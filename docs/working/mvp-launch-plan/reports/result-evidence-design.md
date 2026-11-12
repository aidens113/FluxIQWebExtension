# Result and evidence: one structural fix (design)

Worker report, 2026-11-11. Design only: no code, no Lab run, no model call, no git.

Paths: `Core` is `C:/Users/osrs_/FluxStuff/!FluxIQ/packages/fluxiq/src`, `af` is
`Core/framework/automation-service/service/answer-first`, and `t885` is
`C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQWebExtension`. Step numbers are folders under
`C:/Users/osrs_/FluxStuff/lab-runs/<date>/<run>/steps/`.

## Outcome

Done as a design. The failures share one root: **the attempt's result is never an object anyone
declared.** Core works it out after each call from heuristics: which read came last, whether rows
overlap, a digest of the call text and its opaque handle, and whether a run outranks a read by row
count. It then tells the model and the judge about it in pieces: a diff note when it thinks
something changed, a page count, the end view, and looks cut to a length. Every patch so far adds
one more heuristic or one more piece. The `row-sink.ts` header (501 lines) is now nine paragraphs,
each named after a run.

The fix makes the result explicit:

1. **The result is what the draft's read steps produced.** Each draft read step keeps its pages,
   one per place, read under the step's current conditions. A read the model did not add to the
   draft is a look. It is shown and judged as evidence, but it never changes the result.
2. **List identity and page place come from the site's structure.** The domain declares them. A
   handle, the call's text or row overlap never decides them.
3. **Every request carries a statement of the result as it stands**, and every call that changed
   the result says how it changed.
4. **The judge gets every contributing page whole**: its conditions, place, kept rows, left-out
   rows, and whether the list was read to its end. It also gets the request's columns. Nothing is
   cut to a fixed length.
5. **Anything the page view can show about an element can be read as a column.** This is checked
   mechanically.

The towels question is answered under "Second question". In short: 14 of the 36 live browser
calls came from this class (a stale result note after a Flow run). Another 9, plus 8 decisions,
came from a different class (a rerun refused on a no-reset task, then a repeat-guard identity
mix-up). The robot check repeated nothing.

## Checking the lead's reading

The reading is mostly right, with five corrections.

1. **"About 7 of 8 involve how found rows become the result."** Close, but one run is
   misattributed. In run-mwaknxf9 the rows were stored right: the result held all 16 at 0041. The
   organic row was lost because two judges wrongly called a correct row sponsored, and the model
   then added a name condition that dropped it (0076/0078, `dropped-organic-row.md`). That is an
   evidence failure, not a plumbing one. The list also misses a sub-class: **what the model is
   told about the result can be stale or false even when the result is right.**
   - run-mwbk0twg: a Flow run told the model "11 rows, 1 page" when the result held 16.
   - run-mwaf6gnt 1a: the model was told "extracted holds all 20 kept rows" for rows the read had
     rejected (`shown-rows/account.ts`).
2. **"4 involve the judge seeing partial evidence."** It is 6, plus Saturday indirectly:
   - mwa19obz: the end page only;
   - mwaf6gnt: the empty page 2 was never told;
   - mwaknxf9: rows by name, with no way to tell which card;
   - mwaudvnh: a Flow run's pages had no left-out rows, and one label was both kept and left out;
   - mwbkuxqt: cut to 80 and 600 characters, and the page shown instead of the value read;
   - mwb2kkv5: the judge was never told which columns the request names, so it accepted `link`.

   Partial evidence also produces **wrong yeses**: mwaknxf9 (15 of 16 rows) and mwb2kkv5 (an
   extra column). Wrong nos are not the only cost.
3. **"3 capture gaps."** Right: one element read into a one-row record (mwbkuxqt), a control's
   disabled state (Saturday R1), and a grid read per day instead of per slot (Saturday R2). That
   is three gaps across two runs.
4. **"Each wrong no triggers re-reads, which is where the 50 to 120 calls come from."** Only
   partly. What multiplies calls is **a no the model cannot answer with new evidence**, whether
   the no was wrong or right.
   - Saturday's 119 calls had only 4 judges. Most were week-to-week presses, because each week's
     read replaced the last (R3) and no read could carry the slot state (R1, R2). The judges were
     right. Then came 13 repeats that got past the guard by changing `timeoutMs` (R6).
   - Follow-store's 73: the judges were right that no row existed.
   - Hubs attempt 2's 39 calls started from an act held in doubt after a robot check, which is
     not this class (fixed, `hubs-attempt-2.md` cause 1).
5. **Several first causes are outside this class** and are not swept in below:
   - hubs cause 1 (act settling);
   - the robot-check stops (mwafor01 and mwaknxf9 0015-0022);
   - priya's draft that never assembles;
   - the auction rerun reset and repeat identity;
   - R6 (the repeat key), R7 (parking on a loop), F5 (hover).

## (a) Each observed failure and the invariant it broke

**The invariants:**

- **I1, one declared result.** The result is the output of the draft's read steps, each page as
  last read at its place under the step's current version. No other read changes it.
- **I2, the result is always stated, and changes are announced.** Every request states the result
  as it stands. Every call that changed it says how, worked out from the result itself, not
  pieced together from notes.
