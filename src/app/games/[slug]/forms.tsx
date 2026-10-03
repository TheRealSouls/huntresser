"use client";

import { useActionState, useState } from "react";
import { rateGame, setUnobtainable } from "@/actions/games";
import { SubmitButton } from "@/components/client";
import { FormMessage } from "@/components/ui";

/** A member's own difficulty (1 to 10) and star rating (1 to 5) for the game. */
export function RateGameForm({ gameId, difficulty, rating }: { gameId: string; difficulty: number | null; rating: number | null }) {
  const [state, action] = useActionState(rateGame, null);
  const [stars, setStars] = useState(rating ?? 0);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="gameId" value={gameId} />
      <div>
        <label htmlFor="rate-difficulty" className="label">
          Platinum difficulty
        </label>
        <select id="rate-difficulty" name="difficulty" defaultValue={difficulty ?? 0} className="input">
          <option value={0}>Not rated</option>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}/10{n === 1 ? " (very easy)" : n === 5 ? " (average)" : n === 10 ? " (brutal)" : ""}
            </option>
          ))}
        </select>
      </div>
      <fieldset>
        <legend className="label">How good is the game?</legend>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer" title={`${n} star${n === 1 ? "" : "s"}`}>
              <input
                type="radio"
                name="rating"
                value={n}
                checked={stars === n}
                onChange={() => setStars(n)}
                className="peer sr-only"
              />
              <span className="sr-only">
                {n} star{n === 1 ? "" : "s"}
              </span>
              <svg
                width="28"
                height="28"
                viewBox="0 0 20 20"
                aria-hidden
                className={`rounded-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent-text ${n <= stars ? "text-gold" : "text-line-strong"}`}
              >
                <path
                  d="m10 2 2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L10 14.4 5 17.2l1.2-5.6L2 7.8l5.6-.6L10 2Z"
                  fill={n <= stars ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
            </label>
          ))}
          {stars > 0 && (
            <button type="button" onClick={() => setStars(0)} className="ml-2 text-xs text-muted underline underline-offset-2 hover:text-text">
              Clear
            </button>
          )}
        </div>
        {/* When no star is picked, send 0 so the rating is cleared. */}
        {stars === 0 && <input type="hidden" name="rating" value={0} />}
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton className="btn-ghost w-full" pendingText="Saving…">
        Save my rating
      </SubmitButton>
    </form>
  );
}

/** Admins: mark the platinum or 100% as no longer obtainable, with the reason. */
export function UnobtainableForm({ gameId, unobtainable, reason }: { gameId: string; unobtainable: string | null; reason: string | null }) {
  const [state, action] = useActionState(setUnobtainable, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="gameId" value={gameId} />
      <div>
        <label htmlFor="unob-status" className="label">
          Can it still be completed?
        </label>
        <select id="unob-status" name="unobtainable" defaultValue={unobtainable ?? ""} className="input">
          <option value="">Yes, everything is obtainable</option>
          <option value="PLATINUM">No: the platinum is unobtainable</option>
          <option value="COMPLETION">Platinum is fine, 100% is unobtainable</option>
        </select>
      </div>
      <div>
        <label htmlFor="unob-reason" className="label">
          Reason
        </label>
        <input
          id="unob-reason"
          name="reason"
          defaultValue={reason ?? ""}
          maxLength={300}
          placeholder="Servers shut down on 1 March 2025"
          className="input"
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-ghost w-full" pendingText="Saving…">
        Save
      </SubmitButton>
    </form>
  );
}
