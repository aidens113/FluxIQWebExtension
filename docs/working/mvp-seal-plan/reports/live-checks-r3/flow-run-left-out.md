# A saved Flow's run tells the judge what its reads left out (run-mwaudvnh-c208d32c)

## Outcome

Partial. Fixes 1 and 2 are done, and every check the brief names passed. Fix 3 is traced to its cause. Its text and the code that decides it are outside my owned paths, so the exact change is written below and nothing was edited for it.

- **Fix 1.** A saved Flow's own run now carries each read's left-out account on its record batch. The batch member is never stored. `readPages` now shows `leftOut` for Flow-run reads, the same as for reads the model makes.
  - Proven by tests through the real engine and sink.
  - Proven in the Lab: the three replay judges (attempts 2-4) each received `leftOut` naming the two ad rows.
- **Fix 2.** When a left-out label is also a kept row's label, the judge's `readPages` names it in `sameLabelKept` on that left-out set. `question.ts` gains one generic sentence saying what that means.
- **Fix 3.** "Saved today: notes only. I could not save steps" was not a failed save. It was a mid-attempt row, read as if it were an ending. The cause and the exact change are under Fix 3 below.

## What changed and why

### Core (`C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ/packages/fluxiq/src`)

**Fix 1: what a Flow-run read left out rides its record batch.**

- `engine/automation/contracts.ts`, record batch type only:
  - New optional `leftOut?: { extraction: JsonObject; parameters?: JsonObject }`. It holds the answer's own `extraction` account and the parameters the read was dispatched with.
  - It is documented as never stored. `run-datasets.ts storeBatch` and `records/summary.ts` copy named fields only, so it is not.
- `engine/automation/records/read/` is a new directory. The structure audit's naming rule required it once three `read-*` files existed.
  - `holders.ts` holds the holder walk that used to sit inside `read-location.ts`.
  - `location.ts` is the old `read-location.ts`, moved, with unchanged behaviour.
  - `left-out.ts` (new) takes the `extraction` member that holds `rejectedSamples` from the objects the rows' path runs through, plus `effect.payload.parameters`. It parses nothing.
  - `index.ts` is the new barrel. Tests moved to `read/tests/location.test.ts`, and `read/tests/left-out.test.ts` is new.
- `records/capture.ts` puts `leftOut` on the batch beside `location`, at the one point every dispatch path reaches. `records/index.ts` re-exports `./read/index.ts`.
- `answer-first/rows/read-evidence.ts` gains a second export, `automationStudioAnswerFirstBatchLeftOut`:
  - It is built on the existing parser `extractionSummaryFromOutputs`.
  - `conditions.aloneRows` becomes `alone` sets, each row's label plus the tested column's value.
  - `togetherRows` becomes `together` sets.
  - `aloneObservations` becomes `found`.
  - `where` and `fields` come from the dispatched parameters through `automationStudioResultReadParameters`.
  - It lives in this file because `rows/` already holds 25 files, the limit.
- `answer-first/rows/row-sink.ts` `recordBatch` sets `leftOut` on the page it records. A page that kept no row but says what it left out is also recorded.

**Fix 2: same label kept and left out.**

- `runtime/result-verification/flow-less/read-pages-shown.ts`:
  - Each `leftOut` set gains `sameLabelKept`: the set's labels that equal a row some read of the result kept, on any page. The match is the same column, or the result's label column.
  - A withheld label is never marked.
  - This is the flow-less twin of `request-rows/summary/with/also-in-result.ts`.
- `flow-less/question.ts` gains one sentence. It names no site, task or product: "Where a leftOut set gives sameLabelKept, each label named there is also the label of a row a read kept: the site showed two items under that label, the kept one met every condition of its read and the one in this set did not, so the label being both kept and left out is not one item both kept and dropped."

**Tests.**

- `rows/tests/run-read-pages.test.ts` gains two cases. They use the real engine, real capture and real sink, then the judge's copy:
  - two Flow reads with conditions, whose answers carry `extraction.rejectedSamples`;
  - `readPages[].leftOut` is checked, then the judged `readPages`, including `sameLabelKept: ["Item 1"]`.
- `flow-less/tests/read-left-out.test.ts` gains two cases:
  - a same-label row is marked on another page, and an unmatched label is not;
  - a withheld label is never marked.
- `answer-first/flow-run/tests/repaired-read-conditions.test.ts` is new. It is the lead's requirement, with a real service, real engine and scripted model:
  - Attempt 1 reads with four conditions.
  - Attempt 2's Flow run is judged no. It reads again with the same conditions, drops that step, runs forward from the read and is judged yes.
  - The saved Flow proposes one read, with steps `["kept","dropped"]`. Its `input.parameters` and `ranWith.parameters` both hold the four conditions.
  - Attempt 3 runs `run_flow` with 0 decisions, and the engine's read node ran with exactly those four.
  - The file sits in `flow-run/tests/` because `answer-first/tests/` hit the 25-file limit.
