import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncUser } from "@/lib/psn/sync";

/**
 * Background "live" sync: re-syncs the stalest verified PSN accounts.
 * Call from a scheduler (Vercel Cron, GitHub Actions, cron + curl) with
 * `Authorization: Bearer $CRON_SECRET`, e.g. every 10 minutes.
 */
// Each account run is capped (PSN_SYNC_TITLES_PER_RUN), so keep the batch small to stay under PSN's rate limits.
const BATCH = 5;
const STALE_AFTER_MS = 30 * 60_000;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stale = await prisma.psnAccount.findMany({
    where: {
      verified: true,
      OR: [
        { lastSyncedAt: null },
        { lastSyncedAt: { lt: new Date(Date.now() - STALE_AFTER_MS) } },
        // Part-way through importing a big library.
        { user: { syncJobs: { some: { remaining: { gt: 0 }, startedAt: { gte: new Date(Date.now() - STALE_AFTER_MS) } } } } },
      ],
    },
    orderBy: { lastSyncedAt: { sort: "asc", nulls: "first" } },
    take: BATCH,
    select: { userId: true, onlineId: true },
  });

  const results = [];
  // Sequential on purpose: PSN rate-limits aggressively.
  for (const a of stale) {
    try {
      const job = await syncUser(a.userId);
      results.push({ onlineId: a.onlineId, ok: true, games: job.gamesSynced, trophies: job.trophiesSynced, remaining: job.remaining });
    } catch (e) {
      results.push({ onlineId: a.onlineId, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return NextResponse.json({ synced: results.length, results });
}
