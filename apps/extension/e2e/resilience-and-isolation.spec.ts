import { stat } from "node:fs/promises";
import { expect, launchExtensionSession, closeExtensionSession, restartServiceWorker, test } from "./fixtures/extension-context";

test("restarts the MV3 worker and answers a production readiness message", async ({ extensionSession }) => {
  const restarted = await restartServiceWorker(extensionSession);
  expect(restarted.url()).toBe(`chrome-extension://${extensionSession.metadata.id}/background/index.js`);

  const status = await extensionSession.extensionPage.evaluate(() => chrome.runtime.sendMessage({ type: "fluxiq.getStatus" }));
  expect(status).toMatchObject({ ok: true });
});

test("uses a fresh profile and removes it after shutdown", async ({ extensionSession }) => {
  await extensionSession.extensionPage.evaluate(() => chrome.storage.local.set({ "e2e.isolation": "first-run" }));
  const second = await launchExtensionSession("isolation-second");
  const secondProfile = second.profilePath;
  try {
    expect(second.profilePath).not.toBe(extensionSession.profilePath);
    const secondValue = await second.extensionPage.evaluate(() => chrome.storage.local.get("e2e.isolation"));
    expect(secondValue["e2e.isolation"]).toBeUndefined();
  } finally {
    await closeExtensionSession(second);
  }
  await expect(stat(secondProfile)).rejects.toMatchObject({ code: "ENOENT" });
});
