// T1 coverage of action-runner.ts: the failed result the runtime reports when
// an action cannot run, and the frame an action is delivered to.
//
// Frame routing is covered here rather than only in the browser because the
// thing that must be right is an argument to `chrome.tabs.sendMessage` -- which
// frame the message is addressed to -- and a page cannot observe its own
// delivery. So the chrome API the runner drives is stubbed and the calls it
// makes are read back. What this cannot prove is that an addressed message
// really arrives at that frame and nowhere else; `e2e/content/tests/frames.spec.ts`
// proves the receiving half against a real page of iframes.
//
// The same goes for the readiness probe a child-frame action now runs first:
// the stub can say a frame is not listening and that injecting into it makes it
// listen, but only a loaded extension recovering from a real reload proves the
// injection reaches the frame Chrome was told to inject into.
//
// The rest of the runner's decisions are covered where they live --
// command-options, navigation-outcome, and unsupported-page.

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import type { BrowserActionCommand, BrowserActionResult } from "../../shared/protocol";
import { browserActionFailure, runBrowserActionCommand } from "../action-runner";

test("a failure is reported against its command, finished the moment it started", (t) => {
  t.mock.method(Date, "now", () => 9_000);
  assert.deepEqual(
    browserActionFailure(
      { commandId: "c-9", actionType: "web.dom.click", selector: "#buy", tabId: 4 },
      "Browser and extension pages cannot be automated."
    ),
    {
      commandId: "c-9",
      actionType: "web.dom.click",
      status: "failed",
      // The action never ran, so its post-condition did not hold: the failure
      // is stated as a comparison rather than left as "not yet validated".
      validation: {
        status: "failed",
        expected: "the action to run",
        actual: "Browser and extension pages cannot be automated."
      },
      message: "Browser and extension pages cannot be automated.",
      failure: {
        category: "action_failed",
        code: "web.action.failed",
        retryable: true,
        stage: "execution",
        expected: "the action to run",
        actual: "Browser and extension pages cannot be automated."
      },
      startedAt: 9_000,
      finishedAt: 9_000
    }
  );
});

test("the failure it reports survives Core's parser, which drops a record it refuses", () => {
  const result = browserActionFailure({ commandId: "c-9", actionType: "web.dom.click" }, "Runtime action failed.");
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure);
});

const TAB_ID = 41;

/** What a `fluxiq.ping` must answer before `background/tabs.ts` calls a frame ready. */
const CONTENT_SCRIPT_VERSION = 2;

/** Chrome's own words when a message reaches a frame with no listener. */
const CONNECTION_ERROR = "Could not establish connection. Receiving end does not exist.";

/** One `chrome.tabs.sendMessage` the runner made: the tab, the body, and the frame it addressed. */
type SentToTab = { tabId: number; message: Record<string, unknown>; frameId: number | undefined };

/**
 * What the runner did to the browser. Readiness pings are kept apart from
 * actions: every child-frame action now pings the frame first, and a row about
 * where an action was delivered should not have to filter that out.
 */
type ChromeCalls = { sent: SentToTab[]; pinged: number[]; injected: number[][] };

/** The content script's answer. Returned verbatim, so a test can tell the runner's own result from the frame's. */
const FRAME_REPLY: BrowserActionResult = {
  commandId: "c-frame",
  actionType: "web.dom.click",
  status: "succeeded",
  message: "Element clicked.",
  validation: { status: "passed", expected: "the click lands on the target", actual: "it did" },
  startedAt: 1,
  finishedAt: 2
};

/**
 * The chrome API the runner drives, reduced to what one in-page action touches,
 * with every call recorded.
 *
 * `tabs.get` answers a tab with no URL, which is a shape the runner already has
 * a rule for: an unreadable URL means "judge the action by its own outcome", so
 * the page guard stands aside. It is also what makes `waitForTabReady` settle
 * at once -- its stability window compares the URL with the last one it saw,
 * and two unknowns are already stable -- so a routing test costs no wall clock.
 *
 * `frames` is what `webNavigation.getAllFrames` reports; `undefined` is the
 * browser declining to answer, which the runner reads as "unknown", not "none".
 *
 * `silent` names the frames with no FluxIQ content script listening -- what an
 * extension reload leaves behind, since the frames survive it and their scripts
 * do not. Injecting into one makes it answer, unless it is also `uninjectable`,
 * which is a frame whose origin the manifest does not cover.
 */
