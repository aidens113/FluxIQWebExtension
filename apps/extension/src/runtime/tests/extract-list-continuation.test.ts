// T1 coverage of extract-list-continuation.ts: how the worker carries a
// paginated list read into each document its pagination loads.
//
// The page's half -- sending a checkpoint before each control and going on from
// a resume -- is proven against real pages by the content harness
// (`e2e/content/tests/extraction/tests/extract-list-continuation.spec.ts`), and
// the whole chain against a real site by the Lab's bigbox `pickup-towels`
// recording lane. What must be right here is what the worker sends and when,
// which a page cannot observe, so the chrome API is stubbed and every call the
// module makes is read back.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { BrowserActionCommand, BrowserActionResult } from "../../shared/protocol";
import { EXTRACTION_CHECKPOINT_MESSAGE, type ExtractionCheckpoint } from "../../shared/extraction-continuation";
import { runBrowserActionCommand } from "../action-runner";
import { sendExtractListAcrossDocuments as sendAcross } from "../extract-list-continuation";

const TAB_ID = 7;
const CONTENT_SCRIPT_VERSION = 2;
const CHANNEL_CLOSED = "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received";

type Listener = (message: unknown, sender: { tab?: { id?: number }; frameId?: number }, sendResponse: (response?: unknown) => void) => unknown;

/** What one delivered action does: checkpoint under the token it was sent, then either lose its reply or answer. */
type Delivery = {
  checkpoints?: Array<{ checkpoint: ExtractionCheckpoint; tabId?: number; frameId?: number; token?: string }>;
  outcome: { lost: string } | { reply: BrowserActionResult };
};

type Sent = { message: Record<string, unknown>; frameId: number | undefined };

const ACTION: BrowserActionCommand = {
  commandId: "c-list",
  actionType: "web.dom.extract_list",
  tabId: TAB_ID,
  frameId: 0,
  timeoutMs: 50_000,
  extractList: { item: "li", fields: { name: ".name" }, paginate: { next: "a.next", maxPages: 5 } }
};

const REPLY: BrowserActionResult = {
  commandId: "c-list",
  actionType: "web.dom.extract_list",
  status: "succeeded",
  message: "List extracted.",
  validation: { status: "passed", expected: "at least 1 record", actual: "3 records from 2 pages" },
  startedAt: Number.MAX_SAFE_INTEGER,
  finishedAt: Number.MAX_SAFE_INTEGER
};

const PAGE_ONE: ExtractionCheckpoint = { records: [{ name: "One" }, { name: "Two" }], pagesRead: 1, scrolls: 0, missingFields: [] };
const PAGE_TWO: ExtractionCheckpoint = { records: [{ name: "One" }, { name: "Two" }, { name: "Three" }], pagesRead: 2, scrolls: 0, missingFields: [] };

/** Installs a chrome stub that plays `deliveries` in order, one per action send, and records what was sent. */
function installChromeStub(deliveries: Delivery[], options: { tabClosed?: boolean } = {}): { sent: Sent[]; listeners: Set<Listener> } {
  const listeners = new Set<Listener>();
  const sent: Sent[] = [];
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
      get: (tabId: number) => (options.tabClosed ? Promise.reject(new Error(`No tab with id: ${tabId}.`)) : Promise.resolve({ id: tabId, status: "complete" })),
      onUpdated: { addListener: () => undefined, removeListener: () => undefined },
      sendMessage: (_tabId: number, message: Record<string, unknown>, options: { frameId?: number }, callback: (response: unknown) => void) => {
        if (message["type"] === "fluxiq.ping") {
          callback({ ok: true, active: true, version: CONTENT_SCRIPT_VERSION });
          return;
        }
        sent.push({ message: structuredClone(message), frameId: options.frameId });
        const delivery = pending.shift() ?? { outcome: { reply: REPLY } };
        const token = (message["extraction"] as { token?: string } | undefined)?.token;
        for (const checkpoint of delivery.checkpoints ?? []) {
          const body = { type: EXTRACTION_CHECKPOINT_MESSAGE, token: checkpoint.token ?? token, checkpoint: checkpoint.checkpoint };
          const sender = { tab: { id: checkpoint.tabId ?? TAB_ID }, frameId: checkpoint.frameId ?? 0 };
          for (const listener of [...listeners]) listener(structuredClone(body), sender, () => undefined);
        }
        if ("lost" in delivery.outcome) {
          runtime.lastError = { message: delivery.outcome.lost };
          callback(undefined);
          delete runtime.lastError;
          return;
        }
        callback(structuredClone(delivery.outcome.reply));
      }
    }
  };
  return { sent, listeners };
}

