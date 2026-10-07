// T1 coverage of how the worker carries `web.dom.next_page` into the document
// its press loads (`../extract-list-continuation.ts`, `sendNextPageAcrossDocuments`).
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

const TAB_ID = 7;
const CONTENT_SCRIPT_VERSION = 2;
const CHANNEL_CLOSED = "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received";

type Listener = (message: unknown, sender: { tab?: { id?: number }; frameId?: number }, sendResponse: (response?: unknown) => void) => unknown;

/** What one delivered action does: mark under the token it was sent, then either lose its reply or answer. */
type Delivery = { marks?: Array<{ mark: unknown; token?: string }>; outcome: { lost: string } | { reply: BrowserActionResult } };

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
function installChromeStub(deliveries: Delivery[]): { sent: Array<Record<string, unknown>>; listeners: Set<Listener>; readied: () => number } {
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
      get: (tabId: number) => Promise.resolve({ id: tabId, status: "complete", url: "https://shop.test/results?page=2" }),
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
        for (const { mark, token: own } of delivery.marks ?? []) {
          const body = { type: PAGE_MOVE_MARK_MESSAGE, token: own ?? token, mark };
          for (const listener of [...listeners]) listener(structuredClone(body), { tab: { id: TAB_ID }, frameId: 0 }, () => undefined);
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
