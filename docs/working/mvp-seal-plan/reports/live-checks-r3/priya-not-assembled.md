# priya-tags: why no Flow was saved (run-mwblz4aq-0baa810a)

Read-only trace. Nothing was edited except this report. No build, test or Lab run.
Core paths below are relative to `C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ/packages/fluxiq/src`.
Step folders are under `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-10/run-mwblz4aq-0baa810a/steps/`.

## Outcome

Three separate defects combined. Two are in answer-first and one is in Core's draft guidance and validation:

1. **The model never saw the refusal.** In attempt 1 (0065) the model wrote `{step 32, change "repeat", while 32}`. Step 32 is a `web.output.dom-click` on "Load more comments". The amendment was applied without a check (0066 `applied`). Only assembly refuses it, and in answer-first assembly runs only after the answer is accepted, when the draft is saved (`draft-save.ts`). The refusal goes into a step-log note, so no model request in the whole run contains it. No `request.txt` holds "no way to say the loop is done" or `repeat_while_never_ends`. Only notes 0109, 0186 and 0207 do.
2. **The rule is right. Its alternative fix and the model's guidance are not.** A plain click has no ending route, so a "press Load more while it succeeds" loop can only end when the click fails. The run showed both bad endings: attempt 1's test failed on pass 2, and attempt 2 put a cap (`most 20`) on its loop, which then spent about 10 minutes on 19 empty passes. The right node exists (`dom-next_page`, which answers `ended` and covers "Load more"). But the guidance never says a while-loop's last step must be a step that answers `ended`. It advertises "most ... default 50" as ordinary, and the refusal itself offers `most` as a fix, which only caps the problem.
3. **(b) Attempt 2's working steps lost to attempt 1's broken ones.** Attempt 2 repaired the draft, and its draft assembled and was saved (`partly_works`). But `betterFlow` keeps the old Flow when both are `confirmed`, unless the old one "just broke live". A repair attempt never runs the saved Flow, so it never counts as broken. Attempt 1's steps that do not assemble stayed `best`, and attempts 3 and 4 were seeded with them again: the same `repeat_while_never_ends at draft.steps.32`.
4. **(c) The column reader fails on the colon in "date:".** This did not change whether the answer was right.

## (a) The repeat at draft step 32

**What the model wrote.** The draft shown at 0065 (`0065-decide/request.txt`, the `core.flow_draft` entry) ends with three steps:
- step 31: `dom-click t1920`, kept (a covering layer was closed);
- step 32: `dom-click t1805` "Load more comments", kept.

The decision (`0065-decide/decision.json`) was `{"step":32,"change":"repeat","while":32}` with no `most`. The model's summary: "Repeat the Load more comments press on this giveaway post until it stops". So the body is the click alone, and the condition is the click's own success. In attempt 2 the draft shows it as `"runs":"repeats through step 32 while it succeeds"` (`0111-decide/request.txt`).

**The rule.** `runtime/flow-authoring/bootstrap/authoring/draft-routing.ts`:
- `repeatWhile`, lines 577-621. Lines 601-605 take the span's last step and call `repeatEndings(last.written, ...)`. When there are no endings and no `most`, they return `flow_draft.repeat_while_never_ends`. The same check for a written script is at lines 354-361.
- `repeatEndings`, lines 667-669: a node's outputs with `role: "branch"`. `dom-click` declares only success and failed. Only nodes such as next-page declare an `ended` branch (`domain/src/output-nodes/next-page/parameters.ts:43`).
- The comment at lines 561-576 explains the reason. A loop whose last step has no ending route "could end the loop only by failing or at the Repeat's default bound, which is a Flow that does the wrong thing quietly".

**Is the rule right for "press Load more while it is there"?** Yes. The model wrote a loop that cannot end well, and this run showed both ways it goes wrong:
- **It ends by failing.** Attempt 1's own test of the loop (`core.run_flow`, 0067-0069) replayed pass 1. Pass 2 (`run.forward.32.32.pass.2`) failed: "the page shows a control named "Load more comments" but the step could not find it (target_not_found)" (`0069-tool-core.run_node/result.json`). The recorded selector was `li:nth-of-type(14) > div`, and the button had moved further down the growing list.
- **A cap hides it.** Attempt 2 wrote `{step 35, repeat, while 35, most 20}` (0150), which passes the rule. In the test (0154-0174), pass 1 replayed. Passes 2 to 20 each answered `core.replay.remembered`: "target is gone ... how a site that remembers the step looks". Each took about 30 s (`0156` 31.7 s, `0160` 33.2 s, `0174` 29.5 s in `meta.json`). About 10 minutes of attempt 2's 1068 s went on that.

