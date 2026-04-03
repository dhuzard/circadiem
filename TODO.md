# Circadiem — TODO

Status key: `[x]` done · `[-]` in progress · `[ ]` pending

---

## Bugs / Correctness

- [x] Wrap second `JSON.parse` in repair path with try-catch → clean `AnalysisError` instead of unhandled throw (`server/src/openaiClient.ts`)
- [x] Wrap `req.body.labels` `JSON.parse` in try-catch → 400 instead of 500 (`server/src/app.ts`)
- [x] Guard `localStorage` access with try-catch in App.tsx (private/sandboxed browsing crash)
- [x] Append anchor to `document.body` before `.click()` then remove it for cross-browser download reliability (`client/src/App.tsx`)

## Security

- [x] Add `express-rate-limit` on `POST /api/analyze` (10 req/min/IP)
- [x] Make CORS origin configurable via `CORS_ORIGIN` env var instead of wildcard (`server/src/app.ts`)
- [x] Validate Bearer token format (`sk-` prefix + min length) for faster, clearer auth errors (`server/src/app.ts`)
- [x] Add model string format validation before forwarding to OpenAI (`server/src/app.ts`)

## Code Quality

- [x] Extract `"+-2SD"` to a shared `VCG_BAND` constant in `server/src/constants.ts`
- [x] Add `console.error` / warn logging in server catch blocks for debuggability
- [x] Add log warning when JSON repair fallback is triggered (`server/src/openaiClient.ts`)
- [x] Update all `"vision-review"` string references to `"circadiem"` (STORAGE_KEY, export filenames)

## Tests

- [ ] Add server test for JSON repair fallback path (mock OpenAI client)
- [ ] Add server test for schema validation failure path
- [ ] Add server test for `labels` JSON parse error → 400
- [ ] Add server test for missing/malformed Bearer token → 401
- [ ] Add client-side test for CSV `escapeCsv` edge cases

## Architecture

- [ ] Create `packages/schema` workspace to eliminate client/server schema duplication
- [ ] Add OpenAI request timeout configuration (currently uses SDK default)
- [ ] Add image dimension / resolution guard to prevent outsized base64 payloads

## Features

- [ ] Model selector dropdown with curated vision-capable model list (`gpt-4o`, `gpt-4o-mini`, etc.)
- [ ] Per-image retry button in the UI for failed rows
- [ ] Drag-and-drop reordering of uploaded files before analysis
- [ ] Progress indicator per-file (SSE stream from server)
- [ ] Session history: persist past run results in `localStorage` with `run_id` index
- [ ] Batch comparison view: side-by-side score heatmap across multiple runs
- [ ] Configurable VCG band (expose `vcg_band` as a UI select)
- [ ] Custom rubric editor: allow power users to override `SYSTEM_PROMPT` in the UI
- [ ] Excel (`.xlsx`) export alongside JSON / CSV
- [ ] Dark mode (CSS custom properties already in place — media query + toggle)
