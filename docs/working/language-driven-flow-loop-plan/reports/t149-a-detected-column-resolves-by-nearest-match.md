# t149 — A detected column resolves by nearest match

## Outcome

**Done.** `detectedKey` on the detected path now resolves a near-miss column
through Core's own `automationStudioMatchName` at Core's own 0.25 floor, records
what it assumed, and still fails honestly when nothing plausible was written.

Two things in the brief turned out to be wrong, and both changed the shape of the
work:

1. **The brief's stated shape signal does not exist.** "A detection knows its
   columns' sample values, so `accepts: "number"` is honestly derivable here" is
   false, structurally and by design. Section 2 says what is derivable instead,
   and it is enough to make the brief's test pass.
2. **Near-matching on this path could not simply be switched on.** Two existing
   readings — the field map written the other way round, and a condition naming a
   column by the key the *plan* invented — are recognised only because the first
   reading fails, so a guess answering first would silently take them over.
   Section 3 is that ordering fix, and it is the half of this task with real
   regression risk.

The headline behavioural change, measured through the runtime: the catalog build
that run `run-mu4wwkbc-df6cfe60` and six neighbours wrote —
`fields: { name, price, rating, url }` over a detected list — **now resolves to
the request the fixture's own recording reads**. Every column of it used to be
refused `web.handle.unknown_field`, and the build fell back to guessed CSS that
read eight cards and no field.

---

## 1. What changed, file by file

### 1.1 `plan-resolution/extraction/column-match.ts` — new

The whole of "which detected column did this name mean". It holds Core's matcher
call, the alias set a name is matched against, the shape derivation, and the
assumption type.

**Aliases, not just keys.** The model is shown a column's `key` *and*, for a
table, its header, and `columns.ts` already read `column:Header` and a bare
header exactly. So the guess is made over both: each detected column contributes
its key and (for a `column` kind) its header as aliases of the one column, and a
guess landing on either resolves to it. A name written `column:<text>` matches
headers only, because the prefix says the name is a header.

**Resolution is Core's.** `automationStudioMatchName` from
`fluxiq/automation-studio/nodes`, floor 0.25, no second implementation and no
second floor — the same call t142 made on the literal path.

### 1.2 `plan-resolution/extraction/columns.ts`

`detectedKey` gains a fourth step after the three it had (key verbatim → key
case-folded or header folded → **Core's normalizer**, which also folds
separators and camel-case humps → **the nearest alias**). The first three are the
strict reading; only the fourth is a guess, and a caller asks for it explicitly.

`WebExtractionColumn` and `WebExtractionColumns` now carry `assumed`, and
`keptWebExtractionColumns` reads `fields` in two passes (section 3).

What still refuses, unchanged: a name **two columns answer to exactly**
(`web.handle.ambiguous` — two readings, not a spelling); a `kind` that disagrees
with the column found; a `@attr` on a table cell; a stray key; a name with no
plausible candidate at all.

### 1.3 `plan-resolution/extraction/conditions.ts`

`conditionColumn` is now four ordered attempts — detected strictly, kept
strictly, detected guessing, kept guessing — and passes down the shape the
condition's own comparison needs. What a condition *says* is read before the
column it says it about, so the shape is available; which refusal wins is
unchanged, because the column is still answered for before the grammar is.

### 1.4 `plan-resolution/extraction/slot.ts` and `index.ts`

`{ status: "resolved" }` gains `assumed`, the columns' and the conditions'
assumptions in that order. The type is exported from the barrel.

---

## 2. The shape signal, and the brief's false premise

The brief says a detection knows its columns' sample values. **It does not, and
cannot.** D3 keeps every value read from the page out of the whole chain, and
three separate places enforce it:

- `domain/src/extraction/proposal.ts` — "A proposal holds selectors, names and
  counts only, never a value read from the page (D3)", which is why a proposed
  field's spec cannot even carry an `element` fingerprint;
- `domain/src/extraction/structure-detection.ts` — rebuilds the detection field
  by field, so a producer that put a sample beside it sends none of it. Its test
  plants `proposal.sample`, `proposal.fields[0].sample` and
  `proposal.fields[0].spec.sample` and asserts none survives;
