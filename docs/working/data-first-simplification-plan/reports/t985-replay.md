# Saved replay continuity progress

2026-11-22: lead read F4/F18/F23/F24 campaign findings and traced the F24 production cause to completion/replay-stands.ts. It unconditionally rejects any retries > 0, including a successful unchanged replay, and tests explicitly required a judge for that case. F18 already has t972 person-cleared coverage; F4/F23 need deeper recorded-path diagnosis.

Lead implemented the independent F24 subset in two Core completion files plus saved-flow-defects architecture documentation. Historical step_retried remains readable; new decisions no longer emit it. Failed/incomplete/repaired/rerouted/shape-changed/unproven cases keep their independent checks. Added successful retry completion tests for counts 1 and 3 and retained negative failure/incomplete assertions.

Validation: `git diff --check` -> exit 0. `pnpm --filter fluxiq exec vitest run src/framework/automation-service/service/answer-first/completion/tests/replay-on-record.test.ts --maxWorkers=1 --minWorkers=1 --fileParallelism=false` -> 1 file, 12/12 tests passed, 51.93 seconds. Package typecheck, audit and parent sync are pending. No acceptance claimed. No paid calls, browser run or full suite. Remaining P5 diagnosis/repair persistence is not implemented.

## Lead screened F23 artifact inspection, 2026-11-22

Canonical step metadata confirms main.s5 has three web.target.not_found failures (0245-0247), then an ended step (0248). These flow-step folders contain meta.json only, so they do not establish the exact reacquire branch or target identity. The entry points to the t960 campaign-b bundle; that bundle itself holds minimal run status and cost snapshot. Its sibling attempts/run-mwov0vf8-41ab862a/attempt.json has the four attempt summaries. Lead compared digests without printing raw recordings: each successor loaded its predecessor digest. Attempt 2 saved a changed digest, attempt 3 kept that digest, and attempt 4 saved another changed digest. Therefore the broad claim that no repairs were ever persisted is unsupported; the particular failing step/semantic repair remains to reconstruct. Statuses were achieved, achieved, budget_out, budget_out; saved state/trust remained partly_works/unproven. Per-attempt modelCalls fields are null and must not be counted as zero. Original artifacts untouched; no browser/model execution.

## Lead combined replay regression, 2026-11-22

After merging accepted permission source a4baa606b, gated `pnpm --filter fluxiq exec vitest run src/framework/automation-service/service/answer-first/completion/tests/replay-on-record.test.ts src/framework/automation-service/service/answer-first/attempt/tests/draft-save.test.ts src/engine/automation/tests/person-needed.test.ts src/engine/automation/tests/person-cleared.test.ts src/framework/automation-service/service/answer-first/flow-run/tests/steps-ran-interruption.test.ts --maxWorkers=1 --minWorkers=1 --fileParallelism=false` in paired Core passed **5 files, 55/55 tests, 95.33 s**. This independently covers F24 completion plus existing F4 duplicate-loop and F18 person-clearance regressions. It does not establish F23 exact recorded root cause or four-attempt browser acceptance. No source edits after this snapshot.

## Lead synced-parent checks, 2026-11-22

Merged accepted fixed-model dev into both t985 trees. Gated pnpm --filter fluxiq check -> exit 0, 100,501 ms. Gated node scripts/structure-audit.mjs -> exit 0, 564 warnings / 909 baselined. F24 source remains unchanged from the earlier 55/55 combined regression; package checks now include P4. F26 is covered by accepted t981 repeat-safe repair; exact recorded four-attempt acceptance remains with the shared offline-proof lane. F23 historical identity/source artifacts remain insufficient; no guessed persistence patch was made. This checkpoint does not claim complete P5 or browser acceptance.

## Further screened F23 amendment reconstruction, 2026-11-22

Canonical decision/result JSON files exist even though failed Flow-step folders contain only metadata. The final numbered amendment at 0509 requests a rerun of draft step102 with an extractList patch; 0510 reports draft_rerun, zero applied/refused ordinary amendments, targeted d102, and revision5->6. That zero ordinary-amendment count does not prove the rerun failed: the subsequent 0511 core.run_node extract-list call succeeded and was addable, with zero extracted rows. Its patch and actual request both contain handle/fields/where/minItems. This is a read repair, not proof of the identity or replacement of the earlier failing main.s5 click.

Subsequent metadata shows a new detection, a repeat refusal, successful reads, and repeated already_answered responses. Existing request.ts/replacement.ts explicitly distinguish ordinary amendments from executed reruns and replace a step only after a proposable result, preserving routing and source references. Accepted t981 covers the rebind-before-withdrawal correction. No raw page text, selector, row values or handles were emitted or copied into tracked evidence. The original failed-click target mapping remains missing; do not invent a persistence patch from the misleading zero applied count.

Validation: read-only structural inspection of 0509 decision, 0510 amendment result, 0511 call/result and 0512-0529 metadata; no browser or model call. F23 exact recorded root cause remains unverified.

## Post-reboot integration of the bounded F24 fix

This task's product change is the successful-unchanged-retry completion fix only. It is a coherent validated increment, not completion of P5's historical diagnosis or live four-attempt acceptance. F23 remains explicitly open in the plan and record above.

Both task parents were synced to current dev including accepted P1 retained extraction. Core package patch version is0.52.1. Lead reran the same five replay/continuation/person-clearance owners ->55/55 passed,97.42s, exit0; durable ignored log `.heavy-slots/t985-replay-parent-tests.log`. Corrected-parent `pnpm --filter fluxiq check` passed, exit0 (101924 ms); `node scripts/structure-audit.mjs` passed, exit0 (564 warnings /904 baseline). Integration waits for the offline lane to pin its current-parent browser snapshot; no product checks remain for this bounded F24 increment before mandatory merge gates. No new browser/provider call.
