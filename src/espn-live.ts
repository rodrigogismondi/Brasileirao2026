import type { DashboardData, Match } from "./types";
import { isMatchToday, isMatchUpcoming } from "./utils";

/**
 * GitHub Actions cron often lags by tens of minutes during a matchday, so the
 * static cache keeps old placares while the on-device clock keeps ticking.
 * ESPN's public scoreboard allows browser CORS and carries the live score,
 * period, and minute. We overlay that onto GE fixtures (matched by club).
 */

const ESPN_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/scoreboard";

const LIVE_BEFORE_MS = 20 * 60 * 1000;
const LIVE_AFTER_MS = 4 * 60 * 60 * 1000;
const KICKOFF_MATCH_MS = 6 * 60 * 60 * 1000;

export interface EspnSnapshot {
  homeKey: string;
  awayKey: string;
  kickoffMs: number;
  state: "pre" | "in" | "post";
  statusName: string;
  period: string | null;
  minute: number | null;
  score: [number, number] | null;
}

let cachedSnaps: EspnSnapshot[] = [];

export function getEspnSnapshots(): EspnSnapshot[] {
  return cachedSnaps;
}

/** São Paulo calendar date as YYYYMMDD — ESPN `dates` follows the match day. */
export function saoPauloDateParam(unixSeconds: number): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date(unixSeconds * 1000)).replace(/-/g, "");
}

/** Dates worth polling: in-play, or kickoff inside the live window. */
export function espnDatesFor(matches: Match[], now = Date.now()): string[] {
  const dates = new Set<string>();
  for (const m of matches) {
    const kick = m.datetime * 1000;
    const inWindow = kick - LIVE_BEFORE_MS <= now && now <= kick + LIVE_AFTER_MS;
    if (!inWindow && m.status !== "live") continue;
    if (!Number.isFinite(kick) || kick <= 0) continue;
    dates.add(saoPauloDateParam(m.datetime));
  }
  return [...dates];
}

/** Stable club id shared by GE popular names and ESPN display names. */
export function clubKey(name: string): string {
  const compact = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (compact.includes("athletico") || compact.includes("paranaense")) return "athleticopr";
  if (
    compact.includes("atletico") &&
    (compact.includes("mineiro") || compact.endsWith("mg") || compact.includes("atleticomg"))
  ) {
    return "atleticomg";
  }
  if (compact.includes("saopaulo")) return "saopaulo";
  if (compact.includes("bragantino")) return "bragantino";
  if (compact.includes("chapecoense")) return "chapecoense";
  if (compact.includes("corinthians")) return "corinthians";
  if (compact.includes("internacional")) return "internacional";
  if (compact.includes("fluminense")) return "fluminense";
  if (compact.includes("palmeiras")) return "palmeiras";
  if (compact.includes("coritiba")) return "coritiba";
  if (compact.includes("botafogo")) return "botafogo";
  if (compact.includes("cruzeiro")) return "cruzeiro";
  if (compact.includes("flamengo")) return "flamengo";
  if (compact.includes("mirassol")) return "mirassol";
  if (compact.includes("gremio")) return "gremio";
  if (compact.includes("vitoria")) return "vitoria";
  if (compact.includes("santos")) return "santos";
  if (compact.includes("bahia")) return "bahia";
  if (compact.includes("vasco")) return "vasco";
  if (compact.includes("remo")) return "remo";
  return compact;
}

