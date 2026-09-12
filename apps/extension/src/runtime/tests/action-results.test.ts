// T1 coverage of action-results.ts: the result a worker-side action reports and
// the failure records that go with it. The load-bearing assertion is that every
// record survives Core's parser -- it drops a record whole rather than
// repairing it, so a category paired with the wrong stage or retryability would
// lose the failure entirely instead of reporting it.

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import {
  WEB_AUTOMATION_FAILURE_CODES,
  WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH,
  isWebAutomationFailureCode
} from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand } from "../../shared/protocol";
import {
  boundWorkerValidation,
  navigationUnexpectedFailure,
  workerActionFailedFailure,
  workerActionResult,
  workerBlockedFailure,
  workerTargetNotFoundFailure,
  workerTimeoutFailure
} from "../action-results";

const action: BrowserActionCommand = { commandId: "cmd-1", actionType: "web.browser.navigate" };

test("a result is reported against its command, with the validation that decided it", (t) => {
  t.mock.method(Date, "now", () => 5_000);
  assert.deepEqual(
    workerActionResult(action, 4_000, {
      status: "succeeded",
      message: "Navigation completed.",
      validation: { status: "passed", expected: "https://example.test/", actual: "https://example.test/" },
      url: "https://example.test/"
    }),
    {
      commandId: "cmd-1",
      actionType: "web.browser.navigate",
      status: "succeeded",
      validation: { status: "passed", expected: "https://example.test/", actual: "https://example.test/" },
      message: "Navigation completed.",
      url: "https://example.test/",
      startedAt: 4_000,
      finishedAt: 5_000
    }
  );
});

test("a failure record and the command's visual target ride along when there are any", (t) => {
  t.mock.method(Date, "now", () => 5_000);
  const visualTarget = { namespace: "web" as const, statePath: "web.elements.custom", selector: "#buy" };
  const failure = navigationUnexpectedFailure("https://example.test/dashboard", "https://example.test/login");
  const result = workerActionResult({ ...action, visualTarget }, 4_000, {
    status: "failed",
    message: "Navigation landed elsewhere.",
    validation: { status: "failed", expected: "https://example.test/dashboard", actual: "https://example.test/login" },
    failure
  });
  assert.deepEqual(result.failure, failure);
  assert.deepEqual(result.visualTarget, visualTarget);
  assert.equal(result.status, "failed");
});

test("validation text is collapsed, bounded, and never empty", () => {
  assert.deepEqual(
    boundWorkerValidation({ status: "failed", expected: "  two   words\n", actual: "" }),
    { status: "failed", expected: "two words", actual: "(none)" }
  );
  const long = "x".repeat(WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH + 500);
  const bounded = boundWorkerValidation({ status: "passed", expected: long, actual: long });
  assert.equal(bounded.status === "passed" && bounded.expected.length, WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH);
  // A skipped validation has no text to bound and passes through untouched.
  assert.deepEqual(
    boundWorkerValidation({ status: "none", reason: "not-yet-validated" }),
    { status: "none", reason: "not-yet-validated" }
  );
});

test("every failure this module builds survives Core's parser whole", () => {
  const records = [
    navigationUnexpectedFailure("https://example.test/dashboard", "https://example.test/login"),
    workerTimeoutFailure(WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, "a completed download", "none within 30000 ms"),
    workerBlockedFailure(WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, { expected: "an automatable page", actual: "chrome://extensions" }),
    workerBlockedFailure(WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED),
    workerTargetNotFoundFailure(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, "tab 11 active", "no open tab matched"),
    workerActionFailedFailure(WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, "tab close to succeed", "No tab with id 11.")
  ];
  for (const record of records) {
    assert.deepEqual(parseAutomationStudioFailureRecord(record), record, record.code);
  }
});

test("every builder takes its code from the closed set, so no call site can invent one", () => {
  // The `code` parameter is `WebAutomationFailureCode`, not `string`. That is
  // what a test cannot show -- an out-of-set string is a compile error, not a
  // failing assertion -- so what is asserted here is the consequence: whatever
  // a call site passes is a member of the set, and the guard agrees.
  const codes = [
    workerTimeoutFailure(WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, "a", "b").code,
    workerBlockedFailure(WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED).code,
    workerTargetNotFoundFailure(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, "a", "b").code,
    workerActionFailedFailure(WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, "a", "b").code
  ];
  for (const code of codes) assert.ok(isWebAutomationFailureCode(code), code);
  // The eight strings the three callers used to pass, none of them nameable by
  // a consumer deriving its vocabulary from the domain.
  for (const retired of [
    "web.page.unsupported",
    "web.download.permission_missing",
    "web.download.timeout",
    "web.tab.invalid_request",
    "web.tab.failed",
    "web.tab.no_id",
    "web.tab.no_match",
    "web.tab.no_target",
    "web.tab.not_closed"
  ]) {
    assert.equal(isWebAutomationFailureCode(retired), false, retired);
  }
});

