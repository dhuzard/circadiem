import { analysisResponseSchema, type AnalysisRow } from "../types";
import type { FileProgress } from "./constants";
import { isErrorRow } from "./results";
import type { UploadItem } from "../types";

export type AnalyzeOptions = {
  model: string;
  alignedToDark: boolean;
  vcgBand: string;
  customPromptEnabled: boolean;
  customPrompt: string;
};

export function createFormData(
  batchItems: UploadItem,
  options: AnalyzeOptions,
) {
  const body = new FormData();
  body.append("images", batchItems.file);
  body.append("labels", JSON.stringify([batchItems.label]));
  body.append("model", options.model);
  body.append("aligned_to_dark", String(options.alignedToDark));
  body.append("vcg_band", options.vcgBand);
  if (options.customPromptEnabled && options.customPrompt.trim()) {
    body.append("custom_prompt", options.customPrompt.trim());
  }
  return body;
}

export function createBatchFormData(
  batchItems: UploadItem[],
  options: AnalyzeOptions,
) {
  const body = new FormData();
  for (const item of batchItems) {
    body.append("images", item.file);
  }
  body.append("labels", JSON.stringify(batchItems.map((item) => item.label)));
  body.append("model", options.model);
  body.append("aligned_to_dark", String(options.alignedToDark));
  body.append("vcg_band", options.vcgBand);
  if (options.customPromptEnabled && options.customPrompt.trim()) {
    body.append("custom_prompt", options.customPrompt.trim());
  }
  return body;
}

export async function readJsonError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error;
    }
  } catch {
    // ignore JSON parse errors
  }
  return `Request failed (${response.status}).`;
}

type StreamCallbacks = {
  onProgress: (id: string, progress: FileProgress) => void;
  onStatus: (text: string) => void;
};

export async function analyzeWithStream(
  batchItems: UploadItem[],
  apiKey: string,
  options: AnalyzeOptions,
  callbacks: StreamCallbacks,
) {
  if (!batchItems.length) {
    return [] as AnalysisRow[];
  }

  const response = await fetch("/api/analyze/stream", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: createBatchFormData(batchItems, options),
  });

  if (!response.ok) {
    throw new Error(await readJsonError(response));
  }

  if (!response.body) {
    throw new Error("Streaming response body is unavailable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const rowsByIndex = new Map<number, AnalysisRow>();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const splitIndex = buffer.indexOf("\n\n");
      if (splitIndex < 0) {
        break;
      }

      const block = buffer.slice(0, splitIndex).trim();
      buffer = buffer.slice(splitIndex + 2);
      if (!block.startsWith("data:")) {
        continue;
      }

      const dataText = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");

      if (!dataText) {
        continue;
      }

      let payload: unknown;
      try {
        payload = JSON.parse(dataText);
      } catch {
        continue;
      }

      if (!payload || typeof payload !== "object") {
        continue;
      }

      const event = payload as Record<string, unknown>;
      if (event.done === true) {
        continue;
      }

      const index = typeof event.index === "number" ? event.index : -1;
      if (index < 0 || index >= batchItems.length) {
        continue;
      }

      const item = batchItems[index];
      const status = typeof event.status === "string" ? event.status : "";

      if (status === "analyzing") {
        callbacks.onProgress(item.id, { status: "analyzing" });
        callbacks.onStatus(`Analyzing ${event.label ?? item.label}...`);
        continue;
      }

      if (status !== "done" && status !== "error") {
        continue;
      }

      const parsed = analysisResponseSchema.parse({
        results: [event.result],
      }).results[0];

      rowsByIndex.set(index, parsed);
      callbacks.onProgress(item.id, {
        status: isErrorRow(parsed) ? "error" : "done",
        message: isErrorRow(parsed) ? parsed.error : undefined,
      });
    }
  }

  const ordered = Array.from({ length: batchItems.length }, (_, index) =>
    rowsByIndex.get(index),
  );

  if (ordered.some((row) => !row)) {
    throw new Error("Stream ended before all results were received.");
  }

  return ordered as AnalysisRow[];
}

export async function analyzeSingle(
  item: UploadItem,
  apiKey: string,
  options: AnalyzeOptions,
) {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: createFormData(item, options),
  });
  if (!response.ok) {
    throw new Error(await readJsonError(response));
  }
  const payload = await response.json();
  const parsed = analysisResponseSchema.parse(payload);
  return parsed.results[0];
}
