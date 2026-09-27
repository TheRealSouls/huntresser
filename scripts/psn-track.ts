/**
 * Adds PSN players to the leaderboards (or refreshes them) without importing
 * their games. One PSN request per player.
 *
 *   npm run psn:track -- GamingWithFlacy SomeOtherHunter
 *   npm run psn:track -- --file hunters.txt        (one Online ID per line)
 *   npm run psn:track -- --hide SomeOnlineId       (removal request: keep them off the site)
 *   npm run psn:track -- --unhide SomeOnlineId
 */
import { readFileSync } from "node:fs";
import { getProfileFromUserName } from "psn-api";
import { prisma } from "../src/lib/db";
import { countryFromNpId, recordPlayer } from "../src/lib/psn/players";
import { psnAuth, toPsnError, withTimeout } from "../src/lib/psn/real";
import { countryName } from "../src/lib/countries";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file; rely on the real environment.
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = process.argv.slice(2);
  const hide = args.includes("--hide");
  const unhide = args.includes("--unhide");
  const fileIdx = args.indexOf("--file");
  const ids = [
    ...args.filter((a, i) => !a.startsWith("--") && !(fileIdx >= 0 && i === fileIdx + 1)),
    ...(fileIdx >= 0 ? readFileSync(args[fileIdx + 1], "utf8").split(/\r?\n/) : []),
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) throw new Error("Pass at least one PSN Online ID (or --file path).");
  if (!process.env.PSN_NPSSO?.trim()) throw new Error("PSN_NPSSO is empty. Run npm run psn:check first.");

  for (const id of ids) {
    try {
      const { profile } = await withTimeout(getProfileFromUserName(await psnAuth(), id));
      const e = profile.trophySummary?.earnedTrophies;
      const country = countryFromNpId(profile.npId);
      await recordPlayer({
        accountId: profile.accountId,
        onlineId: profile.onlineId,
        avatarUrl: profile.avatarUrls?.find((a) => a.size === "l")?.avatarUrl ?? profile.avatarUrls?.at(-1)?.avatarUrl ?? null,
        country,
        isPlus: profile.plus === 1,
        trophyLevel: profile.trophySummary?.level ?? 0,
        levelProgress: profile.trophySummary?.progress ?? 0,
        earned: { platinum: e?.platinum ?? 0, gold: e?.gold ?? 0, silver: e?.silver ?? 0, bronze: e?.bronze ?? 0 },
      });
      if (hide || unhide) await prisma.psnPlayer.update({ where: { accountId: profile.accountId }, data: { hidden: hide } });
      console.log(
        `${profile.onlineId}: ${profile.trophySummary ? `level ${profile.trophySummary.level}, ${e?.platinum ?? 0} platinums` : "trophies private, not ranked"}, ${countryName(country) || "unknown country"}${hide ? " (hidden)" : unhide ? " (visible)" : ""}`,
      );
    } catch (err) {
      const e = toPsnError(err);
      console.warn(`skip ${id}: ${e.kind === "not_found" ? "not found on PSN" : e.message}`);
    }
    if (ids.length > 1) await sleep(500);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
