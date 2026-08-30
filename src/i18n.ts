import type { ViewId } from "./types";

export type Lang = "en" | "pt";

const STORAGE_KEY = "br26-lang";

export const LOCALE: Record<Lang, string> = {
  en: "en-US",
  pt: "pt-BR",
};

export const FLAG_BR = "https://flagcdn.com/w40/br.png";
export const FLAG_US = "https://flagcdn.com/w40/us.png";

const strings = {
  en: {
    title: "Brasileirão 2026",
    tagline: "Série A · Brazilian Championship",
    navSchedule: "Matches",
    navLive: "Live",
    navTable: "Table",
    navScorers: "Scorers",
    filterAll: "All",
    filterLive: "Live",
    filterToday: "Today",
    filterUpcoming: "Upcoming",
    filterFinished: "Finished",
    statusLive: "LIVE",
    statusFinished: "FT",
    statusUpcoming: "Upcoming",
    statusScheduled: "Scheduled",
    statusPostponed: "Postponed",
    loading: "Loading Brasileirão data…",
    errorTitle: "Could not load data",
    tryAgain: "Try again",
    noMatches: "No matches in this view right now.",
    noScorers: "Scorers not available yet.",
    noLiveTitle: "No live matches right now",
    nextUp: "Next up",
    recentResults: "Recent results",
    matchesInProgress: "{n} match in progress",
    matchesInProgressPlural: "{n} matches in progress",
    alsoToday: "Also today",
    noOtherToday: "No other matches today.",
    colPos: "#",
    colTeam: "Team",
    colPlayed: "P",
    colWon: "W",
    colDrawn: "D",
    colLost: "L",
    colGF: "GF",
    colGA: "GA",
    colGD: "GD",
    colPts: "Pts",
    tabGoals: "Goals",
    player: "Player",
    updated: "Updated {time}",
    lastRefresh: "Last refresh",
    refreshNow: "Refresh now",
    language: "Language",
    langPt: "Português (Brasil)",
    langEn: "English (US)",
    timeJustNow: "just now",
    timeSeconds: "{n}s ago",
    timeMinutes: "{n}m ago",
    timeHours: "{n}h ago",
    mdLoading: "Loading match…",
    mdEvents: "Events",
    mdStats: "Stats",
    mdLineups: "Lineups",
    mdClose: "Close",
    mdNoEvents: "No events yet.",
    mdNoStats: "Stats not available yet.",
    mdNoLineups: "Lineups not available yet.",
    mdFormation: "Formation",
    mdCoach: "Coach",
    mdBench: "Bench",
    mdGoal: "Goal",
    mdYellow: "Yellow card",
    mdRed: "Red card",
    mdSub: "Substitution",
    mdOdds: "Match odds",
    mdOddsDraw: "Draw",
    mdOddsHint: "Implied probability from bookmaker odds (1X2)",
    mdHeatmap: "Pitch map",
    mdHeatmapHint: "Interactive pitch visualization when available for this match.",
    mdNoHeatmap: "Pitch map not available for this match yet.",
    budgetLabel: "API {used}/{total}",
    zoneLib: "Libertadores",
    zonePreLib: "Libertadores qualifiers",
    zoneSula: "Sudamericana",
    zoneRel: "Relegation",
  },
  pt: {
    title: "Brasileirão 2026",
    tagline: "Série A · Campeonato Brasileiro",
    navSchedule: "Jogos",
    navLive: "Ao vivo",
    navTable: "Tabela",
    navScorers: "Artilharia",
    filterAll: "Todos",
    filterLive: "Ao vivo",
    filterToday: "Hoje",
    filterUpcoming: "Próximos",
    filterFinished: "Encerrados",
    statusLive: "AO VIVO",
    statusFinished: "ENC",
    statusUpcoming: "Próximo",
    statusScheduled: "Agendado",
    statusPostponed: "Adiado",
    loading: "Carregando dados do Brasileirão…",
    errorTitle: "Não foi possível carregar",
    tryAgain: "Tentar de novo",
    noMatches: "Nenhum jogo nesta visão no momento.",
    noScorers: "Artilharia ainda indisponível.",
    noLiveTitle: "Nenhum jogo ao vivo agora",
    nextUp: "Próximo",
    recentResults: "Resultados recentes",
    matchesInProgress: "{n} jogo em andamento",
    matchesInProgressPlural: "{n} jogos em andamento",
    alsoToday: "Também hoje",
    noOtherToday: "Nenhum outro jogo hoje.",
    colPos: "#",
    colTeam: "Time",
    colPlayed: "J",
    colWon: "V",
    colDrawn: "E",
    colLost: "D",
    colGF: "GP",
    colGA: "GC",
    colGD: "SG",
    colPts: "Pts",
    tabGoals: "Gols",
    player: "Jogador",
    updated: "Atualizado {time}",
    lastRefresh: "Última atualização",
    refreshNow: "Atualizar agora",
    language: "Idioma",
    langPt: "Português (Brasil)",
    langEn: "English (US)",
    timeJustNow: "agora",
    timeSeconds: "há {n}s",
    timeMinutes: "há {n} min",
    timeHours: "há {n} h",
    mdLoading: "Carregando partida…",
    mdEvents: "Lances",
    mdStats: "Estatísticas",
    mdLineups: "Escalações",
    mdClose: "Fechar",
    mdNoEvents: "Nenhum lance ainda.",
    mdNoStats: "Estatísticas ainda indisponíveis.",
    mdNoLineups: "Escalações ainda indisponíveis.",
    mdFormation: "Formação",
    mdCoach: "Técnico",
    mdBench: "Banco",
    mdGoal: "Gol",
    mdYellow: "Cartão amarelo",
    mdRed: "Cartão vermelho",
    mdSub: "Substituição",
    mdOdds: "Odds do jogo",
    mdOddsDraw: "Empate",
    mdOddsHint: "Probabilidade implícita a partir das odds 1X2",
    mdHeatmap: "Mapa de calor",
    mdHeatmapHint: "Visualização do campo quando disponível para este jogo.",
    mdNoHeatmap: "Mapa de calor ainda indisponível para este jogo.",
    budgetLabel: "API {used}/{total}",
    zoneLib: "Libertadores",
    zonePreLib: "Pré-Libertadores",
    zoneSula: "Sul-Americana",
    zoneRel: "Zona de rebaixamento",
  },
} as const;

export type StringKey = keyof typeof strings.en;

export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "pt") return saved;
  } catch {
    /* ignore */
  }
  const nav = navigator.language?.toLowerCase() ?? "";
  return nav.startsWith("pt") ? "pt" : "en";
}

export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

export function t(lang: Lang, key: StringKey, vars?: Record<string, string | number>): string {
  let s: string = strings[lang][key] ?? strings.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(`{${k}}`, String(v));
    }
  }
  return s;
}

export function navLabel(lang: Lang, id: ViewId): string {
  const map: Record<ViewId, StringKey> = {
    schedule: "navSchedule",
    live: "navLive",
    table: "navTable",
    scorers: "navScorers",
  };
  return t(lang, map[id]);
}

export function filterLabel(lang: Lang, filter: string): string {
  const map: Record<string, StringKey> = {
    all: "filterAll",
    live: "filterLive",
    today: "filterToday",
    upcoming: "filterUpcoming",
    finished: "filterFinished",
  };
  return t(lang, map[filter] ?? "filterAll");
}
