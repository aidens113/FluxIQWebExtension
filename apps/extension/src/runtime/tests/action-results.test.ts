// T1 coverage of action-results.ts: the result a worker-side action reports and
// the failure records that go with it. The load-bearing assertion is that every
// record survives Core's parser -- it drops a record whole rather than
// repairing it, so a category paired with the wrong stage or retryability would
// lose the failure entirely instead of reporting it.

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH } from "@fluxiq-web-extension/domain/client";
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
    workerTimeoutFailure("web.download.timeout", "a completed download", "none within 30000 ms"),
    workerBlockedFailure("web.page.unsupported", { expected: "an automatable page", actual: "chrome://extensions" }),
    workerBlockedFailure("web.download.permission_missing"),
    workerTargetNotFoundFailure("web.tab.no_match", "tab 11 active", "no open tab matched"),
    workerActionFailedFailure("web.tab.failed", "tab close to succeed", "No tab with id 11.")
  ];
  for (const record of records) {
    assert.deepEqual(parseAutomationStudioFailureRecord(record), record, record.code);
  }
});

test("each category is paired with the stage and retryability Core's consistency rules demand", () => {
  // A blocked action can never be retried unchanged, and Core allows
  // target_not_found only at target resolution. Getting either wrong makes the
  // parser return null, which is why they are asserted rather than assumed.
  const blocked = workerBlockedFailure("web.page.unsupported");
  assert.equal(blocked.category, "blocked_by_capability_or_policy");
  assert.equal(blocked.retryable, false);
  const notFound = workerTargetNotFoundFailure("web.tab.no_match", "tab 11", "none");
  assert.equal(notFound.stage, "target_resolution");
  assert.equal(navigationUnexpectedFailure("a", "b").category, "navigation_unexpected");
  assert.equal(workerTimeoutFailure("web.download.timeout", "a", "b").category, "timeout");
});
