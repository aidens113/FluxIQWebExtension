# t153 — The read's account of its wait is a field, and its item count survives a document

## Outcome

**Done**, with one honest qualification about how far the countability actually
reaches (see §4 — it needs two more hops that are outside this repository's
extraction files, and both are named precisely).

All three of t148's follow-ups are built:

1. **The wait is a declared field.** `WebAutomationExtractionSummary` now carries
   `listWait: { stoppedOn, waitedMs, waitedFor }`, produced by `summaryOf`, so
   `stoppedOn` is something a scan can group by rather than a clause in a
   sentence.
2. **`itemsSeen` crosses a document boundary.** `ExtractionCheckpoint` carries it,
   and a continued read adds its own document's items to the count it was handed.
   The count is **cumulative** — the whole read's, matching `recordCount` and
   `pagesRead` beside it — and is **absent, never restarted**, when the
   checkpoint it resumed from did not carry one.
3. **The stale doc line** at `domain/src/actions/extraction/request.ts` now states
   the default t148 inverted.

Validation: domain `test` **832/832**, extension `test` **791/791**, extension
`check` exit 0, domain `check` exit 0, extension `build` exit 0 with all five
bundles emitted. `structure-audit` exit 1 on two failures, neither of them mine
and one of them new since this task began in a file another agent is editing.

I did not change what the wait *does*. `page-render.ts`'s only edit is one
paragraph of its header comment, which had said the wire could not carry the
account.

---

## 1. The wait becomes a declared field

### What was added

`domain/src/actions/extraction/summary.ts`:

```ts
export type WebAutomationExtractionListWait = {
  stoppedOn: WebAutomationExtractionWaitStop;
  waitedMs: number;
  waitedFor: number;
};
export type WebAutomationExtractionWaitStop = "list_present" | "page_settled" | "window_elapsed" | "deadline_passed";
```

and `listWait?: WebAutomationExtractionListWait | undefined` on the summary,
copied by `webAutomationExtractionSummaryValue` through a new `listWaitValue`.
t142's constraint is respected: the declaration came first, so the copy has a
member to copy and nothing is silently dropped.

`apps/extension/src/content/actions/extract-list.ts::summaryOf` fills it from the
`ListWait` t148 already returns. The extension side was indeed already shaped for
it — one line.

### Four decisions worth stating, because each could reasonably have gone the other way

**The presence is not repeated inside `listWait`.** The extension's `ListWait`
carries `presence`, and the wire object deliberately does not: `listPresence` is
already that fact, and two copies of one fact can disagree — `list-reader.ts`
keeps them in step through a post-wait fix-up, and a wire contract that carried
both would either have to cross-check them (dropping the whole summary over a
disagreement) or publish a contradiction. One fact, one field.

**No pairing of `listWait` with `listPresence` is refused.** This is the point of
the field. `stoppedOn: "page_settled"` beside `never_appeared` is the 2026-09-25
regression's exact signature; refusing it would throw away the one report worth
having. `list_present` beside `never_appeared` is producible too — a page that
drew its list, ended the wait on it, and replaced it during the growth settle
that follows — so that is kept as well, and the reasoning is in the doc comment
rather than left for the next reader to rediscover.

**An unreadable or unknown `listWait` drops the whole summary**, as an unknown
`listPresence` already does. I considered the permissive alternative — keep the
summary, drop just the account — and rejected it on the brief's own standard: a
field must not silently mean two things. Absence of `listWait` already means
"this read never waited for a list of its own", so an account that quietly went
missing would make a reader counting `stoppedOn` treat a continued read and a
half-understood one as the same thing. Dropping the summary is conspicuous; an
account that vanished is what cost t143 a day. The residual risk is stated
plainly in **Open questions** 2.

**Neither number is bounded.** `waitedFor: 0` is not a shape the page writes (it
holds the wait to at least one item) and a `waitedMs` past any constant this side
knows is a fact about a page. Refusing either would cost the whole account for a
number that is merely surprising rather than unsafe. Only `stoppedOn` is checked
against a set, because it is the one member a free string could arrive on — which
is the redaction rule the module header states.

### The prose is kept, and is no longer described as a workaround

