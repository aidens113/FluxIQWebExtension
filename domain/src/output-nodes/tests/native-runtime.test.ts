// T1 for Phase 1.2 step 5 on the node path. A node implementation runs before
// its output is dispatched — Core executes it, then dispatches the effects it
// returned and merges the dispatcher's status, message, and failure over the
// result (`runtime/executor/node-execution.ts`) — so it cannot and must not
// report the command's outcome. What it owes Core is one dispatch effect
// naming its own output and carrying the node's parameters unchanged; the
// status fidelity itself is covered by `io/tests/gateway-output-dispatcher`
// and `runtime/tests/adapter`.

import assert from "node:assert/strict";
import test from "node:test";
import type { AutomationNodeExecutionResult, AutomationStudioNativeNodeContext } from "fluxiq/automation-studio/nodes";
import type { JsonValue } from "fluxiq/core";
import { WEB_AUTOMATION_ACTION_TYPES, type WebAutomationActionType } from "../../actions/types";
import { createWebAutomationOutputNodeImplementationBundle } from "../native-runtime";

const bundle = createWebAutomationOutputNodeImplementationBundle();

async function execute(outputId: WebAutomationActionType, parameters: Record<string, JsonValue>): Promise<AutomationNodeExecutionResult> {
  const implementation = bundle.implementations[outputId];
  if (!implementation) throw new Error(`No trusted-local implementation is bound for ${outputId}.`);
  const context = { inputs: {}, parameters, log: () => undefined } as unknown as AutomationStudioNativeNodeContext;
  return await implementation(context);
}

test("every web automation action type has a bound implementation", () => {
  assert.deepEqual(Object.keys(bundle.implementations).sort(), [...WEB_AUTOMATION_ACTION_TYPES].sort());
  assert.equal(bundle.packageId, "@fluxiq-web-extension/domain");
});

test("an implementation emits exactly one dispatch effect naming its own output", async () => {
  const result = await execute("web.dom.click", { selector: "#save", timeoutMs: 10_000 });
  assert.deepEqual(result.effects, [{
    type: "policy.output.dispatch",
    payload: { outputId: "web.dom.click", parameters: { selector: "#save", timeoutMs: 10_000 } }
  }]);
});

test("an implementation reports no status of its own for Core to trust", async () => {
  const result = await execute("web.dom.wait_for_selector", { selector: "#late" });
  // Core's merge overwrites status, route, message, and failure from the
  // dispatcher whenever the dispatch fails, so anything stated here about the
  // command's outcome would be a guess made before the command ran.
  assert.equal(result.status, "success");
  assert.equal(result.route, "success");
  assert.equal(result.message, undefined);
  assert.equal(result.failure, undefined);
});

test("each of the seven new action types dispatches under its own output id", async () => {
  for (const outputId of ["web.dom.check", "web.dom.assert", "web.dom.extract_list", "web.dom.upload", "web.dom.dialog", "web.browser.tab", "web.browser.download"] as WebAutomationActionType[]) {
    const result = await execute(outputId, { selector: "#target" });
    const effect = result.effects?.[0];
    assert.equal(effect?.type, "policy.output.dispatch");
    assert.deepEqual(effect?.payload, { outputId, parameters: { selector: "#target" } });
  }
});
