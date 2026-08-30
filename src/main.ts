import { fetchDashboard, fetchMatchDetail, matchSummaryFromList } from "./api";
import { detectLang, LOCALE, saveLang, type Lang } from "./i18n";
import { renderApp, type AppState } from "./render";
import type { MatchDetailTab, ViewId } from "./types";
import "./style.css";

const IDLE_REFRESH_MS = 15 * 60_000;

let state: AppState = {
  view: "schedule",
  scheduleFilter: "today",
  scorersTab: "goals",
  lang: detectLang(),
  data: null,
  loading: true,
  error: null,
  selectedMatchId: null,
  matchDetail: null,
  matchDetailLoading: false,
  matchDetailTab: "events",
};

let refreshTimer: ReturnType<typeof setInterval> | null = null;

function mount(): void {
  const root = document.getElementById("app");
  if (!root) return;

  const paint = () => {
    document.documentElement.lang = LOCALE[state.lang];
    root.innerHTML = renderApp(state);
    bindEvents(root);
  };

  const loadMatchDetail = async (id: number, silent = false) => {
    if (!silent) {
      state = { ...state, matchDetailLoading: true, matchDetail: null };
      paint();
    }
    try {
      const detail = await fetchMatchDetail(id);
      const fallback = state.data?.all.find((m) => m.id === id);
      state = {
        ...state,
        matchDetail: detail ?? (fallback ? matchSummaryFromList(fallback) : null),
        matchDetailLoading: false,
      };
    } catch {
      const fallback = state.data?.all.find((m) => m.id === id);
      state = {
        ...state,
        matchDetail: fallback ? matchSummaryFromList(fallback) : null,
        matchDetailLoading: false,
      };
    }
    paint();
  };

  const openMatch = (id: number) => {
    state = {
      ...state,
      selectedMatchId: id,
      matchDetailTab: "events",
      matchDetail: null,
      matchDetailLoading: true,
    };
    paint();
    void loadMatchDetail(id);
  };

  const closeMatch = () => {
    state = {
      ...state,
      selectedMatchId: null,
      matchDetail: null,
      matchDetailLoading: false,
    };
    paint();
  };

  const scheduleRefresh = (liveIntervalMs: number, mode: string) => {
    if (refreshTimer) clearInterval(refreshTimer);
    const ms =
      mode === "idle"
        ? Math.max(IDLE_REFRESH_MS, liveIntervalMs)
        : Math.max(60_000, liveIntervalMs);
    refreshTimer = setInterval(() => void load(true), ms);
  };

  const load = async (silent = false) => {
    if (!silent) {
      state = { ...state, loading: true, error: null };
      paint();
    } else if (!state.data) {
      state = { ...state, loading: true };
      paint();
    }

    try {
      const data = await fetchDashboard();
      state = { ...state, data, loading: false, error: null };
      scheduleRefresh(data.budget.liveIntervalMs, data.budget.mode);
      if (state.selectedMatchId) {
        await loadMatchDetail(state.selectedMatchId, true);
      }
    } catch (err) {
      if (!silent || !state.data) {
        state = {
          ...state,
          loading: false,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      } else {
        state = { ...state, loading: false };
      }
    }
    paint();
  };

  const bindEvents = (el: HTMLElement) => {
    el.querySelectorAll("[data-view]").forEach((node) => {
      node.addEventListener("click", () => {
        state = { ...state, view: (node as HTMLElement).dataset.view as ViewId };
        paint();
      });
    });

    el.querySelectorAll("[data-filter]").forEach((node) => {
      node.addEventListener("click", () => {
        state = { ...state, scheduleFilter: (node as HTMLElement).dataset.filter! };
        paint();
      });
    });

    el.querySelectorAll("[data-scorers-tab]").forEach((node) => {
      node.addEventListener("click", () => {
        const tab = (node as HTMLElement).dataset.scorersTab as "goals" | "assists";
        state = { ...state, scorersTab: tab };
        paint();
      });
    });

    el.querySelectorAll('[data-action="refresh"]').forEach((node) => {
      node.addEventListener("click", () => void load());
    });

    el.querySelectorAll("[data-lang]").forEach((node) => {
      node.addEventListener("click", () => {
        const lang = (node as HTMLElement).dataset.lang as Lang;
        if (lang === state.lang) return;
        state = { ...state, lang };
        saveLang(lang);
        paint();
      });
    });

    el.querySelectorAll('[data-action="open-match"]').forEach((node) => {
      const open = () => {
        const id = Number((node as HTMLElement).dataset.matchId);
        if (id) openMatch(id);
      };
      node.addEventListener("click", open);
      node.addEventListener("keydown", (e) => {
        const key = (e as KeyboardEvent).key;
        if (key === "Enter" || key === " ") {
          e.preventDefault();
          open();
        }
      });
    });

    el.querySelectorAll('[data-action="close-match"]').forEach((node) => {
      node.addEventListener("click", () => closeMatch());
    });

    el.querySelectorAll('[data-action="md-tab"]').forEach((node) => {
      node.addEventListener("click", () => {
        const tab = (node as HTMLElement).dataset.mdTab as MatchDetailTab;
        if (tab) state = { ...state, matchDetailTab: tab };
        paint();
      });
    });
  };

  void load();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void load(true);
  });
}

mount();
