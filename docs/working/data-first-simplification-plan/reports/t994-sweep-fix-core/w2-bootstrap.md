# t994 W2: bootstrap, build and re-author sweep failures

## Outcome

Partial. I found the causes and applied every edit for all 34 real-sql files and both parallel files. The final real-sql confirmation run had only just taken its heavy slot when I was told to hand back, so it never finished.

What has been confirmed by an actual run:
- The parallel group's `refusing-codes` file passes.
- In the baseline run, which already picked up some of these edits, `request-prefix`, `repaired-run-rows`, `repair-followups`, `person-project`, `flow-call-limit`, `candidate-describe-call`, `catalog`, `domain-instructions`, `state-digest-and-trace`, `caller-paid-reauthor-check` and `deepseek exploration` passed.

Nothing else has been re-run since its last edit.

## Cause clusters

### A. One extra paid call when a build starts (t976, b2ee9ed45; the main cluster)

**Cause.** `service.ts` now calls `automationStudioAnswerFirstPermissionForBuild` for every build that does not start from a chat: legacy, candidate, project, extend and re-author builds. That function moves the build's instruction reading (`instruction-authority.ts`, `metadata.source: "instructionAuthority"`, no tools) from the first lasting step to the start. The rule behind it: one permission question when a Flow or chat starts, never mid-Flow (user, 2026-11-03 and 2026-11-10).

Tests that script the model's replies by call number now see that reading as their first call. It takes reply 1, so every later reply shifts by one. That explains the request counts that are one too high, the step counts that are one too short, the "Flow Bootstrap generation failed" and `evidence_budget_exhausted` endings, the doubled accounting, and the timed-out re-author and person-needed tests.

**Fix.** Tests only, updated to the new contract. I added one shared helper, `framework/automation-service/tests/service-bootstrap/tests/instruction-reading.ts`, which exports `automationStudioAnsweringInstructionReading(runTask, usage)`. It answers the reading as "nothing lasting is asked for" at a usage the test chooses, and passes every other request to the test's own script. This is the same answer existing passing tests already give inline (judged-build, domain-hooks, build-call-admission).

Where a test checks accounting, the expected numbers now include the reading's usage, stated as arithmetic and cited to t976.

Two tests needed more than the wrapper:
- `judged-build`, "completion readiness": the reading counts against the build's call allowance, so `FLUXIQ_LLM_BUILD_CALL_LIMIT` and `maxCallsPerRun` go from 4 to 5. That keeps the same two decisions plus the two judge calls held back. **Please confirm this is acceptable, not a raised cap.**
- `creation-spend (f)`: the reading can no longer be refused mid-build because it now happens at the start. The test is retitled, and now asserts one reading at the start, one press, the run ending on cost, and no question asked mid-Flow.

