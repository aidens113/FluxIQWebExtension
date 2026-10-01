# t174-w32: crossborder-marketplace-hub-to-cart path audit

Worker t174-w32, 2026-10-01. Read-only path audit. Trees: downstream and Core `task/t174-live-lane` (downstream at
`a15a465e` plus the uncommitted edits other workers are making; Core `f3778a8e`). No product file edited. No Lab, no
provider. Owned files: this report, and the probe spec
`apps/extension/e2e/content/tests/lane-a-probes/t174-w32.spec.ts`. A Core probe was kept in the scratchpad
(`scratchpad/w32/acts-probe.mts`, session `58ff9269`).

## Outcome

Done. Through the real content script, every item-page step of the honest path works, and the fixture's cart ends exactly
on the goal's line and coupon. That holds only once the chat is minimised as a step of its own: Add to cart is refused
under the chat pill, and the defence cannot clear the pill. Four defects are not owned by any lane
and can be fixed here (D1-D4 below); D5 is in Core. **The two most serious:** (D1) the press that opens the official
listing opens it in a **new tab that FluxIQ never follows**, and the click is still reported as a success; (D5) Core's
completion check **refuses the honest Flow**, because "Space Grey" is the colour the page opens with, so no step
chooses it. Pressing Space Grey, which is what Core's refusal tells the model to do, clears the colour on this site.

## 1. Reference path

The task: "On Farbazaar, put three of the Voltbay USB-C hub sold by Voltbay Official Store in my cart: Space Grey,
the 7-in-1 version, shipped from Spain. Collect that store's coupon while you are on the item. Do not buy anything."
(`live-tasks.ts:4`, `judgeBy: "playback-goal"`). The goal is the header flyouts: `Cart (3)`, `Orders to be shipped (0)`,
one cart line `Voltbay Official Store · <title> · Space Grey · 7-in-1 · Ships from Spain · × 3`, and the store's coupon
held (`manifest/facts.ts:153-158`). The honest path is `CART_SCRIPT` (`manifest/steps.ts:22-72`), proven in a browser
by `tests/browser-paths.test.ts:104-109`. The routes are in `route.ts:106-141`.

| # | Page | Control or input | Expected effect |
| --- | --- | --- | --- |
| S0 | home `/` | (arrive) | The consent banner is drawn at once (fixed to the bottom, z 70). The welcome-coupons modal with its scrim arrives 2 s later, over everything (z 80). These are answered in the order they arrive: "No thanks", then "Accept all" (a person may also choose "Reject non-essential") (`client/shell-script.ts:61-89`). |
| S1 | home | the header search `input[name="q"]`, type "usb c hub" | the box holds the query |
| S2 | home → `/search?q=…` | Enter in the box | Native submit. The results page draws skeletons, then the first 10 cards 600 ms later. One search load (`search-load`). Every third load since the last check is the robot check (`route.ts:110-113`); the cart path makes one load, so it never meets the check. The notification prompt arrives 3.5 s in (fixed top-left, z 60, over the filter sidebar). |
| S3 | results | the official card's **title link** (`a[href="/item/1005008123450"]`, the second of the card's two links), **not** the look-alike or its ad, which carry the same title word for word (`tests/browser-paths.test.ts:122-136`) | The link has `target="_blank"` (`markup/cards.ts:94-95`): **the item opens in a new tab**, and the honest script switches to it (`steps.ts:40`, `switchTab`). |
| S4 | item `/item/1005008123450` | (arrive) | The chat pill arrives 1 s in, fixed over the middle of "Add to cart" (z 65), and the prompt arrives 3.5 s in. Colour is already **Space Grey**, spec **4-in-1**, origin **China** (the first of each, `catalog/skus.ts:24-26`). Pressing Space Grey again **clears** it (`client/item-script.ts:256`). |
| S4a | item | `[title="Minimize chat"]` on the pill | The pill becomes a 44 px bubble above the buy bar (`stylesheet.ts:62`). Until then, a click aimed at Add to cart lands on the chat (`browser-paths.test.ts:111-120`). |
| S5 | item | the Specification chip "7-in-1" | The label reads `Specification: 7-in-1`, and the price and stock follow it |
| S6 | item | the Ships From chip "Spain" (inside the option group, not the header's region picker) | The label reads `Ships From: Spain`. Space Grey · 7-in-1 · Poland is sold out, and Spain has 4 in stock (`skus.ts:15-16`). |
| S7 | item | the quantity box, type "3" | The box holds 3 (at or below the 4 in stock) |
| S8 | item | "Get coupons" inside `fb-store-coupon`'s **open shadow root**, pressed **twice** | The first claim always fails, "Network busy, please try again" (server-side count, `state/mutate.ts:88-97`). The second collects it, and the button then reads "Collected". |
| S9 | item | "Add to cart" (`data-testid="add-to-cart"`) | A 700 ms spinner, then the toast "Added to cart!", and the flyouts refresh. The cart icon's number is deliberately not refreshed. |

## 2. Product path per step

Evidence key: **P** = this audit's T2 probe (`t174-w32.spec.ts`, the real content-script bundle on the fixture with
every interruption left up; `[w32]` lines are quoted from its output); **D35/D36** = the run 35/36 debug files; **C** =
the Core scratchpad probe.

