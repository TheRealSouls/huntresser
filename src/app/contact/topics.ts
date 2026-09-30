export const TOPICS = {
  general: "General question",
  bug: "Something is broken",
  accessibility: "Accessibility problem",
  psn: "PSN linking or syncing",
  content: "Report a guide, tip or user",
  privacy: "My data (access, export, deletion)",
  removal: "Remove my PSN profile from the site",
  other: "Something else",
} as const;
export type Topic = keyof typeof TOPICS;

export const isTopic = (t: string | undefined): t is Topic => !!t && t in TOPICS;
