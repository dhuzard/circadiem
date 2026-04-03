import { z } from "zod";

export const scoreSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

export const resultMetaSchema = z.object({
  filename: z.string().min(1),
  model: z.string().min(1),
  aligned_to_dark: z.boolean(),
  vcg_band: z.enum(["+-2SD", "+-1SD", "+-3SD"]),
  run_id: z.string().min(1),
});

export const analysisResultSchema = z.object({
  label: z.string().min(1),
  baseline_light: scoreSchema,
  dark_onset_burst: scoreSchema,
  dark_irregularity: scoreSchema,
  midnight_fragmentation: scoreSchema,
  pre_light_decline: scoreSchema,
  pre_dark_anticipation: scoreSchema,
  notes: z.string().min(1).max(1600),
  flags: z.array(z.string().min(1)).max(20),
  confidence: z.enum(["low", "med", "high"]),
  meta: resultMetaSchema,
});

export const analysisErrorSchema = z.object({
  label: z.string().min(1),
  error: z.string().min(1),
  meta: resultMetaSchema,
});

export const analysisResponseSchema = z.object({
  results: z.array(z.union([analysisResultSchema, analysisErrorSchema])),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type AnalysisError = z.infer<typeof analysisErrorSchema>;
export type AnalysisRow = AnalysisResult | AnalysisError;
export type VcgBand = z.infer<typeof resultMetaSchema>["vcg_band"];