- `domain/src/runtime/llm-evidence/structure/packet.ts` — "No selector and no
  value, ever (D3)". The binding `detectedKey` reads is built there, from
  `readableSpec`, which copies six spec fields and nothing else.

So `accepts: "number"` had to be derived from something else. What a detected
column's own spec honestly says:

| The column reads | Shape claimed | Why it is honest |
| --- | --- | --- |
| `kind: "link"`, or `kind: "attribute"` naming `href`/`src`/`action`/`poster` | `"text"` | An address is text and never a quantity. The same statement `actions/extraction/field-match.ts` makes, over the same four attributes. |
| `kind: "attribute"` naming an attribute **HTML or ARIA defines as a number** — `aria-valuenow`, `aria-level`, `aria-posinset`, `colspan`, `size`, `width`, 24 in all | `"number"` | The specification, not the page. A star rating drawn as a slider or a `meter` puts the quantity in `aria-valuenow` and prose in the label beside it. |
| `text`, `value`, `column`, any other attribute | nothing | Nothing is claimed. |

Both directions of that statement are used, and both come from Core:

- a candidate whose known shape **is** what the comparison needs wins a tie
  through Core's own `valueShape` tie-break (`+0.02`, documented there as
  settling a tie and never outvoting a clearly better name);
- a candidate whose known shape **contradicts** it stands aside for the guess,
  which is t142's mechanism on the literal path. Standing aside is not
  excluding: with nothing else plausible left, the contradicting column is still
  the answer.

**The wanted shape is `"number"` or nothing, never `"text"`.** A text comparison
runs on every kind of column, so claiming `"text"` would prefer the URL column
for a `contains: "Sponsored"` on no evidence at all. Only the numeric claim
distinguishes anything.

Measured, and asserted in the tests:

- a star widget's `star-rating_label` and `star-rating_value` both score **0.688**
  for a written `rating` — a genuine tie. `{field: "rating", atLeast: 4}` resolves
  to `star-rating_value` (the `aria-valuenow`); `{field: "rating", contains: "out
  of 5"}` resolves to `star-rating_label`;
- the catalog's `product-image_src` and `product-image_alt` both score **0.881**
  for a written `product-image`. A numeric comparison resolves to the `alt`,
  because the `src` reads an address; a text comparison resolves to the `src`;
- against a list whose only column is a `link`, `product-lnk` with `atLeast: 2`
  still resolves to it (0.917) — standing aside is not excluding.

One discrepancy worth recording rather than fixing: t142's private
`comparesNumbers` in `actions/extraction/field-match.ts` tests
`Array.isArray(equals) && equals.some(isNumber)`, so **a bare `equals: 50` is not
seen as a numeric comparison there**. My `webExtractionComparedShape` handles
both. That file is outside my ownership and I did not touch it; it is a one-line
fix whenever someone is in there.

---

## 3. The ordering fix, which is where the risk was

Three existing readings are recognised **only because a stricter one failed**, so
a guess that answered first would take them over without anything failing.

**A condition naming the plan's own key.** A plan that keeps
`{ rating: "css-1f32dgn" }` and then writes `{field: "rating", atLeast: 4}` named
the key it invented two lines above, exactly. `rating` also resolves to the
detected `product-rating` by similarity (0.757). Read detected-first-with-guessing,
that condition would test whichever detected column was nearest while looking
perfectly resolved. So: **both vocabularies strictly, then both guessing.**
Asserted with a case where the two readings pick different columns.

**The field map written the other way round.** `{ "product-price": "price" }` is
recognised because the *value* names no column and the *key* does. A guess at
`price` would answer first and invert it. That reading now happens in the strict
pass, and — deliberately — **stays strict even in the guessing pass**: a guessed
key is no evidence of an inversion. Read otherwise, `{ name: "banana" }` kept the
`product-name` column under the key `banana`, the opposite of the one thing the
plan did say. I hit that exactly once as a test failure before removing it.

**A guess taking a column another name claimed exactly.** `{ image:
"product-image", source: "product-image_src" }`: written alone, `product-image`
resolves to the `src`; beside a name that says `src` outright it must resolve to
the `alt`, or two keys read one column (and in the array form, collide into
`web.handle.malformed` — a refusal caused by a spelling). So `fields` is read in
two passes over the whole map, and the second looks only among the columns the
first did not take.

---

## 4. Measured limits of the rule on this path

