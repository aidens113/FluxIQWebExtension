# A8 wave 14 debug: candidate towels `run-mv9ul5dy-e9a1b1c1`

Worker report, read-only. Nothing was run against a model or the Lab and nothing was committed.

## Outcome

Done. The build failed because it never kept all of the request's clauses in one revision. Ten trials alternated between
two shapes. The first kept the seller filter but dropped the sponsored or pickup-today condition. The second kept those
conditions but dropped the seller filter or the Today filter. Two Core gaps let it swing:

1. A judge's advice that Core's own record partly refutes still reaches the builder as plain advice whenever both
   judges say no.
2. The candidate gate only remembers exclusions that judges upheld for a *kind* of item. It does not remember
   conditions that Core's own record showed removed nothing the request asks for.

The Lab is not at fault.

## Evidence base

- Run folder `fxwork/t565/.../a8-slot-2/run-mv9ul5dy-e9a1b1c1`, steps in `lab-runs/2026-10-15/run-mv9ul5dy-e9a1b1c1/steps`.
- Stored rows were taken from each trial's judge request (`resultSummary.recordSets[0].sampleRows`, `truncated: false`).
  They were compared with the 9 rows of `PICKUP_TOWEL_RECORDS`, using a scratch script on all four fields, both by
  position and as a set.
