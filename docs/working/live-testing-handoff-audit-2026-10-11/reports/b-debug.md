# B round-3 saved-run diagnosis
Status: Complete
Status detail: Saved failure traced; fix proposal awaits supervisor verification and implementation.
Created: 2026-10-11
Last updated: 2026-10-11
Owner: b-debug worker
Scope: Read-only root-cause analysis of run-mv4jqkko-bc9a05c6.
Paired document: none
Related: ../../../live-testing-handoff-audit-2026-10-11.md

## Current State
B did not reach a candidate trial: three submissions were accepted as unverified drafts, then Core withdrew both candidate finishing tools at the final counted decision and instructed completion. Completing the untested revision was correctly refused; the next model request could not be reserved within the $0.10 purse. The draft survives, but no Flow was promoted. Trial count 0, runtime/judge/replay absent; 24 provider calls, $0.091923204 (23 build calls plus one chat call).

## Evidence and cause
- Saved run: 2026-10-11 18:01:19-18:03:31 America/Los_Angeles (October 12 UTC). summary/evaluation agree failed build; flowCreated false, oracle null.
- Steps 0006/0024: recoverable target_covered; detail.closeWith gives a way out; succeeding actions follow. These are not the terminal failure.
- Step 0041: 7 decisions left, $0.0328; submission/test both offered. Step 0042 accepts revision 1, not_performed, promotionAllowed false, next says test.
- Step 0043: 5 left, $0.0285; submit/test only. Step 0044 accepts revised plan as revision 2; still untested.
- Step 0045: 3 left, $0.0204; submit/test only. Step 0046 accepts revision 3; still untested.
- Step 0047: 1 left, $0.0157; tools=[]; budget instruction says only complete is offered. Model returns completion with revision 3/digest. No test call exists anywhere.
- Step 0048: candidate.trial_required. core.log lines 102-104 show refusal then flow_bootstrap.run_budget_cost_exhausted before provider dispatch of iteration 24.
- Core owner: packages/fluxiq/src/programs/automation-studio/runtime/llm/loop-budget.ts:186 keeps candidate finishing tools only when left > 1; :163/:249 select completion-only final guidance. This is a definite finishing-path defect: untested candidate has no legal completion, yet trial is withdrawn.
- t383 commit 397e461f already fixed earlier wrap-up withdrawal, but deliberately retained completion-only left1. llm/tests/loop-budget.test.ts explicitly asserts offeredIds(1,true)==[] and completion-only wording. This is the uncovered final-turn continuation of that defect, not an absent t383 merge.
- Correct acceptance guard: flow-bootstrap/candidate/trial-gate.ts:176 refuses missing trial. Do not weaken it.
- Accepted evidence owner: flow-bootstrap/candidate/authoring-loop.ts:62 names testing but not the exact executable receipt. Strengthen its next instruction with returned revision/digest and explicit 'test next; do not complete until yes'.
- Purse reservation owner: llm/run-budget.ts:180 rejects spent+reserved+next request over ceiling. Remaining $0.008076796 is not proof another request was affordable: reservation prices the request worst case. The spend guard is correct, not a call-count or machine limit.

## Smallest proposed fix and regression
1. In Core llm/loop-budget.ts retain submit_candidate and test_candidate for candidate left1; remove final guidance that claims only completion is offered. Preserve legacy draft wrap-up. Candidate budget count is guidance; purse remains the authority.
2. In Core candidate/authoring-loop.ts make each accepted receipt an explicit next test call using that revision/digest, with the trial requirement. Avoid scenario-shaped examples.
3. Fail first in llm/tests/loop-budget.test.ts: left1 candidate still offers submit/test and does not instruct untested completion. More valuable integration case in candidate/tests: accepted but untested revision, remaining cost count 1, sufficient actual purse for compact trial decision and completion; decide must receive test tool, test exact receipt, then completion passes only after yes. Without trial or with no verdict, completion remains refused.
4. Test accepted receipt next guidance and resubmission resetting the required trial. An actual deadline/token hard stop need not fabricate success when no time remains.
5. Candidate prompt in llm/evidence-loop-decision.ts:71 says 'Complete immediately' with only flow_draft exception; candidate exception is missing. This conflict is observed, but its causal contribution to two resubmissions is a hypothesis, not established model intent. Fix wording only with scoped generic tests if supervisor includes it.
6. Compare surviving C loop-budget/authoring-loop changes first: they may already implement items 1/2. No duplicate patch requested.

## Recording practice is separate
Provider-free practice run-mv4jgt1w-d3c5237f failed recording.persistence: recording entries continued appending after ~91 seconds. That path never participates in this chat-started candidate failure. Its suspected recording connection overhead/t381 overlap needs its own lifecycle investigation; this saved paid run establishes neither cause nor fix for it.

## Validation and limits
Inspected all 48 step metadata, every tool call/result structure and outcome, final four full request contexts, final decision payloads, saved accounting/evaluation/summary and Core trace/source/tests. Did not inspect all historical full page bodies, screenshots, profiles or secrets. No source edits, tests, builds, launches, calls, commits or pushes. Saved artifact review is not fresh live validation.

## Work Ledger
### 2026-10-11 - Failure trace recovered
- Agent: b-debug worker.
- Changed: this report, lane-b-round3.md and full run debug.
- Why: lane report ended before the completed paid failure.
- Validation: saved JSON projections and rg source/trace inspection; no execution validation authorized.
- Outcome: Partial; source proposal awaits implementation and supervisor verification.
- Follow-up: integrate overlapping C fix, focused regression, then new fixed-source B qualification run.
