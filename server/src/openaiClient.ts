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

async function requestJson(
  client: OpenAI,
  model: string,
  imageBase64: string,
  label: string,
  alignedToDark: boolean,
  vcgBand: string,
  systemPrompt: string,
) {
  const response = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: buildUserPrompt(label, alignedToDark, vcgBand) },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${imageBase64}`,
            },
          },
        ],
      },
    ],
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}

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
}): Promise<AnalysisResult> {
  const client = new OpenAI({ apiKey: args.apiKey, timeout: 60_000 });
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
    console.warn(`[circadiem] JSON parse failed for "${args.label}", attempting repair.`);
    const repairResponse = await client.chat.completions.create({
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
    });
    raw = repairResponse.choices[0]?.message?.content?.trim() ?? "";
    try {
      parsed = JSON.parse(stripFence(raw));
    } catch {
      throw new Error("JSON repair failed: model returned non-parseable output.");
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
