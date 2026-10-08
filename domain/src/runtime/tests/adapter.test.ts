import { exerciseRequiredWebDispatch } from "../../io/tests/required-context";
// T1 for Phase 1.2 step 5 and Phase 1.5 steps 3 and 4 on the runtime path.
//
// Phase 1.5 half: every command that did not succeed leaves the adapter with a
// structured failure record drawn from the closed code set, and a failed one
// carries the sanitized `web-llm-evidence.v2` packet built from the snapshot
// the client captured at the instant of failure. Records are run through Core's
// own `parseAutomationStudioFailureRecord`, because Core drops an inconsistent
// record whole rather than repairing it -- a record that does not survive the
// parser loses the failure silently.
//
// Phase 1.2 half. The adapter must report the
// command's own status: flattening `timed_out` and `cancelled` to `failed`
// left Core with an undifferentiated failure it could not classify
// (`failureForCommandStatus`, Core `io-policy.ts`), and a message the client
// reported without an `error` never reached the node attempt, which builds its
// reason from `result.message ?? result.error`. The `rejected` answer for an
// output this domain does not own is unchanged.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { FluxIQ } from "fluxiq";
import { ClientGatewayCommandContext } from "fluxiq/client-gateway";
import type { AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import {
  parseAutomationStudioFailureRecord,
  sanitizeAutomationStudioLlmFailureEvidence
} from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import type { FluxIQRuntimeCommand, FluxIQRuntimeCommandResult } from "fluxiq/runtime";
import { createWebAutomationRuntimeAdapter } from "../adapter";
import { shownPageLines } from "../llm-evidence/page-view/tests/shown-page-lines";

type GatewayActionResult = {
  commandId: string;
  status: "succeeded" | "failed" | "timed_out" | "cancelled" | "unknown";
  message?: string;
  error?: string;
  payload?: JsonObject;
  failure?: AutomationStudioFailureRecord;
};

const readySession = {
  sessionId: "session.one",
  clientId: "client.one",
  status: "ready",
  clientType: "extension",
  capabilities: [{ id: "web.actions", actionTypes: ["web.dom.click"] }]
};

const clickCommand: FluxIQRuntimeCommand = {
  kind: "execute_action",
  commandId: "command.one",
  outputId: "web.dom.click",
  parameters: { selector: "#save" }
};

const succeeded: GatewayActionResult = {
  commandId: "client.command.one",
  status: "succeeded",
  message: "Option selected.",
  payload: { value: "team" }
};

async function runCommand(
  result: GatewayActionResult,
  command: FluxIQRuntimeCommand = clickCommand,
  sessions: unknown[] = [readySession]
): Promise<FluxIQRuntimeCommandResult> {
  const fluxiq = {
    programs: {
      clientGateway: { snapshot: () => ({ sessions }) },
      automationStudioClientGateway: { executeAction: async () => result }
    }
  } as unknown as FluxIQ;
  const adapter = createWebAutomationRuntimeAdapter({ fluxiq });
  return await adapter.execute(command, {});
}

test("a succeeded command keeps its status and promotes the client's message", async () => {
  const result = await runCommand(succeeded);
  assert.equal(result.status, "succeeded");
  assert.equal(result.message, "Option selected.", "the post-condition the client reported reaches the runtime result");
  assert.equal(result.error, undefined, "a success never gains an error");
  assert.deepEqual(result.payload, { status: "succeeded", message: "Option selected.", result: { value: "team" } });
  assert.deepEqual(result.metadata, { outputId: "web.dom.click" });
});

test("a timed out command stays timed_out rather than flattening to failed", async () => {
  const result = await runCommand({ commandId: "client.command.two", status: "timed_out", message: "The element never became visible." });
  assert.equal(result.status, "timed_out");
  assert.equal(result.message, "The element never became visible.");
});

test("a cancelled command stays cancelled rather than flattening to failed", async () => {
  const result = await runCommand({ commandId: "client.command.three", status: "cancelled", message: "The operator stopped the run." });
  assert.equal(result.status, "cancelled");
  assert.equal(result.message, "The operator stopped the run.");
});

test("an unknown command status survives, and carries no invented message", async () => {
  const result = await runCommand({ commandId: "client.command.four", status: "unknown" });
  assert.equal(result.status, "unknown");
  assert.equal(result.message, undefined);
  assert.equal(result.error, undefined);
});

test("a reported error stays the error and becomes the message", async () => {
  const result = await runCommand({
    commandId: "client.command.five",
    status: "failed",
    error: "No element matches #save.",
    message: "Click failed."
  });
  assert.equal(result.status, "failed");
  assert.equal(result.error, "No element matches #save.");
  assert.equal(result.message, "No element matches #save.", "an explicit error outranks the payload message");
});

test("the client's structured failure record reaches the runtime result", async () => {
  const failure: AutomationStudioFailureRecord = {
    category: "output_not_observed",
    code: "web.validation.output_not_observed",
    retryable: true,
    stage: "verification"
  };
  const result = await runCommand({
    commandId: "client.command.six",
    status: "failed",
    message: "Expected the value to be team, but it stayed starter.",
    failure
  });
  // A press whose confirmation was lost after it acted says so (t359): the
  // record is the client's, stating the act may have landed, and Core does not
  // press again.
  assert.deepEqual(result.failure, { ...failure, effect: "ambiguous" }, "Core classifies from the record before it matches the message");
  assert.equal(result.message, "Expected the value to be team, but it stayed starter.");
});

test("a read whose post-condition did not hold keeps its retry, because reading again acts on nothing (t355)", async () => {
  const failure: AutomationStudioFailureRecord = { category: "output_not_observed", code: "web.validation.output_not_observed", retryable: true, stage: "verification" };
  const read: FluxIQRuntimeCommand = { kind: "execute_action", commandId: "command.read", outputId: "web.dom.extract", parameters: { selector: "#price" } };
  const result = await runCommand({ commandId: "client.command.read", status: "failed", message: "Nothing to read yet.", failure }, read);
  assert.deepEqual(result.failure, failure);
});

test("a press the page turned away before it landed keeps its retry, and the wait the page named (t355)", async () => {
  const failure: AutomationStudioFailureRecord = { category: "action_failed", code: "web.action.rate_limited", retryable: true, stage: "execution", effect: "unacted", retryAfterMs: 4_000 };
  const result = await runCommand({ commandId: "client.command.busy", status: "failed", message: "Network busy, please try again.", failure });
  assert.equal(result.failure?.retryable, true);
  assert.equal(result.failure?.effect, "unacted");
  assert.equal(result.failure?.retryAfterMs, 4_000, "Core's retry honours the page's own wait");
  const missing: AutomationStudioFailureRecord = { category: "target_not_found", code: "web.target.not_found", retryable: true, stage: "target_resolution" };
  const late = await runCommand({ commandId: "client.command.late", status: "failed", message: "Not drawn yet.", failure: missing });
  assert.equal(late.failure?.retryable, true);
});

test("a committing press states whether it was dispatched, so Core repeats only a press that never happened (t359)", async () => {
  const after = async (code: string, category: AutomationStudioFailureRecord["category"], stage: AutomationStudioFailureRecord["stage"], extra: Partial<AutomationStudioFailureRecord> = {}, command: FluxIQRuntimeCommand = clickCommand) =>
    (await runCommand({ commandId: `client.${code}`, status: "failed", message: "The press failed.", failure: { category, code, retryable: true, ...(stage ? { stage } : {}), ...extra } }, command)).failure;
  // Sent, and only the answer is missing: the verb threw, the page changed under it, the acknowledgement timed out.
  for (const [code, category] of [["web.action.failed", "action_failed"], ["web.page.changed", "page_changed"], ["web.action.timeout", "timeout"]] as const) {
    const failure = await after(code, category, "execution");
    assert.equal(failure?.effect, "ambiguous", `${code} after the press may have landed`);
    assert.equal(failure?.retryable, true, "Core decides, from the statement, not from a flag cleared here");
    assert.deepEqual(parseAutomationStudioFailureRecord(failure), failure);
  }
  // Nothing was dispatched: not resolved yet, turned away as busy, or refused by the gate before the press.
  assert.equal((await after("web.target.not_found", "target_not_found", "target_resolution"))?.effect, "unacted");
  assert.equal((await after("web.action.rate_limited", "action_failed", "execution", { effect: "unacted" }))?.effect, "unacted");
  const covered = await runCommand({ commandId: "client.covered", status: "failed", message: "Covered.", failure: { category: "unexpected_state", code: "web.target.not_actionable", retryable: false, stage: "execution", actual: "covered: a layer", effect: "unacted" } });
  assert.equal(covered.failure?.effect, "unacted", "the client stood nearest the page and stated nothing was pressed");
  // Typing that sends its form commits; typing alone keeps t355's rule.
  const typeCommand = (submit: boolean): FluxIQRuntimeCommand => ({ kind: "execute_action", commandId: "command.type", outputId: "web.dom.type", parameters: { selector: "#q", text: "lamp", submit } });
  assert.equal((await after("web.action.failed", "action_failed", "execution", {}, typeCommand(true)))?.effect, "ambiguous");
  const typed = await after("web.action.failed", "action_failed", "execution", {}, typeCommand(false));
  assert.equal(typed?.effect, undefined, "typing into a field is not a committing act");
  assert.equal(typed?.retryable, true);
});

test("a client record naming a code this domain does not own becomes UNKNOWN, carrying the code it used", async () => {
  // `result.failure` crossed the WebSocket, so its `code` is a bare string
  // until the adapter checks it -- Core's contract is to validate what crossed
  // a process boundary, and this is that boundary. `web.action.output_not_observed`
  // is what the client emitted before Wave 3 closed the set and is nobody's
  // code now; until this check it reached Core's attempt trace unaltered, where
  // nothing downstream can act on a code no allowlist names. This is the same
  // answer `carriedWebAutomationFailure` gives a thrown record whose code is
  // outside the set, because it is the same drift arriving another way.
  const failure: AutomationStudioFailureRecord = { category: "output_not_observed", code: "web.action.output_not_observed", retryable: true, actual: "the field is empty" };
  const result = await runCommand({ commandId: "client.command.six.b", status: "failed", message: "Value not observed.", failure });
  assert.equal(result.failure?.code, "web.action.unknown");
  assert.equal(result.failure?.category, "ambiguous_or_unknown");
  assert.equal(result.failure?.actual, "the field is empty; unrecognized web automation failure code: web.action.output_not_observed", "what the client saw is kept beside the code nobody names");
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure);
});

