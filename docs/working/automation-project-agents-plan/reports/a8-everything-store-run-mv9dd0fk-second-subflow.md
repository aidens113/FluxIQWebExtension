# A8 wave 7 debug: everything-store `run-mv9dd0fk-8cd2e522`, the `shape_results` subflow that never built

Read-only. No live run, no Lab run, no provider call, no commit. Evidence is the run's
`steps/` under `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-15/run-mv9dd0fk-8cd2e522/` and Core at
`C:/Users/osrs_/FluxStuff/fxwork/t567/!FluxIQ`.

## Outcome

`shape_results` could not be built. The plan made a subflow out of work that has no page of its own: dropping repeats,
keeping result order and choosing columns of rows that `collect_earbuds` reads. A builder must write steps that act on or
read a page, and its trial is judged against a page fact. It was told it was "given exactly `pairs`" but never shown
what `pairs` holds. So both times it re-read the results page (redoing `collect_earbuds`'s work), was refused
`subflow.input_unread` three times in a row because no line read `$input.pairs`, and was stopped by the repeat guard.

Cost by brief (from `meta.json` `costUsd`, total $0.1213):

| Brief | Subflow | Outcome | $ |
| --- | --- | --- | --- |
| brief-1 (0008) | collect_earbuds | done, later dropped by an amend | 0.0246 |
| brief-2 (0008) | shape_results | blocked | 0.0071 |
| brief-3 (0061) | collect_earbuds | done, later dropped by an amend | 0.0412 |
| brief-4 (0061) | shape_results | blocked | 0.0080 |
| brief-5 (0126) | collect_earbuds (merged plan) | done, used | 0.0219 |
| supervisor | — | — | 0.0152 |
| other | — | — | 0.0032 |

`shape_results` itself cost only $0.015. Most of the waste was **rebuilding `collect_earbuds` twice** ($0.066), because each
amend changed its parts and so dropped its done proposal. In all, about $0.08 of the $0.121 (about 66%) went on the split.

## What changed and why

Only this report was written. Nothing else changed.

### 1. What `shape_results` was asked to do

Plan at 0006 (`project.write_plan`): two subflows. `collect_earbuds` carries p1 ("Find every pair ... going through every
page of results") and outputs `pairs`. `shape_results` carries p2, the whole second sentence ("Leave out sponsored
placements and accessories ..., list each pair only once ..., keep the order ..., with columns name, price, rating and
url"), with inputs `[pairs]`, outputs `[rows]` and `after [collect_earbuds]`. Its purpose is "From the collected pairs, drop
duplicates keeping search-result order and emit rows with columns name, price, rating and url." The only warning was
`project.plan_value_unused` on `rows`, which is the Flow's answer, so that warning was noise here.

### 2. What the builder saw and did, the first time (brief-2, steps 0039-0049)

- Builder request 0040: the brief says "it is given exactly "pairs" and hands back exactly "rows"" and gives a template
  with `input: pairs`. **Nowhere in the 70k-character request is `pairs` described**: there is no schema, no row
  count, no sample, and no hint that it is a list of records (`grep pairs` matches only line 314 and the template line 316).
  The entry note says `collect_earbuds` ran and "the site is where your subflow "shape_results" begins" (page 5 of the
  results).
- 0040 → 0041 `web.detect_repeating_structure` on the results list; 0042 → 0043 `core.run_node web.output.dom-extract_list` reads page 5.
  The builder's summary: "Reading the search results list on page 5 to see the columns available ...".
- 0044 → 0045 `submit.1`: a `dom-extract_list` step that re-reads the page, with `where` filters for sponsored, Plus,
  rating and price, `recordOutput.process: {"dedupe": {"by": ["name"]}, "columns": [...]}`, and `done when: exists t1867`.
  This is `collect_earbuds`'s read written again, plus p2's shaping. It was refused `subflow.scope_refused` /
  `subflow.input_unread`: "The input "pairs" at line 3 is declared, and no line of this part reads it. ... If this
  subflow has no use for it, ... end the brief blocked and name the input, so the plan can change."
- 0046 → 0047 `submit.2`: it widened the scope further and added the whole multi-page loop (`repeat while: next` and a
  `dom-next_page` step), so it is now writing p1. Refused for the same reason.
- 0048 → 0049 `submit.3`: summary "now reading the pairs input in its done-when check so the declared input is used". It
  still never wrote `$input.pairs`. Refused for the same reason a third time, and the guard ended the build
  (`llm_evidence_loop.repeat_refused` → `flow_bootstrap.evidence_repeat_without_progress`).
- What it repeated: the same refused submission (input declared, never read) three times. It never took the offered
  way out (end blocked, naming the input).

### 3. The second time (brief-4, steps 0110-0122, after amend 0059)

The amend narrowed p2 to "with columns name, price, rating and url" and moved the rest of the sentence into p1. The
builder did the same things: 0110 snapshot, 0112 and 0114 two detects, 0116 reads the page, then 0118, 0120 and 0122 three submits that
re-read the page with `dom-extract_list` and never read `$input.pairs`. All three were refused `subflow.scope_refused:b54daa6d` and the build was blocked
again with the same code.

### 4. Was the part buildable at all?

Not as a builder subflow:
- It has no page work. Everything p2 asks is either a condition on the read or `recordOutput.process` on the reading step. The
  builder's own format text says so (request 0040, line ~446): "Rows a Flow reads are also collected over the whole run,
  and `recordOutput.process` on the reading step only shapes that saved answer at the end -- keep some, drop repeats,
  sort, limit". The builder in 0044 wrote exactly that, but it can only attach it to a read step, and the read step
  belongs to `collect_earbuds`.
- The node catalog has `builtin.data.filter-list` and `builtin.data.map-object` but no dedupe or ordering node, and the brief
  gives no evidence of what is inside `pairs` to configure them with.
- The trial is judged against a page `done when:` fact, and a pure reshape changes nothing on the page.
- The final plan (0124: one subflow carrying p1 and p2) built in 18 calls and passed (0126, then 0165 `core.test_candidate`
  yes). That confirms the work belonged with the read.

### 5. The three refused dispatches

- **0051 `project.brief_refused` / `project.failing_receipt_unknown`.** The supervisor sent `kind: repair` for
  `shape_results` with `failingReceipt` = a **`collect_earbuds`** trial (`subflow-trial.f2c0c7da...`, its passing one).
  The why: "No return of this subflow listed this trial. Copy one entry of the trials a return of this subflow listed,
  or name the latest whole test". That is accurate, but it is misleading here: `shape_results`'s return listed **no** trials (`"trials":
  []`) and there was no whole test. So there was nothing to copy, and the words never say "this subflow has no trial; a
  repair needs one; send a changed build brief or amend the plan". No `closestTrial` was offered because none existed.
- **0053 `project.brief_refused` / `project.brief_failing_receipt`.** The supervisor dropped the receipt and kept
  `kind: repair`. The issue came back as **code and path only, with no `why`**: `{"code":
  "project.brief_failing_receipt", "path": "briefs.0.failingReceipt"}`. Cause: `supervisor/dispatch-tool.ts:132` turns
  an `AutomationStudioProjectRecordRefusal` from `contracts/subflow-brief.ts:233` ("repair iff failingReceipt") into
  `issues: [{ code: error.code, path: error.path }]` with no guidance text. The supervisor then spent 0054/0055 on
  `core.recall_result` of `dispatch.build.1`, which answered `found: false` even though the call was its own. The
  recall binding (`llm/evidence-recall/binding.ts`) only knows results seen by the current loop instance. I did not trace why
  the supervisor's own dispatch result was absent.
- **0057 `project.brief_repeated`.** A `kind: build` brief identical to brief-2. The words are good: "Change what the
  builder is given (its parts, what runs before it, a recordingExcerpt, or the trial a repair starts from), change the
  plan with project.amend_plan if that subflow cannot do its parts, or end honestly". The supervisor followed this
  (0059 amend), but nothing told it what the split was doing wrong. The blocked reason it read said only
  "core.submit_subflow answered subflow.scope_refused:b54daa6d (3 in a row)". The issue code inside (`subflow.input_unread`
  on `pairs`) is hidden behind the hash, so the supervisor's amend reason (0058) guessed "Narrow its scope ... so its builder
  can submit a small subflow instead of re-detecting the list". That kept the bad split and dropped `collect_earbuds`'s
  done proposal ("its parts changed").

Did the refusal words tell the supervisor how to proceed? 0057 did, in general terms. 0051 pointed at a trial that did not
exist. 0053 said nothing. None of the three, and neither blocked return, said the actual cause: no step of the subflow can use
`pairs`.

### 6. Does the supervisor's plan guidance invite the split?

Yes, implicitly (request 0005, line 741-748; source `project-agents/supervisor/guidance.ts`):
- "taskSpec splits the task into parts: a part is one thing the person asked for", and then "subflows: one for each
  piece of work a builder makes". The only worked example maps one part to one subflow (find_titles [p1], place_hold [p2]).
  A sentence of conditions on a read reads as "one thing the person asked for", so it became a part and then a subflow.
- The guard sentence exists but is not enforced: "Hand a value on only when a step of a later subflow uses it, as a name
  it types or a row it opens." `shape_results` neither types `pairs` nor opens a row, but `write_plan` accepted the plan.
  Its only check of this kind (`plan-input.ts` `valueWarnings`) flags outputs no one takes and subflows that neither act
  nor hand on. `shape_results` hands on `rows`, so it passed.
- Nothing says that a part which only narrows, de-duplicates, orders or picks columns of what another part reads belongs
  to the subflow that does that read.

### 7. Smallest structural fix (product, Core)

The guidance text below is generic: no site, product, task or answer from this scenario.

1. **Plan check, Core `project-agents/supervisor/plan-input.ts` (`valueWarnings`), with words in `guidance.ts`
   `planIssues`.** Add the warning `project.plan_subflow_reshape_only` on any subflow that (a) has inputs, (b) carries
   only parts with no lasting acts, and (c) has outputs no other subflow takes (it only hands the answer back). Words:
   "This subflow takes rows an earlier subflow reads and changes nothing on the target. If its parts only keep, drop,
   de-duplicate, order or choose columns of those rows, they are that read's own condition and `recordOutput.process`:
   carry them in the subflow that reads, and drop this one. Keep it only if its builder must open or read something on
   the target for each row." It stays a warning because it can match a legitimate per-row detail read. Also stop
   `project.plan_value_unused` firing on the output of the last subflow when that output is the Flow's answer (here it fired on
   `rows` both times and told the supervisor to remove the answer). Add a sentence to guidance step 2 in
   `guidance.ts`: "A part that only narrows, de-duplicates, orders or shapes what another part reads is carried by the
   subflow that reads it." Tests: `supervisor/tests/` beside `plan-input` (a reshape-only subflow warns; a subflow
   with a lasting act or a taken output does not).
2. **Blocked return names the issue, Core `project-agents/dispatch/ending.ts`.** When the calls a loop stopped on are
   `subflow.scope_refused:<hash>`, include the issue codes and the input name (Core's own codes, not model words), for example
   "core.submit_subflow answered subflow.scope_refused (subflow.input_unread: input "pairs") 3 in a row", and map that
   case to the plan-level advice "the plan gives this subflow a value no step of it can use: amend the plan". The hash
   hid the one fact the supervisor needed.
3. **Refusal words, Core `project-agents/supervisor/dispatch-tool.ts`.** At line 132, attach a `why` for record
   refusals, at least `project.brief_failing_receipt`: "A repair starts from a trial of this subflow that did not pass,
   or from the latest whole test that did not pass. Send `kind: build` with something it is given changed, or change the
   plan." At `failing_receipt_unknown` (line 224), when the subflow's returns list no trials and no whole test stands,
   say so plainly: "This subflow's returns list no trial and no whole test stands, so it cannot be repaired: send a changed
   build brief or change the plan." Without this the supervisor spent 0051-0057 (four decisions) finding it out.

Fix 1 alone would most likely have avoided both amends and both `collect_earbuds` rebuilds. I estimate the saving at about $0.08 of
$0.121, but this was not measured.

## Commands run and observed results

- `python .../scratchpad/a8-summary.py run-mv9dd0fk-8cd2e522`: 186 steps. The dispatches at 0008 and 0061 each came back
  `collect_earbuds` done and `shape_results` blocked (5 and 6 calls). 0051 and 0053 were `project.brief_refused`, 0057 was `project.brief_repeated`, and
  0126 came back with only `collect_earbuds`, done. The final test at 0165 answered yes.
- Read `call.json`, `result.json`, `meta.json` and `request.txt`/`response.txt` for 0005, 0006, 0008, 0038-0059, 0061,
  0110-0126 (quoted above).
- A cost sum over `meta.json` `costUsd` by role and brief gave the table above, total 0.12133566.
- Greps and reads in Core: `subflow-candidate/callable-target.ts:60-95`, `supervisor/plan-input.ts:100-135`,
  `supervisor/dispatch-tool.ts:125-135,205-225`, `supervisor/guidance.ts:177-197`,
  `contracts/subflow-brief.ts:196-236`, `dispatch/ending.ts:15-60`, `llm/evidence-recall/binding.ts`.

## Not verified

- Why `core.recall_result` of the supervisor's own `dispatch.build.1` answered `found: false` at 0055. I did not trace it.
- Whether Core can pass a record list as a subflow value into `builtin.data.filter-list` at run time. I did not check;
  it does not change the conclusion, because the builder had no evidence of the value.
- No fix was implemented or tested. Fix 1's false-positive rate on other scenarios is not measured.
- I did not check that the final Flow's answer de-duplicates and orders correctly beyond the 0165 test answering yes.

## Open questions or contradictions found

- The brief said "about half the purse went on the subflow that never built". By `costUsd` the `shape_results` builders
  cost only $0.015. The larger waste was two `collect_earbuds` rebuilds forced by amends ($0.066).
- The `subflow.input_unread` message tells the builder to "end the brief blocked and name the input". The builder (a
  flash model) never did, in six refused submits across two briefs. The guard ended it instead, and the return lost the
  issue code.
- `project.plan_value_unused` fires on the final answer value of a multi-subflow plan. That is misleading guidance on
  every plan with a final output.
