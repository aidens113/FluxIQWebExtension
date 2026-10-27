# t758 store-wheel: can the everything-store deal-wheel gate run count?

Worker report, brief t758/store-wheel (investigation, read-only). Trees: `fxwork/t758` (current dev).

## Outcome

**Not viable as-is. It needs a fixture change, and probably a product fix as well.**

- **What decides it is the Flow's shape and its timing, not chance in the model.** The wheel opens about 1.6 s after
  each results page starts loading. Of the verbs a Flow uses, only click and type check whether the page is inert.
  Scroll, `extract_list`, `next_page` and load-more read or act through the wheel. Two cases follow:
  - **The Flow reaches the Plus page by address.** This is what the proxy Flow did with its search URL. Nothing ever
    meets the wheel. The run ends with the wheel up, so the oracle fails on `wheel-closed`, and the gate records
    `no_recovery_attempted`.
  - **The Flow presses the Plus filter.** It meets the wheel only if the press lands more than about 1.6 s after the
    first results page loads. A Playwright press made right after the results hydrated landed at about 0.96 s and beat
    the wheel.
- **When a press or type does meet the wheel, the chain that would count already exists.** The press is refused as
  inert. The in-page defence presses "No thanks, I would rather pay full price". The closed layer is recorded with its
  names, and t516 learns a guarded handler from it with no model call.

## 1. When the wheel opens and what it blocks

- **Armed by** `state.mode === "deal-wheel" && nudges.dealWheel === "pending" && page.organic.length > 0`
  (`pages/results/search.ts:43`).
  - The nudge stays `pending` until the shopper declines the wheel, or spins it and then presses Continue
    (`client/search-script.ts:106-117`, `state/guard-ops.ts:39-41`).
  - So the wheel opens on **every** results page with results until it is answered, not only the first one. The
    comments at `first-page.ts:56` and `state/types.ts:12` say "the first results page".
  - The home page and the soft-check page never show it. `set-mode` recreates the store state (`state/mutate.ts:22-24`),
    so an armed run also meets the soft check first (`route.ts:50`).
- **Trigger:** `setTimeout(openWheel, STORE_TIMINGS.dealWheel)` (`search-script.ts:119`), with `dealWheel: 1500`
  (`client/timings.ts:29`), timed from when the page script runs.
  - Measured (probe A/B/D): the wheel attaches **1596-1668 ms after navigation**, on the first results page and again
    on the `&rh=plus` page. The results hydrate at about 950-1160 ms.
  - If another modal is open, the wheel retries every second (`search-script.ts:97`). The notifications prompt opens
    at 4 s, so it never gets in the wheel's way. It does open after the wheel is answered.
- **What it makes inert:** `openModal` sets `pageRoot.inert = true` (`client/shell-script.ts:60-64`). `pageRoot` is
  `#<ids.root>`, which wraps the whole store page (`pages/shell.ts:52`).
  - The wheel is a `role="dialog" aria-modal="true"` inside a fixed full-viewport scrim at `z-index:80`
    (`style/stylesheet.ts:52`), appended to `body` outside the root.
  - There is no focus trap beyond `inert`.
  - Its way out is a `<p data-decline>`, not a button (`search-script.ts:104`).
- **Probe B, every control behind the wheel:**
  - The search box, the Go button, the Plus link, the result titles and the result count all have `inert` true.
  - `[data-decline]` is not inert and is hit-tested as itself.
  - `focus()` on the search box does not take.
  - A trusted mouse press at the centre of the Plus link does nothing (probe C).
- **Which honest steps it blocks:**
  - **Typing and Go:** only when done on a results page after the wheel opens. The usual search is made from the home
    page, before the wheel.
  - **The Plus filter press:** blocked only if it lands after about 1.6 s on the first results page.
  - **Reading the first page:** not blocked. A person's mouse wheel still scrolls the page under the scrim, the lazy
    results load, and all 16 organic cards are present with the wheel up (probe D: scrollY 610 -> 3754, 16 cards).

## 2. What the extension does under the open layer

- **Click and type are refused before anything is dispatched.**
  - The gate's `hiddenReason` checks for an inert ancestor first: `"the element is inert"` gives `hidden`
    (`action-runtime/actionability.ts:140`). The refusal is at `actions/click.ts:238-240` and `actions/type.ts:68-70`.
  - The code is TARGET_NOT_SHOWN. Recovery reads it as an obstruction (`recovery/fault.ts:182`), and every verb
    absorbs that.
  - `recovery/attempt.ts:154` then calls `pressWaysOut`, through `actions/execute.ts:177`.
  - The way out is "No thanks, I would rather pay full price". It is admitted by `DISMISS_LABEL`
    (`interference/vocabulary.ts:84`), and `pay` is deliberately not a denied word (`interference/consequential-word.ts`).
  - The verb then runs again. `clearedLayers` (kind, name, controlName, wayOut) goes on the result
    (`recovery/record.ts:58`), and the domain lifts it to Core (`domain/src/io/gateway-output-dispatcher.ts:72`).
  - On the verified success, Core's t516 path proposes, with no model call, a handler run before the step:
    `add_handler before <step>, when dialog visible "Spin to win up to 20% off!"`. That gives P2-P4.
  - The existing content-harness row shows this chain end to end for a type made under the wheel
    (`apps/extension/e2e/content/tests/dialog-dismissal.spec.ts:99-124`). I did not run it, because it needs the
    content build.
  - The model is not consulted on this path. Core's ladder or the model is reached only if in-page recovery runs out.
