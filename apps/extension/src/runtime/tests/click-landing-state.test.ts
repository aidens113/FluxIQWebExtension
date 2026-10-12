// T1 coverage of click-landing.ts for a check or a choice that navigates its
// page (t407). Recovery matrix row 3 (bigbox-retail, run
// rmx-2026-10-10T06-59-14-650Z-30bb9a): every rating facet is a checkbox whose
// filter form reloads the page as it is ticked, so the content script's reply
// was lost to "message channel closed", the step failed `web.action.failed`,
// and the retry read "already set" -- five false failures a run. A check
// declares a state, so a lost reply is now judged by reading that state on the
// new document.
//
// The browser is stubbed as click-landing.test.ts stubs it: the three
// `webNavigation` events, and `scripting.executeScript` for the served status.
// The landed page answers at the sender: its robot-check reading, and the fact
// check that reads the requested state.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { FACT_CHECK_MESSAGE } from "../../shared/fact-check-message";
import type { BrowserActionCommand, BrowserActionResult } from "../../shared/protocol";
import { sendClickCheckingLanding } from "../click-landing";
import type { LandedTabAccess } from "../landed-check-wait";

const TAB_ID = 41;
const ORIGIN = "http://127.0.0.1:4000";
const CHANNEL_CLOSED_ERROR =
  "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received";
/** `NAVIGATION_START_GRACE_MS` in the module. */
const START_GRACE_MS = 300;

const SELECTOR = "input[type=\"checkbox\"][value=\"customer_rating:4 & up\"]";
const CHECK: BrowserActionCommand = { commandId: "c-check", actionType: "web.dom.check", selector: SELECTOR, element: { selector: SELECTOR }, checked: true };
const SELECT: BrowserActionCommand = { commandId: "c-select", actionType: "web.dom.select", selector: "#sort", value: "price-asc" };
const EXPECTED_CHECK = "the requested state holds on the page the check led to";

const REPLY: BrowserActionResult = {
  commandId: "c-check",
  actionType: "web.dom.check",
  status: "succeeded",
  message: "Check state set.",
  validation: { status: "passed", expected: "the control is checked", actual: "the checkbox is checked" },
  startedAt: 100,
  finishedAt: 120
};

type NavigationEventName = "onBeforeNavigate" | "onCommitted" | "onErrorOccurred";
type Listener = (details: Record<string, unknown>) => void;
type Browser = { fire(event: NavigationEventName, details: Record<string, unknown>): void; listening(): number };

function installBrowser(t: TestContext, statuses: Record<string, number> = {}): Browser {
  const listeners: Record<NavigationEventName, Set<Listener>> = { onBeforeNavigate: new Set(), onCommitted: new Set(), onErrorOccurred: new Set() };
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
      executeScript: (details: { target: { documentIds?: string[] }; func: () => unknown }) => {
        served = statuses[details.target.documentIds?.[0] ?? "top"];
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
    listening: () => listeners.onBeforeNavigate.size + listeners.onCommitted.size + listeners.onErrorOccurred.size
  };
}

/** The page reloading under the check: a top-frame navigation that starts and commits at once. */
function reload(browser: Browser, documentId: string): void {
  const url = `${ORIGIN}/scenarios/bigbox/search?q=towels&rating=4&token=s3cret`;
  browser.fire("onBeforeNavigate", { url });
  browser.fire("onCommitted", { url, documentId });
}

/**
 * The landed page: no robot check unless `robotCheck` says otherwise, and
 * `state` as the fact check's answer about the requested state. Counts the
 * fact checks it was asked.
 */
function landedPage(state: Record<string, unknown>, robotCheck: Record<string, unknown> = { challenge: null }): LandedTabAccess & { factChecks: number } {
  const access = {
    factChecks: 0,
    send: <T>(_tabId: number, message: unknown) => {
      if ((message as { type?: unknown }).type !== FACT_CHECK_MESSAGE) return Promise.resolve(robotCheck as T);
      access.factChecks += 1;
      return Promise.resolve({ answers: [{ ...state, capturedAt: 1 }] } as T);
    },
    settle: () => Promise.resolve()
  };
  return access;
}

