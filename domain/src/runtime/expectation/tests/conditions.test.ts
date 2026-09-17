// Reading an authored expected state into `web.dom.assert` requests.
//
// The two accepted shapes are proven separately, because two producers write
// them, and the timeout rule is proven against the wire guard it exists for:
// `gateway-action-parameters.ts` drops a non-positive `assert.timeoutMs`, so a
// zero budget emitted literally would silently become the content script's
// five-second default on every checked condition of every successful attempt.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationActionFromGatewayCommand, type WebAutomationActionCommand } from "../../../client";
import {
  describeWebAutomationExpectationCondition,
  webAutomationExpectationActionPayload,
  webAutomationExpectationCondition,
  webAutomationExpectationConditionRefusal
} from "../conditions";

/** The command a payload becomes on the wire, read through the mapping the gateway actually uses. */
function wireCommand(parameters: JsonObject): WebAutomationActionCommand {
  const mapped = webAutomationActionFromGatewayCommand({ commandId: "command.1", actionType: "web.dom.assert", parameters });
  assert.ok(!("status" in mapped), "web.dom.assert is a canonical action type and must never be rejected");
  return mapped;
}

test("reads the flat condition shape a Flow author writes", () => {
  const condition = webAutomationExpectationCondition({ kind: "text", expected: "Order placed", selector: "#banner" }, 2_000);
  assert.deepEqual(condition, { assert: { kind: "text", expected: "Order placed", timeoutMs: 2_000 }, selector: "#banner" });
});

test("reads the nested shape a web.dom.assert output node carries", () => {
  const condition = webAutomationExpectationCondition({ selector: "#save", assert: { kind: "enabled", timeoutMs: 750 } }, 2_000);
  assert.deepEqual(condition, { assert: { kind: "enabled", timeoutMs: 750 }, selector: "#save" });
});

test("carries the frame and tab a condition names under the parameter names the wire reads", () => {
  const condition = webAutomationExpectationCondition({ kind: "visible", selector: "#inner", browserFrameId: 7, tabId: 3 }, 0);
  assert.equal(condition?.frameId, 7);
  assert.equal(condition?.tabId, 3);
  const payload = webAutomationExpectationActionPayload(condition!);
  assert.equal(payload.browserFrameId, 7);
  assert.equal(payload.browserTabId, 3);
  const command = wireCommand(payload);
  assert.equal(command.frameId, 7);
  assert.equal(command.tabId, 3);
});

test("a zero wait budget is emitted as the smallest value the wire keeps, not as zero", () => {
  const condition = webAutomationExpectationCondition({ kind: "exists", selector: "#done" }, 0);
  assert.equal(condition?.assert.timeoutMs, 1);
  assert.equal(wireCommand(webAutomationExpectationActionPayload(condition!)).assert?.timeoutMs, 1);
  // The guard this exists for: a literal 0 is dropped on the way to the page,
  // and the content script falls back to five seconds.
  assert.equal(wireCommand({ assert: { kind: "exists", timeoutMs: 0 } }).assert?.timeoutMs, undefined);
});

test("a condition's own wait wins over Core's budget", () => {
  assert.equal(webAutomationExpectationCondition({ kind: "url", expected: "/thanks", timeoutMs: 4_000 }, 250)?.assert.timeoutMs, 4_000);
  assert.equal(webAutomationExpectationCondition({ kind: "url", expected: "/thanks" }, 250)?.assert.timeoutMs, 250);
});

test("every assert kind is readable, and nothing else is", () => {
  for (const kind of ["exists", "absent", "text", "url", "visible", "enabled"]) {
    assert.equal(webAutomationExpectationCondition({ kind, selector: "#x" }, 100)?.assert.kind, kind);
  }
  for (const unreadable of [{ kind: "contains" }, { kind: 3 }, {}, "exists", null, 7, ["exists"]] as const) {
    assert.equal(webAutomationExpectationCondition(unreadable as never, 100), undefined);
  }
});

test("a payload names only the parameters the condition carries", () => {
  const condition = webAutomationExpectationCondition({ kind: "url", expected: "/thanks" }, 500);
  assert.deepEqual(webAutomationExpectationActionPayload(condition!), { assert: { kind: "url", expected: "/thanks", timeoutMs: 500 } });
});

