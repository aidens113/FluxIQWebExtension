# t994 W2b: finishing the bootstrap sweep failures

## Outcome

Partial. 37 of W2's 38 files pass on the final tree. `node scripts/structure-audit.mjs` passes, and no debug lines are left.

The one file still failing is `deepseek-bootstrap/tests/answerability.test.ts` (2 of 3 tests). Its cause is a real product regression from t981. The fix belongs in `runtime/flow-authoring/draft/amendment/**`, which I must not touch, so it is proposed below as a diff. A temporary probe in my own file confirmed the diagnosis: forcing exactly that withdrawal made all 3 tests pass, and the probe has since been removed.

## Per remaining failure

### 1. candidate-unusable-reply (3/3 failing, now 3/3 passing)
- **Cause:** two contract changes.
  - The start reading (t976, b2ee9ed45) is a paid call that counts in the build's accounting. W2 wrapped the reading but never added its cost to the expected figures.
  - Under t966 (89e40b545), a failed call that reported no usage settles at $0 rather than at its hold.
- **Fix (test, rules cited inline):**
  - Every expectation adds `READING_USD`: 6×→+R, `(1+bound)*D + R`, accounting 30/15/45, `2*D + R`.
  - The purse after a provider throw is now `2*D + R`, not `3*D`. The comment now cites t966: "the purse holds exactly what the failure reports".
  - The sweep log agrees. Before W2, case 3 already failed with `0.002 vs 0.003` (t966). Cases 1 and 2 passed only by coincidence, because the unwrapped reading consumed script reply 1.

### 2. provider-unavailable-authoring-modes (2/7 failing, now 7/7 passing)
- **Cause:** W2's wrapper answered the start reading. In the "answers nothing" case a reply therefore did arrive, and `flowBootstrapProviderReplyArrived` correctly said `received`, because it counts the instruction reading. The test's claim, "the provider answers nothing", had become false.
- **Evidence:** a probe that left the reading unanswered gave: 4 requests (the reading, then 3 decisions), `provider_unavailable`, `not_received`, and an ending message identical to `SILENT_ENDING`.
- **Fix (test):**
  - `build` now passes every request, the reading included, to the case's `answer`. Decisions are counted in `requests` and readings separately.
  - The silent and unreachable cases leave the reading unanswered, and the silent case asserts `readings() === 1`.
  - The "a reply arrived" case and the supervisor case answer the reading through `answeringReading`.
- **Observation:** in the unreachable case the reading is sent 3 times, because the harness retries network errors. That adds about 16 s per mode, inside the 60 s limit. I do not assert that count.

### 3. reauthor-service, "does not leak private retention…" (1/9 failing, now 9/9 passing)
- **Cause:** U1 (t983, 002650596). The second Flow named no model, so it resolved to Haiku, which the harness's DeepSeek key cannot pay for. Its generation therefore failed before it reached the provider, and `flow_bootstrap` never appeared in `taskKinds`.
- **Fix (test):** the second Flow names `llmProvider: "deepseek", llmModel: "deepseek-flash"`, like the harness's own Flow (W2's cluster B), with the citation added.

### 4. service-bootstrap-adaptation (1/9 failing, now 9/9 passing)
- **Cause:** t976. The stored proposal's `metadata.bootstrap.accounting` includes the reading (990/1100). W2 had already updated the first accounting check but not this one at line ~358.
- **Fix (test):** `900 + 90`, `1000 + 100`, with the citation.

### 5. answerability (2/3 failing, still failing; the cause is outside my paths)
- **Symptom:** the judges read a build test of 7 steps instead of 6, `[1 area.rerun.7, 2..6, 7 area.1]`. The extra 7th step is the attempt that the rerun at decision 7 replaced. It stayed in the Flow, at its end.
- **Breaking commit:** 258f83958 (t981, "refuse repeat-breaking amendments before save"), in `runtime/llm/evidence-loop/rerun/replacement.ts`.
  - That commit moved the loop's internal `drop` of the replaced attempt to after the rerun takes its place and the attempt moves to the end.
  - `applyAutomationStudioFlowDraftAmendments` then runs its strand check on that drop. `reach.ts` reads where a step left the target from the step appended after it. The rerun was appended last, so it appears to move nothing.
  - The test's start is now the rerun's page. The attempt at the end looked like the only way to step 2's page, so the drop was refused `strands_a_step` and put back.
  - Probe output: `{"applied":0,"refused":[{"step":7,"reason":"strands_a_step","strands":2}]}`, with all 7 steps `kept`.
  - Before t981 the drop ran while the attempt was still step 1 and the rerun was not yet kept. The attempt was then the Flow's start, so the check never fired. That was luck, not design: a rerun of a middle step that moves pages hits the same refusal under either order.
