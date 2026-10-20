# Debug: run-mvgw3ve5-294881b5

Status: FAILED (no Flow). Read-only review under brief debug-rr4-social, 2026-10-20. No source edit, build, paid run, browser run or commit.

## The run

- Task `social-network-feed-recent-group-posts`, rerun round 4, slot 3, lane tree `C:/Users/osrs_/FluxStuff/fxwork/t566`.
- Source: downstream 0cada957, Core 3b13e394. Both are dev with t741's fixes.
- DeepSeek flash, $0.25 ceiling. The run spent $0.1534 over 196 step folders and 91 model calls. The build ran from 16:26:45.608 to 16:51:49.184 (1,503,576 ms).
  - Builder brief-1: 16:26:53 to 16:48:55, about 22 minutes (dispatch step 0006, 1,321,697 ms).
  - Repair brief-2: 16:49:06 to 16:51:48, about 2.7 minutes (dispatch step 0162).
- Evidence:
  - `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-20/run-mvgw3ve5-294881b5/steps/` (index.md and the step folders);
  - the run folder's `summary.json` and `logs/core.log` (the t736 build-trace lines).
- The Lab log (`scratchpad/rerun4/slot-3.log`) shows no environment fault: no balance error, crash or provider timeout. It has two warnings, and neither touched the build:
  - the Firefox placeholder gecko id;
  - one ui-review screenshot timeout (#45, mid-build).
- Final chat message (`summary.json` firstFailure): "The build reached its time limit before a whole test of the Flow passed. Its last test run from the start was judged not to do what you asked ... I kept what I wrote as a draft."

## Priority one: what threw at 0196

**What was thrown.** The value is a `TimeoutError`. It is almost certainly the project build's own work deadline, `new DOMException("The project build reached its time limit.", "TimeoutError")`. That error is created in Core `runtime/project-agents/supervisor/supervisor-loop.ts` `startClock()`.

- `core.log` line 331 shows `tool throw toolId=core.run_node ms=22810 name=TimeoutError code=-`. That is the t736 trace, which names the error correctly.
- 0196's `result.json` is `{"error": {"name": "TimeoutError", "code": null}}`.
- **Timing.** The work signal aborts at `MAX_DURATION_MS - ENDING_MS` after the clock starts: 1,800,000 - 300,000 = 1,500,000 ms.
  - The clock starts in `runAutomationStudioProjectSupervisorLoop`, between `build start` (16:26:45.608) and `loop start` (16:26:45.970).
  - So the work deadline fell between 16:51:45.61 and 16:51:45.97.
  - 0196's `core.run_node` started at 16:51:25.78 (an `extract_list` read in the browser) and threw at 16:51:48.593. That is 2.6 to 3.0 s after the deadline.
  - The domain checks for cancellation between gateway round-trips: `domain/src/runtime/llm-evidence/capture.ts` `assertActive()` and `pause()` throw `signal.reason`. That fits a throw at the first checkpoint after the in-flight read came back. I did not trace the exact line that threw (see Not verified).
- **No other producer fits.** The other `TimeoutError` producers in Core source are:
  - the provider deadline (`llm/provider-retry/call.ts`): a model call, not a node run;
  - the end-view look (`service/end-view/look.ts`): judge-only;
  - the start hook (`candidate-start-hook/from-environment.ts`): this deployment has none;
  - `recovery/exploration-budget.ts`: runtime recovery, not a build.

**How it was handled. It was not an unclassified end.**

- The evidence loop catches the throw (`llm/evidence-loop.ts` around line 425: `catch { execution = "threw" }`).
- `decision-handlers/failed-call.ts` line 41 then ends the loop `llm_evidence_loop.cancelled`, because `input.signal` (the supervisor's `working` signal) was aborted.
- The dispatch tool returned 0.3 s later (`tool end toolId=project.dispatch ms=162469`). The supervisor ended the build as a draft at 16:51:49.184 with the time-limit message.
- **The run ended on the 25-minute work limit.** The deadline happened to fire during a node run.

**Why index.md says `threw non_error`. This is a step-log labelling defect, and it is old.**

- In Core `runtime/llm/step-log/tool-step.ts`, the step's `summary` is computed as `automationStudioLlmStepLogSummary.tool(evidence, …, thrown(error), unread)`.
- `thrown()` has already reduced the error to a plain `{name, code}` object.
- `summary.ts` line 28 then tests `error instanceof Error`, which is false for that plain object, so it prints `non_error`.
- The result: every throw without a string `code` is logged `non_error`, whatever it was. (A `DOMException` *is* an `Error` in Node 22; I checked.)
- `meta.json`'s `loopVerdict` is also hard-wired to `llm_evidence_loop.tool_failed` for any throw, though here the loop ended `cancelled`.
- **Origin.** `git log -S` puts both lines in b9c26036, the commit that introduced the step log. **Not t736, not t741.** No reset in this run threw: every reset step is `site_check admit`, 0-2 ms.

## The whole run: the honest shape was written five times and could never pass

Brief-1 wrote the round-3 "honest shape" at its first accepted submit (0063, rev 3). It wrote it again at 0075, 0087, 0127 and 0135:

```
step posts: list the posts in the feed      (no text field; group/date where)
step expand: press See more                 optional (from 0087), repeat over: posts, repeat through: expanded
step expanded: wait for the post's full text
step: read the posts with their full text   (same listing, same where, with text)
```

No submit was refused `web.handle.renumbered_by_reload`. No result in the run carries that code.

### Trials (all of brief-1's tests were the judged whole run: one subflow)

| Step | Rev | Took | Verdict | What stopped it |
| --- | --- | --- | --- | --- |
| 0065 | 3 | 98 s | execution_failed | Step 13, the See more press (not optional yet): `web.target.not_found` on pass 1. |
| 0071 | 4 | 91 s | execution_failed | Step 10, a single read with `text`: `incomplete_text`. |
| 0089 | 7 | 268 s | execution_failed | 86 steps. The optional press worked: pressed on some rows, skipped on others. `stoppedBy: steps_left_out`: "steps lists only the first 40, so the step that stopped it is not listed". |
| 0097 | 4 | 104 s | execution_failed | Single read with `text`: `incomplete_text`. |
| 0111 | 5 | 67 s | no (15 rows) | No text column. group/author swapped. Unjoined groups kept. |
| 0119 | 11 | 94 s | execution_failed | Single read with `text`: `incomplete_text`. |
| 0129 | 13 | 96 s | execution_failed | Honest shape. The first read kept **0** rows (group field held the author). The final read failed `incomplete_text`. |
| 0147 | 15 | 56 s | no (0 rows) | Group condition tested author names. |

- Trials took about 875 s of brief-1's 22 minutes.
- Each exploration read refused `incomplete_text` cost about 35 s, because the extension retries `output_not_observed` 3 times (0023, 0025, 0029, 0031, 0179, 0181).
- The repair got about 2.7 minutes. Its one test (0193) was refused `candidate.unchanged_after_no`, and its next read was cut by the deadline.

### Primary cause: the disclosure check fires on rows the read's `where` rejects

- **The code.** In `apps/extension/src/content/extraction/list-reader.ts`, the per-item loop calls `readRecord(element, fields)` (line ~561) *before* the `where` filter, `rejects(...)` (line ~570).
  - `readRecord` reads every field with `readField(..., "complete")`.
  - In `field-reader.ts`, `readElement`/`readColumn` call `assertTextDisclosed()` (`text-disclosure/text-disclosure.ts`).
  - That throws a failure record. `isRefusal()` rethrows it, which refuses the whole read.
  - So a collapsed "See more" on **any** item refuses the read, including items the read's own `where` would drop.
- **The proof in this run is 0129.** The final full-text read kept 0 of 30 rows: every row was rejected by its group condition. It still failed `incomplete_text`.
- **The fixture.** Four posts are longer than `CUT_AT = 200` (`social-network-feed/content/units.ts`):
  - Elena's committee post (group, kept by the oracle);
  - Oliver's bread post (group, kept);
  - Hannah's 10K post (a friend's post, `Friends`; the oracle excludes it);
  - Elena's recycling post (`Public`, 5,690 minutes before the fixture's now = 17 September; excluded by the date).
