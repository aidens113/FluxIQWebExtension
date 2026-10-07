import assert from "node:assert/strict";
import test from "node:test";
import { applyCreatedFlowProposal } from "../review-proposal.js";

test("public Lab apply helper refuses in candidate mode without issuing approve or apply", async () => {
  let calls = 0;
  const control = new Proxy({}, { get: () => { calls++; throw new Error("Unexpected control access"); } });
  await assert.rejects(applyCreatedFlowProposal(control as never, { projectId: "project", flowId: "flow", adaptationId: "borrowed", authorizationPin: "fixture", authoringMode: "candidate" }), (error: unknown) => !!error && typeof error === "object" && "details" in error && (error.details as Record<string, unknown>).code === "lab.candidate_verification_unavailable");
  assert.equal(calls, 0);
});

test("in legacy mode it approves, then applies, sending exactly the review fields", async () => {
  const sent: Array<{ action: string; input: Record<string, unknown> }> = [];
  const control = {
    approveFlowAdaptation: async (input: Record<string, unknown>) => { sent.push({ action: "approve", input }); return { adaptationId: "adaptation", status: "validated" }; },
    applyFlowAdaptation: async (input: Record<string, unknown>) => { sent.push({ action: "apply", input }); return { adaptationId: "adaptation", status: "applied", appliedMutationCount: 3 }; },
  };
  const review = await applyCreatedFlowProposal(control as never, { projectId: "project", flowId: "flow", adaptationId: "adaptation", authorizationPin: "fixture", authoringMode: "legacy" });
  assert.deepEqual(review, { adaptationId: "adaptation", appliedMutationCount: 3 });
  const fields = { projectId: "project", flowId: "flow", adaptationId: "adaptation", authorizationPin: "fixture" };
  assert.deepEqual(sent, [{ action: "approve", input: fields }, { action: "apply", input: fields }]);
});
