import { prisma } from "../db";
import { hashString, mulberry32 } from "../utils";
import type { TrophyType } from "../trophies";
import type { PsnTitle, TrophyProvider } from "./types";

const DAY = 1000 * 60 * 60 * 24;

/** Stable per-account "personality": how good they are and how much they play. */
function persona(accountId: string) {
  const rnd = mulberry32(hashString(`persona:${accountId}`));
  return { skill: 0.4 + rnd() * 1.8, appetite: 0.3 + rnd() * 0.45 };
}

/**
 * Demo-mode provider. Uses the seeded game catalogue as "PSN" and generates a
 * deterministic trophy history per account, so linking + syncing work end to
 * end without Sony credentials. Re-syncing yields the same history.
 */
export class MockPsnProvider implements TrophyProvider {
  readonly name = "mock" as const;

  async getProfile(onlineId: string) {
    // In demo mode the "About Me" always contains the pending code, so
    // verification succeeds. The real provider reads the actual profile.
    const link = await prisma.psnAccount.findUnique({ where: { onlineId } });
    return {
      onlineId,
      accountId: `mock-${hashString(onlineId.toLowerCase())}`,
      avatarUrl: null,
      aboutMe: `Trophy hunter. ${link?.verificationCode ?? ""}`,
      trophyLevel: 1,
      levelProgress: 0,
    };
  }

  async getTitles(accountId: string): Promise<PsnTitle[]> {
    const games = await prisma.game.findMany({
      where: { npCommunicationId: { not: null } },
      orderBy: { npCommunicationId: "asc" },
    });
    const { appetite } = persona(accountId);
    const rnd = mulberry32(hashString(`titles:${accountId}`));
    return games
      .filter((g) => rnd() < appetite && (!g.releaseDate || g.releaseDate.getTime() < Date.now()))
      .map((g) => ({
        npCommunicationId: g.npCommunicationId!,
        npServiceName: (g.npServiceName as "trophy" | "trophy2") ?? "trophy2",
        title: g.title,
        iconUrl: g.iconUrl,
        platforms: g.platforms.split(","),
        lastUpdated: new Date(),
      }));
  }

  async getTitleDefinition(title: PsnTitle) {
    const game = await prisma.game.findUniqueOrThrow({
      where: { npCommunicationId: title.npCommunicationId },
      include: { groups: true, trophies: { include: { group: true } } },
    });
    return {
      groups: game.groups.map((g) => ({ psnGroupId: g.psnGroupId, name: g.name })),
      trophies: game.trophies.map((t) => ({
        psnTrophyId: t.psnTrophyId,
        psnGroupId: t.group.psnGroupId,
        name: t.name,
        description: t.description,
        type: t.type as TrophyType,
        hidden: t.hidden,
        iconUrl: t.iconUrl,
      })),
    };
  }

  async getTitleEarned(accountId: string, title: PsnTitle) {
    const game = await prisma.game.findUniqueOrThrow({
      where: { npCommunicationId: title.npCommunicationId },
      include: { trophies: { orderBy: { psnTrophyId: "asc" }, include: { group: true } } },
    });
    const { skill } = persona(accountId);
    const rnd = mulberry32(hashString(`earned:${accountId}:${title.npCommunicationId}`));
    const now = Date.now();
    const plat = game.trophies.find((t) => t.type === "PLATINUM");
    const nonPlat = game.trophies.filter((t) => t.type !== "PLATINUM");

    // Decide whether this player is going for the platinum on this game.
    const platRate = plat?.earnedRate ?? 5;
    const hunting = rnd() < Math.min(0.92, (platRate / 100) * skill * 2.2 + 0.04);

    const earnedIds: number[] = [];
    let abandoned = false;
    for (const t of nonPlat) {
      const dlc = t.group.isDlc;
      if (hunting && !dlc) {
        earnedIds.push(t.psnTrophyId);
        continue;
      }
      if (hunting && dlc) {
        if (rnd() < 0.35 * skill) earnedIds.push(t.psnTrophyId);
        continue;
      }
      if (abandoned) continue;
      if (rnd() < Math.min(0.97, ((t.earnedRate ?? 50) / 100) * skill + 0.05)) earnedIds.push(t.psnTrophyId);
      else if (rnd() < 0.12) abandoned = true;
    }
    if (hunting && plat) earnedIds.push(plat.psnTrophyId);

    // Spread the earned trophies over a play window. ~20% of titles are
    // "currently playing" so weekly/monthly boards have activity.
    const recent = rnd() < 0.2;
    const release = game.releaseDate?.getTime() ?? now - 900 * DAY;
    const start = recent
      ? now - rnd() * 12 * DAY
      : Math.max(release, now - 30 * DAY - rnd() * 720 * DAY);
    const span = recent ? now - start : Math.min(now - start, (5 + rnd() * 80) * DAY);
    const times = earnedIds.map(() => start + rnd() * span).sort((a, b) => a - b);
    const earnedAt = new Map(earnedIds.map((id, i) => [id, new Date(times[i])]));

    return game.trophies.map((t) => ({
      psnTrophyId: t.psnTrophyId,
      earnedAt: earnedAt.get(t.psnTrophyId) ?? null,
      earnedRate: t.earnedRate,
    }));
  }
}
