// The recorder sends a DOM change it is still batching before any event that
// can become an executable action, so a recording never shows a click ahead of
// the addition that produced its target (`i-late-target-wait`, Task 4 option 2).
// Before this, the batch left 500 ms after the page went quiet, which put W25's
// late-revealed button's `dom.mutation` after the click on it in 3 of 3 Stage 1
// recordings.
//
// The runner is Node, so the page is a stub: `recorder.ts` builds its
// MutationObserver and `instance.ts` claims `window` while loading, which is why
// the stubs go in first and the recorder is loaded by a dynamic import rather
// than a static one. Every global is put back afterwards, because every test
// bundle runs in one process. The observer is driven by hand, which is the
// point: the order of what reaches `chrome.runtime.sendMessage` is the subject,
// not whether Chromium delivers mutation records. That half is the content
// harness's.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { captureSettings } from "../capture-settings";
import type { RecordingEventKind, RecordingEventPayload } from "../types";

type Recorder = typeof import("../recorder");
type FakeRecord = { type: "childList" | "attributes" | "characterData"; addedNodes: { length: number }; removedNodes: { length: number } };

const STUB_GLOBALS = ["window", "document", "location", "chrome", "MutationObserver"] as const;
const stubWindow: Record<string, unknown> = {};
const sent: Array<{ type: string; payload: RecordingEventPayload }> = [];
/** Records the page made that the observer has not delivered yet, as `takeRecords` hands them over. */
let undelivered: FakeRecord[] = [];
let deliver: ((records: FakeRecord[]) => void) | undefined;
let recorder: Recorder | undefined;

class StubMutationObserver {
  constructor(callback: (records: FakeRecord[]) => void) {
    deliver = callback;
  }
  observe(): void {}
  disconnect(): void {}
  takeRecords(): FakeRecord[] {
    const taken = undelivered;
    undelivered = [];
    return taken;
  }
}

const added = (count = 1): FakeRecord => ({ type: "childList", addedNodes: { length: count }, removedNodes: { length: 0 } });
const kinds = (): RecordingEventKind[] => sent.map((message) => message.payload.kind);

/** Runs `body` against a recording recorder on a stub page, with `setTimeout` mocked, and restores every global. */
async function whileRecording(t: TestContext, body: (loaded: Recorder) => void): Promise<void> {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = new Map(STUB_GLOBALS.map((name) => [name, Object.getOwnPropertyDescriptor(globals, name)]));
  const settings = { ...captureSettings };
  globals["window"] = stubWindow;
  // `evidence/interactions.ts`, loaded through the snapshot, starts listening on load.
  globals["document"] = { documentElement: {}, title: "Stub page", readyState: "complete", addEventListener: () => undefined };
  globals["location"] = { href: "http://127.0.0.1:4173/scenarios/stub/" };
  globals["chrome"] = { runtime: { sendMessage: (message: { type: string; payload: RecordingEventPayload }) => { sent.push(message); return Promise.resolve(); } } };
  globals["MutationObserver"] = StubMutationObserver;
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    recorder ??= await import("../recorder");
    Object.assign(captureSettings, { mutations: true, inputValues: true, snapshots: false });
    recorder.setRecordingState(true);
    sent.length = 0;
    undelivered = [];
    body(recorder);
  } finally {
    recorder?.setRecordingState(false);
    Object.assign(captureSettings, settings);
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globals, name, descriptor);
      else delete globals[name];
    }
  }
}

test("a click after a DOM addition sends the dom.mutation first, and the quiet period does not send it again", async (t) => {
  await whileRecording(t, ({ emit }) => {
    deliver?.([added(2)]);
    assert.deepEqual(kinds(), [], "the batch is still waiting for the page to go quiet");
    emit("dom.click", {});
    assert.deepEqual(kinds(), ["dom.mutation", "dom.click"]);
    assert.deepEqual(sent[0]?.payload.mutation, { added: 2, removed: 0, attributes: 0, text: 0 });
    assert.ok((sent[0]?.payload.sequence ?? 0) < (sent[1]?.payload.sequence ?? 0), "the mutation's sequence is the lower one");
    t.mock.timers.tick(500);
    assert.deepEqual(kinds(), ["dom.mutation", "dom.click"], "the flushed batch's timer was cleared");
  });
});

test("every kind that can be executable flushes the batch first; a kind that cannot leaves it to the timer", async (t) => {
  await whileRecording(t, ({ emit }) => {
    const executable: RecordingEventKind[] = ["dom.click", "dom.input", "dom.change", "dom.submit", "dom.keydown"];
    for (const kind of executable) {
      sent.length = 0;
      deliver?.([added()]);
      emit(kind, {});
      assert.deepEqual(kinds(), ["dom.mutation", kind], kind);
    }
    for (const kind of ["dom.scroll", "dom.focus", "browser.navigation"] as const) {
      sent.length = 0;
      deliver?.([added()]);
      emit(kind, {});
      assert.deepEqual(kinds(), [kind], kind);
      t.mock.timers.tick(500);
      assert.deepEqual(kinds(), [kind, "dom.mutation"], `${kind} leaves the batch to the quiet period`);
    }
  });
});

test("with nothing pending an executable event sends only itself, also after the timer already sent the batch", async (t) => {
  await whileRecording(t, ({ emit }) => {
    emit("dom.click", {});
    assert.deepEqual(kinds(), ["dom.click"]);
    deliver?.([{ type: "attributes", addedNodes: { length: 0 }, removedNodes: { length: 0 } }]);
    t.mock.timers.tick(500);
    emit("dom.keydown", {});
    assert.deepEqual(kinds(), ["dom.click", "dom.mutation", "dom.keydown"]);
    assert.deepEqual(sent[1]?.payload.mutation, { added: 0, removed: 0, attributes: 1, text: 0 });
  });
});

test("records the observer has queued but not yet delivered are counted in the flush", async (t) => {
  await whileRecording(t, ({ emit }) => {
    deliver?.([added()]);
    undelivered = [added(3), { type: "characterData", addedNodes: { length: 0 }, removedNodes: { length: 0 } }];
    emit("dom.submit", {});
    assert.deepEqual(kinds(), ["dom.mutation", "dom.submit"]);
    assert.deepEqual(sent[0]?.payload.mutation, { added: 4, removed: 0, attributes: 0, text: 1 });
  });
});

test("with mutation capture off nothing is flushed, and the flush adds no field to the action's payload", async (t) => {
  await whileRecording(t, ({ emit }) => {
    emit("dom.click", {});
    const alone = sent[0]?.payload;
    sent.length = 0;
    captureSettings.mutations = false;
    undelivered = [added()];
    deliver?.([added()]);
    emit("dom.click", {});
    assert.deepEqual(kinds(), ["dom.click"]);
    assert.deepEqual(Object.keys(sent[0]?.payload ?? {}).sort(), Object.keys(alone ?? {}).sort());
  });
});
