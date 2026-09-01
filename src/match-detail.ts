import type { LineupPlayer, MatchDetail, MatchDetailTab, TeamLineup } from "./types";
import { t, type Lang } from "./i18n";
import { escapeHtml, formatKickoff, formatScore, liveBadgeText, statusLabel, teamInitials } from "./utils";

interface TimelineEvent {
  kind: "goal" | "own" | "yellow" | "red" | "sub" | "moment";
  team: 1 | 2;
  minute: string;
  sortKey: number;
  title: string;
  detail?: string;
  playerOut?: string;
}

function minuteSortKey(minute: string | number): number {
  if (typeof minute === "number") return minute;
  const m = minute.match(/^(\d+)(?:\+(\d+))?/);
  if (!m) return 0;
  return Number(m[1]) + (m[2] ? Number(m[2]) : 0);
}

function buildTimeline(detail: MatchDetail, lang: Lang): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const g of detail.goals1) {
    events.push({
      kind: g.own ? "own" : "goal",
      team: 1,
      minute: g.minute,
      sortKey: minuteSortKey(g.minute),
      title: g.name,
      detail: g.own ? t(lang, "mdOwnGoal") : g.assist ? g.assist : undefined,
    });
  }
  for (const g of detail.goals2) {
    events.push({
      kind: g.own ? "own" : "goal",
      team: 2,
      minute: g.minute,
      sortKey: minuteSortKey(g.minute),
      title: g.name,
      detail: g.own ? t(lang, "mdOwnGoal") : g.assist ? g.assist : undefined,
    });
  }
  for (const c of detail.cards) {
    events.push({
      kind: c.type,
      team: c.team,
      minute: String(c.minute),
      sortKey: minuteSortKey(c.minute),
      title: c.name,
      detail: c.type === "red" ? t(lang, "mdRed") : t(lang, "mdYellow"),
    });
  }
  for (const s of detail.subs) {
    events.push({
      kind: "sub",
      team: s.team,
      minute: String(s.minute),
      sortKey: minuteSortKey(s.minute),
      title: s.playerIn,
      playerOut: s.playerOut,
    });
  }
  for (const m of detail.moments ?? []) {
    events.push({
      kind: "moment",
      team: m.team,
      minute: String(m.minute),
      sortKey: minuteSortKey(m.minute),
      title: m.name,
      detail: m.detail && m.detail !== m.name ? m.detail : m.title,
    });
  }
  return events.sort((a, b) => b.sortKey - a.sortKey);
}

function logoImg(src: string, alt: string, size = 28): string {
  if (!src) {
    return `<span class="crest-placeholder" title="${escapeHtml(alt)}">${escapeHtml(teamInitials(alt))}</span>`;
  }
  return `<img class="crest" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="${size}" height="${size}" loading="lazy" />`;
}

/** Classic football with white panels; black parts → red (GE own-goal look). */
function ownGoalBallMarkup(label: string, attrs = ""): string {
  // Inline SVG (no clipPath ids — safe to repeat). White fill + red pentagon/seams.
  return `<span class="md-ball-own" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"${attrs ? ` ${attrs}` : ""}><svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="#fff" stroke="#ef4444" stroke-width="1"/><path fill="#ef4444" d="M8 3.85 10.25 5.5l-.85 2.55H6.6L5.75 5.5 8 3.85z"/><g fill="none" stroke="#ef4444" stroke-width="0.9" stroke-linejoin="round" stroke-linecap="round"><path d="M8 3.85V1.1M10.25 5.5l3.25-1.6M9.4 8.05l3.05 2.8M6.6 8.05l-3.05 2.8M5.75 5.5 2.5 3.9"/><path d="M3.55 10.85 5.35 13.7 8 12.4l2.65 1.3 1.8-2.85"/></g><path fill="#ef4444" d="M4.45 11.95 5.35 13.7 6.9 12.75z"/><path fill="#ef4444" d="M11.55 11.95 10.65 13.7 9.1 12.75z"/><path fill="#ef4444" d="M6.55 12.55h2.9L8 14.55z"/></svg></span>`;
}

