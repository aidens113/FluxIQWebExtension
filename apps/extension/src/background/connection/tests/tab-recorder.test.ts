// Coverage of tab-recorder.ts: which tab changes a recording keeps as actions.
// Another page coming to the front is a switch, named by its path alone; a new
// tab's switch waits for the path it commits; closing the tab the recording is
// in is a close. A page a recording cannot see, a tab change FluxIQ made while
// running a command, and a close of any other tab record nothing.
//
// That each recorded change is counted once and sent with its input id is
// covered where that happens, in recorded-event-intake.test.ts.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { RecordingEventPayload, RecordingState } from "../../../shared/protocol";
import { EventSequence } from "../event-sequence";
import { TabRecorder, type KnownActiveTab } from "../tab-recorder";

const LIST = "https://lab.test:4100/scenarios/multi-tab/";
const DETAILS = "https://lab.test:4100/scenarios/multi-tab/details?order=17&token=secret-token#summary";
const CONTROL_PAGE = "chrome-extension://abcdefghijklmnop/sidepanel/index.html";
// A page with a real origin that the extension still refuses to record.
const WEB_STORE = "https://chromewebstore.google.com/detail/fluxiq/abcdefghijklmnop";

const listPage: KnownActiveTab = { tabId: 1, url: LIST };

function harness() {
  let recordingState: RecordingState = "recording";
  let recordingId = "recording-1";
  let runtimeBusy = false;
  const recorded: Array<{ payload: RecordingEventPayload; tabId: number | undefined }> = [];
  const recorder = new TabRecorder({
    recordingState: () => recordingState,
    recordingId: () => recordingId,
    runtimeBusy: () => runtimeBusy,
    sequence: new EventSequence(),
    recordEvent: async (payload, tabId) => {
      recorded.push({ payload, tabId });
    }
  });
  return {
    recorder,
    recorded,
    operations: () => recorded.map((entry) => entry.payload.tab),
    setRecording: (state: RecordingState, id: string) => {
      recordingState = state;
      recordingId = id;
    },
    setRuntimeBusy: (busy: boolean) => {
      runtimeBusy = busy;
    }
  };
}

function inFront(id: number, url: string | undefined, title = ""): chrome.tabs.Tab {
  return { id, url, title, active: true } as chrome.tabs.Tab;
}

function behind(id: number, url: string): chrome.tabs.Tab {
  return { id, url, title: "", active: false } as chrome.tabs.Tab;
}

test("another page coming to the front records a switch named by its path alone, and coming back records another", async () => {
  const h = harness();
  await h.recorder.noteTabUpdate(inFront(2, DETAILS, "Order 17"), listPage);
  assert.equal(h.recorded.length, 1);
  const [switched] = h.recorded;
  assert.equal(switched?.payload.kind, "browser.tab");
  assert.deepEqual(switched?.payload.tab, { operation: "switch", urlPath: "/scenarios/multi-tab/details" });
  assert.equal(switched?.payload.url, "https://lab.test:4100/scenarios/multi-tab/details");
  assert.equal(switched?.payload.title, "Order 17");
  assert.equal(switched?.tabId, 2, "the tab switched to is where its evidence is read");
  const wire = JSON.stringify(h.recorded);
  for (const leaked of ["token", "order=17", "summary"]) assert.equal(wire.includes(leaked), false, `the query and hash never cross: ${leaked}`);

  await h.recorder.noteTabUpdate(inFront(2, DETAILS, "Order 17 (loaded)"), { tabId: 2, url: DETAILS });
  assert.equal(h.recorded.length, 1, "the page in front updating is not a switch");

  await h.recorder.noteTabUpdate(inFront(1, LIST), { tabId: 2, url: DETAILS });
  assert.deepEqual(h.operations(), [
    { operation: "switch", urlPath: "/scenarios/multi-tab/details" },
    { operation: "switch", urlPath: "/scenarios/multi-tab/" }
  ]);
});

test("the page a recording starts in, and a page changing behind it, record nothing", async () => {
  const h = harness();
  await h.recorder.noteTabUpdate(inFront(1, LIST), listPage);
  await h.recorder.noteTabUpdate(behind(2, DETAILS), listPage);
  assert.deepEqual(h.recorded, []);

  const unseeded = harness();
  await unseeded.recorder.noteTabUpdate(inFront(1, LIST), undefined);
  assert.deepEqual(unseeded.recorded, [], "with no page known, the first page in front is where the recording is");
  await unseeded.recorder.noteTabUpdate(inFront(2, DETAILS), { tabId: 1, url: LIST });
  assert.deepEqual(unseeded.operations(), [{ operation: "switch", urlPath: "/scenarios/multi-tab/details" }]);
});

