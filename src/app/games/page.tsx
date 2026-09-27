import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { familiesFor } from "@/lib/games";
import { GameCard } from "@/components/GameCard";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Games", description: "Every PlayStation game with trophy lists, difficulty and time-to-platinum estimates." };

const SORTS = {
  popular: "Most played",
  release: "Newest",
  easiest: "Easiest platinum",
  hardest: "Hardest platinum",
  shortest: "Shortest",
  title: "A to Z",
} as const;

type Search = { q?: string; platform?: string; genre?: string; sort?: keyof typeof SORTS; online?: string; page?: string };

const PER_PAGE = 60;

export default async function GamesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const sort = sp.sort && sp.sort in SORTS ? sp.sort : "popular";

  const where: Prisma.GameWhereInput = {
    ...(sp.q ? { title: { contains: sp.q } } : {}),
    ...(sp.platform ? { platforms: { contains: sp.platform } } : {}),
    ...(sp.genre ? { genre: sp.genre } : {}),
    ...(sp.online === "0" ? { hasOnlineTrophies: false } : {}),
  };
  const orderBy: Prisma.GameOrderByWithRelationInput[] = [
    {
      popular: { userGames: { _count: "desc" as const } },
      release: { releaseDate: { sort: "desc" as const, nulls: "last" as const } },
      easiest: { difficulty: { sort: "asc" as const, nulls: "last" as const } },
      hardest: { difficulty: { sort: "desc" as const, nulls: "last" as const } },
      shortest: { hoursToPlatinum: { sort: "asc" as const, nulls: "last" as const } },
      title: { title: "asc" as const },
    }[sort],
    // When a game has several trophy lists, the PS5 one represents it.
    { npServiceName: "desc" },
    { title: "asc" },
  ];
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  // One card per game: trophy lists that share a titleKey collapse into one.
  const [games, total, genres] = await Promise.all([
    prisma.game.findMany({
      where,
      orderBy,
      distinct: ["titleKey"],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { trophies: { where: { type: "PLATINUM" }, select: { earnedRate: true } }, _count: { select: { trophies: true } } },
    }),
    prisma.game.groupBy({ by: ["titleKey"], where }).then((g) => g.length),
    prisma.game.findMany({ distinct: ["genre"], select: { genre: true }, where: { genre: { not: null } }, orderBy: { genre: "asc" } }),
  ]);

  const families = await familiesFor(games.map((g) => g.titleKey));
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const qs = (o: Partial<Search>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, page: undefined, ...o }).filter(([, v]) => v) as [string, string][]);
    return `/games?${p}`;
  };

  return (
    <div>
      <PageHeader kicker="Game database" title="Games">
        Trophy lists, DLC, difficulty and time estimates for every game in the catalogue.
      </PageHeader>

      <form className="card mb-6 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto]" action="/games">
        <label className="sr-only" htmlFor="gq">Search games</label>
        <input id="gq" name="q" defaultValue={sp.q} placeholder="Search by title…" className="input" />
        <select name="platform" defaultValue={sp.platform ?? ""} className="input" aria-label="Platform">
          <option value="">All platforms</option>
          {["PS5", "PS4", "PS3", "PSVITA"].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select name="genre" defaultValue={sp.genre ?? ""} className="input" aria-label="Genre">
          <option value="">All genres</option>
          {genres.map((g) => (
            <option key={g.genre} value={g.genre!}>{g.genre}</option>
          ))}
        </select>
        <input type="hidden" name="sort" value={sort} />
        <button className="btn-primary">Filter</button>
        <label className="flex items-center gap-2 text-sm text-muted sm:col-span-4">
          <input type="checkbox" name="online" value="0" defaultChecked={sp.online === "0"} className="accent-[var(--color-accent)]" />
          Hide games with online trophies
        </label>
      </form>

      <div className="mb-5 flex flex-wrap gap-2">
        {Object.entries(SORTS).map(([k, l]) => (
          <Link key={k} href={qs({ sort: k as keyof typeof SORTS })} className={clsx("chip", sort === k && "chip-active")}>
            {l}
          </Link>
        ))}
        <span className="ml-auto text-sm text-muted">{total.toLocaleString("en-GB")} games</span>
      </div>

      {games.length === 0 ? (
        <EmptyState title="No games match" action={<Link href="/games" className="btn-ghost">Clear filters</Link>} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {games.map((g) => (
            <GameCard key={g.id} game={{ ...g, platRate: g.trophies[0]?.earnedRate ?? null }} family={families.get(g.titleKey)} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav className="mt-8 flex items-center justify-between border-t border-line pt-4 text-sm" aria-label="Pagination">
          {page > 1 ? <Link href={qs({ page: String(page - 1) })} className="btn-ghost">Previous</Link> : <span />}
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={qs({ page: String(page + 1) })} className="btn-ghost">Next</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
