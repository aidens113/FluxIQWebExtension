import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "../../fixtures/extension-context.js";
import { installRuntimeHarness, resetRuntimeHarness, runWorkerAction } from "../harness.js";

test("explicit open validates ordinary, HTTP404 and person-only robot landings without retrying the open", async ({ extensionSession }, info) => {
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "text/html");
    response.statusCode = request.url === "/missing" ? 404 : 200;
    response.end(request.url === "/robot"
      ? '<!doctype html><title>Robot check</title><h1>Confirm you are human</h1><p>Complete the CAPTCHA to continue.</p>'
      : '<!doctype html><title>Landing fixture</title><h1>Ordinary fixture page</h1>');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Fixture port missing");
    const origin = `http://127.0.0.1:${address.port}`;
    const page = await extensionSession.context.newPage();
    await page.goto(`${origin}/start`);
    const tabId = await extensionSession.extensionPage.evaluate(async (url) => {
      const tab = (await chrome.tabs.query({})).find((entry) => entry.url === url);
      if (tab?.id === undefined) throw new Error("Fixture tab missing");
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
    const ordinary = await runWorkerAction(extensionSession.extensionPage, { commandId: "open-ordinary", actionType: "web.browser.tab", tab: { operation: "open", url: `${origin}/ordinary` } });
    expect(ordinary.result.status, ordinary.result.message).toBe("succeeded");
    expect(ordinary.result.validation.status).toBe("passed");
    const missing = await runWorkerAction(extensionSession.extensionPage, { commandId: "open-404", actionType: "web.browser.tab", tab: { operation: "open", url: `${origin}/missing` } });
    expect(missing.result.status, missing.result.message).toBe("failed");
    expect(missing.result.validation).toMatchObject({ status: "failed" });
    expect(missing.result.message).toContain("HTTP 404");
    const robot = await runWorkerAction(extensionSession.extensionPage, { commandId: "open-robot", actionType: "web.browser.tab", tab: { operation: "open", url: `${origin}/robot` } });
    expect(robot.result.status, robot.result.message).toBe("failed");
    expect(robot.result.failure?.category).toBe("user_intervention_required");
    expect(await count()).toBe(initial + 3);
    const blank = await runWorkerAction(extensionSession.extensionPage, { commandId: "open-blank", actionType: "web.browser.tab", tab: { operation: "open" } });
    expect(blank.result.status).toBe("succeeded");
    expect(blank.result.validation.status).toBe("passed");
    expect(await count()).toBe(initial + 4);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
