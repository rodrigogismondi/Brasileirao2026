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
      [1, 0],
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

type DetailExtras = {
  events: Array<{
    time: { elapsed: number; extra: number | null };
    team: "home" | "away";
    player: { name: string };
    assist: { name: string | null };
    type: string;
    detail: string;
  }>;
  lineups: Array<{
    side: "home" | "away";
    formation: string;
    coach: string;
    startXI: Array<{ name: string; number: number; pos: string; grid: string }>;
    substitutes: Array<{ name: string; number: number; pos: string }>;
  }>;
  statistics: [Array<{ type: string; value: string | number }>, Array<{ type: string; value: string | number }>];
};

function xi(
  rows: Array<[number, string, string, string]>
): Array<{ name: string; number: number; pos: string; grid: string }> {
  return rows.map(([number, name, pos, grid]) => ({ name, number, pos, grid }));
}

/** Per-fixture narrative so match detail is not generic placeholders. */
const MATCH_DETAILS: Record<number, DetailExtras> = {
  // Flamengo 1-0 São Paulo — aligned with a live reference snapshot
  9004: {
    events: [
      {
        time: { elapsed: 56, extra: null },
        team: "home",
        player: { name: "Léo Pereira" },
        assist: { name: null },
        type: "Goal",
        detail: "Normal Goal",
      },
      {
        time: { elapsed: 57, extra: null },
        team: "home",
        player: { name: "Arrascaeta" },
        assist: { name: "Lorran" },
        type: "subst",
        detail: "Substitution 1",
      },
      {
        time: { elapsed: 62, extra: null },
        team: "home",
        player: { name: "Alex Sandro" },
        assist: { name: null },
        type: "Card",
        detail: "Yellow Card",
      },
      {
        time: { elapsed: 65, extra: null },
        team: "away",
        player: { name: "Ferreira" },
        assist: { name: "Artur" },
        type: "subst",
        detail: "Substitution 1",
      },
      {
        time: { elapsed: 65, extra: null },
        team: "away",
        player: { name: "Victor Sá" },
        assist: { name: "Danielzinho" },
        type: "subst",
        detail: "Substitution 2",
      },
    ],
    lineups: [
      {
        side: "home",
        formation: "4-2-3-1",
        coach: "Filipe Luís",
        startXI: xi([
          [1, "Rossi", "G", "1:1"],
          [2, "Varela", "D", "2:4"],
          [3, "Léo Ortiz", "D", "2:3"],
          [4, "Léo Pereira", "D", "2:2"],
          [26, "Alex Sandro", "D", "2:1"],
          [5, "Pulgar", "M", "3:2"],
          [18, "De la Cruz", "M", "3:1"],
          [7, "Luiz Araújo", "M", "4:3"],
          [19, "Lorran", "M", "4:2"],
          [9, "Plata", "M", "4:1"],
          [21, "Pedro", "F", "5:1"],
        ]),
        substitutes: [
          { name: "Arrascaeta", number: 14, pos: "M" },
          { name: "Bruno Henrique", number: 27, pos: "F" },
          { name: "Gerson", number: 8, pos: "M" },
          { name: "Danilo", number: 13, pos: "D" },
        ],
      },
      {
        side: "away",
        formation: "4-3-3",
        coach: "Hernán Crespo",
        startXI: xi([
          [23, "Rafael", "G", "1:1"],
          [2, "Igor Vinícius", "D", "2:4"],
          [5, "Arboleda", "D", "2:3"],
          [28, "Alan Franco", "D", "2:2"],
          [13, "Rafinha", "D", "2:1"],
          [25, "Alisson", "M", "3:3"],
          [21, "Bobadilla", "M", "3:2"],
          [18, "Danielzinho", "M", "3:1"],
          [17, "Artur", "F", "4:3"],
          [10, "Luciano", "F", "4:2"],
          [9, "Calleri", "F", "4:1"],
        ]),
        substitutes: [
          { name: "Ferreira", number: 11, pos: "F" },
          { name: "Victor Sá", number: 7, pos: "F" },
          { name: "Pablo Maia", number: 29, pos: "M" },
          { name: "Wellington Rato", number: 27, pos: "M" },
        ],
      },
    ],
    statistics: [
      [
        { type: "Ball Possession", value: "58%" },
        { type: "Total Shots", value: 14 },
        { type: "Shots on Goal", value: 5 },
        { type: "Corner Kicks", value: 6 },
        { type: "Fouls", value: 11 },
        { type: "Yellow Cards", value: 1 },
        { type: "Red Cards", value: 0 },
        { type: "Pass Accuracy", value: "87%" },
      ],
      [
        { type: "Ball Possession", value: "42%" },
        { type: "Total Shots", value: 8 },
        { type: "Shots on Goal", value: 2 },
        { type: "Corner Kicks", value: 3 },
        { type: "Fouls", value: 13 },
        { type: "Yellow Cards", value: 2 },
        { type: "Red Cards", value: 0 },
        { type: "Pass Accuracy", value: "81%" },
      ],
    ],
  },
  9001: {
    events: [
      {
        time: { elapsed: 23, extra: null },
        team: "home",
        player: { name: "Everaldo" },
        assist: { name: "Everton Ribeiro" },
        type: "Goal",
        detail: "Normal Goal",
      },
      {
        time: { elapsed: 41, extra: null },
        team: "away",
        player: { name: "Yuri Alberto" },
        assist: { name: "Garro" },
        type: "Goal",
        detail: "Normal Goal",
      },
      {
        time: { elapsed: 68, extra: null },
        team: "away",
        player: { name: "Raniele" },
        assist: { name: null },
        type: "Card",
        detail: "Yellow Card",
      },
    ],
    lineups: [
      {
        side: "home",
        formation: "4-3-3",
        coach: "Rogério Ceni",
        startXI: xi([
          [22, "Marcos Felipe", "G", "1:1"],
          [2, "Gilberto", "D", "2:4"],
          [3, "Gabriel Xavier", "D", "2:3"],
          [4, "Kanu", "D", "2:2"],
          [6, "Luciano Juba", "D", "2:1"],
          [5, "Cauly", "M", "3:3"],
          [8, "Jean Lucas", "M", "3:2"],
          [10, "Everton Ribeiro", "M", "3:1"],
          [7, "Ademir", "F", "4:3"],
          [9, "Everaldo", "F", "4:2"],
          [11, "Biel", "F", "4:1"],
        ]),
        substitutes: [
          { name: "Thaciano", number: 16, pos: "M" },
          { name: "Rafael Ratão", number: 19, pos: "F" },
        ],
      },
      {
        side: "away",
        formation: "4-2-3-1",
        coach: "Dorival Júnior",
        startXI: xi([
          [1, "Hugo Souza", "G", "1:1"],
          [2, "Fagner", "D", "2:4"],
          [3, "Félix Torres", "D", "2:3"],
          [5, "Cacá", "D", "2:2"],
          [21, "Matheuzinho", "D", "2:1"],
          [14, "Raniele", "M", "3:2"],
          [8, "Charles", "M", "3:1"],
          [10, "Garro", "M", "4:3"],
          [11, "Romero", "M", "4:2"],
          [27, "Breno Bidon", "M", "4:1"],
          [9, "Yuri Alberto", "F", "5:1"],
        ]),
        substitutes: [
          { name: "Memphis Depay", number: 10, pos: "F" },
          { name: "Coronado", number: 77, pos: "M" },
        ],
      },
    ],
    statistics: [
      [
        { type: "Ball Possession", value: "49%" },
        { type: "Total Shots", value: 12 },
        { type: "Shots on Goal", value: 4 },
        { type: "Corner Kicks", value: 5 },
        { type: "Fouls", value: 14 },
        { type: "Yellow Cards", value: 2 },
        { type: "Red Cards", value: 0 },
        { type: "Pass Accuracy", value: "83%" },
      ],
      [
        { type: "Ball Possession", value: "51%" },
        { type: "Total Shots", value: 11 },
        { type: "Shots on Goal", value: 5 },
        { type: "Corner Kicks", value: 4 },
        { type: "Fouls", value: 12 },
        { type: "Yellow Cards", value: 3 },
        { type: "Red Cards", value: 0 },
        { type: "Pass Accuracy", value: "85%" },
      ],
    ],
  },
  9002: {
    events: [
      {
        time: { elapsed: 74, extra: null },
        team: "away",
        player: { name: "Savarino" },
        assist: { name: "Marlon Freitas" },
        type: "Goal",
        detail: "Normal Goal",
      },
      {
        time: { elapsed: 88, extra: null },
        team: "home",
        player: { name: "Lucas Silva" },
        assist: { name: null },
        type: "Card",
        detail: "Yellow Card",
      },
    ],
    lineups: [
      {
        side: "home",
        formation: "4-2-3-1",
        coach: "Leonardo Jardim",
        startXI: xi([
          [1, "Cássio", "G", "1:1"],
          [12, "William", "D", "2:4"],
          [15, "Fabrício Bruno", "D", "2:3"],
          [25, "Lucas Villalba", "D", "2:2"],
          [6, "Kaiki", "D", "2:1"],
          [16, "Lucas Silva", "M", "3:2"],
          [29, "Lucas Romero", "M", "3:1"],
          [10, "Matheus Pereira", "M", "4:3"],
          [97, "Dinenno", "M", "4:2"],
          [11, "Christian", "M", "4:1"],
          [19, "Kaio Jorge", "F", "5:1"],
        ]),
        substitutes: [
          { name: "Gabigol", number: 9, pos: "F" },
          { name: "Dudu", number: 7, pos: "F" },
        ],
      },
      {
        side: "away",
        formation: "4-2-3-1",
        coach: "Renato Paiva",
        startXI: xi([
          [12, "John", "G", "1:1"],
          [2, "Vitinho", "D", "2:4"],
          [3, "Bastos", "D", "2:3"],
          [20, "Alexander Barboza", "D", "2:2"],
          [21, "Marçal", "D", "2:1"],
          [17, "Marlon Freitas", "M", "3:2"],
          [5, "Danilo Barbosa", "M", "3:1"],
          [10, "Savarino", "M", "4:3"],
          [7, "Luiz Henrique", "M", "4:2"],
          [11, "Jeffinho", "M", "4:1"],
          [9, "Tiquinho Soares", "F", "5:1"],
        ]),
        substitutes: [
          { name: "Júnior Santos", number: 37, pos: "F" },
          { name: "Gregore", number: 26, pos: "M" },
        ],
      },
    ],
    statistics: [
      [
        { type: "Ball Possession", value: "57%" },
        { type: "Total Shots", value: 15 },
        { type: "Shots on Goal", value: 4 },
        { type: "Corner Kicks", value: 7 },
        { type: "Fouls", value: 10 },
        { type: "Yellow Cards", value: 2 },
        { type: "Red Cards", value: 0 },
        { type: "Pass Accuracy", value: "86%" },
      ],
      [
        { type: "Ball Possession", value: "43%" },
        { type: "Total Shots", value: 9 },
        { type: "Shots on Goal", value: 3 },
        { type: "Corner Kicks", value: 2 },
        { type: "Fouls", value: 15 },
        { type: "Yellow Cards", value: 3 },
        { type: "Red Cards", value: 0 },
        { type: "Pass Accuracy", value: "79%" },
      ],
    ],
  },
};

