# Debug: run-mvtdoyf3-47ffaac1

Status: **FALSE PASS (product defect in Core's result verification, on a path t790 did not cover)**. Lab runner
verdict `failed: runtime.behavior`; Lab oracle `failed` (15 rows of the 16 expected); Core reported `passed`. Adaptation
gate round 2, everything-store `deal-wheel`, task `everything-store-first-page-plus-earbuds-deal-wheel`, lane t563,
instance `gate-es`. Code under test: downstream `89a9e2ed`, Core `7a822e42`. I checked that both t563 trees are clean
at those merges and that `snapshots/running-core-identity.json` says `verified: true`. Read-only debug, 2026-10-29. No
source edit, build, Lab run, model call or git command that changes anything. Offline probes ran Core's own guard
functions from the t563 Core tree on this run's real judge inputs and replies (section 5).

**Cause, in one line.** Revision 1 stored exactly the oracle's 16 rows. Two judges then said no to it, and the only
request words they cited were the search (*"Search the store for wireless earbuds"*). Core took that as a binding no
and refused both later attempts to go back to revision 1 (`candidate.unchanged_after_no`, 0076 and 0115). The repair
then dropped the ear-tips row with two overlapping name conditions. The row failed both of them, so neither condition
"alone" left it out. Core's quote guard (t515, tightened in t790) reads only `leftOutOnlyByThis`, so it never held any
yes to the request's words for that row, and every yes over it was accepted.

## 1. How far it got

| Phase | Steps | What happened |
| --- | --- | --- |
| Chat | 0001 | `flow.createHere` with the task instruction verbatim. |
| Plan | 0002-0006 | read_task, write_plan, dispatch brief-1. |
| Exploration | 0007-0021 | Opened the search, narrowed to Brightaisle Plus (1000 to 43 results), ran detect_repeating_structure three times (0017 `target_unobserved`), one inspect. |
| Revision 1 | 0023 | `where: [{sponsored is absent}]`, the request's only exclusion. |
| Trials of revision 1 | 0025, 0033, 0040 | **Each stored 16 rows (seen 20, condition 1 rejected 4): the oracle's answer.** 0025 unsure (0029 yes, 0030 no, 0031 the t515 re-ask, no). 0033 unsure (0036 no, 0037 yes, 0038 no); its advice reached the builder marked as an unstated exclusion, and the builder rightly tested revision 1 again. **0040 no** (0043 no, 0044 no), `candidate.trial_judged_no`: *"This exact proposal cannot be tested again or completed."* |
| Revision 2 | 0046, trial 0048 | Added `name contains "Earbuds"`, which removed nothing, since the ear-tips name contains "Earbuds". Judged no (0052, 0053): *"the name-contains-Earbuds condition let it through"*, advice *"name not contains 'Ear Tips' / 'Replacement'"*. |
| Revision 3 | 0059, trials 0061 and 0080 | Added `brand is present`, following Core's t785 note on 0048 (*"look for a field present on some rows and not others ... test it with is: "present""*). 13 rows. All eight judge calls said to remove condition 2 (*"keep only the sponsored-absent condition"*). Both trials came back **unsure**, because Core located none of their defects (section 2c, D-C). |
| Builder loop | 0069-0092 | 0070 and 0074 `candidate.unchanged_submission`. **0076 sent revision 1's read again** (summary *"Drop the brand-presence filter that wrongly removed three real earbud listings, keeping only the sponsored exclusion"*) and got `candidate.unchanged_after_no`. Then five repeat-guard refusals. |
| Repair lane (brief-2) | 0093-0131 | Dispatched with *"read every non-sponsored first-page result into a table"* (panel 23). Explored again. 0111 revision 4 = revision 1's read. **0115 test refused, `candidate.unchanged_after_no`** (*"Your subflow joins into a whole Flow that was already tried and judged no"*). 0118 revision 5: `sponsored is absent`, `name contains "Earbuds"`, `name not contains "Ear Tips"`, `name not contains "Replacement"`, with the label *"... leaving out sponsored placements and accessories"*. |
| Revision 5 trial | 0120 (judges 0124-0127) | 15 rows. Condition 3 rejected 1 (`rejectedByItself 0`), condition 4 rejected 1 (`rejectedByItself 0`). 0124 and 0126 said no, but both called stored rows missing, so Core located none of their defects (correctly). 0125 and 0127 said yes. Verdict yes: *"The trial was judged twice to do what the instruction asks."* Completed at 0128-0131. |
| Playback on the armed `deal-wheel` | 0132-0136 | Navigate; navigate; click the optional cookie "Decline", which *"recovered on attempt 2 after absorbing blocking_dialog"* by clearing dialog "No thanks" (the wheel's decline line); click "Brightaisle Plus", recovered by clearing dialog "Not now"; extract 15 rows. |
| Playback result check | 0137 | One call, yes, accepted. Event 44: `resultChecks.status: "confirmed"`. `reportedVerdict: "passed"`. |
| Lane | events 43-46 | `repair.calls: 0, interventions: 4`; `adaptationGate {counted: false, reason: "oracle_failed"}`; error 46: *"Extract step extract-first-page yielded 15 record(s), expected 16"*. |

**The drift part worked again.** All three final-state facts held (`snapshots/flow-lane.json`): `wheel-closed`
(expected false, observed false), `first-page-count` *"1-16 of 43 results for "wireless earbuds""*, and
`never-challenged`. The 4 harness activations are a diagnosis plus a runtime_patch for each blocking dialog. Both
adaptations were applied as revisions 2 and 3 (`adaptationPersistence`).

**The oracle, expected vs got** (`snapshots/extraction-mismatches.json`):
- Expected 16 rows, observed 15. All 15 matched in any order, and 60/60 fields were present.
- The one missing row is expected position 9: `name` "Replacement Ear Tips for Wireless Earbuds, Memory Foam Eartips, 3
  Pairs (S/M/L), Black", `price` $12.99, `rating` 4.5, `url` `.../Replacement-Ear-Tips-for-Wireless-Earbuds-Memory-Foam/dp/B0JKYDKPGR`.
- Observed position 9 is the expected row 10 (Tessaro Arc, $29.99, 3.9), and positions 10-15 are `moved` up by one.
- Nothing else differs. It is the same single row as run 1 (`run-mvswh11y-9d462629`).

**Cost and calls.** 68 calls, $0.071856. That is the sum of the step metas, and it equals `runTotal` in events 43-44
and the live-guard ledger (ceiling $0.25). By kind:
- chat: 1 call, $0.000226;
- builder decisions: 26, $0.031897;
- repair decisions: 14, $0.015271;
- supervisor decisions: 4, $0.003419;
- build judges: 22, $0.018361;
- playback judge: 1, $0.002682.

No balance error.

## 2. The false pass

### 2a. The task wording is not the defect (unchanged from run 1)

*"... and collect every search result on the first page, leaving out sponsored placements ..."* asks for every result
except the one named exclusion. The sibling task `everything-store-plus-earbuds-under-50` names *"accessories such as
ear tips"* as an exclusion, and this one does not. Evidence that the wording leads to the oracle:
- Every trial of revision 1 stored exactly the oracle's 16 rows.
- The build's own checklist reads *"every non-sponsored result on the first page was collected in page order"*.
- The supervisor's repair brief reads *"read every non-sponsored first-page result"*.
- Four of the eight revision 3 calls listed the ear-tips row as `asked_missing` (0065, 0083, 0084, 0086).

The misreading is the judges' (6 of the 8 calls on revision 1 said no over that row), and Core then made it binding.
**Judgement call:** do not reword. *"leaving out only sponsored placements"* would keep the task's intent and stays the
fallback if F3 below is rejected. The oracle must not change.

### 2b. Did the t790 fixes run on the deciding calls?

**D1 (unstated-exclusion mark on an unsure plus a no, `agreement/unsettled.ts`) never applied.** No trial was an unsure
plus a no. The split path it extends did run:
- Trial 1 (0025): 0030's advice was marked (probe: `["excludes accessory listings"]`) and re-asked (0031, recheck text
  in its request).
- 0031 said no again. Its only exclusion, `not contain "Ear Tips"`, is exempted by t628's named-stored-row rule
  (`automationStudioRequestUnstatedExclusions` with the named row returns `[]`, without it `["not contain "Ear Tips""]`),
  because the stored row the reading names has "Ear Tips" in its label. So the advice reached the builder unmarked.
- Trial 2's advice (0038) was marked: *"Core's check: this advice adds an exclusion the request never states ..."*.
- **Trial 3 was a double no, and no exclusion screen runs on a double no.** Its advice went out unmarked as the
  verdict's (0040 `feedback.judge.advice`).

**D2 (`refuted-no/count-claim.ts`) was not involved.** No no was wholly refuted. The probe gives `wholly: false` for
every no in the run.

**D3 (the settled-condition quote must sit in its own sentence) ran, but the row never reached it.** For 0124-0127 and
0137 Core's guard reads hold only one condition (probe 1: `guard reads: [[{"c":"condition 1 (sponsored is
absent)","n":4,"settled":"presence"}]]`). In the judge's copy (0125 `request.txt`), conditions 3 and 4 show
`rejected: 1, alone: 0` and carry no `leftOutOnlyByThis`. The row appears only under `leftOutTogether: [{conditions:
[3, 4], rows: ["Replacement Ear Tips ..."]}]`.

