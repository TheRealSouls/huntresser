import { headers } from "next/headers";

/**
 * Fixed-window rate limiter kept in process memory. Good enough for a single
 * Node instance; swap for Redis/Upstash when running more than one.
 */
type Window = { count: number; resetAt: number };
const buckets = new Map<string, Window>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, w] of buckets) if (w.resetAt <= now) buckets.delete(k);
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/** Returns true if the call is allowed. */
export async function rateLimit(scope: string, limit: number, windowMs: number, key?: string) {
  const now = Date.now();
  sweep(now);
  const id = `${scope}:${key ?? (await clientIp())}`;
  const w = buckets.get(id);
  if (!w || w.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + windowMs });
    return true;
  }
  w.count++;
  return w.count <= limit;
}
