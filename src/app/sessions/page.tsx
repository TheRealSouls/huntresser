import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { flag } from "@/lib/countries";
import { formatDate } from "@/lib/utils";
import { toggleSession } from "@/actions/community";
import { GameArt } from "@/components/art";
import { Avatar, EmptyState, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { SessionForm } from "./SessionForm";

export const metadata: Metadata = { title: "Sessions", description: "Boosting and co-op sessions for online trophies." };

export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const sp = await searchParams;
  const viewerId = await getSessionUserId();
  const [sessions, games] = await Promise.all([
    prisma.session.findMany({
      where: { startsAt: { gte: new Date(Date.now() - 2 * 3600_000) } },
      orderBy: { startsAt: "asc" },
      include: { game: true, host: { include: { psn: true } }, members: { include: { user: { include: { psn: true } } } } },
    }),
    viewerId ? prisma.game.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true, platforms: true } }) : [],
  ]);

  return (
    <div>
      <PageHeader kicker="Online trophies" title="Sessions">
        Team up for online, co-op and multiplayer trophies. Join a session or host your own.
      </PageHeader>
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {sessions.length === 0 && <EmptyState title="No upcoming sessions">Be the first to host one.</EmptyState>}
          {sessions.map((s) => {
            const joined = s.members.some((m) => m.userId === viewerId);
            const full = s.members.length >= s.slots;
            return (
              <article key={s.id} id={s.id} className="card scroll-mt-24 p-5 target:border-accent-text">
                <div className="flex flex-wrap items-start gap-4">
                  <Link href={`/games/${s.game.slug}`}>
                    <GameArt title={s.game.title} hue={s.game.coverHue} iconUrl={s.game.iconUrl} size="sm" className="w-14" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-accent-text">
                      {s.game.title} · {s.platform}
                    </div>
                    <h2 className="text-lg font-semibold">{s.title}</h2>
                    {s.description && <p className="text-sm text-muted">{s.description}</p>}
                    <div className="mt-2 text-sm">
                      <span className="font-semibold">
                        {formatDate(s.startsAt, { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>{" "}
                      <span className="text-muted">
                        · hosted by{" "}
                        <Link href={`/u/${s.host.username}`} className="hover:text-text">{s.host.psn?.onlineId ?? s.host.username}</Link>{" "}
                        {flag(s.host.country)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`chip ${full ? "border-bad/40 text-bad" : "border-good/40 text-good"}`}>
                      {s.members.length}/{s.slots} {full ? "full" : "joined"}
                    </span>
                    {viewerId ? (
                      (joined || !full) && (
                        <form action={toggleSession}>
                          <input type="hidden" name="sessionId" value={s.id} />
                          <SubmitButton className={joined ? "btn-ghost" : "btn-primary"}>
                            {joined ? (s.hostId === viewerId ? "Cancel session" : "Leave") : "Join"}
                          </SubmitButton>
                        </form>
                      )
                    ) : (
                      <Link href="/login?next=/sessions" className="btn-ghost">Log in to join</Link>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex -space-x-2">
                  {s.members.map((m) => (
                    <Link key={m.userId} href={`/u/${m.user.username}`} title={m.user.psn?.onlineId ?? m.user.username}>
                      <Avatar name={m.user.psn?.onlineId ?? m.user.username} hue={m.user.avatarHue} url={m.user.psn?.avatarUrl} size={30} className="ring-surface" />
                    </Link>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
        <aside>
          <section className="card sticky top-24 p-5">
            <h2 className="mb-4 font-bold">Host a session</h2>
            {viewerId ? (
              <SessionForm games={games} initialGameId={sp.new} />
            ) : (
              <p className="text-sm text-muted">
                <Link href="/login?next=/sessions" className="link">Log in</Link> to host a session.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