**Why the model could not write a loop that ends:**
- **It never saw the refusal.** The amendment check at amend time (`runtime/flow-authoring/draft/amendment/repeat-revalidation.ts:53-69`, `routing.ts:218-235`) checks only the order of a repeat. It has no registry, so it cannot know a click has no ending. Assembly runs only:
  - at the end of an attempt, in `framework/automation-service/service/answer-first/attempt/draft-save.ts:34-43`, called from `ending.ts:51` after the result. The note there prints only `verdict.codes` (line 42), not the issue;
  - at the start of the next attempt, in `attempt/opening.ts:81-84`.

  Neither reaches the model. In the repair attempts the model is told only `NOT_ASSEMBLED` (`attempt/round-note.ts:17`, used at line 60): "The saved steps could not be made into a Flow on this site as it stands ... fix what no longer fits". No step and no reason. That is exactly what `0111-decide/request.txt` and `0190-decide/request.txt` show. `flow-run/assemble.ts:42-43` deliberately drops the issue messages ("never its words, which may quote a value").
- **The guidance points the other way.** `runtime/flow-authoring/draft/amendment/schema.ts` says:
  - line 20 (`repeat`): "or, with while, again while its last step succeeds", and "To go through a list that continues -- the step that reads it, then the step that moves it on -- repeat on the read with while naming that step". It never says that "the step that moves it on" must be one that answers `ended`.
  - line 28 (`while`): "the span runs, then again while that step succeeds".
  - line 29 (`most`): "with while, the most passes, 1 to 500, default 50". This presents a default bound as normal, while assembly refuses a while-loop that relies on that default.
- **The refusal's own fix is a cap.** It ends "...or send amend_draft repeat on step N again with most set to the passes it should take" (lines 604 and 360). Under the standing rule, that caps the symptom, and attempt 2 shows what follows. The model did see the next-page node's text: "Show the next page of a detected list, or answer ended when there is none. Next, a numbered page, Load more or scrolling" (0065 request; the source is `domain/src/output-nodes/next-page/catalog-text.ts:33-37`). Nothing connected that node to the loop it was writing.

## (b) Why attempt 3 found steps that do not assemble, after attempt 2 saved `partly_works`

- Attempt 2 opened on the `repair` route (`answer-first/route/route.ts:30-36`). It was seeded with attempt 1's steps, which do not assemble (note 0109).
- It never ran a saved Flow, so `run.flowRun` stays undefined. `flowRun` is set only in `attempt/flow-stage.ts:81-82`, which runs only when `route.kind === "use"` (line 53).
- Its final draft has step 32 made `optional` (0133), so the repeat is gone, and step 35 repeating with `most 20` (0150, shown at 0176). That draft assembled and was saved (`attempt.json` attempt 2: `"state": "partly_works"`, with a `stepsDigest`).
- In `attempt/remember.ts:43`, `automationStudioAnswerFirstBetterFlow(current.best, next, { flowFailedLive: flowFailedLive(run), ... })`. `flowFailedLive` (lines 62-67) returns false because `flowRun` is undefined.
- In `answer-first/task-memory/better-flow.ts:21-23`, both attempts are `confirmed` (`attempt/keep.ts:62`: achieved means confirmed). So the result is `flowFailedLive ? next : kept`, which is **kept**: attempt 1's steps, which do not assemble.
- Attempt 3 therefore opened on `repair` with attempt 1's draft again. 0186 says "...repeat_while_never_ends at draft.steps.32". The draft at 0190 and 0209 still shows `"step":32 ... "runs":"repeats through step 32 while it succeeds"`. Attempts 3 and 4 then never touched step 32 (0190 and 0192 amend steps 45-47), were again saved as notes only (0205, 0214), and changed nothing in `best`.
- `betterFlow` never asks whether the kept Flow assembles, or whether the new one does (`next.candidateId` is set only when the draft saved).

## (c) The named-columns note

