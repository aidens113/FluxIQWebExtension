// T1 coverage of click-landing.ts: a replayed click that takes its own tab to a
// page the server refused fails as `navigation_unexpected`, and nothing else
// about a click changes.
//
// The browser is stubbed at the three `webNavigation` events and at
// `scripting.executeScript`, whose injected function really runs here, against
// a stubbed navigation timing entry. What this cannot prove is that Chromium
// fires those events and keeps `responseStatus` for these landings; a scratch
// probe of the built extension saw both (reports/w19-e4.md), and the Lab's W10
// `broken-link` and W27 `blocked-url` runs are the end-to-end proof.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import type { BrowserActionCommand, BrowserActionResult } from "../../shared/protocol";
import { sendClickCheckingLanding } from "../click-landing";

const TAB_ID = 41;
const ORIGIN = "http://127.0.0.1:4000";
const EXPECTED = "the page the click leads to loads";
/** `NAVIGATION_START_GRACE_MS` in the module. */
const START_GRACE_MS = 300;
const CHANNEL_CLOSED_ERROR =
  "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received";

const CLICK: BrowserActionCommand = { commandId: "c-click", actionType: "web.dom.click", selector: "#go", tabId: TAB_ID };

const REPLY: BrowserActionResult = {
  commandId: "c-click",
  actionType: "web.dom.click",
  status: "succeeded",
  message: "Element clicked.",
  validation: { status: "passed", expected: "the click lands on the target", actual: "it did" },
  url: `${ORIGIN}/scenarios/navigation/start`,
  startedAt: 100,
  finishedAt: 120
};

type NavigationEventName = "onBeforeNavigate" | "onCommitted" | "onErrorOccurred";
type Listener = (details: Record<string, unknown>) => void;

type Browser = {
  /** Fires a navigation event at whatever listens; tab 41's top frame unless the details say otherwise. */
  fire(event: NavigationEventName, details: Record<string, unknown>): void;
  /** How many navigation listeners are attached now. */
  listening(): number;
  /** Every injection's target, in order. */
  injections: Array<Record<string, unknown>>;
};

/**
 * `statuses` is what each document was served with, keyed by `documentId`, or
 * `top` for an injection addressed to the top frame by id. An `Error` is an
 * injection the browser refuses; `undefined` is a document that keeps no status.
 */
function installBrowser(t: TestContext, statuses: Record<string, number | Error | undefined> = {}): Browser {
  const listeners: Record<NavigationEventName, Set<Listener>> = {
    onBeforeNavigate: new Set(),
    onCommitted: new Set(),
    onErrorOccurred: new Set()
  };
  const injections: Array<Record<string, unknown>> = [];
  let served: number | undefined;
  const entries = (type: string) => (type === "navigation" && served !== undefined ? [{ responseStatus: served }] : []);
  t.mock.method(performance, "getEntriesByType", entries as unknown as typeof performance.getEntriesByType);
  const event = (name: NavigationEventName) => ({
    addListener: (listener: Listener) => void listeners[name].add(listener),
    removeListener: (listener: Listener) => void listeners[name].delete(listener)
  });
  (globalThis as { chrome?: unknown }).chrome = {
    webNavigation: { onBeforeNavigate: event("onBeforeNavigate"), onCommitted: event("onCommitted"), onErrorOccurred: event("onErrorOccurred") },
    scripting: {
      executeScript: (details: { target: Record<string, unknown> & { documentIds?: string[] }; func: () => unknown }) => {
        injections.push(details.target);
        const answer = statuses[details.target.documentIds?.[0] ?? "top"];
        if (answer instanceof Error) return Promise.reject(answer);
        served = answer;
        try {
          return Promise.resolve([{ frameId: 0, result: details.func() }]);
        } finally {
          served = undefined;
        }
      }
    }
  };
  t.after(() => {
    delete (globalThis as { chrome?: unknown }).chrome;
  });
  return {
    fire: (name, details) => {
      for (const listener of [...listeners[name]]) listener({ tabId: TAB_ID, frameId: 0, ...details });
    },
    listening: () => listeners.onBeforeNavigate.size + listeners.onCommitted.size + listeners.onErrorOccurred.size,
    injections
  };
}

/** A navigation that starts and commits at once, in the top frame of tab 41 unless `where` says otherwise. */
function land(browser: Browser, url: string, documentId: string | undefined, where: Record<string, unknown> = {}): void {
  browser.fire("onBeforeNavigate", { url, ...where });
  browser.fire("onCommitted", { url, ...(documentId !== undefined ? { documentId } : {}), ...where });
}

const later = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

