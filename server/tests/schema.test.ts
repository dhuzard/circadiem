import test from "node:test";
import assert from "node:assert/strict";
import { analysisResultSchema, analysisErrorSchema } from "../src/schema.js";
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

test("analysis schema rejects out-of-range score (4)", () => {
  assert.throws(() =>
    analysisResultSchema.parse({
      label: "Plot B",
      baseline_light: 4,
      dark_onset_burst: 0,
      dark_irregularity: 0,
      midnight_fragmentation: 0,
      pre_light_decline: 0,
      pre_dark_anticipation: 0,
      notes: "test",
      flags: [],
      confidence: "low",
      meta: {
        filename: "b.png",
        model: "gpt-4o-mini",
        aligned_to_dark: true,
        vcg_band: "+-2SD",
        run_id: "r1",
      },
    }),
  );
});

test("analysis schema rejects invalid confidence value", () => {
  assert.throws(() =>
    analysisResultSchema.parse({
      label: "Plot C",
      baseline_light: 1,
      dark_onset_burst: 1,
      dark_irregularity: 1,
      midnight_fragmentation: 1,
      pre_light_decline: 1,
      pre_dark_anticipation: 1,
      notes: "test",
      flags: [],
      confidence: "very-high",
      meta: {
        filename: "c.png",
        model: "gpt-4o-mini",
        aligned_to_dark: true,
        vcg_band: "+-2SD",
        run_id: "r1",
      },
    }),
  );
});

test("analysis schema rejects empty label", () => {
  assert.throws(() =>
    analysisResultSchema.parse({
      label: "",
      baseline_light: 0,
      dark_onset_burst: 0,
      dark_irregularity: 0,
      midnight_fragmentation: 0,
      pre_light_decline: 0,
      pre_dark_anticipation: 0,
      notes: "test",
      flags: [],
      confidence: "med",
      meta: {
        filename: "d.png",
        model: "gpt-4o-mini",
        aligned_to_dark: true,
        vcg_band: "+-2SD",
        run_id: "r1",
      },
    }),
  );
});

test("analysis error schema validates correctly", () => {
  const result = analysisErrorSchema.parse({
    label: "Plot E",
    error: "Something went wrong",
    meta: {
      filename: "e.png",
      model: "gpt-4o-mini",
      aligned_to_dark: false,
      vcg_band: "+-2SD",
      run_id: "r2",
    },
  });
  assert.equal(result.label, "Plot E");
});
