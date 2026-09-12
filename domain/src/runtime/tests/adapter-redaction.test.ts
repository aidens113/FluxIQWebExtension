// The adapter's second job on a failure, kept apart from `adapter.test.ts`
// because it is a different subject: not what a failure is classified as, but
// what it is allowed to say.
//
// A failure record's `expected` and `actual` never pass through
// `webAutomationActionResultPayload`. `apps/extension/src/runtime/result-mapping.ts`
// puts `result.failure` on the gateway result directly, so this adapter is the
// only place the domain sees them, and they are built in the content script
// from the same value read-back the validation is. Wave 3 taught the producer in
// `content/actions/` to withhold a sensitive control's value from both, and
// widened `gateway-mapping.ts` so the validation reaches the domain at all --
// two changes that were each correct alone and that nothing tested together.
// The producer's redaction is in another package and this side cannot see it,
// so it cannot be what makes this side safe.
//
// Every row hands the adapter exactly what a producer with its redaction
// removed would send. The sentinel below is not a secret and carries no shape
// of one; it stands for whatever such a producer would have written, and each
// row searches the whole serialized runtime result for it rather than one named
// field -- which is how every leak found in this plan was found.

import assert from "node:assert/strict";
import test from "node:test";
import type { FluxIQ } from "fluxiq";
import type { AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import type { FluxIQRuntimeCommand, FluxIQRuntimeCommandResult } from "fluxiq/runtime";
import { WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT } from "../../sensitivity";
import { createWebAutomationRuntimeAdapter } from "../adapter";

type GatewayActionResult = {
  commandId: string;
  status: "succeeded" | "failed" | "timed_out" | "cancelled" | "unknown";
  message?: string;
  payload?: JsonObject;
  failure?: AutomationStudioFailureRecord;
};

const typeCommand: FluxIQRuntimeCommand = {
  kind: "execute_action",
  commandId: "command.type",
  outputId: "web.dom.type",
  parameters: { selector: "[data-testid=\"payment\"]" }
};

/** The adapter driven against a fake FluxIQ, as `adapter.test.ts` drives it. */
async function runCommand(result: GatewayActionResult): Promise<FluxIQRuntimeCommandResult> {
  const fluxiq = {
    programs: {
      clientGateway: {
        snapshot: () => ({
          sessions: [{
            sessionId: "session.one", clientId: "client.one", status: "ready", clientType: "extension",
            capabilities: [{ id: "web.actions", actionTypes: ["web.dom.type"] }]
          }]
        })
      },
      automationStudioClientGateway: { executeAction: async () => result }
    }
  } as unknown as FluxIQ;
  const adapter = createWebAutomationRuntimeAdapter({ fluxiq });
  return await adapter.execute(typeCommand, {});
}

const producerSentinel = "SENTINEL-VALUE-A-PRODUCER-SHOULD-HAVE-WITHHELD";

/** The client's result for a `web.dom.type` on a control the one sensitivity rule marks. */
function sensitivePayload(overrides: JsonObject = {}): JsonObject {
  return {
    commandId: "client.command.sensitive",
    actionType: "web.dom.type",
    status: "succeeded",
    url: "https://fixture.test/checkout",
    title: "Checkout",
    element: { selector: "[data-testid=\"payment\"]", tagName: "input", inputType: "text", attributes: { autocomplete: "billing cc-number" } },
    validation: { status: "passed", expected: `the field holds "${producerSentinel}"`, actual: `the field holds "${producerSentinel}"` },
    ...overrides
  };
}

const leakingClientRecord: AutomationStudioFailureRecord = {
  category: "output_not_observed",
  code: "web.validation.output_not_observed",
  retryable: true,
  stage: "verification",
  expected: `the field holds "${producerSentinel}"`,
  actual: `the field holds "${producerSentinel}", which is not the text that was sent`
};

test("a client's failure record for a sensitive control leaves without its comparison", async () => {
  const result = await runCommand({
    commandId: "client.command.fourteen",
    status: "failed",
    message: "The field did not keep the text.",
    failure: leakingClientRecord,
    payload: sensitivePayload({ status: "failed", validation: { status: "failed", expected: `the field holds "${producerSentinel}"`, actual: "the field holds something else" } })
  });
  assert.equal(JSON.stringify(result).includes(producerSentinel), false, "nothing the producer failed to withhold reaches an attempt trace");
  assert.equal(result.failure?.code, "web.validation.output_not_observed", "the classification is untouched: only the two strings are");
  assert.equal(result.failure?.category, "output_not_observed");
  assert.equal(result.failure?.retryable, true);
  assert.equal(result.failure?.expected, WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT);
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure, "Core keeps the withheld record whole");
});

test("a sensitive control's post-condition is withheld from the dispatch payload as well as the record", async () => {
  const result = await runCommand({ commandId: "client.command.sensitive", status: "succeeded", message: "Text entered.", payload: sensitivePayload() });
  assert.equal(JSON.stringify(result).includes(producerSentinel), false, "a succeeded action leaks the same way a failed one does, and is checked the same way");
  const action = (result.payload as JsonObject).result as JsonObject;
  assert.deepEqual(action.validation, { status: "passed", expected: WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT, actual: WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT }, "withheld text leaves without the flag: the flag is the producer's declaration, and a layer that stamps its own output disarms the next guard");
  assert.equal(action.element !== undefined, true, "the descriptor the guard read still rides with the result");
});

