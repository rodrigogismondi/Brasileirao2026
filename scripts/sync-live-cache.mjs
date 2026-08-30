/**
 * Sync public/cache from GE Globo's Brasileirão tabela page (no API key).
 * Falls back to demo cache if the scrape fails.
 */
import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const GE_URL = "https://ge.globo.com/futebol/brasileirao-serie-a/";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_DIR = join(ROOT, "public", "cache");
const MATCHES_DIR = join(CACHE_DIR, "matches");

const ZONE_BY_COLOR = {
  "#0000ff": "libertadores",
  "#00ffff": "pre-libertadores",
  "#008040": "sudamericana",
  "#ff0000": "relegation",
};

function extractBalanced(source, startIdx) {
  const open = source[startIdx];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inStr = false;
  let esc = false;
  let quote = null;
  for (let j = startIdx; j < source.length; j++) {
    const c = source[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === quote) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      quote = c;
      continue;
    }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return source.slice(startIdx, j + 1);
    }
  }
  throw new Error("Unbalanced JSON in GE page");
}

function parseGeScript(html) {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const body = scripts.find((s) => s.includes("const classificacao") && s.includes("lista_jogos"));
  if (!body) throw new Error("GE classificacao script not found");

  const marker = "const classificacao";
  const i = body.indexOf(marker);
  const eq = body.indexOf("=", i);
  const start = body.indexOf("{", eq);
  const raw = extractBalanced(body, start);
  return JSON.parse(raw);
}

/** Interpret GE wall-clock `YYYY-MM-DDTHH:mm` as America/Sao_Paulo. */
function tsBrazilLocal(isoLocal) {
  const m = isoLocal.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return Math.floor(Date.now() / 1000);
  const [, y, mo, d, h, mi] = m.map(Number);
  // São Paulo is UTC−3 year-round
  return Math.floor(Date.UTC(y, mo - 1, d, h + 3, mi, 0) / 1000);
}

function formToApi(ultimos) {
  return (ultimos ?? [])
    .map((x) => {
      if (x === "v") return "W";
      if (x === "e") return "D";
      if (x === "d") return "L";
      return "";
    })
    .join("");
}

function mapStatus(jogo) {
  const broadcast = jogo?.transmissao?.broadcast?.id ?? "";
  const hasScore =
    jogo.placar_oficial_mandante != null && jogo.placar_oficial_visitante != null;
  if (broadcast === "ENCERRADA" || (hasScore && broadcast !== "LIVE")) {
    return { short: "FT", elapsed: 90 };
  }
  if (jogo.jogo_ja_comecou && broadcast !== "ENCERRADA") {
    return { short: "2H", elapsed: null };
  }
  // GE marks pre-match coverage as LIVE before kickoff
  if (broadcast === "LIVE" && !hasScore && !jogo.jogo_ja_comecou) {
    return { short: "NS", elapsed: null };
  }
  return { short: "NS", elapsed: null };
}

function mapFixtures(listaJogos, rodadaAtual) {
  return (listaJogos ?? []).map((jogo) => {
    const home = jogo.equipes.mandante;
    const away = jogo.equipes.visitante;
    const status = mapStatus(jogo);
    const ts = tsBrazilLocal(jogo.data_realizacao);
    const dt = new Date(ts * 1000);
    const goalsHome = jogo.placar_oficial_mandante;
    const goalsAway = jogo.placar_oficial_visitante;
    return {
      fixture: {
        id: jogo.id,
        timestamp: ts,
        venue: {
          name: jogo.sede?.nome_popular ?? "",
          city: "",
        },
        status: {
          long: status.short,
          short: status.short,
          elapsed: status.elapsed,
        },
      },
      league: { round: `Regular Season - ${rodadaAtual}` },
      teams: {
        home: {
          id: home.id,
          name: home.nome_popular,
          logo: home.escudo,
        },
        away: {
          id: away.id,
          name: away.nome_popular,
          logo: away.escudo,
        },
      },
      goals: { home: goalsHome, away: goalsAway },
      score: {
        halftime: { home: null, away: null },
        fulltime: {
          home: status.short === "FT" ? goalsHome : null,
          away: status.short === "FT" ? goalsAway : null,
        },
      },
      _geUrl: jogo.transmissao?.url ?? null,
    };
  });
}

