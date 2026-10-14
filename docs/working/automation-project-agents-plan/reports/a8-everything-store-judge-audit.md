# A8 judge audit: everything-store Plus earbuds (run-mv7vor5f-ea4d08b4)

Read-only audit. No Lab run, no provider call, nothing edited except this file.
Recorded page data quoted only as product names and prices.

## Outcome

Done. Of the five judged `find_earbuds` trials, **three verdicts were wrong and
two were right**. Revisions 2 and 4 stored **exactly** the oracle's 13 rows, in
order, and were judged **no**. Revision 1 was missing three real earbuds and was
left **unsure** when it should have been no. Revisions 3 and 6 were correctly
judged no.

The builder's Plus condition is **correct**. The page marks Plus with
`<i role="img" aria-label="Brightaisle Plus">` on the card's delivery line. A
non-Plus card has no such element. The read's `plus` field is that aria-label,
and `plus is present` removes exactly the 8 catalogue earbuds that are not Plus
but meet the rating and price. The "six earbuds excluded by the Plus condition"
are 6 of those 8, all non-Plus. The other two non-Plus pairs (Zephyrline Z1,
Pulsebud Mini) have "Wireless Charging Case" in their titles, so in revisions 1
and 3 the accessory condition also removed them, and they were not "alone".

The one real builder defect is the accessory exclusion `name not contains
"Charging Case"`, used in revisions 1 and 3. It drops three real Plus earbuds
whose titles list "Wireless Charging Case" as a feature.

**Root cause: both, but mostly the judge's input.** The builder had one real
defect, and its repairs went back and forth because the judges gave false
advice. The judges' wrong answers come from a Core defect: in a **subflow trial**
every read runs across a Call Subflow boundary, and `read-account/accounts.ts:108`
then drops the authored node. So the judge received **no condition wording, no
tested value beside any left-out row, no `testedLabel`, so no
`leftOutNamingTheItem`, and no dedupe facts**. The earlier whole-candidate build
(run-mv4v1v25-c7d57567) was given all of these. Two judge-protocol weaknesses
already known from the earlier debugs made things worse. First, the
quote-every-left-out-row rule (t515) turned a correct yes into a no. Second,
presence conditions carry no positive evidence, which leaves judges free to doubt
a correct Plus test.

## Oracle (question 1)

Source: `apps/scenario-lab/src/scenarios/everything-store/live-tasks.ts:21-27`
(task `everything-store-plus-earbuds-under-50`, `expectedDatasetId:
"extract-plus-under-fifty"`) and `workflows/plus-under-fifty.ts:14-16`.
`ANSWER` = the organic results of the unfiltered "wireless earbuds" search with
`kind === "earbuds" && plus && rating >= 4 && priceCents < 5000`, in relevance
order. I computed it from the built scenario
(`apps/scenario-lab/dist/.../workflows/plus-under-fifty.js`, local and
deterministic) and got 13 records:

| # | Product (title start) | Price | Rating | SKU |
| --- | --- | --- | --- | --- |
| 1 | Lumo Audio Drift, 50H, Rose Gold | $49.99 | 4.1 | B0PXHP88KT |
| 2 | Brightaisle Basics Sport (organic, also in sponsored carousel) | $22.99 | 4.0 | B0R257NR7U |
| 3 | Zephyrline Z3, 24H, Sage | $34.99 | 4.3 | B0P8ZF57AC |
| 4 | Aurelle Echo, 40H, Ivory | $47.99 | 4.5 | B0J5MCMBAY |
| 5 | Aurelle Pods Fit, 36H, Ivory | $39.99 | 4.4 | B0VNKJTVCD |
| 6 | Tessaro Arc, 24H, Sage | $29.99 | 4.2 | B07Z1RZGJG |
| 7 | Aurelle Pods, 40H, Black | $47.99 | 4.0 | B00BJX53AC |
| 8 | Lumo Audio Drift Pro, 60H, **Wireless Charging Case**, White | $26.99 | 4.2 | B09HZLEPLS |
| 9 | Aurelle Pods Fit, Ivory **with Wireless Charging Case** | $39.99 | 4.4 | B0HKSZ2BM6 |
| 10 | Trevio T5, 30H, ANC, Ivory | $22.99 | 4.6 | B0G68DZTDB |
| 11 | Trevio T5, 30H, **Wireless Charging Case**, Rose Gold | $39.99 | 4.0 | B0X473P78X |
| 12 | Aurelle Pods, 50H, Black | $47.99 | 4.0 | B02UB6NJWC |
| 13 | Soundcrest Air Pro 2, 36H, Graphite | $34.99 | 4.5 | B016CBKJ2R |

