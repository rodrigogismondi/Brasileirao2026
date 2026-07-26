/**
 * Smart daily request budget for API-Football free tier (100 req/day).
 *
 * Strategy:
 * - Idle: almost no polling when nothing is scheduled/live
 * - Pre-match: light checks for kickoff + lineups
 * - Live: one shared live fixtures call on a cadence sized to remaining budget
 * - Heavy data (standings / scorers / assists): long TTL cache
 * - Match detail (stats / lineups): on-demand with short cache
 */

export const DAILY_BUDGET = 100;
export const LEAGUE_ID = 71;
export const SEASON = 2026;

export type CacheKind =
  | "fixtures"
  | "live"
  | "standings"
  | "scorers"
  | "assists"
  | "detail"
  | "lineups"
  | "stats";

export interface BudgetState {
  /** YYYY-MM-DD in America/Sao_Paulo */
  dayKey: string;
  used: number;
  lastLivePollAt: number;
  lastFixturesAt: number;
  lastStandingsAt: number;
  lastScorersAt: number;
  lastAssistsAt: number;
}

export interface BudgetDecision {
  allow: boolean;
  reason: string;
  remaining: number;
  suggestedLiveIntervalMs: number;
  mode: "idle" | "prematch" | "live" | "cooldown";
}

const RESERVE_STATIC = 20; // standings + scorers + assists + fixtures headroom
const MIN_LIVE_INTERVAL_MS = 90_000;
const MAX_LIVE_INTERVAL_MS = 180_000;
const PREMATCH_WINDOW_MS = 75 * 60_000;

export function saoPauloDayKey(now = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}

export function freshBudget(now = Date.now()): BudgetState {
  return {
    dayKey: saoPauloDayKey(now),
    used: 0,
    lastLivePollAt: 0,
    lastFixturesAt: 0,
    lastStandingsAt: 0,
    lastScorersAt: 0,
    lastAssistsAt: 0,
  };
}

export function rollBudgetDay(state: BudgetState, now = Date.now()): BudgetState {
  const key = saoPauloDayKey(now);
  if (state.dayKey === key) return state;
  return freshBudget(now);
}

export function remaining(state: BudgetState): number {
  return Math.max(0, DAILY_BUDGET - state.used);
}

/** Live poll cadence from remaining budget and expected live window length. */
export function suggestedLiveIntervalMs(
  state: BudgetState,
  liveWindowMinutesLeft: number
): number {
  const liveBudget = Math.max(0, remaining(state) - RESERVE_STATIC);
  const minutes = Math.max(30, liveWindowMinutesLeft);
  const ideal = Math.floor((minutes * 60_000) / Math.max(1, liveBudget));
  return Math.min(MAX_LIVE_INTERVAL_MS, Math.max(MIN_LIVE_INTERVAL_MS, ideal));
}

export function decideLivePoll(
  state: BudgetState,
  opts: {
    hasLive: boolean;
    nextKickoffMs: number | null;
    liveWindowMinutesLeft: number;
    now?: number;
  }
): BudgetDecision {
  const now = opts.now ?? Date.now();
  const rem = remaining(state);
  const interval = suggestedLiveIntervalMs(state, opts.liveWindowMinutesLeft);

  if (rem <= RESERVE_STATIC && !opts.hasLive) {
    return {
      allow: false,
      reason: "reserve-for-static",
      remaining: rem,
      suggestedLiveIntervalMs: interval,
      mode: "cooldown",
    };
  }

  if (opts.hasLive) {
    const due = now - state.lastLivePollAt >= interval;
    return {
      allow: due && rem > 0,
      reason: due ? "live-window" : "live-throttle",
      remaining: rem,
      suggestedLiveIntervalMs: interval,
      mode: "live",
    };
  }

  if (opts.nextKickoffMs != null && opts.nextKickoffMs - now <= PREMATCH_WINDOW_MS) {
    const preInterval = 10 * 60_000;
    const due = now - state.lastLivePollAt >= preInterval;
    return {
      allow: due && rem > 1,
      reason: due ? "prematch-check" : "prematch-throttle",
      remaining: rem,
      suggestedLiveIntervalMs: preInterval,
      mode: "prematch",
    };
  }

  return {
    allow: false,
    reason: "idle-no-live",
    remaining: rem,
    suggestedLiveIntervalMs: interval,
    mode: "idle",
  };
}

export function ttlFor(kind: CacheKind, mode: BudgetDecision["mode"]): number {
  switch (kind) {
    case "live":
      return mode === "live" ? 60_000 : 5 * 60_000;
    case "fixtures":
      return mode === "live" ? 5 * 60_000 : 60 * 60_000;
    case "standings":
      return mode === "live" ? 10 * 60_000 : 3 * 60 * 60_000;
    case "scorers":
    case "assists":
      return 3 * 60 * 60_000;
    case "detail":
      return mode === "live" ? 90_000 : 10 * 60_000;
    case "lineups":
      return 30 * 60_000;
    case "stats":
      return mode === "live" ? 90_000 : 15 * 60_000;
  }
}

export function recordUse(state: BudgetState, kind: CacheKind, now = Date.now()): BudgetState {
  const next = { ...state, used: state.used + 1 };
  if (kind === "live") next.lastLivePollAt = now;
  if (kind === "fixtures") next.lastFixturesAt = now;
  if (kind === "standings") next.lastStandingsAt = now;
  if (kind === "scorers") next.lastScorersAt = now;
  if (kind === "assists") next.lastAssistsAt = now;
  return next;
}
