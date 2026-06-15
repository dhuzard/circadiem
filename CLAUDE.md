# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Circadiem batch-feeds circadian activity PNG plots to an OpenAI vision model, scores six circadian markers on a fixed 0–3 rubric, and returns structured JSON/CSV. The OpenAI API key is supplied by the user in the UI and forwarded per-request as a bearer token — it is **never stored server-side** and there is no auth/user system. See `README.md` for the product rubric, marker definitions, and full HTTP API reference.

> Note: package `name` fields are still `vision-review*` (the project's former name); the product, npm scope (`@circadiem/schema`), and log prefix (`[circadiem]`) are "circadiem". Don't "fix" this mismatch without being asked.

## Commands

Run from the repo root; npm workspaces fan out to the right package.

```bash
npm run dev            # client (5173) + server (5174) concurrently in watch mode
npm run build          # builds @circadiem/schema → client → server (order matters, see below)
npm start              # production server on PORT (default 5174); serves API + built client
npm test               # server tests via Node's built-in runner
npm run typecheck      # tsc across client + server
npm run format         # prettier --write .
npm run check          # format:check + typecheck + test — this is the CI gate (.github/workflows)
```

Run a single server test (no per-file npm script — invoke the runner directly):

```bash
cd server && node --import tsx/esm --test tests/schema.test.ts
node --import tsx/esm --test --test-name-pattern="out-of-range" tests/schema.test.ts
```

The `tests/` dir contains both `*.test.ts` (run by `npm test`, glob `tests/*.test.ts`) and stale `*.test.mjs` copies that are **not** run. Add new tests as `.ts`.

## Architecture

Monorepo of three npm workspaces: `packages/schema`, `client`, `server`.

**`@circadiem/schema` is the single source of truth.** All Zod schemas and inferred types (`AnalysisResult`, `AnalysisError`, `AnalysisRow`, `VcgBand`, the 0–3 `scoreSchema`) live in `packages/schema/src/index.ts`. Both `server/src/schema.ts` and `client/src/types.ts` re-export from it rather than redefining. Changing a score range, marker field, or enum means editing this one file.

**Build ordering is load-bearing.** `client` and `server` import `@circadiem/schema` from its compiled `dist/`, not its source. So the schema package must be built before client/server typecheck or build will resolve. `npm run build` already sequences this; if you see "cannot find module @circadiem/schema" during a standalone typecheck, run `npm run build --workspace @circadiem/schema` first.

**Server (`server/src/`)** — Express, ESM, `tsx` in dev / `tsc`→`node dist` in prod.
- `app.ts` — `createApp()` builds all routes/middleware (kept separate from `index.ts` so tests can mount it with supertest without binding a port). Endpoints: `POST /api/analyze` (batch, returns full JSON), `POST /api/analyze/stream` (same inputs, Server-Sent Events with per-image `analyzing`/`done`/`error` progress), `GET /api/prompt` (returns the default system prompt), `GET /health`. A catch-all serves the built client (`client/dist`) for any non-`/api` path.
- `openaiClient.ts` — one OpenAI call per image with `response_format: json_object` and a 60 s timeout. If the response isn't parseable JSON, a **second "repair" LLM call** attempts to fix it before the image is failed. The model's output is parsed against `analysisResultSchema`; the `meta` block (filename, model, run_id, vcg_band, aligned_to_dark) is **injected server-side**, never trusted from the model.
- `prompt.ts` — `SYSTEM_PROMPT` (the rubric) and `buildUserPrompt()`. The rubric text here, the marker field names in the schema, and the README rubric table must stay in sync.
- `constants.ts` — `VCG_BAND` default, `VCG_BAND_OPTIONS`, and `ALLOWED_MODEL_PATTERN` (regex allowlist for the model id).

**Request handling invariants** (both analyze routes enforce these identically — keep them in sync if you touch one):
- Bearer key must start with `sk-` and be ≥ 20 chars (401 otherwise).
- Per-image: MIME must be `image/png`; PNG dimensions are read from the file header and rejected if > 8192×8192 px **before** base64 encoding.
- Concurrency is capped at `pLimit(2)` OpenAI calls per batch; max 20 files × 10 MB (multer memory storage).
- A single image failing produces an **error row** in the results array, not a failed batch.

**Client (`client/src/`)** — React 18 + Vite SPA. `App.tsx` holds essentially all UI state (uploads, labels, options, results). `xlsx` powers spreadsheet export; CSV/JSON export and clipboard copy are client-side. API key can optionally be cached in `localStorage` (opt-in checkbox). The dev server proxies/targets the backend on 5174.

## Conventions

- TypeScript + ESM everywhere; relative imports use the `.js` extension (e.g. `import { createApp } from "./app.js"`) even though sources are `.ts` — required for Node ESM resolution. Keep this.
- Prettier is the only formatter (no ESLint); `npm run check` will fail CI on unformatted code.
- Add a new scored marker or enum value in `packages/schema/src/index.ts` first, then update `prompt.ts` (both system and user prompt field lists), the README rubric/CSV-column tables, and `App.tsx`'s rendering/export. CI runs only on `main` and PRs targeting `main`.
