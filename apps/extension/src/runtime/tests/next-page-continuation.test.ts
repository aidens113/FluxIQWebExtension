// T1 coverage of how the worker carries `web.dom.next_page` into the document
// its press loads (`../next-page-continuation.ts`, `sendNextPageAcrossDocuments`).
//
// A press on a link takes the content script that pressed it away with the
// command unanswered. The page marks the press under the command's token just
// before it makes it, so a reply lost after a mark is a list that moved: the
// worker waits for the tab, makes the new document ready, and asks it whether
// the list arrived, handing it the mark. A reply lost before any mark pressed
// nothing, so the move goes out again from the start. No rows are carried.
// The page's half is `content/extraction/page-advance/tests/move-page.test.ts`.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { BrowserActionCommand, BrowserActionResult } from "../../shared/protocol";
import { PAGE_MOVE_MARK_MESSAGE, type PageMoveMark } from "../../shared/extraction-continuation";
import { runBrowserActionCommand } from "../action-runner";
import { sendNextPageAcrossDocuments } from "../next-page-continuation";

const TAB_ID = 7;
const CONTENT_SCRIPT_VERSION = 2;
const CHANNEL_CLOSED = "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received";

type Listener = (message: unknown, sender: { tab?: { id?: number }; frameId?: number }, sendResponse: (response?: unknown) => void) => unknown;

/** What one delivered action does: mark under the token it was sent, then either lose its reply or answer. */
type Delivery = { marks?: Array<{ mark: unknown; token?: string; tabId?: number; frameId?: number }>; outcome: { lost: string } | { reply: BrowserActionResult } };

const ACTION: BrowserActionCommand = {
  commandId: "c-next",
  actionType: "web.dom.next_page",
  tabId: TAB_ID,
  frameId: 0,
  timeoutMs: 30_000,
  nextPage: { item: "li.result", pagination: { next: "a.next" } }
};

const MOVED: BrowserActionResult = {
  commandId: "c-next",
  actionType: "web.dom.next_page",
  status: "succeeded",
  message: "The list moved to its next page.",
  validation: { status: "passed", expected: "the list on its next page", actual: "moved by next to page 3" },
  nextPage: { outcome: "moved", by: "next", page: 3 },
  startedAt: Number.MAX_SAFE_INTEGER,
  finishedAt: Number.MAX_SAFE_INTEGER
};

/** Installs a chrome stub that plays `deliveries` in order, one per action send, and records every action message sent. */
function installChromeStub(deliveries: Delivery[], options: { tabClosed?: boolean } = {}): { sent: Array<Record<string, unknown>>; listeners: Set<Listener>; readied: () => number } {
  const listeners = new Set<Listener>();
  const sent: Array<Record<string, unknown>> = [];
  let pings = 0;
  const runtime: { lastError?: { message: string }; onMessage: unknown } = {
    onMessage: {
      addListener: (listener: Listener) => void listeners.add(listener),
      removeListener: (listener: Listener) => void listeners.delete(listener)
    }
  };
  const pending = [...deliveries];
  (globalThis as { chrome?: unknown }).chrome = {
    runtime,
    tabs: {
      get: (tabId: number) => options.tabClosed ? Promise.reject(new Error("No tab with id")) : Promise.resolve({ id: tabId, status: "complete", url: "https://shop.test/results?page=2" }),
      onUpdated: { addListener: () => undefined, removeListener: () => undefined },
      sendMessage: (_tabId: number, message: Record<string, unknown>, _options: { frameId?: number }, callback: (response: unknown) => void) => {
        if (message["type"] === "fluxiq.ping") {
          pings += 1;
          callback({ ok: true, active: true, version: CONTENT_SCRIPT_VERSION });
          return;
        }
        if (message["type"] !== "executeAction") {
          callback(undefined);
          return;
        }
        sent.push(structuredClone(message));
        const delivery = pending.shift() ?? { outcome: { reply: MOVED } };
        const token = (message["extraction"] as { token?: string } | undefined)?.token;
        for (const { mark, token: own, tabId, frameId } of delivery.marks ?? []) {
          const body = { type: PAGE_MOVE_MARK_MESSAGE, token: own ?? token, mark };
          for (const listener of [...listeners]) listener(structuredClone(body), { tab: { id: tabId ?? TAB_ID }, frameId: frameId ?? 0 }, () => undefined);
        }
        if ("lost" in delivery.outcome) {
          runtime.lastError = { message: delivery.outcome.lost };
          callback(undefined);
          delete runtime.lastError;
          return;
        }
        callback(structuredClone(delivery.outcome.reply));
      }
    },
    webNavigation: { getAllFrames: () => Promise.resolve([]) },
    scripting: { executeScript: () => Promise.resolve([]) }
  };
  return { sent, listeners, readied: () => pings };
}

