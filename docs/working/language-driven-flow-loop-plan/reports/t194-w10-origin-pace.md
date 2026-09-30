# t194-w10: one per-origin pace for the page loads FluxIQ causes

Worker report. Tree: `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQWebExtension`, branch
`task/t194-live-judge-answer`. Defect from live run `run-muntc23v-7fcc4110` (everything-store).
The build gate (`"step":"total"` in `run06.log`) had already passed before the first edit.

## Outcome

**Done.** All four items are implemented and the checks the brief names pass. One file I
edited, `apps/extension/src/runtime/command-router.ts` (+5 lines), is outside the literal
list of owned files. I took it to be "the navigate path under `runtime/`", because every
command Core sends, navigations included, enters there. The reason is under Open questions 1.

## Cause, with file:line (tree before this change)

- Nothing that outlives a document knew when a site last loaded. Each read began from
  nothing:
  - `content/extraction/pagination.ts` `followNext` / `visitNumberedPage` (HEAD `:289-299`,
    `:353-361`) clicked as soon as the deadline allowed.
  - The runtime's navigate (`runtime/action-runner.ts:68-94`) drove the tab at once.
  - The t194-w5 wait (`pagination.ts:220` `FIRST_RETRY_WAIT_MS`, `refusedPageWaitMs`) lives
    in one read's checkpoint (`refusals`), so the next read starts again at zero refusals
    spent.
- The evidence (`core.log` lines 33-62): reruns `rerun.6` through `rerun.12` of about 11 s
  each, with only 1.3-3 s of model time between them. Each rerun is a reset navigation plus
  four `next` loads.
- The store's limiter (`everything-store/state/throttle.ts:16-21`) refuses a load when five
  others were served in the 8 s before it. It flags the session at its third refusal
  (`route.ts:36-45`). Loads at natural read speed, with no gap kept across read boundaries,
  put a sixth load into a window. The 429 came at 08:03:51 inside `rerun.10`.

## Design

The pace lives in the worker (`apps/extension/src/background/page-pace/`). It is one
`OriginPace`, `SESSION_PAGE_LOAD_PACE`, for the worker's life, keyed by origin.

- **`origin-pace.ts`** (pure, with an injected clock):
  - `reserve(origin)` books the next load and returns the wait. It is 0 for the first load,
    and otherwise the time until `spacingMs` after the previous booking's start.
  - `noteRefusal(origin, status)` acts on 429 or 503 only. It holds the next load until
    `refusalWaitMs` after the refusal was seen, and doubles the origin's spacing up to
    `cooledSpacingCapMs`, permanently.
  - Other origins are untouched. Other statuses change nothing.
- **Pagination loads (the page does the waiting).**
  - Before `followNext` or `visitNumberedPage` clicks, `awaitPageLoadTurn(deadline)`
    (`pagination.ts`) sends `{ type: "fluxiq.pageLoad.pace", kind: "load" }`. The
    `BROWSER_PAGE_HOST.reload()` of a refused page sends the same message first.
  - The page waits `min(answer, cap 30 s, time to the deadline)`. It re-checks the deadline
    (answering `timed_out` as any deadline does), then checkpoints and clicks.
  - The worker answers from `withPagePace` (`paced-page-loads.ts`). It is installed by
    `action-runner.ts` `sendAction` around `sendExtractListAcrossDocuments`, and filters on
    the read's own tab and frame. It takes the origin from `sender.url`, so the page sends
    no address and no text.
- **The answer is synchronous; the page sleeps.** A worker listener that waited before
  replying would lose the race to `background/index.ts`'s catch-all
  `{ ok: false, error: "Unknown FluxIQ extension message." }`. The first `sendResponse` wins,
  and the page would then not wait at all.
- **Refusals.** `BROWSER_PAGE_HOST.status()` reads the navigation entry's `responseStatus`
  (a status, never page text). When it is 429 or 503, it tells the pace
  `{ kind: "refused", status }`, once per document.
  - This covers the w5 path where the read retries.
  - It also covers the path where the read stops at its second 429 without reloading, which
    is exactly the refusal the next read must learn from.
- **Navigations.**
  - `runBrowserActionCommand` calls `paceNavigation` before `resolveAutomationTab` drives
    the tab, and the worker itself waits.
  - `web.browser.navigate` is also the dry-run reset, so it is paced.
  - A non-http(s) destination is not paced.
