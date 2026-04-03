# Circadiem

**Circadiem** is an open-source tool for structured, AI-assisted review of circadian activity PNG plots. It batch-feeds your plots to an OpenAI vision model, scores six circadian markers on a 0–3 rubric, and returns structured JSON and CSV for downstream analysis — all without your data leaving your machine except for the OpenAI API call.

---

## What it does

Circadiem applies a fixed rubric to each plot and produces per-image scores, notes, flags, and a confidence level:

| Marker                   | What is scored                                   |
| ------------------------ | ------------------------------------------------ |
| `baseline_light`         | Low-and-flat baseline during the light phase     |
| `dark_onset_burst`       | Abrupt activation burst at dark onset            |
| `dark_irregularity`      | High but irregular dark-phase activity           |
| `midnight_fragmentation` | Midnight waviness vs. smooth plateau             |
| `pre_light_decline`      | Decline in activity before lights-on             |
| `pre_dark_anticipation`  | Anticipatory increase before the next dark cycle |

Each marker is scored `0–3`. Every result also carries a `confidence` level (`low` / `med` / `high`) and a free-text `notes` field up to 1 600 characters.

### Expected plot conventions

- Dark onset at **x = 0** when aligned (`aligned_to_dark = true`)
- Global VCG curve drawn in **black**
- VCG band shown as **±2 SD**

---

## Features

- **Batch upload** — up to 20 PNG files per run, up to 10 MB each
- **Editable labels** — pre-filled from filename, editable before submission
- **Model selection** — any OpenAI vision-capable model (default `gpt-4o-mini`)
- **JSON repair fallback** — if the model returns malformed JSON, a second repair call is attempted automatically
- **Structured export** — JSON and CSV download, or copy JSON to clipboard
- **Session key storage** — optional `localStorage` caching of your API key (opt-in checkbox)
- **No server-side key storage** — your OpenAI key is sent as a bearer token per request and never persisted
- **Rate limiting** — 10 requests/minute per IP
- **Dimension guard** — rejects images larger than 8 192 × 8 192 px before they are base64-encoded
- **Configurable CORS** — restrict allowed origins via `CORS_ORIGIN` env var

---

## Requirements

- **Node.js** `>=18.18.0`
- **npm** `>=10`
- An **OpenAI API key** with access to a vision-capable model

---

## Quick start

```bash
git clone <repo-url> circadiem
cd circadiem
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

- Frontend dev server: `http://localhost:5173`
- Backend API: `http://localhost:5174`

Enter your OpenAI API key in the UI. No `.env` changes are required for development.

---

## Production build

```bash
npm run build   # compiles schema, client, then server
npm start       # serves the app on PORT (default 5174)
```

The backend serves both the REST API and the pre-built frontend from a single port.

---

## Configuration

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

| Variable      | Default | Description                                              |
| ------------- | ------- | -------------------------------------------------------- |
| `PORT`        | `5174`  | Port the backend listens on                              |
| `CORS_ORIGIN` | `*`     | Allowed CORS origin(s); set to your domain in production |

OpenAI API keys are **never stored server-side**. They are provided in the UI and forwarded per-request as a bearer token.

---

## Developer commands

```bash
npm run dev           # start client (5173) and server (5174) concurrently in watch mode
npm run build         # build @circadiem/schema → client → server
npm start             # run the production server
npm test              # run server tests (Node built-in runner via tsx)
npm run typecheck     # TypeScript checks across all workspaces
npm run format        # apply Prettier formatting
npm run format:check  # check formatting without writing
npm run check         # format:check + typecheck + test (CI gate)
```

---

## Project structure