function uninstall(): void {
  delete (globalThis as { chrome?: unknown }).chrome;
}

const message = { type: "executeAction", action: ACTION, frameId: 0, topFrameOnly: false };

/** How many times the module asked for a frame to be made ready. */
let readied = 0;

/**
 * The module with frame messaging as the runner's `sendToTab` and
 * `ensureContentScript` behave: a send settles through the callback and
 * `lastError`, and making a frame ready is counted.
 */
function sendExtractListAcrossDocuments(action: BrowserActionCommand, tabId: number, body: Record<string, unknown>, frameId: number): Promise<BrowserActionResult> {
  type Chrome = { runtime: { lastError?: { message: string } }; tabs: { sendMessage(tabId: number, message: unknown, options: { frameId: number }, callback: (response: unknown) => void): void } };
  const chrome = (globalThis as unknown as { chrome: Chrome }).chrome;
  return sendAcross(action, tabId, body, frameId, {
    send: <TResponse>(target: number, sent: unknown, frame: number) => new Promise<TResponse>((resolve, reject) => {
      chrome.tabs.sendMessage(target, sent, { frameId: frame }, (response) => {
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve(response as TResponse);
      });
    }),
    makeReady: () => {
      readied += 1;
      return Promise.resolve();
    }
  });
}

test("a reply lost after a checkpoint is sent again with that checkpoint, and its reply is the read's", async () => {
  const readiedBefore = readied;
  const stub = installChromeStub([
    { checkpoints: [{ checkpoint: PAGE_ONE }], outcome: { lost: CHANNEL_CLOSED } },
    { outcome: { reply: REPLY } }
  ]);
  try {
    const result = await sendExtractListAcrossDocuments(ACTION, TAB_ID, message, 0);
    assert.equal(stub.sent.length, 2);
    const [first, second] = stub.sent.map((entry) => entry.message["extraction"] as { token: string; resume?: ExtractionCheckpoint });
    assert.ok(first && second);
    // The same token both times, so the next document's checkpoints are taken too.
    assert.equal(typeof first.token, "string");
    assert.equal(second.token, first.token);
    assert.equal(first.resume, undefined);
    assert.deepEqual(second.resume, PAGE_ONE);
    // The rest of the message is the runner's, and the action is the same action.
    assert.equal(stub.sent[1]?.message["type"], "executeAction");
    assert.equal((stub.sent[1]?.message["action"] as BrowserActionCommand).commandId, "c-list");
    assert.equal(stub.sent[1]?.frameId, 0);
    // The new document was made ready before the read went into it.
    assert.equal(readied - readiedBefore, 1);
    assert.equal(result.status, "succeeded");
    // One read, so it started when the first document's read did, not when the last one's did.
    assert.ok(result.startedAt < Number.MAX_SAFE_INTEGER);
    assert.equal(stub.listeners.size, 0, "the checkpoint listener outlived the command");
  } finally {
    uninstall();
  }
});

test("each document's checkpoint replaces the last, so the read goes on from the latest", async () => {
  const stub = installChromeStub([
    { checkpoints: [{ checkpoint: PAGE_ONE }], outcome: { lost: CHANNEL_CLOSED } },
    { checkpoints: [{ checkpoint: PAGE_TWO }], outcome: { lost: CHANNEL_CLOSED } },
    { outcome: { reply: REPLY } }
  ]);
  try {
    await sendExtractListAcrossDocuments(ACTION, TAB_ID, message, 0);
    assert.deepEqual(stub.sent.map((entry) => (entry.message["extraction"] as { resume?: ExtractionCheckpoint }).resume?.pagesRead), [undefined, 1, 2]);
  } finally {
    uninstall();
  }
});

test("a reply lost before any checkpoint pressed nothing, so the read goes out again from the start", async () => {
  const stub = installChromeStub([{ outcome: { lost: CHANNEL_CLOSED } }, { outcome: { reply: REPLY } }]);
  try {
    const result = await sendExtractListAcrossDocuments(ACTION, TAB_ID, message, 0);
    assert.equal(result.status, "succeeded");
    assert.deepEqual(stub.sent.map((entry) => (entry.message["extraction"] as { resume?: unknown }).resume), [undefined, undefined]);
  } finally {
    uninstall();
  }
});