**The new path.** `runtime/result-verification/request-rows/summary-reads.ts`, `automationStudioRequestRowsReads`:
- It skips a condition whose `leftOutOnlyByThis` is empty (`if (!entry.leftOutOnlyByThis?.length) return [];`).
- It never reads `leftOutTogether`.
- So `request-rows/unquoted-rows.ts` `automationStudioResultLeftOutRowsUnquoted` (t515/t624/t790) has nothing to hold.
  It returns `[]` for 0125, 0127 and 0137 (probe 1), and `verdict/result-verdict.ts` takes each as
  `core.result.answers_request`.
- The judge prompt has the same gap: `llm/diagnosis-instructions.ts` (`AUTOMATION_STUDIO_RESULT_VERIFICATION_INSTRUCTION`)
  says *"Hold every row a condition alone left out (each read's leftOutOnlyByThis, and processing.conditions) to the
  request's own words"*. Rows left out together are not named in that rule.
- `leftOutTogether` (t655) is read elsewhere (`refuted-no/record.ts`, `located-defects/`, `unsure-doubts/narrowing.ts`),
  but never by the quote guard.

What the accepted yeses said about the row:
- 0125: *"Conditions 3/4 left out the Replacement Ear Tips accessory, which is not a wireless earbuds product."*
- 0127: *"... which matches the request's "leaving out sponsored placements"; the accessory ear-tips row was also
  excluded."*
