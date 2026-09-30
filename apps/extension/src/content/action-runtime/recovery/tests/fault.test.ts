// The line between a fault absorbed and a refusal reported, and the three
// totality checks that keep it from rotting.
//
// The load-bearing rows are two. The mutation ones: a click that dispatched its
// gesture and lost the confirmation must not be pressed again, and the only thing
// standing between this loop and a second order is the classification below. And
// the pagination one: a list read is the node the audit measured eleven of
// roughly eighteen reportable live-run failures on, and whether it may be run
// again is decided by its own request rather than by its type.

import assert from "node:assert/strict";
import test from "node:test";
import {
  WEB_AUTOMATION_FAILURE_CODES,
  WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS,
  isWebAutomationFailureCode,
  type WebAutomationFailureCode
} from "@fluxiq-web-extension/domain/client";
import { RECOVERY_FAULT_BY_CODE, RECOVERY_KNOWN_ACTION_TYPES, RECOVERY_OBSTRUCTION_FAULTS, faultNeedsInterference, recoverableFault, webActionReadsOnly } from "../fault";
import type { BrowserActionCommand, BrowserActionResult } from "../../../types";

/** The two members of the command the classification reads, and nothing else. */
function command(actionType: string, extractList?: BrowserActionCommand["extractList"]): Pick<BrowserActionCommand, "actionType" | "extractList"> {
  return { actionType, ...(extractList === undefined ? {} : { extractList }) } as Pick<BrowserActionCommand, "actionType" | "extractList">;
}

function failed(actionType: string, code: WebAutomationFailureCode, actual?: string): BrowserActionResult {
  return {
    commandId: "c1",
    actionType,
    status: "failed",
    validation: { status: "failed", expected: "e", actual: "a" },
    failure: { category: "action_failed", code, retryable: true, stage: "execution", ...(actual === undefined ? {} : { actual }) },
    startedAt: 0,
    finishedAt: 1
  } as unknown as BrowserActionResult;
}

/** A list read, with and without the pagination that makes a second attempt move the page. */
const LIST = { item: ".row", fields: { name: ".name" } } as NonNullable<BrowserActionCommand["extractList"]>;
const PAGED_LIST = { ...LIST, paginate: { next: ".next" } } as NonNullable<BrowserActionCommand["extractList"]>;

test("a succeeded result is never a fault, whatever it carries", () => {
  const result = { ...failed("web.dom.click", WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND), status: "succeeded" } as BrowserActionResult;
  assert.equal(recoverableFault(result, command("web.dom.click")), undefined);
});

test("every verb absorbs a target that was not there, because nothing had been dispatched", () => {
  for (const actionType of RECOVERY_KNOWN_ACTION_TYPES) {
    assert.equal(
      recoverableFault(failed(actionType, WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND), command(actionType)),
      "target_absent",
      `${actionType} refused to wait for a target that had not been drawn yet`
    );
  }
});

test("a verb that changes the page is not retried on a fault decided after it acted", () => {
  const afterTheGesture = [
    WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED,
    WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED,
    WEB_AUTOMATION_FAILURE_CODES.TIMEOUT,
    WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED
  ];
  const mutating = ["web.dom.click", "web.dom.type", "web.dom.clear", "web.dom.select", "web.dom.check", "web.dom.keypress", "web.dom.upload", "web.dom.dialog", "web.dom.scroll"];
  for (const actionType of mutating) {
    assert.equal(webActionReadsOnly(command(actionType)), false, `${actionType} is classified as read-only`);
    for (const code of afterTheGesture) {
      assert.equal(recoverableFault(failed(actionType, code), command(actionType)), undefined, `${actionType} would be run twice on ${code}`);
    }
  }
});

test("an unpaginated list read whose post-condition did not hold is read again -- the fault eleven live runs died on", () => {
  // `minItems` defaults to 1, so a page that had not finished drawing fails the
  // read's own post-condition and reports OUTPUT_NOT_OBSERVED. Core's retry gate
  // refuses the whole `verification` stage, so before this the read got no rungs
  // at all (t163, section 2). Nothing about re-reading a page can move it.
  assert.equal(webActionReadsOnly(command("web.dom.extract_list", LIST)), true);
  assert.equal(
    recoverableFault(failed("web.dom.extract_list", WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED), command("web.dom.extract_list", LIST)),
    "output_not_observed"
  );
});