- **I3, identity comes from the site.** List identity (`listKey`) and page place come from the
  page's structure, as the domain declares them. Never from a handle, a digest of the call text,
  or row overlap.
- **I4, rows are what the read kept.** A read's rows are exactly what its conditions kept. What it
  saw and did not keep is left-out, and its account never calls one the other.
- **I5, one answer contract.** The answer's columns are the request's, declared once. Assembly,
  replay, the row store, the chat and the judge all read that one declaration.
- **I6, the judge sees every contributing page whole**: conditions, place, coverage, kept and
  left-out rows, and the answer contract. A size limit summarises in Core's words and says so. It
  never cuts.
- **I7, anything shown can be read.** Every token the page view, search or describe prints about
  an element can be a column. Any element, or group of elements, the model can point to can be
  read as rows by a step that replays.
- **I8, paging is truthful.** "Moved" only when the records changed, "ended" only when the list
  has no next page, and a pager only if it belongs to the list. Coverage in I6 depends on this.

| Run | What went wrong | Invariant | State today |
| --- | --- | --- | --- |
| mwa19obz hubs a2 | Saved Flow stopped at `repeat.no_progress`: a press that met a check was held as may-have-landed | (not this class: act settling) | Fixed, `run-acts/settling.ts` |
| mwa19obz hubs a2 | A short unsorted re-read, then the run's 10 rows appended after it, out of the site's order | I3 (row-overlap rule 5 decided "next page") | Patched: `list-after-read.ts` `holdsEveryRow` |
| mwa19obz hubs a2 | Judge shown page 3 of 45 (the end page) and nothing of pages 1-2 | I6 | Patched: `readPages` with where/place/kept |
| mwaf6gnt hubs a1 | Exploring page-2 read's rejected rows (the "unfiltered" floor) stored as rows and became the result | I4, I1 | Patched: `found-rows.ts` reads `conditions.unfiltered`; the model-facing sentence is still false (`shown-rows/account.ts:55-63`) |
| mwaf6gnt hubs a1 | Page 2 kept 0 rows, so it was never told; two fair "unknown"s | I6 (coverage) | Patched: `kept: 0` pages |
| mwaf6gnt hubs a1 | Replay judged a later empty page "read nothing where it read 10" and stopped the run (1b) | I8 (pass-count check, not page-scoped) | Proposed to t890 |
| mwaf6gnt hubs a2 | Saved next_page failed `page_fault` on a list with no pager | I8 | Proposed (`move-page.ts:63`) |
| mwafor01 towels | A by-hand 4-condition page-2 read became the whole result (5 rows), silently | I1, I2 | Patched: `resultList` notes (I2 only); the switch itself still happens |
| mwaknxf9 towels | Judges wrongly called correct rows sponsored, the model dropped the organic row, and a later judge said **yes** to 15 | I6 (no kept/left-out per card) | Patched: `keptRows`/`leftOut` on `fromCall` reads |
| mwaudvnh towels a3 | A Flow run's pages carried no left-out rows; the judge took organic rows for their ad copies | I6 | Patched: batch `leftOut` (`engine/automation/records/read/left-out.ts`) |
| mwaudvnh towels a3 | The same label was kept and left out, and nothing said they were two cards | I6 | Patched: `sameLabelKept` |
| mwaudvnh towels a3 | Look-only reads with no conditions replaced the right result twice (15, then 27 rows) | I1 | Patched: `held_apart` rule (conditions subset, with a `writeMode: replace` escape) |
| mwb2kkv5 towels | The answer kept `link`. The replayed read's record output was built without the named columns; the sink never knew them | I5 | Patched: sink `askedColumns`, replay `namedColumns`, wiring |
| mwb2kkv5 towels | The judge was not told the request's columns and accepted the extra one | I6 (answer contract absent) | Not done (proposal in `named-columns-answer.md` (c)) |
| mwbk0twg towels (pass) | A Flow run's note said "11 rows, 1 page" when the result held 16, so 14 more browser calls | I2 | **Open**: `runtime/llm/node-tools/run/result-list.ts` |
| mwbkuxqt follow-store | No read could make one element a one-row record | I7 | Landed t903 (`element-record.ts`, Extract List takes `tN`) |
| mwbkuxqt follow-store | Detection would not bind handles from a search or describe | I7 | Open (F2) |
| mwbkuxqt follow-store | Model search cut at 80 characters; judge looks were the page after the read, cut at 600 | I6 (and the whole-page rule) | Search: landed t903. Looks: `call-chain.ts` and `check.ts` landed; **`flow-less/judged-summary.ts:37` still cuts at 600 on Core dev** |
| mwblz4aq priya | Draft never assembled; the refusal was never shown | (not this class) | Write-time refusal, ranking and reporting landed (2d78a6bb2) |
| mwblz4aq priya | Column reader read "columns author, comment and date: ..." as none | I5 | Open (priya fix 4) |
| mwc60eal auction (pass) | A rerun's put-back was refused on a no-reset task; the repeat guard matched a model call to it | (not this class: rerun mechanics) | Fix 31 committed in t885 (4a055aab4), not on dev |
| mwc6ut8u Saturday | No column for a disabled control (R1) | I7 | In flight, t885 uncommitted |
| mwc6ut8u Saturday | The grid reads one row per day, never one per slot with its day (R2) | I7 | In flight, t885 uncommitted |
| mwc6ut8u Saturday | Each re-detection minted a new handle, which made a new dataset, so each week replaced the last (R3) | I3, I1 | Not done anywhere |
| mwc6ut8u Saturday | Pager was the wizard's Next (R4); "moved" on an identical redraw (R5) | I8 | In flight, t885 uncommitted |
| mwc6ut8u Saturday | Judge saw "one read page, 7 rows" and concluded Later was never followed | I6 (follows from I3/I1) | Follows R3 |
| mwc6ut8u Saturday | Repeat refusals did not point to recall; `timeoutMs` evaded the key (R6). The ladder parked the task (R7). The page view folded an error line (S1) | (not this class) | R6/R7 in flight in t885; S1 in flight |

