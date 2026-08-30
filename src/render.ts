import type { DashboardData } from "./api";
import { renderMatchDetailPanel } from "./match-detail";
import {
  FLAG_BR,
  FLAG_US,
  filterLabel,
  navLabel,
  t,
  type Lang,
} from "./i18n";
import type { Match, MatchDetail, MatchDetailTab, PlayerStatRow, StandingRow, ViewId } from "./types";
import {
  escapeHtml,
  formatDateHeader,
  formatKickoff,
  formatScore,
  groupMatchesByDate,
  isMatchToday,
  isMatchUpcoming,
  statusLabel,
  teamInitials,
  timeAgo,
  liveBadgeText,
} from "./utils";

const ASSET_BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");
const BRAND_TROPHY_SRC = `${ASSET_BASE}brand-trophy.svg`;

function crestImg(src: string, alt: string): string {
  if (!src) {
    return `<span class="crest-placeholder" title="${escapeHtml(alt)}">${escapeHtml(teamInitials(alt))}</span>`;
  }
  return `<img class="crest" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" width="28" height="28" />`;
}

function renderMatchRow(m: Match, lang: Lang, compact = false): string {
  const liveBadge =
    m.status === "live"
      ? `<span class="badge badge-live">${escapeHtml(liveBadgeText(m, lang))}</span>`
      : `<span class="badge badge-${m.status}">${statusLabel(m.status, lang)}</span>`;

  const meta = compact
    ? `<span class="match-meta">${escapeHtml(m.round)}</span>`
    : `<div class="match-meta-block">
        <span class="match-round">${escapeHtml(m.round)}</span>
        <span class="match-venue">${escapeHtml(m.venue)}</span>
      </div>`;

  return `
    <article class="match-card match-card-clickable ${m.status === "live" ? "match-card-live" : ""}" data-action="open-match" data-match-id="${m.id}" role="button" tabindex="0">
      ${meta}
      <div class="match-teams">
        <div class="team-row">
          ${crestImg(m.logo1, m.team1)}
          <span class="team-name">${escapeHtml(m.team1)}</span>
          ${m.score ? `<span class="team-score">${m.score[0]}</span>` : ""}
        </div>
        <div class="team-row">
          ${crestImg(m.logo2, m.team2)}
          <span class="team-name">${escapeHtml(m.team2)}</span>
          ${m.score ? `<span class="team-score">${m.score[1]}</span>` : ""}
        </div>
      </div>
      <div class="match-footer">
        ${liveBadge}
        <time class="match-time">${escapeHtml(m.status === "finished" ? formatScore(m) : formatKickoff(m, lang))}</time>
      </div>
    </article>`;
}

function renderRoundPicker(
  data: DashboardData,
  selectedRound: number,
  lang: Lang
): string {
  const rounds = data.rounds.length > 0 ? data.rounds : [data.currentRound];
  const idx = rounds.indexOf(selectedRound);
  const atStart = idx <= 0;
  const atEnd = idx < 0 || idx >= rounds.length - 1;
  const options = rounds
    .map(
      (n) =>
        `<option value="${n}" ${n === selectedRound ? "selected" : ""}>${escapeHtml(
          t(lang, "roundLabel", { n })
        )}</option>`
    )
    .join("");

  return `
    <div class="round-bar" role="group" aria-label="${escapeHtml(t(lang, "roundLabel", { n: selectedRound }))}">
      <button type="button" class="round-nav-btn" data-action="round-prev" ${atStart ? "disabled" : ""} aria-label="${escapeHtml(t(lang, "roundPrev"))}">‹</button>
      <select class="round-select" data-action="round-select" aria-label="${escapeHtml(t(lang, "roundLabel", { n: selectedRound }))}">
        ${options}
      </select>
      <button type="button" class="round-nav-btn" data-action="round-next" ${atEnd ? "disabled" : ""} aria-label="${escapeHtml(t(lang, "roundNext"))}">›</button>
    </div>`;
}

function renderSchedule(
  data: DashboardData,
  filter: string,
  lang: Lang,
  selectedRound: number
): string {
  let matches = data.all;
  if (filter === "live") matches = matches.filter((m) => m.status === "live");
  else if (filter === "today") matches = matches.filter(isMatchToday);
  else if (filter === "upcoming") matches = matches.filter(isMatchUpcoming);
  else if (filter === "finished") matches = matches.filter((m) => m.status === "finished");
  else if (filter === "all") {
    matches = matches.filter((m) => m.roundNumber === selectedRound);
  }

  const descending = filter === "finished";
  const byDate = groupMatchesByDate(matches, descending);
  const roundPicker = filter === "all" ? renderRoundPicker(data, selectedRound, lang) : "";

  if (matches.length === 0) {
    return `${roundPicker}<div class="empty-state"><p>${escapeHtml(t(lang, "noMatches"))}</p></div>`;
  }

  return (
    roundPicker +
    [...byDate.entries()]
      .sort(([a], [b]) => (descending ? b.localeCompare(a) : a.localeCompare(b)))
      .map(
        ([date, dayMatches]) => `
      <section class="day-section">
        <h3 class="day-header">${escapeHtml(formatDateHeader(date, lang))}</h3>
        <div class="match-grid">${dayMatches.map((m) => renderMatchRow(m, lang)).join("")}</div>
      </section>`
      )
      .join("")
  );
}

