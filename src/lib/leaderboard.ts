import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getFriendIds } from "./social";
import { startOfMonthUTC, startOfWeekUTC } from "./utils";
import { levelFromPoints, ULTRA_RARE_MAX } from "./trophies";

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
  /** Stable React key: the user id for members, the PSN account id otherwise. */
  key: string;
  /** "member" rows link to /u/[username]; "psn" rows are tracked PSN players who haven't joined. */
  kind: "member" | "psn";
  href: string;
  name: string;
  userId: string | null;
  username: string | null;
  country: string | null;
  avatarHue: number;
  avatarUrl: string | null;
  level: number;
  points: number;
  platinums: number;
  trophies: number;
  /** Only known for members, from their synced trophy history. */
  rare: number | null;
  completion: number | null;
  games: number | null;
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

type MemberRaw = {
  userId: string;
  username: string;
  country: string | null;
  avatarHue: number;
  onlineId: string | null;
  avatarUrl: string | null;
  accountId: string | null;
  points: number;
  platinums: number;
  rare: number;
  trophies: number;
  completion: number;
  games: number;
};

/**
 * True when the board ranks Sony's real totals (all time) or gains between
 * snapshots (weekly/monthly) for every tracked player, rather than members'
 * synced trophy history.
 */
export function usesPsnTotals(opts: Pick<Opts, "metric" | "period" | "scope">) {
  return opts.scope !== "friends" && (opts.metric === "points" || opts.metric === "platinums");
}

export async function getLeaderboard(opts: Opts): Promise<LeaderboardRow[]> {
  const { period, limit = 100 } = opts;
  // Completion is a lifetime stat with no meaningful weekly/monthly variant.
  const metric: Metric = opts.metric === "completion" && period !== "all" ? "points" : opts.metric;
  const members = await memberBoard({ ...opts, metric }, limit);

  if (!usesPsnTotals({ ...opts, metric })) return members.map((m, i) => memberRow(m, i + 1));
  return psnTotalsBoard({ ...opts, metric }, members, limit);
}

function memberRow(m: MemberRaw, rank: number): LeaderboardRow {
  return {
    rank,
    key: m.userId,
    kind: "member",
    href: `/u/${m.username}`,
    name: m.onlineId ?? m.username,
    userId: m.userId,
    username: m.username,
    country: m.country,
    avatarHue: m.avatarHue,
    avatarUrl: m.avatarUrl,
    level: levelFromPoints(m.points).level,
    points: m.points,
    platinums: m.platinums,
    trophies: m.trophies,
    rare: m.rare,
    completion: m.completion,
    games: m.games,
  };
}

/**
 * All-time global/country board built from PsnPlayer: the real PSN totals of
 * every player the site has seen, members or not. Members whose PSN summary
 * we have are ranked by it (a partial import won't hold them back); members
 * without one (demo mode, not synced yet) fall back to their synced trophies.
 */
