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
  // The shared panel's top bar (panel/shell/top-bar.ts). Exact, because the
  // getting-started heading also contains "FluxIQ".
  await expect(extensionPage.getByRole("heading", { name: "FluxIQ", exact: true })).toBeVisible();
  await expect(extensionPage.getByRole("tablist", { name: "FluxIQ" })).toBeVisible();
  await expect(extensionPage.getByRole("button", { name: "Settings" })).toBeVisible();
});

test("mounts the shared panel: getting-started steps until connected, and settings in place", async ({ extensionSession }) => {
  const page = extensionSession.extensionPage;
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.reload();

  // A fresh profile has never paired, so numbered steps replace the chat, with
  // Connect as the button the Lab presses; the chat and the record button wait.
  const start = page.getByRole("region", { name: "Get started" });
  await expect(start).toBeVisible();
  await expect(start.getByRole("heading", { name: "Get started with FluxIQ" })).toBeVisible();
  await expect(page.getByText("Connect this browser so FluxIQ can work in it.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect", exact: true })).toBeEnabled();
  await expect(page.getByRole("tabpanel", { name: "Chat" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Start recording" })).toBeHidden();
  await expect(page.locator("#extractionPanel")).toBeHidden();
  // Picking a tab while not connected keeps the steps on screen.
  await page.getByRole("tab", { name: "Automations" }).click();
  await expect(start).toBeVisible();

  // The gear opens settings in place, carrying the labels the Lab's session
  // setup fills (packages/test-runner/src/demo-workspace/browser-session.ts).
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("region", { name: "Settings" })).toBeVisible();
  await expect(start).toBeHidden();
  for (const label of ["FluxIQ connection address", "FluxIQ web address", "Reconnect automatically", "Record page changes", "Record what I type", "Record page snapshots"]) {
    await expect(page.getByLabel(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Forget this pairing", exact: true })).toBeVisible();

  // Closing settings, or picking a tab, goes back to the steps.
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(start).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Chat" }).click();
  await expect(start).toBeVisible();
  expect(pageErrors).toEqual([]);
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
