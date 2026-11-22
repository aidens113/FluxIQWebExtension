import assert from "node:assert/strict";
import test from "node:test";
import { classifyPreflight, type PreflightEvidence } from "../index.js";

test("protocol receipts do not invent a site challenge or a missing permission/read", () => {
  const input: PreflightEvidence = { scenarioId: "auction-marketplace", source: { core: "core", extension: "extension" }, stages: ["pairing", "chat_start", "person_answer", "permission_answer", "read"].map((stage) => ({ stage: stage as "pairing", passed: true, artifact: "synthetic-receipt" })), siteChallenge: "not_declared", externalCalls: 0, externalUsd: 0 };
  assert.deepEqual(classifyPreflight(input), { protocolPassed: true, siteChallenge: "not_declared", gaps: [] });
  assert.deepEqual(classifyPreflight({ ...input, stages: input.stages.slice(0, 3), externalCalls: null }).gaps, ["unproved_permission_answer", "unproved_read", "unproved_zero_external_spend"]);
});

test("permission not applicable needs actual declared read-only task evidence", () => {
  const source = { core: "core", extension: "extension" };
  const input: PreflightEvidence = { scenarioId: "auction-marketplace", source, stages: ["pairing", "chat_start", "person_answer", "read"].map((stage) => ({ stage: stage as "pairing", passed: true, artifact: "receipt" })), siteChallenge: "not_declared", externalCalls: 0, externalUsd: 0, permission: { applicability: "not_applicable", taskId: "auction-marketplace-lens-hood-seller-shop", taskDigest: "a".repeat(64), declaredConsequences: [], pointDeclared: false } };
  assert.equal(classifyPreflight(input).protocolPassed, true);
  assert.equal(classifyPreflight({ ...input, permission: { ...input.permission!, declaredConsequences: ["modify_existing"] } }).protocolPassed, false);
});