function uninstall(): void {
  delete (globalThis as { chrome?: unknown }).chrome;
}

const continuation = (message: Record<string, unknown> | undefined): { token?: unknown; resume?: unknown } | undefined =>
  message?.["extraction"] as { token?: unknown; resume?: unknown } | undefined;

async function run(deliveries: Delivery[]): Promise<{ result: BrowserActionResult; sent: Array<Record<string, unknown>>; listeners: number }> {
  const stub = installChromeStub(deliveries);
  try {
    const { result } = await runBrowserActionCommand({ action: ACTION, attachTabForRecording: () => Promise.resolve() });
    return { result, sent: stub.sent, listeners: stub.listeners.size };
  } finally {
    uninstall();
  }
}

test("the runner sends a next page through the cross-document resend: with a token, and no resume", async () => {
  const { result, sent, listeners } = await run([]);
  assert.equal(sent.length, 1);
  assert.equal(typeof continuation(sent[0])?.token, "string");
  assert.equal(continuation(sent[0])?.resume, undefined);
  assert.deepEqual(result.nextPage, { outcome: "moved", by: "next", page: 3 });
  assert.equal(listeners, 0, "the mark listener outlived the command");
});

test("a reply lost after the press was marked asks the new document whether the list arrived, handing it the mark", async () => {
  const mark: PageMoveMark = { by: "following" };
  const { result, sent } = await run([{ marks: [{ mark }], outcome: { lost: CHANNEL_CLOSED } }, { outcome: { reply: MOVED } }]);
  assert.equal(sent.length, 2);
  const [first, second] = sent.map(continuation);
  assert.equal(second?.token, first?.token);
  assert.deepEqual(second?.resume, mark);
  assert.equal((sent[1]?.["action"] as BrowserActionCommand).actionType, "web.dom.next_page");
  assert.equal(result.status, "succeeded");
  assert.ok(result.startedAt < Number.MAX_SAFE_INTEGER, "one move, started when the press was asked for");
});

test("a reply lost before any mark pressed nothing, so the move goes out again from the start", async () => {
  const { sent } = await run([{ outcome: { lost: CHANNEL_CLOSED } }, { outcome: { reply: MOVED } }]);
  assert.deepEqual(sent.map((message) => continuation(message)?.resume), [undefined, undefined]);
});

test("a refused landing's reload carries the refusal it spent into the next document", async () => {
  const refused: PageMoveMark = { by: "next", refusals: { retries: 1, rateLimits: 1 } };
  const { sent } = await run([
    { marks: [{ mark: { by: "next" } }], outcome: { lost: CHANNEL_CLOSED } },
    { marks: [{ mark: refused }], outcome: { lost: CHANNEL_CLOSED } },
    { outcome: { reply: MOVED } }
  ]);
  assert.deepEqual(sent.map((message) => continuation(message)?.resume), [undefined, { by: "next" }, refused]);
});

test("a mark that is not one, or under another token, is not taken", async () => {
  const { sent } = await run([
    { marks: [{ mark: { by: "sideways" } }, { mark: { by: "next" }, token: "someone-else" }, { mark: { by: "next", rows: [{ a: "b" }] } }], outcome: { lost: CHANNEL_CLOSED } },
    { outcome: { reply: MOVED } }
  ]);
  assert.equal(continuation(sent[1])?.resume, undefined);
});

test("movement marks from another tab or frame cannot authorize a resumed landing", async () => {
  const { sent, listeners } = await run([
    { marks: [{ mark: { by: "next" }, tabId: TAB_ID + 1 }, { mark: { by: "next" }, frameId: 3 }], outcome: { lost: CHANNEL_CLOSED } },
    { outcome: { reply: MOVED } }
  ]);
  assert.equal(continuation(sent[1])?.resume, undefined);
  assert.equal(listeners, 0);
});

