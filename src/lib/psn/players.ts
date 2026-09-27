import { prisma } from "../db";
import { pointsFor } from "../trophies";

/**
 * A PSN npId is base64 of "OnlineId@b5.ie". The part after the last dot is
 * the account's country.
 */
export function countryFromNpId(npId: string | null | undefined): string | null {
  if (!npId) return null;
  try {
    const decoded = Buffer.from(npId, "base64").toString("utf8");
    const code = decoded.slice(decoded.lastIndexOf(".") + 1).toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

export type PlayerSnapshot = {
  accountId: string;
  onlineId: string;
  avatarUrl: string | null;
  country: string | null;
  isPlus: boolean;
  trophyLevel: number;
  levelProgress: number;
  earned: { platinum: number; gold: number; silver: number; bronze: number };
};

/** Stores the latest public summary of a PSN player for the leaderboards. */
export async function recordPlayer(p: PlayerSnapshot) {
  const data = {
    onlineId: p.onlineId,
    avatarUrl: p.avatarUrl,
    isPlus: p.isPlus,
    trophyLevel: p.trophyLevel,
    levelProgress: p.levelProgress,
    ...p.earned,
    points: pointsFor(p.earned),
    // PSN leaves out the trophy summary (level 0 here) when a player's trophies are private.
    trophiesPrivate: p.trophyLevel <= 0,
    // Keep a known country if this response didn't include one.
    ...(p.country ? { country: p.country } : {}),
  };
  await prisma.psnPlayer.upsert({
    where: { accountId: p.accountId },
    create: { accountId: p.accountId, country: p.country, ...data },
    update: data,
  });
}

/** Records a player without letting a database hiccup break the page that saw them. */
export function recordPlayerQuietly(p: PlayerSnapshot) {
  return recordPlayer(p).catch((err) => console.error("[players] record failed", err));
}

export async function markTrophiesPrivate(accountId: string, isPrivate: boolean) {
  await prisma.psnPlayer.updateMany({ where: { accountId, trophiesPrivate: !isPrivate }, data: { trophiesPrivate: isPrivate } }).catch(() => {});
}
