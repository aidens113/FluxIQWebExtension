# t194-w5: a list read that meets a rate-limit page mid-pagination

Worker report. Tree: `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQWebExtension`, branch
`task/t194-live-judge-answer`. Defect from live run `run-munnhi5q-4867dabe` (everything-store).

## Outcome

**Partial.** Items 1, 2 and 4 are done in owned files and verified. A read now does
four things:
- it waits out a 429 or 503 page that a page advance landed on;
- it reloads the same address;
- it goes on from its checkpoint;
- if the retries are spent or the list is lost, it stops `truncated: true` with the
  records it already has, and it says why.

Two parts cannot land in owned files, so each is an exact diff below.

- **The stop word `rate_limited`.** The domain's closed set
  (`domain/src/actions/extraction/summary.ts:105-131`) does not admit it, and a word
  outside the set drops the **whole** summary (`summary.ts:297-298`). Until Diff B
  lands, the tree sends `list_vanished` for a 429 stop. The HTTP status is named in
  the result's `actual` text and in the page outcome's `refusedStatus`.
- **Item 3 (the lane snapshot carries `paginationStop`).** The record's type and its
  strict validator are in `packages/test-contracts` (`validation.ts:5` `readKeys`,
  and `keys()` refuses unknown members). Carrying the member in `extraction-read.ts`
  alone would make every paginated read drop out of the bundle. Diff A is verified
  in an overlay.
- **The retry count cannot reach the bundle at all** without Core. Core's
  projection (`!FluxIQ/.../service/summaries/extraction-summary.ts:166-178`) copies a
  fixed key set, and Core is out of scope. So `pageRetries` reaches the page outcome
  and the result text only.

## Cause (tree as of HEAD, before this change)

1. `apps/extension/src/content/extraction/list-reader.ts:549-550` (HEAD). A page an
   advance reached that showed no item and no control became `paginationStop:
   "list_vanished"`, and `truncated` was left at `false`. The outcome
   (`:363-373`) was therefore a complete-looking read. `actions/extract-list.ts:62`
   then answered `succeeded`, and `validationFor` passed on `records >= minItems`.
2. `list-reader.ts:384` (HEAD). A continued document was always given the 10 s render
   wait (`page-render.ts:159`, `RENDER_WINDOW_MS`), even when the server had refused
   it. Nothing read the document's HTTP status. So the 429 page cost 10 s and was
   read as an empty page. This matches w3's `durationMs` 14,735 arithmetic.
3. Nothing retried. The store's limiter
   (`apps/scenario-lab/src/scenarios/everything-store/state/throttle.ts:11-22`) counts
   no refused request, so waiting out its 8 s window always works. The read never
   waited.
4. `list-reader.ts` (HEAD) counted the empty 429 page in `pagesRead`. That is why the
   live read said `pagesRead: 5` when only 4 result pages had content.
5. `packages/test-runner/src/flow-lane/extraction-read.ts:76` does not destructure
   `paginationStop`, so no bundle can show how a read ended.

## What changed and why

### `apps/extension/src/content/extraction/pagination.ts` (+92 lines, header section at `:171-261`)

- `RefusedPageHost`: `status()`, `pause(ms)` and `reload()`.
  - `BROWSER_PAGE_HOST` (`:227`) is the browser's implementation.
    `status()` reads `performance.getEntriesByType("navigation")[0].responseStatus`,
    and `0` or absent means unknown. `reload()` calls `location.reload()` and waits up
    to 10 s for the document to go.
  - No extra request is ever made to learn `Retry-After`.
- `pageRefusalOf(status)`:
  - 429 → `rate_limited`;
  - 503 → `unavailable`;
  - no status → `unexplained`;
  - anything else → served.