```
circadiem/
├── packages/
│   └── schema/               # @circadiem/schema — shared Zod schemas (single source of truth)
│       └── src/index.ts
├── client/                   # React 18 + Vite + TypeScript SPA
│   └── src/
│       ├── App.tsx           # UI — all state lives here
│       ├── types.ts          # re-exports from @circadiem/schema + client-only types
│       └── styles.css
├── server/                   # Express + TypeScript API
│   └── src/
│       ├── app.ts            # routes and middleware
│       ├── openaiClient.ts   # vision API call + JSON repair fallback
│       ├── prompt.ts         # SYSTEM_PROMPT and buildUserPrompt()
│       ├── schema.ts         # re-exports from @circadiem/schema
│       └── constants.ts      # VCG_BAND, ALLOWED_MODEL_PATTERN
│   └── tests/                # Node built-in test runner, 13 tests
├── .env.example
└── package.json              # npm workspaces root
```

---

## API reference

### `GET /health`

Returns service health.

```json
{ "ok": true }
```

---

### `POST /api/analyze`

Analyze one or more circadian activity PNG plots.

**Headers**

| Header          | Required | Description               |
| --------------- | -------- | ------------------------- |
| `Authorization` | Yes      | `Bearer <OPENAI_API_KEY>` |

**Body** (`multipart/form-data`)

| Field             | Type        | Required | Description                                                        |
| ----------------- | ----------- | -------- | ------------------------------------------------------------------ |
| `images`          | File(s)     | Yes      | PNG files, max 20 files × 10 MB                                    |
| `labels`          | JSON string | No       | `["Label A", "Label B"]` — one per file; defaults to filename stem |
| `model`           | string      | No       | OpenAI model ID (default `gpt-4o-mini`)                            |
| `aligned_to_dark` | string      | No       | `"true"` or `"false"` (default `"true"`)                           |

**Response** `200 OK`

```json
{
  "results": [
    {
      "label": "Mouse 42 — Day 7",
      "baseline_light": 2,
      "dark_onset_burst": 3,
      "dark_irregularity": 1,
      "midnight_fragmentation": 2,
      "pre_light_decline": 1,
      "pre_dark_anticipation": 2,
      "notes": "Clear burst at dark onset. Moderate fragmentation at ZT18.",
      "flags": ["fragmented_dark_phase"],
      "confidence": "high",
      "meta": {
        "filename": "mouse42-day7.png",
        "model": "gpt-4o-mini",
        "aligned_to_dark": true,
        "vcg_band": "+-2SD",
        "run_id": "550e8400-e29b-41d4-a716-446655440000"
      }
    }
  ]
}
```

When a single file fails analysis it returns an error row rather than failing the whole batch:

```json
{
  "label": "Mouse 42 — Day 7",
  "error": "Schema validation failed: baseline_light Expected literal 0, 1, 2, or 3",
  "meta": { "filename": "mouse42-day7.png", ... }
}
```

**Error responses**

| Status | Condition                                                                                          |
| ------ | -------------------------------------------------------------------------------------------------- |
| `400`  | No PNG files, invalid MIME type, malformed labels JSON, invalid model ID, image > 8 192 × 8 192 px |
| `401`  | Missing or malformed bearer token                                                                  |
| `429`  | Rate limit exceeded (10 req/min/IP)                                                                |

---

## Export formats

### CSV columns

`label`, `baseline_light`, `dark_onset_burst`, `dark_irregularity`, `midnight_fragmentation`, `pre_light_decline`, `pre_dark_anticipation`, `confidence`, `flags`, `notes`, `filename`, `model`, `aligned_to_dark`, `vcg_band`, `run_id`, `error`

### JSON

Full nested structure including all scores, notes, flags, confidence, and metadata per image.

---

## Architecture notes

- **Monorepo** — npm workspaces: `packages/schema`, `client`, `server`
- **Shared schemas** — `@circadiem/schema` is the single source of truth for all Zod types; both client and server re-export from it
- **Concurrency control** — at most 2 OpenAI requests run simultaneously per batch (p-limit)
- **60 s timeout** — each OpenAI API call times out after 60 seconds
- **JSON repair** — if the model returns malformed JSON, a second LLM call attempts to fix it before returning an error

---

## Open-source

- [Contributing guide](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security policy](./SECURITY.md)
- [Changelog](./CHANGELOG.md)

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-only). See [LICENSE](./LICENSE).
