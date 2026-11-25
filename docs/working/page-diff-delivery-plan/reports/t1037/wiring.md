# t1037 (W3) phase 2, worker `wiring`: Core's evidence loop drafts the Flow itself

## Phase 2b: the 20 real-sql failures, fixed at their causes

### Outcome
**Done.** All 20 real-sql failures are fixed at their causes. The two recovery assertions are updated (D11). The
pre-existing `route-state/build-routing` "run-munneauy-de8663ed, rebuilt" is left as you asked: it fails with my files
at HEAD too, and you are tracking it.

The last pass, over your folders plus `src/runtime/adaptation`:
- parallel: that one test failed;
- real-sql: everything passed once the last three changes were re-run.

Typecheck, structure audit and model-text pass. No case needed both reads of one list kept.

### Causes found and what fixed each
1. **Steps carried from a saved Flow or an earlier attempt were drafted again.**
   - A saved draft's steps keep the framework's `drafted` word. Seeded into a later attempt, they were recomposed as if
     that attempt had run them. For example, the saved read a run broke at was taken out as an earlier copy of the
     read the model then made by hand. The Flow was then saved as repaired, and the attempt counted as a repair.
   - Fix:
     - New loop input `draft.carried`, the ids of the carried steps. Answer-first passes `run.startedWith`
       (`attempt/round.ts`), and any `f<n>` step counts too.
     - `evidence-loop/framework-draft/carried-steps.ts` makes a carried step that is in the Flow the model's own, so a
       rerun of it is the model's in its place.
     - Compose takes `isRuled` and never decides those steps again, in or out.
   - Fixed: hand-fix, apply-proven (the "judged no" path), and the saved-Flow attempts.
2. **A press that left the page as it found it started a "detour".**
   - Opening a form the digest does not see, then typing a note, was marked `dead_end` as a whole (state S to S, and
     back to S). The card press that sent the form was then left alone, so the saved Flow could not run.
   - Fix (`compose/dead-end.ts`): a detour starts only where a press moved the state (`stateAfter !==
     stateBefore`).
   - Fixed: replay-over-done-act (attempts 2-4 `run_flow` with no decision), dropped-act, and the row repeats
     (apply-proven 4 each, second-attempt-proof).
3. **Answer-first's reads were cut to one "result read".**
   - The framework chose the last read and left every other read out as `not_the_result`. That included a second read
     appending to the same named output, and reads of other pages. Answer-first's answer is every read not marked a
     working read, and its named outputs decide replace or append (`result/output-group.ts`).
   - Fix:
     - New loop input `draft.resultRead`. Answer-first passes "not intermediate".
     - Compose takes `isResult`: every read it accepts is a result read, and the rest are `not_the_result`.
     - Two reads of one list with nothing between them are still one read in the Flow (the copy rule, unchanged), as
       you decided.
   - Fixed: `latest-read` append, `sdk-acceptance` #3, a working read after the answer, and judged-build. No case
     needed both copies kept.
4. **Every read is a draft step (decision 2).**
   - `attempt/decide.ts`: every tool call is now an `add` intent for the ledger, so nothing is a look.
   - `result/empty-refusal.ts` and `result/look-line.ts` name the `result` edit and running the read, never `take`.
   - The two `result-feed/service` tests were rewritten:
     - a page-2 read without `add` is the step's next page (5 rows over 2 pages);
     - a completion on a read without `add` holds its rows.
5. **Authored progress counted the framework's own drafting.**
   - Every new working press joined the Flow, so pressing control after control on an unchanged page read as progress.
   - Fix (`evidence-progress/authored-progress.ts`): only a step the model's word put in counts, and acts done count as
     before. The authored-draft progress test now uses an act.
6. **The paging pattern's Next page** (your item): read, Next page, then `repeat` with `while` and `through` set to
   the press.
   - The framework left that press out as `dead_end` after the only read.
   - Fix:
     - `amendment/edits/put-in-over.ts` became `put-in-named.ts`. A `repeat` now puts in the step named by `over`,
       by `while` or by `through` when the framework left it out, and puts each back if the repeat is refused.
     - A repeat that stands makes the steps it names and its whole span the model's, so a recompose never takes them
       out.
   - Tests in `edits.test.ts`: the paging repeat puts the press in, a recompose leaves the span, and a refused repeat
     puts the press back out.