- **Opt-in by request.** `BrowserActionRunRequest.pace` is optional.
  - `command-router.ts` passes `SESSION_PAGE_LOAD_PACE` for every command from Core.
  - A caller without one (unit tests, `background/extraction/deps.ts` preview) is unpaced.
  - Defaulting inside the runner would have made `navigate-action.test.ts`'s 11 same-origin
    navigations wait about 2.5 s each.
- **Recorded in the result.** `withPaceNote` (`paced-result.ts`) appends one clause to
  `validation.actual`, only when the pace held a load or was told of a refusal. Example:
  `…; FluxIQ spaced its page loads on this site, waiting before 2 of 3 loads (9.8 s in all);
  the site refused 1 load, so FluxIQ now keeps 5.0 s between its loads there`. It contains
  counts and seconds, no address.
- **The message.** `PAGE_LOAD_PACE_MESSAGE`, `PageLoadPaceMessage` and `PageLoadPaceAnswer`
  are in `shared/protocol.ts`. The page imports only the types (so the content bundle
  gains no protocol values), and the literal is type-checked against them.

## Numbers and why (`pace-settings.ts`)

- **`spacingMs` 2,500.**
  - A load is refused only if five served loads fall inside `(t-8 s, t]`, and any spacing
    of 1.6 s or more prevents that. At 2.5 s at most three paced loads precede any load in a
    window, which leaves room for two loads FluxIQ does not pace (a search-submitting
    click, a redirect).
  - Live reads ran about 2.2-2.7 s per load (five pages in about 11 s), so an ordinary
    five-page read waits at most about 0.3 s per page. The test pins this at 2.2 s per page:
    1.2 s in all.
  - A site whose loads are already 2.5 s or more apart never waits.
- **`refusalWaitMs` 8,500.**
  - Nothing more loads on the origin for longer than the 8 s window, measured from when the
    refusal was seen.
  - It equals the page's own `FIRST_RETRY_WAIT_MS`, so the w5 reload that follows its 8.5 s
    pause is not held a second time. The worker's extra wait is about 0.
- **`cooledSpacingCapMs` 8,000.**
  - The spacing goes 2.5 s → 5 s → 8 s, and stays there for the worker's life.
  - At 5 s only one paced load precedes any load in a window. 8 s is the window itself, and
    slower only makes reads time out.

## Tests (all new; every one fails with the fix removed)

- `background/page-pace/tests/origin-pace.test.ts` (6 tests):
  - spacing on one origin;
  - no spacing across origins;
  - an origin that never refuses keeps 2.5 s and never waits when its loads are 3 s apart;
  - statuses 200, 204, 301, 404 and 500 are not refusals;
  - an ordinary five-page read waits 1.2 s or less;
  - a 429 holds the next load 8.5 s and doubles the spacing, capped at 8 s, and it is still
    in force an hour later;
  - a refusal on one origin leaves another alone.
- `background/page-pace/tests/store-limiter-reads.test.ts` (2 tests). A simulated limiter (5
  per 8 s, refused loads not counted, flagged at 3), with reads modelled on the extension:
  a paced reset navigation, then four paced `next` loads 300 ms apart; a 429 is told to the
  pace, waited 8.5 s and reloaded through the pace; the read stops at its second 429.
  Twenty reads, meaning ten plus a replay of each.
  1. Paced: 0 refusals and never flagged. Unpaced, the same run is flagged.
  2. The same run plus a load FluxIQ does not make every 4 s. Paced: 1 refusal, never
     flagged, and the origin ends at 5 s spacing. The same pace with the cool-down removed
     is flagged, and so is the unpaced run.
- `background/page-pace/tests/paced-page-loads.test.ts` (5 tests):
  - the listener answers the read's own tab and frame at once, with the wait, keyed by
    origin and not path;
  - it ignores other tabs, other frames and other message types;
  - refused 429 slows the origin; refused 200 does not;
  - the listener is removed even when the read throws;
  - `paceNavigation` waits in the worker, lets another origin go at once, and does not pace
    `chrome://`;
  - the `withPaceNote` text is exact, and the result is unchanged when nothing was held.
