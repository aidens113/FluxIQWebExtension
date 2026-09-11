import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { Page } from "@playwright/test";
import { BrowserEvidenceRecorder } from "../browser-evidence.js";

test("writes bounded screenshot-suppressed diagnostic facts without arbitrary text", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-evidence-diagnostic-"));
  const page = { isClosed: () => false } as unknown as Page;
  try {
    const recorder = new BrowserEvidenceRecorder({
      workspaceDirectory: root,
      scenarioId: "diagnostic-test",
      pages: { panel: page, extension: page, scenario: page },
    });
    await recorder.start();
    await recorder.diagnostic("panel", "stable-flow", "flow-open.stable-flow", {
      searchCleared: true,
      stableIdCandidateCount: 2,
      exactFlowCandidateCount: 1,
      routerChildCount: 0,
      routerTabCount: 0,
    });
    await recorder.diagnostic("panel", "flow-open-complete", "flow-open.complete", { flowOpened: true });
    await recorder.diagnostic("panel", "generation.pre-provider-validation", "flow_bootstrap.active_instructions_required", { providerCallCount: 0 });
    await recorder.diagnostic("extension", "connect-call", "connect.call", { flowOpened: true, scenarioUrlReady: true });
    await recorder.diagnostic("extension", "connect-entry", "connect.entry", {
      contextSelected: false,
      settingsOpened: false,
      gatewayFilled: false,
      apiFilled: false,
      optionsVerified: 0,
      settingsClosed: false,
      connectionRequested: false,
      connected: false,
      pairingRequired: false,
      scenarioTabSelected: false,
      contextRefreshed: false,
    });
    const bundlePath = await recorder.finalize("failed");
    const events = await readFile(path.join(bundlePath, "events.ndjson"), "utf8");
    assert.match(events, /"stage":"stable-flow"/u);
    assert.match(events, /"errorCode":"flow-open\.stable-flow"/u);
    assert.match(events, /"errorCode":"flow_bootstrap\.active_instructions_required"/u);
    assert.match(events, /"stage":"flow-open-complete"/u);
    assert.match(events, /"stage":"connect-call"/u);
    assert.match(events, /"stage":"connect-entry"/u);
    assert.match(events, /"contextRefreshed":false/u);
    assert.equal(events.trim().split("\n").length, 5);
    assert.match(events, /"screenshotSuppressed":"sensitive-action"/u);
    assert.doesNotMatch(events, /screenshotPath/u);
    await assert.rejects(
      () => recorder.diagnostic("panel", "stable-flow", "flow-open.stable-flow", { arbitraryText: "sentinel" as never }),
      /facts are invalid/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});