### Test premises the switch removed, rewritten to test the same behaviour (decision 4)
- **`unfinished-build`** ("nothing in the Flow"): an act that adds nothing is now one that changed nothing. The model's
  call carries `lands` only where it should land.
- **`skipped-rows`** "a model that keeps away from done rows": the first attempt drops what it ran, where it used to
  leave out `add`.
- **`hand-fix`** "left out of the Flow is no repair": the model drops its hand fix.
- **The reorder repairs** (`apply-proven`, `second-attempt-proof`): the framework moves no step. The written step stays
  where it was written (step 5, after the opening look), the old step is dropped, and the repeat goes on the written
  step.
- **`assemblable-flow-wins`**: the draft that does not assemble is now one Flow input bound with two test values
  (`flow_draft.input_conflict`, a framework `bind`). Before, it was a recovery behind a step (`on_failed`, no longer
  an edit).
- **`deepseek-bootstrap/answerability`**:
  - the measured script's `optional` became `unrepeat` (refused as already so);
  - the judged step counts include the looks the repair ran, which this harness makes steps: `[6, 6, 19, 19]` and
    `[6, 6, 7, 7]`.
- **`latest-read`**: "an empty read does not wipe a good one" now has the model name the good read with `result`.
- **Recovery** `annotate.test.ts` and `recovery-permissions.test.ts` (now mine): the assertion lists `core.run_flow`
  (D11).

### Files (phase 2b, Core `packages/fluxiq/src`)
- **Source:**
  - `runtime/flow-authoring/draft/compose/{compose.ts (isRuled, isResult), dead-end.ts, in-place.ts}`;
  - `runtime/flow-authoring/draft/amendment/{apply.ts, edits/put-in-named.ts (was put-in-over.ts), edits/index.ts, edits/schema.ts}`;
  - `runtime/llm/{evidence-loop.ts, loop-configuration.ts (draft.carried, draft.resultRead), evidence-loop/index.ts}`;
  - `runtime/llm/evidence-loop/framework-draft/{index.ts, carried-steps.ts, read-tests.ts}` (`read-tests.ts` moved
    here from `evidence-loop/`, because that folder was at the 25-file limit);
  - `runtime/llm/evidence-progress/authored-progress.ts`;
  - `framework/automation-service/service/answer-first/attempt/{round.ts, decide.ts}`;
  - `framework/automation-service/service/answer-first/result/{empty-refusal.ts, look-line.ts}`.
- **Tests:**
  - `draft/compose/tests/compose.test.ts`;
  - `draft/amendment/edits/tests/edits.test.ts`;
  - `evidence-loop/tests/{authored-draft,framework-draft}.test.ts`;
  - answer-first: `result-feed/tests/service.test.ts`, `result/tests/empty-refusal.test.ts`,
    `tests/{latest-read,skipped-rows,second-attempt-proof}.test.ts`,
    `attempt/tests/{hand-fix,assemblable-flow-wins}.test.ts`, `apply-proven/tests/apply-proven.test.ts`;
  - `tests/service-bootstrap/tests/unfinished-build.test.ts`;
  - `tests/deepseek-bootstrap/tests/{replies.ts,answerability.test.ts}`;
  - recovery: `annotation/tests/{annotate,recovery-permissions}.test.ts`.

### Commands (phase 2b)
All vitest runs went through the heavy gate with `NODE_OPTIONS=--max-old-space-size=3072`, in `packages/fluxiq`.

- **The full pass:** `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/runtime/llm src/runtime/flow-authoring src/framework/automation-service src/runtime/adaptation src/server/fluxnode-api`.
  - Parallel: `Test Files 3 failed | 1196 passed | 1 skipped (1200)`.
    - The 3 were `build-routing` (fails at HEAD, which you are tracking), `accrual` and `result/tests/empty-refusal`.
    - The last two were fixed after this pass and re-run below: the progress count's memory of steps, and the new
      words.
  - Real-sql: `Test Files 1 failed | 255 passed (256)`, `Tests 1 failed | 1610 passed`.
    - The 1 was `answerability`'s ending, `stepsInFlow` 19 against an expected 6 (the repair's looks, as above). It is
      fixed below.
