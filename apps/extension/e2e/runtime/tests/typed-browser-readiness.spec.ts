import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TestInfo } from "@playwright/test";
import type { ExtensionSession } from "../../fixtures/extension-context.js";
import { expect, test } from "../../fixtures/extension-context.js";
import { installRuntimeHarness, resetRuntimeHarness, runWorkerAction } from "../harness.js";

// A local controlled-component simulation, not React: click is the application's
// state transition; change reconciles DOM to that application state. The server
// supplies the fixture; production content executes the actions.
const FIXTURE = `<!doctype html><title>Typed readiness fixture</title>
<label><input id="controlled" type="checkbox">Controlled checkbox</label>
<label><input id="radio" name="choice" type="radio">Radio choice</label>
<label><input id="reverted" type="checkbox">Reverted checkbox</label>
<label><input id="deferred" type="checkbox">Deferred revert checkbox</label>
<label><input id="detached" type="checkbox">Detached checkbox</label>
<ol id="items"><li data-row="one"><a href="/detail/one">First record</a></li></ol>
<button id="next">Next</button><button id="unchanged">More</button>
<script>
window.proof={checked:false,clicks:0,radioClicks:0,nextClicks:0,unchangedClicks:0};
const controlled=document.querySelector('#controlled');
controlled.addEventListener('click',()=>{proof.clicks++;proof.checked=controlled.checked;});
controlled.addEventListener('change',()=>{controlled.checked=proof.checked;});
document.querySelector('#radio').addEventListener('click',()=>proof.radioClicks++);
document.querySelector('#reverted').addEventListener('change',e=>{e.target.checked=false;});
document.querySelector('#deferred').addEventListener('change',e=>{queueMicrotask(()=>{e.target.checked=false;});});
document.querySelector('#detached').addEventListener('change',e=>{e.target.replaceWith(e.target.cloneNode());});
document.querySelector('#next').addEventListener('click',e=>{
 proof.nextClicks++;const row=document.querySelector('[data-row]');
 row.dataset.row='two';row.querySelector('a').textContent='Second record';
 row.querySelector('a').href='/detail/two';e.target.disabled=true;
});
document.querySelector('#unchanged').addEventListener('click',()=>proof.unchangedClicks++);
</script>`;

async function recordIdentity(session: ExtensionSession, tabId: number, info: TestInfo): Promise<void> {
  const expected = JSON.parse(await readFile(path.join(session.metadata.artifactPath, "build-info.json"), "utf8")).identity;
  const running = await session.extensionPage.evaluate(async (id) => {
    return await chrome.runtime.sendMessage({ type: "fluxiq.buildIdentity", tabId: id });
  }, tabId);
  expect(running).toMatchObject({ ok: true, background: expected, content: expected });
  const artifact = info.outputPath("running-build-identity.json");
  await mkdir(info.outputDir, { recursive: true });
  const browser = await session.extensionPage.evaluate(() => navigator.userAgent);
  await writeFile(artifact, JSON.stringify({ browser, expected, running }, null, 2));
  await info.attach("running-build-identity.json", { contentType: "application/json", path: artifact });
}

test.beforeEach(async ({ extensionSession }) => {
  await installRuntimeHarness(extensionSession.extensionPage);
});

test("controlled check reaches application state once; no-op, radio refusal and reverts remain truthful", async ({ extensionSession }, info) => {
  const server = createServer((_request, response) => { response.setHeader("Content-Type", "text/html"); response.end(FIXTURE); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No fixture port");
    const page = await extensionSession.context.newPage();
    await page.goto(`http://127.0.0.1:${address.port}/readiness`);
    const tabId = await extensionSession.extensionPage.evaluate(async (url) => {
      const tab = (await chrome.tabs.query({})).find((entry) => entry.url === url);
      if (tab?.id === undefined) throw new Error("Fixture tab missing");
      return tab.id;
    }, page.url());
    await resetRuntimeHarness(extensionSession.extensionPage, tabId);
    await recordIdentity(extensionSession, tabId, info);
    const act = (selector: string, checked: boolean) => runWorkerAction(extensionSession.extensionPage, {
      commandId: `check-${selector}-${checked}`, actionType: "web.dom.check", selector, checked
    }, { activeTabId: tabId });
    const on = await act("#controlled", true);
    expect(on.result.status, on.result.message).toBe("succeeded");
    expect(await page.evaluate(() => (globalThis as unknown as { proof: unknown }).proof)).toMatchObject({ checked: true, clicks: 1 });
    expect((await act("#controlled", true)).result.message).toContain("already set");
    expect(await page.evaluate(() => (globalThis as unknown as { proof: { clicks: number } }).proof.clicks)).toBe(1);
    expect((await act("#controlled", false)).result.status).toBe("succeeded");
    expect(await page.evaluate(() => (globalThis as unknown as { proof: unknown }).proof)).toMatchObject({ checked: false, clicks: 2 });
    expect((await act("#radio", true)).result.status).toBe("succeeded");
    expect((await act("#radio", true)).result.message).toContain("already set");
    expect((await act("#radio", false)).result.status).toBe("failed");
    expect(await page.evaluate(() => (globalThis as unknown as { proof: { radioClicks: number } }).proof.radioClicks)).toBe(1);
    expect((await act("#reverted", true)).result.status).toBe("failed");
    expect((await act("#deferred", true)).result.status).toBe("failed");
    expect((await act("#detached", true)).result.status).toBe("failed");
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
});

test("Next observes semantic mutation in existing row once and distinguishes disabled end and unchanged timeout", async ({ extensionSession }, info) => {
  const server = createServer((_request, response) => { response.setHeader("Content-Type", "text/html"); response.end(FIXTURE); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No fixture port");
    const page = await extensionSession.context.newPage();
    await page.goto(`http://127.0.0.1:${address.port}/readiness`);
    const tabId = await extensionSession.extensionPage.evaluate(async (url) => {
      const tab = (await chrome.tabs.query({})).find((entry) => entry.url === url);
      if (tab?.id === undefined) throw new Error("Fixture tab missing");
      return tab.id;
    }, page.url());
    await resetRuntimeHarness(extensionSession.extensionPage, tabId);
    await recordIdentity(extensionSession, tabId, info);
    const move = (selector: string) => runWorkerAction(extensionSession.extensionPage, {
      commandId: `next-${selector}`, actionType: "web.dom.next_page", timeoutMs: 3000,
      nextPage: { item: "#items > li", pagination: { next: selector } }
    }, { activeTabId: tabId });
    const moved = await move("#next");
    expect(moved.result.status, moved.result.message).toBe("succeeded");
    expect(moved.result.nextPage).toMatchObject({ outcome: "moved" });
    await expect(page.locator("#items")).toHaveText("Second record");
    const ended = await move("#next");
    expect(ended.result.nextPage).toMatchObject({ outcome: "ended", stop: "control_disabled" });
    const unchanged = await move("#unchanged");
    expect(unchanged.result.status).not.toBe("succeeded");
    expect(unchanged.result.nextPage?.outcome).not.toBe("ended");
    expect(await page.evaluate(() => (globalThis as unknown as { proof: unknown }).proof)).toMatchObject({ nextClicks: 1, unchangedClicks: 1 });
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
});
