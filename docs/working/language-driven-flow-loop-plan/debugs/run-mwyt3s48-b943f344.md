# run-mwyt3s48-b943f344: kestrel auctions, achieved with the right ten rows, judged wrong on one title

Lane: `live-lane-2` (tree `fxwork/t1059-live-lane-2`). Task: `auction-marketplace/auction-marketplace-kestrel-auctions`,
answer-first, attempt 1, Anthropic `claude-sonnet-5-5`. fluxiq 0.54.34 (after t1074 and t1070).
Attempt 1 ended achieved: 19 calls (interpretation 1, judge 1, decisions 17), $1.2551, 149 s, 10 rows "Found 10 of 10".
Lab verdict wrong: `records: failed`, `shown: failed`. Attempts 2-4 did not run, because the first answer was wrong.
Evidence: bundle `fxwork/t1059-live-lane-2/test-runs/instances/live-lane-2/attempts/run-mwyt3s48-b943f344/`, step
files `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-27/run-mwyt3s48-b943f344/steps/` (0001-0037). Debugged offline from
those files and the code on `dev`. No live or paid run was used and no code was changed.

## In one paragraph

The run found exactly the ten auctions the task owes, in the right order, with the right price, bids and postage in
every row. One cell was wrong: row 9's title reads `New listingKestrel 35 Kamera Messsucher 45mm 2.8 — sehr gut`. The
oracle wants `Kestrel 35 Kamera Messsucher 45mm 2.8 — sehr gut`. The card shows a red "NEW LISTING" badge in its own
span before the title. The extension's list detection offered two title fields with identical samples: `link`, the
whole link text with the badge glued on and no space, and `link_text`, the title span alone. The model picked `link`.
Both `records` and `shown` fail on that one cell. The model's conditions were right, t1074's evaluation and column
placing worked as designed, the read missed nothing, and the oracle is fair. The root cause is in the read layer: it
offers a glued copy of the title as a field of its own (`apps/extension/src/content/extraction/infer-fields.ts:515-525`).

## What happened

| Steps | What it did |
| --- | --- |
| 0002-0008 | Opened the site, pressed Reject all on the cookie banner, searched `kestrel 35`, clicked the Auction tab (`LH_Auction=1`, "42 results"). |
| 0010 | `web.detect_repeating_structure` on the results: 26 items. It offered `link` ("link: 'Kestrel 35S rangefinder camera, 40mm…'", coverage 1), `link_text` ("text: 'Kestrel 35S rangefinder camera, 40mm…'", coverage 1) and `link_text_2` ("text: 'New listing'", coverage 0.08), as well as `price`, `text_4` (the "approx. £" estimate, 0.31), `text_5` (bids), `text_8` (end time) and `text_9` (postage). |
| 0012 | Read refused: the handle was passed in `target` rather than in `extractList` (`handle_in_wrong_parameter`). The next call recovered. |
| 0014, 0016, 0020 | Read page 1 (26 rows), Next page, read page 2 (20 rows). 46 rows in all, the same 46 as run-mwyn25dg. |
| 0018 | First processing declaration, with `columns: ["link", "price", "text_5", "text_9"]`. It kept 6 rows. The rows it printed already showed `"title": "New listingKestrel 35 Kamera Messsucher…"`. |
| 0021-0024 | Draft amendments: drop the duplicate read, repeat the read through Next page, mark it as the result (applied). 0023 sent the same thing again and was refused `already_so`. |
| 0026 | Second declaration: narrower accessory words and `sort text_8 asc as date`. It kept 11 rows, with the body + case auction twice (once as an ad on page 1, once on page 2). |
| 0028 | Third declaration: `dedupe by [link, text_8, price]`. It kept 10 rows, the final answer. The placing line said "title is link (the declaration's order), price is price, bids is text_5 (its values name it), postage is text_9 (its values name it)". |
| 0029-0035 | Sent the repeat and result amendments twice more (`already_so` both times), a `same_fix` steer (0031), `change_approach` (0033). |
| 0036 | Complete, with the 10 rows. |
| 0037 | The judge passed it: "All the conditions are met." It did not notice the badge glued onto row 9. |

## 1. Row by row against the expected dataset

