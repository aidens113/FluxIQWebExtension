import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "../../../../failure";
import { SNAPSHOT, TYPE, field, frozenHarness } from "./harness";

const TYPE_CALL: JsonObject = { node: TYPE, parameters: { target: { handle: "t1" }, text: "Fixed value" }, consequences: [] };
const ENTER_CALL: JsonObject = { node: "web.output.dom-keypress", parameters: { target: { handle: "t1" }, key: "Enter", timeoutMs: 1200 }, consequences: [] };

async function prepared(value: JsonObject = TYPE_CALL) {
  const host = frozenHarness();
  await host.run({ node: SNAPSHOT, parameters: {}, consequences: [] });
  assert.equal((await host.run(value)).effectApplied, true);
  const original = host.snapshots.at(-1)!;
  host.select(original);
  return { host, original, value };
}

test("selected execution reports its exact fresh final-lowering receipt without another candidate", async () => {
  const { host, original, value } = await prepared(ENTER_CALL);
  const snapshotCount = host.snapshots.length;
  const before = host.mainCommands().length;
  let permissions = 0;
  const result = await host.run(value, { permission: async () => {
    permissions += 1;
    assert.equal(host.consumeCalls, 0);
    return { permitted: true };
  } });
  assert.equal(result.resultCode, "web.action.succeeded");
  assert.equal(permissions, 1);
  assert.equal(host.consumeCalls, 1);
  assert.equal(host.mainCommands().length - before, 1);
  assert.equal(host.snapshots.length, snapshotCount);
  const report = host.reports[0]!;
  assert.equal(host.reports.length, 1);
  assert.equal(report.capsule, original.capsule);
  assert.equal(report.dispatch.attempts.length, 1);
  const selected = report.dispatch.attempts[0]!;
  assert.equal(selected.identity, report.dispatch.selected);
  assert.equal(selected.outcome, "succeeded");
  const sent = host.receipts.filter((entry) => entry.command.actionType === "web.dom.keypress").at(-1)!;
  assert.equal(selected.receipt, sent.result);
  assert.notEqual(selected.receipt, original.dispatch.attempts.at(-1)?.receipt);
  assert.notEqual(selected.identity, original.dispatch.selected);
  assert.equal(sent.command.parameters.timeoutMs, 16_200);
  assert.equal(sent.command.parameters.checkWaitMs, 15_000);
  assert.equal(sent.command.parameters.browserTabId, 4);
  assert.equal(sent.command.parameters.key, "Enter");
  assert.equal(result.outputs, undefined);
  assert.equal(host.commands.some((command) => /navigate|reset/u.test(command.actionType)), false);
  assert.doesNotMatch(JSON.stringify(result), /"(?:capsule|receipt|generation|effectiveInputs|reportDispatch)"/u);
});

test("selected same-subject recovery reports all fresh main attempts and excludes passive recovery looks", async () => {
  const { host, original, value } = await prepared();
  const reported = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND);
  const failure = { ...reported, effect: "unacted" as const };
  let calls = 0;
  host.answer(() => {
    calls += 1;
    if (calls === 3) host.replaceControls([field("A", "#fresh")]);
    return calls < 4 ? { status: "failed", failure } : { status: "succeeded", payload: { value: "Fresh value" } };
  });
  const receiptStart = host.receipts.length;
  const result = await host.run(value);
  assert.equal(result.resultCode, "web.action.succeeded");
  assert.equal((result.evidence as JsonObject).attempts, 4);
  assert.equal(host.mainCommands().at(-1)?.parameters.selector, "#fresh");
  assert.equal(host.reports.length, 1);
  const dispatch = host.reports[0]!.dispatch;
  assert.deepEqual(dispatch.attempts.map((attempt) => attempt.outcome), ["failed_unacted", "failed_unacted", "failed_unacted", "succeeded"]);
  const fresh = host.receipts.slice(receiptStart);
  const main = fresh.filter((entry) => entry.command.actionType === "web.dom.type");
  assert.equal(main.length, 4);
  assert.ok(fresh.length > main.length, "scope, recovery and after-action reads are auxiliary");
  dispatch.attempts.forEach((attempt, index) => {
    assert.equal(attempt.receipt, main[index]!.result);
    assert.notEqual(attempt.identity, original.dispatch.selected);
    assert.notEqual(attempt.receipt, original.dispatch.attempts.at(-1)?.receipt);
  });
  assert.equal(dispatch.selected, dispatch.attempts[3]!.identity);
  assert.equal(new Set(dispatch.attempts.map((attempt) => attempt.identity)).size, 4);
});

