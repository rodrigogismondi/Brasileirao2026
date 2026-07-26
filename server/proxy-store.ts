import {
  type BudgetDecision,
  type BudgetState,
  type CacheKind,
  decideLivePoll,
  freshBudget,
  recordUse,
  remaining,
  rollBudgetDay,
  ttlFor,
} from "./budget";
import { apiFootballFetch, leagueSeasonParams } from "./api-football";

interface CacheEntry<T> {
  at: number;
  data: T;
}

export interface ProxyStore {
  budget: BudgetState;
  cache: Map<string, CacheEntry<unknown>>;
}

export function createStore(): ProxyStore {
  return { budget: freshBudget(), cache: new Map() };
}

function getCached<T>(store: ProxyStore, key: string, ttl: number): T | null {
  const hit = store.cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttl) return null;
  return hit.data as T;
}

function setCache(store: ProxyStore, key: string, data: unknown): void {
  store.cache.set(key, { at: Date.now(), data });
}

function liveWindowMinutesLeft(fixtures: Array<{ fixture: { timestamp: number; status: { short: string } } }>): number {
  const now = Date.now();
  const liveOrSoon = fixtures.filter((f) => {
    const short = f.fixture.status.short;
    if (["1H", "HT", "2H", "ET", "BT", "P", "LIVE"].includes(short)) return true;
    const start = f.fixture.timestamp * 1000;
    return start > now && start - now < 4 * 60 * 60_000;
  });
  if (liveOrSoon.length === 0) return 120;
  const ends = liveOrSoon.map((f) => f.fixture.timestamp * 1000 + 2.5 * 60 * 60_000);
  const last = Math.max(...ends);
  return Math.max(30, Math.ceil((last - now) / 60_000));
}

function nextKickoffMs(fixtures: Array<{ fixture: { timestamp: number; status: { short: string } } }>): number | null {
  const now = Date.now() / 1000;
  const upcoming = fixtures
    .filter((f) => f.fixture.status.short === "NS" && f.fixture.timestamp > now)
    .map((f) => f.fixture.timestamp * 1000)
    .sort((a, b) => a - b);
  return upcoming[0] ?? null;
}

function hasLive(fixtures: Array<{ fixture: { status: { short: string } } }>): boolean {
  return fixtures.some((f) =>
    ["1H", "HT", "2H", "ET", "BT", "P", "LIVE"].includes(f.fixture.status.short)
  );
}

export async function getDashboardPayload(store: ProxyStore, apiKey: string): Promise<{
  fixtures: unknown;
  standings: unknown;
  scorers: unknown;
  assists: unknown;
  budget: { used: number; remaining: number; mode: BudgetDecision["mode"]; liveIntervalMs: number };
  fetchedAt: string;
  source: "api" | "cache-mixed";
}> {
  store.budget = rollBudgetDay(store.budget);
  const modeProbe = decideLivePoll(store.budget, {
    hasLive: false,
    nextKickoffMs: null,
    liveWindowMinutesLeft: 120,
  });

  const fixturesKey = "fixtures:season";
  let fixtures =
    getCached<unknown[]>(store, fixturesKey, ttlFor("fixtures", modeProbe.mode)) ?? null;

  if (!fixtures) {
    if (remaining(store.budget) <= 0) throw new Error("Daily API budget exhausted");
    fixtures = await apiFootballFetch<unknown[]>("/fixtures", apiKey, leagueSeasonParams());
    store.budget = recordUse(store.budget, "fixtures");
    setCache(store, fixturesKey, fixtures);
  }

  const typed = fixtures as Array<{
    fixture: { timestamp: number; status: { short: string } };
  }>;
  const decision = decideLivePoll(store.budget, {
    hasLive: hasLive(typed),
    nextKickoffMs: nextKickoffMs(typed),
    liveWindowMinutesLeft: liveWindowMinutesLeft(typed),
  });

  if (decision.allow) {
    const live = await apiFootballFetch<unknown[]>(
      "/fixtures",
      apiKey,
      leagueSeasonParams({ live: "all" })
    );
    store.budget = recordUse(store.budget, "live");
    setCache(store, "fixtures:live", live);
    // Merge live statuses into season cache lightly by replacing matching ids
    const liveArr = live as Array<{ fixture: { id: number } }>;
    const byId = new Map(liveArr.map((m) => [m.fixture.id, m]));
    const merged = (fixtures as Array<{ fixture: { id: number } }>).map(
      (m) => byId.get(m.fixture.id) ?? m
    );
    fixtures = merged;
    setCache(store, fixturesKey, fixtures);
  }

  async function cachedOrFetch(kind: CacheKind, key: string, path: string): Promise<unknown> {
    const hit = getCached(store, key, ttlFor(kind, decision.mode));
    if (hit) return hit;
    if (remaining(store.budget) <= 0) return hit ?? [];
    const data = await apiFootballFetch<unknown[]>(path, apiKey, leagueSeasonParams());
    store.budget = recordUse(store.budget, kind);
    setCache(store, key, data);
    return data;
  }

  const [standings, scorers, assists] = await Promise.all([
    cachedOrFetch("standings", "standings", "/standings"),
    cachedOrFetch("scorers", "scorers", "/players/topscorers"),
    cachedOrFetch("assists", "assists", "/players/topassists"),
  ]);

  return {
    fixtures,
    standings,
    scorers,
    assists,
    budget: {
      used: store.budget.used,
      remaining: remaining(store.budget),
      mode: decision.mode,
      liveIntervalMs: decision.suggestedLiveIntervalMs,
    },
    fetchedAt: new Date().toISOString(),
    source: "cache-mixed",
  };
}

export async function getMatchDetailPayload(
  store: ProxyStore,
  apiKey: string,
  fixtureId: number
): Promise<unknown> {
  store.budget = rollBudgetDay(store.budget);
  const key = `detail:${fixtureId}`;
  const decision = decideLivePoll(store.budget, {
    hasLive: true,
    nextKickoffMs: null,
    liveWindowMinutesLeft: 120,
  });
  const hit = getCached(store, key, ttlFor("detail", decision.mode));
  if (hit) return hit;

  if (remaining(store.budget) <= 0) {
    throw new Error("Daily API budget exhausted");
  }

  // Single-id fixture call can include events / statistics / lineups in one request.
  const data = await apiFootballFetch<unknown[]>("/fixtures", apiKey, {
    id: String(fixtureId),
  });
  store.budget = recordUse(store.budget, "detail");
  const match = Array.isArray(data) ? data[0] : data;
  setCache(store, key, match);
  return match;
}

export function budgetStatus(store: ProxyStore): Record<string, unknown> {
  store.budget = rollBudgetDay(store.budget);
  return {
    dayKey: store.budget.dayKey,
    used: store.budget.used,
    remaining: remaining(store.budget),
    dailyBudget: 100,
  };
}