test("a code this domain does not name is still withheld before it becomes UNKNOWN", async () => {
  const result = await runCommand({
    commandId: "client.command.fifteen",
    status: "failed",
    message: "The field did not keep the text.",
    failure: { ...leakingClientRecord, code: "web.validation.invented" },
    payload: sensitivePayload({ status: "failed" })
  });
  assert.equal(JSON.stringify(result).includes(producerSentinel), false, "the UNKNOWN branch re-uses the sender's `actual`, so it needs the guard too");
  assert.equal(result.failure?.code, "web.action.unknown");
  assert.match(String(result.failure?.actual), /unrecognized web automation failure code/u, "the drift is still named");
});

test("an ordinary control keeps the comparison an operator acts on", async () => {
  const ordinary: AutomationStudioFailureRecord = {
    ...leakingClientRecord,
    expected: "the field holds \"synthetic-control-text\"",
    actual: "the field holds \"\""
  };
  const result = await runCommand({
    commandId: "client.command.sixteen",
    status: "failed",
    message: "The field did not keep the text.",
    failure: ordinary,
    payload: sensitivePayload({
      status: "failed",
      element: { selector: "input[name=\"username\"]", tagName: "input", inputType: "text", attributes: { autocomplete: "username" } },
      validation: { status: "failed", expected: "the field holds \"synthetic-control-text\"", actual: "the field holds \"\"" }
    })
  });
  assert.equal(result.failure?.expected, "the field holds \"synthetic-control-text\"", "redaction stays targeted, or it costs every diagnosis");
  assert.equal(result.failure?.actual, "the field holds \"\"");
  assert.deepEqual(((result.payload as JsonObject).result as JsonObject).validation, { status: "failed", expected: "the field holds \"synthetic-control-text\"", actual: "the field holds \"\"" });
});

test("the guard reaches exactly as far as the descriptor the client sent", async () => {
  const undescribed = sensitivePayload({ status: "failed" });
  delete undescribed.element;
  const result = await runCommand({
    commandId: "client.command.seventeen",
    status: "failed",
    message: "The field did not keep the text.",
    failure: leakingClientRecord,
    payload: undescribed
  });
  assert.equal(JSON.stringify(result).includes(producerSentinel), true, "with no descriptor this layer cannot judge, and says so here rather than in a comment");
});

// -- The producer's declaration, and the fail-safe when it is absent ---------
// Withholding unconditionally cost the producer's own redacted phrasing on
// every sensitive-control failure: a verb that said "a withheld value of 12
// characters" -- a length and never a value -- had it replaced by the marker,
// which says less and hides nothing extra. `redacted` on the validation is the
// producer's declaration that it already did this, and it is a contract rather
// than a heuristic: nothing below inspects the text.
//
// The rows that matter most are the ones where the declaration is *missing* or
// malformed. This is the exit a wire reaches, so the flag arrives as JSON from
// a client that may be older than the contract, may be some other client
// entirely, or may be hand-written; every one of those must be withheld.

/** A comparison a verb built without quoting the control's value: a length, never the content. */
const redactedPhrasing = "the field holds a withheld value of 19 characters";

const producerRedactedRecord: AutomationStudioFailureRecord = {
  category: "output_not_observed",
  code: "web.validation.output_not_observed",
  retryable: true,
  stage: "verification",
  expected: redactedPhrasing,
  actual: `${redactedPhrasing}, which is not the text that was sent`
};

test("a producer that declared it withheld the values keeps its phrasing on both exits", async () => {
  const result = await runCommand({
    commandId: "client.command.eighteen",
    status: "failed",
    message: "The field did not keep the text.",
    failure: producerRedactedRecord,
    payload: sensitivePayload({
      status: "failed",
      validation: { status: "failed", expected: redactedPhrasing, actual: `${redactedPhrasing}, which is not the text that was sent`, redacted: true }
    })
  });
  assert.equal(result.failure?.expected, redactedPhrasing, "the length the producer measured is what a person debugging a read-back needs");
  assert.match(String(result.failure?.actual), /is not the text that was sent/u, "and the half that says the comparison failed");
  assert.equal(String(result.failure?.actual).includes(WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT), false, "a declared redaction is not withheld a second time");
  assert.deepEqual(
    ((result.payload as JsonObject).result as JsonObject).validation,
    { status: "failed", expected: redactedPhrasing, actual: `${redactedPhrasing}, which is not the text that was sent`, redacted: true },
    "the dispatch payload keeps it too, or the flag buys back nothing"
  );
});

// The fail-safe, one row per way the declaration can fail to arrive. Each sends
// the *unredacted* strings a producer with its redaction removed would send, so
// a guard that honoured any of these shapes leaks here rather than in
// production. `undefined` is the older client and the untaught verb; `false` is
// a producer that declared the opposite; the string "true" is what a hand-built
// or loosely-typed sender puts on a wire, and it is not a declaration.
const absentDeclarations: Array<[what: string, redacted: unknown]> = [
  ["no flag at all, which is every client that predates the contract", undefined],
  ["a flag that says the opposite", false],
  ["a string that merely looks like the flag", "true"],
  ["a truthy value that is not the boolean", 1]
];

for (const [what, redacted] of absentDeclarations) {
  test(`an absent declaration withholds: ${what}`, async () => {
    const validation: JsonObject = { status: "failed", expected: `the field holds "${producerSentinel}"`, actual: `the field holds "${producerSentinel}"` };
    if (redacted !== undefined) validation.redacted = redacted as never;
    const result = await runCommand({
      commandId: "client.command.nineteen",
      status: "failed",
      message: "The field did not keep the text.",
      failure: leakingClientRecord,
      payload: sensitivePayload({ status: "failed", validation })
    });
    assert.equal(JSON.stringify(result).includes(producerSentinel), false, "the flag is the only thing that buys the text through, and this is not the flag");
    assert.equal(result.failure?.expected, WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT);
    assert.equal(((result.payload as JsonObject).result as JsonObject).validation !== undefined, true);
  });
}
