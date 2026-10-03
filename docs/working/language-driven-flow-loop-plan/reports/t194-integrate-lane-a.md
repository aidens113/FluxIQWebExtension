# t194-integrate: Core test failures after merging lane A into lane C

Worker label: t194-integrate. Tree: `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`, branch
`task/t194-live-judge-answer`, merge `58e1ff1e` (lane C parent `58e1ff1e^1`, Core dev `4895ec4f`
parent `^2`, merge base `424a70b3`). R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. All nine files fail when run alone too, so none of the failures was a load timeout. All were
real, and **every one was a stale test expectation. No product code was wrong.** The merge resolution
in `agreement.ts` is correct, and I changed no source file. Each test now asserts the combined
behaviour, which keeps both lanes' intent:

- lane A's person-readable wording for unsettled checks;
- lane C's clipped over-long diagnosis texts;
- lane C's second call that confirms a build-finishing yes.

## What changed and why (cause and fix per failure)

### 1. `R/llm/tests/diagnosis-channel.test.ts` "refuses a field Core cannot check..."

- **Cause.** Lane C's commit `3aaa8386` (C-A) changed `llm/harness/provider-result.ts` so that a diagnosis text over 500 characters is read clipped, with the warning `llm_output.diagnosis_text_clipped`, and no longer refused. Lane C updated `harness/tests/long-diagnosis-text.test.ts` but not this file, which neither lane touched. The test still expected a 501-character `observed` to be refused with `invalid_diagnosis_text`. So this failure is lane C's alone; the merge did not cause it, and it most likely fails on lane C's tip as well.
- **Fix.** The test now expects the over-long text to come back `ok`, carrying the clipped warning, at most 500 characters long and ending in `[clipped]`. I also added a check that a text which is not a string is still refused with `llm_output.invalid_diagnosis_text`. That keeps the test's purpose: the channel does not become an opening.

### 2. `R/result-verification/build-test/tests/judge.test.ts` "a no the second call did not confirm is unknown..."

- **Cause.** The supervisor's resolution of `agreement.ts` took lane A's wording ("...neither answer was that it does what was asked, nor were both that it does not..."). This lane C test still looked for lane C's old phrase "never twice that it does not".
- **Fix.** The expectation is now `stringContaining("nor were both that it does not")`. The combined wording is the intended one, because lane A's D3 review replaced exactly that sentence.

### 3. `R/result-verification/tests/agreement.test.ts` "run murwcmx2: yes, then no, is disagreed and unsure..."

- **Cause.** Same as 2. The test checked lane C's original sentence for "yes, then no" ("that it answers the request and then that it does not"). The merge reworded it in lane A's style: "the first was that it does what was asked, the second that it does not".
- **Fix.** The expectation is now `toContain("the first was that it does what was asked, the second that it does not")`. Lane A's own D3 test in the same file already bans "model", "two checks" and "status its steps earned", so the new sentence is the intended one.

### 4 to 9. One extra judge call in the service tests

Affected: `R/tests/refuted-result/tests/reauthor-service.test.ts` (2), `repair-replay-chain.test.ts` (1), and in `R/tests/service-bootstrap/tests/`: `domain-instructions.test.ts` (1), `extend.test.ts` (1), `generation.test.ts` (2) and `judged-build.test.ts` (2).

