import type { AnalysisRow, VcgBand } from "../types";

export const STORAGE_KEY = "circadiem-openai-key";
export const THEME_STORAGE_KEY = "circadiem-theme";
export const RUN_HISTORY_STORAGE_KEY = "circadiem-run-history-v1";
export const MAX_HISTORY_RUNS = 25;

export const CURATED_MODELS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4.1-mini",
  "gpt-4.1",
  "o4-mini",
] as const;

export const VCG_BAND_OPTIONS: readonly VcgBand[] = ["+-2SD", "+-1SD", "+-3SD"];

export type ThemeMode = "system" | "light" | "dark";
export type FileProgressStatus =
  | "idle"
  | "queued"
  | "analyzing"
  | "done"
  | "error";

export type FileProgress = {
  status: FileProgressStatus;
  message?: string;
};

export type ScoreKey =
  | "baseline_light"
  | "dark_onset_burst"
  | "dark_irregularity"
  | "midnight_fragmentation"
  | "pre_light_decline"
  | "pre_dark_anticipation";

export type SessionRun = {
  runId: string;
  createdAt: string;
  model: string;
  alignedToDark: boolean;
  vcgBand: VcgBand;
  results: AnalysisRow[];
};

export const SCORE_COLUMNS: ReadonlyArray<{
  key: ScoreKey;
  short: string;
  label: string;
}> = [
  { key: "baseline_light", short: "B", label: "Baseline" },
  { key: "dark_onset_burst", short: "O", label: "Burst" },
  { key: "dark_irregularity", short: "I", label: "Irregularity" },
  { key: "midnight_fragmentation", short: "F", label: "Fragmentation" },
  { key: "pre_light_decline", short: "D", label: "Decline" },
  { key: "pre_dark_anticipation", short: "A", label: "Anticipation" },
];
