# t195-w27: the service tests meet phase 2's judge

Worker report. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ`, branch `task/t195-live-control-flow`.
R = `packages/fluxiq/src/programs/automation-studio/runtime/`.

## Outcome

Done. The 12 failing service tests and the 2 judge-test pins pass. I added `R/tests/service-bootstrap/tests/judged-build.test.ts` with 5 cases. All 5 fail with the service's `judge:` argument removed and pass with it in place. No source file was edited. To run the removal check I cut `R/service.ts` once, then restored it from a backup and confirmed it byte-identical with `cmp`.

## What changed and why

**Shared helpers** (`R/tests/service-bootstrap/tests/fixtures.ts`), added at the end of the file:
- `isJudgeRequest(request)`: true when `taskKind === "loop_verification"`. The judge asks through the build's own provider.
- `JUDGE_USAGE`: 200/20/220 tokens and $0.0005.
- `judgeReply(answer = "yes", said)`: a `diagnosis` reply that sets `answersRequest`, plus any `expected`, `observed` and `changed`.

**The 12 failing tests.** In each, the fake provider records the judge's request in the same `requests` list as the decisions, so the counts are true, and answers it `yes`. Each test now expects the count and order with the judge included. No test disables the judge, and the service has no test switch.
- `extend.test.ts` (4): these failed with `flow_bootstrap.not_doable`, not on a count. An extend keeps the Flow's existing steps, and the build's test never runs them. Under the run-41 rule, a Flow with untested kept steps is proposed only on a judge's `yes`, so these builds went to repair, which returned the same Flow, and that ended "not doable". The judge's `yes` is now scripted in `serviceWithAppliedFlow`. The first case also asserts the judge was asked once, as the last request.
- `generation.test.ts` (2):
  - The bounded-loop case now expects task kinds `["evidence_tool_decision", "loop_verification"]` and accounting that adds the judge's tokens and cost.
  - The "past eight decisions" case checks the decision count against `calls`, and the total against `calls + 1` when the build finishes. The $0.25 per-request check now covers decisions only. The judge's request is pinned to half of what was left: `(0.25 - calls*0.001)/2`.
- `permission.test.ts` (1), `person-needed.test.ts` (1), `plan-parameters.test.ts` (2), `provider-unavailable.test.ts` (1), `unreadable-replies.test.ts` (1): the judge's request is now counted. The last request is asserted to be the judge's (`isJudgeRequest`, or the `loop_verification` string in person-needed, which records requests as JSON).
- None of these tests was about the instructed-act refusal that lane D removed, so no test subject was rewritten.

**`R/result-verification/build-test/tests/judge.test.ts`.** Each of verify's calls now gets half of what the build has left, so the pins moved from `0.2` to `0.1` and from `0.07` to `0.035`.

**New file `judged-build.test.ts`.** It uses a scripted provider and a stand-in shop domain that answers the dry run's `reset`, `step` and `verify` replay calls. Any request the script has no answer for throws, so a case cannot pass on an extra call it did not expect.
1. **A finished build reaches the judge with its test's observations.** The judge's request carries `buildTest` `{ kind: "build_test", test: "ran" }`. Its read step is `outcome: "replayed"`, with `observed.rows` equal to what the test read, which differs on purpose from what the exploration saw. The replays seen are exactly reset then step. Accounting includes the judge's spend, the chat shows "Judging the Flow", and it never shows "Flow not verified".
2. **Two judge `no`s start a repair round carrying the judge's account.** The first two requests are decisions, the next two are the judge. Request 5 opens the repair: its `core.resumed` entry has `code: "llm_evidence_loop.repair"`, `stopped: "judged_wrong"` and `judgement.judge` set to `{ verdict: "no", expected, observed, advice }`. The judge's words appear in no request before the repair, and the chat shows "Repairing the Flow".
3. **A repair the judge answers `yes` is proposed.** The request order is `[F,F,T,T,F,F,F,T]` (F = decision, T = judge). The last judge packet holds both reads and the pack the repair opened. Accounting covers 5 decisions and 3 judge calls, and the chat never shows "Flow not verified".
4. **No cost left.** The completion spends the build's $0.25. The judge never reaches the provider, the Flow is `proposed`, and the chat shows "Flow not verified" (phase `verifying`), with text containing "no cost left".
5. **Lane A's run 40.** The instruction is `PICKUP_CART`, copied from `live-run-drafts.ts`, because that tests folder has no barrel to import from.
   - The model makes six steps: store, type the towels, Search, the product, the size, and Add to cart. It claims `a1` on step 2 and both `a2` and `a3` on step 7, the towels' Add. That makes 7 positions: the free look is step 1.
   - The first completion is accepted. Request 8 is the judge's, and no request carries a `core.completion_check` refusal.
   - The packet has 6 steps. None of them matches `/napkin/i`, and they do name "Add to cart" and the towels.
   - The Add is `verified` and was only checked by the test, never pressed.
   - The build's own act check still lists `a3` at step 7 in `missingActs`, as information.
   - The judge says `no`, `no`, and the repair is told what it observed. The repair adds the napkins steps, the judge says `yes`, and the build proposes a Flow whose packet names the napkins.

## Commands run and observed results

All `vitest` commands ran in `packages/fluxiq`.
- `npx vitest run src/programs/automation-studio/runtime/tests/service-bootstrap src/programs/automation-studio/runtime/result-verification`
  - Before: 8 files failed, 14 tests failed, 265 passed.
  - After: `Test Files 37 passed (37)`, `Tests 284 passed (284)`.
- The same command restricted to the 7 edited files plus `result-verification/build-test`: `66 passed (66)`.
- `npx vitest run .../judged-build.test.ts`: `5 passed`.
- Removal check: I cut `judge: async ({ loop: finished, budget: left }) => ... budget: left }),` from `R/service.ts` and ran the new file. Result: `5 failed (5)`. Each failed on a missing judge request, or on the missing "Flow not verified" row in case 4. I then restored the file, and `cmp backup service.ts` printed `RESTORED-IDENTICAL`.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195-w27 tsc" npx tsc --noEmit -p tsconfig.json`: `[heavy] t195-w27 tsc holds b1`, no diagnostics, exit 0.
- `node scripts/structure-audit.mjs` (Core root): exit 1. Its only FAIL is `[file-lines] packages/fluxiq/src/programs/automation-studio/runtime/service.ts: 4510 lines exceeds the 800-line limit ... Baseline for this entry is 4491`. That file belongs to the lead and I did not change it. My files raise advisory warnings only:
  - `fixtures.ts`: 14 exported values, past the 8-value advisory threshold. I added 3 of them.
  - The tests directory: 23 source files, past the 15-file advisory threshold.

