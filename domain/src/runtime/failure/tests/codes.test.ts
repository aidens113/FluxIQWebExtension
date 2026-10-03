// T1 coverage of the closed failure-code set.
//
// The table below is the contract the other Wave 3 briefs quote, restated
// independently of `codes.ts` so a silent edit to a category, a retryable flag
// or a stage fails here rather than reaching the wire. Every row is then run
// through Core's own parser: a record Core would drop is a failure that never
// gets reported, which is the whole defect this taxonomy exists to close.

import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES,
  AUTOMATION_STUDIO_FAILURE_RECORD_LIMITS,
  buildAutomationStudioRuntimeDeterministicDiagnosis,
  parseAutomationStudioFailureRecord,
  type AutomationStudioNodeAttemptTrace
} from "fluxiq/automation-studio";
import { WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH } from "../../../actions/types";
import {
  WEB_AUTOMATION_FAILURE_CODES,
  WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS,
  WEB_AUTOMATION_RETRY_AFTER_MAX_MS,
  isWebAutomationFailureCode,
  webAutomationFailureRecord,
  type WebAutomationFailureCode,
  type WebAutomationFailureRecord
} from "../codes";

// [vocabulary name, wire code, category, retryable, stage]
const CODE_TABLE: ReadonlyArray<readonly [string, string, string, boolean, string]> = [
  ["ACTION_REJECTED", "web.action.rejected", "blocked_by_capability_or_policy", false, "execution"],
  ["TARGET_NOT_ACTIONABLE", "web.target.not_actionable", "unexpected_state", false, "execution"],
  // t193 (2026-10-02): a target in the DOM and not shown -- the gate's `hidden`
  // reason. Core's `target_not_found`, so a Flow run routes by page state or
  // takes the step's sometimes-present skip instead of the recovery ladder.
  ["TARGET_NOT_SHOWN", "web.target.not_shown", "target_not_found", true, "target_resolution"],
  ["TARGET_NOT_FOUND", "web.target.not_found", "target_not_found", true, "target_resolution"],
  ["TARGET_AMBIGUOUS", "web.target.ambiguous", "target_ambiguous", false, "target_resolution"],
  ["OUTPUT_NOT_OBSERVED", "web.validation.output_not_observed", "output_not_observed", true, "verification"],
  ["STATE_MISMATCH", "web.validation.state_mismatch", "unexpected_state", false, "verification"],
  ["NAVIGATION_UNEXPECTED", "web.navigation.unexpected", "navigation_unexpected", false, "confirmation"],
  ["PAGE_CHANGED", "web.page.changed", "page_changed", true, "execution"],
  ["TIMEOUT", "web.action.timeout", "timeout", true, "execution"],
  ["AUTH_REQUIRED", "web.auth.required", "auth_required", false, "confirmation"],
  ["USER_INTERVENTION_REQUIRED", "web.intervention.required", "user_intervention_required", false, "execution"],
  ["BLOCKED_BY_DIALOG", "web.action.blocked_by_dialog", "unexpected_state", false, "execution"],
  // t195: a press the page refused as "too fast" and said so. Retryable, and the
  // one row that states the act did not happen (`UNACTED` below).
  ["RATE_LIMITED", "web.action.rate_limited", "action_failed", true, "execution"],
  // t174 F40: a press the page answered with "Please select a Color." beside it
  // and nothing done. The page's state, not retryable, and unacted.
  ["REFUSED_BY_PAGE", "web.action.refused_by_page", "unexpected_state", false, "execution"],
  // t163's finding 2. A manifest-permission refusal reported as the retryable
  // `web.action.failed` cost run-muht9lpw-a39aa056 three attempts and then the
  // run, so the refusal has its own non-retryable row and the dead channel it
  // used to be confused with has its own retryable one.
  ["BROWSER_PERMISSION_DENIED", "web.browser.permission_denied", "blocked_by_capability_or_policy", false, "dispatch"],
  ["TRANSPORT_TRANSIENT", "web.transport.transient", "action_failed", true, "execution"],
  ["UNSUPPORTED_TYPE", "web.action.unsupported_type", "blocked_by_capability_or_policy", false, "dispatch"],
  ["NOT_IMPLEMENTED", "web.action.not_implemented", "blocked_by_capability_or_policy", false, "dispatch"],
  ["INVALID_PARAMETER", "web.action.invalid_parameter", "graph_validation_or_unknown_node", false, "dispatch"],
  ["ACTION_FAILED", "web.action.failed", "action_failed", true, "execution"],
  ["UNKNOWN", "web.action.unknown", "ambiguous_or_unknown", false, "execution"]
];

