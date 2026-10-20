// Loads a captured page in a fresh, isolated browser context with the network
// off and the page's own scripts off, and runs the extension's content script
// there with the harness's bundles and runtime stub (harness.ts): the
// page-world bundle in the main world, and the stub and the content bundle in
// an isolated world, as the extension itself injects its content script.
//
// The capture is served at the URL it was taken from, by a route that answers
// every request: the document itself, then any resource the capture carries
// (an MHTML archive's parts), and an abort for everything else. So nothing
// reaches a network, and links and locations read as they did live.
//
// A navigation the capture cannot answer, in any frame, is answered `204 No
// Content`, which leaves that frame's document in place, and is counted.
//
// How each half of the sandbox is held, and proved:
// - Network: the context is `offline`, and the route answers or aborts every
//   request. Every request the page made is counted by resource type, served
//   from the capture or aborted; one that finished without the route serving
//   it is a leak. The Scenario Lab is already closed when this runs, so a leak
//   would have had nowhere to go.
// - Page scripts: the document is served with `script-src 'none'`. That does
//   not stop CDP-injected scripts, which is what lets the content script run.
//   Every capture carries a canary script and a `<body onload>` canary
//   (arm-capture.ts) that would mark the root element if they ran, and the
//   Debugger domain reports every script the page parsed: one whose URL is
//   the page's, or anything but the harness's own, is a page script.

import type { Browser, BrowserContext, Page, Request } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { BrowserActionCommand, BrowserActionResult, DomSnapshot } from "../../../../../src/shared/protocol.js";
import { CONTENT_HARNESS_BUNDLE_ENV, CONTENT_HARNESS_PAGE_WORLD_BUNDLE_ENV } from "../../../bundle-env.js";
import { installRuntimeStub, type HarnessDelivery } from "../../../runtime-stub.js";

const HARNESS_GLOBAL = "__fluxiqContentHarness";

/** The isolated world the content script runs in offline. */
const CONTENT_WORLD = "fluxiq-content";

/** The longest one content-script call may take offline; the read itself is bounded at 30 s. */
const DELIVERY_TIMEOUT_MS = 60_000;

/** The marker attributes a page script would set on the root element; arm-capture.ts writes the scripts that set them. */
const CANARY_ATTRIBUTES = ["data-snapshot-canary", "data-snapshot-handler"] as const;

/** A capture as the sandbox serves it: the document at its URL, and the resources it carries. */
export type CapturedDocument = { url: string; html: string; resources: Map<string, { contentType: string; body: Buffer }> };

/** What the sandbox let through; counts and resource types only. */
export type SandboxEvidence = {
  requestsByType: Record<string, number>;
  servedFromCapture: number;
  /** Every frame navigation, by frame, scheme and whether it was the capture's URL; never the URL. */
  navigations: string[];
  popups: number;
  /** Navigations the capture could not answer, answered 204 so the frame's document stayed. */
  navigationsHeld: number;
  aborted: number;
  leakedRequests: number;
  websockets: number;
  pageScriptsParsed: number;
  /** Each such script's world, URL scheme and whether its URL is the document's: never the URL itself. */
  pageScripts: string[];
  canaries: Record<string, string | null>;
  contentScriptReady: boolean;
};

export type OfflineCapture = {
  page: Page;
  context: BrowserContext;
  runAction(command: BrowserActionCommand): Promise<BrowserActionResult>;
  capture(): Promise<DomSnapshot>;
  sandbox(): Promise<SandboxEvidence>;
  close(): Promise<void>;
};

