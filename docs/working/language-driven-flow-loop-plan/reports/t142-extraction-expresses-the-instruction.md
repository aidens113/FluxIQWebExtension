# t142 — The extraction node must be able to express run 8's instruction

## Outcome

**Done**, with two gaps identified and deliberately not built because they belong
to the page and to FluxIQ Core rather than to `domain/src`. Both are named below
with the exact file and function that would carry them.

The headline finding is not the one the brief expected. **The vocabulary was
almost entirely there already**: five of run 8's six qualifying clauses were
expressible before I touched anything, and a sixth needs no parameter at all.
What was missing was not expressiveness but **tolerance** — the request reader
refused the *whole* request over one malformed part, which turns a model's small
slip into an extraction node that cannot run and a Flow that stores nothing. That
is the failure mode the coordinator's classification says dominates (six of ten
built Flows stored zero records), and it is now closed.

---

## 1. What the vocabulary could express before I started

Run 8's instruction, clause by clause, against the contract as it stood at commit
`4896d96`. `where` is `WebAutomationExtractItemCondition[]` in
`domain/src/actions/extraction/request.ts`.

| Clause of the instruction | Parameter that carries it | Expressible before? |
| --- | --- | --- |
| "is Brightaisle Plus eligible" | `where: [{ read: ".badge-plus", is: "present" }]`, or `{ field: "<badge column>", contains: "Plus" }` | **Yes** |
| "rated 4.0 or higher" | `where: [{ field: "rating", atLeast: 4 }]` | **Yes** |
| "priced under $50" | `where: [{ field: "price", lessThan: 50 }]` | **Yes** |
| "leave out sponsored placements" | `where: [{ read: ".sponsored-label", is: "absent" }]`, or `{ field, contains: "Sponsored", not: true }` | **Yes** |
| "leave out accessories such as ear tips or charging cases" | `where: [{ field: "name", contains: ["ear tip", "charging case"], not: true }]` — a list means *any of these*, which is how the clause was said | **Yes** |
| "going through every page of results" | `paginate: { mode: "next", next, maxPages }` | **Yes** |
| "keep the order the search results show them in" | *nothing* — and nothing is needed. Records come back in document order and pages in the order they were followed (`content/extraction/list-reader.ts` pushes each item as it walks `querySelectorAll`, and appends each page after the last). | **Yes, by default** — but it was **undocumented**, so neither a model nor a reader could know it was guaranteed |
| "list each pair only once even if it turns up on two pages" | *nothing nameable* — de-duplication happens automatically in the page-by-page modes (`next`, `numbered`) and in a continued read, keyed on **the whole record** | **Partly** — see gap A |
| "columns name, price, rating and url" | `fields` | **Yes** |

I verified each row by writing the whole instruction as one request and asserting
that every clause survives the reader to the character — the new test
`domain/src/actions/extraction/tests/read-request.test.ts`, test *"every clause of
an instruction's qualifying conditions reaches one request"*.

**So run 8's Flow carried one condition not because the node could not say the
other five, but for reasons outside this brief**: the authoring text (measured
repeatedly in `output-nodes/extract-list/catalog-text.ts`) and, per the
2026-09-25 debug, the fact that **the repair cannot amend a node's parameters at
all** (that debug's cause 8, in Core's `llm/harness/structured-response.ts`). I
did not touch either, and neither is mine.

### Gap A — de-duplication cannot be told which column identifies a row

The key is the entire record, so two sightings of one product that differ in any
column — a price that moved between page loads, a URL that gained a tracking
parameter — are two rows. For run 8's fixture this is almost certainly harmless
(the pages render identical cards), but the instruction's words are "list each
pair only once", and the pair's identity is its `url` or its `name`.

