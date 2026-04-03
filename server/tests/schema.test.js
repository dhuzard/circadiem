import test from "node:test";
import assert from "node:assert/strict";
import { analysisResultSchema } from "../src/schema.js";
import { SYSTEM_PROMPT } from "../src/prompt.js";
test("analysis schema accepts a valid result", () => {
  const parsed = analysisResultSchema.parse({
    label: "Plot A",
    baseline_light: 1,
    dark_onset_burst: 2,
    dark_irregularity: 3,
    midnight_fragmentation: 2,
    pre_light_decline: 1,
    pre_dark_anticipation: 0,
    notes: "Low baseline. Clear burst at dark onset. Fragmented dark activity.",
    flags: ["fragmented_dark_phase"],
    confidence: "high",
    meta: {
      filename: "plot-a.png",
      model: "gpt-4o-mini",
      aligned_to_dark: true,
      vcg_band: "+-2SD",
      run_id: "run-1",
    },
  });
  assert.equal(parsed.label, "Plot A");
});
test("system prompt mentions aligned dark onset and +-2SD band", () => {
  assert.match(SYSTEM_PROMPT, /x=0/i);
  assert.match(SYSTEM_PROMPT, /\+\-2SD/i);
});
