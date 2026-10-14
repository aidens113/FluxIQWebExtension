// The host lease as the browser reads and judges it, and the refusal it sends
// for a command whose lease moved (automation-project-agents plan).

import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import {
  WEB_AUTOMATION_HOST_LEASE_REFUSAL_CODES,
  webAutomationHostLeaseJudgement,
  webAutomationHostLeaseReading,
  webAutomationHostLeaseRefusal,
  webAutomationHostLeaseRefusalCode,
  type WebAutomationHostLease
} from "..";

const lease = (epoch: number, briefId = "brief-1"): WebAutomationHostLease => ({ resourceKey: "web.automation:client-a", epoch, holder: { role: "builder", briefId } });

test("a command's lease is read field by field: none, a lease, or one that cannot be read", () => {
  assert.deepEqual(webAutomationHostLeaseReading(undefined), { kind: "none" });
  assert.deepEqual(
    webAutomationHostLeaseReading({ ...lease(4), extra: "dropped", holder: { role: "builder", briefId: "brief-1", note: "dropped" } }),
    { kind: "lease", lease: lease(4) }
  );
  for (const unreadable of [
    null,
    "lease",
    [],
    { epoch: 4, holder: { role: "builder", briefId: "b" } },
    { resourceKey: "", epoch: 4, holder: { role: "builder", briefId: "b" } },
    { resourceKey: "k", epoch: 4.5, holder: { role: "builder", briefId: "b" } },
    { resourceKey: "k", epoch: -1, holder: { role: "builder", briefId: "b" } },
    { resourceKey: "k", epoch: 4 },
    { resourceKey: "k", epoch: 4, holder: { role: "builder" } },
    { resourceKey: "k", epoch: 4, holder: { role: "", briefId: "b" } }
  ]) {
    assert.deepEqual(webAutomationHostLeaseReading(unreadable), { kind: "unreadable" }, JSON.stringify(unreadable));
  }
});

test("a higher epoch is adopted, the same one and holder is current, a lower one is stale, another holder is a mismatch", () => {
  assert.equal(webAutomationHostLeaseJudgement(lease(4), undefined), "adopt");
  assert.equal(webAutomationHostLeaseJudgement(lease(5, "brief-2"), lease(4)), "adopt");
  assert.equal(webAutomationHostLeaseJudgement(lease(4), lease(4)), "current");
  assert.equal(webAutomationHostLeaseJudgement(lease(3), lease(4)), "stale");
  assert.equal(webAutomationHostLeaseJudgement(lease(4, "brief-2"), lease(4)), "holder_mismatch");
  assert.equal(webAutomationHostLeaseRefusalCode("adopt"), undefined);
  assert.equal(webAutomationHostLeaseRefusalCode("current"), undefined);
  assert.equal(webAutomationHostLeaseRefusalCode("stale"), "host_lease.stale");
  assert.equal(webAutomationHostLeaseRefusalCode("holder_mismatch"), "host_lease.holder_mismatch");
});

test("the refusal is a failed result that did nothing and is not retried as sent", () => {
  const refusal = webAutomationHostLeaseRefusal("cmd-1", WEB_AUTOMATION_HOST_LEASE_REFUSAL_CODES.stale, 1_000, 7);
  assert.deepEqual(refusal, {
    commandId: "cmd-1",
    status: "failed",
    startedAt: 1_000,
    completedAt: 1_000,
    message: "The command was issued under a host lease that has since been granted again, so the browser did not act on it.",
    error: "The command was issued under a host lease that has since been granted again, so the browser did not act on it.",
    failure: {
      category: "blocked_by_capability_or_policy",
      code: "host_lease.stale",
      retryable: false,
      stage: "dispatch",
      expected: "a command issued under the current host lease",
      actual: "The command was issued under a host lease that has since been granted again, so the browser did not act on it. The browser has seen epoch 7 for this resource.",
      effect: "unacted"
    },
    payload: { commandId: "cmd-1", status: "refused", code: "host_lease.stale" }
  });
  // Core keeps a client's failure only when its own parser accepts it.
  for (const code of Object.values(WEB_AUTOMATION_HOST_LEASE_REFUSAL_CODES)) {
    const failure = webAutomationHostLeaseRefusal("cmd-1", code, 1_000).failure;
    assert.deepEqual(parseAutomationStudioFailureRecord(failure), failure, code);
  }
});