- **So the shape the hint asks for can never pass here.** The hint is "read context columns, repeat over that read with an optional row-bound click, then read the same listing again with the field". Its row loop presses See more only on rows the first read *kept*. The last two long posts stay collapsed, and the final read refuses on them.
  - The domain's hint (`INCOMPLETE_TEXT_NEXT`) even promises "by then every row is disclosed". That is false whenever the first read filters.
  - Qualification never meets this, because it extracts the three posts by position (`qualification/recent-group-posts/workflow.ts`), not the whole list under a `where`.
- **Rev 7 (0089).** Its kept set was 17 rows with the wrong group column, and the recycling post was rejected by date. So the 86th step, the final read, would have refused the same way. This is inferred: the stopping step is not in the feedback (next section).

### Contributing defect: the trial feedback hides a stop after step 40

- `service/candidate-trial/feedback.ts` lists `ran.slice(0, MAX_STEPS)` with `MAX_STEPS = 40`, and reports only `stepsLeftOut`.
- `flow-bootstrap/candidate/trial-stop.ts` `of()` then says `steps_left_out`, "the step that stopped it is not listed".
- A repeat over 17 rows takes 86 steps. So the one trial whose loop really ran (0089, the most expensive at 268 s) told the builder nothing about why it failed.
- At the next step (0092) the builder dropped the loop: it resubmitted rev 4's single read with `text` (`candidate.unchanged_submission`), then rev 4 again (0095 → 0097, `incomplete_text`).