async function psnTotalsBoard(opts: Opts, members: MemberRaw[], limit: number): Promise<LeaderboardRow[]> {
  const country = opts.scope === "country" ? opts.country : null;
  if (opts.scope === "country" && !country) return [];

  // Linked members who are private or opted out of leaderboards stay off, PSN summary included.
  const excluded = await prisma.psnAccount.findMany({
    where: {
      accountId: { not: null },
      user: { OR: [{ showOnLeaderboards: false }, { profileVisibility: { not: "PUBLIC" } }] },
    },
    select: { accountId: true },
  });
  const excludedIds = excluded.map((e) => e.accountId!);
  const players =
    opts.period === "all"
      ? (
          await prisma.psnPlayer.findMany({
            where: { hidden: false, trophiesPrivate: false, accountId: { notIn: excludedIds }, ...(country ? { country } : {}) },
            orderBy:
              opts.metric === "platinums"
                ? [{ platinum: "desc" }, { points: "desc" }]
                : [{ points: "desc" }, { platinum: "desc" }],
            take: limit,
          })
        ).map((p) => ({ ...p, trophies: p.platinum + p.gold + p.silver + p.bronze }))
      : await playerGains(opts, country ?? null, excludedIds, limit);

  // Which of these players are members (public, on leaderboards)?
  const linked = await prisma.psnAccount.findMany({
    where: {
      verified: true,
      accountId: { in: players.map((p) => p.accountId) },
      user: { showOnLeaderboards: true, profileVisibility: "PUBLIC" },
    },
    select: { accountId: true, user: { select: { id: true, username: true, avatarHue: true } } },
  });
  const memberByAccount = new Map(linked.map((l) => [l.accountId!, l.user]));
  const memberStats = new Map(members.map((m) => [m.userId, m]));

  const rows: Omit<LeaderboardRow, "rank">[] = players.map((p) => {
    const m = memberByAccount.get(p.accountId);
    const stats = m ? memberStats.get(m.id) : undefined;
    return {
      key: m?.id ?? p.accountId,
      kind: m ? "member" : "psn",
      href: m ? `/u/${m.username}` : `/psn/${encodeURIComponent(p.onlineId)}`,
      name: p.onlineId,
      userId: m?.id ?? null,
      username: m?.username ?? null,
      country: p.country,
      avatarHue: m?.avatarHue ?? 0,
      avatarUrl: p.avatarUrl,
      level: p.trophyLevel,
      points: p.points,
      platinums: p.platinum,
      trophies: p.trophies,
      rare: stats?.rare ?? null,
      completion: stats?.completion ?? null,
      games: stats?.games ?? null,
    };
  });

  // Members with no PSN summary yet compete with their synced totals.
  const known = new Set(
    (
      await prisma.psnPlayer.findMany({
        where: { accountId: { in: members.flatMap((m) => (m.accountId ? [m.accountId] : [])) } },
        select: { accountId: true },
      })
    ).map((p) => p.accountId),
  );
  for (const m of members) if (!m.accountId || !known.has(m.accountId)) rows.push(memberRow(m, 0));

  const key =
    opts.metric === "platinums"
      ? (r: Omit<LeaderboardRow, "rank">) => [r.platinums, r.points]
      : (r: Omit<LeaderboardRow, "rank">) => [r.points, r.platinums];
  rows.sort((a, b) => {
    const [a1, a2] = key(a);
    const [b1, b2] = key(b);
    return b1 - a1 || b2 - a2;
  });
  return rows.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
}

type PlayerTotals = {
  accountId: string;
  onlineId: string;
  avatarUrl: string | null;
  country: string | null;
  trophyLevel: number;
  points: number;
  platinum: number;
  trophies: number;
};

/**
 * Points, platinums and trophies each tracked player gained since the start of
 * the week or month, measured between stored snapshots. The baseline is the
 * last snapshot before the period, or the first one we have if they were
 * first seen during it.
 */
async function playerGains(opts: Opts, country: string | null, excluded: string[], limit: number): Promise<PlayerTotals[]> {
  const since = opts.period === "weekly" ? startOfWeekUTC() : startOfMonthUTC();
  const baseline = (col: "points" | "platinum" | "trophies") => Prisma.sql`COALESCE(
      (SELECT s.${Prisma.raw(`"${col}"`)} FROM "PsnPlayerSnapshot" s WHERE s."accountId" = p."accountId" AND s."takenAt" <= ${since} ORDER BY s."takenAt" DESC LIMIT 1),
      (SELECT s.${Prisma.raw(`"${col}"`)} FROM "PsnPlayerSnapshot" s WHERE s."accountId" = p."accountId" ORDER BY s."takenAt" ASC LIMIT 1)
    )`;
  const filters = [Prisma.sql`p."hidden" = FALSE`, Prisma.sql`p."trophiesPrivate" = FALSE`];
  if (country) filters.push(Prisma.sql`p."country" = ${country}`);
  if (excluded.length) filters.push(Prisma.sql`p."accountId" NOT IN (${Prisma.join(excluded)})`);
  const order = opts.metric === "platinums" ? Prisma.sql`platinum DESC, points DESC` : Prisma.sql`points DESC, platinum DESC`;

  const rows = await prisma.$queryRaw<PlayerTotals[]>`
    SELECT * FROM (
      SELECT p."accountId", p."onlineId", p."avatarUrl", p."country", p."trophyLevel",
        CAST(p."points" - ${baseline("points")} AS INTEGER) AS points,
        CAST(p."platinum" - ${baseline("platinum")} AS INTEGER) AS platinum,
        CAST((p."platinum" + p."gold" + p."silver" + p."bronze") - ${baseline("trophies")} AS INTEGER) AS trophies
      FROM "PsnPlayer" p
      WHERE ${Prisma.join(filters, " AND ")}
    ) AS gains WHERE points > 0
    ORDER BY ${order}
    LIMIT ${limit}
  `;
  return rows.map((r) => ({ ...r, points: Number(r.points), platinum: Number(r.platinum), trophies: Number(r.trophies) }));
}

