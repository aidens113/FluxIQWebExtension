# t743-e2a-office: one site memory across briefs, headed and provider-free

## Outcome

Done. The new spec `apps/extension/e2e/site-reset/tests/office-cross-brief.spec.ts` passed headed twice in a row,
using the scripted provider only. A new helper of my own, `apps/extension/e2e/site-reset/cross-brief-watch.ts`, does
the observing. I found no product defect. One observation about how results lists are read is under "Open questions".

## What the spec proves

The scripted supervisor writes the default one-part plan (everything-store) and then sends two build briefs of the
subflow `main`. Brief 1 ends `partial`, so brief 2 is not refused as `project.brief_repeated`. That code only applies
after a `blocked` return, which a builder that ends before submitting gets.

- **Brief 1 searches, acts and ends partial.**
  - It types "gooseneck kettle" into the store's own field `field[search] "Search Brightaisle"` with `submit: true`.
    This lands on `/scenarios/everything-store/s?i=all&field-keywords=&k=gooseneck+kettle`.
  - It looks once more at the loaded results page. Core's read around that look reads the 4-row results list
    complete, and the answer prints `resetDestinations` ref `destination-1` (count 4).
  - It goes to the product page and presses Buy Now, declaring `create_new` with `resetDestination: destination-1`.
  - It submits the subflow and ends `{"ended":"partial"}` without testing it.
- **Brief 2's opening carried `places`.** They are the results address, query included, and the product page. My
  helper read them from the opening call's value, which the instrumented runtime can see.
- **Brief 2's written navigation to brief 1's results page ran** (call `again`). The answer was `ok: true`, and the
  call sent capture, `web.browser.navigate`, capture.
- **The rule still holds** (call `made-up`). A navigation to `/scenarios/everything-store/gp/cross-brief/never-shown`
  was refused `address_not_shown`. The only command sent was the opening capture, with no navigate.
- **Core's own look reaches the typed-search page before the trial.**
  - Brief 2 presses Buy Now again after its own read of the results page (call `buy.second`, `create_new` against
    `destination-1`), so only a later read can settle that act.
  - It submits a changed revision (an extra capture step) and tests it.
  - Inside the test call, `site-reset.look.1.arrival` went to the results address. It sent capture,
    `web.browser.navigate`, capture, and was not refused.
  - That look read the results page complete. The spec counts the start-state reads at that address with rows,
    taken after the test was asked.
- **The trial then ran.**
  - The verdict was `yes`, with a `trial.*` run id.
  - `startedWith.cannotUndo` lists both Buy Now acts, `buy` (brief 1) and `buy.second` (brief 2). Each says
    "nothing it could change showed a change".
  - Core's looks declared nothing lasting.
  - The build ended `proposed`.

## What changed and why

- `apps/extension/e2e/site-reset/cross-brief-watch.ts` (new, only I use it). It wraps whatever evidence runtime is
  bound next, which here is the instrumented one, and the client gateway's `executeAction`. For each call it records:
  - the node and the navigation address;
  - the keys and `places` of the opening call (`initial.*`);
  - the answer's `ok` and `code`;
  - every browser command dispatched while the call ran, by action type, attributed through `AsyncLocalStorage`.

  This is what tells a call that sent a navigation apart from one refused unrun. The shared `instrumented-runtime.ts`
  counts only clicks, and I was not allowed to edit it.
- `apps/extension/e2e/site-reset/tests/office-cross-brief.spec.ts` (new). The supervisor and builders are scripted as
  described above. The diagnostic JSON keeps opaque refs, codes, digests, Lab fixture addresses and page views. Each run
  prints one `resetDiagnostic` line.

## Commands run and observed results

All commands ran from `C:/Users/osrs_/FluxStuff/fxwork/t743/!FluxIQWebExtension/apps/extension`:
`node --no-experimental-strip-types node_modules/@playwright/test/cli.js test -c e2e/playwright.config.ts e2e/site-reset/tests/office-cross-brief.spec.ts --workers=1 --reporter=list --output <scratchpad>/e2a-office-<N>`

`<scratchpad>` is `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/53d1357c-b7da-4f48-9665-ff78992a8998/scratchpad`.

Development runs:
- **Runs 1 and 2, query "kettle":** failed in my script with `diagnostic.search_results_not_read`. Every start-state
  read of the results page had zero collections, so no ref was issued and brief 1 came back blocked.
- **Run 3:** a DOM probe of the same page (see "Open questions").
- **Run 4, query "gooseneck kettle":** passed (1.2m).

Validation, two runs in a row of the final spec:
- **Run 5:** `1 passed (1.2m)`. Diagnostic line:
  `{"ending":"proposed","failure":{},"briefs":["ok","ok"],"again":{"ok":true,"code":null,"actions":["web.dom.capture_snapshot","web.browser.navigate","web.dom.capture_snapshot"]},"madeUp":{"ok":false,"code":"address_not_shown","actions":["web.dom.capture_snapshot"]},"opening2Places":["http://127.0.0.1:58152/scenarios/everything-store/s?i=all&field-keywords=&k=gooseneck+kettle","http://127.0.0.1:58152/scenarios/everything-store/Tidewell-Electric-Kettle-1-7-L-Stainless-Steel/dp/B0D7KXS4G7"],"looksBeforeTrial":[{"call":"site-reset.look.1.arrival","toSearch":true,"actions":["web.dom.capture_snapshot","web.browser.navigate","web.dom.capture_snapshot"],"ok":true,"code":null}],"tests":["yes"],"started":[["buy.second","buy"]]}`
- **Run 6:** `1 passed (1.2m)`. Its diagnostic line is identical to run 5's apart from the Lab port (58209).

The diagnostic JSON is at `<scratchpad>/e2a-office-<N>/<test dir>/reset-office-cross-brief.json`.

## Not verified

- **No mutation check.** I did not confirm that this spec fails without t743's product changes, because that would
  mean editing product code. Brief 2's navigation may be admitted by the build-shared memory, by `places`, or by both;
  the spec does not tell which one did it.
- **Reset briefs.** No reset brief ran, so neither a reset brief's opening `places` nor a reset model's navigation was
  exercised.
- **Repair briefs.** No repair brief ran. A repair needs a failing trial receipt, and brief 1 tested nothing.
- **Restarts.** The stored copy of the memory across a host restart was not exercised.
- **Not run, as the brief requires:** no typecheck, build, other spec or full suite. The other workers' specs in this
  folder were not run.

## Open questions or contradictions found

- **A broad search issued no ref.** The "kettle" results page gave no complete list in this harness, so no ref was
  issued for it.
  - What the page held: 9 results plus 3 adverts, so 12 `role="listitem"` cards, with the "Featured from our brands"
    carousel inside the `role="list"` container.
  - Live DOM probe: list hydrated, `aria-busy` removed, 12 items, no lazy-load sentinel, no pager.
  - Every start-state read at that address still answered `collections: []`, while the 4-row "gooseneck kettle" page
    answered one collection.
  - I did not trace the cause. Possible causes are the domain's per-row subject rule (`control-spot/collection.ts`
    `subjectsOf`) and the list-continuation word.
  - Round 4 live did issue a ref for its search-results list, with an unknown query, so this may only affect larger
    results pages.
  - Why it matters: an act whose only witness is such a list could not name a `resetDestination` there.
  - The spec uses the narrow query and says why in a comment. It does not weaken any assertion.
- **`SupervisorTurn` is not exported** from `site-reset/index.ts`. I imported it from `../scripted-provider` directly
  rather than edit the shared barrel.