### Contributing model error: group and author columns swapped for all of brief-1

- `web.detect_repeating_structure` (0011) labelled the fields clearly:
  - `…h3…span_strong_a…` as `link: 'Aisha Khan'` (a person);
  - `…h3…span_a…` as `link: 'Greenleaf Seeds Co.'` (a group).
- From 0063 on, brief-1 bound `group` to the strong (person) link, `author` to the short-age link (`1h`) and `posted` to the aria date.
- All four judge calls named it: 0114 ("group and author are swapped"), 0115, 0150 and 0151 ("Point the group field at … the h3 group link").
  - 0116 changed only the `where`. 0152 resubmitted unchanged (`repeat_refused same_answer`). Brief-1 completed at 0154.
- The repair's own exploration found the right keys (0195's call binds `group` to `…span_a…` and `author` to `…span_strong_a…`).
- But at 0190 it submitted the failing receipt's script verbatim (wrong keys, no text, no loop), while its summary claimed "full text via See more". Core refused the test as `candidate.unchanged_after_no`: correctly, and in 21 ms.
- The keys differ by one `strong_` segment in 90 characters, which makes them easy to confuse. The labels were right there, though, so I class this as a model error, not a product defect.

### Guidance gap carried from round 3: the judge's `changed`

- 0114 and 0115 said "add a text field reading the post body (expanding See more)" on the same read, and 0151 said "also add the text column".
- The builder did exactly that at 0117: it put `text` back in the single read. The next trial, 0119, failed `incomplete_text`.
- That is round 3's fix 4, still not in place.

## 0193 `candidate.unchanged_after_no`

- 0191 accepted revision 11 as a new draft. Its plan is byte-for-byte the plan of revision 5, and revision 5's whole run (trial `9ddb30fe`, 0111) had been judged `no`.
- 0193's test was refused because the whole Flow it joins into was already judged no. The refusal carried that judgement.
- This is the right answer to the repair re-sending its seed. One small improvement would be to refuse at `core.submit_subflow` (0191) rather than accept a revision that the test then refuses, which would save one decision. It was not a cause.

## Are round 3's causes gone?

- **False reload mark: gone in this run.** The honest shape with the See more handle `t271` was accepted five times (0063, 0075, 0087, 0127, 0135). No `renumbered_by_reload` appears anywhere.
- **Unnamed incomplete field: gone.** 0023's refusal names the key in `missing` and `instead`, and its `next` says "without the field `div_x08wcgyj_…`" and "After that repeat, not inside it, read the same listing again with the field `…`". The builder followed it at its first accepted submit.
- **Judge continuation: mostly gone.**
  - None of the four judge calls asked to page past the caught-up marker.
  - Core's deterministic `fix` for `result.read_list_continues` (0111, 0147) still says to scroll and repeat the read, with its "leave the read as it is" caveat. The builder did not act on it.
  - The judge's "add the text field to the same read" `changed` remains (above).

## How far it got

- 8 whole-run trials (one subflow, so each was the judged run) and 1 refused repair test. None was judged yes, and nothing was assembled.
- Best: 0111 (rev 5), 15 rows stored, but with the wrong columns and no text.
  - This is further from the oracle than round 3: round 3's 0141 and 0214 kept exactly the oracle's three rows.
  - The reason is the swapped group column.