- **Re-run after those fixes:** `vitest-groups --groups=parallel,real-sql src/runtime/llm src/runtime/flow-authoring src/framework/automation-service/service/answer-first/result src/framework/automation-service/tests/deepseek-bootstrap`:
  - parallel: `Test Files 702 passed | 1 skipped (703)`, `Tests 7455 passed | 2 skipped`;
  - real-sql: `Test Files 9 passed (9)`, `Tests 43 passed (43)`.
- **The 12 formerly failing real-sql files** (`--groups=real-sql`): `Tests 3 failed | 83 passed (86)`. The 3 were
  `latest-read` (a run that started before its rewrite) and `answerability` ×2, all fixed since. The full pass above
  re-ran all 12.
- `pnpm --filter fluxiq check` gave `exit=0` (runs `check3`, `check4` and `check5`; see the return contract for the
  last).
- `node scripts/structure-audit.mjs` gave `structure-audit: passed (578 warning(s), 903 baselined).`
- `node scripts/check/model-text.mjs` (downstream) gave
  `model-text: ok (203 scenario tokens, 570 model-facing Core files, 14466 string literals)`.
- I did not rebuild Core's libraries. No downstream check that reads `dist` ran; model-text reads source.


## Phase 2a outcome (superseded by phase 2b above)

**Partial.** Every hook in the brief is wired. Framework drafting is now the loop's only product mode. The decision
schema offers the seven framework edits, and `core.run_flow` is offered from the first decision. These pass:

- typecheck;
- structure audit;
- model-text;
- all of `src/runtime/llm` and `src/runtime/flow-authoring/draft`.

**20 real-sql tests in 12 answer-first and service-bootstrap files still fail.**

- They are caused by this change: all 15 files that failed in the earlier pass, these 12 among them, passed
  (121 of 121) with my source files put back to HEAD.
- They are product meaning, not wiring:
  - the old "a read outside the draft is a look" and `take` semantics;
  - two reads of one list (append) against phase 1's rule that the later read stays;
  - a hand step is now a repair;
  - test premises such as "nothing in the Flow".
- Each is listed below with its likely cause. They need the lead's decisions, and two of them need edits outside my
  paths.

**Two parallel-group tests in the recovery lane's paths also fail.** They fail only because the offered list now
holds `core.run_flow` (D11). The fix is to that one assertion, and those paths are not mine to touch.

**One test, `build-routing` "run-munneauy", fails with my files at HEAD too**, so it is not caused by this change.

## What changed and why (Core, `packages/fluxiq/src`)