- 0137 (playback): *"... which matches the request's "leaving out sponsored placements"; the Replacement Ear Tips
  accessory was excluded by conditions 3 and 4."*

None of them quotes request words that exclude the row, and the request has none to quote. Their reason is their own
(*"not a wireless earbuds product"*). Core's rule (t515) exists to stop exactly that.

### 2c. Why the build never got back to the right revision (two more Core defects, one contributing)

**D-B, a double no that rests on the search words alone is binding.** Files: `located-defects/located-defects.ts`
(`notFound`, the `kept_not_asked` branch) and `agreement/exclusion-words.ts:26`.
- 0043 and 0044 each list one defect: `kept_not_asked` on the ear-tips row, with `requestWords: "Search the store for
  wireless earbuds"`.
- A `kept_not_asked` defect is located when its row is stored and its words run in the request. Probe 1 gives
  `located: 1 of 1` for both, so the double no stood.
- Core's t515 re-ask text invites that defect: *"answer no over a row the result keeps only where you quote words of
  the request that it fails: words that exclude it, **or the words naming what the request asks for, which that row by
  its own words is not**"* (0031's `recheck`). That clause was written for t628's towel holder, where the request asked
  for the item. Here the request asks for every search result, so the searched words name where to look, not the
  cohort.
- What followed: `closedDigests` (`flow-bootstrap/candidate/trial-gate.ts`) refused revision 1 at 0076 and at 0115. The
  rev 1 no's advice was carried to the final judges as `earlierAdvice`. The repair could only add exclusions.