## Second question: why the towels exploration repeated its work (run-mwbk0twg, attempt 1)

**Evidence:** `lab-runs/2026-11-10/run-mwbk0twg-e2493329/steps/0001-0084`, each `decision.json`, the
run results, and the `core.run_flow` values in `0065`, `0069`, `0073` and `0083` `request.txt`.

**What the exploration did.** Steps that reached the browser: 18 replayed, 4 ended, 8 actions,
5 reads or looks and 1 detection, 36 in all. The Lab reported 38; the two counts may treat the
looks after each run differently. The Flow it saved runs 8 browser calls (attempt 2, 0085-0097:
navigate, type, check, select, read, next, read, next) plus its control nodes.

| Span | Browser calls | Decisions | What happened | Class |
| --- | --- | --- | --- | --- |
| 0002-0024, by hand | 9 | 13 (3 describe, 1 format error) | Search, Delivery, sort, detect, read page 1 (12 kept), next, then a stray "page 1" click (0024) the model later dropped | Necessary exploration (plus 1 stray) |
| 0025-0033 | 5 (run from step 9) | 5 (2 format errors, 1 refused `already_so`) | Loop added. The run read page 1 (12) and page 2 (5) and ended: 17 rows, one of them a holder | Necessary: the holder condition could only be learned from the rows |
| 0039-0053 | 0 | 8 | Tried to rerun step 9 with a 4th condition. Refused `answer_first.no_reset` twice (0041, 0046): the rerun's put-back is refused on a no-reset task. Two by-hand reads refused `repeat_refused` with `sameAsCall: rerun.9` (0043, 0048): the guard took a by-hand read for the failed rerun. A write without running (0050), then 3 amends | **Different class**: rerun mechanics and repeat identity (as auction R2). Fix 31 in t885 |
| 0055, run from step 1 | 9 | 1 | **Second search, filter and sort.** "Page 1 is past", and the refusals left no other way back. Page 1 v2 kept 11 (`result_list_replaced` 17→11, true and announced), page 2 kept 5 (carried on, so the result held 16), ended | Consequence of the row above. About 4 calls were needed anyway to re-read page 1 |
| 0065-0082 | 14 | 4 | The run's answer said `resultList: rows 11, pages [{kept 11}]`. `result-list.ts` copies rows and pages from the last pass that *changed* the result, and page 2 only carried it on. The model: "the current 11 rows came from page 1 alone" (0065), "The result list holds only the last page's rows" (0069). It re-read page 2, clicked page 1, pressed next, then ran the whole Flow from step 1 (0073): **the third search, filter and sort** | **Same class (I2)**. All 14 calls and 4 decisions were waste |
| 0083-0084 | 0 | 1 + judge | Completed; 16 rows, judge yes | - |

