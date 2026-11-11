# t905 result ledger: sub-supervisor report

## Checkpoint 2, 2026-11-11: phase 1 (domain parts) and the phase 2 ledger core

**Outcome:** Partial.
- **Done and checked:** `listKey` from site structure on live and saved reads, through the Core record batch (`listKey` and `place` fields); exploring reads send `answer: "kept"` (D3) with truthful I4 wording; the I7 vocabulary table test is written; the phase 2 ledger `answer-first/result/` is built with its tests and is not wired.
- **Blocked on t885's files:** where the page reports `place`, the five read-vocabulary gaps (all in `apps/extension/src/content/extraction/**`), and the wiring.
- **Not done:** the hubs scripted-attempt fix (1d). Its reproduction run never ran to completion, for the reasons below. It will run on the tree after your dev merge.

### What changed

E = `fxwork/t905/!FluxIQWebExtension`, C = `fxwork/t905/!FluxIQ/packages/fluxiq/src`, AF = `C/framework/automation-service/service/answer-first`.

**Phase 1a: `listKey` and `place` (p1-listkey-place, Sonnet; I added the integration).**
- `E/domain/src/output-nodes/extract-list/list-key.ts` (new): `list.<hex>`, a digest of the read's item selector and frame path (or frame id). It holds site structure only, never the page address.
- `structure/handles.ts`: `webLlmExtractionListKey`. `resolve` now returns the binding with its `listKey`.
- `output-nodes/extract-list/answered.ts` (new): stamps `listKey` and `place` beside `extracted`. It is used by the live read (`node-run/run.ts` via `list-read/answer-keys.ts`) and, through my edit, by the saved read in `E/domain/src/runtime/adapter.ts`. So a detection's key, a live read's and a saved read's agree.
- `actions/extraction/list-continues.ts` and `summary.ts`: a typed place (`page`, `offset` or `cursor`), validated strictly and written `page=3` and so on.
- Core `C/engine/automation/records/read/{list-key,place}.ts` (new readers).
- My edits:
  - `C/engine/automation/records/capture.ts` and `C/engine/automation/contracts.ts` (`AutomationStudioRecordBatch.listKey` and `.place`), with a test in `records/tests/capture.test.ts`.
  - The `structure/index.ts` barrel exports.
- **Gap (needs you):** nothing on the page sends `place` yet. The pager's page number is read only in `apps/extension/src/content/extraction/page-advance/` (`shown-page.ts` `pageShownNow`), which t885 holds, and no load-more offset or cursor is read anywhere. The domain accepts and stamps `place` as soon as the page sends `extraction.place = {kind, value}`. Until then Core keeps its interim address-word place (`rows/address-split.ts`).
- `container` is optional in the key and nothing sets it yet. Only `detect.ts`, which t885 holds, knows it. Keys agree today because no container is set on either side.

**Phase 1b: D3 and I4 (p1-kept-reads, Sonnet).**
- `node-run/rejected-rows.ts` `webNodeDispatchParameters`: every exploring list read is dispatched with `answer: "kept"`, as the saved Flow's dispatch already is. Proposing reads still ask for rejected samples, so left-out evidence still arrives.
  - The worker edited this file outside its brief, because it is the one place the live read's parameters are built. I reviewed it and accepted it.
- `node-run/shown-rows/account.ts`: kept rows are called kept, and rejected rows are left out and not result rows. A read that kept none says so. An answer that still arrives unfiltered is described as the rejected rows.

**Phase 1c: the I7 test (p1-read-vocabulary, Sonnet; I fixed three type errors).**
- `E/domain/src/runtime/llm-evidence/page-view/tests/read-vocabulary.test.ts` (new). It reads `state-tokens.ts` and requires every `tokens.push(` site to be claimed by a table row, so a new token fails. It then checks each row against the real request reader. View-only tokens (covered-by, focused, modal, layer kind, covers n) are excluded with reasons.
- **It fails today, on purpose, on five real gaps.** Do not commit it until they are fixed, or decide otherwise:
  1. `disabled` from `cursor: not-allowed`;
  2. `marked`;
  3. native checkbox and radio `checked`;
  4. a select's chosen label;
  5. a select's option list.
