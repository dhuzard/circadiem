import cors from "cors";
import express from "express";
import multer from "multer";
import path from "node:path";
import pLimit from "p-limit";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { analyzeImageWithOpenAI } from "./openaiClient.js";
import { analysisResponseSchema, type AnalysisRow } from "./schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, "../../client/dist");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 20,
    fileSize: 10 * 1024 * 1024,
  },
});

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/analyze", upload.array("images", 20), async (req, res) => {
    const authHeader = req.header("authorization") ?? "";
    const apiKey = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";
    if (!apiKey) {
      return res.status(401).json({ error: "Missing bearer API key." });
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
    }

    const labelsInput = req.body.labels
      ? (JSON.parse(req.body.labels) as string[])
      : [];
    const model =
      typeof req.body.model === "string" && req.body.model.trim()
        ? req.body.model.trim()
        : "gpt-4o-mini";
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
          });
        } catch (error) {
          return {
            label,
            error:
              error instanceof Error ? error.message : "Unknown analysis error",
            meta: {
              filename: file.originalname,
              model,
              aligned_to_dark: alignedToDark,
              vcg_band: "+-2SD",
              run_id: runId,
            },
          };
        }
      }),
    );

    const results = await Promise.all(tasks);
    const payload = analysisResponseSchema.parse({ results });
    res.json(payload);
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
