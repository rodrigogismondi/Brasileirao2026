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
      detail: g.assist ? `${t(lang, "mdGoal")} · ${g.assist}` : t(lang, "mdGoal"),
    });
  }
  for (const g of detail.goals2) {
    events.push({
      kind: "goal",
      team: 2,
      minute: g.minute,
      sortKey: minuteSortKey(g.minute),
      title: g.name,
      detail: g.assist ? `${t(lang, "mdGoal")} · ${g.assist}` : t(lang, "mdGoal"),
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
      detail: `${t(lang, "mdSub")} · ${s.playerOut}`,
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
          <span class="md-event-body">
            <strong>${escapeHtml(e.title)}</strong>
            ${e.detail ? `<span class="muted">${escapeHtml(e.detail)}</span>` : ""}
          </span>
        </li>`
        )
        .join("")}
    </ul>`;
}

function renderStats(detail: MatchDetail, lang: Lang): string {
  if (detail.stats.length === 0) {
    return `<p class="muted">${escapeHtml(t(lang, "mdNoStats"))}</p>`;
  }
  return `
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
}

function renderPlayers(players: TeamLineup["startXI"]): string {
  return players
    .map(
      (p) => `
      <li>
        <span class="md-num">${p.number ?? "–"}</span>
        <span>${escapeHtml(p.name)}</span>
        <span class="muted">${escapeHtml(p.pos)}</span>
      </li>`
    )
    .join("");
}

function renderLineups(detail: MatchDetail, lang: Lang): string {
  if (detail.lineups.length === 0) {
    return `<p class="muted">${escapeHtml(t(lang, "mdNoLineups"))}</p>`;
  }
  return `
    <div class="md-lineups">
      ${detail.lineups
        .map(
          (l) => `
        <section class="md-lineup-card">
          <header>
            ${logoImg(l.logo, l.team, 24)}
            <div>
              <strong>${escapeHtml(l.team)}</strong>
              <span class="muted">${escapeHtml(t(lang, "mdFormation"))}: ${escapeHtml(l.formation)} · ${escapeHtml(t(lang, "mdCoach"))}: ${escapeHtml(l.coach)}</span>
            </div>
          </header>
          <ul class="md-xi">${renderPlayers(l.startXI)}</ul>
          <h4>${escapeHtml(t(lang, "mdBench"))}</h4>
          <ul class="md-xi md-bench">${renderPlayers(l.substitutes)}</ul>
        </section>`
        )
        .join("")}
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
