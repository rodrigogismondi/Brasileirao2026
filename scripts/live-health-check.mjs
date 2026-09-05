#!/usr/bin/env node
/**
 * Detect soft-live / empty-feed failures without hitting GE.
 * Exit 1 when a past-kickoff match is still NS or has no events+stats.
 * Used by the live-cache-sync agent loop for self-heal.
 */
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_DIR = join(ROOT, "public/cache");
const MATCHES_DIR = join(CACHE_DIR, "matches");

function isPastKickoffWindow(ts, nowSec = Math.floor(Date.now() / 1000)) {
  const age = nowSec - Number(ts || 0);
  return age >= 60 && age < 4 * 3600;
}

function main() {
  const dashPath = join(CACHE_DIR, "dashboard.json");
  if (!existsSync(dashPath)) {
    console.error("No dashboard.json");
    process.exit(2);
  }
  const dash = JSON.parse(readFileSync(dashPath, "utf8"));
  const nowSec = Math.floor(Date.now() / 1000);
  const broken = [];

  for (const f of dash.fixtures || []) {
    const ts = f.fixture?.timestamp;
    if (!isPastKickoffWindow(ts, nowSec)) continue;
    const id = f.fixture.id;
    const st = f.fixture?.status?.short || "?";
    const detailPath = join(MATCHES_DIR, `${id}.json`);
    let eventsLen = 0;
    let statsLen = 0;
    let detailStatus = st;
    if (existsSync(detailPath)) {
      try {
        const detail = JSON.parse(readFileSync(detailPath, "utf8"));
        eventsLen = detail.events?.length ?? 0;
        statsLen = detail.statistics?.length ?? 0;
        detailStatus = detail.fixture?.status?.short || st;
      } catch {
        broken.push(`${id}:unreadable`);
        continue;
      }
    } else {
      broken.push(`${id}:missing-detail`);
      continue;
    }
    const emptyFeed = eventsLen === 0 && statsLen === 0;
    const ageMin = Math.floor((nowSec - Number(ts)) / 60);
    // NS after kickoff is always wrong. Empty lances+stats after ~10' usually means
    // enrich stripped the feed (recurring bug) — GE normally has narration by then.
    if (detailStatus === "NS" || (["1H", "HT", "2H", "LIVE"].includes(detailStatus) && emptyFeed && ageMin >= 10)) {
      const home = f.teams?.home?.name || "?";
      const away = f.teams?.away?.name || "?";
      broken.push(`${id} ${home}x${away} status=${detailStatus} events=${eventsLen} stats=${statsLen} age=${ageMin}m`);
    }
  }

  const mode = dash.budget?.mode || "?";
  if (broken.length) {
    console.error(`FAIL mode=${mode} broken=${broken.length}`);
    for (const row of broken) console.error(`  ${row}`);
    process.exit(1);
  }
  console.log(
    `OK mode=${mode} fixtures=${(dash.fixtures || []).length} matchFiles=${existsSync(MATCHES_DIR) ? readdirSync(MATCHES_DIR).length : 0}`
  );
}

main();
