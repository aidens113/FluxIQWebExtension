// A select that names no option is refused before dispatch as an invalid
// parameter, with the shape of an option in what the model reads (t1081,
// bigbox `run-mwytbimp-e0c33977`). Both recorded sends are replayed here:
// step 0014 wrote `label` beside the target, step 0026 `option: {label}` with
// no `by`. Each reached the verb as "the command named none" and was retried
// four times behind a bare `output_not_observed`.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webActionFailureRefusal } from "../../runtime/llm-evidence/action-failure";
import { webLlmRejectionNext } from "../../runtime/llm-evidence/rejection-next";
import { webAutomationOutputNodeDefinitions } from "../../output-nodes";
import { webAutomationActionFromGatewayCommand } from "../gateway-mapping";

const send = (parameters: JsonObject) => webAutomationActionFromGatewayCommand({
  commandId: "sort_price", actionType: "web.dom.select", target: { selector: "#sort" }, parameters: { selector: "#sort", ...parameters }
}) as { status?: string; failure?: { code?: string; actual?: string }; message?: string };

const RECORDED = [
  ["0014: label beside the target", { label: "Price low to high" }, "unnamed"],
  ["0026: option with no by", { option: { label: "Price low to high" } }, "unreadable"]
] as const;

for (const [name, parameters, issue] of RECORDED) {
  test(`${name} is refused at once as an invalid parameter, and the model is told the shape`, () => {
    const refused = send(parameters);
    assert.equal(refused.status, "rejected");
    assert.equal(refused.failure?.code, "web.action.invalid_parameter");
    const refusal = webActionFailureRefusal({ status: "failed", failure: refused.failure }, { actionType: "web.dom.select", parameters });
    assert.equal(refusal.code, "invalid_input");
    assert.equal(refusal.detail?.reason, "parameter_not_readable");
    assert.deepEqual(refusal.detail?.instead, [`web.select.option.${issue}`]);
    const next = webLlmRejectionNext("parameter_not_readable", refusal.detail?.instead, undefined);
    assert.match(next ?? "", /"by": "label"/u);
    assert.match(next ?? "", /Nothing was chosen/u);
    // Nothing the model sent is echoed.
    assert.equal(JSON.stringify([refusal, next]).includes("Price low to high"), false);
  });
}

test("a select that names its option by either readable form is dispatched, an empty value included", () => {
  for (const parameters of [{ value: "Price low to high" }, { value: "" }, { option: { by: "label", label: "Price low to high" } }, { option: { by: "index", index: 0 } }]) {
    assert.equal(send(parameters as JsonObject).status, undefined, JSON.stringify(parameters));
  }
});

test("only a select is refused for naming no option", () => {
  const click = webAutomationActionFromGatewayCommand({ commandId: "c", actionType: "web.dom.click", target: { selector: "#go" }, parameters: { selector: "#go" } });
  assert.equal((click as { status?: string }).status, undefined);
});

test("the select node shows the model what value and option take", () => {
  const node = webAutomationOutputNodeDefinitions.find((item) => item.outputAction?.fixedOutputId === "web.dom.select");
  const parameters = (node as unknown as { parameters: { id: string; description?: string; example?: unknown }[] }).parameters;
  const option = parameters.find((parameter) => parameter.id === "option");
  const value = parameters.find((parameter) => parameter.id === "value");
  assert.match(option?.description ?? "", /by is value .*label .*index/u);
  assert.deepEqual(option?.example, { by: "label", label: "the option's visible words" });
  assert.match(value?.description ?? "", /visible words/u);
});
