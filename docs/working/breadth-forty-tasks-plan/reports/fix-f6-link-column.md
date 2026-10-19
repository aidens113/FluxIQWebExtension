# Fix F6: the item's own link as a column

## Outcome

Done. When a run item is itself an `<a href>`, inference now offers a `link` field with no selector, labelled `item url`. The list reader reads it off the item and makes it absolute.

## What changed and why

- New `apps/extension/src/content/extraction/item-link/own-link.ts` (`offersOwnLink(item)`) and its barrel `item-link/index.ts`. The predicate is true only for an `a` element that has an `href`. The file's comment records the cause (photo newest-likes r1, step 0017).
- `apps/extension/src/content/extraction/infer-fields.ts` imports `offersOwnLink`, and `itemAttributeSources` now puts `{ kind: "link", label: "item url", sensitive }` ahead of the item's `data-*` attributes when the item is a link. I put it in a new module because infer-fields.ts was at 788 lines against the audit's 800-line budget. It is now at 791.
- Nothing else changes. Items that are not links offer what they did before, and links inside items still give `<path> url` with their selectors. No existing label or key was renamed.
- About "make it absolute with `resolvedHref`": the list reader does not use `resolvedHref` for a link field. That function is private to `content/identity/record.ts` and feeds row identity. The link field is read by `linkTarget` in `extraction/field-reader.ts`, which resolves the `href` against `baseURI` and accepts only http(s). The proposal holds no URL, only the spec `{kind:"link"}` with no selector. `readElement` reads a selector-less spec off the item itself, through `linkTarget`, so the URL is made absolute by the reader's existing code and nothing is copied. I did not export anything from `identity/`.
- Tests: three new cases at the end of `tests/infer-fields.test.ts`, all on generic made-up tile markup:
  1. A grid of anchor tiles offers exactly one selector-less link field. Coverage is 1 and it is required. Its label holds no URL text and every key is distinct. Each item reads as an absolute URL. The count column is still offered.
  2. A non-link card with an inner link offers only the inner link's `... url` field, with its selector.
  3. Anchor items with no `href` offer no link field.

## Commands run and observed results

- Red first: `EXTENSION_TEST_BUILD_LABEL=f6-link-column node scripts/test-extension.mjs content/extraction/tests/infer-fields` (in apps/extension) gave `# tests 25 / # pass 24 / # fail 1`. The failing test was the new grid-tile test (`0 !== 1`; only img src/alt and the count were proposed).
- After the change, the same command gave `# tests 25 / # pass 25 / # fail 0`.
- `... test-extension.mjs content/extraction/tests` (the whole directory beside the change) gave `# tests 243 / # pass 240 / # fail 3`. All 3 failures are in `pagination.test.ts`: the hidden-load-more cases fail with `Cannot read properties of undefined (reading 'scrollTo')` and a deep-equal mismatch. Run alone, `pagination.test` fails the same 3 of 31. Its built bundle does not reference `infer-fields` or `item-link` (`grep -c` returned 0), so these failures come from something other than this change.
- `npx tsc -p tsconfig.json --noEmit` (apps/extension) printed no output, meaning no errors.
- `node scripts/structure-audit.mjs` (repository root) ended with `structure-audit: passed (212 warning(s), 638 baselined).`

## Not verified

- I did no live or browser run on the photo grid. The fake DOM has no real `baseURI`, so the tests set it on each item.
- I did not check end to end whether the model-facing packet and picker show a selector-less link field well. Item `data-*` attribute fields are already selector-less, so the same path is already in use.
- I did not trace why the pagination tests fail.

## Open questions or contradictions found

- The brief names `resolvedHref` as the list reader's link resolution, but the list reader actually uses `field-reader.ts` `linkTarget`. The two differ: `linkTarget` refuses links that are not http(s), while `resolvedHref` returns the `.href` property as it is.
- `content/extraction/tests/pagination.test.ts` fails 3 hidden-load-more tests in this tree with no change of mine involved. The supervisor or the pagination owner should look at it.
