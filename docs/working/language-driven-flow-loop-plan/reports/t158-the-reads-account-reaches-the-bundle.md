# t158 — The read's account reaches the bundle

## Outcome

**Done.** All three members now travel the whole way: extension →
domain wire copy → Core's projection onto `metadata.extraction` → the
test-runner's rebuild → the published contract → `snapshots/flow-lane.json`.
A run's bundle now states, per extract attempt and per judged extract step,
what each read waited for, why the wait stopped, how many items its selector
matched, and how many matched items yielded nothing.

**This change spans both repositories and neither side works without the
other, so they must land together.** `F:\!FluxIQ` carries the members onto
`metadata.extraction`; `F:\!FluxIQWebExtension` carries them off it into the
bundle. Core alone projects three members nothing reads. This repository alone
reads three members Core never projects. Either half shipped by itself leaves
the next live run exactly as undiagnosable as t143's six were.

Nothing in the extension or the domain was touched. `stoppedOn`'s four words,
`itemsSeen` and `emptyRecords` are produced exactly as t148 and t153 left them.

---

## 1. The three hops, and what each now carries

### Hop 1 — Core's projection

`F:\!FluxIQ\...\runtime\service\summaries\extraction-summary.ts`

`extractionSummaryFromOutputs` rebuilt a fixed seven members and silently
dropped the rest. It now also rebuilds `itemsSeen`, `emptyRecords` and
`listWait` (a new `waitReport` helper, beside the existing `conditionReport`),
and publishes them onto `metadata.extraction`.

### Hop 2 — the bundle reader

`packages/test-runner/src/flow-lane/extraction-read.ts`

`extractionReadOf` destructured the same seven. It now destructures ten, and a
new `listWaitOf` / `waitStopOf` pair rebuilds the account. Nothing downstream
of this point needed a change: `run-flow-lane.ts` already passes a read whole,
both on the attempt (`...(action.extraction ? { extraction: action.extraction }
: {})`) and on the judged step (`reads: [...step.reads]`).

### Hop 3 — the published contract

`packages/test-contracts/src/extraction-read/read.ts` and `validation.ts`

`RunExtractionRead` gains `itemsSeen?`, `emptyRecords?` and `listWait?`, with a
new `RunExtractionListWait` type and a `RUN_EXTRACTION_WAIT_STOP` word list.
`readKeys` gains the three, and a new `checkListWait` holds the account to two
counts and one word from the set.

I did not need `packages/test-contracts/src/extraction-read/read.ts`'s
declaration to move anywhere; the brief's contingency ("if the declaration lives
there") applies — it does, and that is where it stayed.

---

## 2. What each of the three boundaries does with a word it does not know

The brief asked for this explicitly, including why they differ.

| Boundary | An unrecognised `stoppedOn` | Cost of the alternative |
| --- | --- | --- |
| Core's projection (ingest) | Published as `"unknown"`; the two durations and the whole summary travel | Every read in every run loses its account |
| The bundle reader (ingest) | Rebuilt as `"unknown"`; the read travels | Every attempt in the bundle loses its read |
| The contract's validator (authoring) | **An issue**: `$.listWait.stoppedOn must be one of …` | Nothing — the word should already be resolved |

**The two ingest boundaries are tolerant.** `stoppedOn` enumerates the
*mechanisms* that can end a wait, and mechanisms get added. The producing domain
in a browser, the Core build that reads it, and the test facility that reads
Core all ship separately, and nothing sequences them — which is precisely the
cost t153 flagged in its open question 2 and could not close from inside the
domain. Under a whole-or-nothing rule a fifth word does not degrade the report,
it deletes it: a newer extension would publish no read account at all, and the
next zero read would be diagnosable only by duration arithmetic again.

**The authoring boundary is strict**, because by the time a `RunExtractionRead`
exists, the ingest boundary was supposed to have resolved the word. Accepting a
foreign word there would make the tolerance unobservable and let an unresolved
word into a bundle by a path nobody checks. This is the shape the repository
already takes — strict where a record is authored, tolerant where one is
ingested — and it matches the precedent for an unrecognised failure category in
`packages/test-runner/src/bench/evaluate-run.ts:236`, where a foreign category
becomes `"unknown"` rather than failing the run's evaluation.

