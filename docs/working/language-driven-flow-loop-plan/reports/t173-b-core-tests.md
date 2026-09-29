# t173-B: Core structure audit and stale tests (worker report)

Core `F:\!FluxIQ`, branch `task/t173-audit-close`, base e82089f. Nothing was committed. Another worker was editing service.ts, the evidence-loop sources, flow-bootstrap and apps/web in the same tree at the same time.

## Outcome

Partial. Both import violations are fixed. Four of the five stale tests are green. Coverage for `completion-attempt.ts` and `resume.ts` is added and passing. One assertion in `generation.test.ts` still fails. The cause is a source defect in `service.ts`, which I do not own, so I left the assertion as it is. See the open questions.

## What changed and why

- `llm/loop-budget.ts:36` and `llm/loop-configuration.ts:25`: the two type-only imports now go through `./evidence-loop/index.ts` instead of reaching into `exhaustion.ts` and `resume.ts`. There is no cycle to worry about, because both imports are `import type`.
- `llm/tests/loop-budget.test.ts`: the expectation now includes `limitedBy: "tokens"`. I also added assertions that `limitedBy` names `cost`, `duration` and `iterations` in the backstop test.
- `flow-bootstrap/tests/evidence-loop-steps.test.ts`: the expectation now includes `amendmentRefusals: ["9:no_such_step","1:already_so"]`. I also added:
  - a check that the "refused nothing" case omits it;
  - a check of the flat code for a filtered refusal;
  - a new case for the `step:reason:nodeId` form when the trace knows the node.
- `llm/tests/unusable-decision.test.ts:352`: the expected stall message is now exactly `/^stalled on a\.issue,b\.issue$/`, following the intended de-duplication. It is anchored, so it can no longer pass on the old message as a substring.
- `tests/deepseek-bootstrap-exploration.test.ts`, "26-decision exhaustion" test:
  - Decisions 11–23 offer `[complete, amend_draft, tool_call]`, 24–25 (the wrap-up) offer `[complete, amend_draft]`, and 26 offers `[complete]`.
  - The iteration-9 refusal now carries `nodeId: "demo.look"` and `amendmentRefusals: ["2:already_so:demo.look"]`. `evidence-loop-steps.ts` keeps the node id deliberately.
- `tests/service-bootstrap/tests/generation.test.ts:274`: diagnosed as a test lagging the source. The grant allows 3 calls, so `decisionsLeft` is 3 on decision 1 and the loop is already in its wrap-up. That decision therefore also carries a `core.budget` entry, and no tools. I confirmed this by logging `requests[0]` in a temporary copy, then restored the file. The assertion now checks that the only observed evidence (anything that is not `core.budget`) is `initial.inspect`.
- New `llm/evidence-loop/tests/completion-attempt.test.ts` (10 tests):
  - accepted, with and without a check, and answerability passed through;
  - the dry run runs even when the check refuses, and both refusals are merged with the check's issues first;
  - the dry run can refuse on its own;
  - de-duplication;
  - the check is given copies;
  - an unreadable check ends `invalid_decision` and nothing is replayed;
  - a check that throws ends `threw`, or `cancelled` once the signal is aborted;
  - nothing is replayed after an abort;
  - the dry run can end `cancelled` or `evidence_limit`.
- New `llm/evidence-loop/tests/resume.test.ts` (4 tests):
  - the entry's shape and count of proposable steps (a failed attempt, an observation and a dropped step are excluded);
  - `unusable_decisions` is passed through;
  - a bad revision is clamped to 1;
  - outstanding codes are filtered and capped at 16.

## Commands run and observed results

- `node scripts/structure-audit.mjs`, run right after the import fix: `structure-audit: passed (193 warning(s), 355 baselined).` It also printed `1 baseline entries can be lowered`.
- The same command at the end: `3 violation(s) across 3 rule(s)`. None of the three is in a file I own. All come from the concurrent work:
  - `[class-methods] service.ts` has 223 methods against a baseline of 222;
  - `[failure-as-empty] flow-bootstrap/incomplete-draft/keeper.ts:91`;
  - `[imports] apps/web/.../core-contract-world.ts:25`.
- `npx vitest run` over the 5 stale files before any edit: `5 failed | 97 passed (102)`, the same five as the baseline.
- `npx vitest run` over the 7 touched and new files at the end: `Test Files 1 failed | 6 passed (7); Tests 1 failed | 116 passed (117)`. The only failure is at `generation.test.ts:281`: `freshContributionCount` expected 1, received 2.
- `npx tsc --noEmit -p packages/fluxiq/tsconfig.json`: the first run failed on my resume test, because `stopped` took the `ExhaustedBound` values `iterations|budget|tool_calls` and I had used `tokens`/`cost`. I fixed the test, and the second run gave `TSC_EXIT 0`, including the other worker's in-progress files.
- There was no native crash, so nothing was rerun for that reason.

## Not verified

- I did not run the full `packages/fluxiq` suite, `pnpm check` or `pnpm test`, per the brief.
- I did not run `pnpm structure:baseline`. The baseline file is not mine, and the supervisor should lower it after integrating.
- `resume.test.ts` was written against the version of `resume.ts` present at the end. The other worker modified that file while I was working.

## Open questions or contradictions found

1. **Source defect in `service.ts:1601-1604`, which I do not own.** The reusable-context call passes the loop's whole `evidence`, `core.budget` included, as `freshEvidence`, and counts it in `freshEvidenceCount`. As a result, `freshContributionCount` is 2 when there is one real inspection, and the loop's bookkeeping reaches `selectForFreshEvidence`. The same applies to any other `core.*` entry that is shown, such as `core.completion_check` or `core.resumed`. The fix belongs to whoever owns service.ts: count and pass only entries whose `toolId` is not a `core.` entry. After that, `generation.test.ts:281` passes unchanged.
2. **The wrap-up does not refuse a tool call.** `evidence-loop.ts:545` withholds tools from the schema (`offered = []`), but a `tool_call` the model sends anyway is still executed. It is checked against `eligibleToolIds`, not against `offered`. In the deepseek test, the looks at decision 24 and the rerun at 25 ran with `effectApplied: true` during the wrap-up, and `toolCallCount: 22` depends on that. Is this intended, as leniency for a model that ignores the schema, or should wrap-up tool calls be refused as not offered? This is not my file.
3. **A grant of 3 calls or fewer never offers a tool.** Decision 1 is already inside the wrap-up, so such a build cannot explore at all and must finish from its initial observations. That may be intended, but it is a behaviour change that e82089f made without saying so.
