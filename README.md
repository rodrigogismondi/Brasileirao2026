# Brasileirão 2026

Fan dashboard for the Brazilian Série A — schedule, live scores, classification table, top scorers, assists, and match details (goals, cards, subs, possession, lineups).

Modeled after [FWC26](https://github.com/rodrigogismondi/FWC26), with a **smart API budget** for the API-Football free tier (100 requests/day).

## Features

- **Jogos** — filter by today / live / upcoming / finished
- **Ao vivo** — in-progress matches with adaptive refresh
- **Tabela** — full standings with Libertadores / Sul-Americana / relegation zones
- **Artilharia** — top scorers and assists
- **Match detail** — events, stats (possession, shots, cards), lineups & substitutions
- **PWA** — installable on phone home screen
- **PT / EN** — language toggle

## Smart request budget

The free API-Football plan allows **100 requests/day**. The Vite proxy (local) and Cloudflare Worker (production) share one budget and:

| Mode | When | Behavior |
|------|------|----------|
| Idle | No live / no imminent kickoff | Almost no live polling; standings/scorers cached for hours |
| Prematch | Kickoff within ~75 min | Light checks for lineups / status |
| Live | ≥1 match in play | One shared live fixtures poll every 90–180s, sized to remaining budget |
| Detail | User opens a match | On-demand fixture-by-id (events + stats + lineups), short cache |

List polls do **not** multiply by concurrent matches — one live call returns all of them.

## Data source

[API-Football](https://www.api-football.com/) — league id `71`, season `2026`.

Without a key, the app syncs **live scores and standings from GE Globo** on every GitHub Pages deploy (and every 15 minutes via Actions). Demo data is only used if that sync fails.

## Setup

```bash
npm install
cp .env.example .env
# Add free key from https://dashboard.api-football.com/
# API_FOOTBALL_KEY=your_key

npm run demo-cache   # seed public/cache/dashboard.json
npm run dev          # http://localhost:5173
```

### Production API (recommended)

Deploy the Worker in `worker/` to Cloudflare (free):

```bash
cd worker
npx wrangler kv namespace create CACHE
# put the id into wrangler.toml
npx wrangler secret put API_FOOTBALL_KEY
npx wrangler deploy
```

Then set GitHub repo variable `VITE_API_BASE` to the worker URL (no trailing slash), e.g. `https://brasileirao2026-api.you.workers.dev`.

### GitHub Pages

1. Push to GitHub.
2. **Settings → Pages → Source: GitHub Actions**.
3. Site: `https://<user>.github.io/Brasileirao2026/`

## Repo status

This project was scaffolded from the FWC26 cloud agent environment. If you are creating the GitHub repository for the first time:

1. Create an empty public repo named **`Brasileirao2026`** under your account.
2. Tell the agent (or run locally):

```bash
git remote add origin https://github.com/<you>/Brasileirao2026.git
git push -u origin main
```

## Disclaimer

Unofficial fan project. Not affiliated with CBF or Globo. Match data may lag official feeds.

## License

MIT