test("a click redirected to a page served 404 fails as navigation_unexpected, naming the status and the path without its query", async (t) => {
  const browser = installBrowser(t, { "doc-retired": 404 });
  let listeningDuringSend = 0;
  const result = await sendClickCheckingLanding(CLICK, TAB_ID, async () => {
    listeningDuringSend = browser.listening();
    browser.fire("onBeforeNavigate", { url: `${ORIGIN}/scenarios/navigation/second` });
    browser.fire("onCommitted", { url: `${ORIGIN}/scenarios/navigation/link-retired?token=s3cret#notice`, documentId: "doc-retired" });
    return REPLY;
  });
  const actual = "the server answered HTTP 404 for /scenarios/navigation/link-retired";
  assert.equal(result.status, "failed");
  assert.equal(result.message, "The click landed on /scenarios/navigation/link-retired, which the server answered with HTTP 404.");
  assert.deepEqual(result.validation, { status: "failed", expected: EXPECTED, actual });
  assert.deepEqual(result.failure, {
    category: "navigation_unexpected",
    code: "web.navigation.unexpected",
    retryable: false,
    stage: "confirmation",
    expected: EXPECTED,
    actual
  });
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure);
  // What the frame said about the click itself is kept; only the verdict changes.
  assert.equal(result.commandId, REPLY.commandId);
  assert.equal(result.url, REPLY.url);
  assert.equal(result.startedAt, REPLY.startedAt);
  // Read from the document that commit named, and never the query or fragment.
  assert.deepEqual(browser.injections, [{ tabId: TAB_ID, documentIds: ["doc-retired"] }]);
  assert.doesNotMatch(JSON.stringify(result), /s3cret|#notice/);
  // Listening began before the send, and ended with the call.
  assert.equal(listeningDuringSend, 3);
  assert.equal(browser.listening(), 0);
});

test("a button whose navigation starts after its reply, to a page served 403, fails the same way", async (t) => {
  const browser = installBrowser(t, { "doc-blocked": 403 });
  const url = `${ORIGIN}/scenarios/failure-surfaces/blocked?to=%2Faccount`;
  const result = await sendClickCheckingLanding(CLICK, TAB_ID, async () => {
    void later(20)
      .then(() => browser.fire("onBeforeNavigate", { url }))
      .then(() => later(40))
      .then(() => browser.fire("onCommitted", { url, documentId: "doc-blocked" }));
    return REPLY;
  });
  assert.equal(result.status, "failed");
  assert.equal(result.failure?.code, "web.navigation.unexpected");
  assert.equal(result.failure?.actual, "the server answered HTTP 403 for /scenarios/failure-surfaces/blocked");
});

test("a click that lands on a page served 200 is returned as it was", async (t) => {
  const browser = installBrowser(t, { "doc-second": 200 });
  const result = await sendClickCheckingLanding(CLICK, TAB_ID, async () => {
    land(browser, `${ORIGIN}/scenarios/navigation/second`, "doc-second");
    return REPLY;
  });
  assert.equal(result, REPLY);
  assert.equal(browser.injections.length, 1);
});

for (const [where, details] of [["another tab", { tabId: 99 }], ["a child frame", { frameId: 7 }]] as const) {
  test(`a navigation in ${where}, even to a page served 404, is not the click's landing`, async (t) => {
    const browser = installBrowser(t, { "doc-elsewhere": 404 });
    const result = await sendClickCheckingLanding(CLICK, TAB_ID, async () => {
      land(browser, `${ORIGIN}/missing`, "doc-elsewhere", details);
      return REPLY;
    });
    assert.equal(result, REPLY);
    assert.deepEqual(browser.injections, []);
  });
}

test("a click that commits nothing is returned as it was once the start grace has passed", async (t) => {
  const browser = installBrowser(t);
  const sentAt = Date.now();
  const result = await sendClickCheckingLanding(CLICK, TAB_ID, async () => REPLY);
  const waited = Date.now() - sentAt;
  t.diagnostic(`a click that commits nothing waited ${waited} ms`);
  assert.equal(result, REPLY);
  // Bounded by the grace, not by the 10 s a started navigation is given.
  assert.ok(waited >= START_GRACE_MS - 5 && waited < 1_500, `waited ${waited} ms`);
  assert.deepEqual(browser.injections, []);
  assert.equal(browser.listening(), 0);
});

test("a navigation that ends without a commit, as a download does, is returned as it was without waiting it out", async (t) => {
  const browser = installBrowser(t, { top: 404 });
  const sentAt = Date.now();
  const result = await sendClickCheckingLanding(CLICK, TAB_ID, async () => {
    browser.fire("onBeforeNavigate", { url: `${ORIGIN}/export.csv` });
    browser.fire("onErrorOccurred", { url: `${ORIGIN}/export.csv`, error: "net::ERR_ABORTED" });
    return REPLY;
  });
  assert.equal(result, REPLY);
  assert.deepEqual(browser.injections, []);
  assert.ok(Date.now() - sentAt < 1_500);
});

