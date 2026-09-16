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
/**
 * A node as the tally sees it: what it is attached to, and whether it carries
 * an attribute. That is the whole of what `picker-host.ts` asks of a node, and
 * asking it of plain objects is what lets the tally be tested here at all.
 */
type FakeNode = { parentNode: FakeNode | null; hasAttribute(name: string): boolean };
type FakeRecord = { type: "childList" | "attributes" | "characterData"; target: FakeNode; addedNodes: FakeNode[]; removedNodes: FakeNode[] };

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

/** A node of the page itself, carrying no attribute at all. */
const pageNode = (): FakeNode => ({ parentNode: null, hasAttribute: () => false });

/** The picker's overlay host, and anything the overlay put inside it. */
const overlayNode = (): FakeNode => ({ parentNode: null, hasAttribute: (name) => name === "data-fluxiq-picker" });

const added = (count = 1): FakeRecord => ({
  type: "childList",
  target: pageNode(),
  addedNodes: Array.from({ length: count }, pageNode),
  removedNodes: []
});

const changedText = (): FakeRecord => ({ type: "characterData", target: pageNode(), addedNodes: [], removedNodes: [] });
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
    const executable: RecordingEventKind[] = ["dom.click", "dom.input", "dom.change", "dom.submit", "dom.keydown", "data.extract"];
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
    deliver?.([{ type: "attributes", target: pageNode(), addedNodes: [], removedNodes: [] }]);
    t.mock.timers.tick(500);
    emit("dom.keydown", {});
    assert.deepEqual(kinds(), ["dom.click", "dom.mutation", "dom.keydown"]);
    assert.deepEqual(sent[1]?.payload.mutation, { added: 0, removed: 0, attributes: 1, text: 0 });
  });
});

test("records the observer has queued but not yet delivered are counted in the flush", async (t) => {
  await whileRecording(t, ({ emit }) => {
    deliver?.([added()]);
    undelivered = [added(3), changedText()];
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

test("the picker's overlay is not a page change: its host, and what it holds, are not counted", async (t) => {
  await whileRecording(t, ({ emit }) => {
    const host = overlayNode();
    const insideOverlay: FakeNode = { parentNode: host, hasAttribute: () => false };
    deliver?.([
      // The overlay goes up in the same batch as a change the page made.
      { type: "childList", target: pageNode(), addedNodes: [host, pageNode()], removedNodes: [] },
      // The highlight moves.
      { type: "attributes", target: insideOverlay, addedNodes: [], removedNodes: [] },
      // The pick ends and the overlay comes down.
      { type: "childList", target: pageNode(), addedNodes: [], removedNodes: [host] }
    ]);
    emit("dom.click", {});
    assert.deepEqual(kinds(), ["dom.mutation", "dom.click"]);
    assert.deepEqual(
      sent[0]?.payload.mutation,
      { added: 1, removed: 0, attributes: 0, text: 0 },
      "only the node the page itself added is counted"
    );
  });
});

test("a data.extract carries the definition it was given", async (t) => {
  await whileRecording(t, ({ emit }) => {
    const extraction = {
      form: "list",
      datasetId: "products-1a2b3c4d",
      label: "Products",
      request: { item: "[data-testid=\"product-card\"]", fields: { product_name: "[data-testid=\"product-name\"]" } },
      fieldLabels: { product_name: "product-name" },
      itemCount: 8
    } as const;
    emit("data.extract", { extraction });
    assert.deepEqual(kinds(), ["data.extract"]);
    assert.deepEqual(sent[0]?.payload.extraction, extraction);
  });
});