async function directSend(deliveries: Delivery[], options: { tabClosed?: boolean; frameId?: number; makeReadyError?: Error } = {}): Promise<{ result: BrowserActionResult; sent: Record<string, unknown>[]; listeners: number }> {
  const stub = installChromeStub(deliveries, options);
  type ChromeStub = { runtime: { lastError?: { message: string } }; tabs: { sendMessage(tabId: number, message: unknown, options: { frameId: number }, callback: (response: unknown) => void): void } };
  const installed = (globalThis as unknown as { chrome: ChromeStub }).chrome;
  try {
    const result = await sendNextPageAcrossDocuments(ACTION, TAB_ID, { type: "executeAction", action: ACTION }, options.frameId ?? 0, {
      send: <TResponse>(tabId: number, message: unknown, frameId: number) => new Promise<TResponse>((resolve, reject) => {
        installed.tabs.sendMessage(tabId, message, { frameId }, (response) => {
          const error = installed.runtime.lastError;
          if (error) reject(new Error(error.message));
          else resolve(response as TResponse);
        });
      }),
      makeReady: async () => {
        if (options.makeReadyError) throw options.makeReadyError;
      }
    });
    return { result, sent: stub.sent, listeners: stub.listeners.size };
  } catch (error) {
    assert.equal(stub.listeners.size, 0, "failed movement leaked its listener");
    throw error;
  } finally {
    uninstall();
  }
}

test("closed tab and reassigned child frame propagate the original delivery failure and remove the listener", async () => {
  const lost: Delivery[] = [{ outcome: { lost: CHANNEL_CLOSED } }];
  await assert.rejects(directSend(lost, { tabClosed: true }), /message channel closed/u);
  await assert.rejects(directSend(lost, { frameId: 4 }), /message channel closed/u);
});

test("a readiness cancellation ends continuation and releases its movement listener", async () => {
  const cancelled = new Error("Movement cancelled during document readiness");
  cancelled.name = "AbortError";
  await assert.rejects(directSend([{ marks: [{ mark: { by: "next" } }], outcome: { lost: CHANNEL_CLOSED } }], { makeReadyError: cancelled }), (error) => error === cancelled);
});

test("four unmarked lost documents exhaust the movement fence and clean up", async () => {
  const lost: Delivery = { outcome: { lost: CHANNEL_CLOSED } };
  await assert.rejects(directSend([lost, lost, lost, lost]), /message channel closed/u);
});

test("the resumed landing carries the remaining deadline and a one millisecond final budget", async (t) => {
  let now = 1_000_000;
  t.mock.method(Date, "now", () => now);
  const stub = installChromeStub([
    { marks: [{ mark: { by: "next" } }], outcome: { lost: CHANNEL_CLOSED } },
    { marks: [{ mark: { by: "next", refusals: { retries: 1 } } }], outcome: { lost: CHANNEL_CLOSED } },
    { outcome: { reply: MOVED } }
  ]);
  type Send = (tabId: number, body: Record<string, unknown>, options: unknown, callback: unknown) => void;
  const tabs = (globalThis as unknown as { chrome: { tabs: { sendMessage: Send; get(tabId: number): Promise<{ id: number; status: string }> } } }).chrome.tabs;
  // Readiness is independent of this clock: an already-complete unnamed tab
  // needs no URL-stability interval in the transport's budget regression.
  tabs.get = async (tabId) => ({ id: tabId, status: "complete" });
  const original = tabs.sendMessage;
  tabs.sendMessage = (tabId, body, options, callback) => {
    if (body["type"] === "executeAction") now += 20_000;
    original(tabId, body, options, callback);
  };
  try {
    await runBrowserActionCommand({ action: ACTION, attachTabForRecording: () => Promise.resolve() });
    assert.deepEqual(stub.sent.map((message) => (message["action"] as BrowserActionCommand).timeoutMs), [30_000, 10_000, 1]);
    assert.equal(stub.listeners.size, 0);
  } finally {
    uninstall();
  }
});
