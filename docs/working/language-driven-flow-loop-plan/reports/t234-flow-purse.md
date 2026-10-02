# t234 flow purse: lead report

Status: Done (uncommitted, in the t234 worktrees). The supervisor merged F41 and dev into both t234 trees
(Core 5c981e82, downstream 1168b53f) after this lead's first hand-back; the plan below was approved and
implemented. No Lab or live run.

## Outcome

- One purse per Flow creation is the only cost authority. `build-purse/purse.ts` carries earlier builds'
  spend (`carriedUsd`), has `leftUsd()`, and lost F41's `standing()`/`declinedBy`. `build-purse/run.ts`
  adds `automationStudioLlmBuildPurseScope`, which the whole build body runs inside (lead).
- The loop's count reads the purse with no hold-back and never ends a loop on cost; the purse's refusal is
  the only cost ending (W2: `loop-budget.ts`, `evidence-loop.ts`, `loop-configuration.ts`,
  `evidence-loop/cost-purse.ts`, `evidence-loop/exhaustion.ts`).
- Rounds share the purse (no per-round refill). The judge drops its half-of-left cap under a purse, and a
  judge the purse refuses gives `not_judged`. The cost ending names the carried spend and what the Flow has
  left (W3: `phases.ts`, `budget-exhausted.ts`, `build-test/judge.ts`).
- A per-Flow creation record (`flow-bootstrap/creation-spend/`, `service/creation-spend.ts`) is opened into
  the purse, saved however a build ends, and deleted on proposal or not doable. A refuted-result repair never
  touches it (W4, W5: `service/flow-bootstrap-commands/creation-purse.ts`, `built-loop.ts`). `service.ts`
  went 4491 to 4490 lines.
- `AUTOMATION_STUDIO_LLM_DECISION_REPLY_TOKENS = 2_000` applies only to the build loop's decision call, via
  `automationStudioLlmDecisionTokenLimits` (W4, W5).
- Docs: `docs/architecture/automation-studio/llm-flow-bootstrap.md` gained the section "One purse per Flow
  creation", and `automation-studio.md` was updated (W6). The framework reference was regenerated.
- Lead fixes: `cost-ceiling.test.ts` now gives its mock provider a worst-case price, since an unpriced
  provider is held at nothing and only priced calls can be bounded before they are sent; DeepSeek always
  prices. `generation.test.ts` asserts the judge carries the decisions' per-request default, not half of
  what is left.

## Validation (lead, observed)

- `npx tsc --noEmit -p .` (Core packages/fluxiq): exit 0, no output.
- vitest over build-purse, evidence-loop, llm/tests evidence-loop*, loop-budget, run-budget, flow-bootstrap,
  loop-limits, flow-execution-limits, tests/service-bootstrap, recovery exploration-budget, annotation
  run-budget, build-test, flow-bootstrap-commands and llm/harness:
  "Test Files 150 passed (150), Tests 1737 passed (1737)".
- Fail-on-old spot check: the HEAD `loop-budget.ts` swapped in gave "Failed Tests 11" across
  loop-budget.test.ts and cost-purse.test.ts; restored, and cmp matched.
- `node scripts/structure-audit.mjs` (Core): "passed (217 warning(s), 349 baselined)". W5 ran
  `pnpm structure:baseline`: service.ts 4491 to 4490, one apps/web entry lowered, four stale apps/web entries
  removed.
- `node scripts/docs-reference.mjs --check`: was stale, regenerated, now "Deterministic framework reference
  is current."
- Core libs: `node scripts/build-cache/cli.mjs contracts:build fluxiq:build`: exit 0 (fluxiq rebuilt).
- Downstream: `node scripts/structure-audit.mjs`: "passed (155 warning(s), 118 baselined)"; `domain`
  `npx tsc --noEmit -p .`: exit 0. Lab budget code reads only `budgetBreaches`/`estimatedCostUsd` (unchanged
  shapes), so test-runner tests were not needed.

## Not verified

