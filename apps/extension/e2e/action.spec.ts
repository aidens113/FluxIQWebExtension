import { expect, test } from "./fixtures/extension-context";
import { startScenarioPage } from "./fixtures/scenario-page";

test("executes actions through the real content-script message path", async ({ extensionSession }) => {
  const scenario = await startScenarioPage();
  try {
    const page = await extensionSession.context.newPage();
    await page.goto(scenario.origin);
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
      expect.objectContaining({ tagName: "textarea", selector: '[data-testid="instruction-name-adapted"]' })
    ]));

    const typeResult = await sendAction(extensionSession.extensionPage, tabId, {
      commandId: "e2e-type",
      actionType: "web.dom.type",
      selector: "[data-testid=name]",
      text: "FluxIQ E2E"
    });
    expect(typeResult).toMatchObject({ commandId: "e2e-type", status: "succeeded" });

    const clickResult = await sendAction(extensionSession.extensionPage, tabId, {
      commandId: "e2e-click",
      actionType: "web.dom.click",
      selector: "[data-testid=submit]"
    });
    expect(clickResult).toMatchObject({ commandId: "e2e-click", status: "succeeded" });
    await expect(page.getByTestId("result")).toHaveText("FluxIQ E2E");
  } finally {
    await scenario.close();
  }
});

function sendAction(page: import("@playwright/test").Page, tabId: number, action: Record<string, unknown>): Promise<Record<string, unknown>> {
  return page.evaluate(({ id, command }) => chrome.tabs.sendMessage(id, {
    type: "executeAction",
    topFrameOnly: true,
    action: command
  }), { id: tabId, command: action });
}
