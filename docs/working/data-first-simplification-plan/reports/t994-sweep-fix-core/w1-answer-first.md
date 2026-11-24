# t994 W1: Answer First real-sql sweep failures

## Outcome

Partial. 34 owned failing files: 33 now pass in full. `answer-first/tests/declared-process.test.ts` still fails 3 of its 4 tests. The cause is in `answer-first/result-feed/**`, which belongs to t993, so I did not edit it. The diagnosis and a proposed fix are below. No product source was changed. Every fix is a test-fixture update to a contract that a named commit deliberately superseded.

## Cause clusters

### 1. Missing processing declaration (about 170 of the 180 owned failures)

- **What happened.** Since t984, a new Answer First task always carries a processing declaration (05d61fea4, `result-processing/task.ts`). When the caller gives none, the task stores `task: {}`, which means the declaration is missing.
- **What the data stage does with it.** It refuses every completion with `answer_first.processing_declaration_missing` (`result-feed/stage.ts:49`). An action-only task gets the same refusal.
- **How the tests failed.** The scripted model completes and is refused. Its script then runs out, so the harness stops the attempt as a person would. That is the 37 `scriptRanOut expected true to be false` failures and the `stopped_by_person`/`stopped` endings.
- **Why the next attempts also failed.** Opening saves the empty `{}` declaration into the task's memory. Later attempts at the same task inherit it and are refused too. They then hit the `stopped_part_way` Run-again guard, which is correct. They also hold no rows, which is the 20 `expected 0 to be greater than 0` failures.
- **The fix.** Each first attempt now declares what the chat's reading would, following the precedent of 153d0df0b and e2b1f2635:
  - a data or list task declares `{ process: {} }`;
  - an action-only task ("Renew the card", "Renew every loan", "Renew my three library loans") declares `null`;
  - "due soonest" declares a `sort` on `due`;
  - a FluxNode run has no chat reading, so the SDK fixture's model declares through `core.set_result_processing`, as `fluxnode/tests/library-lane.ts` does.
- **Where it changed.**
  - Shared fixtures in `tests/honest-attempts.ts`: new `LISTED` and `ACTION_ONLY` constants. `honestFirstAttempt`, `honestFirstAttemptWithCard` and `cardFirstAttempt` now carry them.
  - Per-file consts: `card`/`loans`, `again`, `FLOW_OF_TWO`, `firstAttempt`.
  - The options of each `scriptedAttempt` call.
- **Knock-on updates in the SDK test** (rule t984; FluxNode declaration precedent e2b1f2635):
  - `sdk-acceptance.test.ts` decision counts are one higher (4→5, 3→4 twice, 2→3), because the declaration is a real model decision.
  - Test 3 declares only the columns, as `fluxnode-runs.test.ts` does, so that the check under test still sees the Atlas row.

### 2. A data stage refusal now comes first (5 tests)

- **What changed.** 05d61fea4 (t984, `completion/check.ts:207`) makes a declared data task's readiness refusal come before the `nothing_to_judge` and `rows_not_read` checks.
- **What the tests now see.** An empty give-up on a data task is refused as `answer_first.processing_schema_missing`. It is still refused before any judge, the attempt carries on, and there is one judge in the end. I confirmed this with a provider-free probe.
- **The fix.** The pinned code is updated in three places, with a comment citing the commit. This follows e2b1f2635's own `endings/judge.test.ts` update:
  - `endings/refused-rows-not-read.test.ts` (one const, `NOT_READ`);
  - `endings/output-not-observed.test.ts`;
  - `tests/attempt.test.ts`.
