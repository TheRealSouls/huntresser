import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getLeaderboard } from "@/lib/leaderboard";
import { ULTRA_RARE_MAX } from "@/lib/trophies";
import { formatNumber, timeAgo } from "@/lib/utils";
import { flag } from "@/lib/countries";
import { GameArt } from "@/components/art";
import { GameCard } from "@/components/GameCard";
import { TrophyIcon } from "@/components/TrophyIcon";
import { Avatar, Notice, RarityBadge, SectionTitle } from "@/components/ui";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

const publicActivity = { showActivity: true, profileVisibility: "PUBLIC" } as const;

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const user = await getCurrentUser();
  const monthAgo = new Date(Date.now() - 30 * 86_400_000);

  const [hunters, trophyCount, platCount, recentPlats, rareUnlocks, weekly, guides, trending] = await Promise.all([
    prisma.user.count(),
    prisma.userTrophy.count(),
    prisma.userGame.count({ where: { hasPlatinum: true } }),
    prisma.userGame.findMany({
      where: { hasPlatinum: true, user: publicActivity },
      orderBy: { platinumAt: "desc" },
      take: 6,
      include: { user: { include: { psn: true } }, game: true },
    }),
    prisma.userTrophy.findMany({
      where: { trophy: { earnedRate: { lte: ULTRA_RARE_MAX } }, user: publicActivity },
      orderBy: { earnedAt: "desc" },
      take: 5,
      include: { user: { include: { psn: true } }, trophy: { include: { game: true } } },
    }),
    getLeaderboard({ metric: "points", period: "weekly", scope: "global", limit: 5 }),
    prisma.guide.findMany({ orderBy: { views: "desc" }, take: 3, include: { game: true, author: true } }),
    prisma.$queryRaw<{ gameId: string; n: number }[]>`
      SELECT t."gameId" AS "gameId", CAST(COUNT(*) AS INTEGER) AS n
      FROM "UserTrophy" ut JOIN "Trophy" t ON t."id" = ut."trophyId"
      WHERE ut."earnedAt" >= ${monthAgo}
      GROUP BY t."gameId" ORDER BY n DESC LIMIT 6`,
  ]);

  const trendingGames = await prisma.game.findMany({
    where: { id: { in: trending.map((t) => t.gameId) } },
    include: { trophies: { where: { type: "PLATINUM" }, select: { earnedRate: true } } },
  });
  const trendingSorted = trending
    .map((t) => trendingGames.find((g) => g.id === t.gameId))
    .filter((g): g is (typeof trendingGames)[number] => !!g);

  return (
    <div className="space-y-14">
      {deleted && <Notice tone="good">Your account and all of its data have been deleted.</Notice>}

      <section className="grid gap-10 border-b border-line pb-12 pt-4 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div>
          <p className="mb-4 text-xs uppercase tracking-widest text-accent-text">For PlayStation trophy hunters</p>
          <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Your trophies, your platinums, and the people chasing the same ones.
          </h1>
          <p className="mt-5 max-w-xl text-muted">
            Sync your PSN trophy list, plan a platinum with a community roadmap that flags the missables, and see where you
            rank in the world, your country and your friends list.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {!user ? (
              <>
                <Link href="/register" className="btn-primary px-5 py-2.5">Create a free account</Link>
                <Link href="/login" className="btn-ghost px-5 py-2.5">Log in</Link>
              </>
            ) : !user.psn?.verified ? (
              <Link href="/settings#psn" className="btn-primary px-5 py-2.5">Link your PSN account</Link>
            ) : (
              <Link href={`/u/${user.username}`} className="btn-primary px-5 py-2.5">View my trophies</Link>
            )}
            <Link href="/games" className="btn-ghost px-5 py-2.5">Browse games</Link>
          </div>
          <p className="mt-8 text-xs text-muted">
            <span className="text-text">{formatNumber(hunters)}</span> hunters ·{" "}
            <span className="text-text">{formatNumber(trophyCount)}</span> trophies tracked ·{" "}
            <span className="text-text">{formatNumber(platCount)}</span> platinums
          </p>
        </div>

        <form action="/psn" className="card p-5" role="search">
          <label htmlFor="psn-id" className="label">Look up any PSN profile</label>
          <div className="flex gap-2">
            <input id="psn-id" name="id" required placeholder="PSN Online ID" autoComplete="off" spellCheck={false} className="input" />
            <button className="btn-primary">Look up</button>
          </div>
          <p className="mt-3 text-xs text-muted">
            See any public player&apos;s avatar, level and recent games, even if they haven&apos;t joined {SITE.name} yet.
          </p>
        </form>
      </section>

      <section className="grid gap-10 lg:grid-cols-[1.6fr_1fr] [&>*]:min-w-0">
        <div>
          <SectionTitle action={<Link href="/leaderboards?metric=platinums" className="link text-xs">Platinum leaders</Link>}>
            Latest platinums
          </SectionTitle>
          {recentPlats.length === 0 ? (
            <p className="text-sm text-muted">No platinums yet.</p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {recentPlats.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <GameArt title={p.game.title} hue={p.game.coverHue} iconUrl={p.game.iconUrl} size="sm" className="w-11" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/games/${p.game.slug}`} className="block truncate text-sm font-semibold hover:underline hover:underline-offset-4">
                      {p.game.title}
                    </Link>
                    <div className="truncate text-xs text-muted">
                      <Link href={`/u/${p.user.username}`} className="hover:text-text">
                        {p.user.psn?.onlineId ?? p.user.username}
                      </Link>{" "}
                      {flag(p.user.country)} · {p.platinumAt && timeAgo(p.platinumAt)}
                    </div>
                  </div>
                  <TrophyIcon type="PLATINUM" size={22} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <SectionTitle action={<Link href="/leaderboards?period=weekly" className="link text-xs">Full board</Link>}>
            Top this week
          </SectionTitle>
          <ol className="divide-y divide-line border-y border-line">
            {weekly.map((r) => (
              <li key={r.key} className="flex items-center gap-3 py-2.5">
                <span className="w-6 text-right text-sm tabular-nums text-muted">{r.rank}.</span>
                <Avatar name={r.name} hue={r.avatarHue} url={r.avatarUrl} size={28} />
                <Link href={r.href} className="flex-1 truncate text-sm font-semibold hover:underline hover:underline-offset-4">
                  {r.name} <span className="text-xs">{flag(r.country)}</span>
                </Link>
                <span className="text-xs tabular-nums text-muted">{formatNumber(r.points)} pts</span>
              </li>
            ))}
            {weekly.length === 0 && <li className="py-4 text-sm text-muted">Nobody has earned a trophy yet this week.</li>}
          </ol>
        </div>
      </section>

      {trendingSorted.length > 0 && (
        <section>
          <SectionTitle action={<Link href="/games" className="link text-xs">All games</Link>}>Most played this month</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {trendingSorted.map((g) => (
              <GameCard key={g.id} game={{ ...g, platRate: g.trophies[0]?.earnedRate ?? null }} />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-10 lg:grid-cols-2 [&>*]:min-w-0">
        <div>
          <SectionTitle action={<Link href="/guides" className="link text-xs">All guides</Link>}>Popular guides</SectionTitle>
          <ul className="divide-y divide-line border-y border-line">
            {guides.map((g) => (
              <li key={g.id}>
                <Link href={`/guides/${g.slug}`} className="group flex gap-4 py-3">
                  <GameArt title={g.game.title} hue={g.game.coverHue} iconUrl={g.game.iconUrl} size="sm" className="w-12" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold group-hover:underline group-hover:underline-offset-4">{g.title}</div>
                    <div className="line-clamp-2 text-xs text-muted">{g.summary}</div>
                    <div className="mt-1 text-xs text-faint">
                      by {g.author.username} · {formatNumber(g.views)} views
                    </div>
                  </div>
                </Link>
              </li>
            ))}
            {guides.length === 0 && <li className="py-4 text-sm text-muted">No guides yet.</li>}
          </ul>
        </div>
        <div>
          <SectionTitle>Recent ultra rares</SectionTitle>
          <ul className="divide-y divide-line border-y border-line">
            {rareUnlocks.map((u) => (
              <li key={u.id} className="flex items-center gap-3 py-2.5">
                <TrophyIcon type={u.trophy.type} size={22} />
                <div className="min-w-0 flex-1">
                  <Link href={`/trophies/${u.trophy.id}`} className="block truncate text-sm font-semibold hover:underline hover:underline-offset-4">
                    {u.trophy.name}
                  </Link>
                  <div className="truncate text-xs text-muted">
                    <Link href={`/u/${u.user.username}`} className="hover:text-text">{u.user.psn?.onlineId ?? u.user.username}</Link> ·{" "}
                    {u.trophy.game.title} · {timeAgo(u.earnedAt)}
                  </div>
                </div>
                <RarityBadge rate={u.trophy.earnedRate} />
              </li>
            ))}
            {rareUnlocks.length === 0 && <li className="py-4 text-sm text-muted">No ultra rare unlocks yet.</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}
