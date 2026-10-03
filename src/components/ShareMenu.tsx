"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { sendDirect } from "@/actions/messages";
import { ShareIcon } from "./icons";

/**
 * "Send to a friend": copy the link, share it through the device's own share
 * sheet, email it, or (signed in) send it to a friend as a private message.
 */
export function ShareMenu({ path, title, friends }: { path: string; title: string; friends: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [state, action, pending] = useActionState(sendDirect, null);
  const ref = useRef<HTMLDivElement>(null);
  const url = typeof window === "undefined" ? path : new URL(path, window.location.origin).toString();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      ref.current?.querySelector("button")?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked: the link is still in the address bar.
    }
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="share-menu" className="btn-ghost">
        <ShareIcon size={16} />
        Send to a friend
      </button>
      {open && (
        <div id="share-menu" className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-raised)]">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copy} className="btn-ghost flex-1 px-3 py-1.5 text-xs">
              {copied ? "Link copied" : "Copy link"}
            </button>
            <a href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${title}\n${url}`)}`} className="btn-ghost flex-1 px-3 py-1.5 text-xs">
              Email it
            </a>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button type="button" onClick={() => navigator.share({ title, url }).catch(() => {})} className="btn-ghost flex-1 px-3 py-1.5 text-xs">
                Share…
              </button>
            )}
          </div>
          <span role="status" className="sr-only">
            {copied ? "Link copied" : ""}
          </span>

          <div className="mt-3 border-t border-line pt-3">
            <div className="label">Send as a message</div>
            {friends.length === 0 ? (
              <p className="text-xs text-muted">Add friends or follow people and they&apos;ll show up here.</p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {friends.map((f) => (
                  <li key={f.id}>
                    <form action={action} className="flex items-center gap-2">
                      <input type="hidden" name="recipientId" value={f.id} />
                      <input type="hidden" name="body" value={`${title}\n${url}`} />
                      <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
                      <button disabled={pending} className="btn-ghost px-2.5 py-1 text-xs">
                        Send
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            {state && (
              <p role={state.error ? "alert" : "status"} className={`mt-2 text-xs ${state.error ? "text-bad" : "text-good"}`}>
                {state.error ?? state.ok}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
