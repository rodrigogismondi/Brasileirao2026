/**
 * Seeds public/cache for GitHub Pages demo mode.
 * Keep crest IDs in sync with server/demo-data.ts (verified API-Sports IDs).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function tsToday(hour, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function tsDays(daysFromNow, hour = 16) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

const teams = [
  { id: 127, name: "Flamengo", logo: "https://media.api-sports.io/football/teams/127.png" },
  { id: 121, name: "Palmeiras", logo: "https://media.api-sports.io/football/teams/121.png" },
  { id: 131, name: "Corinthians", logo: "https://media.api-sports.io/football/teams/131.png" },
  { id: 126, name: "São Paulo", logo: "https://media.api-sports.io/football/teams/126.png" },
  { id: 128, name: "Santos", logo: "https://media.api-sports.io/football/teams/128.png" },
  { id: 124, name: "Fluminense", logo: "https://media.api-sports.io/football/teams/124.png" },
  { id: 120, name: "Botafogo", logo: "https://media.api-sports.io/football/teams/120.png" },
  { id: 1062, name: "Atlético-MG", logo: "https://media.api-sports.io/football/teams/1062.png" },
  { id: 135, name: "Cruzeiro", logo: "https://media.api-sports.io/football/teams/135.png" },
  { id: 130, name: "Grêmio", logo: "https://media.api-sports.io/football/teams/130.png" },
  { id: 119, name: "Internacional", logo: "https://media.api-sports.io/football/teams/119.png" },
  { id: 118, name: "Bahia", logo: "https://media.api-sports.io/football/teams/118.png" },
  { id: 154, name: "Fortaleza", logo: "https://media.api-sports.io/football/teams/154.png" },
  { id: 794, name: "Bragantino", logo: "https://media.api-sports.io/football/teams/794.png" },
  { id: 133, name: "Vasco", logo: "https://media.api-sports.io/football/teams/133.png" },
  { id: 136, name: "Vitória", logo: "https://media.api-sports.io/football/teams/136.png" },
  { id: 152, name: "Juventude", logo: "https://media.api-sports.io/football/teams/152.png" },
  { id: 134, name: "Athletico-PR", logo: "https://media.api-sports.io/football/teams/134.png" },
  { id: 129, name: "Ceará", logo: "https://media.api-sports.io/football/teams/129.png" },
  { id: 147, name: "Coritiba", logo: "https://media.api-sports.io/football/teams/147.png" },
];

const byName = Object.fromEntries(teams.map((t) => [t.name, t]));

function fixture(id, home, away, status, goals, timestamp, round, venue, city = "Brasil") {
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
        home: goals[0] != null ? Math.floor(goals[0] / 2) : null,
        away: goals[1] != null ? Math.floor(goals[1] / 2) : null,
      },
      fulltime: {
        home: status.short === "FT" ? goals[0] : null,
        away: status.short === "FT" ? goals[1] : null,
      },
    },
  };
}

const fixtures = [
  fixture(9001, byName.Bragantino, byName.Coritiba, { short: "HT", elapsed: 45 }, [0, 0], tsToday(16, 0), "Regular Season - 20", "Cícero de Souza Marques", "Bragança Paulista"),
  fixture(9002, byName.Flamengo, byName["São Paulo"], { short: "NS", elapsed: null }, [null, null], tsToday(18, 30), "Regular Season - 20", "Maracanã", "Rio de Janeiro"),
  fixture(9003, byName.Grêmio, byName.Fluminense, { short: "NS", elapsed: null }, [null, null], tsToday(18, 30), "Regular Season - 20", "Arena do Grêmio", "Porto Alegre"),
  fixture(9004, byName.Palmeiras, byName["Atlético-MG"], { short: "1H", elapsed: 22 }, [0, 0], tsToday(19, 30), "Regular Season - 20", "Allianz Parque", "São Paulo"),
  fixture(9005, byName.Corinthians, byName.Bahia, { short: "FT", elapsed: 90 }, [2, 1], tsDays(-1, 16), "Regular Season - 19", "Neo Química Arena", "São Paulo"),
  fixture(9006, byName.Botafogo, byName.Santos, { short: "FT", elapsed: 90 }, [1, 0], tsDays(-1, 18), "Regular Season - 19", "Nilton Santos", "Rio de Janeiro"),
  fixture(9007, byName.Cruzeiro, byName.Internacional, { short: "NS", elapsed: null }, [null, null], tsDays(1, 16), "Regular Season - 21", "Mineirão", "Belo Horizonte"),
  fixture(9008, byName.Vasco, byName.Fortaleza, { short: "NS", elapsed: null }, [null, null], tsDays(1, 18), "Regular Season - 21", "São Januário", "Rio de Janeiro"),
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
  { player: { id: 1, name: "Pedro", photo: "" }, statistics: [{ team: byName.Flamengo, goals: { total: 12 }, games: { appearences: 19 } }] },
  { player: { id: 2, name: "Yuri Alberto", photo: "" }, statistics: [{ team: byName.Corinthians, goals: { total: 10 }, games: { appearences: 18 } }] },
  { player: { id: 3, name: "Hulk", photo: "" }, statistics: [{ team: byName["Atlético-MG"], goals: { total: 9 }, games: { appearences: 17 } }] },
  { player: { id: 4, name: "Vitor Roque", photo: "" }, statistics: [{ team: byName.Palmeiras, goals: { total: 8 }, games: { appearences: 16 } }] },
  { player: { id: 5, name: "Luciano", photo: "" }, statistics: [{ team: byName["São Paulo"], goals: { total: 7 }, games: { appearences: 19 } }] },
];

const assists = [
  { player: { id: 10, name: "Arrascaeta", photo: "" }, statistics: [{ team: byName.Flamengo, goals: { assists: 8 }, games: { appearences: 19 } }] },
  { player: { id: 11, name: "Estêvão", photo: "" }, statistics: [{ team: byName.Palmeiras, goals: { assists: 7 }, games: { appearences: 17 } }] },
  { player: { id: 12, name: "Veiga", photo: "" }, statistics: [{ team: byName.Palmeiras, goals: { assists: 6 }, games: { appearences: 18 } }] },
  { player: { id: 13, name: "Gerson", photo: "" }, statistics: [{ team: byName.Flamengo, goals: { assists: 5 }, games: { appearences: 18 } }] },
  { player: { id: 14, name: "Neres", photo: "" }, statistics: [{ team: byName["São Paulo"], goals: { assists: 5 }, games: { appearences: 16 } }] },
];

const payload = {
  fixtures,
  standings,
  scorers,
  assists,
  budget: { used: 0, remaining: 100, mode: "live", liveIntervalMs: 120000 },
  fetchedAt: new Date().toISOString(),
  source: "demo",
};

function matchDetail(base) {
  return {
    ...base,
    events: [
      { time: { elapsed: 12, extra: null }, team: base.teams.home, player: { name: "Jogador A" }, assist: { name: "Meia" }, type: "Goal", detail: "Normal Goal" },
      { time: { elapsed: 34, extra: null }, team: base.teams.away, player: { name: "Jogador B" }, assist: { name: null }, type: "Card", detail: "Yellow Card" },
      { time: { elapsed: 51, extra: null }, team: base.teams.away, player: { name: "Atacante" }, assist: { name: "Meia" }, type: "Goal", detail: "Normal Goal" },
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

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = join(root, "public", "cache");
const matchesDir = join(cacheDir, "matches");
mkdirSync(matchesDir, { recursive: true });
writeFileSync(join(cacheDir, "dashboard.json"), JSON.stringify(payload, null, 2));
for (const f of fixtures) {
  writeFileSync(join(matchesDir, `${f.fixture.id}.json`), JSON.stringify(matchDetail(f), null, 2));
}
console.log("Wrote demo cache +", fixtures.length, "match details");