Expected records: `KESTREL_AUCTIONS` (`apps/scenario-lab/src/scenarios/auction-marketplace/manifest.ts:21-23`: m1-m10
sorted by `endsIn`), read through `kestrelRecords()` (`manifest.ts:95-100`, the title is `listing.title`). They are
pinned in `apps/scenario-lab/src/scenarios/auction-marketplace/tests/catalog.test.ts:74-85`. The comparison is exact
and in order (`packages/test-runner/src/run-expectations/extraction/value-match.ts:41-42`, `judgement.ts:90-96`).
I checked it with a scratch script that rebuilt each expected row from `catalog/cameras.ts` and `catalog/money.ts` and
compared it with `attempt-1/answer-turn.json`:

| # | Listing | endsIn | Title | Price | Bids | Postage |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | m1 | 95 | ok | £64.00 ok | ok | ok |
| 2 | m2 | 312 | ok | EUR 109,00 ok (estimate £94.60) | ok | ok |
| 3 | m3 | 545 | ok | £41.00 ok | ok | ok |
| 4 | m4 | 1034 | ok (camera + case counts) | £96.00 ok (also offers Buy it now, counts) | ok | ok |
| 5 | m6 | 2011 | ok | US $189.00 ok (estimate £141.05) | ok | ok |
| 6 | m5 | 2045 | ok ("light meter dead" but working: counts) | £27.50 ok | ok | ok |
| 7 | m7 | 3162 | ok (camera + lens counts) | £78.00 ok | ok | ok |
| 8 | m8 | 4331 | ok (camera + flash and manual counts) | £122.00 ok | ok | ok |
| 9 | m9 | 5770 | **wrong**: `New listingKestrel 35 Kamera Messsucher 45mm 2.8 — sehr gut`, expected `Kestrel 35 Kamera Messsucher 45mm 2.8 — sehr gut` (`catalog.test.ts:83`) | EUR 169,00 ok (estimate £146.68) | ok | ok |
| 10 | m10 | 7005 | ok | £35.00 ok | ok | Collection in person ok |

- Nothing is missing, nothing is extra, and nothing is out of order. The `text_8` date sort gave exactly the
  soonest-ending order.
- Foreign currency was handled correctly. Kept: m2 (EUR 109,00, about £94.60), m6 (US $189.00, about £141.05), m9 (EUR
  169,00, about £146.68). Left out at £150 or more: x9 (EUR 175,00, about £151.88), x10 (US $210.00, about £156.72), x7
  (EUR 1.165,00), x8 (£152.00). All by the `anyOf` alternatives, as t1074 intended (0028 filter account).
- For parts or not working: x1, x2, x3, x12, x13 and o5 were all left out (`text_2` condition and title words).
- Accessories (lens cap, case only, box only, manual reprint, hood, strap, filter, self-timer, lens only, flashgun) and
  the 35S, Mk II, 350 and 50 were all left out. Cameras sold with extras (m4, m7, m8) were kept.
- Fixed-price listings: the Auction tab removed them, and the two "Buy it now" ads (Vantor V2, leather half case) were
  left out by `text_5`.
- Repeats: m4 appeared twice (an ad on page 1, organic on page 2) and m8 once on each page, because the pages overlap.
  0028's dedupe kept one of each.

Why the badge is there: m9 was listed 300 minutes ago (`catalog/cameras.ts:28`, `listedAgo: 300`). A listing counts as
new for 1,440 minutes (`pages/card.ts:12-13`). The heading is
`<div role="heading"><span class="badge">New listing</span><span>title</span></div>` (`pages/card.ts:54-57`). The badge
is styled apart: red, upper case, with a 6px gap (`pages/styles.ts:139`). A person sees "NEW LISTING" and then the
title. The glued text `New listingKestrel…` is not what the page shows anywhere. The manifest's own read takes the
title from `a span:last-child` (`manifest.ts:89`) for this reason. The same badge is on l2 (`New listingKestrel 35-S…`),
which was rightly left out.

## 2. What `shown: failed` means here

