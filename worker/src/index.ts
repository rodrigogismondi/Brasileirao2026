/**
 * Cloudflare Worker proxy for API-Football with shared daily budget + cache.
 * Deploy: cd worker && npx wrangler secret put API_FOOTBALL_KEY && npx wrangler deploy
 */

export interface Env {
  API_FOOTBALL_KEY: string;
  CACHE: KVNamespace;
}

const API_BASE = "https://v3.football.api-sports.io";
const LEAGUE = "71";
const SEASON = "2026";
const DAILY_BUDGET = 100;

function dayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function getBudget(env: Env): Promise<{ dayKey: string; used: number }> {
  const raw = await env.CACHE.get("budget");
  if (!raw) return { dayKey: dayKey(), used: 0 };
  const parsed = JSON.parse(raw) as { dayKey: string; used: number };
  if (parsed.dayKey !== dayKey()) return { dayKey: dayKey(), used: 0 };
  return parsed;
}

async function setBudget(env: Env, budget: { dayKey: string; used: number }): Promise<void> {
  await env.CACHE.put("budget", JSON.stringify(budget), { expirationTtl: 172800 });
}

async function cachedJson(env: Env, key: string): Promise<unknown | null> {
  const raw = await env.CACHE.get(key);
  return raw ? JSON.parse(raw) : null;
}

async function putJson(env: Env, key: string, value: unknown, ttl: number): Promise<void> {
  await env.CACHE.put(key, JSON.stringify(value), { expirationTtl: ttl });
}

async function apiGet(env: Env, path: string, params: Record<string, string>): Promise<unknown> {
  const budget = await getBudget(env);
  if (budget.used >= DAILY_BUDGET) throw new Error("Daily API budget exhausted");

  const url = new URL(`${API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { "x-apisports-key": env.API_FOOTBALL_KEY, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`API-Football HTTP ${res.status}`);
  const data = (await res.json()) as { response: unknown; errors?: unknown };
  budget.used += 1;
  await setBudget(env, budget);
  return data.response;
}

function cors(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(res.body, { status: res.status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return cors(new Response(null, { status: 204 }));
    }

    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/status") {
        const budget = await getBudget(env);
        return cors(
          Response.json({
            ok: true,
            demo: false,
            budget: { used: budget.used, remaining: DAILY_BUDGET - budget.used, dailyBudget: DAILY_BUDGET },
          })
        );
      }

      if (url.pathname === "/api/dashboard") {
        const leagueParams = { league: LEAGUE, season: SEASON };
        let fixtures = await cachedJson(env, "fixtures");
        if (!fixtures) {
          fixtures = await apiGet(env, "/fixtures", leagueParams);
          await putJson(env, "fixtures", fixtures, 3600);
        }

        const list = fixtures as Array<{ fixture: { status: { short: string } } }>;
        const hasLive = list.some((f) =>
          ["1H", "HT", "2H", "ET", "BT", "P", "LIVE"].includes(f.fixture.status.short)
        );

        const liveCached = await cachedJson(env, "live");
        if (hasLive || !liveCached) {
          // Throttle live polls via short KV TTL
          if (!liveCached) {
            const live = await apiGet(env, "/fixtures", { ...leagueParams, live: "all" });
            await putJson(env, "live", live, hasLive ? 90 : 600);
          }
        }

        async function block(key: string, path: string, ttl: number): Promise<unknown> {
          const hit = await cachedJson(env, key);
          if (hit) return hit;
          const data = await apiGet(env, path, leagueParams);
          await putJson(env, key, data, ttl);
          return data;
        }

        const [standings, scorers, assists] = await Promise.all([
          block("standings", "/standings", 3600),
          block("scorers", "/players/topscorers", 7200),
          block("assists", "/players/topassists", 7200),
        ]);

        const budget = await getBudget(env);
        return cors(
          Response.json({
            fixtures,
            standings,
            scorers,
            assists,
            budget: {
              used: budget.used,
              remaining: DAILY_BUDGET - budget.used,
              mode: hasLive ? "live" : "idle",
              liveIntervalMs: hasLive ? 120000 : 900000,
            },
            fetchedAt: new Date().toISOString(),
            source: "worker",
          })
        );
      }

      const detail = url.pathname.match(/^\/api\/match\/(\d+)$/);
      if (detail) {
        const id = detail[1];
        const key = `match:${id}`;
        let match = await cachedJson(env, key);
        if (!match) {
          const data = (await apiGet(env, "/fixtures", { id })) as unknown[];
          match = data[0] ?? null;
          await putJson(env, key, match, 90);
        }
        return cors(Response.json(match));
      }

      return cors(Response.json({ error: "Not found" }, { status: 404 }));
    } catch (err) {
      return cors(
        Response.json({ error: err instanceof Error ? err.message : "Worker error" }, { status: 500 })
      );
    }
  },
};
