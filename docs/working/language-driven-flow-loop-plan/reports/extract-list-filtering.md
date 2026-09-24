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

---

# Follow-up: filtering is optional, and it can no longer answer with nothing

Second brief, same day. `run-mug3tnti-9ab80b85` on
`everything-store-plus-earbuds-under-50` returned **0 records where 13 were
expected**, from 30 provider calls. The run before the filtering work returned 55
unfiltered; the run after it returned 10 with 7 right. So the capability worked
and there was no floor under it: with conditions available, the model wrote ones
that rejected every row, and nothing told it or the person that the filter had
removed the answer rather than that the page had held nothing.

The product owner named the fault: requiring the model to get inclusion right up
front. "IT SHOULD BE ABLE TO INPUT MINIMAL INITIAL PARAMS IF IT WANTS AND THEN
THE REPAIR CAN IMPROVE IT LATER."

## What a node with no conditions at all now returns

**Every row it reads, exactly as before this work started.** An absent `where`
produces no filter, no report, and a summary byte-identical to the one a
pre-change build produced — the action test asserts the summary by `deepEqual`,
so an added key would fail it. `where: []` now means the same thing instead of
refusing the request. Nothing about filtering is required to get a plain
extraction: not a condition, not the key, not a wrapper.

## The four points, and what each became

**1. Optional in every sense.** `itemFilterFor` returns no filter for an absent
or empty clause. The request reader drops an empty `where` from the request
rather than refusing it (`where: []` was a refusal until now), and the plan
resolver resolves one to a plain read. A read with no conditions carries no
condition report at all, so nothing downstream changes shape.

**2. Nothing include-by-default.** Where a shape could be read two ways, the
wider reading wins: an empty clause is no conditions, and `not: false` is
dropped as saying nothing rather than carried. The pressure that actually
produced the failure was in the prompt text, so that is where most of this went —
see *The text* below.

**3. A slightly wrong condition can no longer empty the result.** The three cases
the brief named now behave like this:

| Case | Before | Now |
| --- | --- | --- |
| a column name that does not match | the plan is refused by name (`unknown_field` / `invalid_where`) before it runs | unchanged — a named, repairable refusal, never a silent empty |
| a comparison that cannot parse a value (`"Currently unavailable"` under `lessThan: 50`) | every row rejected, empty answer | the rows are returned, and the report says the conditions kept none |
| a regex that compiles and matches nothing | every row rejected, empty answer | the same |

The rule is in one place,
`apps/extension/src/content/extraction/filtered-answer.ts`: **when the conditions
keep nothing and there is something to fall back to, the read answers with the
rows they rejected.** It is its own module precisely so it could be unit-tested —
`list-reader.ts` needs a document and cannot be tested in Node. The rejected rows
cost an array rather than a second pass, because the record is built before the
conditions are asked; they are bounded by `maxItems` and deduplicated exactly as
the kept rows are, and their missing required fields are folded in only when they
become the answer.

**4. It says when filtering removed everything.** A new counts-only report,
`WebAutomationExtractionConditionReport`, rides in the extraction summary — the
one wire shape whose whole contract is that it carries counts, flags and declared
field keys and never a value. It carries `applied` (items the conditions were
asked about), `kept` (items every condition held of), `rejected` (one count per
condition, positionally) and `unfiltered`. The filter was changed to answer with
**which** conditions rejected an item rather than a yes or no, and no condition
short-circuits the rest, so each count is its own rather than an artefact of the
order they were written in.

The same fact is in the validation prose the model reads:

> `2 records from 1 page, but where kept none of the 2 items it was applied to, so the rows it rejected were returned unfiltered; where[1] rejected every one -- narrow the conditions rather than trusting these rows`

and where no single condition is to blame it says so instead: *"no one condition
rejected them all, so it was the conditions together"*.

## The text, which is where the pressure came from

The grammar and the detect tool's description had made narrowing look
compulsory: three condition shapes in the grammar and a four-condition worked
example, with nothing saying it was optional.

- **The grammar leads with optionality**: `where is optional: omit it, keep every
  item, narrow later.` It sits before any word that narrows, which a test pins.
- **The worked example is now the least a read needs** plus the one exclusion
  that is nearly always right (the sponsored mark). It showed four conditions for
  a day; an example is the only complete, valid request a model sees, so it
  models *how much* to write as much as what.
- **The detect tool's description** says filtering is optional, that leaving it
  out is the right first attempt when unsure, and what the node does when
  conditions reject everything — so a model cannot read an empty answer as an
  empty page. The richer shapes (`contains` with a list, `not: true`) moved here,
  where there is room.

### Both prompt bounds, again

| Text | Bound | Was | Now |
| --- | --- | --- | --- |
| `extractList` parameter description | 700, silently truncated | 697 | **696 (4 spare)** |
| detect tool description | 2,000, **refused outright** | 1,981 | **1,990 (10 spare)** |

Fitting the optionality clause inside 700 cost three things, none of them a rule:
the third condition shape (still named, and still shown in the detect
description), `(this page)` after `paginate?: false` (the pagination clause now
glosses it for both branches), and **the literal branch's duplicate `paginate`** —
pagination is now described once, for both branches, which is both shorter and
truer. That duplicate is what actually bought the room.

The 2,000-character bound bit again on the way: the first draft was 2,086 and
Core refused it as `harness_option.description_invalid`, which surfaced as five
unrelated `llm-evidence` tests failing inside the option registry, naming neither
the length nor the text. There is now an assertion on that length in this
repository, so the next overflow fails as a length.

