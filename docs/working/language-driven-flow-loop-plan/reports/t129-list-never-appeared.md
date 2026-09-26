# t129 — a read whose list never appeared says so

## Outcome

Done. `web.dom.extract_list` now carries one closed word out of the page saying
whether the `item` selector ever named anything: `listPresence`, `"appeared"` or
`"never_appeared"`. It rides on the read's outcome, on the verb's `extraction`
summary (C2), through the domain's wire copy, and into the phrase the model
reads in `validation.actual`. Nothing about when a read succeeds changed.

A read of zero records now reads differently depending on which of two things
happened:

- selector named nothing —
  `0 records from 1 page; the item selector named nothing on the page, so the
  list never appeared -- change the selector rather than the fields or the
  conditions`
- page genuinely held nothing — `0 records from 1 page`, exactly as before.

## What changed and why

### 1. `awaitListPresent` answers instead of discarding its answer

`apps/extension/src/content/extraction/page-render.ts`

It returned `Promise<void>`; it now returns `Promise<ListPresence>`, a new
exported type `"appeared" | "never_appeared"`. The answer is taken at the end of
the wait, from `matchCount(item) > 0`, by a small private `presence(item)` used
on both return paths (with and without the growth settle).

End-of-wait rather than recorded-through-the-wait is deliberate and documented
in the function: the wait already stops the moment the answer can no longer
change (t127's stillness rule), and the read that follows queries the same
document a moment later, so "there now" is the fact the caller actually needs.

No timing, no bound and no control flow in that module changed. The three ways
the wait can end — the list arriving, the page settling, the ceiling or command
deadline running out — all still end it the same way, and each is now covered by
a test that also asserts the word.

### 2. The read's outcome carries it

`apps/extension/src/content/extraction/list-reader.ts`

`ListExtractionOutcome` gains `listPresence?: ListPresence | undefined`, set
from the wait(s) the read makes on the page it starts on and spread into the
outcome only when defined.

Three details worth stating:

- **`timedOut` was not reused,** as the brief required. It still means only that
  the command's `timeoutMs` ran out mid-read, and it is set from `advancePage`.
  A read whose selector names nothing typically does *not* time out — since t127
  it ends on the page settling — so the two are genuinely independent, and a
  read can have neither, either, or both.
- **A continued read reports nothing.** With `resume`, the read waits for its
  predecessor's page (`awaitPageRendered`), never for a list of its own, so
  `listPresence` stays `undefined` and is absent from the summary. Claiming
  `"never_appeared"` there would be a claim about a wait that never ran.
- **A list no wait saw but the read does is upgraded to `"appeared"`.** One line
  at the top of the read loop. It covers a list drawn between the wait's last
  poll and the query, and a later page's list in a paginated read. Only "the
  selector named nothing anywhere in this read" is reported as the selector
  being wrong.

### 3. It reaches the model

`apps/extension/src/content/actions/extract-list.ts` copies it into the
`extraction` summary, and `readSummary` says it **first** — before the
conditions phrase. The two cannot both apply (a selector that names nothing
applies its conditions to no items, so `unfiltered` is false), but the order
makes the precedence explicit.

`domain/src/actions/extraction/summary.ts` declares
`WebAutomationExtractionListPresence` and an optional `listPresence` on
`WebAutomationExtractionSummary`, and `webAutomationExtractionSummaryValue`
copies it under the same rule as everything else there: a value outside the two
known words drops the **whole** summary rather than arriving as a
half-understood fact. The module header's contract sentence was widened from
"a count, a flag, or a declared field key" to include "a word from a closed
set", since that sentence is the file's statement of what may cross the wire.

### Field name and shape, and why

**Name: `listPresence`.** `list` alone is vague beside `recordCount`,
`pagesRead` and `truncated`; `listPresence` reads as a property of the read.

**Shape: a closed two-word union, not a count or a boolean.** A count would
duplicate what is already there — `recordCount` says how much was read, and what
it cannot say is whether there was anything there to read — and would be one
more number to confuse with the others. A boolean (`listNeverAppeared`) carries
the same information but reads as a negation in a contract whose other
vocabulary (`PageArrival`, `WaitOutcome`) is already closed words; a word also
leaves room for a third state later without a second field. It satisfies "counts
and closed words only": no selector, no page text, no markup.

**Optional, not required.** Two reasons, and the second is decisive. First, a
continued read genuinely has nothing to say. Second, `webAutomationExtraction
SummaryValue` drops the entire summary when a *required* field is missing, so
making it required would have silently discarded every summary sent by an
extension build that predates this change — including the unpacked `dist` a
browser has loaded right now. Optional keeps every existing producer and parser
working unchanged; the existing tests that `deepEqual` a summary with no
`listPresence` still pass untouched, which is the proof.

### What deliberately did not change

- **An empty read still succeeds.** The action is still built by `deps.success`.
  `minItems` still defaults to 1, so zero records still fails the post-condition
  with `output_not_observed` exactly as before — that is pre-existing behaviour,
  not something this added. What changed is that the phrase beside it now says
  why there were none. There is no new refusal, no new failure and no automatic
  retry.
- **A read its conditions emptied is untouched.** Its list appeared, so it gets
  `listPresence: "appeared"` and the unchanged `where kept none of the N items
  … narrow the conditions` phrase. Asserted directly by a new test.
- **No architecture document changed.** Following the precedent of both prior
  commits in this family: the condition report (C5) and t127's stopping rule are
  documented in the code that owns them, and `docs/architecture/
  web-capabilities.md` does not enumerate the summary's fields, so there was no
  stale sentence to correct.

## Commands run and observed results

All three run from a clean typecheck. The extension suite was run with
`EXTENSION_TEST_BUILD_LABEL=t129` so its bundles land in a per-label scratch
directory rather than clobbering a concurrent worker's `default`; it is
otherwise the command the brief named.

`cd apps/extension && node scripts/test-extension.mjs`

```
1..775
# tests 775
# pass 775
# fail 0
# duration_ms 38242.588
```

The five new/changed rows in `page-render.test.ts` and the three in
`actions/tests/extract-list.test.ts`, from the same run:

```
ok 337 - a read whose item selector named nothing says the list never appeared, and still succeeds
ok 338 - a page that really held nothing is a read that appeared, and reads as an empty page
ok 339 - a read its conditions emptied is unchanged: its list appeared, and the conditions still have the phrase
ok 430 - a list that is there is reported as having appeared, settle or no settle
ok 431 - a selector that names nothing on a settled page is reported as never having appeared
ok 432 - a selector that names nothing is still never_appeared when the ceiling or the deadline ends the wait
ok 433 - a list that arrives while the page works appeared, however late
ok 434 - a list too short for the request still appeared: the selector names something
```

`pnpm --filter @fluxiq-web-extension/domain test`

```
1..814
# tests 814
# pass 814
# fail 0
# duration_ms 7827.4532
```

```
ok 38 - a read that never saw its list carries the word that says so, and one that saw it carries the other
ok 39 - a word this contract does not know drops the whole summary rather than riding beside it
ok 40 - the list word and the condition report travel together, since a read can have both
```

`cd domain && npx tsc -p tsconfig.json --noEmit` — no output, exit 0.

Also run, unprompted, because the change crosses two packages and a ratcheted
audit:

- `cd domain && npx tsc -p tsconfig.test.json` — no output, exit 0 (this is what
  typechecks the domain's own tests; the test runner is esbuild and does not).
- `cd apps/extension && npx tsc -p tsconfig.json --noEmit` — no output, exit 0.
- `node scripts/structure-audit.mjs` — passed (105 warnings, 121 baselined) when
  run mid-task; on the final run, `structure-audit: 1 violation(s) across 1
  rule(s)`, exit 1, entirely from a pre-existing `docs/working/README.md`
  staleness that appeared with commit `c322a01` part-way through this task. See
  the open questions below; nothing this task touched is in it.

## The three cases the brief asked to cover

| Case | Covered by | Observed |
| --- | --- | --- |
| A list that appears reports `appeared` | `page-render.test.ts` rows 430, 433, 434; `extract-list.test.ts` row 338 | `appeared`, including when the list arrives late and when it is too short for `minItems` |
| A selector matching nothing reports `never_appeared`, zero records, still succeeds | `page-render.test.ts` rows 431, 432; `extract-list.test.ts` row 337 | `never_appeared` on both the settle path and the deadline path; the verb builds a `success` result, `recordCount: 0`, summary carries the word through the wire copy, and the phrase names the selector as the thing to change without quoting it |
| A read its conditions rejected everything is unchanged | `extract-list.test.ts` row 339, and the four pre-existing condition rows | `listPresence: "appeared"`, condition report byte-identical, `where kept none of the 2 items` phrase intact, no "never appeared" in the phrase |

## Not verified

- **No live browser run.** The brief forbids rebuilding `apps/extension/dist`
  (a live run has it loaded), so nothing here has been exercised against a real
  page. Everything proven is Node-level: the wait against a stubbed `document`
  and `MutationObserver`, and the verb against an injected list capability. The
  first live run after the next `dist` build is where `listPresence` would first
  appear in run evidence.
- **The Playwright content suite was not run** (`pnpm --filter …/extension
  test:content`), because its build step is `pnpm build`, which writes `dist`.
  `e2e/content/tests/extract-list.spec.ts` is the file that would prove the word
  on a real fixture page, and it has no case for it yet — worth adding when a
  build is allowed again.
- **Nothing downstream of the wire was touched or checked.** Whether Core's
  prompt-facing evidence packet surfaces `listPresence` to the model as a
  structured field, rather than only via the `validation.actual` phrase, is a
  FluxIQ Core question and outside this brief. The phrase does reach the model
  today, so the fact is not stranded either way.
- **`pnpm check` / `pnpm test` / `pnpm build` were not run** — they build, and a
  live run is in flight.

## Open questions or contradictions found

1. **`docs/working/README.md` is failing the structure audit on `dev`, and it is
   not mine.** `FAIL [working-docs] docs/working/README.md is out of date with
   the documents' header blocks. Run "pnpm structure:baseline" to regenerate
   it.` The audit passed when I ran it part-way through this task and failed on
   the final run; the only thing that changed the tracked tree in between was
   commit `c322a01` ("Correct the repair finding…"), which edited a working
   document's header block without regenerating the index. The rule reads only
   top-level `docs/working/*.md`, so a report under `reports/` cannot cause or
   worsen it. `docs/working/README.md` is a shared document a worker must not
   edit — flagging it for the supervisor, who need only run
   `pnpm structure:baseline`.

   The same run also reports `1 baseline entries can be lowered`, for
   `failure-as-empty` on `packages/test-runner/src/run-scenario.ts` — the file
   another worker is editing, not this task's.
2. **One new advisory warning:** `list-reader.ts` is now 404 lines, four past
   the 400-line advisory threshold (the failing limit is 800, and 105 files are
   already in that band). I trimmed the additions from 19 lines to 8 to get
   close; going under would have meant deleting the contract prose that explains
   the field. The honest read is that the file is approaching a split — its
   89-line header now documents four separate concerns — but splitting it is a
   change with its own risk and was not in this brief.
3. **The second `awaitListPresent` call is a small piece of waste this did not
   fix.** When `minItems > 1` and the selector names nothing, the read pays the
   stillness settle twice: once in the first wait, and again in
   `if (required > 1) await awaitListPresent(item, required, …)`, whose
   `documentStillness()` clock restarts. Roughly two extra seconds on exactly
   the reads this change exists to describe. Skipping the second wait when the
   first said `"never_appeared"` would be safe — `awaitListComplete` returns
   immediately when the selector matches nothing (`if (before === 0 … ) return`),
   so nothing can have changed in between — but it is a behaviour change rather
   than a reporting one, so I left it and am naming it instead.
