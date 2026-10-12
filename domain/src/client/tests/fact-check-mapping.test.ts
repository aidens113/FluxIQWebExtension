// Coverage of fact-check-mapping.ts: only the fact check's action type is
// taken off the action path, an unreadable one is refused with Core's record,
// and its answer leaves the browser rebuilt.

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_AUTOMATION_FACT_CHECK_ACTION_TYPE, type WebAutomationFactCheckResult } from "../../actions/fact-check";
import { webAutomationFactCheckFromGatewayCommand, webAutomationFactCheckResultPayload } from "../fact-check-mapping";
import { normalizeWebAutomationActionType } from "../gateway-mapping";

test("a web action is not a fact check, and a fact check is not a web action", () => {
  assert.equal(webAutomationFactCheckFromGatewayCommand({ commandId: "c1", actionType: "web.dom.assert", parameters: {} }), undefined);
  // The action path would refuse it, which is why the extension asks this first.
  assert.equal(normalizeWebAutomationActionType(WEB_AUTOMATION_FACT_CHECK_ACTION_TYPE).ok, false);
});

test("a fact check carries its request", () => {
  const check = webAutomationFactCheckFromGatewayCommand({
    commandId: "c2",
    actionType: WEB_AUTOMATION_FACT_CHECK_ACTION_TYPE,
    parameters: { queries: [{ kind: "url", comparison: "contains", expected: "/cart" }], documentTimeOrigin: 4 }
  });
  assert.deepEqual(check, { commandId: "c2", request: { queries: [{ kind: "url", comparison: "contains", expected: "/cart" }], documentTimeOrigin: 4 } });
});

test("a fact check with no query list is refused, by Core's invalid-parameter record", () => {
  const check = webAutomationFactCheckFromGatewayCommand({ commandId: "c3", actionType: WEB_AUTOMATION_FACT_CHECK_ACTION_TYPE, parameters: {} });
  assert.ok(check && "status" in check);
  assert.equal(check.status, "rejected");
  assert.equal(check.failure.code, "web.action.invalid_parameter");
});

test("the answer payload is rebuilt, so a stray field never leaves the browser", () => {
  // What a careless producer might hand over: declared fields plus two that are not.
  const polluted: unknown = {
    answers: [{ result: "true", capturedAt: 1, evidence: { excerpt: "ok", value: "secret" } }],
    leaked: "page html"
  };
  const payload = webAutomationFactCheckResultPayload(polluted as WebAutomationFactCheckResult);
  assert.deepEqual(payload, { answers: [{ result: "true", evidence: { excerpt: "ok" }, capturedAt: 1 }] });
});
