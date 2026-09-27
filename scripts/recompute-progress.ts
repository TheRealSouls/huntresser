/**
 * Recomputes every member's per-game progress with the current formula, and
 * restores games that were synced with nothing earned (they used to be
 * dropped). Safe to run repeatedly.
 *
 *   npm run db:recompute-progress
 */
import { prisma } from "../src/lib/db";
import { recomputeUserGame } from "../src/lib/progress";

async function main() {
  const pairs = new Map<string, { userId: string; gameId: string }>();
  for (const ug of await prisma.userGame.findMany({ select: { userId: true, gameId: true } })) pairs.set(`${ug.userId}:${ug.gameId}`, ug);

  // Lists a sync processed but that have no UserGame row (0% games).
  const synced = await prisma.psnTitleSync.findMany({ select: { userId: true, npCommunicationId: true } });
  const games = new Map(
    (await prisma.game.findMany({ where: { npCommunicationId: { in: synced.map((s) => s.npCommunicationId) } }, select: { id: true, npCommunicationId: true } })).map(
      (g) => [g.npCommunicationId!, g.id],
    ),
  );
  let restored = 0;
  for (const s of synced) {
    const gameId = games.get(s.npCommunicationId);
    if (gameId && !pairs.has(`${s.userId}:${gameId}`)) {
      pairs.set(`${s.userId}:${gameId}`, { userId: s.userId, gameId });
      restored++;
    }
  }

  for (const { userId, gameId } of pairs.values()) await recomputeUserGame(prisma, userId, gameId);
  console.log(`Recomputed ${pairs.size} games (${restored} restored at 0%).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
