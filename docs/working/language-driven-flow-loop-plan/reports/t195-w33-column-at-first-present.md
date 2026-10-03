# t195-w33: column `at` from the first item that has the column

## Outcome

Done. A detected column the list's first item lacks now carries `at`: the handle of its element in the first item, in list order, that has the column. Cause R2 of `run-murwcaj0-40e56557`.

## What changed and why

- `domain/src/runtime/llm-evidence/structure/first-item/locate.ts`
  - `firstItem` became `listItems`, which returns every child of the container that the item selector names, in order.
  - `fieldElement` became `fieldElements`, which returns all matches, or `undefined` for a selector form the walk does not read.
  - The new `columnElement` walks the items and stops at the first one with any element for the field. It returns that element only when exactly one matches there.
  - A full-coverage column therefore stops at the first item, so its handle is exactly the same as before. That includes the case where the first item has several matches: that still gives no `at`, with no fallback to later items.
  - A column that no item has, or an unreadable selector form, still gets no `at`.
  - The header comment now gives this run as the reason, and the "left out" list is updated.
- `first-item/index.ts`: the barrel's header comment wording is updated. This is a comment-only change.
- `structure/packet.ts`
  - `AT_NOTE` now reads: "a field's at is the handle of that column's element in the first item that has it; its line in the page view shows what the column holds".
  - The C2 paragraph in the module header records round 1002-M / `run-murwcaj0-40e56557` R2 as the reason.
  - The `at` field's doc comment is updated to match.
- `structure/tests/column-at.test.ts`
  - New test: "a column the first item lacks carries the handle of its element in the first item that has it". It covers the badge that only the second card has, two full-coverage columns that keep the first item's handles, and a `pinned` column no item has, which gets no `at`. It also checks that the atNote mentions "first item that has it".
  - The existing tests asserted the old behaviour (`new_badge` has no `at`). They now expect `new_badge` to be `shownHandle(shown, "New")`.
  - `runtimeOver` takes an optional structure.

## Commands run and observed results

These were run from `domain/`.

Before the fix, with only the test edits applied: `node .../run-domain-tests.mjs t195-w33 src/runtime/llm-evidence/structure/tests/column-at.test.ts`
- not ok 1: each detected column carries the handle ... first item. The deep-equal failed with `-   new_badge: 't16'`.
- not ok 2: the handle is the one the model was shown ... The same failure, `new_badge: 't16'` missing.
- ok 3, ok 4
- not ok 5: a column the first item lacks ... AssertionError, expected `'t16'`, actual undefined.

After the fix: `node .../run-domain-tests.mjs t195-w33` with column-at, badge-column, continues, detect and record from `structure/tests`, plus `first-item/tests/chain.test.ts`:
- `# tests 28  # pass 28  # fail 0`

## Not verified

- Typecheck: not run, per the brief. The lead runs it.
- Live behaviour on the Circleway requests page.

## Open questions or contradictions found

- `structure/detect.ts:149` has a comment that still says "Each column's element in the first item is found...". That file is outside my ownership, so it may need a one-word update by its owner.
- In live step 0042 the "Request accepted" column has coverage 0.13. If the first item with that element also has several matches for the selector, the column still gets no `at`. This is intended: it is never guessed.