test("a client record whose category contradicts its code is rebuilt from the code's own row", async () => {
  // A client one version behind, or one assembling records by hand, can pair a
  // named code with a category that its row forbids. Core's parser drops an
  // inconsistent record whole rather than repairing it, so trusting the sender
  // field by field risks losing the failure entirely. The code is the only part
  // this domain owns, so the code decides; what only the client could see rides
  // across untouched.
  const failure: AutomationStudioFailureRecord = {
    category: "action_failed",
    code: "web.target.not_found",
    retryable: false,
    stage: "execution",
    expected: "an element matching #pay",
    actual: "nothing matched"
  };
  const result = await runCommand({ commandId: "client.command.six.c", status: "failed", message: "Nothing matched #pay.", failure });
  assert.equal(result.failure?.category, "target_not_found", "the code decides the category, not the sender");
  assert.equal(result.failure?.retryable, true, "an element may appear once the page settles, whatever the sender said");
  assert.equal(result.failure?.stage, "target_resolution");
  assert.equal(result.failure?.expected, "an element matching #pay");
  assert.equal(result.failure?.actual, "nothing matched");
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure);
});

test("an output this domain does not own is still rejected before anything is dispatched", async () => {
  const result = await runCommand(succeeded, { kind: "execute_action", commandId: "command.two", outputId: "web.dom.teleport" });
  assert.equal(result.status, "rejected");
  assert.match(result.message ?? "", /Unsupported web automation output/u);
  assert.equal(result.error, result.message);
});