const HOLDS = { result: "true", evidence: { element: { tagName: "input", role: "checkbox" } } };
const DOES_NOT_HOLD = { result: "false", evidence: { element: { tagName: "input", role: "checkbox" } } };

test("a check whose reply is lost to the reload it caused succeeded when the control is checked on the new page", async (t) => {
  t.mock.method(Date, "now", () => 5_000);
  const browser = installBrowser(t, { "doc-filtered": 200 });
  const page = landedPage(HOLDS);
  const result = await sendClickCheckingLanding(CHECK, TAB_ID, async () => {
    reload(browser, "doc-filtered");
    throw new Error(CHANNEL_CLOSED_ERROR);
  }, page);
  assert.deepEqual(result, {
    commandId: "c-check",
    actionType: "web.dom.check",
    status: "succeeded",
    validation: {
      status: "passed",
      expected: EXPECTED_CHECK,
      actual: "the check navigated its page before it could answer; on the page it landed on the control is checked"
    },
    message: "The check navigated its page before it could answer, and the requested state holds there.",
    startedAt: 5_000,
    finishedAt: 5_000
  });
  assert.equal(page.factChecks, 1);
  assert.doesNotMatch(JSON.stringify(result), /s3cret/u);
  assert.equal(browser.listening(), 0);
});

test("a check whose control is unchecked on the new page fails as its own read-back does, retryable", async (t) => {
  const browser = installBrowser(t, { "doc-filtered": 200 });
  const result = await sendClickCheckingLanding(CHECK, TAB_ID, async () => {
    reload(browser, "doc-filtered");
    throw new Error(CHANNEL_CLOSED_ERROR);
  }, landedPage(DOES_NOT_HOLD));
  const actual = "the check navigated its page before it could answer; on the page it landed on the control is unchecked";
  assert.equal(result.status, "failed");
  assert.equal(result.message, "The check navigated its page before it could answer, and the requested state does not hold there.");
  assert.deepEqual(result.validation, { status: "failed", expected: EXPECTED_CHECK, actual });
  assert.deepEqual(result.failure, {
    category: "output_not_observed",
    code: "web.validation.output_not_observed",
    retryable: true,
    stage: "verification",
    expected: EXPECTED_CHECK,
    actual
  });
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure);
});

test("a check whose new page cannot say fails as the lost reply did, retryable, saying why", async (t) => {
  const browser = installBrowser(t, { "doc-filtered": 200 });
  const result = await sendClickCheckingLanding(CHECK, TAB_ID, async () => {
    reload(browser, "doc-filtered");
    throw new Error(CHANNEL_CLOSED_ERROR);
  }, landedPage({ result: "unknown", evidence: { reason: "ambiguous" } }));
  assert.equal(result.status, "failed");
  assert.equal(result.failure?.code, "web.action.failed");
  assert.equal(result.failure?.retryable, true);
  assert.equal(
    result.validation.status === "failed" ? result.validation.actual : "",
    "the check navigated its page before it could answer; the page it landed on could not say whether the control is checked (ambiguous)"
  );
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure);
});

test("a choice whose reply is lost to the reload it caused succeeded when the select holds it, quoting no option", async (t) => {
  const browser = installBrowser(t, { "doc-sorted": 200 });
  const result = await sendClickCheckingLanding(SELECT, TAB_ID, async () => {
    reload(browser, "doc-sorted");
    throw new Error(CHANNEL_CLOSED_ERROR);
  }, landedPage({ result: "true" }));
  assert.equal(result.status, "succeeded");
  assert.equal(result.message, "The choice navigated its page before it could answer, and the requested state holds there.");
  assert.equal(
    result.validation.status === "passed" ? result.validation.actual : "",
    "the choice navigated its page before it could answer; on the page it landed on the select holds the requested option"
  );
  assert.doesNotMatch(JSON.stringify(result), /price-asc/u);
});

test("a check whose reload lands on a robot check only a person can answer fails as needing a person, in a check's words", async (t) => {
  const browser = installBrowser(t, { "doc-check": 200 });
  const page = landedPage(HOLDS, { challenge: "captcha", robotCheck: "person_only" });
  const result = await sendClickCheckingLanding(CHECK, TAB_ID, async () => {
    reload(browser, "doc-check");
    throw new Error(CHANNEL_CLOSED_ERROR);
  }, page);
  assert.equal(result.status, "failed");
  assert.equal(result.failure?.code, "web.intervention.required");
  assert.equal(result.message, "The check was made and landed on a robot check at /scenarios/bigbox/search, which only a person can answer.");
  assert.equal(page.factChecks, 0, "a robot check is not asked about the control");
});

