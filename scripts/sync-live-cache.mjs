/**
 * Sync public/cache from GE Globo's Brasileirão tabela + match transmission pages.
 * Falls back to demo cache if the tabela scrape fails.
 */
import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import vm from "node:vm";

const GE_URL = "https://ge.globo.com/futebol/brasileirao-serie-a/";
const BETEXPLORER_FIXTURES =
  "https://www.betexplorer.com/football/brazil/serie-a-betano/fixtures/";
const BETEXPLORER_RESULTS =
  "https://www.betexplorer.com/football/brazil/serie-a-betano/results/";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_DIR = join(ROOT, "public", "cache");
const MATCHES_DIR = join(CACHE_DIR, "matches");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const FETCH_HEADERS = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
};

const STAT_MAP = [
  ["ballPossession", "Ball Possession", (n) => `${n}%`],
  ["goalFinish", "Total Shots", (n) => n],
  ["wrongFinish", "Shots off Goal", (n) => n],
  ["blockedFinish", "Blocked Shots", (n) => n],
  ["cornerKick", "Corner Kicks", (n) => n],
  ["foulMade", "Fouls", (n) => n],
  ["offSide", "Offsides", (n) => n],
  ["defense", "Goalkeeper Saves", (n) => n],
  ["yellowCardReceived", "Yellow Cards", (n) => n],
  ["redCardReceived", "Red Cards", (n) => n],
];

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

function parseTrv2(html) {
  const marker = html.indexOf("window.trv2");
  if (marker < 0) throw new Error("window.trv2 not found");
  const eq = html.indexOf("=", marker);
  const start = html.indexOf("{", eq);
  const raw = extractBalanced(html, start);
  return vm.runInNewContext("(" + raw + ")", Object.create(null), { timeout: 8000 });
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
  if (broadcast === "ENCERRADA") {
    return { short: "FT", elapsed: 90 };
  }
  // Finished with official score but broadcast lagging
  if (hasScore && broadcast && broadcast !== "LIVE" && !jogo.jogo_ja_comecou) {
    return { short: "FT", elapsed: 90 };
  }
  if (jogo.jogo_ja_comecou || (broadcast === "LIVE" && hasScore)) {
    // Period refined later from transmission page
    return { short: "1H", elapsed: null };
  }
  // GE often marks pre-match coverage as LIVE before kickoff
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
    sportsFieldUrl: null,
  };
}

function momentToElapsed(moment, periodAbbr) {
  const [mmRaw] = String(moment || "0:0").split(":");
  const mm = Number(mmRaw) || 0;
  const abbr = String(periodAbbr || "").toUpperCase();
  if (abbr === "2T" || abbr.includes("SEGUNDO")) return 45 + mm;
  if (abbr === "1T" || abbr.includes("PRIMEIRO")) return mm;
  if (abbr === "PR" || abbr.includes("PRORROGA")) return 90 + mm;
  return mm;
}

function mapPos(position) {
  const initials = String(position?.initials || "").toUpperCase();
  const desc = String(position?.description || "").toLowerCase();
  if (initials === "GOL" || desc.includes("goleiro")) return "Gol";
  if (
    ["LAD", "LAE", "ZAD", "ZAE", "ZAG"].includes(initials) ||
    desc.includes("zagueiro") ||
    desc.includes("lateral") ||
    desc.includes("defesa")
  ) {
    return "Def";
  }
  if (
    ["VOL", "MEC", "MEI"].includes(initials) ||
    desc.includes("volante") ||
    desc.includes("meio")
  ) {
    return "Mei";
  }
  if (initials === "ATA" || desc.includes("atacante") || desc.includes("ponteiro")) return "Ata";
  return "Mei";
}

function mapPlayer(p) {
  const num = p?.shirtNumber != null && p.shirtNumber !== "" ? Number(p.shirtNumber) : null;
  return {
    player: {
      id: p?.slug ?? null,
      name: p?.popularName || p?.name || "?",
      number: Number.isFinite(num) ? num : null,
      pos: mapPos(p?.position),
      grid: null,
    },
  };
}

