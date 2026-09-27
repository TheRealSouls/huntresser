"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, ValidationError } from "@formspree/react";
import clsx from "clsx";
import { TOPICS, type Topic } from "./topics";

/** Topics where knowing the PSN account saves a round trip. */
const NEEDS_PSN: Topic[] = ["psn", "removal"];

export function ContactForm({
  formId,
  topic: initialTopic,
  email,
  username,
  onlineId,
}: {
  formId: string;
  topic: Topic;
  email?: string;
  username?: string;
  onlineId?: string;
}) {
  const [state, handleSubmit, reset] = useForm(formId);
  const [topic, setTopic] = useState<Topic>(initialTopic);
  const needsPsn = NEEDS_PSN.includes(topic);

  if (state.succeeded) {
    return (
      <div role="status" className="border border-good/50 p-5">
        <p className="font-semibold text-good">Message sent.</p>
        <p className="mt-1 text-sm text-muted">
          Thanks for getting in touch. We reply by email, usually within a few days.
          {topic === "removal" && " Removal requests are handled within 30 days, and we'll confirm when it's done."}
        </p>
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={reset} className="btn-ghost">
            Send another
          </button>
          <Link href="/" className="btn-ghost">
            Home
          </Link>
        </div>
      </div>
    );
  }

  const formErrors = state.errors?.getFormErrors() ?? [];

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
      {/* Subject line in the Formspree email, so messages are easy to sort. */}
      <input type="hidden" name="_subject" value={`Huntresser contact: ${TOPICS[topic]}`} />
      {username && <input type="hidden" name="account" value={username} />}
      {/* Honeypot: people never see or fill this, bots usually do. Formspree drops those submissions. */}
      <input type="text" name="_gotcha" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <div>
        <label htmlFor="topic" className="label">
          What is it about?
        </label>
        <select id="topic" name="topic" value={topic} onChange={(e) => setTopic(e.target.value as Topic)} className="input">
          {Object.entries(TOPICS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="label">
            Name <span className="normal-case tracking-normal text-faint">(optional)</span>
          </label>
          <input id="name" name="name" autoComplete="name" maxLength={100} className="input" />
        </div>
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" defaultValue={email} className="input" />
          <ValidationError field="email" prefix="Email" errors={state.errors} className="mt-1 block text-xs text-bad" />
        </div>
      </div>

      <div className={clsx(!needsPsn && "hidden")}>
        <label htmlFor="onlineId" className="label">
          PSN Online ID
        </label>
        <input
          id="onlineId"
          name="psnOnlineId"
          required={needsPsn}
          disabled={!needsPsn}
          defaultValue={onlineId}
          autoComplete="off"
          spellCheck={false}
          maxLength={16}
          pattern="[A-Za-z][A-Za-z0-9_\-]{2,15}"
          className="input"
        />
        {topic === "removal" && (
          <p className="mt-1 text-xs text-muted">
            We&apos;ll hide this profile from lookups, search and leaderboards. We may ask you to confirm you own it, for example
            by adding a code to your PSN About Me.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="message" className="label">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={7}
          minLength={10}
          maxLength={5000}
          className="input"
          placeholder={
            topic === "bug"
              ? "What were you doing, what did you expect, and what happened instead? The page address helps."
              : topic === "content"
                ? "Link to the guide, tip or profile, and what's wrong with it."
                : undefined
          }
        />
        <ValidationError field="message" prefix="Message" errors={state.errors} className="mt-1 block text-xs text-bad" />
      </div>

      {formErrors.length > 0 && (
        <p role="alert" className="border border-bad/50 px-3 py-2 text-sm text-bad">
          {formErrors.map((e) => e.message).join(" ")}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={state.submitting} aria-busy={state.submitting} className="btn-primary">
          {state.submitting ? "Sending…" : "Send message"}
        </button>
        <p className="text-xs text-muted">
          Sent through Formspree. See the{" "}
          <Link href="/privacy" className="link">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </form>
  );
}
