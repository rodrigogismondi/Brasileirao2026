import { defineConfig, loadEnv, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { createStore, getDashboardPayload, getMatchDetailPayload, budgetStatus } from "./server/proxy-store";
import { demoDashboard, demoMatchDetail } from "./server/demo-data";

const base = process.env.VITE_BASE_PATH ?? "/";
const store = createStore();

function apiProxyPlugin(apiKey: string, forceDemo: boolean): Plugin {
  return {
    name: "brasileirao-api-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();

        res.setHeader("Content-Type", "application/json");
        try {
          const url = new URL(req.url, "http://localhost");
          const useDemo = forceDemo || !apiKey;

          if (url.pathname === "/api/status") {
            res.end(
              JSON.stringify({
                ok: true,
                demo: useDemo,
                budget: useDemo ? { used: 0, remaining: 100, dailyBudget: 100 } : budgetStatus(store),
              })
            );
            return;
          }

          if (url.pathname === "/api/dashboard") {
            if (useDemo) {
              res.end(JSON.stringify(demoDashboard()));
              return;
            }
            const payload = await getDashboardPayload(store, apiKey);
            res.end(JSON.stringify(payload));
            return;
          }

          const detailMatch = url.pathname.match(/^\/api\/match\/(\d+)$/);
          if (detailMatch) {
            const id = Number(detailMatch[1]);
            if (useDemo) {
              res.end(JSON.stringify(demoMatchDetail(id)));
              return;
            }
            const payload = await getMatchDetailPayload(store, apiKey, id);
            res.end(JSON.stringify(payload));
            return;
          }

          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Not found" }));
        } catch (err) {
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : "Proxy error",
            })
          );
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiKey = env.API_FOOTBALL_KEY || "";
  const forceDemo = env.VITE_DEMO_MODE === "1";

  return {
    base,
    plugins: [
      apiProxyPlugin(apiKey, forceDemo),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        includeAssets: ["favicon.ico", "favicon-32x32.png", "apple-touch-icon.png"],
        manifest: {
          name: "Brasileirão 2026",
          short_name: "Brasileirão",
          description:
            "Brasileirão 2026 — jogos, tabela, artilharia, assistências e detalhes ao vivo.",
          theme_color: "#0a1f12",
          background_color: "#0a1f12",
          display: "standalone",
          orientation: "portrait-primary",
          categories: ["sports", "news"],
          icons: [
            { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
            {
              src: "pwa-maskable-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,jpg,webp}"],
          navigateFallback: "index.html",
          navigateFallbackDenylist: [/^\/api/],
        },
        devOptions: { enabled: false },
      }),
    ],
    build: { outDir: "dist" },
  };
});
