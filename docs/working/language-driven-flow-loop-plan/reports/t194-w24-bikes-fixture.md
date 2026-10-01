# t194-w24: local-classifieds-bike-search, fixture probe (no Lab, no model)

## Outcome

Partial, as the brief expected: the spec runs and every row passes or fails for a cause traced to file:line. **The product cannot produce the 12 rows today.** Two product gaps stand between it and the answer. Both are fixable in the content script, and the diffs are below. With the Try again batch retried by hand, the read built from the detected proposal plus the instruction's conditions returns exactly `bikeRecords()`. That covers every other trap on this task.

| # | Row (spec `apps/extension/e2e/content/tests/live-tasks/tests/local-classifieds-bike-search.spec.ts`) | Result | Cause |
|---|---|---|---|
| 1 | the radius chip inside the picker's shadow root opens with one click | FAIL | GAP 1 |
| 2 | the product's own actions walk the chain to the filtered, cheapest-first results | PASS | — |
| 3 | a literal read of the results returns the twelve bikes | FAIL (9 rows) | GAP 2 |
| 4 | a literal read that pages by scrolling returns the twelve bikes | FAIL (9 rows, `scrolled_to_end`) | GAP 2 |
| 5 | the detected proposal and the instruction's conditions read the twelve bikes through the evidence runtime | FAIL (9 rows) | GAP 2 |
| 6 | once the failed batch is retried, the proposal's read is exactly the answer | PASS | — |

When GAP 1 and GAP 2 are fixed, rows 1, 3, 4 and 5 should go green unchanged. They are the proving tests.

## What changed and why

