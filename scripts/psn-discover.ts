/**
 * Grows the leaderboards by adding players found in the public friends lists
 * of the best-ranked tracked players. Two PSN requests per new player.
 *
 *   npm run psn:discover                 (up to 100 new players)
 *   npm run psn:discover -- --max 500 --seeds 20
 */
import { prisma } from "../src/lib/db";
import { discoverPlayers } from "../src/lib/psn/players";
import { toPsnError } from "../src/lib/psn/real";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file; rely on the real environment.
}

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Math.max(1, Number(process.argv[i + 1]) || fallback) : fallback;
};

async function main() {
  if (!process.env.PSN_NPSSO?.trim()) throw new Error("PSN_NPSSO is empty. Run npm run psn:check first.");
  const before = await prisma.psnPlayer.count();
  if (before === 0) throw new Error("No tracked players to start from. Run npm run psn:track -- <OnlineID> first.");

  const r = await discoverPlayers({ maxNew: arg("max", 100), seeds: arg("seeds", 10) });
  console.log(`Checked friends of: ${r.checked.join(", ") || "nobody (every tracked player was already checked)"}`);
  console.log(`Added ${r.added} players${r.stoppedEarly ? " (stopped early: PSN is rate limiting, try again later)" : ""}.`);
  console.log(`Tracked players: ${before} -> ${await prisma.psnPlayer.count()}`);
}

main()
  .catch((e) => {
    console.error(toPsnError(e).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