- `content/extraction/tests/pagination-pace.test.ts` (3 tests; a new file, see Open
  questions 2):
  - the page sends exactly `{ type, kind: "load" }` and waits the answer;
  - the wait is cut to the deadline and to 30 s;
  - `{ ok: false }`, "Receiving end does not exist", NaN and no `chrome` each mean no wait.

Mutation runs, using a scratch runner that bundled only these four files. The mutations were
made in `origin-pace.ts` and then restored; `diff` against the backup was empty.

- `reserve` returns 0 (no pace): 8 of 16 tests fail, including both simulations.
- `noteRefusal` is a no-op (no cool-down): 3 fail, including simulation 2, whose session was
  flagged with 3 refusals.
- Every status counts as a refusal: 2 fail, including the "never refuses" test.
- Spacing starts at 5 s: 5 fail, including "ordinary read" (waited 11.2 s).

## Commands run and observed results

- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w10 ext" pnpm --filter @fluxiq-web-extension/extension test`
  (whole suite, run twice, the second time after the final test edit): exit 0,
  `# tests 1371`, `# pass 1371`, `# fail 0`, `# cancelled 0`. The 16 new tests appear as
  `ok 298`-`ok 310` and `ok 749`-`ok 751`.
- `bash …/heavy.sh "t194-w10 check" pnpm --filter @fluxiq-web-extension/extension check`:
  exit 0 (`extension:check` rebuilt, 86,608 ms).
- `node scripts/structure-audit.mjs`: `structure-audit: passed (126 warning(s), 120 baselined).`
  - The first run failed `[failure-as-empty]` at `pagination.ts:301`, because the pace
    client returned `undefined` from a catch. It was reworked to answer a wait in
    milliseconds (0 means none) and then passed.
  - The new warnings on my files are all advisory: `pagination.ts` has 11 exported values
    (advisory 8) and 659 lines (advisory 400); `action-runner.ts` has 496 lines; `protocol.ts`
    has 768 lines.
- `npx tsc -p apps/extension/tsconfig.json --noEmit`: no output.

## Not verified

- No Lab or browser run, as the brief requires. The live behaviour has not been observed:
  - that `sender.url` carries the content script's document address in Chrome/Edge and in
    Firefox;
  - that the synchronous pace answer beats `background/index.ts`'s catch-all in a real
    worker;
  - that the store is no longer flagged.
- The content harness (`test:content`, Playwright) was not run, so `followNext` and
  `visitNumberedPage` actually waiting before the click is proven only by reading the code.
  The node tests cover `awaitPageLoadTurn` itself.
- A 429 on a navigation, as opposed to a pagination load, is not told to the pace. Nothing
  on the navigate path reads the landed document's status, and adding that needs
  `landed-challenge.ts` or a content handler, neither of which I own. Such a refusal is still
  prevented by the spacing, but it does not slow the origin.
- Loads FluxIQ causes by other actions (a `web.dom.click` that submits a search, a
  `loadMore` or `scroll` fetch) are not paced or counted. The 2.5 s spacing leaves room for
  two of them per window; simulation 2 covers one every 4 s.
- The pace is in worker memory. A worker the browser restarts starts a fresh pace and loses
  a cooled origin. The connection's socket normally keeps the worker alive during a run.
- The extraction preview (`background/extraction/deps.ts`) calls the runner without a pace,
  so its reads are unpaced.

## Open questions or contradictions found

1. **`runtime/command-router.ts` edit (+5 lines)**. It sets `pace: SESSION_PAGE_LOAD_PACE`
   on every Core command. If the supervisor reads ownership strictly, the alternative is to
   default `request.pace` inside `action-runner.ts`. That would make unit tests of
   same-origin navigations wait in real time (about 25 s extra in `navigate-action.test.ts`)
   unless those tests passed a pace, and they are not mine.
2. **New test file `content/extraction/tests/pagination-pace.test.ts`**. It is the test of
   owned `pagination.ts`, placed where the placement rule requires. It is additive, and
   nobody else's file.
3. **Trade-off to know.** After one refusal an origin is paced at 5 s for good, so a 5-page
   read there takes about 20 s of spacing alone. A read with a short `timeoutMs` may end
   `timed_out` rather than load early. That is the intended direction (never a third
   refusal), but the supervisor may want the domain's read budget checked against it.
4. The pace waits spend the read's `timeoutMs`: the wait is inside the command. The worker
   books a slot even when the page then times out before loading, which only makes the next
   load later.