**Not built, and it is not a domain-only change.** A `distinctBy: ["url"]` member
would have to be honoured by `apps/extension/src/content/extraction/list-reader.ts`,
where the key is computed by `contentKey(record, fields)` and applied in the
`earlierPages` set and in `rememberRejected`. A request member the page ignores is
worse than no member: it would read as a capability and silently do nothing. The
domain half is three lines in `request.ts`, `schema.ts` and `read-request.ts`; the
page half is one argument to `contentKey`. I have documented the gap on the
contract itself (`request.ts`) so the next reader finds it rather than rediscovers
it.

### Gap B (closed) — order and once-per-row were guaranteed but unwritten

Both are now stated on `WebAutomationExtractListRequest` in `request.ts`, with
*why there is deliberately no way to ask for another order* (a request that could
sort could sort wrongly; sorting belongs to a node that sorts). I did **not** put
them in `WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR`: that string is at 696 of Core's
700-character parameter-description bound, every clause in it was bought by
cutting a measured one, and these two facts change nothing the model has to
*write*. If they ever need to reach the model, Core's 700 is the blocker, exactly
as that file's own comment predicts.

---

## 2. What I changed, and why

### 2.1 The reader stops refusing a whole request over one droppable part

`domain/src/actions/extraction/read-request.ts`.

Before, a property **sent but unreadable** refused the entire request:
`itemElement`, `paginate`, `minItems`, and any one condition of `where`. The
file's stated reason was sound about a *silent* drop and wrong about the cost. A
refused request is not a narrower answer — it is an extraction that never runs.
Run `run-muhubegx-9469de5e` authored `paginate: { next: null, maxPages: 5 }`,
which plainly means "keep reading, five pages, I was never shown the control",
and the old rule's answer to that was no rows at all.

Those four parts are now **dropped and named**. Every drop can only widen the
answer — the page shown, the default minimum, an unnarrowed row set — and a wide
answer is visible to the loop's judgement while an empty one is not
(`content/extraction/filtered-answer.ts` already argues that asymmetry one layer
down).

What still refuses the request whole, and why:

- **`item` and `fields`.** A read with no rows to find, or no column to keep, is
  not a wider answer but a different one. Silently dropping a requested column
  also changes the shape of the table the oracle compares positionally. Each
  already has a named, repairable code.
- **A request naming a frame** (`frame`, `frameId`, `frameSelector`,
  `frameUrlPath`). Read without it, the page searches the document it was
  delivered to while the author believed it had named another.

**The naming half is not optional.** `webAutomationExtractListRequestRead` now
returns `{ request, dropped, assumed }`, and
`output-nodes/extract-list/issues.ts` asks for the request **whole or not at
all**. So a *plan* carrying any of these is still refused before it runs, by the
same code it always was — `invalid_paginate`, `invalid_where`,
`invalid_min_items`, `min_items_exceed_max`, `invalid_item_element`. The
tolerance applies only at dispatch, where there is nobody left to repair it. That
ordering matches this repository's own measured rule: a clause whose absence is a
*named refusal* is cheaper than one whose absence is a *wrong answer*.

### 2.2 A condition naming a column that does not exist resolves to the nearest one

New module `domain/src/actions/extraction/field-match.ts`.

Before, `where: [{ field: "productName", ... }]` on a request declaring `name`
refused the whole request. Now it resolves, and the read records that it assumed.

**Resolution is Core's, not a second implementation of it.** Core already exports
`automationStudioMatchName` from `fluxiq/automation-studio/nodes`, with a
measured score floor of 0.25 and a documented normalizer that folds casing,
separators and camel-case humps. I reused it rather than writing an edit distance
here. Measured behaviour, asserted in the tests:

- `ratng` → `rating` (`nearest`; a typo inside the only word);
- `Price` → `price` (`normalized`; a spelling variant, not a guess);
- `productName` → `name` (`nearest`; a name written long);
- `sponsored` against `name/price/rating/url` → **nothing**, which drops that one
  condition and keeps every row. That is the honest failure the rule allows, and
  it is a *wide* answer rather than a refusal.