- No live or Lab run. The full suites were not run.
- A refused decision's never-sent estimated input tokens now count in the ending's `estimatedInputTokens`
  (W5 removed a redundant throw; the line that adds them is in t235's area).
- Recovery decisions and the instruction reading keep the 8,000 reply allowance; the judge's replies
  (max 737) could also take a smaller one.
- If the creation-record save in the build's `finally` throws, it masks the build's own error.

## Findings

- F1. Two cost authorities. The loop's count (`runtime/llm/loop-budget.ts`) ends a build in
  two places in `runtime/llm/evidence-loop.ts`: `decisionsLeft === 0` (line ~500) and a final
  completion-only decision spent on something else (line ~612). The count also holds back one
  average decision "for calls the loop cannot see". run-muqbzu32 was stopped by the count
  (count 0: $0.0213 left after the hold-back, last worst case $0.0317), not by the purse.
- F2. No purse per Flow creation. Each evidence loop makes its own purse
  (`evidence-loop/cost-purse.ts`); each repair round is given "what the rounds before left"
  (`phases.ts` `remaining`); the judge runs outside any purse with a per-call cap of half of
  what is left (`result-verification/build-test/judge.ts`); the instruction reading
  (`service/instruction-authority.ts`) is outside any purse. Nothing is persisted across
  builds: the incomplete-draft record (`flow-bootstrap/incomplete-draft/record.ts`) keeps
  steps, not spend, so "building again carries on" starts a fresh $0.10.
- F3. Holds use the resolver's 8,000-token reply allowance
  (`AUTOMATION_STUDIO_LLM_DEFAULT_REPLY_TOKENS`, via `session-key-provider.ts`), sent as
  `max_tokens: 8000`. Measured replies (`./t234-reply-sizes.md`, 6,119 recorded decisions
  across 1,222 runs): median 101, p99 469, max 593; complete max 268; amend_draft max 593;
  judge (result_verification, n=38) max 737; no truncated reply. The four 2026-10-01 runs
  (84 decisions): median 96, max 515.
- F4. The input side of the hold is already a true upper bound: the harness measures message
  bytes / 3 + 16 framing tokens; the provider's count was at least 3.036 bytes per token over
  all 84 calls, so the measure overstated every call's input (by 1.2% at the tightest).
- F5. Runtime patch steps may serialize to 8,000 characters
  (`AUTOMATION_STUDIO_RUNTIME_PATCH_STEP_MAX_SERIALIZED_LENGTH`), about 2,700 tokens, so the
  global default reply allowance must not drop to 2,000; the new allowance is scoped to
  evidence-loop decisions.

## Worked example (DeepSeek flash: miss $0.30/M, output $1.20/M; ceiling $0.10)

Script: scratchpad `worked.js` (replays each decision's measured request and reported cost).

run-muqbzu32: 15 decisions sent before and after.
- Before: after 15 decisions $0.0738 spent, $0.0262 left. The count declined the 16th
  ($0.0213 after its hold-back, against the 15th's worst case $0.0317 at 8,000 reply tokens);
  the purse alone would also have refused (16th at least $0.0317). The count had already
  fallen to 3 (the wrap-up, tools withdrawn) at decision 15.
- After (one purse, 2,000-token allowance): the 15th held $0.0245. A 16th fits if its request
  is under about 79,460 estimated tokens (5,900 more than the 15th): the run's mean growth
  (3,772 per decision) fits one more decision, the last four decisions' growth (9,400 per
  decision) does not. No 17th fits in any case. The binding cost here is the request size
  (73,500 estimated input tokens, $0.022 at worst), which t235 is reducing.
- Extrapolated (mean growth, mean of last five costs) over all four runs: extra decisions
  that fit after the stop point, old purse alone at 8,000 vs new at 2,000:
  run-muqbzu32 0 vs 1; run-muqbzqtu 1 vs 3; run-muqc07fh 1 vs 3; run-muqclqt5 1 vs 2.
  Under the old count every one of them got 0 extra.

## Plan (file-partitioned; to dispatch after the merges)

- W1 purse (Core `runtime/llm/build-purse/`): a purse carries what earlier builds of the same
  Flow creation spent (`carriedUsd`); a build-wide scope that holds every harness call made
  inside it (authority, decisions, judge, any test call) without the per-call throw; remove
  F41's `standing()`/`declinedBy` once nothing declines outside the purse. Tests in
  `build-purse/tests/`.
- W2 loop (Core `runtime/llm/loop-budget.ts`, `evidence-loop.ts`, `evidence-loop/cost-purse.ts`,
  `evidence-loop/exhaustion.ts`): the loop takes the build's purse when given one; the cost
  count reads the purse's spend, pending and last worst case with no hold-back, informs the
  model and the wrap-up only, and never ends the loop (no `decisionsLeft === 0` or
  final-decision stop on cost); the purse's refusal is the only cost ending. Recovery loops
  without a given purse keep today's behaviour.
- W3 phases and judge (Core `flow-bootstrap/unfinished-build/phases.ts`, `budget-exhausted.ts`,
  `result-verification/build-test/judge.ts`, `service/flow-bootstrap-commands/build-judge.ts`):
  every round and the judge draw from the one purse; drop the per-round refill and the judge's
  half-of-what-is-left cap; a cost ending reads the purse's own figures, and its "building
  again carries on" sentence says what the Flow has left of its ceiling.
- W4 creation record (Core new `flow-bootstrap/creation-spend/` plus a store beside
  `service/incomplete-drafts.ts`, and `service.ts` wiring): per-Flow spend record; a build
  opens its purse with the recorded spend, writes it back however the build ends (finally),
  clears it when a Flow is proposed or declared not doable; a refuted-result repair build
  (`repairBrief`) keeps its own run ceiling and never reads or writes it.
- W5 reply allowance (Core `runtime/llm/harness/token-limits.ts` and the one decision call in
  `service.ts`, plus recovery's decision call if it shares the path):
  `AUTOMATION_STUDIO_LLM_DECISION_REPLY_TOKENS = 2_000`, derived as at least 3x the largest of
  6,119 recorded decision replies (593), rounded up to the thousand; the hold stays a true
  upper bound because `max_tokens` is that same figure.
- Docs: Core architecture text on the build purse and `node scripts/docs-reference.mjs --check`;
  extension test-runner only if Lab budget code reads these constants.
- Out of scope (t235): request composition and the node catalog.

## Post-merge regression fix (after Core ab781df8 and the dev merge)

- Cause: `repair-purse-chain.test.ts` "is capped at a Flow's $0.10..." spent $0.12. Its provider reports
  $0.03 a call but does not price, and the purse held unpriced calls at nothing, refusing only once spend
  reached the ceiling. On dev the loop's average-based count stopped the re-author build first; with that
  count removed, nothing bounded unpriced calls.
- Fix (`llm/build-purse/purse.ts`): an unpriced call is held at the most any call on the purse has reported
  costing (a measured figure; nothing until one has reported). New unit test in `build-purse/tests/purse.test.ts`.
  My own `creation-spend.test.ts` (e) depended on the overshoot; it was rescaled so the judge spends 0.4 of the
  ceiling per answer.
- Validation: the pre-fix purse swapped in fails the regression test and the new unit test (2 failed);
  restored. tsc rc 0. The directory set plus tests/refuted-result: 1796 passed, 3 failed (lane D:
  reauthor-service x2, repair-replay-chain, which fail on dev too). Structure audit passed; reference
  current.

## Live runs over $0.10 in the Lab index (2026-10-01 night), investigated and fixed

Read-only findings (step meta.json, snapshots/live-llm.json observed.phases/perBuild, spend ledger):
- bigbox run-muqiojz4-04a7a8fc. Creation (inside the purse): 31 calls, steps 0003-0066 (29 decisions), judge
  0082 and the instruction reading 0083 (tagged "explore", round null), $0.082646. That equals the Lab's
  build phase and is within $0.10. The playback run's own ceilings: result-check judges 0084-0085 $0.002124;
  re-author build 0087-0106 $0.030004; diagnose 0107 $0.004462; patch 0108 refused as
  llm.provider_output_invalid with reported usage 14,335 in (1,280 cached), 187 out, about $0.0041.
  The index's $0.1336 counted 0108 at its hold of $0.0144, about $0.0103 over. The step sum ($0.1195)
  counted it at $0 (meta costUsd null), about $0.0041 under. True total, chat included, about $0.1236 across
  two ceilings.
- confirm-requests run-muqilf9s-c3211328. Creation: 37 calls, $0.091164, within $0.10. Recovery: result-check
  judges $0.001473, re-author $0.017623, diagnose and patch $0.005901. The index ($0.1162) equals the step sum
  less the chat call.
- The chat interpreter call (panel_command, flow.createHere, $0.0003) was outside every purse and outside
  the index total.
- Neither purse breached. Each "over $0.10" figure is creation plus the playback run's recovery.

Fixes (Core, uncommitted):
- W7: AutomationStudioLlmProviderError.paid. The DeepSeek envelope reader attaches the reply's usage to
  every refusal after the reply arrived (output_invalid, truncated, padding_truncated,
  usage_limit_exceeded). The harness settles the run ledger and the purse at that usage, including a
  provider result the harness could not parse. The provider's step is priced.
- W8: step-log context gains `part` ("creation" | "reauthor", null otherwise) and phase "read"; run()
  merges, plus a new within(). meta.json has `part`, and a failed step's cost is read from `paid`.
- W9: the panel-command model reports its cost (execution.paid). Every chat build (create-here, explore,
  improve) passes interpretationCostUsd through the API, and generation-request validates it. The
  creation purse carries it on top of the record (a repair ignores it). The build body is tagged with its
  part, and the instruction reading with phase "read".
- Lead: testing-facility.md documents part, read, refused-reply cost and what the index Cost adds up.
  Framework reference regenerated.

Validation (lead, observed): Core tsc exit 0; structure audit "passed (219 warning(s), 349 baselined)";
docs-reference current. vitest over the affected directories (279 files): 2940 passed, 6 failed:
- 3 lane D (fail on dev);
- cancel-runtime-session and runs, which pass in isolation (11/11, twice): load-sensitive;
- extension-chat "improves an automation", which fails on t234 HEAD before these edits too and passes on
  dev eed0cc34 (t195's later fix); it resolves on the next dev merge.
Core libs rebuilt. Downstream: structure audit passed, domain tsc 0, docs-links passed.
