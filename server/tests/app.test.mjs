import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../dist/app.js";

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
    .set("Authorization", "Bearer test-key")
    .attach("images", Buffer.from("hello"), {
      filename: "not-a-png.txt",
      contentType: "text/plain",
    });

  assert.equal(response.status, 400);
  assert.match(response.body.error, /Only PNG is supported/i);
});
