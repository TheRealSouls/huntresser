import { prisma } from "./db";

export async function getFriendIds(userId: string): Promise<string[]> {
  const rows = await prisma.friendship.findMany({
    where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { addresseeId: userId }] },
    select: { requesterId: true, addresseeId: true },
  });
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
}

export type FriendState = "SELF" | "FRIENDS" | "OUTGOING" | "INCOMING" | "NONE";

export async function friendState(viewerId: string | null, otherId: string): Promise<FriendState> {
  if (!viewerId) return "NONE";
  if (viewerId === otherId) return "SELF";
  const f = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: viewerId, addresseeId: otherId },
        { requesterId: otherId, addresseeId: viewerId },
      ],
    },
  });
  if (!f) return "NONE";
  if (f.status === "ACCEPTED") return "FRIENDS";
  return f.requesterId === viewerId ? "OUTGOING" : "INCOMING";
}

/** Privacy gate for profile data (trophies, games, friends, milestones). */
export async function canViewProfile(
  viewerId: string | null,
  owner: { id: string; profileVisibility: string },
): Promise<boolean> {
  if (owner.profileVisibility === "PUBLIC") return true;
  if (viewerId === owner.id) return true;
  if (owner.profileVisibility === "FRIENDS" && viewerId) {
    return (await friendState(viewerId, owner.id)) === "FRIENDS";
  }
  return false;
}