`readSummary`'s `waitAccount` phrase stays. The field and the phrase are not
redundant and the comment now says why: the field is what a scan over a run's
bundles groups by, the phrase is what a model reading one failure's evidence
actually reads, since `client/gateway-mapping.ts` carries the comparison text as
"the only place the evidence for a failure lives". Both are built from the same
`ListWait`, so they cannot disagree. Three stale claims were corrected in the
same pass: the doc comment saying the wire "cannot carry it", `extract-list.ts`'s
file header listing what the summary reports, and `page-render.ts`'s header
paragraph saying the domain puts only the presence on the wire.

---

## 2. `itemsSeen` across a document boundary

### Cumulative, and why that is the only honest choice

`ExtractionCheckpoint` (`apps/extension/src/shared/extraction-continuation.ts`)
gains `itemsSeen?: number | undefined`, refused when sent malformed and absent
from a checkpoint a page build wrote without counting — the rule `filtered`
already follows.

`list-reader.ts` carries it:

```ts
const itemsSeenBefore = resume === undefined ? 0 : resume.itemsSeen;
const itemsSeen = (): number | undefined => (itemsSeenBefore === undefined ? undefined : itemsSeenBefore + namedItems.size);
```

and both the outcome and every checkpoint the read hands on use it.

**Cumulative, not per-document.** `recordCount`, `pagesRead` and `filtered`
beside it are all the whole read's, so a per-document `itemsSeen` would put one
number in a summary whose neighbours mean something else — and specifically it
would land on the one shape that already means something different:
`itemsSeen` below `recordCount` is the signature of "rows matched and every field
was read off the wrong element" (t148's own table). A paginated read reporting its
last document's four items beside twelve records would read as exactly that
failure.

**The sum is exact, not approximate.** The page counts elements in a `Set` because
a `loadMore` or `scroll` read re-queries one document; across documents no element
can recur, because the predecessor's document was destroyed. So adding the
predecessor's total to this document's set size double-counts nothing.

**Absent, never restarted, where the beginning is unknown.** A checkpoint from a
build that did not count items gives nothing to add to, so the read reports no
count at all — and that absence propagates into the next checkpoint rather than
becoming a zero, or the understatement simply moves one document along. This keeps
absence meaning one thing: not counted. `itemsSeen: 0` remains a real count (a
document whose selector named nothing) and is kept as one.

t148's stated reason for omitting the count is therefore gone, and the field's doc
comment on `ListExtractionOutcome` was rewritten to say what it now means.

### The worker half needed no change

t148's open question 2 said "adding one field to both" —
`shared/extraction-continuation.ts` and `runtime/extract-list-continuation.ts`.
Only the first needed it. The worker holds the checkpoint as whatever
`readExtractionCheckpoint` returned and sends it straight back as `resume`, so the
new member travels once the reader keeps it. `runtime/extract-list-continuation.ts`
is unchanged.

**A path correction for the ledger:** both the brief and t148 name
`apps/extension/src/content/shared/extraction-continuation.ts`. No such file
exists; the checkpoint lives at `apps/extension/src/shared/extraction-continuation.ts`
and that is what I edited.

---

## 3. The stale doc line

`domain/src/actions/extraction/request.ts` said "`false` marks the field
optional", which states the pre-t148 default. It now says `true` marks the field
required, that absent and `false` both mean optional, that the string grammar
means the same because it cannot say otherwise, and what asserting the opposite
cost — with a pointer to `field-spec.ts`, where the behaviour is actually decided.

One more line of the same defect, in a file I own, was fixed with it: the
summary's own `missingFields` doc said "Fields at least one record did not yield",
which is now a superset claim. It says "required fields" and names what a
non-required gap does instead.

---

## 4. What this does **not** yet achieve, stated plainly

The brief's goal is that "a future scan can count `page_settled` reads". The field
now exists on the wire and is produced by the page. **It does not yet reach a run
bundle**, and neither do t148's `itemsSeen` and `emptyRecords`. I traced the chain
read-only and it needs two more hops, both outside my bounds:

1. **Core's projection drops it.**
   `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\service\summaries\extraction-summary.ts`
   copies a fixed set — `recordCount`, `pagesRead`, `truncated`, `fieldNames`,
   `missingFields`, `listPresence`, `conditions` — onto `metadata.extraction`. No
   `itemsSeen`, no `emptyRecords`, no `listWait`.
