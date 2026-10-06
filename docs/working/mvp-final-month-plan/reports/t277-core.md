# t277-core: Core chat wording for round-3 UI fixes (worker report)

Brief: "Brief: t277-core (worker-high)". Tree: Core `fxwork/t277/!FluxIQ`, branch `task/t277-r3-ui-fixes`.
Nothing was committed. R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

**Partial.** Items 1, 2, 3, 4 and 5 are done in Core, each with tests that failed before the fix.
Item 6 needs a domain field, so today's words stay (details under item 6). Two changes are outside my
files and are written out below for whoever owns them: the `judge-words.ts` diff the brief asked for,
plus three more I found. No page data is quoted here. The live judge text was only fed through the
code in a scratch test, and only its shape (length, brackets, words) is reported.

## What changed and why

### Item 1 (R2-U-1): refuted check card with no count and no reason

- **Cause.** There were two:
  - `activityActionOf` never set `why` for a `result_check` row. The row has no `Result:` record, so
    `why` was always null.
  - The extension falls back to `said` (`action-card.ts`). It drops the whole sentence when it matches
    `DOTTED_ID = /\b[a-z][\w-]*(?:\.[\w-]+)+\b/iu`. The check's text carried the judge's "(e.g. …".
    `e.g` matches that pattern, so `said` was undefined and the card read only "Didn't pass".
  - The count was in the text: `check-words.ts` writes "82 rows would be stored." first. So the cause
    is not only in `R/result-verification/**`.
