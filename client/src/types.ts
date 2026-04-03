import { z } from "zod";

export const resultMetaSchema = z.object({
  filename: z.string(),
  model: z.string(),
  aligned_to_dark: z.boolean(),
  vcg_band: z.literal("+-2SD"),
  run_id: z.string(),
});

export const analysisResultSchema = z.object({
  label: z.string(),
  baseline_light: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
  ]),
  dark_onset_burst: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
  ]),
  dark_irregularity: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
  ]),
  midnight_fragmentation: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
  ]),
  pre_light_decline: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
  ]),
  pre_dark_anticipation: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
  ]),
  notes: z.string(),
  flags: z.array(z.string()),
  confidence: z.enum(["low", "med", "high"]),
  meta: resultMetaSchema,
});

export const analysisErrorSchema = z.object({
  label: z.string(),
  error: z.string(),
  meta: resultMetaSchema,
});

export const analysisResponseSchema = z.object({
  results: z.array(z.union([analysisResultSchema, analysisErrorSchema])),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type AnalysisError = z.infer<typeof analysisErrorSchema>;
export type AnalysisRow = AnalysisResult | AnalysisError;

export type UploadItem = {
  id: string;
  file: File;
  label: string;
  previewUrl: string;
};
