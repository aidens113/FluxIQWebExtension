# Debug: run-mvgoawg4-ed85dd5a

Status: FAILED (no Flow). Read-only review under brief debug-rr3-social, 2026-10-20. No source edit, build, paid run, browser run or commit.

## The run

- Task `social-network-feed-recent-group-posts`, rerun round 3, slot 3, lane tree `C:/Users/osrs_/FluxStuff/fxwork/t566`.
- Source: downstream e1363c31, Core e74e0890. Both are dev with t738's fixes: the load-every-row-first `incomplete_text` hint, the scroll description, named bad scroll keys, and the loop-in-loop refusal that points at the inner loop.
- DeepSeek flash, $0.25 ceiling. The run spent $0.1943 over 244 step folders, from 12:42:20 to 13:13:58 (32 minutes).
  - Builder brief-1: $0.0179.
  - Builder brief-2: $0.0141.
  - Builder brief-3: $0.1065.
  - Repair brief-4: $0.0410.
  - Builder brief-5: $0.0072.
  - Supervisor: about $0.0075.
- Evidence: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-20/run-mvgoawg4-ed85dd5a/steps/` (index.md and the step folders), plus `summary.json`.
- The Lab log (`scratchpad/rerun3/slot-3.log`) shows no environment fault: no balance error, crash or provider timeout. It has two warnings: the Firefox placeholder gecko id, and one ui-review screenshot timeout (#58, mid-build), which did not touch the build.

## What the supervisor saw at the end (brief-5, 0235-0244)

- **The node:** `web.output.dom-extract_list` on the feed listing (`extraction.10`). It was an exploration run (`core.run_node`), not a Flow step.
  - 0239 sent the bare handle, so the read used the detection's default fields.
  - 0241 and 0243 sent five fields, `group, author, posted, text, comments`.
- **The expected output:** each field reads fully disclosed text. The extension's effect check, `apps/extension/src/content/extraction/text-disclosure/text-disclosure.ts` `assertTextDisclosed()`, found a visible "see more"-style control still inside the `text` field's element. It raised `OUTPUT_NOT_OBSERVED` with the closed marker `incomplete_text: field text ...`.
- **What the model was told:** the domain (`domain/src/runtime/llm-evidence/action-failure/refusal.ts`, lines 159-163) turned that into `{reason: "incomplete_text", next: INCOMPLETE_TEXT_NEXT}`. It dropped the field name on purpose.
  - At 0241 and 0243 the model sent the same `text` field again, and both were answered `answered_the_same_again`.
  - 0240's summary even says "only stable columns", yet the call still holds `text`.
  - The repeat guard then stopped brief-5 after 4 calls (`stoppedRepeating`).
- **Why it was not observed:** the posts' text really was cut short behind See more. Reading a whole post needs a press on each post's disclosure first. The check was right. This read could never have passed while it held `text`.
- **Why the supervisor stopped:** its own decision, not the purse or a deadline.
  - At 0244 about $0.056 was left (Core had given brief-5 only $0.0237 of the $0.15 asked).
  - The dispatch `next` offered three ways on: a changed brief, a plan change, or an honest end.
  - The supervisor ended `blocked`: "Five builder attempts on the feed collection have stalled without a passing trial".
- **Brief-5's place in the run:** it was the tail, not the cause. It was dispatched as a fresh `build`, not a `repair` from `repairFrom.failingReceipt`. So it reran brief-1's opening exactly, and with $0.024 it had no room to do anything else.

## The whole run: one wall, hit five times

Every brief met the same wall. A feed read that holds `text` is refused `incomplete_text`. A read without `text` is judged `no` for the missing text column. Only one brief ever wrote the honest middle: read the row context, press each row's See more with `repeat over`, then read the full text.

| Brief | Steps | What happened | Ended |
| --- | --- | --- | --- |
| brief-1 build | 0009-0037 | Read with `text`: refused `incomplete_text` (0019, 0027). Same read again: `answered_the_same_again` (0029). Then three `repeat_refused`. | blocked, 14 calls, no trial |
| brief-2 build | 0040-0062 | Scroll `{mode: untilStable, maxScrolls: 30}` succeeded (0048). Read with `text`: refused (0044, 0054, 0056). | blocked, 11 calls, no trial |
| brief-3 build | 0071-0171 | 4 trials, described below. The only brief to write the disclosure loop (0160-0164). | partial, 48 calls |
| brief-4 repair | 0174-0232 | 3 trials. It alternated between a read with `text` (`execution_failed`, `incomplete_text`) and a read without it (judged `no`, text missing). It never wrote the loop. | partial, 27 calls |
| brief-5 build | 0235-0243 | As described above. | blocked, 4 calls |

### Trials (no judged whole run passed)

| Step | Rev | Verdict | Stopped at, or what the judge said |
| --- | --- | --- | --- |
| 0103 | 3 | execution_failed | Step 4, the read with `text`: `incomplete_text` after 4 attempts. |
| 0125 | 4 | no (6 rows) | No date or membership condition, and no text column. |
| 0133 | 5 | execution_failed | Step 4, the read with `text`: `incomplete_text`. |
| 0141 | 6 | no (3 rows) | Rows Elena, Sofía, Oliver. These are exactly the oracle's three posts. Only the `text` column is missing. |
| 0204 | 6' | execution_failed | The read with `text`: `incomplete_text`. |
| 0214 | 8 | no (3 rows) | The same three rows, `text` missing. |
| 0222 | 9 | execution_failed | The read with `text`: `incomplete_text`. |

The flat structure (navigate → scroll untilStable → read with the group and date `where` conditions) already kept the oracle's exact rows at 0141 and 0214. What the build never got into a trial: the per-row See more press and the full-text read after it.

## The decisive point: brief-3 wrote the honest shape and was refused on a false "reload"

Brief-3 converged across three submits. Each refusal named a different issue, and each was fixed:

1. **0160 → 0161** `flow_script.only_after_misplaced`: `only after:` named step words instead of a label. Fair.
2. **0162 → 0163** `only_after_misplaced`: the optional click repeated over `posts`, but the read that runs only after it sat outside the span. Fair.
3. **0164 → 0165** added `repeat through: readtext`. The structure was now acceptable:
   ```
   step posts: read the feed posts     (no text field, group/date where)
   step expand: press the row's See more     optional, repeat over: posts, repeat through: readtext
   step readtext: read the post's whole text   only after: expand
   ```
   It was refused `flow_bootstrap.evidence_completion_parameters_unresolved` with `web.handle.renumbered_by_reload` on `target: t271` (the See more press). The `next` said: "The handle t271 came from a view taken before the page was reloaded ... Look at the page again and copy the control's current handle".

**No reload happened.** Here is the sequence:

- 0137's view printed 5 "See more" buttons, the first being `t271`.
- At 0149 exploration pressed `t271` (`run-see-more-2`, `web.action.succeeded`). The press expanded that post, so its button left the page.
- The views at 0149, 0151 and 0153 print 4 "See more" buttons (`t590 t958 t1066 ...`). `t271` is gone, and the other buttons have the same tag and words.
- Every view in this run carries the header `ARRIVED reload`, because the document was first reached by a reload (Core's trial or arrival load). The view after the press therefore also reports `navigation.type === "reload"`.

**The mechanism** is in `domain/src/runtime/llm-evidence/plan-resolution/target-packets.ts`:

- `markRenumbered()` (around line 589) marks every handle a new view dropped as renumbered whenever:
  - the view's `binding.evidence.navigation.type` is `reload`, and
  - another control in the view has the same tag and words.
- `navigation.type` describes how the *document* was reached, and it stays `reload` for the document's whole life. So every later view of that document "arrived by reload", including the view taken right after an exploration press removed its own control.
- `t271` was marked. In `resolveFromHistory()` (line 398), a `renumberedByReload` mark returns before the view-history fallback. That fallback (t358, t442 F1) would have resolved `t271` as the control exploration acted on, "saved as the act found it". So the step that names the pressed control was refused.

**After 0165:**

- It was the 5th step without progress (0156-0165 were all refused submits). Only 3 were left before the build stopped.
- The `core.no_progress` note at 0166 said "The latest accepted candidate has receipt {revision 5 ...}. Use core.test_subflow with that exact revision". Revision 5 is the old read *with* `text`, whose trial had already failed (0133).
- The model regressed. 0166 re-sent a script with `text` and no loop (`already_answered`), 0168 tested revision 5 (`subflow.trial_stale_revision`), and 0170 re-sent it again (`unchanged_submission`). Brief-3 then stopped (`repeat_without_progress`).

## Why the other briefs never wrote the loop

- **The run-time refusal does not name the field.** `refusal.ts` drops `field <name>` from the client's marker, so the model reads "without the incomplete text field" and is not told which of its keys that is. Brief-1, brief-2, brief-4 and brief-5 each re-sent `text` at least once and were answered `answered_the_same_again` (0029, 0056, 0083, 0186, 0241, 0243). That spent their repeat budget on the one read.
- **The hint does not place the final read.** `INCOMPLETE_TEXT_NEXT` (`domain/src/runtime/llm-evidence/rejection-next/next-sentence.ts`) ends "Then read the full text".
  - It does not say that this is the listing read *again with the text field, after the repeat*, so it needs no `only after`.
  - Brief-3 wrote it as a single-element `web.dom-extract` tied with `only after` to the optional click. That cost two refusals (0161, 0163) and dragged the read into the span.
  - The prior successful attempt (`run-mvfq957o-40103539` rev 9) and the qualification workflow both read the list *after* the presses.
- **The judge's `changed` contradicts the hint.** After each `no`, the judge said "add a text field to the read (whole post, expanding See more)" (0128, 0144, 0145, 0217, 0218).
  - The builder did exactly that: it put `text` back in the same read, and the next trial failed `incomplete_text`.
  - Brief-4 swung between the two positions three times (0199 with `text`, 0207 without, 0219 with, 0225 without).
- **The judge was misled about coverage.** At 0141 and 0214 the read's `listContinues` said the feed "was still growing when the read stopped revealing more of it". That is literally true: the fixture's feed goes on past "You're all caught up" with 4 suggestion units, then ends.
  - 0144, 0145 and 0218 read it as rows missing from the task's range. They asked to "page through the infinite-scroll feed" and named posts that the oracle excludes.
  - 0145 and 0217 also wrongly widened the group condition, and 0217 wrongly said the date pattern excluded 19 September.
  - 0217 itself said "The feed was fully loaded (all-caught-up marker reached)". The judges disagreed with each other.
  - This pushed brief-3 into a scroll-repeat loop at 0156, refused `flow_script.repeat_while_never_ends` at 0157.

## Is the round-2 cause gone? Yes

- **No nesting.** No submit in this run nested a row loop inside a page loop. No `repeat_body_is_routed` or `repeat_span_unknown` refusal appears in any result. The t738 hint ("A repeat cannot hold another repeat ... Load every row first") is the text every `incomplete_text` refusal carried.
- **The scroll shape is learned.** 0099's refusal `web.scroll.until_stable_missing_max_scrolls` carried `accepted` with the new description and example. Every later scroll was `{"mode":"untilStable","maxScrolls":N}`, and every trial's scroll step succeeded.

## How far it got

- 7 trials, none judged yes. No whole-Flow judged run passed, and nothing was assembled (one subflow, so the builder's test is the judged run).
- The best trials were 0141 (rev 6) and 0214 (rev 8). Both kept exactly the oracle's three posts, in feed order, with `group, author, posted, comments`. Only the full `text` column was missing.
- Of the honest path, the build reached: open the feed, load it with scroll untilStable, filter by joined group and date, and press See more in exploration (0117, 0149).
- It never got into an accepted revision: the per-row See more press, and the full-text read after it.

## First divergent step

- **0165.** The one honest-shape submit (0164) was refused by a false `web.handle.renumbered_by_reload`, and the build regressed from there.
- The earlier divergence that recurs in every brief is the re-sent `text` read after the first `incomplete_text` (0029, then 0056, 0083, 0186, 0241).

## Cause class

**Product defect**, in two places that compound. One generic guidance gap adds to it. It is not an environment problem: there was no fault in the log, and the purse and the time were not what stopped it. It is not a task, oracle or fixture problem either: the oracle's rows were reached, and the full text is reachable by pressing See more, as qualification and `run-mvfq957o` rev 9 show.

1. **Primary.** `target-packets.ts` `markRenumbered()` treats any view of a reloaded document as "arrived by reload". So a control that left the page because exploration pressed it is marked renumbered. `resolveFromHistory()` then refuses it before the view-history and acted-identity fallback.
2. **Contributing.** The `incomplete_text` refusal at `core.run_node` does not name the field. Its hint does not say the full read is the same listing read again, after the repeat.
3. **Contributing.** The judge's `changed` for a missing disclosed-text column prescribes adding the field back to the same read. It also over-reads `listContinues` on a list that goes on past the instruction's end marker.

## Proposed fixes (least general first)

1. **Downstream, the reload mark.** In `domain/src/runtime/llm-evidence/plan-resolution/target-packets.ts` `markRenumbered()`, mark a dropped handle only when the view is the first view of a *new document*. That means a view whose `navigation.timeOrigin` (already carried in `page-evidence.ts` line 166) differs from the previous view of that page, not any view whose `navigation.type` is `reload`.
   - Store the previous view's `timeOrigin` per page beside `flow.renumbered`.
   - Where `timeOrigin` is absent, keep today's behaviour.
   - Test seam: `domain/src/runtime/llm-evidence/plan-resolution/tests/target-packets.test.ts` (it already builds views with `navigation.type`). Take two views of one reloaded document with the same `timeOrigin`. Press a "Read more" in the first; the second drops it and still shows another "Read more". Assert:
     - the dropped handle is not `renumberedByReload`;
     - `resolve(..., "view_history")` returns the acted identity;
     - a view with a new `timeOrigin` still marks.
   - Use a non-realistic fake site, such as a review list.
2. **Downstream, name the field.** In `refusal.ts`, for `incomplete_text`, put the field key in `missing` (or `instead`) *only when it is one of the keys of the `extractList.fields` the domain sent* (`sent.parameters`), in the same way t738 names scroll keys from the request rather than from the client's sentence. Have the `next` sentence say "without the field `<key>`".
   - Test seam: `domain/src/runtime/llm-evidence/action-failure/tests/refusal.test.ts`. A key that is not among the sent fields is never echoed.
3. **Downstream, the hint wording.** In `next-sentence.ts`, change the end of `INCOMPLETE_TEXT_NEXT` from "Then read the full text." to generic words that place the read. Suggested: "After that repeat, not inside it and with no only-after, read the same listing again with the text field: by then every row is disclosed."
   - Test seam: `domain/src/runtime/llm-evidence/rejection-next/tests/next-sentence.test.ts`. Assert the sentence says "after that repeat" and no "only after".
4. **Core, the judge and the trial feedback** (more general, so after 1-3).
   - When a judged-`no` trial lacks a requested column, and a read of the same extraction was refused `incomplete_text` in this build, attach the disclosure order to the `changed` the builder sees, instead of "add the field".
   - Where the trial reached the Flow's `done when` text, say so beside `listContinues`, so the judge does not infer rows missing from the task's range.
   - Candidate locations: Core `runtime/result-verification/read-account/list-continues.ts` and the candidate-trial judge feedback. Seam: `service/candidate-trial/tests/paging-feedback.test.ts`.
5. **Core, the no-progress note** (minor). `core.no_progress` and `already_answered` at 0166 and 0167 named revision 5 as the revision to test. Its trial had already answered `execution_failed`, and `core.test_subflow` then called it `trial_stale_revision`. The note should not recommend a revision whose last trial is on record as not passing.

None of these fixes mirrors the task or this site, and none weakens the oracle.

## Not verified

- **Fix 1 rests on two assumptions:**
  - that this run's evidence carried `navigation.timeOrigin`: no step file prints the raw navigation record, only the `ARRIVED reload` header;
  - that without the mark, `t271` would have resolved under `view_history`: I read the fallback's code, but did not run it.
- Whether rev 13 (0164 with a current handle) would have passed. Its `readtext` step reads one element (`target: t2007`) inside the repeat, not the listing after it, and was never trialled.
- Whether the oracle's full text needs every See more pressed, or only those on the three kept posts. The loop presses on every kept row.
- Why 0155 accepted a resubmit as the existing revision 5 rather than refusing it unchanged. Also why `core.test_subflow` called revision 5 stale at 0169.
- The ui-review screenshots in the run folder were not reviewed.
