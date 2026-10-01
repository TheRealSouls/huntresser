/**
 * Gives every trophy without one its readable address slug
 * (/games/hollow-knight/watcher). New trophies get one when their list is
 * imported; this covers rows from before slugs existed. Safe to run again:
 * it only touches trophies that have no slug yet.
 *
 *   npm run db:trophy-slugs
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { trophySlugs } from "../src/lib/trophy-slug";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file; rely on the real environment.
}

/** Games handled per round trip to the database. */
const GAMES_PER_BATCH = 300;

async function batch() {
  const games = await prisma.trophy.findMany({ where: { slug: null }, distinct: ["gameId"], select: { gameId: true }, take: GAMES_PER_BATCH });
  if (!games.length) return null;
  const trophies = await prisma.trophy.findMany({
    where: { gameId: { in: games.map((g) => g.gameId) } },
    select: { id: true, gameId: true, psnTrophyId: true, name: true, hidden: true, slug: true },
  });
  const byGame = new Map<string, typeof trophies>();
  for (const t of trophies) byGame.set(t.gameId, [...(byGame.get(t.gameId) ?? []), t]);

  const rows: { id: string; slug: string }[] = [];
  for (const list of byGame.values()) {
    const missing = list.filter((t) => !t.slug);
    const slugs = trophySlugs(missing, list.flatMap((t) => (t.slug ? [t.slug] : [])));
    for (const t of missing) rows.push({ id: t.id, slug: slugs.get(t.psnTrophyId)! });
  }
  // A few big statements rather than one per trophy (PostgreSQL allows 65,535 values per statement).
  for (let i = 0; i < rows.length; i += 5000) {
    const values = Prisma.join(rows.slice(i, i + 5000).map((r) => Prisma.sql`(${r.id}, ${r.slug})`));
    await prisma.$executeRaw`UPDATE "Trophy" AS t SET slug = v.slug FROM (VALUES ${values}) AS v(id, slug) WHERE t.id = v.id`;
  }
  return { games: byGame.size, trophies: rows.length };
}

async function main() {
  let games = 0;
  let trophies = 0;
  let failures = 0;
  for (;;) {
    try {
      const done = await batch();
      if (!done) break;
      games += done.games;
      trophies += done.trophies;
      failures = 0;
    } catch (err) {
      // A dropped connection: wait a moment and carry on where it stopped.
      if (++failures > 5) throw err;
      await new Promise((r) => setTimeout(r, 2000 * failures));
    }
  }
  console.log(`Gave ${trophies} trophies across ${games} games a readable address.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
