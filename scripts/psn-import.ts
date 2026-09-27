/**
 * Seeds the game catalogue from the trophy lists of public PSN profiles.
 * Every title those players own becomes a searchable game.
 *
 *   npm run psn:import -- GamingWithFlacy SomeOtherHunter
 *   npm run psn:import -- --trophies GamingWithFlacy   (also fetch each game's trophy list; slower)
 */
import { prisma } from "../src/lib/db";
import { ensureGameTrophies, importTitles } from "../src/lib/psn/catalogue";
import { recordPlayer } from "../src/lib/psn/players";
import { RealPsnProvider, toPsnError } from "../src/lib/psn/real";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file; rely on the real environment.
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = process.argv.slice(2);
  const withTrophies = args.includes("--trophies");
  const ids = args.filter((a) => !a.startsWith("--"));
  if (!process.env.PSN_NPSSO?.trim()) throw new Error("PSN_NPSSO is empty. Run npm run psn:check first.");
  if (ids.length === 0) throw new Error("Pass at least one PSN Online ID.");

  const psn = new RealPsnProvider();
  let created = 0;
  for (const id of ids) {
    const profile = await psn.getProfile(id);
    if (!profile) {
      console.warn(`skip ${id}: not found on PSN`);
      continue;
    }
    if (profile.earned) {
      await recordPlayer({
        accountId: profile.accountId,
        onlineId: profile.onlineId,
        avatarUrl: profile.avatarUrl,
        country: profile.country ?? null,
        isPlus: !!profile.isPlus,
        trophyLevel: profile.trophyLevel,
        levelProgress: profile.levelProgress,
        earned: profile.earned,
      });
    }
    let titles;
    try {
      titles = await psn.getTitles(profile.accountId);
    } catch (err) {
      console.warn(`skip ${id}: ${toPsnError(err).message}`);
      continue;
    }
    const before = await prisma.game.count();
    const slugs = await importTitles(titles, profile.accountId);
    const added = (await prisma.game.count()) - before;
    created += added;
    console.log(`${profile.onlineId}: ${titles.length} titles, ${added} new games`);

    if (withTrophies) {
      for (const t of titles) {
        const game = await prisma.game.findUniqueOrThrow({ where: { slug: slugs.get(t.npCommunicationId)! } });
        try {
          if (await ensureGameTrophies(psn, game)) {
            console.log(`  trophies: ${game.title}`);
            await sleep(750); // stay well under PSN's rate limits
          }
        } catch (err) {
          console.warn(`  failed: ${game.title}: ${toPsnError(err).message}`);
        }
      }
    }
  }
  console.log(`Done. ${created} games added. Catalogue size: ${await prisma.game.count()}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
