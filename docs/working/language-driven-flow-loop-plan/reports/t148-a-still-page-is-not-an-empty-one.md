# t148 — A still page is not an empty one, and a blank column is not a failed read

## Outcome

**Done.** Both halves of the zero-record failure are fixed in the extension, with
the regression reproduced and measured before and after.

1. **The wait.** `awaitListPresent` no longer ends its search for the list on
   document stillness when the item selector has matched nothing. Measured
   against `HEAD`, the exact live signature reproduces — a mutation-quiet,
   `readyState: "complete"` page whose list arrives on a 4 s timer was abandoned
   at **2023 ms** with `never_appeared`. Against the fix it is read at
   **4024 ms** with `appeared`.
2. **The restrictive `required` default** (the coordinator's scope addition, from
   t142 §4). A field is required only where the author wrote `required: true`.
   Three ratingless cards out of forty-three no longer destroy the forty good
   rows; the read returns them with `null` in the cell and states the gap.

Validation: extension `test` 784/784 (baseline at `HEAD`: 775/775), `check`
exit 0, `build` exit 0 with all five bundles emitted. `structure-audit` exit 1
on two failures that were already red and are in files I did not touch.

**Not run: the Playwright content specs** (`pnpm test:content`), which need a
browser. I edited three of them because my change deliberately inverts what they
assert; those three edits are the least-verified thing in this task. See
**Not verified**.

---

## 1. The wait: stillness is evidence about a list that is there, never about one that is not

### What was wrong

`a05134a` (2026-09-25 18:29) ended the first wait as soon as the document was
loaded and mutation-quiet for `PAGE_STILL_MS`, whether or not a single item had
matched:

```ts
await waitUntil(() => matchCount(item) >= wanted || still.settled(), RENDER_WINDOW_MS, RENDER_POLL_MS, progress.deadline);
```

Its reasoning — `querySelectorAll` can only start matching when a node or an
attribute changes — is correct about the DOM and wrong about pages. **A page
whose next change comes from a `setTimeout` is mutation-quiet and
`readyState: "complete"`, and is indistinguishable from a finished one.** That
is every gate the everything store puts in front of a list: `notifications: 4000`
and `softCheckAuto: 8000`, the latter a `setTimeout(pass, …)` that reloads onto
the results.

### What I changed

`apps/extension/src/content/extraction/page-render.ts`. The first wait is now
`searchForList`, and the stillness is consulted **only at a poll whose selector
already names something**:

```ts
const matched = matchCount(item);
if (matched >= wanted) { stopped = "list_present"; return true; }
if (matched === 0) return false;
still ??= documentStillness();
if (!still.settled()) return false;
stopped = "page_settled";
return true;
```

Two consequences worth stating plainly.

- **The early settle is now unreachable for a read of zero records.** The first
  call from `list-reader.ts` passes `required = 1`, so `matched >= wanted` fires
  the instant anything matches and `page_settled` can only be reached by a wait
  that wants *more* items than it has. That is the half of `a05134a`'s saving
  that was sound — a quiet page holding twelve items where sixteen were asked for
  really has said the sixteenth is not coming — and it is kept, under test.
- **A page that never had a list pays the whole window again**, exactly as it
  did before `a05134a`. That is the price of not reporting a gate as an empty
  page, and the brief says to accept it. I measured it rather than claiming it:
  one test row pays the full `RENDER_WINDOW_MS` and reports
  `stoppedOn: "window_elapsed"`.

I did **not** raise `PAGE_STILL_MS`. No constant separates a finished page from
one waiting on a timer, and a larger one would have slowed every honest empty
read.

The observer is also now created lazily, at the first poll that names an item.
Two effects, both improvements: a wait for a list that is not there yet observes
no document at all, and a list arriving in parts measures its quiet **from the
moment its first part landed** rather than from a clock that started before the
page had drawn anything. There is a test row for the second.

### What the read now says about the wait

The brief asked that a read which waited and found nothing record what it waited
for, how long, and why it stopped, "so the next debug reads it off the artifact
instead of inferring it from a duration". `awaitListPresent` now returns a
`ListWait` instead of a bare `ListPresence`:

```ts
export type ListWaitStop = "list_present" | "page_settled" | "window_elapsed" | "deadline_passed";
export type ListWait = { presence: ListPresence; stoppedOn: ListWaitStop; waitedMs: number; waitedFor: number };
```

`list-reader.ts` carries it on `ListExtractionOutcome.listWait`, and
`content/actions/extract-list.ts` states it in the result's comparison text:

> `0 records from 1 page; the item selector named nothing on the page, so the
> list never appeared, after waiting 10004ms for 1 item and stopping on the
> read's own render window running out -- change the selector rather than the
> fields or the conditions`

**On the channel, and why it is prose rather than a field.** The wire summary is
a closed set of counts and words (`domain/src/actions/extraction/summary.ts`),
which I was forbidden to touch, so there is no declared field for a duration or a
stop reason. `validation.actual` is the one free-form channel the extension owns
that the domain deliberately carries — `client/gateway-mapping.ts` calls it "the
only place the evidence for a failure lives" — and the existing
"the item selector named nothing" phrase was written for exactly this purpose, so
I extended it rather than inventing a second mechanism. **A structured
`listWait` on the wire summary is the follow-up**, and it is a domain change:
see **Open questions** 1.

A second, free property worth noting: because the settle can no longer end a
zero-match wait, `listPresence: "never_appeared"` now *implies* the read paid its
whole window or deadline. The pair `never_appeared` at ~2 s, which is what six
live runs produced, has become unreachable — and `stoppedOn: "page_settled"`
beside `never_appeared` is the signature to look for if it ever returns. There is
a test row asserting the phrase can say it, for that reason.

### The reproduction, before and after

A scratch probe (`.../scratchpad/t148-probe.ts`, not in the repository) running
the regression scenario alone, so the behaviour is measured independently of the
return-shape change. Same file, same scenario, only `page-render.ts` swapped:

| source | observed |
| --- | --- |
| `git show HEAD:…/page-render.ts` | `took=2023ms answer="never_appeared" matchedAtEnd=0` |
| this task's `page-render.ts` | `took=4024ms answer={"presence":"appeared","stoppedOn":"list_present","waitedMs":4024,"waitedFor":1} matchedAtEnd=6` |

2023 ms against a list 4000 ms away is the live signature exactly: the four
zero-record reads in t143 ended at 2089, 2576, 2109 and 2082 ms.

The same scenario is now a test row,
`"a quiet, complete page whose list arrives on a timer is waited for, not written off"`.
Against `HEAD` the whole rewritten file fails (15 of 15, since the return type
changed too); the probe above is the honest isolation of the *behaviour*.
Against the fix, 15 of 15 pass.

---

## 2. The restrictive `required` default (scope addition)

### What was wrong

`field-spec.ts::parseStringField` returned `required: true` for every field
written in the string grammar, and `normalizeSpec` defaulted the structured form
the same way (`spec.required !== false`). `extract-list.ts::validationFor` fails
the whole verb when any required field is missing from any record. So the
ordinary thing a model writes — four bare selectors — failed
`output_not_observed` on a page where three cards of forty-three carried no
rating, and **forty good rows were stored as nothing**.

### What I changed

- `field-spec.ts`: the string grammar requires nothing — it has no way to say so
  — and a structured spec requires the field only on an explicit
  `required === true`. **Both forms moved together deliberately**: t142's own
  criterion was that `{name: ".name"}` and
  `{name: {kind: "text", selector: ".name"}}` must not mean different things.
  Nothing downstream relied on the default: the picker
  (`infer-fields.ts:208`) always writes `required` explicitly, from the coverage
  it measured on the page.
- `validationFor`: `outcome.missingFields` — now only the *explicitly required*
  fields a record lacked — still fails the post-condition, so requirement 3
  holds untouched. Its phrase reads `required fields missing from some records:
  …` to make that explicit in the artifact.
- **The gap is stated whether the read passed or failed**, because forty rows
  that say nothing about the three that are short read as complete. From
  `list-reader.ts`, computed off the answered records:
  - `blankFields` — declared fields at least one returned record carries as
    `null`;
  - `incompleteRecords` — returned records short of at least one declared field;
  - `emptyRecords` — returned records that yielded **no** declared field at all.

  The phrase: `43 records from 1 page; 3 records short of a declared field,
  blank in sku`. Where every returned record is empty it adds
  `and every returned record is empty, so the fields were read off the wrong
  element`, which is the reading of a page whose columns were all read off the
  wrong node — a renamed `column:` header included.

