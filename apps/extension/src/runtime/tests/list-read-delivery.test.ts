import assert from "node:assert/strict";
import { test } from "node:test";
import type { BrowserActionCommand, BrowserActionResult } from "../../shared/protocol";
import { runBrowserActionCommand } from "../action-runner";

const ACTION: BrowserActionCommand = {
  commandId: "read-current-page",
  actionType: "web.dom.extract_list",
  tabId: 7,
  frameId: 0,
  timeoutMs: 5_000,
  extractList: { item: "li", fields: { name: ".name" } }
};

const REPLY: BrowserActionResult = {
  commandId: ACTION.commandId,
  actionType: ACTION.actionType,
  status: "succeeded",
  message: "List extracted.",
  validation: { status: "passed", expected: "current page", actual: "current page" },
  startedAt: 1,
  finishedAt: 2
};

async function deliver(action: BrowserActionCommand, fail: boolean): Promise<{ sent: Record<string, unknown>[]; listeners: number; result: BrowserActionResult }> {
  const sent: Record<string, unknown>[] = [];
  let listeners = 0;
  const runtime: { lastError?: { message: string }; onMessage: unknown } = {
    onMessage: {
      addListener: () => { listeners += 1; },
      removeListener: () => { listeners -= 1; }
    }
  };
  (globalThis as { chrome?: unknown }).chrome = {
    runtime,
    tabs: {
      get: (tabId: number) => Promise.resolve({ id: tabId, status: "complete" }),
      onUpdated: { addListener: () => undefined, removeListener: () => undefined },
      sendMessage: (_tabId: number, message: Record<string, unknown>, _options: unknown, callback: (result: unknown) => void) => {
        if (message["type"] === "fluxiq.ping") {
          callback({ ok: true, active: true, version: 2 });
          return;
        }
        sent.push(structuredClone(message));
        if (fail) {
          runtime.lastError = { message: "The message port closed before a response was received" };
          callback(undefined);
          delete runtime.lastError;
          return;
        }
        callback(REPLY);
      }
    },
    webNavigation: { getAllFrames: () => Promise.resolve([]) },
    scripting: { executeScript: () => Promise.resolve([]) }
  };
  try {
    const { result } = await runBrowserActionCommand({ action, attachTabForRecording: () => Promise.resolve() });
    return { sent, listeners, result };
  } catch (error) {
    assert.equal(sent.length, 1, "failed read was resent through document continuation");
    assert.equal(sent[0]?.["extraction"], undefined);
    assert.equal(listeners, 0);
    throw error;
  } finally {
    delete (globalThis as { chrome?: unknown }).chrome;
  }
}

test("a list read uses ordinary page delivery without a checkpoint token or listener", async () => {
  const { sent, listeners, result } = await deliver(ACTION, false);
  assert.equal(result.status, "succeeded");
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.["extraction"], undefined);
  assert.equal(listeners, 0);
});

test("legacy paginate cannot select the retired worker checkpoint transport", async () => {
  const legacy = { ...ACTION, extractList: { ...ACTION.extractList!, paginate: { next: "a.next", maxPages: 1 } } };
  const { sent, listeners } = await deliver(legacy, false);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.["extraction"], undefined);
  assert.equal(listeners, 0);
});

test("a lost list reply is not resumed as an accumulated multipage read", async () => {
  await assert.rejects(deliver(ACTION, true), /message port closed/u);
});
