import * as XLSX from "xlsx";
import type { AnalysisRow } from "../types";
import { isErrorRow } from "./results";

export function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function downloadBlob(filename: string, blob: Blob) {
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

export function toExportRows(rows: AnalysisRow[]) {
  return rows.map((row) => ({
    label: row.label,
    baseline_light: isErrorRow(row) ? "" : row.baseline_light,
    dark_onset_burst: isErrorRow(row) ? "" : row.dark_onset_burst,
    dark_irregularity: isErrorRow(row) ? "" : row.dark_irregularity,
    midnight_fragmentation: isErrorRow(row) ? "" : row.midnight_fragmentation,
    pre_light_decline: isErrorRow(row) ? "" : row.pre_light_decline,
    pre_dark_anticipation: isErrorRow(row) ? "" : row.pre_dark_anticipation,
    confidence: isErrorRow(row) ? "" : row.confidence,
    flags: isErrorRow(row) ? "" : row.flags.join("|"),
    notes: isErrorRow(row) ? "" : row.notes,
    filename: row.meta.filename,
    model: row.meta.model,
    aligned_to_dark: row.meta.aligned_to_dark,
    vcg_band: row.meta.vcg_band,
    run_id: row.meta.run_id,
    error: isErrorRow(row) ? row.error : "",
  }));
}

export function exportJson(results: AnalysisRow[]) {
  const blob = new Blob([JSON.stringify(results, null, 2)], {
    type: "application/json",
  });
  downloadBlob("circadiem-results.json", blob);
}

export function exportCsv(results: AnalysisRow[]) {
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

  const rows = toExportRows(results);
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.label,
        row.baseline_light,
        row.dark_onset_burst,
        row.dark_irregularity,
        row.midnight_fragmentation,
        row.pre_light_decline,
        row.pre_dark_anticipation,
        row.confidence,
        row.flags,
        row.notes,
        row.filename,
        row.model,
        row.aligned_to_dark,
        row.vcg_band,
        row.run_id,
        row.error,
      ]
        .map(escapeCsv)
        .join(","),
    );
  }

  downloadBlob(
    "circadiem-results.csv",
    new Blob([lines.join("\n")], { type: "text/csv" }),
  );
}

export function exportXlsx(results: AnalysisRow[]) {
  const rows = toExportRows(results);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Results");
  const output = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  downloadBlob(
    "circadiem-results.xlsx",
    new Blob([output], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
}