/** The rows whose producer can prove the act did not happen, which carry `effect: "unacted"`. Every other row states nothing. */
const UNACTED: ReadonlySet<string> = new Set(["RATE_LIMITED", "REFUSED_BY_PAGE"]);

/** A row's effect, spread onto the record the row builds. */
function effectOf(name: string): { effect?: "unacted" } {
  return UNACTED.has(name) ? { effect: "unacted" } : {};
}

const CODES = Object.values(WEB_AUTOMATION_FAILURE_CODES) as WebAutomationFailureCode[];

test("the closed set is exactly the table the briefs quote, by vocabulary name and wire code", () => {
  assert.deepEqual(Object.keys(WEB_AUTOMATION_FAILURE_CODES), CODE_TABLE.map(([name]) => name));
  assert.deepEqual(CODES, CODE_TABLE.map(([, code]) => code));
  assert.equal(new Set(CODES).size, CODES.length, "a code is used once");
  assert.deepEqual(Object.keys(WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS).sort(), [...CODES].sort(), "every code has a definition and no definition is orphaned");
  assert.equal(Object.isFrozen(WEB_AUTOMATION_FAILURE_CODES), true);
  assert.equal(Object.isFrozen(WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS), true);
});

test("each code carries the category, retryable flag and stage its row names", () => {
  for (const [name, code, category, retryable, stage] of CODE_TABLE) {
    const definition = WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS[code as WebAutomationFailureCode];
    assert.deepEqual(definition, { category, retryable, stage, ...effectOf(name) }, name);
    assert.equal(AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES.includes(definition.category), true, `${name} names a Core category`);
  }
});

test("every code builds a record Core's parser accepts unchanged, bare and with descriptions", () => {
  for (const [name, code, category, retryable, stage] of CODE_TABLE) {
    const bare = webAutomationFailureRecord(code as WebAutomationFailureCode);
    assert.deepEqual(bare, { category, code, retryable, stage, ...effectOf(name) }, name);
    assert.deepEqual(parseAutomationStudioFailureRecord(bare), bare, `${name} survives Core's parser`);

    const described = webAutomationFailureRecord(code as WebAutomationFailureCode, { expected: "the saved banner", actual: "the form is still open" });
    assert.deepEqual(described, { category, code, retryable, stage, expected: "the saved banner", actual: "the form is still open", ...effectOf(name) }, name);
    assert.deepEqual(parseAutomationStudioFailureRecord(described), described, `${name} survives Core's parser with descriptions`);
  }
});

test("the text bound is Core's own, and an over-long description is shortened rather than losing the record", () => {
  assert.equal(WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH, AUTOMATION_STUDIO_FAILURE_RECORD_LIMITS.textMaxLength);
  const record = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, { actual: "x".repeat(5_000) });
  assert.equal(record.actual?.length, WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH);
  assert.equal(record.actual?.endsWith("…"), true);
  assert.deepEqual(parseAutomationStudioFailureRecord(record), record);
});

test("a description that says nothing is dropped, and whitespace is collapsed to one line", () => {
  const empty = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, { expected: "   ", actual: "\n\t " });
  assert.equal("expected" in empty, false, "the parser rejects an empty string, so the field is omitted");
  assert.equal("actual" in empty, false);
  assert.deepEqual(parseAutomationStudioFailureRecord(empty), empty);
  const collapsed = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, { actual: "  no element\n  matched  " });
  assert.equal(collapsed.actual, "no element matched");
});

