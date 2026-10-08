import type {
  DashboardData,
  Match,
  MatchCard,
  MatchDetail,
  MatchGoal,
  MatchMoment,
  MatchSub,
} from "./types";
import { isMatchToday, isMatchUpcoming } from "./utils";

/**
 * GitHub Actions cron often lags by tens of minutes during a matchday, so the
 * static cache keeps old placares while the on-device clock keeps ticking.
 * ESPN's public scoreboard allows browser CORS and carries the live score,
 * period, and minute. We overlay that onto GE fixtures (matched by club).
 */

const ESPN_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/scoreboard";
const ESPN_SUMMARY =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/summary";

const LIVE_BEFORE_MS = 20 * 60 * 1000;
const LIVE_AFTER_MS = 4 * 60 * 60 * 1000;
const KICKOFF_MATCH_MS = 6 * 60 * 60 * 1000;

export interface EspnSnapshot {
  espnId: string;
  homeKey: string;
  awayKey: string;
  kickoffMs: number;
  state: "pre" | "in" | "post";
  statusName: string;
  period: string | null;
  minute: number | null;
  score: [number, number] | null;
}

/** One narration line from ESPN's Portuguese commentary feed. */
export interface EspnLance {
  minuteLabel: string;
  sortKey: number;
  text: string;
  headline: string;
  type: string;
  teamName: string | null;
  players: string[];
  disallowed: boolean;
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
      id?: string | number;
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
      espnId: String(ev.id ?? ""),
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

export function espnEventIdFor(match: Match): string | null {
  const id = findSnap(match, cachedSnaps)?.espnId;
  return id ? id : null;
}

function minuteParts(display: string, seconds: number): { label: string; sortKey: number } {
  const stop = display.match(/(\d+)\s*'\s*\+\s*(\d+)/);
  if (stop) {
    const base = Number(stop[1]);
    const extra = Number(stop[2]);
    return { label: `${base}+${extra}`, sortKey: base + extra };
  }
  const plain = display.match(/(\d+)/);
  if (plain && display.trim() !== "0'") {
    return { label: plain[1], sortKey: Number(plain[1]) };
  }
  if (Number.isFinite(seconds) && seconds > 0) {
    const n = Math.round(seconds / 60);
    return { label: String(n), sortKey: n };
  }
  return { label: "0", sortKey: 0 };
}

function isGoalType(type: string): boolean {
  return type === "goal" || type.startsWith("goal-") || type.startsWith("goal---");
}

function isDisallowedGoal(type: string, text: string): boolean {
  if (!isGoalType(type) && !/goal/i.test(type)) return false;
  return /cancelad|anulado|disallow|não há gol|nao ha gol|no goal/i.test(text);
}

export function parseEspnCommentary(payload: unknown): EspnLance[] {
  const rows = (payload as { commentary?: unknown[] } | null)?.commentary;
  if (!Array.isArray(rows)) return [];
  const out: EspnLance[] = [];
  rows.forEach((row, index) => {
    const item = row as {
      text?: string;
      time?: { value?: number; displayValue?: string };
      play?: {
        type?: { text?: string; type?: string };
        text?: string;
        shortText?: string;
        team?: { displayName?: string };
        participants?: Array<{ athlete?: { displayName?: string } }>;
        clock?: { value?: number; displayValue?: string };
      };
    };
    const text = String(item.text || item.play?.text || "").trim();
    if (!text) return;
    const type = String(item.play?.type?.type || "").toLowerCase();
    const headline = String(item.play?.type?.text || item.play?.shortText || "").trim();
    const clock = item.time?.displayValue || item.play?.clock?.displayValue || "";
    const seconds = Number(item.time?.value ?? item.play?.clock?.value ?? 0);
    const minute = minuteParts(String(clock), seconds);
    const players = (item.play?.participants ?? [])
      .map((p) => p.athlete?.displayName || "")
      .filter(Boolean);
    out.push({
      minuteLabel: minute.label,
      // Later lines in the same minute sort above earlier ones.
      sortKey: minute.sortKey + index / 100000,
      text,
      headline,
      type,
      teamName: item.play?.team?.displayName || null,
      players,
      disallowed: isDisallowedGoal(type, text),
    });
  });
  return out;
}

function minuteKey(minute: number | string): number {
  if (typeof minute === "number") return minute;
  const m = String(minute).match(/^(\d+)(?:\+(\d+))?/);
  if (!m) return 0;
  return Number(m[1]) + (m[2] ? Number(m[2]) : 0);
}

function feedMaxMinute(detail: MatchDetail): number {
  let max = -1;
  const bump = (minute: number | string) => {
    const n = minuteKey(minute);
    if (n > max) max = n;
  };
  for (const g of [...detail.goals1, ...detail.goals2]) bump(g.minute);
  for (const c of detail.cards) bump(c.minute);
  for (const s of detail.subs) bump(s.minute);
  for (const m of detail.moments ?? []) bump(m.minute);
  return max;
}

function sideOf(detail: MatchDetail, teamName: string | null): 1 | 2 | null {
  if (!teamName) return null;
  const key = clubKey(teamName);
  if (key && key === clubKey(detail.team1)) return 1;
  if (key && key === clubKey(detail.team2)) return 2;
  return null;
}

/**
 * Replace the cached GE timeline when ESPN commentary has reached a later minute.
 * The scoreboard clock was moving while lances stayed on the last GitHub sync.
 */
export function applyEspnCommentary<T extends MatchDetail>(detail: T, lances: EspnLance[]): T {
  if (!lances.length) return detail;
  const incoming = Math.floor(Math.max(...lances.map((l) => l.sortKey)));
  const cached = feedMaxMinute(detail);
  if (incoming < cached) return detail;
  if (incoming === cached) {
    const currentCount =
      detail.goals1.length +
      detail.goals2.length +
      detail.cards.length +
      detail.subs.length +
      (detail.moments?.length ?? 0);
    if (lances.length <= currentCount) return detail;
  }

  const goals1: MatchGoal[] = [];
  const goals2: MatchGoal[] = [];
  const cards: MatchCard[] = [];
  const subs: MatchSub[] = [];
  const moments: MatchMoment[] = [];

  const ordered = [...lances].sort((a, b) => b.sortKey - a.sortKey);
  for (const lance of ordered) {
    const side = sideOf(detail, lance.teamName);
    const shownMinute = Math.floor(lance.sortKey);
    const headline =
      lance.headline && lance.headline !== lance.text ? lance.headline : lance.text.slice(0, 72);
    if (isGoalType(lance.type) && !lance.disallowed && side) {
      const goal: MatchGoal = {
        name: lance.players[0] || headline,
        minute: lance.minuteLabel,
        assist: lance.players[1],
        own: /own-goal|gol contra/i.test(lance.type + " " + lance.text) || undefined,
      };
      (side === 1 ? goals1 : goals2).push(goal);
      continue;
    }
    if (/card/.test(lance.type) && side) {
      const red = /red|vermelh/.test(lance.type + " " + lance.text);
      cards.push({
        team: side,
        minute: shownMinute,
        name: lance.players[0] || headline,
        type: red ? "red" : "yellow",
      });
      continue;
    }
    if (lance.type.includes("substitution") && side) {
      subs.push({
        team: side,
        minute: shownMinute,
        playerIn: lance.players[0] || "?",
        playerOut: lance.players[1] || "?",
      });
      continue;
    }
    moments.push({
      team: side,
      minute: lance.minuteLabel,
      name: headline,
      title: lance.text,
      detail: lance.text,
    });
  }

  return { ...detail, goals1, goals2, cards, subs, moments };
}

export async function loadEspnCommentary(eventId: string): Promise<EspnLance[]> {
  const url = `${ESPN_SUMMARY}?event=${encodeURIComponent(eventId)}&lang=pt`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`ESPN commentary HTTP ${res.status}`);
  return parseEspnCommentary(await res.json());
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
