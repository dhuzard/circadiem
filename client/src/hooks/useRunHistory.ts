import { useEffect, useMemo, useState } from "react";
import {
  MAX_HISTORY_RUNS,
  RUN_HISTORY_STORAGE_KEY,
  type SessionRun,
} from "../lib/constants";
import { parseRunHistory } from "../lib/runHistory";

export function useRunHistory() {
  const [runHistory, setRunHistory] = useState<SessionRun[]>([]);
  const [comparisonRunIds, setComparisonRunIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      setRunHistory(
        parseRunHistory(window.localStorage.getItem(RUN_HISTORY_STORAGE_KEY)),
      );
    } catch {
      // localStorage unavailable
    }
  }, []);

  const comparisonRuns = useMemo(() => {
    const index = new Map(runHistory.map((run) => [run.runId, run]));
    return comparisonRunIds
      .map((id) => index.get(id))
      .filter((run): run is SessionRun => Boolean(run));
  }, [comparisonRunIds, runHistory]);

  function persistRun(entry: SessionRun) {
    setRunHistory((current) => {
      const next = [
        entry,
        ...current.filter((run) => run.runId !== entry.runId),
      ].slice(0, MAX_HISTORY_RUNS);
      try {
        window.localStorage.setItem(
          RUN_HISTORY_STORAGE_KEY,
          JSON.stringify(next),
        );
      } catch {
        // localStorage unavailable
      }
      return next;
    });
    setComparisonRunIds((current) =>
      [entry.runId, ...current.filter((id) => id !== entry.runId)].slice(0, 4),
    );
  }

  function removeRunFromHistory(runId: string) {
    setRunHistory((current) => {
      const next = current.filter((run) => run.runId !== runId);
      try {
        window.localStorage.setItem(
          RUN_HISTORY_STORAGE_KEY,
          JSON.stringify(next),
        );
      } catch {
        // localStorage unavailable
      }
      return next;
    });
    setComparisonRunIds((current) => current.filter((id) => id !== runId));
  }

  function clearHistory() {
    setRunHistory([]);
    setComparisonRunIds([]);
    try {
      window.localStorage.removeItem(RUN_HISTORY_STORAGE_KEY);
    } catch {
      // localStorage unavailable
    }
  }

  return {
    runHistory,
    comparisonRunIds,
    setComparisonRunIds,
    comparisonRuns,
    persistRun,
    removeRunFromHistory,
    clearHistory,
  };
}
