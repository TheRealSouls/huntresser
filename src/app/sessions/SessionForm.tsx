"use client";

import { useState } from "react";
import { createSession } from "@/actions/community";
import { SubmitButton, useKeepValuesAction } from "@/components/client";
import { FormMessage } from "@/components/ui";
import { GamePicker, type PickedGame } from "@/components/GamePicker";

export function SessionForm({ initialGame }: { initialGame?: PickedGame | null }) {
  const [state, form, pending] = useKeepValuesAction(createSession, null);
  const [game, setGame] = useState<PickedGame | null>(initialGame ?? null);
  const [local, setLocal] = useState("");
  const platforms = game?.platforms.split(",").filter((p) => ["PS5", "PS4", "PS3", "PSVITA"].includes(p)) ?? [];
  const platformOptions = platforms.length ? platforms : ["PS5", "PS4"];

  return (
    <form {...form} className="space-y-3">
      <GamePicker name="gameId" initial={initialGame} onChange={setGame} required />
      <div>
        <label htmlFor="s-title" className="label">
          Title
        </label>
        <input
          id="s-title"
          name="title"
          required
          minLength={4}
          maxLength={100}
          placeholder="Boosting: Ranked Up"
          className="input"
        />
      </div>
      <div>
        <label htmlFor="s-desc" className="label">
          Details
        </label>
        <textarea id="s-desc" name="description" maxLength={500} rows={2} className="input" placeholder="Mic? Region? Plan?" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="s-platform" className="label">
            Platform
          </label>
          <select id="s-platform" name="platform" className="input">
            {platformOptions.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="s-slots" className="label">
            Slots
          </label>
          <input id="s-slots" name="slots" type="number" min={2} max={16} defaultValue={4} className="input" />
        </div>
      </div>
      <div>
        <label htmlFor="s-start" className="label">
          Starts
        </label>
        <input
          id="s-start"
          type="datetime-local"
          required
          className="input"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
        />
        {/* datetime-local has no timezone, so send an absolute ISO timestamp computed in the browser. */}
        <input type="hidden" name="startsAt" value={local ? new Date(local).toISOString() : ""} />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pending={pending}>
        Create session
      </SubmitButton>
    </form>
  );
}