2. **The bundle reader drops it too.**
   `packages/test-runner/src/flow-lane/extraction-read.ts:49` destructures the same
   fixed set and then validates against `packages/test-contracts`, whose
   `extraction-read/validation.ts:5` pins `readKeys` to it.

So the honest position is: this repository's half is done and countable at the
gateway boundary, and a bundle scan still cannot tally `stoppedOn` until Core and
`packages/test-contracts` + `packages/test-runner` carry the three members. That is
one Core change and one test-facility change, and it closes `itemsSeen` and
`emptyRecords` at the same time as `listWait` — they are the same three lines in
each file. I did not make either: the brief forbids `F:\!FluxIQ`,
`packages/test-runner` and `packages/test-contracts`.

Nothing existing breaks from the new member: both readers copy by name and ignore
unknown keys, which is why `itemsSeen` and `emptyRecords` have been inert rather
than fatal since t142.

---

## Files changed

Under the brief's ownership:

- `domain/src/actions/extraction/summary.ts` — `WebAutomationExtractionListWait`,
  `WebAutomationExtractionWaitStop`, the `listWait` member, `listWaitValue`,
  `waitStopValue`, and the `missingFields` doc line.
- `domain/src/actions/extraction/request.ts` — the `required` doc line only.
- `domain/src/actions/extraction/tests/summary.test.ts` — four rows.
- `apps/extension/src/content/actions/extract-list.ts` — `summaryOf` produces
  `listWait`; the file header and two doc comments corrected.
- `apps/extension/src/content/actions/tests/extract-list.test.ts` — two rows
  added, two existing assertions updated (they pinned a wire summary that now
  carries `listWait`).
- `apps/extension/src/content/extraction/list-reader.ts` — `itemsSeen` carried
  across the boundary, written into each checkpoint, and its doc comment
  rewritten; two header clauses corrected.
- `apps/extension/src/content/extraction/tests/list-reader.test.ts` — four rows
  and a fake page.
- `apps/extension/src/content/extraction/page-render.ts` — **one header paragraph
  only**, no behaviour.
- `apps/extension/src/shared/extraction-continuation.ts` — `itemsSeen` on the
  checkpoint and in its reader.
- `apps/extension/src/shared/tests/extraction-continuation.test.ts` — one row, and
  four refusal cases.

I touched nothing under `domain/src/runtime/llm-evidence/`,
`domain/src/plan-resolution/`, `packages/`, `apps/scenario-lab/` or `F:\!FluxIQ`.

## The tests the brief asked for

**A `page_settled` stop and a `list_present` stop are distinguishable as fields.**

- domain, `"a wait that gave up on a still page and one that found its list
  differ by a field, not by a duration"`: both summaries copied whole, their
  `stoppedOn` asserted unequal, and the contradictory pair asserted **kept**.
- domain, `"every one of the four stop words is known, and anything else drops the
  whole summary"`: all four accepted; eleven malformed shapes refused.
- domain, `"the wait's numbers are not second-guessed"`: `waitedMs: 0` /
  `waitedFor: 0` and a 600 s wait both kept.
- extension, `"the two ways a wait can end are told apart by a field, not by
  reading a duration against a constant"`: the verb's own output, through the
  domain's wire copy, for both stops, with `itemsSeen` beside them.
- extension, the existing `page_settled` row now also asserts
  `wire.listWait.stoppedOn === "page_settled"` beside `recordCount: 0` — the live
  signature, as fields.

**A continued read's item count is not understated.**

- `"a continued read adds its own document's items to the count it was handed"`:
  four handed over, three in this document → `itemsSeen: 7` beside seven records
  and three pages, and asserted **not** 3.
- `"a checkpoint that counted no items leaves the count absent rather than
  reporting one document's as the read's"`: `itemsSeen` absent, records still 7.
- `"a read that began here counts its own items, and the checkpoint it hands on
  carries the whole read's count"`: a `loadMore` read whose checkpoint carries
  `itemsSeen: 6` (four handed over plus two named here) and whose answer carries
  8. A count that restarted per document would read 2 and 4.
