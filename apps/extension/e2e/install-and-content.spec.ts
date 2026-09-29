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
  // The shared panel shell's header (panel/shell/header.ts). Exact, because the
  // status card's sentences also contain "FluxIQ".
  await expect(extensionPage.getByRole("heading", { name: "FluxIQ", exact: true })).toBeVisible();
  await expect(extensionPage.getByRole("radiogroup", { name: "View" })).toBeVisible();
  await expect(extensionPage.getByRole("button", { name: "Settings" })).toBeVisible();
});

test("mounts the shared panel: status card, record control, and a remembered view switch", async ({ extensionSession }) => {
  const page = extensionSession.extensionPage;
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.reload();

  // A fresh profile has never paired, so the status card asks to connect and
  // the record control says why it is disabled instead of being silently off.
  await expect(page.getByText("FluxIQ isn't connected", { exact: true })).toBeVisible();
  await expect(page.getByText("Connect this browser so FluxIQ can work in it.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect", exact: true })).toBeEnabled();
  const record = page.getByRole("button", { name: "Start recording" });
  await expect(record).toBeDisabled();
  await expect(page.getByText("Connect to FluxIQ to record.", { exact: true })).toBeVisible();
  // The extraction entry appears only while recording; its sheet is built but closed.
  await expect(page.getByRole("button", { name: "Extract Data From This Page", exact: true })).toBeHidden();
  await expect(page.locator("#extractionPanel")).toBeHidden();

  const view = page.getByRole("radiogroup", { name: "View" });
  await expect(view.getByRole("radio", { name: "Simple" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(view.getByRole("radio", { name: "Advanced" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("region", { name: "Advanced" })).toBeVisible();
  await expect(record).toBeHidden();
  // The gear opens Advanced on its Connection tab, carrying the settings under the
  // labels the Lab's session setup fills (packages/test-runner/src/demo-workspace/browser-session.ts).
  for (const label of ["FluxIQ connection address", "FluxIQ web address", "Reconnect automatically", "Record page changes", "Record what I type", "Record page snapshots"]) {
    await expect(page.getByLabel(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();

  // The choice survives closing and reopening the panel, and Simple returns to it.
  await page.reload();
  await expect(page.getByRole("radiogroup", { name: "View" }).getByRole("radio", { name: "Advanced" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radiogroup", { name: "View" }).getByRole("radio", { name: "Simple" }).click();
  await expect(page.getByRole("radiogroup", { name: "View" }).getByRole("radio", { name: "Simple" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "Start recording" })).toBeVisible();
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
