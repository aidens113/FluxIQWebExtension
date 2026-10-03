import assert from "node:assert/strict";
import test from "node:test";
import { publishableTree } from "../publishable-tree.js";

test("a nested Core record keeps its codes, counts and flags and drops its sentences", () => {
  assert.deepEqual(publishableTree({
    routed: true,
    code: "flow_bootstrap.evidence_iteration_limit",
    reason: "The build ran out of decisions before it finished.",
    attempts: [{ attempt: 1, durationMs: 240_000, accounting: { provider: "deepseek", totalTokens: 507_000, estimatedCostUsd: 0.056 }, note: "free text here" }],
  }), {
    routed: true,
    code: "flow_bootstrap.evidence_iteration_limit",
    attempts: [{ attempt: 1, durationMs: 240_000, accounting: { provider: "deepseek", totalTokens: 507_000, estimatedCostUsd: 0.056 } }],
  });
});

test("a member whose name says it holds content is dropped even when its value has a code's shape", () => {
  assert.deepEqual(publishableTree({ label: "Checkout", value: "149.99", url: "example.test", selectorCount: 2, stage: "diagnosis" }), { selectorCount: 2, stage: "diagnosis" });
  assert.equal(publishableTree({ apiKey: "sk-abc123", sessionToken: "abc" }), undefined);
});

test("decision rows inside a record go through the decision-row rule, refused amendments included", () => {
  const tree = publishableTree({ evidenceLoop: { decisionCount: 2, steps: [
    { toolId: "llm.amend_draft", iteration: 1, amended: 0, amendmentsRefused: [{ step: 3, reason: "already_so", nodeId: "web.click" }], resultReason: "llm_evidence_loop.draft_unchanged" },
    { toolId: "web.inspect", iteration: 2, usage: { inputTokens: 1_200, outputTokens: 80 }, selector: "#buy" },
  ] } });
  assert.deepEqual(tree, { evidenceLoop: { decisionCount: 2, steps: [
    { toolId: "llm.amend_draft", iteration: 1, amended: 0, amendmentsRefused: [{ step: 3, reason: "already_so", nodeId: "web.click" }], resultReason: "llm_evidence_loop.draft_unchanged" },
    { toolId: "web.inspect", iteration: 2, usage: { inputTokens: 1_200, outputTokens: 80 } },
  ] } });
});

test("the copy is bounded in depth and in list length, and an emptied record is absent", () => {
  let deep: Record<string, unknown> = { count: 1 };
  for (let level = 0; level < 10; level += 1) deep = { inner: deep };
  assert.equal(publishableTree(deep), undefined);
  assert.equal((publishableTree(Array.from({ length: 50 }, (_, index) => index)) as readonly number[]).length, 32);
  assert.equal(publishableTree({ message: "a sentence", nested: { text: "another" } }), undefined);
});

// Core records no round's stop word today (t194-w60: the round ending is held only in
// `unfinished-build/phases.ts` locals, and `reauthor-build.ts` drops the build ending). This pins
// what the copy carries once Core writes one: a stop word under `stopped` or `noRoute.kind`
// travels, and one under a `...Reason` name never would, since that name reads as content.
test("a round's stop word travels under a code-shaped name and is dropped under a reason-shaped one", () => {
  assert.deepEqual(publishableTree({ rounds: [
    { round: 0, stopped: "repeat_without_progress", decisions: 9 },
    { round: 1, stopped: "repeat_without_progress", noRoute: { kind: "repeated_unchanged" }, stopReason: "repeated_unchanged" },
  ] }), { rounds: [
    { round: 0, stopped: "repeat_without_progress", decisions: 9 },
    { round: 1, stopped: "repeat_without_progress", noRoute: { kind: "repeated_unchanged" } },
  ] });
});