function mapStandings(rows) {
  return [
    {
      league: {
        standings: [
          (rows ?? []).map((row) => {
            const color = (row.faixa_classificacao_cor || row.faixa_classificacao?.cor || "")
              .toLowerCase();
            return {
              rank: row.ordem,
              team: {
                id: row.equipe_id,
                name: row.nome_popular,
                logo: row.escudo,
              },
              points: row.pontos,
              goalsDiff: row.saldo_gols,
              form: formToApi(row.ultimos_jogos),
              description:
                color === "#0000ff"
                  ? "Copa Libertadores"
                  : color === "#00ffff"
                    ? "Copa Libertadores Qualifiers"
                    : color === "#008040"
                      ? "Copa Sudamericana"
                      : color === "#ff0000"
                        ? "Relegation"
                        : null,
              all: {
                played: row.jogos,
                win: row.vitorias,
                draw: row.empates,
                lose: row.derrotas,
                goals: { for: row.gols_pro, against: row.gols_contra },
              },
            };
          }),
        ],
      },
    },
  ];
}

function minimalMatchDetail(fixtureRow) {
  const { _geUrl, ...base } = fixtureRow;
  return {
    ...base,
    events: [],
    lineups: [],
    statistics: [],
  };
}

async function fetchGeHtml() {
  const res = await fetch(GE_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`GE HTTP ${res.status}`);
  return await res.text();
}

function writeDemoFallback(reason) {
  console.warn("GE sync failed, falling back to demo cache:", reason);
  const r = spawnSync(process.execPath, [join(ROOT, "scripts", "generate-demo-cache.mjs")], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) process.exit(r.status ?? 1);
}

async function main() {
  try {
    const html = await fetchGeHtml();
    const data = parseGeScript(html);
    const rodada = data.rodada?.atual ?? 0;
    const fixtures = mapFixtures(data.lista_jogos, rodada);
    const standings = mapStandings(data.classificacao);
    const hasLive = fixtures.some((f) => ["1H", "HT", "2H", "LIVE"].includes(f.fixture.status.short));

    const payload = {
      fixtures: fixtures.map(({ _geUrl, ...f }) => f),
      standings,
      scorers: [],
      assists: [],
      budget: {
        used: 0,
        remaining: 100,
        mode: hasLive ? "live" : "idle",
        liveIntervalMs: hasLive ? 90_000 : 15 * 60_000,
      },
      fetchedAt: new Date().toISOString(),
      source: "ge-globo",
      meta: {
        rodada,
        edicao: data.edicao?.nome ?? "Campeonato Brasileiro",
        provider: "ge.globo.com",
      },
    };

    mkdirSync(MATCHES_DIR, { recursive: true });
    for (const name of readdirSync(MATCHES_DIR)) {
      if (name.endsWith(".json")) unlinkSync(join(MATCHES_DIR, name));
    }
    writeFileSync(join(CACHE_DIR, "dashboard.json"), JSON.stringify(payload, null, 2));
    for (const f of fixtures) {
      writeFileSync(
        join(MATCHES_DIR, `${f.fixture.id}.json`),
        JSON.stringify(minimalMatchDetail(f), null, 2)
      );
    }

    console.log(
      `Synced GE cache: rodada ${rodada}, ${fixtures.length} jogos, ${data.classificacao?.length ?? 0} times, source=${payload.source}`
    );
  } catch (err) {
    writeDemoFallback(err instanceof Error ? err.message : String(err));
  }
}

await main();
