// The requests setting in the real extension: unavailable, and persisted OFF
// whatever is written to storage. A tab on a realistic Scenario Lab page (the
// everything store's home page) is where the running content script reports
// the build identity the check below compares with the artifact's.

import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { startScenarioLab } from "../../../../scenario-lab/src/server.js";
import { expect, restartServiceWorker, test } from "../../fixtures/extension-context.js";

test("requests Settings stays unavailable and persisted OFF in the actual extension", async ({ extensionSession }, info) => {
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url") });
  try {
  const fixture = await extensionSession.context.newPage();
  await fixture.goto(new URL("/scenarios/everything-store/", lab.origin).href);
  const page = extensionSession.extensionPage;
  const tabId = await page.evaluate(async url => (await chrome.tabs.query({})).find(tab => tab.url === url)?.id, fixture.url());
  if (tabId === undefined) throw new Error("Missing the scenario tab");
  const expected = JSON.parse(await readFile(path.join(extensionSession.metadata.artifactPath, "build-info.json"), "utf8")).identity;
  const running = await page.evaluate(id => chrome.runtime.sendMessage({ type: "fluxiq.buildIdentity", tabId: id }), tabId);
  expect(running).toMatchObject({ ok: true, background: expected, content: expected });
  const saved = await page.evaluate(() => chrome.runtime.sendMessage({ type: "fluxiq.panel.saveSettings", settings: { requestsEnabled: true, autoReconnect: false } }));
  expect(saved).toMatchObject({ ok: true });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const requests = page.getByRole("checkbox", { name: "Allow direct requests", exact: true });
  await expect(requests).toBeDisabled();
  await expect(requests).not.toBeChecked();
  await expect(page.getByText("Unavailable in this version.", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "Reconnect automatically", exact: true }).uncheck();
  await requests.evaluate((element) => { (element as HTMLInputElement).checked = true; element.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
  const read = () => page.evaluate(async () => {
    const settings = (await chrome.storage.local.get("fluxiq.settings"))["fluxiq.settings"];
    return { requestsEnabled: settings.requestsEnabled, autoReconnect: settings.autoReconnect };
  });
  expect(await read()).toEqual({ requestsEnabled: false, autoReconnect: false });
  await page.evaluate(async () => {
    const settings = (await chrome.storage.local.get("fluxiq.settings"))["fluxiq.settings"];
    await chrome.storage.local.set({ "fluxiq.settings": { ...settings, requestsEnabled: true } });
  });
  await restartServiceWorker(extensionSession);
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(requests).toBeDisabled();
  await expect(requests).not.toBeChecked();
  await expect.poll(read).toEqual({ requestsEnabled: false, autoReconnect: false });
  await info.attach("requests-foundation", { contentType: "application/json", body: JSON.stringify({ identity: expected, browser: await page.evaluate(() => navigator.userAgent), available: false, persistedEnabled: false }) });
  } finally {
    await lab.close();
  }
});
