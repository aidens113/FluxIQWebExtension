# t994 sweep fix (Core): sub-supervisor report

Brief: `briefs/t994-sweep-fix-core.md`. Tree: `C:/Users/osrs_/FluxStuff/fxwork/t994/!FluxIQ`, task branch fast-forwarded by the lead to Core dev 27e8fabc9 (t993). All changes are uncommitted in the working tree. fluxiq bumped 0.54.1 -> 0.54.3 (dev reached 0.54.2 with t998 since the merge, per the lead).

## Outcome

**Done.** Every Core sweep failure in my scope, and every cluster the lead added (the judge-model DeepSeek fallback, F23 carried press and `declared-process`), now passes on the final tree, for a named cause:
- three product regressions are fixed at their cause: the replaced rerun attempt left in the Flow (t981), a read's own process dropped under a declared task (t984), and the carried press refused forever on replays (F23);
- two consistency fixes so one task runs on one model: the judge now takes the Flow's provider default, and recovery uses the starting model;
- the apps/web guard violations are fixed in the product code;
- the rest are tests pinning behaviour that named commits superseded on purpose, updated to the new contract with the commit and rule cited.

No assertion was weakened, and no test was deleted or skipped. `answer-first/result-feed/tests/automatic.test.ts` and `storage.test.ts` were left to t993 as instructed. `result-feed/tests/service.test.ts` passes 5/5 on the merged tree.

## Clusters: cause, breaking commit, fix

Worker reports with per-file detail are in `reports/t994-sweep-fix-core/{w1-answer-first,w2-bootstrap,w2b-bootstrap-finish,w3-parallel,w4-web,w5-carried-press}.md`.