- **Cause.** Lane C's commit `781943ce` (C-H) sets `confirmAnswer: true` on every build-test judge (`result-verification/build-test/judge.ts`, line 137). Every build-finishing yes therefore costs a second `loop_verification` call. None of these files was updated by lane C; only `judged-build.test.ts` was touched at all, and that was by lane A, which added 6 lines unrelated to the call count. Each test failed on a call list or count that was short by exactly one judge call. So these failures are lane C's alone; the merge did not cause them.
- **Fix.** Each expectation now counts the confirming call, and each comment says why ("a build-finishing yes always is confirmed, murwcmx2, C-H"):
  - **`reauthor-service`:** the two `taskKinds` lists are 7 entries long, not 6. The harness answers every verification call after the second with yes, so the order is two refuting no answers, two decisions, then yes, confirming yes, and the repaired run's yes.
  - **`repair-replay-chain`:** the call list is 8 entries long, not 7. `calls[5]` and `calls[6]` are both build-test judge calls, and both now must contain `buildTest`. The repaired run's judge is now `calls[7]`, so the Beta and Gamma checks moved from `calls[6]` to `calls[7]`.
  - **`domain-instructions`:** the judge pattern is `[false,false,true,true]`.
  - **`extend`:** there are 2 judge requests, and the last request is still the judge.
  - **`generation`:**
    - the task list is decision, decision, verification, verification;
    - requests number `calls + (finishes ? 2 : 0)`;
    - accounting includes 2 × `JUDGE_USAGE` in tokens and cost;
    - the audit detail has `additionalProviderCallCount: 2` and `totalProviderCallCount: 4`, which counts the confirming call as a call outside the loop, as t195-w28b does.
  - **`judged-build`:** the scripted judges answered `["yes"]` and `["no","no","yes"]`, so the confirming call ran past the end of the script. The harness threw, and verify read the throw as an unavailable second call, which leaves the yes standing. The test at line 306 (lane A's run-40 test) passed only because of that throw. All three scripts now answer the confirming call with a real yes: `["yes","yes"]` and `["no","no","yes","yes"]`. The judge patterns, the accounting (2 × and 4 × `JUDGE_USAGE`) and the comment "it said yes, so it was not asked again" are updated to match. A thrown script error should not stand in for the behaviour under test.

## Commands run and observed results

All were run from `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ` or `packages/fluxiq`, through `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-integrate ..."`.

1. **Each file alone, before any fix** (`npx vitest run <file>`): all 9 exited 1, with the same assertion failures the supervisor listed. Collection took 10 to 63 s and no test timed out, so these were real failures, not load timeouts. For example:
   - diagnosis-channel: 1 failed, 7 passed;
   - extend: 1 failed, 4 passed, 99 s in total.
2. **Each file alone, after the fixes:** 8 exited 0. `generation` exited 1, first on the accounting tokens and then on the audit call counts, both caused by the extra judge call. After fixing those, it ran alone again: `Test Files 1 passed (1) / Tests 8 passed (8)`.
3. **All nine together** (`npx vitest run <all nine files>`): `Test Files 9 passed (9) / Tests 79 passed (79)`, in 27.32 s.
4. `pnpm --filter fluxiq check`: exit 0, with a build-cache rebuild because "inputs changed: packages/fluxiq".
5. `node scripts/structure-audit.mjs`: `structure-audit: passed (224 warning(s), 349 baselined).`, exit 0.
6. `node scripts/docs-reference.mjs --check`: `Deterministic framework reference is current.`, exit 0.

## Not verified

- **Lane C's tip.** I did not check out lane C's tip to confirm that failures 1 and 4 to 9 already fail there. That conclusion rests on the diffs: neither lane changed those tests, and lane C's commits `3aaa8386` and `781943ce` brought in the behaviour they contradict.
- **The rest of the touched directories.** I ran only the nine named files. Other tests in those directories that script a single judge yes could still pass only because the confirming call throws and is read as unavailable, as the run-40 test did. I did not search for them.
- **Full suites.** None were run, as the brief asked.

## Open questions or contradictions found

- **Lane C's own validation.** Lane C's round 1002-M did not update the service-bootstrap and refuted-result tests, or `diagnosis-channel.test.ts`, for its own C-A and C-H changes. Its narrow checks evidently did not include those directories. This is worth noting in the lane C ledger entry.
- **A silent fallback in scripted harnesses.** When a scripted judge runs out of answers, it throws, and verify reads that as an unavailable second call, so a confirmed-yes test can pass without the confirmation ever happening. A fixture-level guard that fails the test when a script is exhausted would surface this. I did not add one, because it is outside this brief.

## Follow-up round (supervisor: 7 more failures in the full touched set)

### Outcome

Done. The supervisor's whole touched set now passes, as do the check, the audit and the docs check. As before, I changed no product code; only tests changed.

### What changed and why

**`src/ui/activity-action/tests/action-of.test.ts` "names a test run's list read by what it reads".** Both lanes fixed the same complaint, that a step the build's test ran read as a bare "Test run":

- **Lane C (UI-1/UI-2, test only).** It kept the kind `test` and added the target, expecting `["test", "name, price and rating", ...]`. Lane C did not change `action-of.ts` for this; it changed only the recall kind.
- **Lane A (D4, source and tests).** It changed `action-of.ts` so that a test-run step (a `verifying` tool row that is not a Core tool) is named by its action and marked `testing: true`. Lane A also deliberately changed its existing tests from `test` to `click`.

Lane A's rule is the intended one. It is the source change, it covers lane C's goal (the read is now named by what it reads), and lane A's D4 tests require it. I left the source alone and changed the expectation to `["read", "name, price and rating", "done", ""]`, with `testing === true`.

**Confirming judge call, in five more service-bootstrap files.** Same cause as failures 4 to 9 above: lane C's `confirmAnswer: true` on the build-test judge. I updated each request count and judge pattern, and each comment, to include the confirming call:

- **`permission.test.ts`:** 4 requests become 5, and the pattern ends `true, true`.
- **`person-needed.test.ts`:** 3 requests become 4, and `requests[3]` must also be a `loop_verification`.
- **`plan-parameters.test.ts`:** 3 becomes 4 and 4 becomes 5, with the patterns to match.
- **`provider-unavailable.test.ts` and `unreadable-replies.test.ts`:** 5 requests become 6, and the pattern ends `true, true`.

**Tests that passed only because the script ran out on the confirming call.** I searched for these with a probe, not by reading files:

- **The probe.** I added a temporary line to `result-verification/verify.ts` that logged the test file, the test name, and the basis and verdict of every second call that confirms a first yes. I ran it over the whole set (301 files) and over 63 more candidate files outside it. I then restored `verify.ts` from a copy; `git diff --quiet` confirms it is identical to HEAD and no probe line remains.
- **What it found.**
  - Every confirming call in the service, refuted-result, deepseek-bootstrap and conversations tests got a real `model/answers`.
  - The only confirming calls without a real answer were six in `result-verification/build-test/tests/judge.test.ts`. Two of them (one silent, one unavailable) are the deliberate tests "yes, then unknown or a call that did not come back" and "a confirming call the purse refuses".
- **Fixed.** Two tests in `judge.test.ts` scripted `["yes"]`, so their confirming call read as silent: "run 38 (C7)", which even asserts `seen` has length 2, and "a reply allowance a resolver named smaller...". Both now script `["yes", "yes"]`.
- **Earlier round.** The `judged-build.test.ts` scripts were already fixed then.
- **Where I looked outside the set.** I grepped every test under `R/**/tests/**` and `R/tests/**` for `generateFlowBootstrapAdaptation`, `extendFlow`, `build_and_adapt`, `automationStudioBuildTestJudge` and `confirmAnswer`, and for the judge-scripting helpers. Together with the earlier grep, that gave these candidates outside the set: `conversations/`, `llm/deepseek/tests/system-prompt.test.ts`, `llm/step-log/`, `result-check-authorization/`, `service/flow-settings/`, `tests/service-adaptation/`, `tests/llm-deepseek-flow-bootstrap.test.ts`, `tests/completed-llm-evidence.test.ts`, `tests/service-flows/` and `tests/adaptive-orchestrator.test.ts`. With the probe on: 63 files passed, 383 tests. Seven confirming calls happened, all in `conversations/commands/tests/extension-chat.test.ts`, and all got a real `answers`.

### Commands run and observed results (follow-up)

1. **Full set with the probe** (`npx vitest run <supervisor's 16 R directories> src/ui/activity-action/`), after the action-of fix: `Test Files 5 failed | 296 passed (301); Tests 6 failed | 3329 passed (3335)`. The 6 failures were exactly the five service-bootstrap files above, all short by one call.
2. **Candidates outside the set, with the probe:** `Test Files 63 passed (63); Tests 383 passed (383)`.
3. **Full set, final, probe removed:** `Test Files 301 passed (301); Tests 3335 passed (3335)`, in 147.93 s, exit 0.
4. `pnpm --filter fluxiq check`: exit 0.
5. `node scripts/structure-audit.mjs`: `structure-audit: passed (224 warning(s), 349 baselined).`
6. `node scripts/docs-reference.mjs --check`: `Deterministic framework reference is current.`

### Not verified (follow-up)

- **The rest of `R`.** I did not run the R test files outside the supervisor's set and the 63 candidates. Of 531 R test files, 364 ran. The rest match none of the build-entry or judge-script patterns.
- **Full package suites.** Not run.