**`"unknown"` is a published member of the word set, not a validator leniency.**
It is listed in `RUN_EXTRACTION_WAIT_STOP` and documented as a word about the
boundary rather than about the page.

### The producer's word is named as unknown, not carried verbatim

"Named and carried through as unknown" is implemented as: the account survives
and says `stoppedOn: "unknown"`; the string the producer actually sent is
**discarded**. Republishing it would put an unredacted free string into a run
record and a bundle, and every one of these three modules exists on the premise
that a read is only counts, booleans, closed words and field keys — with
`stoppedOn` named in the domain's own source as "the one member a free string
could arrive on". Tolerance that weakened redaction would be a worse trade than
the strictness it replaced. Both repositories have a test that plants page text
in `stoppedOn` and asserts it is absent from the output.

### Where tolerance stops, and why absence still means one thing

A malformed account — a duration that is not a count, or a `stoppedOn` that is
not even a string — still gets each boundary's existing refusal: Core drops the
summary, the reader drops the read, the validator records an issue. Version skew
adds words and members; it does not turn a count into a string, so a malformed
member is a producer defect rather than a newer producer.

That line also preserves t153's invariant. **Absence of `listWait` means exactly
one thing** — this read waited for no list of its own, i.e. a continued read
resuming where its predecessor's control left it. If a malformed account quietly
became absence, a scan counting `stoppedOn` would tally a continued read and a
broken one as the same thing, which is the specific mistake t153 refused to make.

### `listPresence` stays strict, and that is not an inconsistency

Its two words answer a yes/no question — did the `item` selector ever name an
element — so the set is closed by what it means and has nowhere to grow. There
is no version-skew scenario for it, so there is nothing for tolerance to buy.

### No relation is checked among the three counts

`recordCount`, `itemsSeen` and `emptyRecords` are not cross-checked against each
other at any boundary, deliberately, and this is stated in all three files.
Every pairing that looks impossible is a real read a diagnosis needs to see:
`itemsSeen: 0` beside records is a continued read whose predecessor did the
matching, `itemsSeen` far above `recordCount` is duplicates or the item bound,
and `emptyRecords` equal to `recordCount` is the signature of fields read off
the wrong element — the exact shape `emptyRecords` was added to publish. A rule
refusing any of them would discard the report it exists to carry, and the
penalty would fall on a zero read, which is the one read that cannot afford to
lose its account.

---

## 3. Files changed

**`F:\!FluxIQ`** (2 files, +145 / −1):

- `packages/fluxiq/src/programs/automation-studio/runtime/service/summaries/extraction-summary.ts`
  — `WAIT_STOPS`, `WAIT_STOP_UNKNOWN`, the three members on the projection, the
  `waitReport` helper, and two header paragraphs stating the exception and the
  rule behind it.
- `.../summaries/tests/extraction-summary.test.ts` — a `WAIT` fixture and five
  tests.

**`F:\!FluxIQWebExtension`** (5 files, +324 / −13):

- `packages/test-contracts/src/extraction-read/read.ts` — `itemsSeen`,
  `emptyRecords`, `listWait` on `RunExtractionRead`; `RunExtractionListWait`;
  `RUN_EXTRACTION_WAIT_STOP` / `RunExtractionWaitStop`; two more bullets in the
  module header's list of the reasons a read comes back empty.
- `packages/test-contracts/src/extraction-read/validation.ts` — three entries in
  `readKeys`, a `waitKeys` list, `checkListWait`, the two optional counts, and
  the doc comment explaining the strict side and the absent cross-checks.
- `packages/test-contracts/tests/extraction-read.test.mjs` — two tests
  (6 → 8 in the file).
- `packages/test-runner/src/flow-lane/extraction-read.ts` — `KNOWN_WAIT_STOPS`,
  the three members through `extractionReadOf`, `listWaitOf`, `waitStopOf`, and
  a header section on the one tolerance.
- `packages/test-runner/src/flow-lane/tests/extraction-read.test.ts` — a
  `GAVE_UP_WAITING` fixture, three tests (10 → 13 in the file), five more
  refusal cases, and the end-to-end run-detail test extended to carry all three
  members and an unfamiliar stop word.