- `refusedPageWaitMs(refusal, spent, remainingMs, canReload)` (`:257`) returns the
  wait before a reload, or `undefined` to stop.
  - The first wait is **8,500 ms**: longer than the 8 s window, so the first retry
    succeeds against the store's limiter. The second is 17,000 ms.
  - At most `MAX_PAGE_RETRIES = 2` reloads per read, counted across documents.
  - No retry unless the read's remaining `timeoutMs` covers the wait + 2,000 ms.
  - No retry when nothing takes the checkpoint, because the reload would lose the
    read.
  - **A read stops at its second 429** rather than reload into a possible third (see
    Open questions 1). An `unexplained` page counts as a possible 429.
- `RATE_LIMITED_STOP` (`:202`) is `"list_vanished"` until Diff B lands.

### `apps/extension/src/content/extraction/list-reader.ts` (686 → 763 lines)

- `refusedDocument` (`:430`) handles a refused page:
  1. waits;
  2. increments `spent`;
  3. checkpoints the document's own `resume` plus `refusals`, since nothing was read
     there;
  4. reloads.

  The reload takes the script with it. The worker then re-sends with that checkpoint
  (`runtime/extract-list-continuation.ts:86-98`, unchanged). A checkpoint resets its
  stall count, and `refusals` bounds the loop. If it does not retry, it sets
  `truncated = true`, `refusedStatus` and the stop word.
- A continued document checks its status **before** the render wait (`:448`), so a
  refused page costs no 10 s.
- A lost list (`:624-635`) is now always `truncated: true`, and its empty page is not
  counted in `pagesRead`. On the first page of a continued document with no status,
  it is retried as a possible refusal (the Firefox and older-Chromium fallback). With
  a known 2xx status it is `list_vanished` with no retry.
- The checkpoint carries `refusals` forward. The outcome gains `pageRetries` (only when
  it is above 0) and `refusedStatus`. `truncated`'s documentation now covers a lost
  list.
- New option `pageHost`, which is the test seam.

### `apps/extension/src/shared/extraction-continuation.ts`

- `refusals?: { retries, rateLimits }` crosses the boundary.
- Unreadable counts refuse the checkpoint rather than reset it, because a reset would
  let a read reload a refusing page for ever.

### `apps/extension/src/content/actions/extract-list.ts`

- When `refusedStatus` is set, the `actual` text reads: "paging stopped because the
  server refused the next page (HTTP 429, too many requests) and went on refusing
  after the read waited and reloaded it (1 time) -- the list goes on past these
  records, so the read is incomplete".
- A read that recovered says "the server refused a page and the read waited and
  reloaded it (N times) and went on".
- The `list_vanished` phrase now ends "so the read is incomplete".
- `PAGING_STOPPED` already carries a `rate_limited` entry, typed as `Record<Stop |
  "rate_limited", string>`, so Diff B needs no edit here.
- The action stays `succeeded`, with `truncated: true` on the summary. See Open
  questions 2.

### `docs/architecture/web-capabilities.md`

- The Pagination row now covers the behaviour above.
- The Structured extraction and Repeating/list rows in the same diff are another
  worker's (w6 badge column), not mine.

### Tests

**New file `content/extraction/tests/list-reader-refused-page.test.ts`**, which covers
the read across documents:
- 429 → wait 8,500 → checkpoint `{...FOUR_PAGES, refusals:{1,1}}` → reload. The
  reloaded 200 document then returns all 10 records, `pagesRead: 5`,
  `truncated: false` and `pageRetries: 1`.
- A 429 that persists: no reload and no wait. The result is the 8 records kept,
  `truncated: true`, `refusedStatus: 429`, the stop named, and `pagesRead: 4`.
- A 503 retried twice (8,500 then 17,000), then truncated.
- No checkpoint taker, or too little time: no reload, and truncated.
- No status and the list lost: retried as a possible refusal. A 200 page that lost
  the list is `list_vanished` and truncated, and not counted as a page.

**Other test files:**
- `pagination.test.ts`: +3 tests for the pure policy.
- `shared/tests/extraction-continuation.test.ts`: +1 test for the `refusals` round
  trip and refusal of unreadable counts.
- New file `content/actions/tests/extract-list-refused-page.test.ts`: +3 tests. The
  summary is truncated through the domain's wire copy, and the text names the status.

## Commands run and observed results

