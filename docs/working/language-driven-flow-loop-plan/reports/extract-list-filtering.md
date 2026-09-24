# `web.dom.extract_list`: declarative filtering

Task: give the node's `where` enough vocabulary to carry what a person states in
one clause, after `run-mug1z9k9-ef625d8b` returned 55 rows for 13 wanted, 0
matching, because none of the instruction's three qualifying conditions and two
exclusions could be expressed.

## Outcome

Done. The condition vocabulary now covers include and exclude, regular
expressions, value matching, numeric and currency-tolerant comparison,
presence/absence and composition. Filtering stays deterministic and replayable:
nothing here makes a provider call, and the whole judgement is one pure function
over a value string.

Everything the model may write about a value is read in one place and judged in
one place, so a condition the plan resolver accepts is exactly the condition the
page runs.

## What a condition may now say

One condition names its value as before — `field` (a key of this request's
`fields`) or `read` (a field of its own) — and then compares it:

| Phrase | Means |
| --- | --- |
| `is: "present" \| "absent"` | the page has the value, or does not |
| `atLeast`, `atMost`, `lessThan`, `greaterThan` | the number in the value |
| `equals` | a number against the number in the value, a string against its text |
| `contains`, `startsWith`, `endsWith` | the value's text |
| `matches` | a regular expression over the value's text |
| `not: true` | keep the items the rest of the condition rejects |

- **Composition.** Several conditions across several columns already AND
  together, and several phrases inside one condition do too, with `not`
  inverting the whole condition afterwards. So "rated 4.0 or higher and under
  $50 and not sponsored and no charging cases" is four conditions on one node,
  which is what the new resolver test asserts end to end.
- **Any-of.** `equals`, `contains`, `startsWith`, `endsWith` and `matches` each
  take one value or a list of them, and a list means any of them. That is what
  makes "no ear tips and no charging cases" one condition rather than a shape to
  remember.
- **Currency and rating formats.** A numeric comparison reads the first number
  written in the value, group separators removed. Proven by test against
  `16.00 USD` → 16, `$49.00` → 49, `3.7 out of 5 stars` → 3.7, `4.0` → 4,
  `$1,299.00` → 1299, `$39.99$39.99` → 39.99, and `Free`/`Plus`/`""` → no number,
  which fails every comparison because a row with no price is not a row under
  $50.
- **Text handling.** Runs of whitespace (including NBSP) collapse to one space
  and case is ignored, because a card's title is laid out for a screen rather
  than for a comparison.
- **Regular expressions.** A bare source is compiled case-insensitively; the
  `/source/flags` form says what its flags say, so `/Sponsored/` is how case is
  asked for. `g` and `y` are dropped, since a stateful expression would answer
  differently per row.
- **A missing value under `not`.** `{contains: "charging case", not: true}` keeps
  an item whose title the page did not have. "No charging case in the title" is
  not a reason to drop an item with no title.

### Easy to produce

- One value or a list, everywhere a list is allowed.
- A number written where a text is expected is read as its digits.
- A key is matched with case and punctuation ignored, and a set of other names
  is read as the phrase it plainly means: `min`/`gte`, `max`/`lte`, `lt`/`under`,
  `gt`/`over`, `regex`/`pattern`, `includes`/`has`, `equalTo`/`eq`,
  `beginsWith`/`prefix`, `suffix`, `exclude`/`negate`. The **wire always carries
  the canonical key**, so nothing downstream sees fifteen spellings.
- `not: false` is dropped, since it is what no `not` at all means.
- `not` accepts `true`/`false` and the strings `"true"`/`"false"`.

### What still refuses, and why

Nothing is dropped quietly, because a dropped condition returns the whole
unnarrowed list and reports success: a key the grammar cannot place, an empty
text (`contains: ""` holds of every item), an empty list, a bound that is not a
finite number, a regular expression that does not compile or is longer than 200
characters, `is: "absent"` beside any comparison, and two spellings of one phrase
that disagree. A refusal from the plan resolver now names the offending key
(`…where.0.matches`) rather than its index (`…where.0.1`).

## What changed and why

New, in `domain/src/actions/extraction/`:

- **`condition-match.ts`** — the one judge of whether a value satisfies a
  condition (`webAutomationExtractConditionHolds`), plus the number reader and
  the pattern compiler. It is in the domain rather than the extension so the
  content script, the plan resolver and the tests cannot disagree about what
  "under $50" means; a second implementation would be a row set that differs
  between the page and everything reasoning about the page, and nothing would
  report it.
- **`condition-grammar.ts`** — the one reader of what a condition *says*, used
  by both the dispatch reader and the plan resolver, so a condition the resolver
  accepts is a condition the page runs.

Changed:

- `request.ts` — the condition type widened; `WEB_AUTOMATION_EXTRACT_CONDITION_BOUNDS`
  moved to `condition-match.ts`; the doc comment that declared text matching
  deliberately impossible rewritten (see *Contradictions* below).
- `read-request.ts` — condition reading delegated to the grammar.
- `schema.ts` — the new properties declared, and the `where` description updated.
- `actions/types.ts` — `webAutomationExtractConditionHolds` re-exported for the
  extension, which cannot reach `actions/extraction/` directly.
- `plan-resolution/extraction/conditions.ts` — keeps only the column-naming half;
  every phrase now comes from the shared grammar and is carried through
  `present<T>()` by name, so a new phrase is a compile error here until it is
  written.
- `plan-resolution/issue-position.ts` — the condition keys come from the grammar
  so refusal positions spell them.
- `apps/extension/src/content/extraction/item-filter.ts` — the bounds table and
  the number reader deleted; it now reads the value off the DOM and asks the
  domain. **DOM-reading behaviour is unchanged.**
- `runtime/llm-evidence/tools.ts` — the detect tool's description previously
  said "There is no test against the text in a column", which would have steered
  the model away from the new vocabulary. It now describes the whole of it.

## The parameter-description bound, measured

Core keeps a node parameter description to **700 characters** and truncates
silently past it (`flow-bootstrap/plan/parameter-text.ts`). The grammar stood at
**699 of 700** before this change, so the filtering vocabulary could not simply
be appended.

**It now stands at 697 of 700 — three characters spare.** The example is 349 of
its own 600-byte bound.

Two clauses were cut to fit, chosen by one rule: *a clause whose absence is a
named refusal is cheaper than a clause whose absence is a wrong answer.*

- the field-spec form `{kind: text|attribute|link|value|column, …}`. The string
  grammar still names `attribute`, `text`, `link` and `column:`; only the spec
  form and the word `value` left the text a model reads. The reader accepts all
  five kinds exactly as before, and the spec form belongs to the literal branch
  — the path this text exists to steer a model away from. No live run has ever
  failed for want of it. `domain/src/output-nodes/tests/definitions.test.ts` was
  relaxed for `value` alone, with the reason written in place.
- `Keys A-Za-z0-9_-`, the field-key charset. A bad key is refused before the Flow
  runs, by name, as `web.extract_list.invalid_field_key`, which a model can
  repair from. A `where` clause that does not fit is not refused — it is
  truncated in silence and the answer is simply wrong.

Everything with a recorded live failure behind it was kept: detect-the-list-first,
the handle form, `paginate?: false (this page)`, `minItems`/`maxItems`, the
link/`@href` distinction, and "maxPages/maxScrolls = pages to read, not pages
present".

**A second Core screen was hit and is worth recording.** A harness/tool
description is refused outright above **2,000 characters**
(`harness_option.description_invalid`, `automation-studio/runtime/llm/harness-options/option.ts`)
rather than truncated: the first draft of the detect tool's description was
2,086 and failed five unrelated tests with a registry error naming neither the
length nor the tool's text. It now stands at **1,981 of 2,000 — 19 spare**, fitted
by cutting two illustrations rather than a rule. Both bounds are now recorded in
comments beside the text they bound.

The finding for the supervisor: **between them, these two bounds are everything a
model ever learns about `where`, and both are now within twenty characters of
full.** The next clause that earns its place has to displace one already there,
or Core's 700 has to move again — which it already did once, 600 → 700, on
2026-09-24.

## Commands run and observed results