| # | Product path (file:line) | Verdict | Evidence |
| --- | --- | --- | --- |
| S0 | Interruptions are cleared only when one stands in an action's way. Dismissal words: `content/action-runtime/interference/vocabulary.ts:71` ("No thanks", "Not now", "×"). Consent is answered by declining optional cookies only (`vocabulary.ts:109-131`, "Reject non-essential"). | **works** (by design they stay open until in the way) | **P**: the first item-page press closed the welcome modal ("recovered on attempt 2 after absorbing blocking_dialog, closing 1 dialog"). The refused Add to cart declined consent (final state `consent=essential`). The prompt was never in the way and stayed `pending`. The existing row `dialog-dismissal.spec.ts:138` (typing behind the welcome modal) is on dev. The cost of these layers to the model's packet is **t223's** (cause #1). |
| S1 | `content/actions/type.ts` (type over the field's text, then read back) | **works** | D36 it. 3 (`type target.42` succeeded) |
| S2 | `content/actions/keypress.ts`, then a click landing / navigation judged by `runtime/click-landing.ts` | **works** | D35 it. 4, D36 it. 7 (`/search`). The robot check on repeat loads is **owned by t197** (handed to the person; D36 it. 19 and 28 "personCompletedCheck"). |
| S3 (choose the card) | The packet shown to the model, and the page search | **owned by t223** (cause #1: 40 of 293 elements, no card, D36). Handle refused: **fixed on dev (F13)**. | D36 cause 1, cause 2 |
| S3 (press the card) | The content script judges a link by whether a navigation began (`content/actions/click.ts:167-178`, `linkValidation` at `:252-262`): "navigation to … was initiated". The background watches only **its own tab's top frame** (`runtime/click-landing.ts:194-257`, `isOurTopFrame` at `:203-204`). **No code anywhere listens for a tab a click opens** (no `onCreatedNavigationTarget` or `tabs.onCreated` in `apps/extension/src`). The automation tab stays on the results page (`runtime/automation-tab.ts:117` is only called by navigate and by `web.browser.tab`). | **defect D1** | **P**: `S3 card title click: status=succeeded … actual="navigation to http://127.0.0.1:60515/scenarios/crossborder-marketplace/item/1005008123450 was initiated"`, then `S3 tab after click: unchanged (still the results page); new tab: /scenarios/crossborder-marketplace/item/1005008123450` |
| S3 (domain/Core) | The step is a kept `mutate` press, and Core accepts it as a step. The next look and every later step run in the results tab. | consequence of D1 | code reading |
| S4 (colour) | Nothing to press, since the page opens on Space Grey. Core still wants a step of its own for `a1.colour` (`instructed-acts/check.ts:157-169`, read by `instruction-choices.ts:58-62`), and its refusal says "press that option" (`check.ts:104-106`). | **defect D5 (Core)** | **C**: the honest draft with `a1.colour` unclaimed gives `["a1.colour:no_step_named"]`; claimed on the add gives `choice_is_the_act_step`; claimed on the card press or the Spain press gives `ok`. **P** (trap row): `S4 press Space Grey (already chosen): status=succeeded … ; colour label after: "Color: "`. |
| S4a | The content script snapshot lists the control (`Minimize chat`, from its `title`). Whether the model's packet carries it is t223's. | **works** (extension side) | **P** S0 row: `"Minimize chat"=1` |
| S5 | `content/actions/click.ts:146-165` (hit test, then ignored-press watch) | **works** | **P**: `S5 choose 7-in-1: status=succeeded … landed on the target; … closing 1 dialog` (the welcome modal); label `Specification: 7-in-1` |
| S6 | same | **works** | **P**: `S6 choose Spain: status=succeeded … landed on the target`; label `Ships From: Spain` |
| S7 | `content/actions/type.ts` (types over "1") | **works** | **P**: `S7 type quantity 3: status=succeeded … the field holds "3"`; box `3` |
| S8 press 1 | The click passes on its hit test. The page's in-place refusal is inline text inside the shadow root. The rate-limit watch reads only **layers** (`content/action-runtime/rate-limit-notice.ts:79`, phrases at `interference/vocabulary.ts:141`), so "Network busy, please try again" is not seen. | **defect D2** | **P**: `S8 coupon press 1: status=succeeded`; then `stores=[] attempts={"voltbay-official":1} inline error="Network busy, please try again"` |
| S8 press 1, second press | F20's ignored-press watch observes `pressScope(pressed)` (`ignored-press/page-press-listener.ts:94`). The scope climbs **out** of the shadow root through its host (`press-scope.ts:28-38`), and a MutationObserver on a light-DOM ancestor never sees changes inside a shadow root. The press's own change ("Get coupons" → "…") is therefore missed, and the request goes out 800 ms later, at the window's end (`item-script.ts:328-330`). So the press is made **again** (`click.ts:152-164`). | **defect D3** (F20, on dev) | **P**: press 1 and press 2 both say `the page ignored the first press, so it was pressed once more`. Only the widget's own guard (`textContent === '…'`, `item-script.ts:326`) stopped a second claim. |
| S8 press 2 | same | **works** (collected) | **P**: `S8 coupon press 2: status=succeeded`; state `coupons=["voltbay-official"]` |
| S9 | Actionability hit-tests the **centre only** (`content/action-runtime/actionability.ts:53-69`). The pill covers it. The defence finds no way out, because "Minimize chat" is not a dismissal label (`vocabulary.ts:71`; titles are read at `interference/way-out.ts:115-116`). The refusal tells the model the layer has **"no control to press"** (`interference/covering-layer.ts:76`). | **defect D4** | **P**: `S9 add to cart: status=failed code=web.action.rejected … "the point 1174,688 landed on span, which covers the target; it is part of div, a layer over the page with no control to press; the execution did not recover within its 4 attempts after absorbing blocking_dialog, obstructed_target, obstructed_target, obstructed_target, closing 1 dialog …"` |
| S9 after S4a | same; `[title="Minimize chat"]` pressed as its own step | **works** | **P**: `S9a minimise the chat: status=succeeded … landed on the target`; `S9b add to cart after the chat is minimised: status=succeeded`; final `cart=[{"listingId":"1005008123450","choice":{"color":"Space Grey","spec":"7-in-1","origin":"Spain"},"quantity":3}] coupons=["voltbay-official"]`, which is the goal's line and coupon |
| Completion | Core `instructed-acts/check.ts`: a1 `add_to` (put … in my cart), a1.quantity "three", a1.colour "Space Grey", a1.version "7-in-1", a2 `claim` (collect … coupon). "Shipped from Spain" is not read as a choice. | a1, a2, a1.quantity, a1.version: **works**. a1.colour: **D5** | **C** (acts read verbatim as listed) |
| Playback | Each step is replayed by the same verbs. D1 means a replayed card press leaves every later step in the results tab. D2 means a one-press coupon step reports success while the page refused it (if playback starts from a fresh site state). D4 refuses Add to cart unless the Flow holds a minimise step. | follows from D1, D2, D4 | code reading. Whether playback starts from fresh site state is the Lab's (cause #3 says consent and store state were not carried into playback) and was not checked. |

Probe S0 row (content-script snapshot of the item page, with the welcome modal, prompt, consent banner and chat all up):
`[w32] S0 snapshot: 199 elements; "Space Grey"=2 "Silver"=1 "7-in-1"=1 "Spain"=1 "Get coupons"=1 "Add to cart"=1 "Buy now"=1 "Minimize chat"=1 "No thanks"=1 "Not now"=1 "Reject non-essential"=1`.
Every control the path needs is in the extension's snapshot, including the shadow-root "Get coupons" and the
title-only "Minimize chat". What reaches the model from it is t223's.

Probe trap row (D5's consequence, chat minimised so the add lands): `S4 press Space Grey (already chosen): status=succeeded`,
label then `"Color: "`; `S9 add to cart after the colour was cleared: status=succeeded … landed on the target`; final
`cart=[] page tip="Please select a Color."`. **A press of Add to cart that added nothing is reported as a success.** The
page's refusal is the inline tip, which no watch reads. This is the same gap as D2.

## 3. Causes the debugs recorded, against today's code

| Debug cause | Status today | Where |
| --- | --- | --- |
| Run 15 #1: a Flow of two navigations accepted | **fixed** (F5 `step_only_arrives`) | Core `instructed-acts/check.ts:128-129, 249-255` |
| Run 15 #2 / run 19 #1: blind navigations onto the robot check read as success; the check never answered | navigations now fail `needs_person` (F7) and are handed to the person: **owned by t197**, working in run 36 (it. 19, 28) | `runtime/landed-challenge.ts`, `runtime/landed-check-wait.ts` |
| Run 15 #3: re-author loop calls uncounted | Core result re-author; **not this lane's** (t194 per the debug) | - |
| Run 15 #4: exploration rung `no_progress` | Core recovery; **t193's area** | - |
| Run 19 #2: a list read replayed as success on a robot-check page | replays from the start: **owned by t196**; check detection on reads: **t197** | - |
| Run 19 #3 / theme "navigated without pressing" | **fixed** (P1 A: addresses not shown are refused). Live-proven in runs 35 and 36 (`address_not_shown`, after which the search was typed). | domain `node-run/shown-addresses.ts` |
| Run 19 #4-5; run 35 #3-5; run 36 #3-6: refused completions, dry runs, transcript draft, draft cap, completing while not done | **owned by t196** (lifecycle, replays, transcript, no-progress guard) | Core `flow-draft/**`, `llm/evidence-loop*` |
| Run 35 #1 / run 36 #2 / theme "Voltbay card press refused" | `handle_not_in_packet` **fixed** (F13). The card missing from the packet is **t223's**. **New:** even once pressed, the card opens a tab FluxIQ does not follow (**D1**). | - |
| Run 36 #1: 40 of 293 elements, no card | **owned by t223** | domain `runtime/llm-evidence/` page view |
| Theme: notification prompt and cookie banner open all build | Not a runtime defect. The defence clears each one only when it stands in an action's way, and each is clearable ("Not now", "Reject non-essential"; P closed the welcome modal and declined consent). What they cost in the packet is **t223's**. The chat pill is the one layer the defence cannot clear (**D4**). | `interference/vocabulary.ts` |
| Theme: robot check every third search load | **owned by t197**. The honest cart path makes one load and never meets it. | `route.ts:110` |

## 4. Fixable here

| # | Defect and cause | Files a fix would edit | Test that proves it (fails first) | Size |
| --- | --- | --- | --- | --- |
| D1 | **A click that opens a new tab is reported as a success, and the tab is never followed.** The content script calls a `target="_blank"` link "navigation … initiated" (`click.ts:262`). The background watches only its own tab's top frame (`click-landing.ts:203`). Nothing re-points the automation tab, so the next look and every later step (in the build and in playback) run on the results page while the item sits in an undriven tab. A fix: in `sendClickCheckingLanding`, listen for `chrome.webNavigation.onCreatedNavigationTarget` with `sourceTabId === tabId` during the click's grace. On a hit, call `setAutomationTab(newTabId)`, wait for it to be ready, judge its landing as a same-tab landing (robot check, served status), and say in `actual` that the click opened the page in a new tab, now the driven one. | `apps/extension/src/runtime/click-landing.ts` (being edited now by w31, so this comes after it), `apps/extension/src/runtime/automation-tab.ts` (read; maybe export a ready-wait), `docs/architecture/web-capabilities.md` | `apps/extension/src/runtime/tests/click-landing-new-tab.test.ts` (new): a fake `chrome.webNavigation` firing `onCreatedNavigationTarget` for the click's tab. It asserts `currentAutomationTabId()` is the new tab and `actual` names the new tab. It fails on HEAD (the automation tab is unchanged). Also a check that a new tab opened by a *different* tab is ignored. **Not provable in the T2 harness** (no background); P proves the content half. | medium |
| D2 | **A press the page refuses in place with a transient error is a success.** The rate-limit watch reads only layers over the page and a closed "too fast" phrase list. The coupon's refusal is inline text inside the control's own shadow root, "Network busy, please try again". A one-press coupon step in a Flow (an authored, not transcript, draft, or playback from a fresh site state) then reports success while the coupon is not collected. A fix: also read the pressed control's section (`pressScope`, **including** its shadow root) for newly appeared text matching a narrow transient-refusal phrase ("network busy", "server busy", "busy, please try again", "try again later"; never bare "try again", which a failed payment says too), and fail it `web.action.rate_limited`, `effect: unacted`, with no named wait, so Core's backoff runs the node again. | `apps/extension/src/content/action-runtime/rate-limit-notice.ts`, `apps/extension/src/content/action-runtime/interference/vocabulary.ts`, their `tests/` | A unit test in `content/action-runtime/tests/rate-limit-notice.test.ts` (a shadow-root control whose press writes "Network busy, please try again" beside it is refused, and "Payment failed, try again" is not). A T2 row: crossborder coupon press 1 gives `web.action.rate_limited`, press 2 collects. P shows press 1 `succeeded` today. | medium |
| D3 | **F20's ignored-press watch is blind inside shadow roots.** `pressScope` walks out through the host (`press-scope.ts:28-38`), and the MutationObserver on that light-DOM ancestor (`page-press-listener.ts:94`) cannot see the shadow tree. A widget that answers a press only inside its own shadow root, with its request later than 800 ms, is pressed **twice**. That is exactly what F20 says must never happen ("a second press on one that did something is a second order"). Here only the coupon widget's own `'…'` guard prevented a second claim. A fix: also observe every shadow root between the pressed control and its scope (`pressed.getRootNode()` up the host chain) with the same `OBSERVED` options. | `apps/extension/src/content/action-runtime/ignored-press/page-press-listener.ts` (maybe `press-scope.ts`) | `content/action-runtime/ignored-press/tests/page-press-listener.test.ts`: a control in an open shadow root that changes its own text synchronously on press is **not** pressed again (fails on HEAD). The T2 row: P's `S8 coupon press 1` must no longer say "pressed once more". | small |
| D4 | **The chat pill over Add to cart cannot be cleared, and the refusal says there is nothing to press.** The pill's only way out is a glyph `⌄` with `title="Minimize chat"`. "Minimize" and "minimise" are not dismissal words (`vocabulary.ts:71`), so the defence leaves the pill and refuses after 4 attempts. `covering-layer.ts` lists no control (the pill is the layer, and its title-only span is not a recognised pressable), so the model reads "a layer over the page with no control to press". The click aims only at the centre (`actionability.ts:53`), so the uncovered sliver of the button is never tried. A fix: add `minimi[sz]e` to `DISMISS_LABEL` (minimising hides a widget and acts on nothing), so the defence presses `⌄` and the button is reached. Optionally, name title-only controls in the covering sentence. | `apps/extension/src/content/action-runtime/interference/vocabulary.ts` (+ its test); optionally `interference/covering-layer.ts` | `interference/tests/vocabulary.test.ts` row (`"Minimize chat"` is a dismissal; `"Minimize and delete"` is not). A T2 row in `e2e/content/tests/dialog-dismissal.spec.ts` style: crossborder item page with the pill up, `web.dom.click` on `[data-testid="add-to-cart"]` succeeds with "closing 1 dialog" and the fixture's cart gets the line. P shows `S9 add to cart: status=failed code=web.action.rejected` today. | small |
| D5 (Core) | **Completion refuses a choice the page already has.** `a1.colour = Space Grey` needs a kept, changing step of its own (`check.ts:157-169`). The page opens on Space Grey, so the honest Flow has none. The refusal's guidance tells the model to "press that option" (`check.ts:104-106`). On this site that clears the colour (P trap row), and Add to cart then refuses ("Please select a Color."). The check passes only if the model names an unrelated press (the card or the Spain chip) for the colour (C). A fix: let a choice be answered by a look that **observed** it in effect on the item page (a kept observation whose reading holds the value), or tell the model in the refusal that a choice already shown as selected must not be pressed again and may name the step that reached the page. Which of the two is the supervisor's call, since it touches what Core may read from an observation. Core-boundary work: alert the user first. | Core `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/check.ts` (+ `choice-evidence.ts`, `checklist.ts` for the same rule) | Core `instructed-acts/tests/check.test.ts`: the crossborder honest draft (the 11 steps in `scratchpad/w32/acts-probe.mts`) with a1.colour answered by the look shows `ok` (fails today with `no_step_named`). | small (wording) to medium (observation) |

Not defects, for the record:
- The notification prompt and the cookie banner stay open until they are in the way. That is the defence's rule, and both are clearable.
- The look-alike card's identical title can be told apart only by the store line on the card. That is the page view's job (t223).
- A synthetic click opens a `target="_blank"` tab only because Playwright runs Chromium with `--disable-popup-blocking`
  (`playwright-core/lib/server/chromium/chromiumSwitches.js:63`), in both the harness and the Lab. In a person's
  Chrome, an untrusted click on such a link may be blocked as a popup. **Unknown, not probed.** Whether D1's fix
  should open the link's href in the driven tab instead is a design question for the fixer.

## Commands run and observed results

- `node --experimental-strip-types --no-warnings scratchpad/w32/acts-probe.mts` (Core check, no provider). It printed
  the acts above, then `honest, colour unclaimed: ["a1.colour:no_step_named"]`,
  `honest, colour -> the add: ["a1.colour:choice_is_the_act_step"]`, `honest, colour -> the card press: ok`,
  `honest, colour -> the Spain press: ok`, `coupon -> first (unacted) press: ["a2:step_changed_nothing"]`.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t174 w32 probe" pnpm --filter @fluxiq-web-extension/extension test:content -- e2e/content/tests/lane-a-probes/t174-w32.spec.ts --workers=1`.
  The first two runs had 3 rows (2 passed, 1 failed by design: the honest-path row expected the cart line and got `[]`,
  because Add to cart was refused under the pill, which is D4). The `[w32]` lines quoted in section 2 are from those
  runs. The final run, with the S0 snapshot row and the minimise continuation: rc 0, `4 passed (2.2m)` (S3, S4-S9, S0 snapshot, S4 trap); every `[w32]` line above was reproduced in it, identical except for the port.

## Not verified

- Anything the background worker does: the T2 harness has none. D1's background half is from code reading and a grep
  (no `onCreatedNavigationTarget` or `tabs.onCreated` in `apps/extension/src`), not from a run.
- Popup blocking in a real person's Chrome (see above).
- Whether Lab playback starts from fresh site state, which decides whether D2 bites in playback.
- Which elements of the item page reach the **model's** packet: that is t223's domain page view. The S0 row reads the
  content script's snapshot only.
- Firefox.

## Open questions or contradictions

- The brief says F20 ("an ignored press is pressed once more") is on dev and done. D3 shows that it presses a
  shadow-root control twice whenever the control answers only inside its own shadow root.
- The probe spec sits at the path the brief gave, `e2e/content/tests/lane-a-probes/t174-w32.spec.ts`, not in a
  `tests/` subfolder as the other content specs are (`tests/<area>/tests/*.spec.ts`). The structure audit was not run
  against it.
- D1 and w31's work share `runtime/click-landing.ts`, so a D1 fix is serial after w31.
