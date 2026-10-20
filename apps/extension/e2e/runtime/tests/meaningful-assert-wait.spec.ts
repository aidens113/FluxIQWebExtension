// Assertion and wait predicates in the real extension's content script: a
// predicate with nothing to check is refused at once, and the literal text
// "null" is text to look for, not a missing value.
//
// The page is bigbox-retail's results for a search for "null", which the store
// echoes ("Results for “null”", "We couldn't find results for
// “null”"): the word is on the page because a person searched for it.
// The sort select is focused first, so an untargeted predicate that read the
// focused control instead of the page would not find the word. The store's
// cookie dialog and email offer are answered through its own API first, as a
// returning visitor would have answered them, so nothing stands over the page.
//
// Blocked on t732 (sensitive to a product defect, not to this page): a blank
// `web.dom.wait_for_text` makes `requireText` in
// src/content/action-runtime/wait-conditions.ts throw a plain Error, which the
// recovery ladder retries three times, so the wait refusals take over 2 s.
// The 2 s bound stays: it is the claim that a refusal is immediate. Until t732
// makes the wait refusal non-retryable, as `assert.ts` already is, the wait rows
// here fail.

import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { startScenarioLab, type RunningScenarioLab } from "../../../../scenario-lab/src/server.js";
import type { BrowserActionCommand } from "../../../src/shared/protocol.js";
import { expect, test } from "../../fixtures/extension-context.js";
import { installRuntimeHarness, resetRuntimeHarness, runWorkerAction } from "../harness.js";

test("production content refuses missing predicates and preserves authored literal text", async ({ extensionSession }, info) => {
  test.setTimeout(60_000);
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url") });
  try {
    await mutate(lab, "consent", { choice: "accept" });
    await mutate(lab, "dismiss-promo", {});
    const page = await extensionSession.context.newPage();
    await page.goto(new URL("/scenarios/bigbox-retail/search?q=null", lab.origin).href);
    await expect(page.getByRole("heading", { name: "Results for “null”" })).toBeVisible();
    const tabId = await extensionSession.extensionPage.evaluate(async (url) => {
      const tab = (await chrome.tabs.query({})).find((entry) => entry.url === url);
      if (tab?.id === undefined) throw new Error("Scenario tab missing");
      return tab.id;
    }, page.url());
    const expected = JSON.parse(await readFile(path.join(extensionSession.metadata.artifactPath, "build-info.json"), "utf8")).identity;
    const running = await extensionSession.extensionPage.evaluate(async (id) => chrome.runtime.sendMessage({ type: "fluxiq.buildIdentity", tabId: id }), tabId);
    expect(running).toMatchObject({ ok: true, background: expected, content: expected });
    await mkdir(info.outputDir, { recursive: true });
    await writeFile(info.outputPath("running-build-identity.json"), JSON.stringify({ browser: await extensionSession.extensionPage.evaluate(() => navigator.userAgent), expected, running }, null, 2));
    await installRuntimeHarness(extensionSession.extensionPage);
    await resetRuntimeHarness(extensionSession.extensionPage, tabId);
    const malformed: BrowserActionCommand[] = [
      { commandId: "absent-no-target", actionType: "web.dom.assert", assert: { kind: "absent", timeoutMs: 5_000 } },
      ...[undefined, "", " "].map((expected, index): BrowserActionCommand => ({ commandId: "text-" + index, actionType: "web.dom.assert", assert: { kind: "text", ...(expected === undefined ? {} : { expected }), timeoutMs: 5_000 } })),
      ...[undefined, "", " "].map((text, index): BrowserActionCommand => ({ commandId: "wait-" + index, actionType: "web.dom.wait_for_text", ...(text === undefined ? {} : { text }), timeoutMs: 5_000 }))
    ];
    for (const action of malformed) {
      const started = Date.now();
      const { result } = await runWorkerAction(extensionSession.extensionPage, action);
      expect.soft(result.status, action.commandId).toBe("failed");
      expect.soft(result.validation.status, action.commandId).not.toBe("passed");
      expect.soft(result.failure?.code, action.commandId).toBeTruthy();
      expect.soft(Date.now() - started, action.commandId + " must not poll").toBeLessThan(2_000);
    }
    await page.locator('select[name="sort"]').focus();
    const valid: BrowserActionCommand[] = [
      // The product page's add-to-cart test id is not on a results page.
      { commandId: "absent-targeted", actionType: "web.dom.assert", selector: '[data-testid="atc"]', assert: { kind: "absent", timeoutMs: 0 } },
      { commandId: "exists-targeted", actionType: "web.dom.assert", selector: "h1", assert: { kind: "exists", timeoutMs: 0 } },
      { commandId: "literal-assert", actionType: "web.dom.assert", assert: { kind: "text", expected: "null", timeoutMs: 0 } },
      { commandId: "literal-wait", actionType: "web.dom.wait_for_text", text: "null", timeoutMs: 0 }
    ];
    for (const action of valid) {
      const { result } = await runWorkerAction(extensionSession.extensionPage, action);
      expect(result.status, action.commandId).toBe("succeeded");
      expect(result.validation.status, action.commandId).toBe("passed");
    }
  } finally {
    await lab.close();
  }
});

/** One of the store's own page operations, sent as its pages send them. */
async function mutate(lab: RunningScenarioLab, operation: string, payload: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${lab.origin}/api/bigbox-retail/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`${operation} answered HTTP ${response.status}`);
}