test("a paginated list read is not read again, because pressing next moved the page", () => {
  assert.equal(webActionReadsOnly(command("web.dom.extract_list", PAGED_LIST)), false);
  assert.equal(
    recoverableFault(failed("web.dom.extract_list", WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED), command("web.dom.extract_list", PAGED_LIST)),
    undefined
  );
  // Except for the one fault decided before it pressed anything.
  assert.equal(
    recoverableFault(failed("web.dom.extract_list", WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND), command("web.dom.extract_list", PAGED_LIST)),
    "target_absent"
  );
});

test("a verb that only reads absorbs every transient fault the closed set names, except the one Core waits out", () => {
  const reading = ["web.dom.capture_snapshot", "web.dom.extract", "web.dom.assert", "web.dom.wait_for_selector", "web.dom.wait_for_text"];
  for (const actionType of reading) {
    assert.equal(webActionReadsOnly(command(actionType)), true);
    assert.deepEqual(
      Object.values(WEB_AUTOMATION_FAILURE_CODES)
        .filter(isWebAutomationFailureCode)
        .filter((code) => RECOVERY_FAULT_BY_CODE[code] !== undefined)
        .filter((code) => code !== WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED)
        .map((code) => recoverableFault(failed(actionType, code), command(actionType))),
      ["target_absent", "output_not_observed", "page_changed", "timeout", "transport", "action_failed"]
    );
  }
});

test("a press the page refused as too fast is never retried by this loop, on any verb: its wait outlasts this budget and Core honours it", () => {
  assert.equal(RECOVERY_FAULT_BY_CODE[WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED], "rate_limited");
  for (const actionType of RECOVERY_KNOWN_ACTION_TYPES) {
    assert.equal(recoverableFault(failed(actionType, WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED), command(actionType)), undefined, actionType);
  }
});

test("a deterministic refusal is never retried, on any verb", () => {
  const deterministic = Object.values(WEB_AUTOMATION_FAILURE_CODES)
    .filter(isWebAutomationFailureCode)
    // The two obstruction codes are not retried either -- they are *cleared* and
    // then attempted, which is a different move and has its own rows below.
    .filter((code) => code !== WEB_AUTOMATION_FAILURE_CODES.BLOCKED_BY_DIALOG && code !== WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED)
    .filter((code) => !WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS[code].retryable);
  assert.ok(deterministic.includes(WEB_AUTOMATION_FAILURE_CODES.TARGET_AMBIGUOUS));
  assert.ok(deterministic.includes(WEB_AUTOMATION_FAILURE_CODES.INVALID_PARAMETER));
  // The permission refusal added for t163's finding 2: retried three times before
  // it had a code of its own, and the point of giving it one is that it is not.
  assert.ok(deterministic.includes(WEB_AUTOMATION_FAILURE_CODES.BROWSER_PERMISSION_DENIED));
  for (const actionType of RECOVERY_KNOWN_ACTION_TYPES) {
    for (const code of deterministic) {
      assert.equal(recoverableFault(failed(actionType, code), command(actionType)), undefined, `${actionType} retried ${code}, which cannot change`);
    }
  }
});

test("a code outside the closed set is not a fault, so a hand-written record cannot open the loop", () => {
  const result = failed("web.dom.extract", WEB_AUTOMATION_FAILURE_CODES.TIMEOUT);
  (result.failure as { code: string }).code = "web.action.made_up";
  assert.equal(recoverableFault(result, command("web.dom.extract")), undefined);
});

test("a failed result with no record at all is not a fault", () => {
  const result = failed("web.dom.extract", WEB_AUTOMATION_FAILURE_CODES.TIMEOUT);
  delete (result as { failure?: unknown }).failure;
  assert.equal(recoverableFault(result, command("web.dom.extract")), undefined);
});

test("every retryable code in the closed set has a fault word, so a new one cannot arrive unnamed", () => {
  for (const code of Object.values(WEB_AUTOMATION_FAILURE_CODES)) {
    if (!isWebAutomationFailureCode(code)) continue;
    if (!WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS[code].retryable) continue;
    assert.notEqual(RECOVERY_FAULT_BY_CODE[code], undefined, `${code} is retryable and this loop has no word for it`);
  }
});

test("every action type this build knows is decided one way or the other", () => {
  for (const actionType of RECOVERY_KNOWN_ACTION_TYPES) {
    assert.equal(typeof webActionReadsOnly(command(actionType)), "boolean");
  }
  assert.equal(webActionReadsOnly(command("web.dom.made_up")), false, "an unclassified type must default to changing the page");
});