function mapSquadSide(side, teamMeta) {
  if (!side?.lineUp?.length) return null;
  return {
    team: { id: teamMeta.id, name: teamMeta.name, logo: teamMeta.logo },
    formation: side.formation || null,
    coach: {
      name: side.coach?.popularName || side.coach?.name || "—",
    },
    startXI: side.lineUp.map(mapPlayer),
    substitutes: (side.bench ?? []).map(mapPlayer),
  };
}

function goalDetail(kind) {
  const k = String(kind || "").toUpperCase();
  if (k.includes("PENALTY") || k.includes("PENALTI") || k.includes("PÊNALTI")) return "Penalty";
  if (k.includes("OWN")) return "Own Goal";
  return "Normal Goal";
}

function cardDetail(kind) {
  const k = String(kind || "").toUpperCase();
  if (k.includes("RED") && k.includes("YELLOW")) return "Second Yellow Card";
  if (k.includes("RED")) return "Red Card";
  return "Yellow Card";
}

function mapEvents(plays, homeId, awayId, homeName, awayName) {
  const events = [];
  for (const play of plays ?? []) {
    const typeId = play?.playType?.id;
    if (!typeId || !["GOAL", "CARD", "SUBSTITUTION"].includes(typeId)) continue;
    const details = play.details ?? {};
    const teamId = details.team?.id ?? play.team?.id;
    if (teamId == null) continue;
    const teamName =
      teamId === homeId ? homeName : teamId === awayId ? awayName : details.team?.abbreviation || "";
    const elapsed = momentToElapsed(play.moment, play.period?.abbreviation || play.period?.id);
    const base = {
      time: { elapsed, extra: null },
      team: { id: teamId, name: teamName },
    };

    if (typeId === "GOAL") {
      events.push({
        ...base,
        type: "Goal",
        detail: goalDetail(details.kind),
        player: { name: details.athlete?.popularName || details.athlete?.name || "?" },
        assist: details.assist
          ? { name: details.assist.popularName || details.assist.name }
          : null,
      });
    } else if (typeId === "CARD") {
      events.push({
        ...base,
        type: "Card",
        detail: cardDetail(details.kind),
        player: { name: details.athlete?.popularName || details.athlete?.name || "?" },
        assist: null,
      });
    } else if (typeId === "SUBSTITUTION") {
      events.push({
        ...base,
        type: "subst",
        detail: "Substitution 1",
        player: {
          name: details.comingIn?.popularName || details.comingIn?.name || "?",
        },
        assist: {
          name: details.leaving?.popularName || details.leaving?.name || "?",
        },
      });
    }
  }
  return events.sort((a, b) => (a.time.elapsed ?? 0) - (b.time.elapsed ?? 0));
}

function mapStatistics(stats, home, away) {
  if (!stats?.homeTeam && !stats?.awayTeam) return [];
  const homeSide = stats.homeTeam ?? {};
  const awaySide = stats.awayTeam ?? {};
  const homeRows = [];
  const awayRows = [];
  for (const [key, label, fmt] of STAT_MAP) {
    const hv = homeSide[key]?.total;
    const av = awaySide[key]?.total;
    if (hv == null && av == null) continue;
    homeRows.push({ type: label, value: fmt(hv ?? 0) });
    awayRows.push({ type: label, value: fmt(av ?? 0) });
  }
  const homePass = homeSide.totalPasses?.total;
  const awayPass = awaySide.totalPasses?.total;
  const homeRight = homeSide.rightPasses?.total;
  const awayRight = awaySide.rightPasses?.total;
  if (homePass || awayPass) {
    const hAcc =
      homePass > 0 ? Math.round(((homeRight ?? 0) / homePass) * 100) : 0;
    const aAcc =
      awayPass > 0 ? Math.round(((awayRight ?? 0) / awayPass) * 100) : 0;
    homeRows.push({ type: "Pass Accuracy", value: `${hAcc}%` });
    awayRows.push({ type: "Pass Accuracy", value: `${aAcc}%` });
  }
  return [
    { team: { id: home.id, name: home.name }, statistics: homeRows },
    { team: { id: away.id, name: away.name }, statistics: awayRows },
  ];
}

