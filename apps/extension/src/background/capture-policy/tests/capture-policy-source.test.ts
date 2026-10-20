import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY } from "fluxiq/automation-studio/nodes";
import type { PanelRelayResponse } from "../../../shared/protocol";
import { CapturePolicySource } from "../capture-policy-source";

const strict = {
  captureInputValues: { allowed: false, default: false },
  captureSnapshots: { allowed: true, default: true },
  captureMutations: { allowed: true, default: true },
  directRequests: { allowed: false }
};

function source(replies: Array<PanelRelayResponse | Error>, projectId: string | null | undefined = "p-1") {
  const calls: Array<{ endpoint: string; payload: Record<string, unknown> }> = [];
  const changes: unknown[] = [];
  const policySource = new CapturePolicySource({
    call: async (endpoint, payload) => {
      calls.push({ endpoint, payload });
      const reply: PanelRelayResponse | Error = replies.shift() ?? { ok: false, code: "unreachable", error: "FluxIQ could not be reached." };
      if (reply instanceof Error) throw reply;
      return reply;
    },
    projectId: () => projectId,
    onChange: (policy) => changes.push(policy)
  });
  return { policySource, calls, changes };
}

test("is Core's default until Core answers, and asks Core's endpoint with the session's project", async () => {
  const { policySource, calls, changes } = source([{ ok: true, payload: { policy: strict } }]);
  assert.equal(policySource.current(), AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY);
  assert.deepEqual(await policySource.refresh(), strict);
  assert.deepEqual(policySource.current(), strict);
  assert.deepEqual(calls, [{ endpoint: "get-recording-capture-policy", payload: { projectId: "p-1" } }]);
  assert.deepEqual(changes, [strict]);
});

test("names no project when the session has none", async () => {
  const { policySource, calls } = source([], null);
  await policySource.refresh();
  assert.deepEqual(calls[0]?.payload, {});
});

test("an unreachable, refusing, throwing or malformed Core leaves the default, and later the last policy Core gave", async () => {
  const { policySource, changes } = source([
    { ok: false, code: "not_paired", error: "This browser is not paired with FluxIQ yet." },
    new Error("boom"),
    { ok: true, payload: { policy: { captureInputValues: {} } } },
    { ok: true, payload: null },
    { ok: true, payload: { policy: strict } },
    { ok: false, code: "failed", httpStatus: 404, error: "FluxIQ answered 404." }
  ]);
  for (let index = 0; index < 4; index++) assert.equal(await policySource.refresh(), AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY);
  assert.deepEqual(await policySource.refresh(), strict);
  assert.deepEqual(await policySource.refresh(), strict);
  assert.deepEqual(changes, [strict], "only a read that changed the policy is reported");
});

test("an answer equal to the default is kept but reported as no change, and a read under way is shared", async () => {
  const { policySource, calls, changes } = source([{ ok: true, payload: { policy: AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY } }]);
  const [first, second] = await Promise.all([policySource.refresh(), policySource.refresh()]);
  assert.deepEqual(first, AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY);
  assert.equal(first, second);
  assert.equal(calls.length, 1);
  assert.deepEqual(changes, []);
});
