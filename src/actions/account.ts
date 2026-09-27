"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { destroySession, requireUser } from "@/lib/auth";
import { COUNTRIES } from "@/lib/countries";
import { toPsnError } from "@/lib/psn/real";
import { getProvider, syncUntilDone, syncUser } from "@/lib/psn/sync";
import { rateLimit } from "@/lib/rate-limit";
import { isDemoAccount } from "@/lib/demo";
import type { FormState } from "./auth";

const DEMO_LOCKED = "The shared demo account can't do this. Create your own account to link PSN or delete an account.";

export async function updateProfile(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const bio =
    String(fd.get("bio") ?? "")
      .trim()
      .slice(0, 280) || null;
  const country = String(fd.get("country") ?? "");
  await prisma.user.update({
    where: { id: user.id },
    data: { bio, country: country in COUNTRIES ? country : null },
  });
  revalidatePath(`/u/${user.username}`);
  return { ok: "Profile saved." };
}

const privacySchema = z.object({
  profileVisibility: z.enum(["PUBLIC", "FRIENDS", "PRIVATE"]),
});

export async function updatePrivacy(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = privacySchema.safeParse({ profileVisibility: fd.get("profileVisibility") });
  if (!parsed.success) return { error: "Invalid visibility option." };
  await prisma.user.update({
    where: { id: user.id },
    data: {
      profileVisibility: parsed.data.profileVisibility,
      showOnLeaderboards: fd.get("showOnLeaderboards") === "on",
      showActivity: fd.get("showActivity") === "on",
    },
  });
  revalidatePath("/", "layout");
  return { ok: "Privacy settings saved." };
}

const onlineIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z][A-Za-z0-9_-]{2,15}$/, "PSN Online IDs are 3 to 16 characters and start with a letter.");

export async function startPsnLink(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (isDemoAccount(user)) return { error: DEMO_LOCKED };
  const parsed = onlineIdSchema.safeParse(fd.get("onlineId"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const onlineId = parsed.data;

  const existing = await prisma.psnAccount.findUnique({ where: { onlineId } });
  if (existing && existing.userId !== user.id) {
    if (existing.verified) return { error: "That PSN account is already linked to another Huntresser profile." };
    // An unverified claim proves nothing. Whoever verifies ownership first wins.
    await prisma.psnAccount.delete({ where: { id: existing.id } });
  }

  const code = `HUNT-${randomBytes(3).toString("hex").toUpperCase()}`;
  await prisma.psnAccount.upsert({
    where: { userId: user.id },
    create: { userId: user.id, onlineId, verificationCode: code },
    update: { onlineId, verificationCode: code, verified: false, accountId: null },
  });
  revalidatePath("/settings");
  return { ok: "Code generated. Add it to your PSN About Me, then verify." };
}

export async function verifyPsn(_: FormState): Promise<FormState> {
  const user = await requireUser();
  if (isDemoAccount(user)) return { error: DEMO_LOCKED };
  const link = await prisma.psnAccount.findUnique({ where: { userId: user.id } });
  if (!link?.verificationCode) return { error: "Start linking first." };

  if (!(await rateLimit("psn-verify", 10, 10 * 60_000, user.id))) return { error: "Too many attempts. Wait a few minutes." };
  const provider = getProvider();
  let profile;
  try {
    profile = await provider.getProfile(link.onlineId);
  } catch (err) {
    const e = toPsnError(err);
    console.error("[psn] verify failed:", e.kind, e.message);
    return { error: e.kind === "rate_limited" ? e.message : "PSN isn't responding right now. Try again in a few minutes." };
  }
  if (!profile) return { error: `Couldn't find the PSN profile "${link.onlineId}". Check the spelling.` };
  if (!profile.aboutMe.includes(link.verificationCode)) {
    return { error: `We couldn't find ${link.verificationCode} in your About Me yet. PSN can take a minute to update.` };
  }

  await prisma.psnAccount.update({
    where: { id: link.id },
    data: {
      verified: true,
      verificationCode: null,
      accountId: profile.accountId,
      onlineId: profile.onlineId,
      avatarUrl: profile.avatarUrl,
      trophyLevel: profile.trophyLevel,
      levelProgress: profile.levelProgress,
    },
  });

  // Import in the background after the response is sent: a big library takes
  // many capped runs. Progress shows from the SyncJob rows on the settings page.
  after(() => syncUntilDone(user.id).catch((err) => console.error("[psn] initial sync failed", err)));
  revalidatePath("/", "layout");
  redirect("/settings?linked=1");
}

export async function syncNow(_: FormState): Promise<FormState> {
  const user = await requireUser();
  try {
    const job = await syncUser(user.id);
    revalidatePath("/", "layout");
    const more = job.remaining ? ` ${job.remaining} more games still to import; sync again in a minute.` : "";
    return {
      ok:
        (job.gamesSynced === 0 && !job.remaining
          ? "Already up to date."
          : job.trophiesSynced
            ? `Synced ${job.trophiesSynced} new trophies across ${job.gamesSynced} games.`
            : `Checked ${job.gamesSynced} games, no new trophies.`) + more,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Sync failed." };
  }
}

export async function unlinkPsn() {
  const user = await requireUser();
  if (isDemoAccount(user)) return;
  await prisma.$transaction([
    prisma.userTrophy.deleteMany({ where: { userId: user.id } }),
    prisma.userGame.deleteMany({ where: { userId: user.id } }),
    prisma.psnTitleSync.deleteMany({ where: { userId: user.id } }),
    prisma.psnAccount.deleteMany({ where: { userId: user.id } }),
  ]);
  revalidatePath("/", "layout");
}

/** Permanently deletes the account and everything tied to it (cascades in the schema). */
export async function deleteAccount(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (isDemoAccount(user)) return { error: DEMO_LOCKED };
  const password = String(fd.get("password") ?? "");
  const full = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await bcrypt.compare(password, full.passwordHash))) return { error: "That password is incorrect." };
  if (fd.get("confirm") !== user.username) return { error: `Type your username (${user.username}) to confirm.` };

  // Their public PSN summary goes too, so they drop off the leaderboards.
  if (user.psn?.accountId) await prisma.psnPlayer.deleteMany({ where: { accountId: user.psn.accountId } });
  await prisma.user.delete({ where: { id: user.id } });
  await destroySession();
  redirect("/?deleted=1");
}
