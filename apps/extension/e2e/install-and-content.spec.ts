import { expect, test } from "./fixtures/extension-context";
import { startScenarioPage } from "./fixtures/scenario-page";

test("loads the current MV3 artifact and its extension page", async ({ extensionSession }) => {
  const { extensionPage, metadata, worker } = extensionSession;
  const runtimeManifest = await worker.evaluate(() => chrome.runtime.getManifest());

  expect(metadata.id).toMatch(/^[a-p]{32}$/);
  expect(metadata.artifactSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(runtimeManifest.manifest_version).toBe(3);
  expect(runtimeManifest.name).toBe(metadata.name);
  expect(runtimeManifest.version).toBe(metadata.version);
  await expect(extensionPage).toHaveURL(`chrome-extension://${metadata.id}/sidepanel/index.html`);
  await expect(extensionPage.getByRole("heading", { name: "FluxIQ Recorder" })).toBeVisible();
});

test("injects the content script into a loopback scenario page", async ({ extensionSession }) => {
  const scenario = await startScenarioPage();
  try {
    const page = await extensionSession.context.newPage();
    await page.goto(scenario.origin);
    const tabId = await tabIdFor(extensionSession.extensionPage, page.url());
    const response = await extensionSession.extensionPage.evaluate(async (id) => (
      chrome.tabs.sendMessage(id, { type: "fluxiq.ping" })
    ), tabId);
    expect(response).toMatchObject({ ok: true, active: true, version: 2 });
  } finally {
    await scenario.close();
  }
});

async function tabIdFor(extensionPage: import("@playwright/test").Page, url: string): Promise<number> {
  return extensionPage.evaluate(async (targetUrl) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((candidate) => candidate.url === targetUrl);
    if (typeof tab?.id !== "number") throw new Error(`Scenario tab not found for ${targetUrl}`);
    return tab.id;
  }, url);
}
