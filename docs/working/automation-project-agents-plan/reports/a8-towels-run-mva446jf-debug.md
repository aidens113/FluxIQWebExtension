# A8 frozen pair 4: candidate towels, run-mva446jf-926a3c72 (read-only debug)

Run: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-15/run-mva446jf-926a3c72`, task
`bigbox-retail-pickup-towels`, mode `candidate`, downstream `9c1e164d`, Core
`0df06e34`. Ended `lab.chat_build_failed` after 51 steps, $0.036.

## Outcome

Done (diagnosis only; no source changed). There are two Core defects. They
stack, and either one alone would have let the build through:

1. **The resend that t641 invites can never be made (general).** The generic
   repeat guard records every refused submission as a `failed` outcome keyed on
   the Flow and the revision that stands. The kept-condition refusal leaves that
   revision standing on purpose, so the resend Core asked for has the same key
   and the guard refuses it unrun. Three such refusals in a row ended the build.
2. **Core vindicated a condition that wrongly excludes asked rows (general).**
   Condition 4, `retailer startsWith "ValueRidge"`, reads the **product name**,
   not a seller. The t629 "request's own words" test counted it as encoding the
   request, because the word "ValueRidge" appears in the request. Core then
   overruled four judges and held the condition through t641. Seven of the eight
   rows it "accounted for" are in the oracle's nine.

Condition 2 (`fulfillment contains "Pickup today"`) was held correctly.

## What changed and why

Nothing changed: this was a read-only brief. The findings follow.

### Timeline (steps)

- 0020 rev 1: no site filters. The read had seven fields and four conditions:
  sponsored absent, `fulfillment contains "Pickup today"`, `rating atLeast 4.5`
  and `retailer startsWith "ValueRidge"`, where the field `retailer` is
  `span_css-195vhdq`. It paged three pages.
- 0022 trial 1: saw 41 rows, kept 2, judged no. Condition 4 rejected 34 rows,
  8 of them by itself. Both judges (0023/0024) said condition 4 tests the
  product-name prefix rather than the seller. Judge call 2 was printed as
  "contradicted by Core's record".
- 0036 rev 2 was refused `candidate.kept_condition_dropped:7b212a27`. It used
  the Retailer facet (t953) and the Speed "Today" facet (t945), and dropped
  conditions 2 and 4. Core held both conditions, each with all its kept-out rows
  `by: request_words`.
- 0038 rev 3 obeyed: it kept all four conditions and added the Retailer facet.
- 0040 trial 2: saw 29 rows, kept 2, judged no. 0041/0042: "kept only 2 rows,
  but the request asks for every ValueRidge-sold...". Core again printed the
  judges' reading as contradicted by its record.
- 0044 rev 4 dropped only condition 4 and kept the Retailer facet. It was
  refused `candidate.kept_condition_dropped:ff8e892f`, whose words end: "If you
  mean to drop or change it anyway, submit the same change again: Core refuses
  this once, not twice."
- 0046, 0048 and 0050 were the same script, sent as invited. Each was refused
  `llm_evidence_loop.repeat_refused` with `sameAsCall: submit-candidate-4` and
  `then.outcome: failed`. The counter went 1 → 2 → 3 (`maxRefusedInARow` 3),
  the round stalled, and the build ended. The person-facing message said "it was
  sent again unchanged 3 times", but the model was following Core's own
  instruction.

### (1) Mechanism: the repeat guard blocks the t641 resend (confirmed)

Core `packages/fluxiq/src/programs/automation-studio/runtime/`:

- `flow-bootstrap/candidate/submission.ts:188-192`: a dropped kept condition sets
  `this.current = standing` and returns `ok: false`. The revision that stood
  still stands.
- `submission.ts:214-222` (`keptDropped`): it adds the condition to `keptRefused`,
  so the controller itself would accept the identical resend. It never sees it.
- `llm/evidence-loop.ts:452`: `recorded({... refused: value.ok === false ...})`
  for every call.
- `llm/repeat-guard/outcomes.ts:378-379`: a `core.submit_candidate` key is the
  tool, the page, `standing` (the digest of the last *accepted* submission,
  unchanged by a refusal) and the Flow alone (`keyedInput`, 498-503).
- `outcomes.ts:423`: `failed = call.refused || ...`. Lines 441-449 then store
  `outcome: "failed"` with the refusal's issues. Nothing distinguishes a refusal
  that invites a resend.
- `evidence-loop.ts:762`: `handling.repeats.blocks(decision.toolId,
  decision.input)` returns that outcome for the resend: same page (no browser
  act between), same standing digest, same Flow. The resend is refused unrun,
  `refusedAgain` counts it, and the third in a row stalls the round.
- The repeat policy would not also block it. A refused submission (`effect:
  "observe"`, not applied, `ok: false`) is `LookWasRefused` (`llm/repeat-policy.ts:124`),
  so `answeredRequests` drops its signature (`evidence-loop.ts:445`). Only the
  guard stands in the way.
- The tests cover the controller alone
  (`flow-bootstrap/candidate/tests/kept-condition-drop.test.ts:60-98`, and the
  subflow twin). No test sends the resend through the loop, so the override has
  never been reachable in a live build.
- The same applies to `core.submit_subflow`. The scoped controller passes the
  inner refusal through (`flow-bootstrap/subflow-candidate/scoped-submission.ts:191-196`),
  and the guard records it as `failed` under the whole input.

**Structural fix (general).** A refusal that invites a resend says so in a
machine field, and the guard admits that one resend. The guard is not weakened
for any other refusal.

- `flow-bootstrap/candidate/submission.ts` `keptConditionRefusal`: add a marker
  to `feedback`, for example `resend: "accepted_once"`, beside `code`. It must
  be Core-written, never taken from model text. It reaches the tool's JSON as
  `diagnostics.resend`. Check that `authoring-loop.ts` and the subflow
  submit-tool wrapper carry `feedback` through as `diagnostics`; the candidate
  path does, as this run's 0036/0044 `result.json` shows.
- New `llm/repeat-guard/resend-invited.ts`, exported from the barrel: a
  function that reads a refusal answer and reports whether it invites a resend
  (`diagnostics.resend === "accepted_once"` or a top-level `resend`). It works
  on plain JSON and names no build code, so the guard stays generic.
- `llm/repeat-guard/outcomes.ts` `recorded()`: when `call.refused` and the
  answer invites a resend, and its key is not in a new `admitted: Set<string>`,
  delete `outcomes.get(at)`, add `at` to `admitted`, and return without
  recording a failure. A second inviting refusal on the same key is recorded as
  `failed` as now, which bounds it to one resend. Add a header paragraph naming
  this run.
- No change is needed in `evidence-loop.ts` or `candidate-feedback.ts`.

**Tests:**

- `llm/repeat-guard/tests/resend-invited.test.ts`:
  - A refused `core.submit_candidate` whose answer carries the marker leaves
    `blocks()` undefined for the identical Flow on the same page.
  - A second marked refusal on that key makes `blocks()` return `failed`.
  - An unmarked refusal (`candidate.loop_or_binding_refused`, the unchanged
    refusal) still blocks: the guard is not weakened.
  - The same holds for `core.submit_subflow`.
- `flow-bootstrap/candidate/tests/kept-condition-resend-loop.test.ts`: a scripted
  model through the real authoring loop and evidence loop submits, gets a trial
  no with a kept condition, drops it (refused `kept_condition_dropped`), resends
  word for word, and is answered `ok: true` with a new revision, not
  `repeat_refused`.
- `flow-bootstrap/subflow-candidate/tests/kept-condition-resend-loop.test.ts`:
  the same through the builder loop.

### (2) The kept-condition refusals on their merits

Site truth comes from the downstream `apps/scenario-lab/src/scenarios/bigbox-retail/`.
The oracle is `manifest/expected-values.ts` `PICKUP_TOWEL_RECORDS`, nine rows.
The catalog is `catalog/paper-towels.ts`, and the facet is
`search/facet-groups.ts:36` (Retailer: `product.seller === "ValueRidge"`). The
result tile shows no seller at all: the Retailer facet is the only seller signal
on the results page.

**Condition 2, `fulfillment contains "Pickup today"` (held at 0036): Core was
right.** It kept out only "ValueRidge Essentials Paper Towels, 1 Roll". The
catalog has `pickupAt("today", { [HOME]: "tomorrow" })`, so the home store
(Carden Falls, 2291) has it only tomorrow, and the oracle leaves it out. Rev 2
would have replaced condition 2 with the Speed "Today" facet. That facet also
counts delivery today, as `manifest/pickup-towels-workflow.ts` says, so it would
have let through listings the home store can pick up only tomorrow. Holding
condition 2 was correct.

**Condition 4, `retailer startsWith "ValueRidge"` (held at 0036 and 0044): Core
was wrong.** Its eight kept-out rows were:

| Kept-out row | Oracle? | Why |
| --- | --- | --- |
| Loftwell Ultra Strong Paper Towels, 6 Double Rolls | yes | seller VR, pickup today, 4.8 |
| Loftwell Select-A-Size Paper Towels, 12 Double Rolls | yes | |
| Softerra Paper Towels, 6 Double Rolls | yes | |
| Hearthside Paper Towels, 12 Double Rolls | yes | |
| Softerra Pick-A-Sheet Paper Towels, 12 Triple Rolls | yes | |
| Kindleaf Unbleached Paper Towels, 4 Rolls | yes | |
| Hearthside Select-A-Size Paper Towels, 8 Double Rolls | yes | |
| Loftwell Countertop Paper Towel Holder, Bamboo | no | a holder (department "Paper Towel Holders"), not "a pack of paper towels". Excluded by the request's item words, not by "ValueRidge" |

So 7 of the 8 rows that Core said were "accounted for by the request's words
'ValueRidge'" are rows the request asks for. The judges were right in substance
at 0023/0024 and 0041/0042: the field reads the product name, and a
seller/marketplace distinction is not a brand prefix. One stray claim in judge
call 1 was wrong: Tidemark 8 Double Rolls is "Pickup tomorrow".

**What Core measured.** Each row's witness value for the `retailer` field was
the row's own label. In the judge text, Core read "Loftwell Ultra Strong Paper
Towels, 6 Double Rolls" on the row labelled "Loftwell Ultra Strong Paper Towels,
6 Double Rolls". The kept-row value printed in the condition's own name was
"ValueRidge Essentials Select-A-Size Paper Towels, 6 Double Rolls", which is a
stored row's name. Core measured only that "the name does not start with
'ValueRidge'". It never measured that this field carries what the request's word
is about.

**Where the defect is.** All paths are under `result-verification/` in Core.

- `refuted-no/request-text-test.ts` (t629): a positive literal text test counts
  as "the request's own words" when every operand runs word for word in the
  request and no cue word is within 3 words before or 2 after.
  - "ValueRidge" appears twice in the request. "On ValueRidge, find" is the site
    name. "that ValueRidge sells itself rather than a marketplace seller" is the
    seller.
  - The cue "rather" is the third word after, outside `AFTER = 2`
    (`request-text-test.ts:41-42`), so both occurrences are "clean".
  - The test never asks whether the condition's field holds the attribute those
    words describe.
- `refuted-no/record.ts:91-115` (`requestQuotes`): every settled row with a
  `present` witness becomes `quoted` (`quotesRequest`), even when the witness
  value is the row's own label.
- `refuted-no/record-conditions.ts:62-67` → `by: "request_words"`.
  `standing-no-record/record.ts:92-97` (`keptOutOf`) then marks every row
  accounted for, `standing-no/kept-conditions.ts:54-56` keeps the condition, and
  `flow-bootstrap/candidate/submission.ts:214-222` refuses its drop.
- The same quotes drive the "contradicted by Core's record" banners on the
  judges' expected and observed text (`refuted-no/advice-condition.ts:149`,
  `missing-claim.ts`). Core therefore discredited correct judges twice.
- `value-readings/settled-rows.ts` is not at fault. It settles only "fails the
  condition as written", and its own header says a yes must still show the
  condition is the request's. The leap from that to "the request's words
  exclude it" is made in t629/t631.

**Proposed fix (general; Core refutes only what it measured).**

- **Primary**, in `refuted-no/record.ts` `requestQuotes`: a settled row whose
  witness value is, after folding, the row's own label
  (`automationStudioRequestRowLabel(row)`) is not quoted. The condition then
  tests the row's name, and Core never measured that a name failing the
  request's word means the request does not ask for the row. Better still, do
  this at the condition level: skip the whole condition when, on any row it
  kept, the tested value equals that row's label or another recorded column's
  value on the same row. Such a field duplicates the name, and the
  `(read "…" on a row it kept)` value already shows it.
  - Effect: condition 4's rows lose `request_words`, so `keptOut` is absent, it
    is never a kept condition, the judges' readings are not marked contradicted,
    and the 0044 drop is accepted.
  - Condition 2 is unaffected: its witness values ("Pickup tomorrow" and so on)
    are not labels.
  - Cost: a genuine brand-in-name condition (say "every Loftwell towel") also
    stops being vindicated. That is the conservative direction: the judges'
    reading stands, and a yes must still quote, as for any unsettled row.
- **Secondary, optional**: also treat a cue anywhere later in the same clause
  segment as non-clean, not only within 2 words, so "X sells itself rather than
  Y" is caught. This would have caught this run alone, but it is a word-window
  heuristic and should not replace the primary fix.
- **Tests:**
  - A new `refuted-no/tests/request-words-name-field.test.ts` with a generic
    fixture: a hardware store whose request names its own house name as seller,
    and a condition on the title field that starts with that house name. Never
    the bigbox site, products or words. Show that its left-out rows are not
    `request_words`, that a judge's "missing rows" is not marked contradicted,
    that a value-field condition (a badge whose value is the request's words) is
    still quoted, and that a witness equal to the label is not.
  - Extend `standing-no/tests` and `candidate/tests/kept-condition-drop.test.ts`:
    a name-field condition is not kept, and its drop is accepted the first time.

### (3) Rest of the losing path: Flow shape against the oracle

- **Rev 1 (trial 1)** read all three pages with no facets. Without condition 4
  it would have stored 10 rows: the 9 oracle rows plus the Loftwell Countertop
  holder, which passes sponsored-absent, pickup today and rating 4.6. A
  department restriction, the "Paper Towels" Department facet the oracle uses,
  is still missing. Dedupe of the sponsored copy by condition 1 is correct.
- **Rev 4 (0044)**, the one blocked, would have stored the same 10 rows under
  the Retailer facet: the 2 kept plus 8 from condition 4's kept-out list, the
  holder among them. It was one step from the oracle; the next judge "no" would
  most likely have named the holder.
- **Rev 2 (0036)**, had it been resent and accepted, would also have let in
  tomorrow-pickup listings through the "Today" facet. Core's hold on condition 2
  was useful there.
- **Field naming.** The model named the product-name selector `retailer`. The
  tile carries no seller, so no row field can test seller; only the facet can.
  The model found that at 0028-0034. Model guidance needs nothing
  task-specific; fixes 1 and 2 are enough for the model's own correct reading to
  land.
- Paging (3 pages, then 2 under the facet) and order were right; the bot check
  on the third document passed.

## Commands run and observed results

- Read the step files with `cat` and `python -X utf8` JSON dumps:
  0001, 0020, 0022, 0036, 0038, 0040, 0043-0046, 0048, 0050, and
  `summary.json` `firstFailure`. The key values are quoted above.
- Read in Core: `llm/repeat-guard/outcomes.ts` (whole),
  `flow-bootstrap/candidate/submission.ts:1-40` and `90-310`,
  `llm/evidence-loop.ts:440-456` and `740-800`, `llm/repeat-policy.ts:124-127`,
  `result-verification/standing-no/kept-conditions.ts`,
  `value-readings/settled-rows.ts`, `refuted-no/request-text-test.ts`,
  `refuted-no/record.ts:1-120`, `refuted-no/record-conditions.ts`,
  `standing-no-record/record.ts:80-100`, and
  `subflow-candidate/scoped-submission.ts:185-215`.
- Ran `grep` for `kept_condition_dropped` in `*.test.ts`. It found only the two
  controller-level `kept-condition-drop.test.ts` files, so no loop-level test
  exists.
- Read downstream: `bigbox-retail/manifest/pickup-towels-workflow.ts`,
  `manifest/expected-values.ts`, `catalog/paper-towels.ts` (the relevant rows),
  `search/facet-groups.ts`, and `live-tasks.ts`.
- No tests and no builds were run: the brief was read-only.

## Not verified

- I did not check that the subflow submit tool's JSON carries `check.feedback`
  as `diagnostics`, which is where the proposed marker must reach the guard. I
  read only that `scoped-submission.ts` passes the inner refusal through.
- I did not open `snapshots/` to confirm byte for byte that `span_css-195vhdq`
  is the title span. I inferred it from Core's own quoted witness values, which
  equal each row's label.
- The 10-row prediction for rev 4 is derived from the catalog and the trial's
  kept-out lists, not from a run.
- I did not check whether the secondary cue-window change would break existing
  t629 fixtures.
- None of the proposed fixes was implemented or tested.

## Open questions or contradictions found

- t641's header says "the same drop submitted again is accepted, so the refusal
  is a hint the model can override, never a block". In the loop it is a block,
  because the t503 guard key deliberately ignores refusals when picking
  `standing`. The two designs were never tested together.
- For a field that duplicates the row label, t629's rationale ("the condition
  only restates the request: then Core measured what the dispute is about") is
  false. The dispute is about which attribute the field holds, which Core does
  not measure.
- The person-facing ending ("sent again unchanged 3 times") blames the model
  for following Core's instruction. Fix 1 removes the case.
