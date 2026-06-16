import type { AnalysisRow } from "../types";
import type { ScoreKey } from "./constants";

export function fileStem(name: string) {
  return name.replace(/\.png$/i, "");
}

export function isErrorRow(
  row: AnalysisRow,
): row is Extract<AnalysisRow, { error: string }> {
  return "error" in row;
}

export function scoreFor(row: AnalysisRow, key: ScoreKey) {
  return isErrorRow(row) ? null : row[key];
}

export function shortRunId(id: string) {
  return id.slice(0, 8);
}
