import assert from "node:assert/strict";
import test from "node:test";
import type { AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { RecoverableToolRejection } from "..";
import { RecoverableToolRejection as ExistingImport } from "../../tool-rejection";

test("a refusal projects optional failure controls before it can be thrown or serialized", () => {
  const original: AutomationStudioFailureRecord = {
    category: "action_failed", code: "host.temporary", retryable: true, stage: "execution", effect: "unacted", transient: true,
    expected: "private expected", actual: "private actual", evidenceDigest: "a".repeat(64)
  };
  const rejection = new RecoverableToolRejection("page_unreadable", undefined, undefined, true, original);
  assert.ok(rejection instanceof ExistingImport);
  assert.equal(rejection.personNeeded, true);
  assert.deepEqual(rejection.failure, {
    category: "action_failed", code: "host.temporary", retryable: true, stage: "execution", effect: "unacted", transient: true
  });
  assert.equal(original.expected, "private expected");
  assert.doesNotMatch(JSON.stringify(rejection), /private|a{64}/u);
});

test("malformed optional controls preserve the refusal and its actual flags", () => {
  const rejection = new RecoverableToolRejection("needs_person", undefined, undefined, true, { transient: false });
  assert.equal(rejection.code, "needs_person");
  assert.equal(rejection.message, "needs_person");
  assert.equal(rejection.personNeeded, true);
  assert.equal(rejection.failure, undefined);
});