1. `EXTENSION_TEST_BUILD_LABEL=t194-w5 bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w5 ext" pnpm --filter @fluxiq-web-extension/extension test`
   - Whole suite, final run: `# tests 1239` / `# pass 1239` / `# fail 0` (exit 0).
     The earlier run, before the last two test files existed, gave 1235/1235.
2. `node node_modules/typescript/bin/tsc -p apps/extension/tsconfig.json --noEmit` → exit 0.
   - An earlier run showed only `infer-fields.ts` errors (`constantBadgeName`,
     `isBadge`, `badgeSource`). That file belongs to the concurrent w6 worker, who
     was mid-edit, and the errors were gone on the final run.
3. **Fails without the fix.** Sources were rebuilt as HEAD + the w3 diff applied,
   which equals the tree minus my change (the test files were byte-identical), in an
   ignored scratch overlay, and the new tests were run with the extension's esbuild
   settings:
   - `list-reader-refused-page.test.ts`: `# tests 5 / # pass 0 / # fail 5`. Tests
     1-3 and 5 fail with "Missing expected rejection". Test 4 fails with `truncated`
     `expected: true, actual: false`, which is the live signature.
   - `extraction-continuation` refusals test and all 3 `extract-list-refused-page`
     tests: `not ok` (4 fail; the 4 earlier tests pass).
   - `pagination.test.ts`: fails to build (`No matching export ... "refusedPageWaitMs"`,
     and so on).
   - The overlay was deleted afterwards.
4. `bash .../heavy.sh "t194-w5 runner" pnpm --filter @fluxiq-web-extension/test-runner build`
   - Result: exit 0 (`"build-cache":"build" ... "ms":23486`).
   - Then `node --test dist/flow-lane/tests/extraction-read.test.js` →
     `# tests 13 / # pass 13 / # fail 0`. That file is unchanged in the tree, because
     item 3 is Diff A.
5. **Diff A verified in an overlay** (an ignored copy under
   `packages/test-runner/node_modules/.cache/t194-w5`, since removed):
   - Overlay test-contracts: `tsc` exit 0, and `node --test tests/*.test.mjs` →
     `# tests 156 / # pass 156 / # fail 0`, including the new test.
   - Overlay test-runner src: whole-package `tsc` exit 0, and `node --test
     runner-dist/flow-lane/tests/extraction-read.test.js` → `# tests 14 / # pass 14 /
     # fail 0`.
   - Against the unmodified contract the same sources fail to compile (`TS2353:
     'paginationStop' does not exist in type 'RunExtractionRead'`, and `TS2724` for the
     imports).
   - `git apply --check` of Diff A in the tree → ok.
6. `git apply --check` of Diff B in the tree → ok. **It was not compiled or run.**
7. `node scripts/structure-audit.mjs` → `structure-audit: passed (126 warning(s), 120 baselined).`, exit 0.
   - One new advisory warning is mine: `pagination.ts: 10 exported values is past the
     8-value advisory threshold`.
   - `list-reader.ts` is at 763 lines, under the 800 hard limit; its 400-line
     warning was already there.
   - A first run failed on a stray `apps/extension/out/` that my scratch runner had
     written. I deleted it, and the rerun passed.

## Not verified

- **Live browser behaviour.** The brief forbids Lab, browser and Playwright runs, so
  the following are proven only with stand-ins:
  - the real `location.reload()`;
  - Chromium's `responseStatus` on the store's 429 page and after a reload;
  - the worker re-attaching after a same-address reload;
  - the store actually serving the retried page.
- Firefox: whether `responseStatus` is present, and therefore whether it takes the
  fallback path.
- Diff B was not compiled, and no domain test was run.
- An in-place (SPA) advance that loses the list is truncated but never retried,
  because there is no document status and no safe address to reload. It is untested.

## Open questions or contradictions found

