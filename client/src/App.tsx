import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type AnalysisRow,
  type UploadItem,
  type VcgBand,
  analysisResponseSchema,
} from "./types";
import {
  CURATED_MODELS,
  SCORE_COLUMNS,
  VCG_BAND_OPTIONS,
  type FileProgress,
  type ThemeMode,
} from "./lib/constants";
import { fileStem, isErrorRow, scoreFor, shortRunId } from "./lib/results";
import { exportCsv, exportJson, exportXlsx } from "./lib/export";
import {
  type AnalyzeOptions,
  analyzeSingle,
  analyzeWithStream,
} from "./lib/api";
import { useApiKey } from "./hooks/useApiKey";
import { useTheme } from "./hooks/useTheme";
import { useRunHistory } from "./hooks/useRunHistory";

export function App() {
  const { apiKey, setApiKey, rememberKey, setRememberKey } = useApiKey();
  const [model, setModel] = useState<string>(CURATED_MODELS[0]);
  const [alignedToDark, setAlignedToDark] = useState(true);
  const [vcgBand, setVcgBand] = useState<VcgBand>("+-2SD");
  const [customPromptEnabled, setCustomPromptEnabled] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [defaultPrompt, setDefaultPrompt] = useState<string>("");

  const [items, setItems] = useState<UploadItem[]>([]);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  const [results, setResults] = useState<AnalysisRow[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>("Idle");
  const [fileProgress, setFileProgress] = useState<
    Record<string, FileProgress>
  >({});

  const { theme, setTheme } = useTheme();
  const {
    runHistory,
    comparisonRunIds,
    setComparisonRunIds,
    comparisonRuns,
    persistRun,
    removeRunFromHistory,
    clearHistory,
  } = useRunHistory();

  const itemsRef = useRef<UploadItem[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/prompt");
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { prompt?: unknown };
        if (typeof payload.prompt === "string" && payload.prompt.trim()) {
          setDefaultPrompt(payload.prompt);
          setCustomPrompt(payload.prompt);
        }
      } catch {
        // prompt fetch is optional
      }
    })();
  }, []);

  const progressSummary = useMemo(() => {
    const statuses = items.map(
      (item) => fileProgress[item.id]?.status ?? "idle",
    );
    const finished = statuses.filter(
      (status) => status === "done" || status === "error",
    ).length;
    return {
      total: items.length,
      finished,
      percent: items.length ? Math.round((finished / items.length) * 100) : 0,
    };
  }, [fileProgress, items]);

  function analyzeOptions(): AnalyzeOptions {
    return {
      model,
      alignedToDark,
      vcgBand,
      customPromptEnabled,
      customPrompt,
    };
  }

  function buildUploadItemsFromFiles(nextFiles: File[]) {
    return nextFiles
      .filter((file) => file.type === "image/png")
      .map(
        (file) =>
          ({
            id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
            file,
            label: fileStem(file.name),
            previewUrl: URL.createObjectURL(file),
          }) satisfies UploadItem,
      );
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextItems = buildUploadItemsFromFiles(
      Array.from(event.target.files ?? []),
    );
    if (!nextItems.length) {
      return;
    }
    setItems((current) => [...current, ...nextItems]);
    setError(null);
    event.target.value = "";
  }

  function moveItem(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
      return;
    }
    setItems((current) => {
      if (fromIndex >= current.length || toIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function onDropFiles(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const dropped = buildUploadItemsFromFiles(
      Array.from(event.dataTransfer.files),
    );
    if (!dropped.length) {
      return;
    }
    setItems((current) => [...current, ...dropped]);
    setError(null);
  }

  async function runAnalysis() {
    if (!apiKey.trim()) {
      setError("Enter an OpenAI API key.");
      return;
    }
    if (!items.length) {
      setError("Upload at least one PNG.");
      return;
    }

    setRunning(true);
    setError(null);
    setStatusText(`Analyzing ${items.length} PNG file(s)...`);
    setFileProgress(
      Object.fromEntries(
        items.map((item) => [item.id, { status: "queued" }]),
      ) as Record<string, FileProgress>,
    );

    try {
      const streamedResults = await analyzeWithStream(
        items,
        apiKey,
        analyzeOptions(),
        {
          onProgress: (id, progress) =>
            setFileProgress((current) => ({ ...current, [id]: progress })),
          onStatus: setStatusText,
        },
      );
      const parsed = analysisResponseSchema.parse({ results: streamedResults });
      setResults(parsed.results);
      setStatusText(`Completed ${parsed.results.length} result(s).`);

      const runId = parsed.results[0]?.meta.run_id ?? crypto.randomUUID();
      persistRun({
        runId,
        createdAt: new Date().toISOString(),
        model,
        alignedToDark,
        vcgBand,
        results: parsed.results,
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unknown request error.",
      );
      setStatusText("Failed");
    } finally {
      setRunning(false);
    }
  }

  async function retryRow(row: AnalysisRow, index: number) {
    if (running) {
      return;
    }

    const sourceItem = items[index];
    if (!sourceItem) {
      setError("Retry unavailable: source upload item could not be located.");
      return;
    }

    setRunning(true);
    setError(null);
    setStatusText(`Retrying ${sourceItem.label}...`);
    setFileProgress((current) => ({
      ...current,
      [sourceItem.id]: { status: "queued" },
    }));

    try {
      const retried = await analyzeSingle(sourceItem, apiKey, analyzeOptions());
      setResults((current) => {
        const next = [...current];
        next[index] = retried;
        return next;
      });
      setFileProgress((current) => ({
        ...current,
        [sourceItem.id]: {
          status: isErrorRow(retried) ? "error" : "done",
          message: isErrorRow(retried) ? retried.error : undefined,
        },
      }));
      setStatusText(`Retry completed for ${row.label}.`);
    } catch (retryError) {
      setError(
        retryError instanceof Error ? retryError.message : "Retry failed.",
      );
      setStatusText("Retry failed");
      setFileProgress((current) => ({
        ...current,
        [sourceItem.id]: { status: "error" },
      }));
    } finally {
      setRunning(false);
    }
  }

  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify(results, null, 2));
    setStatusText("Copied JSON to clipboard.");
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Circadiem</p>
          <h1>Review circadian plot PNGs with an OpenAI vision rubric.</h1>
          <p className="lede">
            Batch upload aligned PNGs, stream per-file progress, retry failures,
            compare past runs, and export JSON, CSV, or Excel.
          </p>
        </div>
        <div className="hero-card">
          <p>Expected plot conventions</p>
          <ul>
            <li>Dark onset at x=0 when aligned</li>
            <li>Global VCG in black</li>
            <li>VCG band currently selected: {vcgBand}</li>
          </ul>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Settings</h2>
          <span>{statusText}</span>
        </div>
        <div className="settings-grid">
          <label>
            <span>OpenAI API key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
            />
          </label>

          <label>
            <span>Model</span>
            <select
              value={model}
              onChange={(event) => setModel(event.target.value)}
            >
              {!CURATED_MODELS.includes(
                model as (typeof CURATED_MODELS)[number],
              ) && <option value={model}>{model}</option>}
              {CURATED_MODELS.map((modelId) => (
                <option key={modelId} value={modelId}>
                  {modelId}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>VCG band</span>
            <select
              value={vcgBand}
              onChange={(event) => setVcgBand(event.target.value as VcgBand)}
            >
              {VCG_BAND_OPTIONS.map((band) => (
                <option key={band} value={band}>
                  {band}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Theme</span>
            <select
              value={theme}
              onChange={(event) => setTheme(event.target.value as ThemeMode)}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={rememberKey}
              onChange={(event) => setRememberKey(event.target.checked)}
            />
            <span>Remember key on this device</span>
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={alignedToDark}
              onChange={(event) => setAlignedToDark(event.target.checked)}
            />
            <span>Aligned to dark onset (x=0)</span>
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={customPromptEnabled}
              onChange={(event) => setCustomPromptEnabled(event.target.checked)}
            />
            <span>Override rubric (custom system prompt)</span>
          </label>
        </div>

        <div className="prompt-editor">
          <div className="prompt-editor-title">
            <strong>Rubric prompt</strong>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setCustomPrompt(defaultPrompt)}
              disabled={!defaultPrompt}
            >
              Reset to default
            </button>
          </div>
          <textarea
            value={customPrompt}
            onChange={(event) => setCustomPrompt(event.target.value)}
            disabled={!customPromptEnabled}
            placeholder="Prompt will load from /api/prompt when available"
          />
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Upload</h2>
          <span>{items.length} file(s)</span>
        </div>
        <label
          className="dropzone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDropFiles}
        >
          <input
            type="file"
            accept="image/png"
            multiple
            onChange={onFileChange}
          />
          <strong>Import PNG plots</strong>
          <span>
            Drop files here or browse. Drag cards to reorder before analysis.
          </span>
        </label>

        <div className="file-grid">
          {items.map((item, index) => {
            const progress = fileProgress[item.id]?.status ?? "idle";
            return (
              <article
                className="file-card"
                key={item.id}
                draggable
                onDragStart={() => setDraggedItemId(item.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (!draggedItemId || draggedItemId === item.id) {
                    return;
                  }
                  const fromIndex = items.findIndex(
                    (entry) => entry.id === draggedItemId,
                  );
                  moveItem(fromIndex, index);
                  setDraggedItemId(null);
                }}
                onDragEnd={() => setDraggedItemId(null)}
              >
                <img src={item.previewUrl} alt={item.label} />
                <div className="file-meta-row">
                  <span className="file-index">#{index + 1}</span>
                  <span className={`progress-badge progress-${progress}`}>
                    {progress}
                  </span>
                </div>
                <input
                  value={item.label}
                  onChange={(event) => {
                    const nextLabel = event.target.value;
                    setItems((current) =>
                      current.map((entry) =>
                        entry.id === item.id
                          ? { ...entry, label: nextLabel }
                          : entry,
                      ),
                    );
                  }}
                />
                <div className="file-card-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => moveItem(index, Math.max(0, index - 1))}
                    disabled={index === 0}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      moveItem(index, Math.min(items.length - 1, index + 1))
                    }
                    disabled={index === items.length - 1}
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      URL.revokeObjectURL(item.previewUrl);
                      setItems((current) =>
                        current.filter((entry) => entry.id !== item.id),
                      );
                    }}
                  >
                    Remove
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Run</h2>
          <span>
            {progressSummary.finished}/{progressSummary.total} files
          </span>
        </div>

        {items.length > 0 && (
          <div className="progress-wrap" aria-label="Analysis progress">
            <div
              className="progress-bar"
              style={{ width: `${progressSummary.percent}%` }}
            />
          </div>
        )}

        <div className="action-row">
          <button
            type="button"
            className="primary-button"
            disabled={running}
            onClick={runAnalysis}
          >
            {running ? "Analyzing..." : "Analyze PNGs"}
          </button>
          {results.length > 0 && (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={() => exportJson(results)}
              >
                Export JSON
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => exportCsv(results)}
              >
                Export CSV
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => exportXlsx(results)}
              >
                Export XLSX
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={copyJson}
              >
                Copy JSON
              </button>
            </>
          )}
        </div>
        {error && <p className="error-text">{error}</p>}
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Results</h2>
          <span>{results.length} row(s)</span>
        </div>
        {results.length === 0 ? (
          <p className="empty-state">No results yet.</p>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Baseline</th>
                    <th>Burst</th>
                    <th>Irregularity</th>
                    <th>Fragmentation</th>
                    <th>Decline</th>
                    <th>Anticipation</th>
                    <th>Confidence</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, index) => (
                    <tr
                      key={`${row.meta.run_id}-${row.meta.filename}-${index}`}
                    >
                      <td>{row.label}</td>
                      <td>{isErrorRow(row) ? "-" : row.baseline_light}</td>
                      <td>{isErrorRow(row) ? "-" : row.dark_onset_burst}</td>
                      <td>{isErrorRow(row) ? "-" : row.dark_irregularity}</td>
                      <td>
                        {isErrorRow(row) ? "-" : row.midnight_fragmentation}
                      </td>
                      <td>{isErrorRow(row) ? "-" : row.pre_light_decline}</td>
                      <td>
                        {isErrorRow(row) ? "-" : row.pre_dark_anticipation}
                      </td>
                      <td>{isErrorRow(row) ? "-" : row.confidence}</td>
                      <td>{isErrorRow(row) ? "error" : "ok"}</td>
                      <td>
                        {isErrorRow(row) && items[index] && (
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => void retryRow(row, index)}
                            disabled={running}
                          >
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="details-grid">
              {results.map((row, index) => (
                <details
                  className="result-card"
                  key={`details-${row.meta.filename}-${row.label}-${index}`}
                >
                  <summary>
                    <span>{row.label}</span>
                    <span>{isErrorRow(row) ? "error" : row.confidence}</span>
                  </summary>
                  {isErrorRow(row) ? (
                    <p className="error-text">{row.error}</p>
                  ) : (
                    <>
                      <p>{row.notes}</p>
                      <p>
                        <strong>Flags:</strong>{" "}
                        {row.flags.length ? row.flags.join(", ") : "none"}
                      </p>
                    </>
                  )}
                  <pre>{JSON.stringify(row, null, 2)}</pre>
                </details>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Session history</h2>
          <span>{runHistory.length} run(s)</span>
        </div>

        {runHistory.length === 0 ? (
          <p className="empty-state">No saved runs yet.</p>
        ) : (
          <>
            <div className="history-grid">
              {runHistory.map((run) => {
                const selected = comparisonRunIds.includes(run.runId);
                return (
                  <article className="history-card" key={run.runId}>
                    <p>
                      <strong>Run {shortRunId(run.runId)}</strong>
                    </p>
                    <p>
                      {new Date(run.createdAt).toLocaleString()} |{" "}
                      {run.results.length} row(s)
                    </p>
                    <p>
                      model={run.model}, vcg={run.vcgBand}, aligned=
                      {String(run.alignedToDark)}
                    </p>
                    <div className="history-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          setResults(run.results);
                          setStatusText(
                            `Loaded ${run.results.length} row(s) from run ${shortRunId(run.runId)}.`,
                          );
                        }}
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          setComparisonRunIds((current) =>
                            selected
                              ? current.filter((id) => id !== run.runId)
                              : [...current, run.runId].slice(-4),
                          )
                        }
                      >
                        {selected ? "Uncompare" : "Compare"}
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => removeRunFromHistory(run.runId)}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="action-row">
              <button
                type="button"
                className="secondary-button"
                onClick={clearHistory}
              >
                Clear history
              </button>
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Batch comparison</h2>
          <span>{comparisonRuns.length} selected run(s)</span>
        </div>
        {comparisonRuns.length === 0 ? (
          <p className="empty-state">
            Select one or more runs from history to compare.
          </p>
        ) : (
          <div className="comparison-grid">
            {comparisonRuns.map((run) => (
              <article className="comparison-card" key={`compare-${run.runId}`}>
                <h3>
                  Run {shortRunId(run.runId)} ({run.results.length} rows)
                </h3>
                <p>
                  {new Date(run.createdAt).toLocaleString()} | {run.model} |{" "}
                  {run.vcgBand}
                </p>
                <div className="table-wrap">
                  <table className="heatmap-table">
                    <thead>
                      <tr>
                        <th>Label</th>
                        {SCORE_COLUMNS.map((column) => (
                          <th
                            key={`${run.runId}-${column.key}`}
                            title={column.label}
                          >
                            {column.short}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {run.results.map((row, rowIndex) => (
                        <tr
                          key={`${run.runId}-${row.meta.filename}-${rowIndex}`}
                        >
                          <td>{row.label}</td>
                          {SCORE_COLUMNS.map((column) => {
                            const score = scoreFor(row, column.key);
                            return (
                              <td
                                key={`${run.runId}-${row.label}-${column.key}`}
                              >
                                <span
                                  className={`score-chip ${
                                    score === null
                                      ? "score-error"
                                      : `score-${score}`
                                  }`}
                                >
                                  {score === null ? "!" : score}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