### The two zeros are now told apart from the artifact, as asked

The coordinator asked me to check rather than assume that "matched rows, stored
nothing" is a different failure from "matched nothing at all", and to cover them
separately. They are different, and both are now attributable **without a
duration**:

| what happened | `listPresence` | `itemsSeen` | `recordCount` | `emptyRecords` |
| --- | --- | --- | --- | --- |
| the selector named nothing | `never_appeared` | `0` | 0 | 0 |
| rows matched, every field read off the wrong element | `appeared` | `2` | 2 | `2` |
| rows matched, the conditions removed them | `appeared` | `n` | 0 | 0 (with `conditions.applied: n`) |

There is a test row, `"the two halves of a zero read are told apart by itemsSeen,
not by a duration"`, asserting both wire summaries in full.

### t142's inert counts, now produced

`itemsSeen` and `emptyRecords` were declared and validated in
`domain/src/actions/extraction/summary.ts` with no producer. Both now have one,
and it was cheap because neither needed the read loop plumbed:

- `emptyRecords` is computed from the answered records, so it is exact for a
  continued read too — the resumed rows come back through the checkpoint with
  their `null`s intact.
- `itemsSeen` counts the elements the selector named, in a `Set<Element>`
  rather than a running sum, because a `loadMore` or `scroll` read re-queries
  the same document and a sum would count its first items again on every pass.
  It is counted before the item bound and before any condition, so it says what
  the page held rather than what the read kept.

**`itemsSeen` is omitted for a continued read** (`resume`), deliberately.
`ExtractionCheckpoint` lives in `content/shared/extraction-continuation.ts`,
outside my files, and carries no item count; a number that silently restarted at
a new document would be read as the selector having matched fewer items than it
did, which is worse than absent. Naming that as the next task, per the
coordinator's instruction: see **Open questions** 2.

I touched nothing under `domain/src`, `packages/`, `apps/scenario-lab/` or
`F:\!FluxIQ`.

---

## Files changed

Under the brief's ownership:

- `apps/extension/src/content/extraction/page-render.ts` — the wait, the
  `ListWait` account, the lazy stillness, and the header rewritten around what a
  still page proves.
- `apps/extension/src/content/extraction/list-reader.ts` — carries `listWait`,
  counts `itemsSeen`, and computes `blankFields` / `incompleteRecords` /
  `emptyRecords` off the answered records.
- `apps/extension/src/content/extraction/field-spec.ts` — the `required`
  default, in both field forms.
- `apps/extension/src/content/extraction/index.ts` — exports `ListWait` and
  `ListWaitStop`.
- `apps/extension/src/content/extraction/tests/page-render.test.ts` — rewritten:
  15 rows across the four ways the wait can end, including the regression.
- `apps/extension/src/content/extraction/tests/field-spec.test.ts` — the
  `required` rows inverted, and the capability's row kept.
- `apps/extension/src/content/actions/tests/extract-list.test.ts` — five new
  rows.

Added to my scope by the coordinator's message:

- `apps/extension/src/content/actions/extract-list.ts` — `validationFor` (the
  required-only post-condition and the stated gap), `recordGap`, `waitAccount`,
  and `summaryOf` carrying `itemsSeen` / `emptyRecords`.

Edited without ownership, and declared here because my change inverts what they
assert (see **Not verified**):

- `apps/extension/e2e/content/tests/extraction/tests/extract-list-catalog.spec.ts`
  — two rows: "a declared field no record yields fails …" becomes "a column no
  card has is stated, not failed", and the required-field row now writes
  `required: true` out, which is what keeps it testing its own subject.
- `apps/extension/e2e/content/tests/extraction/tests/extract-list-table.spec.ts`
  — one row: a renamed `column:` header leaves its column blank and says so
  rather than destroying the twelve rows that read correctly. The row's real
  point — that `sku` is never read from another column — is unchanged.

---

## Commands run and observed results

All from `F:\!FluxIQWebExtension`. Nothing repository-wide was run, as
instructed. `EXTENSION_TEST_BUILD_LABEL=t148` throughout, so a concurrent
worker's test build was never overwritten.

