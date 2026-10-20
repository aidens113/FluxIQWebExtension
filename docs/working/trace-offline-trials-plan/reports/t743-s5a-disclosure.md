# t743-s5a-disclosure: disclosure checked only on rows the read keeps

## Outcome

Done.

## What changed and why

Social rerun round 4 (`run-mvgw3ve5-294881b5`, primary cause): `extractList` read every item with "complete" text before `where` ran. One collapsed long item that the conditions rejected therefore refused the whole read with `incomplete_text`. The step kept 0 of 30 rows and still failed.

- `apps/extension/src/content/extraction/list-reader.ts`
  - When `where` is present, each item is read with `"visible"` text. With no `where` it is read `"complete"` in one pass, as before.
  - A kept item then goes through `assertDisclosed(element, fields)`, which re-reads only the text and column fields with `"complete"`. Only those kinds can be collapsed. Re-reading attribute reads would double helper reads, which `rejected-samples.test.ts` counts.
  - A rejected item goes through `assertDisclosed` limited to the fields that its rejecting conditions name (`request.where[index].field`). It is refused only when that rejection judged partial text.
  - `readRecord` now takes the completeness. The scroll-mode `hasUnreadItem` key read uses `"visible"`, because it only compares content.
  - The header comment records the rule and the run that motivated it.
- `apps/extension/src/content/extraction/item-filter.ts`
  - Conditions that read their own value (`read`) now judge visible text.
  - After judging, the disclosure assertion runs for these text/column read-conditions, but only on two kinds of item:
    - a kept item, where every read-condition is checked;
    - a rejected item, where only the read-conditions that rejected it are checked.
  - So a read-condition that held on partial text no longer refuses an item that a different condition dropped.
  - The existing test still passes: "an executable condition's own text read refuses an unexpanded field" (the item is kept, so it is asserted).
- `domain/src/runtime/llm-evidence/rejection-next/next-sentence.ts` (`INCOMPLETE_TEXT_NEXT`)
  - Before: "...read the same listing again with X: by then every row is disclosed."
  - After: "...read the same listing again with X, and give both reads the same conditions, so every row the final read keeps was disclosed by the repeat."
  - The doc comment says why the old wording was false.
- Tests. The fixture is a library's reader comments, a non-realistic list:
  - `extraction/tests/list-reader.test.ts`, 3 tests:
    - An old collapsed comment that a date-text condition rejects, plus a short kept one: the read returns 1 record and is not refused.
    - The long comment is new (kept): still refused `incomplete_text`.
    - A condition on the collapsed field itself rejects the long item: still refused. This is checked both as a `field` condition and as a `read` condition.
  - `extraction/tests/item-filter.test.ts`, 1 test: when a field condition rejects the item, a read-condition on a collapsed element that holds does not throw. When the item is kept, it throws.
  - `rejection-next/tests/next-sentence.test.ts`: the new wording is matched, and the old "every row is disclosed" is asserted absent.

## Commands run and observed results

- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t743-s5a node scripts/test-extension.mjs content/extraction/tests`
  - First run: `# tests 253 # pass 252 # fail 1`. The failure was `rejected-samples.test.ts` "the helper is evaluated once per item": 6 !== 3. My first version re-read every field kind for disclosure.
  - Fixed by re-reading only text and column fields. Rerun: `# tests 253 # pass 253 # fail 0`. This includes ok 84, 112, 113 and 114, the new tests.
- `cd domain && DOMAIN_TEST_BUILD_LABEL=t743-s5a node scripts/test-domain.mjs rejection-next/tests`: `# tests 7 # pass 7 # fail 0`.

## Not verified

- No typecheck was run (the brief forbids it). The test build compiled and ran the edited files.
- No browser or e2e run (`e2e/content/tests/extract-list.spec.ts` not run).
- No full suites.
- Not exercised: column fields, or `lines` text fields that sit under a collapsed condition. The code path is the same `readField(..., "complete")`.

## Open questions or contradictions found

- `item-filter.ts` was not named in the Owns list. It is in the owned directory `apps/extension/src/content/extraction/`, and it had to change, because `read` conditions asserted "complete" before judging. That would have kept refusing a rejected item through a read-condition that did not reject it.
- Other workers' changes are in the tree (identity, action-runtime, domain state-diff and others). I did not touch them.