function parseMinute(displayClock: string, clockSeconds: number): number | null {
  const stoppage = displayClock.match(/(\d+)\s*'?\s*\+\s*(\d+)/);
  if (stoppage) return Number(stoppage[1]) + Number(stoppage[2]);
  const plain = displayClock.match(/(\d+)/);
  if (plain && !/^0'$/.test(displayClock.trim())) return Number(plain[1]);
  if (Number.isFinite(clockSeconds) && clockSeconds > 0) return Math.floor(clockSeconds / 60);
  return null;
}

function periodFromEspn(typeName: string, periodNum: number | null, state: string): string | null {
  const name = typeName.toUpperCase();
  if (state === "post" || /FULL_TIME|FINAL/.test(name)) return "FT";
  if (/HALFTIME/.test(name)) return "HT";
  if (/SHOOTOUT|PENALT/.test(name)) return "P";
  if (/EXTRA/.test(name)) return "ET";
  if (/SECOND_HALF/.test(name) || periodNum === 2) return "2H";
  if (/FIRST_HALF/.test(name) || periodNum === 1) return "1H";
  if (state === "in") return "LIVE";
  return null;
}

export function parseEspnScoreboard(payload: unknown): EspnSnapshot[] {
  const events = (payload as { events?: unknown[] } | null)?.events;
  if (!Array.isArray(events)) return [];
  const out: EspnSnapshot[] = [];
  for (const event of events) {
    const ev = event as {
      date?: string;
      competitions?: Array<{
        status?: {
          clock?: number;
          displayClock?: string;
          period?: number;
          type?: { name?: string; state?: string };
        };
        competitors?: Array<{
          homeAway?: string;
          score?: string | number;
          team?: { displayName?: string };
        }>;
      }>;
    };
    const comp = ev.competitions?.[0];
    if (!comp) continue;
    const home = comp.competitors?.find((c) => c.homeAway === "home");
    const away = comp.competitors?.find((c) => c.homeAway === "away");
    if (!home?.team?.displayName || !away?.team?.displayName) continue;
    const kickoffMs = Date.parse(ev.date || "");
    if (!Number.isFinite(kickoffMs)) continue;
    const typeName = comp.status?.type?.name || "";
    const stateRaw = String(comp.status?.type?.state || "pre");
    const state: EspnSnapshot["state"] =
      stateRaw === "in" || stateRaw === "post" ? stateRaw : "pre";
    const period = periodFromEspn(
      typeName,
      comp.status?.period ?? null,
      state
    );
    const hs = Number(home.score);
    const as = Number(away.score);
    const score: [number, number] | null =
      Number.isFinite(hs) && Number.isFinite(as) ? [hs, as] : null;
    const minute =
      state === "in" && period !== "HT"
        ? parseMinute(String(comp.status?.displayClock || ""), Number(comp.status?.clock ?? 0))
        : null;
    out.push({
      homeKey: clubKey(home.team.displayName),
      awayKey: clubKey(away.team.displayName),
      kickoffMs,
      state,
      statusName: typeName,
      period,
      minute,
      score,
    });
  }
  return out;
}

function findSnap(m: Match, snaps: EspnSnapshot[]): EspnSnapshot | null {
  const home = clubKey(m.team1);
  const away = clubKey(m.team2);
  const kick = m.datetime * 1000;
  for (const s of snaps) {
    if (s.homeKey !== home || s.awayKey !== away) continue;
    if (Math.abs(s.kickoffMs - kick) > KICKOFF_MATCH_MS) continue;
    return s;
  }
  return null;
}

function timerForPeriod(
  period: string | null,
  minute: number | null,
  now: number
): { timerStart: string | null; timerStatus: string | null } {
  if (period === "HT" || period === "FT") {
    return { timerStart: null, timerStatus: "PAUSADO" };
  }
  if (minute == null || (period !== "1H" && period !== "2H" && period !== "ET" && period !== "P")) {
    return { timerStart: null, timerStatus: null };
  }
  let into = minute;
  if (period === "2H") into = Math.max(0, minute - 45);
  else if (period === "ET" || period === "P") into = Math.max(0, minute - 90);
  return {
    timerStart: new Date(now - into * 60_000).toISOString(),
    timerStatus: "INICIADO",
  };
}

/** Overlay one fixture. Returns the same object when ESPN has nothing newer. */
export function patchMatch<T extends Match>(m: T, snaps: EspnSnapshot[], now = Date.now()): T {
  const snap = findSnap(m, snaps);
  if (!snap) return m;

  if (snap.state === "pre") {
    if (m.status !== "live") return m;
    const phantom =
      (m.score?.[0] ?? 0) === 0 &&
      (m.score?.[1] ?? 0) === 0 &&
      (m.liveMinute == null || m.liveMinute === 0);
    if (!phantom) return m;
    return {
      ...m,
      status: "upcoming",
      score: null,
      liveMinute: null,
      period: null,
      timerStart: null,
      timerStatus: null,
    };
  }

  const finished = snap.state === "post" || snap.period === "FT";
  const postponed = /POSTPON/i.test(snap.statusName);
  const period = finished ? "FT" : snap.period;
  const clock = timerForPeriod(period, snap.minute, now);
  return {
    ...m,
    status: postponed ? "postponed" : finished ? "finished" : "live",
    score: snap.score ?? m.score,
    liveMinute: finished || period === "HT" ? null : snap.minute,
    period,
    timerStart: clock.timerStart,
    timerStatus: clock.timerStatus,
  };
}

export function applyEspnToDashboard(
  data: DashboardData,
  snaps: EspnSnapshot[],
  now = Date.now()
): DashboardData {
  if (!snaps.length) return data;
  const all = data.all.map((m) => patchMatch(m, snaps, now));
  const changed = all.some((m, i) => m !== data.all[i]);
  if (!changed) return data;
  return {
    ...data,
    all,
    live: all.filter((m) => m.status === "live"),
    today: all.filter(isMatchToday),
    upcoming: all.filter(isMatchUpcoming).slice(0, 20),
    recent: all
      .filter((m) => m.status === "finished")
      .sort((a, b) => b.datetime - a.datetime)
      .slice(0, 10),
    fetchedAt: new Date(now),
  };
}

export async function loadEspnSnapshots(dates: string[]): Promise<EspnSnapshot[]> {
  if (!dates.length) return cachedSnaps;
  const lists = await Promise.all(
    dates.map(async (date) => {
      const url = `${ESPN_SCOREBOARD}?dates=${date}&limit=100`;
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
      if (!res.ok) throw new Error(`ESPN HTTP ${res.status}`);
      return parseEspnScoreboard(await res.json());
    })
  );
  cachedSnaps = lists.flat();
  return cachedSnaps;
}
