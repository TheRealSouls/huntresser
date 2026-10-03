"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { sendMessage, startConversation } from "@/actions/messages";
import { SubmitButton } from "@/components/client";
import { FormMessage } from "@/components/ui";

export function NewConversationForm({ to }: { to: string }) {
  const [state, action] = useActionState(startConversation, null);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="msg-to" className="label">
          To
        </label>
        <input id="msg-to" name="to" required defaultValue={to} className="input" placeholder="Username or PSN ID" autoComplete="off" spellCheck={false} />
        <p className="mt-1 text-xs text-muted">Add several names, separated by commas, to start a group chat.</p>
      </div>
      <div>
        <label htmlFor="msg-title" className="label">
          Group name <span className="normal-case tracking-normal text-faint">(group chats only)</span>
        </label>
        <input id="msg-title" name="title" maxLength={60} className="input" />
      </div>
      <div>
        <label htmlFor="msg-body" className="label">
          Message
        </label>
        <textarea id="msg-body" name="body" required maxLength={2000} rows={4} className="input" />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Sending…">
        Send
      </SubmitButton>
    </form>
  );
}

/** The reply box at the bottom of a conversation. Clears itself once the message is sent. */
export function ReplyBox({ conversationId }: { conversationId: string }) {
  const [state, action, pending] = useActionState(sendMessage, null);
  const ref = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) ref.current?.reset();
    wasPending.current = pending;
  }, [pending, state]);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <input type="hidden" name="conversationId" value={conversationId} />
      <label htmlFor="reply-body" className="sr-only">
        Write a message
      </label>
      <textarea
        id="reply-body"
        name="body"
        required
        maxLength={2000}
        rows={3}
        className="input"
        placeholder="Write a message…"
        onKeyDown={(e) => {
          // Ctrl or Cmd + Enter sends.
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
        }}
      />
      {state?.error && <FormMessage state={state} />}
      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Sending…">Send</SubmitButton>
        <span className="text-xs text-muted">Ctrl + Enter sends</span>
      </div>
    </form>
  );
}

/** Checks for new messages every few seconds while the conversation is open. */
export function LiveRefresh({ seconds = 6 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
