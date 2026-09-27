import type { TrophyType } from "../trophies";

export type PsnProfileData = {
  onlineId: string;
  accountId: string;
  avatarUrl: string | null;
  aboutMe: string;
  trophyLevel: number;
  levelProgress: number;
};

export type PsnTitle = {
  npCommunicationId: string;
  npServiceName: "trophy" | "trophy2";
  title: string;
  iconUrl: string | null;
  platforms: string[];
  lastUpdated: Date;
};

export type PsnGroupDef = { psnGroupId: string; name: string };

export type PsnTrophyDef = {
  psnTrophyId: number;
  psnGroupId: string;
  name: string;
  description: string;
  type: TrophyType;
  hidden: boolean;
  iconUrl: string | null;
};

export type PsnEarnedTrophy = { psnTrophyId: number; earnedAt: Date | null; earnedRate: number | null };

/**
 * Anything that can answer "who is this PSN user and what have they earned".
 * The real implementation talks to Sony; the mock one powers demo mode.
 */
export interface TrophyProvider {
  readonly name: "psn" | "mock";
  getProfile(onlineId: string): Promise<PsnProfileData | null>;
  getTitles(accountId: string): Promise<PsnTitle[]>;
  getTitleDefinition(title: PsnTitle): Promise<{ groups: PsnGroupDef[]; trophies: PsnTrophyDef[] }>;
  /** Every trophy in the title with earned state + global earn rate. */
  getTitleEarned(accountId: string, title: PsnTitle): Promise<PsnEarnedTrophy[]>;
}
