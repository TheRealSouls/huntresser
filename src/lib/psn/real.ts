import {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
  getProfileFromUserName,
  getTitleTrophies,
  getTitleTrophyGroups,
  getUserTitles,
  getUserTrophiesEarnedForTitle,
  type AuthTokensResponse,
} from "psn-api";
import type { TrophyType } from "../trophies";
import { countryFromNpId } from "./players";
import type { PsnTitle, TrophyProvider } from "./types";

/**
 * Talks to the real PlayStation Network through a service account's NPSSO
 * token. Sony has no public OAuth for third parties, so users *link* their
 * PSN ID (verified via a code in their About Me) and we read their public
 * trophy data with this account.
 */

export type PsnErrorKind = "auth" | "not_found" | "private" | "rate_limited" | "unknown";

export class PsnError extends Error {
  constructor(
    readonly kind: PsnErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "PsnError";
  }
}

/** psn-api throws plain Errors whose message is either text or a JSON error body. */
export function toPsnError(err: unknown): PsnError {
  if (err instanceof PsnError) return err;
  const raw = err instanceof Error ? err.message : String(err);
  const text = raw.toLowerCase();
  if (/npsso|access code|invalid_grant|unauthori[sz]ed|invalid token|expired/.test(text))
    return new PsnError("auth", "The PSN service token is invalid or expired. Generate a new PSN_NPSSO.");
  if (/not found|2105356|resource not found/.test(text)) return new PsnError("not_found", "PSN profile not found.");
  if (/access control|not permitted|forbidden|private|2240526/.test(text))
    return new PsnError("private", "This player's trophies are private on PSN.");
  if (/too many requests|rate.?limit|\b429\b/.test(text)) return new PsnError("rate_limited", "PSN is rate limiting requests. Try again shortly.");
  return new PsnError("unknown", raw.trim().slice(0, 300) || "Unexpected PSN error.");
}

/** psn-api has no request timeout, so a stalled Sony endpoint would hang the page. */
export function withTimeout<T>(p: Promise<T>, ms = 15_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new PsnError("unknown", "PlayStation Network took too long to respond.")), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

type TokenState = { tokens: AuthTokensResponse; expiresAt: number; refreshExpiresAt: number };
let state: TokenState | null = null;
let inflight: Promise<{ accessToken: string }> | null = null;

async function refreshTokens(): Promise<{ accessToken: string }> {
  const now = Date.now();
  let tokens: AuthTokensResponse;
  try {
    if (state && now < state.refreshExpiresAt - 60_000) {
      tokens = await withTimeout(exchangeRefreshTokenForAuthTokens(state.tokens.refreshToken));
    } else {
      const npsso = process.env.PSN_NPSSO?.trim();
      if (!npsso) throw new PsnError("auth", "PSN_NPSSO is not configured.");
      tokens = await withTimeout(exchangeNpssoForAccessCode(npsso).then(exchangeAccessCodeForAuthTokens));
    }
  } catch (err) {
    state = null;
    const e = toPsnError(err);
    throw e.kind === "unknown" ? new PsnError("auth", `PSN sign-in failed: ${e.message}`) : e;
  }
  state = {
    tokens,
    expiresAt: now + tokens.expiresIn * 1000,
    refreshExpiresAt: now + tokens.refreshTokenExpiresIn * 1000,
  };
  return { accessToken: tokens.accessToken };
}

/** Returns a valid access token, sharing one refresh between concurrent callers. */
export async function psnAuth(): Promise<{ accessToken: string }> {
  if (state && Date.now() < state.expiresAt - 60_000) return { accessToken: state.tokens.accessToken };
  inflight ??= refreshTokens().finally(() => {
    inflight = null;
  });
  return inflight;
}

const PAGE = 800;

export class RealPsnProvider implements TrophyProvider {
  readonly name = "psn" as const;

  async getProfile(onlineId: string) {
    try {
      const { profile } = await withTimeout(getProfileFromUserName(await psnAuth(), onlineId));
      const avatar = profile.avatarUrls?.find((a) => a.size === "l") ?? profile.avatarUrls?.at(-1);
      return {
        onlineId: profile.onlineId,
        accountId: profile.accountId,
        avatarUrl: avatar?.avatarUrl ?? null,
        aboutMe: profile.aboutMe ?? "",
        trophyLevel: profile.trophySummary?.level ?? 0,
        levelProgress: profile.trophySummary?.progress ?? 0,
        country: countryFromNpId(profile.npId),
        isPlus: profile.plus === 1,
        earned: profile.trophySummary?.earnedTrophies,
      };
    } catch (err) {
      const e = toPsnError(err);
      if (e.kind === "not_found") return null;
      throw e;
    }
  }

  async getTitles(accountId: string): Promise<PsnTitle[]> {
    const out: PsnTitle[] = [];
    let offset = 0;
    for (;;) {
      const res = await withTimeout(getUserTitles(await psnAuth(), accountId, { limit: PAGE, offset })).catch((e) => {
        throw toPsnError(e);
      });
      for (const t of res.trophyTitles) {
        out.push({
          npCommunicationId: t.npCommunicationId,
          npServiceName: t.npServiceName,
          title: t.trophyTitleName,
          iconUrl: t.trophyTitleIconUrl ?? null,
          platforms: String(t.trophyTitlePlatform).split(","),
          lastUpdated: new Date(t.lastUpdatedDateTime),
        });
      }
      if (!res.nextOffset) break;
      offset = res.nextOffset;
    }
    return out;
  }

  async getTitleDefinition(title: PsnTitle) {
    const a = await psnAuth();
    const opts = title.npServiceName === "trophy" ? { npServiceName: "trophy" as const } : {};
    const [groups, trophies] = await withTimeout(
      Promise.all([
        getTitleTrophyGroups(a, title.npCommunicationId, opts),
        getTitleTrophies(a, title.npCommunicationId, "all", opts),
      ]),
    ).catch((e) => {
      throw toPsnError(e);
    });
    return {
      groups: groups.trophyGroups.map((g) => ({ psnGroupId: g.trophyGroupId, name: g.trophyGroupName })),
      trophies: trophies.trophies.map((t) => ({
        psnTrophyId: t.trophyId,
        psnGroupId: t.trophyGroupId ?? "default",
        name: t.trophyName ?? "Hidden trophy",
        description: t.trophyDetail ?? "",
        type: t.trophyType.toUpperCase() as TrophyType,
        hidden: !!t.trophyHidden,
        iconUrl: t.trophyIconUrl ?? null,
      })),
    };
  }

  async getTitleEarned(accountId: string, title: PsnTitle) {
    const opts = title.npServiceName === "trophy" ? { npServiceName: "trophy" as const } : {};
    const res = await withTimeout(
      getUserTrophiesEarnedForTitle(await psnAuth(), accountId, title.npCommunicationId, "all", opts),
    ).catch((e) => {
      throw toPsnError(e);
    });
    return res.trophies.map((t) => ({
      psnTrophyId: t.trophyId,
      earnedAt: t.earned && t.earnedDateTime ? new Date(t.earnedDateTime) : null,
      earnedRate: t.trophyEarnedRate ? Number(t.trophyEarnedRate) : null,
    }));
  }
}
