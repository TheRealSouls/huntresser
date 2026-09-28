/**
 * Works out difficulty, hours to platinum and playthroughs for every game
 * from its guides. New guides do this on their own; run it once after
 * importing guides or changing how estimates are calculated.
 *
 *   npm run db:estimates
 */
import { prisma } from "../src/lib/db";
import { refreshAllEstimates } from "../src/lib/estimates";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file; rely on the real environment.
}

refreshAllEstimates()
  .then((n) => console.log(`Updated estimates on ${n} trophy lists.`))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