test("a check whose reload lands on a page served 403 fails as navigation_unexpected, in a check's words", async (t) => {
  const browser = installBrowser(t, { "doc-refused": 403 });
  const result = await sendClickCheckingLanding(CHECK, TAB_ID, async () => {
    reload(browser, "doc-refused");
    throw new Error(CHANNEL_CLOSED_ERROR);
  }, landedPage(HOLDS));
  assert.equal(result.status, "failed");
  assert.equal(result.failure?.code, "web.navigation.unexpected");
  assert.equal(result.message, "The check landed on /scenarios/bigbox/search, which the server answered with HTTP 403.");
});

test("a check whose reply is lost with no navigation rethrows the refusal unchanged, without asking the page", async (t) => {
  const browser = installBrowser(t);
  const page = landedPage(HOLDS);
  const refusal = new Error(CHANNEL_CLOSED_ERROR);
  await assert.rejects(sendClickCheckingLanding(CHECK, TAB_ID, async () => { throw refusal; }, page), (error: unknown) => error === refusal);
  assert.equal(page.factChecks, 0);
  assert.equal(browser.listening(), 0);
});

test("a check refused before delivery rethrows at once, even when a navigation then commits", async (t) => {
  const browser = installBrowser(t, { "doc-filtered": 200 });
  const page = landedPage(HOLDS);
  const refusal = new Error("Could not establish connection. Receiving end does not exist.");
  const sentAt = Date.now();
  await assert.rejects(
    sendClickCheckingLanding(CHECK, TAB_ID, async () => {
      reload(browser, "doc-filtered");
      throw refusal;
    }, page),
    (error: unknown) => error === refusal
  );
  assert.ok(Date.now() - sentAt < START_GRACE_MS, "an undelivered check is not given the start grace");
  assert.equal(page.factChecks, 0);
  assert.equal(browser.listening(), 0);
});

test("a check that answered is returned as it was, at once, whatever its tab then did", async (t) => {
  const browser = installBrowser(t, { "doc-filtered": 200 });
  const page = landedPage(DOES_NOT_HOLD);
  const sentAt = Date.now();
  const result = await sendClickCheckingLanding(CHECK, TAB_ID, async () => {
    reload(browser, "doc-filtered");
    return REPLY;
  }, page);
  assert.equal(result, REPLY);
  assert.ok(Date.now() - sentAt < START_GRACE_MS, "an answered check pays no start grace");
  assert.equal(page.factChecks, 0);
  assert.equal(browser.listening(), 0);
});

test("a check in a child frame is not judged by the top frame's landing: its lost reply rethrows unchanged", async (t) => {
  const browser = installBrowser(t, { "doc-filtered": 200 });
  const page = landedPage(HOLDS);
  const refusal = new Error(CHANNEL_CLOSED_ERROR);
  await assert.rejects(
    sendClickCheckingLanding(CHECK, TAB_ID, async () => {
      reload(browser, "doc-filtered");
      throw refusal;
    }, page, undefined, 3),
    (error: unknown) => error === refusal
  );
  assert.equal(page.factChecks, 0);
  assert.equal(browser.listening(), 0);
});

test("a click's lost reply is still judged as a press: it never asks the page about a state", async (t) => {
  const browser = installBrowser(t, { "doc-filtered": 200 });
  const page = landedPage(DOES_NOT_HOLD);
  const click: BrowserActionCommand = { commandId: "c-click", actionType: "web.dom.click", selector: "#go" };
  const result = await sendClickCheckingLanding(click, TAB_ID, async () => {
    reload(browser, "doc-filtered");
    throw new Error(CHANNEL_CLOSED_ERROR);
  }, page);
  assert.equal(result.status, "succeeded");
  assert.equal(result.message, "The click navigated its page before it could answer.");
  assert.equal(page.factChecks, 0);
});