**Side defect F2: the search words are not recognised as searched on revision 1.** File `request-rows/request-wording.ts`,
`searchedWords`.
- It intersects exact phrase keys over the kept rows. The ear-tips row's phrase is `for wireless earbud`, while every
  other row's is `wireless earbud`.
- So the intersection is empty (probe 8), and `ownWords("Search the store for wireless earbuds")` returns `["store",
  "wireless", "earbud"]` instead of `["store"]`.
- On revision 1, Core therefore treated the search words as the request's own words. That weakens every own-words check
  on the correct revision.

**D-C, correct nos over an unstated presence condition cannot be located (contributing).** File
`located-defects/located-defects.ts` `askedCellNotFound`, and `located-defects/untested-column.ts` (t790).
- Revision 3's nos named Brightaisle Basics Sport and Oakhaven Sound Grove (oracle rows) as `asked_missing`.
- With `column: name` they are refused as an untested column (0065: *"the defect quotes "name", which condition 2 did
  not test ... Quote that row's own value in "brand""*).
- With `column: brand, value: (no value)` they are refused as *"Core holds no cell "brand" of ..., and its label does
  not say "(no value)""* (0067, 0086).
- The check reads the bare label and `leftOutCells`, which hold only the answer columns. It ignores the label as given,
  *"... — brand: (no value)"*, and the presence condition's own `leftOutSettled`.
- So no no over a presence condition the request never states can be located, and revision 3 came back unsure twice.
- This was not decisive: the correct next step was revision 1, which was locked either way.

**Not a Lab or oracle defect.** The Lab reported `oracleVerdict: failed` truthfully, and the gate did not count the run.

## 3. The fix (Core; no oracle, wording or scenario-specific guidance change)

**F1, primary (stops the false pass): hold rows left out together to the request's words.**
- (a) In `request-rows/summary-reads.ts` (`automationStudioRequestRowsReads`), read each `leftOutTogether` set of a run
  read as one left-out group:
  - name it `conditions 3 and 4 (<wording 3>; <wording 4>)`;
  - keep its rows' labels;
  - leave it unsettled, since no one condition's value is the reason. The build-test path (`build-test/read-rows.ts`
    already sends `leftOutTogether`) needs the same.
  - `unquoted-rows.ts` then holds each such row to t515's rule: named in a sentence that quotes the request's own words.
- (d) In `request-rows/unquoted-rows.ts`, a quote whose own words name another condition of the read (its subject or
  tested text) and none of this condition's is that other condition's reason. It does not account for this
  condition's rows. This mirrors the existing rule that *"a quote beside another row is that row's reason"*.
- Also add `leftOutTogether` rows to the prompt's *"Hold every row ..."* sentence in `llm/diagnosis-instructions.ts`. The
  wording stays generic and uses no scenario words.
- Probes 3 and 5 checked F1 against the three accepted yeses:
  - With (a) alone, 0125, 0127 and 0137 are held as written: each names the row too briefly for `row-naming.ts`.
  - Counterfactually, with the row named by its whole label, (a) alone accepts all three. (a) with "no lending from a
    sentence naming a condition" (b) and "`;` breaks a sentence" (c) still accepts 0125, whose quote shares a sentence
    through a comma. (a) with (d) holds all three.
  - Control (probe 7): a request that states the second exclusion, with a yes quoting it beside the row, stays accepted.
    The same yes with the quote shared with condition 1 is held.
- **Judgement call:** prefer (a)+(d) over (b)+(c). (d) is the one that closes the shared-quote case, and it reads only
  Core's own wording of the conditions.
- Effect on this run: the revision 5 trial and the playback check come out held (unsure), and the run reports
  unconfirmed, not passed.

