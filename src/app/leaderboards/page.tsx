import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { getCurrentUser } from "@/lib/auth";
import { COMPLETION_MIN_GAMES, getLeaderboard, METRICS, PERIODS, SCOPES, type Metric, type Period, type Scope } from "@/lib/leaderboard";
import { COUNTRIES, flag } from "@/lib/countries";
import { formatNumber } from "@/lib/utils";
import { TrophyIcon } from "@/components/TrophyIcon";
import { Avatar, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Leaderboards", description: "Global, country and friends trophy leaderboards." };
export const dynamic = "force-dynamic";

type Search = { scope?: string; period?: string; metric?: string; country?: string };

const pickKey = <T extends Record<string, string>>(obj: T, v: string | undefined, fallback: keyof T) =>
  (v && v in obj ? v : fallback) as keyof T;

export default async function LeaderboardsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const scope = pickKey(SCOPES, sp.scope, "global") as Scope;
  const period = pickKey(PERIODS, sp.period, "all") as Period;
  let metric = pickKey(METRICS, sp.metric, "points") as Metric;
  if (metric === "completion" && period !== "all") metric = "points";
  const country = sp.country && sp.country in COUNTRIES ? sp.country : (user?.country ?? "GB");

  const rows = await getLeaderboard({ metric, period, scope, country, viewerId: user?.id });

  const href = (o: Partial<Record<keyof Search, string>>) => {
    const p = new URLSearchParams({ scope, period, metric, ...(scope === "country" ? { country } : {}), ...o });
    return `/leaderboards?${p}`;
  };

  const valueOf = (r: (typeof rows)[number]) =>
    metric === "points" ? formatNumber(r.points) : metric === "platinums" ? r.platinums : metric === "rare" ? r.rare : `${r.completion}%`;

  return (
    <div>
      <PageHeader kicker="Compete" title="Leaderboards">
        {period === "all" ? "All-time standings" : period === "weekly" ? "Trophies earned since Monday (UTC)" : "Trophies earned this calendar month (UTC)"}
        {scope === "country" && ` in ${COUNTRIES[country]}`}
        {scope === "friends" && " among you and your friends"}.
      </PageHeader>

      <div className="card mb-6 space-y-4 p-4">
        <Group label="Scope">
          {Object.entries(SCOPES).map(([k, l]) => (
            <Pill key={k} href={href({ scope: k })} active={scope === k}>{l}</Pill>
          ))}
          {scope === "country" && (
            <form action="/leaderboards" className="ml-2 flex gap-2">
              <input type="hidden" name="scope" value="country" />
              <input type="hidden" name="period" value={period} />
              <input type="hidden" name="metric" value={metric} />
              <select name="country" defaultValue={country} className="input py-1.5" aria-label="Country">
                {Object.entries(COUNTRIES).map(([c, n]) => (
                  <option key={c} value={c}>{flag(c)} {n}</option>
                ))}
              </select>
              <button className="btn-ghost py-1.5">Go</button>
            </form>
          )}
        </Group>
        <Group label="Period">
          {Object.entries(PERIODS).map(([k, l]) => (
            <Pill key={k} href={href({ period: k })} active={period === k}>{l}</Pill>
          ))}
        </Group>
        <Group label="Ranked by">
          {Object.entries(METRICS).map(([k, l]) =>
            k === "completion" && period !== "all" ? null : (
              <Pill key={k} href={href({ metric: k })} active={metric === k}>{l}</Pill>
            ),
          )}
        </Group>
      </div>

      {scope === "friends" && !user ? (
        <EmptyState title="Log in to see your friends board" action={<Link href="/login?next=/leaderboards?scope=friends" className="btn-primary">Log in</Link>} />
      ) : rows.length === 0 ? (
        <EmptyState title="Nobody here yet">No trophies have been earned in this window.</EmptyState>
      ) : (
        <>
          {rows.length >= 3 && (
            <ol className="mb-6 grid gap-3 sm:grid-cols-3">
              {rows.slice(0, 3).map((r) => (
                <li
                  key={r.userId}
                  className={clsx(
                    "card relative flex flex-col items-center p-5 text-center",
                    r.rank === 1 && "border-gold/60 sm:order-2",
                    r.rank === 2 && "sm:order-1 sm:mt-6",
                    r.rank === 3 && "sm:order-3 sm:mt-6",
                  )}
                >
                  <span className={clsx("absolute left-3 top-2 text-lg font-bold", r.rank === 1 ? "text-gold" : "text-muted")}>{r.rank}</span>
                  <Avatar name={r.onlineId ?? r.username} hue={r.avatarHue} url={r.avatarUrl} size={r.rank === 1 ? 72 : 60} />
                  <Link href={`/u/${r.username}`} className="mt-3 break-all font-bold hover:underline hover:underline-offset-4">
                    {r.onlineId ?? r.username} <span className="text-sm">{flag(r.country)}</span>
                  </Link>
                  <div className="mt-1 text-xl font-bold tabular-nums">{valueOf(r)}</div>
                  <div className="text-xs text-muted">{METRICS[metric]}</div>
                </li>
              ))}
            </ol>
          )}
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-line bg-surface-2 text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="w-14 px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Hunter</th>
                  <Th active={metric === "points"}>Points</Th>
                  <Th active={metric === "platinums"}>Plats</Th>
                  <Th active={metric === "rare"}>Ultra rares</Th>
                  <Th>Trophies</Th>
                  {period === "all" && <Th active={metric === "completion"}>Avg %</Th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.userId} className={clsx(r.userId === user?.id && "bg-surface-3")}>
                    <td className="px-4 py-2.5 tabular-nums text-muted">{r.rank}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/u/${r.username}`} className="flex items-center gap-2.5 font-semibold hover:underline hover:underline-offset-4">
                        <Avatar name={r.onlineId ?? r.username} hue={r.avatarHue} url={r.avatarUrl} size={28} />
                        {r.onlineId ?? r.username}
                        <span title={r.country ? COUNTRIES[r.country] : undefined}>{flag(r.country)}</span>
                        {r.userId === user?.id && <span className="chip">You</span>}
                      </Link>
                    </td>
                    <Td active={metric === "points"}>{formatNumber(r.points)}</Td>
                    <Td active={metric === "platinums"}>
                      <span className="inline-flex items-center gap-1"><TrophyIcon type="PLATINUM" size={13} />{r.platinums}</span>
                    </Td>
                    <Td active={metric === "rare"}>{r.rare}</Td>
                    <Td>{formatNumber(r.trophies)}</Td>
                    {period === "all" && <Td active={metric === "completion"}>{r.completion}%</Td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {metric === "completion" && (
            <p className="mt-3 text-xs text-faint">Completion rankings require at least {COMPLETION_MIN_GAMES} games.</p>
          )}
        </>
      )}
      <p className="mt-4 text-xs text-faint">
        Points: platinum 300 · gold 90 · silver 30 · bronze 15. Ultra rare means 5% of players or fewer have it. Global and country boards only
        include public profiles; friends-only profiles appear on their friends&apos; boards.
      </p>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 text-xs uppercase tracking-wider text-muted">{label}</span>
      {children}
    </div>
  );
}

function Pill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={clsx(
        "border px-3 py-1 text-sm",
        active ? "border-accent bg-accent text-white" : "border-line text-muted hover:border-muted hover:text-text",
      )}
    >
      {children}
    </Link>
  );
}

function Th({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return <th className={clsx("px-4 py-3 text-right", active && "text-accent-text")}>{children}</th>;
}
function Td({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return <td className={clsx("px-4 py-2.5 text-right tabular-nums", active && "font-bold text-text")}>{children}</td>;
}