**Files (tests):**
- `service-bootstrap/tests/`: `accounting`, `catalog`, `creation-spend`, `domain-instructions` (the reading is listed and checked to carry the domain's instructions; it does), `extend`, `flow-call-limit`, `generation`, `incomplete-draft`, `judged-build`, `person-needed`, `plan-parameters`, `provider-unavailable`, `rejections`, `state-digest-and-trace`, `unfinished-build`, `unreadable-replies`.
- `service/datasets/tests/repaired-run-harness.ts` (fixes `repaired-run-rows` and `repair-followups`).
- `service/project-build/tests/project-build-facade.test.ts`.
- `service/flow-bootstrap-commands/tests/`: `candidate-describe-call`, `candidate-generation`, `candidate-tool-cards`, `candidate-unusable-reply`, `service-cancellation`.
- `service/tests/provider-unavailable-authoring-modes.test.ts`.
- `tests/refuted-result/tests/`: `reauthor-service`, `repair-replay-chain` (the reading is answered inside their DeepSeek fetch stubs).
- `tests/service-adaptation/tests/caller-paid-reauthor-check.test.ts`.
- `programs/automation-studio/api/tests/service-bootstrap-adaptation.test.ts`.
- `deepseek-bootstrap/tests/harness.ts` (`READING_BILLED` and a `readings` count).
- `runtime/llm/evidence-loop/tests/request-prefix.test.ts`.

### B. One fixed starting model, Haiku (U1, t983, 002650596)

**Cause.** When nothing names a model, `role-routing/resolution.ts` and `task-model/resolve.ts` now ask for `claude-haiku-5-5`, or DeepSeek only when the provider is named `deepseek`. Test harnesses that wire a DeepSeek session key and DeepSeek's endpoint therefore fail with `provider_secret_unavailable` and make zero requests: deepseek-bootstrap, request-prefix, reauthor-service and repair-replay-chain. Resolver-input assertions also gain `modelId`: generation "builds with no grant" and caller-paid-result-check.

**Fix (tests).** These harnesses now save `llmProvider: "deepseek", llmModel: "deepseek-flash"` on the Flow. The resolver-input assertions expect `modelId: "claude-haiku-5-5"`.

**Fix (product, `runtime/adaptation/recovery/annotation/annotate.ts`).** The run's diagnosis and patch recovery called the host resolver with no model. A run that names no model was therefore repaired on the host's default (DeepSeek-flash) while its judge asked for Haiku: two models in one task, against U1 ("judge stays on same model ... its repairs ... likewise"). caller-paid-result-check showed this: one resolver input without `modelId`, the other with Haiku. Recovery now resolves through `automationStudioLlmRoleRoutedResolution`, the same starting model the build and judge use.

Two tests that were passing but drive recovery on DeepSeek with no model named would break under this change. They now name DeepSeek: `tests/deepseek-recovery-requests.test.ts` (policy metadata) and `tests/service-adaptation/tests/iterating-recovery.test.ts`. **Neither has been run since the edit.**

### C. Failed calls with no reported usage settle at $0 (t966, 89e40b545)

**Cause.** The harness now settles a failure that reported no usage at zero, never at its hold. In `refuted-result-port`, the timed-out first build therefore cost $0, and an unpriced timeout is no longer an "unreported zero charge".

**Fix (test).** The second build expects the full ceiling and `spentUsd: 0.01`. The `reported=false` case now produces its unreported zero from an unpriced provider's answered call with no usage, followed by a timeout, so the property "an unreported part refuses another paid build" is still tested. I also removed an `as never` cast I had added (structure audit).

### D. New result code (t987/P6, c0244a44d)

`core.result.semantic_evidence_missing`: a yes whose evidence has a gap is held `model_unconfirmed`, so it does not fail the run and gets no repair. `refusing-codes.test.ts` now lists it under UNVERIFIED. Passed.

### E. Service-profile IAM for a paired browser (t950, d73bca654)

On `service`, a paired browser is now decided by its person's policies narrowed by FluxIQBrowserSession, not by the permissions it carries. `person-project.test.ts` now uses a separate reader person whose policy is read-only on `service` and whose permissions are `programs.read` on `local`. Passed (18/18).

## Commands run and observed results

- `node .../heavy-slot.mjs run t994-w2 -- node ../../scripts/vitest-groups.mjs --groups=parallel <refuted-result-port> <refusing-codes> --maxWorkers=1 --minWorkers=1 --fileParallelism=false`: refusing-codes 8/8 passed; refuted-result-port 2 failed of 41. That was before the t966 test update, which has not been re-run.
- Baseline real-sql run of all 34 files: 23 files failed, 11 passed; 69 tests failed, 158 passed. Some of my edits landed mid-run, so this is not a clean baseline.
- `node scripts/structure-audit.mjs` (Core root): first 2 violations, both mine (a 26th file in `tests/`, and the `as never` cast). Both fixed, then `structure-audit: passed (570 warning(s), 903 baselined)`.
- Final confirmation real-sql run (`w2-run2.txt`, the 34 files plus deepseek-recovery-requests and iterating-recovery): it had just taken its slot at hand-back and no results were recorded.

## Not verified

- Every file edited after the baseline: all of service-bootstrap except catalog, domain-instructions, state-digest and flow-call-limit; the candidate tests; service-cancellation; provider-unavailable-authoring-modes; project-build-facade; reauthor-service; repair-replay-chain; caller-paid-result-check; service-bootstrap-adaptation; and the parallel `refuted-result-port`.
- The accounting numbers I computed are estimates and may need adjusting after a run: rejections 40/20/60/$0.004, candidate-generation 460/70/530/$0.007, candidate-unusable-reply, and service-bootstrap-adaptation's second accounting check at line ~355, which may also need +90/+100.
- deepseek-bootstrap `answerability`: the judges read 7 build-test steps where 6 were expected. The cause is not yet diagnosed. I put a debug print in the harness, then removed it before it could run.
- `provider-unavailable-authoring-modes` "answers nothing": with the reading now answered, `providerResponse` may come back as "received".
- The two recovery tests affected by the annotate change, and any other recovery test it affects.
- No typecheck was run.

## Open questions or contradictions found

1. t976's start reading is one extra paid call for every non-chat build, even one whose tools can only observe. A product decision for W1 or the lead: should the start reading be skipped when the bound tools cannot cause lasting consequences?
2. U1 gap, in W3's area: `role-routing/judge-model.ts` does not handle a Flow that names `llmProvider: "deepseek"` without `llmModel`. It returns Haiku while `providerId` is `deepseek`, so `assertAutomationStudioLlmModelBinding` throws. `resolution.ts` handles this case. Proposed fix: in `automationStudioLlmRunJudgeModelId`, take the provider and return `"deepseek-flash"` when it is `"deepseek"`.
3. t966 settles a timeout with no usage at $0. A provider can still bill a request whose reply never arrived, so a timeout may not truly cost nothing. Flagging this; I did not change it.
4. The judged-build call-limit change from 4 to 5 (cluster A) needs the lead's sign-off.

## Continuation after the supervisor's message (round 2)

- Moved the helper to `tests/service-bootstrap/tests/instruction-reading.ts`, fixed my `as never` cast, and re-ran `node scripts/structure-audit.mjs` -> `structure-audit: passed (570 warning(s), 903 baselined)`.
- `judged-build` call limit from 4 to 5. The refused-draft test now counts the reading and asserts `expect(run.readings()).toBe(1)` next to the existing `expect(run.requests.map(isJudgeRequest)).toEqual([false, false])` and the diagnostic's `ending: { kind: "budget_exhausted", bound: "calls" }`. Together these show the build stops on its call limit at the same point as before: two decisions, the two judge calls kept back, and now the reading counted too.
- A temporary, env-gated debug print (`W2DBG`) is back in `deepseek-bootstrap/tests/harness.ts` to dump the judge's build-test steps for the answerability 7-vs-6 question. **Remove it before this is committed** (the line beginning `if (process.env.W2DBG)`).
- Batch 1 started: the 20 files outside service-bootstrap, including `deepseek-recovery-requests` and `iterating-recovery`. Output: `C:/Users/osrs_/AppData/Local/Temp/claude/bc302d3e1bd85154/b9e846ce-920f-4917-ba85-cff713b3e423/scratchpad/w2-b1.txt`, which ends with `BATCHDONE` when finished. It had taken a heavy slot but had reported no file result when the hand-back was forced again. Batch 2 (the 16 service-bootstrap files, list in `w2-batch2.txt`) and the parallel `refuted-result-port` have not been run.
