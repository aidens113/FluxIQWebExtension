// T1 coverage of the pure part of action-runner.ts: the failed result the
// runtime reports when an action cannot run. Resolving and driving a tab needs
// the chrome tabs API, which this Node runner does not provide; the decisions
// the runner makes around it are covered where they live -- command-options,
// navigation-outcome, and unsupported-page.

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { browserActionFailure } from "../action-runner";

test("a failure is reported against its command, finished the moment it started", (t) => {
  t.mock.method(Date, "now", () => 9_000);
  assert.deepEqual(
    browserActionFailure(
      { commandId: "c-9", actionType: "web.dom.click", selector: "#buy", tabId: 4 },
      "Browser and extension pages cannot be automated."
    ),
    {
      commandId: "c-9",
      actionType: "web.dom.click",
      status: "failed",
      // The action never ran, so its post-condition did not hold: the failure
      // is stated as a comparison rather than left as "not yet validated".
      validation: {
        status: "failed",
        expected: "the action to run",
        actual: "Browser and extension pages cannot be automated."
      },
      message: "Browser and extension pages cannot be automated.",
      failure: {
        category: "action_failed",
        code: "web.action.failed",
        retryable: true,
        stage: "execution",
        expected: "the action to run",
        actual: "Browser and extension pages cannot be automated."
      },
      startedAt: 9_000,
      finishedAt: 9_000
    }
  );
});

test("the failure it reports survives Core's parser, which drops a record it refuses", () => {
  const result = browserActionFailure({ commandId: "c-9", actionType: "web.dom.click" }, "Runtime action failed.");
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure);
});
