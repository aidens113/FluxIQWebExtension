# Amendment filter not saved into the Flow (run-mwcess01-e0124be6)

Worker: amendment-filter-not-saved (E1 brief). Read-only trace; no source or test edited.

## Outcome

Done (trace and proposal). The debug note's description ("attempt 1 amended its draft twice and the
filter was lost on save") is half right. Two defects stacked:

1. **The amendment that carried the filter never ran.** Decision 0017 was a `rerun` of draft step 5
   with `where role contains Apprentice`. On t898's Core the rerun first sent a reset
   (`rerun.5.place`, `replay: "reset"`, step 0019). Answer-first refuses every reset
   (`answer_first.no_reset`, `ok: false`), so the rerun was unreachable and nothing ran. Draft step d5
   kept its unfiltered input, though row 0018 says `applied`, `draftState: changed`. **E1 fix 31**
   (`4a055aab4`, task/t885 Core: "a repaired step re-runs from the page as it stands") already fixes
   this. t898's Core (`e39e2d332`) does not contain it, and Core `dev`/`origin/dev` do not contain it
   yet either.
2. **The answer came from a read the Flow does not hold, and nothing on the save path notices
   (unfixed).** Once the rerun failed, the model reran the unfiltered Flow (0020-0026, 28 rows). Then it
   made the filtered read by hand, without `add` (0029, `apprentice.read.1`). The row sink made those 4
   rows the result (`answer_first.result_list_replaced`), and the judge (0031) passed them. The ending
   saved the Flow from the draft's kept steps, where d5 is still unfiltered. The 0029 step was
   `taken`, not `kept`, so it is not in the Flow. Attempt 2 replayed d5 and delivered 28 rows; its
   judge (0052) refused them as `kept_not_asked`, which cost a repair (0053-0063).

Fix 31 alone closes this run's exact path. The root fix still needs part 2: the saved Flow must hold
the read whose rows are the answer. Otherwise, any attempt whose last, conditioned read is made by
hand saves a Flow that does not reproduce its answer.

## Answers

### 1. Which amendments carried the filter

- **0015 → 0016** (`llm_evidence_loop.draft_amended`, revision 4→5). Loop only, no filter:
  `{"kind":"amend_draft","amendments":[{"step":5,"change":"repeat","while":7}]}`
- **0017 → 0018** (`llm_evidence_loop.draft_rerun`, revision 5→6, `rerunStepId: "d5"`). **The filter:**
  `{"kind":"amend_draft","amendments":[{"step":5,"change":"rerun","input":{"parameters":{"extractList":{"where":[{"field":"role","contains":"Apprentice"}]}}}}]}`
- 0019 is the rerun's placement call, `{"callId":"rerun.5.place","toolId":"core.run_node","input":{"replay":"reset","from":{"location":".../team"}}}`.
  It answered `{"ok":false,"code":"answer_first.no_reset"}`, and `rerun.5` itself was never sent.
- The rows the judge passed came from **0029**, a plain tool call (not an amendment):
  `core.run_node` `web.output.dom-extract_list` with
  `extractList {handle: extraction.1, fields{name,role,branch}, where:[{field:role, contains:Apprentice}], minItems:0}`,
  with no `add`. Its answer: `addable: true`, and `resultList.code: answer_first.result_list_replaced`
  (4 rows replaced the 28-row list whose `lastReadBy` was `run.flow.5to7.5.pass.3`, the Flow's d5
  replayed).

### 2. Where the filter was held

- **Not on the draft step's parameters.** d5 never got it: the attempt-1 forward run 0021 sent d5
  with no `where`, and the attempt-2 replays 0036…0048 likewise.
- **Not in a held amendment.** Decision 0017 had only the rerun, so `split.held` was empty.
- **The rerun request's merged input** (`automationStudioLlmEvidenceRerunRequest` →
  `request.input`). It was discarded when the placement was unreachable: the rerun's
  `RerunReplaced` only swaps a step in after a rerun that ran.
- **The `taken` draft step of call `apprentice.read.1`** (0029; `draftRecord` gives a call without
  `add` the disposition `taken`, `runtime/llm/evidence-loop.ts:186-188`).
