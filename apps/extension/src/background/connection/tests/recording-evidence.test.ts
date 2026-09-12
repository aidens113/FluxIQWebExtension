// What one recorded event costs, and what goes on the wire with it.
//
// The reporter's merge is the expensive thing in the recording path: one
// `captureSnapshot` round trip per frame, each a full content-script DOM sweep
// that Phase 1.4 made seven passes heavier, on every click, input, change,
// submit and keydown. `connection.ts` now puts the merged snapshot on the
// recording event as well as projecting state from it, and the whole point of
// `captureEventSnapshot` is that doing both costs one merge rather than two.
//
// So these tests count round trips rather than trusting the shape of the code.
// The counterfactual is measured too -- the naive two-call sequence, which
// doubles the sweep -- because a regression here is invisible in any assertion
// about output: both shapes produce the same messages.
//
// The frame snapshots are hand-written, so what is proven is the joinery and
// its cost, not the browser behaviour the snapshots stand for.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { RecordingEventPayload } from "../../../shared/protocol";
import type { TabSnapshotTransport } from "../dom-snapshot";
import { gatewayRecordingEventFromPayload } from "../gateway-payloads";
import { RecordingEvidenceReporter, type RecordingEvidenceDeps } from "../recording-evidence";
import type { StateAssetStore } from "../state-assets";

const TAB_ID = 11;
const CHILD_FRAME_ID = 1;

function topFrameSnapshot() {
  return {
    url: "https://shop.test/checkout",
    title: "Checkout",
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 },
    frame: { isTop: true },
    interactiveElements: [{ tagName: "button", selector: "button.pay", text: "Pay", bounds: { x: 40, y: 600, width: 160, height: 44 }, documentBounds: { x: 40, y: 600, width: 160, height: 44 } }]
  };
}

function childFrameSnapshot() {
  return {
    url: "https://payments.test/card",
    title: "Card details",
    viewport: { width: 600, height: 400, scrollX: 0, scrollY: 0 },
    frame: { isTop: false, viewportOffset: { x: 40, y: 200, width: 600, height: 400 } },
    interactiveElements: [{ tagName: "input", selector: "#card", name: "Card number", bounds: { x: 20, y: 40, width: 300, height: 32 }, documentBounds: { x: 20, y: 40, width: 300, height: 32 } }]
  };
}

function clickPayload(snapshot?: unknown): RecordingEventPayload {
  return {
    kind: "dom.click",
    sequence: 4,
    url: "https://shop.test/checkout",
    title: "Checkout",
    eventTimestampMs: 900,
    element: { tagName: "input", selector: "#card", text: "" },
    ...(snapshot === undefined ? {} : { snapshot })
  } as unknown as RecordingEventPayload;
}

type Harness = {
  reporter: RecordingEvidenceReporter;
  /** `captureSnapshot` round trips into the tab so far -- the cost being measured. */
  captureCount: () => number;
  sent: Array<{ type: string; payload: unknown }>;
};

function harnessFor(frames: Record<number, unknown>): Harness {
  let captureCount = 0;
  const sent: Array<{ type: string; payload: unknown }> = [];
  const transport: TabSnapshotTransport = {
    sendToTab: async <TResponse = unknown>(_tabId: number, message: unknown, frameId?: number): Promise<TResponse> => {
      if ((message as { type?: string }).type === "captureSnapshot") captureCount += 1;
      return frames[frameId ?? 0] as TResponse;
    },
    allTabFrames: async () => Object.keys(frames).map((frameId) => ({ frameId: Number(frameId) })) as never
  };
  const send: RecordingEvidenceDeps["send"] = async (type, payload) => {
    sent.push({ type, payload });
  };
  const deps: RecordingEvidenceDeps = {
    send,
    recordingState: () => "recording",
    // No project id, so no screenshot is attempted: this measures the DOM
    // sweep, which is what a second merge would double.
    resolveProjectId: async () => undefined,
    onActivity: () => undefined,
    emitStatus: () => undefined,
    clientId: () => "client-1",
    activeTabId: () => TAB_ID,
    activeTabUrl: () => "https://shop.test/checkout",
    unsupportedPage: () => undefined,
    setUnsupportedPage: () => undefined,
    transport,
    ensureContentScript: async () => undefined,
    attachTabForRecording: async () => undefined,
    activeTab: async () => undefined,
    allTabs: async () => [],
    stateAssets: {} as StateAssetStore,
    screenshotDiagnostics: () => ({})
  };
  return { reporter: new RecordingEvidenceReporter(deps), captureCount: () => captureCount, sent };
}

/** The reporter narrates every capture, which drowns the counts these tests are about. */
async function quietly<TResult>(run: () => Promise<TResult>): Promise<TResult> {
  const { info, warn } = console;
  console.info = () => undefined;
  console.warn = () => undefined;
  try {
    return await run();
  } finally {
    console.info = info;
    console.warn = warn;
  }
}

