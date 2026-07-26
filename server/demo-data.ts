/** Offline/demo payload shaped like API-Football responses so the UI works without a key. */

/**
 * Kickoff wall-clock times are defined in America/Sao_Paulo (Brasileirão schedule),
 * then stored as absolute UTC so the UI can show them in the viewer's local timezone
 * (e.g. Louisiana CDT).
 */
function tsBrazil(dayOffset: number, hour: number, minute = 0): number {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt
      .formatToParts(new Date())
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value])
  ) as Record<string, string>;

  // Noon UTC on that Brazil calendar day, then shift by dayOffset (avoids DST edge cases).
  const baseUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12, 0, 0);
  const shifted = new Date(baseUtc + dayOffset * 86_400_000);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();
  // São Paulo is UTC−3 year-round (no DST since 2019).
  return Math.floor(Date.UTC(y, m, d, hour + 3, minute, 0) / 1000);
}

/** Verified API-Sports crest IDs (media.api-sports.io/football/teams/{id}.png). */
const teams = [
  { id: 127, name: "Flamengo", code: "FLA", logo: "https://media.api-sports.io/football/teams/127.png" },
  { id: 121, name: "Palmeiras", code: "PAL", logo: "https://media.api-sports.io/football/teams/121.png" },
  { id: 131, name: "Corinthians", code: "COR", logo: "https://media.api-sports.io/football/teams/131.png" },
  { id: 126, name: "São Paulo", code: "SAO", logo: "https://media.api-sports.io/football/teams/126.png" },
  { id: 128, name: "Santos", code: "SAN", logo: "https://media.api-sports.io/football/teams/128.png" },
  { id: 124, name: "Fluminense", code: "FLU", logo: "https://media.api-sports.io/football/teams/124.png" },
  { id: 120, name: "Botafogo", code: "BOT", logo: "https://media.api-sports.io/football/teams/120.png" },
  { id: 1062, name: "Atlético-MG", code: "CAM", logo: "https://media.api-sports.io/football/teams/1062.png" },
  { id: 135, name: "Cruzeiro", code: "CRU", logo: "https://media.api-sports.io/football/teams/135.png" },
  { id: 130, name: "Grêmio", code: "GRE", logo: "https://media.api-sports.io/football/teams/130.png" },
  { id: 119, name: "Internacional", code: "INT", logo: "https://media.api-sports.io/football/teams/119.png" },
  { id: 118, name: "Bahia", code: "BAH", logo: "https://media.api-sports.io/football/teams/118.png" },
  { id: 154, name: "Fortaleza", code: "FOR", logo: "https://media.api-sports.io/football/teams/154.png" },
  { id: 794, name: "Bragantino", code: "RBB", logo: "https://media.api-sports.io/football/teams/794.png" },
  { id: 133, name: "Vasco", code: "VAS", logo: "https://media.api-sports.io/football/teams/133.png" },
  { id: 136, name: "Vitória", code: "VIT", logo: "https://media.api-sports.io/football/teams/136.png" },
  { id: 152, name: "Juventude", code: "JUV", logo: "https://media.api-sports.io/football/teams/152.png" },
  { id: 134, name: "Athletico-PR", code: "CAP", logo: "https://media.api-sports.io/football/teams/134.png" },
  { id: 129, name: "Ceará", code: "CEA", logo: "https://media.api-sports.io/football/teams/129.png" },
  { id: 147, name: "Coritiba", code: "CFC", logo: "https://media.api-sports.io/football/teams/147.png" },
  { id: 1198, name: "Remo", code: "REM", logo: "https://media.api-sports.io/football/teams/1198.png" },
] as const;

type Team = (typeof teams)[number];

const byName = Object.fromEntries(teams.map((t) => [t.name, t])) as Record<string, Team>;

function fixture(
  id: number,
  home: Team,
  away: Team,
  status: { short: string; elapsed: number | null },
  goals: [number | null, number | null],
  timestamp: number,
  round: string,
  venue: string,
  city = "Brasil"
) {
  return {
    fixture: {
      id,
      timestamp,
      venue: { name: venue, city },
      status: { long: status.short, short: status.short, elapsed: status.elapsed },
    },
    league: { round },
    teams: {
      home: { id: home.id, name: home.name, logo: home.logo },
      away: { id: away.id, name: away.name, logo: away.logo },
    },
    goals: { home: goals[0], away: goals[1] },
    score: {
      halftime: {
        home: goals[0],
        away: goals[1],
      },
      fulltime: {
        home: status.short === "FT" ? goals[0] : null,
        away: status.short === "FT" ? goals[1] : null,
      },
    },
  };
}

