# Saturday certificate loop (run-mwc6ut8u-52e3c1b3)

Worker report for E1. Read-only trace; no source or test was edited.

Run: `company-website-saturday-certificate`, Haiku, answer-first, attempt 1 of 4. It stopped at
`waiting_for_person` / `stuck_in_a_loop` after 91 live steps, 119 calls and $0.31 of a $5 purse.
Evidence: `lab-runs/2026-11-11/run-mwc6ut8u-52e3c1b3/steps/` (step numbers below are those folders).
Attempt output: `test-runs/instances/t885-live/attempts/run-mwc6ut8u-52e3c1b3/` (`attempt.json`, `stopped.jpg`).

## Outcome

Partial. Every cause is traced to code and step evidence. Two links (R4, which control the
detected pager pressed, and S1, the folded error line) are inferred from code, the screenshot and
timings. They were not reproduced in a browser.

## Summary in plain English

The model could see the right answer within its first 34 steps. The page view marks taken slots
`disabled`. At step 19 it wrote that Sat 10/10 is "both taken", at step 21 that Sat 03/10 has 11:30
free and 09:00 taken, and at step 34 that Sat 17/10 has 09:00 free. Its own summaries at steps 216
and 243 give exactly the oracle's two rows.

The result, though, can only be rows a read returned (answer-first D9). This run's reads could not
hold the answer, for four reasons:

1. A read cannot carry whether a slot is taken (R1).
2. The calendar can only be read as one row per day with positional slot columns, so the rows came
   out with day labels and columns a-d (R2).
3. Each re-detection of the same calendar became a new list, which replaced the result instead of
   adding to it (R3).
4. The detected "next page" was the booking wizard's Next button, and the next-page step reported
   "moved" when nothing moved (R4, R5).

The model then went back and forth between weeks to re-check slot states it no longer had in
context. The repeat guard refused those presses as repeats without saying that the earlier view
could be recalled. The model got past the refusals by changing `timeoutMs`, 13 times (R6). After
two fresh approaches and three refused completions, the ladder parked the task to ask the person
"keep going or stop", which is not a real question for the person (R7).

## Answers to the four questions

### 1. Why 119 calls did not get past this

**What repeated.** The model pressed Earlier and Later between weeks about 30 times and ran 7
structure detections (22, 49, 59, 147, 159, 165, 236). It ran 11 list reads under 6 different
extraction handles (50, 60, 66, 79, 91, 95, 148, 160, 166, plus 83, 152 and 154, which were
refused) and recalled reads 5 times. It completed 6 times (76, 131, 216, 229, 232, 243). Four
completions were judged no, and the last two were refused before the judge as the same evidence.

**What loop detection saw** (`attempt.json` `loopsCaught`):

- `exact_repeat`: 22 refusals, all of them Earlier or Later presses refused `same_result`, plus
  three reads refused `changed_nothing` (84, 153, 155). One `change_approach` at step 87.
- `no_progress`: steered at steps 127 (x13) and 130 (x14), then `change_approach` at step 140 (x17).
- `near_repeat` on `core.completion_check`: steered at step 233, then `ask_person` at step 244.

**Why nothing steered it to Later.** The model did not lack Later; it pressed it more than ten
times. Later just never added to the result, because each week's read replaced the previous one
(R3). From those readPages the judge concluded the other weeks were never read (diagnoses at 77,
217 and 230: "Later link that was not followed"). Its advice to "read Next page over the calendar
weeks" (77, 217) sent the model to `dom-next_page` (89, 109, 150), which pressed the booking
wizard's Next instead of Later (R4) and still answered "moved" (R5).

