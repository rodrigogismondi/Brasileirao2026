/**
 * Seeds public/cache from server/demo-data.ts (single source of truth).
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const helper = join(root, "scripts", "_write-demo-cache.mts");

const result = spawnSync(process.execPath, ["--experimental-strip-types", helper], {
  cwd: root,
  encoding: "utf8",
  env: process.env,
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