- `answer-first/tests/fake-library-engine.ts`: the READ_LOANS node now hands its `parameters` to the `over` hook, as the other nodes already do.

### Extension (`C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQWebExtension`)

- `packages/test-runner/src/attempt-lane/scripted-model/scripts/crossborder-marketplace-free-hubs-under-ten.ts` gains a new form, `left-out` (`FLUXIQ_ATTEMPT_SCRIPT_FORM=left-out`):
  - It runs the plain path for four attempts.
  - Its judge throws, naming the page, unless every `readPages` entry has a `leftOut` set with rows.
- Its test file has the refusal message updated and gains one new test.

## Commands run and observed results

**Vitest and checks.**

- `npx vitest run src/engine/automation/records src/.../answer-first/rows src/.../answer-first/flow-run src/.../answer-first/attempt src/.../answer-first/run-acts src/.../answer-first/tests src/runtime/result-verification` was run after all edits and the file moves. Result: `Test Files 303 passed (303)`, `Tests 2374 passed (2374)`, exit 0.
- Revert check:
  - I temporarily reverted three things: the sink's `leftOut` (to `undefined`), the capture's `leftOut` argument, and fix 2's matcher (to `() => false`).
  - With those reverts, 4 tests failed: `rides the batch the capture makes`, `tells each page's left-out rows ...`, `reaches the judge's readPages ...` and `says, in sameLabelKept, ...`. The run reported `Tests 4 failed | 10 passed`.
  - The files were then restored from backups and the full run above is on the restored code.
  - I did not revert the sink alone and the capture alone separately; both are Fix 1.
- `pnpm --filter fluxiq check` → exit 0 (tsc, `fluxiq:check` built).
- `pnpm structure:check`:
  - First run: 2 violations, both mine. `answer-first/tests/` held 26 files, and records had 3 `read-` files.
  - After the moves: `structure-audit: passed (526 warning(s), 969 baselined)`, exit 0.

**Builds.**

- `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/sdk --filter @fluxiq/ui-components build` → exit 0. `fluxiq:build` and `ui-components:build` rebuilt; the others were reused.
- Test-runner `pnpm run build` → exit 0. `core-build: ... current with its source`.
- `node --test dist/.../crossborder-marketplace-free-hubs-under-ten.test.js` → `tests 13, pass 13, fail 0`.

**Lab proof.**

- Free memory was 3400 MB at launch.
- Command, from the extension worktree: `FLUXIQ_LAB_INSTANCE=t885-proof FLUXIQ_TEST_ENV_FILES=none FLUXIQ_ATTEMPT_SCRIPT_FORM=left-out pnpm lab attempt crossborder-marketplace --task crossborder-marketplace-free-hubs-under-ten --authoring-mode answer-first --scripted-model --attempts 4` → exit 0, `"status":"passed"`.
- Evidence is in `test-runs/instances/t885-proof/attempts/run-mwaxy7s0-871febc5`. The model was a stand-in, so none of the dollar figures below is real spend.

| Attempt | Path | Calls | Verdict | Rows | Stand-in dollars |
| --- | --- | --- | --- | --- | --- |
| 1 | explore | 11 (interpretation 1, judge 1, decisions 9) | right, achieved | 10 | $0.4081 |
| 2 | run_flow, from attempt 1's saved work (digest held) | 2 (interpretation 1, judge 1, decisions 0) | right, achieved | 10 | $0.0190 |
| 3 | run_flow, from attempt 2's | 2 (interpretation 1, judge 1, decisions 0) | right, achieved | 10 | $0.0190 |
| 4 | run_flow, from attempt 3's | 2 (interpretation 1, judge 1, decisions 0) | right, achieved | 10 | $0.0190 |

- The Lab played the person at the site's traffic screen twice in each later attempt.
- Step evidence in `steps/`:
  - The replay judges are 0032, 0044 and 0056. Each `request.json` `readPages` carries `leftOut: [{ by: "condition 1 (the item's text not is present; it read \"Ad\" on the items it left out) by itself, ...", rows: ["Castellan USB C Hub 7 in 1 HDMI 4K 60Hz PD 100W 2 USB 3.0 SD TF Card Reader", "Lumora Wireless Charger Stand 15W Fast Charging Dock for Phone Earbuds"] }]`.
  - Attempt 1's exploring judge (0020) carries the same two rows.
  - Before Fix 1, a judge of an engine replay received no `leftOut` (0182 in the original run).