- Reached: open the feed, scroll untilStable (every trial's scroll succeeded), the honest disclosure shape (accepted), and the per-row optional See more press (worked in 0089).
- Never reached: a final full-text read that the extension accepts, and the correct group/author binding inside an accepted revision.

## First divergent step

- **0065/0089.** These are the first trials of the honest shape. They failed on things the builder could not fix or could not see:
  - 0065: the non-optional press on a row without See more (fair, and fixed at 0087);
  - 0089: a stop hidden past step 40, behind which sits the disclosure refusal on rejected rows.
- From 0092 on, the builder alternated between shapes and never returned to a passing path.

## Cause class

**Product defect**, plus a model error and a carried guidance gap. Not environment: the log has no fault, the purse was not binding ($0.153 of $0.25), and the 25-minute limit is the product's own. Not a task, oracle or fixture problem: the three posts and their full text are reachable, as qualification shows. The task asks for whole posts, and the oracle is unchanged.

1. **Primary (downstream extension).** `apps/extension/src/content/extraction/list-reader.ts` `readRecord` → `field-reader.ts` `readField(…, "complete")` → `assertTextDisclosed`. It is applied to every item before `where`, so rows the read never keeps refuse it. The disclosure shape the domain's own hint prescribes cannot pass on a list where a rejected row is long.
2. **Contributing (Core).** `service/candidate-trial/feedback.ts` (`MAX_STEPS = 40`) and `flow-bootstrap/candidate/trial-stop.ts` `of()`. A trial that stops past step 40 does not name its stopping step.
3. **Contributing (model).** group/author swapped despite labelled samples and four judge findings. The repair re-sent its seed.
4. **Contributing (guidance, carried).** The judge's `changed` for a missing disclosed-text column says to add the field to the same read.
5. **Logging defect (Core, not a cause of failure).** `runtime/llm/step-log/tool-step.ts` and `summary.ts` log every codeless throw as `non_error`, and `loopVerdict` as `tool_failed` even when the loop ended `cancelled`.

## Proposed fixes (least general first)

1. **Downstream, disclosure after `where`.** In `list-reader.ts`:
   - read each item's fields with `"visible"` completeness;
   - run `rejects(...)`;
   - call `assertTextDisclosed` (through a `readRecord(…, "complete")` re-read, or a field-wise assertion) only for items the conditions keep.
   - Keep refusing a *rejected* item only when one of the conditions that rejected it reads a field whose element is still collapsed (that rejection judged partial text).
   - Test seam: `apps/extension/src/content/extraction/tests/list-reader.test.ts`, on a non-realistic fake list (for example a list of product reviews):
     - two items: an old review with a "Read more" button, which a date `where` rejects, and a short kept review. The read returns one record, with no refusal;
     - the same list where the kept review has "Read more": still refused `incomplete_text`;
     - a `where` on the collapsed field itself that rejects the long item: still refused.
2. **Core, name the stop past the listing.** In `service/candidate-trial/feedback.ts`, when `ran.length > MAX_STEPS`, keep the first `MAX_STEPS - 1` steps and append the last attempted step, with its real `step` number (and `stepsLeftOut` counting the gap). `trial-stop.ts` `failedLast()` then names it as `stoppedBy.kind: "step"`.
   - Test seam: `service/candidate-trial/tests/feedback.test.ts` and `flow-bootstrap/candidate/tests/trial-stop.test.ts`. An 86-step trace whose last step fails `output_not_observed` lists step 86 with its `actual`, and `stoppedBy.kind === "step"`.
3. **Core, step-log name.** In `runtime/llm/step-log/summary.ts` `tool()`, read the name off the record it is given (`asRecord(error)?.name` when it is a string) instead of `instanceof Error`. Or have `tool-step.ts` pass the raw error.
   - Optionally, write `loopVerdict: "llm_evidence_loop.cancelled"` when the throw's name is `AbortError` or `TimeoutError`.
   - Test seam: `runtime/llm/step-log/tests/tool-step.test.ts`. A call that throws `new DOMException("x", "TimeoutError")` gives `meta.summary === "threw TimeoutError"` and `result.json` `{error: {name: "TimeoutError", code: null}}`.
4. **Downstream, hint wording.** If fix 1 is not taken, or as belt and braces: in `domain/src/runtime/llm-evidence/rejection-next/next-sentence.ts` `INCOMPLETE_TEXT_NEXT`, replace "by then every row is disclosed" with words that tie the two reads together. Suggested: "give both reads the same conditions, so every row the final read keeps was disclosed by the repeat".
   - Test seam: `rejection-next/tests/next-sentence.test.ts`.
5. **Core, the judge's `changed`** (round 3's fix 4, still open). When the judged run lacks a requested column, and a read of the same listing was refused `incomplete_text` in this build, give the disclosure order rather than "add the field".
6. **Observation (not proposed as a fix yet).**
   - Brief-1 spent 22 of the 25 working minutes, and the repair was dispatched with about 2.7 minutes left. The purse has per-brief allowances, but time has none.
   - Each refused exploration read costs about 35 s, because `output_not_observed` is retried 3 times (user rule: every node retries). An `incomplete_text` refusal does not change with waiting, but the retry rule stands as the user set it.

None of these fixes mirrors the task or this site, and none weakens the oracle.

## Not verified

- **Which line threw.** I matched the `TimeoutError` to the supervisor's work deadline by timing (within 3 s of 1,500,000 ms) and by ruling out the other producers. I did not trace which domain or Core line rethrew `signal.reason` inside `core.run_node`.
- **What stopped 0089 at its 86th step.** Its feedback omits it. That it was the final read's `incomplete_text` on a rejected long post is inferred from the code order and from 0129.
- **That fix 1 alone would have let rev 7 or rev 13 pass.** Both also carried the swapped group column, so the judge would still have said no. A pass needs fix 1 plus the repair's correct binding.
- **That `wait for the post's full text` with `text: $row.author` is a sound wait.** It succeeded in 0089, but it waits for the author's name, not for the disclosed text.
- The ui-review screenshots in the run folder were not reviewed.