## Not verified

- No Lab, browser or real model calls, as the brief requires.
- No full suites. Only the two named directories, tsc and the audit were run.
- `packages/fluxiq/src/.../flow-bootstrap/unfinished-build/tests/judged.test.ts` and other directories outside the brief were not run.

## Open questions or contradictions found

1. **Structure audit fails on source.** `R/service.ts` is 4510 lines against a baseline of 4491, from the lead's judge wiring. `pnpm task finish` will refuse the merge until it is split or re-baselined. I touched no source.
2. **The audit's provider call count leaves out the judge.** `providerCallCount` in a build's audit detail is counted from the loop's trace (`R/service/flow-bootstrap-commands/evidence-trace.ts:232`, `providerIterations.size`). Judge calls are not in that trace. The generation test still asserts `providerCallCount: 1` after two provider calls, and it passes. The judge's tokens and cost are in `accounting`. `R/service/instruction-authority.ts:28` documents the same exclusion for the authority call, so this may be intended. Worth a decision.
3. **Run 40's reason.** With `a2` and `a3` both claimed on the towels' Add, the act check reads `a3` as `step_claimed_twice`, not `step_acts_on_another_object`, because claimed-twice comes first. The case accepts either reason. Both used to refuse the completion.
4. **Case 4's spend.** The completion's own cost takes the build to $0.251 against a $0.25 ceiling, and the loop still accepts it, recording a breach. That is existing behaviour, and the case relies on it to reach "no cost left".