function statLabel(key: string, lang: Lang): string {
  const pt: Record<string, string> = {
    "Ball Possession": "Posse de bola",
    "Total Passes": "Total de passes",
    "Pass Accuracy": "Precisão de passe",
    "Incomplete Passes": "Passes errados",
    "Total Shots": "Finalizações",
    "Shots on Goal": "Chutes no gol",
    "Shots off Goal": "Chutes para fora",
    "Blocked Shots": "Chutes bloqueados",
    "Hit Woodwork": "Na trave",
    "Corner Kicks": "Escanteios",
    Offsides: "Impedimentos",
    Penalties: "Pênaltis",
    "Goalkeeper Saves": "Defesas",
    Tackles: "Desarmes",
    Fouls: "Faltas",
    "Yellow Cards": "Cartões amarelos",
    "Red Cards": "Cartões vermelhos",
  };
  if (lang !== "pt") return key;
  return pt[key] ?? key;
}

function parseStatNumber(v: string | number): number {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace("%", ""));
  return Number.isFinite(n) ? n : 0;
}

function eventCrest(detail: MatchDetail, team: 1 | 2): string {
  const logo = team === 1 ? detail.logo1 : detail.logo2;
  const name = team === 1 ? detail.team1 : detail.team2;
  return `<span class="md-event-crest">${logoImg(logo, name, 22)}</span>`;
}

function renderEventBody(e: TimelineEvent, lang: Lang): string {
  if (e.kind === "sub") {
    return `
      <span class="md-event-body md-sub-body">
        <span class="md-sub-row md-sub-in">
          <span class="md-sub-arrow" aria-hidden="true">↑</span>
          <strong>${escapeHtml(e.title)}</strong>
        </span>
        <span class="md-sub-row md-sub-out">
          <span class="md-sub-arrow" aria-hidden="true">↓</span>
          <span>${escapeHtml(e.playerOut ?? "")}</span>
        </span>
      </span>`;
  }
  if (e.kind === "goal" || e.kind === "own") {
    const label = e.kind === "own" ? t(lang, "mdOwnGoal") : t(lang, "mdGoal");
    const ball =
      e.kind === "own"
        ? ownGoalBallMarkup(label)
        : `<span class="md-ball-ico" aria-hidden="true">⚽</span>`;
    const sub =
      e.kind === "own" ? label : e.detail ? `${label} · ${e.detail}` : label;
    return `
      <span class="md-event-body">
        <span class="md-event-title-row">
          ${ball}
          <strong>${escapeHtml(e.title)}</strong>
        </span>
        <span class="muted">${escapeHtml(sub)}</span>
      </span>`;
  }
  if (e.kind === "yellow" || e.kind === "red") {
    const label = e.kind === "red" ? t(lang, "mdRed") : t(lang, "mdYellow");
    return `
      <span class="md-event-body">
        <span class="md-event-title-row">
          <span class="md-card-ico md-card-ico-${e.kind}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"></span>
          <strong>${escapeHtml(e.title)}</strong>
        </span>
        <span class="muted">${escapeHtml(e.detail ?? label)}</span>
      </span>`;
  }
  if (e.kind === "moment") {
    return `
      <span class="md-event-body">
        <span class="md-event-title-row">
          <span class="md-moment-ico" aria-hidden="true">◆</span>
          <strong>${escapeHtml(e.title)}</strong>
        </span>
        ${e.detail ? `<span class="muted">${escapeHtml(e.detail)}</span>` : `<span class="muted">${escapeHtml(t(lang, "mdMoment"))}</span>`}
      </span>`;
  }
  return `
    <span class="md-event-body">
      <strong>${escapeHtml(e.title)}</strong>
      ${e.detail ? `<span class="muted">${escapeHtml(e.detail)}</span>` : ""}
    </span>`;
}

function renderEvents(detail: MatchDetail, lang: Lang): string {
  const events = buildTimeline(detail, lang);
  if (events.length === 0) {
    return `<p class="muted">${escapeHtml(t(lang, "mdNoEvents"))}</p>`;
  }
  return `
    <ul class="md-timeline">
      ${events
        .map(
          (e) => `
        <li class="md-event md-event-${e.kind} md-event-team${e.team}">
          <span class="md-min">${escapeHtml(e.minute)}'</span>
          ${eventCrest(detail, e.team)}
          ${renderEventBody(e, lang)}
        </li>`
        )
        .join("")}
    </ul>`;
}