const TEAM_SQUADS: Record<
  string,
  {
    coach: string;
    formation: string;
    xi: Array<[number, string, string, string]>;
    bench: Array<{ name: string; number: number; pos: string }>;
  }
> = {
  Bragantino: {
    coach: "Fernando Seabra",
    formation: "4-2-3-1",
    xi: [
      [1, "Cleiton", "G", "1:1"],
      [2, "Nathan Mendes", "D", "2:4"],
      [3, "Pedro Henrique", "D", "2:3"],
      [4, "Luan Cândido", "D", "2:2"],
      [6, "Juninho Capixaba", "D", "2:1"],
      [5, "Jadsom", "M", "3:2"],
      [8, "Eric Ramires", "M", "3:1"],
      [7, "Helinho", "M", "4:3"],
      [10, "Lincoln", "M", "4:2"],
      [11, "Vitinho", "M", "4:1"],
      [9, "Eduardo Sasha", "F", "5:1"],
    ],
    bench: [
      { name: "Borbas", number: 18, pos: "F" },
      { name: "Lucas Evangelista", number: 16, pos: "M" },
    ],
  },
  Coritiba: {
    coach: "Mozart",
    formation: "4-3-3",
    xi: [
      [1, "Pedro Morisco", "G", "1:1"],
      [2, "Natanael", "D", "2:4"],
      [3, "Bruno Viana", "D", "2:3"],
      [4, "Marcio Silva", "D", "2:2"],
      [6, "Jamerson", "D", "2:1"],
      [5, "Sebastian Gomez", "M", "3:3"],
      [8, "Matheus Bianqui", "M", "3:2"],
      [10, "Josué", "M", "3:1"],
      [7, "Robson", "F", "4:3"],
      [9, "Alejo Véliz", "F", "4:2"],
      [11, "Brandão", "F", "4:1"],
    ],
    bench: [
      { name: "Figueiredo", number: 19, pos: "F" },
      { name: "Filipe Machado", number: 15, pos: "M" },
    ],
  },
  Grêmio: {
    coach: "Gustavo Quinteros",
    formation: "4-2-3-1",
    xi: [
      [1, "Tiago Volpi", "G", "1:1"],
      [2, "João Pedro", "D", "2:4"],
      [3, "Kannemann", "D", "2:3"],
      [4, "Rodrigo Ely", "D", "2:2"],
      [6, "Reinaldo", "D", "2:1"],
      [5, "Villasanti", "M", "3:2"],
      [8, "Dodi", "M", "3:1"],
      [7, "Edenilson", "M", "4:3"],
      [10, "Cristaldo", "M", "4:2"],
      [11, "Pavón", "M", "4:1"],
      [9, "Braithwaite", "F", "5:1"],
    ],
    bench: [
      { name: "Soteldo", number: 7, pos: "M" },
      { name: "Arezo", number: 19, pos: "F" },
    ],
  },
  Fluminense: {
    coach: "Mano Menezes",
    formation: "4-2-3-1",
    xi: [
      [1, "Fábio", "G", "1:1"],
      [2, "Samuel Xavier", "D", "2:4"],
      [3, "Thiago Silva", "D", "2:3"],
      [4, "Ignácio", "D", "2:2"],
      [6, "Guga", "D", "2:1"],
      [5, "André", "M", "3:2"],
      [8, "Martinelli", "M", "3:1"],
      [7, "Arias", "M", "4:3"],
      [10, "Ganso", "M", "4:2"],
      [11, "Keno", "M", "4:1"],
      [14, "Cano", "F", "5:1"],
    ],
    bench: [
      { name: "Serna", number: 19, pos: "F" },
      { name: "Nonato", number: 16, pos: "M" },
    ],
  },
  Palmeiras: {
    coach: "Abel Ferreira",
    formation: "4-2-3-1",
    xi: [
      [21, "Weverton", "G", "1:1"],
      [12, "Mayke", "D", "2:4"],
      [15, "Gustavo Gómez", "D", "2:3"],
      [26, "Murilo", "D", "2:2"],
      [22, "Piquerez", "D", "2:1"],
      [5, "Aníbal Moreno", "M", "3:2"],
      [8, "Zé Rafael", "M", "3:1"],
      [41, "Estêvão", "M", "4:3"],
      [23, "Veiga", "M", "4:2"],
      [10, "Rony", "M", "4:1"],
      [9, "Vitor Roque", "F", "5:1"],
    ],
    bench: [
      { name: "Flaco López", number: 42, pos: "F" },
      { name: "Felipe Anderson", number: 18, pos: "M" },
    ],
  },
  "Atlético-MG": {
    coach: "Cuca",
    formation: "4-2-3-1",
    xi: [
      [22, "Everson", "G", "1:1"],
      [2, "Saravia", "D", "2:4"],
      [3, "Lyanco", "D", "2:3"],
      [4, "Júnior Alonso", "D", "2:2"],
      [6, "Guilherme Arana", "D", "2:1"],
      [5, "Alan Franco", "M", "3:2"],
      [8, "Gustavo Scarpa", "M", "3:1"],
      [7, "Bernard", "M", "4:3"],
      [10, "Zaracho", "M", "4:2"],
      [11, "Paulinho", "M", "4:1"],
      [9, "Hulk", "F", "5:1"],
    ],
    bench: [
      { name: "Deyverson", number: 19, pos: "F" },
      { name: "Fausto Vera", number: 18, pos: "M" },
    ],
  },
  Remo: {
    coach: "Marcelo Cabo",
    formation: "4-3-3",
    xi: [
      [1, "Marcelo Rangel", "G", "1:1"],
      [2, "Nathan", "D", "2:4"],
      [3, "Raimar", "D", "2:3"],
      [4, "Fabiano", "D", "2:2"],
      [6, "Luan Martins", "D", "2:1"],
      [5, "Paulinho Curuá", "M", "3:3"],
      [8, "Giovanni Augusto", "M", "3:2"],
      [10, "Jáderson", "M", "3:1"],
      [7, "Pedro Rocha", "F", "4:3"],
      [9, "Muriqui", "F", "4:2"],
      [11, "Ribamar", "F", "4:1"],
    ],
    bench: [
      { name: "Sávio", number: 19, pos: "F" },
      { name: "Ronald", number: 16, pos: "M" },
    ],
  },
  Vitória: {
    coach: "Thiago Carpini",
    formation: "4-2-3-1",
    xi: [
      [1, "Lucas Arcanjo", "G", "1:1"],
      [2, "Willean Lepo", "D", "2:4"],
      [3, "Camutanga", "D", "2:3"],
      [4, "Wagner Leonardo", "D", "2:2"],
      [6, "Lucas Esteves", "D", "2:1"],
      [5, "Willian Oliveira", "M", "3:2"],
      [8, "Luan Santos", "M", "3:1"],
      [7, "Matheuzinho", "M", "4:3"],
      [10, "Jáderson", "M", "4:2"],
      [11, "Osvaldo", "M", "4:1"],
      [9, "Alerrandro", "F", "5:1"],
    ],
    bench: [
      { name: "Everaldo", number: 19, pos: "F" },
      { name: "Filipe Machado", number: 16, pos: "M" },
    ],
  },
  Vasco: {
    coach: "Fábio Carille",
    formation: "4-2-3-1",
    xi: [
      [1, "Léo Jardim", "G", "1:1"],
      [2, "Puma Rodríguez", "D", "2:4"],
      [3, "Maicon", "D", "2:3"],
      [4, "Léo", "D", "2:2"],
      [6, "Lucas Piton", "D", "2:1"],
      [5, "Hugo Moura", "M", "3:2"],
      [8, "Juan Sforza", "M", "3:1"],
      [10, "Payet", "M", "4:3"],
      [11, "David", "M", "4:2"],
      [7, "Adson", "M", "4:1"],
      [99, "Vegetti", "F", "5:1"],
    ],
    bench: [
      { name: "Praxedes", number: 21, pos: "M" },
      { name: "Alex Teixeira", number: 9, pos: "F" },
    ],
  },
  Fortaleza: {
    coach: "Juan Pablo Vojvoda",
    formation: "3-4-3",
    xi: [
      [1, "João Ricardo", "G", "1:1"],
      [2, "Tingaa", "D", "2:4"],
      [3, "Brítez", "D", "2:3"],
      [4, "Benevenuto", "D", "2:2"],
      [6, "Bruno Pacheco", "D", "2:1"],
      [5, "Zé Welison", "M", "3:2"],
      [8, "Hércules", "M", "3:1"],
      [7, "Pochettino", "M", "4:3"],
      [10, "Moises", "M", "4:2"],
      [11, "Marinho", "M", "4:1"],
      [9, "Lucero", "F", "5:1"],
    ],
    bench: [
      { name: "Yago Pikachu", number: 22, pos: "M" },
      { name: "Juan Martín Lucero", number: 19, pos: "F" },
    ],
  },
};