**The robot check did not cause any of it.** I grepped every file in 0001-0084 for "Robot or
human", "Press and Hold", `person_only` and `verify-human`, and none matched. The sort (0016)
succeeded on its first call. Its self-clearing check costs wall time inside the select (6.0 s
each in run-mwb2kkv5's speed split), never a repeated step. Every repeated sort sits inside a
`core.run_flow` from step 1.

**Ideal path.** About 9 calls by hand, then, after learning the holder condition, back to page 1,
read, next, read, next: about 14 calls, against 36 actual.
- **Overhead:** 36 / 8 = 4.5x against the saved Flow, against about 1.75x ideal.
- **Waste:** this class cost 14 calls and 4 decisions. Rerun mechanics cost about 5 calls (the
  second setup) and 8 decisions.
- **Of the 29 decisions:** 3 provider-format errors, 3 describes, about 10 productive.

## (b) The target model

### 1. The attempt's one result (the ledger)

A new Core object, `AttemptResult`, held by the attempt beside the act record. The row store
(`run_dataset_rows`) stays exactly as it is, as the place the rows live. The ledger decides which
stored rows are the answer.

**What it holds:**

- **The output step.** The last read step in the draft that is not marked `purpose: intermediate`.
  Earlier read steps of other lists are working reads, and the header says so.
- **Each read step's versions.** A version is the step's conditions, fields and list (`listKey`).
  Changing a step's `where` or fields, by `amend_draft` or by replacing the step, opens a new
  version.
- **Pages, per step version, keyed by place.** Each page holds the read call or batch id, the kept
  rows, the left-out rows by condition, the view (where), and the paging verdict that followed it
  (moved, or ended with its reason).
- **Coverage, per version.** The places read, whether the first place was read, and whether an
  `ended` was seen after the last place.
- **The answer contract.** The named columns, in the request's order, read once from
  `automationStudioFlowBootstrapInstructionColumns`, and whether the reader was sure of them.

**How it changes.** There are exactly these operations. No row-count or row-overlap heuristic is
left.

| Event | Effect on the result |
| --- | --- |
| A draft read step runs (by hand with `add`, a rerun, a `core.run_flow` pass, or a saved run's record batch) | Its page at that place, in that version, is set (added, or replaced if the place was read). Place comes from the domain's answer. With no place, it is "next after the version's last place", which replaces the earlier rows-overlap rule 5 |
| A new read step whose `listKey`, conditions and fields equal an existing step's version | The same list. Core records the page against the existing step and tells the model the step is the same list as step N, so a re-detected handle (Saturday R3) never starts a new list. Whether to also fold the duplicate step into the draft is a question for the lead |
| A step's version changes | Pages of the old version leave the result. The change line names them (count, places) and says which places the new version has not read |
| A read step is dropped from the draft | Its pages leave the result, and this is announced |
| A read not in the draft (no `add`) | A **look**. Its rows are stored, shown to the model, and handed to the judge as a whole look. It never changes the result |
| `amend_draft {change: "take", call: <id>}` (new) | Adds an earlier successful read call to the draft as a step, with no new browser act, and records its page. The rows still come from a real read (D9) |
| A later attempt's carry-on (`rows/copied-rows.ts`) | Pages are marked `carried`, never presented as read in this attempt |

**Announced, never silent:**

- **The result header.** Every model request carries a compact, fixed slot, in the same way the
  current view is carried. It holds counts and ids only, never rows (rows come back with
  `core.recall_result`). Template: "Result: step 9 (v2: 4 conditions), 16 rows, columns name,
  price, rating; pages 1 (11), 2 (5); the list ended after page 2 (no next page). Looks not in
  it: call p1.recheck.1 (12 rows)."
  - It is worked out from the ledger on each request. It cannot go stale, which is what fails
    today: `result-list.ts`, and the notes that only fire on a change.
- **The change line.** It goes on the answer of any call or run that changed the ledger, as
  before → after: "result 17 → 11 rows: step 9 is now v2; v1's pages 1 (12) and 2 (5) left the
  result; v2 has read page 1 only."
  - A look's answer always carries one line: "a look: the result is unchanged (step 9, 16 rows)".
    This tells the model directly what mwaudvnh and mwafor01 left it to infer.
- **Completion with an empty result** is refused, naming the looks that hold rows and the one-call
  fix (`take`). It is never auto-promoted.

**What this removes:**

- `rows/result-dataset.ts`: the latest read wins, and the run outranks a read by count, with
  `runRowsRefused`.
- `rows/list-after-read.ts` rules 1-5 and their run-named exceptions.
- `held_apart` and its `writeMode: replace` escape.
- The recorded-read-key matching of a replay to a read.
- `rows/result-change.ts` and `runtime/llm/node-tools/run/result-list.ts`. They are replaced by
  the header and change line.
- `dataset-of-read.ts`'s digest as the list identity. Datasets become `step.<draftStepId>.v<n>`,
  which also keeps the store's "schema never changes within a run" contract.

**Why the draft is the right anchor:**

1. **Every replacing read in the evidence was a look.** Checked in the step logs: mwaudvnh 0201,
   0211, 0219 and 0250, and mwafor01 0093, each had no `add`.
2. **The answer and the saved Flow can no longer drift**, because the answer is what the Flow's
   steps read. That covers the named-columns drift, the replay record-output drift, and a
   Flow-run batch against a by-hand read.
3. **A draft exists even when it does not assemble**, so the answer-first pivot (a result whether
   or not the Flow works) is kept.

### 2. What the judge always receives

The flow-less summary is built from the ledger (`completion/check.ts` `summaryOf`), with these
parts:

- **`result`**, one entry per contributing page of the output step's current version, in place
  order:
  - step and version;
  - the version's conditions, in Core's generic words built from the `where` items (the column
    label, the comparison and the value), never a site's words;
  - where (the view) and place;
  - `keptRows`, whole;
  - `leftOut`, whole, grouped by condition, with `sameLabelKept`;
  - `carried`, where it applies.
- **`coverage`**: the first place read or not, and the last verdict ("ended: no next page
  (control_absent)" or "moved, not read further"). It is stated as a fact for the judge to weigh,
  never as "complete".
- **`answerContract`**: the named columns, with one generic sentence: "a column the request does
  not name was not asked for, unless it is a named one under another name". It is omitted when
  the reader is unsure (priya).
- **`working`**: earlier intermediate steps, summarised as step, list and kept count, for context.
- **`looks`**: every distinct look after the first lasting act, whole, as `call-chain.ts`
  `lookOf` now hands them on, plus looks before it for read-only tasks.
- **Unchanged parts**: `acts`, the witnesses before and after (judge the change), `endView`, and
  `answerText`.
- **No fixed cuts.** Remove `judged-summary.ts`'s 600/300 cuts, and `read-pages-shown.ts`'s 40-read,
  300, 200 and 80-character cuts. When the request does not fit the window, `window-fitting.ts`
  already summarises item by item, in Core's words, and names what it summarised. That matches
  the user's "DO NOT HIDE INFORMATION" rule, which that file quotes.

### 3. Any value the model can point to becomes a row and a replayable step

- **One read surface for every handle.**
  - **One element** (`tN`) is a one-row record. This landed in t903.
  - **A detected list** (`extraction.N`) is one row per item.
  - **A cell run** is one row per same-template control across groups, with the group's heading
    as a column (R2).
  - All three bind through the same target store presses use, so any handle the model was shown
    (page view, search, describe) binds (F2). Each saves as a draft step with the element's full
    fingerprint, which is already a standing rule.
- **The vocabulary invariant (I7), enforced by a test, not by guidance.** Every state or attribute
  token the page view prints for an element must have a matching read field, in a domain table
  test:
  - `disabled` (aria and native, R1), `pressed`, `checked`, `selected`, `expanded`;
  - `value`, `href`, text, and `data-*`.

  A new page-view token without a read field fails the build. This closes the class instead of
  the next instance, as the user asked ("enforce standards mechanically").
- **A look's value is one call from the result.** When the model has seen a value only in a look,
  the refusal and the header name `take`. If the look was a read, `take` makes it a draft step.
  If it was a search or describe, the next call is a `tN` read of that handle.

### 4. Exploration overhead number for the Lab report

Per attempt, in `attempt-report.txt` and the debug notes' per-attempt table:

- **live browser calls**: step folders that reached the domain;
- **Flow browser calls**: from the first deterministic replay, non-control nodes;
- **overhead**: their ratio, for example "36 / 8 = 4.5x";
- **repeated calls**: browser calls whose node, target identity, parameters (without replay
  words) and place already occurred in the attempt;
- **whole-Flow runs from step 1**;
- **decisions by kind**: describe, provider-format error, refused, look, step.

It is computed from the step logs alone, so it needs no model call and can run on old runs.

## (c) What it subsumes, and what happens to each in-flight fix

**Landed patches** (Core dev 9654df2a3 unless noted):

| Patch | Fate |
| --- | --- |
| `found-rows.ts` unfiltered = no rows (1a) | Kept as the I4 guard. Its model-facing half (`domain/.../shown-rows/account.ts:55-63` still says "all N kept rows") is fixed in phase 1 |
| `kept: 0` empty pages (1c), `list-after-read.ts` passing them by | Subsumed: a page with 0 kept is a normal ledger page and counts toward coverage |
| `list-after-read.ts` rules 1-5, `holdsEveryRow` (hubs cause 2) | Replaced by keying on place and version |
| `result-dataset.ts` (latest read, run precedence, `runRowsRefused`) | Replaced by the output step |
| `held_apart` / `result_list_kept` (mwaudvnh) | Replaced: a look never changes the result; a version change is explicit |
| `result-change.ts` notes; `run/result-list.ts` run note | Replaced by the header and change line. Phase 0 patches `result-list.ts` meanwhile |
| Recorded-read key, replay = the read it replays (mwb9b59w) | Subsumed: keyed by draft step id |
| Named columns in the sink (`askedColumns`), replay `namedColumns`, wiring | Kept as logic, re-homed: one answer contract on the ledger feeds sink, replay and assembly |
| Repeat row-field lowering (forward-run-same-list) | Kept (Flow assembly) |
| Batch `leftOut`, `location` (`engine/automation/records/read/*`) | Kept: it is how a saved run's pages carry I6 data into the ledger |
| `sameLabelKept`, `keptRows`/`leftOut` rendering | Kept (judge rendering) |
| `readPages` (where, place, kept) | Kept as data, built from ledger pages |
| `call-chain.ts` whole looks (F3), `check.ts` cuts removed | Kept. The missing third piece (`judged-summary.ts`) is phase 0 |
| t903 element record (F1), whole search words (F4a) | Kept: part of I7 |
| `run-acts/settling.ts`, robot-check pause and look signal | Not this class; untouched |

**In-flight fixes:**

- **Saturday:**
  - **R1** (disabled column) and **R2** (cell run): **keep and land first.** They are I7
    instances. R1's case becomes a row of the vocabulary table test.
  - **R3:** **replaced in its Core half.** Do not change `dataset-of-read.ts` to `listKey`, since
    the ledger keys by step. **Keep its domain half and move it earlier**: `listKey` emitted by
    detection and the read answer, which phase 2 consumes for "a new step on the same list".
  - **R4** and **R5:** keep. They are I8, and coverage depends on them.
  - **R6a/R6b:** keep, independent.
  - **R7:** keep, independent. It still needs the user's confirmation, since it reverses D14
    step 4.
  - **S1:** keep, independent.
  - **Order: R1, R2, R4, R5, S1** (extension, as uncommitted in t885) **then R6, R7**. R3's domain
    half goes into phase 1.
- **Follow-store:**
  - F1, F3 and F4a: landed.
  - F4b: phase 0 (the remaining 600-character cut).
  - F2 (detection binds through the target store): keep, phase 1.
  - F5 (hover): outside this design. Trusted input conflicts with the no-debugger rule, so it
    needs the user's decision.
- **Priya:**
  - Fixes 1, 5 and 6 landed.
  - **Fix 4** (column reader at the colon): keep, and **move into phase 2** as the answer
    contract's reader test.
  - Fixes 2 and 3 (guidance on `most` and while-endings): keep, independent. Their landing state
    was not checked.
  - **Fix 7** (assemble when the judge says yes, while the evidence is in view): **reorder after
    phase 2.** With the result tied to draft steps, assembling at a yes checks that the result is
    replayable, which is I7's second half.
- **Rerun and repeat identity:**
  - Fix 31 (t885 4a055aab4): keep, and land on dev.
  - The repeat-guard identity proposal (a model call matched to `rerun.N`): keep. It cost
    run-mwbk0twg 8 decisions and a setup run.

## (d) Build phases

Every test below is provider-free, and each must fail with its change reverted. Follow the
repository's validation rules: narrow checks per merge, and full suites only in the twice-daily
sweep.

**Phase 0 (Core, small, now):** stop the two live contradictions.

- `Core/runtime/result-verification/flow-less/judged-summary.ts`: remove `FOUND_CHARS`,
  `WHERE_CHARS` and `cut`.
- `Core/runtime/result-verification/flow-less/read-pages-shown.ts`: remove `READS_SHOWN` and the
  200/300/80-character cuts.
- Rely on `window-fitting.ts` for size.
- Tests in `flow-less/tests/`:
  - a 2,000-character look and a 300-character left-out label reach `sent` whole;
  - an oversize summary is summarised with `summarised` naming the items;
  - update the `judged-summary.json` snapshot.
- `Core/runtime/llm/node-tools/run/result-list.ts`: the run's note states the result as the sink
  holds it after the run, not the last pass's note. `flow-part.ts` passes the sink's summary.
  - Test in `run/tests/result-list.test.ts`: pass 1 replaces (11), pass 2 carries on (+5), so the
    note says 16 rows over 2 pages.
- Proof: the scripted towels attempt (`pnpm lab attempt bigbox-retail --task
  bigbox-retail-rated-delivery-towels --authoring-mode answer-first --scripted-model --attempts
  4`). Check the run note in `request.txt`.

**Phase 1 (domain and extension, parallel with phase 0):** identity, paging truth, capture.

- **Extension** (t885 uncommitted, land as is): R1, R2, R4, R5 in
  `apps/extension/src/content/extraction/**`, with their tests as traced. Fixtures stay generic
  (cinema seats, a timetable).
- **Domain `listKey`** (R3's domain half):
  - `domain/src/runtime/llm-evidence/structure/handles.ts`: a digest of the binding's item
    selector, container and frame path.
  - Carried on the list read's answer (`node-run/list-read/`), and on a saved read's answer so
    Core's record batch carries it (`engine/automation/records/read/` reads it beside `location`).
  - Test in `structure/tests/handles.test.ts`: two detections of one redrawn run give one key, and
    two different runs give two.
- **Domain place:** each list read's answer names its place (page number, offset or cursor) where
  the pager says so.
  - Test: the place appears for numbered, next-link and load-more paging.
- **Domain F2:** detection binds `target` through `targetPackets`
  (`llm-evidence/tools.ts`, `structure/detect.ts`).
  - Test: a handle from a search binds.
  - Test: a detection whose list does not contain the target names no target.
- **Domain I4 wording:** `node-run/shown-rows/account.ts` says an unfiltered answer's rows are the
  rejected ones. A decision for the lead: send exploring reads with `answer: "kept"` and drop the
  floor.
- **Domain I7 table test** (new, in `domain/src/runtime/llm-evidence/page-view/tests/`): every
  state or attribute token the page-view element printer can emit maps to a read field spec.
- **Proof:** the scripted Saturday honest path (detect cells, read with `where` on the disabled
  column, Later, repeat) reaches its oracle. Content harness specs for R1, R2 and R4 on the
  company-website scenario only.

**Phase 2 (Core, after phase 1's `listKey`):** the ledger.

- **New directory `af/result/`.** `rows/` is at the 25-file limit.
  - `ledger.ts`: state and operations.
  - `version.ts`: a step's version from its call.
  - `header.ts`: the always-present statement.
  - `change-line.ts`.
  - `answer-contract.ts`: named columns, folding in priya fix 4 at
    `runtime/flow-authoring/bootstrap/answerability/instruction-columns.ts`.
  - `index.ts`.
- **Wiring:**
  - `af/attempt/call-chain.ts`: a draft read step records a page; a look records a look.
  - `af/flow-run/flow-run.ts`: `onRecordBatch` records a page against the node's draft step.
  - Draft amendments notify the ledger, through answer-first's draft port.
  - `af/attempt/run-attempt.ts` builds it.
  - The header goes into the decision context's fixed slot. `resultHolds` in
    `af/completion/refused-words.ts` reads the header.
  - `af/attempt/ending.ts` and `keep.ts` read back the output step.
  - New `amend_draft` change `take`: `runtime/flow-authoring/draft/amendment/schema.ts`, `apply.ts`,
    and `runtime/llm/decision-handlers/amendment.ts`.
- **Then delete:**
  - `rows/result-dataset.ts`;
  - `list-after-read.ts`'s rules;
  - `held_apart`;
  - `rows/result-change.ts`;
  - `run/result-list.ts`;
  - the recorded-read-key matching in `row-sink.ts`.

  `row-sink.ts` shrinks to "store a page's rows under its step-version dataset".
- **Tests:**
  - `af/result/tests/ledger.test.ts`: one case per operation row in (b)1.
  - Port every existing `rows/tests/*` case. List each case whose expectation changes in the
    phase report.
  - Real-service scripted-model tests, as in `af/tests/latest-read.test.ts` with real SQL, one per
    evidence run's shape:
    - **mwafor01:** a by-hand 4-condition page-2 read without `add` leaves the run's 17 and says
      "a look".
    - **mwaudvnh:** look reads with no conditions leave 16.
    - **mwa19obz:** a short re-read, then a whole run, gives the run's place order.
    - **mwbk0twg:** a run from step 1 with v2 gives a header of 16 rows over 2 pages after the
      run.
    - **Saturday:** three weeks read under three handles with one `listKey` give 3 pages.
    - **mwb2kkv5:** no `link` in the answer.
- **Proof:** scripted Lab `--attempts 4` on towels and on hubs. The hubs script's attempt-2 limit
  noted in `hubs-attempt-2.md` must be fixed in `packages/test-runner` first. Also scripted
  Saturday after phase 1. Each attempt's `request.txt` must show the header.

**Phase 3 (Core result-verification, after phase 2):** the judge bundle from the ledger.

- Files:
  - `Core/runtime/result-verification/flow-less/{types,judged-summary,question,read-pages-shown}.ts`
    (rename the last to `result-pages-shown.ts`);
  - `af/completion/check.ts` `summaryOf`.
- Add `coverage`, `answerContract`, `working` and `carried`, with one generic sentence each in
  `question.ts`.
- Extend the existing `flow-less/tests/judge.test.ts` word guard to the new sentences, so no
  scenario word can appear.
- **Tests:**
  - coverage ended or not;
  - the contract is present, and absent when the reader is unsure;
  - carried pages are marked;
  - left-out rows are whole.
- **Phase 3b** (the lead's call): give the finished-run judge
  (`result-verification/request-rows/**`) the same page shape, so the two judges read one
  evidence model.
- **Proof:** scripted attempts, with the judge requests containing the bundle (by grep of
  `request.txt`).

**Phase 4 (Lab, `packages/test-runner`, parallel with any phase):** the overhead number.

- Files: `src/attempt-lane/report.ts`, `src/attempt-lane/live/result-line.ts`,
  `src/attempt-lane/live/unscored-attempt-evidence.ts`.
- Compute (b)4 from the run's `steps/` folders.
- Test in `src/attempt-lane/tests/`: a synthetic step index shaped like towels attempt 1 gives
  36 / 8, two runs from step 1, and the repeated-call count.
- **Proof:** run the reader over the kept run-mwbk0twg and run-mwc6ut8u step folders, which reads
  files only.

**Live check after phases 0-3:** one `--attempts 4` run each of towels (Haiku), hubs, follow-store
and Saturday, under the normal guards. Compare calls, overhead and verdicts against the debug
notes above.

## (e) Risks

- **Whole-page views rule.** The header adds a fixed item to every request. It holds counts and ids
  only, and rows stay a recall away. The judge bundle grows, with whole left-out rows. The
  user's rule forbids cutting, so size is handled only by `window-fitting.ts`, which summarises
  in Core's words and names what it summarised. Expect more tokens per judge and fewer judges;
  measure both in phase 4.
- **Judge the change, not the absolute state.** The ledger is per attempt. Pages carried from an
  earlier attempt are marked `carried` and never presented as read now. Act tasks keep the
  before and after witnesses. Coverage is reported as a fact, never as "complete", so the judge
  still decides.
- **Never teach to the test.** Every new sentence (header, change line, coverage, contract,
  `take`) is generic and covered by the judge word guard. Tests use non-scenario fixtures.
  Realistic scenarios appear only in Lab proofs.
- **Model burden.** The result now requires the answer read to be a draft step.
  - A model that completes on looks only is refused, with `take` named. Watch for a new loop:
    check the refusal's wording in scripted runs before live.
  - A model that adds a look as a step puts an extra read in the Flow. Earlier reads of other
    lists are reported as intermediate, which the model can change.
- **The answer-first pivot.** The ledger keys on draft steps, not the assembled Flow, so a draft
  that does not assemble still has a result. Phase 2 must test that case explicitly (priya's
  shape).
- **Migration regressions.** Each deleted `row-sink.ts` rule exists because of a run. Porting every
  `rows/tests` case before deleting, and listing each changed expectation, is the guard. Some
  expectations will change on purpose: a by-hand read without `add` no longer becomes the result.
- **Paging truth gates coverage.** Until R4 and R5 land, "ended" can be false (Saturday 109,
  "moved" on week 3). The judge must see the ended *reason*, not a bare flag.
- **Two judges.** The finished-run judge keeps its own evidence shape until phase 3b. A saved
  Flow's judged run and an attempt's judge could disagree on the same rows.
- **Answers built from several lists** (a join) are not designed here. The output step is one
  list. `recordSets` stays plural for a later extension.
- **Structure budgets.** `rows/` is at 25 files. The new `af/result/` keeps paths within the depth
  limit (af + 1 segment).
- **R7 still needs the user.** It is independent of this design but appears in the same runs.

## What changed and why

Wrote this report only. No source, test, working document, worktree or git state was touched.

## Commands run and observed results

- Read the 11 debug notes in `t885/docs/working/language-driven-flow-loop-plan/debugs/` (315
  lines), and the seven named traces in `t885/docs/working/mvp-seal-plan/reports/live-checks-r3/`.
- Read the Outcome sections of these landed-fix reports: `result-list-switch*`,
  `result-keeps-conditioned-rows`, `flow-run-left-out`, `judge-read-pages*`, `judge-whole-looks`,
  `dropped-organic-row`, `forward-run-same-list`, `named-columns-wiring`, `replay-named-columns`,
  `r6-r7-recall-and-question`, `saturday-extension-causes`, `priya-not-assembled`, and
  `rerun-reset-and-repeat-identity`.
- Current State of `first-class-data-extraction-plan.md` and `framework-heavy-lifting-plan.md`.
  Neither plans a result model: the first defines collect-then-process per read dataset, which
  this keeps; the second's t841 "filtered-out rows carry measured evidence" is what `leftOut`
  builds on.
- **Core code read** (dev 9654df2a3):
  - `rows/row-sink.ts` (header), `rows/dataset-of-read.ts`, `rows/result-dataset.ts`,
    `rows/list-after-read.ts` (head), `rows/result-change.ts` (head);
  - `attempt/call-chain.ts` (head);
  - `runtime/llm/node-tools/run/result-list.ts`;
  - `flow-less/question.ts`, `judged-summary.ts` (bounds), `read-pages-shown.ts` (bounds),
    `window-fitting.ts` (head).
- `grep` for `FOUND_CHARS`, `cut(` and `LOOKS_SHOWN` showed:
  - `judged-summary.ts:37` `FOUND_CHARS = 600`;
  - `read-pages-shown.ts:35-38`: 40 reads, and 300/80/200 characters.
- `git log dev..HEAD` in t885 Core showed only fix 31 (4a055aab4) plus a merge.
  - `git status` there showed R6/R7 files uncommitted.
  - t885 extension status showed R1/R2/R4/R5/S1 files uncommitted.
  - `dataset-of-read.ts` has no `listKey`, on dev or in t885: R3 has not landed.
- Domain dev: `page-find/search.ts` says "Nothing a match prints is cut (t903)", and
  `plan-resolution/extraction/element-record.ts` exists (F1 landed).
- **Towels run, `lab-runs/2026-11-10/run-mwbk0twg-e2493329/steps`:**
  - `index.md` rows 0001-0084 by kind: 18 replayed, 8 actions, 5 inspects, 4 ended,
    3 describe, 2 no_reset, 1 detection, 1 written;
  - every `decision.json` summary in 0003-0083;
  - pass results 0034-0081 (`resultList` at 0060: rows 11, replaced 17);
  - the `run.flow.fromstart.1`, `run.flow.10` and `run.flow.all.1` values in `0065`, `0069`,
    `0073` and `0083` `request.txt`;
  - `0043` `sameAsCall: rerun.9`; `0041` `answer_first.no_reset`; judge 0084 `totalRecordCount:
    16`.
  - A grep of 0001-0084 for "robot or human", "press and hold", `person_only` and `verify-human`
    returned nothing.
- **mwaudvnh** `0201`, `0211`, `0219` and `0250` `decision.json`: `add` is absent on all four
  replacing reads. **mwafor01** `0093`: `add` is absent.

## Not verified

- No design element was prototyped. The claim that "the draft's read steps" covers every task
  shape rests on the runs above and on priya's shape. It was not checked across all 40 breadth
  tasks.
- The Lab's 38 live steps against my 36: not reconciled. I did not read the Lab's counter.
- Saturday's reads: I did not check whether they carried `add`. If each re-detected read was
  added as a new step, the ledger needs `listKey` (phase 1) to keep weeks together. The design
  assumes that.
- Where the decision context's fixed slot is built (the analogue of
  `decision-context/current-view.ts`): named from the Saturday trace, not opened.
- Priya fixes 2 and 3 (guidance wording): landing state not checked.
- Whether exploring reads should drop the unfiltered floor (phase 1 I4): left as the lead's
  decision, as `paged-reads-and-next-page.md` did.

## Open questions or contradictions found

1. **Live contradiction on Core dev.** `flow-less/question.ts` tells the judge that looks are
   "whole", but `flow-less/judged-summary.ts:37` still cuts each look to 600 characters.
   `judge-whole-looks.md` said "Land both changes in one unit". Only one landed. Phase 0 fixes it.
2. **`run/result-list.ts` misstates the result after any Flow run whose later passes carry the list
   on.** It cost run-mwbk0twg 14 browser calls and its third setup. It affects every multi-page
   Flow run. Phase 0 patches it before the ledger replaces it.
3. **"Look versus step" is a product decision.** Is the result only the draft's read steps (this
   design), or should a by-hand read without `add` still be able to become the result with an
   announcement? The evidence favours steps, since every replacing read was a look. The lead
   should confirm, because it changes what a model must do to finish.
4. **Should a new draft step on a list an existing step reads fold into that step?** (b)1 records
   pages against the existing step. Whether the draft also drops the duplicate is the lead's call.
5. **R7** still reverses answer-first D14 step 4 and needs the user's word.
