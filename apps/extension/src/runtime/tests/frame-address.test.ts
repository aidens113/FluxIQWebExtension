// T1 coverage of frame-address.ts: which child frame an action goes to when it
// names its frame by path as well as by id (P6, W28). The runner's use of the
// choice -- where the message is sent and what the result reports -- is
// action-runner.test.ts's.

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { chooseFrame, type ListedFrame } from "../frame-address";

const TOP: ListedFrame = { frameId: 0, url: "http://127.0.0.1:4173/scenarios/iframe-checkout/" };
/** Served from a second loopback port, with a query, as a cross-origin fixture frame is. */
const PAY: ListedFrame = { frameId: 6, url: "http://127.0.0.1:4174/scenarios/iframe-checkout/pay?session=synthetic-token" };
const SHIPPING: ListedFrame = { frameId: 7, url: "http://127.0.0.1:4173/scenarios/iframe-checkout/shipping" };
const PAY_PATH = "/scenarios/iframe-checkout/pay";

test("without a path the recorded id stands, whatever frames the tab has", () => {
  assert.deepEqual(chooseFrame([TOP, PAY, SHIPPING], 4, undefined), { frameId: 4 });
  assert.deepEqual(chooseFrame([TOP, PAY, SHIPPING], undefined, undefined), { frameId: undefined });
});

test("an empty frame list is unknown, not empty, so the recorded id stands", () => {
  assert.deepEqual(chooseFrame([], 4, PAY_PATH), { frameId: 4 });
});

test("the one child frame at the path is chosen over a stale id, whatever its origin or query", () => {
  assert.deepEqual(chooseFrame([TOP, PAY, SHIPPING], 4, PAY_PATH), { frameId: 6 });
});

test("the top frame is never a candidate, even at the same path", () => {
  const topAtPath: ListedFrame = { frameId: 0, url: `http://127.0.0.1:4173${PAY_PATH}` };
  assert.deepEqual(chooseFrame([topAtPath, PAY], 4, PAY_PATH), { frameId: 6 });
  const choice = chooseFrame([topAtPath, SHIPPING], 4, PAY_PATH);
  assert.ok("refused" in choice);
  assert.equal(choice.refused.failure?.code, "web.target.not_found");
});

test("several child frames at the path: the recorded id breaks the tie when it is one of them", () => {
  const twin: ListedFrame = { frameId: 9, url: `http://127.0.0.1:4174${PAY_PATH}` };
  assert.deepEqual(chooseFrame([TOP, PAY, twin], 9, PAY_PATH), { frameId: 9 });
});

test("several child frames at the path and no tie-break is target_ambiguous, naming the count", () => {
  const twin: ListedFrame = { frameId: 9, url: `http://127.0.0.1:4174${PAY_PATH}` };
  const choice = chooseFrame([TOP, PAY, twin], 4, PAY_PATH);
  assert.ok("refused" in choice);
  assert.deepEqual(choice.refused, {
    status: "failed",
    message: `The action is addressed to the frame at ${PAY_PATH}, and 2 frames in this tab are at that path.`,
    validation: { status: "failed", expected: `one child frame at ${PAY_PATH}`, actual: `2 child frames are at ${PAY_PATH}, and none is frame 4` },
    failure: {
      category: "target_ambiguous",
      code: "web.target.ambiguous",
      retryable: false,
      stage: "target_resolution",
      expected: `one child frame at ${PAY_PATH}`,
      actual: `2 child frames are at ${PAY_PATH}, and none is frame 4`
    }
  });
  assert.deepEqual(parseAutomationStudioFailureRecord(choice.refused.failure), choice.refused.failure);
});

test("no child frame at the path is target_not_found, naming paths and never a full URL", () => {
  const blank: ListedFrame = { frameId: 8, url: "about:blank" };
  const choice = chooseFrame([TOP, SHIPPING, blank], 4, PAY_PATH);
  assert.ok("refused" in choice);
  const actual = "the tab has frame 7 at /scenarios/iframe-checkout/shipping, frame 8 at no http(s) path";
  assert.deepEqual(choice.refused.failure, {
    category: "target_not_found",
    code: "web.target.not_found",
    retryable: true,
    stage: "target_resolution",
    expected: `a child frame at ${PAY_PATH}`,
    actual
  });
  assert.equal(choice.refused.message, `The action is addressed to the frame at ${PAY_PATH}, which this tab does not have.`);
  const wire = JSON.stringify(chooseFrame([TOP, PAY], 4, "/scenarios/iframe-checkout/missing"));
  assert.doesNotMatch(wire, /127\.0\.0\.1|session=|synthetic-token/u);
  assert.deepEqual(parseAutomationStudioFailureRecord(choice.refused.failure), choice.refused.failure);
});

test("a path never matches a frame whose URL is not http(s) or cannot be parsed", () => {
  const frames: ListedFrame[] = [TOP, { frameId: 3, url: "about:srcdoc" }, { frameId: 5, url: "not a url" }, { frameId: 11 }];
  const choice = chooseFrame(frames, 3, "/srcdoc");
  assert.ok("refused" in choice);
  assert.equal(choice.refused.failure?.code, "web.target.not_found");
});