function defaultDetail(homeName: string, awayName: string): DetailExtras {
  const home = TEAM_SQUADS[homeName];
  const away = TEAM_SQUADS[awayName];
  const hAttack = home?.xi[10]?.[1] ?? "Atacante";
  const aMid = away?.xi[7]?.[1] ?? "Meia";
  const aAttack = away?.xi[9]?.[1] ?? "Atacante";

  return {
    events: [
      {
        time: { elapsed: 28, extra: null },
        team: "home",
        player: { name: hAttack },
        assist: { name: null },
        type: "Card",
        detail: "Yellow Card",
      },
      {
        time: { elapsed: 61, extra: null },
        team: "away",
        player: { name: aAttack },
        assist: { name: aMid },
        type: "subst",
        detail: "Substitution 1",
      },
    ],
    lineups: [
      {
        side: "home",
        formation: home?.formation ?? "4-2-3-1",
        coach: home?.coach ?? "Técnico",
        startXI: xi(home?.xi ?? [[1, "Goleiro", "G", "1:1"]]),
        substitutes: home?.bench ?? [{ name: "Reserva", number: 21, pos: "F" }],
      },
      {
        side: "away",
        formation: away?.formation ?? "4-3-3",
        coach: away?.coach ?? "Técnico",
        startXI: xi(away?.xi ?? [[1, "Goleiro", "G", "1:1"]]),
        substitutes: away?.bench ?? [{ name: "Reserva", number: 19, pos: "F" }],
      },
    ],
    statistics: [
      [
        { type: "Ball Possession", value: "52%" },
        { type: "Total Shots", value: 10 },
        { type: "Shots on Goal", value: 3 },
        { type: "Corner Kicks", value: 4 },
        { type: "Fouls", value: 12 },
        { type: "Yellow Cards", value: 2 },
        { type: "Red Cards", value: 0 },
        { type: "Pass Accuracy", value: "84%" },
      ],
      [
        { type: "Ball Possession", value: "48%" },
        { type: "Total Shots", value: 9 },
        { type: "Shots on Goal", value: 2 },
        { type: "Corner Kicks", value: 3 },
        { type: "Fouls", value: 13 },
        { type: "Yellow Cards", value: 2 },
        { type: "Red Cards", value: 0 },
        { type: "Pass Accuracy", value: "82%" },
      ],
    ],
  };
}

