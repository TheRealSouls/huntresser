"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { durationText } from "@/lib/plans";
import { deleteAccount, startPsnLink, syncNow, updatePrivacy, updateProfile, verifyPsn } from "@/actions/account";
import { SubmitButton } from "@/components/client";
import { FormMessage } from "@/components/ui";
import { COUNTRIES } from "@/lib/countries";

export function ProfileForm({ bio, country }: { bio: string; country: string }) {
  const [state, action] = useActionState(updateProfile, null);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="bio" className="label">Bio</label>
        <textarea id="bio" name="bio" defaultValue={bio} maxLength={280} rows={3} className="input" placeholder="Favourite plat? Current hunt?" />
      </div>
      <div>
        <label htmlFor="country" className="label">Country</label>
        <select id="country" name="country" defaultValue={country} className="input">
          <option value="">Prefer not to say</option>
          {Object.entries(COUNTRIES).map(([c, n]) => (
            <option key={c} value={c}>{n}</option>
          ))}
        </select>
      </div>
      <FormMessage state={state} />
      <SubmitButton>Save profile</SubmitButton>
    </form>
  );
}

export function PrivacyForm({
  visibility,
  showOnLeaderboards,
  showActivity,
}: {
  visibility: string;
  showOnLeaderboards: boolean;
  showActivity: boolean;
}) {
  const [state, action] = useActionState(updatePrivacy, null);
  const options = [
    ["PUBLIC", "Public", "Anyone can see your trophies, games and milestones."],
    ["FRIENDS", "Friends only", "Only accepted friends see your trophy data. You only appear on friends leaderboards."],
    ["PRIVATE", "Private", "Only you. You're hidden from every leaderboard and activity feed."],
  ];
  return (
    <form action={action} className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="label">Profile visibility</legend>
        {options.map(([v, label, help]) => (
          <label key={v} className="flex cursor-pointer gap-3 border border-line p-3 has-[:checked]:border-accent-text has-[:checked]:bg-surface-2">
            <input type="radio" name="profileVisibility" value={v} defaultChecked={visibility === v} className="mt-1 accent-[var(--color-accent)]" />
            <span>
              <span className="block font-semibold">{label}</span>
              <span className="text-sm text-muted">{help}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="flex items-center gap-3">
        <input type="checkbox" name="showOnLeaderboards" defaultChecked={showOnLeaderboards} className="h-4 w-4 accent-[var(--color-accent)]" />
        <span className="text-sm">Show me on leaderboards</span>
      </label>
      <label className="flex items-center gap-3">
        <input type="checkbox" name="showActivity" defaultChecked={showActivity} className="h-4 w-4 accent-[var(--color-accent)]" />
        <span className="text-sm">Show my platinums and rare unlocks in public activity feeds</span>
      </label>
      <FormMessage state={state} />
      <SubmitButton>Save privacy</SubmitButton>
    </form>
  );
}

export function LinkPsnForm({ current }: { current?: string }) {
  const [state, action] = useActionState(startPsnLink, null);
  return (
    <form action={action} className="space-y-3">
      <label htmlFor="onlineId" className="label">PSN Online ID</label>
      <div className="flex gap-2">
        <input id="onlineId" name="onlineId" defaultValue={current} required placeholder="e.g. Rare_Aura" className="input" />
        <SubmitButton pendingText="…">Get code</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function VerifyPsnButton() {
  const [state, action] = useActionState(verifyPsn, null);
  return (
    <form action={action} className="space-y-3">
      <SubmitButton pendingText="Checking PSN and syncing…">I&apos;ve added it, verify</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/**
 * Sync now, switched off until the plan allows another manual sync. While a
 * sync or import is running the page refreshes itself so progress shows up.
 */
export function SyncButton({ nextAt, busy }: { nextAt: string | null; busy: boolean }) {
  const [state, action] = useActionState(syncNow, null);
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => router.refresh(), 4_000);
    return () => clearInterval(t);
  }, [busy, router]);

  const waitMs = nextAt ? new Date(nextAt).getTime() - now : 0;
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {!busy && waitMs > 0 ? (
          <>
            <button type="button" disabled className="btn-primary">
              Sync now
            </button>
            <span className="text-xs text-muted">Available again in {durationText(waitMs)}</span>
          </>
        ) : (
          <SubmitButton pendingText="Syncing trophies…" pending={busy || undefined}>
            {busy ? "Syncing…" : "Sync now"}
          </SubmitButton>
        )}
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function DeleteAccountForm({ username }: { username: string }) {
  const [state, action] = useActionState(deleteAccount, null);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="del-password" className="label">Password</label>
          <input id="del-password" name="password" type="password" autoComplete="current-password" required className="input" />
        </div>
        <div>
          <label htmlFor="del-confirm" className="label">Type {username} to confirm</label>
          <input id="del-confirm" name="confirm" required autoComplete="off" spellCheck={false} className="input" />
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-danger" pendingText="Deleting…">Delete my account</SubmitButton>
    </form>
  );
}
