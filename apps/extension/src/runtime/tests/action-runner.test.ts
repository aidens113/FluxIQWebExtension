// T1 coverage of action-runner.ts: the failed result the runtime reports when
// an action cannot run, and the frame an action is delivered to.
//
// Frame routing is covered here rather than only in the browser because the
// thing that must be right is an argument to `chrome.tabs.sendMessage` -- which
// frame the message is addressed to -- and a page cannot observe its own
// delivery. So the chrome API the runner drives is stubbed and the calls it
// makes are read back (`runner-chrome-stub.ts`). What this cannot prove is
// that an addressed message really arrives at that frame and nowhere else;
// `e2e/content/tests/frames.spec.ts` proves the receiving half against a real
// page of iframes.
//
// The same goes for the readiness probe a child-frame action now runs first:
// the stub can say a frame is not listening and that injecting into it makes it
// listen, but only a loaded extension recovering from a real reload proves the
// injection reaches the frame Chrome was told to inject into.
//
// The rest of the runner's decisions are covered where they live --
// command-options, navigation-outcome, unsupported-page, and click-landing,
// whose one call here the last row proves. The navigate branch -- which tab it
// drives, whether it arrived, and whether it landed on a robot check -- is
// `navigate-action.test.ts`.

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation";
import { WEB_AUTOMATION_FAILURE_CODES } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand } from "../../shared/protocol";
import { browserActionFailure, runBrowserActionCommand } from "../action-runner";
import { browserActionFromGatewayCommand } from "../result-mapping";
import { forgetAutomationTab } from "../automation-tab";
import type { ListedFrame } from "../frame-address";
import { CONNECTION_ERROR, FRAME_REPLY, installChromeStub, runAgainstStub, TAB_ID, type ChromeCalls } from "./runner-chrome-stub";

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

