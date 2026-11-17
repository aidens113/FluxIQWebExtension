import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, expect, type Browser, type BrowserContext } from "@playwright/test";
import { installDeterministicNetworkGuard, networkContainmentArgs, type DeterministicNetworkPolicy } from "../../../../packages/test-runner/src/guarded-browser/index.js";
import { installRealisticScenarioGuard } from "../../../scenario-lab/e2e/realistic-scenario-guard/index.js";
import { assertProbeAllocation } from "./allocation/index.js";
import { assertProbeProfileIdle } from "./profile-idle.js";
import { stopProbeProcess } from "./process-control.js";
import { probeEnvironment } from "./environment.js";
import { NativeAuthProbeError } from "./failure.js";
import type { ProbeAllocation, ProbeConfiguration, ProbeHost } from "./model.js";
import { startNativeProxy } from "./proxy/index.js";
import { closeProbeResources } from "./close.js";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

export async function openNativeProbeHost(allocation: ProbeAllocation, configuration: ProbeConfiguration, restore = false): Promise<ProbeHost> {
  await assertProbeAllocation(allocation);
  await assertProbeProfileIdle(allocation);
  let context: BrowserContext | undefined;
  let browser: Browser | undefined;
  const proxy = await startNativeProxy(configuration);
  try {
    context = await chromium.launchPersistentContext(allocation.profile, {
      executablePath: CHROME, headless: true, timeout: 30_000, env: await probeEnvironment(process.env),
      ignoreDefaultArgs: ["--disable-extensions"], locale: "en-US", timezoneId: "UTC", viewport: { width: 1280, height: 720 }, colorScheme: "light",
      args: ["--remote-debugging-port=0", "--enable-unsafe-extension-debugging", "--no-first-run", "--disable-default-apps", "--disable-background-networking", ...networkContainmentArgs([]).filter(value => value !== "--no-proxy-server"), `--proxy-server=${proxy.origin}`, "--proxy-bypass-list=<-loopback>", ...(restore ? ["--restore-last-session"] : [])]
    });
    const origins = [new URL(configuration.ordinaryUrl).origin, new URL(configuration.alternateUrl).origin];
    const policy: DeterministicNetworkPolicy = { scenarioOrigins: origins, fluxiqOrigins: [] };
    const network = await installDeterministicNetworkGuard(context, policy);
    const scenarios = await installRealisticScenarioGuard(context, "native-auth-feasibility company-website probe");
    let port = "";
    await expect.poll(async () => {
      try { port = (await readFile(path.join(allocation.profile, "DevToolsActivePort"), "utf8")).split("\n")[0] ?? ""; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new NativeAuthProbeError("browser_launch"); }
      return /^\d+$/u.test(port);
    }, { timeout: 10_000 }).toBe(true);
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const cdp = await browser.newBrowserCDPSession();
    // Chrome's newer public CDP command predates these installed Playwright typings.
    const extensionCommand = cdp.send.bind(cdp) as unknown as (method: "Extensions.loadUnpacked", parameters: { path: string }) => Promise<{ id: unknown }>;
    const loaded = await extensionCommand("Extensions.loadUnpacked", { path: allocation.extension });
    if (typeof loaded.id !== "string") throw new NativeAuthProbeError("browser_launch");
    if (!/^[a-p]{32}$/u.test(loaded.id)) throw new NativeAuthProbeError("browser_launch");
    const control = await context.newPage();
    await control.goto(`chrome-extension://${loaded.id}/probe.html`);
    const version = await cdp.send("Browser.getVersion");
    const activeContext = context;
    const activeBrowser = browser;
    let stopped = false;
    return {
      context, browser, cdp, control, extensionId: loaded.id, browserVersion: version.product,
      containment: () => proxy.counts(),
      async assertContained() {
        try {
          await network.serviceWorkersProven();
          network.assertNoViolations();
          scenarios.assertClean();
          if (proxy.counts().transportFailures !== 0) throw new NativeAuthProbeError("containment");
        } catch {
          throw new NativeAuthProbeError("containment");
        }
      },
      async close() {
        if (stopped) return;
        try { await closeProbeResources({ allocation, context: activeContext, browser: activeBrowser, proxy }); }
        finally { stopped = true; }
      },
      async crash() {
        if (stopped) throw new NativeAuthProbeError("ownership");
        try {
          const closed = activeContext.waitForEvent("close");
          await stopProbeProcess(allocation);
          await closed;
        } finally {
          try { await closeProbeResources({ allocation, context: activeContext, browser: activeBrowser, proxy }); }
          finally { stopped = true; }
        }
      }
    };
  } catch {
    const cleanup = await Promise.allSettled([closeProbeResources({ allocation, context, browser, proxy })]);
    const failed = cleanup[0]?.status === "rejected" ? cleanup[0].reason : undefined;
    throw new NativeAuthProbeError("browser_launch", { stage: "browser", evidence: failed instanceof NativeAuthProbeError ? failed.evidence : [] });
  }
}