| Cluster (sweep failures) | Cause | Breaking commit | Fix |
| --- | --- | --- | --- |
| Answer First real-sql, ~170 of 292: `stopped_by_person`, "Run again was refused: stopped part way", 0 rows, `scriptRanOut` (W1) | Since t984, a task that declares nothing gets an empty processing declaration, and the data stage refuses every completion `answer_first.processing_declaration_missing`. The scripted model runs out and the attempt ends stopped. The empty declaration is kept in task memory, so later attempts hold 0 rows or meet the `stopped_part_way` guard. The guard itself is correct. | 05d61fea4 (t984 / P2) | Tests: each first attempt declares what the chat would. Data tasks get `{ process: {} }`, action-only tasks `null`, and "due soonest" a sort on `due`. The shared `LISTED` and `ACTION_ONLY` constants live in `answer-first/tests/honest-attempts.ts`. In the FluxNode SDK test, the model declares through `core.set_result_processing`. |
| Data stage refuses first (5 tests) (W1) | An empty give-up on a data task is refused by the data stage before `nothing_to_judge` and `rows_not_read`. It is still refused before any judge. | 05d61fea4 | Tests now expect the data stage's code (`refused-rows-not-read`, `output-not-observed`, `attempt`). |
| `endings/person` `ask_person` (W1) | `ask_person` is offered at the first catch | 002650596 (t983, U1) | Test now expects `["ask_person"]`. |
| `row-sink-real-store` (W1) | Dataset evidence gained `nodeId` and `invalidCount` | 8c50dc21c | Test now expects both fields. |
| `judge-continues-decider` (W1, t993 confirmed it) | The fixture's judge "yes" lacked `diagnosis.defects`, which the real Anthropic adapter requires. Every reply was unreadable and asked again with no wait: 2,399 judge calls until the harness's hang guard stopped it. | 021b1f631 | Test: `judgedYes(request, { defects: [] })`, plus asserts for `achieved` and no hang. The file now runs in 1.6 s. |
| `declared-process` 3/4 (W1 diagnosis; W6 fix, after the lead ruled it a regression and handed over `result-feed/**`) | **Product regression.** Under a declared task, `result-feed/feed.ts` took the `stage.active()` path, which bound only the task's declaration. A read's own `recordOutput.process` (sort, where, limit) was silently dropped, the same failure class as t869. W6 found a second problem: a saved step's stamped processing copy carries a `declaration` key, which input resolution refuses, so a plain merge would have failed on every rerun of a saved step. | 05d61fea4 | `merged` moved to `result-feed/merged-processing.ts` (`automationStudioAnswerFirstMergedProcessing`); both paths use it with the same rule (held keys over the read's). `stage.ts` `bind` binds that merge. If the merge does not bind, it binds the declaration alone, so the declaration's own failure is still the one reported. The read's process is in the cache key. A stamped saved copy is reused only under the same declaration source and revision. 5 new tests in `result-feed/tests/read-process.test.ts`. A mutation check showed the cache-key and stamp guards are both covered. |
| Flow build, bootstrap and re-author, about 36 files (W2, W2b) | Since t976, a build not started from a chat reads its instruction before its first decision (one more paid call). Every scripted reply shifted by one. This gave the `totalProviderCallCount` mismatches, `evidence_budget_exhausted`, generation failures and doubled accounting. | b2ee9ed45 (t976) | Tests: one shared helper, `tests/service-bootstrap/tests/instruction-reading.ts`. Expected accounting now includes the reading. `judged-build` call limit 4->5: the same two decisions plus the reading. The test still proves the limit is reached at the same boundary (`readings() === 1`, two non-judge requests, `ending.bound === "calls"`). |
| Unnamed model resolves to Haiku (W2, W2b) | Since U1, a Flow with no model resolves to Haiku. Harnesses that only hold a DeepSeek key failed. | 002650596 (t983) | Tests name DeepSeek where the harness holds a DeepSeek key. Resolver-input checks expect `claude-haiku-5-5`. **Product** (`runtime/adaptation/recovery/annotation/annotate.ts`): recovery now resolves through `automationStudioLlmRoleRoutedResolution`. Before, it was repaired on the host default but judged on the starting model. |
| Zero charge for an unreported failure (W2, W2b) | A failed call that reports no usage settles at $0 | 89e40b545 (t966) | Tests (`refuted-result-port`, `candidate-unusable-reply`). |
| New result code (W2) | `core.result.semantic_evidence_missing` | c0244a44d (t987) | `refusing-codes` lists it under "unverified". |
| Paired-browser policies (W2) | Policies decide, not the permissions the browser carries | d73bca654 (t950) | `person-project` uses a separate read-only person. |
| `answerability` 7-vs-6 judge steps (W2b diagnosis; supervisor applied the fix) | **Product regression.** Since t981, the attempt a rerun replaced is withdrawn after the rerun takes its place. Reach cannot yet tell where the rerun leaves the target, so the strand check refused the drop as `strands_a_step`. The attempt stayed in the Flow at its end and ran again after every other step. | 258f83958 (t981) | `flow-authoring/draft/amendment/apply.ts` has a new option `withdrawsReplacedAttempt`, which skips only the strand check. It is passed only by `llm/evidence-loop/rerun/replacement.ts`'s final drop. Repeat-hold, span and reversal checks are unchanged. New unit test in `evidence-loop/tests/rerun-replacement.test.ts`. It fails without the fix (1 failed / 18 passed) and passes with it. |
| Parallel group, 12 files (W3) | Wording pins, a new `consequences: []` field, U1's removed ladder, missing `recordOutput` fixtures, and a locator gap | per file in `w3-parallel.md` | 11 test updates. **Product** (`flow-authoring/bootstrap/authoring/accept.ts`): the early `record_output.process_declaration_framework_owned` refusal now carries a script locator, which a new corpus case required. |
| U1 leftover (W3 note; supervisor) | `loop-signal/completion-refused-again.ts` still called the no-op `automationStudioLlmModelLadderClimb`, and its header described a model climb | 002650596 | Removed the call and the import. The header now says the model never changes. |
| apps/web `panel-tokens` (W4) | Colour literals and a gradient in the panel's CSS | 92f45c26f, dee11cc75, 6fd230cb9 | Replaced with the package tokens `--divider`, `--hover`, `--shadow`. The radio dot is drawn with an accent fill and an inset ring. |
| apps/web `scope-boundary` (W4) | The environments route imported the primary-instance accessor | f5da86d31 | New server helper `server/environments/platform-environment-store.ts` (`getPlatformEnvironmentStore`); the route uses it. |
| Lead: judge model ignores the Flow's provider | `role-routing/judge-model.ts` fell back to Haiku even for a Flow naming only DeepSeek, so the result check threw `verification_did_not_finish` | t983 | **Product:** one shared `role-routing/starting-model.ts` (`automationStudioLlmStartingModelId`), used by both `resolution.ts` and `judge-model.ts`. `service.ts` passes the Flow's `llmProvider` to the judge. New test in `role-routing/tests/resolution.test.ts`: provider-only DeepSeek gets `deepseek-flash` (the build's model), and nothing named or `host` gets Haiku. |
| Lead: F23 carried press (W5) | On a saved Flow's replays, an undeclared press carried as `heldOnRepeat` was refused on every replay, because nothing can look. The stepper's Next was never pressed and the next step ended `target.gone`. | see `w5-carried-press.md` | **Product:** `act-record/record.ts` adds `carriedHold(call)`. `run-acts/run-gate.ts` looks at the page when every match is a look-hold: only the host's `not_seen` for the node's recorded effect lets the hold go, for this attempt only. `flow-run/flow-run.ts` passes the scope. The supervisor also passed the scope in `runtime-session/graph-options.ts`, so FluxNode carried runs get the same look. Builds already record effects (`node.routeSignatures.effect`). The t995 reproduction now runs as `it`, plus 10 new cases. |

## Workers

| Worker | Tier | Brief | Outcome | What I verified |
| --- | --- | --- | --- | --- |
| W1 | worker-heavy | `briefs/t994-w1-answer-first.md` | Partial: 33/34 files; `declared-process` handed on | Rerun of all its files on the merged tree (see Commands) |
| W2 | worker-heavy | `briefs/t994-w2-bootstrap.md` | Partial twice: causes found, edits made; it repeatedly handed back before its runs finished | Its first-batch output read: 14/19 files passing; superseded by W2b |
| W2b | worker-heavy (retry with W2's report) | `briefs/t994-w2b-bootstrap-finish.md` | Partial: 37/38; diagnosed `answerability` outside its paths | I applied its proposed fix and added a test that fails without it. Every W2 file passes in my verification pass. |
| W3 | worker | `briefs/t994-w3-parallel.md` | Done | My rerun: 19 files, 227/227 |
| W4 | worker | `briefs/t994-w4-web.md` | Done | Diff reviewed; my rerun: 71 files, 527/527; web check exit 0 |
| W5 | worker-heavy | `briefs/t994-w5-carried-press.md` | Done | Diff reviewed; act-record, run-acts, flow-run and graph-options tests pass in my verification pass; FluxNode scope wiring added by me |
| W6 | worker-heavy | `briefs/t994-w6-read-process.md` | Done | `stage.ts` diff reviewed; my rerun after W6: 91 file runs, 682/682; typecheck and audit pass |

## Integration changes I made myself

- `runtime/llm/role-routing/{starting-model.ts (new), judge-model.ts, resolution.ts, index.ts}`, `framework/automation-service/service.ts` (judge call site) and `role-routing/tests/resolution.test.ts`.
- `answer-first/loop-signal/completion-refused-again.ts`: ladder leftover removed.
- `flow-authoring/draft/amendment/apply.ts` and `llm/evidence-loop/rerun/replacement.ts`, with a test in `evidence-loop/tests/rerun-replacement.test.ts`.
- `service/runtime-session/graph-options.ts`: scope for the FluxNode gate.
- `packages/fluxiq/package.json`: 0.54.3.
- Line endings: `git status` lists about 380 modified entries, but `git diff --ignore-cr-at-eol` shows about 100 files with real content changes. The rest differ only in CRLF/LF, and staging them changes nothing. Stage by content.

## Commands run on the final tree (Core dev 27e8fabc9 + working tree)

All from `packages/fluxiq` through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql <files> --maxWorkers=1 --minWorkers=1 --fileParallelism=false`. Files: every file that failed in the sweep, minus t993's two, plus the tests beside every changed source (role-routing, draft amendment, rerun-replacement, act-record, run-acts, flow-run, loop-signal, graph-options, recovery annotation, bootstrap authoring, deepseek-recovery-requests, iterating-recovery). In all, 97 entries in 9 chunks; logs in the scratchpad as `v-vchunk-0N.log`.

- **Verification pass** (before W6): 194 file runs, 1853 tests; 3 failed, all in `declared-process.test.ts`, which W6 then fixed. Per chunk (parallel / real-sql): 16/125 + 22/127; 7/114 + 12 files 100 passed, 3 failed; 12/74; 1/41 + 11/74; 2/14 + 10/52; 12/77; 60/736 + 5/47; 22/258 + 2/11.
- **Rerun after W6** of every Answer First, FluxNode SDK, person-humanness and input-basis file, plus `result-feed/tests/` (42 entries, 4 chunks, `r-rchunk-0N.log`): 91 file runs, 682 tests, all passed. That includes `declared-process` 4/4 and `result-feed/tests/service.test.ts` 5/5.
- **W3 files plus role-routing** (supervisor rerun): 19 files, 227/227.
- **Negative check of the rerun-replacement test** with the `withdrawsReplacedAttempt` option removed: 1 failed / 18 passed. With the option restored it passes.
- `node scripts/build-cache/cli.mjs contracts:build fluxiq:build` (lead's instruction, after the merge) -> exit 0; fluxiq rebuilt in 137 s.
- `pnpm --filter fluxiq check` -> exit 0, run twice: after the integration edits, and again after W6 (recompiled, "inputs changed", 79 s).
- `node scripts/structure-audit.mjs` (Core root) -> `structure-audit: passed (570 warning(s), 903 baselined).`, run twice.
- apps/web, from `apps/web`: `pnpm exec vitest run` over the two guard tests and the tests beside the changed files and features -> 71 files, 527/527. `pnpm run check` -> exit 0. This ran after the library rebuild and before W6. W6 touched only fluxiq's result-feed, which apps/web tests do not exercise, but apps/web's stale-library guard will ask for a fluxiq rebuild before its next run.
- `grep -rn "W2DBG|W2BPROBE" packages/fluxiq/src` -> 0 lines (debug probes gone).

## Not verified

- Live or browser behaviour: F23 has not had a four-attempt Lab acceptance, and the radio dot and menu shadow have not been looked at in a browser.
- Whether F23's saved `main.s4` effect has at least 3 added control names, which the domain needs before it says `not_seen`. If it has fewer, the press is still refused (`unknown`).
- The whole fluxiq suite was not run (brief: named files only).
- apps/web tests ran before W6's result-feed edit. They do not exercise result-feed, but their stale-library guard will ask for a fluxiq rebuild before their next run.
- No downstream checks: this lane edited Core only.

## Open questions for the lead

1. **Unthrottled judge re-ask (W1):** an unreadable judge reply is asked again at once, with no wait. One fixture made 2,399 calls in 90 s, and only the purse would end it in a live run. It is a product question, and nothing was changed for it.
2. **t983 `ask_person` (W1):** it is now offered at the first catch. The 2026-11-19 rule calls asking the person a last resort, and U1 removed only the model climb. Was dropping the changed-approach gate intended?
3. **`rows_not_read` ordering (W1):** for data tasks, the data stage's refusal now comes before `rows_not_read`, which quotes the person's words. Should it come first again? (t993 changed `completion/check.ts` here too.)
4. **The start-of-build reading costs a call even for a read-only build (W2):** should it be skipped when no tool can cause a lasting effect? That is t976 product design.
5. **t966:** a timed-out call with no reported usage settles at $0, but a provider may still bill it.
6. **The reading is sent 3 times on a network error (W2b):** the harness retries network errors but sends a timeout once. Not investigated.
8. **W6 choices to confirm:**
   - When the task names no columns, the person's asked columns count as the task's, so they override a read's own `columns`. This follows the merge rule and how the active path already treated asked columns.
   - After an amendment, a read's original sort or limit folded into the saved copy is lost until the read runs again with its own process. W6 chose this so that an amended-away condition cannot come back.
   - The legacy path still withholds an answer whose processing cannot be applied. Only its header was corrected.
7. **One look before a held press (W5):** a page still drawing a late effect could read `not_seen`. The domain's at-least-3-names rule limits this.
