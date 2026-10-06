# t194-w81: the result check's card speaks the person's language

## Outcome

Done. The result check's card now begins with how many rows came back, gives Core's verdict sentence, and on a refusal adds the check's reading. Any of the judge's sentences that names something internal is dropped. The check's advice no longer appears on the card. The run record and the repair's inputs are unchanged.

## What changed and why

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`, R = `packages/fluxiq/src/programs/automation-studio/runtime/`.

- `R/result-verification/check-words.ts` (new, one export, `automationStudioResultCheckWords`). It builds the card text for a check that ran:
  - **Row count.** Taken from the count at the start of Core's own `observation` (`/(\d+)(?: records?)? stored/`), which covers all three of Core's observation forms. It is said as "N rows came back.", "1 row came back." or "No rows came back."
  - **Verdict.** `outcome.reason`, which is Core's own sentence.
  - **The check's reading.** Only when the verdict is `does_not_answer`. It shows `repair.judgement.expected` as "It looked for: …" and `observed` as "What it found: …". The text is split into sentences, and a sentence is kept only if it contains none of these:
    - a dotted path or handle (`reads.stop`, `node.bootstrap…main.s7`, `extraction.4`)
    - a camelCase name (`endView`, `pageLimit`; brand casing like `iPhone` or `eBay` is not caught)
    - a snake_case code word (`control_disabled`)
    - a hash of 10 or more hex characters
    - backticks or braces

    Whole sentences are dropped rather than having names cut out, because a sentence with its names removed no longer says anything.
  - **Advice.** `advice` (the judge's `changed`) is never put on the card.
- `R/result-verification/check-activity.ts`: the text now comes from the helper. Labels, status and the 600-character `automationStudioActivityReasonText` bound are unchanged, and so is a check that was skipped (`performed: false`), which still shows its reason.
- `R/recovery/refuted-result/repair.ts:160` reuses this text for the "Fixing the Flow so its result answers the request" row. That is the row in picture 22, so it gets the new words without being edited.
- `tests/check-activity.test.ts`:
  - The existing "answers" test now expects "3 rows came back. …".
  - The refuted test now asserts that the advice and "What to change" are absent.
  - New: the musp39u8 refusal (13 rows; 0111's observed and changed), asserting the text starts "13 rows came back.", keeps "Pages 6+ were never read" and contains none of endView, reads.stop, pageLimit, maxPages, extractList, control_disabled, node.bootstrap, the hash, main.s7, "Raise", or any dotted path. It also asserts that `outcome.repair.judgement.advice` still carries `extractList.paginate.maxPages`, which shows the repair's input is unchanged.
  - New: the "No rows" and singular "1 row" wording.

With the musp39u8 fixture, the card now reads: "13 rows came back. The result was judged not to answer the request the Flow was built for, twice and with the same evidence. It looked for: Every Brightaisle Plus eligible wireless earbud rated 4.0+ under $50 across all result pages. What it found: 13 rows stored from 5 pages (94 items seen). Pages 6+ were never read, so qualifying pairs there are missing." This wording was worked out from the code, not printed by a run; the test asserts its parts.

## Commands run and observed results

- Tests written first: `npx vitest run src/programs/automation-studio/runtime/result-verification/tests/check-activity.test.ts` printed "Tests 4 failed | 2 passed (6)". Example failure: received "The result was judged not to answer the request the Flow was built for." where /^No rows came back\./ was expected.
- After the change: `npx vitest run src/programs/automation-studio/runtime/result-verification` (in packages/fluxiq) printed "Test Files 29 passed (29)" and "Tests 295 passed (295)".
- `npx vitest run src/programs/automation-studio/runtime/recovery/refuted-result` (the other caller of this text) printed "Test Files 7 passed (7)" and "Tests 48 passed (48)".
- `npx tsc --noEmit -p tsconfig.json` (packages/fluxiq) exited 0 with no `error TS` lines.

## Not verified

- Live chat rendering; no Lab run was made.
- The structure audit was not run.
- 0111's exact `expected` text. The bundle's `steps/` folder is gone (the run folder now holds only 5 files). The observed and changed texts come from the run's failure record in `snapshots/flow-lane.json` and the stored run object. The expected sentence in the test is reconstructed and deliberately includes "pageLimit".
- Unconfirmed outcomes (`unconfirmedReading`) still show only the row count and the reason, as before. The brief scoped the check's reading to refusals.

## Open questions or contradictions found

- The new helper is imported directly by `check-activity.ts` and is not exported from `R/result-verification/index.ts`, because the barrel was not in my brief. The supervisor may want to add `export * from "./check-words.ts";`.
- On this run the card still shows the judge's mistaken reading ("Pages 6+ were never read"). It is plain words, but its content is wrong (debug cause R1). That is fixed on the judge's side, not on this card.