function shouldEnrich(fixtureRow) {
  // Current rodada is ~10 matches; enrich all with a GE page so pre-match
  // lineups appear as soon as GE publishes them (not only after kickoff).
  return Boolean(fixtureRow._geUrl);
}

async function fetchHtml(url, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function statusFromPeriod(periodAbbr, fallback) {
  const p = String(periodAbbr || "");
  if (/ENCERR|POS_JOGO/i.test(p)) return { long: "FT", short: "FT", elapsed: 90 };
  if (/INTERVALO|^HT$/i.test(p)) return { long: "HT", short: "HT", elapsed: 45 };
  if (/1T|PRIMEIRO/i.test(p)) return { long: "1H", short: "1H", elapsed: null };
  if (/2T|SEGUNDO/i.test(p)) return { long: "2H", short: "2H", elapsed: null };
  if (/PRORROGA|PENALT/i.test(p)) return { long: "ET", short: "ET", elapsed: null };
  return fallback;
}

function periodIndicatesInPlay(periodAbbr) {
  const p = String(periodAbbr || "");
  return /1T|2T|HT|ET|BT|PR|INTERVALO|PRIMEIRO|SEGUNDO|PRORROGA|PENALT/i.test(p);
}

/**
 * GE's `currentTime` is often stuck at "00:00". The real clock is
 * `timerStart` (period kickoff ISO) + `timerStatus: INICIADO`.
 * For 2T/ET, timerStart resets at that period's start.
 */
function elapsedFromTransmissionClock(transmission, periodAbbr, now = Date.now()) {
  const period = String(
    periodAbbr ||
      transmission?.period?.abbreviation ||
      transmission?.period?.id ||
      ""
  );
  if (/INTERVALO|^HT$/i.test(period)) {
    return { elapsed: 45, fromTimer: false };
  }

  const timerStatus = String(transmission?.timerStatus || "").toUpperCase();
  const timerStart = transmission?.timerStart;

  if (timerStatus === "INICIADO" && timerStart) {
    const startMs = Date.parse(timerStart);
    if (Number.isFinite(startMs)) {
      let mins = Math.floor((now - startMs) / 60000);
      if (mins < 0) mins = 0;
      if (mins > 130) mins = 130;
      if (/2T|SEGUNDO/i.test(period)) mins = 45 + mins;
      else if (/PRORROGA|^PR$|PR_/i.test(period)) mins = 90 + mins;
      return { elapsed: mins, fromTimer: true };
    }
  }

  // Rare: GE currentTime actually advancing (mm:ss)
  const ct = String(transmission?.currentTime || "");
  const m = ct.match(/^(\d{1,3}):(\d{2})$/);
  if (m) {
    const mm = Number(m[1]);
    const ss = Number(m[2]);
    if (mm > 0 || ss > 0) {
      let mins = mm + (ss >= 30 ? 1 : 0);
      if (/2T|SEGUNDO/i.test(period)) mins = 45 + Number(m[1]);
      else if (/PRORROGA|^PR$|PR_/i.test(period)) mins = 90 + Number(m[1]);
      return { elapsed: mins, fromTimer: false };
    }
  }

  return null;
}

async function enrichFromTransmission(fixtureRow) {
  const url = fixtureRow._geUrl;
  const html = await fetchHtml(url);
  const trv2 = parseTrv2(html);
  const match = trv2.transmission?.match ?? {};
  const home = fixtureRow.teams.home;
  const away = fixtureRow.teams.away;
  const events = mapEvents(trv2.plays, home.id, away.id, home.name, away.name);
  const homeLineup = mapSquadSide(match.squads?.homeTeam, home);
  const awayLineup = mapSquadSide(match.squads?.awayTeam, away);
  const lineups = [homeLineup, awayLineup].filter(Boolean);
  const statistics = mapStatistics(trv2.statistics, home, away);

  const periodAbbr =
    match.period?.abbreviation ||
    match.period?.id ||
    trv2.transmission?.period?.abbreviation ||
    "";
  const listaStatus = fixtureRow.fixture.status;
  const nowSec = Math.floor(Date.now() / 1000);
  const beforeKickoff = nowSec < fixtureRow.fixture.timestamp - 60;
  const hasPreGame = Boolean(trv2.transmission?.hasPreGame);
  const scoreboard = match.scoreboard;
  const boardHasGoals =
    scoreboard &&
    ((Number(scoreboard.home) || 0) > 0 || (Number(scoreboard.away) || 0) > 0);

  // GE marks many pre-match pages as status "LIVE" — that is NOT kickoff.
  let status = statusFromPeriod(periodAbbr, listaStatus);
  if (beforeKickoff && listaStatus.short === "NS" && !periodIndicatesInPlay(periodAbbr)) {
    status = { long: "NS", short: "NS", elapsed: null };
  } else if (
    status.short === "NS" &&
    !beforeKickoff &&
    (periodIndicatesInPlay(periodAbbr) ||
      ["1H", "HT", "2H", "ET", "BT", "P", "LIVE"].includes(listaStatus.short) ||
      boardHasGoals)
  ) {
    status = { long: "1H", short: "1H", elapsed: null };
  } else if (
    status.short === "NS" &&
    hasPreGame &&
    !periodIndicatesInPlay(periodAbbr) &&
    listaStatus.short === "NS"
  ) {
    status = { long: "NS", short: "NS", elapsed: null };
  }

  const listaHome = fixtureRow.goals.home;
  const listaAway = fixtureRow.goals.away;
  const boardReady =
    scoreboard && scoreboard.home != null && scoreboard.away != null;
  const preferBoard = boardReady && status.short !== "NS";
  let goalsHome = preferBoard ? scoreboard.home : listaHome;
  let goalsAway = preferBoard ? scoreboard.away : listaAway;
  // If lista placar is ahead of a stale scoreboard, keep the higher total
  if (
    status.short !== "NS" &&
    listaHome != null &&
    listaAway != null &&
    goalsHome != null &&
    goalsAway != null &&
    listaHome + listaAway > goalsHome + goalsAway
  ) {
    goalsHome = listaHome;
    goalsAway = listaAway;
  }
  if (status.short === "NS") {
    goalsHome = listaHome;
    goalsAway = listaAway;
  }

  // Prefer GE timerStart wall-clock; last play moment lags and currentTime is often 00:00
  const clock = elapsedFromTransmissionClock(trv2.transmission, periodAbbr);
  if (status.short !== "NS" && status.short !== "FT" && clock?.elapsed != null) {
    status = { ...status, elapsed: clock.elapsed };
  } else if (status.short !== "NS" && status.short !== "FT" && status.elapsed == null) {
    const timed = (trv2.plays || [])
      .map((p) => momentToElapsed(p.moment, p.period?.abbreviation || p.period?.id))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (timed.length) status = { ...status, elapsed: Math.max(...timed) };
  }

  const timerStart = trv2.transmission?.timerStart || null;
  const timerStatus = trv2.transmission?.timerStatus || null;

  const { _geUrl, ...base } = fixtureRow;
  const sportsFieldUrl = trv2.theSportsField?.url || null;
  return {
    ...base,
    fixture: {
      ...base.fixture,
      status,
      timerStart,
      timerStatus,
      venue: {
        name: match.location?.popularName || match.location?.name || base.fixture.venue.name,
        city: base.fixture.venue.city,
      },
    },
    goals: { home: goalsHome, away: goalsAway },
    score: {
      halftime: base.score.halftime,
      fulltime: {
        home: status.short === "FT" ? goalsHome : null,
        away: status.short === "FT" ? goalsAway : null,
      },
    },
    events: status.short === "NS" ? [] : events,
    lineups,
    statistics: status.short === "NS" ? [] : statistics,
    odds: base.odds ?? null,
    sportsFieldUrl,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeTeamKey(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(rj|sc|sp|mg|pr|rs|ba|pe|ce|go|df|pa)\b/g, "")
    .replace(/\b(ec|fc|se|sa|cr|aa|ac|clube|futebol|regatas|sport)\b/g, "")
    .replace(/atletico/g, "athletico")
    .replace(/[^a-z0-9]/g, "");
}

function parseBetexplorerOddsPage(html) {
  const out = [];
  const rowRe =
    /<tr>[\s\S]*?<a[^>]*class="in-match"[^>]*>\s*<span>(?:<strong>)?([^<]+?)(?:<\/strong>)?<\/span>\s*-\s*<span>(?:<strong>)?([^<]+?)(?:<\/strong>)?<\/span><\/a>[\s\S]*?data-odd="([0-9.]+)"[\s\S]*?data-odd="([0-9.]+)"[\s\S]*?data-odd="([0-9.]+)"[\s\S]*?<\/tr>/gi;
  let m;
  while ((m = rowRe.exec(html))) {
    const home = m[1].trim();
    const away = m[2].trim();
    const odds = {
      home: Number(m[3]),
      draw: Number(m[4]),
      away: Number(m[5]),
      source: "betexplorer",
    };
    if (odds.home > 1 && odds.draw > 1 && odds.away > 1) {
      out.push({
        homeKey: normalizeTeamKey(home),
        awayKey: normalizeTeamKey(away),
        homeName: home,
        awayName: away,
        odds,
      });
    }
  }
  return out;
}

async function fetchBetexplorerOdds() {
  const rows = [];
  for (const url of [BETEXPLORER_FIXTURES, BETEXPLORER_RESULTS]) {
    try {
      const html = await fetchHtml(url, 25000);
      rows.push(...parseBetexplorerOddsPage(html));
    } catch (err) {
      console.warn(
        "Betexplorer odds fetch failed:",
        url,
        err instanceof Error ? err.message : String(err)
      );
    }
    await sleep(200);
  }
  // Prefer first occurrence (fixtures usually listed before results duplicates)
  const map = new Map();
  for (const row of rows) {
    const key = `${row.homeKey}__${row.awayKey}`;
    if (!map.has(key)) map.set(key, row);
  }
  return map;
}

function findOddsForFixture(oddsMap, homeName, awayName) {
  if (!oddsMap?.size) return null;
  const hk = normalizeTeamKey(homeName);
  const ak = normalizeTeamKey(awayName);
  const direct = oddsMap.get(`${hk}__${ak}`);
  if (direct) return direct.odds;
  for (const row of oddsMap.values()) {
    if (
      (row.homeKey === hk || row.homeKey.includes(hk) || hk.includes(row.homeKey)) &&
      (row.awayKey === ak || row.awayKey.includes(ak) || ak.includes(row.awayKey))
    ) {
      return row.odds;
    }
  }
  return null;
}

function parseScorersFromHtml(html) {
  const sectionMatch = html.match(
    /class="artilharia-wrapper"[\s\S]*?<div class="ranking-content">([\s\S]*?)(?:<\/div>\s*<\/div>\s*<\/section>|<\/section>)/i
  );
  const section = sectionMatch?.[1] ?? "";
  const items = [...section.matchAll(/class="ranking-item-wrapper"[\s\S]*?(?=class="ranking-item-wrapper"|$)/gi)];
  const scorers = [];
  let rank = 0;
  let prevGoals = null;
  for (const item of items) {
    const block = item[0];
    const name = block.match(/class="jogador-nome"[^>]*>([^<]+)/i)?.[1]?.trim();
    const goalsRaw = block.match(/class="jogador-gols"[^>]*>\s*(\d+)/i)?.[1];
    if (!name || goalsRaw == null) continue;
    const goals = Number(goalsRaw);
    if (prevGoals == null || goals < prevGoals) {
      rank = scorers.length + 1;
      prevGoals = goals;
    }
    // tied players keep same display order; rank number from GE may be blank for ties
    const photo = block.match(/class="jogador-foto"[\s\S]*?<img[^>]+src="([^"]+)"/i)?.[1] ?? "";
    const teamLogo = block.match(/class="jogador-escudo"[\s\S]*?<img[^>]+src="([^"]+)"/i)?.[1] ?? "";
    const team =
      block.match(/class="jogador-escudo"[\s\S]*?<img[^>]+alt="([^"]*)"/i)?.[1] ?? "";
    scorers.push({
      player: {
        id: scorers.length + 1,
        name,
        photo,
      },
      statistics: [
        {
          team: { name: team, logo: teamLogo },
          goals: { total: goals, assists: null },
          games: { appearences: 0 },
        },
      ],
    });
  }
  return scorers;
}

