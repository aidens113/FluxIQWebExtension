// The Flow Settings driver and the adapting lanes that call it. Flow Settings
// has no call limit: a diagnosis is always one call, and an adapting run
// iterates for as many provider calls as it needs, so the driver must never
// look for a call-count field and a lane that pins a count is misleading. These
// lanes drive a real browser and panel, so their call sites and field tables
// are held here at source level.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourceDirectory = path.resolve(import.meta.dirname, "../../../../../packages/test-runner/src/demo-workspace");
const source = (name: string) => readFile(path.join(sourceDirectory, name), "utf8");

function settingsDriver(text: string): string {
  const start = text.indexOf("export async function configureFirstLiveDiagnosisViaUi");
  assert.notEqual(start, -1);
  const end = text.indexOf("export async function", start + 40);
  return text.slice(start, end);
}

test("the settings driver types no call count for either run", async () => {
  const text = await source("diagnosis-ui.ts");
  const body = settingsDriver(text);
  assert.match(body, /run: "diagnosis" \| "adaptation" = "diagnosis"/u);
  const limits = /run === "adaptation"\s*\?\s*(\[[^\n]*\])\s*:\s*(\[[^\n]*\]);/u.exec(body);
  assert.ok(limits, "the driver chooses its per-run limits in one place");
  assert.match(limits[1]!, /FIRST_LIVE_ADAPTATION_PROFILE\.budget\.maxTotalTokensPerRequest/u);
  assert.equal(limits[2], '[["Input tokens", "2000"], ["Output tokens", "512"], ["Total tokens", "3000"]]');
  assert.match(body, /\["Timeout \(seconds\)", "20"\], \["Max cost \(USD\)", "0\.25"\], \["Provider retries", "0"\]/u);
  // The Settings form has no such field, so no path through this file looks for one.
  assert.doesNotMatch(text, /max calls/iu);
});

test("adapting lanes never pin a call count or require an exact one", async () => {
  for (const name of ["adaptation-lane.ts", "exploration-adaptation.ts"]) {
    const text = await source(name);
    const calls = text.match(/configureFirstLiveDiagnosisViaUi\([^)]*\)/gu) ?? [];
    assert.ok(calls.length > 0, name);
    for (const call of calls) assert.match(call, /, "adaptation"\)$/u, `${name}: ${call}`);
    assert.doesNotMatch(text, /providerCallCount \?\? 0\) !== \d|providerCallCount !== \d/u, name);
    assert.match(text, /adaptationCallCountWithinGrant\(/u, name);
  }
});

test("the diagnosis lane keeps its exactly-one-call settings", async () => {
  const text = await source("diagnosis-lanes.ts");
  assert.match(text, /configureFirstLiveDiagnosisViaUi\(panelPage, flowTreeItemId, config\.pin, evidence\)/u);
});
