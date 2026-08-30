import { fetchDashboard, fetchMatchDetail, matchSummaryFromList } from "./api";
import { detectLang, LOCALE, saveLang, type Lang } from "./i18n";
import { renderApp, type AppState } from "./render";
import type { MatchDetailTab, ViewId } from "./types";
import { registerSW } from "virtual:pwa-register";
import "./style.css";

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    // Pick up new deploys while the PWA stays open (common on mobile).
    setInterval(() => {
      void registration.update();
    }, 60_000);
  },
  onNeedRefresh() {
    window.location.reload();
  },
});

const IDLE_REFRESH_MS = 15 * 60_000;

let state: AppState = {
  view: "schedule",
  scheduleFilter: "today",
  selectedRound: null,
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
let clockTimer: ReturnType<typeof setInterval> | null = null;
const LIVE_CLOCK_MS = 15_000;

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
      const merged =
        detail != null
          ? { ...detail, odds: detail.odds ?? fallback?.odds ?? null }
          : fallback
            ? matchSummaryFromList(fallback)
            : null;
      state = {
        ...state,
        matchDetail: merged,
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
      mode === "live"
        ? Math.max(20_000, liveIntervalMs)
        : mode === "prematch"
          ? Math.max(60_000, liveIntervalMs)
          : Math.max(IDLE_REFRESH_MS, liveIntervalMs);
    refreshTimer = setInterval(() => void load(true), ms);
  };

  const scheduleLiveClock = () => {
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = null;
    const needsTick = Boolean(
      state.data?.live.some(
        (m) => m.timerStart && String(m.timerStatus || "").toUpperCase() === "INICIADO"
      )
    );
    if (!needsTick) return;
    clockTimer = setInterval(() => {
      // Recompute minutes from timerStart without waiting for the next cache sync.
      paint();
    }, LIVE_CLOCK_MS);
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
      state = {
        ...state,
        data,
        loading: false,
        error: null,
        selectedRound: state.selectedRound ?? data.currentRound,
      };
      scheduleRefresh(data.budget.liveIntervalMs, data.budget.mode);
      scheduleLiveClock();
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
        const filter = (node as HTMLElement).dataset.filter!;
        state = {
          ...state,
          scheduleFilter: filter,
          selectedRound:
            filter === "all"
              ? (state.selectedRound ?? state.data?.currentRound ?? null)
              : state.selectedRound,
        };
        paint();
      });
    });

    el.querySelectorAll('[data-action="round-prev"]').forEach((node) => {
      node.addEventListener("click", () => {
        const rounds = state.data?.rounds ?? [];
        const cur = state.selectedRound ?? state.data?.currentRound ?? 1;
        const idx = rounds.indexOf(cur);
        if (idx > 0) {
          state = { ...state, selectedRound: rounds[idx - 1]! };
          paint();
        }
      });
    });

    el.querySelectorAll('[data-action="round-next"]').forEach((node) => {
      node.addEventListener("click", () => {
        const rounds = state.data?.rounds ?? [];
        const cur = state.selectedRound ?? state.data?.currentRound ?? 1;
        const idx = rounds.indexOf(cur);
        if (idx >= 0 && idx < rounds.length - 1) {
          state = { ...state, selectedRound: rounds[idx + 1]! };
          paint();
        }
      });
    });

    el.querySelectorAll('[data-action="round-select"]').forEach((node) => {
      node.addEventListener("change", () => {
        const n = Number((node as HTMLSelectElement).value);
        if (Number.isFinite(n) && n > 0) {
          state = { ...state, selectedRound: n };
          paint();
        }
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