function installChromeStub(frames: number[] | undefined, silent: number[] = [], uninjectable: number[] = []): ChromeCalls {
  const calls: ChromeCalls = { sent: [], pinged: [], injected: [] };
  const injectedInto = new Set<number>();
  const runtime: { lastError?: { message: string } } = {};
  const stub = {
    runtime,
    tabs: {
      get: (tabId: number) => Promise.resolve({ id: tabId, status: "complete" }),
      onUpdated: { addListener: () => undefined, removeListener: () => undefined },
      sendMessage: (tabId: number, message: unknown, third?: unknown, fourth?: unknown) => {
        const options = typeof third === "object" && third !== null ? third as { frameId?: number } : undefined;
        const callback = (typeof third === "function" ? third : fourth) as ((response: unknown) => void) | undefined;
        const frameId = options?.frameId;
        if ((message as { type?: string }).type === "fluxiq.ping") {
          const target = frameId ?? 0;
          calls.pinged.push(target);
          if (silent.includes(target) && !injectedInto.has(target)) {
            runtime.lastError = { message: CONNECTION_ERROR };
            callback?.(undefined);
            delete runtime.lastError;
            return;
          }
          callback?.({ ok: true, active: true, version: CONTENT_SCRIPT_VERSION });
          return;
        }
        calls.sent.push({ tabId, message: message as Record<string, unknown>, frameId });
        callback?.(FRAME_REPLY);
      }
    },
    scripting: {
      executeScript: (details: { target: { tabId: number; frameIds: number[] }; files: string[] }) => {
        calls.injected.push([...details.target.frameIds]);
        if (details.target.frameIds.some((frameId) => uninjectable.includes(frameId))) {
          return Promise.reject(new Error("Cannot access contents of the page."));
        }
        for (const frameId of details.target.frameIds) injectedInto.add(frameId);
        return Promise.resolve([]);
      }
    },
    webNavigation: {
      getAllFrames: (_details: { tabId: number }, callback: (found: Array<{ frameId: number }> | undefined) => void) => {
        callback(frames?.map((frameId) => ({ frameId })));
      }
    }
  };
  (globalThis as { chrome?: unknown }).chrome = stub;
  return calls;
}

/** Runs one in-page action against the stub and hands back the result and every browser call it made. */
async function runAgainstStub(
  action: BrowserActionCommand,
  frames: number[] | undefined,
  silent: number[] = [],
  uninjectable: number[] = []
): Promise<ChromeCalls & { run: Awaited<ReturnType<typeof runBrowserActionCommand>> }> {
  const calls = installChromeStub(frames, silent, uninjectable);
  try {
    const run = await runBrowserActionCommand({ action, attachTabForRecording: () => Promise.resolve() });
    return { run, ...calls };
  } finally {
    delete (globalThis as { chrome?: unknown }).chrome;
  }
}

test("an action naming no frame is delivered to the top frame, and says so twice", async () => {
  const { run, sent } = await runAgainstStub(
    { commandId: "c-top", actionType: "web.dom.click", selector: "#buy", tabId: TAB_ID },
    [0, 3]
  );
  // The delivery option is what confines the message to one frame; the body's
  // own frameId is what lets that frame confirm it is the addressee, for the
  // senders that cannot use the option.
  assert.deepEqual(sent, [{
    tabId: TAB_ID,
    message: {
      type: "executeAction",
      action: { commandId: "c-top", actionType: "web.dom.click", selector: "#buy", tabId: TAB_ID },
      frameId: 0,
      topFrameOnly: true
    },
    frameId: 0
  }]);
  assert.deepEqual(run, { result: FRAME_REPLY, tabId: TAB_ID, frameId: 0 });
});

test("an action naming a child frame is delivered to that frame, not the top one", async () => {
  const { run, sent } = await runAgainstStub(
    { commandId: "c-child", actionType: "web.dom.click", selector: "#pay", tabId: TAB_ID, frameId: 3 },
    [0, 3]
  );
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.frameId, 3);
  assert.deepEqual(sent[0]?.message["frameId"], 3);
  // Not "the top frame only": the whole point is that a child must answer.
  assert.equal(sent[0]?.message["topFrameOnly"], false);
  assert.equal(run.frameId, 3);
});

test("the frame may be named by the raw browserFrameId parameter, which is how it arrives today", async () => {
  const { run, sent } = await runAgainstStub(
    { commandId: "c-raw", actionType: "web.dom.click", selector: "#pay", tabId: TAB_ID, options: { browserFrameId: 3 } },
    [0, 3]
  );
  assert.equal(sent[0]?.frameId, 3);
  assert.equal(run.frameId, 3);
});

test("an action naming a frame the tab does not have fails as target_not_found, and is never sent", async () => {
  const { run, sent } = await runAgainstStub(
    { commandId: "c-gone", actionType: "web.dom.click", selector: "#pay", tabId: TAB_ID, frameId: 7 },
    [0, 3]
  );
  // Nothing was dispatched: a frame id recorded at capture is reassigned when
  // that frame navigates, and sending to it blind would either be refused by
  // Chrome with a message naming no frame, or land somewhere else.
  assert.deepEqual(sent, []);
  assert.equal(run.result.status, "failed");
  assert.equal(run.result.message, "The action is addressed to frame 7, which this tab does not have.");
  assert.deepEqual(run.result.validation, {
    status: "failed",
    expected: "frame 7 in the tab",
    actual: "the tab has frame 0, frame 3"
  });
  assert.deepEqual(run.result.failure, {
    category: "target_not_found",
    code: "web.target.not_found",
    retryable: true,
    stage: "target_resolution",
    expected: "frame 7 in the tab",
    actual: "the tab has frame 0, frame 3"
  });
  // Core drops a record it refuses whole, taking the failure with it.
  assert.deepEqual(parseAutomationStudioFailureRecord(run.result.failure), run.result.failure);
});