1. **The brief's arithmetic is off by one.** "At most 2 retries, so one read can never
   cause the 3 refusals that flag a session": the first refusal plus two refused
   retries is 3, and so are three separate refusal episodes each retried once. So I
   kept both bounds: at most 2 reloads, **and** a stop at the read's second 429. In
   effect a 429 is retried once, and a 503 up to twice.
   - Known limit: a long read against a 5-per-8 s limiter meets a 429 about every 5
     pages, so after one recovery the next 429 ends it, truncated. The fix is to pace
     page advances after a first refusal. That is not implemented; it is a
     recommended follow-up.
2. **"A cut-short read is never reported as success" versus Do-2.** I did what Do-2
   specifies. The action stays `succeeded`, the summary says `truncated: true`, and the
   text says "the read is incomplete". Making the validation `failed` would change Flow
   semantics (repair loop, dataset storage), and the brief did not ask for it. The
   supervisor should decide whether the judge reading `truncated` is enough.
3. **The retry count does not reach bundles.** Carrying `pageRetries` to a bundle needs
   three changes: the domain summary member (Diff B could add it), Core's projection
   (`extraction-summary.ts`; Core is out of scope) and Diff A. Core should also add
   `rate_limited` to its `PAGINATION_STOPS` (`:86`), or Core will publish it as
   `unknown`. That is harmless, but it is less informative.
4. **Advisory.** `pagination.ts` now has 10 exported values. The refused-page policy
   (`:171-261`) would sit better in its own `content/extraction/refused-page.ts`
   module, but that is a new file outside my ownership.
5. **Test-file ownership.** I created two test files and extended one:
   `content/actions/tests/extract-list-refused-page.test.ts` (new, for `extract-list.ts`),
   `content/extraction/tests/list-reader-refused-page.test.ts` (new), and
   `shared/tests/extraction-continuation.test.ts` (extended). I read these as "their
   tests" of owned files. The brief names only the extraction files' tests.

## Diff A: lane carries `paginationStop` (test-contracts + test-runner; verified in overlay)