**F2: searched words by contained phrase.** In `request-rows/request-wording.ts` (`searchedWords`), a label whose phrase is
`for wireless earbud` also names `wireless earbud`. Intersect on the sub-runs that are themselves request phrases
(`phrases.isPhrase`), not on exact keys. Probe 8: today the intersection is `[]`; with contained runs it is `["wireless",
"wireless earbud", "earbud"]`.

**F3, judgement call (keeps the correct revision testable): a kept row is not "not asked" by the search's own words when
the request asks for every result of its search.**
- In `located-defects/located-defects.ts`, the `kept_not_asked` branch: where the request's own words ask for every
  result (an `every`/`all`/`each` quantifier on `result(s)`, read from the request text), a defect is not located when
  the row's own label says every request phrase its `requestWords` hold. The words cannot be what the row fails.
- In `agreement/exclusion-words.ts`, drop the *"or the words naming what the request asks for ..."* clause of the t515
  re-ask under the same condition.
- Effect here: 0043 and 0044 are unlocated, the t752 re-ask follows, and the trial is unsure rather than binding.
  Revision 1 stays testable and is never locked.
- Risk: reading the quantifier wrongly. Gate it narrowly so t628's towel-holder case (a request for the item, not for
  every result) is unchanged.
- Rejected alternative: also mark unstated exclusions on a double no. That changes only what the builder is told, not
  the binding verdict or the lock.

**F4 (contributing): locate an `asked_missing` defect over a row an unstated presence condition settled.** In
`located-defects/located-defects.ts` (`askedCellNotFound`), for a row a presence condition left out whose
`leftOutSettled` holds it (said `label — column: (no value)`), a defect naming that column with `(no value)` is located.
Core measured the absence itself (t599). Revision 3's nos 0067, 0068, 0085 and 0086 would then stand.