export function demoMatchDetail(id: number) {
  const dash = demoDashboard();
  const base =
    (dash.fixtures as ReturnType<typeof fixture>[]).find((f) => f.fixture.id === id) ??
    (dash.fixtures as ReturnType<typeof fixture>[])[0];

  const extras = MATCH_DETAILS[base.fixture.id] ?? defaultDetail(base.teams.home.name, base.teams.away.name);

  return {
    ...base,
    events: extras.events.map((e) => ({
      ...e,
      team: e.team === "home" ? base.teams.home : base.teams.away,
      assist: e.assist.name != null ? { name: e.assist.name } : null,
    })),
    lineups: extras.lineups.map((l) => {
      const team = l.side === "home" ? base.teams.home : base.teams.away;
      return {
        team,
        formation: l.formation,
        coach: { name: l.coach },
        startXI: l.startXI.map((p) => ({
          player: { name: p.name, number: p.number, pos: p.pos, grid: p.grid },
        })),
        substitutes: l.substitutes.map((p) => ({
          player: { name: p.name, number: p.number, pos: p.pos, grid: null },
        })),
      };
    }),
    statistics: [
      { team: base.teams.home, statistics: extras.statistics[0] },
      { team: base.teams.away, statistics: extras.statistics[1] },
    ],
  };
}
