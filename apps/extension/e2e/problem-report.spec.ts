import { expect, restartServiceWorker, test } from "./fixtures/extension-context";

// "Report a problem" (plan 4.8) in the real side panel: the Connection tab asks
// the background for its redacted bundle and hands it to the person, and the
// bundle carries no pairing token even though one is stored.

const TOKEN = "e2e-secret-pairing-token-7731";

test("the Connection tab makes a problem report that names the extension and never the pairing token", async ({ extensionSession }) => {
  const page = extensionSession.extensionPage;
  await page.evaluate(async (token) => {
    await chrome.storage.local.set({
      "fluxiq.clientId": "extension-e2e-report",
      "fluxiq.session": { clientId: "extension-e2e-report", token },
      "fluxiq.settings": { gatewayUrl: "ws://127.0.0.1:9/client?token=leak", coreApiUrl: "http://127.0.0.1:9/", autoReconnect: false, captureMutations: true, captureInputValues: true, captureSnapshots: true }
    });
  }, TOKEN);
  // The worker reads settings and the session when it starts, as after a browser restart.
  await restartServiceWorker(extensionSession);

  const answer = await page.evaluate(() => chrome.runtime.sendMessage({ type: "fluxiq.panel.reportProblem" })) as { ok: boolean; report?: Record<string, unknown> };
  expect(answer.ok).toBe(true);
  expect(answer.report).toMatchObject({ schema: "fluxiq.problem-report/1", extension: { version: extensionSession.metadata.version }, connection: { gatewayOrigin: "ws://127.0.0.1:9" } });
  const text = JSON.stringify(answer.report);
  expect(text).not.toContain(TOKEN);
  expect(text).not.toContain("token=leak");

  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Report a problem" }).click();
  await expect(page.getByRole("link", { name: "Save report" })).toBeVisible();
  await expect(page.getByText(/Problem report copied|Use Save report to keep it as a file/)).toBeVisible();
  const saved = await page.getByRole("link", { name: "Save report" }).getAttribute("download");
  expect(saved).toMatch(/^fluxiq-problem-report-\d{8}T\d{6}\.json$/);
});