test("a dispatch with no eligible client fails with the selection reason", async () => {
  const result = await runCommand(succeeded, clickCommand, []);
  assert.equal(result.status, "failed");
  assert.match(result.error ?? "", /single paired web-automation client/u);
});

test("the command's timeout is sent to the client as the gateway command's timeout, and none is invented", async () => {
  // Without it the client waits its own default (10,000 ms for a wait) while
  // Core gives up on the node's timeout plus its answer margin, so a page that
  // never shows the target is reported as a client that never answered.
  const sent: JsonObject[] = [];
  const fluxiq = {
    programs: {
      clientGateway: { snapshot: () => ({ sessions: [readySession] }) },
      automationStudioClientGateway: {
        executeAction: async (_sessionId: string, command: JsonObject) => {
          sent.push(command);
          return succeeded;
        }
      }
    }
  } as unknown as FluxIQ;
  const adapter = createWebAutomationRuntimeAdapter({ fluxiq });

  await adapter.execute({ ...clickCommand, timeoutMs: 5_000 }, {});
  await adapter.execute(clickCommand, {});
  await adapter.execute({ ...clickCommand, timeoutMs: 0 }, {});

  assert.equal(sent.length, 3);
  assert.equal(sent[0]?.timeoutMs, 5_000, "the client gives up when the node does");
  assert.equal(Object.hasOwn(sent[1] ?? {}, "timeoutMs"), false, "a command without a timeout sends none, so the client keeps its default");
  assert.equal(Object.hasOwn(sent[2] ?? {}, "timeoutMs"), false, "a timeout the runtime arms no deadline for is not sent either");
});