All 13 titles are distinct, so the builder's `dedupe by name` is safe here.

The 8 earbuds that are **not Plus** but meet rating and price (catalogue ranks 7, 13,
26, 36, 45, 50, 55, 59): Kinetra Run 60H Graphite ($49.99), Aurelle Pods Fit 30H
Sage ($49.99), Aurelle Echo 50H Ivory ($49.99), Tessaro Arc 48H Ivory ($19.99),
Soundcrest Air Lite 80H Ivory ($19.99), Zephyrline Z1 60H Midnight Blue
($49.99), Pulsebud Mini 30H Ivory ($39.99), Tessaro Arc 24H Ivory ($19.99).

## Revisions against the oracle (question 2)

Read `where` per revision is from the submit `call.json` (steps 0060, 0069,
0076, 0082, 0108). Stored rows are from each judge's `resultSummary.recordSets`.

| Rev (submit) | Accessory / extra conditions | Stored | Against the oracle |
| --- | --- | --- | --- |
| 1 (0060) | contains "Wireless Earbuds"; not ["Ear Tips","Charging Case","Replacement"] | 10 | missing #8, #9, #11 (dropped by "Charging Case"); no extras; order right |
| 2 (0069) | contains "Wireless Earbuds"; not ["Ear Tips","Replacement"] | 13 | **exact**, order right |
| 3 (0076) | not ["Ear Tips","Replacement","Charging Case"] | 10 | missing #8, #9, #11 again |
| 4 (0082) | not ["Ear Tips","Replacement"] | 13 | **exact**, order right |
| 6 (0108) | Plus condition removed | 21 | 13 + all 8 non-Plus; no misses |

`plus is present` excludes non-Plus earbuds correctly. The 6 (revisions 1/3)
and 8 (revisions 2/4) rows in its `leftOutOnlyByThis` are exactly the non-Plus set
above. Revision 6 shows the inverse: removing the condition added exactly those 8.
The `contains "Wireless Earbuds"` condition in revisions 1 and 2 rejected 0 rows.

## Per-trial verdicts (question 3)

