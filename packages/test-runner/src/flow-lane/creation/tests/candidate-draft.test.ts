import assert from "node:assert/strict";
import test from "node:test";
import { createdFlowCandidateDraft } from "../candidate-draft.js";
const candidate = { status: "draft", projectId: "project", flowId: "flow", candidateId: "candidate", revision: 1, digest: "a".repeat(64), sourceInstructionIds: ["instruction"], baseDependencyDigest: "base", baseSettingsRevision: 0, verification: "not_performed", promotionAllowed: false, accounting: { requestId: "request", estimatedInputTokens: 10 } };
test("actual draft wire is retained as unverified authoring for its original Lab subject", () => {
  const read = createdFlowCandidateDraft({ candidate }, { projectId: "project", flowId: "flow" });
  assert.equal(read?.candidateId, "candidate"); assert.equal(read?.verification, "not_performed"); assert.equal(read?.promotionAllowed, false);
  assert.equal(createdFlowCandidateDraft({ candidate }, { projectId: "foreign", flowId: "flow" }), null);
  assert.equal(createdFlowCandidateDraft({ adaptation: { status: "proposed" } }, { projectId: "project", flowId: "flow" }), null);
});