test("an evidence digest is kept only in the shape Core accepts", () => {
  const digest = "a".repeat(64);
  const kept = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, { evidenceDigest: digest });
  assert.equal(kept.evidenceDigest, digest);
  assert.deepEqual(parseAutomationStudioFailureRecord(kept), kept);
  const dropped = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, { evidenceDigest: "NOT-A-DIGEST" });
  assert.equal("evidenceDigest" in dropped, false, "one lost optional field beats a record Core discards whole");
  assert.deepEqual(parseAutomationStudioFailureRecord(dropped), dropped);
});

test("a press the page refused as too fast maps to a retryable, unacted record carrying the page's wait, and Core keeps all of it", () => {
  const record = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED, {
    expected: "the page accepts the press",
    actual: "the page answered the press with a notice that it was refused for going too fast",
    retryAfterMs: 12_500.4
  });
  assert.deepEqual(record, {
    category: "action_failed",
    code: "web.action.rate_limited",
    retryable: true,
    stage: "execution",
    expected: "the page accepts the press",
    actual: "the page answered the press with a notice that it was refused for going too fast",
    effect: "unacted",
    retryAfterMs: 12_500
  });
  assert.deepEqual(parseAutomationStudioFailureRecord(record), record, "Core's parser keeps the effect and the wait");
});

test("a wait is kept only where Core accepts one: on a retryable code, readable, and within Core's bound", () => {
  assert.equal(WEB_AUTOMATION_RETRY_AFTER_MAX_MS, AUTOMATION_STUDIO_FAILURE_RECORD_LIMITS.retryAfterMsMax);
  const refused = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.BLOCKED_BY_DIALOG, { retryAfterMs: 5_000 });
  assert.equal("retryAfterMs" in refused, false, "a wait on a code that is not retryable would make Core drop the record");
  assert.deepEqual(parseAutomationStudioFailureRecord(refused), refused);
  for (const unreadable of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal("retryAfterMs" in webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED, { retryAfterMs: unreadable }), false, String(unreadable));
  }
  const held = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED, { retryAfterMs: 10 * WEB_AUTOMATION_RETRY_AFTER_MAX_MS });
  assert.equal(held.retryAfterMs, WEB_AUTOMATION_RETRY_AFTER_MAX_MS);
  assert.deepEqual(parseAutomationStudioFailureRecord(held), held);
});

test("a record written out by hand with a code outside the set does not compile", () => {
  // The invariant, pinned. `webAutomationFailureRecord` checked its argument
  // against the set and then returned Core's record, whose `code` is a bare
  // `string` -- so the check was discarded one line after it was made, and a
  // record written out at a call site compiled with any string at all. Four
  // workers reported out-of-set codes reaching the wire while every gate
  // passed; `WebAutomationFailureRecord` is what closes that, and this row is
  // what keeps it closed.
  //
  // `@ts-expect-error` is the assertion: if this literal ever compiles again,
  // the narrowing has been widened and `check` fails here, rather than a Flow
  // meeting a code nothing downstream can act on. The runtime guard is
  // asserted beside it because the two answer different questions -- the
  // compiler speaks for values written in this build, and
  // `isWebAutomationFailureCode` for a record that crossed a process boundary.
  const handBuilt: WebAutomationFailureRecord = {
    category: "unexpected_state",
    // @ts-expect-error - "web.assert.state_mismatch" is not one of the closed set's codes
    code: "web.assert.state_mismatch",
    retryable: false,
    stage: "verification"
  };
  assert.equal(isWebAutomationFailureCode(handBuilt.code), false, "the runtime guard agrees with the compiler");
});

test("the guard admits every code and nothing else", () => {
  for (const code of CODES) assert.equal(isWebAutomationFailureCode(code), true, code);
  for (const outside of ["web.action.rejected ", "WEB.ACTION.REJECTED", "web.target.missing", "", "toString", undefined, null, 7]) {
    assert.equal(isWebAutomationFailureCode(outside), false, JSON.stringify(outside));
  }
});