- Every fix is in `apps/extension/src/content/extraction/field-reader.ts` (`readElement`, `controlValue`) and `item-mark/state-sources.ts`, plus the field kinds and marks in `E/domain/src/actions/extraction/request.ts` and `schema.ts`. That is t885's ground, and R1 covers part of gap 1.
- My recommendation: once t885 lands, a t905 worker fixes all five and lands this test with them. I would keep 5 as a column too: a person may want the options a row offers.

**Phase 2 ledger core (p2-ledger, Opus).**
- `AF/result/` (new, 21 files, not wired). Its entry point is `automationStudioAnswerFirstResultPort(instruction)`, which provides:
  - `record(events)`, which returns the line the call's answer carries;
  - `header()`, `outputStep()`, `answer()`, `emptyRefusal()` and `ledger()`.
- Events: `page`, `step`, `paging`, `dropped`, `look` and `take`.
- It applies D1, D2 and D3, and has no fixed cut.
- The worker reverted each of 13 rules in turn, and each reversion failed its tests. That includes the run shapes mwafor01, mwaudvnh, mwa19obz, mwbk0twg, Saturday and mwb2kkv5.
- Priya fix 4 was already on the branch (a79248cb5). Only a test with run mwblz4aq's own wording was added.
- **Points for the wiring (worker's findings, which I agree with):**
  - (a) A page with no `place` appends as "next after the last", so a step re-run from the start without places would add duplicate pages. Reliable domain places (the gap above) gate this.
  - (b) A version must hold no handle, or the Saturday fold fails.
  - (c) Moving a step must send a `step` event.
  - (d) `AF/index.ts` must export `./result/`.

**Your 2026-11-11 additions to phase 2.**
1. **The saved Flow must hold the output step's current version.** This goes in the wiring step: `attempt/ending.ts` and `attempt/draft-save.ts` are under `AF/attempt/*`, which t885 holds.
   - Under D1, the run-mwcess01 path (a hand-made filtered read becoming the answer) cannot happen: that read is a look.
   - The remaining guarantee is that assembling or saving includes the output step's current version (conditions and fields).
   - The plan: a pure check in `AF/result/` called at save, with a test that fails when the saved Flow drops the output step's conditions.
2. **Remove the dead `stuck_in_a_loop` branch** in `attempt/ending.ts`, keeping the carry-on refusal and its test. Also in the wiring step.

### Commands run (by me) and what they showed

- Domain tests beside phase 1:
  - `DOMAIN_TEST_BUILD_LABEL=t905-sup node scripts/test-domain.mjs structure/tests/handles extract-list/tests/answered summary-place node-run/tests/run.test target-binding node-run/tests/shown-rows node-run/tests/rejected-rows node-run/tests/replay actions/extraction/tests/read-request` -> `# tests 158, # pass 158, # fail 0`
  - `... test-domain.mjs page-view/tests/read-vocabulary` -> ok 1-4, `not ok 5 - every printed element token maps to a read field (I7)` (the gaps above, intended)
- Core:
  - `npx vitest run src/engine/automation/records` -> 5 files, 55 tests passed
  - `npx vitest run .../answer-first/result src/runtime/flow-authoring/bootstrap/answerability` -> 10 files, 75 tests passed
- Typechecks:
  - Core rebuild then `pnpm check` (packages/fluxiq) -> CORE_CHECK_OK
  - Domain `pnpm check`: the first run's only errors were 3 type errors in read-vocabulary.test.ts, now fixed. After a Core library rebuild, the rerun printed DOMAIN_CHECK_OK, with tsc for src and tests clean.

### Phase 1d: the hubs scripted model (p1-hubs-attempts, Sonnet), not done

- **Confirmed script limit:** the plain form of `packages/test-runner/src/attempt-lane/scripted-model/scripts/crossborder-marketplace-free-hubs-under-ten.ts` holds two `panel_command` replies and three `loop_verification` replies, so `--attempts 4` cannot run. The `left-out` and `timed-check` forms already size these from `1 + LATER_ATTEMPTS`.
- **Unconfirmed:** whether "the read's fields hold no title" at request 17 is a script limit or a product defect. That needs a reproduced run's step logs.
- **Why there is no reproduction yet:**
  1. The worker's foreground run waited past its 10-minute limit in the heavy-slot queue, and the run died when the worker handed back.
  2. My background run failed at startup: "Core's build inputs changed while the web panel was building". The ledger worker was editing Core at the time.
  3. I stopped my third run in its prelude, so it would not be building from these trees while you commit and merge dev. No t905 process is left running.
- **Plan after the merge:** I run the reproduction myself in the background. The worker then fixes the script from the evidence and runs the proof.

### Workers this checkpoint

| Label | Tier | Outcome | What I checked |
| --- | --- | --- | --- |
| p1-listkey-place | Sonnet | Partial (needed files outside its brief) | Diff read; I made the adapter, capture, contract and barrel edits; tests, tsc and audits re-run |
| p1-kept-reads | Sonnet | Partial (`pnpm check` refused on a stale Core; edited `rejected-rows.ts` outside its brief) | Diff reviewed and accepted; tests (158 pass) and tsc re-run |
| p1-read-vocabulary | Sonnet | Partial by design (5 gaps) | Test run: 4 pass, 1 fails on the gaps; 3 type errors fixed by me |
| p1-hubs-attempts | Sonnet | Partial (no reproduction, no edit) | Nothing to check; to be re-run after the merge |
| p2-ledger | Opus | Done | Diff and model-facing words reviewed; 75 tests, Core tsc, audit and model-text re-run |

### Plan for the wiring after your merge (phase 2 continued)

Wiring, by one Opus worker:
- `call-chain.ts`, `flow-run.ts` `onRecordBatch`, the draft port, `run-attempt.ts`, the decision context's header slot, and `refused-words.ts` `resultHolds`;
- `ending.ts` and `keep.ts` read the output step;
- `amend_draft take` in `draft/amendment/{schema,apply}.ts` and `decision-handlers/amendment.ts`;
- `AF/index.ts` exports `./result/`.

Then port every `rows/tests` case, list each changed expectation, and delete the guessing rules (`result-dataset.ts`, the `list-after-read.ts` rules, `held_apart`, `result-change.ts`, `run/result-list.ts`, the recorded-read-key matching).

Your three additions go into the same step:
1. **The save path holds the output step's current version (its conditions and fields).** A test fails when the saved Flow drops them.
2. **The `stuck_in_a_loop` branch leaves `ending.ts`**, keeping the carry-on refusal and its test.
3. **The run-mwcncux8 shape.** A hand-made read of a list a loop step already reads (same `listKey`, D2) folds into that step, and a hand-made Next page that only advances that list goes with it, so neither is saved after the loop. There will be a ledger test and an assembly test, on a generic fixture.

Proofs: scripted towels and hubs at `--attempts 4`. Each attempt's `request.txt` must show the header.

Outcome: Partial
Changed: E domain/src/{output-nodes/extract-list/{list-key.ts,answered.ts,index.ts,tests/answered.test.ts}, runtime/adapter.ts, runtime/llm-evidence/structure/{handles.ts,index.ts,tests/handles.test.ts}, runtime/llm-evidence/node-run/{run.ts,rejected-rows.ts,list-read/{answer-keys.ts,index.ts},shown-rows/account.ts,tests/{run,rejected-rows,shown-rows}.test.ts}, runtime/llm-evidence/page-view/tests/read-vocabulary.test.ts (do not commit yet), actions/extraction/{list-continues.ts,summary.ts,tests/summary-place.test.ts}}; Core packages/fluxiq/src/{engine/automation/contracts.ts, engine/automation/records/{capture.ts,tests/capture.test.ts,read/{list-key.ts,place.ts,index.ts,tests/list-key-and-place.test.ts}}, framework/automation-service/service/answer-first/result/** (new), runtime/flow-authoring/bootstrap/answerability/tests/instruction-columns.test.ts}
Validation: domain tests beside the change -> 158 pass, 0 fail; read-vocabulary -> 4 pass, 1 fail (intended gaps); Core records vitest -> 55 pass; ledger and answerability vitest -> 75 pass; Core `pnpm check` -> CORE_CHECK_OK; domain `pnpm check` -> DOMAIN_CHECK_OK; structure audits pass in both repos; model-text ok
Not verified: hubs scripted proof (no reproduction yet); the page sending `place`; listKey seen in a real Lab run's request.txt
Report: C:/Users/osrs_/FluxStuff/fxwork/t905/!FluxIQWebExtension/docs/working/mvp-launch-plan/reports/t905-result-ledger.md
Notes: checkpoint 2; tiers: 4 Sonnet and 1 Opus this checkpoint, no escalation; hold read-vocabulary.test.ts out of the commit until its gaps are fixed
- Structure audits:
  - E `node scripts/structure-audit.mjs` -> passed (249 warnings, 552 baselined)
  - Core -> passed (537 warnings, 969 baselined)
- `node scripts/check/model-text.mjs` (E) -> ok (203 scenario tokens, 491 model-facing Core files)

## Checkpoint 1, 2026-11-11: phase 0 done (Core only)

**Outcome:** Phase 0 is done and checked in the Core tree `fxwork/t905/!FluxIQ` (task/t905-result-ledger). Nothing in the extension tree changed apart from these reports. Phases 1 to 3b have not started.

### What changed (Core, `packages/fluxiq/src`)

**Phase 0a, the judge gets everything whole** (`runtime/result-verification/flow-less/`):

- `judged-summary.ts`: removed `LOOKS_SHOWN` (6), `FOUND_CHARS` (600), `WHERE_CHARS` (300) and `cut()`. Every look now reaches `sent` whole.
- `read-pages-shown.ts`: removed `READS_SHOWN` (40), `WHERE_CHARS` (300), `PLACE_CHARS` (80), `FOUND_CHARS` (200), `cut()` and the `notShown` count. Screening is unchanged.
- `question.ts` and `tests/__snapshots__/judged-summary.json` (my integration edit): dropped "readPagesNotShown counts any earlier reads left out", because that key no longer exists.
- Size is handled only by `window-fitting.ts`, which was not changed. New tests show it summarises `looked` and `readPages` by name.
- Tests changed: `tests/looked-view.test.ts`, `tests/read-pages.test.ts`, `tests/window-fitting.test.ts`. They cover a 2,000-character look, a 300-character left-out label, more than 40 pages, and an oversize summary being summarised and named.

**Phase 0b, the run's note gives the result after the run** (run-mwbk0twg):

- `framework/.../answer-first/rows/result-change.ts`: a new change kind, `carried_on`. It holds counts only and no instruction words, under the code `answer_first.result_list_carried_on`.
- `rows/row-sink.ts`: a replay pass (`call.value.replay`) that adds to the result's own list now records the result's rows and pages as they stand after it.
- `runtime/llm/node-tools/run/result-list.ts`: the run's note keeps `replaced` and the instruction from the first pass that switched the result. It takes the counts from the last pass that stored rows. A run that changed nothing still carries no note.
- I did not change `flow-part.ts`. The route through the row sink avoids every t885 file. The design's alternative, passing the sink's summary as a port, would have needed `evidence-loop*`.
- Tests: `run/tests/result-list.test.ts` (pass 1 replaces 11 rows, pass 2 carries on +5, so the note says 16 rows over 2 pages) and `rows/tests/carried-on-stamp.test.ts` (new). In `rows/tests/replayed-read.test.ts`, two assertions changed from "no note" to the stamp, on purpose.

### Workers

| Label | Tier | Brief | Outcome | What I checked |
| --- | --- | --- | --- | --- |
| p0-judge-cuts | worker (Sonnet) | phase 0a | Partial: its `pnpm check` was still queued when it stopped, and it flagged question.ts | I read the diff, fixed question.ts and the snapshot, and ran the tests, audit and tsc below |
| p0-run-note | worker (Sonnet) | phase 0b | Done | I read the diff and re-ran the tests, the neighbouring tests and tsc |

### Commands run (by me) and what they showed

- `npx vitest run src/runtime/result-verification/flow-less src/runtime/llm/node-tools/run src/framework/automation-service/service/answer-first/rows` printed "Test Files 30 passed (30), Tests 272 passed (272)".
- `npx vitest run .../attempt/tests/named-columns.test.ts .../answer-first/tests/latest-read.test.ts src/runtime/run-overrides/tests/prompt-text.test.ts .../answer-first/completion` printed "Test Files 12 passed (12), Tests 92 passed (92)". That includes the real-SQL latest-read case "a Flow run that switches the list: the run's answer says so".
- `node scripts/structure-audit.mjs` printed "structure-audit: passed (535 warning(s), 969 baselined)".
- `heavy-slot run t905 -- pnpm check` (Core packages/fluxiq tsc) printed `{"build-cache":"build","step":"fluxiq:check",...}` and exited with code 0 (no type errors).

### Not verified

- The scripted towels Lab proof (`pnpm lab attempt bigbox-retail --task bigbox-retail-rated-delivery-towels --authoring-mode answer-first --scripted-model --attempts 4`) has not been run. It needs the downstream workspace built against this Core tree. I propose running it at the phase 2 proof, when the header replaces this note anyway.
- The `result-list.ts` unit test alone would still pass with the old `result-list.ts`, because the old "last note's counts" logic also yields 16 once pass 2 carries a stamp. The regression guard for the actual fault is the sink stamp test, `carried-on-stamp.test.ts`, which cannot pass without the `row-sink.ts` change.

### Open questions and notes for the lead

- The finished-run judge (`result-verification/build-test/change-lines.ts` `CHANGE_LINE_CHARS`, and `rowsNotShown`/`changedNotShown` in `read-rows.ts`/`stores.ts`) still cuts. That is phase 3b's ground, so I left it.
- `carried_on` is interim. Phase 2 deletes `result-change.ts` and `result-list.ts` in favour of the ledger header and change line.

Outcome: Partial
Changed: Core packages/fluxiq/src/{runtime/result-verification/flow-less/{judged-summary,read-pages-shown,question}.ts, flow-less/tests/{looked-view,read-pages,window-fitting}.test.ts, flow-less/tests/__snapshots__/judged-summary.json, runtime/llm/node-tools/run/result-list.ts, run/tests/result-list.test.ts, framework/automation-service/service/answer-first/rows/{row-sink,result-change}.ts, rows/tests/{replayed-read,carried-on-stamp}.test.ts}
Validation: `npx vitest run` (flow-less, run, rows) -> 30 files / 272 tests passed; neighbours -> 12 files / 92 passed; `pnpm check` (Core tsc, heavy slot) -> exit 0; `node scripts/structure-audit.mjs` -> passed (535 warnings, 969 baselined)
Not verified: scripted towels Lab proof; phases 1-3b not started
Report: C:/Users/osrs_/FluxStuff/fxwork/t905/!FluxIQWebExtension/docs/working/mvp-launch-plan/reports/t905-result-ledger.md
Notes: checkpoint 1 of the lane (phase 0); tiers: 2 Sonnet workers, no escalation