**Name and shape, as the rule requires.** A request's fields declare what to read
and never what type the value holds, so the shape is mostly unknowable here. The
one exception is a field that reads an **address** — a `link`, or an `attribute`
naming `href`/`src`/`action`/`poster` — and a comparison on the *number* in a
value was not written for one of those. So where the name alone leaves a guess,
address columns are stood aside and the guess is made among the rest; standing
aside is not excluding, and with nothing else to pick an address column is still
the answer, because a guess beats a dropped clause. A string-grammar field makes
no claim either way: the page owns that grammar
(`content/extraction/field-spec.ts`) and a second parser of it here would
disagree with the first about which selectors carry an attribute.

An exact key is never an assumption, and an **excluded** column is not a
candidate at all (D12: it is never read, so a condition over it could only ever
be false).

### 2.3 An empty condition is a no-op the node says it made

`where: [{}]` — a condition naming no read and comparing nothing — used to refuse
the whole request. It is now dropped, which means *keep every item*; `dropped`
carries `where.0`, and an author still gets `web.extract_list.invalid_where`
before the Flow runs. `where: []` and a `where` every condition left both resolve
to no clause at all, as omitting `where` always has.

### 2.4 A producer's value is still read whole or not at all

New `webAutomationExtractListRequestWhole`, used by three callers that must not
inherit the tolerance:

- `output-nodes/extract-list/issues.ts` (the author-facing codes);
- `actions/extraction/recorded-definition.ts` — the producer is the recorder, and
  a definition arriving with its pagination quietly dropped would replay a read
  the user never recorded;
- `domain/src/extraction/structure-detection.ts` — the producer is the page's own
  detector, and a proposal claiming no pagination because the detector
  misdescribed one is a misstatement nobody can see.

