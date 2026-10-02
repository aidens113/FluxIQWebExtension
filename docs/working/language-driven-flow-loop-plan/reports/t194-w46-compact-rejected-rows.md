# t194-w46: a read's rejected rows said once, and the "reads as numbers" note only where digits are compared

## Outcome

Partial. Both tasks are implemented and tested. The size target was not met. On run 13's real `rerun.13` read,
`rejectedRows` shrank from 40,928 to 16,834 compact-JSON characters (41.1%). The target was under a third. A third
cannot be reached by removing only repetition and URL prefixes: the 72 distinct rows' own values (names 8,814,
links written from `~` 5,864, prices and ratings 937) add up to 15,615 characters, which is 38% of the old size.
Getting below a third would mean dropping row values, and the brief forbids that.

## What changed and why

- `domain/src/runtime/llm-evidence/node-run/rejected-rows.ts` (Task 1). `rejectedRows` is now a single object
  instead of a list with one entry per condition:
  - `"~"`: the base for `~/...` links. It is chosen with the page view's own `webLlmLinkWriter` (imported from the
    `../page-view` barrel; page-view itself was not edited), using the read's `url` and the rows' links. That gives the
    same base the page view header declares (`~ = http://127.0.0.1:56906/scenarios/everything-store` on run 13). The
    key appears only when at least one value was written that way. Links on other origins, and every link when the
    read has no `url`, stay whole. Each written link reads back to the exact address.
  - `fields`: the column names, given once. Each row is now a list of its values in that order, so the keys are not
    repeated on every row. A column a row does not have is `null`.
  - `conditions`: `{where, rejected, alone, rowsAlone}` for each condition, with every alone row included. An empty
    `rowsAlone` is left out, and `alone: 0` still says the count. An older page build that does not order its rows
    still produces `rows` for each condition.
  - `rowsWithOthers`: every row that more than one condition rejected, listed once for the whole read, grouped as
    `{failed: [i, j, ...], rows}` and ordered by the set of failed conditions. Two rows count as the same row when their
    values are equal, which is the same identity the page side already uses (`rejected-samples.ts` `keyOf`).
  - The screen (`webNodeReadResult`) still runs over the object form before it becomes lists. Denied keys and
    credential-shaped values are therefore withheld exactly as before, and `fields` is built from the keys that survive
    the screen.
  - The numeric sentences are now built per condition from its `rowsAlone`, plus the `rowsWithOthers` groups whose
    `failed` includes it, plus `rows`.
  - `WEB_NODE_REJECTED_ROWS_NOTE` now describes the new shape. It says rows are values in the order of `fields`, keeps
    the "check rowsAlone" instruction as it was, and says `rowsWithOthers` lists once each row more than one condition
    rejected, under the conditions it failed.
- `node-run/numeric-text-filter.ts` (Task 2). The new `comparesDigits` check lets the sentence fire only for:
  - a `matches` pattern that contains a digit, `\d` or `\p{N`, once `{n}`, `{n,}` and `{n,m}` quantifiers are removed;
  - or a `contains` term that contains a digit.

  Run 36's `/(?:[5-9]|[1-9][0-9]+) mutual/` still fires. Run 13's `name not contains ["ear tips", ...]` no longer does.
  Run against the real run 13 read, the note is now only the alone sentence.
- Tests:
  - `node-run/tests/rejected-rows.test.ts`: the five existing shape assertions are updated to the new shape. The alone
    test now checks that the two rows both conditions rejected appear once, under `failed: [0, 1]`.
  - New `node-run/tests/rejected-rows-once.test.ts`: a synthetic fixture with run 13's exact counts, membership and
    value lengths.
    - Rejected counts per condition are `[20,37,34,40,20]`, alone counts `[4,6,12,3,5]`, and the sets of conditions
      each row failed are as in run 13. There are 72 distinct rows, 46 of them in `rowsWithOthers`; the old shape listed
      134.
    - It asserts that the new form is under half the old one, that every count is kept, that each row is said exactly
      once with the right `failed` set, and that each `~` link reads back exactly. It also checks other-origin links and
      a read with no `url`.
  - New `node-run/tests/numeric-text-filter.test.ts`: covers both trigger directions, including the quantifier case
    and `\d` / `\p{Nd}` / digit-term positives.
- The page side (`apps/extension/src/content/extraction/rejected-samples.ts`) did not need to change.

## Commands run and observed results

All were run from the tree root `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQWebExtension`.

- `bash .../heavy.sh "t194-w46 tests" node .../t194s5/narrow-tests.mjs <domain> t194-w46 runtime/llm-evidence/node-run`
  printed `# tests 114`, `# pass 114`, `# fail 0`.
- `bash .../heavy.sh "t194-w46 tsc" npx tsc -p domain/tsconfig.json --noEmit` exited 0 with no output.
- `bash .../heavy.sh "t194-w46 tsc-test" npx tsc -p domain/tsconfig.test.json --noEmit` exited 0 with no output.
- `bash .../heavy.sh "t194-w46 audit" node scripts/structure-audit.mjs` printed
  `structure-audit: passed (155 warning(s), 118 baselined)`. None of the warnings is about the files changed here.
- New tests failing on the old source: I copied the original `rejected-rows.ts` and `numeric-text-filter.ts` back in,
  ran the same narrow command (`# pass 107`, `# fail 7`), then restored both files (`cmp` identical).
  - New tests that failed: 26 (numeric, run 13), 42 (run 13 said once), 43 (`~`).
  - Updated shape tests that failed: 44, 46, 47, 48.
- Sizes, in compact `JSON.stringify` characters, which is what the provider receives (`request.json` is compact JSON):

  | Input | Before | After | Share |
  | --- | --- | --- | --- |
  | Fixture | 41,455 | 17,145 | 41.4% |
  | Real run 13 `0031` read, rebuilt into a raw payload by a scratch script outside the repository | 40,928 | 16,834 | 41.1% |
  | Whole real read | 45,195 | 20,595 | 45.6% |

  The debug's 52,201 figure comes from the human-readable `request.txt` rendering, not from what the model receives.

## Not verified

- No Lab or live run, as the brief required, so how the model reads the list-of-values rows has not been tried live.
- Core's prompt rendering of the new shape is not measured. The provider body is compact JSON, so that is what I
  measured.

## Open questions or contradictions found

- The size target cannot be met under the rules. A third (about 13.6k) is below the 15.6k that the distinct rows' own
  values take up. Possible further savings, each of which needs a ruling:
  - Leave out columns no condition tested. On run 13 the `url` column alone is 5.9k.
  - Shorten the ad-redirect links, whose `url=%2Fscenarios%2Feverything-store%2F...` query repeats the prefix. This
    cannot be done exactly without decoding.
- Edge case: the page merges distinct items that have identical values (`keyOf`), and moves such a row to a
  condition's alone list when one copy was rejected alone. A row identical to an alone row could then show up in
  `rowsWithOthers` with a single-condition `failed` set, or with a union of sets. This is no worse than the page's own
  identity, and it did not occur on run 13: there, no row was in both one condition's alone rows and another's
  others.
- Run 13's samples are fewer than its counts: condition 0 has `alone` 4 but 2 alone rows, and condition 2 has 12 but
  10. The cause is page-side dedupe or sampling, which is outside this brief. The counts are passed through unchanged.
