import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { rarityOf } from "@/lib/trophies";
import { flag } from "@/lib/countries";
import { formatDate, timeAgo } from "@/lib/utils";
import { GameArt } from "@/components/art";
import { TrophyIcon } from "@/components/TrophyIcon";
import { HiddenTrophyReveal } from "@/components/client";
import { Tips } from "@/components/Tips";
import { Avatar, RarityBadge, Stat, StatGrid } from "@/components/ui";

type Params = { id: string };

async function load(id: string) {
  const t = await prisma.trophy.findUnique({ where: { id }, include: { game: true, group: true } });
  if (!t) notFound();
  return t;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const t = await load((await params).id);
  return { title: t.hidden ? `Hidden trophy · ${t.game.title}` : `${t.name} · ${t.game.title}` };
}

export default async function TrophyPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const t = await load(id);
  const viewerId = await getSessionUserId();

  const [mine, earnerCount, owners, recent, steps] = await Promise.all([
    viewerId ? prisma.userTrophy.findUnique({ where: { userId_trophyId: { userId: viewerId, trophyId: t.id } } }) : null,
    prisma.userTrophy.count({ where: { trophyId: t.id } }),
    prisma.userGame.count({ where: { gameId: t.gameId } }),
    prisma.userTrophy.findMany({
      where: { trophyId: t.id, user: { profileVisibility: "PUBLIC", showActivity: true } },
      orderBy: { earnedAt: "desc" },
      take: 8,
      include: { user: { include: { psn: true } } },
    }),
    prisma.guideStep.findMany({ where: { trophyId: t.id }, include: { guide: true }, take: 5 }),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <nav className="mb-4 text-sm text-muted">
        <Link href={`/games/${t.game.slug}`} className="hover:text-text">{t.game.title}</Link>
        {t.group.isDlc && (
          <>
            <span className="mx-1">/</span>
            <Link href={`/games/${t.game.slug}/dlc/${t.group.psnGroupId}`} className="hover:text-text">{t.group.name}</Link>
          </>
        )}
        <span className="mx-1">/</span> Trophy
      </nav>

      <header className="card mb-8 flex flex-wrap items-center gap-6 p-6 sm:p-8">
        <div className="rounded-sm bg-surface-3 p-4">
          <TrophyIcon type={t.type} size={64} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap gap-1.5">
            <span className="chip capitalize">{t.type.toLowerCase()}</span>
            {t.missable && <span className="chip border-bad/40 bg-bad/10 text-bad">Missable</span>}
            {t.online && <span className="chip border-rare/40 text-rare">Online</span>}
            {t.hidden && <span className="chip">Hidden</span>}
            {t.group.isDlc && <span className="chip border-very/40 text-very">DLC</span>}
          </div>
          {t.hidden && !mine ? (
            <div className="text-xl">
              <HiddenTrophyReveal name={t.name} description={t.description} />
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-bold">{t.name}</h1>
              <p className="text-muted">{t.description}</p>
            </>
          )}
          {mine && <p className="mt-2 text-sm font-semibold text-good">You earned this on {formatDate(mine.earnedAt)}</p>}
        </div>
        <Link href={`/games/${t.game.slug}`} className="hidden sm:block">
          <GameArt title={t.game.title} hue={t.game.coverHue} iconUrl={t.game.iconUrl} className="w-20" />
        </Link>
      </header>

      <StatGrid className="mb-10 grid-cols-2 sm:grid-cols-4">
        <Stat label="PSN rarity" value={<RarityBadge rate={t.earnedRate} className="text-sm" />} sub={t.earnedRate != null ? rarityOf(t.earnedRate).label : "Not reported yet"} />
        <Stat label="Earned by members" value={earnerCount} sub={`of ${owners} players`} />
        <Stat label="Member rate" value={owners ? `${((earnerCount / owners) * 100).toFixed(1)}%` : "n/a"} />
        <Stat label="Game difficulty" value={t.game.difficulty ? `${Math.round(t.game.difficulty)}/10` : "n/a"} />
      </StatGrid>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-8">
          {steps.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-bold">In the guides</h2>
              <ul className="space-y-3">
                {steps.map((s) => (
                  <li key={s.id} className="card p-4">
                    <Link href={`/guides/${s.guide.slug}#${s.kind.toLowerCase()}`} className="text-xs font-semibold uppercase tracking-wider text-accent-text hover:underline">
                      {s.guide.title} · {s.kind.toLowerCase()}
                    </Link>
                    <div className="mt-1 font-semibold">{s.title}</div>
                    <p className="prose-guide mt-1 line-clamp-4 text-sm text-muted">{s.body}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <Tips trophyId={t.id} path={`/trophies/${t.id}`} />
        </div>
        <aside className="card h-fit p-5">
          <h2 className="mb-3 font-bold">Recently earned by</h2>
          <ul className="space-y-2.5">
            {recent.map((e) => (
              <li key={e.id} className="flex items-center gap-2.5 text-sm">
                <Avatar name={e.user.psn?.onlineId ?? e.user.username} hue={e.user.avatarHue} url={e.user.psn?.avatarUrl} size={28} />
                <Link href={`/u/${e.user.username}`} className="flex-1 truncate font-semibold hover:text-accent-text">
                  {e.user.psn?.onlineId ?? e.user.username} <span className="text-xs">{flag(e.user.country)}</span>
                </Link>
                <span className="text-xs text-muted">{timeAgo(e.earnedAt)}</span>
              </li>
            ))}
            {recent.length === 0 && <li className="text-sm text-muted">No member has earned this yet.</li>}
          </ul>
        </aside>
      </div>
    </div>
  );
}
