import type { Page, Request } from "@playwright/test";
import { extensionViewPanelDriver, pagePanelDriver } from "./panel-driver.js";
import type { RunningTopology } from "../coordinator.js";
import { installDeterministicNetworkGuard, type DeterministicNetworkGuard, type DeterministicNetworkPolicy } from "../network-guard.js";
import { launchBrowser, openSidePanel } from "../run-scenario/index.js";
import type { ChatBrowserSession } from "./types.js";

/** A request the extension's service worker made, as Playwright saw it leave the worker. */
export type WorkerRequest = { at: number; method: string; url: string; postData: unknown };

const PANEL_PATH = "sidepanel/index.html";

/**
 * Headed Chromium with the extension's e2e build, the scenario page, and the
 * real side panel beside it (`openSidePanel`: a trusted click in an extension
 * page calling `chrome.sidePanel.open`, verified by a `SIDE_PANEL` context).
 *
 * `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS` makes Playwright report the
 * service worker's own requests, so the chat's call to Core is observed as it
 * leaves the worker, not only as the recording proxy receives it. Only the
 * worker's requests are kept, by URL and body; headers never are.
 *
 * The deterministic network guard (`policy`) is installed right after the
 * launch and before any page is opened, as the run lane does
 * (`guarded-browser/tests/launch-containment.test.ts` pins the order).
 */
export async function openChromeChatSession(input: { topology: RunningTopology; extensionPath: string; scenarioUrl: string; workerRequests: WorkerRequest[]; policy: DeterministicNetworkPolicy }): Promise<ChatBrowserSession> {
  process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";
  const { context, browserVersion } = await launchBrowser(input.topology, input.extensionPath);
  let guard: DeterministicNetworkGuard;
  try {
    guard = await installDeterministicNetworkGuard(context, input.policy);
  } catch (error) {
    await context.close().catch(/* best-effort: the guard failure is the one reported */ () => undefined);
    throw error;
  }
  context.on("request", (request: Request) => {
    if (!request.serviceWorker() || !/\/api\/programs\//u.test(request.url())) return;
    let postData: unknown = request.postData();
    try { postData = typeof postData === "string" ? JSON.parse(postData) : postData; } catch { /* best-effort: a body that is not JSON is kept as its text */ }
    input.workerRequests.push({ at: Date.now(), method: request.method(), url: request.url().split("?")[0]!, postData });
  });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 15_000 });
  const extensionOrigin = `chrome-extension://${new URL(worker.url()).hostname}`;
  const control = context.pages()[0] ?? await context.newPage();
  await control.goto(`${extensionOrigin}/${PANEL_PATH}`, { waitUntil: "domcontentloaded" });
  const scenario = await context.newPage();
  await scenario.goto(input.scenarioUrl, { waitUntil: "domcontentloaded" });
  const session: ChatBrowserSession = {
    browser: "chrome",
    context,
    guard,
    control,
    scenario,
    extensionOrigin,
    profileDir: input.topology.allocation.browserProfileDir,
    browserVersion,
    async openPanel() {
      await scenario.bringToFront();
      const opened = await openSidePanel(control, new URL(input.scenarioUrl).origin, 10_000);
      if (!opened.ok) throw new Error(`The real side panel did not open: ${opened.reason}`);
      const page = await sidePanelPage(control, extensionOrigin);
      session.panel = page ? pagePanelDriver(page) : extensionViewPanelDriver(control, PANEL_PATH);
      session.panelMode = "side-panel";
      session.panelNote = `Chrome's real side panel, opened by chrome.sidePanel.open inside a trusted click and verified by a SIDE_PANEL context; the scenario tab stayed the window's active tab. ${page ? "Playwright drove the panel's page with trusted input." : "Playwright 1.51 does not hand over the side panel's page, so the panel's own document was driven from the control tab through chrome.extension.getViews(): the text set with the textarea's value setter and an input event, and Send and Yes pressed with HTMLElement.click(). That is the panel's real composer, controller and relay, but not trusted key and mouse input."}`;
    },
    close: () => context.close(),
  };
  return session;
}

/** The side panel's own page, when Playwright attached to one: a panel page that is not the control tab. */
async function sidePanelPage(control: Page, extensionOrigin: string): Promise<Page | undefined> {
  const url = `${extensionOrigin}/${PANEL_PATH}`;
  const deadline = Date.now() + 3_000;
  for (;;) {
    const found = control.context().pages().find(page => page !== control && page.url().startsWith(url));
    if (found) return found;
    if (Date.now() >= deadline) return undefined;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}