| Command | Observed |
| --- | --- |
| extension `test`, **baseline**: every file of mine replaced by its `HEAD` version, then restored | `# tests 775 / # pass 775 / # fail 0` |
| extension `test`, mid-task (before the `field-spec.test.ts` rows were inverted) | `# tests 781 / # pass 773 / # fail 8` — all eight in `field-spec.test.ts`, all of them the assertions I had just inverted |
| `pnpm --filter @fluxiq-web-extension/extension test` (final) | `# tests 784 / # pass 784 / # fail 0`, exit 0 |
| `pnpm --filter @fluxiq-web-extension/extension check` (final) | exit 0 |
| `pnpm --filter @fluxiq-web-extension/extension build` (final) | exit 0 — `background 461.5kb`, `content 491.3kb`, `page-world 4.0kb`, `popup 204.6kb`, `sidepanel 204.6kb`. **The bundle was rebuilt, which `a05134a` did not do.** |
| `node scripts/structure-audit.mjs` (final) | exit 1 — `2 violation(s) across 2 rule(s)` |
| `page-render.test.ts` bundled alone, against `HEAD`'s `page-render.ts` | `# tests 15 / # pass 0 / # fail 15` |
| the same, against this task's `page-render.ts` | `# tests 15 / # pass 15 / # fail 0`, `duration_ms 41136` |
| the isolated probe, against `HEAD` | `took=2023ms answer="never_appeared" matchedAtEnd=0` |
| the isolated probe, against the fix | `took=4024ms answer={"presence":"appeared","stoppedOn":"list_present","waitedMs":4024,"waitedFor":1} matchedAtEnd=6` |

I did **not** run `pnpm structure:baseline`.

### The two structure-audit failures were already red

Neither is in my diff, and both are named as pre-existing in t142's report:

1. `FAIL [file-lines] packages/test-runner/src/run-scenario.ts: 812 lines exceeds the 800-line limit`
2. `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks`

The audit also reports `1 baseline entries can be lowered`, which I left alone.

### One advisory warning I introduced

`warn [file-lines] apps/extension/src/content/actions/tests/extract-list.test.ts:
570 lines is past the 400-line advisory threshold` — 364 at `HEAD`, hard limit
800. I did not split it: it is one subject (the verb's account of its read), and
splitting a test file by nothing but length would scatter that subject. Twelve
other files in the repository carry the same advisory, and t142 made the same
call for `read-request.ts` at 427 lines. `list-reader.ts` is now 498 lines and
also warns, but it was 404 at `HEAD` and so was already past the threshold.

### A transient failure that was not mine, recorded so it is not re-diagnosed

An intermediate `check` run failed with exit 1 and eight errors, **all** of them
in `domain/src/runtime/llm-evidence/plan-resolution/extraction/conditions.ts`
(`Property 'assumed' is missing`, `Expected 4 arguments, but got 3`). That file,
`columns.ts` and a new `column-match.ts` had appeared in `git status` since my
task began — a concurrent worker mid-edit in a tree I was told not to touch. No
error named any extension file. Re-running `check` a few minutes later returned
exit 0 with no errors at all. The final figures in the table above are the
re-run.

---

## Not verified

- **No live run**, and no browser. Everything here is argued from the source and
  measured against a fake page that provides exactly what the wait asks of a
  document: a counting `querySelectorAll`, a `readyState`, and an observer
  whose callback the fake page fires. That the real gate on the real fixture is
  now waited out is a prediction, not an observation. It is the prediction the
  next live run of `everything-store-plus-earbuds-under-50` tests directly, and
  the artifact will now say which of the four things ended the wait.
- **The three Playwright e2e rows I edited were not run.** `pnpm test:content`
  needs a browser, the brief did not list it, and AGENTS.md warns against
  starting a browser run that may be competing with one already in flight. I
  edited them because leaving them asserting the behaviour I deliberately
  inverted would have read as a product defect and invited the next agent to
  undo this change. I kept the risk as low as I could: the substrings I assert
  (`8 records short of a declared field, blank in sku`,
  `required fields missing from some records: sku`) are proven by unit rows, I
  used `expect.stringContaining` rather than pinning whole phrases, and I
  verified from the source that `readColumn` returns `undefined` — not a throw —
  for a header the table does not have, which is what makes the table row's
  twelve `sku: null` cells correct. What I could not verify is the fixture-level
  counts (`itemsSeen: 8`, `itemsSeen: 12`) and that no *other* content spec's
  exact `actual` string moved. I checked every remaining
  `every declared field present` assertion by hand against its fixture's dataset
  and believe all of them read fields that are present in every row, so their
  gap clause is empty and their phrase is unchanged — but that is a reading, not
  a run.
- **`expected` now slightly overstates the post-condition.** It still says
  `at least 1 record, each carrying name, price, sku` although a record need not
  carry every field any more. I left it alone on purpose: changing it would
  break five further e2e assertions on reads whose behaviour is otherwise
  untouched, for no gain in what the read reports. `actual` carries the truth.
- **`itemsSeen` for a continued read** is untested because it is deliberately
  absent; I did not exercise the `resume` path at all.
- **The `required` change's blast radius beyond extraction.** I traced the
  default's only other consumer (`infer-fields.ts`, which always writes
  `required` explicitly) and the verb's post-condition. I did not audit Core or
  `packages/test-runner` for anything that reads `missingFields` and expects the
  old strictness.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run whole**, as
  instructed, and neither was `pnpm --filter … test:content`.