async function fetchGeHtml() {
  return fetchHtml(GE_URL);
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
    const nowSec = Math.floor(Date.now() / 1000);
    const hasLive = fixtures.some((f) =>
      ["1H", "HT", "2H", "LIVE", "ET", "BT", "P"].includes(f.fixture.status.short)
    );
    const hasPrematch = fixtures.some((f) => {
      if (f.fixture.status.short !== "NS") return false;
      const eta = f.fixture.timestamp - nowSec;
      // Lineups usually drop ~1h before; keep a wider window.
      return eta <= 3 * 3600 && eta >= -30 * 60;
    });
    const mode = hasLive ? "live" : hasPrematch ? "prematch" : "idle";
    const liveIntervalMs =
      mode === "live" ? 60_000 : mode === "prematch" ? 3 * 60_000 : 15 * 60_000;

    const scorers = parseScorersFromHtml(html);
    const oddsMap = await fetchBetexplorerOdds();
    let oddsMatched = 0;
    for (const f of fixtures) {
      const odds = findOddsForFixture(oddsMap, f.teams.home.name, f.teams.away.name);
      f.odds = odds;
      if (odds) oddsMatched++;
    }

    const payload = {
      fixtures: fixtures.map(({ _geUrl, ...f }) => f),
      standings,
      scorers,
      assists: [],
      budget: {
        used: 0,
        remaining: 100,
        mode,
        liveIntervalMs,
      },
      fetchedAt: new Date().toISOString(),
      source: "ge-globo",
      meta: {
        rodada,
        edicao: data.edicao?.nome ?? "Campeonato Brasileiro",
        provider: "ge.globo.com",
        scorersCount: scorers.length,
        oddsMatched,
        oddsAvailable: oddsMap.size,
      },
    };

    mkdirSync(MATCHES_DIR, { recursive: true });
    for (const name of readdirSync(MATCHES_DIR)) {
      if (name.endsWith(".json")) unlinkSync(join(MATCHES_DIR, name));
    }
    writeFileSync(join(CACHE_DIR, "dashboard.json"), JSON.stringify(payload, null, 2));

    let enriched = 0;
    let failed = 0;
    for (const f of fixtures) {
      let detail = minimalMatchDetail(f);
      if (shouldEnrich(f)) {
        try {
          detail = await enrichFromTransmission(f);
          enriched++;
          // Keep dashboard fixture score/status in sync when transmission has FT data
          const idx = payload.fixtures.findIndex((x) => x.fixture.id === f.fixture.id);
          if (idx >= 0) {
            payload.fixtures[idx] = {
              ...payload.fixtures[idx],
              fixture: detail.fixture,
              goals: detail.goals,
              score: detail.score,
              odds: detail.odds ?? payload.fixtures[idx].odds ?? null,
            };
          }
        } catch (err) {
          failed++;
          console.warn(
            `Match detail enrich failed for ${f.fixture.id}:`,
            err instanceof Error ? err.message : String(err)
          );
        }
        await sleep(150);
      }
      writeFileSync(join(MATCHES_DIR, `${f.fixture.id}.json`), JSON.stringify(detail, null, 2));
    }

    // Rewrite dashboard after possible score/status updates from transmissions
    writeFileSync(join(CACHE_DIR, "dashboard.json"), JSON.stringify(payload, null, 2));

    console.log(
      `Synced GE cache: rodada ${rodada}, ${fixtures.length} jogos, ${data.classificacao?.length ?? 0} times, enriched=${enriched}, failed=${failed}, scorers=${scorers.length}, odds=${oddsMatched}/${oddsMap.size}, source=${payload.source}`
    );
  } catch (err) {
    writeDemoFallback(err instanceof Error ? err.message : String(err));
  }
}

await main();