/** Exactly what `connection.ts` does for one executable recorded action. */
async function recordOneEvent(harness: Harness, payload: RecordingEventPayload, frameId: number): Promise<RecordingEventPayload> {
  return quietly(async () => {
    const captured = await harness.reporter.captureEventSnapshot(payload, TAB_ID, frameId);
    const recorded = captured.snapshot === undefined ? payload : { ...payload, snapshot: captured.snapshot };
    await harness.reporter.sendRecordingEvidence(payload, TAB_ID, frameId, captured);
    return recorded;
  });
}

test("one recorded event costs one cross-frame merge, not two", async () => {
  const single = harnessFor({ 0: topFrameSnapshot() });
  await recordOneEvent(single, clickPayload(topFrameSnapshot()), 0);
  assert.equal(single.captureCount(), 1, "a single-frame page: one round trip, the same as before the event carried the merge");

  const three = harnessFor({ 0: topFrameSnapshot(), [CHILD_FRAME_ID]: childFrameSnapshot(), 2: childFrameSnapshot() });
  await recordOneEvent(three, clickPayload(childFrameSnapshot()), CHILD_FRAME_ID);
  assert.equal(three.captureCount(), 3, "three frames: one round trip per frame, and the seeded frame is not re-read");
});

// The regression this guard exists to prevent, measured rather than described.
// Without the captured snapshot the reporter merges again, and every count
// above doubles -- on every click, input, change, submit and keydown.
test("without the captured snapshot the reporter merges a second time", async () => {
  const harness = harnessFor({ 0: topFrameSnapshot(), [CHILD_FRAME_ID]: childFrameSnapshot(), 2: childFrameSnapshot() });
  const payload = clickPayload(childFrameSnapshot());
  await quietly(async () => {
    await harness.reporter.captureEventSnapshot(payload, TAB_ID, CHILD_FRAME_ID);
    await harness.reporter.sendRecordingEvidence(payload, TAB_ID, CHILD_FRAME_ID);
  });
  assert.equal(harness.captureCount(), 6, "two merges of a three-frame page: the cost the fourth argument avoids");
});

test("a capture that came back with nothing is not tried again", async () => {
  const harness = harnessFor({ 0: { notASnapshot: true } });
  const payload = clickPayload(undefined);
  const captured = await quietly(async () => {
    const result = await harness.reporter.captureEventSnapshot(payload, TAB_ID, 0);
    await harness.reporter.sendRecordingEvidence(payload, TAB_ID, 0, result);
    return result;
  });
  assert.equal(captured.snapshot, undefined, "the tab answered with nothing a snapshot could be read from");
  assert.equal(harness.captureCount(), 2, "the failed attempt was the top-frame read and the frame sweep, and neither happened twice");
  assert.deepEqual(harness.sent.map((message) => message.type), ["client.state_update"], "and the evidence still went out, without a snapshot");
});

// Condition 1 of the swap. An ordinary page is one frame, so if the merged
// snapshot ever reshaped one this would be the first thing to notice.
test("on a single-frame page the recorded event is byte-identical to the frame-local one", async () => {
  const harness = harnessFor({ 0: topFrameSnapshot() });
  const payload = clickPayload(topFrameSnapshot());
  const recorded = await recordOneEvent(harness, payload, 0);
  const tabMerged = gatewayRecordingEventFromPayload(recorded, TAB_ID, 0, "rec-1");
  const frameLocal = gatewayRecordingEventFromPayload(payload, TAB_ID, 0, "rec-1");
  assert.equal(JSON.stringify(tabMerged), JSON.stringify(frameLocal));
});

// And the upgrade itself: on a page made of more than one frame the event stops
// describing the frame the interaction happened in and starts describing the
// page, in the same terms the state projected beside it uses.
test("on a multi-frame page the recorded event carries the whole tab", async () => {
  const harness = harnessFor({ 0: topFrameSnapshot(), [CHILD_FRAME_ID]: childFrameSnapshot() });
  const payload = clickPayload(childFrameSnapshot());
  const recorded = await recordOneEvent(harness, payload, CHILD_FRAME_ID);
  const frameLocal = payload.snapshot as { url: string; interactiveElements: { selector: string }[] };
  const merged = recorded.snapshot as unknown as { url: string; interactiveElements: { selector: string }[] };

  assert.deepEqual(frameLocal.interactiveElements.map((element) => element.selector), ["#card"], "what the content script saw");
  // The frame the event came from leads, because its snapshot is the seed the
  // merge is given rather than one of the frames it goes and reads.
  assert.deepEqual(
    merged.interactiveElements.map((element) => element.selector),
    [`frame[${CHILD_FRAME_ID}] >> #card`, "button.pay"],
    "what the page is, with the child frame's selectors qualified as the merge qualifies them"
  );
  assert.equal(merged.url, "https://shop.test/checkout", "the page's URL, not the payment iframe's");
  assert.deepEqual(harness.sent.map((message) => message.type), ["client.snapshot"], "the state beside it is projected from that same merge");
});