export function demoDashboard() {
  // Snapshot aligned with a typical Rodada 20 Sunday slate (demo — not a live feed).
  const fixtures = [
    fixture(
      9001,
      byName.Bahia,
      byName.Corinthians,
      { short: "FT", elapsed: 90 },
      [1, 1],
      tsBrazil(0, 16, 0),
      "Regular Season - 20",
      "Fonte Nova",
      "Salvador"
    ),
    fixture(
      9002,
      byName.Cruzeiro,
      byName.Botafogo,
      { short: "FT", elapsed: 90 },
      [0, 1],
      tsBrazil(0, 16, 0),
      "Regular Season - 20",
      "Mineirão",
      "Belo Horizonte"
    ),
    fixture(
      9003,
      byName.Bragantino,
      byName.Coritiba,
      { short: "2H", elapsed: 68 },
      [0, 0],
      tsBrazil(0, 18, 30),
      "Regular Season - 20",
      "Cícero de Souza Marques",
      "Bragança Paulista"
    ),
    fixture(
      9004,
      byName.Flamengo,
      byName["São Paulo"],
      { short: "2H", elapsed: 67 },
      [0, 0],
      tsBrazil(0, 18, 30),
      "Regular Season - 20",
      "Maracanã",
      "Rio de Janeiro"
    ),
    fixture(
      9005,
      byName.Grêmio,
      byName.Fluminense,
      { short: "2H", elapsed: 66 },
      [0, 0],
      tsBrazil(0, 18, 30),
      "Regular Season - 20",
      "Arena do Grêmio",
      "Porto Alegre"
    ),
    fixture(
      9006,
      byName.Palmeiras,
      byName["Atlético-MG"],
      { short: "1H", elapsed: 22 },
      [0, 0],
      tsBrazil(0, 19, 30),
      "Regular Season - 20",
      "Nubank Parque",
      "São Paulo"
    ),
    fixture(
      9007,
      byName.Remo,
      byName.Vitória,
      { short: "1H", elapsed: 18 },
      [0, 0],
      tsBrazil(0, 19, 30),
      "Regular Season - 20",
      "Mangueirão",
      "Belém"
    ),
    fixture(
      9008,
      byName.Vasco,
      byName.Fortaleza,
      { short: "NS", elapsed: null },
      [null, null],
      tsBrazil(1, 16, 0),
      "Regular Season - 21",
      "São Januário",
      "Rio de Janeiro"
    ),
  ];

  const standings = [
    {
      league: {
        standings: [
          teams.slice(0, 20).map((t, i) => ({
            rank: i + 1,
            team: { id: t.id, name: t.name, logo: t.logo },
            points: 40 - i,
            goalsDiff: 12 - i,
            all: {
              played: 19,
              win: Math.max(0, 12 - Math.floor(i / 2)),
              draw: 3,
              lose: 2 + Math.floor(i / 3),
              goals: { for: 32 - i, against: 18 + Math.floor(i / 2) },
            },
            form: "WWDWL",
            description:
              i < 4
                ? "Copa Libertadores"
                : i < 6
                  ? "Copa Libertadores Qualifiers"
                  : i < 12
                    ? "Copa Sudamericana"
                    : i >= 16
                      ? "Relegation"
                      : null,
          })),
        ],
      },
    },
  ];

  const scorers = [
    {
      player: { id: 1, name: "Pedro", photo: "" },
      statistics: [{ team: byName.Flamengo, goals: { total: 12 }, games: { appearences: 19 } }],
    },
    {
      player: { id: 2, name: "Yuri Alberto", photo: "" },
      statistics: [{ team: byName.Corinthians, goals: { total: 10 }, games: { appearences: 18 } }],
    },
    {
      player: { id: 3, name: "Hulk", photo: "" },
      statistics: [{ team: byName["Atlético-MG"], goals: { total: 9 }, games: { appearences: 17 } }],
    },
    {
      player: { id: 4, name: "Vitor Roque", photo: "" },
      statistics: [{ team: byName.Palmeiras, goals: { total: 8 }, games: { appearences: 16 } }],
    },
    {
      player: { id: 5, name: "Luciano", photo: "" },
      statistics: [{ team: byName["São Paulo"], goals: { total: 7 }, games: { appearences: 19 } }],
    },
  ];

  const assists = [
    {
      player: { id: 10, name: "Arrascaeta", photo: "" },
      statistics: [{ team: byName.Flamengo, goals: { assists: 8 }, games: { appearences: 19 } }],
    },
    {
      player: { id: 11, name: "Estêvão", photo: "" },
      statistics: [{ team: byName.Palmeiras, goals: { assists: 7 }, games: { appearences: 17 } }],
    },
    {
      player: { id: 12, name: "Veiga", photo: "" },
      statistics: [{ team: byName.Palmeiras, goals: { assists: 6 }, games: { appearences: 18 } }],
    },
    {
      player: { id: 13, name: "Gerson", photo: "" },
      statistics: [{ team: byName.Flamengo, goals: { assists: 5 }, games: { appearences: 18 } }],
    },
    {
      player: { id: 14, name: "Neres", photo: "" },
      statistics: [{ team: byName["São Paulo"], goals: { assists: 5 }, games: { appearences: 16 } }],
    },
  ];

  return {
    fixtures,
    standings,
    scorers,
    assists,
    budget: { used: 0, remaining: 100, mode: "live" as const, liveIntervalMs: 120_000 },
    fetchedAt: new Date().toISOString(),
    source: "demo",
  };
}

