import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getLeaderboard } from "@/lib/leaderboard";
import { ULTRA_RARE_MAX } from "@/lib/trophies";
import { formatDate, formatNumber, timeAgo } from "@/lib/utils";
import { flag } from "@/lib/countries";
import { GameArt } from "@/components/art";
import { GameCard } from "@/components/GameCard";
import { TrophyIcon } from "@/components/TrophyIcon";
import { Avatar, Notice, RarityBadge, SectionTitle } from "@/components/ui";
import { SITE } from "@/lib/site";
import { gamesNeedingGuides, latestPlatinums, latestSessions, newDlc, newTrophyLists, siteTotals, trendingGameIds } from "@/lib/activity";
import { familiesFor } from "@/lib/games";

export const dynamic = "force-dynamic";

const publicActivity = { showActivity: true, profileVisibility: "PUBLIC" } as const;

export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const user = await getCurrentUser();
  const monthAgo = new Date(Date.now() - 30 * 86_400_000);

  const [totals, recentPlats, rareUnlocks, weekly, guides, trending, needGuides, newLists, dlcs, sessions] = await Promise.all([
    siteTotals(),
    latestPlatinums(6),
    prisma.userTrophy.findMany({
      where: { trophy: { earnedRate: { lte: ULTRA_RARE_MAX } }, user: publicActivity },
      orderBy: { earnedAt: "desc" },
      take: 5,
      include: { user: { include: { psn: true } }, trophy: { include: { game: true } } },
    }),
    getLeaderboard({ metric: "points", period: "weekly", scope: "global", limit: 5 }),
    prisma.guide.findMany({ orderBy: { createdAt: "desc" }, take: 4, include: { game: true, author: true } }),
    trendingGameIds(monthAgo, 24),
    gamesNeedingGuides(5),
    newTrophyLists(8),
    newDlc(8),
    latestSessions(10),
  ]);
  const listFamilies = await familiesFor(newLists.map((g) => g.titleKey));
  const { hunters, trophies: trophyCount, platinums: platCount } = totals;

  const trendingGames = await prisma.game.findMany({
    where: { id: { in: trending } },
    include: { trophies: { where: { type: "PLATINUM" }, select: { earnedRate: true } } },
  });
  // One card per game: a game's regional and PS4/PS5 lists count as one.
  const seenKeys = new Set<string>();
  const trendingSorted = trending
    .map((id) => trendingGames.find((g) => g.id === id))
    .filter((g): g is (typeof trendingGames)[number] => !!g)
    .filter((g) => {
      const key = g.titleKey || g.id;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    })
    .slice(0, 6);

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
            Sync your PSN trophy list, plan a platinum with a community roadmap that flags the missables, and see where you rank
            in the world, your country and your friends list.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {!user ? (
              <>
                <Link href="/register" className="btn-primary px-5 py-2.5">
                  Create a free account
                </Link>
                <Link href="/login" className="btn-ghost px-5 py-2.5">
                  Log in
                </Link>
              </>
            ) : !user.psn?.verified ? (
              <Link href="/settings#psn" className="btn-primary px-5 py-2.5">
                Link your PSN account
              </Link>
            ) : (
              <Link href={`/u/${user.username}`} className="btn-primary px-5 py-2.5">
                View my trophies
              </Link>
            )}
            <Link href="/games" className="btn-ghost px-5 py-2.5">
              Browse games
            </Link>
          </div>
          <p className="mt-8 text-xs text-muted">
            <span className="text-text">{formatNumber(hunters)}</span> hunters ·{" "}
            <span className="text-text">{formatNumber(trophyCount)}</span> trophies tracked ·{" "}
            <span className="text-text">{formatNumber(platCount)}</span> platinums
          </p>
        </div>

        <form action="/psn" className="card p-5" role="search">
          <label htmlFor="psn-id" className="label">
            Look up any PSN profile
          </label>
          <div className="flex gap-2">
            <input
              id="psn-id"
              name="id"
              required
              placeholder="PSN Online ID"
              autoComplete="off"
              spellCheck={false}
              className="input"
            />
            <button className="btn-primary">Look up</button>
          </div>
          <p className="mt-3 text-xs text-muted">
            See any public player&apos;s avatar, level and recent games, even if they haven&apos;t joined {SITE.name} yet.
          </p>
        </form>
      </section>

      <section className="grid gap-10 lg:grid-cols-[1.6fr_1fr] [&>*]:min-w-0">
        <div>
          <SectionTitle
            action={
              <Link href="/leaderboards?metric=platinums" className="link text-xs">
                Platinum leaders
              </Link>
            }
          >
            Latest platinums
          </SectionTitle>
          {recentPlats.length === 0 ? (
            <p className="text-sm text-muted">No platinums yet. They appear as players link their accounts or get tracked.</p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {recentPlats.map((p) => (
                <li key={p.key} className="flex items-center gap-3 py-2.5">
                  <GameArt title={p.game.title} hue={p.game.coverHue} iconUrl={p.game.iconUrl} size="sm" className="w-11" />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/games/${p.game.slug}`}
                      className="block truncate text-sm font-semibold hover:underline hover:underline-offset-4"
                    >
                      {p.game.title}
                    </Link>
                    <div className="truncate text-xs text-muted">
                      <Link href={p.player.href} className="hover:text-text">
                        {p.player.name}
                      </Link>{" "}
                      {flag(p.player.country)} · {timeAgo(p.at)}
                    </div>
                  </div>
                  <TrophyIcon type="PLATINUM" size={22} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <SectionTitle
            action={
              <Link href="/leaderboards?period=weekly" className="link text-xs">
                Full board
              </Link>
            }
          >
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
          <SectionTitle
            action={
              <Link href="/games" className="link text-xs">
                All games
              </Link>
            }
          >
            Most played this month
          </SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {trendingSorted.map((g) => (
              <GameCard key={g.id} game={{ ...g, platRate: g.trophies[0]?.earnedRate ?? null }} />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-10 lg:grid-cols-2 [&>*]:min-w-0">
        <div>
          <SectionTitle
            action={
              <Link href="/games" className="link text-xs">
                All games
              </Link>
            }
          >
            New trophy lists
          </SectionTitle>
          <ul className="divide-y divide-line border-y border-line">
            {newLists.map((g) => {
              const platforms = listFamilies.get(g.titleKey)?.platforms ?? g.platforms.split(",");
              const loaded = Object.keys(g.counts).length > 0;
              return (
                <li key={g.id} className="flex items-center gap-3 py-2.5">
                  <GameArt title={g.title} hue={g.coverHue} iconUrl={g.iconUrl} size="sm" className="w-11" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/games/${g.slug}`} className="block truncate text-sm font-semibold hover:underline hover:underline-offset-4">
                      {g.title}
                    </Link>
                    <div className="truncate text-xs text-muted">{platforms.join(" · ")}</div>
                  </div>
                  {loaded ? (
                    <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-muted">
                      {(["PLATINUM", "GOLD", "SILVER", "BRONZE"] as const).map((t) =>
                        g.counts[t] ? (
                          <span key={t} className="inline-flex items-center gap-0.5">
                            <TrophyIcon type={t} size={13} />
                            {g.counts[t]}
                          </span>
                        ) : null,
                      )}
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-faint">List not loaded</span>
                  )}
                </li>
              );
            })}
            {newLists.length === 0 && <li className="py-4 text-sm text-muted">No trophy lists yet.</li>}
          </ul>
        </div>
        <div>
          <SectionTitle>New DLC</SectionTitle>
          <ul className="divide-y divide-line border-y border-line">
            {dlcs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5">
                <GameArt title={d.game.title} hue={d.game.coverHue} iconUrl={d.game.iconUrl} size="sm" className="w-11" />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/games/${d.game.slug}/dlc/${d.psnGroupId}`}
                    className="block truncate text-sm font-semibold hover:underline hover:underline-offset-4"
                  >
                    {d.name}
                  </Link>
                  <div className="truncate text-xs text-muted">
                    {d.game.title} · {d.game.platforms.split(",").join(" · ")}
                  </div>
                </div>
                {d.addedLater && <span className="chip border-accent-text/50 text-accent-text">New</span>}
                <span className="shrink-0 text-xs tabular-nums text-muted">{d._count.trophies} trophies</span>
              </li>
            ))}
            {dlcs.length === 0 && <li className="py-4 text-sm text-muted">No DLC trophy packs yet.</li>}
          </ul>
        </div>
      </section>

      <section>
        <SectionTitle
          action={
            <Link href="/sessions" className="link text-xs">
              All sessions
            </Link>
          }
        >
          Gaming sessions
        </SectionTitle>
        {sessions.length === 0 ? (
          <div className="border-y border-line py-4 text-sm text-muted">
            No upcoming sessions.{" "}
            <Link href="/sessions" className="link">
              Host one
            </Link>{" "}
            for the online trophies you still need.
          </div>
        ) : (
          <ul className="grid border-t border-line lg:grid-cols-2 lg:gap-x-10">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 border-b border-line py-2.5">
                <GameArt title={s.game.title} hue={s.game.coverHue} iconUrl={s.game.iconUrl} size="sm" className="w-11" />
                <div className="min-w-0 flex-1">
                  <Link href={`/sessions#${s.id}`} className="block truncate text-sm font-semibold hover:underline hover:underline-offset-4">
                    {s.title}
                  </Link>
                  <div className="truncate text-xs text-muted">
                    {s.game.title} · {s.platform} ·{" "}
                    {formatDate(s.startsAt, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <span className={`chip shrink-0 ${s._count.members >= s.slots ? "border-bad/40 text-bad" : "border-good/40 text-good"}`}>
                  {s._count.members}/{s.slots}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-10 lg:grid-cols-2 [&>*]:min-w-0">
        <div>
          <SectionTitle
            action={
              <Link href="/guides" className="link text-xs">
                All guides
              </Link>
            }
          >
            Latest guides
          </SectionTitle>
          <ul className="divide-y divide-line border-y border-line">
            {guides.map((g) => (
              <li key={g.id}>
                <Link href={`/guides/${g.slug}`} className="group flex gap-4 py-3">
                  <GameArt title={g.game.title} hue={g.game.coverHue} iconUrl={g.game.iconUrl} size="sm" className="w-12" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold group-hover:underline group-hover:underline-offset-4">{g.title}</div>
                    <div className="line-clamp-2 text-xs text-muted">{g.summary}</div>
                    <div className="mt-1 text-xs text-faint">
                      by {g.author.username} · {timeAgo(g.createdAt)}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {guides.length === 0 && (
            <div className="border-b border-line py-4 text-sm">
              <p className="text-muted">
                No guides yet. Guides are written by members, so the first ones are up for grabs.
                {needGuides.length > 0 && " These games have the most players and no guide:"}
              </p>
              {needGuides.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {needGuides.map(({ game, players }) => (
                    <li key={game.id} className="flex items-center gap-3">
                      <GameArt title={game.title} hue={game.coverHue} iconUrl={game.iconUrl} size="sm" className="w-8" />
                      <Link
                        href={`/games/${game.slug}`}
                        className="min-w-0 flex-1 truncate hover:underline hover:underline-offset-4"
                      >
                        {game.title}
                      </Link>
                      <span className="text-xs text-faint">{players} players</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/guides/new" className="btn-ghost mt-4">
                Write a guide
              </Link>
            </div>
          )}
        </div>
        <div>
          <SectionTitle>Recent ultra rares</SectionTitle>
          <ul className="divide-y divide-line border-y border-line">
            {rareUnlocks.map((u) => (
              <li key={u.id} className="flex items-center gap-3 py-2.5">
                <TrophyIcon type={u.trophy.type} size={22} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/trophies/${u.trophy.id}`}
                    className="block truncate text-sm font-semibold hover:underline hover:underline-offset-4"
                  >
                    {u.trophy.name}
                  </Link>
                  <div className="truncate text-xs text-muted">
                    <Link href={`/u/${u.user.username}`} className="hover:text-text">
                      {u.user.psn?.onlineId ?? u.user.username}
                    </Link>{" "}
                    · {u.trophy.game.title} · {timeAgo(u.earnedAt)}
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
