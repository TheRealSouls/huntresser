/**
 * Cleans stored game titles and fills titleKey for rows created before it
 * existed. Safe to run repeatedly.
 *
 *   npx tsx scripts/backfill-titles.ts
 */
import { prisma } from "../src/lib/db";
import { cleanTitle, slugify, titleKey } from "../src/lib/utils";

async function main() {
  const games = await prisma.game.findMany({ select: { id: true, title: true, titleKey: true } });
  const changed = games.filter((g) => g.title !== cleanTitle(g.title) || g.titleKey !== titleKey(g.title));
  for (let i = 0; i < changed.length; i += 200) {
    await prisma.$transaction(
      changed
        .slice(i, i + 200)
        .map((g) => prisma.game.update({ where: { id: g.id }, data: { title: cleanTitle(g.title), titleKey: titleKey(g.title) } })),
    );
  }
  // Non-Latin titles used to get placeholder slugs ("game", "game-2"); give them their list id instead.
  const placeholders = await prisma.game.findMany({
    where: { slug: { startsWith: "game" }, npCommunicationId: { not: null } },
    select: { id: true, slug: true, npCommunicationId: true },
  });
  let renamed = 0;
  for (const g of placeholders.filter((g) => /^game(-\d+)?$/.test(g.slug))) {
    await prisma.game.update({ where: { id: g.id }, data: { slug: slugify(g.npCommunicationId!) } });
    renamed++;
  }
  if (renamed) console.log(`Renamed ${renamed} placeholder slugs.`);

  const groups = await prisma.game.groupBy({ by: ["titleKey"], _count: true });
  console.log(`Updated ${changed.length} of ${games.length} games. ${groups.length} distinct games, ${groups.filter((g) => g._count > 1).length} with more than one trophy list.`);
}

main().finally(() => prisma.$disconnect());
