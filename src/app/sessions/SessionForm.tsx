"use client";

import { useState } from "react";
import { createSession } from "@/actions/community";
import { SubmitButton, useKeepValuesAction } from "@/components/client";
import { FormMessage } from "@/components/ui";

export function SessionForm({ games, initialGameId }: { games: { id: string; title: string; platforms: string }[]; initialGameId?: string }) {
  const [state, form, pending] = useKeepValuesAction(createSession, null);
  const [gameId, setGameId] = useState(initialGameId ?? "");
  const [local, setLocal] = useState("");
  const platforms = games.find((g) => g.id === gameId)?.platforms.split(",") ?? ["PS5", "PS4"];

  return (
    <form {...form} className="space-y-3">
      <div>
        <label htmlFor="s-game" className="label">Game</label>
        <select id="s-game" name="gameId" value={gameId} onChange={(e) => setGameId(e.target.value)} required className="input">
          <option value="">Choose…</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>{g.title}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="s-title" className="label">Title</label>
        <input id="s-title" name="title" required minLength={4} maxLength={100} placeholder="Boosting: Ranked Up" className="input" />
      </div>
      <div>
        <label htmlFor="s-desc" className="label">Details</label>
        <textarea id="s-desc" name="description" maxLength={500} rows={2} className="input" placeholder="Mic? Region? Plan?" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="s-platform" className="label">Platform</label>
          <select id="s-platform" name="platform" className="input">
            {platforms.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="s-slots" className="label">Slots</label>
          <input id="s-slots" name="slots" type="number" min={2} max={16} defaultValue={4} className="input" />
        </div>
      </div>
      <div>
        <label htmlFor="s-start" className="label">Starts</label>
        <input id="s-start" type="datetime-local" required className="input" value={local} onChange={(e) => setLocal(e.target.value)} />
        {/* datetime-local has no timezone, so send an absolute ISO timestamp computed in the browser. */}
        <input type="hidden" name="startsAt" value={local ? new Date(local).toISOString() : ""} />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pending={pending}>Create session</SubmitButton>
    </form>
  );
}