// --- A layer standing over the target -------------------------------------
//
// The rule these rows hold the loop to: a dialog in the way is an obstacle the
// runtime clears and attempts past, never a reason to report the step as
// blocked with the effect not applied. They are the rows that fail if the
// defence is taken out, because without the classification below the loop never
// reaches `interference/clear.ts` at all.

test("a dialog over the page is a fault for every verb, although its code is not retryable", () => {
  // `retryable` asks whether repeating the action *unchanged* can work, and the
  // answer for a dialog is rightly no. Clearing the dialog first is not a
  // repetition, which is the distinction Core's own ladder draws for the same
  // reason (`runtime/executor/recovery-ladder.ts`).
  assert.equal(WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS[WEB_AUTOMATION_FAILURE_CODES.BLOCKED_BY_DIALOG].retryable, false);
  for (const actionType of RECOVERY_KNOWN_ACTION_TYPES) {
    assert.equal(
      recoverableFault(failed(actionType, WEB_AUTOMATION_FAILURE_CODES.BLOCKED_BY_DIALOG), command(actionType)),
      "blocking_dialog",
      `${actionType} carried on with a dialog in the way instead of closing it`
    );
  }
});

test("a mutating verb absorbs it too, because the gate refused before anything was dispatched", () => {
  // The one thing that makes this safe where OUTPUT_NOT_OBSERVED is not: a
  // covered or hidden target is decided by `checkActionability`, which runs
  // before the verb touches the page, so no gesture, value, key or file has
  // happened and a second attempt cannot be a second act.
  for (const actionType of ["web.dom.click", "web.dom.type", "web.dom.upload", "web.dom.check"]) {
    assert.equal(webActionReadsOnly(command(actionType)), false);
    assert.equal(recoverableFault(failed(actionType, WEB_AUTOMATION_FAILURE_CODES.BLOCKED_BY_DIALOG), command(actionType)), "blocking_dialog");
    assert.equal(recoverableFault(failed(actionType, WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, "covered: the point 10,20 landed on div.scrim"), command(actionType)), "obstructed_target");
    assert.equal(recoverableFault(failed(actionType, WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, "hidden: the element is inert"), command(actionType)), "obstructed_target");
  }
});

test("a refusal the target made on its own account is not an obstruction, so a dispatched verb is never repeated", () => {
  // `disabled` is the row this distinction exists for. The gate produces it
  // before dispatch, but so do `actions/check.ts` after `setCheckedState` failed
  // and `actions/upload.ts` after `setInputFiles` failed -- both after the verb
  // acted. Absorbing the word would retry those.
  for (const actual of [
    "disabled: the element is disabled",
    "not_checkable: the control does not take a checked state",
    "unsupported_key: F13",
    "upload_rejected: the input refused the files",
    // A list read that resolved a field to a sensitive control refuses the whole
    // read (`extraction/field-reader.ts`). It is a rule about what may be read,
    // not a layer over the page, and a runtime that retried past it would be
    // retrying its way to a value it is forbidden to take.
    "sensitive_value: field value resolved to a sensitive control, so its value is never read",
    "dialog_override_missing: the page-world dialog override is not installed on this page"
  ]) {
    assert.equal(recoverableFault(failed("web.dom.check", WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, actual), command("web.dom.check")), undefined, actual);
  }
  // And a rejection carrying no reason at all stays a refusal rather than
  // becoming an obstruction by default.
  assert.equal(recoverableFault(failed("web.dom.click", WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED), command("web.dom.click")), undefined);
});

test("a person's challenge is never absorbed, whatever else is", () => {
  // The one refusal that must keep ending the step: a robot check, a credential
  // prompt or a payment confirmation is the person's, and a runtime that
  // retried past one would be answering it.
  for (const actionType of RECOVERY_KNOWN_ACTION_TYPES) {
    assert.equal(recoverableFault(failed(actionType, WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED), command(actionType)), undefined);
    assert.equal(recoverableFault(failed(actionType, WEB_AUTOMATION_FAILURE_CODES.AUTH_REQUIRED), command(actionType)), undefined);
  }
});

test("the obstruction faults are exactly the ones the loop acts on the page for", () => {
  const acted = (["target_absent", "output_not_observed", "page_changed", "timeout", "action_failed", "transport", "blocking_dialog", "obstructed_target"] as const)
    .filter((fault) => faultNeedsInterference(fault));
  assert.deepEqual(acted, [...RECOVERY_OBSTRUCTION_FAULTS]);
});
