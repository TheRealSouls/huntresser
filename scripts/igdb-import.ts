/**
 * Fills in release dates, descriptions, genres, screenshots and trailers from
 * IGDB for every game that hasn't been looked up yet, most played first.
 * Safe to stop and run again; it carries on where it left off.
 *
 *   npm run igdb:import                  (every game not looked up yet)
 *   npm run igdb:import -- 200           (only the next 200)
 *   npm run igdb:import -- "Hollow Knight"   (test one title, prints the match)
 */
import { prisma } from "../src/lib/db";
import { enrichGame, enrichPending, igdbEnabled } from "../src/lib/igdb";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file; rely on the real environment.
}

const BATCH = 100;

async function one(title: string) {
  const game = await prisma.game.findFirst({
    where: { title: { contains: title, mode: "insensitive" } },
    orderBy: { userGames: { _count: "desc" } },
    select: { id: true, title: true, titleKey: true },
  });
  if (!game) throw new Error(`No game in the catalogue matches "${title}".`);
  // Look it up again even if it was checked before.
  await prisma.game.updateMany({ where: game.titleKey ? { titleKey: game.titleKey } : { id: game.id }, data: { igdbCheckedAt: null } });
  const found = await enrichGame(game.id);
  const after = await prisma.game.findUniqueOrThrow({
    where: { id: game.id },
    select: { title: true, igdbId: true, releaseDate: true, genre: true, developer: true, publisher: true, trailerYoutubeId: true, screenshots: true, description: true },
  });
  console.log(found ? "Matched on IGDB:" : "Not found on IGDB:", {
    ...after,
    screenshots: JSON.parse(after.screenshots).length,
    description: after.description?.slice(0, 80),
  });
}

async function main() {
  if (!igdbEnabled()) throw new Error("Set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET in .env first (see README, IGDB).");
  const arg = process.argv[2];
  if (arg && !/^\d+$/.test(arg)) return one(arg);

  let left = arg ? Number(arg) : Infinity;
  let matched = 0;
  let checked = 0;
  while (left > 0) {
    const r = await enrichPending(Math.min(BATCH, left));
    matched += r.matched;
    checked += r.checked;
    left -= r.checked || 1;
    console.log(`${checked} looked up, ${matched} matched, ${r.remaining} trophy lists left${r.error ? ` (last error: ${r.error})` : ""}`);
    if (r.stopped || !r.checked || r.remaining === 0) break;
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
