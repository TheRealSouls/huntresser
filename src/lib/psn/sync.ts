import { prisma } from "../db";
import { recomputeUserGame } from "../progress";
import { ensureGameTrophies, importTitles } from "./catalogue";
import { MockPsnProvider } from "./mock";
import { recordPlayer } from "./players";
import { RealPsnProvider } from "./real";
import type { PsnTitle, TrophyProvider } from "./types";

export function isDemoMode() {
  return !process.env.PSN_NPSSO?.trim();
}

export function getProvider(): TrophyProvider {
  return isDemoMode() ? new MockPsnProvider() : new RealPsnProvider();
}

export const SYNC_COOLDOWN_MS = 60_000;

/**
 * PSN rate limits hard and big libraries have thousands of trophy lists, so a
 * run only processes this many changed lists. The next run (Sync now, the
 * cron job, or the background loop after linking) resumes where it stopped.
 */
const TITLES_PER_RUN = Math.max(1, Number(process.env.PSN_SYNC_TITLES_PER_RUN) || 60);

/** Makes sure the game and its trophy list exist locally. */
async function ensureGame(provider: TrophyProvider, title: PsnTitle, accountId: string) {
  // Mock account ids are meaningless to Sony, so only real ones become samples.
  const slugs = await importTitles([title], provider.name === "psn" ? accountId : null);
  const game = await prisma.game.findUniqueOrThrow({ where: { slug: slugs.get(title.npCommunicationId)! } });
  await ensureGameTrophies(provider, game);
  return prisma.game.findUniqueOrThrow({
    where: { id: game.id },
    include: { trophies: { select: { id: true, psnTrophyId: true } } },
  });
}

export async function syncUser(userId: string, { force = false }: { force?: boolean } = {}) {
  const psn = await prisma.psnAccount.findUnique({ where: { userId } });
  if (!psn?.verified || !psn.accountId) throw new Error("Link and verify your PSN account first.");

  const recent = await prisma.syncJob.findFirst({ where: { userId }, orderBy: { startedAt: "desc" } });
  if (recent?.status === "RUNNING" && Date.now() - recent.startedAt.getTime() < 10 * 60_000) {
    throw new Error("A sync is already running.");
  }
  if (!force && recent && Date.now() - recent.startedAt.getTime() < SYNC_COOLDOWN_MS) {
    throw new Error("Please wait a minute between syncs.");
  }

  const provider = getProvider();
  const job = await prisma.syncJob.create({ data: { userId, provider: provider.name } });
  let gamesSynced = 0;
  let trophiesSynced = 0;
  let remaining = 0;

  try {
    const profile = await provider.getProfile(psn.onlineId);
    const titles = await provider.getTitles(psn.accountId);

    // Only lists that changed since they were last synced. Mock titles always
    // report "now", so demo mode re-syncs everything (it's a small catalogue).
    const synced = new Map(
      (await prisma.psnTitleSync.findMany({ where: { userId }, select: { npCommunicationId: true, lastUpdated: true } })).map(
        (r) => [r.npCommunicationId, r.lastUpdated.getTime()],
      ),
    );
    const pending = titles.filter(
      (t) => provider.name !== "psn" || (synced.get(t.npCommunicationId) ?? -1) < t.lastUpdated.getTime(),
    );
    const batch = pending.slice(0, TITLES_PER_RUN);
    remaining = pending.length - batch.length;

    for (const title of batch) {
      const game = await ensureGame(provider, title, psn.accountId);
      const byPsnId = new Map(game.trophies.map((t) => [t.psnTrophyId, t.id]));
      const earned = await provider.getTitleEarned(psn.accountId, title);

      const already = new Set(
        (
          await prisma.userTrophy.findMany({
            where: { userId, trophy: { gameId: game.id } },
            select: { trophyId: true },
          })
        ).map((r) => r.trophyId),
      );

      const toCreate = earned
        .filter((e) => e.earnedAt && byPsnId.has(e.psnTrophyId) && !already.has(byPsnId.get(e.psnTrophyId)!))
        .map((e) => ({ userId, trophyId: byPsnId.get(e.psnTrophyId)!, earnedAt: e.earnedAt! }));
      if (toCreate.length) await prisma.userTrophy.createMany({ data: toCreate });

      // Global earn rates come back with the user's trophy data on PSN.
      if (provider.name === "psn") {
        await prisma.$transaction(
          earned
            .filter((e) => e.earnedRate !== null && byPsnId.has(e.psnTrophyId))
            .map((e) =>
              prisma.trophy.update({ where: { id: byPsnId.get(e.psnTrophyId)! }, data: { earnedRate: e.earnedRate! } }),
            ),
        );
      }

      await recomputeUserGame(prisma, userId, game.id);
      await prisma.psnTitleSync.upsert({
        where: { userId_npCommunicationId: { userId, npCommunicationId: title.npCommunicationId } },
        create: { userId, npCommunicationId: title.npCommunicationId, lastUpdated: title.lastUpdated },
        update: { lastUpdated: title.lastUpdated },
      });
      gamesSynced++;
      trophiesSynced += toCreate.length;
    }

    // Sony's own totals feed the all-time leaderboards, even while a big library is still importing.
    if (profile?.earned && provider.name === "psn") {
      await recordPlayer({
        accountId: psn.accountId,
        onlineId: profile.onlineId,
        avatarUrl: profile.avatarUrl,
        country: profile.country ?? null,
        isPlus: !!profile.isPlus,
        trophyLevel: profile.trophyLevel,
        levelProgress: profile.levelProgress,
        earned: profile.earned,
      });
    }

    await prisma.psnAccount.update({
      where: { userId },
      data: {
        lastSyncedAt: new Date(),
        ...(profile && provider.name === "psn"
          ? { trophyLevel: profile.trophyLevel, levelProgress: profile.levelProgress, avatarUrl: profile.avatarUrl }
          : {}),
      },
    });
    return prisma.syncJob.update({
      where: { id: job.id },
      data: { status: "SUCCESS", finishedAt: new Date(), gamesSynced, trophiesSynced, remaining },
    });
  } catch (err) {
    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        gamesSynced,
        trophiesSynced,
        remaining,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

/**
 * Keeps syncing until the library is fully imported (or maxRuns is hit).
 * Used right after linking so a big library fills in without the user
 * pressing Sync now dozens of times.
 */
export async function syncUntilDone(userId: string, { maxRuns = 50, pauseMs = 5_000 } = {}) {
  for (let run = 0; run < maxRuns; run++) {
    const job = await syncUser(userId, { force: run > 0 });
    if (job.remaining === 0) return job;
    await new Promise((r) => setTimeout(r, pauseMs));
  }
}
