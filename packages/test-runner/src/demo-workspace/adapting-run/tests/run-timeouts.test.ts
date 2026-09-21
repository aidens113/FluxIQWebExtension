// An adapting run iterates under Core's run lease, so the demo lanes must wait
// for it as long as the grant may keep calling. Both waits were 60 s, a figure
// from when a repair was one diagnosis and one patch.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { EVIDENCE_GUIDED_CREATION_LIMITS } from "../../../demo-llm-create-ui/index.js";
import { ADAPTING_RUN_TIMEOUT_MS } from "../run-timeouts.js";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "src", "demo-workspace");

test("an adapting run is waited for through the grant's claim window and whole lease", () => {
  const { grantClaimWindowSeconds, runLeaseSeconds } = EVIDENCE_GUIDED_CREATION_LIMITS;
  assert.ok(ADAPTING_RUN_TIMEOUT_MS > (grantClaimWindowSeconds + runLeaseSeconds) * 1_000);
});

test("both adapting-run waits use that timeout, not a fixed minute", async () => {
  const ui = await readFile(path.join(sourceRoot, "adaptation-ui.ts"), "utf8");
  assert.match(ui, /waitForPanelRunResponse\(page, async \(\) =>/u);
  assert.match(ui, /Confirm high-token LLM Execution/u);
  assert.match(ui, /Continue high-token execution/u);
  assert.match(ui, /\}, ADAPTING_RUN_TIMEOUT_MS\)/u);
  const wait = ui.slice(ui.indexOf("export async function waitForAdaptationRun"), ui.indexOf("export function requireCompleteAdaptationIntervention"));
  assert.match(wait, /Date\.now\(\) \+ ADAPTING_RUN_TIMEOUT_MS/u);
  assert.doesNotMatch(wait, /60_000/u);
});
