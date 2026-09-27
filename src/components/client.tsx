"use client";

import { useActionState, useEffect, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import clsx from "clsx";
import type { FormState } from "@/actions/auth";

/**
 * Like useActionState, but once hydrated submits via onSubmit + so
 * React doesn't reset uncontrolled fields, so users keep their input when
 * validation fails. `action` is still set so a submit before hydration is a
 * progressive-enhancement POST (never a GET that leaks fields into the URL).
 * Spread the returned `form` props onto the <form>.
 */
export function useKeepValuesAction(fn: (state: FormState, fd: FormData) => Promise<FormState>, initial: FormState) {
  const [state, action, pending] = useActionState(fn, initial);
  const [, startTransition] = useTransition();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
  return [state, { action, onSubmit }, pending] as const;
}

export function SubmitButton({
  children,
  pendingText,
  className = "btn-primary",
  pending: pendingOverride,
}: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
  pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingOverride ?? status.pending;
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={className}>
      {pending && <span className="skeleton h-2 w-2 bg-current" aria-hidden />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/** Submit button that asks for confirmation first (for destructive actions). */
export function ConfirmButton({ message, children, className = "btn-danger" }: { message: string; children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

/** Hidden trophies stay spoiler-free until the viewer opts in. */
export function HiddenTrophyReveal({ name, description }: { name: string; description: string }) {
  const [shown, setShown] = useState(false);
  if (shown)
    return (
      <div>
        <div className="font-semibold">{name}</div>
        <div className="text-sm text-muted">{description}</div>
      </div>
    );
  return (
    <div>
      <div className="font-semibold text-muted">Hidden trophy</div>
      <button type="button" onClick={() => setShown(true)} className="text-sm text-accent-text underline-offset-4 hover:underline">
        Reveal (spoiler)
      </button>
    </div>
  );
}

/** Collectible checklist that remembers ticks in localStorage (per guide step). */
export function StepCheck({ id }: { id: string }) {
  const key = `huntresser:step:${id}`;
  const [done, setDone] = useState(false);
  useEffect(() => {
    try {
      setDone(localStorage.getItem(key) === "1");
    } catch {}
  }, [key]);
  return (
    <button
      type="button"
      aria-pressed={done}
      onClick={() => {
        const next = !done;
        setDone(next);
        try {
          if (next) localStorage.setItem(key, "1");
          else localStorage.removeItem(key);
        } catch {}
      }}
      className={clsx(
        "flex h-6 w-6 shrink-0 items-center justify-center border text-sm",
        done ? "border-good bg-good/15 text-good" : "border-line bg-surface-2 text-transparent hover:border-muted",
      )}
      title={done ? "Mark as not done" : "Mark as done"}
    >
      ✓
    </button>
  );
}
