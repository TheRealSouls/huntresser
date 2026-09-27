/**
 * Site-wide identity and legal details. Operator details come from env so a
 * deployment can set them without code changes; the defaults are placeholders
 * that must be replaced before launch.
 */
export const SITE = {
  name: "Huntresser",
  tagline: "PlayStation trophy tracking, guides and leaderboards",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  operator: process.env.SITE_OPERATOR_NAME || "the Huntresser team",
  contactEmail: process.env.SITE_CONTACT_EMAIL || "hello@huntresser.example",
  privacyEmail: process.env.SITE_PRIVACY_EMAIL || process.env.SITE_CONTACT_EMAIL || "privacy@huntresser.example",
  jurisdiction: process.env.SITE_JURISDICTION || "England and Wales",
  legalUpdated: "26 September 2026",
} as const;
