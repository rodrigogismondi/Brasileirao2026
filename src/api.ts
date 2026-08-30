import type {
  BudgetInfo,
  DashboardData,
  Match,
  MatchCard,
  MatchDetail,
  MatchGoal,
  MatchStatRow,
  MatchStatus,
  MatchSub,
  PlayerStatRow,
  StandingRow,
  TeamLineup,
} from "./types";
import { isMatchToday, isMatchUpcoming } from "./utils";

export type { DashboardData, BudgetInfo } from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");
/** Vite base path, e.g. `/Brasileirao2026/` on GitHub Pages — needed for static demo cache. */
const STATIC_BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const FETCH_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(input: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Request timed out after ${FETCH_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Worker / Vite proxy API routes (absolute when VITE_API_BASE is set). */
function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

/** Static files under `public/` — must include Vite `base` on project Pages sites. */
function cacheUrl(path: string): string {
  const bust = `t=${Date.now()}`;
  return `${STATIC_BASE}${path}${path.includes("?") ? "&" : "?"}${bust}`;
}

function normalizeStatus(short: string): MatchStatus {
  if (["1H", "HT", "2H", "ET", "BT", "P", "LIVE"].includes(short)) return "live";
  if (["FT", "AET", "PEN"].includes(short)) return "finished";
  if (short === "PST") return "postponed";
  if (short === "NS") return "upcoming";
  return "scheduled";
}

function roundLabel(round: string | undefined): string {
  if (!round) return "";
  const m = round.match(/(\d+)\s*$/);
  if (m) return `Rodada ${m[1]}`;
  return round.replace("Regular Season - ", "Rodada ");
}

function roundNumberFromLabel(round: string | undefined): number | null {
  const m = String(round || "").match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

interface RawFixture {
  fixture: {
    id: number;
    timestamp: number;
    venue?: { name?: string; city?: string };
    status: { short: string; elapsed: number | null };
    timerStart?: string | null;
    timerStatus?: string | null;
  };
  league?: { round?: string };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
  odds?: { home: number; draw: number; away: number; source?: string } | null;
}

function mapMatch(f: RawFixture): Match {
  const dt = new Date(f.fixture.timestamp * 1000);
  const period = f.fixture.status.short || null;
  let status = normalizeStatus(f.fixture.status.short);
  // Soft-live: when the live-cache cron lags, GE lista may still say NS
  // after kickoff. Promote so the UI leaves "em breve" / upcoming.
  if (status === "upcoming" || status === "scheduled") {
    const ageSec = Math.floor(Date.now() / 1000) - f.fixture.timestamp;
    if (ageSec >= 90 && ageSec < 3 * 3600) {
      status = "live";
    }
  }
  const score =
    f.goals.home != null && f.goals.away != null ? ([f.goals.home, f.goals.away] as [number, number]) : null;
  const odds =
    f.odds && f.odds.home > 1 && f.odds.draw > 1 && f.odds.away > 1
      ? {
          home: f.odds.home,
          draw: f.odds.draw,
          away: f.odds.away,
          source: f.odds.source,
        }
      : null;
  const isLive = status === "live";
  return {
    id: f.fixture.id,
    round: roundLabel(f.league?.round),
    team1: f.teams.home.name,
    team2: f.teams.away.name,
    logo1: f.teams.home.logo ?? "",
    logo2: f.teams.away.logo ?? "",
    status,
    score: score ?? (isLive ? ([0, 0] as [number, number]) : null),
    liveMinute: isLive ? f.fixture.status.elapsed : null,
    period: isLive ? (period === "NS" ? "1H" : period) : null,
    timerStart: isLive ? f.fixture.timerStart ?? null : null,
    timerStatus: isLive ? f.fixture.timerStatus ?? null : null,
    date: dt.toISOString().slice(0, 10),
    time: dt.toTimeString().slice(0, 5),
    datetime: f.fixture.timestamp,
    venue: f.fixture.venue?.name || f.fixture.venue?.city || "",
    roundNumber: roundNumberFromLabel(f.league?.round),
    odds,
  };
}

function mapZone(description: string | null | undefined, rank: number): StandingRow["zone"] {
  const d = (description ?? "").toLowerCase();
  if (d.includes("relegation") || d.includes("rebaix")) return "relegation";
  if (d.includes("sudamericana") || d.includes("sul-americana")) return "sudamericana";
  if (d.includes("qualif")) return "pre-libertadores";
  if (d.includes("libertadores")) return "libertadores";
  if (rank <= 4) return "libertadores";
  if (rank <= 6) return "pre-libertadores";
  if (rank <= 12) return "sudamericana";
  if (rank >= 17) return "relegation";
  return "mid";
}

function mapStandings(raw: unknown): StandingRow[] {
  const arr = raw as Array<{ league?: { standings?: unknown[] } }>;
  const table = (arr?.[0]?.league?.standings?.[0] ?? []) as Array<{
    rank: number;
    team: { id: number; name: string; logo: string };
    points: number;
    goalsDiff: number;
    form?: string;
    description?: string | null;
    all: {
      played: number;
      win: number;
      draw: number;
      lose: number;
      goals: { for: number; against: number };
    };
  }>;
  return table.map((row) => ({
    rank: row.rank,
    teamId: row.team.id,
    name: row.team.name,
    logo: row.team.logo,
    played: row.all.played,
    won: row.all.win,
    drawn: row.all.draw,
    lost: row.all.lose,
    goalsFor: row.all.goals.for,
    goalsAgainst: row.all.goals.against,
    goalDiff: row.goalsDiff,
    points: row.points,
    form: row.form ?? "",
    zone: mapZone(row.description, row.rank),
  }));
}

function mapPlayerRows(raw: unknown, kind: "goals" | "assists"): PlayerStatRow[] {
  const arr = (raw ?? []) as Array<{
    player: { id: number; name: string; photo?: string };
    statistics: Array<{
      team: { name: string; logo: string };
      goals?: { total?: number | null; assists?: number | null };
      games?: { appearences?: number | null; appearances?: number | null };
    }>;
  }>;
  return arr.map((row) => {
    const st = row.statistics?.[0];
    const value =
      kind === "goals" ? (st?.goals?.total ?? 0) : (st?.goals?.assists ?? 0);
    return {
      id: row.player.id,
      name: row.player.name,
      photo: row.player.photo ?? "",
      team: st?.team?.name ?? "",
      teamLogo: st?.team?.logo ?? "",
      value: value ?? 0,
      appearances: st?.games?.appearences ?? st?.games?.appearances ?? 0,
    };
  });
}

interface RawEvent {
  time: { elapsed: number | null; extra: number | null };
  team: { id: number; name: string };
  player: { name: string | null };
  assist: { name: string | null } | null;
  type: string;
  detail: string;
}

interface RawDetail extends RawFixture {
  events?: RawEvent[];
  lineups?: Array<{
    team: { name: string; logo: string };
    formation: string | null;
    coach?: { name?: string };
    startXI?: Array<{ player: { name: string; number: number | null; pos: string; grid: string | null } }>;
    substitutes?: Array<{ player: { name: string; number: number | null; pos: string; grid: string | null } }>;
  }>;
  statistics?: Array<{
    team: { id: number; name: string };
    statistics: Array<{ type: string; value: string | number | null }>;
  }>;
  score?: { halftime?: { home: number | null; away: number | null } };
  sportsFieldUrl?: string | null;
}

function minuteStr(e: RawEvent): string {
  const base = e.time.elapsed ?? 0;
  return e.time.extra ? `${base}+${e.time.extra}` : String(base);
}

export function mapMatchDetail(raw: RawDetail): MatchDetail {
  const base = mapMatch(raw);
  const homeId = raw.teams.home.id;
  const goals1: MatchGoal[] = [];
  const goals2: MatchGoal[] = [];
  const cards: MatchCard[] = [];
  const subs: MatchSub[] = [];

  for (const e of raw.events ?? []) {
    const team: 1 | 2 = e.team.id === homeId ? 1 : 2;
    const minute = e.time.elapsed ?? 0;
    if (e.type === "Goal") {
      const g: MatchGoal = {
        name: e.player?.name ?? "?",
        minute: minuteStr(e),
        assist: e.assist?.name ?? undefined,
      };
      (team === 1 ? goals1 : goals2).push(g);
    } else if (e.type === "Card") {
      cards.push({
        team,
        minute,
        name: e.player?.name ?? "?",
        type: /red/i.test(e.detail) ? "red" : "yellow",
      });
    } else if (e.type === "subst") {
      subs.push({
        team,
        minute,
        playerIn: e.player?.name ?? "?",
        playerOut: e.assist?.name ?? "?",
      });
    }
  }

  const stats: MatchStatRow[] = [];
  const homeStats = raw.statistics?.[0]?.statistics ?? [];
  const awayStats = raw.statistics?.[1]?.statistics ?? [];
  const keys = new Set([...homeStats.map((s) => s.type), ...awayStats.map((s) => s.type)]);
  for (const key of keys) {
    const h = homeStats.find((s) => s.type === key)?.value ?? 0;
    const a = awayStats.find((s) => s.type === key)?.value ?? 0;
    stats.push({ key, values: [h ?? 0, a ?? 0] });
  }

  const lineups: TeamLineup[] = (raw.lineups ?? []).map((l) => ({
    team: l.team.name,
    logo: l.team.logo,
    formation: l.formation ?? "—",
    coach: l.coach?.name ?? "—",
    startXI: (l.startXI ?? []).map((p) => ({
      name: p.player.name,
      number: p.player.number,
      pos: p.player.pos,
      grid: p.player.grid,
    })),
    substitutes: (l.substitutes ?? []).map((p) => ({
      name: p.player.name,
      number: p.player.number,
      pos: p.player.pos,
      grid: p.player.grid,
    })),
  }));

  const ht = raw.score?.halftime;
  return {
    ...base,
    halfTime:
      ht?.home != null && ht?.away != null ? [ht.home, ht.away] : null,
    goals1,
    goals2,
    cards,
    subs,
    stats,
    lineups,
    odds:
      raw.odds && raw.odds.home > 1 && raw.odds.draw > 1 && raw.odds.away > 1
        ? {
            home: raw.odds.home,
            draw: raw.odds.draw,
            away: raw.odds.away,
            source: raw.odds.source,
          }
        : base.odds,
    sportsFieldUrl: raw.sportsFieldUrl ?? null,
  };
}

export function matchSummaryFromList(m: Match): MatchDetail {
  return {
    ...m,
    halfTime: null,
    goals1: [],
    goals2: [],
    cards: [],
    subs: [],
    stats: [],
    lineups: [],
    odds: m.odds,
    sportsFieldUrl: null,
  };
}

interface DashboardPayload {
  fixtures: RawFixture[];
  standings: unknown;
  scorers: unknown;
  assists: unknown;
  budget: BudgetInfo;
  fetchedAt: string;
  source: string;
  meta?: {
    rodada?: number;
    ultimaRodada?: number;
    rounds?: number[];
  };
}

async function loadDashboardPayload(): Promise<DashboardPayload> {
  // Prefer live API / Vite proxy; fall back to packaged demo cache.
  // Cache paths must include BASE_URL so GitHub Pages project sites resolve correctly.
  const endpoints = [
    API_BASE ? apiUrl("/api/dashboard") : "/api/dashboard",
    cacheUrl("/cache/dashboard.json"),
  ];
  let lastError: Error | null = null;
  for (const url of endpoints) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        lastError = new Error(body?.error || `HTTP ${res.status}`);
        continue;
      }
      return (await res.json()) as DashboardPayload;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("fetch failed");
    }
  }
  throw lastError ?? new Error("Could not load dashboard");
}

