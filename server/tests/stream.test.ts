import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import type OpenAI from "openai";
import { createApp } from "../src/app.js";
import type { OpenAIFactory } from "../src/openaiClient.js";

// Valid 8-byte PNG signature, accepted by the signature check.
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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
 * Fake factory that returns `content` for every completion call, or throws
 * `error` if provided. Used to drive the SSE route without network access.
 */
function fakeFactory(opts: { content?: string; error?: Error }): OpenAIFactory {
  return () =>
    ({
      chat: {
        completions: {
          create: async () => {
            if (opts.error) throw opts.error;
            return {
              choices: [{ message: { content: opts.content } }],
            };
          },
        },
      },
    }) as unknown as OpenAI;
}

/** Parse the `data:` JSON payloads out of an SSE response body. */
function parseSseEvents(body: string): Array<Record<string, unknown>> {
  return body
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice("data:".length).trim()));
}

test("stream emits analyzing then done per image and a final done:true", async () => {
  const app = createApp({
    openaiFactory: fakeFactory({ content: JSON.stringify(VALID_RESULT) }),
  });
  const response = await request(app)
    .post("/api/analyze/stream")
    .set("Authorization", "Bearer sk-validkeyformatthatislong")
    .attach("images", PNG_BYTES, {
      filename: "plot-a.png",
      contentType: "image/png",
    });

  assert.equal(response.status, 200);
  const events = parseSseEvents(response.text);

  const analyzing = events.find((e) => e.status === "analyzing");
  const done = events.find((e) => e.status === "done");
  const final = events.find((e) => e.done === true);

  assert.ok(analyzing, "expected an analyzing event");
  assert.equal(analyzing!.index, 0);
  assert.ok(done, "expected a done event");
  assert.equal((done!.result as { label: string }).label, "Plot A");
  assert.ok(final, "expected a final done:true event");
});

test("stream emits an error event for a failing image but still 200", async () => {
  const app = createApp({
    openaiFactory: fakeFactory({
      error: Object.assign(new Error("Unauthorized"), { status: 401 }),
    }),
  });
  const response = await request(app)
    .post("/api/analyze/stream")
    .set("Authorization", "Bearer sk-validkeyformatthatislong")
    .attach("images", PNG_BYTES, {
      filename: "plot-a.png",
      contentType: "image/png",
    });

  assert.equal(response.status, 200);
  const events = parseSseEvents(response.text);

  const errorEvent = events.find((e) => e.status === "error");
  const final = events.find((e) => e.done === true);

  assert.ok(errorEvent, "expected an error event");
  assert.match((errorEvent!.result as { error: string }).error, /Unauthorized/);
  assert.ok(final, "expected a final done:true event");
});

test("batch /api/analyze returns 200 with an error row when an image fails", async () => {
  const app = createApp({
    openaiFactory: fakeFactory({
      // Score of 4 fails schema validation -> error row.
      content: JSON.stringify({ ...VALID_RESULT, baseline_light: 4 }),
    }),
  });
  const response = await request(app)
    .post("/api/analyze")
    .set("Authorization", "Bearer sk-validkeyformatthatislong")
    .attach("images", PNG_BYTES, {
      filename: "plot-a.png",
      contentType: "image/png",
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.results.length, 1);
  const row = response.body.results[0];
  assert.ok("error" in row, "expected an error row");
  assert.match(row.error, /Schema validation failed/i);
});

test("rejects a spoofed image/png whose body is not a PNG", async () => {
  const app = createApp();
  const response = await request(app)
    .post("/api/analyze")
    .set("Authorization", "Bearer sk-validkeyformatthatislong")
    .attach("images", Buffer.from("this is not a png"), {
      filename: "fake.png",
      contentType: "image/png",
    });

  assert.equal(response.status, 400);
  assert.match(response.body.error, /Invalid or corrupt PNG/i);
});
