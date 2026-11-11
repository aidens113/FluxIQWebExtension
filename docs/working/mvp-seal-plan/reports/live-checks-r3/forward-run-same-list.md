# A forward run's re-read of the result's own list is that list (run-mwb9b59w-aa0784db)

## Outcome

Done. Two root causes were found and fixed in Core, and both scripted proofs pass 4/4. Nothing is committed.

The failed forward run had two separate defects, and the brief named only the second:

1. **What actually failed the run.** `passed: false` did not come from the `resultList` note. It came from step 11 (`web.output.browser-navigate`, `url: $row.url`) stopping with `core.replay.unresolved_binding` on passes 2 and 3.
   - The named-columns wiring made the replayed read (step 10) declare the person's columns: `title, price` (`status` matched no field).
   - That narrowing dropped `url`, which the repeat over step 10 binds.
   - The saved Flow does not have this problem. Assembly's t869 lowering keeps any row field a repeat reads (`script-statements/repeat/row-fields.ts`, `automationStudioFlowPlanRepeatRowFields`).
   - The replay derived the record output step by step and never applied that lowering.
   - The script's check is `forward.value.passed !== true`, so this alone failed the run.
2. **The "different list" note.** This is the identity defect.

All Core paths below are under `C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ/packages/fluxiq/src`. `af` is `framework/automation-service/service/answer-first`.

## The identity: step, dataset ids, and why the same-list test failed

- **The result was built at step 0020, call `read-tables`.** It was a `core.run_node` read with no record output, columns `title, price, url`, and three `where` conditions.
  - Its dataset id is the unnamed form, `read.core-run_node.<digest>`. The digest covers {tool, asked = the call minus replay and page words, columns, view = the search page}.
- **The forward run sent step 10 again at step 0032, call `forward.10`.**
  - Its value was `{...step.ranWith, parameters.recordOutput: {datasetId: "web-output-dom-extract-list-d10", schema: title, price}, replay: "step", from, produced}`.
  - So the sink read it as named (`evidence.named = "web-output-dom-extract-list-d10"`), with columns `title, price`.
  - Its dataset id was the named form, `read.core-run_node.<digest of {named, columns}>`. That is a different dataset.
  - The step log does not record either id's digest, so I cannot quote the exact ids.
- **Why it was "another list".** In `row-sink.ts`, `into` and `asNamed` decide by exact dataset id. The reasons it differed:
  - **A different record-output name.** Assembly's derived name versus none. This is the decisive one, and it holds with or without named columns.
  - **A different column set.** `title, price` versus `title, price, url`, from the named columns.
  - **A different "asked".** The step's `ranWith` carries the host's `extractionBinding`, which the model's call never had.
  - **Not a view mismatch.** `ofList` (used by `heldApart`) did say "same list" by view, so the read was not held apart. But `changed()` compares dataset ids only, so it reported `other_list`, which became `answer_first.result_list_replaced`.
- **Before the wiring too, as the lead noted.** The replay already carried assembly's derived `recordOutput` name, so the dataset differed and the note fired.
  - The proof still passed then because `url` survived and the forward run's `passed` was true.
  - My round test confirms both shapes: without the fix, the note appears with named columns and with none.

**The fix in the identity itself.** A replay of a saved step is the read that recorded it.