test("a page a recording cannot see records no switch, and passing through one is not a switch", async () => {
  const h = harness();
  await h.recorder.noteTabUpdate(inFront(3, CONTROL_PAGE), listPage);
  await h.recorder.noteTabUpdate(inFront(4, "chrome://settings/"), undefined);
  await h.recorder.noteTabUpdate(inFront(5, WEB_STORE), undefined);
  assert.deepEqual(h.recorded, [], "the control page, a browser page and the web store");

  await h.recorder.noteTabUpdate(inFront(1, LIST), undefined);
  assert.deepEqual(h.recorded, [], "back on the page the recording never left");
});

test("a new tab in front before its URL commits records the switch under the path it commits", async () => {
  const h = harness();
  await h.recorder.noteTabUpdate(inFront(2, ""), listPage);
  await h.recorder.noteTabUpdate(inFront(2, "about:blank"), listPage);
  assert.deepEqual(h.recorded, [], "nothing to name it by yet");
  await h.recorder.noteTabUpdate(inFront(2, DETAILS), undefined);
  assert.deepEqual(h.operations(), [{ operation: "switch", urlPath: "/scenarios/multi-tab/details" }]);

  const left = harness();
  await left.recorder.noteTabUpdate(inFront(2, ""), listPage);
  await left.recorder.noteTabUpdate(inFront(1, LIST), listPage);
  await left.recorder.noteTabUpdate(behind(2, DETAILS), listPage);
  assert.deepEqual(left.recorded, [], "a new tab the user left before it loaded was never switched to");
});

test("a new tab that commits later than the bound records no switch, but the recording follows it", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 50_000 });
  const h = harness();
  await h.recorder.noteTabUpdate(inFront(2, ""), listPage);
  t.mock.timers.tick(10_001);
  await h.recorder.noteTabUpdate(inFront(2, DETAILS), undefined);
  assert.deepEqual(h.recorded, []);
  await h.recorder.noteTabUpdate(inFront(1, LIST), { tabId: 2, url: DETAILS });
  assert.deepEqual(h.operations(), [{ operation: "switch", urlPath: "/scenarios/multi-tab/" }]);
});

test("closing the tab the recording is in records a close; closing another tab does not", async () => {
  const h = harness();
  await h.recorder.noteTabUpdate(inFront(2, DETAILS), listPage);
  await h.recorder.noteTabRemoved(1, { tabId: 2, url: DETAILS });
  assert.equal(h.recorded.length, 1, "the list tab is not the tab the recording is in");

  await h.recorder.noteTabRemoved(2, { tabId: 2, url: DETAILS });
  const closed = h.recorded.at(-1);
  assert.deepEqual(closed?.payload.tab, { operation: "close" });
  assert.equal(closed?.tabId, undefined, "a closed tab has no page to read");
  assert.equal(closed?.payload.url, "https://lab.test:4100/scenarios/multi-tab/details");

  await h.recorder.noteTabUpdate(inFront(1, LIST), undefined);
  assert.deepEqual(h.operations(), [
    { operation: "switch", urlPath: "/scenarios/multi-tab/details" },
    { operation: "close" },
    { operation: "switch", urlPath: "/scenarios/multi-tab/" }
  ], "the page the browser fronts after the close is where the recording went");
});

test("a close that is a recording's first tab event is of the page the extension had in front", async () => {
  const h = harness();
  await h.recorder.noteTabRemoved(1, listPage);
  assert.deepEqual(h.operations(), [{ operation: "close" }]);
  assert.equal(h.recorded[0]?.payload.url, "https://lab.test:4100/scenarios/multi-tab/");
});

test("a tab change FluxIQ makes while running a command records nothing, and the recording follows it", async () => {
  const h = harness();
  h.setRuntimeBusy(true);
  await h.recorder.noteTabUpdate(inFront(2, DETAILS), listPage);
  await h.recorder.noteTabRemoved(2, { tabId: 2, url: DETAILS });
  await h.recorder.noteTabUpdate(inFront(3, ""), undefined);
  h.setRuntimeBusy(false);
  await h.recorder.noteTabUpdate(inFront(3, LIST), undefined);
  assert.deepEqual(h.recorded, [], "a switch, a close, and a new tab that finished opening after the command");

  await h.recorder.noteTabUpdate(inFront(1, LIST), undefined);
  assert.deepEqual(h.operations(), [{ operation: "switch", urlPath: "/scenarios/multi-tab/" }], "a person's switch after it is recorded");
});

test("nothing is recorded while no recording runs, and a new recording starts from its own page", async () => {
  const h = harness();
  h.setRecording("idle", "recording-1");
  await h.recorder.noteTabUpdate(inFront(2, DETAILS), listPage);
  await h.recorder.noteTabRemoved(1, listPage);
  assert.deepEqual(h.recorded, []);

  h.setRecording("recording", "recording-1");
  await h.recorder.noteTabUpdate(inFront(2, DETAILS), listPage);
  assert.equal(h.recorded.length, 1);

  h.setRecording("recording", "recording-2");
  await h.recorder.noteTabUpdate(inFront(1, LIST), listPage);
  assert.equal(h.recorded.length, 1, "the second recording starts on the list page, not on the first one's details tab");
});