- **The instruction** (`apps/scenario-lab/src/scenarios/photo-social/live-tasks.ts:9`): "...give me one row per comment with columns author, comment and date: author is the username of whoever wrote it, comment is its text exactly as written, and date is the day it was posted, as YYYY-MM-DD."
- **The reader:** `runtime/flow-authoring/bootstrap/answerability/instruction-columns.ts`.
  - Line 50 captures the text after "columns" up to `.`, `;` or a newline.
  - Line 53 splits it at `,`, `;`, ` and ` and ` & `. The pieces are "author", "comment", and, after " and ", "date: author is the username of whoever wrote it".
  - Line 83 trims only the ends of a piece, so the colon stays inside.
  - The piece has more than 3 words, so lines 86-87 call `cutShort(["author","comment"], "date: author is ...")`.
  - `cutShort` (lines 98-108) tries the leading words "date: author is", "date: author" and "date:". Every one fails `COLUMN_NAME = /^[A-Za-z][A-Za-z0-9 _-]*$/` (line 51) because of the colon, so `leading` is empty.
  - Confirmed by running the real function on the instruction (Node 22 with `--experimental-strip-types`, a scratch file importing the `.ts`). The output was `[]`, with `cutShort` `{"named":["author","comment"],"leading":[]}`.
- **What emits the note:** `runtime/flow-authoring/bootstrap/authoring/assembled-record-output.ts`. `closedNamedColumns` (lines 125-133) finds no leading name and returns `{ names: [], unread: ["author","comment"] }`. Lines 88-91 then write the note, and nothing is declared.
- **Does it matter for the answer?** Not this time. All 4 answers were judged right, with 5 rows each. Here is what the declared schema would have done:
  - Attempts 2-4: the kept read (step 47) has exactly the fields author, comment and date, so "store every field" gave the same columns.
  - Attempt 1: the read in the Flow had author, comment and **time**. A declared ["author","comment","date"] would have left "date" unmatched. It would have stored only author and comment, and `record_output.named_column_unmatched` would have warned.

  What it does cost is generality. While the reader answers `[]`, the column feedback is silent:
  - the note beside the draft that says no read gives a named column (`automationStudioFlowBootstrapUnreadColumnsSentence`, `authoring/instruction-record-columns.ts`);
  - the judge's unread-columns sentence;
  - the answerability check's quoted columns.

  So attempt 1 was never told that "date" was not read. A read that also held helper fields (step 46's `mention1-3`) would have stored them.

## (d) Proposed fixes, at the cause

**Core: flow authoring and draft validation**

1. **Check a while-loop's ending when the repeat is written, not only at assembly.** Add a registry-backed check to `applyAutomationStudioFlowDraftAmendments` (`runtime/flow-authoring/draft/amendment/apply.ts:84`), as an option like `claimRefused`. Pass it from `runtime/llm/decision-handlers/amendment.ts:98`, using the loop's registry.
   - A `repeat ... while` whose last step's node declares no `branch` output is refused there. It is taken back the same way `automationStudioFlowDraftSettleWrittenRepeats` takes one back (`repeat-revalidation.ts:76-93`).
   - It gets a new refusal reason, for example `loop_cannot_end`. The `next` names the registry's nodes that do declare an ending, worked out from `outputs[].role === "branch"` with their ids and labels. Core then names no domain node or site. The model hears it in the same turn (attempt 1 at 0065).
   - Add the reason's sentence to the amendment feedback's `reasons` (the `runtime/llm/draft-amendment-feedback/` module).
2. **Remove the cap as a fix.**
   - In `draft-routing.ts:604` (and `:360` for scripts), drop "or ... with most set to the passes it should take" as the remedy for a loop with no ending. Keep `most` only as a bound the person asked for ("the first 3 pages").
   - In `draft/amendment/schema.ts:29`, drop "default 50" from the while wording, and say `most` is for a number of passes the instruction gives.
3. **Say what ends a while-loop, in the guidance.**
   - `schema.ts:28` (`while`) and the `repeat` text on line 20 should say that the span's last step must be one that answers `ended` when there is nothing more, such as a node whose description says so.
   - "the step that moves it on" in the list-that-continues sentence should say the same.
   - For a list that grows in place, keep "loaded whole by its own step before the listing read" (`draft-routing.ts:340`). The span is that one step, repeated while it answers until `ended`, then a single read. That matches "read-list reads one page; rows auto-collect" without a row loop inside a page loop. The wording stays generic and names no site or task.
4. **Fix the column reader at the colon:** `runtime/flow-authoring/bootstrap/answerability/instruction-columns.ts`. A piece that contains ":" names the text before the colon (when that is a valid name) and closes the list there, because a colon after a named item opens its explanation. That gives ["author","comment","date"]. As a fallback, `cutShort` (lines 98-108) should trim trailing non-alphanumerics from each leading candidate ("date:" becomes "date"). Add a case to the reader's tests: "columns a, b and c: a is ...".

**Answer-first (`framework/automation-service/service/answer-first/`)**

5. **The better Flow must assemble.**
   - In `task-memory/better-flow.ts`, a kept Flow whose steps do not assemble never wins over a next Flow with steps. Pass `keptAssembles` from `attempt/remember.ts` (false when `run.route.kind === "repair"`). Alternatively, treat a repair route as `flowFailedLive`, which also clears `provenWhole`.
   - Rank a `next` whose draft saved (`candidateId` present) above a kept one that did not.
   - Add tests in `task-memory/tests/` for both cases.
6. **Tell the repairing model what does not assemble.**
   - Carry the assembly issues on the `repair` route: `route/route-type.ts`, `route/route.ts`, and `attempt/opening.ts:81-90`, which already has `assembled.issues`.
   - Put them in `round-note.ts` `flowRunTold` (line 60) as the step number and the Core sentence. For `flow_draft.*` codes, the messages are Core's own and name only step numbers. Allow those through `flow-run/assemble.ts:42-43` by code instead of dropping every message.
   - Also print the issues in `attempt/draft-save.ts:42`, as `opening.ts:84` does, so the end-of-attempt note says why.
7. **Assemble the draft before the attempt ends, while the evidence is still in view.** Once the judge says yes (`completion/check.ts`), assemble the draft as `draft-save.ts` does. If it is refused, give the model the issues and let it fix the draft. The result is already held, so this adds no failure ending. Fix 1 catches the repeat case earlier, but this catches every other assembly refusal too. It is a design decision for the answer-first plan, because it spends calls after the result.

Order: fixes 1, 2, 3 and 5 address the root causes of this run. Fix 6 makes a future repair work. Fix 4 is independent.

## Commands run and observed results

- `grep` and `Read` over the step folders (`index.md`, the `meta.json` of notes 0106-0109, 0184-0186 and 0207, the decisions and results of 0065, 0111, 0113, 0133, 0148, 0150, 0190 and 0192, and the draft entries in their `request.txt`), over the Lab evidence `attempt.json` and `attempt-report.txt`, and over the Core sources cited above.
- Python with `-I -X utf8` printed the non-page keys of the 0069, 0155 and 0156 `result.json` files: `core.replay.failed` "...could not find it (target_not_found)"; `core.replay.replayed`; `core.replay.remembered`.
- `node --experimental-strip-types <scratchpad>/cols-probe.mts` imported the real `instruction-columns.ts` and printed `[] {"named":["author","comment"],"leading":[]}`.

## Not verified

- I did not confirm from the stored task memory that attempt 1 and attempt 2 were both labelled `confirmed`; I found no memory file under the instance. The conclusion rests on the code (`keep.ts:62`, `better-flow.ts`), and on attempts 3 and 4 showing attempt 1's exact draft (step 32's repeat), which attempt 2's final draft did not hold.
- I did not check whether `dom-next_page` with `{list, control}` actually loads this comment list in place and answers `ended` when the button is gone. Its description says it covers "Load more", but that is not proven live.
- I did not check how the real Flow engine's Repeat treats a click whose target is gone, compared with replay's `remembered`.
- No fix was implemented or tested.

## Open questions or contradictions found

- **The guidance contradicts the rule.** The schema says `most` defaults to 50 with `while` (`schema.ts:29`), while assembly refuses a while-loop that relies on that default (`draft-routing.ts:603`). The refusal's own fallback (`most`) is a cap, against the standing root-cause rule.
- **Replay's `remembered`** (`runtime/flow-authoring/draft/site-memory.ts:26-31`) treats a missing target as a success even for a non-lasting press inside a repeat. Combined with the 30 s wait, a capped click loop runs to the cap quietly. This may need its own fix: a pass of a repeat whose press found no target should not count as passing.
- **Pass 2 in attempt 1 failed with target_not_found** while the page showed a control with the same name. The recorded positional selector (`li:nth-of-type(14)`) did not follow the button as the list grew. This is a re-targeting gap, separate from the loop rule, and I did not trace it.
- **The Flow is not general** (not a cause of this failure): the five "View replies" presses (draft steps 37-43) are fixed presses of individual items, not a repeat over a listing.
