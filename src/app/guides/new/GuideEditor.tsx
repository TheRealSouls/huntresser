"use client";

import { useState } from "react";
import { createGuide } from "@/actions/community";
import { SubmitButton, useKeepValuesAction } from "@/components/client";
import { FormMessage } from "@/components/ui";

type Game = { id: string; title: string; trophies: { id: string; name: string; type: string }[] };
type Step = { key: number; kind: string; title: string; body: string; trophyId: string; video: string };

const KINDS = [
  ["ROADMAP", "Roadmap stage"],
  ["MISSABLE", "Missable"],
  ["COLLECTIBLE", "Collectible"],
  ["SPEEDRUN", "Speedrun split"],
];

let nextKey = 1;
const blank = (kind = "ROADMAP"): Step => ({ key: nextKey++, kind, title: "", body: "", trophyId: "", video: "" });

export function GuideEditor({ games, initialGameId }: { games: Game[]; initialGameId?: string }) {
  const [state, form, pending] = useKeepValuesAction(createGuide, null);
  const [gameId, setGameId] = useState(initialGameId && games.some((g) => g.id === initialGameId) ? initialGameId : "");
  const [steps, setSteps] = useState<Step[]>([blank()]);
  const game = games.find((g) => g.id === gameId);

  const update = (key: number, patch: Partial<Step>) => setSteps((s) => s.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const move = (i: number, dir: -1 | 1) =>
    setSteps((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const copy = [...s];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  return (
    <form {...form} className="space-y-6">
      <section className="card space-y-4 p-6">
        <div>
          <label htmlFor="gameId" className="label">Game</label>
          <select id="gameId" name="gameId" value={gameId} onChange={(e) => setGameId(e.target.value)} required className="input">
            <option value="">Choose a game…</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="title" className="label">Guide title</label>
          <input id="title" name="title" required minLength={5} maxLength={120} className="input" placeholder={game ? `${game.title} Trophy Guide & Roadmap` : ""} />
        </div>
        <div>
          <label htmlFor="summary" className="label">Summary</label>
          <textarea id="summary" name="summary" required minLength={20} maxLength={600} rows={3} className="input" placeholder="Overview, what to expect, key warnings." />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="difficulty" className="label">Difficulty (1 to 10)</label>
            <input id="difficulty" name="difficulty" type="number" min={1} max={10} defaultValue={5} required className="input" />
          </div>
          <div>
            <label htmlFor="hoursEstimate" className="label">Hours to plat</label>
            <input id="hoursEstimate" name="hoursEstimate" type="number" min={1} defaultValue={20} required className="input" />
          </div>
          <div>
            <label htmlFor="playthroughs" className="label">Playthroughs</label>
            <input id="playthroughs" name="playthroughs" type="number" min={1} max={20} defaultValue={1} required className="input" />
          </div>
        </div>
        <div>
          <label htmlFor="video" className="label">Video walkthrough (YouTube URL, optional)</label>
          <input id="video" name="video" className="input" placeholder="https://youtu.be/…" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="onlineRequired" className="accent-[var(--color-accent)]" /> Online trophies required
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Steps</h2>
        {steps.map((s, i) => (
          <fieldset key={s.key} className="card space-y-3 p-5">
            <legend className="sr-only">Step {i + 1}</legend>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-muted">#{i + 1}</span>
              <select value={s.kind} onChange={(e) => update(s.key, { kind: e.target.value })} className="input w-auto py-1.5" aria-label="Step type">
                {KINDS.map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
              <div className="ml-auto flex gap-1">
                <button type="button" onClick={() => move(i, -1)} className="btn-ghost px-2.5 py-1" aria-label="Move up">↑</button>
                <button type="button" onClick={() => move(i, 1)} className="btn-ghost px-2.5 py-1" aria-label="Move down">↓</button>
                <button
                  type="button"
                  onClick={() => setSteps((x) => (x.length > 1 ? x.filter((y) => y.key !== s.key) : x))}
                  className="btn-ghost px-2.5 py-1 text-bad"
                  aria-label="Remove step"
                >
                  ✕
                </button>
              </div>
            </div>
            <input value={s.title} onChange={(e) => update(s.key, { title: e.target.value })} placeholder="Step title" className="input" aria-label="Step title" />
            <textarea value={s.body} onChange={(e) => update(s.key, { body: e.target.value })} rows={4} placeholder="What to do…" className="input" aria-label="Step details" />
            <div className="grid gap-3 sm:grid-cols-2">
              <select value={s.trophyId} onChange={(e) => update(s.key, { trophyId: e.target.value })} className="input" aria-label="Linked trophy" disabled={!game}>
                <option value="">{game ? "Link a trophy (optional)" : "Pick a game first"}</option>
                {game?.trophies.map((t) => (
                  <option key={t.id} value={t.id}>{t.type[0]} · {t.name}</option>
                ))}
              </select>
              <input value={s.video} onChange={(e) => update(s.key, { video: e.target.value })} placeholder="YouTube URL (optional)" className="input" aria-label="Step video" />
            </div>
          </fieldset>
        ))}
        <div className="flex flex-wrap gap-2">
          {KINDS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setSteps((s) => [...s, blank(k)])} className="btn-ghost">
              + {l}
            </button>
          ))}
        </div>
      </section>

      <input
        type="hidden"
        name="steps"
        value={JSON.stringify(steps.map(({ kind, title, body, trophyId, video }) => ({ kind, title, body, trophyId: trophyId || null, video: video || null })))}
      />
      <FormMessage state={state} />
      <SubmitButton className="btn-primary px-6 py-3" pending={pending} pendingText="Publishing…">Publish guide</SubmitButton>
    </form>
  );
}
