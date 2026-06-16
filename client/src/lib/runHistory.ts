import { analysisResponseSchema, type VcgBand } from "../types";
import { VCG_BAND_OPTIONS, type SessionRun } from "./constants";

export function parseRunHistory(raw: string | null): SessionRun[] {
  if (!raw) {
    return [];
  }
  try {
    const decoded = JSON.parse(raw) as unknown;
    if (!Array.isArray(decoded)) {
      return [];
    }
    const parsed: SessionRun[] = [];
    for (const entry of decoded) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const record = entry as Record<string, unknown>;
      if (
        typeof record.runId !== "string" ||
        typeof record.createdAt !== "string" ||
        typeof record.model !== "string" ||
        typeof record.alignedToDark !== "boolean" ||
        typeof record.vcgBand !== "string" ||
        !VCG_BAND_OPTIONS.includes(record.vcgBand as VcgBand) ||
        !Array.isArray(record.results)
      ) {
        continue;
      }
      const parsedResults = analysisResponseSchema.parse({
        results: record.results,
      }).results;
      parsed.push({
        runId: record.runId,
        createdAt: record.createdAt,
        model: record.model,
        alignedToDark: record.alignedToDark,
        vcgBand: record.vcgBand as VcgBand,
        results: parsedResults,
      });
    }
    return parsed;
  } catch {
    return [];
  }
}