test("a navigation the page replaces before it commits is judged by the one that does commit", async (t) => {
  const browser = installBrowser(t, { "doc-replacement": 403 });
  const result = await sendClickCheckingLanding(CLICK, TAB_ID, async () => {
    browser.fire("onBeforeNavigate", { url: `${ORIGIN}/first` });
    browser.fire("onBeforeNavigate", { url: `${ORIGIN}/blocked` });
    browser.fire("onErrorOccurred", { url: `${ORIGIN}/first`, error: "net::ERR_ABORTED" });
    void later(30).then(() => browser.fire("onCommitted", { url: `${ORIGIN}/blocked`, documentId: "doc-replacement" }));
    return REPLY;
  });
  assert.equal(result.failure?.actual, "the server answered HTTP 403 for /blocked");
});

for (const [why, answer] of [["the document has gone", new Error("No document with id doc-landed.")], ["the browser keeps no status", undefined]] as const) {
  test(`a landing whose status cannot be read, because ${why}, leaves the click as it was`, async (t) => {
    const browser = installBrowser(t, { "doc-landed": answer });
    const result = await sendClickCheckingLanding(CLICK, TAB_ID, async () => {
      land(browser, `${ORIGIN}/somewhere`, "doc-landed");
      return REPLY;
    });
    assert.equal(result, REPLY);
    assert.equal(browser.injections.length, 1);
  });
}

test("a commit that names no document is read from the top frame", async (t) => {
  const browser = installBrowser(t, { top: 404 });
  const result = await sendClickCheckingLanding(CLICK, TAB_ID, async () => {
    land(browser, `${ORIGIN}/gone`, undefined);
    return REPLY;
  });
  assert.deepEqual(browser.injections, [{ tabId: TAB_ID, frameIds: [0] }]);
  assert.equal(result.failure?.code, "web.navigation.unexpected");
});

test("a failed click is never judged by where its tab went", async (t) => {
  const browser = installBrowser(t, { "doc-blocked": 403 });
  const failed: BrowserActionResult = { ...REPLY, status: "failed", validation: { status: "failed", expected: "#go", actual: "nothing matched" } };
  const result = await sendClickCheckingLanding(CLICK, TAB_ID, async () => {
    land(browser, `${ORIGIN}/blocked`, "doc-blocked");
    return failed;
  });
  assert.equal(result, failed);
  assert.deepEqual(browser.injections, []);
  assert.equal(browser.listening(), 0);
});

for (const actionType of ["web.dom.type", "web.dom.assert"] as const) {
  test(`a ${actionType} is sent without watching where its tab goes`, async (t) => {
    const browser = installBrowser(t, { "doc-landed": 404 });
    const reply: BrowserActionResult = { ...REPLY, actionType };
    let listeningDuringSend = -1;
    const result = await sendClickCheckingLanding({ ...CLICK, actionType }, TAB_ID, async () => {
      listeningDuringSend = browser.listening();
      land(browser, `${ORIGIN}/gone`, "doc-landed");
      return reply;
    });
    assert.equal(listeningDuringSend, 0);
    assert.equal(result, reply);
    assert.deepEqual(browser.injections, []);
  });
}

test("a click whose reply is lost to its own navigation still fails when the tab landed on a refused page", async (t) => {
  t.mock.method(Date, "now", () => 5_000);
  const browser = installBrowser(t, { "doc-blocked": 403 });
  const result = await sendClickCheckingLanding(CLICK, TAB_ID, async () => {
    land(browser, `${ORIGIN}/scenarios/failure-surfaces/blocked?to=x`, "doc-blocked");
    throw new Error(CHANNEL_CLOSED_ERROR);
  });
  const actual = "the server answered HTTP 403 for /scenarios/failure-surfaces/blocked";
  assert.deepEqual(result, {
    commandId: "c-click",
    actionType: "web.dom.click",
    status: "failed",
    validation: { status: "failed", expected: EXPECTED, actual },
    message: "The click landed on /scenarios/failure-surfaces/blocked, which the server answered with HTTP 403.",
    failure: { category: "navigation_unexpected", code: "web.navigation.unexpected", retryable: false, stage: "confirmation", expected: EXPECTED, actual },
    startedAt: 5_000,
    finishedAt: 5_000
  });
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure);
});

for (const [landing, status] of [["no navigation", undefined], ["a page served 200", 200]] as const) {
  test(`a click whose reply is lost, after ${landing}, rethrows the refusal unchanged`, async (t) => {
    const browser = installBrowser(t, { "doc-fine": status });
    const refusal = new Error(CHANNEL_CLOSED_ERROR);
    await assert.rejects(
      sendClickCheckingLanding(CLICK, TAB_ID, async () => {
        if (status !== undefined) land(browser, `${ORIGIN}/fine`, "doc-fine");
        throw refusal;
      }),
      (error: unknown) => error === refusal
    );
    assert.equal(browser.listening(), 0);
  });
}