## Commands run and observed results

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/domain check` | exit 0, no diagnostics |
| `pnpm --filter @fluxiq-web-extension/domain test` | `# tests 804 / # pass 802 / # fail 2` — both failures are a concurrent Core change, see below |
| `pnpm --filter @fluxiq-web-extension/extension check` | exit 0 (type check plus in-memory bundle of every browser entry) |
| `EXTENSION_TEST_BUILD_LABEL=extract-filter pnpm --filter @fluxiq-web-extension/extension test` | `# tests 761 / # pass 761 / # fail 0` (was 749 before this follow-up) |
| `node scripts/structure-audit.mjs` | `structure-audit: passed (104 warning(s), 121 baselined)` |

New tests: 19. `content/extraction/tests/filtered-answer.test.ts` (4, the
fail-open rule), `content/extraction/tests/item-filter.test.ts` (6, per-condition
rejection reporting), `content/actions/tests/extract-list.test.ts` (3 added, the
report on the wire and the prose naming the culprit),
`actions/extraction/tests/summary.test.ts` (4, the counts-only contract),
`output-nodes/extract-list/tests/catalog-text.test.ts` (1 added, optionality
before narrowing), plus the optionality and length assertions in
`llm-evidence/tests/tools.test.ts` and the two `where: []` rows that flipped from
refusal to plain read.

### The two failing domain tests are not this work

`not ok 482 - a step that says it would publish, under a grant that permits
nothing, asks the person` and `not ok 488 - a declaration written onto the step's
parameters is read...`.

Both are the permission gate, exercising only `web.dom.click`, `web.dom.type` and
`web.dom.capture_snapshot` — no extraction anywhere. Neither test file nor any
domain source they touch is modified in this working tree. What changed is
**Core**: another agent is editing
`packages/fluxiq/src/programs/automation-studio/runtime/action-permissions/gate.ts`
and rebuilt Core's `dist` at 15:20 today, narrowing the gate so that only a
destructive class can stop a run — its own new comment says "Making something new
and sending what the instruction said to send are not the gate's to refuse at
all". `send_or_publish` is therefore no longer refused, which is exactly why a
test expecting a refusal now sees `ok: true`. I did not touch it; it belongs to
whoever owns `permission-gate-narrowing.md`.

## Not verified

- **No live run**, as instructed. Whether the model now writes fewer and better
  conditions is unmeasured, and it is the only thing that settles whether the
  text changes worked.
- **The fail-open path has no browser coverage.** The decision is unit-tested
  pure; the reader that feeds it needs a document, so the wiring between the loop
  and the decision is proven only by the type checker and the in-memory bundle.
  The two e2e specs that exercise `where` (`item-conditions.spec.ts`,
  `list-completeness.spec.ts`) both assert bounds that keep some rows and not
  others — I read them to confirm the fallback cannot fire there, so neither
  covers it and neither is broken by it. **An e2e case for a read whose
  conditions reject every row is the gap worth closing on the next live run**; I
  did not add an unrunnable one.
- A read carried across documents reports what its own document did and can fall
  back only to its own rejected rows, because the checkpoint carries counts and
  not rows. Honest in the report (`unfiltered` stays false with nothing to fall
  back to) but untested, and it needs a navigation to reproduce.
- No repository-wide `pnpm check`, `test` or `build`.

## Open questions and judgements made

1. **A fallback answer still passes validation, deliberately.** The rows satisfy
   `minItems`, so the node succeeds and the Flow continues, carrying a too-wide
   answer plus a loud report. I did not fail the node, because a failed node
   stops the Flow and yields neither an answer nor a judgement of one — and the
   brief asks for a superset that "can be repaired". This puts real weight on the
   judge reading `conditions.unfiltered`: **if the judgement does not read it, a
   too-wide answer will pass silently.** That is the one thing I would check next
   after a live run.
2. **The fallback is unconditional, and `minItems: 0` does not switch it off.** I
   considered honouring `minItems: 0` as "empty is a legitimate answer", and
   rejected it on evidence: both the grammar and the detect description tell the
   model to write `minItems: 0` for a filtered read, so the failing run almost
   certainly had it, and a `minItems`-coupled fallback would not have fired.
   The consequence is that a Flow can no longer learn "nothing matched" from an
   empty table; it learns it from `unfiltered` and the counts, which say strictly
   more. A branching Flow that tests "are there any results under $50?" must read
   the report rather than the row count.
3. **One restrictive reading is left, and I left it on purpose.** A condition that
   names a column and compares nothing — `{field: "ad_label"}` — still means
   `is: "present"`, which is the narrower reading and can be the complement of
   what was meant. I did not change it: it is an explicit documented meaning
   rather than an ambiguity, its failure mode is now floored by the fallback, and
   the codebase already refuses the genuinely ambiguous form (a bare string
   `where: ["ad_label"]`) for this exact reason. Changing pre-existing semantics
   with no measurement is the kind of guess that produced this follow-up. If it
   should become a no-op instead, the change is one branch in `valueHolds`
   (`actions/extraction/condition-match.ts`).
4. **Per-condition attribution is per-condition counts, not a partition.** They
   sum above `applied - kept` when one item fails several conditions at once.
   That is what makes "condition 2 rejected all 30" sayable, which is the fact a
   repair can act on.
