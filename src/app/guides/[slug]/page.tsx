import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { trophyHref } from "@/lib/trophy-slug";
import { getSessionUserId } from "@/lib/auth";
import { formatDate, formatNumber } from "@/lib/utils";
import { GameArt } from "@/components/art";
import { TrophyIcon } from "@/components/TrophyIcon";
import { StepCheck } from "@/components/client";
import { Tips } from "@/components/Tips";
import { YouTube } from "@/components/YouTube";
import { Avatar, DifficultyMeter, RarityBadge } from "@/components/ui";

type Params = { slug: string };

const load = cache(async (slug: string) => {
  const guide = await prisma.guide.findUnique({
    where: { slug },
    include: {
      game: true,
      author: { include: { psn: true } },
      steps: { orderBy: { order: "asc" }, include: { trophy: { include: { game: { select: { slug: true } } } } } },
    },
  });
  if (!guide) notFound();
  return guide;
});

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const g = await load((await params).slug);
  return { title: g.title, description: g.summary };
}

const SECTIONS = [
  { kind: "ROADMAP", id: "roadmap", title: "Roadmap" },
  { kind: "MISSABLE", id: "missable", title: "Missables" },
  { kind: "COLLECTIBLE", id: "collectible", title: "Collectibles" },
  { kind: "SPEEDRUN", id: "speedrun", title: "Speedrun route" },
] as const;

export default async function GuidePage({ params }: { params: Promise<Params> }) {
  const guide = await load((await params).slug);
  await prisma.guide.update({ where: { id: guide.id }, data: { views: { increment: 1 } } });

  const viewerId = await getSessionUserId();
  const earnedIds = viewerId
    ? new Set(
        (
          await prisma.userTrophy.findMany({
            where: { userId: viewerId, trophyId: { in: guide.steps.flatMap((s) => (s.trophyId ? [s.trophyId] : [])) } },
            select: { trophyId: true },
          })
        ).map((r) => r.trophyId),
      )
    : new Set<string>();

  const present = SECTIONS.filter((s) => guide.steps.some((st) => st.kind === s.kind));

  return (
    <div>
      <nav className="mb-4 text-sm text-muted">
        <Link href="/guides" className="hover:text-text">Guides</Link> <span className="mx-1">/</span>
        <Link href={`/games/${guide.game.slug}`} className="hover:text-text">{guide.game.title}</Link>
      </nav>

      <header className="card mb-8 grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto]">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{guide.title}</h1>
          <p className="mt-3 max-w-2xl text-text/90">{guide.summary}</p>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted">
            <Avatar name={guide.author.username} hue={guide.author.avatarHue} url={guide.author.psn?.avatarUrl} size={24} />
            <Link href={`/u/${guide.author.username}`} className="font-semibold text-text hover:text-accent-text">
              {guide.author.psn?.onlineId ?? guide.author.username}
            </Link>
            · updated {formatDate(guide.updatedAt)} · {formatNumber(guide.views)} views
          </div>
        </div>
        <GameArt title={guide.game.title} hue={guide.game.coverHue} iconUrl={guide.game.iconUrl} className="hidden w-28 md:block" />
        <dl className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-5 md:col-span-2">
          <div className="bg-surface p-3">
            <dt className="label">Difficulty</dt>
            <dd><DifficultyMeter value={guide.difficulty} /></dd>
          </div>
          {[
            ["Time", `~${guide.hoursEstimate}h`],
            ["Playthroughs", guide.playthroughs],
            ["Missables", guide.missableCount],
            ["Online", guide.onlineRequired ? "Required" : "No"],
          ].map(([k, v]) => (
            <div key={k} className="bg-surface p-3">
              <dt className="label">{k}</dt>
              <dd className={`text-xl font-bold ${k === "Missables" && Number(v) > 0 ? "text-bad" : ""}`}>{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1 text-sm" aria-label="Guide sections">
            {present.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="block rounded-sm px-3 py-2 text-muted hover:bg-surface-2 hover:text-text">
                {s.title}
              </a>
            ))}
            <a href="#tips" className="block rounded-sm px-3 py-2 text-muted hover:bg-surface-2 hover:text-text">Community tips</a>
          </nav>
        </aside>

        <div className="min-w-0 space-y-12">
          {guide.videoYoutubeId && <YouTube id={guide.videoYoutubeId} title={`${guide.title} video`} />}

          {present.map((section) => {
            const steps = guide.steps.filter((s) => s.kind === section.kind);
            return (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="mb-2 text-2xl font-bold">{section.title}</h2>
                {section.kind === "MISSABLE" && (
                  <p className="mb-4 rounded-sm border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
                    These can be permanently missed. Read them before you start.
                  </p>
                )}
                {section.kind === "COLLECTIBLE" && (
                  <p className="mb-4 text-sm text-muted">Tick items off as you go. Your checklist is saved in this browser.</p>
                )}
                <ol className="space-y-3">
                  {steps.map((s, i) => (
                    <li
                      key={s.id}
                      className={`card flex gap-4 p-5 ${section.kind === "MISSABLE" ? "border-bad/30" : ""}`}
                    >
                      {section.kind === "ROADMAP" ? (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-accent font-bold">{i + 1}</span>
                      ) : section.kind === "COLLECTIBLE" ? (
                        <StepCheck id={s.id} />
                      ) : section.kind === "MISSABLE" ? (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-bad/20 font-bold text-bad">!</span>
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-surface-3 text-xs font-bold">{i + 1}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-semibold">{s.title}</h3>
                        <p className="prose-guide mt-1">{s.body}</p>
                        {s.trophy && (
                          <Link
                            href={s.trophy.slug ? trophyHref(s.trophy.game.slug, s.trophy.slug) : `/trophies/${s.trophy.id}`}
                            className="mt-3 inline-flex items-center gap-2 rounded-sm border border-line bg-surface-2 px-3 py-1.5 text-sm hover:border-muted"
                          >
                            <TrophyIcon type={s.trophy.type} size={18} dim={viewerId ? !earnedIds.has(s.trophy.id) : false} />
                            <span className="font-semibold">{s.trophy.hidden && !earnedIds.has(s.trophy.id) ? "Hidden trophy" : s.trophy.name}</span>
                            <RarityBadge rate={s.trophy.earnedRate} />
                            {earnedIds.has(s.trophy.id) && <span className="text-xs text-good">earned</span>}
                          </Link>
                        )}
                        {s.videoYoutubeId && (
                          <div className="mt-3 max-w-xl">
                            <YouTube id={s.videoYoutubeId} title={s.title} />
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}

          <Tips guideId={guide.id} path={`/guides/${guide.slug}`} />
        </div>
      </div>
    </div>
  );
}
