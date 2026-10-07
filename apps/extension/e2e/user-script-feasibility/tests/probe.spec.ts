import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { userScriptProbeBrowser, startProbePages } from "../index.js";

for (const brand of ["chrome", "edge"] as const) test(`${brand}: actual one-shot USER_SCRIPT permission, document, CSP and DOM-network boundaries`, async () => {
  test.skip(process.env.FLUXIQ_USER_SCRIPT_PROBE !== "1", "Explicit isolated browser prototype only");
  const pages = await startProbePages(); let session;
  try {
    session = await userScriptProbeBrowser.open(brand); const { extensionPage: api, missingPage, settingsPage, context } = session;
    const outcomes: Record<string, unknown> = { brand, version: session.version, loading: "CDP Extensions.loadUnpacked" };
    const available = (page = api) => page.evaluate(async () => { const c = (globalThis as any).chrome; try { await c.userScripts.getScripts(); return { namespace: typeof c.userScripts, execute: typeof c.userScripts.execute, enabled: true }; } catch (error) { return { namespace: typeof c.userScripts, enabled: false, error: String(error) }; } });
    outcomes.missingPermission = await available(missingPage); expect((outcomes.missingPermission as any).enabled).toBe(false);
    outcomes.initialToggle = await available(); expect((outcomes.initialToggle as any).enabled).toBe(false);
    // Browser settings UI only. Never mutate profile prefs or use a privileged settings API.
    const toggle = settingsPage.locator(brand === "edge" ? "access-section #checkbox-1" : "#allow-user-scripts");
    await expect(settingsPage.getByText("Allow User Scripts", { exact: true })).toBeVisible(); await expect(toggle).toBeVisible(); await toggle.click(); await api.reload();
    outcomes.enabled = await available(); expect((outcomes.enabled as any).enabled).toBe(true); expect((outcomes.enabled as any).execute).toBe("function");
    const page = await context.newPage(); await page.goto(`${pages.origin}/strict`);
    const tabId = await api.evaluate(async url => (await (globalThis as any).chrome.tabs.query({})).find((tab: any) => tab.url === url).id as number, page.url());
    const execute = (code: string, target: Record<string, unknown> = { tabId }, worldId = "denied") => api.evaluate(async ({ code, target, worldId }) => { try { return { ok: true, results: await (globalThis as any).chrome.userScripts.execute({ target, world: "USER_SCRIPT", worldId, js: [{ code }] }) }; } catch (error) { return { ok: false, error: String(error) }; } }, { code, target, worldId });
    await api.evaluate(async () => { const c = (globalThis as any).chrome; (globalThis as any).__retainedUserScripts = c.userScripts; await c.userScripts.configureWorld({ worldId: "denied", messaging: false, csp: "script-src 'self'; connect-src 'none'" }); await c.userScripts.configureWorld({ worldId: "allowed", messaging: false, csp: "script-src 'self'; connect-src http://127.0.0.1:*" }); });
    outcomes.oneShot = await execute("document.documentElement.dataset.userScript='ran'; ({fact:document.querySelector('#fact').textContent, runtime:typeof globalThis.chrome?.runtime, pageGlobal:typeof window.pageOnlyValue})");
    expect((outcomes.oneShot as any).ok).toBe(true); await expect(page.locator("html")).toHaveAttribute("data-user-script", "ran"); expect(await page.locator("html").getAttribute("data-page-inline")).toBeNull();
    const documentId = (outcomes.oneShot as any).results[0].documentId; expect(typeof documentId).toBe("string");
    outcomes.strictFetch = await execute(`fetch('${pages.origin}/network?kind=strict-fetch').then(()=> 'allowed',()=> 'blocked')`); expect((outcomes.strictFetch as any).results[0].result).toBe("blocked"); expect(pages.requests["strict-fetch"] ?? 0).toBe(0);
    await page.goto(`${pages.origin}/plain`);
    expect(await page.evaluate(() => (window as any).pageOnlyValue)).toBe(123);
    outcomes.worldIsolation = await execute("({pageGlobal:typeof window.pageOnlyValue, sendMessage:typeof globalThis.chrome?.runtime?.sendMessage, connect:typeof globalThis.chrome?.runtime?.connect})");
    expect((outcomes.worldIsolation as any).results[0].result).toEqual({ pageGlobal: "undefined", sendMessage: "undefined", connect: "undefined" });
    outcomes.staleDocument = await execute("document.documentElement.dataset.stale='ran'", { tabId, documentIds: [documentId] }); expect(await page.locator("html").getAttribute("data-stale")).toBeNull(); expect((outcomes.staleDocument as any).ok).toBe(false);
    outcomes.allowedFetch = await execute(`fetch('${pages.origin}/network?kind=allowed-fetch').then(r=>r.text())`, { tabId }, "allowed"); expect((outcomes.allowedFetch as any).results[0].result).toBe("synthetic-network-response"); expect(pages.requests["allowed-fetch"]).toBe(1);
    outcomes.deniedFetch = await execute(`fetch('${pages.origin}/network?kind=denied-fetch').then(()=> 'allowed',()=> 'blocked')`); expect((outcomes.deniedFetch as any).results[0].result).toBe("blocked"); expect(pages.requests["denied-fetch"] ?? 0).toBe(0);
    outcomes.domImage = await execute(`const image=document.createElement('img'); image.src='${pages.origin}/network?kind=dom-image'; document.body.append(image); 'issued'`);
    await expect.poll(() => pages.requests["dom-image"] ?? 0).toBe(1);
    await api.evaluate(async () => { await (globalThis as any).chrome.userScripts.configureWorld({ worldId: "sealed", messaging: false, csp: "default-src 'none'; script-src 'self'; connect-src 'none'" }); });
    outcomes.sealedImage = await execute(`new Promise(resolve => { const deniedImage=document.createElement('img'); deniedImage.onload=()=>resolve('loaded'); deniedImage.onerror=()=>resolve('blocked'); deniedImage.src='${pages.origin}/network?kind=sealed-image'; document.body.append(deniedImage); })`, { tabId }, "sealed");
    expect((outcomes.sealedImage as any).results[0].result).toBe("blocked"); expect(pages.requests["sealed-image"] ?? 0).toBe(0);
    outcomes.domNavigation = await execute(`const link=document.createElement('a'); link.href='${pages.origin}/network?kind=dom-navigation'; document.body.append(link); link.click(); 'issued'`, { tabId }, "sealed");
    await expect.poll(() => pages.requests["dom-navigation"] ?? 0).toBe(1); await expect(page).toHaveURL(/kind=dom-navigation/);
    const denied = await context.newPage(); await denied.goto(`${pages.deniedOrigin}/plain`); const deniedId = await api.evaluate(async url => (await (globalThis as any).chrome.tabs.query({})).find((tab: any) => tab.url === url).id as number, denied.url());
    outcomes.ungrantedSite = await execute("document.documentElement.dataset.unauthorized='ran'", { tabId: deniedId }); expect((outcomes.ungrantedSite as any).ok).toBe(false); expect(await denied.locator("html").getAttribute("data-unauthorized")).toBeNull();
    await toggle.click(); outcomes.revokedRetainedNamespace = await api.evaluate(async () => { const c = (globalThis as any).chrome; try { await (globalThis as any).__retainedUserScripts.getScripts(); return { namespace: typeof c.userScripts, allowed: true }; } catch (error) { return { namespace: typeof c.userScripts, allowed: false, error: String(error) }; } }); expect((outcomes.revokedRetainedNamespace as any).allowed).toBe(false);
    outcomes.revokedExecute = await api.evaluate(async tabId => { try { await (globalThis as any).__retainedUserScripts.execute({ target: { tabId }, world: "USER_SCRIPT", js: [{ code: "document.documentElement.dataset.revoked='ran'" }] }); return { allowed: true }; } catch (error) { return { allowed: false, error: String(error) }; } }, tabId);
    expect((outcomes.revokedExecute as any).allowed).toBe(false); await api.reload(); outcomes.revokedReload = await available(); expect((outcomes.revokedReload as any).enabled).toBe(false);
    const sourceHash = createHash("sha256"); for (const file of ["../browser.ts", "../extension.ts", "../pages.ts", "../types.ts", "../index.ts", "../playwright.config.ts", "probe.spec.ts"]) sourceHash.update(await readFile(new URL(file, import.meta.url)));
    // Fixture-only results: hide volatile document/tab IDs even though every page is synthetic.
    const safeOutcomes = JSON.parse(JSON.stringify(outcomes, (key, value) => key === "documentId" ? "[owned-document]" : typeof value === "string" ? value.replace(/[A-F0-9]{32}/g, "[owned-document]").replace(/tab with id \d+/g, "tab with owned id") : value));
    console.log(JSON.stringify({ ...safeOutcomes, sourceFingerprint: sourceHash.digest("hex"), networkCounts: pages.requests, hardTerminationProven: false, providerCalls: 0 }));
  } finally { try { if (session) await userScriptProbeBrowser.close(session); } finally { await pages.close(); } }
});
