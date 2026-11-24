// t968: the worker's half of the act mark. A mark counts only from the tab and
// frame the command went to, under the command's own token; one still in flight
// when a lost reply is judged is waited for briefly.

import assert from "node:assert/strict";
import test from "node:test";
import { ACT_MARK_MESSAGE } from "../../../shared/act-mark-message";
import { watchActMark, type ActMarkEvents } from "..";

const TAB_ID = 41;
type MessageListener = (message: unknown, sender: chrome.runtime.MessageSender) => boolean | void;

function channel(): { events: ActMarkEvents; post(message: unknown, sender?: chrome.runtime.MessageSender): void; listening(): number } {
  const listeners = new Set<MessageListener>();
  return {
    events: { addListener: (listener) => void listeners.add(listener), removeListener: (listener) => void listeners.delete(listener) },
    post: (message, sender = { tab: { id: TAB_ID } as chrome.tabs.Tab, frameId: 0 }) => {
      for (const listener of [...listeners]) listener(message, sender);
    },
    listening: () => listeners.size
  };
}

test("a mark from another tab, another frame or another command is not this press's", async () => {
  const messages = channel();
  const mark = watchActMark(TAB_ID, 0, messages.events, "token-4")!;
  messages.post({ type: ACT_MARK_MESSAGE, token: "token-4" }, { tab: { id: 7 } as chrome.tabs.Tab, frameId: 0 });
  messages.post({ type: ACT_MARK_MESSAGE, token: "token-4" }, { tab: { id: TAB_ID } as chrome.tabs.Tab, frameId: 3 });
  messages.post({ type: ACT_MARK_MESSAGE, token: "other" });
  assert.equal(await mark.settle(0), false);
  messages.post({ type: ACT_MARK_MESSAGE, token: "token-4" });
  assert.equal(await mark.settle(0), true);
  mark.stop();
  assert.equal(messages.listening(), 0);
});

test("a mark still in flight when the lost reply is judged is waited for briefly, and none is a press not made", async () => {
  const messages = channel();
  const mark = watchActMark(TAB_ID, 0, messages.events, "token-5")!;
  setTimeout(() => messages.post({ type: ACT_MARK_MESSAGE, token: "token-5" }), 20);
  assert.equal(await mark.settle(500), true);
  mark.stop();
  const silent = watchActMark(TAB_ID, 0, messages.events, "token-6")!;
  assert.equal(await silent.settle(30), false);
  silent.stop();
});

test("with no message channel there is no watch, and the press is judged as before marks", () => {
  // Passing undefined asks for the default, the worker's own `chrome.runtime.onMessage`; this run shares one
  // process with every other test file, so the worker's channel is taken away here rather than assumed absent.
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = Object.getOwnPropertyDescriptor(globals, "chrome");
  Object.defineProperty(globals, "chrome", { configurable: true, writable: true, value: undefined });
  try {
    assert.equal(watchActMark(TAB_ID, 0, undefined), undefined);
  } finally {
    if (previous) Object.defineProperty(globals, "chrome", previous);
    else delete globals["chrome"];
  }
});
