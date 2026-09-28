import { NextResponse } from "next/server";
import { enrichPending, igdbEnabled } from "@/lib/igdb";

/**
 * Fills in release dates, descriptions, genres, screenshots and trailers from
 * IGDB for games that haven't been looked up yet, most played first. Game
 * pages also do this on their first visit; this catches the rest.
 *
 * Call with `Authorization: Bearer $CRON_SECRET`, e.g. every 30 minutes.
 * Each game costs one IGDB request (4 a second allowed).
 */
export const maxDuration = 300;

const PER_RUN = Math.max(1, Number(process.env.IGDB_GAMES_PER_RUN) || 100);

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!igdbEnabled()) return NextResponse.json({ skipped: "IGDB_CLIENT_ID and IGDB_CLIENT_SECRET are not set" });
  return NextResponse.json(await enrichPending(PER_RUN));
}
