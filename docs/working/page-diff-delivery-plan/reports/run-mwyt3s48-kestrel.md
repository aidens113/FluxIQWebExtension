# Report: run-mwyt3s48-b943f344 (kestrel auctions) debug

Brief: diagnose why attempt 1 of `auction-marketplace-kestrel-auctions` was judged wrong after ending achieved. This
was diagnosis only: two documents written and no code changed.
Full debug: `docs/working/language-driven-flow-loop-plan/debugs/run-mwyt3s48-b943f344.md`.

## Outcome

Done. The answer had the right ten auctions, in the right order, with the right price, bids and postage. One cell was
wrong, and both `records: failed` and `shown: failed` come from it. Row 9's title was
`New listingKestrel 35 Kamera Messsucher 45mm 2.8 — sehr gut`. The oracle expects
`Kestrel 35 Kamera Messsucher 45mm 2.8 — sehr gut` (`apps/scenario-lab/src/scenarios/auction-marketplace/tests/catalog.test.ts:83`).

- Immediate cause: the model's declarations named the read field `link` for the title, not `link_text`
  (steps 0018, 0026, 0028).
- Root cause: list detection offered `link`, a glued copy of the title with the card's "New listing" badge joined on and
  no space, next to `link_text`, the clean title. Both carried the same sample, so the model could not tell them apart.
  The rule meant to stop the same value being offered twice (`apps/extension/src/content/extraction/infer-fields.ts:515-525`,
  check at `:520`) covers a link holding one text leaf, not a badge leaf plus a title leaf. Fields are merged across
  the whole run (`infer-fields.ts:302-321`), so the two badge cards put `link` in front of the model at coverage 1.
- Not the cause: the model's conditions; t1074's `anyOf` evaluation (all three foreign prices kept by their estimate,
  everything at £150 or more left out); t1074's column placing, which placed `title` on `link` by the declaration's own
  order (`!FluxIQ/packages/contracts/src/record-sets/asked-columns/map.ts:74-80`); the pound estimate derive; the read
  (estimate and end time present); the oracle and the task wording.
- t1074's offline proof kept the ten because that run's declaration used `link_text`
  (`any-of-alternatives.test.ts:21`). It never tested a declaration naming `link`, although its fixture holds m9's
  glued `link` (`rows-fixture.ts:20`).

## What changed and why

- Wrote `docs/working/language-driven-flow-loop-plan/debugs/run-mwyt3s48-b943f344.md`: a step timeline, a row-by-row
  table against the expected dataset, what `shown` means, a table of causes, two proposed fixes with offline proofs,
  and side findings.
- Wrote this report.
- No code, tests or shared documents were edited.

Proposed fixes, recommended in this order:

- **F1, read layer** (`apps/extension/src/content/extraction/infer-fields.ts`):
  - A leaf that says the same words on every item that carries it, and appears on two or more items, is a mark. Keep
    it as its own field, as `badge-name.ts` already does for constant names.
  - A link whose words, without its marks, are one offered leaf's on every item is not offered as text (only its URL).
  - Links with words of their own keep today's behaviour.
  - Proofs: (a) a unit test on a synthetic page of another kind, with counter-cases; (b) a provider-free check of
    detection on this scenario's results page, that no field reads "New listing…" and the title field equals each
    listing's title on all 26 cards; (c) a replay of 0028's declaration over this run's 46 recorded rows
    (steps 0014 and 0020) with the title read from `link_text`, expecting rows equal to `catalog.test.ts:74-85`.
- **F2, data layer** (`asked-columns/map.ts` step 3, and the placing line in `result-feed/column-names.ts:26`):
  - When the placed field equals another stored field on some rows and, on the rest, that field with a third field's
    words joined on, place the column on the clean field "by its values" and say so to the model and the judge.
  - Proof: replay 0028's declaration exactly as sent (`columns: ["link", …]`) over the 46 rows. Today row 9 is glued,
    which reproduces the failure; with F2 the ten rows equal the expected dataset. Include a counter-case that is not
    re-placed.

## Commands run and observed results

- `ls`, `cat` and `find` on the bundle and the step files. Found `lab-runs/2026-11-27/run-mwyt3s48-b943f344/steps`
  (0001-0037).
- `python -I scratchpad/kestrel3-dbg/rows.py` printed all 46 recorded rows (26 from 0014, 20 from 0020) with the key
  fields. All ten owed listings are among them; m9 has `link` = "New listingKestrel 35 Kamera…", `link_text` = the
  bare title, and `link_text_2` = "New listing".
- `python -I scratchpad/kestrel3-dbg/compare.py` rebuilt the expected rows from `catalog/cameras.ts` and the
  `money.ts` formats, sorted by `endsIn`, and compared them exactly with `answer-turn.json`. Output: rows 1-8 and 10
  OK; row 9 `DIFF title: expected 'Kestrel 35 Kamera Messsucher 45mm 2.8 — sehr gut' got 'New listingKestrel 35 Kamera
  Messsucher 45mm 2.8 — sehr gut'`. That matches the pinned expected rows in `catalog.test.ts:74-85`.
- `python -I scratchpad/kestrel3-dbg/linkdiff.py` found that `link` and `link_text` differ on exactly 2 of the 46
  rows (page 1 row 6, l2, and page 1 row 12, m9), both by the "New listing" prefix.
- I read the oracle code: `score-answer.ts:31,36`, `judge-answer.ts:68-80`, `judge-shown.ts:29-36,72-74`,
  `value-match.ts:41-42` (exact match) and `extraction/judgement.ts:76-96`.

Scratch scripts are in `C:/Users/osrs_/AppData/Local/Temp/claude/bc302d3e1bd85154/1bda39b1-1940-4a03-9ca6-eeeb61191390/scratchpad/kestrel3-dbg/`.

## Not verified

- I did not open the stored dataset's rows themselves (`readAttemptRows` reads them from Core's run dataset, and that
  store is not in the bundle). I inferred their values from the 0028 processing result and the chat turn, which agree.
  If the stored keys differed from the asked names, more rows would fail, but row 9 fails either way.
- None of the proposed fixes or proofs was built or run. F1's counter-cases (a highlighted word in a link, a title split
  into value pieces) are reasoned from the code, not tested.
- I did not check whether other realistic scenarios have badge-prefixed link titles that F1 would also change.

## Open questions or contradictions found

- The repeated `already_so` amendments (0023, 0029, 0034, then a `same_fix` steer and a loop decision) cost about $0.28
  for nothing. run-mwyn25dg showed the same pattern (0017-0043). It recurs, so it needs a structural look in its own
  brief.
- F2 replaces a column the model named explicitly, on evidence from the reads. That follows the user's rule that the
  data layer cleans from upstream data, but the lead should confirm it is wanted, rather than only reporting the glued
  field to the model.
