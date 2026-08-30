import type { MatchDetail, MatchDetailTab, TeamLineup } from "./types";
import { t, type Lang } from "./i18n";
import { escapeHtml, formatKickoff, formatScore, statusLabel, teamInitials } from "./utils";

interface TimelineEvent {
  kind: "goal" | "yellow" | "red" | "sub";
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
      kind: "goal",
      team: 1,
      minute: g.minute,
      sortKey: minuteSortKey(g.minute),
      title: g.name,
      detail: g.assist ? g.assist : undefined,
    });
  }
  for (const g of detail.goals2) {
    events.push({
      kind: "goal",
      team: 2,
      minute: g.minute,
      sortKey: minuteSortKey(g.minute),
      title: g.name,
      detail: g.assist ? g.assist : undefined,
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
  return events.sort((a, b) => b.sortKey - a.sortKey);
}

function logoImg(src: string, alt: string, size = 28): string {
  if (!src) {
    return `<span class="crest-placeholder" title="${escapeHtml(alt)}">${escapeHtml(teamInitials(alt))}</span>`;
  }
  return `<img class="crest" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="${size}" height="${size}" loading="lazy" />`;
}

function statLabel(key: string, lang: Lang): string {
  const map: Record<string, string> =
    lang === "pt"
      ? {
          "Ball Possession": "Posse de bola",
          "Total Shots": "Finalizações",
          "Shots on Goal": "Chutes no gol",
          "Shots off Goal": "Chutes para fora",
          "Blocked Shots": "Chutes bloqueados",
          "Corner Kicks": "Escanteios",
          Fouls: "Faltas",
          "Yellow Cards": "Cartões amarelos",
          "Red Cards": "Cartões vermelhos",
          "Pass Accuracy": "Precisão de passe",
          Offsides: "Impedimentos",
          "Goalkeeper Saves": "Defesas",
        }
      : {};
  return map[key] ?? key;
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
  if (e.kind === "goal") {
    return `
      <span class="md-event-body">
        <strong>${escapeHtml(e.title)}</strong>
        <span class="muted">${escapeHtml(e.detail ? `${t(lang, "mdGoal")} · ${e.detail}` : t(lang, "mdGoal"))}</span>
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

function renderHeatmap(detail: MatchDetail, lang: Lang): string {
  if (!detail.sportsFieldUrl) {
    return `<p class="muted md-heat-empty">${escapeHtml(t(lang, "mdNoHeatmap"))}</p>`;
  }
  return `
    <div class="md-heatmap">
      <p class="muted md-heat-caption">${escapeHtml(t(lang, "mdHeatmapHint"))}</p>
      <div class="md-heatmap-frame">
        <iframe
          src="${escapeHtml(detail.sportsFieldUrl)}"
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

  return `
    ${statsBlock}
    <section class="md-heat-section">
      <h3 class="md-section-title">${escapeHtml(t(lang, "mdHeatmap"))}</h3>
      ${renderHeatmap(detail, lang)}
    </section>`;
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

/** Match scorers/subs to lineup names without substring false positives (Cano≠Canobbio, Léo≠Leozinho). */
function samePlayer(a: string, b: string): boolean {
  const na = normPlayerName(a);
  const nb = normPlayerName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ta = playerNameTokens(a);
  const tb = playerNameTokens(b);
  // Single-token nickname/surname must equal a full token on the other side
  if (ta.length === 1 && tb.includes(ta[0])) return true;
  if (tb.length === 1 && ta.includes(tb[0])) return true;
  return false;
}

function playerGoalCount(detail: MatchDetail, team: 1 | 2, playerName: string): number {
  const goals = team === 1 ? detail.goals1 : detail.goals2;
  return goals.filter((g) => samePlayer(g.name, playerName)).length;
}

function playerSubbedOut(detail: MatchDetail, team: 1 | 2, playerName: string): boolean {
  return detail.subs.some((s) => s.team === team && samePlayer(s.playerOut, playerName));
}

function playerSubbedIn(detail: MatchDetail, team: 1 | 2, playerName: string): boolean {
  return detail.subs.some((s) => s.team === team && samePlayer(s.playerIn, playerName));
}

function renderPlayerIcons(
  detail: MatchDetail,
  team: 1 | 2,
  playerName: string,
  role: "xi" | "bench",
  lang: Lang
): string {
  const goals = playerGoalCount(detail, team, playerName);
  const out = role === "xi" && playerSubbedOut(detail, team, playerName);
  const cameIn = role === "bench" && playerSubbedIn(detail, team, playerName);
  if (!goals && !out && !cameIn) return "";
  const parts: string[] = [];
  if (goals > 0) {
    parts.push(
      `<span class="md-ico md-ico-goals" title="${escapeHtml(t(lang, "mdGoal"))}">${"⚽".repeat(goals)}</span>`
    );
  }
  if (cameIn) {
    parts.push(
      `<span class="md-ico md-ico-in" title="${escapeHtml(t(lang, "mdSubIn"))}" aria-label="${escapeHtml(t(lang, "mdSubIn"))}">↑</span>`
    );
  }
  if (out) {
    parts.push(
      `<span class="md-ico md-ico-out" title="${escapeHtml(t(lang, "mdSubOut"))}" aria-label="${escapeHtml(t(lang, "mdSubOut"))}">↓</span>`
    );
  }
  return `<span class="md-player-icons">${parts.join("")}</span>`;
}

function renderPlayers(
  players: TeamLineup["startXI"],
  detail: MatchDetail,
  team: 1 | 2,
  role: "xi" | "bench",
  lang: Lang
): string {
  return players
    .map(
      (p) => `
      <li>
        <span class="md-num">${p.number ?? "–"}</span>
        <span class="md-player-name">
          <span class="md-player-label">${escapeHtml(p.name)}</span>
          ${renderPlayerIcons(detail, team, p.name, role, lang)}
        </span>
        <span class="muted md-pos">${escapeHtml(formatPos(p.pos))}</span>
      </li>`
    )
    .join("");
}

function renderLineupColumn(l: TeamLineup, detail: MatchDetail, lang: Lang): string {
  const team: 1 | 2 = l.team === detail.team2 ? 2 : 1;
  return `
    <section class="md-lineup-card">
      <header>
        ${logoImg(l.logo, l.team, 22)}
        <div>
          <strong>${escapeHtml(l.team)}</strong>
          <span class="muted">${escapeHtml(l.formation)} · ${escapeHtml(l.coach)}</span>
        </div>
      </header>
      <ul class="md-xi">${renderPlayers(l.startXI, detail, team, "xi", lang)}</ul>
      <h4>${escapeHtml(t(lang, "mdBench"))}</h4>
      <ul class="md-xi md-bench">${renderPlayers(l.substitutes, detail, team, "bench", lang)}</ul>
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
      ? `<span class="badge badge-live">${detail.liveMinute != null ? `${detail.liveMinute}'` : t(lang, "statusLive")}</span>`
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
