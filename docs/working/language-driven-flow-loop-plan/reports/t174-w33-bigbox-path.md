# t174-w33: bigbox-retail-pickup-cart, the path audit

Read-only audit by worker t174-w33, 2026-10-01. Trees: downstream and Core on `task/t174-live-lane` (downstream `a15a465e` plus w31's uncommitted runtime edits, which the content harness does not load; Core `f3778a8e`). No product file was changed. No Lab and no provider call. The one new file besides this report is the probe spec `apps/extension/e2e/content/tests/lane-a-probes/t174-w33.spec.ts`.

## Outcome

Done.

On today's dev the extension can perform and verify every step of the honest path but one, and the probe proves it end to end on the real page. That one step is opening the store chooser, and it is broken by F20.

- **The F20 store-chip defect.** The chooser is opened by its header chip. F20's ignored-press watch cannot see a change inside an open shadow root. So the chip's answer, which is the flyout un-hiding inside `vr-fulfillment-picker`'s root, reads as "ignored", and the chip is pressed a second time. The second press closes the chooser again.
- **The effect.** "Set as my store" then fails `web.action.rejected` ("zero-size box") after 4 attempts. This holds in a build and in playback, every time.
- **The rest of the path works.** With the chooser reopened by hand, the content script built exactly the goal's cart: `storeId=1187`, and cart `5530601:1:pickup,5510202:2:pickup,5530102:1:pickup`. The pieces that made this work:
  - consent and the email offer were cleared by the defence;
  - the Val card was cleared by R1;
  - the "Added to cart" panel was cleared by the defence;
  - both Add to cart presses were woken by F20;
  - the size and quantity presses were each made once.

A second, timing-dependent F20 weakness is proved too. The pinned Add to cart's press scope is the whole `<main>`. When it is pressed in the first second after a product page loads, the reviews loading into `<main>` are read as the page's answer, so the wake press is not repeated. The reply then says `succeeded` and nothing is added.

The other causes the four debugs recorded are fixed on dev, or owned elsewhere (table below).

## (1) The reference path

Sources:
- the task (`live-tasks.ts:4`);
- the manifest's recording script (`manifest/primary-workflow.ts:15-39`, `opening-steps.ts:75-93`), which `tests/browser-paths.test.ts:221-231` replays and judges by the goal's facts;
- the route (`route.ts`) and the client scripts.

The goal's facts are in `manifest/expected-values.ts:171-177`: store Millbrook Crossing Supercenter; the soap kept; 2 x towels in 12 Double Rolls for pickup; 1 x napkins in 250 Count for pickup; "4 items · Subtotal $43.39".

| # | Page | Control or input | Expected effect |
| --- | --- | --- | --- |
| R1 | home `/scenarios/bigbox-retail/` | consent dialog "Accept all", or "Reject all" (`shell/consent-dialog.ts`, `role=dialog aria-modal`) | `consent` answered; the email offer opens 2.2 s later over a scrim (`shell-script.ts:17,61-91`) |
| R2 | any page | the offer's "No thanks" link (`href="#"`) or its "×" div | `promo=dismissed`; it does not come back |
| R3 | header | the store chip `vr-fulfillment-picker` > `button` (open shadow root) | the flyout un-hides inside the root (`shell-script.ts:97`, a toggle) |
| R4 | header flyout | "Set as my store" in the 3rd card, Millbrook Crossing Supercenter. Three identical buttons; only the card tells them apart (`shell/store-picker.ts:93`) | POST `set-store`, then `location.reload()` (`shell-script.ts:105-109`); `storeId=1187`. This must come before the towels: their 12-roll pickup is "none" at both Carden Falls stores (`catalog/paper-towels.ts:29`) |
| R5 | header | type "select-a-size paper towels" into `input[type=search]`, submit (Enter or the button) | GET `/search?q=...` (`search-view`, load 1). A query holding the size finds nothing (`search/query-match.ts`) |
| R6 | results | the towels' own tile link, item `418830127`, not the ad copy that opens with "Sponsored" (`listing/tile.ts`) | `/ip/valueridge-essentials-select-a-size-paper-towels/418830127` |
| R7 | towels page | swatch "12 Double Rolls" (`div[tabindex=0]`, no role) | title, price and URL become `?variant=5510202`, with no reload; pickup stays chosen at Millbrook (`product-script.ts:213-231`) |
| R8 | towels page | quantity "+" (a bare `span`, no role or tabindex; inside the buy box, hidden for 700 ms after load) | qty 2 (`product-script.ts:235-237`) |
| R9 | towels page | the support card "×" (in the `vr-assist` root; it opens 3 s after load, bottom-right, over the pinned Add to cart; `shell/support-chat.ts`) | `chatCard=dismissed` (server state; it never reopens) |
| R10 | towels page | Add to cart (`data-testid=atc`, pinned bar, `position:fixed`), pressed twice | the first press only wakes the page (`shell-script.ts:45`, `product-script.ts:258`); the second POSTs `add-to-cart` and opens the "Added to cart" panel over a scrim (`product-script.ts:241-256`) |
| R11 | towels page | the panel's "Continue shopping" or "×" | panel and scrim gone |
| R12 | header | type "dinner napkins", submit | `/search?q=dinner+napkins` (load 2; the 3rd results load would raise the robot check, `state/robot-check.ts:4`) |
| R13 | results | the napkins' own tile link, item `418831402` | the napkins page |
| R14 | napkins page | swatch "250 Count" | `?variant=5530102` |
| R15 | napkins page | Add to cart, pressed twice (no card: it was dismissed) | line `5530102`, qty 1, pickup; the panel opens |
| R16 | - | no checkout, no cart-page edits | the soap line kept |

## (2) Each step against today's product

"Probe" means `t174-w33.spec.ts`, run at 2026-10-01 against the real content-script bundle on the real bigbox page. Its output is quoted from the final run (5 passed) unless noted. The harness stubs the runtime. Background `click-landing.ts` is therefore judged by its unit tests, not by the probe.

| # | Product path | Verdict | Evidence |
| --- | --- | --- | --- |
| R1/R2 | No step needed. The defence (`recovery/attempt.ts:110`, `interference/clear.ts`, `way-out.ts` consent decline) clears the consent wall when the first press meets it, and the offer when a later press meets it. | works | Probe honest path, step 1: "recovered on attempt 2 after absorbing blocking_dialog, closing 1 dialog", state `consent=rejected`. Step 2 (first run): "closing 1 dialog", state `promo=dismissed`. |
| R3 | `actions/click.ts:146-165` (F20). The watch is `ignored-press/page-press-listener.ts:88-94`: one `MutationObserver` on `pressScope(pressed)`, the light-DOM ancestor `div.page`. That observer cannot see inside the picker's shadow root, so the flyout toggle is not seen, and focus is retargeted to the host and excluded. | **defect (D1)** | Probe "store chip pressed once": "the page ignored the first press, so it was pressed once more"; flyout hidden before `true`, after `true`. The probe's first run without the workaround gives step 2 as `failed web.action.rejected`, "the element has a zero-size box; the execution did not recover within its 4 attempts". |
| R4 | A click on a button inside the root resolves through the widened root search (`resolve-target.ts:252-271`). The page reloads before the content script answers. Background `click-landing.ts:141-142` (HEAD) turns a reply lost to its own committed navigation into `succeeded`, "navigated its page before it could answer" (t202). The domain waits out the look between the two documents (`node-run/run.ts:374-383`). | works (with R3 worked around) | Probe step 2: "reply lost (Execution context was destroyed...)", state `storeId=1187`, activity `...>set-store`. Unit test `runtime/tests/click-landing.test.ts:307`. |
| R5/R12 | Typing works. Enter submits through `keyboard/press-key.ts:90` (`requestSubmit`). A button press loses its reply to the navigation, which t202 covers as for R4. | works | Probe 3a/3b and 6a/6b: "the field holds ..."; "the form fired a submit event with the '⚲' button as the submitter". Probe "search button": "reply lost", landed on `/scenarios/bigbox-retail/search`. |
| R6/R13 | The link rule (`click.ts:167-181`). | works | Probe 3c/6c: "navigation to .../418830127 was initiated" (and 418831402). How a model is shown and addresses the tile is t223's. |
| R7/R14 | F20 sees the title/price redraw inside the press scope, so there is one press. | works | Probe 4a/7a: one press, no "pressed once more"; page `?variant=5510202`. |
| R8 | One press, which the qty text change answers. This is the case F20 must never double-press, and it did not. | works | Probe 4b: one press; page `qty=2`; the server line later reads `5510202:2:pickup`, not 3. Whether the bare `span` "+" is shown to the model is t223's. |
| R9 | No step needed. The R1 corner probe (`interference/probe-points.ts:43`) finds the card, and `way-out.ts` presses its "×" inside the shadow root. | works | Probe step 5: "absorbing blocking_dialog, closing 1 dialog", state `chatCard=dismissed`. |
| R10/R15 | F20 presses the wake-only button once more. The add POST is the second press's request. | works, except timing (D2) | Probe step 5: "pressed once more", cart `5530601:1:pickup,5510202:2:pickup`. Step 7b: "pressed once more", final cart as the goal. See D2 for a press in the first second after load. |
| R11 | No step needed. The next press on the header meets the scrim (`obstructed_target`). The panel (fixed, right, 400 px) lies under the 0.92/0.94 probes, and its "×" is pressed. | works | Probe step 6a: "absorbing obstructed_target, closing 1 dialog". |
| R16 | Nothing in the path touches the cart page. | works | Final activity: `consent>dismiss-promo>set-store>search-view>dismiss-chat-card>add-to-cart>search-view>add-to-cart`. |
| Domain report | A succeeded command is `effectApplied: true`. `pageChanged` is said beside it, and an unchanged press gets the `PRESS_AGAIN` hint (`node-run/run.ts:105,413`). For D1 that hint makes things worse: the model presses the chip again, F20 doubles it again, and the chooser stays shut. | works; D1 interaction | Read from source; `run.ts` is t223's file. |
| Core completion | The reader yields `a1 set switch`, `a2 add_to` requiring `a2.quantity=two` and `a2.size=12 Double Rolls`, and `a3 add_to` requiring `a3.size=250 Count` (the reader run read-only on the task text). `check.ts:141-169` accepts the honest path when each is claimed by its own kept mutating step: set-store for a1, swatch for a2.size, "+" for a2.quantity, ATC for a2, swatch for a3.size, ATC for a3. | works | Scratch script output: `{"id":"a2",...,"requires":[{"id":"a2.quantity","choice":"quantity","value":"two"},{"id":"a2.size","choice":"variant","value":"12 Double Rolls"}]}` and so on. |

### The debugs' causes against current code

| Debug cause | Now |
| --- | --- |
| I1 (t193): store switch accepted without a switch step | Still possible: `check.ts:249-255` accepts any kept, applied, non-arrival mutate step for `set`, including the chip press. Owned elsewhere: act-object binding and the dry-run reset that made the store steps unreproducible and got them amended out (t196). New on dev, it is also fed by D1: since F20 merged, no chip press can open the chooser, so a build cannot do a1 the obvious way. |
| Run 34: 7 presses `action_failed` (6, 9, 10, 13, 18, 21, 23) | **Fixed by t202** (merged 2026-09-30 20:19 UTC, after run 34 at 18:35 UTC). The pattern fits: press 6 is the set-store reload, and the rest are search-button submits after a type. The probe shows both lose their reply to their own navigation (steps 2 and "search button"), and `click-landing.ts:141-142` now makes such a click succeed. Press 13 also met the third-load robot check (t197). The per-call parameters are screened in that bundle (G1), so which control each press hit is inferred from the type→click pattern, not read. |
| Add to cart taking no effect (runs 20, 28, 32, 34) | The wake press: **fixed by F20** (probe steps 5 and 7b), except D2. The Val card over the button: **fixed by R1** (probe step 5). The sticky ATC missing from the packet (lane cause 1) is t223's. |
| Size and quantity missing (run 28) | **Fixed by P1 B** (reader output above; run 34's refusals named `a2.quantity`, `a2.size` and `a3.size`). The presses themselves work (probe 4a/4b/7a). |
| Run 28 cause 1: composed item address | **Fixed by P1 A** (`node-run/shown-addresses.ts:141`, `address_not_shown`). |
| Run 28 cause 4, runs 20/28 causes 3-7: the dry run passes an unchanged press, the reset keeps site state, accepted without a dry run, a dry run on a refused completion | Owned elsewhere (t196: replays from the start, build lifecycle). |
| Run 20 cause 2: the card close amended out | Owned elsewhere (t196: transcript drafts). It is moot now that R1 closes the card in the page. |
| Run 20 causes 7-8: recovery cannot close a layer; diagnosis context | Moot for this path (R1). Owned by t193 (self-repair) and t194 (F4). |
| Run 28 cause 8: result check refused `llm.provider_result_summary_invalid` | Owned elsewhere (t194 judge lane). `request-evidence-check.ts` has changed since (no size bound, wider task kinds); whether a state-change task's summary is now sent was not re-checked. |
| Run 32/34: `handle_not_in_packet` | **Fixed by F13** (owned by t174, on dev). |
| Run 34 cause 3: an unshown address answered with another guess | Model behaviour. The refusal's `instead` already names the shown link's handle (`shown-addresses.ts:64-67`). |
| Draft entry cap, no-progress guard, repeat amendments | Owned elsewhere (t196). |

## (3) Fixable here

### D1. F20 presses a second time a control whose answer is inside an open shadow root

**Cause.** `ignored-press/page-press-listener.ts:88-94` observes only `pressScope(pressed)`, a light-DOM element. A `MutationObserver` does not descend into shadow roots, so a toggle drawn inside one is invisible. Focus inside the root is retargeted to its host, which `listenForFocus` (`:153`) rightly excludes. Every press answered only inside an open root is therefore made twice. A toggle is undone by that second press. On bigbox the toggle is the store chip, so the cart task's first act is impossible on dev, in builds and in playback.

**Fix.** In `listenForChange`, also observe every open shadow root within the scope: `openRootsWithin(scope)` from `content/shadow-dom/composed-roots.ts:46`, which `in-place-effect.ts` already uses for the link rule. A press inside a root whose host is below the scope is then seen. Optionally also re-walk for roots attached after the press, as `in-place-effect.ts` does. One file: `apps/extension/src/content/action-runtime/ignored-press/page-press-listener.ts`.

**Test.** Failing first, a T2 spec next to `shadow-roots/tests/shadow-root-in-place.spec.ts`, for example `e2e/content/tests/shadow-roots/tests/shadow-root-press-answer.spec.ts`. It builds an open root on basic-form holding a toggle button whose click flips a panel's `hidden` inside the root, sends one `web.dom.click`, and expects:
- no "pressed once more";
- the panel open.

On HEAD it fails as the probe's chip test does. A second row keeps the guard honest: a root button that does nothing is still pressed once more. The bigbox chip probe (`t174-w33.spec.ts`, "store chip pressed once") turns from `after: true` to `after: false`.

**Size.** Small: about 10 lines and one spec.

### D2. F20's scope for a pinned control is the whole `<main>`, so the page's own load-time motion forbids the wake press's repeat

**Cause.** `ignored-press/press-scope.ts:28` walks up to 4 ancestors and stops at the first section tag. The pinned Add to cart's parent is `<main>` (`pages/product-page.ts:60,76`), so its scope is all of `<main>`. bigbox loads its reviews into `<main>` 900 ms after load (`product-script.ts:284`).

**Evidence.** A press made as soon as the buy box is ready (about 700 ms) is followed, within F20's 800 ms window (`click.ts:116`), by that insert. The insert counts as the page's answer, so there is no second press, and the reply is `succeeded | passed: the point 1146,685 landed on the target`, with the cart unchanged. Probe "Add to cart pressed as soon as the buy box is ready": `reviews at press: 0, after: 3`, cart `5530601:1:pickup`. In the previous run the press came after the reviews ("reviews at press: 3"), was pressed once more, and added `5530101`. So the outcome depends on timing.

**Who meets it.** A playback that presses Add to cart within about 1 s of the product page's load, typically a Flow whose product needs no size press. Runs 20 and 28 pressed 4-5 s after load.

**Candidate fix, which needs a decision.** In `press-scope.ts`, let a `position: fixed` or `sticky` ancestor bound the section: a pinned bar or drawer is its own region. The ATC's scope would become the bar. The trade-off falls against the file's one-sided rule. A pinned-bar press whose only answer is a change inside `<main>`, with no request, no change in the bar, no navigation and no focus move, would be pressed twice. That is rare: an add almost always sends a request, which forbids the second press on its own. One file, `apps/extension/src/content/action-runtime/ignored-press/press-scope.ts`, plus the computed style read there.

**Test.** Failing first, the probe's "ready press" row made deterministic on basic-form or bigbox. Use a pinned-bar button whose first press is swallowed, and have the page append to `<main>` 100 ms after the press. Expect "pressed once more" and the add made. A second row keeps a change inside the bar forbidding the repeat.

**Size.** Small, but the supervisor should rule on the trade-off first.

### Recorded, not proposed

**A press before the buy box is ready.** Add to cart pressed while the buy box still shows "checking availability" (under 700 ms after load) wakes the page and adds nothing. A second press would add nothing either (`product-script.ts:258`, `live.hidden`), and the reply is `succeeded`. Probe "early press": `buy box hidden at press: true`, `Add to cart: succeeded | passed: the point 1146,685 landed on the target`, cart unchanged.

This is the click verb's stated contract: it is held to its hit test (`click.ts:297-302`), and the domain's after-look reports `pageChanged: false`. It is not a defect of this path's fixable code. It stays a playback risk only for a step that presses within 700 ms of load.

## What changed and why

- New: `apps/extension/e2e/content/tests/lane-a-probes/t174-w33.spec.ts`, the provider-free proof the brief asks for. It has five rows:
  - the honest path, with the chooser reopened by hand after D1 so the later steps are probed;
  - the early press;
  - the store chip pressed once;
  - the press while the reviews load;
  - the search-button submit.

  It records more than it asserts. The rows that show D1 and D2 assert only that the reply was `succeeded`, and print the oracle's state, so they pass on today's code.
- New: this report.
- Nothing else. The scratch script for Core's act reader is in my scratchpad (`w33-acts.mts`).

## Commands run and observed results

- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t174 w33 probe" pnpm --filter @fluxiq-web-extension/extension test:content -- e2e/content/tests/lane-a-probes/t174-w33.spec.ts --workers=1 --reporter=list --output=<scratchpad>/w33-out`
  - **Final run: `5 passed (1.5m)`.** The lines quoted in (2) and (3) are from it.
  - **First run** (default reporter): the honest path failed on a probe-selector error (`web.target.ambiguous`: `> a` matched the tile link and the "Options" link; fixed to `> a:first-of-type`). The html reporter hit `EBUSY`, probably from other workers sharing `e2e/test-results`. Later runs used `--reporter=list` and a scratch `--output`.
  - **Second run:** showed D1 without the workaround: `2 set Millbrook: failed web.action.rejected | failed: the element has a zero-size box; ... 4 attempts`, state `storeId=2291`.
  - **Third run:** the chip row hit a harness setup timeout (`browserContext.newPage: Test timeout of 30000ms exceeded while setting up "page"`, under machine load). It passed when re-run alone: `1 passed`, flyout hidden after `true`.
- `node --experimental-strip-types <scratchpad>/w33-acts.mts` (Core `instruction-acts.ts`, read-only) printed:
  - `a1 set switch`;
  - `a2 add_to` requiring `a2.quantity=two` and `a2.size=12 Double Rolls`;
  - `a3 add_to` requiring `a3.size=250 Count`.
- `git log -S` dated the fixes:
  - t202's lost-reply rule: `bd6a32d0`, merged `660e4429` at 2026-09-30 13:19 -0700;
  - F20, R1 and R2: first in `c22646d0`, lane D's branch, merged to dev in round 5.

## Not verified

- **Background and runtime behaviour.** Background `click-landing.ts` and the domain's node-run were not exercised by the probe; the harness stubs the runtime. The R4 and search-button verdicts rest on the probe's lost reply plus `click-landing.test.ts:307`.
- **The model's view.** Whether the page view (t223) shows the chip, the "Set as my store" buttons, the swatches, the bare "+" span or the pinned Add to cart to the model was not checked; that is t223's.
- **Live and Core behaviour.** No live run, and no Core dry run or playback. In particular I did not check that playback from the seeded state (consent, card and offer all pending) behaves as the probe's fresh harness does, though both start from `createBigboxState()`.
- **The proposed tests and the structure audit.** The proposed D1 and D2 tests were not written (fixing is out of scope). No structure audit was run on the probe file.
- **Run 34's press mapping.** Which run-34 press hit which control: the parameters are screened (G1). The mapping is inferred.

## Open questions or contradictions found

1. **D1 and I1 are linked.** The lane report says I1 "waits for a live run" because t202 may have removed its trigger. But since round 5, F20 makes the chip unpressable, so a live bigbox build on dev will most likely meet I1 again, or fail to switch the store, for a new reason. D1 should be fixed before the next bigbox live run.
2. **D2 needs a ruling on F20's one-sided rule.** The rule is: any sign forbids a second press. The probe shows that the page's own motion inside a wide scope can also be the reason a swallowed press is never repeated.
3. **The `PRESS_AGAIN` hint stacks with F20.** The hint (`node-run/run.ts:105`, t223's file) tells the model to press again and keep both presses. On a control F20 has already doubled, that is four presses. For a toggle in a shadow root it never opens. Once D1 is fixed this stops mattering on bigbox, but t223 may want the hint to read the result's "pressed once more".