export function demoMatchDetail(id: number) {
  const dash = demoDashboard();
  const base =
    (dash.fixtures as ReturnType<typeof fixture>[]).find((f) => f.fixture.id === id) ??
    (dash.fixtures as ReturnType<typeof fixture>[])[0];

  return {
    ...base,
    events: [
      {
        time: { elapsed: 12, extra: null },
        team: base.teams.home,
        player: { name: "Jogador A" },
        assist: { name: "Meia" },
        type: "Goal",
        detail: "Normal Goal",
      },
      {
        time: { elapsed: 34, extra: null },
        team: base.teams.away,
        player: { name: "Jogador B" },
        assist: { name: null },
        type: "Card",
        detail: "Yellow Card",
      },
      {
        time: { elapsed: 51, extra: null },
        team: base.teams.away,
        player: { name: "Atacante" },
        assist: { name: "Meia" },
        type: "Goal",
        detail: "Normal Goal",
      },
    ],
    lineups: [
      {
        team: base.teams.home,
        formation: "4-2-3-1",
        coach: { name: "Técnico Casa" },
        startXI: [
          { player: { name: "Goleiro", number: 1, pos: "G", grid: "1:1" } },
          { player: { name: "Lateral D", number: 2, pos: "D", grid: "2:4" } },
          { player: { name: "Zagueiro", number: 3, pos: "D", grid: "2:3" } },
          { player: { name: "Zagueiro", number: 4, pos: "D", grid: "2:2" } },
          { player: { name: "Lateral E", number: 6, pos: "D", grid: "2:1" } },
          { player: { name: "Volante", number: 5, pos: "M", grid: "3:2" } },
          { player: { name: "Volante", number: 8, pos: "M", grid: "3:1" } },
          { player: { name: "Meia", number: 7, pos: "M", grid: "4:3" } },
          { player: { name: "Meia", number: 10, pos: "M", grid: "4:2" } },
          { player: { name: "Ponta", number: 11, pos: "M", grid: "4:1" } },
          { player: { name: "Centroavante", number: 9, pos: "F", grid: "5:1" } },
        ],
        substitutes: [{ player: { name: "Reserva", number: 21, pos: "F", grid: null } }],
      },
      {
        team: base.teams.away,
        formation: "4-3-3",
        coach: { name: "Técnico Fora" },
        startXI: [
          { player: { name: "Goleiro", number: 1, pos: "G", grid: "1:1" } },
          { player: { name: "Lateral D", number: 2, pos: "D", grid: "2:4" } },
          { player: { name: "Zagueiro", number: 3, pos: "D", grid: "2:3" } },
          { player: { name: "Zagueiro", number: 4, pos: "D", grid: "2:2" } },
          { player: { name: "Lateral E", number: 6, pos: "D", grid: "2:1" } },
          { player: { name: "Volante", number: 5, pos: "M", grid: "3:3" } },
          { player: { name: "Meia", number: 8, pos: "M", grid: "3:2" } },
          { player: { name: "Meia", number: 10, pos: "M", grid: "3:1" } },
          { player: { name: "Ponta", number: 7, pos: "F", grid: "4:3" } },
          { player: { name: "Centroavante", number: 9, pos: "F", grid: "4:2" } },
          { player: { name: "Ponta", number: 11, pos: "F", grid: "4:1" } },
        ],
        substitutes: [{ player: { name: "Reserva", number: 19, pos: "F", grid: null } }],
      },
    ],
    statistics: [
      {
        team: base.teams.home,
        statistics: [
          { type: "Ball Possession", value: "54%" },
          { type: "Total Shots", value: 11 },
          { type: "Shots on Goal", value: 4 },
          { type: "Corner Kicks", value: 5 },
          { type: "Fouls", value: 12 },
          { type: "Yellow Cards", value: 2 },
          { type: "Red Cards", value: 0 },
          { type: "Pass Accuracy", value: "84%" },
        ],
      },
      {
        team: base.teams.away,
        statistics: [
          { type: "Ball Possession", value: "46%" },
          { type: "Total Shots", value: 9 },
          { type: "Shots on Goal", value: 3 },
          { type: "Corner Kicks", value: 3 },
          { type: "Fouls", value: 14 },
          { type: "Yellow Cards", value: 3 },
          { type: "Red Cards", value: 0 },
          { type: "Pass Accuracy", value: "81%" },
        ],
      },
    ],
  };
}
