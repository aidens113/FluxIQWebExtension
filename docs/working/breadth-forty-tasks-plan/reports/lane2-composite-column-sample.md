# lane2-composite-column-sample: report

## Outcome

Done. If a text or table column's element has no words of its own, its sample is now built from the words of the elements inside it, in page order. In the split-price case the sample is `9,87 €` and the label is `price: '9,87 €'`.

## What changed and why

- New file `domain/src/runtime/llm-evidence/structure/container-words.ts` with `webLlmContainerWords(container, page)`.
  - It finds the elements inside the container by walking each element's `parent` links upward, up to 40 levels, the same way `node-run/layer/member.ts` does. It keeps them in page order.
  - Each piece is the element's own words: `ownText ?? text ?? name`. `name` is included because the capture drops `text` when it equals the name.
  - Each piece is screened, put on one line and trimmed. Empty pieces are skipped.
  - Pieces are joined with one space, except no space before a piece that starts with `,` or `.`, and none after a piece that ends with `(`, `[` or `{`.
  - Form controls are skipped, and the walk does not continue up through them.
  - If any piece is withheld, the whole result is `undefined`.
- `structure/field-sample.ts`:
  - `webLlmShownColumn` takes an optional 4th parameter, `page`.
  - The new `composedSample` runs only when the column kind is `text` or `column`, the element is not a form control, and its own words (`readable ?? text ?? name ?? ownText`) are missing or blank. Its result goes through `bounded()`.
  - The sample is now `sampleOf(...) ?? composedSample(...)`. An element with words of its own keeps today's sample, including when that sample is withheld.
  - `readableLabel` now strips a closing note such as `(currency amount)` or `(number)` before testing whether the label is a generated class path. This was needed: the live label is `div.css-14mzav0 > div.css-0a5kivv (currency amount)`, and `CLASS_PATH` rejects it while the note is attached, so the label would never have become `price: ...`.
  - I added `LABEL_NOTE` with exactly the same text and position as in t563's copy, so that hunk should merge as an identical change.
- `structure/packet.ts`: one line. The call site now passes `firstItem?.detected.evidence.elements`, the detection's own capture, which is the page the first-item element came from.
- `structure/index.ts`: comment only. It names `container-words.ts`, which is not re-exported because nothing outside the directory uses it.
- New test file `structure/tests/composed-sample.test.ts`. It uses a card with the sale price split as `"" "9" ",87" " €"` under a container, and the struck original `21,48 €` in a sibling. It checks that:
  - the container's sample is `9,87 €` and its label is `price: '9,87 €'`;
  - the struck column's sample stays `21,48 €`;
  - an empty container with nothing inside it has no sample;
  - an input column has no sample, and its value never appears in the packet.

## Commands run and observed results

- `cd domain && DOMAIN_TEST_BUILD_LABEL=lane2cs node scripts/test-domain.mjs runtime/llm-evidence/structure` -> `# tests 45`, `# pass 45`, `# fail 0`. The 3 new tests appear as ok 11, 12 and 13.
- Check that the tests catch the bug: I removed the new argument at the packet.ts call site and re-ran the same command. It printed `# pass 44`, `# fail 1`. I then restored the argument; grep finds it exactly once.
- `cd domain && npx tsc -p tsconfig.test.json --noEmit` -> no output, `tsc-exit=0`.
- `node scripts/structure-audit.mjs` (repo root) -> `structure-audit: passed (204 warning(s), 638 baselined).`, exit 0. Two warnings are in this directory: `packet.ts` at 415 lines (one changed line, line count unchanged) and `detect.test.ts` at 737 lines. Both files already existed.

## Not verified

- I did not do a live or Lab run, and did not re-run the run-mvd0pbn9 capture through the new code. The fixture copies the shape the debug note describes; I did not check the real capture's `ownText` and `text` fields for the price container.
- I did not run the full domain suite (narrow tests only, per the brief).
- I did not test the opening-bracket joining rule or the withheld-piece rule directly.

## Open questions or contradictions found

- **Label-note stripping applies to every column, not only composed ones.** The struck column's sample is unchanged, but its label also changes, from `div.css-2b8kq0w > span.css-7rt3wq1 (currency amount)` to `price: '21,48 €'`. The same goes for any `(number)` path column, for example `number: '4.9'`. My test checks only the struck column's sample. If "the struck column is unchanged" was meant to cover its label too, the stripping must be limited to composed samples.
- **Merge with t563.** t563 adds the 4th parameter `lines?` to `webLlmShownColumn` and changes the same packet.ts call line. Both changes conflict here. The fix is to keep both, giving `(label, element, spec, lines?, page?)` and the call `..., field.spec, lines.get(field.key), firstItem?.detected.evidence.elements)`. t563's `linesColumn` returns before `sampleOf` runs, so the two features do not interact.
