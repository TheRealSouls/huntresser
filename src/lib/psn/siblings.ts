import { getTitleTrophyGroups } from "psn-api";
import { prisma } from "../db";
import { titleKey } from "../utils";
import { importTitles } from "./catalogue";
import { psnAuth, toPsnError, withTimeout } from "./real";

/**
 * PSN has no public game search, so the catalogue only knows trophy lists
 * that showed up on a profile. Lists released together (PS4 and PS5, or
 * regional copies) usually get neighbouring ids like NPWR30593_00 and
 * NPWR30594_00, and Sony's trophy-definition endpoint answers for any id.
 * This walks outwards from a known list and adds neighbours with the same
 * title, stopping after two misses in a row.
 */
const MAX_STEPS = 8;
const MISSES_TO_STOP = 2;

async function describe(npCommunicationId: string) {
  const auth = await psnAuth();
  for (const service of ["trophy2", "trophy"] as const) {
    try {
      const r = await withTimeout(
        getTitleTrophyGroups(auth, npCommunicationId, service === "trophy" ? { npServiceName: "trophy" } : {}),
        8_000,
      );
      if (r?.trophyTitleName) return { ...r, npServiceName: service };
    } catch (err) {
      if (toPsnError(err).kind === "rate_limited") throw err;
    }
  }
  return null;
}

export async function probeSiblings(gameId: string): Promise<number> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, npCommunicationId: true, titleKey: true, siblingsProbedAt: true },
  });
  const m = game?.npCommunicationId?.match(/^NPWR(\d{5})_(\d{2})$/);
  if (!game || !m || game.siblingsProbedAt || !game.titleKey) return 0;
  // Claim it first so concurrent page views don't probe twice.
  await prisma.game.update({ where: { id: game.id }, data: { siblingsProbedAt: new Date() } });

  try {
    return await walk(game as { id: string; titleKey: string }, m);
  } catch (err) {
    // Let a later page view try again (token or network trouble, rate limits).
    await prisma.game.update({ where: { id: game.id }, data: { siblingsProbedAt: null } });
    throw err;
  }
}

async function walk(game: { id: string; titleKey: string }, m: RegExpMatchArray) {
  const base = Number(m[1]);
  const known = new Map(
    (await prisma.game.findMany({ where: { titleKey: game.titleKey }, select: { npCommunicationId: true } })).map((g) => [
      g.npCommunicationId,
      true,
    ]),
  );
  let added = 0;
  for (const dir of [-1, 1]) {
    let misses = 0;
    for (let step = 1; step <= MAX_STEPS && misses < MISSES_TO_STOP; step++) {
      const n = base + dir * step;
      if (n < 0 || n > 99999) break;
      const id = `NPWR${String(n).padStart(5, "0")}_${m[2]}`;
      if (known.has(id)) {
        misses = 0;
        continue;
      }
      const d = await describe(id);
      if (!d || titleKey(d.trophyTitleName) !== game.titleKey) {
        misses++;
        continue;
      }
      misses = 0;
      await importTitles(
        [
          {
            npCommunicationId: id,
            npServiceName: d.npServiceName,
            title: d.trophyTitleName,
            iconUrl: d.trophyTitleIconUrl ?? null,
            platforms: String(d.trophyTitlePlatform).split(","),
            lastUpdated: new Date(),
          },
        ],
        null,
      );
      known.set(id, true);
      added++;
    }
  }
  if (added) {
    await prisma.game.updateMany({ where: { titleKey: game.titleKey }, data: { siblingsProbedAt: new Date() } });
  }
  return added;
}