---

## Open questions or contradictions found

1. **The wait's account has no structured home on the wire, and it should.**
   `waitedMs`, `waitedFor` and `stoppedOn` ride in `validation.actual` as prose
   because `WebAutomationExtractionSummary` is a closed set of counts and words
   and `domain/src` was out of bounds. Prose is readable but not queryable: a
   future scan over 159 bundles cannot count `page_settled` reads the way t143
   had to count durations. **The follow-up is one optional field on that summary**
   — a `listWait` object, or `waitStoppedOn` plus `waitedMs` — plus the two lines
   in `summaryOf` that fill it, plus Core's projection and the test contract.
   The extension side is already shaped for it.
2. **`itemsSeen` cannot cross a document boundary, and the checkpoint is where
   that is fixed.** `ExtractionCheckpoint`
   (`apps/extension/src/content/shared/extraction-continuation.ts`) carries
   `records`, `pagesRead`, `scrolls`, `missingFields` and `filtered`, but no item
   count, and the worker half is `runtime/extract-list-continuation.ts`. Adding
   one field to both makes `itemsSeen` exact for every read. It is two files
   outside my list and should be its own small task.
3. **The domain's own doc comment for `required` is now stale, and I could not
   fix it.** `domain/src/actions/extraction/request.ts:40` reads "`false` marks
   the field optional", which states the old default. The behaviour is decided
   in the page's parser, which is where I changed it, but the contract's prose
   now says the opposite of what happens. One line, in a file I was told not to
   touch.
4. **A renamed column no longer fails on its own, and that is a real loss taken
   on purpose.** `list-reader.ts` used to promise that "a page that renamed a
   column reports the rename rather than quietly returning records without it",
   and the failure was the report. Now the report is `blankFields` naming the
   column, `incompleteRecords` counting the rows, and `emptyRecords` equal to
   `recordCount` where every column went. That is strictly more information and
   strictly less enforcement. It is the right trade under "minimal parameters
   first; the repair improves them" — but it depends on something downstream
   *reading* those counts. **Nothing does yet.** Until the judge or the repair
   looks at `emptyRecords`, a Flow whose every column reads `null` now succeeds
   quietly where it used to fail loudly, and that is a worse failure mode than
   the one it replaces for that one case. I think this still nets out well ahead,
   because the case it fixes (a few rows short of one column) is common and the
   case it loosens (every column wrong) is rare and loud in the counts — but it
   is a judgement, and whoever owns the judging seam should be told the counts
   are now there to be read.
5. **`a05134a` and `bf3b0c4` disagreed, and t143 flagged it; this resolves the
   disagreement in `bf3b0c4`'s favour.** `a05134a` removed the wait on the
   grounds that a still page cannot discover anything; `bf3b0c4` added
   `listPresence` seventeen minutes later so a zero read could say whether the
   list was ever there. The second existed because the first made zero reads more
   common. `listPresence` is kept and extended; the reason it was needed is
   removed.
