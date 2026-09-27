export const COUNTRIES: Record<string, string> = {
  AR: "Argentina", AU: "Australia", AT: "Austria", BE: "Belgium", BR: "Brazil", BG: "Bulgaria",
  CA: "Canada", CL: "Chile", CN: "China", CO: "Colombia", HR: "Croatia", CZ: "Czechia",
  DK: "Denmark", FI: "Finland", FR: "France", DE: "Germany", GR: "Greece", HK: "Hong Kong",
  HU: "Hungary", IN: "India", ID: "Indonesia", IE: "Ireland", IL: "Israel", IT: "Italy",
  JP: "Japan", KR: "South Korea", LT: "Lithuania", LV: "Latvia", MY: "Malaysia", MX: "Mexico",
  NL: "Netherlands", NZ: "New Zealand", NO: "Norway", PE: "Peru", PH: "Philippines", PL: "Poland",
  PT: "Portugal", RO: "Romania", SA: "Saudi Arabia", SG: "Singapore", ZA: "South Africa",
  ES: "Spain", SE: "Sweden", CH: "Switzerland", TW: "Taiwan", TH: "Thailand", TR: "Turkey",
  UA: "Ukraine", AE: "United Arab Emirates", GB: "United Kingdom", US: "United States",
};

export function flag(code: string | null | undefined) {
  if (!code || code.length !== 2) return "";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

const displayNames = new Intl.DisplayNames(["en-GB"], { type: "region" });

/** Name for any ISO country code, including PSN regions missing from COUNTRIES. */
export function countryName(code: string | null | undefined) {
  if (!code) return "";
  if (COUNTRIES[code]) return COUNTRIES[code];
  try {
    return displayNames.of(code) ?? code;
  } catch {
    return code;
  }
}
