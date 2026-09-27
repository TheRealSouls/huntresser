import Link from "next/link";
import type { Family } from "@/lib/games";
import { GameArt } from "./art";
import { TrophyIcon } from "./TrophyIcon";

export type GameCardData = {
  slug: string;
  title: string;
  coverHue: number;
  iconUrl: string | null;
  platforms: string;
  difficulty: number | null;
  hoursToPlatinum: number | null;
  genre: string | null;
  _count?: { trophies: number };
  platRate?: number | null;
};

/** `family` merges every trophy list of the game (PS4, PS5, regional stacks) into one card. */
export function GameCard({ game, family }: { game: GameCardData; family?: Family }) {
  const platforms = family?.platforms ?? game.platforms.split(",");
  return (
    <Link href={`/games/${game.slug}`} className="group card flex flex-col p-3 hover:border-muted">
      <GameArt title={game.title} hue={game.coverHue} iconUrl={game.iconUrl} className="w-full" />
      <div className="mt-3 flex flex-1 flex-col">
        <div className="flex gap-2 text-[10px] uppercase tracking-wider text-muted">
          <span>{platforms.join(" / ")}</span>
          {family && family.lists > 1 && <span className="ml-auto normal-case tracking-normal">{family.lists} lists</span>}
        </div>
        <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug group-hover:underline group-hover:underline-offset-4">
          {game.title}
        </h3>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-muted">
          {game.difficulty != null && <span title="Estimated difficulty">diff {Math.round(game.difficulty)}/10</span>}
          {game.hoursToPlatinum != null && <span title="Estimated hours to platinum">{game.hoursToPlatinum}h</span>}
          {game.platRate != null && (
            <span className="ml-auto inline-flex items-center gap-1" title="Players with the platinum">
              <TrophyIcon type="PLATINUM" size={13} /> {game.platRate.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