test("a builder's record is the code's row in the table, not the call site's opinion", () => {
  // Whole records, because the point of narrowing the parameter is that the
  // category, the retryable flag and the stage stop being written at the call
  // site. Two rows moved when the set decided them, and both are asserted here
  // rather than left to be noticed downstream.
  assert.deepEqual(workerTimeoutFailure(WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, "a completed download", "none within 1000 ms"), {
    category: "timeout",
    code: "web.action.timeout",
    retryable: true,
    stage: "execution",
    expected: "a completed download",
    actual: "none within 1000 ms"
  });
  assert.deepEqual(workerBlockedFailure(WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, { expected: "an automatable page", actual: "chrome://extensions" }), {
    category: "blocked_by_capability_or_policy",
    code: "web.action.rejected",
    retryable: false,
    // Moved from `dispatch`: the set binds one stage to a code, and a refusal
    // is `execution` there. The category and retryability, which are what Core
    // acts on, are unchanged.
    stage: "execution",
    expected: "an automatable page",
    actual: "chrome://extensions"
  });
  assert.deepEqual(workerTargetNotFoundFailure(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, "tab 11 active", "no open tab matched"), {
    category: "target_not_found",
    code: "web.target.not_found",
    retryable: true,
    stage: "target_resolution",
    expected: "tab 11 active",
    actual: "no open tab matched"
  });
  assert.deepEqual(workerActionFailedFailure(WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, "tab close to succeed", "No tab with id 11."), {
    // `action_failed`, not `ambiguous_or_unknown`: the action ran, and the
    // browser said why. `UNKNOWN` means nothing said why.
    category: "action_failed",
    code: "web.action.failed",
    retryable: true,
    stage: "execution",
    expected: "tab close to succeed",
    actual: "No tab with id 11."
  });
});

test("a refusal with nothing to compare carries no empty text, which Core's parser refuses", () => {
  const blocked = workerBlockedFailure(WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED);
  assert.equal(blocked.expected, undefined);
  assert.equal(blocked.actual, undefined);
  // Text is bounded by the domain now, not by this module: collapsed to one
  // line, cut to Core's limit, and dropped rather than sent as "(none)".
  const long = workerActionFailedFailure(WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, "  two   words\n", "x".repeat(WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH + 500));
  assert.equal(long.expected, "two words");
  assert.equal(long.actual?.length, WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH);
  assert.deepEqual(parseAutomationStudioFailureRecord(long), long);
});

test("an unexpected navigation carries the closed set's code, whole", () => {
  const record = navigationUnexpectedFailure("https://example.test/dashboard", "https://example.test/login");
  // The whole record, not just the code: the point of building it from the set
  // is that the category, the stage and the retryable flag come from the code
  // rather than from whatever the call site remembered. The string this used to
  // write by hand -- `web.navigate.unexpected_url` -- was in no set at all.
  assert.deepEqual(record, {
    category: "navigation_unexpected",
    code: "web.navigation.unexpected",
    retryable: false,
    // `confirmation`, not `verification`: the navigation itself is what is
    // being confirmed, not a post-condition checked after it.
    stage: "confirmation",
    expected: "https://example.test/dashboard",
    actual: "https://example.test/login"
  });
  assert.equal(record.code, WEB_AUTOMATION_FAILURE_CODES.NAVIGATION_UNEXPECTED);
  // A code outside the closed set has no way onto the wire from here.
  assert.ok(isWebAutomationFailureCode(record.code));
});

test("an unexpected navigation still bounds its text, now to the domain's own limit", () => {
  const long = "https://example.test/".concat("x".repeat(WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH));
  const record = navigationUnexpectedFailure("  the   requested  URL\n", long);
  assert.equal(record.expected, "the requested URL");
  assert.equal(record.actual?.length, WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH);
  assert.deepEqual(parseAutomationStudioFailureRecord(record), record);
});

test("each category is paired with the stage and retryability Core's consistency rules demand", () => {
  // A blocked action can never be retried unchanged, and Core allows
  // target_not_found only at target resolution. Getting either wrong makes the
  // parser return null, which is why they are asserted rather than assumed.
  const blocked = workerBlockedFailure(WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED);
  assert.equal(blocked.category, "blocked_by_capability_or_policy");
  assert.equal(blocked.retryable, false);
  const notFound = workerTargetNotFoundFailure(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, "tab 11", "none");
  assert.equal(notFound.stage, "target_resolution");
  assert.equal(navigationUnexpectedFailure("a", "b").category, "navigation_unexpected");
  assert.equal(workerTimeoutFailure(WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, "a", "b").category, "timeout");
});