- **Change.** New `src/ui/activity-action/check-why.ts` (`activityActionCheckWhy`), called from
  `action-of.ts` for a failed `result_check` row that is not unconfirmed:
  - It reads the check's text with the shared splitter and builds `<count sentence>, but <the check's
    first finding as one plain clause>`. The clause has its asides removed and is cut at its first
    ":", ";" or dash.
  - When no finding can be used it says "…, but the check found they don't answer what you asked"
    ("it doesn't" for one row). With zero rows it says "No rows …, and <finding>".
  - It returns null when there is neither a count nor a finding, so the client still shows Core's
    sentence. An unconfirmed check keeps `why: null`, so the "Not confirmed" words are unchanged.
- **Live replay.** I put judge step 0026's diagnosis through Core's real path in a scratch test:
  `check-words` (outside my files) → `automationStudioActivityReasonText(…, 600)` → `activityActionOf`.
  - `why` = "82 rows would be stored, but a step kept 82 rows from 5 pages with no filtering or
    removing duplicates".
  - The text was 503 characters with balanced brackets, and contained no "Step 8" and no "dedup".

### Item 2 (R2-U-3): sentences cut inside brackets or glued together

- **Cause.**
  - Every splitter split on `(?<=[.!?;])\s+`, so "(e.g." ended a sentence.
  - `reason-text.ts` then cut the text at `max` with `slice`, which can land inside an open bracket.
  - `judge-words.ts` then put the next sentence of the ending straight after "(e.g.".
- **Change.**
  - New shared splitter `src/ui/activity-action/sentences.ts` (`activityActionSentences`, exported
    from the ui barrel).
    - It does not split after e.g., i.e., vs., cf., approx., incl., esp. or viz.
    - It splits after "etc." only when a capital follows.
    - It never splits inside brackets that close.
    - An unclosed aside is dropped up to where its sentence ends, or to the end of the text; that
      sentence keeps or gets a full stop.
    - The option `{ clauses: true }` also splits at ";".
  - `reason-text.ts` now uses it in two places:
    - The decision screen (`withoutMechanics`).
    - A new `held()` that keeps the text to `max` in whole sentences. A sentence that fits only
      without its asides is kept without them. If not even the first sentence fits, it is cut at a
      word end with "…", after its asides are removed, so the cut is never inside brackets.
  - The card text from item 1 uses the same splitter.

### Item 3 (R2-U-4): internal words in the chat

- **Change.** New `R/activity/wording/person-words.ts` (`automationStudioActivityPersonWords`, exported
  from the wording and activity barrels). `reason-text.ts` (`screened`) applies it to every thought and
  to the result check's text. It replaces:

  | Internal words | Person's words |
  | --- | --- |
  | "extract list (node)", "dom extract list", "extraction node", "the extraction" | "the list reader" ("its list reader" after a possessive, "a list reader" after a/an) |
  | "extraction" on its own | "reading the list" |
  | scrape, scrapes, scraped, scraping | read, reads, read, reading |
  | "pagination" | "the result pages" |
  | paginate, paginates, paginated, paginating | page through, pages through, paged, paging through |
  | dedup, dedupe, deduplication | "removing duplicates" ("remove duplicates" after to, then, must, should, will, would, can, could, also, please) |
  | deduplicate, deduplicates | "remove duplicates", "removes duplicates" |
  | "are deduplicated", "is deduplicated" | "have duplicates removed", "has duplicates removed" |
  | "deduplicated" on its own | "with duplicates removed" |
  | "the judge", "the judge's" | "the check", "the check's" |
  | "next call" | "next step" |
  | "Step 8", "steps 3 and 4" | "A step"/"a step", "some steps" (just "step" after the/its) |

  It also removes brackets that hold only ids, such as "(web.output.dom-extract_list)", before the ids
  are rewritten.
- **Look-up card.** `wording/core-tool.ts`: the `core.describe_nodes` title now says what is being
  looked up and never names a node.
  - Examples: "Looking up how to read a list", "Looking up how to click and type", "…how to type,
    click, read a list and more".
  - "Looking up how to use a step" when no verb is known.
  - `action-of.ts` reads "Looking up how to …" back as the card's target (`LOOKED_UP`). The card reads
    "Look · how to read a list". Old quoted titles still read as before.

### Item 4 (R2-U-6): "wasn't on the page" for a call never sent

- **Correction to the brief.** Step 0034 (`malformed_handle`) already read correctly. It is the top card
  in moment 07: "FluxIQ didn't send it, as the step didn't say which control on the page to use".
  - The cards that read "it wasn't on the page" were 0039 and 0046.
  - Their reason was `answered_the_same_again`. The domain's `repeated-refusal.ts` puts that in place
    of the cause when it gives the same refusal again.
  - Core had no words for that reason, so it fell back to the code `target_unobserved`. Its `unobserved`
    word was in the page-miss row of the table.
- **Change.**
  - `failure-reason.ts`:
    - It takes an optional `kind`. `action-of.ts` passes the card's kind, and a list read gets
      list-specific words.
    - `unobserved` is no longer a page miss: "FluxIQ didn't send it, as the step named something it
      hadn't seen on the page", or for a read "FluxIQ didn't read it, as the step named a list it
      hadn't seen on the page".
    - `malformed_handle`, `not_a_handle` and `handle_in_wrong_parameter`, for a read: "FluxIQ didn't
      read it, as the step didn't say which list on the page to read". The control words are
      unchanged.
    - `answered_the_same_again` → "FluxIQ didn't send it (for a read: didn't read it), for the same
      reason as the time before".
    - `changes_nothing` → "it was already tried exactly this way on this same page".
    - Core codes never read these as page misses.
  - New `R/activity/repeated-reason.ts`: the observer of one loop remembers each call's last cause,
    keyed by tool, node and code. When the same refusal comes back as `answered_the_same_again`, the
    observer puts that cause back on the row's `Reason:`, so the repeats read the real cause. A repeat
    whose first refusal the observer never saw keeps the "same reason as the time before" words.
  - `web.target.not_found` (Core really looked) still reads "it wasn't on the page".

### Item 5 (R2-U-8): one list, one name

- **Change.** New `R/activity/wording/list-name.ts` (`automationStudioActivityListName`), used by the
  list-read sentence in `wording/action.ts`.
  - A list of more than two fields is named by exactly two of them plus a count: "name, price, rating
    and 3 more" becomes "name, price and 4 more", and "name, price and rating" becomes "name, price
    and 1 more".
  - A list of one or two fields is unchanged.
  - Build reads, reruns ("Trying again: reading the list of “name, price and 4 more”") and test reads
    get the same name, and the card target is read from that title. No extension file was touched.

### Item 6 (R2-U-9): detect card does not name the list

- **Not done. A domain field is needed.**
- **What reaches Core today.**
  - The detect call (step 0010) carries only `target`, an item's own heading link.
  - Its result (`web-llm-structure.v1`) carries `location`, `extraction`, `target`, `itemCount`,
    `fields`, `pagination`, `paginationBound`, `confidence` and `atNote`. It has no heading, region or
    aria label for the list.
  - In this run the list sat in an unlabelled `[main]` region with no heading of its own.
- **What the domain must send.** A plain list name in the domain's `describeCall` words for
  `web.detect_repeating_structure`. Suggested field: `list?: string`, taken from the container's
  accessible name (aria-label or aria-labelledby), else the nearest heading before it.
- **What Core then needs.**
  - `AutomationStudioLlmEvidenceCallWords` in `R/llm/loop-configuration.ts` (not mine) gains `list`.
  - `describeSafely` in `R/activity/observer.ts` keeps it.
  - The detect sentence in `wording/action.ts` says `Looking for “<list>”` (card: `Look · <list>`).
- Today's words stay: "Looking for the repeating list on the page".

## Commands run and observed results

All `npx vitest` commands were run from `packages/fluxiq`.

- **Fail-first, before any source change.** `npx vitest run src/ui/activity-action/tests/sentences.test.ts
  src/ui/activity-action/tests/failure-reason.test.ts src/ui/activity-action/tests/action-of.test.ts
  R/activity/wording/tests/reason-screen.test.ts R/activity/wording/tests/reasons.test.ts
  R/activity/wording/tests/wording.test.ts R/activity/tests/observer.test.ts`
  → `Test Files 7 failed (7)`, `Tests 24 failed | 204 passed (228)`. By item:

  | Item | Failing tests | Where |
  | --- | --- | --- |
  | 1 | 2 | action-of R2-U-1 |
  | 2 | 7 | sentences 5, reason-screen R2-U-3 2 |
  | 3 | 5 | reason-screen R2-U-4 2, reasons "screens handles" 1, wording look-ups 1, action-of looks 1 |
  | 4 | 9 | failure-reason 6, action-of R2-U-6 1, observer 2 |
  | 5 | 1 | wording list name |

- **The same command after the fixes** → `Test Files 7 passed (7)`, `Tests 228 passed (228)`.
- **After the fail-first run I changed two tests:**
  - One assertion in reason-screen R2-U-3 test 1 was wrong, because the decision screen correctly
    drops a sentence that names "step 7". I replaced it with the case where the glue showed:
    "Read the ads, e.g. the ones in step 7. The cart needs three." should give "The cart needs three.".
    The old splitter would have given "Read the ads, e.g. The cart needs three.". I worked that out by
    reading the old code; I did not run it against the old code.
  - The observer test's `?? ""` was added for the type check.
- **Required directories:** `npx vitest run src/ui/activity-action src/programs/automation-studio/runtime/activity`
  → `Test Files 32 passed (32)`, `Tests 419 passed (419)`.
- **Neighbouring suites that use the changed code**, to catch regressions (not mine to edit):
  - `R/executor/tests/cleared-wait-activity.test.ts`, `R/executor/tests/failed-step-reason.test.ts`,
    `R/llm/tests/evidence-loop.test.ts`, `R/result-verification/tests`,
    `R/service/runtime-session/tests/parked-wait.test.ts`, `R/recovery`, `R/conversations`
    → `Test Files 86 passed (86)`, `Tests 922 passed (922)`.
  - `R/flow-bootstrap` → `Test Files 85 passed (85)`, `Tests 1245 passed (1245)`.
- **Core root `node scripts/build-cache/cli.mjs fluxiq:check`.**
  - First run: exit 2. TS2322 in the new observer test (`resultReason: string | undefined` under
    exactOptionalPropertyTypes). Fixed in the test.
  - Final run: passed and stamped (`"reason":"inputs changed: packages/fluxiq; stored in the shared store"`).
- **Core root `node scripts/build-cache/cli.mjs structure-audit:check`** → `structure-audit: passed (264
  warning(s), 349 baselined)`.
  - Advisory warnings on my files: `ui/activity-action/action-of.ts` has 425 lines (it already had
    407), `tests/action-of.test.ts` has 469, and `R/activity` now has 17 files (the warning starts
    at 15).
- **Line endings.** Every changed or new file is LF (`file` reports no CRLF). The working tree uses
  autocrlf, so git warns that it will convert them on checkout. The index is LF either way.
- **Scratch tests** (scratchpad, not in the repo):
  - The live-judge replay above.
  - The judge-words comparison below. It passed 2 of 2: the new `judge-words.ts` gives the same output
    as today on all nine judge-words inputs in `ending-never-cut.test.ts`, and fixes the "(e.g." cut.

## Words the next live UI review must see

These assume the lead rebuilds Core and the extension takes Core's `why` and names as given.

- **Build-test check card:** "Check result · Didn't pass: 82 rows would be stored, but <the check's
  first finding>". On this run that finding was "a step kept 82 rows from 5 pages with no filtering or
  removing duplicates". Never a bare "Didn't pass".
- **Thoughts and reasons:**
  - No "extract list node", "extraction", "scrapes", "pagination", "dedup", "the judge", "next call"
    or "Step N".
  - For example: "I'll describe the list reader so I can add a step that reads all result pages…",
    and "…to see the rows, fields and the result pages it really returns…".
  - No sentence ends at "(e.g.", and none is cut inside a bracket.
- **Look-up:** card "Look · how to read a list"; overlay and message title "Looking up how to read a
  list".
- **Refused list read:** card "Read list · name, price and 4 more / Didn't work: FluxIQ didn't read it,
  as the step didn't say which list on the page to read", repeats included. Never "it wasn't on the
  page" for a refused or repeated call.
- **List name:** overlay "Reading the list of “name, price and 4 more”" and "Trying again: reading the
  list of “name, price and 4 more”"; card "Read list · name, price and 4 more", and the same on test
  cards once the extension stops shortening it.
- **Detect:** unchanged, "Look · the repeating list on the page" (item 6).
- **Still raw until the owners act:** the "Repairing the Flow" heading and the build ending. They come
  from `flow-bootstrap`; see below.

## judge-words.ts diff (not my file; checked on a scratch copy)

```diff
--- a/packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/judge-words.ts
+++ b/packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/judge-words.ts
@@ -25,6 +25,8 @@
 // Not a quote: what comes back is the judge's account in plain words, which is
 // why no ending puts quotation marks round it any more.
 