The floor is Core's, measured on node ids. Against the catalog's detected keys it
rescues **the instruction's words** and not **typos of them**, which is the
opposite way round from the literal path:

| Written | Resolves to | Score |
| --- | --- | --- |
| `name`, `price`, `rating`, `stock` | `product-name`, `product-price`, `product-rating`, `stock-badge` | 0.733, 0.746, 0.757, 0.764 |
| `productName`, `PRODUCT-NAME`, `product_name`, `.product-name` | `product-name` | 1 (`normalized`) |
| `product-lnk`, `product-ratings`, `product-prce` | `product-link`, `product-rating`, `product-price` | 0.917, 0.933, 0.923 |
| `prce`, `ratng`, `ratings`, `title`, `url`, `banana` | **nothing** | below 0.25 |

A short written name resolves when it shares a whole token with the long detected
key; a *typo of a short name* shares no token, and the edit distance across the
long key sinks it. t142 recorded the mirror image (`ratng` → `rating` worked
there, because the candidate was short). Whether the floor should move for column
names is a measurement nobody has taken, and a synonym table (`url` → `link`,
`title` → `name`) is a different mechanism I did not add.

One boundary worth knowing, because it looks inconsistent and is not: a bare
`.product-name` resolves (Core folds `.` with the other separators, so it is the
column's name spelled differently), while a whole selector
`[data-testid="stock-badge"]` or `#card > .price:nth-child(2)` does not — its
brackets, quotes and `=` survive the fold and sink the score. Both are asserted.

---

## 5. Commands run and observed results

All from `F:\!FluxIQWebExtension`. Nothing repository-wide was run.

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/domain test` (**baseline, before any edit**) | `# tests 822 / # pass 822 / # fail 0` |
| `pnpm --filter @fluxiq-web-extension/domain test` (final) | `# tests 828 / # pass 828 / # fail 0` |
| `pnpm --filter @fluxiq-web-extension/domain check` (final) | exit 0 (`tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`) |
| `node scripts/structure-audit.mjs` (**baseline**) | `2 violation(s) across 2 rule(s)` |
| `node scripts/structure-audit.mjs` (final) | `2 violation(s) across 2 rule(s)` — **the same two, both pre-existing, neither in a file I touched** |

### The structure-audit findings

Both were red before I started and both are outside my diff:

1. `FAIL [file-lines] packages/test-runner/src/run-scenario.ts: 812 lines exceeds
   the 800-line limit` — t142 recorded this one too. Another agent is splitting it
   right now (`packages/test-runner/src/run-scenario/` appeared untracked during
   my run); the FAIL is still present, so the split is not finished.
2. `FAIL [working-docs] docs/working/README.md is out of date with the documents'
   header blocks` — the supervisor's, as t142 said.

The two working-doc findings t142 recorded as third and fourth — the loop plan
past 800 lines, and the `imports` failure in `scripts/lab/domain-build-staleness.mjs`
— **are no longer reported**, so two of its four have been closed since. The
audit also says `1 baseline entries can be lowered`; I did **not** run
`pnpm structure:baseline`.

**No finding, and no advisory warning, in my directory.** Line counts:
`column-match.ts` 229, `columns.ts` 272, `conditions.ts` 214, `slot.ts` 191,
`tests/column-match.test.ts` 234 — all under the 400-line advisory. The
directory holds 5 source files (limit 25). `column-match` forms a prefix group of
one, so the `prefixGroup: 3` rule is untouched.

### One run to discount

A mid-run `pnpm --filter @fluxiq-web-extension/domain test` reported 6 failures
in `domain/src/actions/extraction/tests/summary.test.ts`. `summary.ts` had been
written by another agent **4 seconds earlier**; the next run, against the settled
file, was 828/828. It is the hazard `AGENTS.md` names — a validation run reading a
tree someone else is editing — and I did not touch that file or its tests.

---

## 6. Tests added

`domain/src/runtime/llm-evidence/plan-resolution/extraction/tests/column-match.test.ts`
— **new**, 5 tests, unit-level over hand-built column maps, because the cases
that matter are two columns one name answers to and a captured page gives one such
pair rather than the several needed to show which signal decided:

- a near-miss column resolving, with the assumption recorded (run 8's own words,
  the four `normalized` spellings, a near-miss table **header**, and the key
  verbatim assuming nothing);
- a genuinely unknown column still failing (`banana`, `title`, `prce`, a whole
  selector, `column:Name` where nothing has a header);
- two similar names disambiguated by value shape, in both directions, plus the
  fallback that proves standing aside is not excluding;
- every strict reading before every guess (the plan's own key winning against a
  detected guess that picks a *different* column; the reversed map; the guess not
  taking a claimed column);
- the resolved slot carrying every assumption, read off `resolveWebExtractionSlot`
  through a real handle store.

`.../extraction/tests/slot.test.ts` — one new test proving the same rule
end-to-end through `resolvePlanNodeParameters`: run 8's `fields` plus a `where` in
the same words resolving to the fixture's own recorded request. Three rows moved
out of the `unknownField` list because they now resolve, and `banana` was added in
their place.

`.../extraction/tests/conditions.test.ts` — comments only. Two rows there said a
column must be "a detected key" and that a selector "could only have been
guessed"; both are now stated as "no plausible candidate", with why a whole
selector still misses.

---

## 7. Not verified

- **No live run, and no browser.** Nothing here is observed against a real page or
  a real provider. That a resolved column really reads the values a person meant
  is argued from the specs, not measured.
- **The extension build was not run.** `column-match.ts` value-imports
  `fluxiq/automation-studio/nodes`, the same narrow entry point
  `actions/extraction/field-match.ts` and `output-nodes/extract-list/dispatch.ts`
  already value-import, and t142 ran the build once to prove that crossing passes
  the extension's barrel guard. I did not re-run it, because another agent is
  editing `apps/extension/src/content/` and a build over their tree would report
  their state, not mine.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run whole**, as instructed.
- **`assumed` reaches no run artifact.** It is on the slot's resolution and
  asserted there. `../resolve-plan-node.ts` (outside my files) drops it, so
  nothing downstream sees it yet — the gap is stated on
  `WebExtractionSlotResolution` with the two hops it needs.
- **The 24 numeric attributes are read off the HTML and ARIA specifications, not
  off any captured detection.** No fixture in this repository proposes an
  `aria-valuenow` column; the `STARS` map in my test is written by hand to the
  shape `packet.ts` would bind. Whether real sites' rating widgets get detected
  that way is unmeasured.
- **The scores in the tests are Core's current output**, pinned as literals. A
  change to Core's similarity function or floor will fail these rows, which is
  intended — they are the measurement — but it means Core cannot retune silently.

## 8. Open questions or contradictions found

1. **The brief's premise about sample values is false** (section 2). The rule is
   built, and the shape signal is real, but it comes from the column's spec and
   the HTML/ARIA specifications rather than from values. If a future task wants
   sample-based shapes on this path, it is a **D3 change** — page values would
   have to cross into the binding — and that is a decision about the privacy
   contract, not a matter of plumbing.
2. **Nothing carries the assumption to a person or a repair.** Two hops are
   missing and neither is in this directory: `plan-resolution/resolve-plan-node.ts`
   would have to put `assumed` on its resolved outcome, and FluxIQ Core would have
   to project it beside the authored node, as it already projects a corrected
   *parameter* name (`flow-bootstrap/plan/name-correction-assumption.ts`). t142
   reached the same wall from the dispatch side. **Both paths now produce an
   assumption in the same shape and neither can publish it** — that seam is one
   Core task, and it would close both at once.
3. **`web.handle.ambiguous` is now the only naming refusal that survives a near
   miss, and it may be the wrong shape.** Two columns with the same folded header
   still refuse. That is defensible — two exact answers is not a spelling — but the
   shape signal could often tell them apart, and a refusal is what the standing
   rule exists to avoid. I left it because widening it was not in the brief and
   because an ambiguous *header* is a page problem rather than a model one.
4. **`url` and `title` remain the two commonest model words that resolve to
   nothing**, on both paths (t142 measured `title` → `name`; I measured `url` →
   `product-link`). Both are synonyms rather than misspellings, so the floor is
   not what is stopping them: a small synonym list — `url`/`link`/`href`,
   `title`/`name`/`label` — would close the most frequent remaining miss, and it
   belongs in Core beside the matcher rather than here, so that a node id and a
   column name are corrected by one vocabulary.
