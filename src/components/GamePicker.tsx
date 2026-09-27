"use client";

import { useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";

export type PickedGame = { id: string; title: string; platforms: string; iconUrl?: string | null; npCommunicationId?: string | null };

/**
 * Searchable game field. The catalogue has thousands of trophy lists, far too
 * many for a <select>, so this queries /api/games/search as you type. The
 * chosen list's id is submitted under `name`.
 */
export function GamePicker({
  name,
  label = "Game",
  initial,
  onChange,
  required,
}: {
  name: string;
  label?: string;
  initial?: PickedGame | null;
  onChange?: (game: PickedGame | null) => void;
  required?: boolean;
}) {
  const id = useId();
  const [picked, setPicked] = useState<PickedGame | null>(initial ?? null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (picked || q.trim().length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/games/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        const data = (await res.json()) as { games: PickedGame[] };
        setResults(data.games);
        setActive(0);
      } catch {
        // Aborted or offline; keep the old results.
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, picked]);

  const choose = (g: PickedGame | null) => {
    setPicked(g);
    setResults([]);
    setQ("");
    onChange?.(g);
    if (!g) setTimeout(() => input.current?.focus(), 0);
  };

  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <input type="hidden" name={name} value={picked?.id ?? ""} />
      {picked ? (
        <div className="flex items-center gap-3 border border-line bg-bg px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{picked.title}</span>
          <span className="text-xs text-muted">{picked.platforms.split(",").join(" / ")}</span>
          <button type="button" onClick={() => choose(null)} className="text-xs text-accent-text underline-offset-4 hover:underline">
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            ref={input}
            id={id}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && results[active]) {
                e.preventDefault();
                choose(results[active]);
              }
            }}
            required={required}
            placeholder="Type at least 2 letters of the title"
            autoComplete="off"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={`${id}-list`}
            className="input"
          />
          {(results.length > 0 || (q.trim().length >= 2 && !loading)) && (
            <ul id={`${id}-list`} role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto border border-line bg-surface">
              {results.map((g, i) => (
                <li key={g.id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(g)}
                    className={clsx("flex w-full items-center gap-3 px-3 py-2 text-left text-sm", i === active && "bg-surface-2")}
                  >
                    <span className="min-w-0 flex-1 truncate">{g.title}</span>
                    <span className="shrink-0 text-xs text-muted">{g.platforms.split(",").join(" / ")}</span>
                  </button>
                </li>
              ))}
              {results.length === 0 && <li className="px-3 py-2 text-sm text-muted">No games match. Try another spelling.</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