test("actual failed-unacted and uncertain committing receipts remain actual failures", async () => {
  for (const effect of ["unacted", "ambiguous"] as const) {
    const { host, value } = await prepared(ENTER_CALL);
    const reported = webAutomationFailureRecord(effect === "unacted" ? WEB_AUTOMATION_FAILURE_CODES.REFUSED_BY_PAGE : WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED);
    const failure = { ...reported, effect };
    host.answer(() => ({ status: "failed", failure, error: failure.code }));
    const before = host.mainCommands().length;
    const result = await host.run(value);
    assert.equal(result.effectApplied, false);
    assert.equal(host.mainCommands().length - before, 1);
    assert.equal(host.reports.length, 1);
    const attempt = host.reports[0]!.dispatch.attempts[0]!;
    assert.equal(attempt.outcome, effect === "unacted" ? "failed_unacted" : "uncertain");
    assert.equal(attempt.receipt, host.receipts.filter((entry) => entry.command.actionType === "web.dom.keypress").at(-1)!.result);
    assert.equal((attempt.receipt as { status: string }).status, "failed");
    if (effect === "ambiguous") assert.equal(result.resultReason, "outcome_uncertain");
  }
});

test("effect-check settlement excludes its auxiliary receipt and preserves the main's actual failed reply", async () => {
  const parameters = ENTER_CALL.parameters as JsonObject;
  const value: JsonObject = { node: ENTER_CALL.node!, parameters: { ...parameters, expectedState: { conditions: [{ kind: "text", expected: "Saved" }] } }, consequences: [] };
  const { host } = await prepared(value);
  const reported = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED);
  const failure = { ...reported, effect: "ambiguous" as const };
  host.answer((command) => command.actionType === "web.dom.assert" ? { status: "succeeded" } : { status: "failed", failure });
  const start = host.receipts.length;
  const result = await host.run(value);
  assert.equal(result.effectApplied, true, "the ordinary effect check settled it as landed");
  const fresh = host.receipts.slice(start);
  const main = fresh.filter((entry) => entry.command.actionType === "web.dom.keypress");
  const checks = fresh.filter((entry) => entry.command.actionType === "web.dom.assert");
  assert.equal(main.length, 1);
  assert.equal(checks.length, 1);
  assert.equal(host.reports.length, 1);
  const dispatch = host.reports[0]!.dispatch;
  assert.equal(dispatch.attempts.length, 1);
  assert.equal(dispatch.attempts[0]!.receipt, main[0]!.result);
  assert.notEqual(dispatch.attempts[0]!.receipt, checks[0]!.result);
  assert.equal(dispatch.attempts[0]!.outcome, "uncertain");
  assert.equal(main[0]!.result.status, "failed");
});

test("permission and consume holds report no main despite their auxiliary reads", async () => {
  for (const hold of ["permission", "consume", "scope"] as const) {
    const { host, value } = await prepared();
    const before = host.mainCommands().length;
    if (hold === "consume") host.refuseConsumption();
    if (hold === "scope") host.document(999);
    const result = await host.run(value, hold === "permission" ? { permission: async () => ({ permitted: false, missing: [], requestId: "request.one" }) } : {});
    assert.equal(result.effectApplied, false, hold);
    assert.equal(host.mainCommands().length, before, hold);
    assert.equal(host.reports.length, 0, hold);
  }
});

test("foreign and JSON-shaped capsules cannot mint a fresh dispatch report", async () => {
  for (const forged of ["foreign", "json"] as const) {
    const { host, original, value } = await prepared();
    host.select(original, forged === "json" ? JSON.parse(JSON.stringify(original.capsule)) as object : {});
    const before = host.commands.length;
    const result = await host.run(value);
    assert.equal(result.effectApplied, false);
    assert.equal(host.commands.length, before);
    assert.equal(host.consumeCalls, 0);
    assert.equal(host.reports.length, 0);
  }
});

