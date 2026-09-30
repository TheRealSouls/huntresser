/**
 * Loads the trophy lists of the newest games in the catalogue (and lists
 * that gained DLC), so "New trophy lists" and "New DLC" on the home page have
 * trophy counts. The players cron does a few each run; this fills a batch.
 *
 *   npm run psn:lists -- 40
 */
import { prisma } from "../src/lib/db";
import { keepListsFresh } from "../src/lib/psn/catalogue";
import { getProvider, isDemoMode } from "../src/lib/psn/sync";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file; rely on the real environment.
}

async function main() {
  if (isDemoMode()) throw new Error("Set PSN_NPSSO first: demo mode has no PSN lists to load.");
  const n = Number(process.argv[2]) || 20;
  const r = await keepListsFresh(getProvider(), { newest: n, grown: n });
  console.log(`Loaded ${r.loaded} new trophy lists, fetched ${r.refreshed} lists again for new DLC.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