// --- Phase 1.5 steps 3 and 4: the structured failure and the evidence packet ---

/**
 * The client's action-result payload, as `webAutomationActionResultPayload`
 * shapes it. `dispatchWebAutomationOutput` is what nests it under `result`, so
 * this is the inner object, not the wrapper.
 */
function failedPayload(overrides: JsonObject = {}): JsonObject {
  return {
    commandId: "client.command.one",
    actionType: "web.dom.click",
    status: "failed",
    url: "https://fixture.test/checkout/pay?session=secret-token#step2",
    title: "Checkout",
    element: { selector: "#pay", tagName: "button" },
    snapshot: {
      url: "https://fixture.test/checkout/pay?session=secret-token",
      title: "Checkout",
      interactiveElements: [
        { tagName: "button", selector: "#pay", role: "button", name: "Pay now" },
        { tagName: "input", selector: "#card", inputType: "password", name: "Card number" }
      ]
    },
    ...overrides
  };
}

test("a failed command with no client record still leaves with one from the closed code set", async () => {
  const result = await runCommand({ commandId: "client.command.seven", status: "failed", message: "The click did not take." });
  assert.equal(result.failure?.code, "web.action.failed", "the message is a reason, so the failure is action_failed rather than unknown");
  assert.equal(result.failure?.category, "action_failed");
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure, "Core keeps the record whole");
});

test("a timed out command leaves with the timeout code, not a bare status", async () => {
  const result = await runCommand({ commandId: "client.command.eight", status: "timed_out", message: "The element never became visible." });
  assert.equal(result.status, "timed_out");
  assert.equal(result.failure?.code, "web.action.timeout");
  assert.equal(result.failure?.category, "timeout");
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure);
});

test("a failure with nothing to say is UNKNOWN rather than no record at all", async () => {
  const result = await runCommand({ commandId: "client.command.nine", status: "unknown" });
  assert.equal(result.failure?.code, "web.action.unknown");
  assert.equal(result.failure?.category, "ambiguous_or_unknown");
});

test("a succeeded command carries no failure and no failure evidence", async () => {
  const result = await runCommand({ ...succeeded, payload: failedPayload() });
  assert.equal(result.failure, undefined);
  assert.equal((result.metadata as JsonObject | undefined)?.failureEvidence, undefined);
  assert.equal((result.metadata as JsonObject | undefined)?.failureDiagnostics, undefined);
});

test("an output this domain does not own is rejected with the unsupported-type code", async () => {
  const result = await runCommand(succeeded, { kind: "execute_action", commandId: "command.three", outputId: "web.dom.teleport" });
  assert.equal(result.status, "rejected");
  assert.equal(result.failure?.code, "web.action.unsupported_type");
  assert.equal(result.failure?.category, "blocked_by_capability_or_policy");
  assert.equal(result.failure?.retryable, false, "Core forbids this category from being retryable");
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure);
});

