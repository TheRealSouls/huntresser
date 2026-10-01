import { slugify } from "./utils";

/**
 * Readable trophy addresses: /games/hollow-knight/watcher.
 *
 * - The slug is the trophy name, unique within its trophy list.
 * - Hidden trophies get "hidden-12" so the address doesn't spoil the name.
 * - Names that slugify to nothing (Japanese, Korean...) get "trophy-12".
 * - A name used twice in one list, or "dlc" (which is /games/x/dlc/...),
 *   gets the trophy number added: "watcher-31".
 *
 * Slugs are assigned in trophy-number order, so the same list always gets
 * the same slugs, and trophies added later (DLC) never take an existing one.
 */
const RESERVED = new Set(["dlc"]);

export function trophySlugs(trophies: { psnTrophyId: number; name: string; hidden: boolean }[], taken: Iterable<string> = []) {
  const used = new Set(taken);
  const out = new Map<number, string>();
  for (const t of [...trophies].sort((a, b) => a.psnTrophyId - b.psnTrophyId)) {
    const base = t.hidden ? `hidden-${t.psnTrophyId}` : slugify(t.name) || `trophy-${t.psnTrophyId}`;
    let slug = RESERVED.has(base) || used.has(base) ? `${base}-${t.psnTrophyId}` : base;
    for (let i = 2; used.has(slug); i++) slug = `${base}-${t.psnTrophyId}-${i}`;
    used.add(slug);
    out.set(t.psnTrophyId, slug);
  }
  return out;
}

/** Where a trophy's page lives. */
export const trophyHref = (gameSlug: string, trophySlug: string) => `/games/${gameSlug}/${trophySlug}`;
