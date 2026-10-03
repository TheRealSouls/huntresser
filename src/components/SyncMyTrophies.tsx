"use client";

import { useActionState, useEffect, useState } from "react";
import { syncNow } from "@/actions/account";
import { SyncIcon } from "./icons";

/**
 * "Sync my trophies" in the top bar, for members with PSN linked. It runs
 * the same sync as Settings (and the same once-an-hour limit) and shows the
 * result underneath for a few seconds.
 */
export function SyncMyTrophies() {
  const [state, action, pending] = useActionState(syncNow, null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!state) return;
    setShown(true);
    const t = setTimeout(() => setShown(false), 8000);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <form action={action} className="relative">
      <button type="submit" disabled={pending} aria-busy={pending} className="btn-primary px-3 py-2" title="Sync my trophies">
        <SyncIcon size={16} className={pending ? "animate-spin" : undefined} />
        <span className="hidden xl:inline">{pending ? "Syncing…" : "Sync my trophies"}</span>
        <span className="sr-only xl:hidden">{pending ? "Syncing" : "Sync my trophies"}</span>
      </button>
      <p
        role={state?.error ? "alert" : "status"}
        className={
          shown && state
            ? `absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border bg-surface px-3 py-2 text-sm shadow-[var(--shadow-raised)] ${state.error ? "border-bad/50 text-bad" : "border-good/50 text-good"}`
            : "sr-only"
        }
      >
        {shown && state ? (state.error ?? state.ok) : ""}
      </p>
    </form>
  );
}
