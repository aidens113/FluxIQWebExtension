# Live lane 1, fix 2b: one kind per column, and a value stated only in an attribute

## Outcome

Done. Field inference used to name a column by the DOM position it had in the first item. Now a positional column whose element is a different kind in different items is read by a selector that names one kind in every item. Each other kind it met gets a column of its own. An element that shows words and states something else in its `aria-label` or `title` (or a `time` element's `datetime`) now also offers that attribute as a column, with a sample. Fix 2 (`lines: true`) is untouched and its tests still pass. No build was run.

## What changed and why

### Rule A: a column means one kind of element in every item

New directory `apps/extension/src/content/extraction/template-kind/`:
- `element-kind.ts` reads an element's kind: its tag, its `role`, its classes, whether it carries a non-empty `aria-label` or `datetime`, and its href folder. The folder is the href as written, with the query and fragment removed, cut after the last `/` before the final segment. So `/posts/12/?x` gives `/posts/` and `/people/ana/` gives `/people/`.
  - `title` is left out of the kind on purpose. Pages add it to the same element only when its words are cut short, so counting it would split an ordinary title column.
- `same-kind.ts`: two elements are the same kind when tag, role, stated attributes and href folder are equal and their classes overlap. Two unclassed elements also count as the same kind. A modifier class (`price price-sale`) therefore does not split a column.
- `kind-conditions.ts` builds the selector parts that separate one kind from the others:
  - the classes every element of the kind shares, with the ones no other kind has placed first, at most 3;
  - `[attr]` or `:not([attr])` for a stated attribute one kind has and the other lacks;
  - `[role="x"]` or `:not([role])`;
  - `[href^="<folder>"]` or `:not([href])`.
  - A test is written only where some other kind actually differs.
- `kind-columns.ts` holds `separateKinds(sources, run, pathLabel)`, which runs in `inferFields` on the collected sources before coverage and the bound. It looks only at sources whose selector has an `:nth-of-type(` step and are not `lines` groups. It groups the elements that selector names across the run (at most 48 items) by kind. If there are two or more kinds:
  - **The column's own kind** is the kind of the first item that gives it a value. That source keeps its label and key and gets a new selector, chosen in this order:
    1. a `:scope <tag.classes><conditions>` step that names exactly that kind in every item (at most one match per item), and the source's own element in each of that kind's items;
    2. failing that, the same step allowing several matches, as long as every match is that kind and the first match is the item's element. This covers an item that embeds a second element of the kind, such as a quoted post with its own time link;
    3. failing that, the positional selector narrowed to the kind (`…span:nth-of-type(1) > a.meta[aria-label]`). That is the split.
  - **Each other kind:**
    - If an existing source with the same read already reads that kind's elements in every item where it has one, that source is widened to the new selector and keeps its label and key. In the test this is the author column of the personal template.
    - Otherwise a new source is inserted after the column. Its label is the path to its element in the first item that has it, plus any narrowing, plus the original suffix (` url`, ` aria-label`).
  - **Duplicates are dropped.** A source with the same read whose every value a rewritten column reads at the same element, in fewer items, is removed (here the `span:3 > a` columns from the second template).
  - A column whose elements are one kind in every item is returned unchanged, so its key stays the same.
- `index.ts`: the barrel, with the rationale and the live-run cause.

### Rule B: a value stated only in an attribute

New directory `apps/extension/src/content/extraction/stated-name/` (`stated-attributes.ts` and `index.ts`). `statedAttributes(element, selector, peers)` returns the attributes to offer as columns:
- `aria-label` and `title`, only when the element shows words of its own. Elements without words are badges, which `badge-name.ts` already offers.
- `datetime` on a `time` element.
- An attribute is kept only when its text differs from the shown words, and only when the peers do not all state it alike. A constant label ("Leave a comment" on every Comment button) is page chrome, checked with `constantBadgeName`.
- Nothing is offered for an element inside a sensitive control.
- The words and attribute values are only compared, never kept.

### Wiring into `infer-fields.ts` (779 to 792 lines, under 800)

- Two imports and a 5-line header note.
- `inferFields` calls `separateKinds(fieldSources(item, run), run, (owner, element) => pathWithinItem(owner, element)?.label)`.
- In `elementSources`, an element that offered at least one source (and is not an `img` or a form control) also offers `{ kind: "attribute", label: "<label> <attr>", selector, attribute }` for each name `statedAttributes` returns.

### Domain (`domain/src/runtime/llm-evidence/structure/first-item/compound.ts`)

Without this change the new selectors resolve in the browser but get no `at` handle or sample in the packet. I confirmed that by running the new tests against `HEAD`'s copy of the file: 2 of 6 failed.
- `:not([class])` is generalized to `:not([<any attribute>])`.
- A prefix test `[x^="/…"]` (root-relative) also matches a value the capture published as an absolute http(s) URL, by comparing against that URL's path, query and fragment. The capture publishes `href` resolved (`attributes.ts`, `evidenceHref`), so `[href^="/people/"]` would otherwise never match.
- No key or spec shape changed: `spec.selector` is still a string and `attribute` is the existing field. Nothing in `actions/extraction` needed a change.

### Tests

- `apps/extension/src/content/extraction/tests/infer-fields.test.ts` has 2 new tests and a fixture (`entry`, `ENTRIES`, `readAll`). The fixture is one list of 6 entries:
  - three in a personal template: title `h3 > span > strong > a` author, byline `span > a.meta[aria-label]` time, then ` · `;
  - two in a group template: title is the group link, byline is `author · time ·`;
  - one personal entry that quotes another post in a box with its own `a.meta[aria-label]` time link.
- The new tests are added to this existing file because `extraction/tests/` already holds 25 files.
- `apps/extension/src/content/extraction/tests/fake-shadow-dom.ts`: the test DOM's step parser now reads several attribute tests per step, `[a^="v"]` with escapes, and `:not([a])`. It still throws on anything else.
- `domain/src/runtime/llm-evidence/structure/first-item/tests/chain.test.ts`: one new test for `:not([attr])` and folder prefixes against a published absolute href.
- New `domain/src/runtime/llm-evidence/structure/tests/template-kind.test.ts`, run through the detect-structure tool. The time column samples `1h`, the author column `[href^="/feed/people/"]` samples `Aisha Khan`, and the aria-label column samples the full date. The handle keeps all three selectors as written.

### What the fixture produces now (printed once with a temporary log, then removed)

| Column | Key | Selector | Coverage | Reads |
| --- | --- | --- | --- | --- |
| time | `div_head_div_div_byline_span_1_a_meta` (unchanged) | `:scope a.meta[aria-label]` | 1 | `1h 3h 5h 1d 2d` |
| author | `div_head_div_h3_title_span_strong_a_meta` (the personal template's existing key, widened) | `:scope a.meta[href^="/people/"]` | 1 | every author |
| full date | `…span_1_a_meta_aria-label` | `:scope a.meta[aria-label]`, attribute `aria-label` | 1 | the full dates |

The time link's url column was rewritten the same way, and the author's url column widened. The `span:3 > a.meta` text, url and aria-label columns of the group template were dropped as duplicates.

## Commands run and observed results

All commands ran in `C:/Users/osrs_/FluxStuff/fxwork/t563/!FluxIQWebExtension`. `<tsc>` is `node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc`, resolved from `domain`.

**Fail-first, before any product change** (test, test infrastructure and fixture only): `EXTENSION_TEST_BUILD_LABEL=lane1-fix2b node apps/extension/scripts/test-extension.mjs src/content/extraction/tests/infer-fields` printed `# tests 18 # pass 16 # fail 2`. The full output is saved in the scratchpad as `lane1-fix2b-failfirst.txt`.
- `not ok 17 - a column means one kind of element in every item, whatever template the item uses`, error `a text column reads the time in every item: [...]`. The dump shows `["div.head > div > div.byline > span:1 > a.meta", ":scope > div.head > div:not([class]) > div.byline > span:nth-of-type(1) > a.meta", null, ["1h","Elena Sokolova","5h","Priya Nair","2d"]]`. The author column `…strong > a.meta` read `["Aisha Khan",null,"Tom Becker",null,"Lena Vogt"]`.
- `not ok 18 - the full date a time link states only in its aria-label is offered as a column, and read in every item`: there was no `aria-label` attribute field in the proposal.

That first run used 5 entries. After the product change, the same command printed `# tests 18 # pass 18 # fail 0`. I then added the sixth, quoting entry and checked the relaxed pass:
- with the relaxed pass removed, 17 and 18 fail again (`# pass 16 # fail 2`);
- with it restored, 18 of 18 pass.

**Domain fail-first:** with `HEAD`'s `compound.ts` (restored after), `DOMAIN_TEST_BUILD_LABEL=lane1-fix2b node domain/scripts/test-domain.mjs runtime/llm-evidence/structure/tests/template-kind runtime/llm-evidence/structure/first-item` printed `not ok 2` (chain: kind steps) and `not ok 5` (the author sample), `# pass 4 # fail 2`. With the change it printed `# tests 6 # pass 6 # fail 0`.

**Final runs, after the last edit:**
- Typechecks, each exit 0 with no output:
  - `node <tsc> -p domain/tsconfig.json --noEmit`
  - `node <tsc> -p domain/tsconfig.test.json --noEmit`
  - `node <tsc> -p apps/extension/tsconfig.json --noEmit`
  - `node <tsc> -p apps/extension/tsconfig.test.json --noEmit`
- `EXTENSION_TEST_BUILD_LABEL=lane1-fix2b node apps/extension/scripts/test-extension.mjs src/content/extraction src/background/extraction src/panel/extraction` -> `# tests 477 # pass 477 # fail 0`.
- `DOMAIN_TEST_BUILD_LABEL=lane1-fix2b node domain/scripts/test-domain.mjs runtime/llm-evidence/structure actions/extraction output-nodes/extract-list runtime/llm-evidence/plan-resolution/extraction` -> `# tests 272 # pass 272 # fail 0`.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (205 warning(s), 638 baselined).`
  - The only warning in my files is the existing advisory one, `infer-fields.ts: 792 lines is past the 400-line advisory threshold`.
  - An earlier run reported one FAIL, `contract-spread` in my new `template-kind.test.ts` (a conditional spread in the fixture). It was fixed by writing both object literals out in full. The baseline was not touched.

## Not verified

- No build was run, as the brief instructed, and nothing was tested live or in a browser. The headed lane run still uses the old built extension.
- Nothing was replayed against the real capture of `run-mvczv4jn-1b61183c`. The fixture copies the structure of `postHead` and `timeLink`, but its class names are not hashed.
- On the real feed, the expected selectors are `:scope a.<metaLink>[aria-label]` (time) and `:scope a.<metaLink>[href^="/scenarios/social-network-feed/people/"]` (author). That second one assumes the avatar link's class differs from `metaLink`, as it does in the markup. These are inferred, not observed.
- The Playwright content harness (`e2e/content/tests/extraction/inference.spec.ts`) was not run.
- Full package suites were not run.
- Whether the model chooses the date column for a date condition is unverified until a live run.

## Open questions or contradictions found

- `docs/architecture/web-capabilities.md` (the structured-extraction row) should get a sentence on both rules, but the brief did not give me that file, so I left it unchanged. Suggested wording: "a positional column that met different kinds of element across items is read by kind or split (`template-kind/`); an element's `aria-label`, `title` or a `time`'s `datetime` that differs from its words is offered as an attribute column (`stated-name/`)."
- **Same-kind columns split by position.** Two positional columns that each read one kind consistently, but at different positions in different templates, stay separate: `span:1 > a.meta > span` (0.6) and `span:3 > a.meta > span` (0.4), the time's inner span. The time column now covers every item, so nothing depends on these. Merging them would need its own rule.
- **Fix 2 side effect.** Fix 2's line group also fires on this byline (`div.byline (all lines)`, read as `"Elena Sokolova · · · 3h · ·"`) because the byline's spans are named by position. The `aria-hidden` ` · ` separators become lines. This happened before this fix and I left it unchanged.
- **Cross-origin prefix match.** The domain compound's root-relative prefix match ignores the URL's origin, so in the packet `[href^="/people/"]` would also match a cross-origin `https://other.example/people/x`. In the browser it would not. This affects only the domain's handle and sample lookup, which already leaves out a column whose first item has several matches.
- **Request contract.** No key or spec shape changed. Field keys keep their labels. Two keys disappear from proposals: those of columns now dropped as duplicates (in the fixture, the second template's `span:3 > a` text, url and aria-label columns). Saved Flows keep their own specs, so nothing that is already saved stops reading.