- **Impact (product):** a Flow keeps the replaced attempt as an extra last step, so it runs again after every other step. If that step is a lasting act, the act repeats.
- **Confirmation:** a temporary probe in replacement.ts forced the refused drop through. With it, answerability passed 3/3 (run 2 below). The probe has been removed, and `git status` shows replacement.ts unchanged.
- **Proposed diff** (`runtime/flow-authoring/**` is must-not-touch for me):
```diff
--- runtime/flow-authoring/draft/amendment/apply.ts
-  options: { claimRefused?: AutomationStudioFlowDraftClaimRefused | undefined; loopNeverEnds?: AutomationStudioFlowDraftLoopNeverEnds | undefined } = {}
+  options: { claimRefused?: AutomationStudioFlowDraftClaimRefused | undefined; loopNeverEnds?: AutomationStudioFlowDraftLoopNeverEnds | undefined;
+    /** The loop's own withdrawal of the attempt a rerun replaced (`../../../llm/evidence-loop/rerun/replacement.ts`). */
+    withdrawsReplacedAttempt?: boolean | undefined } = {}
@@
-  const reach = automationStudioFlowDraftStrandCheck(steps, reachBefore, withdrawn, shown);
+  // The attempt a rerun replaced strands nothing: the rerun is the same step corrected, standing where it stood. Reach
+  // cannot see that (where a step left the target is read off the step appended after it, and the rerun was appended
+  // last), so the check would put the attempt back at the Flow's end, where it runs again after every other step (t994).
+  const reach = automationStudioFlowDraftStrandCheck(steps, reachBefore, options.withdrawsReplacedAttempt ? [] : withdrawn, shown);
--- runtime/llm/evidence-loop/rerun/replacement.ts   (takesItsPlace branch, the last drop)
-  applyAutomationStudioFlowDraftAmendments(steps, [{ step: replaced.position, change: "drop" }]);
+  applyAutomationStudioFlowDraftAmendments(steps, [{ step: replaced.position, change: "drop" }], { withdrawsReplacedAttempt: true });
```
  Also add a case to `runtime/llm/evidence-loop/tests/rerun-replacement.test.ts`: steps carrying `replay.from` pages so that the attempt is the only mover to the next step's page. The attempt should end `dropped`, and the rerun `kept` in its place.
  - Repeat-hold, span settling, reversals and loop-covered settling stay as t981 left them. Only the strand check is skipped, and only for this one internal call.
  - I did not apply the replacement.ts half alone, because it would not typecheck without the new option.

### Also done
- Removed the `W2DBG` debug line from `deepseek-bootstrap/tests/harness.ts`.
- W2's batch 2 had failures beyond what W2 recorded. All were fixed as test updates:
  - `generation.test.ts`: accounting includes the reading, and the audit's `additionalProviderCallCount`/`totalProviderCallCount` are +1 (t976). The resolver input already had `modelId` from W2.
  - `extend.test.ts`: the resolver input gains `modelId: "claude-haiku-5-5"` (U1, t983).
  - `provider-unavailable.test.ts`: same issue as item 2. The silent case now leaves the reading unanswered and asserts `readings() === 1`, with a `readingAnswered` option on `build`.
  - `unreadable-replies.test.ts`: the cost is `0.012 + USAGE.estimatedCostUsd`, the readable reading (t976).

## Files changed (all under `C:/Users/osrs_/FluxStuff/fxwork/t994/!FluxIQ/packages/fluxiq/src/`)
- `framework/automation-service/service/flow-bootstrap-commands/tests/candidate-unusable-reply.test.ts`
- `framework/automation-service/service/tests/provider-unavailable-authoring-modes.test.ts`
- `framework/automation-service/tests/refuted-result/tests/reauthor-service.test.ts`
- `programs/automation-studio/api/tests/service-bootstrap-adaptation.test.ts`
- `framework/automation-service/tests/service-bootstrap/tests/{generation,extend,provider-unavailable,unreadable-replies}.test.ts`
- `framework/automation-service/tests/deepseek-bootstrap/tests/harness.ts` (debug line removed)
- Temporary only, since removed: `service/tests/w2b-probe-silent-reading.test.ts` was deleted, and replacement.ts was restored byte-identical from my backup.

