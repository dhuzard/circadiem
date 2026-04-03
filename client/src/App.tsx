import { ChangeEvent, useEffect, useState } from "react";
import {
  analysisResponseSchema,
  type AnalysisRow,
  type UploadItem,
} from "./types";

const STORAGE_KEY = "circadiem-openai-key";

function fileStem(name: string) {
  return name.replace(/\.png$/i, "");
}

function isErrorRow(
  row: AnalysisRow,
): row is Extract<AnalysisRow, { error: string }> {
  return "error" in row;
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function App() {
  const [apiKey, setApiKey] = useState("");
  const [rememberKey, setRememberKey] = useState(false);
  const [model, setModel] = useState("gpt-4o-mini");
  const [alignedToDark, setAlignedToDark] = useState(true);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [results, setResults] = useState<AnalysisRow[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>("Idle");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setApiKey(saved);
        setRememberKey(true);
      }
    } catch {
      // localStorage unavailable (private/sandboxed context)
    }
  }, []);

  useEffect(() => {
    try {
      if (rememberKey && apiKey) {
        window.localStorage.setItem(STORAGE_KEY, apiKey);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // localStorage unavailable (private/sandboxed context)
    }
  }, [apiKey, rememberKey]);

  useEffect(() => {
    return () => {
      for (const item of items) {
        URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, [items]);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []).filter(
      (file) => file.type === "image/png",
    );
    if (!nextFiles.length) {
      return;
    }
    const nextItems = nextFiles.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      label: fileStem(file.name),
      previewUrl: URL.createObjectURL(file),
    }));
    setItems((current) => [...current, ...nextItems]);
    setError(null);
    event.target.value = "";
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

    const body = new FormData();
    for (const item of items) {
      body.append("images", item.file);
    }
    body.append("labels", JSON.stringify(items.map((item) => item.label)));
    body.append("model", model);
    body.append("aligned_to_dark", String(alignedToDark));
    body.append("vcg_band", "+-2SD");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Analysis request failed.");
      }
      const parsed = analysisResponseSchema.parse(payload);
      setResults(parsed.results);
      setStatusText(`Completed ${parsed.results.length} result(s).`);
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

  function exportJson() {
    downloadBlob(
      "circadiem-results.json",
      JSON.stringify(results, null, 2),
      "application/json",
    );
  }

  function exportCsv() {
    const header = [
      "label",
      "baseline_light",
      "dark_onset_burst",
      "dark_irregularity",
      "midnight_fragmentation",
      "pre_light_decline",
      "pre_dark_anticipation",
      "confidence",
      "flags",
      "notes",
      "filename",
      "model",
      "aligned_to_dark",
      "vcg_band",
      "run_id",
      "error",
    ];
    const lines = [header.join(",")];
    for (const row of results) {
      const values = [
        row.label,
        isErrorRow(row) ? "" : row.baseline_light,
        isErrorRow(row) ? "" : row.dark_onset_burst,
        isErrorRow(row) ? "" : row.dark_irregularity,
        isErrorRow(row) ? "" : row.midnight_fragmentation,
        isErrorRow(row) ? "" : row.pre_light_decline,
        isErrorRow(row) ? "" : row.pre_dark_anticipation,
        isErrorRow(row) ? "" : row.confidence,
        isErrorRow(row) ? "" : row.flags.join("|"),
        isErrorRow(row) ? "" : row.notes,
        row.meta.filename,
        row.meta.model,
        row.meta.aligned_to_dark,
        row.meta.vcg_band,
        row.meta.run_id,
        isErrorRow(row) ? row.error : "",
      ];
      lines.push(values.map(escapeCsv).join(","));
    }
    downloadBlob("circadiem-results.csv", lines.join("\n"), "text/csv");
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
            Batch upload aligned PNGs, run the baseline/burst/fragmentation
            rubric, inspect structured results, and export JSON or CSV.
          </p>
        </div>
        <div className="hero-card">
          <p>Expected plot conventions</p>
          <ul>
            <li>Dark onset at `x=0` when aligned</li>
            <li>Global VCG in black</li>
            <li>VCG band shown as `+-2SD`</li>
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
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
            />
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={rememberKey}
              onChange={(event) => setRememberKey(event.target.checked)}
            />
            <span>Remember on this device</span>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={alignedToDark}
              onChange={(event) => setAlignedToDark(event.target.checked)}
            />
            <span>Aligned to dark onset (x=0)</span>
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Upload</h2>
          <span>{items.length} file(s)</span>
        </div>
        <label className="dropzone">
          <input
            type="file"
            accept="image/png"
            multiple
            onChange={onFileChange}
          />
          <strong>Import PNG plots</strong>
          <span>Drop files here or browse. PNG only.</span>
        </label>
        <div className="file-grid">
          {items.map((item) => (
            <article className="file-card" key={item.id}>
              <img src={item.previewUrl} alt={item.label} />
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
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Run</h2>
        </div>
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
                onClick={exportJson}
              >
                Export JSON
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={exportCsv}
              >
                Export CSV
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
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => (
                    <tr key={`${row.meta.run_id}-${row.meta.filename}`}>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="details-grid">
              {results.map((row) => (
                <details
                  className="result-card"
                  key={`details-${row.meta.filename}-${row.label}`}
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
    </main>
  );
}