I touched nothing else in either repository: not `domain/src/actions/extraction/`,
not `domain/src/runtime/llm-evidence/`, not the extension, not Core's
`runtime/llm/harness/`, `runtime/recovery/context.ts`, `runtime/flow-draft/` or
the automation-studio node matcher, not `packages/test-runner/src/run-scenario/`,
and no working document.

---

## 4. The tests the brief asked for

**A read's `stoppedOn`, `itemsSeen` and `emptyRecords` survive to the shape a
bundle reader sees** — one at each boundary:

- Core, `"carries what the read waited for, why the wait stopped, how many items
  it saw and how many came back empty"`: a real dispatched attempt through
  `runAutomationStudioGraph` and `runtimeSessionToFlowRunDetail`, with
  `metadata.extraction` asserted whole, `listWait` included.
- Core, `"keeps all four stop words, and the two counts a zero read is diagnosed
  by"`: each of the four words projected as itself, plus `itemsSeen: 0` beside
  eight empty records.
- test-contracts, `"the wait's account, the items the selector matched and the
  records that came back empty are all publishable"`: every word in
  `RUN_EXTRACTION_WAIT_STOP`, and the four count pairings a cross-check would
  have refused.
- test-runner, `"the wait's account, the items seen and the empty records survive
  the rebuild and the contract"`: `extractionReadOf` round-trips
  `GAVE_UP_WAITING` and the published validator accepts it.
- test-runner, `"a judged step's read states what its wait was for, why it
  stopped, and what the selector matched"`: through `flowExtractionSnapshot`,
  which is `snapshots/flow-lane.json`'s `extraction.steps[].reads[]`.
- test-runner, `"every read reaches the bundle on its own attempt…"` (existing,
  extended): both attempts now carry the three members through a faked Core run
  detail into `flowLaneSnapshot`, and the written JSON is asserted to contain
  `"stoppedOn":"page_settled"`, `"waitedMs":2089` and `"itemsSeen":0`.

**An unrecognised stop word does not cost the rest of the read:**

- Core, `"renames a stop word it does not know rather than dropping the read that
  reported it"`: `items_stopped_growing` → `{ stoppedOn: "unknown", waitedMs:
  2089, waitedFor: 1 }`, the rest of the summary intact.
- Core, `"publishes the unknown word rather than the one the producer sent…"`:
  a `stoppedOn` of `"#private-selector had 0 items"` is absent from the output.
- test-runner, `"a stop word this reader does not know costs the word its name
  and nothing else of the read"`: the fifth word resolved, page text planted in
  `stoppedOn` asserted absent from the serialized read, and `waitedMs`,
  `recordCount` and `itemsSeen` asserted still present — the durations being
  exactly what t143's diagnosis was reconstructed from.
- test-contracts, `"a stop word outside the set is an issue here, because the
  reader was meant to have resolved it"`: the strict half, with the issue path
  and message asserted.
- test-runner's end-to-end test carries an unfamiliar word on the *first*
  attempt, so the tolerance is proven on the real path and not only on the unit.

**And that tolerance stops where it should:** five cases added to Core's
`"refuses an account whose durations are not counts, or whose stop is not even a
word"` and five to the runner's `"a summary this reader cannot rebuild whole is
dropped whole"` table (a non-count `itemsSeen`, a negative `emptyRecords`, a
string duration, a numeric `stoppedOn`, the account as prose). The runner's
`"a member the producer added beside the ones this reader knows stays behind"`
test gained a case proving an extra member *inside* `listWait` is stripped
rather than published.

---

## 5. Commands run and observed results

Every figure, with what it was before the change.