async function memberBoard(opts: Opts & { metric: Metric }, limit: number): Promise<MemberRaw[]> {
  const { period, scope, metric } = opts;

  const filters: Prisma.Sql[] = [];

  if (scope === "friends") {
    if (!opts.viewerId) return [];
    const ids = [opts.viewerId, ...(await getFriendIds(opts.viewerId))];
    // Friends can see friends-only profiles; the viewer always sees themselves.
    filters.push(
      Prisma.sql`u."id" IN (${Prisma.join(ids)})`,
      Prisma.sql`(u."id" = ${opts.viewerId} OR (u."showOnLeaderboards" = TRUE AND u."profileVisibility" <> 'PRIVATE'))`,
    );
  } else {
    // Global/country boards are public: friends-only and private profiles stay off them.
    filters.push(Prisma.sql`u."showOnLeaderboards" = TRUE`, Prisma.sql`u."profileVisibility" = 'PUBLIC'`);
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

  // PostgreSQL can't use a column alias in HAVING, so repeat the expression.
  const having =
    metric === "completion"
      ? Prisma.sql`HAVING (SELECT COUNT(*) FROM "UserGame" ug WHERE ug."userId" = u."id") >= ${COMPLETION_MIN_GAMES}`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<MemberRaw[]>`
    SELECT
      u."id" AS "userId", u."username", u."country", u."avatarHue",
      p."onlineId", p."avatarUrl", p."accountId",
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
    GROUP BY u."id", p."onlineId", p."avatarUrl", p."accountId"
    ${having}
    ORDER BY ${orderBy}
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    ...r,
    points: Number(r.points),
    platinums: Number(r.platinums),
    rare: Number(r.rare),
    trophies: Number(r.trophies),
    completion: Number(r.completion ?? 0),
    games: Number(r.games),
  }));
}

export type ViewerRanks = {
  points: number;
  global: { rank: number; of: number };
  country: { code: string; rank: number; of: number } | null;
};

/**
 * Where a signed-in member stands on the all-time trophy points board,
 * worldwide and in their country. Uses Sony's totals when their PSN account
 * is tracked (everyone who has synced is), otherwise the members' board.
 * Null if they have no trophies to rank yet.
 */
export async function viewerRanks(user: { id: string; country: string | null; psn: { accountId: string | null } | null }): Promise<ViewerRanks | null> {
  const visible = { hidden: false, trophiesPrivate: false } as const;
  const me = user.psn?.accountId ? await prisma.psnPlayer.findUnique({ where: { accountId: user.psn.accountId } }) : null;
  if (me && !me.hidden && !me.trophiesPrivate) {
    const code = me.country ?? user.country;
    const [ahead, total, aheadHere, totalHere] = await Promise.all([
      prisma.psnPlayer.count({ where: { ...visible, points: { gt: me.points } } }),
      prisma.psnPlayer.count({ where: visible }),
      code ? prisma.psnPlayer.count({ where: { ...visible, country: code, points: { gt: me.points } } }) : 0,
      code ? prisma.psnPlayer.count({ where: { ...visible, country: code } }) : 0,
    ]);
    return {
      points: me.points,
      global: { rank: ahead + 1, of: total },
      country: code ? { code, rank: aheadHere + 1, of: Math.max(totalHere, 1) } : null,
    };
  }

  // Not tracked on PSN (demo mode, or never synced): rank among members.
  const board = await getLeaderboard({ metric: "points", period: "all", scope: "global", limit: 10_000 });
  const mine = board.find((r) => r.userId === user.id);
  if (!mine) return null;
  const here = user.country ? board.filter((r) => r.country === user.country) : [];
  const hereRank = here.findIndex((r) => r.userId === user.id);
  return {
    points: mine.points,
    global: { rank: mine.rank, of: board.length },
    country: user.country && hereRank >= 0 ? { code: user.country, rank: hereRank + 1, of: here.length } : null,
  };
}
