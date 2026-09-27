import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getFriendIds } from "./social";
import { startOfMonthUTC, startOfWeekUTC } from "./utils";
import { ULTRA_RARE_MAX } from "./trophies";

export const METRICS = {
  points: "Trophy points",
  platinums: "Platinums",
  completion: "Avg. completion",
  rare: "Ultra rares",
} as const;
export const PERIODS = { all: "All time", weekly: "This week", monthly: "This month" } as const;
export const SCOPES = { global: "Global", country: "Country", friends: "Friends" } as const;

export type Metric = keyof typeof METRICS;
export type Period = keyof typeof PERIODS;
export type Scope = keyof typeof SCOPES;

export type LeaderboardRow = {
  rank: number;
  userId: string;
  username: string;
  country: string | null;
  avatarHue: number;
  onlineId: string | null;
  avatarUrl: string | null;
  points: number;
  platinums: number;
  rare: number;
  trophies: number;
  completion: number;
  games: number;
};

type Opts = {
  metric: Metric;
  period: Period;
  scope: Scope;
  country?: string | null;
  viewerId?: string | null;
  limit?: number;
};

/** Minimum games before someone ranks on the completion board (stops 1-game 100%ers topping it). */
export const COMPLETION_MIN_GAMES = 5;

export async function getLeaderboard(opts: Opts): Promise<LeaderboardRow[]> {
  const { period, scope, limit = 100 } = opts;
  // Completion is a lifetime stat with no meaningful weekly/monthly variant.
  const metric: Metric = opts.metric === "completion" && period !== "all" ? "points" : opts.metric;

  const filters: Prisma.Sql[] = [];

  if (scope === "friends") {
    if (!opts.viewerId) return [];
    const ids = [opts.viewerId, ...(await getFriendIds(opts.viewerId))];
    // Friends can see friends-only profiles; the viewer always sees themselves.
    filters.push(
      Prisma.sql`u."id" IN (${Prisma.join(ids)})`,
      Prisma.sql`(u."id" = ${opts.viewerId} OR (u."showOnLeaderboards" = 1 AND u."profileVisibility" <> 'PRIVATE'))`,
    );
  } else {
    // Global/country boards are public: friends-only and private profiles stay off them.
    filters.push(Prisma.sql`u."showOnLeaderboards" = 1`, Prisma.sql`u."profileVisibility" = 'PUBLIC'`);
    if (scope === "country") {
      if (!opts.country) return [];
      filters.push(Prisma.sql`u."country" = ${opts.country}`);
    }
  }

  const since = period === "weekly" ? startOfWeekUTC() : period === "monthly" ? startOfMonthUTC() : null;
  const trophyFilters = since ? [...filters, Prisma.sql`ut."earnedAt" >= ${since}`] : filters;
  const where = Prisma.join(trophyFilters, " AND ");

  const orderBy = {
    points: Prisma.sql`points DESC, platinums DESC`,
    platinums: Prisma.sql`platinums DESC, points DESC`,
    rare: Prisma.sql`rare DESC, points DESC`,
    completion: Prisma.sql`completion DESC, games DESC`,
  }[metric];

  const having = metric === "completion" ? Prisma.sql`HAVING games >= ${COMPLETION_MIN_GAMES}` : Prisma.empty;

  const rows = await prisma.$queryRaw<Omit<LeaderboardRow, "rank">[]>`
    SELECT
      u."id" AS "userId", u."username", u."country", u."avatarHue",
      p."onlineId", p."avatarUrl",
      CAST(SUM(CASE t."type" WHEN 'PLATINUM' THEN 300 WHEN 'GOLD' THEN 90 WHEN 'SILVER' THEN 30 ELSE 15 END) AS INTEGER) AS points,
      CAST(SUM(CASE WHEN t."type" = 'PLATINUM' THEN 1 ELSE 0 END) AS INTEGER) AS platinums,
      CAST(SUM(CASE WHEN t."earnedRate" <= ${ULTRA_RARE_MAX} THEN 1 ELSE 0 END) AS INTEGER) AS rare,
      CAST(COUNT(*) AS INTEGER) AS trophies,
      CAST((SELECT ROUND(AVG(ug."progress")) FROM "UserGame" ug WHERE ug."userId" = u."id") AS INTEGER) AS completion,
      CAST((SELECT COUNT(*) FROM "UserGame" ug WHERE ug."userId" = u."id") AS INTEGER) AS games
    FROM "UserTrophy" ut
    JOIN "Trophy" t ON t."id" = ut."trophyId"
    JOIN "User" u ON u."id" = ut."userId"
    LEFT JOIN "PsnAccount" p ON p."userId" = u."id"
    WHERE ${where}
    GROUP BY u."id"
    ${having}
    ORDER BY ${orderBy}
    LIMIT ${limit}
  `;

  return rows.map((r, i) => ({
    ...r,
    points: Number(r.points),
    platinums: Number(r.platinums),
    rare: Number(r.rare),
    trophies: Number(r.trophies),
    completion: Number(r.completion ?? 0),
    games: Number(r.games),
    rank: i + 1,
  }));
}
