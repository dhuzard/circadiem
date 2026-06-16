import OpenAI from "openai";
import { ZodError } from "zod";
import {
  analysisResultSchema,
  type AnalysisResult,
  type VcgBand,
} from "./schema.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt.js";

function stripFence(text: string) {
  return text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503]);

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Decide whether an OpenAI failure is transient and worth retrying.
 * Retries on 429 and 5xx (500/502/503) and on network/timeout errors, which
 * surface without a numeric `status`. Other 4xx (e.g. 400/401/403) fail fast.
 */
function isRetryableError(error: unknown): boolean {
  const status = (error as { status?: number } | undefined)?.status;
  if (typeof status === "number") {
    return RETRYABLE_STATUSES.has(status);
  }
  // No HTTP status => network error, timeout, or aborted request: retry.
  return true;
}

/** Run an OpenAI call with bounded exponential backoff on transient errors. */
async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= MAX_ATTEMPTS || !isRetryableError(error)) {
        throw error;
      }
      const backoff = BASE_DELAY_MS * 2 ** (attempt - 1);
      console.warn(
        `[circadiem] OpenAI call for "${label}" failed (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${backoff}ms.`,
      );
      await delay(backoff);
    }
  }
  throw lastError;
}

async function requestJson(
  client: OpenAI,
  model: string,
  imageBase64: string,
  label: string,
  alignedToDark: boolean,
  vcgBand: string,
  systemPrompt: string,
) {
  const response = await withRetry(label, () =>
    client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildUserPrompt(label, alignedToDark, vcgBand),
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
    }),
  );

  return response.choices[0]?.message?.content?.trim() ?? "";
}

/** Factory for the OpenAI client; overridable in tests to inject a fake. */
export type OpenAIFactory = (apiKey: string) => OpenAI;

const defaultOpenAIFactory: OpenAIFactory = (apiKey) =>
  new OpenAI({ apiKey, timeout: 60_000 });

export async function analyzeImageWithOpenAI(args: {
  apiKey: string;
  model: string;
  imageBuffer: Buffer;
  label: string;
  filename: string;
  alignedToDark: boolean;
  runId: string;
  vcgBand: string;
  systemPrompt?: string;
  onProgress?: (phase: "start" | "done", label: string) => void;
  /**
   * Optional factory for constructing the OpenAI client. Defaults to a real
   * client with a 60s timeout; tests pass a fake to avoid network calls.
   */
  openaiFactory?: OpenAIFactory;
}): Promise<AnalysisResult> {
  const client = (args.openaiFactory ?? defaultOpenAIFactory)(args.apiKey);
  const imageBase64 = args.imageBuffer.toString("base64");

  args.onProgress?.("start", args.label);
  let raw = await requestJson(
    client,
    args.model,
    imageBase64,
    args.label,
    args.alignedToDark,
    args.vcgBand,
    args.systemPrompt ?? SYSTEM_PROMPT,
  );
  let parsed: unknown;

  try {
    parsed = JSON.parse(stripFence(raw));
  } catch {
    console.warn(
      `[circadiem] JSON parse failed for "${args.label}", attempting repair.`,
    );
    const repairResponse = await withRetry(args.label, () =>
      client.chat.completions.create({
        model: args.model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Repair the following model output into valid JSON only. Preserve meaning and return a single JSON object.",
          },
          { role: "user", content: raw },
        ],
      }),
    );
    raw = repairResponse.choices[0]?.message?.content?.trim() ?? "";
    try {
      parsed = JSON.parse(stripFence(raw));
    } catch {
      throw new Error(
        "JSON repair failed: model returned non-parseable output.",
      );
    }
  }

  const parsedObject =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};

  try {
    const result = analysisResultSchema.parse({
      ...parsedObject,
      label: parsedObject.label ?? args.label,
      meta: {
        filename: args.filename,
        model: args.model,
        aligned_to_dark: args.alignedToDark,
        vcg_band: args.vcgBand as VcgBand,
        run_id: args.runId,
      },
    });
    args.onProgress?.("done", args.label);
    return result;
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(
        `Schema validation failed: ${error.issues.map((issue) => issue.path.join(".") + " " + issue.message).join("; ")}`,
      );
    }
    throw error;
  }
}
