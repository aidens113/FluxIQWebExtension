// The factory's contract without a browser: it launches none until an action
// needs one, refuses what a snapshot cannot answer before launching, and
// closes only a browser it launched. The sandbox itself is proved headed on
// realistic scenarios (`apps/extension/e2e/content/tests/offline-reads/`).

import assert from "node:assert/strict";
import test from "node:test";
import type { Browser } from "@playwright/test";
import type { WebAutomationActionCommand, WebPageSnapshot } from "@fluxiq-web-extension/domain/node";
import { openWebSnapshotPage } from "../open-web-snapshot-page.js";

const CONTENT = { contentScript: "", pageWorldScript: "", actionMessage: (action: WebAutomationActionCommand) => ({ type: "executeAction", action }) };
const SNAPSHOT: WebPageSnapshot = {
  url: "http://127.0.0.1:4100/scenarios/site/list",
  primary: { sha256: "a", mediaType: "text/html", role: "primary", source: "http://127.0.0.1:4100/scenarios/site/list", bytes: new TextEncoder().encode("<p>a</p>") },
  resources: [],
  unavailable: 0
};
const READ: WebAutomationActionCommand = { commandId: "r", actionType: "web.dom.extract_list", extractList: { item: "p", fields: {}, minItems: 0 } };
const untouchable = new Proxy({}, { get: () => assert.fail("the browser was used") }) as Browser;

test("an action addressed to a child frame is unavailable, and no browser is touched", async () => {
  const page = openWebSnapshotPage({ content: CONTENT, browser: untouchable });
  for (const action of [{ ...READ, frameId: 3 }, { ...READ, frameUrlPath: "/frames/inner" }]) {
    const evaluation = await page.evaluate(SNAPSHOT, action);
    assert.equal(evaluation.status, "unavailable");
    if (evaluation.status === "unavailable") {
      assert.equal(evaluation.reason, "snapshot_unavailable");
      assert.match(evaluation.detail, /child frame/u);
    }
  }
  await page.close();
});

test("a snapshot whose primary is not a document is unavailable before any browser is touched", async () => {
  const page = openWebSnapshotPage({ content: CONTENT, browser: untouchable });
  const evaluation = await page.evaluate({ ...SNAPSHOT, primary: { ...SNAPSHOT.primary, mediaType: "application/json" } }, READ);
  assert.deepEqual(evaluation, { status: "unavailable", reason: "snapshot_unavailable", detail: "the snapshot's primary part is application/json, not a document" });
});

test("closing a page that launched nothing, or was given its browser, closes nothing", async () => {
  await openWebSnapshotPage({ content: CONTENT }).close();
  await openWebSnapshotPage({ content: CONTENT, browser: untouchable }).close();
});
