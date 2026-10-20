// The userScripts feasibility probe, on everything-store in the scenario lab.
//
// - The strict-policy document is the store's printable order receipt, which
//   the store serves with `default-src 'none'; script-src 'none'; connect-src
//   'none'; img-src 'self'`. Its own inline script would reveal a Print button;
//   the button staying hidden is the proof that page scripts did not run.
// - Page-world isolation is read off the store's home page, whose own script
//   publishes `window.storeModals` in the page world.
// - Network effects are counted by the lab (`/__control/requests`), per probe,
//   on one of the store's product photos asked for under a query of its own.
// - The ungranted site is the same store under `localhost`, which the lab
//   accepts and the probe extension's host permission does not name.
//
// It runs only with FLUXIQ_USER_SCRIPT_PROBE=1, in the branded browsers.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { userScriptProbeBrowser, startProbePages } from "../index.js";

type Outcome = { ok: boolean; results?: Array<{ result?: unknown; documentId?: string }>; error?: string };

for (const brand of ["chrome", "edge"] as const) test(`${brand}: actual one-shot USER_SCRIPT permission, document, CSP and DOM-network boundaries`, async () => {
  test.skip(process.env.FLUXIQ_USER_SCRIPT_PROBE !== "1", "Explicit isolated browser prototype only");
  const pages = await startProbePages();
  let session;
  try {
    session = await userScriptProbeBrowser.open(brand);
    const { extensionPage: api, missingPage, settingsPage, context } = session;
    const outcomes: Record<string, unknown> = { brand, version: session.version, loading: "CDP Extensions.loadUnpacked" };
    const available = (page = api) => page.evaluate(async () => {
      const c = (globalThis as any).chrome;
      try {
        await c.userScripts.getScripts();
        return { namespace: typeof c.userScripts, execute: typeof c.userScripts.execute, enabled: true };
      } catch (error) {
        return { namespace: typeof c.userScripts, enabled: false, error: String(error) };
      }
    });
    outcomes.missingPermission = await available(missingPage);
    expect((outcomes.missingPermission as any).enabled).toBe(false);
    outcomes.initialToggle = await available();
    expect((outcomes.initialToggle as any).enabled).toBe(false);

    // Browser settings UI only. Never mutate profile prefs or use a privileged settings API.
    const toggle = settingsPage.locator(brand === "edge" ? "access-section #checkbox-1" : "#allow-user-scripts");
    await expect(settingsPage.getByText("Allow User Scripts", { exact: true })).toBeVisible();
    await expect(toggle).toBeVisible();
    await toggle.click();
    await api.reload();
    outcomes.enabled = await available();
    expect((outcomes.enabled as any).enabled).toBe(true);
    expect((outcomes.enabled as any).execute).toBe("function");

    const page = await context.newPage();
    await page.goto(pages.receipt);
    const tabIdOf = (url: string) => api.evaluate(async (wanted) => (await (globalThis as any).chrome.tabs.query({})).find((tab: any) => tab.url === wanted).id as number, url);
    const tabId = await tabIdOf(page.url());
    const execute = (code: string, target: Record<string, unknown> = { tabId }, worldId = "denied") => api.evaluate(async ({ code, target, worldId }) => {
      try {
        return { ok: true, results: await (globalThis as any).chrome.userScripts.execute({ target, world: "USER_SCRIPT", worldId, js: [{ code }] }) };
      } catch (error) {
        return { ok: false, error: String(error) };
      }
    }, { code, target, worldId }) as Promise<Outcome>;
    const resultOf = (outcome: unknown) => (outcome as Outcome).results?.[0]?.result;
    await api.evaluate(async () => {
      const c = (globalThis as any).chrome;
      (globalThis as any).__retainedUserScripts = c.userScripts;
      await c.userScripts.configureWorld({ worldId: "denied", messaging: false, csp: "script-src 'self'; connect-src 'none'" });
      await c.userScripts.configureWorld({ worldId: "allowed", messaging: false, csp: "script-src 'self'; connect-src http://127.0.0.1:*" });
    });

    // The receipt: the user script runs where the page's own script could not.
    outcomes.oneShot = await execute("document.documentElement.dataset.userScript='ran'; ({fact:document.querySelector('h1').textContent, runtime:typeof globalThis.chrome?.runtime, pageGlobal:typeof window.storeModals})");
    expect((outcomes.oneShot as Outcome).ok).toBe(true);
    await expect(page.locator("html")).toHaveAttribute("data-user-script", "ran");
    expect(String((resultOf(outcomes.oneShot) as { fact?: string }).fact)).toMatch(/^Final Details for Order #/u);
    // The receipt's inline script would have revealed this button and retired the hint.
    await expect(page.locator("[data-print]")).toBeHidden();
    await expect(page.locator("[data-print-hint]")).toBeVisible();
    const documentId = (outcomes.oneShot as Outcome).results?.[0]?.documentId;
    expect(typeof documentId).toBe("string");
    outcomes.strictFetch = await execute(`fetch('${pages.asset("strict-fetch")}').then(()=> 'allowed',()=> 'blocked')`);
    expect(resultOf(outcomes.strictFetch)).toBe("blocked");
    expect(await pages.requests("strict-fetch")).toBe(0);

    // The store's home page: its own script's global lives only in the page world.
    await page.goto(pages.store);
    expect(await page.evaluate(() => typeof (window as any).storeModals)).toBe("object");
    outcomes.worldIsolation = await execute("({pageGlobal:typeof window.storeModals, sendMessage:typeof globalThis.chrome?.runtime?.sendMessage, connect:typeof globalThis.chrome?.runtime?.connect})");
    expect(resultOf(outcomes.worldIsolation)).toEqual({ pageGlobal: "undefined", sendMessage: "undefined", connect: "undefined" });
    outcomes.staleDocument = await execute("document.documentElement.dataset.stale='ran'", { tabId, documentIds: [documentId] });
    expect(await page.locator("html").getAttribute("data-stale")).toBeNull();
    expect((outcomes.staleDocument as Outcome).ok).toBe(false);

    // Network effects, counted by the lab.
    outcomes.allowedFetch = await execute(`fetch('${pages.asset("allowed-fetch")}').then(r=>r.status)`, { tabId }, "allowed");
    expect(resultOf(outcomes.allowedFetch)).toBe(200);
    expect(await pages.requests("allowed-fetch")).toBe(1);
    outcomes.deniedFetch = await execute(`fetch('${pages.asset("denied-fetch")}').then(()=> 'allowed',()=> 'blocked')`);
    expect(resultOf(outcomes.deniedFetch)).toBe("blocked");
    expect(await pages.requests("denied-fetch")).toBe(0);
    outcomes.domImage = await execute(`const image=document.createElement('img'); image.src='${pages.asset("dom-image")}'; document.body.append(image); 'issued'`);
    await expect.poll(() => pages.requests("dom-image")).toBe(1);
    await api.evaluate(async () => {
      await (globalThis as any).chrome.userScripts.configureWorld({ worldId: "sealed", messaging: false, csp: "default-src 'none'; script-src 'self'; connect-src 'none'" });
    });
    outcomes.sealedImage = await execute(`new Promise(resolve => { const deniedImage=document.createElement('img'); deniedImage.onload=()=>resolve('loaded'); deniedImage.onerror=()=>resolve('blocked'); deniedImage.src='${pages.asset("sealed-image")}'; document.body.append(deniedImage); })`, { tabId }, "sealed");
    expect(resultOf(outcomes.sealedImage)).toBe("blocked");
    expect(await pages.requests("sealed-image")).toBe(0);
    outcomes.domNavigation = await execute(`const link=document.createElement('a'); link.href='${pages.asset("dom-navigation")}'; document.body.append(link); link.click(); 'issued'`, { tabId }, "sealed");
    await expect.poll(() => pages.requests("dom-navigation")).toBe(1);
    await expect(page).toHaveURL(/v=dom-navigation/u);

    // The same store under a host name the extension was never granted.
    const denied = await context.newPage();
    await denied.goto(pages.ungrantedStore);
    const deniedId = await tabIdOf(denied.url());
    outcomes.ungrantedSite = await execute("document.documentElement.dataset.unauthorized='ran'", { tabId: deniedId });
    expect((outcomes.ungrantedSite as Outcome).ok).toBe(false);
    expect(await denied.locator("html").getAttribute("data-unauthorized")).toBeNull();

    // Revoking the toggle revokes the namespace the extension kept hold of.
    await toggle.click();
    outcomes.revokedRetainedNamespace = await api.evaluate(async () => {
      const c = (globalThis as any).chrome;
      try {
        await (globalThis as any).__retainedUserScripts.getScripts();
        return { namespace: typeof c.userScripts, allowed: true };
      } catch (error) {
        return { namespace: typeof c.userScripts, allowed: false, error: String(error) };
      }
    });
    expect((outcomes.revokedRetainedNamespace as any).allowed).toBe(false);
    outcomes.revokedExecute = await api.evaluate(async (tabId) => {
      try {
        await (globalThis as any).__retainedUserScripts.execute({ target: { tabId }, world: "USER_SCRIPT", js: [{ code: "document.documentElement.dataset.revoked='ran'" }] });
        return { allowed: true };
      } catch (error) {
        return { allowed: false, error: String(error) };
      }
    }, tabId);
    expect((outcomes.revokedExecute as any).allowed).toBe(false);
    await api.reload();
    outcomes.revokedReload = await available();
    expect((outcomes.revokedReload as any).enabled).toBe(false);

    const sourceHash = createHash("sha256");
    for (const file of ["../browser.ts", "../extension.ts", "../pages.ts", "../types.ts", "../index.ts", "../playwright.config.ts", "probe.spec.ts"]) sourceHash.update(await readFile(new URL(file, import.meta.url)));
    const networkCounts: Record<string, number> = {};
    for (const kind of ["strict-fetch", "allowed-fetch", "denied-fetch", "dom-image", "sealed-image", "dom-navigation"]) networkCounts[kind] = await pages.requests(kind);
    // Hide volatile document and tab ids; the receipt's order number is the store's own fiction.
    const safeOutcomes = JSON.parse(JSON.stringify(outcomes, (key, value) => key === "documentId" ? "[owned-document]" : typeof value === "string" ? value.replace(/[A-F0-9]{32}/g, "[owned-document]").replace(/tab with id \d+/g, "tab with owned id") : value));
    console.log(JSON.stringify({ ...safeOutcomes, sourceFingerprint: sourceHash.digest("hex"), networkCounts, hardTerminationProven: false, providerCalls: 0 }));
  } finally {
    try {
      if (session) await userScriptProbeBrowser.close(session);
    } finally {
      await pages.close();
    }
  }
});