All package-scoped. No repository-root `pnpm build` was run, and no build output
was written: the extension check bundles in memory (`write: false`), and the
extension test run used `EXTENSION_TEST_BUILD_LABEL=extract-filter` so it could
not overwrite a concurrent run's scratch directory.

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/domain test` (before any change) | `# tests 782 / # pass 782 / # fail 0` |
| `pnpm --filter @fluxiq-web-extension/domain check` | no output past the two `tsc` lines; exit 0 |
| `pnpm --filter @fluxiq-web-extension/domain test` (final) | `# tests 797 / # pass 797 / # fail 0` |
| `pnpm --filter @fluxiq-web-extension/extension check` | no output past the script line; exit 0 (type check plus an in-memory bundle of every browser entry, which is what proves the content script may value-import the new domain function) |
| `EXTENSION_TEST_BUILD_LABEL=extract-filter pnpm --filter @fluxiq-web-extension/extension test` | `# tests 749 / # pass 749 / # fail 0` |
| `node scripts/structure-audit.mjs` | `structure-audit: passed (104 warning(s), 121 baselined)` |

Two intermediate failures worth recording, both fixed:

- `harness_option.description_invalid` on five `llm-evidence` tests — the detect
  tool description over Core's 2,000-character bound, described above.
- `FAIL [failure-as-empty] domain/src/actions/extraction/condition-match.ts` — a
  bare `catch { return undefined }` around `new RegExp`. Now `catch (error) { if
  (error instanceof SyntaxError) return undefined; throw error; }`.

New tests: 15 across three files —
`domain/src/actions/extraction/tests/condition-match.test.ts` (9, every operator
and every messy value format), `.../tests/item-conditions.test.ts` (2 added, the
reader and its other names, plus 10 new refusal rows), and
`.../plan-resolution/extraction/tests/conditions.test.ts` (2 added, the model's
vocabulary over a detected column, and refusal positions).

## Not verified

- **No live browser run.** The judgement function is proven by unit test in
  Node; the page half — reading a column off a real card and handing the string
  to it — is covered only by the existing Playwright content suite
  (`apps/extension/e2e/content/tests/extraction/tests/item-conditions.spec.ts`),
  which was not run here and which was not changed. A live run on the
  everything store is what would confirm the original failure is closed.
- **No live provider run**, so it is unmeasured whether the model actually
  writes the new phrases. That is the only thing that settles whether the
  description changes did their job, and it is the reason the two character
  bounds above are reported rather than assumed.
- **No repository-wide `pnpm check`, `pnpm test` or `pnpm build`**, per the
  brief. `packages/test-runner` and `packages/test-contracts` were not compiled.
- The `where` filter's cost per row is unmeasured. A regular expression is
  recompiled per row and per condition; patterns are capped at 200 characters
  and the text handed to one at 2,000, which bounds a bad pattern's cost but does
  not make a catastrophically backtracking one safe. On lists of up to 1,000 rows
  this was judged acceptable without measurement.

## Open questions and contradictions found

1. **This reverses a written decision, deliberately.** `request.ts`,
   `item-filter.ts` and `plan-resolution/extraction/conditions.ts` each said in
   prose that there is *deliberately* no substring or equality test over text,
   citing a word-list heuristic deleted on 2026-09-18 for guessing which cards
   were advertisements. The brief asks for exactly that capability. I read the
   two as distinguishable and wrote the distinction into the code: what was
   deleted was **the product inferring** which words matter; what is added is
   **a person naming** words they do not want, in a column they named. The line
   that still holds is that a condition tests one named column and never
   searches an item's prose. If the supervisor disagrees, the place to change it
   is the `contains`/`matches`/`equals`-string entries in
   `condition-grammar.ts`; the numeric and presence half needs nothing.
2. **No cross-column OR.** Conditions AND together and any-of works within one
   comparison on one column. "Under $50 **or** on sale" needs two nodes or a
   branch. That was a deliberate omission: a general `any` group costs
   description characters this budget does not have, and the everything-store
   instruction did not need it. Worth revisiting only if a live run asks for it.
3. **The working tree holds another agent's concurrent changes.** When I started,
   `domain/src/runtime/llm-evidence/structure/detect.ts`, `structure/index.ts`,
   `structure/refusal.ts` (new), `tool-rejection.ts`,
   `harness-options/exploration-terms.ts` and their tests were already modified
   or added by someone else, along with two new report files. I touched none of
   them, but every command above ran against the combined tree, so the passes
   are joint passes rather than a clean measurement of this change alone.