test("a browser that will not enumerate the tab's frames does not turn into a missing frame", async () => {
  const { run, sent } = await runAgainstStub(
    { commandId: "c-unknown", actionType: "web.dom.click", selector: "#pay", tabId: TAB_ID, frameId: 3 },
    undefined
  );
  // Unknown is not "no frames": the action goes, and is judged by its own outcome.
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.frameId, 3);
  assert.equal(run.result.status, "succeeded");
});

test("the top frame is never looked up, because a tab always has one", async () => {
  const { run, sent, pinged } = await runAgainstStub(
    { commandId: "c-zero", actionType: "web.dom.click", selector: "#buy", tabId: TAB_ID, frameId: 0 },
    // An enumeration that omits frame 0 would fail the action if it were consulted.
    []
  );
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.frameId, 0);
  assert.equal(sent[0]?.message["topFrameOnly"], false);
  // Nor is it probed: `attachTabForRecording` has already run
  // `ensureContentScript` for the top frame before the action gets here.
  assert.deepEqual(pinged, []);
  assert.equal(run.result.status, "succeeded");
});

test("a command addressed to a child frame that lost its content script reaches it once it is injected", async () => {
  const { run, sent, pinged, injected } = await runAgainstStub(
    { commandId: "c-reload", actionType: "web.dom.click", selector: "#pay", tabId: TAB_ID, frameId: 3 },
    [0, 3],
    [3]
  );
  // The frame exists, so the existence check passes and catches nothing. What
  // an extension reload took away is the script inside it, and only injecting
  // into that frame puts it back: the declarative `all_frames` entry runs on
  // navigation, and this frame has not navigated.
  assert.deepEqual(injected, [[3]]);
  assert.deepEqual(pinged, [3, 3]);
  // Only then is the action sent, and to frame 3 rather than the top frame.
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.frameId, 3);
  assert.equal(sent[0]?.message["type"], "executeAction");
  assert.deepEqual(run.result, FRAME_REPLY);
});

test("a child frame that cannot be given a content script fails as target_not_found, and the action is never sent", async () => {
  const { run, sent, injected } = await runAgainstStub(
    { commandId: "c-blocked", actionType: "web.dom.click", selector: "#pay", tabId: TAB_ID, frameId: 3 },
    [0, 3],
    [3],
    [3]
  );
  assert.deepEqual(injected, [[3]]);
  // The whole point: an unanswerable command must end as a classified failure.
  // `chrome.tabs.sendMessage` to a frame with no listener is neither answered
  // nor refused, and nothing upstream puts a deadline on a web action, so
  // sending it would hang the command with no end.
  assert.deepEqual(sent, []);
  assert.equal(run.result.status, "failed");
  assert.equal(run.result.message, "The action is addressed to frame 3, which is not running the FluxIQ content script.");
  assert.deepEqual(run.result.failure, {
    category: "target_not_found",
    code: "web.target.not_found",
    retryable: true,
    stage: "target_resolution",
    expected: "frame 3 to be running the FluxIQ content script",
    actual: "Cannot access contents of the page."
  });
  assert.deepEqual(parseAutomationStudioFailureRecord(run.result.failure), run.result.failure);
});

test("an action on a page the extension cannot automate is refused with the set's code, and never sent", async () => {
  // Driven through the runner rather than the private builder, because the
  // decision under test is the code the refusal carries once it is made. The
  // reason arrives on the request, which is the path a tab whose URL the worker
  // cannot read already takes.
  const calls = installChromeStub([0]);
  let run: Awaited<ReturnType<typeof runBrowserActionCommand>>;
  try {
    run = await runBrowserActionCommand({
      action: { commandId: "c-privileged", actionType: "web.dom.click", selector: "#buy", tabId: TAB_ID },
      unsupportedPageReason: "Browser and extension pages cannot be automated.",
      attachTabForRecording: () => Promise.resolve()
    });
  } finally {
    delete (globalThis as { chrome?: unknown }).chrome;
  }
  assert.deepEqual(calls.sent, []);
  assert.equal(run.result.status, "failed");
  assert.deepEqual(run.result.failure, {
    // `web.page.unsupported` before, which was in no set, so a consumer
    // deriving its vocabulary from the domain could not name it. The page is
    // what is refused, so `ACTION_REJECTED` rather than `UNSUPPORTED_TYPE`,
    // which names an action type the client will not run.
    category: "blocked_by_capability_or_policy",
    code: "web.action.rejected",
    retryable: false,
    // The set fixes the stage at `execution`. This is decided before anything
    // runs, so the hand-built record said `dispatch`; the category and the
    // retryable flag, which are what Core acts on, are unchanged.
    stage: "execution",
    expected: "a page the extension can automate",
    actual: "Browser and extension pages cannot be automated."
  });
  assert.deepEqual(parseAutomationStudioFailureRecord(run.result.failure), run.result.failure);
});