- New: `apps/extension/e2e/content/tests/live-tasks/tests/local-classifieds-bike-search.spec.ts` (T2 content harness, 314 lines). It opens `local-classifieds` at its own seed (44). The task row sets no variant. Each step is a content-script action aimed the way a model's handle is aimed: the snapshot descriptor's selector and identity, plus `context.shadowHosts`, which the domain carries (`domain/src/runtime/llm-evidence/plan-resolution/element-identity.ts:89-104`, `target-packets.ts:152`). `page.*` only waits and observes. The answer is imported from `scenario-lab/.../local-classifieds/index.js` (`bikeRecords()`).
- Rows 5 and 6 drive the real domain evidence runtime (`createWebAutomationLlmEvidenceRuntime`) with scripted decisions, the same way `list-completeness.spec.ts` does. The flow is `detect_structure`, then `run_node web.output.dom-extract_list` with the handle, the four columns renamed to title/price/location/url, `where: [{field: "title", is: "present"}]` (sponsored cards have no title in the listing's place) and `dedupe: {by: ["url"]}`.
- No source, scenario, Core or other spec was touched.

## What works (observed)

Every one of these is a product action that returned `succeeded` with a passing validation:

- Cookie wall: "Allow all cookies".
- Bicycles category link (navigation). The content script re-announced itself on the new page.
- Timed notification prompt: "Not now".
- Radius select `10` inside the shadow root. Apply pressed twice: the first press is swallowed by the widget, and the chip then reads "Kelford · Within 10 mi".
- Min 100 + Enter and Max 400 + Enter.
- The folded "Item condition" toggle, then check New, Used – like new and Used – good.
- Sort combobox, then "Price: lowest first".
- The robot pause the 4th search trips. The click reported: `309 ms after the press the page put up a robot check that cleared by itself 2553 ms later, untouched`.
- The final address is `?radius=10&minPrice=100&maxPrice=400&itemCondition=new,used_like_new,used_good&sortBy=price_ascend`, and `/item/1045935841478603/` (£100) leads the feed.

Read traps disproved (they do not break the product), from row 6 and the probes:

- **Adverts excluded.** The proposal's title column (`div:3 > span.<title class>`, coverage 0.83) is absent on the two sponsored cards, so `where title present` drops both. The manifest's literal item `a[href*="/item/"]` drops them too.
- **Duplicate across batches.** "Folding bike, 16in…" is on the page twice. `dedupe by url` keeps it once (`order.duplicates: 1`).
- **"Results outside your search".** The proposed item is `main > section > div:nth-of-type(1) > div.<card>`, the first grid only. Outside listings are on the page and none is read.
- **Current price, not "was".** The proposal marks the current-price span as `(currency amount)` with coverage 1, and the struck `was` is a separate column with coverage 0.17. Ridgeline reads £240, not £300.
- **url.** The proposal's link column reads the absolute URL (`http://127.0.0.1:<port>/scenarios/...`). The judge accepts an absolute URL on the run's scenario origin as equal to the answer's path (`packages/test-runner/src/run-expectations/extraction/value-match.ts:18-52`), so this is not a gap. The spec compares paths for that reason.

What the detection proposes, recorded for the supervisor:

- `itemCount: 12` (the two batches drawn), `pagination: "none"` (no `infiniteScroll` flag), `confidence: 0.44`, 11 fields.
- The labels carry class names and positions only; the packet shows no values, by design (D3).

## Gaps

### GAP 1: a click on the radius chip opens the picker and immediately closes it again

- **Observed (row 1):** the validation says `"the point 101,388 landed on the target; the page ignored the first press, so it was pressed once more"`, and the panel is shut. Every further click repeats the open-then-close, so a model clicking the chip can never open the picker. Enter on the same handle opens it, and the chain falls back to that so the rest can be measured.
- **Cause:**
  - `apps/extension/src/content/action-runtime/ignored-press/page-press-listener.ts:94` observes `pressScope(pressed)` with `subtree: true`.
  - `press-scope.ts:27-35` walks out of the shadow root through the host to `<aside>`. A light-DOM subtree observation never sees mutations inside a shadow root.
  - The chip's answer is entirely inside `kf-location`'s root: `pop.hidden` flips and the chip's `aria-expanded` changes (scenario `client/location-element.ts:58-71`). It makes no request, does not navigate and does not move focus away.
  - So `click.ts:152` sees no sign at all, and `click.ts:160` presses again, which toggles the panel shut.
- **Smallest fix:** also observe every shadow root the scope walk crossed.

```diff
--- a/apps/extension/src/content/action-runtime/ignored-press/press-scope.ts
+++ b/apps/extension/src/content/action-runtime/ignored-press/press-scope.ts
@@
 export function pressScope(pressed: Element): Element {
   ...
 }
+
+/**
+ * The shadow roots between `pressed` and its scope. A subtree observation of
+ * the scope does not see into them, and a widget in its own root (a picker,
+ * a consent wall) answers a press entirely inside it.
+ */
+export function pressRoots(pressed: Element, scope: Element): Node[] {
+  const roots: Node[] = [];
+  for (let current: Element | null = pressed; current && current !== scope; current = composedParent(current)) {
+    const parent = current.parentNode;
+    if (!current.parentElement && parent && parent.nodeType === 11 && "host" in parent) roots.push(parent);
+  }
+  return roots;
+}
--- a/apps/extension/src/content/action-runtime/ignored-press/page-press-listener.ts
+++ b/apps/extension/src/content/action-runtime/ignored-press/page-press-listener.ts
@@
-import { pressScope } from "./press-scope";
+import { pressRoots, pressScope } from "./press-scope";
@@ function listenForChange(
-  observer.observe(pressScope(pressed), OBSERVED);
+  const scope = pressScope(pressed);
+  observer.observe(scope, OBSERVED);
+  for (const root of pressRoots(pressed, scope)) observer.observe(root, OBSERVED);
```

- **Proving tests:**
  - T2: row 1 of this spec should turn green.
  - T1, a new row in `action-runtime/ignored-press/tests/page-press-listener.test.ts`: in a fake page where the button's `parentNode` is a fake root (`nodeType: 11`, `host` = a node in `section`), with `parentElement: null`, assert that `mutations.observed` holds both `section` and the root.
- **Knock-on:** the widget's Apply. Its first press replaces the button inside the root. Today the second press is skipped only because the old element is detached and fails actionability (`click.ts:157-159`). After the fix it is skipped because the replacement is seen. The behavior is the same either way: the page swallowed the press, so the model must press Apply twice, as the manifest's script does.

### GAP 2: no read presses the feed's "Try again", so every read ends at 9 of 12 rows

- **Observed (rows 3, 4 and 5):**
  - Row 3, one-page literal read: `recordCount 9`, `listWait.stoppedOn: page_settled`, and "Try again" is still on the page.
  - Row 4, `paginate: {mode: "scroll", maxScrolls: 10}`: 9 rows, `paginationStop: "scrolled_to_end"`.
  - Row 5, the proposal read: 9 rows.
  - The missing rows are exactly #10 to #12 (Gravel £375, Carbon £395, Electric £400). At seed 44 the failing batch is index 2 (`catalog/feed.ts:40`). Its skeletons stay under the grid, with a `<span class="linkButton" tabindex="0">Try again</span>` that has no role (`client/feed-script.ts:59-64`).
  - Row 6 shows that one product click on that span loads the batch, after which the read is exact. The snapshot does list the span, as `span`, with no role and no accessible name, and visible text "Try again".
- **Cause:**
  - `apps/extension/src/content/extraction/list-wait.ts:109-119` (`awaitListComplete`, the reveal of a read with no `paginate`) stops as soon as a reveal brings nothing (`:113`, `:116`). It never looks for a retry.
  - `apps/extension/src/content/extraction/pagination.ts:448-461` (`scrollForMore`) ends at `:459` as `scrolled_to_end`, also without looking for one.
  - Only `loadMore` presses a Retry (`pagination.ts:433-446`). Even there, `load-retry.ts:37` `PRESSABLE` (`button, [role=button], a[href], input…`) excludes a bare focusable span, so `offeredLoadRetry` (`:46-58`) could not offer this one. The label rule (`:32`, the whole label "Try again") already matches.
- **Smallest fix:** offer the list's own retry and press it, bounded, wherever the read waits for the rest of a list.

```diff
--- a/apps/extension/src/content/extraction/load-retry.ts
+++ b/apps/extension/src/content/extraction/load-retry.ts
@@
-const PRESSABLE = 'button, [role="button"], a[href], input[type="button"], input[type="submit"]';
+// A focusable element with no role is how many feeds draw a link-styled
+// "Try again"; the whole-label rule below is what keeps it safe to press.
+const PRESSABLE = 'button, [role="button"], a[href], input[type="button"], input[type="submit"], [tabindex]:not([tabindex^="-"])';
@@
+/**
+ * The Retry a list put under itself after loading more of it failed: looked
+ * for beside the element that holds the whole run, as `offeredLoadRetry`
+ * looks beside a pressed control.
+ */
+export function offeredListRetry(items: readonly Element[]): HTMLElement | undefined {
+  const last = items[items.length - 1];
+  let container: Element | null = last?.parentElement ?? null;
+  while (container && items.length > 1 && !items.every((item) => container!.contains(item))) container = container.parentElement;
+  return container ? offeredLoadRetry(container) : undefined;
+}
--- a/apps/extension/src/content/extraction/list-wait.ts
+++ b/apps/extension/src/content/extraction/list-wait.ts
@@
+import { offeredListRetry } from "./load-retry";
@@
+/** At most this many times one read presses the Retry a failed part of its list offers, as `pagination.ts` presses a load-more's. */
+const LIST_LOAD_RETRIES = 2;
+/** How long a pressed Retry has to bring the part it reloads: a fetch, not a scroll. */
+const RETRY_GROWTH_WINDOW_MS = 5_000;
@@ export async function awaitListComplete(item: string, wanted: number, actionDeadline: number | undefined): Promise<ListCompletion> {
+  let retried = 0;
   for (let reveal = 0; reveal < LIST_REVEALS; reveal += 1) {
     const before = matchCount(item);
     if (before === 0 || before >= wanted) return "complete";
-    if (!revealListEnd(item)) return "complete";
-    const grew = await waitUntil(() => matchCount(item) > before, LIST_GROWTH_WINDOW_MS, LIST_GROWTH_POLL_MS, actionDeadline);
+    const moved = revealListEnd(item);
+    let grew: WaitOutcome = moved ? await waitUntil(() => matchCount(item) > before, LIST_GROWTH_WINDOW_MS, LIST_GROWTH_POLL_MS, actionDeadline) : "unchanged";
+    while (grew === "unchanged" && retried < LIST_LOAD_RETRIES) {
+      const retry = offeredListRetry(matches(item));
+      if (!retry) break;
+      retried += 1;
+      retry.click();
+      grew = await waitUntil(() => matchCount(item) > before, RETRY_GROWTH_WINDOW_MS, LIST_GROWTH_POLL_MS, actionDeadline);
+    }
     if (grew === "timed_out") return "timed_out";
     if (grew === "unchanged") return "complete";
   }
--- a/apps/extension/src/content/extraction/pagination.ts
+++ b/apps/extension/src/content/extraction/pagination.ts
@@
-import { offeredLoadRetry } from "./load-retry";
+import { offeredListRetry, offeredLoadRetry } from "./load-retry";
@@ async function scrollForMore(paginate: ScrollPagination, progress: PaginationProgress): Promise<PageAdvance> {
   const bound = paginationBound(paginate);
   const scroller = scrollerOf(progress.shown[0]);
+  let retried = 0;
   for (;;) {
@@
     if (outcome === "changed") return ADVANCED;
     if (outcome === "timed_out") return TIMED_OUT;
+    const retry = retried < LOAD_RETRIES ? offeredListRetry(progress.shown) : undefined;
+    if (retry) {
+      retried += 1;
+      retry.click();
+      const reloaded = await waitUntil(() => progress.hasUnreadItem(), LIST_CHANGE_TIMEOUT_MS, SCROLL_POLL_MS, progress.deadline);
+      if (reloaded === "changed") return ADVANCED;
+      if (reloaded === "timed_out") return TIMED_OUT;
+      continue;
+    }
     if (atBottom(scroller)) return ended("scrolled_to_end");
```

- **Proving tests:**
  - T2: rows 3, 4 and 5 of this spec should turn green. All three read the real feed, whose batch fails once per session.
  - T1, `extraction/tests/load-retry.test.ts`, which today tests only `isLoadRetryLabel`: a row that a bare `span[tabindex="0"]` labelled "Try again" beside the list's container is offered, and a `tabindex="-1"` one is not. That needs a small fake element tree, in the style of the ignored-press tests.
  - It is also worth adding a `list-wait` T1 row: a list whose reveal brings nothing, with a Retry offered, is pressed at most twice.
- **Why it matters beyond this run:** the batch fails "the first time it is asked for" per session, so a saved Flow replayed in a fresh session meets the failure again. A model pressing Try again during authoring would not make the Flow's read complete on replay. The read itself has to handle it.

## Observations that are not gaps

- **The heading's name includes its arrow.** The snapshot names the folded heading "Item condition▾": `content/identity/accessible-name.ts:96-98` `nameFromContent` includes the `aria-hidden` arrow glyph. The handle still resolves uniquely, so the spec uses the name as shown. This is cosmetic and was not pursued.
- **The packet says "none" for an infinite feed.** The structure packet reports `pagination: "none"`. The read still reaches the later batches through the one-page reveal (once GAP 2 is fixed). A model that writes `paginate: scroll` also reaches them.
- **Model-side, not product:**
  - A read without `dedupe` keeps the repeated card. Plain one-page reads dedupe only across pages (`domain/src/actions/extraction/request.ts`, "A row is read once across pages"). The instruction's "List each bike once" must become `dedupe`.
  - Apply must be pressed twice.
  - The product's first Apply click reports `succeeded` although the widget swallowed it. It did land; nothing on the page says it was refused.

## Commands run and observed results

- The Core libs log (`.../scratchpad/t194s5/core-libs.log`) ended with `rc=0` before any run.
- Final run: `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w24 t2" pnpm --filter @fluxiq-web-extension/extension test:content -- e2e/content/tests/live-tasks/tests/local-classifieds-bike-search.spec.ts --reporter=list --output=e2e/test-results/t194-w24`. It printed `4 failed, 2 passed (1.2m)`:
  - `ok` for "walk the chain" (16.4s) and for "once the failed batch is retried…" (17.5s).
  - `x` for "radius chip … one click": `Received string: "...landed on the target; the page ignored the first press, so it was pressed once more"`.
  - `x` for "literal read": `read 9 rows; "Try again" on the page: 1`.
  - `x` for "pages by scrolling": `read 9 rows, stop scrolled_to_end`.
  - `x` for "detected proposal …": `read 9 rows`.
- The same split was seen on the previous full run, after the duplicate assertion was moved out of row 2. Row 2's one-batch-only observation is timing-dependent, so the duplicate is asserted in row 6.
- `npx tsc -p tsconfig.test.json --noEmit` in `apps/extension` (heavy slot): rc=0, 0 errors.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (140 warning(s), 118 baselined)`. No warning names this spec.
- Probe runs (console output, since removed from the spec) are the source of:
  - the detection JSON;
  - the packet without values;
  - the extract_list request the runtime dispatched, which is literal with a resolved `where.read`, `dedupe: {by: ["url"]}` and `rejectedSamples: true`;
  - the snapshot entry for "Try again" (`span`, no role, `main > section > div:nth-of-type(3) > span:nth-of-type(2)`).

## Not verified

- The proposed diffs were neither applied nor run. Their effect on rows 1, 3, 4 and 5 is a prediction, not an observation.
- In particular, the 5 s retry window (feed latency is 250–500 ms plus the fetch) and the broadened `PRESSABLE` were not run against the other specs that use `offeredLoadRetry` (Guildline's invitation manager).
- The list-layout and location-check variants of this task were not exercised. The brief's task row sets no variant.
- Nothing here exercises the background worker, the frame merge, or delivery between extension contexts (a T2 limit).
- Concurrency with the other three lanes' T2 runs is unknown.

## Open questions or contradictions found

- The comment in `shadow-root-controls.spec.ts` says a model's handle carries "no host chain, because the packet's element identity has no field for one". The domain now carries `context.shadowHosts` (`element-identity.ts:89-95`). Without the chain, the chip's handle (`div:nth-of-type(1)`) failed `Target ambiguous: … matched 27 elements`; with it, the handle resolved. The spec follows the current domain. That comment looks stale.
- `manifest.ts:100-103` says "the grammar has no way to leave out a card the feed sent twice, and neither has FluxIQ's list extraction". That is no longer true: `dedupe: {by: ["url"]}` reads it once (`order.duplicates: 1`). The note is stale. It is in scenario-lab, which this brief does not own.
