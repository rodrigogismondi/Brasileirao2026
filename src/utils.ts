import type { Match } from "./types";
import type { Lang } from "./i18n";
import { LOCALE, t } from "./i18n";

export function localDateKey(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

export function todayLocalKey(): string {
  return localDateKey(Math.floor(Date.now() / 1000));
}

export function isMatchToday(m: Match): boolean {
  return localDateKey(m.datetime) === todayLocalKey();
}

export function isMatchUpcoming(m: Match): boolean {
  if (m.status === "finished" || m.status === "live") return false;
  return m.datetime * 1000 > Date.now();
}

/** Kickoff in the viewer's local timezone (device TZ — e.g. Louisiana). */
export function formatKickoff(match: Match, lang: Lang): string {
  const d = new Date(match.datetime * 1000);
  const formatted = d.toLocaleString(LOCALE[lang], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return capitalizeLocale(formatted, lang);
}

export function formatDateHeader(localKey: string, lang: Lang): string {
  const [y, mo, d] = localKey.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  const formatted = date.toLocaleDateString(LOCALE[lang], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return capitalizeLocale(formatted, lang);
}

function capitalizeLocale(text: string, lang: Lang): string {
  if (lang !== "pt" || !text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatScore(match: Match): string {
  if (!match.score) return "–";
  return `${match.score[0]} – ${match.score[1]}`;
}

export function statusLabel(status: Match["status"], lang: Lang): string {
  switch (status) {
    case "live":
      return t(lang, "statusLive");
    case "finished":
      return t(lang, "statusFinished");
    case "upcoming":
      return t(lang, "statusUpcoming");
    case "postponed":
      return t(lang, "statusPostponed");
    default:
      return t(lang, "statusScheduled");
  }
}

/**
 * Live display minute from GE timerStart when the clock is running.
 * Falls back to the last synced `liveMinute` (e.g. while PAUSADO).
 */
export function resolveLiveMinute(m: Match, now = Date.now()): number | null {
  if (m.status !== "live") return null;
  if (isHalftime(m, now)) return null;

  const running = String(m.timerStatus || "").toUpperCase() === "INICIADO";
  if (running && m.timerStart) {
    const startMs = Date.parse(m.timerStart);
    if (Number.isFinite(startMs)) {
      let mins = Math.floor((now - startMs) / 60000);
      if (mins < 0) mins = 0;
      if (mins > 130) mins = 130;
      if (m.period === "2H") mins = 45 + mins;
      else if (m.period === "ET") mins = 90 + mins;
      return mins;
    }
  }

  return m.liveMinute;
}

/** Wall-clock minutes since period timerStart, if available. */
function minutesSinceTimerStart(m: Match, now: number): number | null {
  if (!m.timerStart) return null;
  const startMs = Date.parse(m.timerStart);
  if (!Number.isFinite(startMs)) return null;
  return Math.floor((now - startMs) / 60000);
}

/** True when GE says Intervalo, or 1H is paused past 45', or cache lagged past typical half length. */
export function isHalftime(m: Match, now = Date.now()): boolean {
  if (m.status !== "live") return false;
  if (m.period === "HT") return true;
  // Do not treat 2H pause / full-time whistle as Intervalo.
  if (m.period === "2H" || m.period === "ET" || m.period === "FT") return false;

  const wallMins = minutesSinceTimerStart(m, now);
  const syncedMins = m.liveMinute ?? 0;

  // PAUSADO during 1H is often hydration/VAR — only call it Intervalo near/after 45'.
  const paused = String(m.timerStatus || "").toUpperCase() === "PAUSADO";
  if (paused && m.period === "1H") {
    if (syncedMins >= 45 || (wallMins != null && wallMins >= 45)) return true;
  }

  // Cache lag: still "1H"/"INICIADO" after a half that should already be over.
  if (m.period === "1H" && wallMins != null) {
    // 45' + ~7' stoppage — beyond that the half is almost certainly over (cache lag).
    if (wallMins >= 52) return true;
  }

  return false;
}

/** Badge text for a live match: "34'" | "45+3'" | "INT" | "AO VIVO". */
export function liveBadgeText(m: Match, lang: Lang, now = Date.now()): string {
  if (isHalftime(m, now)) return t(lang, "statusHT");
  const minute = resolveLiveMinute(m, now);
  if (minute == null) return t(lang, "statusLive");
  // Stoppage in the 1st half: show 45+N instead of 48'/52'
  if (m.period === "1H" && minute > 45) return `45+${minute - 45}'`;
  if (m.period === "2H" && minute > 90) return `90+${minute - 90}'`;
  return `${minute}'`;
}

export function groupMatchesByDate(matches: Match[], descending = false): Map<string, Match[]> {
  const map = new Map<string, Match[]>();
  for (const m of matches) {
    const key = localDateKey(m.datetime);
    const list = map.get(key) ?? [];
    list.push(m);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => (descending ? b.datetime - a.datetime : a.datetime - b.datetime));
  }
  return map;
}

export function teamInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function timeAgo(date: Date, lang: Lang): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 10) return t(lang, "timeJustNow");
  if (sec < 60) return t(lang, "timeSeconds", { n: sec });
  const min = Math.floor(sec / 60);
  if (min < 60) return t(lang, "timeMinutes", { n: min });
  return t(lang, "timeHours", { n: Math.floor(min / 60) });
}