- `"a read that counted items and then handed the count on leaves it absent when
  it never had one"`: the absence propagates into the checkpoint rather than
  becoming a zero.
- the checkpoint reader's own row: kept when sent, absent when not, `0` kept as a
  real count, and four malformed values refused.

The four list-reader rows needed a page, so one is stood up under `globalThis` as
the three things the reader asks of it — a `querySelectorAll` naming items, a
`querySelector` for a pagination control, and elements answering `getAttribute` —
plus `HTMLElement` and `HTMLInputElement`, which `pagination.ts` and the
sensitivity rule ask for by name. Fields are read as an `attribute` kind so no
text reader is involved.

---

## Commands run and observed results

All from `F:\!FluxIQWebExtension`. Nothing repository-wide was run, as instructed.
`DOMAIN_TEST_BUILD_LABEL=t153` and `EXTENSION_TEST_BUILD_LABEL=t153` throughout,
so no concurrent worker's test build was overwritten.

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/domain test` | `# tests 832 / # pass 832 / # fail 0`, `duration_ms 30753` |
| `pnpm --filter @fluxiq-web-extension/extension check` | exit 0, no output |
| `pnpm --filter @fluxiq-web-extension/domain check` | exit 0, no output |
| `pnpm --filter @fluxiq-web-extension/extension test` (first run) | `# tests 791 / # pass 790 / # fail 1` — one of my own new rows, `"a read that counted items and then handed the count on…"`, expected one checkpoint and saw none: `maxPages: 2` against a resume at `pagesRead: 1` makes `pressLoadMore` answer `truncated` before `beforeFollow`, so no checkpoint is written. Raised to 3. |
| `pnpm --filter @fluxiq-web-extension/extension test` (final) | `# tests 791 / # pass 791 / # fail 0`, `duration_ms 58686` |
| `pnpm --filter @fluxiq-web-extension/extension build` | exit 0 — `background 462.3kb`, `content 491.9kb`, `page-world 4.0kb`, `popup 204.6kb`, `sidepanel 204.6kb`. **All five bundles emitted**, so t148's wait fix stays built for the next live run. |
| `node scripts/structure-audit.mjs` (before any edit) | exit 1 — `2 violation(s) across 2 rule(s)` |
| `node scripts/structure-audit.mjs` (final) | exit 1 — `2 violation(s) across 1 rule(s)` |

Counts against the brief's floors: domain 832 ≥ 822, extension 791 ≥ 784. My own
additions are +4 domain and +7 extension, so the pre-task baselines were 828 and
784.

I did **not** run `pnpm structure:baseline`, `pnpm check`, `pnpm test`,
`pnpm build`, or `pnpm --filter … test:content`.

### Every structure-audit finding, and which were already red

Before my first edit:

1. `FAIL [file-lines] packages/test-runner/src/run-scenario.ts: 812 lines exceeds the 800-line limit`
2. `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks`

After:

1. `FAIL [working-docs] docs/working/language-driven-flow-loop-plan.md: 802 lines exceeds the 800-line compaction threshold` — **new since this task began, and not mine.** The document is the supervisor's; I did not open or edit it.
2. `FAIL [working-docs] docs/working/README.md is out of date …` — already red, and the brief says to expect it.

The `run-scenario.ts` failure the brief said to expect **cleared during this
task**, not by me: `git status` shows `M packages/test-runner/src/run-scenario.ts`
and a new untracked `packages/test-runner/src/run-scenario/` directory — another
agent split it while I worked. I touched neither.

`1 baseline entries can be lowered` is reported, as it was before; I left it.

Advisory warnings involving my files, all of which were already past the
threshold before I touched them:

- `apps/extension/src/content/actions/tests/extract-list.test.ts` 570 → 654 lines
  (hard limit 800). One subject — the verb's account of its own read — so
  splitting it by length alone would scatter that subject, which is the call t148
  made for the same file.
- `apps/extension/src/content/extraction/list-reader.ts` 498 → 524 (hard limit
  800), warned at 498 already.
- `apps/extension/src/content/extraction/` at 17 source files, and
  `domain/src/actions/extraction/request.ts` at 9 exported values: both unchanged
  by me.