```diff
diff --git a/packages/test-contracts/src/extraction-read/read.ts b/packages/test-contracts/src/extraction-read/read.ts
--- a/packages/test-contracts/src/extraction-read/read.ts
+++ b/packages/test-contracts/src/extraction-read/read.ts
@@ -88,8 +88,29 @@ export type RunExtractionRead = {
   listWait?: RunExtractionListWait;
   /** What the read's `where` did to it, or absent for a read whose request named no conditions. */
   conditions?: RunExtractionConditionReport;
+  /**
+   * Why a read that paged stopped paging, in one closed word, or absent for a
+   * read that did not page. `truncated` beside it says whether the stop cut the
+   * read short: `list_vanished` and `rate_limited` are a page advance that lost
+   * the list, which live run `run-munnhi5q-4867dabe` answered as a complete read
+   * of four of five pages -- and a bundle could not say how that read ended.
+   */
+  paginationStop?: RunExtractionPaginationStop;
 };
 
+/**
+ * Why a paginated read stopped paging: the domain's closed set
+ * (`WebAutomationExtractionPaginationStop`), `rate_limited` ahead of it, and
+ * `unknown` for a word this contract has not been told about, on the rule
+ * `RUN_EXTRACTION_WAIT_STOP` states. Core's projection already publishes a word
+ * it does not know as `unknown`.
+ */
+export const RUN_EXTRACTION_PAGINATION_STOP = [
+  "control_absent", "control_disabled", "no_following_page", "scrolled_to_end", "list_vanished", "rate_limited",
+  "page_limit", "item_limit", "deadline", "list_unchanged", "page_repeated", "control_not_clickable", "page_fault", "unknown"
+] as const;
+export type RunExtractionPaginationStop = (typeof RUN_EXTRACTION_PAGINATION_STOP)[number];
+
 /** The two words a read uses for whether its `item` selector ever named an element on the page. */
 export const RUN_EXTRACTION_LIST_PRESENCE = ["appeared", "never_appeared"] as const;
 export type RunExtractionListPresence = (typeof RUN_EXTRACTION_LIST_PRESENCE)[number];
diff --git a/packages/test-contracts/src/extraction-read/validation.ts b/packages/test-contracts/src/extraction-read/validation.ts
--- a/packages/test-contracts/src/extraction-read/validation.ts
+++ b/packages/test-contracts/src/extraction-read/validation.ts
@@ -1,8 +1,8 @@
-import { RUN_EXTRACTION_LIST_PRESENCE, RUN_EXTRACTION_READ_BOUNDS, RUN_EXTRACTION_WAIT_STOP, type RunExtractionConditionReport, type RunExtractionListWait, type RunExtractionRead } from "./read.js";
+import { RUN_EXTRACTION_LIST_PRESENCE, RUN_EXTRACTION_PAGINATION_STOP, RUN_EXTRACTION_READ_BOUNDS, RUN_EXTRACTION_WAIT_STOP, type RunExtractionConditionReport, type RunExtractionListWait, type RunExtractionRead } from "./read.js";
 import { add, array, enumeration, finite, keys, object, result, uniqueStrings, type JsonObject } from "../runtime-validation.js";
 import type { ValidationIssue, ValidationResult } from "../validation.js";
 
-const readKeys = ["recordCount", "pagesRead", "truncated", "fieldNames", "missingFields", "itemsSeen", "emptyRecords", "listPresence", "listWait", "conditions"] as const satisfies readonly (keyof RunExtractionRead)[];
+const readKeys = ["recordCount", "pagesRead", "truncated", "fieldNames", "missingFields", "itemsSeen", "emptyRecords", "listPresence", "listWait", "conditions", "paginationStop"] as const satisfies readonly (keyof RunExtractionRead)[];
 const conditionKeys = ["applied", "kept", "rejected", "unfiltered"] as const satisfies readonly (keyof RunExtractionConditionReport)[];
 const waitKeys = ["stoppedOn", "waitedMs", "waitedFor"] as const satisfies readonly (keyof RunExtractionListWait)[];
 
@@ -74,6 +74,9 @@ export function validateRunExtractionRead(input: unknown): ValidationResult<RunE
     if (value.listPresence !== undefined) enumeration(value.listPresence, RUN_EXTRACTION_LIST_PRESENCE, "$.listPresence", issues);
     if (value.listWait !== undefined) checkListWait(value.listWait, "$.listWait", issues);
     if (value.conditions !== undefined) checkConditions(value.conditions, "$.conditions", issues);
+    // Absent for a read that did not page; one word from the set otherwise,
+    // `unknown` included, which the reader resolves a newer word to.
+    if (value.paginationStop !== undefined) enumeration(value.paginationStop, RUN_EXTRACTION_PAGINATION_STOP, "$.paginationStop", issues);
   }
   return result<RunExtractionRead>(input, issues);
 }
diff --git a/packages/test-contracts/tests/extraction-read.test.mjs b/packages/test-contracts/tests/extraction-read.test.mjs
--- a/packages/test-contracts/tests/extraction-read.test.mjs
+++ b/packages/test-contracts/tests/extraction-read.test.mjs
@@ -114,3 +114,13 @@ test("a count that is not a count, and a member nothing declared, are both refus
   assert.deepEqual(issuesOf({ ...read, itemSelector: ".product-card" }), ["$.itemSelector unknown property"], "the selector is the one thing this record must never hold");
   assert.deepEqual(issuesOf(null), ["$ must be an object"]);
 });
+
+// How a paginated read ended (`run-munnhi5q-4867dabe`: the everything store's
+// 429 page mid-pagination, answered as a complete read and unexplained in the bundle).
+test("a paginated read says how it ended, in one word from the set, unknown included", () => {
+  assert.deepEqual(issuesOf({ ...read, pagesRead: 4, truncated: true, paginationStop: "list_vanished" }), []);
+  assert.deepEqual(issuesOf({ ...read, pagesRead: 4, truncated: true, paginationStop: "rate_limited" }), []);
+  assert.deepEqual(issuesOf({ ...read, paginationStop: "unknown" }), []);
+  assert.ok(contracts.RUN_EXTRACTION_PAGINATION_STOP.includes("control_absent"));
+  assert.deepEqual(issuesOf({ ...read, paginationStop: "went for lunch" }).map((issue) => issue.split(" must")[0]), ["$.paginationStop"]);
+});
diff --git a/packages/test-runner/src/flow-lane/extraction-read.ts b/packages/test-runner/src/flow-lane/extraction-read.ts
--- a/packages/test-runner/src/flow-lane/extraction-read.ts
+++ b/packages/test-runner/src/flow-lane/extraction-read.ts
@@ -50,7 +50,7 @@
 // count into a string, so a malformed member still drops the read -- which is
 // also what keeps the *absence* of `listWait` meaning one thing, namely that the
 // read waited for no list of its own.
-import { isRunExtractionFieldKey, validateRunExtractionRead, RUN_EXTRACTION_LIST_PRESENCE, RUN_EXTRACTION_READ_BOUNDS, type RunExtractionConditionReport, type RunExtractionListPresence, type RunExtractionListWait, type RunExtractionRead, type RunExtractionWaitStop } from "@fluxiq-web-extension/test-contracts";
+import { isRunExtractionFieldKey, validateRunExtractionRead, RUN_EXTRACTION_LIST_PRESENCE, RUN_EXTRACTION_PAGINATION_STOP, RUN_EXTRACTION_READ_BOUNDS, type RunExtractionConditionReport, type RunExtractionListPresence, type RunExtractionListWait, type RunExtractionPaginationStop, type RunExtractionRead, type RunExtractionWaitStop } from "@fluxiq-web-extension/test-contracts";
 
 /** The four mechanisms a producer can name; a fifth becomes `"unknown"` rather than costing the read. */
 const KNOWN_WAIT_STOPS: readonly RunExtractionWaitStop[] = ["list_present", "page_settled", "window_elapsed", "deadline_passed"];
@@ -73,7 +73,7 @@ const KNOWN_WAIT_STOPS: readonly RunExtractionWaitStop[] = ["list_present", "pag
 export function extractionReadOf(attempt: Record<string, unknown>): RunExtractionRead | undefined {
   const summary = optionalRecord(optionalRecord(attempt.metadata)?.extraction);
   if (!summary) return undefined;
-  const { recordCount, pagesRead, truncated, fieldNames, missingFields, itemsSeen, emptyRecords, listPresence, listWait, conditions } = summary;
+  const { recordCount, pagesRead, truncated, fieldNames, missingFields, itemsSeen, emptyRecords, listPresence, listWait, conditions, paginationStop } = summary;
   if (!isCount(recordCount) || !isCount(pagesRead) || typeof truncated !== "boolean") return undefined;
   const declared = fieldKeys(fieldNames);
   const missing = fieldKeys(missingFields);
@@ -91,6 +91,12 @@ export function extractionReadOf(attempt: Record<string, unknown>): RunExtractio
   if (listWait !== undefined && wait === undefined) return undefined;
   const report = conditions === undefined ? undefined : conditionReportOf(conditions);
   if (conditions !== undefined && report === undefined) return undefined;
+  // How a paginated read ended, resolved as `stoppedOn` is: a word this reader
+  // does not know is `unknown`, and a member that is not a word drops the read.
+  // Until 2026-09-30 it was not carried at all, so a read that stopped on a
+  // rate-limit page read, in the bundle, like one that finished
+  // (`run-munnhi5q-4867dabe`).
+  if (paginationStop !== undefined && typeof paginationStop !== "string") return undefined;
   const read: RunExtractionRead = {
     recordCount,
     pagesRead,
@@ -102,6 +108,7 @@ export function extractionReadOf(attempt: Record<string, unknown>): RunExtractio
     ...(isListPresence(listPresence) ? { listPresence } : {}),
     ...(wait ? { listWait: wait } : {}),
     ...(report ? { conditions: report } : {}),
+    ...(typeof paginationStop === "string" ? { paginationStop: paginationStopOf(paginationStop) } : {}),
   };
   // The published contract's own check, run on the way in rather than asserted
   // in a test alone: a member this reader rebuilt wrongly is then absent from
@@ -131,6 +138,11 @@ function waitStopOf(value: string): RunExtractionWaitStop {
   return (KNOWN_WAIT_STOPS as readonly string[]).includes(value) ? value as RunExtractionWaitStop : "unknown";
 }
 
+/** The word the producer named for how paging stopped, or `"unknown"` for one this reader has not been told about. */
+function paginationStopOf(value: string): RunExtractionPaginationStop {
+  return (RUN_EXTRACTION_PAGINATION_STOP as readonly string[]).includes(value) ? value as RunExtractionPaginationStop : "unknown";
+}
+
 /** What the read's `where` did, in counts alone; `undefined` for a report that is not well formed. */
 function conditionReportOf(value: unknown): RunExtractionConditionReport | undefined {
   const report = optionalRecord(value);
diff --git a/packages/test-runner/src/flow-lane/tests/extraction-read.test.ts b/packages/test-runner/src/flow-lane/tests/extraction-read.test.ts
--- a/packages/test-runner/src/flow-lane/tests/extraction-read.test.ts
+++ b/packages/test-runner/src/flow-lane/tests/extraction-read.test.ts
@@ -310,3 +310,16 @@ test("every read reaches the bundle on its own attempt, including one no step ju
   // neither did the stop word this facility could not name.
   for (const secret of MUST_NOT_TRAVEL) assert.equal(written.includes(secret), false, secret);
 });
+
+// How a paginated read ended. Live run `run-munnhi5q-4867dabe` stopped on the
+// everything store's 429 page after four of five results pages; Core projected
+// `paginationStop` onto the attempt and this reader dropped it, so the bundle
+// could not say the read had lost its list rather than finished it.
+test("a paginated read's stop reaches the bundle beside truncated, and a word this reader does not know is unknown", () => {
+  const lost: RunExtractionRead = { ...FOUND, pagesRead: 4, truncated: true, paginationStop: "list_vanished" };
+  assert.deepEqual(extractionReadOf(attemptWith(lost)), lost);
+  assert.equal(extractionReadOf(attemptWith({ ...lost, paginationStop: "rate_limited" }))?.paginationStop, "rate_limited");
+  assert.equal(extractionReadOf(attemptWith({ ...lost, paginationStop: "a newer word" }))?.paginationStop, "unknown");
+  assert.equal(extractionReadOf(attemptWith({ ...lost, paginationStop: 7 })), undefined, "a member that is not a word drops the read");
+  assert.equal("paginationStop" in (extractionReadOf(attemptWith(FOUND)) ?? {}), false);
+});
```

