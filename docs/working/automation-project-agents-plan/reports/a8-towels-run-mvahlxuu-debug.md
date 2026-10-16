# A8 frozen pair 7, candidate towels `run-mvahlxuu-760d9e28`: a false yes in the build

Read-only debug. Downstream `813a3340`, Core `917ca845` (lane `fxwork/t567`, both trees clean
per `run.json`). Task `bigbox-retail-pickup-towels`, mode `candidate`, $0.123.

## Outcome

**Cause: general, in Core's result verification.** The trial stored the oracle's 9 rows plus
one extra row, "Loftwell Countertop Paper Towel Holder, Bamboo". This is a paper towel
holder, not a pack of paper towels. Two things let it through:

- **No check on the rows a yes keeps.** Every gate on a yes (t515 quotes, t574 and later
  settled rows, `leftOutNamingTheItem`) is about rows a condition *left out*. Nothing Core
  measures or requires is about the rows a read *kept*. A kept row that is not the item
  asked for passes all of Core's gates, so only the judges' prose can catch it.
- **The re-ask steered toward yes.** The first two judge calls (0037, 0038) said no, which
  was the right verdict, but for a wrong reason: they wanted "Pickup tomorrow" rows added.
  Core correctly refuted every reason they gave (t607 and t629). The t607 re-ask then asked
  both calls again. The recheck text names only left-out rows, and nothing points the judge
  at the kept rows. Both re-asked calls (0039, 0040) said yes at confidence 0.9. 0039 even
  claimed every kept row was "a ValueRidge-sold paper towel pack".

Core never turned a no into a yes itself. But a no that was right for an unstated reason
became a yes once its stated reasons were refuted. Without any check on kept rows, nothing
stood in the way.

Three side findings:

- **Playback judges were right.** They saw the same evidence (only the node ids differ, and
  `startView` is absent), and both named the holder (0050, 0051). The run was refuted and
  the oracle failed on records.
- **t662's hold did not fire, but by its own rule it should have.** The playback stored the
  very rows the trial judged yes twice. Had it fired, it would have kept two correct nos
  from counting. Why it did not fire cannot be told from the artifacts (see Not verified).
- **The retailer clause holds only by coincidence.** The request's "ValueRidge sells itself
  rather than a marketplace seller" has no condition and no filter behind it. It holds only
  because every marketplace listing in this fixture is ship-only, so the "Pickup today"
  condition happens to drop them.

## What changed and why

Nothing changed. This was a read-only debug. The only file written is this report.

### 1. Stored rows against the oracle

| | Trial `trial.88496ae4…` (0036) | Playback (0042-0049) | Oracle (`PICKUP_TOWEL_RECORDS`) |
| --- | --- | --- | --- |
| Rows | 10 | 10, byte-identical to the trial (judge payload `recordSets` differ only in node ids) | 9 |
| Extra | "Loftwell Countertop Paper Towel Holder, Bamboo" ($12.97, 4.6, **no unitPrice**), at position 9 | same | - |
| Missing | none | none | - |

- The Lab compare gives `matchedInAnyOrder 9`, `matchedRecords 8` and `presentFields 35/36`.
  The holder pushes "Hearthside Select-A-Size …, 8 Double Rolls" from 9th to 10th place, and
  in 9th place the holder has no `unitPrice`. That one row is the only defect.