### Hooks as built
1. **Compose at append** (`runtime/llm/evidence-loop.ts`, `draftRecord`):
   - The appended step is `taken`. Then `composeDraft()` runs: `automationStudioFlowDraftComposeInPlace` followed by
     `automationStudioFlowDraftSettleLoopCovered`.
   - The add-flag, second-copy, opener and reversal calls at append are gone. `add` is accepted and does nothing.
   - `act` is claimed when the step is in. It is also claimed on a step that is out only as `dead_end`: the claim
     makes the step lasting, and it is composed again so it comes back in.
     - Reason: a press with `act` right after the result's read used to be dropped as leading nowhere before its
       claim landed.
   - `place` is claimed when the step is in.
   - A claimed step stays the framework's. A later press that undoes it takes both out, together with the act, as
     the reversal rule always did (run musp8nz1's test still holds).
2. **In-place applier** (new `draft/compose/in-place.ts`): it composes, then writes `drafted`, `disposition`,
   `cancels` and `acts` back onto the same objects.
3. **Compose again**:
   - after the rerun-replaced block (`evidence-loop.ts`);
   - after every apply in `decision-handlers/amendment.ts`;
   - after held amendments settle (`context.composeDraft`, a new field on the handler context, `decision-handlers/types.ts`).
4. **The handler context and the draft entry say the framework drafts**:
   - `draftEdits: "framework"` and `composeDraft` are set on the handler context;
   - `authored: "framework"` is passed to the draft entry. This needed a one-word type widening in
     `decision-context/shown.ts`, which is outside my list.
5. **Schema** (`evidence-loop-decision.ts`):
   - With `authoring`, `amend_draft` items use `AUTOMATION_STUDIO_FLOW_DRAFT_EDIT_SCHEMA`.
   - The `add` description now reads "Not needed: a step that works joins the Flow by itself, and amend_draft edits
     what was drafted." `act` and `place` lose "Implies add".
   - The parser accepts the edit changes, `result` among them.
   - Three clauses of `AUTOMATION_STUDIO_LLM_EVIDENCE_DECISION_INSTRUCTION` that said "a step you added" now say a
     step that works joins the Flow, Core drafts it, and the model edits the draft. The prompt pins and snapshot were
     regenerated, and the diff is only those words.
6. **`rerun` is the seventh edit**:
   - Files: `draft/amendment/edits/{changes,schema,index,is-edit}.ts`.
   - The handler carries `rerun` out as before, and the framework filter that refused it is gone.
   - The schema and the telling (`draft/entry.ts`) say: "rerun to do a step again in its place with a corrected
     argument (a step that failed is repaired so, then checked by running the Flow from it)".
   - `rerun/replacement.ts`:
     - when the replaced step was the model's (a carried step of a saved Flow included), the rerun becomes the
       model's;
     - otherwise the framework composes it;
     - `result: true` moves to the rerun.
   - `draft-amendment-feedback/fallback.ts` (outside my list): the `not_an_edit` sentence now lists `rerun`.
7. **Telling the result's read**:
   - New `evidence-loop/read-tests.ts`, which gives the composer two tests:
     - `isRead`: the host named the list (`reads`), or the answer kept rows under `readRows.rows` or the declared
       `readRowsKey`;
     - `isAskedTable`: a read whose rows hold every column in `namedColumns`, by the completion check's own
       `automationStudioResultAskedTableLacks`.
   - Absent named columns or `readRowsKey`, there is no asked-table test and the last read is the result.
   - `compose.ts` takes an optional `isRead`. A step that observes and reads no list (opening a page by its address,
     a wait, a check) is in the Flow when it worked and is never `not_the_result`.
     - Reason: the library row-address repeat lost its open step and pressed one row.
8. **`result-columns.ts`**: the words now say that running that read puts it in the draft, and that
   `amend_draft` with change "result" on that read's step makes it the result's step. They no longer name
   `add: true` or `take`.
9. **D11** (`node-tools/run/flow.ts`):
   - `offered` is always true where the tool is added at all.
   - A call made before the draft has a proposed step with `ranWith` and `replay` is refused by name, and nothing is
     sent. The answer is `{ok:false, code:"run_flow.nothing_to_run", reason:"Nothing was run: no step of the Flow can
     be run again yet. Run the steps the Flow needs first; a step that works joins it."}`.

### Root causes found and fixed along the way (not caps)
- **Lasting** (`compose/lasting.ts`): a step that declares consequences is lasting. The declaration is read in
  `ranWith.consequences` else `input.consequences`, by the dry run's own `automationStudioFlowDraftDeclaresLasting`.
  - Without this, a renewal after the list's read was dropped as `dead_end`. That broke the "read, act on a row,
    repeat" shape (saved-on-every-ending and others).
  - This closes phase 1's open question 1.
- **Loop-covered steps** (`compose/framework-step.ts`): a step with `coveredBy` is not the framework's while a loop
  covers it. Otherwise compose put back the Next-page press the loop already does (t975).
- **Progress** (`evidence-progress/authored-progress.ts`): a new step counts as progress only when the Flow then holds
  more steps than it ever has.
  - Reason: each new press entered the Flow by itself and the next one closed the detour, so going back and forth
    between pages read as progress (run-munwmfrs shape).
- **Loop detection** (`evidence-loop.ts`): calls pass no draft key where the framework drafts. A call's landing moves
  the draft by itself, so its news is its act, page and rows; only an edit moves the draft. Otherwise reworded cycles
  and windows of new presses were never caught (ladder tests).
- **Pinning** (`amendment/apply.ts`, `pins`): a keep whose only news was an act that could not be recorded there
  (refused claim, or act on a read) no longer makes the step the model's or counts as applied.
- `evidence-loop/resume.ts`: the explore-again words said "add true". They now say a step that works joins the Flow.

### Item 7: the read's stored handle and binding
- No Core change was needed, and none was made.
- The step's `input` and `ranWith` come from the host's own draft statement (`evidence-loop/call-record.ts`:
  `declared.input ?? input`, `declared.ranWith`). The domain's D13 read already states `input` with the issued
  `extraction.N` and `ranWith` with `extractionBinding` (and `names`): see `domain/.../node-run/run.ts`, where
  `written = resolving.parameters` after `webListReadOwnDetection`.
- The new loop test proves the auto-drafted read carries those, never the model's `tN`
  (`evidence-loop/tests/framework-draft.test.ts`, "keeps a read in the Flow with the handle and binding the read
  stored").

## Tests changed and why (intent kept)
- **New tests:**
  - `draft/compose/tests/in-place.test.ts` (5);
  - `evidence-loop/tests/framework-draft.test.ts`, which covers:
    - item 7;
    - the asked-table result;
    - a failed step redone in its place by `rerun`;
    - an act on a press after the read;
    - the seven edits offered and the telling;
    - the read and asked-table tests;
    - an open-by-address step that stays in;
  - `compose.test.ts`: a declared lasting effect after the read stays in;
  - `run-flow.test.ts` and `run-flow-in-loop.test.ts`: the D11 refusal by name, and offering from the first decision.
- **Moved:** `evidence-loop/tests/rerun-replacement.test.ts` moved to `evidence-loop/rerun/tests/replacement.test.ts`,
  beside its subject. The folder was at the 25-file limit.
- **Old-grammar changes replaced by framework edits:**
  - `add` became `keep` with an act;
  - `exploratory` became `drop`;
  - `optional` became `repeat while` or `repeat over`;
  - `keep` of an in step (now applied, it pins) became `unrepeat` where the test needs an `already_so` refusal;
  - files: `accrual`, `draft-numbers`, `held-amendments`, `progress`, `repeat-guard` (decisions A and B now differ by
    order, and the press names its act), `authored-draft`, `moved-act-told`, `refusals-of-one-kind`,
    `draft-amendment-feedback`, `rerun-check`, `anthropic/decision-check`.
- **Expectations that now take the framework's word:**
  - "taken until add" became `kept` and `drafted: "in"`;
  - "dropped" became `taken` with `undone` or `replaced`;
  - second copies are `repeat` or `dead_end` on the step, with `out` in the entry and no separate refusal told;
  - `keep-adds-nothing` uses the framework's words;
  - the first keep pins, so the refusal comes a decision later (`run 36`, act named again);
  - files: `second-copy`, `keep-adds-nothing`, `amendment-told` (rerun is now carried out), `evidence-loop.test`
    (a look shows `drafted: "look"`), `evidence-loop-draft-shown` (the telling is 696 bytes, not over 1000).
- **D11:** `core.run_flow` added to the offered lists in `evidence-loop-tool-failure`, `evidence-loop.test`,
  `repair-exploration-tools`, `repeat-policy`, `unknown-tool`, `forward-run`.
- **Old grammar on purpose:**
  - `unreached-told` runs under `draftAuthoring: "transcript"`, because only moves leave a step unreached;
  - two move tests in `held-amendments` now settle the old grammar directly.
- **Regenerated:** `deepseek/tests/system-prompt-pins.json` (`FLUXIQ_UPDATE_SYSTEM_PROMPT_PINS=1`) and
  `provider-task/tests/__snapshots__/explorer-system-prompt.txt` (`-u`). The header gets a t1037 line.
- `result-columns.test.ts`: the new words.

## Commands run and observed results
All vitest runs used the heavy gate and `NODE_OPTIONS=--max-old-space-size=3072`, in `packages/fluxiq`.

- **Broad first pass, before the later root-cause fixes:** `vitest-groups --groups=parallel,real-sql` over
  `src/runtime/llm`, `src/runtime/flow-authoring`, `src/framework/automation-service`, `src/runtime/adaptation`,
  `src/runtime/automation-activity`, `src/runtime/project-agents`, `src/runtime/result-verification`,
  `src/runtime/run-overrides`, `src/programs/automation-studio` and `src/server/fluxnode-api`:
  - parallel: `Test Files 24 failed | 1603 passed | 1 skipped (1628)`, `Tests 44 failed | 14494 passed | 2 skipped`;
  - real-sql: `Test Files 22 failed | 290 passed (312)`, `Tests 69 failed | 1861 passed`.
- **Last pass:** `vitest-groups --groups=parallel,real-sql <the 15 failing real-sql files> src/runtime/llm src/runtime/flow-authoring/draft`:
  - parallel: `Test Files 350 passed (350)`, `Tests 3547 passed (3547)`;
  - real-sql: `Test Files 12 failed | 5 passed (17)`, `Tests 20 failed | 105 passed (125)`.
- **Earlier targeted pass:** `vitest-groups --groups=parallel` over `src/runtime/flow-authoring/draft`,
  `src/runtime/llm/repeat-guard`, `src/runtime/llm/tests`, `src/runtime/llm/evidence-loop`,
  `src/runtime/llm/decision-handlers`, `src/framework/automation-service/route-state` and
  `src/runtime/adaptation/recovery/annotation`:
  - `Tests 4 failed | 1833 passed`;
  - the 4 were build-routing, the 2 recovery assertions, and one `evidence-loop.test` offered list, fixed since.
- **Attribution:** I put my 22 changed source files back to their HEAD versions (`git show HEAD:<path>`), then
  restored them, with `cmp` confirming 0 mismatches:
  - `vitest-groups --groups=real-sql <the 15 files>` gave `Test Files 15 passed (15)`, `Tests 121 passed (121)`, so
    those failures are caused by this change;
  - `vitest run build-routing.test.ts -t run-munneauy` still failed with `[11, 0, 9]`, so that one is not caused by
    this change.
- **Final broad parallel pass, after every fix:** `vitest-groups --groups=parallel` over `src/runtime/flow-authoring`,
  `src/framework/automation-service`, `src/runtime/adaptation`, `src/runtime/automation-activity`,
  `src/runtime/project-agents`, `src/runtime/result-verification`, `src/runtime/run-overrides`,
  `src/programs/automation-studio` and `src/server/fluxnode-api`:
  - `Test Files 3 failed | 1316 passed | 1 skipped (1320)`, `Tests 3 failed | 11479 passed | 2 skipped`;
  - the 3 are build-routing "run-munneauy" (fails with my files at HEAD too) and the two recovery-lane assertions.
- `pnpm --filter fluxiq check` (Core root, heavy gate) gave `exit=0`, run again after the last source change.
- `node scripts/structure-audit.mjs` (Core root) gave `structure-audit: passed (578 warning(s), 903 baselined).`
- `node scripts/check/model-text.mjs` (downstream root) gave
  `model-text: ok (203 scenario tokens, 568 model-facing Core files, 14460 string literals)`.

## Still failing, caused by this change (real-sql), with the likely cause
1. **A hand step is now in the Flow, so it counts as a repair:**
   - `apply-proven` "for a run judged no, or an attempt with any model decision";
   - `hand-fix` "left out of the Flow is no repair, and the Flow keeps the step it had";
   - in both, `path` is `run_flow_then_repair` where `run_flow_then_explore` was expected.
   - The test premise is a step left out without `add`, and that no longer exists.
2. **The repaired row repeat does not press every row on the next attempt:**
   - `apply-proven` "for a repair, until its own next whole run proves it" (2 where 4 was expected);
   - `second-attempt-proof` "at the row's own step" (1 where 2 was expected).
   - Not traced. A repair redoes a row step: check how the rerun of a row-bound step under compose keeps its
     repeat or binding.
3. **A saved Flow does not run as `run_flow`:**
   - `replay-over-done-act` (attempt 2 `explore`);
   - `assemblable-flow-wins` (a candidate is kept where none was expected).
   - Not traced. The Flow drafted with more steps than the model added may not assemble or replay.
4. **The "read outside the draft is a look" and `take` semantics:**
   - `result-feed/service` "a page-2 read by hand without add says it is a look";
   - `result-feed/service` "a completion on looks alone is refused naming take".
   - Every read that worked is now in the draft.
   - Separately, answer-first's model words still name `amend_draft` change `"take"`, which is now refused
     `not_an_edit`:
     - `answer-first/result/empty-refusal.ts:20`;
     - `answer-first/result/look-line.ts:13`.
   - **These must change, and they are outside my paths.**
5. **Two reads of one list, or a working read after the answer:**
   - `latest-read` (4 tests: "the model says append across two views under one name", "a working read after the
     answer does not become the result", "a look that came back empty does not wipe a good one", "a Flow run of an
     earlier read step is that step's page");
   - `sdk-acceptance` "3. a failing check goes back into the loop" (it keeps `Clockmaking` without `Atlas of Rivers`).
   - Cause: phase 1's rule that of two reads of a list with nothing kept between them the later stays, and that the
     last read is the result. Answer-first's append, and the user's "collect broadly" rule, want both. **The lead must
     decide.**
6. `dropped-act` "the paid reply's edit ... the way-to-a-page guard puts the navigations back": `[2,3,10]` where
   `[2,3,4,6,7,10]` was expected. The steps the guard used to put back are composed differently. Not traced.
7. `skipped-rows` "a model that keeps away from done rows by itself left nothing out": `skippedAsDone: 2`. A hand
   press on a row is now in the Flow, so the forward run sees done rows. Not traced.
8. **`deepseek-bootstrap/answerability`, both tests:**
   - the script sends an old-grammar change, now `not_an_edit` where `already_so` was expected;
   - the judged Flow has 7 steps where 6 were expected, because the framework keeps a working step the scripted model
     never added.
9. **`service-bootstrap/unfinished-build`, 3 tests:**
   - "with nothing in its Flow" cannot happen while a call works;
   - `stepsInFlow` is 2 where 1 was expected.
   - The test premises need restaging.

Not caused by this change: `route-state/build-routing` "run-munneauy-de8663ed, rebuilt" (`[11, 0, 9]` where
`[12, 0, 9]` was expected) fails with my files at HEAD too.

The recovery lane's paths, which I did not touch: `adaptation/recovery/annotation/tests/annotate.test.ts`
"offers a mutating option to the exploration" and `recovery-permissions.test.ts` "offers the acting option". The
offered list now ends with `core.run_flow` (D11); the fix is to add it to each assertion.

## Not verified
- No Lab, provider or live run, per the brief. Downstream domain and extension tests did not run, because no
  downstream source changed.
- Whether recorded runs replay the same way under the new composer settings (`isRead`, declared lasting): the
  phase 1 `test-runs/t1037/replay.mts` did not run again.
- The broad real-sql pass ran again only over the failing files plus `src/runtime/llm` and
  `src/runtime/flow-authoring/draft`. Real-sql tests elsewhere were last run before the last three root-cause
  changes. In that run, every failure was in the files that were run again.

## Open questions or contradictions found
1. **Phase 1's rule against answer-first's append** (item 5 above), and whether `isAskedTable` should count rows as
   the domain records them (the D13 `columns` list) as well as the row keys.
2. **Model words outside my paths that are now wrong:**
   - answer-first `take` (item 4);
   - `flow-authoring/bootstrap/instructed-acts/act/evidence.ts:252` and `instructed-acts/check.ts:143`, which tell the
     model `amend_draft add on step N`, now refused `not_an_edit` (they should say `keep`);
   - many "as a new call with add true" sentences in `draft-amendment-feedback/fallback.ts` and `way-out.ts`, which
     are harmless (`add` is accepted) but stale.
3. **Edits I made outside the owned list:**
   - `decision-context/shown.ts` (type widening);
   - `draft-amendment-feedback/fallback.ts` (`rerun` added to `not_an_edit`);
   - `evidence-loop/resume.ts` is inside `evidence-loop/**`, so it is owned.
4. `OWN_LIST` in `result-columns.ts` still says the list is detected and read through the detection's handle. With
   D13 a read names its list by a line, so the wording may need W2's eye.
5. The old grammar, the authored telling, `decision-handlers/second-copy.ts` (now unused by the loop) and
   `KEEP_ADDS_NOTHING_INSTRUCTION` remain for the later delete step.