test("a description says what was claimed and never what the page holds", () => {
  const describe = (value: unknown) => describeWebAutomationExpectationCondition(webAutomationExpectationCondition(value as never, 0)!);
  assert.equal(describe({ kind: "exists", selector: "#save" }), 'an element matches "#save"');
  assert.equal(describe({ kind: "absent", selector: "#spinner" }), 'no element matches "#spinner"');
  assert.equal(describe({ kind: "visible", selector: "#save" }), '"#save" is visible');
  assert.equal(describe({ kind: "enabled", selector: "#save" }), '"#save" is enabled');
  assert.equal(describe({ kind: "url", expected: "/thanks" }), 'the page URL contains "/thanks"');
  assert.equal(describe({ kind: "text", expected: "Done" }), 'the page contains "Done"');
  assert.equal(describe({ kind: "text", expected: "Done", selector: "#banner" }), '"#banner" contains "Done"');
});

test("a long claim is bounded so it can be a failure record's expected value", () => {
  const description = describeWebAutomationExpectationCondition(
    webAutomationExpectationCondition({ kind: "text", expected: "x".repeat(500) }, 0)!
  );
  assert.ok(description.length <= 160, description.length.toString());
  assert.ok(description.endsWith("…"));
});

// The refusals. These are the claims the page must not be asked, and each one
// exists because the content script would otherwise answer it confidently and
// wrongly (`content/action-runtime/assertion-evaluation.ts`).

test("an absent claim naming no element is refused, because the page would report it as held", () => {
  // The whole reason this refusal exists: `evaluateOnce` re-queries the target,
  // finds nothing because there was nothing to query, and returns
  // `{ held: true, verdict: "judged" }`. "The blocking banner is gone" would
  // come back yes without anything having been looked at.
  const condition = webAutomationExpectationCondition({ kind: "absent" }, 0);
  assert.ok(condition, "the shape is readable; it is the claim that cannot be asked");
  assert.equal(webAutomationExpectationConditionRefusal(condition), "a absent claim naming no element, which the page cannot be asked");
});

test("every element claim naming no element is refused; a page-wide text claim is not", () => {
  for (const kind of ["exists", "absent", "visible", "enabled"]) {
    const condition = webAutomationExpectationCondition({ kind }, 0);
    assert.ok(webAutomationExpectationConditionRefusal(condition!), `${kind} with no selector must be refused`);
    assert.equal(webAutomationExpectationConditionRefusal(webAutomationExpectationCondition({ kind, selector: "#x" }, 0)!), undefined);
  }
  // `text` with no selector is the authored claim "the page says X", judged
  // against document.body, which is a real question with a real answer.
  assert.equal(webAutomationExpectationConditionRefusal(webAutomationExpectationCondition({ kind: "text", expected: "Done" }, 0)!), undefined);
});

test("a url or text claim naming nothing to look for is refused, blank included", () => {
  for (const kind of ["url", "text"]) {
    for (const expected of [undefined, "", "   ", "\t\n"]) {
      const condition = webAutomationExpectationCondition(expected === undefined ? { kind } : { kind, expected }, 0);
      assert.ok(
        webAutomationExpectationConditionRefusal(condition!),
        `${kind} expecting ${JSON.stringify(expected)} must be refused`
      );
    }
    assert.equal(webAutomationExpectationConditionRefusal(webAutomationExpectationCondition({ kind, expected: "/thanks" }, 0)!), undefined);
  }
});

test("the two conditions a recovery verdict asks for are askable, and stay opaque to Core", () => {
  // Landing on an expected URL after a recovery.
  const landed = webAutomationExpectationCondition({ kind: "url", expected: "/order/confirmed" }, 2_000);
  assert.equal(webAutomationExpectationConditionRefusal(landed!), undefined);
  assert.deepEqual(webAutomationExpectationActionPayload(landed!), { assert: { kind: "url", expected: "/order/confirmed", timeoutMs: 2_000 } });

  // The blocking banner recovery dismissed is gone.
  const dismissed = webAutomationExpectationCondition({ selector: ".cookie-wall", assert: { kind: "absent" } }, 2_000);
  assert.equal(webAutomationExpectationConditionRefusal(dismissed!), undefined);
  assert.equal(wireCommand(webAutomationExpectationActionPayload(dismissed!)).assert?.kind, "absent");

  // Neither claim is named by a test id, and neither description carries the
  // element's identity anywhere Core would have to understand it.
  for (const condition of [landed!, dismissed!]) {
    const serialized = JSON.stringify(webAutomationExpectationActionPayload(condition));
    assert.ok(!serialized.includes("data-testid"), serialized);
  }
});

test("a refusal describes the claim and never the page", () => {
  const refusal = webAutomationExpectationConditionRefusal(webAutomationExpectationCondition({ kind: "text", expected: " " }, 0)!);
  assert.equal(refusal, "a text claim naming nothing to look for, which the page cannot be asked");
  assert.ok((refusal ?? "").length <= 160);
});
