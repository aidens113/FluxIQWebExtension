import assert from "node:assert/strict";
import test from "node:test";
import { applyCreatedFlowProposal } from "../review-proposal.js";
test("public Lab apply helper refuses without issuing approve or apply", async () => {
  let calls = 0;
  const control = new Proxy({}, { get: () => { calls++; throw new Error("Unexpected control access"); } });
  await assert.rejects(applyCreatedFlowProposal(control as never, { projectId: "project", flowId: "flow", adaptationId: "borrowed", authorizationPin: "fixture" }), (error: unknown) => !!error && typeof error === "object" && "details" in error && (error.details as Record<string, unknown>).code === "lab.candidate_verification_unavailable");
  assert.equal(calls, 0);
});