No new warning was introduced. `domain/src/actions/extraction/summary.ts` is 300
lines with 6 exported values, under both thresholds.

---

## Not verified

- **No live run and no browser.** Everything here is argued from the source and
  measured in Node. That the field arrives in a live bundle is **not** a
  prediction I am making — see §4: it currently will not, because Core's
  projection drops it. What a live run *will* now show is the account in the
  result's `actual` text, exactly as t148 left it.
- **The Playwright content specs were not run** (`pnpm test:content` needs a
  browser and the brief did not list it). I edited none of them. I checked by hand
  that none would break: no e2e spec compares a read's summary exactly — the
  closest are `extraction-picker.spec.ts:115` (a picked *definition*, not a
  summary) and `inference.spec.ts:192` (`fieldNames` alone) — and
  `extract-list-continuation.spec.ts` asserts checkpoints only through a projection
  to `{token, records.length, pagesRead}` plus `checkpoint.records`, so a new
  checkpoint member does not disturb it. That is a reading, not a run.
- **The `resume` path has no live coverage.** My four new rows exercise it against
  a fake page. The real thing — a control that loads a new document, the worker
  re-sending the command — is `extract-list-continuation.spec.ts`, which I did not
  run.
- **Core and the test facility were read, not changed or built.** §4's two
  findings come from reading `extraction-summary.ts`, `extraction-read.ts` and
  `extraction-read/validation.ts`. I did not compile Core or the test packages,
  so "nothing existing breaks" rests on both readers copying by name, which I read
  in their source.
- **`packages/test-runner` and `packages/test-contracts` were not type-checked**
  after the domain type changed. The change is purely additive to an optional
  member, and neither package imports `WebAutomationExtractionSummary` (they use
  their own `RunExtractionRead`), so I expect no effect — but I did not run their
  checks, and another agent is editing `run-scenario.ts` concurrently.
- **`waitedFor` is not cross-checked against the request's `minItems`** anywhere.
  A page that sent a `waitedFor` unrelated to what it waited for would be believed.

---

## Open questions or contradictions found

1. **The countability this task exists for is two hops short, and both hops are
   one small change each.** §4 has the file and line for each. Whoever picks it up
   closes `itemsSeen` and `emptyRecords` in the same edit, because all three are
   members of the same fixed key list in three places: Core's
   `extraction-summary.ts`, `test-contracts`' `readKeys`, and `test-runner`'s
   `extractionReadOf`. **Until then the premise of the brief still holds** — a scan
   over the bundles cannot count `page_settled` — and it would be easy for the next
   agent to believe otherwise from this repository's source alone.
2. **A fifth stop word would drop every summary sent by a newer extension.** The
   closed set is the member most likely to grow, and the extension in a browser
   and the domain build in Core can be out of step in either direction. I chose the
   strict rule for the reason in §1, and I think it is right, but the cost of being
   wrong is a build that silently publishes no extraction summaries at all. If the
   set is ever extended, the domain side has to ship first. That is a sequencing
   constraint nothing in the code enforces.
3. **`filtered` restarts at a new document and nobody has noticed.**
   `let filtered = resume?.filtered ?? 0` in `list-reader.ts` sums correctly *when
   the checkpoint carries it*, but the checkpoint's own doc says it is "absent in a
   checkpoint written before conditions existed" and an absent one silently
   becomes `0` — the exact understatement `itemsSeen` was just protected from.
   `filtered` is a smaller number and a smaller lie, and it was outside this
   brief, so I left it; it is one line if anyone wants the two to agree.
4. **`conditions` is still per-document while `itemsSeen` is now per-read.** t143's
   open question 3 flagged that `conditions.{applied,kept,rejected}` describe the
   last document alone, and `muhubegx` published `applied: 0` beside
   `recordCount: 43`. That contradiction is now sharper, not softer: two counts in
   one summary, side by side, with different scopes and nothing naming the
   difference. Either the condition report becomes per-read as `itemsSeen` and
   `filtered` are, or its members are renamed for what they describe.
5. **`expected` still overstates the post-condition**, as t148 left it: `at least
   1 record, each carrying name, price, sku` although a record need not carry every
   field. I did not touch it, for t148's reason — changing it moves five e2e
   assertions for no gain in what the read reports.