## Commands run and observed results
All test runs were from `packages/fluxiq`, in the foreground, using `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t994-w2b -- node ../../scripts/vitest-groups.mjs --groups=<g> <files> --maxWorkers=1 --minWorkers=1 --fileParallelism=false`. Output is in `C:/Users/osrs_/AppData/Local/Temp/claude/bc302d3e1bd85154/b9e846ce-920f-4917-ba85-cff713b3e423/scratchpad/w2b-runN.txt`.

Diagnostic runs:
- run1 (probe + answerability + candidate-unusable): `2 failed | 1 passed (3)` files. These are the probes cited above.
- run2 (real-sql, answerability with `W2BPROBE2` forcing the refused drop, plus 4 others): answerability 3/3 passed. provider-unavailable-authoring-modes failed 2 tests, on my own `readings()===1` assertion in the unreachable case, which I then removed. Overall `Tests 2 failed | 29 passed (31)`.

Final results:

| Run | Group | Files | Result |
| --- | --- | --- | --- |
| run3 | real-sql | service-bootstrap batch 2, part 1 | `6 passed, 2 failed` files. `extend` and `generation` failed and were fixed, then confirmed in run5. accounting 13, catalog 3, creation-spend 8, domain-instructions 4, flow-call-limit 1, incomplete-draft 4 all passed. |
| run4 | real-sql | service-bootstrap batch 2, part 2 | `6 passed, 2 failed` files. `provider-unavailable` and `unreadable-replies` failed and were fixed, then confirmed in run5. judged-build 10, person-needed 4, plan-parameters 9, rejections 17, state-digest-and-trace 3, unfinished-build 5 all passed. |
| run5 | real-sql | generation, extend, provider-unavailable, unreadable-replies, provider-unavailable-authoring-modes | `Test Files 5 passed (5)`, `Tests 26 passed (26)` |
| run6 | parallel | refuted-result-port, refusing-codes | `Test Files 2 passed (2)`, `Tests 49 passed (49)` (41 + 8) |
| run7 | real-sql | repaired-run-rows, candidate-describe-call, candidate-generation, candidate-tool-cards, candidate-unusable-reply, service-cancellation, project-build-facade, repair-followups | `Test Files 8 passed (8)`, `Tests 56 passed (56)` |
| run8 | real-sql | answerability, exploration, reauthor-service, repair-replay-chain, caller-paid-reauthor-check, caller-paid-result-check, person-project, service-bootstrap-adaptation | `Test Files 1 failed, 7 passed (8)`, `Tests 2 failed, 60 passed (62)`. Only answerability failed, `[7,7,7,7]` vs `[6,6,6,6]` at lines 93 and 200. |
| run9 | real-sql | request-prefix, iterating-recovery | `2 passed (2)`, `Tests 5 passed (5)` |
| run10 | parallel | deepseek-recovery-requests (untagged), rerun-replacement | `2 passed (2)`, `Tests 25 passed (25)` |
| run11 | real-sql | provider-unavailable, after a one-statement-per-line fix | `1 passed (1)`, `Tests 3 passed (3)` |

Other checks:
- `node scripts/structure-audit.mjs` (Core root):
  - First run: one violation, mine (statement-packing in provider-unavailable.test.ts line 85).
  - After the fix: `structure-audit: passed (570 warning(s), 903 baselined).`
- `grep -rn "W2DBG\|W2BPROBE" packages/fluxiq/src`: 0 lines.

## Not verified
- No typecheck was run (the daily allowance). vitest does not typecheck.
- Each batch-2 file was confirmed in the run after its own last edit (run3/run4, or run5 for the four that changed). The batch was not re-run as a whole on the final tree.
- The proposed answerability diff has not been applied or run. Its effect was checked only through an equivalent probe that forced the drop.

## Open questions or contradictions found
1. **The answerability regression is a real product bug:** a replaced rerun attempt stays in the Flow and runs again at its end. Whoever owns `runtime/flow-authoring` (W3, or the lead) should apply the diff above, and then answerability should pass.
2. W2's open questions still stand:
   - judged-build's call limit 4 to 5 needs sign-off.
   - A read-only build still pays for a start reading.
   - A timeout that reported no usage settles at $0 (t966).
   - `judge-model.ts` behaviour for DeepSeek with no model named. The supervisor reports this was changed.
3. A network error on the start reading is sent 3 times, presumably the harness retrying it. A timeout is sent once. I observed this but did not investigate it.