- **The row sink's result list**: a list of its own, with conditions `[role contains Apprentice]`
  and `by: apprentice.read.1`. It displaced d5's list, whose pages were 8/16/24/28 (0010's read
  plus three replay passes). So the sink knew the result's read and the Flow read it displaced. The
  draft and the save path never ask it.

### 3. Where it is dropped on the save path, and why

- **Live (t898 Core):** `runtime/llm/node-tools/step-place.ts` `automationStudioNodeRerunFromItsPlace`
  sends `<callId>.place` with `replay: "reset"`. `answer-first/attempt/call-chain.ts` refuses it
  (`NO_RESET_CODE`). `automationStudioNodeRerunAnswer` returns the refusal for
  `place.kind === "unreachable"` without running. `automationStudioLlmEvidenceRerunReplaced` leaves d5
  in place. The filter is gone at this point, before any save. (Fixed on t885 by fix 31:
  `rerunsInPlace: true` from `attempt/round.ts:90`, and `inPlace()` in `step-place.ts`.)
- **Save:** `attempt/ending.ts` → `automationStudioAnswerFirstStandIn(run)` (only a saved step a run
  broke at) → `attempt/draft-save.ts` `checkAutomationStudioFlowBootstrapCompletion({ draftSteps: run.steps })`.
  It assembles only the proposed (`kept`) steps. Nothing between the sink and the save compares the
  result's read (`sink` `held.by`) with the Flow's steps. `completion/check.ts` does not read the
  draft. The judge judges rows, not the Flow, so 0031 rightly passed. The divergence surfaced only as
  attempt 2's `flow_not_proven` judge (0051-0052), working as designed but one attempt late.

### 4. Root fix

**Part A: land fix 31 everywhere.** Merge task/t885's Core (`4a055aab4`) into Core `dev`, then sync
it into every live lane (t898 included) before further live runs. Missing test: fix 31's
`tests/endings/tests/rerun-reset.test.ts` asserts the rerun call. It does not assert that the saved
Flow carries the rerun's new argument, and its read went through the act-done check path. Add
`framework/automation-service/service/answer-first/tests/endings/tests/rerun-filter-saved.test.ts`
(fake library, `scriptedAttempt`). The case: an unfiltered read with `add`, then the page moves, then
`amend_draft rerun` of that read with a `where` patch, then complete. Expect:
(a) no `replay: "reset"` call;
(b) the stored `steps` read is `kept` at the old position, its input holds the `where`, and the old
read is listed at the end with `replacedBy`;
(c) the saved candidate's read node carries the `where`;
(d) a second attempt's run_flow delivers only the filtered rows with zero decisions.

**Part B: the read whose rows are the answer stands in for the Flow's read it displaced** (new). This
is the sibling of `flow-run/stand-in.ts` and uses the same mechanism (`automationStudioLlmEvidenceRerunReplaced`
with `takesItsPlace`). It is applied once at the ending, before anything is saved. The filtered read
then takes d5's place, its acts and route places, and the `repeat through d5 while d7` routing,
which is renamed. d5 stays listed at the end as the receipt. The Flow then reruns exactly the read
the answer used, with exactly its `where`.

Core files (t885 Core worktree, `packages/fluxiq/src/framework/automation-service/service/answer-first/`):