It is the same cell, not the table or its columns. `judgeShownAnswer`
(`packages/test-runner/src/flow-lane/creation/answer/judge-shown.ts:72-74`) compares the chat turn's table rows
(`previewRows`) with the expected records, using the same `measureExtraction` and exact match (`judge-shown.ts:29-36`).
The turn showed all 10 rows (`totalRows` 10 equals the 10 expected) under exactly `title, price, bids, postage`. Nine
match at their positions and row 9 does not, so `matchedRecords` is 9 of 10 and the check fails
(`score-answer.ts:36`, `not_shown`). `records: failed` comes from the stored dataset through the same exact comparison
(`judge-answer.ts:68-69`, `score-answer.ts:31`).

## 3. The cause of the one difference

| Candidate | Verdict | Evidence |
| --- | --- | --- |
| Model's conditions | Not the cause | Every `where`, `anyOf`, sort and dedupe kept exactly the owed ten (0028 filter account; table above). The `kestrel 35` and exclusion patterns ran on `link`, but the badge changes no filter result: `link` and `link_text` differ only by the prefix on l2 and m9. |
| Model's column choice | Immediate cause | All three declarations named `link` as the first column (0018, 0026, 0028). The badge was visible to it three times: in the page view (`t670 link "New listingKestrel 35 Kamera…"`, `0014/page.txt:268`), in 0018's printed rows, and in each filter account's left-out titles. It still did not switch. |
| Read layer (field offer) | **Root cause** | Detection offered a glued copy of the title as its own field, with a sample identical to the clean field (0010). See below. |
| Data layer, t1074 evaluation | Worked | `anyOf` alternatives decided every foreign and pound price correctly. |
| Data layer, t1074 column placing | Worked as designed | It placed `title` on `link` "by order" (`!FluxIQ/packages/contracts/src/record-sets/asked-columns/map.ts:74-80`), because the declaration's own columns named `link` and nothing contradicted it. It never asks whether the placed field is a glued copy of another one. |
| Derived pound estimate | Worked | The `gbp` derive from `text_4` and `own` from a pound `price` read every row. |
| Read missing a field | No | `text_4` (estimate) and `text_8` (end time) were read on every row that has them. |
| Oracle or task wording | Not a defect | The task asks for "title … exactly as the listing's search result shows it". The title is the title. The badge is a separate, differently styled label, and the glued string is shown nowhere. Expected values match the fixture (`catalog.test.ts:74-85`). |

**Root cause in the read layer.** List detection collects fields from every item of the run and merges them
(`apps/extension/src/content/extraction/infer-fields.ts:302-321`). A link's own words become a text field when
`offersOwnText` allows it (`infer-fields.ts:422-424`). That rule exists so the same value is not shown to the model
twice. It returns false when the link's words are all one descendant's (`infer-fields.ts:520`). On 24 of the 26 cards
that holds: the link's words are the title span's, and nothing is offered. On the two badge cards the link's words are
the badge span's plus the title span's, which is no single descendant's, so the link's words are offered. The merge
then gives that field coverage 1 across the run. Its value is read with `textContent`
(`field-reader.ts:128`, `content/sensitive-text.ts:47-48`), which joins the two spans with no space. So the model was
shown `link` and `link_text`, both labelled with the same sample from card 1, and could not tell them apart until a
badge card's value came back. The comment above `offersOwnText` (`infer-fields.ts:503-506`) states the intent: "the
same value is not put in front of the model twice under two labels". A badge breaks that intent.

**Comparison with t1074's offline proof.** The proof (`!FluxIQ/packages/contracts/src/record-sets/process/tests/run-mwyn25dg/tests/any-of-alternatives.test.ts:21`,
`:90`) replays 0053's declaration over the same 46 rows and keeps exactly the ten. But that run's model had chosen
`COLUMNS = ["link_text", …]`. The fixture does carry m9's glued `link`
(`process/tests/run-mwyn25dg/rows-fixture.ts:20`), but no declaration in the proof names `link`. So the proof held for
the filters and the placing, and never tested which title field a model picks. This run picked the other one.

## 4. Proposed root-cause fixes, each with an offline proof

No cap, no limit, nothing that names this site, listing or answer.

**F1, read layer (primary): a mark inside a value is not part of the value, and a link is not offered twice.** In
`apps/extension/src/content/extraction/infer-fields.ts`, decide over the run, not per card:

