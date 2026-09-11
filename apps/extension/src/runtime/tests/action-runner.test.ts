// T1 coverage of the pure part of action-runner.ts: the failed result the
// runtime reports when an action cannot run. Resolving and driving a tab needs
// the chrome tabs API, which this Node runner does not provide.

import assert from "node:assert/strict";
import { test } from "node:test";
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
      validation: { status: "none", reason: "not-yet-validated" },
      message: "Browser and extension pages cannot be automated.",
      startedAt: 9_000,
      finishedAt: 9_000
    }
  );
});
