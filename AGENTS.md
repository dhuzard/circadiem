# AGENTS.md — Circadiem

## Status and ownership
**Experimental**, standalone scientific-figure *review assistant*. This repository is the intended maintained Circadiem source. The historical embedded copy under UDA `services/circadiem/` is slated for removal in a separate, tested migration. Do not automatically push changes between repositories or claim the migration is already complete.

## Scope of claims
Circadiem uses an LLM vision model to score six qualitative markers on **rendered circadian PNG plots**. Its 0–3 marker scores, flags, notes and model-reported confidence are **exploratory model outputs**, not validated metrics derived from raw DVC time series, a statistical rhythm test or biological diagnosis. Do not use those scores as scientific QC pass/fail, animal welfare assessment or regulatory evidence without independent validation.

## Architecture
`packages/schema/` owns shared Zod contracts; `client/` is the browser UI; `server/` provides the Express API, model calls, parsing and rate limits. Preserve schema and CSV/JSON/XLSX export parity, size bounds, request/authentication checks, and visible per-image failures.
Never log or persist API keys server-side. Browser key caching must remain optional, explicit and accurately described. Images are transmitted to a configured OpenAI service; do not claim exclusively local execution or send sensitive images without consent.
Treat custom prompts and model responses as untrusted; do not weaken response validation or silently 'repair' scientific content.

## Validation
```bash
npm ci
npm run check
npm run build
```
Also test invalid images/model output, oversized upload, filename/formula injection, API key handling and export compatibility before changing a scoring or export contract. Use synthetic images and documented expected behavior. Any UDA migration and deployment configuration changes require their own PRs.