- **Scroll never refuses.** It reads the gate only to describe what it saw (`actions/scroll.ts:36-46`, `:159`). A window
  scroll moves the inert page and triggers the lazy load (probe A).
- **Reads read under the layer without saying so.**
  - `extract_list` has no layer, inert or actionability check (`actions/extract-list.ts:96-122`; no match in
    `extraction/*.ts`).
  - Probe A: all 16 organic cards were read with the wheel up.
  - pf-replays: 24/24 actions succeeded and `wheel-closed` did not hold.
- **The pager and load-more act through the layer.**
  - `afterListChange` presses with `control.click()` (`extraction/page-advance/list-change.ts:146`) and falls back to
    `window.location.assign` (`:98`). `load-more.ts:55` does the same.
  - Probe B: a synthetic click on the inert Plus link navigated it. A trusted click did not.
  - The proxy replay's four `next_page` moves (0.9-2.1 s each) all succeeded across pages that each had the wheel up.
  - So these are presses a person could not make, reported as moves. The page did move, so this is not a false
    success, but it gets around the layer without a word.

## 3. The instruction against the oracle

- **The instruction** (`live-tasks.ts:7`, used at `:54-62`) never mentions a promotion or closing anything.
- **The variant's oracle** checks `wheel-closed` (`deal-wheel exists false`, `first-page.ts:91`), together with the
  result count and the not-challenged fact.
- **A person on the natural path does close the wheel.** It is up before they can find the Plus filter, and they cannot
  press anything under it (probe C). Once declined, it never returns (`honest-paths.test.ts:43-62`).
- **A run that reads the right 16 records can still fail the oracle.** That happens when the run reaches the Plus page
  by address, or presses within 1.6 s: a person can scroll and read under the wheel (probe D), and the Flow can too.
  So **the oracle checks a fact the instruction does not ask for**, which is against AGENTS.md's realistic-task rule.
- **The wheel-closed fact also does work the gate needs.** It is the only thing that tells a run that handled the
  interruption from one that read through it.

## 4. Verdict and minimal changes

**Verdict: needs a fixture change (required) and a product fix (needed for a Flow that does not press on a results
page).**

### A. Fixture change, everything-store, downstream scenario-lab

Open the wheel as the results page renders, not 1.5 s later. In `client/search-script.ts:119`, call `openWheel()`
synchronously, or render the scrim in the page's HTML. Drop or zero `dealWheel` in `client/timings.ts:14,29`. Reword
`workflows/first-page.ts:55-57,86` and `state/types.ts:12-13`: "as the results page loads" and "every results page
until it is answered".

This keeps the intent: a new popup, met by a Flow built without it. It makes two things certain:

- every press or type on a results page meets the wheel, so the Plus-filter press is always refused as inert and the
  defence closes the wheel;
- t516's handler, which runs before the step with no leading wait, finds the wheel already visible when it replays.
  At 1.5 s the replay would be the same race again.

Fail-first test, in `everything-store/tests/` beside `honest-paths.test.ts`:

1. Arm `deal-wheel`, search, and wait for `[data-component="search-result"][data-sku][data-index="1"]`.
2. Assert at once that `[data-testid="deal-wheel"]` exists and the root is inert.
3. Then make a trusted press of the "Brightaisle Plus" link and assert that the URL did not change.

Today it fails: the cards come at about 0.95 s and the wheel at about 1.6 s. The `honest-paths` deal-wheel row must
still pass.

### B. Product fix in the extension, a separate brief

For a Flow that reaches the Plus page by address (likely: the proxy Flow navigated straight to its search URL), the
fixture change alone is not enough, because no gated verb ever runs.

**Minimal fix:** `extract_list` refuses before it reads when the list's items lie under an `[inert]` ancestor, using
the same words as the gate (`hidden: the element is inert`, TARGET_NOT_SHOWN, decided before anything was read). The
existing obstruction recovery then clears the page wall and reads again. The result carries `clearedLayers`, and t516
learns a handler before the extract step.

