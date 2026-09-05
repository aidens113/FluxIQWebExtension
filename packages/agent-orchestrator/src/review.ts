import type { AgentTaskPacket, ProtectedInvariant, CandidateSubmission, PolicyIssue, PolicyResult, ReviewGateResult } from "./types.js";
import { validateCandidateEdits } from "./path-policy.js";
import { validateTaskPacket, validateTaskResponse } from "./task.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function candidateEdits(value: unknown): CandidateSubmission["observedEdits"] | undefined {
  if (!Array.isArray(value)) return undefined;
  const edits: CandidateSubmission["observedEdits"] = [];
  for (const entry of value) {
    if (!isRecord(entry) || !["facility", "core"].includes(String(entry.repository)) || typeof entry.path !== "string" || !["add", "modify", "delete"].includes(String(entry.operation)) || typeof entry.changedBytes !== "number") return undefined;
    edits.push(entry as CandidateSubmission["observedEdits"][number]);
  }
  return edits;
}

export function validateCandidateResult(packet: AgentTaskPacket, responseValue: unknown, observedValue: unknown): PolicyResult {
  const issues: PolicyIssue[] = [...validateTaskPacket(packet).issues, ...validateTaskResponse(packet, responseValue).issues];
  const observed = candidateEdits(observedValue);
  if (!observed) issues.push({ code: "edits.observed-format", message: "Trusted observed edits must be a CandidateEdit JSON array" });
  else issues.push(...validateCandidateEdits(packet, observed).issues);
  const response = isRecord(responseValue) ? candidateEdits(responseValue.changedFiles) : undefined;
  if (!response) issues.push({ code: "edits.reported-format", message: "Agent changedFiles must be a CandidateEdit JSON array" });
  if (observed && response) {
    const identity = (edit: CandidateSubmission["observedEdits"][number]) => `${edit.repository}\0${edit.path}\0${edit.operation}\0${edit.changedBytes}`;
    if (JSON.stringify([...observed].map(identity).sort()) !== JSON.stringify([...response].map(identity).sort())) issues.push({ code: "edits.mismatch", message: "Agent-reported edits do not match the independently observed diff" });
  }
  return { accepted: issues.length === 0, issues };
}

export function detectExpectationWeakening(baseline: readonly ProtectedInvariant[], candidate: readonly ProtectedInvariant[]): PolicyIssue[] {
  const issues: PolicyIssue[] = [];
  const candidates = new Map(candidate.map((invariant) => [invariant.id, invariant]));
  for (const invariant of baseline) {
    const next = candidates.get(invariant.id);
    if (!next) issues.push({ code: "expectation.removed", message: `Protected invariant removed: ${invariant.id}` });
    else {
      if (invariant.definitionSha256 !== next.definitionSha256) issues.push({ code: "expectation.changed", message: `Protected invariant changed: ${invariant.id}` });
      if (invariant.required && !next.required) issues.push({ code: "expectation.optional", message: `Required invariant made optional: ${invariant.id}` });
    }
  }
  return issues;
}

export function evaluateReviewGate(submission: CandidateSubmission): ReviewGateResult {
  const issues: PolicyIssue[] = [
    ...validateCandidateResult(submission.packet, submission.response, submission.observedEdits).issues,
    ...detectExpectationWeakening(submission.packet.protectedInvariants, submission.candidateInvariants),
  ];
  if (!submission.auditVerified) issues.push({ code: "audit.invalid", message: "Audit chain is missing or invalid" });
  if (submission.baselineEvaluation.runId !== submission.comparison.baselineRunId) issues.push({ code: "comparison.baseline", message: "Comparison baseline does not match evaluation" });
  if (submission.candidateEvaluation.runId !== submission.comparison.candidateRunId) issues.push({ code: "comparison.candidate", message: "Comparison candidate does not match evaluation" });
  if (!submission.response.candidateRunIds.includes(submission.comparison.candidateRunId)) issues.push({ code: "response.candidate-run", message: "Response does not reference the compared candidate run" });
  if (submission.candidateEvaluation.verdict !== "passed") issues.push({ code: "candidate.failed", message: "Candidate evaluation did not pass" });
  const candidateResults = new Map(submission.candidateEvaluation.invariants.map((invariant) => [invariant.id, invariant]));
  for (const baseline of submission.baselineEvaluation.invariants) {
    const candidate = candidateResults.get(baseline.id);
    if (!candidate) issues.push({ code: "evaluation.invariant-removed", message: `Candidate evaluation omitted invariant: ${baseline.id}` });
    else if (candidate.expected !== baseline.expected) issues.push({ code: "evaluation.expected-changed", message: `Candidate changed the expected result for invariant: ${baseline.id}` });
  }
  if (!submission.comparison.safetyPassed) issues.push({ code: "comparison.safety", message: "Safety checks did not pass" });
  if (!submission.comparison.expectationSetEqual) issues.push({ code: "comparison.expectations", message: "Comparison reports an expectation-set change" });
  if (!submission.comparison.evidenceComplete) issues.push({ code: "comparison.evidence", message: "Candidate evidence is incomplete" });
  if (submission.comparison.verdict === "rejected" || submission.comparison.verdict === "regressed") issues.push({ code: "comparison.verdict", message: `Comparison verdict is ${submission.comparison.verdict}` });
  if (submission.response.status !== "completed") issues.push({ code: "response.status", message: `Task response is ${submission.response.status}` });
  return { accepted: issues.length === 0, issues, verdict: issues.length === 0 ? "approve-for-human-review" : "reject" };
}
