/**
 * The shared demo login. Its password is public (README, login page), so the
 * account is locked down: no deletion, no PSN linking.
 */
export const DEMO_EMAIL = "demo@trophypilot.com";
export const DEMO_USERNAME = "demo";
export const DEMO_PASSWORD = "trophyhunter";
/** Demo emails from before the rename, moved to DEMO_EMAIL by `npm run demo:user`. */
export const LEGACY_DEMO_EMAILS = ["demo@huntresser.gg"];

export const isDemoAccount = (user: { email: string } | null | undefined) => user?.email === DEMO_EMAIL;
