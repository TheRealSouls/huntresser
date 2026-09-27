/**
 * Checks that PSN_NPSSO works: signs in, then optionally looks up a player.
 *
 *   npm run psn:check
 *   npm run psn:check -- GamingWithFlacy
 */
import { getProfileFromUserName } from "psn-api";
import { psnAuth, toPsnError } from "../src/lib/psn/real";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file; rely on the real environment.
}

async function main() {
  const npsso = process.env.PSN_NPSSO?.trim();
  if (!npsso) {
    console.error("PSN_NPSSO is empty. Add it to .env first (see README, 'Connecting to real PSN').");
    process.exitCode = 1;
    return;
  }
  if (npsso.length !== 64) console.warn(`Warning: NPSSO tokens are usually 64 characters, this one is ${npsso.length}.`);

  try {
    await psnAuth();
    console.log("OK: signed in to PSN with the service account token.");
  } catch (err) {
    console.error(`FAILED to sign in: ${toPsnError(err).message}`);
    console.error("Get a fresh token from https://ca.account.sony.com/api/v1/ssocookie while signed in to playstation.com.");
    process.exitCode = 1;
    return;
  }

  const onlineId = process.argv[2];
  if (!onlineId) return;
  try {
    const { profile } = await getProfileFromUserName(await psnAuth(), onlineId);
    const t = profile.trophySummary;
    console.log(`OK: found ${profile.onlineId} (account ${profile.accountId})`);
    console.log(`    level ${t?.level ?? "?"}, trophies P${t?.earnedTrophies.platinum} G${t?.earnedTrophies.gold} S${t?.earnedTrophies.silver} B${t?.earnedTrophies.bronze}`);
    console.log(`    avatar ${profile.avatarUrls?.at(-1)?.avatarUrl ?? "none"}`);
  } catch (err) {
    const e = toPsnError(err);
    console.error(e.kind === "not_found" ? `No PSN account called ${onlineId}.` : `Lookup failed: ${e.message}`);
    process.exitCode = 1;
  }
}

main();
