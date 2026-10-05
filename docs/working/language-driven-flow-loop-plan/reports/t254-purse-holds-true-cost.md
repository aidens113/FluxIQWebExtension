# t254: the purse holds what calls really cost (Core)

Worker: t254-worker. Core tree `fxwork/t254/!FluxIQ`, branch `task/t254-purse-holds-true-cost`, base 58db495f.
R = `packages/fluxiq/src/programs/automation-studio/runtime`. Nothing is committed.

The brief changed partway through. A binding user order, relayed by the supervisor, dropped P3. It also
removed every reply cap and added billed pricing (off-peak and cached rates) plus observed-maximum reply
reserves. I stopped at a safe point when the session ended.

## Outcome

**Partial, but every requested item is implemented and tested.** P1, P4, P5, the cap removal, billed
pricing, the reply reserves and the overshoot record are all written. The narrow tests pass, and the
typecheck, structure audit and docs-reference check pass. What remains is a final combined rerun of the
narrow suite after the last test fixes, plus the open questions below. Each fixed file passed when run on
its own. No step is half-done in code.

## State per item

| Item | State | Main files | Tests |
| --- | --- | --- | --- |
| P1, price only what is sent | Done, tested | `R/llm/harness/run.ts` (`measuredInput` returns `pricedInputTokens`; the purse hold and ledger cost read it; the packed request is kept only for the window refusal; a comment says bytes/3 over-counts, densest 3.24 B/token) | `R/llm/harness/tests/run-size.test.ts` "what a build's purse holds a call at (t254)" |
| P3 caps | **Dropped (user order)** | — | — |
| Cap removal | Done, tested | `R/llm/deepseek/request-body.ts` (no `max_tokens`); `R/llm/harness/token-limits.ts` (decision and judge caps and narrowers removed; the output-limit usage check removed); `R/llm/deepseek/response-envelope.ts` (output no longer refused against `maxOutputTokens`); `R/service.ts` (passes the resolver's limits); `R/result-verification/verify.ts` (no judge narrowing); `R/llm/harness/index.ts` | `R/llm/deepseek/tests/billing.test.ts` "no reply cap…" (decision, judge and recovery bodies have no `max_tokens`; a 9,000-token reply is accepted); `deepseek-provider.test.ts`; `creation-spend.test.ts` (d); `judge.test.ts`; `run-call-record.test.ts` |
| Billed pricing | Done, tested | `R/llm/deepseek/pricing.ts` (`automationStudioDeepSeekOffPeakAt`; `estimate…(…, atMs)` half off-peak); `R/llm/deepseek/provider.ts` (`now` option; the hold priced at `now()`; the charge priced at the send time, taken just before fetch); `response-envelope.ts` and `panel-command.ts` (send-time pricing). Time rule: the call's send time on the UTC clock. Peak is Mon–Fri 01:00–04:00 and 06:00–10:00; everything else is off-peak. Chinese holidays are unknown to Core and are charged at peak. Cached input is charged at the cached rate, as before. | `billing.test.ts` (window boundaries; off-peak and cached charge; peak charge; charged by send time, not read time; hold at the current rate, all input uncached) |
| Observed-maximum reply reserves | Done, tested | `R/llm/build-purse/build-call-reserves.ts` (decision and instruction reading 750 = 2×371; judge 1,250 = 2×625; judge input allowance 8,000); `run.ts` `replyReserveFor` (other kinds use the window set-aside of 8,000) | `run-size.test.ts`; `judge.test.ts`; `cost-purse.test.ts`; `loop-budget-cost-ending.test.ts` |
| Overshoot recorded | Done, tested | `R/llm/build-purse/purse.ts` (`overshootUsd`); `R/llm/evidence-loop/accounting.ts` (`budgetOvershootUsd`); `R/llm/evidence-loop/cost-purse.ts`; `phases.ts` `addAccounting` | `purse.test.ts` "records a reply that cost more…"; `cost-purse.test.ts` "a decision that cost more than it was held at" |
| P4 gate | Done, tested | `R/flow-bootstrap/unfinished-build/round-funding.ts` (new): need = 2 × judge hold (the largest judge hold priced, or the allowance before any) + the least a first decision can cost (750-token reserve, no input). The first decision is priced from its own request when it is sent. `budget-exhausted.ts` has the new wording and `keptBackUsd`. | `repair-rounds.test.ts` (two new gate tests); `judged.test.ts`; `murzln6g-repair-funding.test.ts` |
| P5 judging reserve | Done, tested | `purse.ts` (`keepBackForJudging`, `judgingHoldUsd`, `keptBackUsd`, `priceUsd`; non-judge holds must leave the reserve; judge calls, `taskKind loop_verification`, draw on it); `harness-hold.ts` (`judge` flag and price; refusal message); `loop-budget.ts` and `cost-purse.ts` (the count subtracts `keptBackUsd`) | `purse.test.ts` (4 new); `loop-budget.test.ts` "the cost count beside a judging reserve" |

**How P5 shows up.** The reserve is never charged, so it appears in no spend. The loop's `core.budget`
entry shows `costLeftUsd` with the reserve already taken out, so the model wraps up sooner. A refused
call's refusal and the cost ending carry `keptBackUsd`, which reads as "…, $0.007 was kept back for judging
the Flow, and its next call could have cost up to $0.007." When a reply overshoots its reserve, the loop
accounting gets `budgetBreaches` and `budgetOvershootUsd`.

## Holds before and after, per call kind

All figures are peak flash rates, using the investigation's murzln6g sizes. Off-peak halves every figure.

| Call | Before | After |
| --- | --- | --- |
| Last explore decision (27,119 sent, about 12,800 packed overhead) | $0.0144 (packed + 2,000 cap) | $0.0090 (27,119 × 0.30/M + 750 × 1.20/M) |
| Judge call (6,409 sent) | $0.0043 (2,000 cap) | $0.0034 (1,250 reserve) |
| Instruction reading (about 2,130) | $0.0105 (8,000 default) | $0.0015 (750 reserve) |
| Round gate | decision + 1 judge = $0.0187 | 2 judges + 750-token floor = $0.0077 |
| Judging reserve during exploration | none | $0.0078 before a judge is priced (2 × 8,000/1,250), then 2 × the judge hold |

## murzln6g reproduction

The reproduction is in `R/flow-bootstrap/unfinished-build/tests/murzln6g-repair-funding.test.ts`. It runs
the real harness hold under phases, with $0.0889 spent before the repair.

- **Old gate:** recomputed in the test as $0.0187, more than the $0.0111 left.
- **At peak, after the fix:** the gate needs $0.0077, so **the repair round opens**. Its first decision
  (20,068 tokens, hold $0.0069) does not fit beside the $0.0068 judging reserve and is refused unsent. The
  build ends at cost, and the message names the reserve. At peak, $0.0111 buys a round's judging but not
  its first decision.
- **Off-peak** (the run's actual Saturday billing): the first decision ($0.0035) fits, and the repair
  finishes with the judge's yes.

## phases.ts hunks, for lane D

These are `git diff -U0` against base. The edits are the gate and its feed only.

- `@@ -32,6 +32,4 @@` and `@@ -114,3 +112,5 @@`: header comments (funding paragraph; cost paragraph).
- `@@ -154,0 +155 @@`: `import { automationStudioFlowBootstrapRoundFunding } from "./round-funding.ts";`
- `@@ -293,2 +294,2 @@`: `const holds: CallHolds = {}` becomes `const funding = automationStudioFlowBootstrapRoundFunding(input.purse, input.judge !== undefined);`
- `@@ -308,3 +308,0 @@`: removed the decision-hold capture after a round.
- `@@ -329,3 +326,0 @@`: removed the judge-hold capture after `input.judge`.
- `@@ -392 +387 @@`: `const next = funding.nextRound();`
- `@@ -440,3 +434,0 @@` and `@@ -455,12 +446,0 @@`: removed `CallHolds` and `nextRoundHold`.
- `@@ -506,0 +487 @@`: `costSpending` carries `refusal.keptBackUsd`.
- `@@ -534,2 +515,3 @@`: `exhaustedBound` doc comment.
- `@@ -574,0 +557 @@`: `addAccounting` sums `budgetOvershootUsd`.

## Files changed outside the brief's ownership

The user's order required these:

- `R/llm/deepseek/{request-body,response-envelope,provider,panel-command}.ts`
- `R/llm/evidence-loop/{accounting,cost-purse}.ts`
- `R/service.ts`
- `R/result-verification/verify.ts`
- `R/flow-bootstrap/unfinished-build/budget-exhausted.ts`
- `docs/architecture/automation-studio/llm-flow-bootstrap.md`
- `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md`, regenerated by `pnpm docs:reference`

Tests updated for the change, adding a peak clock where a test pins peak costs:

- `purse.test`, `panel-command.test`, `response-envelope.test`, `paid-refusal.test`, `provider-cache-prefix.test`, `deepseek-provider.test`
- `default-model-env.test` (accepts the peak or the off-peak figure)
- `cost-purse.test`, `loop-budget-cost-ending.test`, `run-call-record.test`
- `cost-ceiling.test` and `creation-spend.test` (judge-sized mock price)

New files:

- `round-funding.ts`
- `build-call-reserves.ts`
- `billing.test.ts`
- `murzln6g-repair-funding.test.ts`

## Commands run and observed results

- **Baseline vitest at base**, narrow set: 98 files, 898 tests passed.
- **Mid-way narrow run** over harness, build-purse, llm/tests, deepseek, evidence-loop, step-log,
  unfinished-build, generation-failure, service-bootstrap, result-verification, recovery-default-limits,
  domain-instructions, recovery/annotation and conversation: 2,024 passed, 2 failed. The 2 failures were
  `cost-purse.test` first case and `deepseek-provider.test` endpoint case. I fixed both, and on their own
  they then passed (31 of 31). I have **not** rerun the whole set since.
- **Wider run** (llm, provider-refusal, recovery/annotation, refuted-result, service-adaptation and
  others): 1,856 passed, 5 failed, all in `service-adaptation` (adaptive-retry-resume, failed-start,
  recovery-trace). Rerun on their own, all 16 passed, so this looks like contention under load; not proven.
- `unfinished-build` on its own: 110 tests passed after the murzln6g message fix.
- `billing.test`, `run-size.test`, `purse.test` and `loop-budget.test` each pass.
- `npx tsc --noEmit -p packages/fluxiq`: no errors. The last `pnpm --filter fluxiq check` failed on a
  `billing.test` type error, which I then fixed and confirmed with plain tsc.
- `node scripts/structure-audit.mjs`: passed. It also says "1 baseline entries can be lowered"; I did not
  run `pnpm structure:baseline`.
- `node scripts/docs-reference.mjs --check`: "current", after I ran `pnpm docs:reference`.

## Not verified

- No live run, and no full suite.
- I did not do a final combined rerun of the narrow set after the last fixes.
- `pnpm --filter fluxiq check` itself was not rerun after the last fix; only plain tsc was.
- DeepSeek's actual billing-time rule (send time versus completion time) and its holiday calendar are
  assumed, not checked.

## Next

1. Rerun the narrow vitest set in one go, then `pnpm --filter fluxiq check`.
2. Supervisor decisions:
   - Run `pnpm structure:baseline`?
   - The chat panel command still sends `max_tokens` 600. It was outside the user's list of build, judge
     and repair paths.
   - Recovery's own ledger (`R/recovery/annotation/run-budget.ts`) still prices at peak.
   - Judge overshoot is recorded on the purse (`overshootUsd`) but not in phases' accounting, because the
     judge's spend arrives as a verdict.
   - A round stopped by the judging reserve ends the build at cost without using the reserve. Testing and
     judging the Flow so far would need `round-ending`/`judgement` changes, which is lane D's area.

## Open questions or contradictions found

- A cycle trap: a value import of `llm/index.ts` from `flow-bootstrap/unfinished-build` closed a module
  cycle, and `runAutomationStudioLlmHarness` became undefined in `loop-budget.test`. The fix was to import
  the reserves from the leaf `llm/build-purse` barrel.
- The ceiling can now be crossed by the part of one reply beyond its reserve, which the user accepted. It
  is recorded as a breach with an overshoot amount.

## Merge of lane B, 2026-10-03

Lead: t254-lead, stage "merge". The supervisor ran `git merge --no-ff task/t193-live-self-repair` in both trees.
Downstream merged cleanly. Core had five conflicted files. I resolved them all, and nothing is staged: they
still show `UU` for the supervisor to add and commit. U = `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build`.

### Resolution decisions

- `U/phases.ts`: kept lane B's `judgedFixNamed`, which line 444's no-progress rule still calls. Dropped
  `CallHolds`, because t254's `round-funding.ts` replaces it. No other reference to `CallHolds`,
  `nextRoundHold` or `holds.*Usd` remains under `packages/fluxiq/src`.
- `U/tests/judged.test.ts`: kept t254's gate sentence ("judging its Flow takes two judge calls held at up to
  $0.008, and its first decision at least $0.001 more"). Took lane D's "The Flow so far was kept as a draft",
  which the merged `budget-exhausted.ts` now produces through `kept-said.ts`.
- `U/tests/repair-rounds.test.ts`: merged the header comment. It keeps t254's gate description and lane D's
  "ends the build not finished … never \"not doable\" (t195-w37)".
- Both `framework-reference.md` files: regenerated with `node scripts/docs-reference.mjs`, not hand-merged.
- **A semantic conflict git did not flag:** `U/tests/no-progress-ending.test.ts` (lane B, new, auto-merged)
  failed. Its "opens the one more round only if the purse funds it" case held decisions with no `price` and
  left $0.02, which was under the old gate's decision-plus-judge at $0.02. Under t254 the purse never learned
  a rate, so the gate was skipped, and $0.02 funds a round anyway. I restated the case under t254's rule:
  holds at flash peak with `price`, 750-token reserve, and $0.008 left against a need of $0.0087 (judging
  pair at the unpriced allowance 2 × $0.0039, plus the $0.0009 decision floor). Lane B's intent is kept: the
  extra round after a named fix still needs funding. The case also asserts the gate sentence.
- `.structure-baseline.json`: lowered by `pnpm structure:baseline`, because the audit reported a lowerable
  entry (`runtime/service.ts` file-lines 4419 -> 4418; 1 lowered, 0 removed).

### Checks (Core tree unless noted)

- `node scripts/docs-reference.mjs`: "Wrote … (3036 public declarations)". Then `--check`: "Deterministic
  framework reference is current." No conflict markers remain in either file.
- Combined narrow vitest, one run through heavy.sh: `npx vitest run` over llm/{harness, build-purse, tests,
  deepseek, evidence-loop, step-log, domain-instructions}, flow-bootstrap/{unfinished-build,
  generation-failure, instructed-acts, authoring}, tests/service-bootstrap, tests/recovery-default-limits.test.ts,
  result-verification, recovery/annotation, conversations, activity and flow-draft. Result before the
  no-progress fix: 245 files, 2,702 passed and 1 failed (the case above).
- After the fix, `npx vitest run …/unfinished-build`: 17 files, 129 tests passed. That includes
  `murzln6g-repair-funding.test.ts` (2) and `no-progress-ending.test.ts` (6). The failure was the only one,
  and it was in this directory, so I did not rerun the wider set.
- `pnpm --filter fluxiq check`: exit 0, both before and after the test edit.
- `node scripts/structure-audit.mjs`: "passed (233 warning(s), 349 baselined)", after the baseline update.
- `grep -rn max_tokens --include=*.ts` under automation-studio, excluding tests: the only request that
  sends it is `llm/deepseek/panel-command.ts:113`, the chat panel command, which was already an open
  supervisor decision. The other hits are comments. The build, judge and repair paths send no `max_tokens`.
- Core libraries, through heavy.sh: `node scripts/build-cache/cli.mjs contracts:build fluxiq:build
  client-gateway-websocket:build`. fluxiq was rebuilt in 44.9 s; contracts and client-gateway-websocket
  were reused from their stamps. Exit 0. Downstream `node scripts/check/core-build.mjs` reports "current
  with its source".
- Downstream tree: `pnpm --filter @fluxiq-web-extension/domain check`: exit 0. The purse types compile there.

### Not verified

- No full suites, no Lab and no live run.
- The wider narrow set was not rerun after the one-test fix. Only its directory was.
- The earlier `service-adaptation` flake noted above was outside this set, and I did not exercise it.

## Stage 2, 2026-10-03

Lead: t254-lead. This stage carries out the supervisor's four decisions on Core b5533c0c. Nothing is staged
or committed. Three workers ran in parallel, partitioned by file. Their reports are
`t254-s2-w1-panel-cap.md`, `t254-s2-w2-recovery-pricing.md` and `t254-s2-w3-judge-reserve.md` beside this
one. I reviewed each diff myself before relying on it. R = `packages/fluxiq/src/programs/automation-studio/runtime`.

### Decisions as implemented

1. **No output cap anywhere** (W1). `R/llm/deepseek/panel-command.ts` no longer sends `max_tokens`. The
   600 constant is gone; its only use was the request body, so no reserve was needed in its place. A test
   asserts that the body has no `max_tokens`, and that a 5,000-token reply is accepted and charged.
   `grep -rnE 'max_tokens\s*:|"max_tokens"|max_completion_tokens'` over `packages/fluxiq/src`, excluding
   tests, finds nothing (exit 1).
2. **Recovery prices at the billed rate** (W2). `R/recovery/annotation/run-budget.ts` takes an optional
   `now` clock (default `Date.now`). It prices its worst-case reservation through the one shared
   `estimateAutomationStudioDeepSeekCostUsd(…, atMs)`, at the rate in force, all input uncached, as the
   purse does. Recovery's charges already came from the provider's send-time, cached-input cost. W2's
   search of src found nothing else priced at peak. One comment in `R/llm/harness/provider.ts` was fixed.
   Caveat: a recovery resolved off-peak that runs on into a peak window reserves at half the rate. The
   ledger records that as a breach rather than refusing the call.
3. **Judge overshoot in the accounting** (W3). The judge call in `phases.ts` is now `judgeAccounted`. It
   reads the purse's `breaches` and `overshootUsd` across the judge's calls and adds them to the build's
   `budgetBreaches` and `budgetOvershootUsd` beside the verdict's spend. Test:
   `U/tests/judge-overshoot.test.ts` (accounting equals the purse's charged figures).
4. **The judging reserve is spent, never left** (W3). A round that ends `budget`/`cost` with
   `costRefusal.keptBackUsd > 0`, with a purse and a judge, now has its Flow so far tested from its start.
   The service hands that test to the judge (`build-judge.ts` `judgedTest()`). It is then checked by the
   new `acceptStopped`, which is the service's completion check and makes the draft the plan to build. The
   judge then rules on it through the new `U/reserve-judging.ts`.
   - A yes about that Flow's signature (the t244 rule) finishes the build.
   - Any other answer ends `budget_exhausted` at cost. The message carries the judge's finding and advice,
     the reserve's spend (`judgedUsd`) and "kept as a draft". It never says "not doable", because the cost
     ending returns before the not-doable check.
   - An empty or unreplayable draft, an unclean test, or a refused completion check is not judged, and the
     build ends at cost as before.

   Tests: `U/tests/reserve-judging.test.ts`; `judged-build.test.ts` (2 end-to-end service cases);
   `build-judge.test.ts`. murzln6g at peak now leads to judging the draft
   (`murzln6g-repair-funding.test.ts`, 3 tests). The architecture doc `llm-flow-bootstrap.md` is updated.

**Open for the supervisor (from W3):** at peak, murzln6g now re-judges a seed that round 0 already judged
no (about $0.003). A cheaper rule would end at cost with the earlier findings when the Flow's signature is
unchanged. I left it as the decision states it: the reserve is spent judging the Flow as it stands.

### Checks (Core tree unless noted)

- Wider narrow vitest, one run through heavy.sh, over llm/{harness, build-purse, tests, deepseek,
  evidence-loop, step-log, domain-instructions}, flow-bootstrap (all of it), tests/service-bootstrap,
  tests/recovery-default-limits.test.ts, result-verification, recovery (all of it), conversations,
  activity, flow-draft and service/flow-bootstrap-commands: **316 files, 3,447 tests passed**. This
  includes `murzln6g-repair-funding.test.ts` (3).
- `pnpm --filter fluxiq check`: exit 0.
- `node scripts/structure-audit.mjs`: "passed (234 warning(s), 349 baselined)". No entry was lowerable, so
  the baseline was not touched.
- `node scripts/docs-reference.mjs --check` first reported "stale", because of the new public
  declarations. I regenerated it ("3040 public declarations"), and `--check` then said "current".
- Core libraries, through heavy.sh (`cli.mjs contracts:build fluxiq:build client-gateway-websocket:build`):
  exit 0, with fluxiq rebuilt. Downstream `core-build.mjs` says "current with its source".
- Downstream tree: `pnpm --filter @fluxiq-web-extension/domain check`: exit 0.

### Not verified

- No live or Lab run, and no full suites.
- No live DeepSeek panel call.
- How a real web domain's test of the Flow so far behaves when the judging reserve stops a round.
- No test runs `annotate.ts` at an off-peak wall clock.

## Stage 3, 2026-10-03

Lead: t254-lead. Two rules settle the stage 2 notes. Nothing is staged or committed. The worker reports are
`t254-s3-w1-unchanged-not-rejudged.md` and `t254-s3-w2-recovery-per-call-price.md`. I reviewed both diffs.
R = `packages/fluxiq/src/programs/automation-studio/runtime`; U = `R/flow-bootstrap/unfinished-build`.

1. **No re-judging an unchanged Flow** (W1; `U/phases.ts`, `U/budget-exhausted.ts`).
   - "Unchanged" means the stopped round's repair seed has the same Flow signature as the test the last
     `no` judged. That is the verdict's own `flowSignature`, or else that finished round's Flow. It is the
     comparison `unchanged-complete.ts` already makes. The replay signature was not used, because it leaves
     out routing.
   - An unchanged draft runs no test and no judge call. It ends `budget_exhausted` at cost with that
     judge's findings and advice and "kept as a draft". The message says the reserve "was not spent,
     because the Flow was unchanged since the judge said it does not do what was asked". It is never "not
     doable", even when that judge said the result can no longer be had.
   - A changed draft is tested and judged as in stage 2.
   - The chat announcement for this case is W1's wording.
   - Tests: `U/tests/reserve-unchanged.test.ts` (6 cases), and the stage 2 `reserve-judging.test.ts` (5,
     unchanged). murzln6g at peak now ends at cost with round 0's finding, with no test and no second judge
     call.
   - **Open:** only a `no` from a judge in this build counts. An extend or continued-draft build whose Flow
     an earlier build's judge rejected is still re-judged. Covering that needs `R/service.ts` to pass the
     earlier verdict in.
2. **Recovery prices each call when it is made** (W2; `R/recovery/annotation/{run-budget,annotate,exploration}.ts`).
   - The budget gains `maxEstimatedCostUsdPerCallAt(atMs?)`: the same bounded expression, with the
     worst-case term priced through the shared `estimateAutomationStudioDeepSeekCostUsd(…, atMs)` at call
     time.
   - `annotate.ts` reads it for the diagnosis, re-plan and patch calls, and for the patch-reserve hold.
     Exploration takes a function and reads it once per decision.
   - The reservation itself is taken in `R/llm/harness/run.ts`, as the lower of that ceiling and the
     provider's price at that moment. run.ts was unchanged.
   - Tests in `run-budget.test.ts` and `exploration.test.ts`: a budget resolved off-peak gives the peak rate
     for a call at peak, and in the ledger, 0 breaches at the call-time figure against 1 at the old figure.
   - **Notes:** the resolve-time `maxEstimatedCostUsdPerCall` stays only because
     `R/tests/recovery-default-limits.test.ts` reads it. The patch-reserve hold is priced when exploration
     starts; the patch call reserves at its own time.

### Checks (Core tree unless noted)

- `npx vitest run` over U, R/recovery, R/service/flow-bootstrap-commands, R/tests/service-bootstrap,
  R/tests/recovery-default-limits.test.ts and R/llm/harness, through heavy.sh: **124 files, 1,075 tests
  passed**. This includes murzln6g-repair-funding (3) and reserve-unchanged (6).
- `pnpm --filter fluxiq check`: exit 0.
- `node scripts/structure-audit.mjs`: "passed (234 warning(s), 349 baselined)".
- `node scripts/docs-reference.mjs --check` first reported "stale", because of the new budget member. I
  regenerated it, and the check then said "current".
- Core libraries rebuilt (`cli.mjs contracts:build fluxiq:build client-gateway-websocket:build`, exit 0;
  `core-build.mjs` says "current").
- Downstream `pnpm --filter @fluxiq-web-extension/domain check`: exit 0.

### Not verified

- No live or Lab run, and no full suites.
- No service-level test of the unchanged-draft path.
- No annotate-level test crosses a peak boundary.

## Stage 4 (in t252), 2026-10-03

Lead: t254-lead. Tree `fxwork/t252/!FluxIQ`, branch `task/t252-general-flow-authoring-impl`, at
43d8dfba (dev, with t254, merged in). Nothing is staged or committed. One file changed:
`R/recovery/annotation/tests/iteration-guards.test.ts`.

### Cause

"holds an explore_and_adapt recovery to the run's budget" stopped at 23 calls (21 exploration) instead of 26.
No budget guard stopped it: `budgetCodes` was empty, and every request reserved exactly CEILING/26
($0.003846). Price, share and reservation, the stage 3 per-call pricing and P1 all played no part.

- **What stopped it:** a temporary log in `exploration.ts` (reverted; `git status` shows only the test
  changed) showed the 22nd decision refused unsent with `llm_budget.input_limit_exceeded` and
  `llm_budget.request_total_exceeded`: "an estimated 4045 input tokens (12134 bytes), over its 4000-token
  input limit".
- **Why only on t252:** the exploration's decision request grows with each look's evidence. The test pinned
  `tokenLimits.maxInputTokens: 4_000`. On dev the 24 decisions fit just under it. t252's ~290 extra tokens
  of evidence-decision guidance push the 22nd decision over.

### Decision

The product is right. A request larger than its declared per-call window cannot be sent, and the window is
not the run's ceiling. The test's arithmetic assumed the old prompt size.

The rewritten test derives its window from the budget:
- The share is CEILING / declared calls.
- `maxInputTokens` is the largest input whose worst case at peak, with the 1,000-token reply, stays within
  the share. Both are priced through the shared `estimateAutomationStudioDeepSeekCostUsd`, which gives
  about 8,820 tokens.
- The premise "one call at the window's limits costs no more than its share" is asserted, not assumed.
- The expectations read the declared count (`calls: declaredCalls`, `explorationCalls: declaredCalls - 2`)
  and the share, so nothing depends on prompt length.

What the test is for is kept: the run's $0.10 ceiling bounds the recovery (spend between 80% and 100% of
it), every call reserves its share rather than the resolver's $2, and a spent training budget does not stop
it.

**Noted, not changed:** a decision refused for its window ends the exploration as
`llm_evidence_loop.invalid_decision`, which reads as a bad reply rather than an oversized request. Worth a
separate look.

### Checks (t252 tree)

- `npx vitest run …/recovery/annotation/tests/iteration-guards.test.ts`: 8/8 passed.
- `npx vitest run` over R/recovery, R/llm/harness and R/flow-bootstrap (which includes unfinished-build),
  through heavy.sh: **148 files, 1,884 tests passed**.
- `pnpm --filter fluxiq check`: exit 0.
- `node scripts/structure-audit.mjs`: "passed (240 warning(s), 349 baselined)".

### Not verified

- No live run, and no full suites.
- I did not rebuild the Core libraries in t252 (only a test changed).