- A text leaf that says the same words on every item that has it, and appears on at least two items, is a mark.
  `badge-name.ts` already treats a constant accessible name this way, and the user's data-layer rule (2026-11-20) asks
  for markers to be kept "beside the asked columns". Keep it as its own field: here `link_text_2`, "New listing", on
  2 of 26 items.
- A link whose words, once its marks are left out, are one offered leaf's words on every item is that leaf's column. Do
  not offer it as a text field (only its URL).
- A link with words of its own (for example a highlighted search word: `Best <mark>tomato</mark> soup`) or whose words
  are split over value pieces on every item keeps today's behaviour.

The result here would be: `link_text` is the only title field, `link_text_2` is the "New listing" mark, and `link` is
URL only. A model then cannot pick the glued copy.

Offline proof:

- (a) A unit test in `apps/extension/src/content/extraction/tests/` on a synthetic page of a different kind (for
  example a recipe list with a "Popular" badge on two of ten cards). Assert: no text field reads a badge-plus-title
  value, the title field reads the bare title on every card, and the badge is one field at 2/10 coverage. Counter-cases:
  a link with its own highlighted words still offers its text, and a title split into two value spans on every card is
  unchanged.
- (b) Provider-free, on this scenario's results page with `_nkw=kestrel+35&LH_Auction=1` (the browser harness in
  `apps/scenario-lab/src/scenarios/auction-marketplace/tests/browser.test.ts`). Run detection on the result list and
  assert: no field's value on the m9 or l2 card starts with "New listing", and the title field equals `listing.title`
  on all 26 cards.
- (c) Replay this run's 0028 declaration, with `link` read as `link_text`, over the 46 recorded rows (copy
  `read.extracted` from steps 0014 and 0020, as `rows-fixture.ts` does for run-mwyn25dg) through
  `automationStudioAnswerFirstDataStage` with asked columns title, price, bids, postage. Expect 10 rows equal to
  `catalog.test.ts:74-85`, in order. From the recorded rows, `link` and `link_text` differ only on l2 and m9, so the
  filters keep the same ten.

**F2, data layer (defence in depth): the column placing checks that a placed field is not a glued copy.** In the data
stage's column placing (`!FluxIQ/packages/contracts/src/record-sets/asked-columns/map.ts`, step 3 "by order",
`:74-80`; text in `!FluxIQ/packages/fluxiq/src/framework/automation-service/service/answer-first/result-feed/column-names.ts:26`):

- When the field placed for an asked column equals another stored field on some kept rows, and on the rest equals that
  field with a third stored field's words joined on, the placed field is that field plus a mark.
- Place the asked column on the clean field "by its values" and say so in the placing line, for example "title is
  link_text (link adds link_text_2's words on 1 row)". The evidence is upstream data the reads already hold, so this is
  the framework cleaning from upstream data, not a model rule. The same line reaches the judge, which missed it here.
- Offline proof: replay 0028's declaration exactly as sent (`columns: ["link", …]`) over the same 46 recorded rows.
  Today row 9's title is glued, which reproduces the failure. With F2 the 10 rows equal `catalog.test.ts:74-85` and the
  placing line names `link_text`. Add a counter-case where two fields differ by words that are not another field's
  value: nothing is re-placed.

F1 removes the trap where it starts. F2 covers any other way a glued field reaches the result, for example a read
authored with explicit selectors. I recommend both, F1 first.

## Side findings (not the verdict's cause)

- **The same amendment sent three more times** (0023, 0029, 0034: repeat step 7 while step 8, mark it as the result).
  Each was refused `already_so` after 0022 had applied it, then came the `same_fix` steer (0031) and a loop decision
  (0032). Four calls, about $0.28, bought nothing. run-mwyn25dg showed the same pattern (three `already_so` and a
  `same_fix` steer, 0017-0043). It recurs, so it needs a structural look: why the model does not believe the draft
  already says this. That is a separate brief.
- **The handle in the wrong parameter** (0012) cost one call. The refusal said where the handle belongs and the next
  call recovered.
- **The judge (0037) passed a glued title.** F2's placing line would give it the evidence. No judge-only change is
  proposed.
