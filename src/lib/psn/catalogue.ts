import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { cleanTitle, hashString, slugify, titleKey } from "../utils";
import type { PsnEarnedTrophy, PsnTitle, TrophyProvider } from "./types";

/**
 * The game catalogue is built from PSN itself: every title seen on a synced
 * or looked-up profile gets a Game row. Trophy lists are fetched lazily the
 * first time someone needs them.
 */

const slugTaken = async (slug: string) => !!(await prisma.game.findUnique({ where: { slug }, select: { id: true } }));

/** "rainbow-six-siege", then "rainbow-six-siege-ps4", then "rainbow-six-siege-ps4-2" for regional stacks. */
async function uniqueGameSlug(title: string, platforms: string[], npCommunicationId: string) {
  // Non-Latin titles slugify to nothing, so fall back to the list id (npwr12345-00).
  const base = slugify(title) || slugify(npCommunicationId);
  if (!(await slugTaken(base))) return base;
  const withPlatform = `${base}-${slugify(platforms[0] ?? "")}`.replace(/-$/, "");
  if (!(await slugTaken(withPlatform))) return withPlatform;
  let i = 2;
  while (await slugTaken(`${withPlatform}-${i}`)) i++;
  return `${withPlatform}-${i}`;
}

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

async function createGame(title: PsnTitle, sampleAccountId: string | null) {
  // Two concurrent imports can race for the same slug or npCommunicationId.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.game.create({
        data: {
          slug: await uniqueGameSlug(cleanTitle(title.title), title.platforms, title.npCommunicationId),
          npCommunicationId: title.npCommunicationId,
          npServiceName: title.npServiceName,
          title: cleanTitle(title.title),
          titleKey: titleKey(title.title),
          platforms: title.platforms.join(","),
          iconUrl: title.iconUrl,
          coverHue: hashString(title.title) % 360,
          psnSampleAccountId: sampleAccountId,
        },
        select: { id: true, slug: true, npCommunicationId: true },
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      const existing = await prisma.game.findUnique({
        where: { npCommunicationId: title.npCommunicationId },
        select: { id: true, slug: true, npCommunicationId: true },
      });
      if (existing) return existing;
    }
  }
  throw new Error(`Couldn't create a catalogue entry for ${title.title}`);
}

/**
 * Makes sure every title has a Game row. Returns npCommunicationId → slug.
 * Only missing titles are written, so repeat calls are one read.
 */
export async function importTitles(titles: PsnTitle[], sampleAccountId: string | null): Promise<Map<string, string>> {
  const ids = titles.map((t) => t.npCommunicationId);
  const existing = await prisma.game.findMany({
    where: { npCommunicationId: { in: ids } },
    select: { slug: true, npCommunicationId: true, iconUrl: true, psnSampleAccountId: true },
  });
  const slugs = new Map(existing.map((g) => [g.npCommunicationId!, g.slug]));

  // Backfill details that older rows might be missing.
  const stale = existing.filter((g) => (!g.iconUrl || !g.psnSampleAccountId) && sampleAccountId);
  for (const g of stale) {
    const t = titles.find((x) => x.npCommunicationId === g.npCommunicationId);
    await prisma.game.update({
      where: { slug: g.slug },
      data: { iconUrl: g.iconUrl ?? t?.iconUrl ?? null, psnSampleAccountId: g.psnSampleAccountId ?? sampleAccountId },
    });
  }

  for (const t of titles) {
    if (slugs.has(t.npCommunicationId)) continue;
    const g = await createGame(t, sampleAccountId);
    slugs.set(t.npCommunicationId, g.slug);
  }
  return slugs;
}

type CatalogueGame = {
  id: string;
  title: string;
  npCommunicationId: string | null;
  npServiceName: string | null;
  platforms: string;
  iconUrl: string | null;
  psnSampleAccountId: string | null;
};

export function gameAsTitle(g: CatalogueGame): PsnTitle | null {
  if (!g.npCommunicationId) return null;
  return {
    npCommunicationId: g.npCommunicationId,
    npServiceName: g.npServiceName === "trophy" ? "trophy" : "trophy2",
    title: g.title,
    iconUrl: g.iconUrl,
    platforms: g.platforms.split(","),
    lastUpdated: new Date(),
  };
}

/**
 * Fetches and stores the trophy groups and trophies for a game if it has none yet.
 * Pass `earned` when you're fetching a player's progress on this list anyway:
 * its earn rates fill in rarity, and it saves a second call for the same data.
 */
export async function ensureGameTrophies(
  provider: TrophyProvider,
  game: CatalogueGame,
  { earned }: { earned?: Promise<PsnEarnedTrophy[]> } = {},
) {
  const title = gameAsTitle(game);
  if (!title) return false;
  if ((await prisma.trophy.count({ where: { gameId: game.id } })) > 0) return false;

  // Global earn rates only come back on per-user calls, so borrow them from
  // an account we know owns the title (or the player being synced).
  const ratesFrom =
    earned ??
    (game.psnSampleAccountId && provider.name === "psn" ? provider.getTitleEarned(game.psnSampleAccountId, title) : null);
  const [def, rates] = await Promise.all([
    provider.getTitleDefinition(title),
    // Rarity is a nice-to-have; the list is still useful without it.
    (ratesFrom ?? Promise.resolve([]))
      .then((list) => new Map(list.filter((e) => e.earnedRate !== null).map((e) => [e.psnTrophyId, e.earnedRate!])))
      .catch(() => new Map<number, number>()),
  ]);

  await prisma.trophyGroup.createMany({
    data: def.groups.map((g) => ({ gameId: game.id, psnGroupId: g.psnGroupId, name: g.name, isDlc: g.psnGroupId !== "default" })),
    skipDuplicates: true,
  });
  const groupIds = new Map(
    (await prisma.trophyGroup.findMany({ where: { gameId: game.id }, select: { id: true, psnGroupId: true } })).map((g) => [
      g.psnGroupId,
      g.id,
    ]),
  );

  // One insert for the whole list; a concurrent import of the same game just skips.
  await prisma.trophy.createMany({
    data: def.trophies
      .filter((t) => groupIds.has(t.psnGroupId))
      .map((t) => ({
        gameId: game.id,
        groupId: groupIds.get(t.psnGroupId)!,
        psnTrophyId: t.psnTrophyId,
        name: t.name,
        description: t.description,
        type: t.type,
        hidden: t.hidden,
        iconUrl: t.iconUrl,
        earnedRate: rates.get(t.psnTrophyId) ?? null,
      })),
    skipDuplicates: true,
  });
  return true;
}