| Where | Command | Observed | Before |
| --- | --- | --- | --- |
| `F:\!FluxIQ\packages\fluxiq` | `npx tsc --noEmit` | **exit 0**, no output | exit 0 |
| `F:\!FluxIQ\packages\fluxiq` | `npx vitest run src/programs/automation-studio/runtime/service` | **26 files passed, 226 passed, 1 skipped (227)**, 21.27 s | 221 passed, 1 skipped — derived: I added 5 `it(` to one file (11 → 16), nothing else in that scope changed |
| `F:\!FluxIQWebExtension` | `pnpm --filter @fluxiq-web-extension/test-contracts build` | **exit 0**, `tsc -p tsconfig.json`, no diagnostics | exit 0 |
| `F:\!FluxIQWebExtension` | `pnpm --filter "@fluxiq-web-extension/test-runner..." build` | **exit 0**, 4 of 11 projects: `domain`, `test-contracts`, `test-evidence`, `test-runner` all `Done` | exit 0 |
| `F:\!FluxIQWebExtension` | `pnpm --filter @fluxiq-web-extension/test-contracts test` | **# tests 145 / # pass 145 / # fail 0**, 497 ms | 143 — derived: +2 top-level tests in `tests/extraction-read.test.mjs` (6 → 8), no subtests |
| `F:\!FluxIQWebExtension` | `pnpm --filter @fluxiq-web-extension/test-runner test` | **# tests 1462 / # pass 1462 / # fail 0** (1426 top-level), 33.7 s | 1459 (1423 top-level) on this same working tree — derived: +3 top-level tests in `flow-lane/tests/extraction-read.test.ts` (10 → 13); the five added refusal cases are `t.assert.equal` calls inside one existing test and do not change the count |
| `F:\!FluxIQWebExtension` | `node scripts/structure-audit.mjs` | **exit 1** — `2 violation(s) across 1 rule(s)` | — |
| `F:\!FluxIQ` | `node scripts/structure-audit.mjs` | **exit 0** — no violations; `2 baseline entries can be lowered` | — |

**On the "before" figures.** The two package totals are derived from the test
counts I added rather than measured on a clean tree, and I say so rather than
implying I ran them first: other agents have uncommitted edits in
`packages/test-runner/src/run-scenario.ts`, a new
`packages/test-runner/src/run-scenario/` directory and
`packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`, plus
several Core areas, so a `git stash` to measure a baseline would have disturbed
work I do not own. The deltas are exact and verified against `git show HEAD:`
for each test file. Core's `tsc --noEmit` passing at exit 0 over the *whole*
package is a stronger statement than my own files compiling, since it compiled
those concurrent edits too.

I did **not** run `pnpm check`, `pnpm test` or `pnpm build` whole in either
repository, did **not** build Core, did **not** run `pnpm structure:baseline` in
either repository, and committed nothing in either.

### Every structure-audit finding, and which were already red

**`F:\!FluxIQWebExtension`** — exit 1, both failures in `docs/working/`, which I
never opened:

1. `FAIL [working-docs] docs/working/language-driven-flow-loop-plan.md:
   "## Current State" is 173 lines, over the 150-line budget.`
2. `FAIL [working-docs] docs/working/README.md is out of date with the
   documents' header blocks.`

Both are the supervisor's, and finding 1 moved while this task ran — the same
audit reported `173 lines` before I wrote this report and `187 lines` after,
because the supervisor is editing that document concurrently. Adding my report
file introduced no finding of its own.

