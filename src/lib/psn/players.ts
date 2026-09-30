import {
  getProfileFromAccountId,
  getProfileFromUserName,
  getUserFriendsAccountIds,
  getUserTitles,
  getUserTrophiesEarnedForTitle,
  type ProfileFromUserNameResponse,
} from "psn-api";
import { prisma } from "../db";
import { pointsFor } from "../trophies";
import { importTitles } from "./catalogue";
import { countryFromNpId } from "./npid";
import { psnAuth, sumCounts, toPsnError, withTimeout } from "./real";
import type { PsnTitle } from "./types";

export { countryFromNpId };

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

/** At most one stored snapshot per player per hour keeps the table small. */
const SNAPSHOT_EVERY_MS = 60 * 60_000;

/** Stores the latest public summary of a PSN player for the leaderboards. */
export async function recordPlayer(p: PlayerSnapshot) {
  const points = pointsFor(p.earned);
  const data = {
    onlineId: p.onlineId,
    avatarUrl: p.avatarUrl,
    isPlus: p.isPlus,
    trophyLevel: p.trophyLevel,
    levelProgress: p.levelProgress,
    ...p.earned,
    points,
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

  if (p.trophyLevel > 0) {
    const last = await prisma.psnPlayerSnapshot.findFirst({
      where: { accountId: p.accountId },
      orderBy: { takenAt: "desc" },
      select: { takenAt: true, points: true },
    });
    if (!last || Date.now() - last.takenAt.getTime() > SNAPSHOT_EVERY_MS || last.points !== points) {
      const { platinum, gold, silver, bronze } = p.earned;
      await prisma.psnPlayerSnapshot.create({
        data: { accountId: p.accountId, points, platinum, trophies: platinum + gold + silver + bronze },
      });
    }
  }
}

/** Records a player without letting a database hiccup break the page that saw them. */
export function recordPlayerQuietly(p: PlayerSnapshot) {
  return recordPlayer(p).catch((err) => console.error("[players] record failed", err));
}

export async function markTrophiesPrivate(accountId: string, isPrivate: boolean) {
  await prisma.psnPlayer
    .updateMany({ where: { accountId, trophiesPrivate: !isPrivate }, data: { trophiesPrivate: isPrivate } })
    .catch(() => {});
}

export function snapshotFromProfile(profile: ProfileFromUserNameResponse["profile"]): PlayerSnapshot {
  const e = profile.trophySummary?.earnedTrophies;
  return {
    accountId: profile.accountId,
    onlineId: profile.onlineId,
    avatarUrl: profile.avatarUrls?.find((a) => a.size === "l")?.avatarUrl ?? profile.avatarUrls?.at(-1)?.avatarUrl ?? null,
    country: countryFromNpId(profile.npId),
    isPlus: profile.plus === 1,
    // No summary means the player's trophies are private.
    trophyLevel: profile.trophySummary?.level ?? 0,
    levelProgress: profile.trophySummary?.progress ?? 0,
    earned: { platinum: e?.platinum ?? 0, gold: e?.gold ?? 0, silver: e?.silver ?? 0, bronze: e?.bronze ?? 0 },
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Re-reads a player's summary and their most recently played trophy lists.
 * New platinums get their exact date from the trophy list (a few per run, to
 * stay polite to PSN). Returns null if PSN has no such player.
 */
export async function refreshPlayer(onlineId: string, { recentTitles = 50, platinumLookups = 5 } = {}) {
  let profile: ProfileFromUserNameResponse["profile"];
  try {
    ({ profile } = await withTimeout(getProfileFromUserName(await psnAuth(), onlineId)));
  } catch (err) {
    const e = toPsnError(err);
    if (e.kind === "not_found") return null;
    throw e;
  }
  const snap = snapshotFromProfile(profile);
  await recordPlayer(snap);
  const player = await prisma.psnPlayer.findUniqueOrThrow({ where: { accountId: snap.accountId } });
  if (player.trophiesPrivate || player.hidden) return { player, titles: 0, platinumsDated: 0 };

  let res;
  try {
    res = await withTimeout(getUserTitles(await psnAuth(), snap.accountId, { limit: recentTitles }));
  } catch (err) {
    const e = toPsnError(err);
    if (e.kind === "private") {
      await markTrophiesPrivate(snap.accountId, true);
      return { player, titles: 0, platinumsDated: 0 };
    }
    throw e;
  }

  const titles = await storePlayerTitles(snap.accountId, res.trophyTitles);
  const platinumsDated = await datePlatinums(snap.accountId, platinumLookups);
  await prisma.psnPlayer.update({ where: { accountId: snap.accountId }, data: { titlesRefreshedAt: new Date() } });
  return { player, titles, platinumsDated };
}

type RawTitle = {
  npCommunicationId: string;
  npServiceName: "trophy" | "trophy2";
  trophyTitleName: string;
  trophyTitleIconUrl?: string | null;
  trophyTitlePlatform: string;
  progress?: number;
  earnedTrophies?: { platinum: number };
  definedTrophies?: { bronze: number; silver: number; gold: number; platinum: number };
  lastUpdatedDateTime: string;
};

/** Saves a player's recently played lists (and adds any new games to the catalogue). */
export async function storePlayerTitles(accountId: string, raw: RawTitle[]) {
  const titles: PsnTitle[] = raw.map((t) => ({
    npCommunicationId: t.npCommunicationId,
    npServiceName: t.npServiceName,
    title: t.trophyTitleName,
    iconUrl: t.trophyTitleIconUrl ?? null,
    platforms: String(t.trophyTitlePlatform).split(","),
    lastUpdated: new Date(t.lastUpdatedDateTime),
    definedTrophies: sumCounts(t.definedTrophies),
  }));
  await importTitles(titles, accountId);
  const games = new Map(
    (
      await prisma.game.findMany({
        where: { npCommunicationId: { in: titles.map((t) => t.npCommunicationId) } },
        select: { id: true, npCommunicationId: true },
      })
    ).map((g) => [g.npCommunicationId!, g.id]),
  );
  for (const t of raw) {
    const gameId = games.get(t.npCommunicationId);
    if (!gameId) continue;
    const data = {
      gameId,
      progress: t.progress ?? 0,
      hasPlatinum: (t.earnedTrophies?.platinum ?? 0) > 0,
      lastUpdated: new Date(t.lastUpdatedDateTime),
    };
    await prisma.psnPlayerTitle.upsert({
      where: { accountId_npCommunicationId: { accountId, npCommunicationId: t.npCommunicationId } },
      create: { accountId, npCommunicationId: t.npCommunicationId, ...data },
      update: data,
    });
  }
  return titles.length;
}

/** Looks up the exact date of the newest platinums we only know exist (one PSN request each). */
export async function datePlatinums(accountId: string, max = 5) {
  const undated = await prisma.psnPlayerTitle.findMany({
    where: { accountId, hasPlatinum: true, platinumAt: null },
    orderBy: { lastUpdated: "desc" },
    take: max,
    include: { game: { select: { npServiceName: true } } },
  });
  let dated = 0;
  for (const u of undated) {
    try {
      const opts = u.game.npServiceName === "trophy" ? { npServiceName: "trophy" as const } : {};
      const earned = await withTimeout(
        getUserTrophiesEarnedForTitle(await psnAuth(), accountId, u.npCommunicationId, "all", opts),
      );
      const plat = earned.trophies.find((t) => t.trophyType === "platinum" && t.earned && t.earnedDateTime);
      if (plat?.earnedDateTime) {
        await prisma.psnPlayerTitle.update({
          where: { accountId_npCommunicationId: { accountId, npCommunicationId: u.npCommunicationId } },
          data: { platinumAt: new Date(plat.earnedDateTime) },
        });
        dated++;
      }
    } catch (err) {
      if (toPsnError(err).kind === "rate_limited") break;
      // Otherwise leave it undated; the next refresh tries again.
    }
    await sleep(250);
  }
  return dated;
}

/**
 * Finds new players through the public friends lists of tracked players,
 * best-ranked first (top hunters tend to be friends with other top hunters).
 * Each new player costs two PSN requests. Players whose friends list is
 * private are skipped.
 */
export async function discoverPlayers({ maxNew = 50, seeds = 5, pauseMs = 300 } = {}) {
  const sources = await prisma.psnPlayer.findMany({
    where: { friendsCheckedAt: null, hidden: false, trophiesPrivate: false },
    orderBy: { points: "desc" },
    take: seeds,
    select: { accountId: true, onlineId: true },
  });
  let added = 0;
  const checked: string[] = [];
  for (const src of sources) {
    if (added >= maxNew) break;
    let friends: string[] = [];
    try {
      friends = (await withTimeout(getUserFriendsAccountIds(await psnAuth(), src.accountId, { limit: 1000 }))).friends;
    } catch {
      // Friends list not visible to us.
    }
    await prisma.psnPlayer.update({ where: { accountId: src.accountId }, data: { friendsCheckedAt: new Date() } });
    checked.push(src.onlineId);

    const known = new Set(
      (await prisma.psnPlayer.findMany({ where: { accountId: { in: friends } }, select: { accountId: true } })).map(
        (p) => p.accountId,
      ),
    );
    for (const id of friends) {
      if (added >= maxNew) break;
      if (known.has(id)) continue;
      try {
        const { onlineId } = await withTimeout(getProfileFromAccountId(await psnAuth(), id));
        const { profile } = await withTimeout(getProfileFromUserName(await psnAuth(), onlineId));
        await recordPlayer(snapshotFromProfile(profile));
        added++;
      } catch (err) {
        if (toPsnError(err).kind === "rate_limited") return { added, checked, stoppedEarly: true };
      }
      await sleep(pauseMs);
    }
  }
  return { added, checked, stoppedEarly: false };
}