test("a failed command carries the sanitized evidence packet, digest-bound to its own failure record", async () => {
  const result = await runCommand({ commandId: "client.command.ten", status: "failed", message: "Click failed.", payload: failedPayload() });
  const metadata = result.metadata as JsonObject;
  const evidence = metadata.failureEvidence as JsonObject;
  // The page as the model reads every page (t223), never the structured packet.
  assert.equal(evidence.schemaVersion, "web-llm-page.v3");
  assert.equal(Object.hasOwn(evidence, "elements"), false);
  assert.equal(evidence.trust, "untrusted-page-evidence");
  assert.equal(evidence.location, "https://fixture.test/checkout/pay?session=(withheld)", "the packet's location keeps the query and withholds the session token's value");
  // Core's own gate, applied to the packet exactly as the diagnosis path will.
  assert.deepEqual(sanitizeAutomationStudioLlmFailureEvidence("runtime_diagnosis", evidence), evidence);

  const diagnostics = metadata.failureDiagnostics as JsonObject;
  assert.equal(diagnostics.url, "https://fixture.test/checkout/pay?session=(withheld)#step2", "no secret query value reaches the attempt trace");
  // Phase T: what rides into Core is the handle the packet minted for the
  // control, never the control's own selector.
  assert.equal(diagnostics.selector, undefined, "no selector reaches Core on the attempt's metadata");
  assert.equal(diagnostics.failedTarget, "t1", "the target the client resolved rides with the failure, as a handle");
  assert.equal((evidence as { failedTarget?: string }).failedTarget, "t1", "and the packet the model reads marks the same element");
  assert.doesNotMatch(JSON.stringify(metadata.failureDiagnostics), /#pay|#card/u);
  assert.equal(diagnostics.evidenceDigest, createHash("sha256").update(JSON.stringify(evidence)).digest("hex"));
  assert.equal(result.failure?.evidenceDigest, diagnostics.evidenceDigest, "the record names the packet it was captured with");
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure, "the digest does not cost the record its validity");
});

test("the evidence packet never carries a sensitive control", async () => {
  const result = await runCommand({ commandId: "client.command.eleven", status: "failed", message: "Click failed.", payload: failedPayload() });
  const evidence = (result.metadata as JsonObject).failureEvidence as JsonObject;
  // One element survives, and it is the pay button rather than the password
  // field: the sensitive control is dropped whole, not described without its
  // value. It is named by its opaque handle, because the page an LLM reads has
  // carried no selector since `.v2`, and is the compact view since t223.
  assert.deepEqual(shownPageLines(evidence).map((line) => [line.target, line.kind]), [["t1", "button"]], "the password control is dropped, not reported");
  assert.doesNotMatch(JSON.stringify(evidence), /#pay|#password|selector/u);
});

test("a client's own failure record survives the hop and only gains the digest", async () => {
  const failure: AutomationStudioFailureRecord = {
    category: "target_not_found",
    code: "web.target.not_found",
    retryable: true,
    stage: "target_resolution",
    expected: "an element matching #pay",
    actual: "nothing matched"
  };
  const result = await runCommand({ commandId: "client.command.twelve", status: "failed", message: "Nothing matched #pay.", failure, payload: failedPayload() });
  // A press states that a target never resolved means nothing was pressed (t359).
  assert.deepEqual({ ...result.failure, evidenceDigest: undefined }, { ...failure, effect: "unacted", evidenceDigest: undefined }, "the producer stood nearest the page, so its record is not relabelled");
  assert.match(String(result.failure?.evidenceDigest), /^[a-f0-9]{64}$/u);
});

test("an unusable snapshot costs the packet, never the failure it was meant to explain", async () => {
  const result = await runCommand({
    commandId: "client.command.thirteen",
    status: "failed",
    message: "Click failed.",
    payload: failedPayload({ snapshot: { url: "about:blank", title: "", interactiveElements: [] } })
  });
  assert.equal((result.metadata as JsonObject).failureEvidence, undefined, "a non-HTTP location is refused by the sanitizer");
  assert.equal(result.failure?.code, "web.action.failed", "the failure is reported anyway");
  assert.equal(result.failure?.evidenceDigest, undefined);
  assert.equal((result.metadata as JsonObject | undefined)?.failureDiagnostics !== undefined, true, "the URL and target still ride with it");
});

test("actual required runtime domain owner forwards service-issued context through durable gateway", async () => { await exerciseRequiredWebDispatch("runtime"); });
test("required Runtime refuses copied context before selecting/sending", async () => {
  const adapter = createWebAutomationRuntimeAdapter({ fluxiq: { programs: {} } as unknown as FluxIQ });
  await assert.rejects(() => Promise.resolve(adapter.executeWithCommandContext!(clickCommand, { commandContext: {} as ClientGatewayCommandContext })));
});