test("a dialog in the way reaches the model under Core's own diagnosis, and a challenge never does", () => {
  // The line `content/action-runtime/blocking-dialog.ts` draws is only worth
  // drawing if Core routes the two codes apart. Live on 2026-09-21 a promotion
  // with its own "Not now" was reported as USER_INTERVENTION_REQUIRED, and
  // Core, rightly for that category, refused to ask the model how to get past
  // it. So the pair is asserted through Core's real Stage A diagnosis, not
  // restated from its current table.
  const diagnose = (code: WebAutomationFailureCode) => {
    const failedAttempt: AutomationStudioNodeAttemptTrace = {
      attemptId: "node.press.attempt.1",
      nodeId: "node.press",
      definitionId: "web.dom.click",
      startedAt: 1,
      finishedAt: 2,
      status: "failed",
      route: "failed",
      inputs: {},
      outputs: {},
      effects: [],
      message: "Action blocked.",
      failure: webAutomationFailureRecord(code, { expected: "a target that can be clicked", actual: "covered: the point landed on the scrim" })
    };
    return buildAutomationStudioRuntimeDeterministicDiagnosis({ projectId: "project.one", flowId: "flow.one", runId: "run.one", failedAttempt });
  };

  const dialog = diagnose(WEB_AUTOMATION_FAILURE_CODES.BLOCKED_BY_DIALOG);
  assert.equal(dialog.failureClass, "unexpected_state");
  assert.equal(dialog.resolution, "model_required");
  assert.equal(dialog.modelNeeded, true);

  const challenge = diagnose(WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED);
  assert.equal(challenge.failureClass, "user_intervention_required");
  assert.equal(challenge.resolution, "manual_intervention");
  assert.equal(challenge.modelNeeded, false);
  assert.equal(challenge.stillAchievable, "no");
});

test("a press the page refused for needing something first is Core's unexpected state, for the model, and is not retried", () => {
  // t174 F40: crossborder's Add to cart answered "Please select a Color." and
  // added nothing. Asserted through Core's real parser and Stage A diagnosis:
  // the page's state, a move the model (or a repair) makes -- choose the colour
  // -- and never the same press again unchanged.
  const record = webAutomationFailureRecord("web.action.refused_by_page" as WebAutomationFailureCode, {
    expected: "the page accepts the press",
    actual: "the page answered the press 4 ms after it with a line beside the control saying it needs something first, and did nothing"
  });
  assert.equal(record.retryable, false);
  assert.equal(record.effect, "unacted");
  assert.equal(record.retryAfterMs, undefined);
  assert.deepEqual(parseAutomationStudioFailureRecord(record), record);
  const diagnosis = buildAutomationStudioRuntimeDeterministicDiagnosis({
    projectId: "project.one",
    flowId: "flow.one",
    runId: "run.one",
    failedAttempt: {
      attemptId: "node.add.attempt.1",
      nodeId: "node.add",
      definitionId: "web.dom.click",
      startedAt: 1,
      finishedAt: 2,
      status: "failed",
      route: "failed",
      inputs: {},
      outputs: {},
      effects: [],
      message: "Action refused by the page: it needs something first.",
      failure: record
    }
  });
  assert.equal(diagnosis.failureClass, "unexpected_state");
  assert.equal(diagnosis.resolution, "model_required");
  assert.equal(diagnosis.modelNeeded, true);
});

test("a target the page has and does not show is Core's target_not_found, so the run routes by state; disabled and covered stay the page's unexpected state", () => {
  // Live run `run-murwdp4f-35f976d2` (cause R1-C2): a chat card's close button,
  // in the DOM and not shown until the card opens, failed as
  // `web.target.not_actionable` (`unexpected_state`), so the step never routed
  // by state or took its sometimes-present skip -- Core does both only for
  // `target_not_found` (`R/executor/state-routing/could-not-run.ts`).
  const hidden = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_SHOWN, { actual: "hidden: the element's display is none" });
  assert.deepEqual(hidden, { category: "target_not_found", code: "web.target.not_shown", retryable: true, stage: "target_resolution", actual: "hidden: the element's display is none" });
  assert.deepEqual(parseAutomationStudioFailureRecord({ ...hidden, effect: "unacted" }), { ...hidden, effect: "unacted" }, "the gate's unacted statement survives Core's parser");
  const actionable = WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS[WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_ACTIONABLE];
  assert.deepEqual(actionable, { category: "unexpected_state", retryable: false, stage: "execution" }, "disabled and covered are unchanged");
});