function renderLive(data: DashboardData, lang: Lang): string {
  if (data.live.length === 0) {
    const next = data.upcoming[0];
    return `
      <div class="empty-state">
        <p class="empty-title">${escapeHtml(t(lang, "noLiveTitle"))}</p>
        ${
          next
            ? `<p class="empty-sub">${escapeHtml(t(lang, "nextUp"))}: <strong>${escapeHtml(next.team1)} vs ${escapeHtml(next.team2)}</strong><br/>${escapeHtml(formatKickoff(next, lang))}</p>`
            : ""
        }
      </div>
      <section class="section-block">
        <h3>${escapeHtml(t(lang, "recentResults"))}</h3>
        <div class="match-grid">${data.recent.map((m) => renderMatchRow(m, lang, true)).join("")}</div>
      </section>`;
  }

  const progressKey = data.live.length === 1 ? "matchesInProgress" : "matchesInProgressPlural";
  return `
    <div class="live-banner">
      <span class="pulse"></span>
      ${escapeHtml(t(lang, progressKey, { n: data.live.length }))}
    </div>
    <div class="match-grid match-grid-live">${data.live.map((m) => renderMatchRow(m, lang)).join("")}</div>
    <section class="section-block">
      <h3>${escapeHtml(t(lang, "alsoToday"))}</h3>
      <div class="match-grid">${
        data.all
          .filter((m) => isMatchToday(m) && m.status !== "live")
          .map((m) => renderMatchRow(m, lang, true))
          .join("") || `<p class='muted'>${escapeHtml(t(lang, "noOtherToday"))}</p>`
      }</div>
    </section>`;
}

function zoneClass(zone: StandingRow["zone"]): string {
  if (zone === "libertadores") return "zone-lib";
  if (zone === "pre-libertadores") return "zone-prelib";
  if (zone === "sudamericana") return "zone-sula";
  if (zone === "relegation") return "zone-rel";
  return "";
}