function renderOddsBar(detail: MatchDetail, lang: Lang): string {
  const odds = detail.odds;
  if (!odds) return "";
  const ih = 1 / odds.home;
  const id = 1 / odds.draw;
  const ia = 1 / odds.away;
  const sum = ih + id + ia || 1;
  const ph = Math.round((ih / sum) * 100);
  const pd = Math.round((id / sum) * 100);
  const pa = Math.max(0, 100 - ph - pd);
  const o = (n: number) => n.toFixed(2);
  return `
    <div class="md-odds" aria-label="${escapeHtml(t(lang, "mdOdds"))}">
      <div class="md-odds-labels">
        <span><strong>${escapeHtml(detail.team1)}</strong> ${o(odds.home)}</span>
        <span>${escapeHtml(t(lang, "mdOddsDraw"))} ${o(odds.draw)}</span>
        <span>${o(odds.away)} <strong>${escapeHtml(detail.team2)}</strong></span>
      </div>
      <div class="md-odds-bar" title="${escapeHtml(t(lang, "mdOddsHint"))}">
        <i class="md-odds-home" style="width:${ph}%"></i>
        <i class="md-odds-draw" style="width:${pd}%"></i>
        <i class="md-odds-away" style="width:${pa}%"></i>
      </div>
      <div class="md-odds-pct muted">
        <span>${ph}%</span><span>${pd}%</span><span>${pa}%</span>
      </div>
    </div>`;
}

/** True only when we have a pitch map URL that is actually usable in-app. */
function usableHeatmapUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    // TheSports embeds for Brasileirão almost always render an empty
    // "unavailable" placeholder — treat them as missing rather than show that UI.
    if (host.includes("thesports")) return null;
  } catch {
    return null;
  }
  return url;
}

function renderHeatmap(detail: MatchDetail, lang: Lang): string {
  const url = usableHeatmapUrl(detail.sportsFieldUrl);
  if (!url) return "";
  return `
    <div class="md-heatmap">
      <p class="muted md-heat-caption">${escapeHtml(t(lang, "mdHeatmapHint"))}</p>
      <div class="md-heatmap-frame">
        <iframe
          src="${escapeHtml(url)}"
          title="${escapeHtml(t(lang, "mdHeatmap"))}"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          allowfullscreen
        ></iframe>
      </div>
    </div>`;
}

function renderStats(detail: MatchDetail, lang: Lang): string {
  const statsBlock =
    detail.stats.length === 0
      ? `<p class="muted">${escapeHtml(t(lang, "mdNoStats"))}</p>`
      : `
    <div class="md-stats">
      ${detail.stats
        .map((s) => {
          const h = parseStatNumber(s.values[0]);
          const a = parseStatNumber(s.values[1]);
          const total = h + a || 1;
          const hp = Math.round((h / total) * 100);
          return `
          <div class="md-stat-row">
            <div class="md-stat-vals">
              <span>${escapeHtml(String(s.values[0] ?? 0))}</span>
              <span class="md-stat-label">${escapeHtml(statLabel(s.key, lang))}</span>
              <span>${escapeHtml(String(s.values[1] ?? 0))}</span>
            </div>
            <div class="md-stat-bar">
              <i style="width:${hp}%"></i>
            </div>
          </div>`;
        })
        .join("")}
    </div>`;

  const heat = renderHeatmap(detail, lang);
  const heatSection = heat
    ? `<section class="md-heat-section">
      <h3 class="md-section-title">${escapeHtml(t(lang, "mdHeatmap"))}</h3>
      ${heat}
    </section>`
    : "";

  return `
    ${statsBlock}
    ${heatSection}`;
}

/** Short Portuguese position labels (Gol / Def / Mei / Ata). */
function formatPos(pos: string): string {
  const p = String(pos || "").trim().toUpperCase();
  if (!p) return "";
  if (["G", "GK", "GKP", "GOL", "GOALKEEPER"].includes(p) || p.startsWith("GOL")) return "Gol";
  if (
    ["D", "DF", "DEF", "DEFENDER", "CB", "LB", "RB", "LWB", "RWB"].includes(p) ||
    p.startsWith("DEF")
  ) {
    return "Def";
  }
  if (
    ["M", "MF", "MID", "MEI", "MIDFIELDER", "CDM", "CM", "CAM", "LM", "RM", "VOL", "MEC"].includes(
      p
    ) ||
    p.startsWith("MEI") ||
    p.startsWith("MID")
  ) {
    return "Mei";
  }
  if (
    ["F", "FW", "ST", "ATA", "ATTACKER", "FORWARD", "CF", "LW", "RW", "SS"].includes(p) ||
    p.startsWith("ATA") ||
    p.startsWith("ATT") ||
    p.startsWith("FOR")
  ) {
    return "Ata";
  }
  return pos.length <= 3 ? pos : pos.slice(0, 3);
}