**Why nothing steered it to the free or taken state.** The model already knew the state. It read
it from the page view's `disabled` tokens, from `find_on_page "aria-disabled"` (104, 112) and from
`describe_element` (108, 179, 193). No read can carry that state (R1), so knowing it was useless
for a result built only from rows. The steers are generic ("look at or search the page, use a
different control"). None of them can say "your read lacks a column the page shows", because the
read offered no such column.

### 2. Why the columns were a-d, not date and time

The model named them `a`, `b`, `c` and `d` itself (step 50: `fields: {day: div_css-12aztu2, a:
div_2, b: div_3, c: div_4, d: div_5}`). Detection proposed one item per day column, whose slot
buttons are positional children (`div_2` to `div_5`), so no single "time" column and no ISO date
exist to name (R2).

170d8c4c5 is not regressed. It narrows a result to the person's named columns only "where every
named column is a stored column" (Core `answer-first/rows/row-sink.ts:104`). The stored columns
were `day, a, b, c, d`; neither `date` nor `time` was one of them, so by design nothing was
narrowed. Named columns cannot turn a day row with four slots into one row per slot. Only a read
whose item is the slot can (R2).

### 3. Can the page show free versus taken, and does web-llm-page.v3 drop it?

**The page shows it.** The fixture renders each slot as `<div role="button"
aria-disabled="{!free}" data-date="YYYY-MM-DD" data-slot="date|time">HH:mm</div>`, and a taken slot
also gets the `slotFull` class: struck through, grey, `cursor: not-allowed`
(`apps/scenario-lab/src/scenarios/company-website/client/widget-script.ts:59`; `stopped.jpg` shows
the strike-through). Later and Earlier are `<div data-week="±1">` and appear only where another
week exists (`widget-script.ts:63-64`).

**The page view keeps it.** Step 20's page view prints `t296 button "09:00" disabled` and `t297
button "11:30"`. `find_on_page` and `describe_element` both report `aria-disabled` and `data-date`.

**Only the read drops it** (R1, R2).

**One thing the page view does drop (S1, secondary).** After the wizard Next was pressed, the
widget's red error "Choose a time." sits right after the grey note "Choose a time." (`stopped.jpg`).
The view prints one `t301 "Choose a time."` (steps 149/151, 88/90), because rule F3 folds a text
line that says what the line before it says (`domain/src/runtime/llm-evidence/page-view/fragment-merge.ts:18-19`).
So neither the model nor the judge could see that next_page had raised a form error.

**The task is achievable and unambiguous.** Free versus taken is visible. All three weeks are
reachable by Later. The year is on every page (`t178 "© 2026 ..."`) and in the long date shown once
a slot is chosen. The oracle's two rows match the fixture (`qualification/saturday-certificate/expected.ts:4`,
`data/slots.ts`, with Sat 10/10 both taken). The recorded honest path reads slot buttons with
`date` from `data-date` and filters on `aria-disabled="false"` and the Saturday column
(`qualification/saturday-certificate/workflow.ts:27-30`). **No fixture or task defect.** Do not
change the fixture: giving Later a role would hide R4.

### 4. Is stopping at waiting_for_person right?

No, judged against the user's rule as quoted in AGENTS.md: "it NEEDS to keep retrying until final
result achieved or budget out", where a person's Stop still stops a task. The loop rule says loops
are "detected and steered/stopped", which reads as stopping the repetition, not the task.

The park came from the ladder's last rung. The second fresh approach was used at step 140, and the
third refused completion (step 243) then hit `ask_person` (Core `answer-first/loop-signal/completion-refused-again.ts:56-64`,
`limits.ts:23,33`). The question it asks, "Do you want me to keep going, or stop here?"
(`answer-first/attempt/stuck-ask.ts:11`), is not something only the person can answer. It is a
stuck loop handed over with $4.69 of the purse left. `stuck-ask.ts:1-4` calls it "not an ending",
but with nobody watching (the Lab, or a person who walked away) it ends the task's progress
indefinitely. Answer-first D14 step 4 designed this rung, so changing it reverses a planned
decision. The lead should confirm the reading with the user (see R7).

## Causes, evidence, class and proposed fix

### R1. A read cannot carry a control's disabled state

**Class:** product defect, extension (content extraction).

**Evidence.**

- Reads 71, 75, 98, 169 and 171 hold the times with no state. For example, `Sat 17/10 a: 09:00
  b: 11:30` (171) keeps 11:30 although it is `aria-disabled="true"` (179).
- Judges 132, 217 and 231 refuse because "the rows do not show whether those slots are free".
- State columns are offered only for `aria-pressed`, `aria-checked` and `aria-selected`
  (`apps/extension/src/content/extraction/item-mark/state-sources.ts:28`).
- An item's own attributes are offered only when they are `data-*`
  (`item-attributes/item-attribute-sources.ts:22,41-52`).
- So `aria-disabled` and native `disabled`, which the page view prints as `disabled`, are no
  column, and `where {field, is: "absent"}` (supported, `domain/src/actions/extraction/request.ts:179,210`)
  has nothing to test.

**Fix.**

- Add a `disabled` state mark in `state-sources.ts`: `aria-disabled="true"`, plus the native
  `disabled` property on form controls (selector `:disabled`). Its column reads only while on,
  exactly as the pressed, checked and selected marks do, labelled `<path> (disabled)`.
- Check that the label word passes the domain packet unchanged
  (`domain/src/runtime/llm-evidence/structure/packet.ts`).
- The page view and the read then agree on one notion of "disabled".

**Tests.**

- `apps/extension/src/content/extraction/item-mark/tests/state-sources.test.ts` (new): aria-disabled
  true, false and absent; a native disabled button; a sensitive control never offered.
- A detection case in `apps/extension/src/content/extraction/tests/infer-list.test.ts`: a run of
  options, some disabled, offers the `(disabled)` column and `is: "absent"` keeps the enabled ones.
  Use a generic fixture, such as a cinema seat or shoe-size picker, never a booking calendar.

### R2. A grid of grouped controls cannot be read one row per control

**Class:** product defect, extension (content extraction), with the domain structure packet.

**Evidence.**

- Each detection (22, 49, 59, 147, 159, 165, 236) proposes 7 day items whose slots are positional
  fields `div_2` to `div_5`, plus a class-variant field `div_css-0j5f94n_css-0qx3ssu` that is the
  taken style under a hashed name (22).
- A run is only siblings (`infer-list.ts`). Aimed at a slot, a thin run of controls loses to the
  rich enclosing list (`detect-structure.ts:66-71`). So slot buttons in different day columns can
  never be one list, and their `data-date` (an item attribute only when the slot is the item) is
  never offered.
- The judges refuse "day labels ... not YYYY-MM-DD" (77, 133, 231).
- The honest path the fixture records is exactly this slot-level read (`workflow.ts:27-30`).

**Fix.** Teach detection a cell run.

- Where the run's items each hold a run of same-template controls, also propose a list whose
  items are those nested controls across all groups, in document order.
- Each row carries the enclosing group's heading field as a column (the context `describe_element`
  already computes as `within`, step 199), plus the cell's own text, `data-*` and state columns
  (R1).
- The domain packet hands it out under a further handle, as it does the one-record `record` list
  (`domain/src/runtime/llm-evidence/structure/detect.ts:50-57`, `packet.ts`), with a note in Core
  words ("one row per control inside each item, with the item's heading").
- With R1, the model's read becomes:
  `where: [{field: heading, contains: "Sat"}, {field: "(disabled)", is: "absent"}]`, fields
  `date: data-date`, `time: text`.
- No guidance is shaped to this site.

**Tests.**

- `apps/extension/src/content/extraction/tests/infer-list.test.ts`: a grouped grid (example: a
  cinema's showtimes per day, or a bus timetable per stop) yields the cell list with the heading
  column; a plain card list does not.
- `domain/src/runtime/llm-evidence/structure/tests/detect.test.ts`: a third handle, retained in the
  same scope and frame, readable by `extractList`.

### R3. Each re-detection of the same list became a new list that replaced the result

**Class:** product defect in Core (`packages/fluxiq/src`), needing a domain-supplied identity.

**Evidence.**

- The dataset id is the tool, its input (which holds the opaque `extractList.handle`), the view and
  the columns (Core `answer-first/rows/dataset-of-read.ts:31-39`).
- The widget redraws on every press, so the model re-detected often and read week 2 under
  `extraction.3` (60), week 1 under `.1` (66), `.4` (148), `.5` (160) and `.6` (166). Each was
  "another list", and the latest replaced the result (`row-sink.ts` header, `other_list`).
- When it reused one handle (91 then 95, both `extraction.2`), the rows did merge: the judge at 133
  saw 14 rows over two weeks.
- Judges 77, 217 and 230 saw "one read page, 7 rows", which is why they said Later was never
  followed.

**Fix.**

- The domain's read answer states the list's own identity: a digest of the detected binding's item
  selector, container and frame path (`domain/src/runtime/llm-evidence/structure/handles.ts`, read
  answer in `node-run/list-read/`).
- Core's `dataset-of-read.ts` uses a generic `listKey` from the answer, where present, in place of
  the input's handle.
- Two handles for one list are then one dataset, and `list-after-read.ts` rule 5 ("none known is
  the next page") appends each week.
- Alternative, domain-only: `detectRepeatingStructure` returns the retained handle when a
  re-detection's item selector, container and frame equal a retained binding's. This is weaker,
  because the field sets differ by week here (week 1 has the "Today" note).

**Tests.**

- Core `answer-first/rows/tests/dataset-of-read.test.ts` (new): same `listKey` under two handles
  gives the same dataset; a different key gives a different one.
- Core `answer-first/rows/tests/row-sink.test.ts`: two pages read under different handles with one
  `listKey` accumulate.
- Domain `structure/tests/handles.test.ts`: two detections of one re-rendered run give the same key.

### R4. The detected pager was the booking wizard's Next button, not Later

**Class:** product defect, extension (content extraction). Inferred, not reproduced.

**Evidence.**

- Every detection reports `pagination: next_link` (22).
- Later is a `<div data-week="1">` with no role, so it is not a pager candidate:
  `CONTROL_SELECTOR = 'a,button,[role="button"],[role="link"]'` (`detect-pagination.ts:71`). Its
  label is not a Next label either (`:265`).
- The wizard's `<button data-go="next">Next</button>` sits beside the week container and matches
  `^next\b` (`:265`, `nextControlOnPage` `:276-292`).
- Pressing it with no slot chosen sets the error "Choose a time." (`widget-script.ts:88`) and
  redraws the same week. `stopped.jpg` shows that red error, which only a wizard Next press at this
  step produces.
- next_page at 150 answered `moved by next` in 5 ms while the label stayed "Mon 28/09 to Sun 04/10"
  (149 and 151 identical). At 109 it also answered moved, on week 3, where no Later exists.
- On a site where a slot was already chosen, this verb would have advanced the booking to "Your
  details". A pager must never be a form's step control.

**Fix** in `apps/extension/src/content/extraction/detect-pagination.ts`:

- (a) Pager candidates include elements the page view calls `clickable`, using the same predicate
  as the domain's press-target rules, not only semantic controls.
- (b) Recognise date-ordered direction pairs as a pager: Earlier and Later, Older and Newer, a
  control flanking a range label.
- (c) Prefer the candidate grouped with the list (a direction pair around a range label adjacent to
  the run) over a lone Next in an action bar paired with Back.

R5 is the run-time backstop.

**Tests** in `apps/extension/src/content/extraction/tests/detect-pagination.test.ts`:

- A multi-step form whose list has a div-drawn "Later ›"/"‹ Earlier" pair and a Back/Next action
  bar proposes the pair's forward control.
- The same form without the pair proposes no pagination, never the step's Next.
- Use a generic fixture, such as a timetable inside a checkout-style stepper.

### R5. next_page reports "moved" when the list was redrawn identically

**Class:** product defect, extension (content extraction).

**Evidence.**

- `listChanged` returns true when the first item is detached (`!first.isConnected`), even if every
  record means the same (`page-advance/list-change.ts:175-181`). `hasUnreadItem` likewise counts
  new element objects (`move-page.ts:85`).
- The widget redraws everything on every press, so 109 and 150 "moved" without moving.
- The model's next reads were refused `changed_nothing` (153, 155), which confused it further.

**Fix.**

- A move needs the records to differ, not just the elements: compare `recordMeaning` sequences (or
  count) only, and treat a redraw that reproduces the same records as `list_unchanged`
  (`OUTPUT_NOT_OBSERVED`).
- Apply the same rule in `hasUnreadItem` for the arrival wait.

**Tests** in `apps/extension/src/content/extraction/page-advance/tests/list-change.test.ts`:

- A redraw with identical records fails `list_unchanged`.
- A redraw with new records moves.
- An appended page still moves.

### R6. The repeat guard blocked the only way back to evidence the model had lost, and was evaded by `timeoutMs`

**Class:** product defect in Core (`packages/fluxiq/src`).

**Evidence.**

- A navigation repeated from the same page that ends where it ended before is `same_result` and is
  refused (Core `runtime/llm/repeat-guard/outcomes.ts:31-38,567-570`).
- The week-2 view with `Sat 10/10 ... "09:00" disabled ... "11:30" disabled` is in request 0040 but
  gone from 0123, 0204 and 0219, which hold only change notes and the stateless read rows. The
  current view keeps only the latest page (`decision-context/current-view.ts`).
- The view was still recallable through `core.recall_result {callId}`. The refusal names
  `sameAsCall` (for example `later_week_4` at 41, `later_week_click_6` at 191/195/197) but never
  says that recall shows where it led.
- The model used recall only for reads (70, 74, 97, 168, 170) and instead got past the guard by
  changing `timeoutMs`, which the key includes because it keys on the whole input (`outcomes.ts:491,625`).
  That happened 13 times: 56, 72, 144, 180, 182, 188, 200, 202, 212, 214, 221, 239, 241.

**Fix.**

- (a) A `same_result` refusal says that the call would end on the page `sameAsCall` ended on, and
  that `core.recall_result {callId: sameAsCall}` shows that page without going there.
  `runtime/llm/repeat-guard/feedback.ts`; the generic Core words go to every role.
- (b) Parameters that do not change what a call asks, such as the wait bound, are dropped from the
  repeat key. Nodes declare them in their definition, so Core names no domain parameter. They stay
  in the key only when the earlier outcome was a timeout. Files: `outcomes.ts` (`keyedInput`), and
  `loop-detection/meaningful-input.ts` for the near-repeat key.
- Do not loosen `same_result` itself. With R2 and R3 fixed, the honest path is read, Later, read,
  Later, read, which never repeats from the same page.

**Tests.**

- Core `runtime/llm/repeat-guard/tests/feedback.test.ts`: the same_result refusal names recall with
  `sameAsCall`.
- `repeat-guard/tests/outcomes.test.ts`: the same call with only a declared timing parameter
  changed is refused after `same_result`, and runs after a `timed_out` failure.

### R7. A stuck loop parks the task to ask the person

**Class:** product defect in Core (`packages/fluxiq/src`), measured against the user's
result-or-budget rule. It reverses answer-first D14 step 4, so confirm with the user.

**Evidence.**

- Step 244 is `ask_person near_repeat x3`, after `change_approach` at 87 and 140 had used both
  fresh approaches.
- The question (`attempt/stuck-ask.ts:11`) asks nothing only the person knows. The attempt then sat
  for 600 s and the Lab declared `AttemptProofStuck` (`attempt-report.txt`).

**Fix.**

- At the last rung, tell the person as a step ("still stuck, still trying; Stop stops it") without
  parking, and start another fresh approach.
- Raise a parking ask only for a genuine question: a missing input, a permission, or a choice
  between results.
- Files: `answer-first/attempt/stuck-ask.ts`, `answer-first/loop-signal/completion-refused-again.ts:56-64`,
  `runtime/llm/repeat-guard/loop-detection/watch.ts:127-134`.
- The purse still bounds the run.

**Tests.**

- Core `answer-first/loop-signal/tests/completion-refused-again.test.ts`: the third refused
  completion past two approaches yields another fresh round and a notice, never `ask_person`.
- `answer-first/attempt/tests/person-wait.test.ts`: a loop never parks; a genuine ask still does.

### S1 (secondary). An error message the press raised was folded out of the view

**Class:** product defect, web domain (page view). Plausible; its effect on this run is small.

**Evidence.** See question 3: `page-view/fragment-merge.ts:18-19` folds a text line that repeats
the line before it, so the wizard's red "Choose a time." error was never shown.

**Fix.** Do not fold a repeated line when the element was newly drawn by the last act (it is in the
change list), or when its region or role differs from the line it repeats.

**Test.** `domain/src/runtime/llm-evidence/page-view/tests/fragment-merge.test.ts`: a validation
message equal to a nearby note survives after the act that raised it.

### M. Model behaviour with otherwise correct guidance

- It confused which week was third. At 113-122 it searched for "19/10" and the missing Later on
  week 3. At 142 and 144 it said "Earlier to reach the third week".
- At 76 it claimed Sat 10/10 09:00 and 11:30 were free, contradicting its own step 19.
- It named columns `a` to `d` (50) and never tried `where` on the day label.
- It did not use `core.recall_result` for an earlier page view (made more likely by R6a).

These cost calls, but the run fails without them because of R1, R2 and R3. No guidance change is
proposed.

## Order to fix

1. R1 and R2: the read can hold the answer.
2. R3: the weeks accumulate.
3. R4 and R5: Next page is the real pager and is truthful.
4. R6: refusals point at recall, and the timing loophole is closed.
5. R7: no park on loops.
6. S1.

After R1 to R5, prove the honest path provider-free with the scripted model: detect cells, read
with `where`, Next page, repeat. Then run the 4-attempt live check.

## What changed and why

Nothing in source or tests. This report is the only file written.

## Commands run and observed results

All read-only (`ls`, `sed`, `grep`, `diff`, a `node` timeline script in the scratchpad):

- Step timeline of 244 folders. `next_page` results at 0090, 0110 and 0151 are `moved by next`,
  with `pageChanged` true, false and false. `diff 0149/page.txt 0151/page.txt` printed nothing.
- `grep` of requests 0040, 0123, 0204 and 0219 for the week-2 view: present in 0040, absent from
  the later three.
- The judge request at 0230 shows `recordSets` with one read, 7 rows, columns `day, a-d`, and an
  end view of week 1.
- No vitest or tsc was run.

## Not verified

- Which element the detected pager selector named (R4). The selector is not in any artifact
  (`snapshots/live-llm.json` is 129 bytes); I inferred it from code, the screenshot error and the
  5 ms "moved".
- That `core.recall_result` restores the web `page` member for a click's callId. Its description
  says held view members, and the current view's "top" group carries the page.
- That S1's fold is the cause of the missing error line, rather than another rule.
- Nothing was reproduced in a browser or a unit test.

## Open questions or contradictions found

- R7 reverses answer-first D14 step 4 ("ask the person" after two approaches). The lead should
  confirm with the user that a stuck loop must keep going rather than park.
- `same_result` (t195) is a deliberate rule. I recommend keeping it and fixing its feedback and key
  (R6) rather than loosening it, because the loop here was driven by R1 to R5.
