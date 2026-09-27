import Link from "next/link";
import { addFriend, removeFriend, respondToRequest } from "@/actions/friends";
import { prisma } from "@/lib/db";
import { COUNTRIES, flag } from "@/lib/countries";
import type { FriendState } from "@/lib/social";
import type { UserStats } from "@/lib/stats";
import { formatDate, formatNumber, timeAgo } from "@/lib/utils";
import { TrophyCounts } from "@/components/TrophyIcon";
import { Avatar, ProgressBar, Stat, StatGrid } from "@/components/ui";
import { ConfirmButton, SubmitButton } from "@/components/client";

type Owner = {
  id: string;
  username: string;
  bio: string | null;
  country: string | null;
  avatarHue: number;
  createdAt: Date;
  profileVisibility: string;
  psn: { onlineId: string; avatarUrl: string | null; verified: boolean; lastSyncedAt: Date | null } | null;
};

export async function ProfileHeader({
  owner,
  stats,
  relation,
  viewerId,
}: {
  owner: Owner;
  stats: UserStats | null;
  relation: FriendState;
  viewerId: string | null;
}) {
  const display = owner.psn?.verified ? owner.psn.onlineId : owner.username;
  const incoming =
    relation === "INCOMING"
      ? await prisma.friendship.findFirst({ where: { requesterId: owner.id, addresseeId: viewerId!, status: "PENDING" } })
      : null;

  return (
    <section className="mb-8 border border-line bg-surface">
      <div className="flex flex-wrap items-start gap-5 p-5 sm:p-6">
        <Avatar name={display} hue={owner.avatarHue} url={owner.psn?.avatarUrl} size={96} className="border border-line" />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 break-all text-2xl font-bold tracking-tight sm:text-3xl">
            {display}
            {owner.country && (
              <span className="text-xl" title={COUNTRIES[owner.country]}>
                {flag(owner.country)}
              </span>
            )}
            {owner.profileVisibility !== "PUBLIC" && (
              <span className="chip">{owner.profileVisibility === "FRIENDS" ? "Friends only" : "Private"}</span>
            )}
          </h1>
          <div className="mt-1 text-xs text-muted">
            @{owner.username} · joined {formatDate(owner.createdAt, { month: "short", year: "numeric" })}
            {owner.psn?.lastSyncedAt && <> · synced {timeAgo(owner.psn.lastSyncedAt)}</>}
          </div>
          {owner.bio && <p className="mt-3 max-w-2xl text-sm text-text/90">{owner.bio}</p>}
        </div>
        <div className="flex gap-2">
          {relation === "SELF" && (
            <Link href="/settings" className="btn-ghost">Edit profile</Link>
          )}
          {relation !== "SELF" && (
            <Link href={`/compare?b=${owner.username}`} className="btn-ghost">Compare</Link>
          )}
          {relation === "NONE" && viewerId && (
            <form action={addFriend}>
              <input type="hidden" name="username" value={owner.username} />
              <SubmitButton>Add friend</SubmitButton>
            </form>
          )}
          {relation === "NONE" && !viewerId && (
            <Link href={`/login?next=/u/${owner.username}`} className="btn-primary">Add friend</Link>
          )}
          {relation === "OUTGOING" && <span className="btn-ghost cursor-default">Request sent</span>}
          {relation === "INCOMING" && incoming && (
            <form action={respondToRequest}>
              <input type="hidden" name="id" value={incoming.id} />
              <input type="hidden" name="accept" value="1" />
              <SubmitButton>Accept friend request</SubmitButton>
            </form>
          )}
          {relation === "FRIENDS" && (
            <form action={removeFriend}>
              <input type="hidden" name="userId" value={owner.id} />
              <ConfirmButton message={`Remove ${owner.username} from your friends?`} className="btn-ghost">
                Friends
              </ConfirmButton>
            </form>
          )}
        </div>
      </div>

      {stats && (
        <>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-line px-5 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="text-[11px] uppercase tracking-wider text-muted">Level</span>
              <span className="text-2xl font-bold tabular-nums">{stats.level}</span>
              <div className="w-32">
                <ProgressBar value={stats.progress} />
                <div className="mt-1 text-[11px] text-muted">{stats.progress}% · {formatNumber(stats.points)} pts</div>
              </div>
            </div>
            <TrophyCounts {...stats} size={18} className="flex-wrap" />
          </div>
          <StatGrid className="-mx-px -mb-px grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Trophies" value={formatNumber(stats.total)} />
            <Stat label="Games" value={stats.games} />
            <Stat label="Platinums" value={stats.platinum} />
            <Stat label="100% games" value={stats.completed} />
            <Stat label="Avg completion" value={`${stats.avgCompletion}%`} />
            <Stat label="Ultra rares" value={stats.ultraRare} />
          </StatGrid>
        </>
      )}
    </section>
  );
}
