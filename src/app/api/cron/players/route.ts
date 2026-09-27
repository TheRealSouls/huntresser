import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { discoverPlayers, refreshPlayer } from "@/lib/psn/players";
import { toPsnError } from "@/lib/psn/real";
import { isDemoMode } from "@/lib/psn/sync";

/**
 * Keeps tracked PSN players fresh: re-reads the stalest few (level, totals,
 * recent games, new platinums), which feeds the weekly/monthly boards and the
 * home page. With PSN_DISCOVERY=on it also adds new players found through the
 * public friends lists of the best-ranked ones.
 *
 * Call with `Authorization: Bearer $CRON_SECRET`, e.g. every 10 minutes.
 * Each run costs roughly 3 PSN requests per refreshed player and 2 per
 * discovered one.
 */
export const maxDuration = 300;

const REFRESH_PER_RUN = Math.max(1, Number(process.env.PSN_REFRESH_PER_RUN) || 10);
const DISCOVER_PER_RUN = Math.max(0, Number(process.env.PSN_DISCOVER_PER_RUN) || 20);

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isDemoMode()) return NextResponse.json({ skipped: "demo mode" });

  const stale = await prisma.psnPlayer.findMany({
    where: { hidden: false },
    orderBy: [{ titlesRefreshedAt: { sort: "asc", nulls: "first" } }, { points: "desc" }],
    take: REFRESH_PER_RUN,
    select: { onlineId: true },
  });

  const refreshed = [];
  for (const p of stale) {
    try {
      const r = await refreshPlayer(p.onlineId);
      refreshed.push({ onlineId: p.onlineId, ok: !!r, titles: r?.titles ?? 0, platinumsDated: r?.platinumsDated ?? 0 });
    } catch (err) {
      const e = toPsnError(err);
      refreshed.push({ onlineId: p.onlineId, ok: false, error: e.message });
      // Stop early rather than hammer PSN while it's limiting us or the token is bad.
      if (e.kind === "rate_limited" || e.kind === "auth") break;
    }
  }

  const discovery =
    process.env.PSN_DISCOVERY === "on" && DISCOVER_PER_RUN > 0
      ? await discoverPlayers({ maxNew: DISCOVER_PER_RUN }).catch((err) => ({ error: toPsnError(err).message }))
      : "off";

  return NextResponse.json({ refreshed, discovery });
}
