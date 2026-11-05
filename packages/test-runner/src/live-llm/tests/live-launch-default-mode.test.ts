// The live-run guards ledger a launch under its authoring mode, and `scripts/` resolves no
// workspace package, so `scripts/lab/live-guards/live-launch.mjs` restates the product's default.
// This is what stops that copy drifting: when the product's default flips, this fails until the
// restated word moves with it, because the `unchanged` rule compares a launch with runs of its mode.

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { AUTOMATION_STUDIO_AUTHORING_MODE_DEFAULT } from "fluxiq/automation";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
const GUARD = path.join(REPOSITORY_ROOT, "scripts", "lab", "live-guards", "live-launch.mjs");

test("a live launch naming no mode is ledgered under the product's default", async () => {
  const guard = await import(pathToFileURL(GUARD).href) as { describeLiveLaunch(args: string[], env: NodeJS.ProcessEnv): { authoringMode: string } | null };
  const launch = guard.describeLiveLaunch(["run", "company-website", "--task", "company-website-apprentices", "--live-llm"], {});
  assert.equal(launch?.authoringMode, AUTOMATION_STUDIO_AUTHORING_MODE_DEFAULT);
});