test("a checkpoint from another tab, another frame or another command is not taken", async () => {
  const stub = installChromeStub([
    {
      checkpoints: [
        { checkpoint: PAGE_TWO, tabId: TAB_ID + 1 },
        { checkpoint: PAGE_TWO, frameId: 3 },
        { checkpoint: PAGE_TWO, token: "someone-else" },
        { checkpoint: { records: [{ name: 7 }], pagesRead: 1, scrolls: 0, missingFields: [] } as unknown as ExtractionCheckpoint }
      ],
      outcome: { lost: CHANNEL_CLOSED }
    },
    { outcome: { reply: REPLY } }
  ]);
  try {
    await sendExtractListAcrossDocuments(ACTION, TAB_ID, message, 0);
    assert.equal((stub.sent[1]?.message["extraction"] as { resume?: unknown }).resume, undefined);
  } finally {
    uninstall();
  }
});

test("documents that go away without a checkpoint are allowed three in a row, then the refusal stands", async () => {
  const lost: Delivery = { outcome: { lost: CHANNEL_CLOSED } };
  const stub = installChromeStub([lost, lost, lost, lost, lost]);
  try {
    await assert.rejects(sendExtractListAcrossDocuments(ACTION, TAB_ID, message, 0), new RegExp(CHANNEL_CLOSED.slice(0, 40), "u"));
    assert.equal(stub.sent.length, 4);
    assert.equal(stub.listeners.size, 0);
  } finally {
    uninstall();
  }
});

test("a closed tab, or a child frame, ends the read with the refusal it met", async () => {
  const closed = installChromeStub([{ checkpoints: [{ checkpoint: PAGE_ONE }], outcome: { lost: CHANNEL_CLOSED } }], { tabClosed: true });
  try {
    await assert.rejects(sendExtractListAcrossDocuments(ACTION, TAB_ID, message, 0), /message channel closed/u);
    assert.equal(closed.sent.length, 1);
  } finally {
    uninstall();
  }
  const child = installChromeStub([{ checkpoints: [{ checkpoint: PAGE_ONE, frameId: 3 }], outcome: { lost: CHANNEL_CLOSED } }]);
  try {
    await assert.rejects(sendExtractListAcrossDocuments({ ...ACTION, frameId: 3 }, TAB_ID, { ...message, frameId: 3 }, 3), /message channel closed/u);
    assert.equal(child.sent.length, 1);
  } finally {
    uninstall();
  }
});

test("each send carries the time the read has left, and at least 1 ms once it has none", async (t) => {
  let now = 1_000_000;
  t.mock.method(Date, "now", () => now);
  const stub = installChromeStub([
    { checkpoints: [{ checkpoint: PAGE_ONE }], outcome: { lost: CHANNEL_CLOSED } },
    { checkpoints: [{ checkpoint: PAGE_TWO }], outcome: { lost: CHANNEL_CLOSED } },
    { outcome: { reply: REPLY } }
  ]);
  type SendMessage = (tabId: number, body: Record<string, unknown>, options: unknown, callback: unknown) => void;
  const chrome = (globalThis as unknown as { chrome: { tabs: { sendMessage: SendMessage } } }).chrome;
  const send = chrome.tabs.sendMessage;
  // Each action send takes 30 s of the command's 50 s.
  chrome.tabs.sendMessage = (tabId, body, options, callback) => {
    if (body["type"] === "executeAction") now += 30_000;
    send(tabId, body, options, callback);
  };
  try {
    await sendExtractListAcrossDocuments(ACTION, TAB_ID, message, 0);
    assert.deepEqual(stub.sent.map((entry) => (entry.message["action"] as BrowserActionCommand).timeoutMs), [50_000, 20_000, 1]);
  } finally {
    uninstall();
  }
});

test("the runner sends a paginated list read through the continuation and every other action as before", async () => {
  const run = async (action: BrowserActionCommand): Promise<Sent[]> => {
    const stub = installChromeStub([]);
    try {
      await runBrowserActionCommand({ action, attachTabForRecording: () => Promise.resolve() });
      return stub.sent;
    } finally {
      uninstall();
    }
  };
  const paged = await run(ACTION);
  assert.equal(typeof (paged[0]?.message["extraction"] as { token?: unknown } | undefined)?.token, "string");
  const { paginate: _paginate, ...onePage } = ACTION.extractList ?? { item: "", fields: {} };
  const single = await run({ ...ACTION, extractList: onePage });
  assert.equal(single[0]?.message["extraction"], undefined);
});