- The Flow's read (s6) had three conditions: `sponsored is absent`, `pickup contains
  ["Pickup today"]` and `rating atLeast 4.5`. It used no Department or Retailer facet.
  - The holder ("Paper Towel Holders" department, seller VR, pickup today, 4.6) passes all
    three conditions.
  - The oracle's selector leaves it out only through the recording's Department facet.
- The two "Pickup tomorrow" traps (Softerra 8 Triple, Northmere 12) were left out correctly
  by the text condition.
- Marketplace rows (seller ≠ VR) are all `shippedOnly` in `catalog/paper-towels.ts`, so the
  pickup condition drops them. The read also reads a `retailer` field from the
  `data-item-id` attribute, which is an item id, not a seller. No condition uses it and it
  is not stored.

### 2. Why the build's judges said yes on wrong rows

All four trial calls ran on deepseek-flash, temperature 0, with about 27k input tokens.

**What every call saw.** The fields below were the same in all four calls (0039 shown):

- `recordSets[0].sampleRows`: all 10 rows. The holder row has no `unitPrice` key.
  - `rowsMissingRequired: 0`, because the model authored every field `required: false`
    (`result-summary.ts` `requiredValueCheck` counts only `required: true`).
- `reads[0].conditions`, one entry per condition:
  - **Condition 1 (sponsored).** It alone left out 6 rows. All 6 are in `leftOutSettled`
    and all 6 are in `leftOutAlsoInResult`.
  - **Condition 2 (pickup).** It alone left out 12 rows. All 12 are settled with a witness
    value ("Pickup tomorrow" or "Shipping, arrives …").
  - **Condition 3 (rating).** It alone left out 4 rows. All 4 are settled with values
    4.1-4.4. Two of those are themselves holders or dispensers.
- `leftOutTogether` groups and `narrowedBefore`: two steps, both with `resultCount` 32 → 32.
- Paging: 3 pages read, the list `ended`.

Nothing in the payload is about a kept row: no kind, no column coverage, no label check.
The holder shows up only as one entry of `sampleRows` and in the page views.

**0037 and 0038 (no, wrong reason).** Both said condition 2 was too narrow, because
"Pickup tomorrow" rows "may still qualify". 0037 also said the sponsored condition drops
qualifying packs. Neither call mentioned the holder.

**Core's weighing (`agreement.ts`, `refuted-no/`).** Core wholly refuted both readings.
Every row they called missing was settled on a measured witness that fails "Pickup today".
The t629 request-text test applies, since "pickup today" runs in the request. The
sponsored rows are `leftOutAlsoInResult`.

- These refutations are correct: Core refuted only what it measured.
- `refutedMark` marked both calls. `automationStudioResultReaskRefutedNo` asked each call
  once more with `refuted-no/recheck-words.ts`.
  - The recheck says the earlier no's reasons were contradicted and lists the seven settled
    pickup rows.
  - It ends with "If you answer no, say … each row that is wrong or missing and why".
  - It says nothing about the kept rows.

**0039 and 0040 (yes).** Both quoted the request once per condition, which the settled
rows require. Both concluded "no requested item is missing" and "the result matches the
request".

- Their yes is a completeness argument. Core's gates check exactly that, and it is true.
- On precision (the kept rows) neither call looked. 0039 asserted every kept row is a
  ValueRidge-sold paper towel pack, which no condition proves and which is false for the
  holder.
- `verdict.ts` took both yeses. It has nothing to hold them on: no left-out row was
  unquoted, and `leftOutNamingTheItem` was empty.
- Two yeses gave `candidate.trial_yes`, and the build completed at 0041.

**Did Core's machinery make the wrong yes easier?**

- **On left-out rows: no weakening.** Every settled row and every also-in-result row is a
  measured fact, and each is correct here. They made a yes cheaper to write, but only on
  the side where the yes was true.
- **The gap: a yes proves nothing about kept rows.** t652-t661 made the left-out side
  tighter and cheaper. That made it more obvious that a yes only has to argue
  completeness. The same evidence shown without a recheck (the playback) got two correct
  nos naming the holder.
- **What the re-ask changed.** It changed what the judge attended to:
  - It told them their no's reasons were wrong.
  - It listed only left-out facts.
  - It asked them to "answer again".

  It did not weaken a gate, but it moved a correct verdict to an incorrect one, and no
  kept-row check stood behind it.
- **t629 and t660.** These made the pickup refutation possible. Their logic is right. They
  are not the defect.
- **Two measured signals Core held but never surfaced:**
  - The holder is the only kept row without a value in an asked column (`unitPrice`).
    `process.columns` lists the request's four columns, and 9 of 10 kept rows carry all
    four.
  - The holder is the only kept row whose label lacks the phrase every other kept row
    names, which is also the request's own words: "Paper Towels". Its label says "Paper
    Towel Holder".

### 3. t662's playback hold

**Conditions in `build-yes-hold/held-double-no.ts`:**

- The playback result check ended in two agreeing nos (basis `model`; `judge … verdict=no`
  is not logged for playback, but `resultVerification: "refuted"` and `resultRepair` ran).
- The trial `trial.88496ae4…` was judged yes with 4 calls (`judgeCalls: 4`).
- Same request, and the stored rows are byte-identical by content.

By its rule, the hold should have recorded the playback as `core.result.build_yes_disagrees`
(unverified, no repair). **It did not fire.** The run was refuted and the re-author was
attempted, which ended `flow_bootstrap.evidence_budget_exhausted`.

**Why it did not fire is not recorded anywhere I can read.**

- `core.log` has no line for it, the outcome carries no field, and the Lab instance's store
  is gone.
- The likeliest cause, from the code but unverified, is `automationStudioRanJudgedVersions`:
  - The parent's revision is recorded `null` at apply.
  - It "matches only `null` against `null`".
  - Its chain "starts only when its graph is first viewed or patched".
  - The Lab reads `authoredGraph` for `flow-lane.json` between apply and playback.
- Other possible causes: the instruction digest, or the trial's datasets not being
  readable by `readRecordSets`.

**This time it mattered in the right direction.** Had the hold fired, a wrong Flow would
have been left "unverified" instead of refuted and repaired. Two correct nos that named a
measured row would have been set aside for two yeses that never looked at kept rows. The
brief's premise ("different rows from the oracle?") does not apply: the hold compares the
playback with the trial, never with an oracle, and those rows were identical. So the hold
is unsafe whenever the build's yes is the false one. It needs the guard in fix 3.

### 4. General or task-specific

**General.**

- **In both modes.** `verdict.ts`, `agreement.ts` and `refuted-no/` serve the candidate
  trial, the evidence-loop draft trial and the playback check alike.
- **For any list task.** A kept row that passes every authored condition but is not the
  item asked for gets through on the judges' attention alone. Examples:
  - an accessory among items;
  - an item in a sibling category the site's own facet would have removed;
  - a different kind of record that happens to match the search words.
- **The trap only triggers it.** The task-specific part is the trigger: holders whose names
  share the search words, and a Department facet the Flow did not use. The holder has
  appeared in every towels run since pair 4 (`mva6mlo8`, `mvac0nmw`). Builders sometimes
  add a name condition and sometimes do not, so the safety net has to be Core's.
- **The re-ask is general too.** Any wrong-reason no on a wrong result can become a yes.

## Proposed structural fixes, by owning module

None of these weakens what a yes must prove. Each adds a requirement or keeps a no from
being set aside. Core holds only on what it measured, never caps output, and the test
fixtures are a library and a hardware store, never this site.

**Fix 1 (primary, general): a kept row without a value in an asked column must be named by
a yes.**

- **Owners:**
  - `result-verification/request-rows/` gets a new `kept-without-asked-column.ts` and a
    `summary-with-kept-without-asked-column.ts`, mirroring
    `summary-with-left-out-naming-the-item.ts`.
  - `contracts/run-result-summary.ts` gets the field.
  - `verdict.ts` gets the hold, mirroring `automationStudioResultLeftOutRowsUnaccounted`.
  - `llm/diagnosis-instructions.ts` gets one sentence.
- **Measure:**
  - Take each record set whose `process.columns` (the answer's columns) are known.
  - Find the stored rows that lack a value (`carriesValue` false) in one of those columns.
  - Flag them only when the rest of that set carries the column on most rows, so a column
    empty on every row (a broken read) stays with `read-account/emptied-columns.ts`.
  - Each flagged row goes on the judge's copy as `keptWithoutAskedColumn: [{datasetId,
    column, rows}]`.
- **Rule:** a yes must name each flagged row (`row-naming.ts`) in a sentence that quotes
  the request's words naming what it asks for, which the row is. A yes that does not is
  held (`exclusion_evidence_missing`, like t611 and t636), never refuted. A no is unaffected.
- **Test:** new `request-rows/tests/kept-without-asked-column.test.ts`, run on a library
  request "every hardcover atlas … columns title, pages, isbn":
  1. The stored rows include "Atlas Bookmark Set" with no `pages`, and the yes does not
     name it. Result: held.
  2. The same yes naming the bookmark set with a quote. Result: taken. Whether the claim
     is right is the judges' call, but the row has been looked at.
  3. Every row carries every column. Result: nothing flagged.
  4. A column empty on every row. Result: not flagged here.

**Fix 1b (general, secondary): a kept row missing the request's item phrase that every
other kept row names.**

- **Owner:** `request-rows/` (`request-phrases.ts`, new `kept-not-naming-the-item.ts`).
- **Measure:** a phrase of the request (`automationStudioRequestPhrases`) that all kept rows
  but at most a few name in their labels, and the rows that do not.
  - Today's item-phrase detection requires *every* kept row to name it. The very row to be
    flagged defeats that, so `leftOutNamingTheItem` has no item phrase here.
- **Rule:** the same as fix 1, a named row is required for a yes.
- **Test:** new `request-rows/tests/kept-not-naming-the-item.test.ts`, on a hardware request
  "every pack of wood screws". With 9 kept "… Wood Screws, …" rows and one "Wood Screw
  Organizer Case", the organizer is flagged. When all rows name it, nothing is flagged.

**Fix 2 (general): a refuted no's re-ask says that Core's record covers only the rows it
names.**

- **Owner:** `refuted-no/recheck-words.ts`, and `reask.ts` to pass the summary's kept-row
  flags from fix 1 and 1b.
- **Change:** after the findings, the recheck adds "Core's record above speaks only of the
  rows it names; it says nothing of the rows the result kept, which the request must ask
  for too". When fix 1 or 1b flagged rows, it names them.
  - This is wording only, and generic. It never instructs a verdict.
  - The mechanical part is fix 1, which applies to the re-asked yes as to any yes.
- **Test:** extend `refuted-no/tests/` (the reask test). The recheck for a summary with a
  flagged kept row names that row's label. Without flags, the extra sentence is still
  there and no label appears.

**Fix 3 (general, safety of t660/t662): the playback hold never sets aside a no that the
record does not contradict.**

- **Owner:** `build-yes-hold/held-double-no.ts`, which needs the playback outcome's weighing
  (`recordContradicts` on `unconfirmedReading`, or `agreement.ts` `weighedNos`) passed
  through `run-outcome.ts`.
- **Rule:** hold only where Core's record contradicts at least part of each no's reading.
  - This is the motivating `mvac1av6` case, where the nos blamed a step Core measured as
    removing no row.
  - Never hold where both readings stand whole.
  - Never hold where a reading names a stored row that fix 1 or 1b flagged.
- **Test:** extend `build-yes-hold/tests/held-double-no.test.ts`:
  1. Same rows, a trial yes with 2 calls, playback nos naming a stored row as not the item
     asked for, nothing refuted. Result: not held.
  2. The t660 case, where the nos blame a step whose `resultCount` before equals after.
     Result: still held.

**Fix 4 (general, observability): the hold says why it did or did not fire.**

- **Owner:** `build-yes-hold/held-double-no.ts` and `run-outcome.ts`.
- **Change:** the outcome carries `buildYesHold: {held, because: "no_trial" |
  "trial_not_confirmed" | "digest_differs" | "versions_differ" | "rows_differ" |
  "no_stands" | "held"}`, and the build trace logs one line. Today a debug cannot tell which
  precondition failed (section 3).
- **Test:** extend `held-double-no.test.ts` with one assertion of `because` per precondition.

**Fix 5 (general, low priority): a read field that is neither tested nor stored is said
in the read's account.**

- **Owner:** `read-account/accounts.ts`.
- **Change:** add `unusedFields: ["retailer"]`. A request clause the Flow read for and never
  applied then shows up as a measured fact, not as the judges' inference (0050 found it
  only by reading `flowShape`).
- **Test:** new `read-account/tests/unused-fields.test.ts`, with a read of `branch` that is
  in no condition and not stored.

## Commands run and observed results

- `cat steps/index.md`, `summary.json` and `evaluation.json` gave:
  - verdict failed, `core.result.does_not_answer_request`;
  - extraction expected 9, observed 10, matched in any order 9, matched 8, fields 35/36.
- Trial `0036/result.json` gave:
  - verdict yes, 10 rows stored, 41 seen;
  - conditions rejected 9, 21 and 11;
  - the narrowing steps' `resultCount` was 32 → 32.
- The judge responses 0037-0040 and 0050-0051 are quoted in section 2.
  - 0037 and 0038 said no (pickup too narrow).
  - 0039 and 0040 said yes after the recheck.
  - 0050 and 0051 said no and named the holder.
- A Python parse of each judge `request.json`:
  - 0039 and 0040 carry `recheck`. 0050 and 0051 carry no `startView`.
  - Diffing 0037 against 0050 `recordSets` and `reads` showed only node ids and
    `narrowedBefore.effect` and `before` differing.
  - The holder's `sampleRows` entry has no `unitPrice`.
- `snapshots/flow-lane.json` gave:
  - candidate promoted, revision 2, `judgeCalls: 4`;
  - `resultVerification: "refuted"`, oracles `records failed` and `finalState held`;
  - `resultReauthor` `failureCode flow_bootstrap.evidence_budget_exhausted`.
- `grep build_yes_disagrees|judgedBuildTrial` over the run directory found nothing.
  `core.log` has no hold line.
- I read these Core files at `917ca845`:
  - `agreement.ts`, `refuted-no/reask.ts`, `refuted-no/recheck-words.ts`;
  - the `verdict.ts` header;
  - `result-summary.ts` `requiredValueCheck`;
  - `build-yes-hold/*.ts`;
  - `flow-version/judged-build-trial/applied.ts` and `ran-judged-versions.ts`;
  - `run-outcome.ts` lines 570-600 and `readRecordSets`;
  - `service/candidate-trial/run.ts` and `promotion.ts`, for the trial run id and the
    audit `calls`.
- I also read the fixture and oracle: `catalog/paper-towels.ts`,
  `manifest/pickup-towels-workflow.ts` and `expected-values.ts`.

## Not verified

- **Why the t662 hold did not fire.**
  - The parent-revision `null` mismatch in `automationStudioRanJudgedVersions` is a
    hypothesis from the code comment, not observed.
  - The digest and readability of the trial's datasets were not checked.
  - The Lab instance's store is gone, and nothing logs the hold.
- **The proposed fixes.** None was implemented or run, and no test was run (read-only
  brief). The flagging thresholds in fix 1 and 1b ("most rows", "at most a few") need
  design.
- **The repair loop (0052-0325).** I did not analyse it beyond its outcome.
- **The trial's temperature-0 split.** That identical-evidence calls diverged between the
  trial and the playback (wrong reason against the holder) I attribute to sampling and
  attention. The only payload difference is `startView` (14 KB, trial only). I did not
  test that it matters.

## Open questions or contradictions found

- **The hold rests on four judge calls, but the yes side is not independent.** t660's
  header says "what Core holds is four judgements, two each way". In this run, the trial's
  two yeses are re-asks after Core refuted the same calls' nos. The trial's verdict was
  **no then yes, from the same two calls**. Should a yes reached only by the refuted-no
  re-ask count as "confirmed" (`calls ≥ 2`) for the hold at all? Fix 3 makes this moot only
  where the playback no stands.
- **The brief's premise about the hold.** The brief says it "should not have fired:
  different rows from the oracle?". The hold never sees the oracle. Its rows were identical
  to the trial's, so by its rule it should have fired. That it did not is unexplained, and
  this time it was the safe outcome.
- **The retailer clause.** "Sells itself rather than a marketplace seller" has no condition
  or filter. A future variant where a marketplace item offers pickup would expose it.
  0039's claim that every kept row is ValueRidge-sold was unsupported but not checked by
  anything.
