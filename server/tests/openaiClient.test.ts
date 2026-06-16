import test from "node:test";
import assert from "node:assert/strict";
import type OpenAI from "openai";
import {
  analyzeImageWithOpenAI,
  type OpenAIFactory,
} from "../src/openaiClient.js";

const VALID_RESULT = {
  label: "Plot A",
  baseline_light: 1,
  dark_onset_burst: 2,
  dark_irregularity: 3,
  midnight_fragmentation: 2,
  pre_light_decline: 1,
  pre_dark_anticipation: 0,
  notes: "A valid analysis.",
  flags: [],
  confidence: "high",
};

/**
 * Build a fake OpenAI factory whose `chat.completions.create` returns the
 * given queued responses (one per call). Each entry is either the string
 * `content` to return, or an Error to throw. Records the number of calls.
 */
function makeFakeFactory(responses: Array<string | Error>): {
  factory: OpenAIFactory;
  calls: () => number;
} {
  let i = 0;
  const factory: OpenAIFactory = () =>
    ({
      chat: {
        completions: {
          create: async () => {
            const item = responses[i] ?? responses[responses.length - 1];
            i++;
            if (item instanceof Error) {
              throw item;
            }
            return {
              choices: [{ message: { content: item } }],
            };
          },
        },
      },
    }) as unknown as OpenAI;
  return { factory, calls: () => i };
}

const baseArgs = {
  apiKey: "sk-testkeythatisvalidformat",
  model: "gpt-4o-mini",
  imageBuffer: Buffer.from("fake-image"),
  filename: "plot-a.png",
  label: "Plot A",
  alignedToDark: true,
  runId: "run-1",
  vcgBand: "+-2SD",
};

test("returns a parsed result on a clean first response", async () => {
  const { factory } = makeFakeFactory([JSON.stringify(VALID_RESULT)]);
  const result = await analyzeImageWithOpenAI({
    ...baseArgs,
    openaiFactory: factory,
  });
  assert.equal(result.label, "Plot A");
  assert.equal(result.baseline_light, 1);
  assert.equal(result.meta.filename, "plot-a.png");
  assert.equal(result.meta.run_id, "run-1");
});

test("JSON-repair path: malformed first response, valid repair response", async () => {
  const { factory, calls } = makeFakeFactory([
    "{ not valid json",
    JSON.stringify(VALID_RESULT),
  ]);
  const result = await analyzeImageWithOpenAI({
    ...baseArgs,
    openaiFactory: factory,
  });
  assert.equal(result.label, "Plot A");
  // One initial call + one repair call.
  assert.equal(calls(), 2);
});

test("repair also fails: throws a JSON-repair error", async () => {
  const { factory } = makeFakeFactory(["{ not json", "still not json"]);
  await assert.rejects(
    analyzeImageWithOpenAI({ ...baseArgs, openaiFactory: factory }),
    /JSON repair failed/i,
  );
});

test("schema-validation failure (score of 4) throws a schema error", async () => {
  const bad = { ...VALID_RESULT, baseline_light: 4 };
  const { factory } = makeFakeFactory([JSON.stringify(bad)]);
  await assert.rejects(
    analyzeImageWithOpenAI({ ...baseArgs, openaiFactory: factory }),
    /Schema validation failed/i,
  );
});

test("retries on a transient 503 then succeeds", async () => {
  const transient = Object.assign(new Error("Service Unavailable"), {
    status: 503,
  });
  const { factory, calls } = makeFakeFactory([
    transient,
    JSON.stringify(VALID_RESULT),
  ]);
  const result = await analyzeImageWithOpenAI({
    ...baseArgs,
    openaiFactory: factory,
  });
  assert.equal(result.label, "Plot A");
  // First call threw 503, retry succeeded.
  assert.equal(calls(), 2);
});

test("does not retry on a 401 and fails fast", async () => {
  const authError = Object.assign(new Error("Unauthorized"), { status: 401 });
  const { factory, calls } = makeFakeFactory([authError]);
  await assert.rejects(
    analyzeImageWithOpenAI({ ...baseArgs, openaiFactory: factory }),
    /Unauthorized/,
  );
  // No retry: exactly one attempt.
  assert.equal(calls(), 1);
});

test("gives up after 3 attempts on persistent transient errors", async () => {
  const transient = Object.assign(new Error("rate limited"), { status: 429 });
  const { factory, calls } = makeFakeFactory([
    transient,
    transient,
    transient,
    transient,
  ]);
  await assert.rejects(
    analyzeImageWithOpenAI({ ...baseArgs, openaiFactory: factory }),
    /rate limited/,
  );
  assert.equal(calls(), 3);
});
