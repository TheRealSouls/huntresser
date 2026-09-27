/**
 * The shared demo login. Its password is public (README, login page), so the
 * account is locked down: no deletion, no PSN linking.
 */
export const DEMO_EMAIL = "demo@huntresser.gg";
export const DEMO_USERNAME = "demo";
export const DEMO_PASSWORD = "trophyhunter";

export const isDemoAccount = (user: { email: string } | null | undefined) => user?.email === DEMO_EMAIL;
