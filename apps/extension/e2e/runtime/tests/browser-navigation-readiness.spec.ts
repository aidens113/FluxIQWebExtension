// An explicit `web.browser.tab` open, in a real Chromium with the real
// extension loaded, judged by where each new tab landed: the everything
// store's home page (an ordinary landing), an address the store does not have
// (HTTP 404), and the store's robot check, which only a person can answer.
//
// The robot check is the store's own `robot-check` variant, armed through the
// Lab's control API after the first two opens: while it is armed the store
// serves its "Enter the characters you see below" challenge in place of every
// page, so the third open lands on it at an ordinary address. Each open is
// made once; the tab count proves none was retried.

import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { startScenarioLab, type RunningScenarioLab } from "../../../../scenario-lab/src/server.js";
import { expect, test } from "../../fixtures/extension-context.js";
import { installRuntimeHarness, resetRuntimeHarness, runWorkerAction } from "../harness.js";

const STORE = "/scenarios/everything-store/";

test("explicit open validates ordinary, HTTP404 and person-only robot landings without retrying the open", async ({ extensionSession }, info) => {
  test.setTimeout(90_000);
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url") });
  try {
    const at = (subpath: string) => new URL(subpath, lab.origin).href;
    const page = await extensionSession.context.newPage();
    await page.goto(at(STORE));
    const tabId = await extensionSession.extensionPage.evaluate(async (url) => {
      const tab = (await chrome.tabs.query({})).find((entry) => entry.url === url);
      if (tab?.id === undefined) throw new Error("Scenario tab missing");
      return tab.id;
    }, page.url());
    const expected = JSON.parse(await readFile(path.join(extensionSession.metadata.artifactPath, "build-info.json"), "utf8")).identity;
    const running = await extensionSession.extensionPage.evaluate(async (id) => chrome.runtime.sendMessage({ type: "fluxiq.buildIdentity", tabId: id }), tabId);
    expect(running).toMatchObject({ ok: true, background: expected, content: expected });
    const artifact = info.outputPath("running-build-identity.json");
    await mkdir(info.outputDir, { recursive: true });
    await writeFile(artifact, JSON.stringify({ browser: await extensionSession.extensionPage.evaluate(() => navigator.userAgent), expected, running }, null, 2));
    await info.attach("running-build-identity.json", { contentType: "application/json", path: artifact });
    await installRuntimeHarness(extensionSession.extensionPage);
    await resetRuntimeHarness(extensionSession.extensionPage, tabId);
    const count = () => extensionSession.extensionPage.evaluate(async () => (await chrome.tabs.query({})).length);
    const initial = await count();
    const ordinary = await runWorkerAction(extensionSession.extensionPage, { commandId: "open-ordinary", actionType: "web.browser.tab", tab: { operation: "open", url: at(STORE) } });
    expect(ordinary.result.status, ordinary.result.message).toBe("succeeded");
    expect(ordinary.result.validation.status).toBe("passed");
    const missing = await runWorkerAction(extensionSession.extensionPage, { commandId: "open-404", actionType: "web.browser.tab", tab: { operation: "open", url: at(`${STORE}no-such-aisle`) } });
    expect(missing.result.status, missing.result.message).toBe("failed");
    expect(missing.result.validation).toMatchObject({ status: "failed" });
    expect(missing.result.message).toContain("HTTP 404");
    await armRobotCheck(lab);
    const robot = await runWorkerAction(extensionSession.extensionPage, { commandId: "open-robot", actionType: "web.browser.tab", tab: { operation: "open", url: at(STORE) } });
    expect(robot.result.status, robot.result.message).toBe("failed");
    expect(robot.result.failure?.category).toBe("user_intervention_required");
    expect(await count()).toBe(initial + 3);
    const blank = await runWorkerAction(extensionSession.extensionPage, { commandId: "open-blank", actionType: "web.browser.tab", tab: { operation: "open" } });
    expect(blank.result.status).toBe("succeeded");
    expect(blank.result.validation.status).toBe("passed");
    expect(await count()).toBe(initial + 4);
  } finally {
    await lab.close();
  }
});

/** Arms the store's `robot-check` variant, which serves the challenge in place of every page. */
async function armRobotCheck(lab: RunningScenarioLab): Promise<void> {
  const response = await fetch(`${lab.origin}/__control/arm`, {
    method: "POST",
    headers: { authorization: `Bearer ${lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify({ scenarioId: "everything-store", variantId: "robot-check", workflowId: "first-page-earbuds" })
  });
  if (!response.ok) throw new Error(`arm robot-check answered HTTP ${response.status}: ${await response.text()}`);
}
