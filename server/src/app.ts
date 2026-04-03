import cors from "cors";
import express from "express";
import multer from "multer";
import path from "node:path";
import pLimit from "p-limit";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { analyzeImageWithOpenAI } from "./openaiClient.js";
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, "../../client/dist");

function getPngDimensions(
  buffer: Buffer,
): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buffer.subarray(0, 8).equals(PNG_SIG)) return null;
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

export function createApp() {
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
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post(
    "/api/analyze",
    analyzeRateLimit,
    upload.array("images", 20),
    async (req, res) => {
      const authHeader = req.header("authorization") ?? "";
      const apiKey = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : "";
      if (!apiKey) {
        return res.status(401).json({ error: "Missing bearer API key." });
      }
      if (!apiKey.startsWith("sk-") || apiKey.length < 20) {
        return res.status(401).json({ error: "Invalid API key format." });
      }

      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (!files.length) {
        return res.status(400).json({ error: "No PNG files uploaded." });
      }

      for (const file of files) {
        if (file.mimetype !== "image/png") {
          return res.status(400).json({
            error: `Invalid file type for ${file.originalname}. Only PNG is supported.`,
          });
        }
        const dims = getPngDimensions(file.buffer);
        if (dims && (dims.width > 8192 || dims.height > 8192)) {
          return res.status(400).json({
            error: `Image ${file.originalname} exceeds maximum dimensions (8192×8192 px).`,
          });
        }
      }

      let labelsInput: string[] = [];
      if (req.body.labels) {
        try {
          labelsInput = JSON.parse(req.body.labels) as string[];
        } catch {
          return res.status(400).json({ error: "Invalid labels format." });
        }
      }
      const model =
        typeof req.body.model === "string" && req.body.model.trim()
          ? req.body.model.trim()
          : "gpt-4o-mini";
      if (!ALLOWED_MODEL_PATTERN.test(model)) {
        return res.status(400).json({ error: "Invalid model identifier." });
      }
      const vcgBand =
        typeof req.body.vcg_band === "string" &&
        (VCG_BAND_OPTIONS as readonly string[]).includes(req.body.vcg_band)
          ? req.body.vcg_band
          : VCG_BAND;
      const customPrompt =
        typeof req.body.custom_prompt === "string" &&
        req.body.custom_prompt.trim()
          ? req.body.custom_prompt.trim()
          : undefined;
      const alignedToDark =
        String(req.body.aligned_to_dark ?? "true") !== "false";
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
      const authHeader = req.header("authorization") ?? "";
      const apiKey = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : "";
      if (!apiKey) {
        return res.status(401).json({ error: "Missing bearer API key." });
      }
      if (!apiKey.startsWith("sk-") || apiKey.length < 20) {
        return res.status(401).json({ error: "Invalid API key format." });
      }

      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (!files.length) {
        return res.status(400).json({ error: "No PNG files uploaded." });
      }

      for (const file of files) {
        if (file.mimetype !== "image/png") {
          return res.status(400).json({
            error: `Invalid file type for ${file.originalname}. Only PNG is supported.`,
          });
        }
        const dims = getPngDimensions(file.buffer);
        if (dims && (dims.width > 8192 || dims.height > 8192)) {
          return res.status(400).json({
            error: `Image ${file.originalname} exceeds maximum dimensions (8192×8192 px).`,
          });
        }
      }

      let labelsInput: string[] = [];
      if (req.body.labels) {
        try {
          labelsInput = JSON.parse(req.body.labels) as string[];
        } catch {
          return res.status(400).json({ error: "Invalid labels format." });
        }
      }

      const model =
        typeof req.body.model === "string" && req.body.model.trim()
          ? req.body.model.trim()
          : "gpt-4o-mini";
      if (!ALLOWED_MODEL_PATTERN.test(model)) {
        return res.status(400).json({ error: "Invalid model identifier." });
      }

      const alignedToDark =
        String(req.body.aligned_to_dark ?? "true") !== "false";
      const vcgBand =
        typeof req.body.vcg_band === "string" &&
        (VCG_BAND_OPTIONS as readonly string[]).includes(req.body.vcg_band)
          ? req.body.vcg_band
          : VCG_BAND;
      const customPrompt =
        typeof req.body.custom_prompt === "string" &&
        req.body.custom_prompt.trim()
          ? req.body.custom_prompt.trim()
          : undefined;
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
