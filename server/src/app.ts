import cors from "cors";
import express from "express";
import type { Request } from "express";
import multer from "multer";
import path from "node:path";
import pLimit from "p-limit";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { analyzeImageWithOpenAI, type OpenAIFactory } from "./openaiClient.js";
import {
  analysisResponseSchema,
  type AnalysisRow,
  type VcgBand,
} from "./schema.js";
import rateLimit from "express-rate-limit";
import {
  VCG_BAND,
  VCG_BAND_OPTIONS,
  ALLOWED_MODEL_PATTERN,
} from "./constants.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import { createRateLimitStore } from "./rateLimitStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, "../../client/dist");

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function hasPngSignature(buffer: Buffer): boolean {
  return buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIG);
}

function getPngDimensions(
  buffer: Buffer,
): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  if (!hasPngSignature(buffer)) return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 20,
    fileSize: 10 * 1024 * 1024,
  },
});

/** A request-handling failure with a status code and client-facing message. */
type RequestFailure = { status: number; error: string };

function isFailure(value: unknown): value is RequestFailure {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    "error" in value
  );
}

/** Extract and validate the bearer API key (sk- prefix, >= 20 chars). */
function parseApiKey(req: Request): string | RequestFailure {
  const authHeader = req.header("authorization") ?? "";
  const apiKey = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!apiKey) {
    return { status: 401, error: "Missing bearer API key." };
  }
  if (!apiKey.startsWith("sk-") || apiKey.length < 20) {
    return { status: 401, error: "Invalid API key format." };
  }
  return apiKey;
}

/**
 * Validate that at least one file was uploaded and each one is a real PNG:
 * correct MIME, a valid PNG file signature, and within dimension limits.
 * MIME is client-controlled, so the signature check is what actually guards
 * against a spoofed image/png payload whose body is not a PNG.
 */
function validatePngFiles(files: Express.Multer.File[]): RequestFailure | null {
  if (!files.length) {
    return { status: 400, error: "No PNG files uploaded." };
  }
  for (const file of files) {
    if (file.mimetype !== "image/png") {
      return {
        status: 400,
        error: `Invalid file type for ${file.originalname}. Only PNG is supported.`,
      };
    }
    if (!hasPngSignature(file.buffer)) {
      return {
        status: 400,
        error: `Invalid or corrupt PNG: ${file.originalname}`,
      };
    }
    const dims = getPngDimensions(file.buffer);
    if (dims && (dims.width > 8192 || dims.height > 8192)) {
      return {
        status: 400,
        error: `Image ${file.originalname} exceeds maximum dimensions (8192×8192 px).`,
      };
    }
  }
  return null;
}

type AnalyzeOptions = {
  labelsInput: string[];
  model: string;
  vcgBand: string;
  customPrompt: string | undefined;
  alignedToDark: boolean;
};

/** Parse labels/model/vcg_band/custom_prompt/aligned_to_dark from the body. */
function parseAnalyzeOptions(
  body: Record<string, unknown>,
): AnalyzeOptions | RequestFailure {
  let labelsInput: string[] = [];
  if (body.labels) {
    try {
      labelsInput = JSON.parse(body.labels as string) as string[];
    } catch {
      return { status: 400, error: "Invalid labels format." };
    }
  }
  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : "gpt-4o-mini";
  if (!ALLOWED_MODEL_PATTERN.test(model)) {
    return { status: 400, error: "Invalid model identifier." };
  }
  const vcgBand =
    typeof body.vcg_band === "string" &&
    (VCG_BAND_OPTIONS as readonly string[]).includes(body.vcg_band)
      ? body.vcg_band
      : VCG_BAND;
  const customPrompt =
    typeof body.custom_prompt === "string" && body.custom_prompt.trim()
      ? body.custom_prompt.trim()
      : undefined;
  const alignedToDark = String(body.aligned_to_dark ?? "true") !== "false";
  return { labelsInput, model, vcgBand, customPrompt, alignedToDark };
}

export type CreateAppOptions = {
  /**
   * Optional OpenAI client factory forwarded to every analysis call. Lets
   * tests inject a fake client; production passes nothing and gets the real
   * client.
   */
  openaiFactory?: OpenAIFactory;
};