export async function openOfflineCapture(browser: Browser, captured: CapturedDocument): Promise<OfflineCapture> {
  const contentBundle = await readFile(requiredEnv(CONTENT_HARNESS_BUNDLE_ENV), "utf8");
  const pageWorldBundle = await readFile(requiredEnv(CONTENT_HARNESS_PAGE_WORLD_BUNDLE_ENV), "utf8");
  const context = await browser.newContext({
    offline: true,
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1280, height: 720 },
    colorScheme: "light"
  });
  const requestsByType: Record<string, number> = {};
  const served = new WeakSet<Request>();
  let servedFromCapture = 0;
  let aborted = 0;
  let navigationsHeld = 0;
  let leakedRequests = 0;
  let websockets = 0;
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (request.url() === captured.url && request.isNavigationRequest()) {
      served.add(request);
      return route.fulfill({ status: 200, headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": "script-src 'none'" }, body: captured.html });
    }
    const resource = captured.resources.get(request.url());
    if (resource) {
      served.add(request);
      servedFromCapture += 1;
      // A captured frame's document gets the same script-off policy as the page.
      const headers: Record<string, string> = { "content-type": resource.contentType };
      if (/^text\/html/iu.test(resource.contentType)) headers["content-security-policy"] = "script-src 'none'";
      return route.fulfill({ status: 200, headers, body: resource.body });
    }
    if (request.isNavigationRequest()) {
      // A navigation the capture cannot answer -- a frame it does not hold,
      // a load-more link only the page's own script would have kept in place,
      // a pager -- is answered "no content", which leaves the frame's document
      // where it is. An abort would replace it with Chromium's error page.
      navigationsHeld += 1;
      return route.fulfill({ status: 204, body: "" });
    }
    aborted += 1;
    return route.abort("internetdisconnected");
  });
  const page = await context.newPage();
  page.on("request", (request) => {
    if (request.url().startsWith("data:")) return;
    const type = request.resourceType();
    requestsByType[type] = (requestsByType[type] ?? 0) + 1;
  });
  page.on("requestfinished", (request) => {
    if (!request.url().startsWith("data:") && !served.has(request)) leakedRequests += 1;
  });
  page.on("websocket", () => {
    websockets += 1;
  });
  const navigations: string[] = [];
  page.on("framenavigated", (frame) => {
    navigations.push(`${frame === page.mainFrame() ? "main" : "sub"} frame, ${frame.url().split(":")[0]}:, ${frame.url() === captured.url ? "the capture's URL" : "another URL"}`);
  });
  let popups = 0;
  context.on("page", (opened) => {
    if (opened !== page) popups += 1;
  });

  const cdp = await context.newCDPSession(page);
  let pageScriptsParsed = 0;
  const pageScripts: string[] = [];
  cdp.on("Debugger.scriptParsed", (event: { url?: string; length?: number; executionContextAuxData?: { type?: string } }) => {
    const url = event.url ?? "";
    if (url === "" || url.includes("fluxiq-") || url.includes("playwright")) return;
    pageScriptsParsed += 1;
    pageScripts.push(`${event.executionContextAuxData?.type ?? "unknown"} world, ${url.split(":")[0]}:, ${url === captured.url ? "the document's URL" : "another URL"}, ${event.length ?? 0} chars`);
  });
  await cdp.send("Debugger.enable");

  await page.addInitScript({ content: `${pageWorldBundle}\n//# sourceURL=fluxiq-page-world-harness.js\n` });
  // The content world's context in each frame, by frame id; a navigation clears them.
  const contentContexts = new Map<string, number>();
  cdp.on("Runtime.executionContextCreated", (event: { context: { id: number; name: string; auxData?: { frameId?: string } } }) => {
    if (event.context.name === CONTENT_WORLD && event.context.auxData?.frameId) contentContexts.set(event.context.auxData.frameId, event.context.id);
  });
  cdp.on("Runtime.executionContextsCleared", () => contentContexts.clear());
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(${installRuntimeStub.toString()})(${JSON.stringify(HARNESS_GLOBAL)});\n${contentBundle}\n//# sourceURL=fluxiq-content-harness.js\n`,
    worldName: CONTENT_WORLD
  });
  await page.goto(captured.url, { waitUntil: "load" });
  const { frameTree } = await cdp.send("Page.getFrameTree") as { frameTree: { frame: { id: string } } };
  const topFrameId = frameTree.frame.id;

  const inContentWorld = async (expression: string): Promise<unknown> => {
    const contentContext = contentContexts.get(topFrameId);
    if (contentContext === undefined) throw new Error("The content script's isolated world was not created in the offline page.");
    const reply = await cdp.send("Runtime.evaluate", { expression, contextId: contentContext, awaitPromise: true, returnByValue: true }) as {
      result: { value?: unknown };
      exceptionDetails?: { text?: string; exception?: { description?: string } };
    };
    if (reply.exceptionDetails) {
      const worlds = [...contentContexts].map(([frame, id]) => `${frame === topFrameId ? "top" : "sub"} frame context ${id}`).join(", ");
      throw new Error(`The content world threw: ${reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text ?? "unknown"} (content worlds: ${worlds}; used ${contentContext})`);
    }
    return reply.result.value;
  };
  // Bounded, so a content-script call that never answers offline names itself
  // instead of running out the test's time.
  const deliver = async (message: unknown): Promise<HarnessDelivery> => {
    const what = message as { type?: string; action?: { actionType?: string; commandId?: string } };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stalled = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`The content script did not answer ${what.type} ${what.action?.actionType ?? ""} ${what.action?.commandId ?? ""} offline within ${DELIVERY_TIMEOUT_MS} ms.`)), DELIVERY_TIMEOUT_MS);
    });
    try {
      return await Promise.race([inContentWorld(`window[${JSON.stringify(HARNESS_GLOBAL)}].deliver(${JSON.stringify(message)})`), stalled]) as HarnessDelivery;
    } finally {
      clearTimeout(timer);
    }
  };
  const answer = async (message: { type: string } & Record<string, unknown>, what: string): Promise<unknown> => {
    const delivery = await deliver(message);
    if (!delivery.responded) throw new Error(`The content script did not answer ${what} offline.`);
    return delivery.response;
  };
  const ready = async (): Promise<boolean> => Boolean(await inContentWorld(
    `(window[${JSON.stringify(HARNESS_GLOBAL)}]?.sent ?? []).some((message) => message.type === "fluxiq.contentReady")`
  ));

  return {
    page,
    context,
    runAction: async (command) => await answer({ type: "executeAction", action: command, topFrameOnly: true }, `executeAction for ${command.actionType}`) as BrowserActionResult,
    capture: async () => await answer({ type: "captureSnapshot" }, "captureSnapshot") as DomSnapshot,
    sandbox: async () => ({
      requestsByType: { ...requestsByType },
      servedFromCapture,
      navigations: [...navigations],
      popups,
      navigationsHeld,
      aborted,
      leakedRequests,
      websockets,
      pageScriptsParsed,
      pageScripts: [...pageScripts],
      canaries: await page.evaluate((names) => Object.fromEntries(names.map((name) => [name, document.documentElement.getAttribute(name)])), [...CANARY_ATTRIBUTES]),
      contentScriptReady: await ready()
    }),
    close: () => context.close()
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; run the specs through e2e/playwright.content.config.ts.`);
  return value;
}