- **For the lead.** `rows_not_read` (whose words quote the person's sentence) can now only be reached by a legacy task that has no declaration.

### 3. `ask_person` is offered at the first catch (1 test, `endings/person.test.ts`)

- **What changed.** t983/U1 (002650596) removed both gates on `ask_person`: the one after a changed approach and the one after a climb (`runtime/llm/loop-decision/options.ts`). Its own unit test pins "offers a person question on first detection without any approach count".
- **The fix.** The expected decisions are now `["ask_person"]`, with a comment.
- **For the lead.** The 2026-11-19 rule says "asking the person is a last resort", and only its model-climb part was superseded by U1. If removing the changed-approach gate was not intended, the fix belongs in `runtime/**` (W2/W3/W4), not here.

### 4. Run-dataset evidence now carries `nodeId` and `invalidCount` (1 test)

- **What changed.** 8c50dc21c (t984, exact batches) added both fields to `readRunDatasetEvidence`, and updated its own store test the same way.
- **The fix.** `rows/tests/row-sink-real-store.test.ts` now expects `nodeId: "exploration.web.read", invalidCount: 0`.

### 5. Hidden in a passing run: judge re-asked about 2,400 times (`completion/tests/judge-continues-decider.test.ts`)

- **What I saw.** Once cluster 1 was fixed, the file passed in 97 s, but the attempt had hung. A probe showed 2,399 `loop_verification` calls in 90 s. The harness's 90 s hang guard then stopped the attempt, ending `stopped_by_person`.
- **Why.** The judge goes through the real Anthropic adapter. The wire schema requires `diagnosis.defects` (`models/providers/anthropic/schema-misses.ts`). The fixture's yes from `judgedYes` has no `defects`. So every reply is `llm.provider_output_invalid`, and the judge is asked again on the same model with no wait (021b1f631).
- **The fix.** The test's judge now replies `judgedYes(request, { defects: [] })`, as a real grammar-constrained reply would. The test also now asserts `attempt.status: "achieved"` and `hung === false`. It passes in 1.6 s.
- **Product observation for the lead (not fixed, not mine).** An unreadable judge is re-asked in a tight loop with no backoff. The purse ends it only after very many calls. This follows the rule to retry on the same model until the budget is gone, but the loop spends calls very fast.

### 6. Unresolved: a read's own declared process is ignored under the data stage (`tests/declared-process.test.ts`, 3 of 4 fail)

- **Cause.** Once a task has a declaration, `result-feed/feed.ts` takes the `stage.active()` path at about line 206. That path evaluates only the task declaration. The output step's own `recordOutput.process` (sort, where, limit) is applied only on the legacy path, through `merged(processes.get(output.id), held)`. So a model's sort on a read is silently dropped. This is the same failure as t869 (run-mw37vz9n). The header comment at `feed.ts:25` still promises the old behaviour.
- **Breaking commit.** 05d61fea4 (t984).
- **Proposed fix (t993 owns `result-feed/**`).**
  1. Pass the step's declared process into `stage.evaluate`, for example `stepProcess: processes.get(output.id)`.
  2. In `stage.ts` `bind`, merge it under the resolved task process key by key, so that `{ ...stepProcess, ...taskProcess }` is bound to the schema.
  3. Include it in the `stableJson` cache key.
- **Alternative.** If P2 means a read's local process is now superseded by the one task declaration, the lead should say so. These three tests would then be rewritten to declare through the task, and the model must be told that a read-level process is ignored.
- **Current state of the file.** It carries `taskProcessing: { process: {} }`, so it now fails at the real question rather than at the missing declaration.

## Files changed

Paths are under `packages/fluxiq/src/`.

- **`framework/automation-service/service/answer-first/tests/`:**
  - `honest-attempts.ts`
  - `attempt.test.ts`, `declared-process.test.ts`, `double-act-on-run.test.ts`, `dropped-act.test.ts`
  - `fewer-than-earlier.test.ts`, `forward-loop.test.ts`, `identical-rows.test.ts`, `latest-read.test.ts`
  - `reachable.test.ts`, `row-identity.test.ts`, `second-attempt-proof.test.ts`, `whole-row-link.test.ts`
- **`framework/automation-service/service/answer-first/tests/endings/tests/`:**
  - `asked-count`, `balance-at-judge`, `budget`, `clocks`, `output-not-observed`, `person`, `pre-model`
  - `refused-completion`, `refused-rows-not-read`, `rerun-reset`, `stalls`, `steps`, `stuck-with-nobody`
  - each `.test.ts`
- **`framework/automation-service/service/answer-first/` (other folders):**
  - `apply-proven/tests/apply-proven.test.ts`
  - `attempt/tests/named-columns.test.ts`
  - `attempt/tests/judge-token-limits.test.ts`
  - `completion/tests/judge-continues-decider.test.ts`
  - `rows/tests/row-sink-real-store.test.ts`
- **Elsewhere:**
  - `framework/automation-service/service/input-basis/execution/tests/flow-stage.test.ts`
  - `framework/automation-service/tests/person-humanness/tests/answer-first.test.ts`
  - `server/fluxnode-api/tests/sdk-acceptance.test.ts`

`attempt/tests/hand-fix.test.ts` passes through the shared `honest-attempts.ts` fixtures, with no edit of its own.

Some files show as modified in `git status` that I did not edit: `fake-library.ts`, `later-attempts.ts`, `library-site.ts`, `fake-library-engine.ts`, `carry-on`, `interrupted`, `later-attempt`, `same-words`, `saved-read-restart`, `skipped-rows`, `whole-row-link-flow-run`, `acts-with-no-row`, and the input-basis `fixtures`/`store`. `git diff` shows no content change in them; only a line-ending warning. W3's files were edited by W3.

## Commands run and observed results

All runs were from `packages/fluxiq`, in the form `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t994-w1 -- node ../../scripts/vitest-groups.mjs --groups=real-sql <files> --maxWorkers=1 --minWorkers=1 --fileParallelism=false`.

| Run | What it covered | Observed result |
| --- | --- | --- |
| Reproduction | `endings/tests/clocks.test.ts` | 1 failed (`scriptRanOut` true). A probe showed the refusal `answer_first.processing_declaration_missing`. |
| After the endings fixtures | the 13 endings files | 61 passed, 4 failed (codes from clusters 2 and 3). |
| Batch of 11 files | `output-not-observed`, `refused-rows-not-read`, `attempt`, `declared-process`, `fewer-than-earlier`, `forward-loop`, `identical-rows`, `latest-read`, `reachable`, `row-identity`, `whole-row-link` | 78 passed, 3 failed, all in `declared-process`. |
| Batch of 13 files | `person`, `apply-proven`, `hand-fix`, `named-columns`, `judge-token-limits`, `judge-continues-decider`, `row-sink-real-store`, `double-act-on-run`, `dropped-act`, `second-attempt-proof`, `flow-stage`, `person-humanness/answer-first`, `sdk-acceptance` | 13 files passed, 110 of 110 tests. |
| After the judge fixture fix | `judge-continues-decider.test.ts` | 1 passed in 1.6 s (it was 97 s while hung). |
| Acceptance check | `answer-first/result-feed/tests/service.test.ts` (not edited) | **5 of 5 failed.** It has no `taskProcessing`, so it is very likely cluster 1. That is for t993. |

- The structure audit was not run, because no source file was changed.
- The probe test files I wrote were deleted.

## Not verified

- I did not run a typecheck (budget rule: at most two full typechecks a day). Vitest transpiles without checking types. The new fixture fields use the existing `AutomationStudioFlowTaskProcessing` type.
- The endings files passed in the first endings run; the three I edited afterwards were rerun and passed. I did not rerun all 34 files together in one final run.
- I did not check other passing files for attempts that hung but were still accepted, as in cluster 5. The endings and fake-library tests assert `hung === false` through `expectEnded`. The others mostly do not.

## Open questions or contradictions found

1. Does a read's own `recordOutput.process` still apply under the data stage (cluster 6)? Either t993 makes it apply again, or the lead declares it superseded.
2. Was dropping the changed-approach gate on `ask_person` (t983) meant, given the 2026-11-19 "last resort" rule (cluster 3)?
3. Should `rows_not_read`'s words, which quote the person's own sentence, come before the data stage's `processing_schema_missing` for data tasks (cluster 2)?
4. The judge re-ask loop has no backoff on `llm.provider_output_invalid` (cluster 5).
5. `result-feed/tests/service.test.ts` fails 5 of 5. It likely only needs `taskProcessing` fixtures; that is for t993.