**Regression tests** (Core, fail-first; a library catalog example, never this store's rows):
1. `request-rows/tests/unquoted-rows.test.ts`:
   - Setup: request *"Search the catalog for garden, ... list every result on the first page, leaving out reference
     copies"*. Read conditions: 1 `reference is absent` (settled presence), 2 `title not contains ["Calendar"]` and 3
     `title not contains ["Wall"]`, each `rejected 1, alone 0`. `leftOutTogether: [{conditions: [2, 3], rows: ["Garden
     Wall Calendar 2027"]}]`.
   - A yes saying *"Condition 1 (reference is absent) left out the reference copies, as the request says "leaving out
     reference copies"; the Garden Wall Calendar 2027 row was excluded by conditions 2 and 3."* is held for `conditions
     2 and 3`. Also test the comma-joined form.
   - Control: the request adds *"and wall calendars"* and the yes quotes it beside the row; it is accepted.
2. `request-rows/tests/` (summary-reads): a together set becomes one unsettled condition with its labels. A set whose
   row another read stored follows t691 as before.
3. `request-rows/tests/` (request-wording): kept rows "Garden Tools Set" ... and "Hook Rack for Garden Tools". The
   searched words include `garden tool`.
4. `located-defects/tests/located-defects.test.ts`:
   - Under *"... list every result the search shows"*, a kept "Glove Hook for Garden Gloves" with `kept_not_asked`
     quoting *"Search the catalog for garden gloves"* is not located.
   - Under *"Find garden gloves and list them"*, the same defect is still located (t628 unchanged).
5. `located-defects/tests/asked-cells.test.ts`: `isbn is present` left out a row said `— isbn: (no value)`. An
   `asked_missing` defect with `column: isbn, value: (no value)` is located.
6. Existing tests that must still pass: `value-readings/tests/text-settled-judge.test.ts`,
   `read-account/tests/together-rows.test.ts`, and the `refuted-no/` users of `leftOutTogether`.

**Before a rerun:**
- Core's narrow checks: the vitest files above plus `result-verification/`, the package typecheck, and the structure
  audit.
- A provider-free replay of this run's 23 judge replies:
  - every yes over revision 5 (0125, 0127, 0137) must come out held;
  - 0043 and 0044 must not be binding under F3;
  - revision 3's brand-column nos must be located under F4.
- Then one paid gate rerun, after this note is in the launching lane tree.

## 4. UI (chat and ending)

- Mid-build, panel 22: *"Asked once more to list each, the first named 2 defects, none of which Core can find in its
  record and the second named 3 defects, ... so neither no is taken."* then "Whole-Flow run: Not confirmed". These were
  the correct nos about the brand condition. The user is told they were not taken, but not what they said.
- The chat never says the builder, and then the repair, tried to go back to the 16-row version and were refused
  (0076, 0115). The user cannot see why the Flow gained conditions.
- Panels 27-28: the read is labelled *"read the first page of results, leaving out sponsored placements and accessories"*
  and the check says *"Passed: 15 rows came back. The result was judged to answer the request."* The step label itself
  announces an exclusion the request never asks for, and nothing flags it.
- Build ending, panel 29: *"Repaired Collect Brightaisle Plus wireless earbuds — The subflow, which is the whole Flow
  here, answered yes in its test run from the start."*, "Spent $0.02 · 18 calls · 1 test" (the repair's share only).
  It also says *"Left on the site: The build clicked "Decline", which changed the page ..."* about the optional cookie
  button, which is harmless noise, as in run 1.
- Playback, panel 30: *"Robot check — Done. The check cleared on its own after 8 s."* and "Closed a notice the page put
  in the way" (the wheel's "No thanks", unnamed). Clear.
- Ending, panel 31: *"Learning an interruption — The page put "Never miss a deal" in the way and the run closed it. The
  Flow now keeps a step that closes it ..."*, then **"Check of the run's result: Passed: 15 rows came back. The result
  was judged to answer the request."** and "Run finished". This is the false claim. F1 fixes it at the source, and no
  UI change is needed for it.
- Small separate UI defects: say what a refused no claimed, and say when a return to an earlier revision was refused.

## 5. Probes (offline, zero model calls)

- **Setup.** `node --experimental-transform-types` from `C:/Users/osrs_/FluxStuff/fxwork/t563/!FluxIQ/packages/fluxiq`.
  Each judge's `context` was parsed from `request.json` (the user message is JSON). The scripts are in
  `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/b969a395-6436-4284-bccb-432f7f43683b/scratchpad/d-gate-es-2/`.
- **probe1.mts:** `automationStudioResultVerdict` and `automationStudioResultLeftOutRowsUnquoted` on each real reply.
  For nos it also ran `automationStudioResultDefectsLocated`, `automationStudioResultRefutedReading` and the unstated
  screen.
  - 0125, 0127 and 0137 come back `answers`, unquoted `[]`.
  - 0124 and 0126 come back `located: 0` (their rows are stored).
  - 0043 and 0044 come back `located: 1 of 1`.
  - Revision 3's nos are located 0 of 2 or 0 of 3, with the findings quoted in 2c.
- **probe3 and probe5 (with `sr.ts`, `uq.ts`):** scratch copies of `summary-reads.ts` and `unquoted-rows.ts` with F1
  (a)-(d) behind switches. Results are in section 3.
- **probe7:** the control with a stated exclusion.
- **probe8:** searched words, exact keys against contained runs.

## Not verified

- That F1 to F4, as they would be written in Core, behave as the scratch switches did. Only `summary-reads.ts` and
  `unquoted-rows.ts` were patched in scratch, and only `automationStudioResultLeftOutRowsUnquoted` was re-run. F2, F3
  and F4 were checked only by reading the code or by a standalone calculation.
- That the probes saw exactly Core's internal summary. They used the judge's copy, which may lack fields Core holds
  internally; the previous debug made the same approximation.
- That the builder would have reached a yes on revision 1 with F3. The judges are free to keep saying no; F3 only stops
  that no from being binding.
- Why revision 1's three trials got different splits on byte-identical evidence. That is model variance and was not
  investigated.
- The two in-run adaptations' durable reuse; no replay ran (`replays: []`).
