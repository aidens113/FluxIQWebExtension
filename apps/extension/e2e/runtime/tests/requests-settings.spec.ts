import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, restartServiceWorker, test } from "../../fixtures/extension-context.js";

test("requests Settings stays unavailable and persisted OFF in the actual extension", async ({ extensionSession }, info) => {
  const server = createServer((_request, response) => response.end("<!doctype html><title>Requests policy fixture</title>"));
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing owned fixture port");
  const fixture = await extensionSession.context.newPage();
  await fixture.goto(`http://127.0.0.1:${address.port}/policy`);
  const page = extensionSession.extensionPage;
  const tabId = await page.evaluate(async url => (await chrome.tabs.query({})).find(tab => tab.url === url)?.id, fixture.url());
  if (tabId === undefined) throw new Error("Missing owned fixture tab");
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
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Owned fixture close timed out")), 2000);
      server.close(error => { clearTimeout(timeout); if (error) reject(error); else resolve(); });
    });
  }
});
