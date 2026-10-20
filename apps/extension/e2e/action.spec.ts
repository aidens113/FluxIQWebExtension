// Actions through the real content-script message path, in a real Chromium
// with the real extension loaded, against the everything store's home page.
//
// Snapshot, type and click are each sent to the tab's content script exactly
// as the background sends them, and each is checked by what the site itself
// shows for it: the snapshot names the header's search button by its test id,
// the typed words sit in the store's search box, and the pressed Accept
// answers the store's cookie banner, which the store records on its server.
//
// The store's notifications prompt and app banner are answered through its
// own API before the page loads, as a returning visitor would have answered
// them: the prompt makes the page inert while it stands, which would turn the
// click into a test of the prompt rather than of the message path.

import { randomBytes } from "node:crypto";
import { startScenarioLab, type RunningScenarioLab } from "../../scenario-lab/src/server.js";
import { expect, test } from "./fixtures/extension-context";

const SCENARIO = "everything-store";

test("executes actions through the real content-script message path", async ({ extensionSession }) => {
  test.setTimeout(60_000);
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url") });
  try {
    await mutate(lab, "dismiss-nudge", { nudge: "notifications" });
    await mutate(lab, "dismiss-nudge", { nudge: "app-banner" });
    const page = await extensionSession.context.newPage();
    await page.goto(new URL(`/scenarios/${SCENARIO}/`, lab.origin).href);
    const banner = page.getByRole("region", { name: "Cookie preferences" });
    await expect(banner).toBeVisible();
    const tabId = await extensionSession.extensionPage.evaluate(async (targetUrl) => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find((candidate) => candidate.url === targetUrl);
      if (typeof tab?.id !== "number") throw new Error(`Scenario tab not found for ${targetUrl}`);
      return tab.id;
    }, page.url());

    const snapshotResult = await sendAction(extensionSession.extensionPage, tabId, {
      commandId: "e2e-snapshot",
      actionType: "web.dom.capture_snapshot"
    });
    expect(snapshotResult).toMatchObject({ commandId: "e2e-snapshot", status: "succeeded" });
    const snapshot = snapshotResult.snapshot as { interactiveElements?: Array<{ tagName?: string; selector?: string }> } | undefined;
    expect(snapshot?.interactiveElements).toEqual(expect.arrayContaining([
      expect.objectContaining({ tagName: "button", selector: '[data-testid="nav-search-submit"]' })
    ]));

    const typeResult = await sendAction(extensionSession.extensionPage, tabId, {
      commandId: "e2e-type",
      actionType: "web.dom.type",
      selector: 'input[name="k"]',
      text: "FluxIQ E2E"
    });
    expect(typeResult).toMatchObject({ commandId: "e2e-type", status: "succeeded" });
    await expect(page.locator('input[name="k"]')).toHaveValue("FluxIQ E2E");

    const clickResult = await sendAction(extensionSession.extensionPage, tabId, {
      commandId: "e2e-click",
      actionType: "web.dom.click",
      selector: '[data-consent="accept"]'
    });
    expect(clickResult).toMatchObject({ commandId: "e2e-click", status: "succeeded" });
    await expect(banner).toBeHidden();
    await expect.poll(async () => (await finalState(lab)).consent).toBe("accepted");
  } finally {
    await lab.close();
  }
});

function sendAction(page: import("@playwright/test").Page, tabId: number, action: Record<string, unknown>): Promise<Record<string, unknown>> {
  return page.evaluate(({ id, command }) => chrome.tabs.sendMessage(id, {
    type: "executeAction",
    topFrameOnly: true,
    action: command
  }), { id: tabId, command: action });
}

/** One of the store's own page operations, sent as its pages send them. */
async function mutate(lab: RunningScenarioLab, operation: string, payload: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${lab.origin}/api/${SCENARIO}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`${operation} answered HTTP ${response.status}`);
}

/** The store's server-side state, which the Lab's oracle reads. */
async function finalState(lab: RunningScenarioLab): Promise<{ consent?: string }> {
  const response = await fetch(`${lab.origin}/__control/final-state?scenario=${SCENARIO}`, {
    headers: { authorization: `Bearer ${lab.runToken}` }
  });
  if (!response.ok) throw new Error(`final-state answered HTTP ${response.status}`);
  return ((await response.json()) as { state: { consent?: string } }).state;
}