- Owning files: `apps/extension/src/content/actions/extract-list.ts`, or the extraction entry it calls.
- The same rule should apply to the pager and load-more presses (`list-change.ts:146`, `load-more.ts:55`): refuse an
  inert control before dispatching, instead of calling `click()` or `location.assign` through the layer.

**Fail-first tests:**

- **Unit:** a list under `#root[inert]`, with an `aria-modal` dialog whose "No thanks" is a leaf `<p>`. Today
  `extract_list` succeeds with no `clearedLayers` and the dialog still up. After the fix it succeeds with
  `clearedLayers[0].name` set to the dialog's name and the dialog gone.
- **Content harness:** add a row to `dialog-dismissal.spec.ts`: `extract_list` on
  `s?k=wireless+earbuds&rh=plus` under the wheel closes the wheel and returns 16 organic rows.

**This is a product policy, and the supervisor or the user should confirm it.** Probe D shows a person can still read
under this wheel, so reading through it is not strictly a false success. The argument for the fix is that the page
declared its content inert.

### C. Not recommended

- **Dropping `wheel-closed`.** A run that reads through the wheel then passes the oracle, but the gate classifies it
  `no_recovery_attempted` (`packages/test-runner/src/run-evaluation/adaptation/gate.ts:91,94`), so the paid run is
  still wasted.
- **Locking page scroll while the wheel is up.** That would make the person's path require closing the wheel, but the
  extension's programmatic `scrollTo` would still read through it.

Nothing here lands in Core's flow-bootstrap, site-reset, reset, project-build, supervisor or dispatch.

## Commands run and observed results

- **`node <scratchpad>/wheel-probe.mjs`**, headed Chromium against `apps/scenario-lab/dist` (built 14:07, source
  14:06), with a lab of its own and `set-mode deal-wheel`:
  - **A:** the results hydrated at 962 ms; a Plus press made right away succeeded with no wheel. On the Plus page the
    wheel attached at 1596 ms. After a window scroll there were 16 organic cards and the wheel was still up.
  - **B:** the wheel attached at 1603 ms. The `inert` element was the root `DIV#:r1i9fz:`. The search box, Go, the Plus
    link, the result titles and the count were all `inert: true`. `[data-decline]` was not inert and was hit-tested as
    itself. `focus()` on the search box gave `false`. A synthetic `dispatchEvent(click)` on the inert Plus link
    navigated to `...&rh=plus`. The nudges stayed `dealWheel: pending`.
  - **C:** a trusted `mouse.click` at the link's centre did not navigate, and the wheel stayed up.
- **`node <scratchpad>/wheel-probe.mjs --only-d`:** on the Plus page by address, the wheel attached at 1668 ms. Mouse
  wheel under the scrim moved scrollY from 610 to 3754, there were 16 organic cards, and the wheel stayed up.
- **`EXTENSION_TEST_BUILD_LABEL=t758-store-wheel node scripts/test-extension.mjs`** with `interference/tests/vocabulary`,
  `interference/tests/press-ways-out` and `tests/actionability`: `# tests 31 # pass 31 # fail 0`.
- **The proxy receipt `test-runs/instances/t758-pf-replay/replays/replay-mvr9datd-5138e3d9.json`:** navigate took
  9919 ms (the soft check), each `extract_list` 3.5-5.5 s, and each `next_page` 0.9-2.1 s. All succeeded, so the
  wheel was up during the reads and pager presses after the first page.

The scratchpad is `C:\Users\osrs_\AppData\Local\Temp\claude\c--Users-osrs--FluxStuff--FluxIQWebExtension\b969a395-6436-4284-bccb-432f7f43683b\scratchpad`.

## Not verified

- **No gate Flow exists**, so whether a built first-page Flow presses the Plus filter or goes to `&rh=plus` by address
  is not known.
- **How fast playback presses** after the soft-check reload, compared with the wheel's 1.6 s, was not measured. There
  was no live Lab run and no `pnpm lab`.
- **The content-harness wheel row** (`dialog-dismissal.spec.ts:99`) and Core's t516 learning on a live run were not run
  by me. Their claims come from code and earlier reports.
- **Whether the gate run keeps adaptations** was not checked. t516 learning is off in training mode, where
  `createAdaptations` is false.
- **Neither proposed change was prototyped.**

## Open questions or contradictions found

1. **The oracle checks a fact the instruction does not name** (`wheel-closed`; section 3). It is entailed only on a path
   that presses on a results page.
2. **The comments say the wheel is on "the first results page"** (`first-page.ts:56`, `state/types.ts:12`), but it
   comes back on every results page until it is answered (`search.ts:43`).
3. **`next_page` and load-more press inert controls with `HTMLElement.click()`**, and with `location.assign`, and report
   the move. They are not covered by the actionability gate's inert rule, whatever happens with this task.