## Diff B: the domain admits `rate_limited`, and the extension sends it (apply-checked only)

After applying it, also update the web-capabilities Pagination row. Its sentence "That
word becomes `rate_limited` once the domain's closed set admits it" should become "…
and `rate_limited` for a 429".

```diff
diff --git a/domain/src/actions/extraction/summary.ts b/domain/src/actions/extraction/summary.ts
--- a/domain/src/actions/extraction/summary.ts
+++ b/domain/src/actions/extraction/summary.ts
@@ -90,6 +90,12 @@ export type WebAutomationExtractionSummary = {
  *   page after the current one), `scrolled_to_end`, and `list_vanished` (the page
  *   a control led to showed no item of the list at all, and nothing to go on
  *   with);
+ * - the server: `rate_limited` (the page a control led to was refused as too
+ *   many requests, and still refused after the read waited and reloaded it, or
+ *   the read could not afford to). Either of these two words beside
+ *   `truncated: true` is a read cut short, never a complete one: live run
+ *   `run-munnhi5q-4867dabe` read four of five results pages, stopped on the
+ *   everything store's 429 page and answered `truncated: false`;
  * - the request's bounds: `page_limit` (`maxPages` or `maxScrolls`),
  *   `item_limit` (`maxItems`), and `deadline` (the command's `timeoutMs`);
  * - the page misbehaving: `list_unchanged` (the control was followed, and then
@@ -108,6 +114,7 @@ export type WebAutomationExtractionPaginationStop =
   | "no_following_page"
   | "scrolled_to_end"
   | "list_vanished"
+  | "rate_limited"
   | "page_limit"
   | "item_limit"
   | "deadline"
@@ -123,6 +130,7 @@ const PAGINATION_STOPS: readonly WebAutomationExtractionPaginationStop[] = [
   "no_following_page",
   "scrolled_to_end",
   "list_vanished",
+  "rate_limited",
   "page_limit",
   "item_limit",
   "deadline",
diff --git a/domain/src/actions/extraction/tests/summary-pagination-stop.test.ts b/domain/src/actions/extraction/tests/summary-pagination-stop.test.ts
--- a/domain/src/actions/extraction/tests/summary-pagination-stop.test.ts
+++ b/domain/src/actions/extraction/tests/summary-pagination-stop.test.ts
@@ -13,7 +13,7 @@ import { webAutomationExtractionSummaryValue } from "../summary";
 const SUMMARY = { recordCount: 12, pagesRead: 1, truncated: false, missingFields: [], fieldNames: ["title", "link"] };
 
 test("every stop word is copied as sent", () => {
-  const words = ["control_absent", "control_disabled", "no_following_page", "scrolled_to_end", "list_vanished", "page_limit", "item_limit", "deadline", "list_unchanged", "page_repeated", "control_not_clickable", "page_fault"];
+  const words = ["control_absent", "control_disabled", "no_following_page", "scrolled_to_end", "list_vanished", "rate_limited", "page_limit", "item_limit", "deadline", "list_unchanged", "page_repeated", "control_not_clickable", "page_fault"];
   for (const paginationStop of words) {
     assert.deepEqual(webAutomationExtractionSummaryValue({ ...SUMMARY, paginationStop }), { ...SUMMARY, paginationStop }, paginationStop);
   }
diff --git a/apps/extension/src/content/extraction/pagination.ts b/apps/extension/src/content/extraction/pagination.ts
--- a/apps/extension/src/content/extraction/pagination.ts
+++ b/apps/extension/src/content/extraction/pagination.ts
@@ -193,13 +193,8 @@ export type RefusedPageHost = {
 /** What the server's answer makes of a document a page advance reached: refused as too fast, refused as unavailable, or unexplained. */
 export type PageRefusal = "rate_limited" | "unavailable" | "unexplained";
 
-/**
- * The stop word for a read that met a 429 it could not wait out. `list_vanished`
- * until the domain's closed set (`WebAutomationExtractionPaginationStop`)
- * admits `rate_limited`, because a word outside that set drops the read's
- * whole summary; the outcome's `refusedStatus` says it was a 429 meanwhile.
- */
-export const RATE_LIMITED_STOP: PaginationStop = "list_vanished";
+/** The stop word for a read that met a 429 it could not wait out; the outcome's `refusedStatus` says which status. */
+export const RATE_LIMITED_STOP: PaginationStop = "rate_limited";
 
 /** Reloads one read may make of refused pages, across every document it reads. */
 export const MAX_PAGE_RETRIES = 2;
diff --git a/apps/extension/src/content/extraction/tests/list-reader-refused-page.test.ts b/apps/extension/src/content/extraction/tests/list-reader-refused-page.test.ts
--- a/apps/extension/src/content/extraction/tests/list-reader-refused-page.test.ts
+++ b/apps/extension/src/content/extraction/tests/list-reader-refused-page.test.ts
@@ -142,7 +142,7 @@ test("a 429 that never clears ends the read truncated, named, with every record
     assert.deepEqual(outcome.records, FOUR_PAGES.records, "the records already read are the answer");
     assert.equal(outcome.truncated, true);
     assert.equal(outcome.refusedStatus, 429);
-    assert.equal(outcome.paginationStop, "list_vanished", "the domain's word until it admits rate_limited");
+    assert.equal(outcome.paginationStop, "rate_limited");
     assert.equal(outcome.pageRetries, 1);
     assert.equal(outcome.pagesRead, 4);
     assert.equal(outcome.itemsSeen, 8);
```
