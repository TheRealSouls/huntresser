import { prisma } from "./db";
import { levelFromPoints, pointsFor, ULTRA_RARE_MAX } from "./trophies";

export async function getUserStats(userId: string) {
  const [agg, platinum, completed, ultraRare] = await Promise.all([
    prisma.userGame.aggregate({
      where: { userId },
      _sum: { earnedBronze: true, earnedSilver: true, earnedGold: true, earnedCount: true },
      _avg: { progress: true },
      _count: true,
    }),
    prisma.userGame.count({ where: { userId, hasPlatinum: true } }),
    prisma.userGame.count({ where: { userId, completedAt: { not: null } } }),
    prisma.userTrophy.count({ where: { userId, trophy: { earnedRate: { lte: ULTRA_RARE_MAX } } } }),
  ]);

  const counts = {
    platinum,
    gold: agg._sum.earnedGold ?? 0,
    silver: agg._sum.earnedSilver ?? 0,
    bronze: agg._sum.earnedBronze ?? 0,
  };
  const points = pointsFor(counts);
  return {
    ...counts,
    total: agg._sum.earnedCount ?? 0,
    games: agg._count,
    completed,
    ultraRare,
    avgCompletion: Math.round(agg._avg.progress ?? 0),
    points,
    ...levelFromPoints(points),
  };
}

export type UserStats = Awaited<ReturnType<typeof getUserStats>>;

export type Milestone = {
  key: string;
  label: string;
  kind: "trophy" | "platinum" | "rare" | "complete";
  achieved: boolean;
  at?: Date;
  detail?: string;
  gameSlug?: string;
};

const TROPHY_MILESTONES = [1, 100, 500, 1000, 2500, 5000, 10000];
const PLATINUM_MILESTONES = [1, 10, 25, 50, 100, 250];

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Milestones are derived on read from the user's earned-trophy history. */
export async function getMilestones(userId: string, stats: UserStats): Promise<Milestone[]> {
  const nthTrophy = (n: number) =>
    prisma.userTrophy.findFirst({
      where: { userId },
      orderBy: { earnedAt: "asc" },
      skip: n - 1,
      include: { trophy: { select: { name: true, game: { select: { title: true, slug: true } } } } },
    });

  const trophyMs = await Promise.all(
    TROPHY_MILESTONES.map(async (n): Promise<Milestone> => {
      if (stats.total < n) return { key: `t${n}`, label: `${ordinal(n)} trophy`, kind: "trophy", achieved: false };
      const t = await nthTrophy(n);
      return {
        key: `t${n}`,
        label: n === 1 ? "First trophy" : `${ordinal(n)} trophy`,
        kind: "trophy",
        achieved: true,
        at: t?.earnedAt,
        detail: t ? `${t.trophy.name} (${t.trophy.game.title})` : undefined,
        gameSlug: t?.trophy.game.slug,
      };
    }),
  );

  const plats = await prisma.userGame.findMany({
    where: { userId, hasPlatinum: true },
    orderBy: { platinumAt: "asc" },
    select: { platinumAt: true, game: { select: { title: true, slug: true } } },
  });
  const platMs = PLATINUM_MILESTONES.map((n): Milestone => {
    const p = plats[n - 1];
    return {
      key: `p${n}`,
      label: n === 1 ? "First platinum" : `${ordinal(n)} platinum`,
      kind: "platinum",
      achieved: !!p,
      at: p?.platinumAt ?? undefined,
      detail: p?.game.title,
      gameSlug: p?.game.slug,
    };
  });

  const [firstUltra, firstComplete] = await Promise.all([
    prisma.userTrophy.findFirst({
      where: { userId, trophy: { earnedRate: { lte: ULTRA_RARE_MAX } } },
      orderBy: { earnedAt: "asc" },
      include: { trophy: { select: { name: true, earnedRate: true, game: { select: { title: true, slug: true } } } } },
    }),
    prisma.userGame.findFirst({
      where: { userId, completedAt: { not: null } },
      orderBy: { completedAt: "asc" },
      select: { completedAt: true, game: { select: { title: true, slug: true } } },
    }),
  ]);

  return [
    ...trophyMs,
    ...platMs,
    {
      key: "ultra",
      label: "First ultra rare",
      kind: "rare",
      achieved: !!firstUltra,
      at: firstUltra?.earnedAt,
      detail: firstUltra ? `${firstUltra.trophy.name} (${firstUltra.trophy.earnedRate?.toFixed(1)}%)` : undefined,
      gameSlug: firstUltra?.trophy.game.slug,
    },
    {
      key: "complete",
      label: "First 100% completion",
      kind: "complete",
      achieved: !!firstComplete,
      at: firstComplete?.completedAt ?? undefined,
      detail: firstComplete?.game.title,
      gameSlug: firstComplete?.game.slug,
    },
  ];
}
