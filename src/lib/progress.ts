import type { PrismaClient } from "@prisma/client";
import { TROPHY_POINTS, type TrophyType } from "./trophies";

/**
 * Recomputes the denormalised UserGame row for a user/game pair from their
 * earned trophies. Progress is points-weighted, the way PSN calculates it.
 * Shared by the PSN sync service and the seed script.
 */
export async function recomputeUserGame(db: PrismaClient, userId: string, gameId: string) {
  const [trophies, earned] = await Promise.all([
    db.trophy.findMany({ where: { gameId }, select: { type: true } }),
    db.userTrophy.findMany({
      where: { userId, trophy: { gameId } },
      select: { earnedAt: true, trophy: { select: { type: true } } },
      orderBy: { earnedAt: "asc" },
    }),
  ]);

  if (earned.length === 0) {
    await db.userGame.deleteMany({ where: { userId, gameId } });
    return;
  }

  const totalPoints = trophies.reduce((s, t) => s + TROPHY_POINTS[t.type as TrophyType], 0);
  let earnedPoints = 0;
  const counts = { BRONZE: 0, SILVER: 0, GOLD: 0, PLATINUM: 0 };
  let platinumAt: Date | null = null;
  for (const e of earned) {
    const type = e.trophy.type as TrophyType;
    counts[type]++;
    earnedPoints += TROPHY_POINTS[type];
    if (type === "PLATINUM") platinumAt = e.earnedAt;
  }

  const data = {
    progress: totalPoints ? Math.floor((earnedPoints / totalPoints) * 100) : 0,
    earnedCount: earned.length,
    earnedBronze: counts.BRONZE,
    earnedSilver: counts.SILVER,
    earnedGold: counts.GOLD,
    hasPlatinum: counts.PLATINUM > 0,
    platinumAt,
    completedAt: earned.length === trophies.length ? earned[earned.length - 1].earnedAt : null,
    firstEarned: earned[0].earnedAt,
    lastEarned: earned[earned.length - 1].earnedAt,
  };

  await db.userGame.upsert({
    where: { userId_gameId: { userId, gameId } },
    create: { userId, gameId, ...data },
    update: data,
  });
}
