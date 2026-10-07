import { randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { writeProbeExtension } from "./extension.js";
import type { UserScriptProbeSession } from "./types.js";
const executables = { chrome: "C:/Program Files/Google/Chrome/Application/chrome.exe", edge: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" };
async function cleanupRoot(root: string, parent: string, rootName: string): Promise<void> {
  const resolved = await realpath(root);
  if (path.dirname(resolved) !== parent || path.basename(resolved) !== rootName || resolved !== root || !/^probe-(chrome|edge)-[0-9a-f]{8}$/.test(rootName)) throw new Error("Refusing redirected or unowned browser probe cleanup root.");
  await rm(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
async function boundedClose(action: Promise<void>): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try { await Promise.race([action, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Owned browser cleanup exceeded 15 seconds; profile retained for diagnosis.")), 15_000); })]); }
  finally { if (timer) clearTimeout(timer); }
}
/** Real branded browsers, isolated profiles; CDP is only extension-loading test infrastructure. */
export const userScriptProbeBrowser = Object.freeze({
  async open(brand: "chrome" | "edge"): Promise<UserScriptProbeSession> {
    const intendedParent = fileURLToPath(new URL("../../test-results/user-script-feasibility-owned", import.meta.url));
    await mkdir(intendedParent, { recursive: true }); const parent = await realpath(intendedParent), rootName = `probe-${brand}-${randomUUID().slice(0, 8)}`, root = path.resolve(parent, rootName);
    await mkdir(root); const extension = path.join(root, "extension"), missing = path.join(root, "missing");
    await writeProbeExtension(extension, true); await writeProbeExtension(missing, false);
    let browser, context;
    try {
      context = await chromium.launchPersistentContext(path.join(root, "profile"), { executablePath: executables[brand], headless: false, timeout: 30_000, ignoreDefaultArgs: ["--disable-extensions"], args: ["--remote-debugging-port=0", "--enable-unsafe-extension-debugging", "--no-first-run", "--disable-default-apps", "--disable-background-networking", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1"] });
      const deadline = Date.now() + 10_000; let port = "";
      while (Date.now() < deadline) { try { port = (await readFile(path.join(root, "profile/DevToolsActivePort"), "utf8")).split("\n")[0] ?? ""; if (/^\d+$/.test(port)) break; } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } await new Promise(resolve => setTimeout(resolve, 50)); }
      if (!/^\d+$/.test(port)) throw new Error("Owned browser did not expose its test-only CDP port.");
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
      const cdp = await browser.newBrowserCDPSession(), version = await cdp.send("Browser.getVersion");
      const loaded = await cdp.send("Extensions.loadUnpacked" as never, { path: extension } as never) as unknown as { id: string };
      const unprivileged = await cdp.send("Extensions.loadUnpacked" as never, { path: missing } as never) as unknown as { id: string };
      const extensionPage = await context.newPage(), missingPage = await context.newPage(), settingsPage = await context.newPage();
      await extensionPage.goto(`chrome-extension://${loaded.id}/probe.html`); await missingPage.goto(`chrome-extension://${unprivileged.id}/probe.html`);
      await settingsPage.goto(`${brand === "edge" ? "edge" : "chrome"}://extensions/?id=${loaded.id}`);
      return { browser, context, cdp, extensionPage, missingPage, settingsPage, extensionId: loaded.id, missingId: unprivileged.id, root, parent, rootName, version: version.product };
    } catch (error) { if (context) await boundedClose(context.close()); if (browser) await boundedClose(browser.close()); await cleanupRoot(root, parent, rootName); throw error; }
  },
  async close(session: UserScriptProbeSession): Promise<void> {
    await boundedClose(session.context.close()); await boundedClose(session.browser.close()); await cleanupRoot(session.root, session.parent, session.rootName);
  }
});