1. `rows/row-sink.ts` and `rows/sink-type.ts`: per list, keep the call ids of the reads the model
   made that stored into it (exploring calls; a replay's call id names no step). When a read makes
   the result another list or starts it over (`changed()` → `other_list` / `started_over`), record
   which list it displaced. Expose `resultRead(): { callId; readBy: string[]; displacedReadBy: string[] } | undefined`,
   following displacement transitively (R2 displaced R1, which displaced d5). A working read
   (`lookUp`) and a list set aside never count.
   Test: `rows/tests/result-read.test.ts`. Cases:
   - an unfiltered read, then a run's replays of it, then a filtered read: `resultRead()` names the
     filtered call, and `displacedReadBy` holds the unfiltered read's call id;
   - a later page of one list keeps one list;
   - a working read is never `resultRead`;
   - a chain of two displacements reaches the first read.
2. `flow-run/result-read-stand-in.ts` (new; export it from `flow-run/index.ts`):
   `automationStudioAnswerFirstResultReadStandsIn(run)`.
   - S_R is the step whose `callId` is `resultRead().callId`. It must not be proposed, must be
     `effect: "observe"`, and must have no `routing`, `standsFor` or `replacedBy`.
   - S_F is the last proposed, un-replaced step with the same `actionId`, `toolId` and `effect`
     whose `callId` is in `readBy ∪ displacedReadBy`.
   - Work on copies, as `stand-in.ts` does: move S_R to the end, call
     `automationStudioLlmEvidenceRerunReplaced(ordered, S_F, { takesItsPlace: true })`, and keep the
     result only where S_F left and S_R is `kept`.
   - Write one step-log note naming both steps (`automationStudioLlmStepLogNote`).

   Test: `flow-run/tests/result-read-stand-in.test.ts`. The positive case is this run's draft:
   navigate, click, d5 read kept with repeat-while-d7, d7 next page kept, and a taken filtered read.
   The filtered read must stand at d5's position with d5's routing renamed, and d5 must be at the end
   with `replacedBy`. Negatives:
   - the result read already kept;
   - the result came from the Flow's own read or its replay;
   - another node, another tool, or a mutate step;
   - a working read;
   - no Flow read of the displaced list.
3. `attempt/ending.ts`: call it right after `automationStudioAnswerFirstStandIn(run)`, before
   `automationStudioAnswerFirstPathAtEnding`. The path then reports the changed Flow honestly.
   `apply-proven` is already safe: `automationStudioAnswerFirstProvenRun(run, ending, stepsDigest)`
   checks the final steps' digest, so a Flow changed here is never applied as proven, and the next
   attempt's replay is judged (`flow_not_proven`) as now.
   Test: `tests/endings/tests/result-read-saved.test.ts` (fake library). The case: read the loans with
   `add`, read them again with a `where` and no `add`, then complete. The saved candidate's read
   carries the `where`, and attempt 2 (run_flow) delivers only the filtered rows with zero decisions
   and a yes judge.

Must not change: the row sink's result rules, `completion/check.ts`, and the judge.

Coordination: the t885 Core tree has other workers' uncommitted edits in `attempt/round.ts`,
`attempt/state.ts`, `attempt/rounds.ts` and `attempt/round-note.ts`, among others. `ending.ts`,
`flow-run/*` and `rows/*` are not among them. Part B needs no `state.ts` change: `run.sink` and
`run.steps` are already on the run.

Optional, not a substitute: a `resultList` note on a read made without `add` could say that the
Flow's step still reads that list without the condition. That is guidance the model may ignore;
Part B is the deterministic fix.

### 5. Provider-free proof at `--attempts 4`

There is no such form today. `packages/test-runner/src/attempt-lane/scripted-model/scripts/company-website-apprentices.ts`
has one form only (`scripts/index.ts` ignores `form` for this task). It reads with the `where` and
`add: true` at once and never amends. It also answers one attempt only (`panel_command: [startAttempt]`,
`loop_verification: [answersRequest]`), so it cannot run `--attempts 4` at all.

Add a `form` parameter to this script, in the shape of `crossborderMarketplaceFreeHubsUnderTenScript`
(keep `plain`; refuse unknown forms), and register `(form) => …` in `scripts/index.ts`. Two new
forms, each answering four attempts: `panel_command` ×4, `loop_verification` ×8, and the same
`decide` budget.

- **`amended-filter`** (proves Part A; mirrors 0015-0018):
  1. Take the plain path up to the read, then read without `where`, with `add`
     (callId `read-team-all`).
  2. Once that read is in evidence, reply
     `{"kind":"amend_draft","amendments":[{"step":N,"change":"rerun","input":{"parameters":{"extractList":{"where":[{"field":<role key>,"contains":"Apprentice"}],"minItems":0}}}}]}`.
     N is read from the latest `core.flow_draft` evidence entry: its `steps[].step` for the `kept`
     step whose `actionId` is `web.output.dom-extract_list`. Never hard-code it.
  3. Complete once the evidence holds `rerun.N` answered.
- **`filtered-by-hand`** (proves Part B; mirrors 0029): read `read-team-all` with `add`, then a
  second read with the `where` and **no** `add` (callId `read-apprentices`), then complete.
- **Judge for both (`apprenticesOnly`).** It throws, naming the counts, unless the result's record
  sets hold exactly 4 rows and every sample row's role column contains "Apprentice". Otherwise it
  answers `scriptedJudgement(..., {answersRequest: "yes"})`. A replay that lost the filter therefore
  fails loudly at attempt 2's judge ("28 rows, 24 not apprentices"); a judge answering "no" would let
  the run wander into a repair the script cannot answer.
- **Command** (Lab run, through the heavy-slot queue):
  `FLUXIQ_ATTEMPT_SCRIPT_FORM=amended-filter pnpm lab attempt company-website --task company-website-apprentices --authoring-mode answer-first --scripted-model --attempts 4`.
  Then the same with `filtered-by-hand`.
- **Expected after the fix, for each form:**
  - attempt 1 explores;
  - attempts 2-4 take path `run_flow` with zero `evidence_tool_decision` requests, each delivering
    the 4 apprentices;
  - the continuation proof holds (each later attempt ran the Flow its predecessor saved).

  **Before the fix**, the forms fail as follows (red-first):
  - `filtered-by-hand` fails at attempt 2's judge with 28 rows, on t885 today (Part B missing);
  - `amended-filter` passes on t885 (fix 31) and fails on a Core without fix 31.
- Unit tests beside the script: `scripts/tests/company-website-apprentices.test.ts`.
  - `amended-filter` emits the rerun with the position read from a `core.flow_draft` entry;
  - `filtered-by-hand`'s second read carries `where` and no `add`;
  - the judge throws on a 28-row summary and answers yes on the 4 apprentices;
  - an unknown form is refused.

## Commands run and observed results

- Read the step logs `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-11/run-mwcess01-e0124be6/steps/` (index.md,
  0015-0031, 0036, 0051) and the debug note
  `C:/Users/osrs_/FluxStuff/fxwork/t898/!FluxIQWebExtension/docs/working/language-driven-flow-loop-plan/debugs/run-mwcess01-e0124be6.md`.
- `git merge-base --is-ancestor 4a055aab4 HEAD` in t898 Core -> "t898 LACKS fix31". In t885 Core
  against `dev` and `origin/dev` -> both lack it. t885 Core branch is `task/t885-live-checks-r3`.
- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t885 -- npx vitest run src/runtime/llm/evidence-loop/tests/rerun-place.test.ts src/runtime/llm/evidence-loop/tests/rerun-request.test.ts`
  (in `t885/!FluxIQ/packages/fluxiq`) -> "Test Files 2 passed (2), Tests 50 passed (50)".

## Not verified

- I did not rerun this task live or scripted. Part B and the new forms are designs and are not
  implemented.
- I did not run fix 31's end-to-end `tests/endings/tests/rerun-reset.test.ts` (real-sql group).
- I did not check that the fix-31 in-place rerun of d5 in this exact draft is admitted by every
  guard. I traced `changes_nothing` (the merged input differs, so it is not refused). I did not trace
  the loop-check ladder (`decision-handlers/loop-check.ts`).
- I assumed exploring reads' call ids reach the sink as the draft steps' `callId`s (the same
  `call.callId` the loop records). The Part B worker should confirm this in its first test.

## Open questions or contradictions found

- Row 0018 says `applied` / `draftState: changed` for a rerun that never ran. Fix 31's commit says a
  rerun that never reached the page is now marked unrun; I did not check whether the row's
  `draftState` is corrected too.
- The debug note credits "two draft amendments" with the filter. Only 0017 carried it, it never ran,
  and the answer's filter came from a hand read (0029).
- If the model adds both the unfiltered and the filtered read (both `kept`), the Flow reads twice.
  Part B leaves that case alone by design; it is not this run's defect.