test("selected observation reports only its current main read, excluding the scope guard", async () => {
  const host = frozenHarness();
  const value = { node: SNAPSHOT, parameters: {}, consequences: [] };
  await host.run(value);
  const original = host.snapshots.at(-1)!;
  host.select(original);
  const before = host.receipts.length;
  const result = await host.run(value);
  assert.equal(result.resultCode, "web.inspect.succeeded");
  const fresh = host.receipts.slice(before);
  assert.equal(fresh.length, 2);
  assert.equal(host.reports.length, 1);
  const dispatch = host.reports[0]!.dispatch;
  assert.equal(dispatch.attempts.length, 1);
  assert.equal(dispatch.attempts[0]!.receipt, fresh[1]!.result);
  assert.notEqual(dispatch.attempts[0]!.receipt, fresh[0]!.result);
  assert.notEqual(dispatch.attempts[0]!.receipt, original.dispatch.attempts[0]!.receipt);
  assert.equal(host.snapshots.length, 1);
});

test("missing hook or final observation leaves fresh proof absent without repeating the completed action", async () => {
  for (const missing of ["hook", "observation"] as const) {
    const { host, value } = await prepared();
    if (missing === "hook") host.reporting("absent");
    else host.omitFinalObservation();
    const before = host.mainCommands().length;
    const result = await host.run(value);
    assert.equal(result.resultCode, "web.action.succeeded");
    assert.equal(host.mainCommands().length - before, 1);
    assert.equal(host.reports.length, 0);
  }
});

test("a rejected or throwing report preserves the actual result and never falls back or repeats", async () => {
  for (const mode of ["refused", "throws"] as const) {
    const { host, value } = await prepared();
    host.reporting(mode);
    const before = host.mainCommands().length;
    const result = await host.run(value);
    assert.equal(result.resultCode, "web.action.succeeded");
    assert.equal(host.mainCommands().length - before, 1);
    assert.equal(host.reports.length, 1);
    assert.equal(host.reports[0]!.dispatch.attempts[0]!.receipt, host.receipts.filter((entry) => entry.command.actionType === "web.dom.type").at(-1)!.result);
    assert.equal(host.snapshots.length, 2);
  }
});

test("an unavailable acknowledgement never manufactures a main receipt", async () => {
  const { host, value } = await prepared(ENTER_CALL);
  host.answer(() => { throw new Error("private acknowledgement missing"); });
  const before = host.mainCommands().length;
  const result = await host.run(value);
  assert.equal(result.effectApplied, false);
  assert.equal(host.mainCommands().length - before, 1);
  assert.equal(host.reports.length, 0);
  assert.doesNotMatch(JSON.stringify(result), /private acknowledgement/u);
});

test("an actual unknown reply remains a fresh unknown receipt, never a synthesized success", async () => {
  const { host, value } = await prepared(ENTER_CALL);
  host.answer(() => ({ status: "unknown" }));
  const result = await host.run(value);
  assert.equal(result.effectApplied, false);
  assert.equal(host.reports.length, 1);
  assert.equal(host.reports[0]!.dispatch.attempts[0]!.outcome, "unknown");
  assert.equal(host.reports[0]!.dispatch.attempts[0]!.receipt, host.receipts.filter((entry) => entry.command.actionType === "web.dom.keypress").at(-1)!.result);
});

test("a finalized selected transaction cannot consume or dispatch late", async () => {
  const { host, value } = await prepared();
  const selection = host.binding.select(host.asRun(value));
  assert.equal(selection.kind, "selected");
  if (selection.kind !== "selected") return;
  const before = host.commands.length;
  assert.deepEqual(selection.finish(), { kind: "unavailable", reason: "capsule_unconsumed" });
  assert.deepEqual(selection.finish(), { kind: "unavailable", reason: "report_closed" });
  assert.equal(selection.consume(), false);
  await assert.rejects(selection.capture.dispatch(selection.call.command, () => host.base.gateway.executeAction("session.one", selection.call.command)), /selected main dispatch is unavailable/u);
  assert.equal(host.commands.length, before);
  assert.equal(host.reports.length, 0);
});