The last of those is **outside the file list in my brief** and I am flagging it
explicitly. It is one line plus its comment. I changed it because leaving it
would have silently loosened a wire copy's guarantee as a side effect of my
change; the existing test for it
(`domain/src/extraction/tests/structure-detection.test.ts`, "a detection any part
of which is malformed is refused whole") failed when I did not, and passes
unchanged now — which is the point.

### 2.5 The account of the read: two counts a zero read is diagnosed by

`domain/src/actions/extraction/summary.ts` gains two optional counts:

- **`itemsSeen`** — items the `item` selector matched, across every page read,
  before any condition, any duplicate and the item bound;
- **`emptyRecords`** — records that yielded **no** declared field at all.

These are the two numbers that separate the coordinator's four states. See
section 3 for exactly which state each artifact field settles, and for the honest
limit on this half of the work.

---

## 3. The four states of a zero read, and what can tell them apart

| State | Distinguishable from a run's artifacts today? |
| --- | --- |
| **The node never ran** | **Yes.** No `extraction` member on the attempt at all. `RunExtractionRead`'s rule is "absent stays absent". |
| **It ran and the item locator matched nothing** | **Yes.** `listPresence: "never_appeared"`. Already built (t132). |
| **It matched rows and every field came back empty** | **No.** This is the gap. `missingFields` names the fields *some* record lacked, so one bad row and forty empty ones read identically — and **both fail the verb's post-condition and store nothing** (`apps/extension/src/content/actions/extract-list.ts`: any non-empty `missingFields` is a failed validation → `output_not_observed`). `emptyRecords` equal to `recordCount` says it exactly; `itemsSeen` above `recordCount` with no conditions says duplicates or the bound. |
| **It matched rows and the conditions removed all of them** | **Yes.** `conditions.applied > 0`, `kept: 0`, `unfiltered: true`, and `rejected[]` names which clause did it. Already built. |

**The honest limit, and it is the most important sentence in this report.** The
two new counts are **inert until two changes outside `domain/src` land**, and the
domain had to be first because `webAutomationExtractionSummaryValue` copies field
by field, so an undeclared count is dropped at this boundary however faithfully
the page sends it. The remaining halves:

1. **`apps/extension/src/content/extraction/list-reader.ts`** must count them.
   `itemsSeen` is a counter beside the existing `read` map in the item loop;
   `emptyRecords` is `itemRead.missing.length === fields.length` at the point a
   record is pushed. Then
   `apps/extension/src/content/actions/extract-list.ts::summaryOf` carries them,
   exactly as it carries `listPresence` and `conditions`.
2. **FluxIQ Core's `service/summaries/extraction-summary.ts`** must project them,
   and `packages/test-contracts/src/extraction-read/read.ts` must declare them,
   or they will not reach `snapshots/flow-lane.json`. The whole chain is
   enumerated field by field at every hop — which is deliberate (nothing off the
   page may ride out on a diagnostic) and means a new count is a four-file,
   three-repository change by design.

I did not build either. The page is outside my ownership; Core is outside this
repository and the brief says to name such a gap rather than build it.

**On "which conditions it could not apply".** This is decided in the *domain*
reader, not on the page, so the page cannot report it and the summary is the wrong
channel for it. What exists now:

- at **authoring** time it is a named refusal (`invalid_where`), which is the
  channel that reaches the model;
- at **dispatch** time it is recorded as the difference between the authored
  `extractList` (published in the run's `authoredNodes[].parameters`) and the
  `where` the page was actually given. A reader with the authored value can
  recompute the drop exactly, because the reader is deterministic.

**One residual I introduced and want on the record**: when a condition is
dropped, the positions shift, so `conditions.rejected[0]` in the page's account
may not be the author's `where[0]`. In practice the authoring refusal means the
dispatch path rarely sees a dropped condition, and the authored request is
published beside the account, so the mapping is recoverable. A position-preserving
alternative would need a page-side "condition not applied" marker, which is the
same page + Core seam as above. Recording the assumption (`assumed`) has the same
shape: the reader returns it, `issues.ts` deliberately does not turn it into a
refusal (an assumption is not a fault), and no run-artifact channel carries it
today — Core's nearest precedent is
`flow-bootstrap/plan/name-correction-assumption.ts`, which is for a *parameter*
name on a node rather than a name inside a parameter value.

---

## 4. A further finding, outside my files, that I believe outweighs everything above

The single most likely cause of "matched the page perfectly, stored nothing" is a
**restrictive default that is not in my files**: `required` is `true` for every
field written in the string grammar.

`apps/extension/src/content/extraction/field-spec.ts::parseStringField` returns
`required: true` unconditionally ("always required as it always was"), and
`content/actions/extract-list.ts::validationFor` fails the whole verb when any
required field is missing from any record. So a model writing the ordinary thing —
`fields: { name: ".name", price: ".price", rating: ".rating", url: "a@href" }` —
on a page where three cards of forty-three lack a rating gets
`output_not_observed`, a failed node, and **zero stored records where forty good
rows existed**.

That is precisely "a parameter the model omits gets a restrictive default" and
"turning a wide answer into an empty one". The permissive shape is: an omitted
`required` means `false`, the row is kept with `null` for the field it lacked
(D16 already defines that), `missingFields` still names the incomplete columns, and
`required: true` stays available for a Flow that means it.

I could not do it here. The default is decided by the page's own string-grammar
parser and enforced by the page's post-condition; the domain cannot set it for
string-form fields without duplicating that parser, and applying it to spec-form
fields alone would make `{name: ".name"}` and
`{name: {kind: "text", selector: ".name"}}` mean different things. **It is two
small edits in `apps/extension/src/content/extraction/field-spec.ts` and
`apps/extension/src/content/actions/extract-list.ts`, and I recommend it be the
next task on this rung.** t143's per-run classification should be able to confirm
or refute it directly: the signature is a failed extract step whose validation
`actual` reads `N records from 1 page; missing from some records: …`.

---

## Commands run and observed results

All from `F:\!FluxIQWebExtension`. Nothing repository-wide was run.

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/domain test` (**baseline, before any edit**) | `# tests 814 / # pass 814 / # fail 0`, exit 0 |
| `pnpm --filter @fluxiq-web-extension/domain test` (final) | `# tests 822 / # pass 822 / # fail 0`, exit 0 |
| `pnpm --filter @fluxiq-web-extension/domain check` (final) | exit 0 (`tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`) |
| `node scripts/structure-audit.mjs` (final) | exit 1 — `4 violation(s) across 3 rule(s)`, **all four pre-existing and in files I did not touch** |
| `pnpm --filter @fluxiq-web-extension/extension build` | exit 0, all five bundles emitted |

### The structure-audit violations, and that they were already red

None is in my diff (`git status` confirms), and each traces to a commit before
mine:

1. `FAIL [file-lines] packages/test-runner/src/run-scenario.ts: 812 lines exceeds the 800-line limit` — last touched by `6992b45`.
2. `FAIL [imports] scripts/lab/domain-build-staleness.mjs: 1 import(s) reach into another directory's files` — `5671780`.
3. `FAIL [working-docs] docs/working/language-driven-flow-loop-plan.md: 872 lines exceeds the 800-line compaction threshold` — `4896d96`.
4. `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks` — `4896d96`.

The audit also reports `1 baseline entries can be lowered`. **I did not run
`pnpm structure:baseline`**, as instructed.

**One advisory warning I did introduce**, and it is a warning rather than a
failure: `warn [file-lines] domain/src/actions/extraction/read-request.ts: 427
lines is past the 400-line advisory threshold` (330 at `HEAD`, hard limit 800). I
already split the column matcher out into `field-match.ts` — a distinct
responsibility mirroring `plan-resolution/extraction/columns.ts` on the resolver
side — which took it from 503 to 427. I did not chase it below 400 with a second
split, because the remainder is one coherent subject and four other domain files
already carry the same advisory. The `warn [exported-values]
domain/src/actions/extraction/request.ts: 9` is pre-existing (19 `export`
statements before and after my change).

A third `condition-*.ts` in that directory would have tripped the
`prefixGroup: 3` rule, which is why the new module is named `field-match.ts`
(joining `field-key.ts` at a group of two).

### Extension build, and why I ran it

`field-match.ts` value-imports `fluxiq/automation-studio/nodes`, which reaches
the content-script bundle through `@fluxiq-web-extension/domain/client`. The
extension build has an explicit guard against value-importing the wide
`fluxiq/automation-studio` barrel, so I ran the build once to prove the crossing
is allowed. It is — the same narrow entry point that
`output-nodes/extract-list/dispatch.ts` already value-imports for Core's
record-output parser. Content bundle: `489.5kb`.

---

## Files changed

Owned by the brief:

- `domain/src/actions/extraction/read-request.ts` — tolerant reader, `…Read` and
  `…Whole` entry points, dropped-part and assumption vocabulary.
- `domain/src/actions/extraction/field-match.ts` — **new**; nearest-column
  resolution over a request's own keys, using Core's matcher.
- `domain/src/actions/extraction/index.ts` — barrel.
- `domain/src/actions/extraction/request.ts` — the order and once-per-row
  guarantees, the resolution rule, the empty-condition no-op, and gap A.
- `domain/src/actions/extraction/summary.ts` — `itemsSeen`, `emptyRecords`.
- `domain/src/actions/extraction/recorded-definition.ts` — reads the request whole.
- `domain/src/output-nodes/extract-list/issues.ts` — judges the tolerated parts
  by asking for the request whole; documents where the strictness went.

Tests:

- `domain/src/actions/extraction/tests/read-request.test.ts` — **new**; the
  droppable parts, the parts that still refuse, and the whole-instruction request.
- `domain/src/actions/extraction/tests/item-conditions.test.ts` — the refusal rows
  become drop rows; new nearest-match and shape-tie-break tests.
- `domain/src/actions/extraction/tests/summary.test.ts` — the two new counts.
- `domain/src/client/tests/gateway-command-parameters.test.ts` — malformed
  `paginate`, `minItems` and `itemElement` now lift with the part dropped.
- `domain/src/runtime/llm-evidence/plan-resolution/extraction/tests/slot.test.ts`
  and `…/plan-resolution/tests/resolve-plan-node.test.ts` — the resolver still
  refuses a bad `minItems`, now at the **more precise** position
  `extractList.minItems` rather than `extractList`. Two expectation lines each.

Outside the brief's file list, declared above:

- `domain/src/extraction/structure-detection.ts` — one line, so the detector's
  wire copy keeps the all-or-nothing guarantee its own test asserts.

I touched nothing under `packages/test-runner`, `apps/scenario-lab`,
`packages/test-contracts`, `apps/extension`, the scenario fixtures, the expected
datasets or `F:\!FluxIQ`.

---

## Not verified

- **No live run.** Nothing here is proven against a real page or a real provider.
  Everything below the domain boundary — that a dropped `paginate` really does
  read the page shown, that a resolved column really does filter the rows a
  person meant — is argued from the page's source, not observed.
- **`itemsSeen` and `emptyRecords` carry no data yet.** They are declared and
  validated; no producer sends them and no run artifact shows them until the
  extension and Core halves in section 3 land. I tested the contract, not the
  count.
- **I did not measure the content bundle delta.** The build passes and the
  bundle is 489.5kb; I have no before figure to compare, since build output is
  not tracked.
- **The nearest-match floor is Core's, measured on node ids rather than on column
  names.** `title` → `name` does *not* resolve (no shared token, edit distance
  the length of the word), which is a common model slip and stays a dropped
  clause. Whether the floor should move for column names is a measurement nobody
  has taken; a synonym table would be a different mechanism and I did not add one.
- **`pnpm check` and `pnpm build` were not run whole**, as instructed.
- **The "required-by-default" diagnosis in section 4 is read off source, not off a
  run's artifacts.** It predicts a specific validation string; t143 can confirm or
  refute it.

## Open questions or contradictions found

1. **The brief asked me to make the read able to say "which conditions it could
   not apply". The domain is the only place that knows, and the summary comes
   *from* the page — so those two facts cannot meet in the current channels.** I
   resolved it as described (authoring refusal plus the authored-vs-dispatched
   diff) and I think that is right, but if the intent was for the *run artifact*
   to state it in one field, that needs a Core-side channel for a value-internal
   assumption, and it should be a Core task.
2. **The tolerance and the "named refusal is cheaper" rule pull in opposite
   directions, and which wins depends on a Core defect.** While the repair cannot
   amend node parameters (the 2026-09-25 debug's cause 8), an authoring-time
   refusal is *more* useful than a tolerated narrow read, because the model gets
   another authoring pass while the repair gets nothing. I have kept both — strict
   at authoring, tolerant at dispatch — which is correct either way. But if cause 8
   is fixed and the repair can amend parameters, it may then be right to *drop*
   some of the authoring refusals too, and let the loop converge instead of
   spending a call on a refusal. That is a decision for after cause 8.
3. **`minItems: -1` now applies the default of 1 rather than refusing.** A Flow
   that wrote `-1` may have meant `0` ("empty is a valid answer") and will now
   fail an empty page instead of not running at all. Failing is strictly better
   than not running, and D4 says the default exists so that "a list that matched
   nothing is never a success" — but it is a judgement I made rather than found
   written down, and it is the one drop whose effect is not purely widening.
4. **The nearest-match rule is applied to literal requests only.** The path the
   authoring text steers a model towards is a *detected* list, where a condition's
   column is resolved by
   `domain/src/runtime/llm-evidence/plan-resolution/extraction/columns.ts::detectedKey`
   — which still does exact, case-folded and table-header matching and then
   refuses `web.handle.unknown_field`. **That is where this rule will pay most,
   and it is one function.** It is outside my file list, so I did not touch it; it
   should be its own small task, using the same `automationStudioMatchName`, and
   it has a real extra signal the literal path lacks (the detection knows each
   column's sample values, so `accepts: "number"` is honestly derivable there).
