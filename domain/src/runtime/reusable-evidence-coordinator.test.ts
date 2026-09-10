import assert from "node:assert/strict";
import test from "node:test";
import { mapCompletedWebReusableEvidenceToPutRequest, writeCompletedWebReusableEvidence, type CompletedWebReusableEvidenceInput } from "./reusable-evidence-coordinator.ts";

function input(overrides: Partial<CompletedWebReusableEvidenceInput> = {}): CompletedWebReusableEvidenceInput {
  return {
    enabled: true,
    completionStatus: "completed",
    projectId: "project.one",
    flowId: "flow.one",
    subflowId: "subflow.one",
    evidenceKind: "runtime_failure",
    evidence: {
      schemaVersion: "web-llm-evidence.v1",
      trust: "untrusted-page-evidence",
      location: "https://example.test/form?secret=query#fragment",
      elements: [
        { target: "target.1", tag: "textarea", selector: '[data-testid="adapted-name"]', name: "Name", hasValue: true },
        { target: "target.2", tag: "input", selector: "#password", inputType: "password", name: "Password" },
        { target: "target.3", tag: "select", selector: "#plan", name: "Plan", selectedValue: "private-value", options: [{ value: "private-value", label: "Private label" }] },
      ],
      truncated: false,
    },
    actions: [{ definitionId: "web.output.dom-type", status: "failed", route: "failed" }],
    clientCapabilities: ["web.actions.v1", "web.snapshots.v1"],
    outcome: "failed",
    reviewerState: "unreviewed",
    validationState: "unknown",
    sourceRunIds: ["run.one"],
    sourceAdaptationIds: [],
    completedAt: 1_000,
    ttlMs: 60_000,
    ...overrides,
  };
}

test("maps completed sanitized evidence to the protected Core put contract", () => {
  const request = mapCompletedWebReusableEvidenceToPutRequest(input());
  assert.equal(request.projectId, "project.one");
  assert.deepEqual(request.record.sourceRunIds, ["run.one"]);
  assert.equal(request.record.domainId, "web-automation");
  assert.equal(request.record.outcome, "failed");
  assert.match(request.record.compatibilityTags.find(tag => tag.name === "web.fingerprint")?.value ?? "", /^[a-f0-9]{64}$/u);
  const serialized = JSON.stringify(request);
  assert.doesNotMatch(serialized, /secret=query|fragment|private-value|Private label|Password|adapted-name|#plan|#password|target\.1/iu);
  assert.doesNotMatch(serialized, /selector|selectedValue|hasValue|options|rawDom|cookie|headers/iu);
  const projection = request.record.promptProjection as { facts: Array<Record<string, unknown>>; compatibilityDigest: string };
  assert.ok(projection.facts.some(fact => fact.kind === "action" && fact.status === "failed"));
  assert.ok(projection.facts.some(fact => fact.kind === "element" && fact.tag === "textarea"));
});

test("does not call Core while feature-gated off", async () => {
  let calls = 0;
  const result = await writeCompletedWebReusableEvidence(input({ enabled: false }), { putReusableLlmContext: async () => { calls += 1; return { ok: true }; } });
  assert.deepEqual(result, { status: "disabled" });
  assert.equal(calls, 0);
});

test("writes once and returns only protected Core identity", async () => {
  const requests: unknown[] = [];
  const result = await writeCompletedWebReusableEvidence(input(), {
    putReusableLlmContext: async (request) => {
      requests.push(request);
      return { ok: true, payload: { context: { recordId: "llm-context:one", contentDigest: "a".repeat(64) } } };
    },
  });
  assert.deepEqual(result, { status: "stored", recordId: "llm-context:one", contentDigest: "a".repeat(64) });
  assert.equal(requests.length, 1);
});

test("fails closed on incomplete provenance and every rejected protected write", async () => {
  assert.throws(() => mapCompletedWebReusableEvidenceToPutRequest(input({ completionStatus: "running" as never })), /only after completion/u);
  assert.throws(() => mapCompletedWebReusableEvidenceToPutRequest(input({ sourceRunIds: [], sourceAdaptationIds: [] })), /explicit source provenance/u);
  let rejectedCalls = 0;
  await assert.rejects(() => writeCompletedWebReusableEvidence(input(), { putReusableLlmContext: async () => { rejectedCalls += 1; return { ok: false }; } }), /rejected by Core/u);
  assert.equal(rejectedCalls, 1);
  let thrownCalls = 0;
  await assert.rejects(() => writeCompletedWebReusableEvidence(input(), { putReusableLlmContext: async () => { thrownCalls += 1; throw new Error("content protection unavailable"); } }), /rejected by Core/u);
  assert.equal(thrownCalls, 1);
});