**Neither failure is mine, and neither is new from my change:**
no file I touched appears anywhere in the audit's output — not as a failure and
not as an advisory warning. (t153 recorded finding 2 as already red and recorded
a different failure on the same plan document, which has since changed shape;
`packages/test-runner/src/run-scenario.ts`, red at 812 lines during t153, is now
688 and clears, from another agent's split.) Advisory warnings exist across the
repository — 40-odd `file-lines` warnings, including four in `packages/test-runner`
and two in `packages/test-contracts` — and none of them names a file I edited.
My five files are 116–312 lines, all well under the 400-line advisory threshold.

**`F:\!FluxIQ`** — exit 0, no violations. The only advisories naming the
directory I edited are for `summaries/store.ts` (29 methods, 660 lines), which I
did not touch. `2 baseline entries can be lowered` is reported and I left it, as
instructed.

---

## 6. Not verified

- **No live run, no browser, no provider call.** Everything here is measured in
  Node and vitest. That the members reach a *real* bundle rests on the faked
  Core run detail in the runner's end-to-end test plus Core's own test driving a
  real `runAutomationStudioGraph` dispatch — the two halves are verified
  separately and not against each other in one process, because they are in two
  repositories and Core was not to be built.
- **Core was not built.** `npx tsc --noEmit` type-checks it; `pnpm build` in
  Core was outside the brief. So the next live run needs Core rebuilt before it
  will show any of this, and the extension bundles rebuilt if they are stale
  from t153.
- **The `test-runner` absolute test total includes other agents' uncommitted
  edits.** My delta is exact; the totals are of the tree as it stood.
- **`apps/scenario-lab` and the Playwright e2e specs were not run.** I checked by
  reading that nothing there compares an extraction read's members exactly; that
  is a reading, not a run.
- **Nothing proves the three members are *produced* on a real page.** That was
  t148's and t153's measurement and I deliberately did not re-litigate it. I did
  confirm by reading that `summaryOf`
  (`apps/extension/src/content/actions/extract-list.ts:97`) emits all three and
  that `webAutomationActionResultPayload`
  (`domain/src/client/gateway-mapping.ts:308`) puts them on the wire through
  `webAutomationExtractionSummaryValue`, so there is no fourth hop between the
  page and Core that drops them.
- **No scan or bench report reads the new members yet.** The bundle now states
  them; nothing tallies them. Counting `stoppedOn` across a campaign is a
  separate change in `packages/test-runner/src/bench/`.

---

## 7. Open questions or contradictions found

1. **The strict half of t153's open question 2 is still live in the domain, by
   design, and is now the only place a fifth word is fatal.** Both ingest
   boundaries downstream of it now absorb an unfamiliar word, but
   `webAutomationExtractionSummaryValue`
   (`domain/src/actions/extraction/summary.ts`) still drops the **whole summary**
   for a `stoppedOn` outside its four. That is the boundary the brief told me not
   to touch, and t153's reasoning for it is sound on its own terms. The practical
   effect is that the sequencing constraint has moved rather than gone: a fifth
   word must be added to the domain before any producer emits it, and if it ever
   is emitted first, the summary dies at the domain and the tolerance I added
   never gets a chance to help. Worth a one-line note wherever the stop set is
   next extended.
2. **`RUN_EXTRACTION_WAIT_STOP` has five words and the domain's
   `WebAutomationExtractionWaitStop` has four, and nothing mechanically ties
   them.** `unknown` is deliberately only on the bundle side — it is a statement
   about a boundary, not something a page can produce — but the four shared words
   are now written out in four places (the domain type, Core's `WAIT_STOPS`, the
   runner's `KNOWN_WAIT_STOPS`, and the contract's list) and a fifth added to
   one of them will not fail a build anywhere. The repository's own standard is
   to enforce this kind of thing mechanically rather than by comment. There is no
   shared module the domain and `packages/test-contracts` can both import
   (`test-contracts` is repository-local and not Core public API), so the honest
   options are a check in `scripts/structure-audit/config.mjs` that the word
   lists agree, or a test in one package that asserts the other's list. I did
   neither: it is a fourth file and outside the brief's ownership.
3. **`itemsSeen` is cumulative and `conditions.{applied,kept,rejected}` are
   per-document, and the bundle now publishes both side by side with nothing
   naming the difference.** This is t153's open question 4, and carrying both
   into the bundle makes it visible to a reader who has no access to either
   file's doc comments. `RunExtractionRead`'s member docs state each member's
   scope individually, which is the most I could do inside my own files, but a
   reader comparing `itemsSeen: 12` with `conditions.applied: 4` on one read will
   draw the wrong conclusion. Either the condition report becomes per-read or its
   members are renamed for what they describe — both in the domain, which I do
   not own.
4. **Nothing cross-checks `emptyRecords` against `recordCount` anywhere, and
   that is intentional at every boundary — but it means a producer that reported
   `emptyRecords: 400` against `recordCount: 8` would be believed.** I judged the
   diagnostic value of the impossible-looking pairings to be worth more than the
   refusal (§2), and the numbers are the producer's own counters rather than page
   data, so nothing unsafe rides on them. Stating it because it is a real
   asymmetry with `kept > applied`, which *is* refused.
