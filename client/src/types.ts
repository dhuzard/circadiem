export {
  analysisResponseSchema,
  type AnalysisRow,
  type AnalysisResult,
  type AnalysisError,
  type VcgBand,
} from "@circadiem/schema";

export type UploadItem = {
  id: string;
  file: File;
  label: string;
  previewUrl: string;
};