function normPlayerName(name: string): string {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function playerNameTokens(name: string): string[] {
  return String(name || "")
    .split(/\s+/)
    .map(normPlayerName)
    .filter(Boolean);
}

/**
 * Pair an event name with a lineup player.
 * Prefer exact full-name matches so "Eduardo" does not also hit "Carlos Eduardo".
 * Fall back to unique token shorthand (e.g. "Cano" → "Germán Cano") only when
 * a single squad member owns that token.
 */
function resolveSquadPlayer(eventName: string, squadNames: string[]): string | null {
  const ne = normPlayerName(eventName);
  if (!ne || squadNames.length === 0) return null;

  const exact = squadNames.filter((n) => normPlayerName(n) === ne);
  if (exact.length === 1) return exact[0]!;
  if (exact.length > 1) return exact[0]!;

  const et = playerNameTokens(eventName);
  if (et.length === 0) return null;

  if (et.length === 1) {
    const token = et[0]!;
    const owners = squadNames.filter((n) => playerNameTokens(n).includes(token));
    if (owners.length === 1) return owners[0]!;
    // Ambiguous token (Eduardo vs Carlos Eduardo) — only accept a sole exact name.
    return null;
  }

  // Multi-token event name: require every token to appear, prefer unique match.
  const hits = squadNames.filter((n) => {
    const tokens = playerNameTokens(n);
    return et.every((t) => tokens.includes(t));
  });
  if (hits.length === 1) return hits[0]!;
  const exactMulti = hits.filter((n) => normPlayerName(n) === ne);
  return exactMulti[0] ?? null;
}

function teamSquadNames(detail: MatchDetail, team: 1 | 2): string[] {
  const lineup = detail.lineups[team - 1];
  if (!lineup) return [];
  return [...lineup.startXI, ...lineup.substitutes].map((p) => p.name).filter(Boolean);
}

function playerGoalCounts(
  detail: MatchDetail,
  team: 1 | 2,
  playerName: string
): { normal: number; own: number } {
  const goals = team === 1 ? detail.goals1 : detail.goals2;
  const squad = teamSquadNames(detail, team);
  const target = normPlayerName(playerName);
  let normal = 0;
  let own = 0;
  for (const g of goals) {
    const resolved = resolveSquadPlayer(g.name, squad);
    if (!resolved || normPlayerName(resolved) !== target) continue;
    if (g.own) own++;
    else normal++;
  }
  return { normal, own };
}

function playerSubbedOut(detail: MatchDetail, team: 1 | 2, playerName: string): boolean {
  const squad = teamSquadNames(detail, team);
  const target = normPlayerName(playerName);
  return detail.subs.some((s) => {
    if (s.team !== team) return false;
    const resolved = resolveSquadPlayer(s.playerOut, squad);
    return resolved != null && normPlayerName(resolved) === target;
  });
}

/** Bench player (or stub) who replaced this starter, if any. */
function replacementFor(
  detail: MatchDetail,
  team: 1 | 2,
  playerOutName: string
): LineupPlayer | null {
  const lineup = detail.lineups[team - 1];
  if (!lineup) return null;
  const squad = teamSquadNames(detail, team);
  const target = normPlayerName(playerOutName);
  const sub = detail.subs.find((s) => {
    if (s.team !== team) return false;
    const resolved = resolveSquadPlayer(s.playerOut, squad);
    return resolved != null && normPlayerName(resolved) === target;
  });
  if (!sub) return null;
  const inName = resolveSquadPlayer(sub.playerIn, squad) ?? sub.playerIn;
  const fromBench = lineup.substitutes.find(
    (p) => normPlayerName(p.name) === normPlayerName(inName)
  );
  if (fromBench) return fromBench;
  return { name: inName, number: null, pos: "", grid: null };
}

function remainingBench(
  lineup: TeamLineup,
  detail: MatchDetail,
  team: 1 | 2
): LineupPlayer[] {
  const squad = teamSquadNames(detail, team);
  return lineup.substitutes.filter((p) => {
    const target = normPlayerName(p.name);
    return !detail.subs.some((s) => {
      if (s.team !== team) return false;
      const resolved = resolveSquadPlayer(s.playerIn, squad);
      return resolved != null && normPlayerName(resolved) === target;
    });
  });
}

function playerCardKinds(
  detail: MatchDetail,
  team: 1 | 2,
  playerName: string
): { yellow: boolean; red: boolean } {
  const squad = teamSquadNames(detail, team);
  const target = normPlayerName(playerName);
  let yellow = false;
  let red = false;
  for (const c of detail.cards) {
    if (c.team !== team) continue;
    const resolved = resolveSquadPlayer(c.name, squad);
    if (!resolved || normPlayerName(resolved) !== target) continue;
    if (c.type === "red") red = true;
    else yellow = true;
  }
  return { yellow, red };
}

function renderPlayerEventIcons(
  detail: MatchDetail,
  team: 1 | 2,
  playerName: string,
  lang: Lang
): string {
  const { normal, own } = playerGoalCounts(detail, team, playerName);
  const cards = playerCardKinds(detail, team, playerName);
  if (!normal && !own && !cards.yellow && !cards.red) return "";
  const parts: string[] = [];
  if (normal > 0) {
    parts.push(
      `<span class="md-ico md-ico-goals" title="${escapeHtml(t(lang, "mdGoal"))}">${"⚽".repeat(normal)}</span>`
    );
  }
  if (own > 0) {
    const label = t(lang, "mdOwnGoal");
    parts.push(
      `<span class="md-ico md-ico-own-goals" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${ownGoalBallMarkup(label).repeat(own)}</span>`
    );
  }
  if (cards.yellow) {
    parts.push(
      `<span class="md-card-ico md-card-ico-yellow md-card-ico-sm" title="${escapeHtml(t(lang, "mdYellow"))}" aria-label="${escapeHtml(t(lang, "mdYellow"))}"></span>`
    );
  }
  if (cards.red) {
    parts.push(
      `<span class="md-card-ico md-card-ico-red md-card-ico-sm" title="${escapeHtml(t(lang, "mdRed"))}" aria-label="${escapeHtml(t(lang, "mdRed"))}"></span>`
    );
  }
  return `<span class="md-player-icons">${parts.join("")}</span>`;
}

function renderLineupPlayerRow(
  p: LineupPlayer,
  detail: MatchDetail,
  team: 1 | 2,
  lang: Lang,
  opts: { arrow?: "in" | "out"; faded?: boolean }
): string {
  const arrow =
    opts.arrow === "out"
      ? `<span class="md-xi-arrow md-xi-arrow-out" title="${escapeHtml(t(lang, "mdSubOut"))}" aria-label="${escapeHtml(t(lang, "mdSubOut"))}">↓</span>`
      : opts.arrow === "in"
        ? `<span class="md-xi-arrow md-xi-arrow-in" title="${escapeHtml(t(lang, "mdSubIn"))}" aria-label="${escapeHtml(t(lang, "mdSubIn"))}">↑</span>`
        : `<span class="md-xi-arrow md-xi-arrow-spacer" aria-hidden="true"></span>`;
  return `
    <div class="md-xi-player ${opts.faded ? "md-xi-player-out" : ""}">
      ${arrow}
      <span class="md-num">${p.number ?? "–"}</span>
      <span class="md-player-name">
        <span class="md-player-label">${escapeHtml(p.name)}</span>
        ${renderPlayerEventIcons(detail, team, p.name, lang)}
      </span>
      <span class="muted md-pos">${escapeHtml(formatPos(p.pos))}</span>
    </div>`;
}

function renderStartingXi(
  players: TeamLineup["startXI"],
  detail: MatchDetail,
  team: 1 | 2,
  lang: Lang
): string {
  return players
    .map((p) => {
      const out = playerSubbedOut(detail, team, p.name);
      const incoming = out ? replacementFor(detail, team, p.name) : null;
      if (out && incoming) {
        return `
        <li class="md-xi-slot">
          ${renderLineupPlayerRow(p, detail, team, lang, { arrow: "out", faded: true })}
          ${renderLineupPlayerRow(incoming, detail, team, lang, { arrow: "in" })}
        </li>`;
      }
      if (out) {
        return `
        <li class="md-xi-slot">
          ${renderLineupPlayerRow(p, detail, team, lang, { arrow: "out", faded: true })}
        </li>`;
      }
      return `
        <li class="md-xi-slot">
          ${renderLineupPlayerRow(p, detail, team, lang, {})}
        </li>`;
    })
    .join("");
}

function renderBenchPlayers(
  players: LineupPlayer[],
  detail: MatchDetail,
  team: 1 | 2,
  lang: Lang
): string {
  return players
    .map(
      (p) => `
      <li class="md-xi-slot">
        ${renderLineupPlayerRow(p, detail, team, lang, {})}
      </li>`
    )
    .join("");
}

function renderLineupColumn(l: TeamLineup, detail: MatchDetail, lang: Lang): string {
  const team: 1 | 2 = l.team === detail.team2 ? 2 : 1;
  const bench = remainingBench(l, detail, team);
  return `
    <section class="md-lineup-card">
      <header>
        ${logoImg(l.logo, l.team, 22)}
        <div>
          <strong>${escapeHtml(l.team)}</strong>
          <span class="muted">${escapeHtml(l.formation)} · ${escapeHtml(l.coach)}</span>
        </div>
      </header>
      <ul class="md-xi">${renderStartingXi(l.startXI, detail, team, lang)}</ul>
      <h4>${escapeHtml(t(lang, "mdBench"))}</h4>
      <ul class="md-xi md-bench">${
        bench.length
          ? renderBenchPlayers(bench, detail, team, lang)
          : `<li class="muted md-bench-empty">—</li>`
      }</ul>
    </section>`;
}

function renderLineups(detail: MatchDetail, lang: Lang): string {
  if (detail.lineups.length === 0) {
    return `<p class="muted">${escapeHtml(t(lang, "mdNoLineups"))}</p>`;
  }
  const home =
    detail.lineups.find((l) => l.team === detail.team1) ?? detail.lineups[0];
  const away =
    detail.lineups.find((l) => l.team === detail.team2) ??
    detail.lineups.find((l) => l !== home) ??
    detail.lineups[1];
  const columns = [home, away].filter(Boolean) as TeamLineup[];
  return `
    <div class="md-lineups ${columns.length > 1 ? "md-lineups-split" : ""}">
      ${columns.map((l) => renderLineupColumn(l, detail, lang)).join("")}
    </div>`;
}

export function renderMatchDetailPanel(
  detail: MatchDetail,
  tab: MatchDetailTab,
  lang: Lang
): string {
  const liveBadge =
    detail.status === "live"
      ? `<span class="badge badge-live">${escapeHtml(liveBadgeText(detail, lang))}</span>`
      : `<span class="badge badge-${detail.status}">${statusLabel(detail.status, lang)}</span>`;

  let body = "";
  if (tab === "events") body = renderEvents(detail, lang);
  else if (tab === "stats") body = renderStats(detail, lang);
  else body = renderLineups(detail, lang);

  return `
    <div class="md-panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(detail.team1)} vs ${escapeHtml(detail.team2)}">
      <div class="md-backdrop" data-action="close-match"></div>
      <div class="md-sheet">
        <button type="button" class="md-close" data-action="close-match" aria-label="${escapeHtml(t(lang, "mdClose"))}">×</button>
        <div class="md-header">
          <div class="md-meta">
            <span>${escapeHtml(detail.round)}</span>
            ${liveBadge}
          </div>
          <div class="md-scoreboard">
            <div class="md-side">
              ${logoImg(detail.logo1, detail.team1, 40)}
              <span>${escapeHtml(detail.team1)}</span>
            </div>
            <div class="md-score">
              ${detail.score ? `<strong>${detail.score[0]} – ${detail.score[1]}</strong>` : `<strong class="muted">vs</strong>`}
              <time>${escapeHtml(detail.status === "finished" ? formatScore(detail) : formatKickoff(detail, lang))}</time>
            </div>
            <div class="md-side">
              ${logoImg(detail.logo2, detail.team2, 40)}
              <span>${escapeHtml(detail.team2)}</span>
            </div>
          </div>
          ${renderOddsBar(detail, lang)}
          ${detail.venue ? `<p class="md-venue muted">${escapeHtml(detail.venue)}</p>` : ""}
        </div>
        <div class="md-tabs">
          ${(["events", "stats", "lineups"] as MatchDetailTab[])
            .map((id) => {
              const label =
                id === "events" ? t(lang, "mdEvents") : id === "stats" ? t(lang, "mdStats") : t(lang, "mdLineups");
              return `<button type="button" class="md-tab ${tab === id ? "active" : ""}" data-action="md-tab" data-md-tab="${id}">${escapeHtml(label)}</button>`;
            })
            .join("")}
        </div>
        <div class="md-body">${body}</div>
      </div>
    </div>`;
}