export async function fetchDashboard(): Promise<DashboardData> {
  const data = await loadDashboardPayload();
  const all = (data.fixtures ?? []).map(mapMatch).sort((a, b) => a.datetime - b.datetime);
  const live = all.filter((m) => m.status === "live");
  const recent = all
    .filter((m) => m.status === "finished")
    .sort((a, b) => b.datetime - a.datetime)
    .slice(0, 10);

  const roundsFromMatches = [
    ...new Set(all.map((m) => m.roundNumber).filter((n): n is number => n != null && n > 0)),
  ].sort((a, b) => a - b);
  const rounds =
    data.meta?.rounds && data.meta.rounds.length > 0 ? data.meta.rounds : roundsFromMatches;
  const currentRound = data.meta?.rodada ?? rounds[rounds.length - 1] ?? 1;
  const lastRound = data.meta?.ultimaRodada ?? rounds[rounds.length - 1] ?? currentRound;

  return {
    all,
    live,
    today: all.filter(isMatchToday),
    upcoming: all.filter(isMatchUpcoming).slice(0, 20),
    recent,
    standings: mapStandings(data.standings),
    scorers: mapPlayerRows(data.scorers, "goals"),
    assists: mapPlayerRows(data.assists, "assists"),
    budget: data.budget,
    fetchedAt: new Date(data.fetchedAt),
    demo: data.source === "demo",
    source: data.source ?? "demo",
    currentRound,
    lastRound,
    rounds,
  };
}

export async function fetchMatchDetail(id: number): Promise<MatchDetail | null> {
  const endpoints = [
    API_BASE ? apiUrl(`/api/match/${id}`) : `/api/match/${id}`,
    cacheUrl(`/cache/matches/${id}.json`),
  ];
  for (const url of endpoints) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) continue;
      const raw = (await res.json()) as RawDetail;
      if (!raw?.fixture) continue;
      return mapMatchDetail(raw);
    } catch {
      /* try next */
    }
  }
  return null;
}