test("a structure detection arrives from the gateway as an observation for the frame it names, its flag intact", async () => {
  // The domain's authoring tool sends the flag and the frame as parameters;
  // the lift puts them on the command, and the runner delivers that command
  // unchanged to the frame, where `capture-snapshot.ts` answers it.
  const action = browserActionFromGatewayCommand({
    commandId: "c-detect",
    actionType: "web.dom.capture_snapshot",
    parameters: { detectStructure: { selector: '[data-testid="product-link"]' }, browserFrameId: 3, browserTabId: TAB_ID }
  }) as BrowserActionCommand;
  const { run, sent } = await runAgainstStub(action, [0, 3]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.frameId, 3);
  const delivered = sent[0]?.message["action"] as BrowserActionCommand;
  assert.deepEqual(delivered.detectStructure, { selector: '[data-testid="product-link"]' });
  assert.equal(delivered.actionType, "web.dom.capture_snapshot");
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
    actual: "the tab has frame 0, frame 3",
    effect: "unacted"
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

/** W28's page after a Flow reloads its start page: both child frames renumbered, the pay frame cross-origin and carrying a query. */
const RELOADED_FRAMES: ListedFrame[] = [
  { frameId: 0, url: "http://127.0.0.1:4173/scenarios/iframe-checkout/" },
  { frameId: 6, url: "http://127.0.0.1:4173/scenarios/iframe-checkout/shipping" },
  { frameId: 7, url: "http://127.0.0.1:4174/scenarios/iframe-checkout/pay?session=synthetic-token" }
];
const PAY_PATH = "/scenarios/iframe-checkout/pay";

test("a stale recorded frame id with one child frame at its path is sent to that frame, which the result reports", async () => {
  const { run, sent, pinged } = await runAgainstStub(
    { commandId: "c-path", actionType: "web.dom.click", selector: "#pay", tabId: TAB_ID, frameId: 4, frameUrlPath: PAY_PATH },
    RELOADED_FRAMES
  );
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.frameId, 7);
  assert.equal(sent[0]?.message["frameId"], 7);
  assert.equal(sent[0]?.message["topFrameOnly"], false);
  // The frame found is the one probed for a listener, not the recorded one.
  assert.deepEqual(pinged, [7]);
  assert.deepEqual(run, { result: FRAME_REPLY, tabId: TAB_ID, frameId: 7 });
});

test("two child frames at the path, neither with the recorded id, fail as target_ambiguous and nothing is sent", async () => {
  const twin: ListedFrame = { frameId: 9, url: `http://127.0.0.1:4174${PAY_PATH}` };
  const { run, sent, pinged } = await runAgainstStub(
    { commandId: "c-path-twins", actionType: "web.dom.click", selector: "#pay", tabId: TAB_ID, frameId: 4, frameUrlPath: PAY_PATH },
    [...RELOADED_FRAMES, twin]
  );
  assert.deepEqual(sent, []);
  assert.deepEqual(pinged, []);
  assert.equal(run.result.status, "failed");
  assert.deepEqual(run.result.failure, {
    category: "target_ambiguous",
    code: "web.target.ambiguous",
    retryable: true,
    stage: "target_resolution",
    expected: `one child frame at ${PAY_PATH}`,
    actual: `2 child frames are at ${PAY_PATH}, and none is frame 4`,
    effect: "unacted"
  });
  assert.deepEqual(parseAutomationStudioFailureRecord(run.result.failure), run.result.failure);
  assert.equal(run.frameId, 4);
});

test("no child frame at the path fails as target_not_found, naming paths and never a full URL, and nothing is sent", async () => {
  const receipt = "/scenarios/iframe-checkout/receipt";
  const { run, sent } = await runAgainstStub(
    { commandId: "c-path-gone", actionType: "web.dom.click", selector: "#pay", tabId: TAB_ID, frameId: 4, frameUrlPath: receipt },
    RELOADED_FRAMES
  );
  assert.deepEqual(sent, []);
  assert.equal(run.result.message, `The action is addressed to the frame at ${receipt}, which this tab does not have.`);
  assert.deepEqual(run.result.failure, {
    category: "target_not_found",
    code: "web.target.not_found",
    retryable: true,
    stage: "target_resolution",
    expected: `a child frame at ${receipt}`,
    actual: "the tab has frame 6 at /scenarios/iframe-checkout/shipping, frame 7 at /scenarios/iframe-checkout/pay",
    effect: "unacted"
  });
  assert.doesNotMatch(JSON.stringify(run.result), /127\.0\.0\.1|session=|synthetic-token/u);
});

test("without a path a stale id is refused exactly as before, even when a frame sits at its document's path", async () => {
  const { run, sent } = await runAgainstStub(
    { commandId: "c-no-path", actionType: "web.dom.click", selector: "#pay", tabId: TAB_ID, frameId: 4 },
    RELOADED_FRAMES
  );
  assert.deepEqual(sent, []);
  assert.equal(run.result.message, "The action is addressed to frame 4, which this tab does not have.");
  assert.deepEqual(run.result.validation, { status: "failed", expected: "frame 4 in the tab", actual: "the tab has frame 0, frame 6, frame 7" });
});

test("a browser that will not enumerate frames leaves a path-addressed action on its recorded id", async () => {
  const { run, sent } = await runAgainstStub(
    { commandId: "c-path-unknown", actionType: "web.dom.click", selector: "#pay", tabId: TAB_ID, frameId: 4, frameUrlPath: PAY_PATH },
    undefined
  );
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.frameId, 4);
  assert.equal(run.frameId, 4);
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
    actual: "Cannot access contents of the page.",
    effect: "unacted"
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

/** Chrome's words for a document that unloaded before it answered, older and newer. */
const PORT_CLOSED_ERROR = "The message port closed before a response was received.";
const CHANNEL_CLOSED_ERROR =
  "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received";

/** Runs a top-frame action whose sends meet `refusals` in order, keeping a rejection as the outcome. */
async function runAgainstRefusals(action: BrowserActionCommand, refusals: string[]): Promise<ChromeCalls & { outcome: unknown }> {
  const calls = installChromeStub([0], [], [], refusals);
  try {
    const request = { action, attachTabForRecording: () => Promise.resolve() };
    const outcome = await runBrowserActionCommand(request).catch((error: unknown) => error);
    return { outcome, ...calls };
  } finally {
    delete (globalThis as { chrome?: unknown }).chrome;
  }
}

for (const refusal of [CONNECTION_ERROR, PORT_CLOSED_ERROR, CHANNEL_CLOSED_ERROR]) {
  test(`an assert that meets a navigating page is sent once more after the tab settles: "${refusal}"`, async () => {
    const action: BrowserActionCommand = { commandId: "c-assert", actionType: "web.dom.assert", selector: "#welcome", tabId: TAB_ID };
    const { outcome, sent, timeline } = await runAgainstRefusals(action, [refusal]);
    // The tab is waited for between the sends, not only before the first.
    assert.deepEqual(timeline, ["wait", "send", "wait", "send"]);
    assert.deepEqual(sent[1], sent[0]);
    // One result, and it is the second send's answer rather than a failure.
    assert.deepEqual(outcome, { result: FRAME_REPLY, tabId: TAB_ID, frameId: 0 });
  });
}

// The look the domain takes straight after a click whose page saves and then
// reloads (bigbox "Set as my store", `run-muncqlr0-3348202b`): the old document
// can go while the look is in it. It only reads, so it is sent again once the
// tab has settled, and answers from the new document instead of failing.
for (const refusal of [CONNECTION_ERROR, PORT_CLOSED_ERROR, CHANNEL_CLOSED_ERROR]) {
  test(`a snapshot that meets a navigating page is sent once more after the tab settles: "${refusal}"`, async () => {
    const action: BrowserActionCommand = { commandId: "c-look", actionType: "web.dom.capture_snapshot", tabId: TAB_ID };
    const { outcome, sent, timeline } = await runAgainstRefusals(action, [refusal]);
    assert.deepEqual(timeline, ["wait", "send", "wait", "send"]);
    assert.deepEqual(sent[1], sent[0]);
    assert.deepEqual(outcome, { result: FRAME_REPLY, tabId: TAB_ID, frameId: 0 });
  });
}

for (const actionType of ["web.dom.click", "web.dom.type", "web.dom.extract", "web.dom.wait_for_selector"] as const) {
  test(`a ${actionType} that meets a navigating page the same way is sent once`, async () => {
    const action: BrowserActionCommand = { commandId: "c-once", actionType, selector: "#sign-in", tabId: TAB_ID };
    const { outcome, timeline } = await runAgainstRefusals(action, [CHANNEL_CLOSED_ERROR]);
    // A click may already have acted before the channel closed; sending it again would act twice.
    assert.deepEqual(timeline, ["wait", "send"]);
    assert.ok(outcome instanceof Error);
    assert.equal(outcome.message, CHANNEL_CLOSED_ERROR);
  });
}

test("an assert refused for any other reason is sent once", async () => {
  const action: BrowserActionCommand = { commandId: "c-other", actionType: "web.dom.assert", selector: "#welcome", tabId: TAB_ID };
  const { outcome, timeline } = await runAgainstRefusals(action, ["Extension context invalidated."]);
  assert.deepEqual(timeline, ["wait", "send"]);
  assert.ok(outcome instanceof Error);
  assert.equal(outcome.message, "Extension context invalidated.");
});

// t361: a press whose send the browser refused before it reached the page
// ("Receiving end does not exist": the new document's content script was not
// in yet) was not made, and says so -- `effect: "unacted"` -- so Core makes it
// again instead of ending it uncertain (t359). One that reached the page and
// lost its answer says nothing of the kind, and Core does not press it again.
test("a press whose send never reached the page fails saying it was not made, and is sent once", async () => {
  for (const actionType of ["web.dom.click", "web.dom.keypress", "web.dom.type"] as const) {
    const action: BrowserActionCommand = { commandId: "c-undelivered", actionType, selector: "#add", key: "Enter", text: "Enter", submit: true, tabId: TAB_ID };
    const { outcome, sent } = await runAgainstRefusals(action, [CONNECTION_ERROR]);
    assert.equal(sent.length, 1, actionType);
    const run = outcome as Awaited<ReturnType<typeof runBrowserActionCommand>>;
    assert.equal(run.result.status, "failed", actionType);
    assert.deepEqual(run.result.failure, {
      category: "action_failed",
      code: "web.transport.transient",
      retryable: true,
      stage: "execution",
      expected: "the action to run",
      actual: CONNECTION_ERROR,
      effect: "unacted"
    }, actionType);
    // Core's parser keeps the statement, which is what lets the retry through.
    assert.deepEqual(parseAutomationStudioFailureRecord(run.result.failure), run.result.failure);
    assert.equal(run.tabId, TAB_ID);
  }
});

test("a send addressed to a tab or frame the browser no longer has was never delivered either", async () => {
  for (const refusal of [`No tab with id: ${TAB_ID}.`, `No frame with id 3 in tab ${TAB_ID}.`]) {
    const action: BrowserActionCommand = { commandId: "c-gone", actionType: "web.dom.click", selector: "#add", tabId: TAB_ID };
    const { outcome } = await runAgainstRefusals(action, [refusal]);
    const run = outcome as Awaited<ReturnType<typeof runBrowserActionCommand>>;
    assert.equal(run.result.failure?.effect, "unacted", refusal);
  }
});

test("a press delivered to a page that unloaded before answering states nothing, so its outcome stays Core's to call uncertain", async () => {
  for (const refusal of [PORT_CLOSED_ERROR, CHANNEL_CLOSED_ERROR]) {
    const action: BrowserActionCommand = { commandId: "c-delivered", actionType: "web.dom.click", selector: "#add", tabId: TAB_ID };
    const { outcome, sent } = await runAgainstRefusals(action, [refusal]);
    assert.equal(sent.length, 1);
    // Thrown, as before, to the command router, whose record carries no effect.
    assert.ok(outcome instanceof Error);
    assert.equal(browserActionFailure(action, outcome.message).failure?.effect, undefined, refusal);
  }
});

test("a read sent twice is unacted only when neither send reached the page", async () => {
  const action: BrowserActionCommand = { commandId: "c-look-twice", actionType: "web.dom.assert", selector: "#welcome", tabId: TAB_ID };
  const neither = await runAgainstRefusals(action, [CONNECTION_ERROR, CONNECTION_ERROR]);
  assert.equal(neither.sent.length, 2);
  assert.equal((neither.outcome as Awaited<ReturnType<typeof runBrowserActionCommand>>).result.failure?.effect, "unacted");
  // The first reached the page and lost its answer: the second's refusal does not undo that.
  const first = await runAgainstRefusals(action, [CHANNEL_CLOSED_ERROR, CONNECTION_ERROR]);
  assert.ok(first.outcome instanceof Error);
});

test("an assert refused on both sends is sent exactly twice, and the second refusal is reported", async () => {
  const action: BrowserActionCommand = { commandId: "c-twice", actionType: "web.dom.assert", selector: "#welcome", tabId: TAB_ID };
  const { outcome, timeline } = await runAgainstRefusals(action, [CHANNEL_CLOSED_ERROR, CONNECTION_ERROR, CONNECTION_ERROR]);
  assert.deepEqual(timeline, ["wait", "send", "wait", "send"]);
  assert.ok(outcome instanceof Error);
  assert.equal(outcome.message, CONNECTION_ERROR);
});

test("a click whose tab lands on a page served 404 fails as navigation_unexpected, not as the frame's success", async () => {
  const calls = installChromeStub([0], [], [], [], { status: 404, url: "http://127.0.0.1:4000/scenarios/navigation/link-retired?from=recording" });
  let run: Awaited<ReturnType<typeof runBrowserActionCommand>>;
  try {
    run = await runBrowserActionCommand({
      action: { commandId: "c-retired", actionType: "web.dom.click", selector: "#second", tabId: TAB_ID },
      attachTabForRecording: () => Promise.resolve()
    });
  } finally {
    delete (globalThis as { chrome?: unknown }).chrome;
  }
  // Sent once, answered `succeeded` by the frame, and then judged by where the tab went.
  assert.equal(calls.sent.length, 1);
  assert.equal(run.result.status, "failed");
  assert.equal(run.result.commandId, FRAME_REPLY.commandId);
  assert.deepEqual(run.result.failure, {
    category: "navigation_unexpected",
    code: "web.navigation.unexpected",
    retryable: false,
    stage: "confirmation",
    expected: "the page the click leads to loads",
    actual: "the server answered HTTP 404 for /scenarios/navigation/link-retired"
  });
  assert.equal(run.tabId, TAB_ID);
  assert.equal(run.frameId, 0);
});

// t640 (`run-mv9q50ui`, RC3): a navigate with no url was not a navigation, so it
// went to the content script, which has no navigate verb and answered
// `web.action.unsupported_type` -- told to a build as a policy refusal. It is
// answered here with the domain navigate node's own missing-value record.
test("a navigate with no url value is answered as a parameter with no value, and nothing is sent or driven", async () => {
  for (const url of [undefined, "", "  "]) {
    const action: BrowserActionCommand = { commandId: "c-nav-empty", actionType: "web.browser.navigate", ...(url !== undefined ? { url } : {}) };
    const { run, sent, pinged, injected } = await runAgainstStub(action, [0]);
    assert.deepEqual(sent, [], "nothing reaches the content script");
    assert.deepEqual(pinged, []);
    assert.deepEqual(injected, []);
    assert.equal(run.result.status, "failed");
    assert.deepEqual(run.result.failure, {
      category: "graph_validation_or_unknown_node",
      code: "web.action.invalid_parameter",
      retryable: false,
      stage: "dispatch",
      expected: "url to hold where to go when the step runs",
      actual: "no value: url had no value when the step ran; the value it reads was empty, so nothing was sent to the browser"
    });
    assert.deepEqual(parseAutomationStudioFailureRecord(run.result.failure), run.result.failure);
    assert.doesNotMatch(JSON.stringify(run.result), /permission|policy|unsupported/u);
  }
});

// F7 (auction seller-shop run): a navigate bound to a link read off the page got
// the root-relative `/scenarios/.../str/...`, `chrome.tabs.update` resolved it
// against the extension's own origin, the tab landed on a missing extension
// file, and the step was told to the build as a permission refusal. The runner
// now resolves the address against the web page the Flow is on first.
const LISTING = "http://127.0.0.1:58327/scenarios/auction-marketplace/itm/hood";
const EXTENSION_BASE = "chrome-extension://ojijcpdhndjbpooecgfhaeoloheeeigk/";

/** Tabs a navigation drives, with every `tabs.update` and `tabs.create` url recorded. */
function installAddressStub(tabs: Record<number, { url: string | undefined; document?: number }>): { updated: string[]; created: string[] } {
  const calls = { updated: [] as string[], created: [] as string[] };
  const read = (tabId: number) => tabs[tabId] ? Promise.resolve({ id: tabId, url: tabs[tabId]!.url, status: "complete" }) : Promise.reject(new Error(`No tab with id: ${tabId}.`));
  (globalThis as { chrome?: unknown }).chrome = {
    runtime: { getURL: (path: string) => `${EXTENSION_BASE}${path}` },
    tabs: {
      get: read,
      update: (tabId: number, properties: { url?: string }) => {
        if (properties.url !== undefined) {
          calls.updated.push(properties.url);
          tabs[tabId] = { url: properties.url, document: (tabs[tabId]?.document ?? 0) + 1 };
        }
        return read(tabId);
      },
      reload: () => Promise.resolve(),
      create: (properties: { url: string }) => {
        calls.created.push(properties.url);
        tabs[900] = { url: properties.url, document: 1 };
        return read(900);
      },
      onUpdated: { addListener: () => undefined, removeListener: () => undefined },
      sendMessage: (_tabId: number, _message: unknown, _options: unknown, callback: (response: unknown) => void) => callback({ challenge: null })
    },
    scripting: { executeScript: () => Promise.resolve([{ frameId: 0, result: 200 }]) },
    webNavigation: {
      getAllFrames: (details: { tabId: number }, callback: (found: unknown[]) => void) =>
        callback([{ frameId: 0, errorOccurred: false, documentId: `document.${tabs[details.tabId]?.document ?? 0}` }])
    }
  };
  return calls;
}

async function navigateTo(url: string, activeTabId: number | undefined, extra: Partial<BrowserActionCommand> = {}): Promise<Awaited<ReturnType<typeof runBrowserActionCommand>>> {
  try {
    return await runBrowserActionCommand({
      action: { commandId: "c-nav-address", actionType: "web.browser.navigate", url, ...extra },
      ...(activeTabId !== undefined ? { activeTabId } : {}),
      attachTabForRecording: () => Promise.resolve()
    });
  } finally {
    delete (globalThis as { chrome?: unknown }).chrome;
  }
}

test("a root-relative navigate drives the tab to the same-origin absolute address, never the relative string", async () => {
  forgetAutomationTab();
  const calls = installAddressStub({ 41: { url: LISTING } });
  const run = await navigateTo("/scenarios/auction-marketplace/str/the_camera_loft", 41);
  assert.deepEqual(calls.updated, ["http://127.0.0.1:58327/scenarios/auction-marketplace/str/the_camera_loft"]);
  assert.deepEqual(calls.created, []);
  assert.equal(run.result.status, "succeeded");
  assert.equal(run.result.url, "http://127.0.0.1:58327/scenarios/auction-marketplace/str/the_camera_loft");
});

test("a relative navigate into a new tab resolves against the page the Flow is on", async () => {
  forgetAutomationTab();
  const calls = installAddressStub({ 41: { url: LISTING } });
  await navigateTo("../str/the_camera_loft", 41, { newTab: true });
  assert.deepEqual(calls.created, ["http://127.0.0.1:58327/scenarios/auction-marketplace/str/the_camera_loft"]);
});

test("a relative navigate with no web page to resolve against fails as an invalid parameter, and nothing is driven", async () => {
  for (const tabs of [{}, { 41: { url: "about:blank" } }, { 41: { url: `${EXTENSION_BASE}sidepanel.html` } }]) {
    forgetAutomationTab();
    const calls = installAddressStub(tabs);
    const run = await navigateTo("/scenarios/auction-marketplace/str/the_camera_loft", 41);
    assert.deepEqual(calls, { updated: [], created: [] });
    assert.equal(run.result.status, "failed");
    assert.equal(run.result.failure?.code, "web.action.invalid_parameter");
    assert.match(run.result.failure?.actual ?? "", /is relative and there is no web page to resolve it against/u);
    assert.deepEqual(parseAutomationStudioFailureRecord(run.result.failure), run.result.failure);
    assert.doesNotMatch(JSON.stringify(run.result), /permission|policy/u);
  }
});

test("a navigate to the extension's own address is refused as an invalid parameter, and nothing is driven", async () => {
  forgetAutomationTab();
  const calls = installAddressStub({ 41: { url: LISTING } });
  const run = await navigateTo(`${EXTENSION_BASE}scenarios/auction-marketplace/str/the_camera_loft`, 41);
  assert.deepEqual(calls, { updated: [], created: [] });
  assert.equal(run.result.failure?.code, "web.action.invalid_parameter");
  assert.match(run.result.failure?.actual ?? "", /the extension's own address/u);
  assert.doesNotMatch(JSON.stringify(run.result), /permission|policy/u);
});

// t885 (`run-mwaknxf9-7549d126`): a look took bigbox's "Robot or human?" page as an ordinary page, so the
// model stopped on a check that cleared by itself. A whole-tab look that carries the check allowance
// now meets a check as a landing does (`look-check/`); every other look reads the page as it is.
const PERSON_ONLY_PAGE = { challenge: "captcha", robotCheck: "person_only" };
const SELF_CLEARING_PAGE = { challenge: "captcha", robotCheck: "self_clearing" };

/** Runs looks one after another on one stubbed tab whose top frame answers `challenges`. */
async function looksAgainst(challenges: unknown[], frames: number[], ...actions: BrowserActionCommand[]) {
  const calls = installChromeStub(frames, [], [], [], undefined, challenges);
  const runs: Array<Awaited<ReturnType<typeof runBrowserActionCommand>>> = [];
  try {
    for (const action of actions) runs.push(await runBrowserActionCommand({ action, attachTabForRecording: () => Promise.resolve() }));
  } finally {
    delete (globalThis as { chrome?: unknown }).chrome;
  }
  return { runs, ...calls };
}

const ALLOWED_LOOK: BrowserActionCommand = { commandId: "c-look", actionType: "web.dom.capture_snapshot", tabId: TAB_ID, checkWaitMs: 15_000 };
const HOST_LOOK: BrowserActionCommand = { commandId: "c-host", actionType: "web.dom.capture_snapshot", tabId: TAB_ID };

test("a look that carries the check allowance, on a check only a person can clear, fails USER_INTERVENTION_REQUIRED and is never sent", async () => {
  const { runs, sent, challenged } = await looksAgainst([PERSON_ONLY_PAGE], [0], ALLOWED_LOOK);
  const run = runs[0]!;
  assert.deepEqual(sent, []);
  assert.deepEqual(challenged, [0]);
  assert.equal(run.result.commandId, "c-look");
  assert.equal(run.result.status, "failed");
  assert.equal(run.result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED);
  assert.match(run.result.failure?.actual ?? "", /^captcha: /u);
  assert.deepEqual(parseAutomationStudioFailureRecord(run.result.failure), run.result.failure);
  assert.equal(run.tabId, TAB_ID);
  assert.equal(run.frameId, 0);
});

test("the same look without the allowance -- a host state capture -- takes the check page as a page, unasked", async () => {
  const { runs, sent, challenged } = await looksAgainst([PERSON_ONLY_PAGE], [0], HOST_LOOK);
  assert.equal(sent.length, 1);
  assert.deepEqual(challenged, []);
  assert.deepEqual(runs[0], { result: FRAME_REPLY, tabId: TAB_ID, frameId: 0 });
});

test("a look addressed to one frame is that frame's, and the page is not asked about a check", async () => {
  const { runs, sent, challenged } = await looksAgainst([PERSON_ONLY_PAGE], [0, 3], { ...ALLOWED_LOOK, frameId: 3 });
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.frameId, 3);
  assert.deepEqual(challenged, []);
  assert.equal(runs[0]?.result.status, "succeeded");
});

test("a look on a check that clears by itself is taken once it has, and carries how long it stood", async () => {
  const { runs, sent, challenged } = await looksAgainst([SELF_CLEARING_PAGE, SELF_CLEARING_PAGE, { challenge: null }], [0], ALLOWED_LOOK);
  const run = runs[0]!;
  assert.equal(sent.length, 1);
  // The first reading, a poll still on the check, a poll past it, and the settled page's confirmation.
  assert.equal(challenged.length, 4);
  assert.equal(run.result.status, "succeeded");
  assert.ok((run.result.checkWait?.waitedMs ?? 0) >= 400, JSON.stringify(run.result.checkWait));
  assert.deepEqual({ ...run.result, checkWait: undefined }, { ...FRAME_REPLY, checkWait: undefined });
});

test("a check page a host capture kept is still judged for a look that carries the allowance, and is not answered from the kept look", async () => {
  const { runs, sent } = await looksAgainst([PERSON_ONLY_PAGE], [0], HOST_LOOK, ALLOWED_LOOK);
  assert.equal(runs[0]?.result.status, "succeeded");
  assert.equal(sent.length, 1, "the host capture alone reached the page");
  assert.equal(runs[1]?.result.status, "failed");
  assert.equal(runs[1]?.result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED);
});