| Trial step (rev) | Stored | Judge answers (step: answer) | Final | Correct verdict | Right or wrong | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| 0062 (1) | 10 | 0063 yes; 0064 recheck yes; 0065 no | unsure (`candidate.trial_unconfirmed`) | no | **Wrong** | The judges did see all three missing earbuds, by label alone, under the accessory condition ("alone 5": 2 real accessories plus #8, #9, #11). 0063 talked itself round to yes on a "Wireless Earbuds" condition that rejected nothing. 0064 said every left-out row is "excluded by the request's own words". 0065 named the real defect (two of the three rows) but added false claims: that the Plus test is wrong, and that Brightaisle Basics Sport is sponsored. It is organic rank 12, also shown in the carousel. No `leftOutNamingTheItem` was produced, though it exists for exactly this case. |
| 0071 (2) | 13 exact | 0072 no; 0073 yes; 0074 recheck no | no (`candidate.trial_judged_no`) | yes | **Wrong** | 0072: no because `contains "Wireless Earbuds"` "could" drop a pair, though that condition's account says rejected 0. 0073: a correct yes, held because it did not quote the request beside each of the 37 left-out rows. 0074 (recheck): no. It put the Plus condition's 8 rows under "condition 4", claimed two Aurelle Pods Fit rows were a failed dedupe (they are the two lookalike listings #5 and #9), and claimed Basics Sport lacks a Plus badge. Core's `checked` refuted one claim ("Brightaisle Basics Sport ... is in the result"), and the no still stood. |
| 0078 (3) | 10 | 0079 no; 0080 no | no | no | **Right** | 0080 got it right for the right reason: all three "Wireless Charging Case" earbuds, by name. 0079 reached no with false parts: it called Aurelle Echo 40H (stored row #4) missing, and blamed the rating condition for the Plus condition's rows. Core's `checked` refuted the first claim. 0080 also cast doubt on the Plus test. |
| 0084 (4) | 13 exact | 0085 no; 0086 no | no | yes | **Wrong** | 0085: "the 8 Plus-eligible earbuds" were dropped by a broken aria-label read, and "the page view shows the Plus badge on many of these listings". False: all 8 are non-Plus. 0086: the rating condition dropped 4.5-4.8 rows (those are the Plus condition's rows, misaligned), and price was read from the list price ($69.99 is the real price of a row the price condition left out). Both advised fixing the Plus test. That led to revision 6. |
| 0110 (6) | 21 | 0111 no; 0112 no | no | no | **Right** | Both: no condition tests Plus. Correct, and their advice to add `plus is present` back is correct. |

What misled the judges. Each item is checked against the request files.

1. **No condition wording, and three numbering schemes.** In every judge request
   of this run, `resultSummary.reads[0].conditions[]` entries carry only
   `rejected`, `alone`, `leftOutOnlyByThis` and `leftOutObservations`, with no
   `condition` text. The wording exists only in `flowShape[...s6].parameters.extractList.where`,
   an unnumbered list. `leftOutObservations[].conditionIndex` counts from 0. Core's
   recheck lines and `checked` lines say `condition "condition 2"` counting from 1
   (`request-rows/summary-reads.ts:68`), and the builder's feedback said
   `condition 2 (wording withheld)` (`service/candidate-trial/reads.ts:47`). The
   judges matched rows to the wrong conditions: 0074, 0079, 0086 above. Even
   Core's own `checked` ("condition 2 alone left out ... Kinetra Run") reads as
   support for the judge, because it does not say that condition 2 is
   `plus is present`.
2. **No tested value beside a left-out row.** The system prompt promises
   `label — column: value`. Here the labels are bare, and the values sit in a
   separate `leftOutObservations` list that has to be zipped by position. The
   Plus rows' observations say only `readKind: attribute, state: absent`, with
   nothing about what was looked for. Kept rows never show the Plus value
   (`valuesRead` covers rating, price and name only).
3. **`leftOutNamingTheItem` never fired** (`"leftOutNamingTheItem"` occurs 0
   times in all 12 requests). It needs `condition.testedLabel` (see the root
   cause below). The earlier whole-candidate run had it on its "charging case"
   revision (step 0039 there).
4. **Quote-every-row recheck.** Revisions 2 and 4 left out 37 rows across 6
   conditions. A yes is held unless every one is named beside a quote of the
   request (`request-rows/unquoted-rows.ts:34-55`, `verdict.ts:167-178`), and the
   recheck lists all 37 (`exclusion-evidence/recheck.ts:5-13`). The rating and
   price rows' values decide them mechanically, yet the model is asked to argue
   each one. On revision 2 the recheck turned the only yes into a no.
5. **End view of page 5 only.** The view gives `img "Brightaisle Plus"` as a loose
   line after each card's title, not tied to that card, and the kept and left-out
   rows sit on pages 1-4. 0085's "the page view shows the Plus badge on many of
   these listings" and 0074's "Basics Sport has no Plus image in the view" both
   rest on that view. This is a likely cause, not a proven one.
6. No truncation was involved. Every response finished `stop`, and every reads
   block says `truncated: false`.

## Root cause in Core (the judge input)

`C:/Users/osrs_/FluxStuff/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/result-verification/read-account/accounts.ts`:

- **Line 108**: `const authored = (attempt, nodeId) => attempt.parentAttemptId === undefined ? nodes.get(nodeId) : undefined;`.
  A subflow trial (`flow-bootstrap/verification/detached-subflow.ts`, header:
  "Each part runs across the C1 Call Subflow boundary") runs the target through a
  throwaway root of Call Subflow steps, so the read's attempts have a parent.
  `node` is therefore undefined at lines 110/114/117, and `account()` gets
  `authored === undefined` (line 143).
- That one guard removes several things:
  - The condition wording (line 214: `conditionText` needs `deniedKeys` and
    `written`, and `written` is `[]`).
  - The tested column (line 204), so no `label — column: value` (lines 209-210,
    `withTestedValue`).
  - `testedLabel` (line 221). So `request-rows/summary-reads.ts:68` sets
    `testedLabel` false, and `request-rows/left-out-naming-the-item.ts:51`
    skips every condition.
  - `dedupes` and `dedupeBy` (lines 153, 168-169), and `dropsEarlierPageRepeats`
    (line 158).
- Evidence that this branch, and not missing denied keys, is what ran:
  - `leftOutOnlyByThis` is present, which needs `deniedKeys` (line 209).
  - `narrowedBefore` is present, which needs the read's nodeId and definitionId
    in `flowNodes` (`result-summary.ts:237`). So the node *was* in `flowNodes`.
  - The looped account has no `dedupes` key, which a pass account always has
    when `authored` is set (`looped-account.ts:54`).
- The guard's stated reason (lines 89-92: "a part's node can share an id with one
  of them") does not hold for bootstrap parts, whose node ids are namespaced
  (`node.bootstrap.<hash>.find_earbuds.s6`). `value-readings` and
  `narrowed-before` already match the same node by id.
- The builder's trial feedback inherits the same loss
  (`service/candidate-trial/reads.ts:47`, "wording withheld").

Contributing (judge protocol, same as earlier debugs):

- `request-rows/unquoted-rows.ts:34-55` with `verdict.ts:167-178` and
  `exclusion-evidence/recheck.ts:5-13`: the yes is held, then rechecked, over
  rows whose own tested values settle them.
- `request-rows/summary-reads.ts:68`: falls back to `condition ${index + 1}`,
  counting from 1, while `leftOutObservations.conditionIndex` counts from 0.
- Presence conditions: `read-account/condition.ts:101-103` says the found value
  only for an own read or a column that is not stored. Kept rows' Plus value
  never reaches the judge, even in the earlier run, where the wording read only
  `plus is present` (why `seen` was not said there is not checked).

## Comparison with earlier debugs (question 4)

- `language-driven-flow-loop-plan/debugs/run-mv79nrcx-112c5ed7.md`: correct
  answers were labelled refuted because affirmative replies lacked row-local quotes
  (`verdict.ts:169-176`). The recheck plus `not_judged` fix that debug proposed
  now exists (`build-test/judge.ts:272`) and explains 0062's unsure. In 0071,
  though, the recheck itself flipped a correct yes to no: same weakness, new
  shape.
- `run-mv6qr7fk-77f30b49`: there is no file at the brief's path. The debug is
  `adaptation-and-breadth-plan/reports/w1-job-classifieds-debug.md` ("Run 2").
  There, judges made claims Core's own record contradicts (sort order, rows
  present), and the builder followed them. The same happens here: Plus, rating
  and list-price claims, and stored rows called missing. Core's `checked`
  refuted two such claims (0071, 0078) without changing the verdict or
  stopping the builder.
- `run-mv4v1v25-c7d57567` (2026-10-11, whole-candidate `test_candidate`):
  - Trial 0038: 10 rows, missing the same #8, #9, #11. Judged no (right).
  - Trials 0044, 0056, 0062, 0070: **exactly the 13 oracle rows**. All four were
    left unsure: answers yes/no, yes/unknown, unknown/no, yes/unknown.
  - Its judges *did* get the condition wording (`plus is present`,
    `rating atLeast 4`, ...), the tested values inline (`— rating: 3.8`),
    `dedupes`, and `leftOutNamingTheItem` (its step 0039).
  - Every doubt there was the Plus presence condition ("whether they are Plus
    eligible is not shown"). So even with full wording, a presence condition's
    left-out rows stop a correct answer being confirmed, and the subflow trial
    path removed the rest of the evidence on top of that.
  - Note: it was never *confirmed* correct by Core. It was correct only by this
    oracle.

## Recommended fix (no scenario wording)

1. **Give called-part reads their authored node** (`read-account/accounts.ts:108`).
   - When `parentAttemptId` is set, find the node in the called graph's nodes (the
     detached trial already has `candidateGraphs`), or in `flowNodes` when exactly
     one node has that id and definitionId.
   - Keep the counts-only path only where that is ambiguous.
   - Add a test in `read-account/tests/accounts.test.ts` next to the existing
     `parentAttemptId` case (line 113): a called part's looped read with `where`
     must carry the wording, the tested value, `testedLabel` and `dedupes`.
   - This one change gives subflow trials back what whole-candidate trials have,
     `leftOutNamingTheItem` included.
2. **One numbering for conditions.**
   - Each `reads[].conditions[]` entry should carry its own index and wording.
   - The recheck, `checked` and builder feedback should say the same index and
     wording (`summary-reads.ts:68`, `candidate-trial/reads.ts:47`), never a bare
     `condition N`.
3. **Settle value-tested rows in Core before asking for quotes.**
   - Leave out of `unquoted-rows` any row whose tested value Core read
     (`value-readings`) and found failing the condition's own bound.
   - Ask the model to quote only for text and presence conditions.
4. **Give presence conditions evidence on both sides.**
   - Say the value the condition found on its kept rows, and say on each
     left-out row that the same read found nothing there. For example: `plus (read
     "<value>" on every kept row; nothing on this row)`.
   - Then a judge can tell "lacks the marker" from "read broken" without the
     page view.
5. Optional: when Core's `checked` refutes a no's named row, re-ask that call
   with the refutation, as t501/t511 already do for page and order claims,
   instead of letting the no stand.

None of these teach the scenario. They are about how a condition, its index and
its evidence are shown, for any read on any site.

## What changed and why

Only this report was written.

## Commands run and observed results

- Oracle computed with `node a8audit-oracle.mjs` / `a8audit-oracle2.mjs` /
  `a8audit-nonplus.mjs` (scratchpad, importing
  `apps/scenario-lab/dist/scenarios/everything-store/...`). They printed
  "EXPECTED 13", the 13 records above, "unique names 13", and the 8 non-Plus
  candidates.
- `python -I a8audit-trials.py` (scratchpad) gave the stored rows per judge
  request against the oracle SKUs:
  - 0063-0065 and 0079-0080: 10 rows, missing B09HZLEPLS, B0HKSZ2BM6, B0X473P78X.
  - 0072-0074 and 0085-0086: 13 rows, missing none, extra 0.
  - 0111-0112: 21 rows, extra 8.
- The same script on run-mv4v1v25: 0045-0072 had 13 rows, missing none; 0039/0040
  had 10, missing the same 3.
- `python -I a8audit-conds.py` checked order and per-condition `alone`/listed
  counts. Order was right in every trial. `leftOutNamingTheItem` occurred 0 times.
- A diff of 0063 against 0064, and of 0072 against 0074, showed the only addition
  is the `recheck:` block. 0065 and 0073 are byte-identical to 0063 and 0072.
- I read the trial `result.json` files for verdict, code, `checked` and advice,
  and the judge `response.txt` files for each answer.

## Not verified

- I did not see `parentAttemptId` directly on this run's attempts: the step
  folders do not record attempts. It is inferred from the evidence listed under
  the root cause.
- That the free-floating Plus `img` lines in the page-5 end view caused 0085's
  claim is likely, not proven.
- Why the earlier run's `plus is present` wording lacked the "(read ... on a row
  it kept)" part (`condition.ts:101-103`) was not checked.
- I did not trace the exact order of call 1, recheck and call 2 in
  `agreement.ts`. The final verdicts are taken from `result.json`.
- I did not look into the build's final `flow_bootstrap.post_provider_validation_failed`.

## Open questions or contradictions found

- The brief's path for the mv6qr7fk debug does not exist. I used
  `docs/working/adaptation-and-breadth-plan/reports/w1-job-classifieds-debug.md`.
- The brief calls run-mv4v1v25 "a correct earlier build". Its revisions were
  correct by the oracle, but Core never confirmed one (all four were unsure), and
  the run failed on time.
- A debug for this run already exists
  (`language-driven-flow-loop-plan/debugs/run-mv7vor5f-ea4d08b4.md`). The brief
  did not name it, so I did not read it, and this report may overlap it or
  contradict it.
