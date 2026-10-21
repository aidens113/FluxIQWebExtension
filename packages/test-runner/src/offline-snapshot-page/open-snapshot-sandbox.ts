// One sandboxed page for one evaluation (lane T U3's method, made the
// product's port): a fresh browser context with the network off, a route that
// answers every request from the snapshot (`routes.ts`), the
// page-world bundle in the page's world and the content code in an isolated
// world (`content-world-source.ts`), and the counts the observations report.
//
// How each half of the sandbox is held, and counted:
// - Network: the context is `offline` and the route answers every request it
//   sees. A request that finished without the route answering it, or a
//   websocket the page opened, is a leak (`requestsLeaked`).
// - Page scripts: the documents are served with `script-src 'none'`, which
//   does not stop CDP-injected scripts, so the content code still runs. The
//   Debugger domain reports every script the page parsed, and anything not
//   named `fluxiq-snapshot-*` (nor CDP's or Playwright's own unnamed
//   evaluations) is a page script; the canaries (`canaries.ts`) add
//   any that ran unparsed by name (`scriptsRan`).

import type { Browser, Request } from "@playwright/test";
import type { WebSnapshotSandboxObservations } from "@fluxiq-web-extension/domain/node";
import type { ContentWorldSource } from "./content-world-source.js";
import { snapshotCanaries } from "./canaries.js";
import type { SnapshotRouteAnswer, SnapshotRouteRequest } from "./routes.js";

/** The isolated world the content code runs in. */
const CONTENT_WORLD = "fluxiq-snapshot-content";
/** How long the snapshot may take to load before it counts as one that will not. */
const LOAD_TIMEOUT_MS = 30_000;

export type SnapshotSandbox = Readonly<{
  /** Loads the snapshot's address; the reason it did not load, or `undefined` once it has. */
  load(url: string): Promise<string | undefined>;
  /** Evaluates `expression` in the top frame's content world and returns its value. */
  inContentWorld(expression: string): Promise<unknown>;
  /** Waits `ms` in the page's own time. */
  wait(ms: number): Promise<void>;
  observations(scrollsPastEnd: number): Promise<WebSnapshotSandboxObservations>;
  close(): Promise<void>;
}>;

export async function openSnapshotSandbox(
  browser: Browser,
  answer: (request: SnapshotRouteRequest) => SnapshotRouteAnswer,
  world: ContentWorldSource,
  pageWorldScript: string
): Promise<SnapshotSandbox> {
  const context = await browser.newContext({ offline: true, locale: "en-US", timezoneId: "UTC", viewport: { width: 1280, height: 720 }, colorScheme: "light" });
  const counts = { requestsLeaked: 0, navigationsHeld: 0, requestsRefused: 0, pageScripts: 0 };
  const answered = new WeakSet<Request>();
  await context.route("**/*", async (route) => {
    const request = route.request();
    answered.add(request);
    const decision = answer({ url: request.url(), navigation: request.isNavigationRequest() });
    if (decision.kind === "served") return route.fulfill({ status: 200, headers: { ...decision.headers }, body: Buffer.from(decision.body) });
    if (decision.kind === "held") {
      counts.navigationsHeld += 1;
      return route.fulfill({ status: 204, body: "" });
    }
    counts.requestsRefused += 1;
    return route.abort("internetdisconnected");
  });
  // Counted on the context, so a popup the content code opened is counted too.
  context.on("requestfinished", (request) => {
    if (!answered.has(request) && !/^(?:data|blob):/u.test(request.url())) counts.requestsLeaked += 1;
  });
  context.on("page", (opened) => opened.on("websocket", () => {
    counts.requestsLeaked += 1;
  }));
  const page = await context.newPage();

  const cdp = await context.newCDPSession(page);
  cdp.on("Debugger.scriptParsed", (event: { url?: string }) => {
    const url = event.url ?? "";
    if (url === "" || url.includes("fluxiq-snapshot-") || url.includes("playwright")) return;
    counts.pageScripts += 1;
  });
  const contentContexts = new Map<string, number>();
  cdp.on("Runtime.executionContextCreated", (event: { context: { id: number; name: string; auxData?: { frameId?: string } } }) => {
    if (event.context.name === CONTENT_WORLD && event.context.auxData?.frameId) contentContexts.set(event.context.auxData.frameId, event.context.id);
  });
  cdp.on("Runtime.executionContextsCleared", () => contentContexts.clear());
  await cdp.send("Debugger.enable");
  // Scripts are only counted: nothing may stop the content code at a `debugger` statement.
  await cdp.send("Debugger.setSkipAllPauses", { skip: true });
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await page.addInitScript({ content: world.pageWorld(pageWorldScript) });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: world.source, worldName: CONTENT_WORLD });
  let topFrameId: string | undefined;

  return {
    load: async (url) => {
      try {
        const response = await page.goto(url, { waitUntil: "load", timeout: LOAD_TIMEOUT_MS });
        if (response === null || response.status() !== 200) return `the snapshot's address answered ${response?.status() ?? "nothing"}`;
      } catch (error) {
        return `the snapshot did not load: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`;
      }
      const { frameTree } = await cdp.send("Page.getFrameTree") as { frameTree: { frame: { id: string } } };
      topFrameId = frameTree.frame.id;
      return undefined;
    },
    inContentWorld: async (expression) => {
      const contextId = topFrameId === undefined ? undefined : contentContexts.get(topFrameId);
      if (contextId === undefined) throw new Error("the content code's isolated world was not created in the snapshot page");
      const reply = await cdp.send("Runtime.evaluate", { expression, contextId, awaitPromise: true, returnByValue: true }) as {
        result: { value?: unknown };
        exceptionDetails?: { text?: string; exception?: { description?: string } };
      };
      if (reply.exceptionDetails) throw new Error(`the content world threw: ${reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text ?? "unknown"}`);
      return reply.result.value;
    },
    wait: (ms) => page.waitForTimeout(ms),
    observations: async (scrollsPastEnd) => {
      const canaries = await page.evaluate((names) => names.filter((name) => document.documentElement.getAttribute(name) !== null).length, [...snapshotCanaries.attributes]);
      return {
        scriptsRan: counts.pageScripts + canaries,
        requestsLeaked: counts.requestsLeaked,
        navigationsHeld: counts.navigationsHeld,
        requestsRefused: counts.requestsRefused,
        scrollsPastEnd
      };
    },
    close: () => context.close()
  };
}
