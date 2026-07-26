import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { demoDashboard, demoMatchDetail } from "../server/demo-data.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = join(root, "public", "cache");
const matchesDir = join(cacheDir, "matches");
mkdirSync(matchesDir, { recursive: true });

const payload = demoDashboard();
writeFileSync(join(cacheDir, "dashboard.json"), JSON.stringify(payload, null, 2));

for (const f of payload.fixtures as Array<{ fixture: { id: number } }>) {
  const detail = demoMatchDetail(f.fixture.id);
  writeFileSync(join(matchesDir, `${f.fixture.id}.json`), JSON.stringify(detail, null, 2));
}

const fla = (payload.fixtures as Array<{ teams: { home: { name: string } }; goals: { home: number | null }; fixture: { id: number } }>).find(
  (f) => f.teams.home.name === "Flamengo"
);
const detail = demoMatchDetail(fla!.fixture.id) as {
  events: Array<{ player: { name: string }; type: string }>;
  lineups: Array<{ coach: { name: string }; startXI: Array<{ player: { name: string } }> }>;
};

console.log("Wrote demo cache +", payload.fixtures.length, "match details");
console.log(
  "Flamengo score",
  fla!.goals.home,
  "| events:",
  detail.events.map((e) => `${e.type}:${e.player.name}`).join(", ")
);
console.log("Flamengo coach:", detail.lineups[0].coach.name, "| XI0:", detail.lineups[0].startXI[0].player.name);