- The Lab compares positionally (`packages/test-runner/src/run-expectations/extraction/judgement.ts`: "Matching is
  positional").
- Comparison runs: project `run-mv9ul5kb-ee01656b`, which passed with the same 9 rows in oracle order at step 0130, and
  wave 9 candidate `run-mv9ml750-cd5d63b4`, the same at step 0043.

## (1) The ten trials

Filters are abbreviated as follows: VR = Retailer "ValueRidge (23)", Today = "Today (16)", 4up = "4 & up (32)",
Pickup = "Pickup (20)". Conditions: R = rating atLeast 4.5, PT = text contains "Pickup today", N = name contains
"Paper Towels", H = name not contains "Holder", S = "Sponsored" absent.

| Trial (step) | Rev | Filters / conditions | Stored vs oracle | Judges | Right? |
| --- | --- | --- | --- | --- | --- |
| 1 (0022) | 1 | VR Today 4up / R PT | 10 rows: all 9 plus "Loftwell Countertop Paper Towel Holder, Bamboo"; no S, so the order is wrong | 0023 no, 0024 no | Verdict right. 0023's reason ("not ValueRidge's own brand") is wrong: brand is not seller. 0024 is right (holder) |
| 2 (0032) | 3 | Today 4up / R PT N H S + dedupe | **9 rows, exactly the oracle, in order** | 0033 no, 0034 no | Rows right. Both called it no; see (2) |
| 3 (0038) | 4 | VR Today 4up / R PT N H | 9 rows, the oracle as a set; positions 2 and 3 swapped | 0039 no, 0040 no | Verdict right (order). Reasons wrong: 0039 says the holder was kept, 0040 says PT drops rows that were asked for |
| 4 (0044) | 5 | VR Today 4up / R N H | 12 rows: 9 plus Softerra Pick 8 Triple, Northmere 12, Tidemark 12 Mega | 0045 no, 0046 no | Right |
| 5 (0050) | 6 | VR 4up / R PT N H | 9 rows, swapped | 0051 no, 0052 no | Verdict right; reasons wrong ("Hearthside ... twice", "PT dropped 9 rows the request asks for") |
| 6 (0056) | 7 | VR / R PT N H | 9 rows, swapped | 0057 no, 0058 no | Verdict right; reasons wrong |
| 7 (0062) | 8 | VR Today / R N H | 12 rows (the same three extras) | 0063 no, 0064 no | Right |
| (0066) | 9 | identical to rev 7 | refused `candidate.unchanged_after_no`, then two repeat refusals (0068, 0070) | | |
| 8 (0074) | 10 | VR Pickup / R PT N H | 9 rows, swapped | 0075 no, 0076 no | Right. 0076 gives the *true* cause: "Two are sponsored listings ... Loftwell Select-A-Size ... Hearthside Paper Towels, 12" |
| 9 (0080) | 11 | VR Pickup / R N H S | 15 rows: 9 plus Softerra Pick 8, Tidemark Everyday 6, ValueRidge 1 Roll, Northmere 12, Tidemark 8 Double, Loftwell 1 Roll | 0081 **yes**, 0082 no → unsure | 0081 is wrong; 0082 is right ("each shows only 'Pickup tomorrow'"). Held unsure, which was correct |
| 10 (0084) | 11 (retest) | same | same 15 rows | 0085 **yes**, 0086 no → unsure | Same as trial 9; the build ran out of time |

**Why "9 rows, swapped".** Page 1, item 2 is a sponsored copy of "Loftwell Select-A-Size Paper Towels, 12 Double Rolls".
In trial 2, condition S's `leftOutObservations` show page 1, item 2. Without S, the sponsored copy is collected first
and the organic copy is removed by the dedupe (trial 3 `processing: collected 13, duplicates 4`). The set is exact, but
"Loftwell Select-A-Size" lands before "Loftwell Ultra Strong", so the Lab's positional oracle would fail it. That is
correct: the request says "leave out sponsored listings ... in the order the results show them". In trials 1, 3, 5, 6
and 8, the dedupe hid the missing sponsored exclusion, and only 0024 and 0076 noticed it.

## (2) The one correct result judged no: trial 2 (rev 3)

It was a double no, so `agreement.ts` `agree()` took the `does_not_answer && does_not_answer` branch, which runs
`bothReadings` plus `refutedMark` plus `standingNoOf`.

- **t607 refuted-no (`refutedMark`, `refuted-no/weigh.ts`).** It fires only when a call's every reason is refuted, and
  on a double no only when both are (`calls.length === 2 && marked.length < 2` returns `{}`). Neither call was wholly
  refuted:
  - Call 1 (0033) also says "no Retailer=ValueRidge filter/condition was applied", which is true of rev 3.
  - Call 2 (0034) says "the Retailer=ValueRidge filter was never applied", which is also true.
  - So there was no re-ask and the no stood.
- **t631 row references.** They did refute the sentences about rows left out. The feedback `checked` says:
  "Loftwell Ultra Strong ... is in the result, although the check calls it left out: the check misread ...; advice
  resting on that reading is not supported", and "condition 5 ... alone left out these rows the check names:
  Hearthside Select-A-Size ... (also in the result); ValueRidge Essentials Select-A-Size ... (also in the result)". The
  read summary also carried `alsoInResult`: "another copy of the same item was kept, so that item is not missing". This
  refuted only part of call 1.
- **t633 standing-no.** Not applicable. It acts only on a no whose every standing call merely drops conditions, against
  an earlier no that upheld rows of a kind. Rev 3 stored no holder, and call 1's observed names rows, so `drops` was
  unset.
- **Exclusion evidence and `changeAdvised`.** Not applicable, because no call said yes.

On the Flow rather than the rows, the no is defensible. Rev 3 had no step or condition for "sells itself rather than a
marketplace seller". Its rows equalled the oracle only because, on this site, no marketplace listing survives "Pickup
today". The damage came from what the no's **advice** carried forward. The feedback `judge.advice` reached the builder
**unlabelled**: "Judge call 1: ... change condition 5 so it excludes only the sponsored listing row, not the product, so
qualifying products with a sponsored duplicate are still kept once." `bothReadings` labels only the readings in
`refutedFindings`, which keeps only `wholly` refuted ones (`agreement.ts` ~l.700-707). A partly refuted reading is
labelled only on the split path (`refutedLabelled`, t628). The builder followed it at 0035: "fixing the sponsored
condition so qualifying products with sponsored duplicates are kept once". Rev 4 deleted S, and S stayed out for seven
revisions (revs 4 to 10).

The same mechanism struck again at trial 3 → rev 5:

- Call 2 was labelled "contradicted by Core's record" (the t629 settled rows: "Core read 'Pickup tomorrow' on that row,
  which fails it as written").
- Call 1 was not wholly refuted. Its false claim that "Kept rows include 'Loftwell Countertop Paper Towel Holder'" was
  not refuted, because that holder was left out by N and H jointly, not by one condition alone, and
  `row-reference-claim.ts` refutes "kept" claims only for rows a condition left out *alone*.
- Call 1's unlabelled advice was "drop condition 2 (contains 'Pickup today')". At 0041 the builder said "drop the
  pickup-today text condition", and rev 5 stored the 3 pickup-tomorrow or shipping rows (trial 4).

## (3) Candidate loop compared with the project path

- **No ledger of clauses.** The project supervisor's `project.write_plan` (project run, step 0006) records `goalFacts`
  ("sponsored listings are excluded", "only ValueRidge-sold, pickup-today, 4.5+ star items are included"). Its repair
  brief (0095) names the one failing condition. Its builder therefore kept S, PT and VR together; see the yes at
  0130/0131.

  The candidate builder rewrites the whole script from the latest advice and has nothing that holds a clause to its
  step. Rev 3 and rev 4 together held every clause, yet no revision combined them.
- **Gate memory.** `candidate/trial-gate.ts` remembers exact digests (`closedDigests`) and, through
  `AutomationStudioResultStandingNoMemory` (t633), only `upheldKind`, which is the stored rows a judge called "not the
  asked kind". Conditions settled by Core's own record are never remembered: every row they left out alone either
  failed the request's quoted words or was a copy of a stored row. Here those were S in rev 3 and PT in revs 1, 3, 4, 6
  and 10. The project path has the same memory (`dispatch/standing-nos.ts`, also kind-only), so this gap is shared. The
  project's plan masks it.
- **Re-test words (shared, not candidate-only).** `UNSURE_RETESTABLE` (`trial-gate.ts`) calls a retest "the better move"
  when "one judge call said yes (answeredReading)". This holds even when nothing contradicts the no. At 0083 the builder
  retested rev 11, claiming "the other's doubts are contradicted by Core's own read record". Trial 9's `checked` was
  empty, and its no was right (pickup-tomorrow rows kept), so the last trial was wasted. The project run did the same
  thing three times on a wrong 2-row Flow (its steps 0078, 0082, 0086) before dispatching a repair.
- **Standing-no records.** Not the gap here. No trial was `contradictedByBuild`, and the swing was over fulfilment and
  sponsored clauses, not a kind.

## (4) Root causes and fixes

**RC1 (Core, primary): a build can drop a condition that Core's record proved removed nothing the request asks for.**
In rev 3, S left out 4 rows alone, all `leftOutAlsoInResult`. PT left out 2 rows alone, both settled against the
request's quoted words. A judge's misread got S deleted at rev 4, and another misread got PT deleted at rev 5.

Smallest structural fix:

- Record each judged trial's **settled conditions**. A condition qualifies when every row it alone left out is settled
  by a request-quoting test (t629/t631 `quotesRequest`) or is also in the result (`alsoInResult`).
  - Record them in `result-verification/standing-no-record/record.ts`, beside `conditions`.
  - Keep them in `standing-no/memory.ts`, or a new `standing-no/settled-conditions.ts` with its barrel.
- In `flow-bootstrap/candidate/submission.ts`, refuse once a revision that removes or loosens a settled condition.
  Compare by the wording key that `standing-no/record.ts` already uses. Give the condition and Core's finding in Core's
  generic words. Count it like `unchanged_after_no`.
- Mirror this in `subflow-candidate/subflow-trial-gate.ts` for project repairs.
- On this run, the refusal would have stopped rev 4's removal of S. Rev 4 would then have been VR Today 4up plus R PT N
  H S: the shape that passed in the project run and in wave 9.

**RC2 (Core, small): a double no forwards a partly refuted reading unlabelled.**

- In `agreement.ts` `bothReadings`, label a call's reading "Core's record contradicts part of this reading: ..." where
  `weighedNo` has findings but `wholly` is false. This is what `refutedLabelled` already does on the split path (t628).
- In `refuted-no/row-reference-claim.ts`, let a "kept"/"includes" claim be refuted for a row that any condition left
  out, not only one condition alone (trial 3's holder claim).

**RC3 (Core, minor): retest advice.**

- Base `UNSURE_RETESTABLE` on Core-computed facts (`refutedNo` or `contradictedUnsure` present, or a standing-no
  contradiction) rather than "one judge call said yes" alone.
- Say it as a field, `retestAdvised`, so the builder cannot claim a contradiction that `checked` does not hold.

**Not fixable by Core alone:** judges reading brand as seller (0023, 0034, 0058, 0086) and missing the sponsored copy
(trials 3, 5, 6). Nothing here proposes model guidance shaped like this task, site or answer.

**Lab:** no defect. The oracle and its positional comparison match the request's "order ... under Best match" with
sponsored listings left out.

## Commands run and observed results

- `cat summary.json evaluation.json run.json`: verdict failed, `runtime.behavior`, 53 LLM calls, about 606 s. Pair
  downstream `05452761`, Core `797452c1`, both clean.
- The index of steps 0001 to 0086: as tabled above.
- `node cmp.js 0023 ... 0085` (scratch): trial 2 `positional true sameSet true`; trials 3, 5, 6 and 8
  `positional false sameSet true`; trials 1, 4, 7, 9 and 10 as listed, with extras.
- Per-trial `result.json` dump of `judge`, `checked`, `unconfirmedReading` and `instruction`: quoted above.
- Read Core `agreement.ts`, `candidate/trial-gate.ts` (l.100-330), `standing-no/memory.ts`, `contradiction.ts`,
  `standing-no-record/record.ts` header, `refuted-no/row-reference-claim.ts` header.

## Not verified

- I did not read `candidate/submission.ts` or `refuted-no/weigh.ts` in full, so the exact insertion point for RC1 and
  the `weighedNo` findings for trial 2 call 1 are inferred from the `checked` lines.
- The internal `standingNo` record of each trial is Core-only and not in the step files, so I did not inspect it.
- I did not confirm that "no marketplace listing is pickup-today" against the site's data. I inferred it from trial 2
  seeing 22 items, the same as trial 1, which had VR.

## Open questions or contradictions found

- Is an RC1 refusal too strong where a settled condition genuinely must change, for example because its field
  disappears on a variant? The proposal is "refuse once": a second submission that still drops it would be accepted.
- The t632 retest clause was written for a correct revision. RC3 must keep that case: there, Core's record
  contradicted the no.
