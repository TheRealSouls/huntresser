/**
 * A PSN npId is base64 of "OnlineId@b5.ie". The part after the last dot is
 * the account's country.
 */
export function countryFromNpId(npId: string | null | undefined): string | null {
  if (!npId) return null;
  try {
    const decoded = Buffer.from(npId, "base64").toString("utf8");
    const code = decoded.slice(decoded.lastIndexOf(".") + 1).toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}
