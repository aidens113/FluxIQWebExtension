import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "../../fixtures/extension-context.js";
import { installRuntimeHarness, resetRuntimeHarness, runWorkerAction } from "../harness.js";
const html = `<!doctype html><title>Native sanitized typing</title><form>
<label>Quantity<input id="number" type="number" step="any" value="7"></label>
<label>Date<input id="date" type="date" value="2026-09-01"></label>
<label>Time<input id="time" type="time"></label>
<label>Month<input id="month" type="month"></label>
<label>Week<input id="week" type="week"></label>
<label>Local datetime<input id="datetime" type="datetime-local"></label>
<label>Key cancelled<input id="keycancelled" type="number" value="4"></label>
<label>Revert<input id="revert" type="number" value="8"></label>
<label>Cancelled<input id="cancelled" type="date" value="2026-09-01"></label>
<label>Readonly<input id="readonly" type="number" readonly value="9"></label>
<label>Detached text<input id="detached-text" type="text"></label>
<label>Detached number<input id="detached-number" type="number" value="7"></label>
<label>Password<input id="password" type="password"></label>
<label>Search<input id="text" type="text"></label><button>Submit</button></form>
<script>window.proof={submits:0,textInputs:[],numberInputs:[],detachedEnters:0};
document.querySelector('form').addEventListener('submit',e=>{e.preventDefault();proof.submits++;});
document.querySelector('#text').addEventListener('input',e=>proof.textInputs.push(e.target.value));
document.querySelector('#number').addEventListener('input',e=>proof.numberInputs.push(e.target.value));
document.querySelector('#keycancelled').addEventListener('keydown',e=>{if(e.key==='.')e.preventDefault();});
document.querySelector('#revert').addEventListener('input',e=>e.target.value='8');
document.querySelector('#cancelled').addEventListener('beforeinput',e=>e.preventDefault());
for(const id of ['detached-text','detached-number']){
 const field=document.getElementById(id);
 field.addEventListener('keydown',e=>{if(e.key==='Enter')proof.detachedEnters++;});
 field.addEventListener(id==='detached-text'?'input':'change',()=>{
  if(!field.isConnected)return;const replacement=field.cloneNode();replacement.value=id==='detached-text'?'old':'7';field.replaceWith(replacement);
 });
}</script>`;
test("native numeric/date values survive sanitization; malformed and refused edits stay truthful", async ({ extensionSession }, info) => {
    const server = createServer((_request, response) => { response.setHeader("content-type", "text/html"); response.end(html); });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
        const address = server.address();
        if (!address || typeof address === "string")
            throw new Error("Missing owned fixture port");
        const page = await extensionSession.context.newPage();
        await page.goto(`http://127.0.0.1:${address.port}/sanitized`);
        await installRuntimeHarness(extensionSession.extensionPage);
        const tabId = await extensionSession.extensionPage.evaluate(async (url) => (await chrome.tabs.query({})).find(tab => tab.url === url)?.id, page.url());
        if (tabId === undefined)
            throw new Error("Missing owned fixture tab");
        await resetRuntimeHarness(extensionSession.extensionPage, tabId);
        const expected = JSON.parse(await readFile(path.join(extensionSession.metadata.artifactPath, "build-info.json"), "utf8")).identity;
        const running = await extensionSession.extensionPage.evaluate(id => chrome.runtime.sendMessage({ type: "fluxiq.buildIdentity", tabId: id }), tabId);
        expect(running).toMatchObject({ ok: true, background: expected, content: expected });
        await info.attach("identity", { contentType: "application/json", body: JSON.stringify({ expected, running, browser: await page.evaluate(() => navigator.userAgent) }) });
        let commandOrdinal = 0;
        const act = (selector: string, text: string) => runWorkerAction(extensionSession.extensionPage, { commandId: `type-${++commandOrdinal}`, actionType: "web.dom.type", selector, text }, { activeTabId: tabId });
        const detachedText = await act("#detached-text", "xy");
        const detachedNumber = await runWorkerAction(extensionSession.extensionPage, { commandId: "detached-number-submit", actionType: "web.dom.type", selector: "#detached-number", text: "1.5", submit: true }, { activeTabId: tabId });
        const detachProof = await page.evaluate(() => ({ enters: (globalThis as unknown as { proof: { detachedEnters: number } }).proof.detachedEnters, text: (document.querySelector("#detached-text") as HTMLInputElement).value, number: (document.querySelector("#detached-number") as HTMLInputElement).value }));
        await info.attach("detached-control-result", { contentType: "application/json", body: JSON.stringify({ statuses: [detachedText.result.status, detachedNumber.result.status], ...detachProof }) });
        expect([detachedText.result.status, detachedNumber.result.status]).toEqual(["failed", "failed"]);
        expect(detachProof).toEqual({ enters: 0, text: "old", number: "7" });
        for (const value of ["1.5", "-3"]) {
            const result = await act("#number", value);
            expect(result.result.status, result.result.message).toBe("succeeded");
            await expect(page.locator("#number")).toHaveValue(value);
        }
        expect((await act("#date", "2026-10-07")).result.status).toBe("succeeded");
        await expect(page.locator("#date")).toHaveValue("2026-10-07");
        for (const [selector, value] of [["#time", "10:30"], ["#month", "2026-10"], ["#week", "2026-W41"], ["#datetime", "2026-10-07T10:30"]]) {
            const answer = await act(selector!, value!);
            expect(answer.result.status, answer.result.message).toBe("succeeded");
            await expect(page.locator(selector!)).toHaveValue(value!);
        }
        expect((await act("#keycancelled", "1.5")).result.status).toBe("failed");
        await expect(page.locator("#keycancelled")).toHaveValue("4");
        const before = await page.evaluate(() => (globalThis as unknown as {
            proof: {
                numberInputs: string[];
            };
        }).proof.numberInputs.length);
        expect((await act("#number", "1.5oops")).result.status).toBe("failed");
        await expect(page.locator("#number")).toHaveValue("-3");
        expect(await page.evaluate(() => (globalThis as unknown as {
            proof: {
                numberInputs: string[];
            };
        }).proof.numberInputs.length)).toBe(before);
        expect((await act("#date", "2026-02-30")).result.status).toBe("failed");
        await expect(page.locator("#date")).toHaveValue("2026-10-07");
        expect((await act("#revert", "1.5")).result.status).toBe("failed");
        await expect(page.locator("#revert")).toHaveValue("8");
        expect((await act("#cancelled", "2026-10-07")).result.status).toBe("failed");
        await expect(page.locator("#cancelled")).toHaveValue("2026-09-01");
        expect((await act("#readonly", "1.5")).result.status).toBe("failed");
        await expect(page.locator("#readonly")).toHaveValue("9");
        expect((await act("#text", "abc")).result.status).toBe("succeeded");
        expect(await page.evaluate(() => (globalThis as unknown as {
            proof: {
                textInputs: string[];
            };
        }).proof.textInputs)).toEqual(["a", "ab", "abc"]);
        const sensitive = await act("#password", "synthetic-secret-123");
        expect(sensitive.result.status).toBe("succeeded");
        expect(JSON.stringify(sensitive.result)).not.toContain("synthetic-secret-123");
        expect(await page.evaluate(() => (globalThis as unknown as {
            proof: {
                submits: number;
            };
        }).proof.submits)).toBe(0);
    }
    finally {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
});