+import { activityActionSentences } from "../../../../../ui/index.ts";
+
 /** A step id the draft gives (`s8`, `n12`). */
 const STEP_ID = /\b[sn]\d{1,5}\b/u;
 /** A page handle (`t958`, `e3`, `d7`) or an act id (`a1`, `a2.quantity`). */
@@ -34,10 +36,9 @@
 
 /** The judge's words, screened and in whole sentences of at most `most` characters; empty when none fits or none is plain. */
 export function automationStudioFlowBootstrapJudgeWordsSaid(text: string, most: number): string {
-  const pieces = screened(folded(text))
-    .split(/(?<=[.!?;])\s+/u)
-    .map((piece) => piece.trim())
-    .filter(Boolean);
+  // The chat's one splitter: never after "e.g." nor inside an aside, and an
+  // aside left unclosed is left out (R2-U-3, `run-muwansvz-a2b4a987`).
+  const pieces = activityActionSentences(screened(folded(text)), { clauses: true });
   const kept: { piece: string; index: number }[] = [];
   pieces.forEach((piece, index) => {
     if (!STEP_ID.test(piece) && !HANDLE.test(piece) && !CODE.test(piece) && /[A-Za-z]/u.test(piece)) kept.push({ piece, index });
```

- **Checked on a scratch copy against today's file:**
  - The same output for all nine inputs in `ending-never-cut.test.ts` (RUN_A and RUN_B observed and
    advice at their limits, "x " × 100, the bare code).
  - With room for one sentence, today's code gives "Stored rows include ads (e.g.". The new code gives
    "Stored rows include ads, and repeats.".
  - On the live 0026 text, today's code ends on "(e.g." at limits 120, 200 and 400. The new code says
    the first whole sentence, with balanced brackets.
- **Optional second step, not checked.** `screened()` could end with
  `automationStudioActivityPersonWords(…)`, now exported from `../../activity/index.ts`, which
  flow-bootstrap already imports. That would remove "Step 8", "dedup" and "the judge" from the judge's
  text in the endings. The catch: `ending-never-cut.test.ts` line 229 expects "Add a step after
  step 6 …", which would become "Add a step after a step …".

## Other changes needed outside my files

1. **Extension (t277-ext):** `apps/extension/src/panel/chat/stream/step/action-card.ts` `DOTTED_ID`
   treats "e.g" as an id and drops Core's whole `said`. The refuted card no longer depends on it, since
   it now has `why`, but "Passed: …" and "Not confirmed: …" cards whose text holds "e.g." still lose it.
   Suggested fix: require each dotted part to be at least two characters, or allow e.g. and i.e.
2. **Extension (t277-ext):**
   - `card-words.ts` `shorterList` must pass Core's "name, price and 4 more" through unchanged, so test
     cards stop showing "name and 5 more".
   - The overlay's `OUTCOME_NOT_FOUND` for any `unobserved` code is theirs to change.
   - Extension tests that assert words I changed: `messages.test.ts:178`, `card-words.test.ts:19-25`,
     `action-card-view.test.ts:120`. They pass `why` in as a fixture, so they may not need changing;
     not run.
3. **`R/result-verification/check-words.ts` `plain()`** (not mine) splits the judge's expected and
   found text on `(?<=[.!?])\s+`. This is not run. Suggested change, with the import beside the
   existing `ui/index.ts` import used by `check-activity.ts`:

   ```diff
   +import { activityActionSentences } from "../../../../ui/index.ts";
   ...
   -  const kept = text
   -    .split(/(?<=[.!?])\s+/u)
   -    .map((sentence) => sentence.trim())
   -    .filter((sentence) => sentence && !INTERNAL.some((shape) => shape.test(sentence)))
   +  const kept = activityActionSentences(text)
   +    .filter((sentence) => !INTERNAL.some((shape) => shape.test(sentence)))
   ```

4. **Ending, R2-U-2 and R2-U-4 (flow-bootstrap `budget-exhausted.ts`, not mine):** "next call", "the
   judge" and the dollar wording are Core's own sentences there, so the reason screen does not reach
   them.
5. **Domain `repeated-refusal.ts`:** it swaps `resultReason` to `answered_the_same_again`. Core now
   carries the cause back on where it saw it. The alternative fix is for the domain to keep the cause in
   `resultReason` and report the repeat count elsewhere.

## Not verified

- No pnpm build, Lab, browser or provider call (per the brief). The extension does not yet see these
  Core changes, and extension tests were not run.
- The suggested diffs for `check-words.ts` and the optional judge-words person-words step were not run.
- The reworked reason-screen assertion "Read the ads, e.g. …" was not run against the old code; that it
  would fail there is my reading of the old code.
- Whole-package `pnpm test` was not run (the full suites run twice a day).

## Open questions or contradictions found

- The brief says the 0034 card (`malformed_handle`) read "wasn't on the page". The step folders show
  0034 read correctly; 0039 and 0046 (`answered_the_same_again`) are the ones that did not.
- Item 5's rule "exactly two named" also turns a three-field list "name, price and rating" into "name,
  price and 1 more". That follows the brief, but it is wordier than before; the lead may want lists of
  exactly three fields left whole.
