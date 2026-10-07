import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BrowserActionCommand } from "../../../src/shared/protocol.js";
import { expect, test } from "../../fixtures/extension-context.js";
import { installRuntimeHarness, resetRuntimeHarness, runWorkerAction } from "../harness.js";

test("production content refuses missing predicates and preserves authored literal text", async ({ extensionSession }, info) => {
  test.setTimeout(60_000);
  const server = createServer((_request, response) => {
    response.setHeader("Content-Type", "text/html");
    response.end('<!doctype html><title>Predicates</title><p id="subject">literal null is present</p><input id="focused" value="unrelated">');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Fixture port missing");
    const page = await extensionSession.context.newPage();
    await page.goto("http://127.0.0.1:" + address.port + "/");
    const tabId = await extensionSession.extensionPage.evaluate(async (url) => {
      const tab = (await chrome.tabs.query({})).find((entry) => entry.url === url);
      if (tab?.id === undefined) throw new Error("Fixture tab missing");
      return tab.id;
    }, page.url());
    const expected = JSON.parse(await readFile(path.join(extensionSession.metadata.artifactPath, "build-info.json"), "utf8")).identity;
    const running = await extensionSession.extensionPage.evaluate(async (id) => chrome.runtime.sendMessage({ type: "fluxiq.buildIdentity", tabId: id }), tabId);
    expect(running).toMatchObject({ ok: true, background: expected, content: expected });
    await mkdir(info.outputDir, { recursive: true });
    await writeFile(info.outputPath("running-build-identity.json"), JSON.stringify({ browser: await extensionSession.extensionPage.evaluate(() => navigator.userAgent), expected, running }, null, 2));
    await installRuntimeHarness(extensionSession.extensionPage);
    await resetRuntimeHarness(extensionSession.extensionPage, tabId);
    const malformed: BrowserActionCommand[] = [
      { commandId: "absent-no-target", actionType: "web.dom.assert", assert: { kind: "absent", timeoutMs: 5_000 } },
      ...[undefined, "", " "].map((expected, index): BrowserActionCommand => ({ commandId: "text-" + index, actionType: "web.dom.assert", assert: { kind: "text", ...(expected === undefined ? {} : { expected }), timeoutMs: 5_000 } })),
      ...[undefined, "", " "].map((text, index): BrowserActionCommand => ({ commandId: "wait-" + index, actionType: "web.dom.wait_for_text", ...(text === undefined ? {} : { text }), timeoutMs: 5_000 }))
    ];
    for (const action of malformed) {
      const started = Date.now();
      const { result } = await runWorkerAction(extensionSession.extensionPage, action);
      expect.soft(result.status, action.commandId).toBe("failed");
      expect.soft(result.validation.status, action.commandId).not.toBe("passed");
      expect.soft(result.failure?.code, action.commandId).toBeTruthy();
      expect.soft(Date.now() - started, action.commandId + " must not poll").toBeLessThan(2_000);
    }
    await page.locator("#focused").focus();
    const valid: BrowserActionCommand[] = [
      { commandId: "absent-targeted", actionType: "web.dom.assert", selector: "#missing", assert: { kind: "absent", timeoutMs: 0 } },
      { commandId: "exists-targeted", actionType: "web.dom.assert", selector: "#subject", assert: { kind: "exists", timeoutMs: 0 } },
      { commandId: "literal-assert", actionType: "web.dom.assert", assert: { kind: "text", expected: "null", timeoutMs: 0 } },
      { commandId: "literal-wait", actionType: "web.dom.wait_for_text", text: "null", timeoutMs: 0 }
    ];
    for (const action of valid) {
      const { result } = await runWorkerAction(extensionSession.extensionPage, action);
      expect(result.status, action.commandId).toBe("succeeded");
      expect(result.validation.status, action.commandId).toBe("passed");
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