export function createApp(options: CreateAppOptions = {}) {
  const { openaiFactory } = options;
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN ?? "*";
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: "1mb" }));

  const analyzeRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please wait before retrying." },
    // Defaults to express-rate-limit's in-memory store; uses a Redis-backed
    // store instead when REDIS_URL is set (see rateLimitStore.ts).
    store: createRateLimitStore(),
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post(
    "/api/analyze",
    analyzeRateLimit,
    upload.array("images", 20),
    async (req, res) => {
      const apiKey = parseApiKey(req);
      if (isFailure(apiKey)) {
        return res.status(apiKey.status).json({ error: apiKey.error });
      }

      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      const fileError = validatePngFiles(files);
      if (fileError) {
        return res.status(fileError.status).json({ error: fileError.error });
      }

      const options = parseAnalyzeOptions(req.body);
      if (isFailure(options)) {
        return res.status(options.status).json({ error: options.error });
      }
      const { labelsInput, model, vcgBand, customPrompt, alignedToDark } =
        options;
      const runId = randomUUID();
      const limit = pLimit(2);

      const tasks = files.map((file, index) =>
        limit(async (): Promise<AnalysisRow> => {
          const label =
            labelsInput[index]?.trim() ||
            file.originalname.replace(/\.png$/i, "");
          try {
            return await analyzeImageWithOpenAI({
              apiKey,
              model,
              imageBuffer: file.buffer,
              filename: file.originalname,
              label,
              alignedToDark,
              runId,
              vcgBand,
              systemPrompt: customPrompt,
              openaiFactory,
            });
          } catch (error) {
            console.error(`[circadiem] Analysis failed for "${label}":`, error);
            return {
              label,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown analysis error",
              meta: {
                filename: file.originalname,
                model,
                aligned_to_dark: alignedToDark,
                vcg_band: vcgBand as VcgBand,
                run_id: runId,
              },
            };
          }
        }),
      );

      const results = await Promise.all(tasks);
      const payload = analysisResponseSchema.parse({ results });
      res.json(payload);
    },
  );

  app.post(
    "/api/analyze/stream",
    analyzeRateLimit,
    upload.array("images", 20),
    async (req, res) => {
      const apiKey = parseApiKey(req);
      if (isFailure(apiKey)) {
        return res.status(apiKey.status).json({ error: apiKey.error });
      }

      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      const fileError = validatePngFiles(files);
      if (fileError) {
        return res.status(fileError.status).json({ error: fileError.error });
      }

      const options = parseAnalyzeOptions(req.body);
      if (isFailure(options)) {
        return res.status(options.status).json({ error: options.error });
      }
      const { labelsInput, model, vcgBand, customPrompt, alignedToDark } =
        options;
      const runId = randomUUID();
      const limit = pLimit(2);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const sendEvent = (data: object) => {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      };

      const tasks = files.map((file, index) =>
        limit(async (): Promise<AnalysisRow> => {
          const label =
            labelsInput[index]?.trim() ||
            file.originalname.replace(/\.png$/i, "");
          sendEvent({ index, label, status: "analyzing" });
          try {
            const result = await analyzeImageWithOpenAI({
              apiKey,
              model,
              imageBuffer: file.buffer,
              filename: file.originalname,
              label,
              alignedToDark,
              runId,
              vcgBand,
              systemPrompt: customPrompt,
              openaiFactory,
            });
            sendEvent({ index, label, status: "done", result });
            return result;
          } catch (error) {
            console.error(`[circadiem] Analysis failed for "${label}":`, error);
            const errorRow: AnalysisRow = {
              label,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown analysis error",
              meta: {
                filename: file.originalname,
                model,
                aligned_to_dark: alignedToDark,
                vcg_band: vcgBand as VcgBand,
                run_id: runId,
              },
            };
            sendEvent({ index, label, status: "error", result: errorRow });
            return errorRow;
          }
        }),
      );

      await Promise.all(tasks);
      sendEvent({ done: true });
      res.end();
    },
  );

  app.get("/api/prompt", (_req, res) => {
    res.json({ prompt: SYSTEM_PROMPT });
  });

  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.join(clientDist, "index.html"));
  });

  return app;
}
