import { LEAGUE_ID, SEASON } from "./budget";

const API_BASE = "https://v3.football.api-sports.io";

export interface ApiFootballResponse<T> {
  get: string;
  results: number;
  response: T;
  errors?: Record<string, string> | string[];
}

export async function apiFootballFetch<T>(
  path: string,
  apiKey: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: {
      "x-apisports-key": apiKey,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`API-Football HTTP ${res.status}`);
  }

  const data = (await res.json()) as ApiFootballResponse<T>;
  if (data.errors && (Array.isArray(data.errors) ? data.errors.length : Object.keys(data.errors).length)) {
    const msg = Array.isArray(data.errors)
      ? data.errors.join(", ")
      : Object.values(data.errors).join(", ");
    throw new Error(`API-Football: ${msg}`);
  }
  return data.response;
}

export function leagueSeasonParams(extra: Record<string, string> = {}): Record<string, string> {
  return {
    league: String(LEAGUE_ID),
    season: String(SEASON),
    ...extra,
  };
}
