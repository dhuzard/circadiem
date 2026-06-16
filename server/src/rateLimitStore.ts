import { createRequire } from "node:module";
import type { Store } from "express-rate-limit";

const require = createRequire(import.meta.url);

/**
 * Build the store backing the analyze rate limiter.
 *
 * By default this returns `undefined`, which makes express-rate-limit fall
 * back to its built-in in-memory store (per-process; fine for a single
 * instance). When the `REDIS_URL` environment variable is set, a Redis-backed
 * store (via `rate-limit-redis` + the `redis` client) is used instead so the
 * limit is shared across multiple server instances.
 *
 * The Redis client connects in the background; if it cannot connect, errors
 * are logged rather than crashing the process at startup.
 */
export function createRateLimitStore(): Store | undefined {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return undefined;
  }

  // Loaded lazily so `redis` / `rate-limit-redis` are only required when a
  // Redis-backed limiter is actually requested (keeps them optional at runtime
  // for the default in-memory path).
  const { createClient } = require("redis") as typeof import("redis");
  const RedisStore = require("rate-limit-redis")
    .default as typeof import("rate-limit-redis").default;

  const client = createClient({ url: redisUrl });
  client.on("error", (err: unknown) => {
    console.error("[circadiem] Redis rate-limit store error:", err);
  });
  client.connect().catch((err: unknown) => {
    console.error("[circadiem] Failed to connect Redis rate-limit store:", err);
  });

  return new RedisStore({
    // `sendCommand` is the adapter express-rate-limit expects.
    sendCommand: (...args: string[]) => client.sendCommand(args),
  });
}