- `af/rows/dataset-of-read.ts` has a new `automationStudioAnswerFirstRecordedReadKey`. It is a digest of {tool, the call with the replay's words (`replay, from, produced, reach`), both record-output spots, and the page words removed}.
- `af/rows/row-sink.ts`:
  - Keys each read the model makes by the call its step keeps (`answer.draft.ranWith`), mapped to the dataset it went to.
  - A later call carrying `replay` with the same key goes into that dataset first, ahead of `joined`. It does so only where the replay meets the list's conditions, shares a column with it, and its rows validate against the list's schema. It then carries the list on or starts it over like any re-read.
  - A replay that returns fewer columns (the named ones) is still that list. Its rows tie by the columns they share, and missing cells are absent, never invented.
  - A replay of a step no read of this exploration made (a seeded Flow's step) behaves as before.
- `REPLAY_WORDS` in the unnamed dataset id also gained `reach` (the forward run's "read the list on its own page" marker).
- The header paragraphs of both files are updated.

**S9's "shape differs".**

- **This task is not affected.** In every attempt the result's final list is the saved-items read (`read-saved`, `title, price, status`). Attempt 1's kept shape and attempts 2-4's shape are the same, and all three later attempts were judged `right`.
- **One divergence exists outside my paths (not caused by this change), and it could reach S9 elsewhere.** It applies when a forward-run read is itself the final result and the instruction names a column no field matches:
  - The sink's `askedColumns` leaves processing alone, so it shows every stored column (`title, price, url`).
  - Assembly declares only the matched columns (`title, price`).
  - Before my fix, attempt 1's result was the forward run's own dataset, shown as `title, price`. Now it is the hand read's list, shown as `title, price, url`. A saved run would then show `title, price`, giving `shape_differs` and one judge call. That is not a wrong answer.
  - The disagreement between the two derivations is in `af/rows/row-sink.ts` `askedColumns` versus `runtime/flow-authoring/bootstrap/authoring/assembled-record-output.ts`, and it predates this work.

## What changed and why

- **`runtime/llm/node-tools/replay/row-fields.ts` (new): the cause of `passed: false`.**
  - `automationStudioFlowDraftReplayRowFieldsKept` finds every repeat over a read step and the `item.<field>` bindings its members read.
  - It hands assembly's own lowering (`automationStudioFlowPlanRepeatRowFields`) a one-listing plan: the read, a For Each over its records, and those bindings. Then it takes the read's parameters back.
  - This is one derivation, not a copy. The replayed read now sends exactly the saved Flow's record output: `url` is stored, and `process.columns` is `title, price`.
- **`replay/replay.ts`, `span.ts`, `draft.ts`.** The step call, verify call and pass call take the whole draft (`steps`). `draft.ts` passes `input.steps` for the walk's own steps.
  - Span members get none, because a read a repeat walks sits before its span.
  - `replay/index.ts` exports the new module.
- **`af/rows/dataset-of-read.ts` and `af/rows/row-sink.ts`.** The identity fix, as above. `rows/` is at the 25-file limit and one level below the depth limit, so the key lives in the identity module rather than in a new file.
- **(b) `runtime/llm/node-tools/step-place.ts`.**
  - `automationStudioNodeRerunFromItsPlace` takes `partOf` and `namedColumns` and passes both to `redo`.
  - `runtime/llm/evidence-loop.ts:408` passes `input.partOf` and `input.namedColumns`. The file is still 800 lines.
  - The put-back also gets the row-field keeping through `steps`.
- **Tests:**
  - `af/rows/tests/replayed-read.test.ts` (new, 3 tests): the same list with every column; the same list with only the named columns; and the control case, where a replay of an unrecorded step stays a list of its own.
  - `af/attempt/tests/named-columns.test.ts`: the round's forward run must produce no `answer_first.result_list_replaced`, both with named columns and with none.
  - `node-tools/replay/tests/replay-row-fields.test.ts` (new, 3 tests): the stored and shown columns, equality with the saved Flow's assembled record output, and a forward walk that opens each row by its address with no `unresolved_binding`.
  - `node-tools/tests/step-place-done-again.test.ts`: two put-back tests, for named columns and for `partOf`. This is in the existing file because `node-tools/tests/` is at its file limit.

## Commands run and observed results

Vitest ran in `packages/fluxiq`; pnpm ran at the Core root.

**Revert checks.** Each fix was disabled and the tests rerun, then the fix was restored. A grep for my markers afterwards found nothing.

- **Sink replay rule disabled** (`replayed` returns `undefined`):
  - `replayed-read.test.ts`: 2 failed, 1 passed (`expected 'read.core-run_node.5ef6cea58000' to be 'read.core-run_node.021ab9928768'`).
  - `attempt/tests/named-columns.test.ts`: 2 failed, 2 passed (`expected true to be false` on `replaced`, in both forward tests).
- **Row-field keeping disabled:** `replay-row-fields.test.ts` had 2 failed, 1 passed. The failures were `stored: ['title','year']` and `expected [...] to not include 'core.replay.unresolved_binding'`, which is the live failure reproduced.
- **step-place `partOf` and `namedColumns` lines removed:** 2 failed, 12 passed (`expected ['title','year','link'] to deeply equal ['title','year']`, and the same against `['title']`).
- **With every fix in place:** `replayed-read` 3 passed; `replay-row-fields` 3 passed; `step-place-done-again` 14 passed; `attempt/tests/named-columns` 4 passed.

**Suites:**

- `npx vitest run af/rows af/attempt af/tests`: exit 0, 70 files and 499 tests passed.
- `npx vitest run src/runtime/llm/node-tools src/runtime/llm/tests`: exit 0, 61 files and 904 tests passed.

**Typecheck, audit and build:**

- `pnpm --filter fluxiq check`: exit 0, after fixing two type errors in the new module (`valueType`, router `fallback`) and one in a test.
- `pnpm structure:check`: "structure-audit: passed (530 warning(s), 969 baselined).", exit 0. It was 529 before; `row-sink.ts` is now 501 lines (advisory).
- `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/sdk --filter @fluxiq/ui-components build`: exit 0. fluxiq built in 138116 ms and ui-components was rebuilt; the rest were reused.

**Scripted proofs.** I checked free memory first: 2.05 GB at first, because another lane's domain test was using about 1.9 GB. I waited until it reached 3.0 GB, then 2.53 GB before the second proof.

- **Dining:** `FLUXIQ_LAB_INSTANCE=t885-proof FLUXIQ_TEST_ENV_FILES=none pnpm lab attempt local-classifieds --task local-classifieds-save-dining-tables --authoring-mode answer-first --scripted-model --attempts 4`
  - Result: `{"status":"passed"}`, evidence `run-mwbbrxpo-02eea338`.
  - Attempt 1: explore, 22 calls (interpretation 1, judge 1, decisions 20), right, achieved, 126.8 s.
  - Attempt 2: run_flow, 1 call (judge only), right, achieved, 88.7 s, continuation held.
  - Attempt 3: run_flow, 1 call (judge only), right, achieved, 97.4 s, continuation held.
  - Attempt 4: run_flow, 1 call (judge only), right, achieved, 165.9 s, continuation held.
  - My shell wrapper `timeout 1700` cut the process after it had printed the final result (exit 124/143), so the exit code is not the Lab's. Afterwards I found no leftover t885 Lab or Chrome processes.
  - In attempt 1, the forward steps 0032-0037 carry no `result_list_replaced`. Steps 0032-0036 answered `core.replay.replayed`.
  - `forward.10` declared `title, price, url` with `process.columns ["title","price"]`.
  - The only note is at step 0045, `read-saved`: the saved-items list, a genuinely different list, replacing the result. Its `replaced.lastReadBy: "forward.10"` shows the forward read had stayed in the result's own list.
- **Crossborder:** `FLUXIQ_ATTEMPT_SCRIPT_FORM=left-out FLUXIQ_LAB_INSTANCE=t885-proof FLUXIQ_TEST_ENV_FILES=none pnpm lab attempt crossborder-marketplace --task crossborder-marketplace-free-hubs-under-ten --authoring-mode answer-first --scripted-model --attempts 4`
  - Exit 0, `passed`, evidence `run-mwbd2ybz-0849709f`.
  - Attempt 1: explore, 12 calls, right, achieved, 106.9 s.
  - Attempt 2: run_flow, 1 call, right, achieved, 82.7 s.
  - Attempt 3: run_flow, 1 call, right, achieved, 86.9 s.
  - Attempt 4: run_flow, 1 call, right, achieved, 68.6 s.
  - All continuations held.

## Not verified

- No live or paid run.
- No extension-side tests and no Core-wide vitest.
- I did not test the evidence-loop caller line (`evidence-loop.ts:408`) through a loop-level test. Only `step-place` itself is tested.
- I did not exercise a replay that is a verify (`replay: "verify"`) of a read, or a read whose step's parameters hold bindings. Bindings are resolved in the replay's call, so their key would differ and they stay a list of their own, as before.
- The exact digests of the failing run's two dataset ids are not in its step log.

## Open questions or contradictions found

- **The brief's premise.** The brief says the script refused because of `resultList`. The script actually refused on `passed: false` from step 11's `core.replay.unresolved_binding`. Both are fixed.
- **The sink and assembly disagree on unmatched named columns** (see S9 above). This is outside my paths, in `assembled-record-output.ts` and `instruction-record-columns.ts` versus `askedColumns`.
- **Seam.** The row-field keeping is reached through the exported plan-level `automationStudioFlowPlanRepeatRowFields` with a one-listing plan. A smaller seam would be to export its per-output `keeping` from `runtime/flow-authoring/bootstrap/script-statements/repeat/row-fields.ts`, which is outside my paths.
