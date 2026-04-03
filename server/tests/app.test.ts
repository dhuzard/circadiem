import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
test("health endpoint returns ok", async () => {
  const app = createApp();
  const response = await request(app).get("/health");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true });
});
test("analyze rejects invalid mime types", async () => {
  const app = createApp();
  const response = await request(app)
    .post("/api/analyze")
    .set("Authorization", "Bearer sk-testkeythatisvalidformat")
    .attach("images", Buffer.from("hello"), {
      filename: "not-a-png.txt",
      contentType: "text/plain",
    });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /Only PNG is supported/i);
});

test("analyze returns 401 when Authorization header is missing", async () => {
  const app = createApp();
  const response = await request(app)
    .post("/api/analyze")
    .attach("images", Buffer.from("\x89PNG\r\n\x1a\n"), {
      filename: "test.png",
      contentType: "image/png",
    });
  assert.equal(response.status, 401);
  assert.match(response.body.error, /missing bearer/i);
});

test("analyze returns 401 for malformed bearer token", async () => {
  const app = createApp();
  const response = await request(app)
    .post("/api/analyze")
    .set("Authorization", "Bearer tooshort")
    .attach("images", Buffer.from("\x89PNG\r\n\x1a\n"), {
      filename: "test.png",
      contentType: "image/png",
    });
  assert.equal(response.status, 401);
  assert.match(response.body.error, /invalid api key format/i);
});

test("analyze returns 400 for invalid labels JSON", async () => {
  const app = createApp();
  const response = await request(app)
    .post("/api/analyze")
    .set("Authorization", "Bearer sk-validkeyformatthatislong")
    .field("labels", "not-valid-json")
    .attach("images", Buffer.from("\x89PNG\r\n\x1a\n"), {
      filename: "test.png",
      contentType: "image/png",
    });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /invalid labels format/i);
});

test("analyze returns 400 for invalid model identifier", async () => {
  const app = createApp();
  const response = await request(app)
    .post("/api/analyze")
    .set("Authorization", "Bearer sk-validkeyformatthatislong")
    .field("model", "../../etc/passwd")
    .attach("images", Buffer.from("\x89PNG\r\n\x1a\n"), {
      filename: "test.png",
      contentType: "image/png",
    });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /invalid model identifier/i);
});

test("analyze returns 400 when no files are uploaded", async () => {
  const app = createApp();
  const response = await request(app)
    .post("/api/analyze")
    .set("Authorization", "Bearer sk-validkeyformatthatislong");
  assert.equal(response.status, 400);
  assert.match(response.body.error, /no png files/i);
});
