/** Offline/demo payload shaped like API-Football responses so the UI works without a key. */

function ts(daysFromNow: number, hour = 16): number {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

const teams = [
  { id: 127, name: "Flamengo", code: "FLA", logo: "https://media.api-sports.io/football/teams/127.png" },
  { id: 121, name: "Palmeiras", code: "PAL", logo: "https://media.api-sports.io/football/teams/121.png" },
  { id: 131, name: "Corinthians", code: "COR", logo: "https://media.api-sports.io/football/teams/131.png" },
  { id: 124, name: "São Paulo", code: "SAO", logo: "https://media.api-sports.io/football/teams/124.png" },
  { id: 118, name: "Bahia", code: "BAH", logo: "https://media.api-sports.io/football/teams/118.png" },
  { id: 154, name: "Botafogo", code: "BOT", logo: "https://media.api-sports.io/football/teams/154.png" },
  { id: 1062, name: "Atlético-MG", code: "CAM", logo: "https://media.api-sports.io/football/teams/1062.png" },
  { id: 119, name: "Internacional", code: "INT", logo: "https://media.api-sports.io/football/teams/119.png" },
  { id: 135, logo: "https://media.api-sports.io/football/teams/135.png", name: "Cruzeiro", code: "CRU" },
  { id: 120, name: "Grêmio", code: "GRE", logo: "https://media.api-sports.io/football/teams/120.png" },
  { id: 130, name: "Santos", code: "SAN", logo: "https://media.api-sports.io/football/teams/130.png" },
  { id: 133, name: "Vasco", code: "VAS", logo: "https://media.api-sports.io/football/teams/133.png" },
  { id: 125, name: "Fluminense", code: "FLU", logo: "https://media.api-sports.io/football/teams/125.png" },
  { id: 152, name: "Fortaleza", code: "FOR", logo: "https://media.api-sports.io/football/teams/152.png" },
  { id: 129, name: "Bragantino", code: "RBB", logo: "https://media.api-sports.io/football/teams/129.png" },
  { id: 136, name: "Vitória", code: "VIT", logo: "https://media.api-sports.io/football/teams/136.png" },
  { id: 144, name: "Atlético-GO", code: "ACG", logo: "https://media.api-sports.io/football/teams/144.png" },
  { id: 134, name: "Athletico-PR", code: "CAP", logo: "https://media.api-sports.io/football/teams/134.png" },
  { id: 140, name: "Ceará", code: "CEA", logo: "https://media.api-sports.io/football/teams/140.png" },
  { id: 126, name: "Juventude", code: "JUV", logo: "https://media.api-sports.io/football/teams/126.png" },
];

function fixture(
  id: number,
  home: (typeof teams)[number],
  away: (typeof teams)[number],
  status: { short: string; elapsed: number | null },
  goals: [number | null, number | null],
  timestamp: number,
  round: string
) {
  return {
    fixture: {
      id,
      timestamp,
      venue: { name: "Estádio Demo", city: "Brasil" },
      status: { long: status.short, short: status.short, elapsed: status.elapsed },
    },
    league: { round },
    teams: {
      home: { id: home.id, name: home.name, logo: home.logo },
      away: { id: away.id, name: away.name, logo: away.logo },
    },
    goals: { home: goals[0], away: goals[1] },
    score: {
      halftime: { home: goals[0] != null ? Math.floor(goals[0] / 2) : null, away: goals[1] != null ? Math.floor(goals[1] / 2) : null },
      fulltime: { home: status.short === "FT" ? goals[0] : null, away: status.short === "FT" ? goals[1] : null },
    },
  };
}

export function demoDashboard() {
  const fixtures = [
    fixture(9001, teams[0], teams[1], { short: "2H", elapsed: 67 }, [2, 1], ts(0, 16), "Regular Season - 15"),
    fixture(9002, teams[2], teams[3], { short: "1H", elapsed: 28 }, [0, 0], ts(0, 18), "Regular Season - 15"),
    fixture(9003, teams[4], teams[5], { short: "NS", elapsed: null }, [null, null], ts(0, 20), "Regular Season - 15"),
    fixture(9004, teams[6], teams[7], { short: "FT", elapsed: 90 }, [1, 1], ts(-1, 16), "Regular Season - 14"),
    fixture(9005, teams[8], teams[9], { short: "FT", elapsed: 90 }, [3, 0], ts(-1, 18), "Regular Season - 14"),
    fixture(9006, teams[10], teams[11], { short: "NS", elapsed: null }, [null, null], ts(1, 16), "Regular Season - 16"),
    fixture(9007, teams[12], teams[13], { short: "NS", elapsed: null }, [null, null], ts(1, 18), "Regular Season - 16"),
    fixture(9008, teams[14], teams[15], { short: "NS", elapsed: null }, [null, null], ts(2, 16), "Regular Season - 16"),
  ];

  const standings = [
    {
      league: {
        standings: [
          teams.map((t, i) => ({
            rank: i + 1,
            team: { id: t.id, name: t.name, logo: t.logo },
            points: 40 - i,
            goalsDiff: 12 - i,
            all: {
              played: 14,
              win: 10 - Math.floor(i / 2),
              draw: 2,
              lose: 2 + Math.floor(i / 3),
              goals: { for: 28 - i, against: 16 + Math.floor(i / 2) },
            },
            form: "WWDWL",
            description:
              i < 4 ? "Copa Libertadores" : i < 6 ? "Copa Libertadores Qualifiers" : i < 12 ? "Copa Sudamericana" : i >= 16 ? "Relegation" : null,
          })),
        ],
      },
    },
  ];

  const scorers = [
    { player: { id: 1, name: "Pedro", photo: "" }, statistics: [{ team: teams[0], goals: { total: 12 }, games: { appearences: 14 } }] },
    { player: { id: 2, name: "Yuri Alberto", photo: "" }, statistics: [{ team: teams[2], goals: { total: 10 }, games: { appearences: 14 } }] },
    { player: { id: 3, name: "Hulk", photo: "" }, statistics: [{ team: teams[6], goals: { total: 9 }, games: { appearences: 13 } }] },
    { player: { id: 4, name: "Vitor Roque", photo: "" }, statistics: [{ team: teams[1], goals: { total: 8 }, games: { appearences: 12 } }] },
    { player: { id: 5, name: "Luciano", photo: "" }, statistics: [{ team: teams[3], goals: { total: 7 }, games: { appearences: 14 } }] },
  ];

  const assists = [
    { player: { id: 10, name: "Arrascaeta", photo: "" }, statistics: [{ team: teams[0], goals: { assists: 8 }, games: { appearences: 14 } }] },
    { player: { id: 11, name: "Estêvão", photo: "" }, statistics: [{ team: teams[1], goals: { assists: 7 }, games: { appearences: 13 } }] },
    { player: { id: 12, name: "Veiga", photo: "" }, statistics: [{ team: teams[1], goals: { assists: 6 }, games: { appearences: 14 } }] },
    { player: { id: 13, name: "Gerson", photo: "" }, statistics: [{ team: teams[0], goals: { assists: 5 }, games: { appearences: 14 } }] },
    { player: { id: 14, name: "Neres", photo: "" }, statistics: [{ team: teams[3], goals: { assists: 5 }, games: { appearences: 12 } }] },
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
      { time: { elapsed: 12, extra: null }, team: base.teams.home, player: { name: "Pedro" }, assist: { name: "Arrascaeta" }, type: "Goal", detail: "Normal Goal" },
      { time: { elapsed: 34, extra: null }, team: base.teams.away, player: { name: "Veiga" }, assist: { name: null }, type: "Card", detail: "Yellow Card" },
      { time: { elapsed: 51, extra: null }, team: base.teams.away, player: { name: "Rony" }, assist: { name: "Estêvão" }, type: "Goal", detail: "Normal Goal" },
      { time: { elapsed: 63, extra: null }, team: base.teams.home, player: { name: "Bruno Henrique" }, assist: { name: "Gerson" }, type: "Goal", detail: "Normal Goal" },
      { time: { elapsed: 70, extra: null }, team: base.teams.home, player: { name: "Plata" }, assist: { name: "Luiz Araújo" }, type: "subst", detail: "Substitution 1" },
      { time: { elapsed: 78, extra: null }, team: base.teams.away, player: { name: "Flaco López" }, assist: { name: null }, type: "Card", detail: "Red Card" },
    ],
    lineups: [
      {
        team: base.teams.home,
        formation: "4-2-3-1",
        coach: { name: "Filipe Luís" },
        startXI: [
          { player: { name: "Rossi", number: 1, pos: "G", grid: "1:1" } },
          { player: { name: "Varela", number: 2, pos: "D", grid: "2:4" } },
          { player: { name: "Léo Ortiz", number: 3, pos: "D", grid: "2:3" } },
          { player: { name: "Léo Pereira", number: 4, pos: "D", grid: "2:2" } },
          { player: { name: "Ayrton Lucas", number: 6, pos: "D", grid: "2:1" } },
          { player: { name: "Pulgar", number: 5, pos: "M", grid: "3:2" } },
          { player: { name: "De la Cruz", number: 18, pos: "M", grid: "3:1" } },
          { player: { name: "Luiz Araújo", number: 7, pos: "M", grid: "4:3" } },
          { player: { name: "Arrascaeta", number: 14, pos: "M", grid: "4:2" } },
          { player: { name: "Plata", number: 9, pos: "M", grid: "4:1" } },
          { player: { name: "Pedro", number: 21, pos: "F", grid: "5:1" } },
        ],
        substitutes: [
          { player: { name: "Bruno Henrique", number: 27, pos: "F", grid: null } },
          { player: { name: "Gerson", number: 8, pos: "M", grid: null } },
        ],
      },
      {
        team: base.teams.away,
        formation: "4-3-3",
        coach: { name: "Abel Ferreira" },
        startXI: [
          { player: { name: "Weverton", number: 21, pos: "G", grid: "1:1" } },
          { player: { name: "Mayke", number: 12, pos: "D", grid: "2:4" } },
          { player: { name: "Gustavo Gómez", number: 15, pos: "D", grid: "2:3" } },
          { player: { name: "Murilo", number: 26, pos: "D", grid: "2:2" } },
          { player: { name: "Piquerez", number: 22, pos: "D", grid: "2:1" } },
          { player: { name: "Zé Rafael", number: 8, pos: "M", grid: "3:3" } },
          { player: { name: "Aníbal Moreno", number: 5, pos: "M", grid: "3:2" } },
          { player: { name: "Veiga", number: 23, pos: "M", grid: "3:1" } },
          { player: { name: "Estêvão", number: 41, pos: "F", grid: "4:3" } },
          { player: { name: "Rony", number: 10, pos: "F", grid: "4:2" } },
          { player: { name: "Flaco López", number: 42, pos: "F", grid: "4:1" } },
        ],
        substitutes: [{ player: { name: "Felipe Anderson", number: 9, pos: "F", grid: null } }],
      },
    ],
    statistics: [
      {
        team: base.teams.home,
        statistics: [
          { type: "Ball Possession", value: "58%" },
          { type: "Total Shots", value: 14 },
          { type: "Shots on Goal", value: 6 },
          { type: "Corner Kicks", value: 5 },
          { type: "Fouls", value: 11 },
          { type: "Yellow Cards", value: 1 },
          { type: "Red Cards", value: 0 },
          { type: "Pass Accuracy", value: "86%" },
        ],
      },
      {
        team: base.teams.away,
        statistics: [
          { type: "Ball Possession", value: "42%" },
          { type: "Total Shots", value: 9 },
          { type: "Shots on Goal", value: 3 },
          { type: "Corner Kicks", value: 3 },
          { type: "Fouls", value: 14 },
          { type: "Yellow Cards", value: 2 },
          { type: "Red Cards", value: 1 },
          { type: "Pass Accuracy", value: "81%" },
        ],
      },
    ],
  };
}