## Fix 3: "Saved today: notes only. I could not save steps"

**Where it is produced.**

- The text is in `C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ/packages/ui-components/src/chat/answer/words/saved-words.ts:29`, case `notes_only`.
- That state is decided by `framework/automation-service/service/answer-first/attempt-store/outcome-of-record.ts` `savedOf`. It reads `notes_only` for "proposed steps and no `candidateId`".
- Neither path is owned by me, and neither is in the two lanes named in the brief. So nothing was edited.

**Cause.** This is traced in code, and agrees with the original run.

- Attempt 3 was not ended. It stood at the stuck question: `attempt/rounds.ts`, `askPerson` with a person port, after `automationStudioAnswerFirstKeep`.
- `attempt/keep.ts` writes the row at that wait with `steps: run.steps` and no candidate.
- The draft is assembled and saved only at an ending, in `attempt/ending.ts` → `draft-save.ts`.
- So `savedOf` read "steps, no candidate" as "could not be assembled". The chip then told the person, while the attempt waited for them, that a save had failed, when no save had been tried. Lab evidence: the chat text quoted in `attempt-report.txt` of run-mwaudvnh-c208d32c, and no "kept as steps only" note anywhere in its `steps/`.
- It also hid what really was saved: attempt 2's steps, which attempt 3 started from (`startedFrom` `8bcd1a37…`), are still in the task's memory.

**Exact change proposed:**

1. `packages/contracts/src/task-attempts/saved-state.ts`:
   - `notes_only` gains an optional `why: "still_waiting" | "not_assembled" | "not_saved"`.
   - Add `"why"` to `notes_only`'s allowed keys (line 49), and parse it as one of those three words.
2. `answer-first/attempt-store/outcome-of-record.ts` `savedOf`:
   - When `attempt.status` is `working` or `waiting_for_person` and the record has no `candidateId`, return the saved state of the Flow the attempt started from, where `attempt.startedFrom` names one (the task memory's `best`, via `automationStudioAnswerFirstSavedStateOf`).
   - Otherwise return `{ state: "notes_only", trust: "unproven", savedAtMs, why: "still_waiting" }`.
   - For an ended attempt with no candidate, carry the draft's own reason as `why`. Today `draft-save.ts` returns `kept.why` as `"not_assembled" | "not_saved"`. `attempt/ending.ts storedEnding` would pass it into the row, which needs `attempt-store/record.ts` to gain `draftKept?: "not_assembled" | "not_saved"`.
3. `packages/ui-components/src/chat/answer/words/saved-words.ts`, case `"notes_only"`:
   - `still_waiting` → `${on}: no steps saved yet. This attempt is waiting for you, and its steps are saved as a Flow when it ends.`
   - `not_assembled` → `${on}: notes only. The steps I took did not fit together as a Flow, so next time I will start from what I learned.`
   - `not_saved` → `${on}: notes only. Saving the steps failed this time, so next time I will start from what I learned.`
   - With no `why`, keep today's sentence.
4. Tests:
   - `attempt-store/tests/outcome-of-record.test.ts`: a waiting row that started from a saved Flow reads as that Flow's state, not `notes_only`.
   - `ui-components/src/chat/answer/tests/model.test.ts`: one line per `why`.

## Not verified

- **A Lab attempt 2 that repairs.** The `left-out` form's later attempts replay the saved Flow cleanly; they do not repair. The repair keeping its conditions is proven only by the provider-free Core test, through the real service and engine.
- **`sameLabelKept` in a real browser run.** This site's ad and non-ad labels did not coincide in this run, so no judge request shows `sameLabelKept`. It is proven by unit tests and the engine-to-judge test only.
- **A live, model-backed judge.** I did not check whether a real judge now says yes on the original towels evidence. No paid call was made.
- **Full Core and extension suites.** Neither was run, by the twice-a-day rule. The extension's test-runner ran only the free-hubs script tests.

## Open questions or contradictions found

- **How a Flow-run condition is worded.** It reads "the item's text not is present", while the exploring read's reads "span_css-1r8u2lx not is present".
  - The dispatched `where` names its field differently after the domain's declared-columns narrowing, so `conditionWording` falls back to how the field is read.
  - Both are correct, and the rows and the "it read \"Ad\"" value say what was tested.
  - The wording "not is present" (`is: "present", not: true`) is awkward in both. That comes from `read-account/condition.ts`, and I did not change it.
- **The repaired-Flow requirement holds as written.** Its test shows a repaired Flow's replay keeps every condition. That agrees with my earlier trace: the conditions were never lost; their account was.
