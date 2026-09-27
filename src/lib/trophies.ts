export const TROPHY_TYPES = ["PLATINUM", "GOLD", "SILVER", "BRONZE"] as const;
export type TrophyType = (typeof TROPHY_TYPES)[number];

/** Point values PSN uses for trophy level calculation. */
export const TROPHY_POINTS: Record<TrophyType, number> = {
  PLATINUM: 300,
  GOLD: 90,
  SILVER: 30,
  BRONZE: 15,
};

export const TROPHY_ORDER: Record<string, number> = { PLATINUM: 0, GOLD: 1, SILVER: 2, BRONZE: 3 };

export type RarityKey = "ULTRA_RARE" | "VERY_RARE" | "RARE" | "COMMON";

/** PlayStation's rarity bands. */
export function rarityOf(earnedRate: number): { key: RarityKey; label: string } {
  if (earnedRate <= 5) return { key: "ULTRA_RARE", label: "Ultra Rare" };
  if (earnedRate <= 15) return { key: "VERY_RARE", label: "Very Rare" };
  if (earnedRate <= 50) return { key: "RARE", label: "Rare" };
  return { key: "COMMON", label: "Common" };
}

export const ULTRA_RARE_MAX = 5;

/**
 * Approximation of the PS5 trophy level curve: points required per level grow
 * in bands of 100 levels.
 */
const LEVEL_BANDS: [maxLevel: number, pointsPerLevel: number][] = [
  [99, 60],
  [199, 90],
  [299, 450],
  [399, 900],
  [499, 1350],
  [599, 1800],
  [699, 2250],
  [799, 2700],
  [899, 3150],
  [999, 3600],
];

export function levelFromPoints(points: number): { level: number; progress: number } {
  let level = 1;
  let remaining = points;
  for (const [maxLevel, per] of LEVEL_BANDS) {
    while (level <= maxLevel && remaining >= per) {
      remaining -= per;
      level++;
    }
    if (level <= maxLevel) return { level, progress: Math.floor((remaining / per) * 100) };
  }
  return { level: 999, progress: 100 };
}

export function pointsFor(counts: { platinum: number; gold: number; silver: number; bronze: number }) {
  return (
    counts.platinum * TROPHY_POINTS.PLATINUM +
    counts.gold * TROPHY_POINTS.GOLD +
    counts.silver * TROPHY_POINTS.SILVER +
    counts.bronze * TROPHY_POINTS.BRONZE
  );
}