function renderTable(data: DashboardData, lang: Lang): string {
  if (data.standings.length === 0) {
    return `<div class="empty-state"><p>${escapeHtml(t(lang, "noMatches"))}</p></div>`;
  }
  return `
    <div class="table-wrap">
      <table class="standings-table">
        <thead>
          <tr>
            <th>${escapeHtml(t(lang, "colPos"))}</th>
            <th>${escapeHtml(t(lang, "colTeam"))}</th>
            <th>${escapeHtml(t(lang, "colPlayed"))}</th>
            <th>${escapeHtml(t(lang, "colWon"))}</th>
            <th>${escapeHtml(t(lang, "colDrawn"))}</th>
            <th>${escapeHtml(t(lang, "colLost"))}</th>
            <th>${escapeHtml(t(lang, "colGF"))}</th>
            <th>${escapeHtml(t(lang, "colGA"))}</th>
            <th>${escapeHtml(t(lang, "colGD"))}</th>
            <th>${escapeHtml(t(lang, "colPts"))}</th>
          </tr>
        </thead>
        <tbody>
          ${data.standings
            .map(
              (row) => `
            <tr class="${zoneClass(row.zone)}">
              <td class="pos">${row.rank}</td>
              <td class="team-cell">
                ${crestImg(row.logo, row.name)}
                ${escapeHtml(row.name)}
              </td>
              <td>${row.played}</td><td>${row.won}</td><td>${row.drawn}</td><td>${row.lost}</td>
              <td>${row.goalsFor}</td><td>${row.goalsAgainst}</td>
              <td class="${row.goalDiff > 0 ? "positive" : row.goalDiff < 0 ? "negative" : ""}">${row.goalDiff > 0 ? "+" : ""}${row.goalDiff}</td>
              <td><strong>${row.points}</strong></td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
      <div class="zone-legend">
        <span class="zone-lib">${escapeHtml(t(lang, "zoneLib"))}</span>
        <span class="zone-prelib">${escapeHtml(t(lang, "zonePreLib"))}</span>
        <span class="zone-sula">${escapeHtml(t(lang, "zoneSula"))}</span>
        <span class="zone-rel">${escapeHtml(t(lang, "zoneRel"))}</span>
      </div>
    </div>`;
}

function renderPlayerList(rows: PlayerStatRow[], lang: Lang): string {
  if (rows.length === 0) {
    return `<div class="empty-state"><p>${escapeHtml(t(lang, "noScorers"))}</p></div>`;
  }
  return `
    <ol class="player-list">
      ${rows
        .map(
          (p, i) => `
        <li class="player-row">
          <span class="player-rank">${i + 1}</span>
          <div class="player-info">
            <strong>${escapeHtml(p.name)}</strong>
            <span class="muted">${crestImg(p.teamLogo, p.team)} ${escapeHtml(p.team)}</span>
          </div>
          <span class="player-value" title="${escapeHtml(t(lang, "tabGoals"))}">${p.value}</span>
        </li>`
        )
        .join("")}
    </ol>`;
}

function renderScorers(data: DashboardData, lang: Lang): string {
  return renderPlayerList(data.scorers, lang);
}

function renderLangSwitch(lang: Lang): string {
  return `
    <div class="lang-switch" role="group" aria-label="${escapeHtml(t(lang, "language"))}">
      <button type="button" class="lang-btn ${lang === "pt" ? "active" : ""}" data-lang="pt" title="${escapeHtml(t(lang, "langPt"))}">
        <img src="${FLAG_BR}" alt="PT-BR" width="22" height="15" loading="lazy" />
      </button>
      <button type="button" class="lang-btn ${lang === "en" ? "active" : ""}" data-lang="en" title="${escapeHtml(t(lang, "langEn"))}">
        <img src="${FLAG_US}" alt="EN" width="22" height="15" loading="lazy" />
      </button>
    </div>`;
}

export interface AppState {
  view: ViewId;
  scheduleFilter: string;
  selectedRound: number | null;
  lang: Lang;
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  selectedMatchId: number | null;
  matchDetail: MatchDetail | null;
  matchDetailLoading: boolean;
  matchDetailTab: MatchDetailTab;
}

function renderMatchDetailOverlay(state: AppState): string {
  if (!state.selectedMatchId || !state.data) return "";
  if (state.matchDetailLoading) {
    return `
      <div class="md-panel md-panel-loading" role="dialog" aria-modal="true">
        <div class="md-backdrop" data-action="close-match"></div>
        <div class="md-sheet md-sheet-compact">
          <div class="loading"><div class="spinner"></div><p>${escapeHtml(t(state.lang, "mdLoading"))}</p></div>
        </div>
      </div>`;
  }
  if (!state.matchDetail) return "";
  return renderMatchDetailPanel(state.matchDetail, state.matchDetailTab, state.lang);
}

export function renderApp(state: AppState): string {
  const { view, data, loading, error, scheduleFilter, lang } = state;
  const selectedRound = state.selectedRound ?? data?.currentRound ?? 1;

  let content = "";
  if (loading && !data) {
    content = `<div class="loading"><div class="spinner"></div><p>${escapeHtml(t(lang, "loading"))}</p></div>`;
  } else if (error && !data) {
    content = `<div class="error-state"><p>${escapeHtml(t(lang, "errorTitle"))}</p><p class="muted">${escapeHtml(error)}</p><button class="btn" data-action="refresh">${escapeHtml(t(lang, "tryAgain"))}</button></div>`;
  } else if (data) {
    switch (view) {
      case "schedule":
        content = `
          <div class="filter-bar">
            ${["today", "live", "upcoming", "finished", "all"]
              .map(
                (f) =>
                  `<button class="filter-btn ${scheduleFilter === f ? "active" : ""}" data-filter="${f}">${escapeHtml(filterLabel(lang, f))}</button>`
              )
              .join("")}
          </div>
          ${renderSchedule(data, scheduleFilter, lang, selectedRound)}`;
        break;
      case "live":
        content = renderLive(data, lang);
        break;
      case "table":
        content = renderTable(data, lang);
        break;
      case "scorers":
        content = renderScorers(data, lang);
        break;
    }
  }

  const liveCount = data?.live.length ?? 0;
  const updated = data ? timeAgo(data.fetchedAt, lang) : "";
  const budget = data
    ? t(lang, "budgetLabel", { used: data.budget.used, total: data.budget.used + data.budget.remaining })
    : "";

  return `
    <div class="app">
      <header class="header">
        <div class="header-inner">
          <div class="brand">
            <div class="brand-mark" aria-hidden="true">
              <img src="${escapeHtml(BRAND_TROPHY_SRC)}" alt="" width="40" height="40" decoding="async" />
            </div>
            <div>
              <h1>${escapeHtml(t(lang, "title"))}</h1>
              <p class="tagline">${escapeHtml(t(lang, "tagline"))}</p>
            </div>
          </div>
          <div class="header-actions">
            ${renderLangSwitch(lang)}
            ${updated ? `<span class="updated" title="${escapeHtml(budget)}">${escapeHtml(t(lang, "updated", { time: updated }))}</span>` : ""}
            <button class="btn btn-ghost" data-action="refresh" title="${escapeHtml(t(lang, "refreshNow"))}" ${loading ? "disabled" : ""}>
              ${loading ? "…" : "↻"}
            </button>
          </div>
        </div>
        <nav class="nav">
          ${navItem("schedule", lang, view)}
          ${navItem("live", lang, view, liveCount)}
          ${navItem("table", lang, view)}
          ${navItem("scorers", lang, view)}
        </nav>
      </header>
      <main class="main">${content}</main>
    </div>
    ${renderMatchDetailOverlay(state)}`;
}

function navItem(id: ViewId, lang: Lang, current: ViewId, badge?: number): string {
  return `
    <button class="nav-btn ${current === id ? "active" : ""}" data-view="${id}">
      ${escapeHtml(navLabel(lang, id))}${badge ? `<span class="nav-badge">${badge}</span>` : ""}
    </button>`;
}
