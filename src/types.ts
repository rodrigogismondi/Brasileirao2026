export type MatchStatus = "scheduled" | "live" | "finished" | "upcoming" | "postponed";

export type ViewId = "schedule" | "live" | "table" | "scorers";

export interface Match {
  id: number;
  round: string;
  team1: string;
  team2: string;
  logo1: string;
  logo2: string;
  status: MatchStatus;
  score: [number, number] | null;
  /** Synced elapsed minute (may be slightly stale between syncs). */
  liveMinute: number | null;
  /** GE period code: 1H, HT, 2H, ET, LIVE, … */
  period: string | null;
  /** ISO kickoff of the current period from GE `timerStart`. */
  timerStart: string | null;
  /** GE timerStatus: INICIADO | PAUSADO | … */
  timerStatus: string | null;
  date: string;
  time: string;
  datetime: number;
  venue: string;
  /** Numeric round (1–38) when known. */
  roundNumber: number | null;
}

export interface StandingRow {
  rank: number;
  teamId: number;
  name: string;
  logo: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  form: string;
  zone: "libertadores" | "pre-libertadores" | "sudamericana" | "relegation" | "mid" | null;
}

export interface PlayerStatRow {
  id: number;
  name: string;
  photo: string;
  team: string;
  teamLogo: string;
  value: number;
  appearances: number;
}

export type MatchDetailTab = "events" | "stats" | "lineups";

export interface MatchOdds {
  home: number;
  draw: number;
  away: number;
  source?: string;
}

export interface MatchGoal {
  name: string;
  minute: string;
  assist?: string;
}

export interface MatchCard {
  team: 1 | 2;
  minute: number;
  name: string;
  type: "yellow" | "red";
}

export interface MatchSub {
  team: 1 | 2;
  minute: number;
  playerIn: string;
  playerOut: string;
}

export interface MatchStatRow {
  key: string;
  values: [string | number, string | number];
}

export interface LineupPlayer {
  name: string;
  number: number | null;
  pos: string;
  grid: string | null;
}

export interface TeamLineup {
  team: string;
  logo: string;
  formation: string;
  coach: string;
  startXI: LineupPlayer[];
  substitutes: LineupPlayer[];
}

export interface MatchDetail extends Match {
  halfTime: [number, number] | null;
  goals1: MatchGoal[];
  goals2: MatchGoal[];
  cards: MatchCard[];
  subs: MatchSub[];
  stats: MatchStatRow[];
  lineups: TeamLineup[];
  odds: MatchOdds | null;
  sportsFieldUrl: string | null;
}

export interface BudgetInfo {
  used: number;
  remaining: number;
  mode: "idle" | "prematch" | "live" | "cooldown";
  liveIntervalMs: number;
}

export interface DashboardData {
  all: Match[];
  live: Match[];
  today: Match[];
  upcoming: Match[];
  recent: Match[];
  standings: StandingRow[];
  scorers: PlayerStatRow[];
  assists: PlayerStatRow[];
  budget: BudgetInfo;
  fetchedAt: Date;
  demo: boolean;
  source: string;
  currentRound: number;
  lastRound: number;
  rounds: number[];
}
