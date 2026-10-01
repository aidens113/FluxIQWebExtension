# t195-w19b: read-only audit of `bigbox-retail-pickup-order`

Worker t195-w19b (lane D, lead t195), 2026-10-01. Trees: downstream `a15a465e`, Core `f3778a8e`, both
`task/t195-live-control-flow`. "R/" is Core `packages/fluxiq/src/programs/automation-studio/runtime/`. "BB/" is
`apps/scenario-lab/src/scenarios/bigbox-retail/`.

## Outcome

Done. The audit found four causes that can stop the first live run even after P1 and L1:

1. The build's own dry run happens after the real order. The cart is empty by then, and the site remembers the guest
   checkout and the slot fetch. So the checkout chain cannot replay (#1).
2. The steps for a first visit only are the sign-in wall's link, the slots' Retry, the consent dialog and the offer.
   No dry run can reproduce them, but the reset playback needs them (#2).
3. The Lab's judge compares the expected order record with the Flow's **first** extraction. I proved this by running
   the built judge (#3).
4. On the product page, F20's watch counts the page's own load-time changes as an answer to the press. So an Add to
   cart press soon after load is never pressed again (#4). I proved the press scope by running `press-scope.ts`.

The remaining seven are risks.

Answers to the brief's question 3:
- The Lab does reset the site between the build and the judged playback.
- The order number is deterministic: `2000958-40713`.
- The playback's own Place order needs no grant.

## (a) The chain a correct build takes

Every value below comes from the scenario's own source.

1. **Start.** The page is the home page, as a returning shopper.
   - The site state is in `BB/state/initial-state.ts:9-29`: consent pending, offer pending, home store 2291 "Carden
     Falls Supercenter".
   - The cart holds one line: `L1` dish soap `418832007` sku `5530601`, qty 1, pickup.
   - The checkout is `account-wall` and `slotFetches` is 0.
2. **Consent and offer.**
   - The consent dialog is answered with "Accept all". F1's defence would decline it instead, which is also fine.
   - The "Get $10 off your first pickup order" offer is answered with "No thanks" (`manifest/opening-steps.ts:8-12`).
   - Both are first-visit states (`state/mutate-state.ts:34-38`).
3. **Search.** Type "select-a-size paper towels" and press Enter. The robot check comes only on the third results load
   since a reset (`state/robot-check.ts:4,11-13`). The playback is load 1, so it never meets the check there.
4. **Product.**
   - Open listing `418830127` from its own tile, not the sponsored copy (`opening-steps.ts:24-26`).
   - The size is already **6 Double Rolls**: variant `5510201`, the first, $8.97 (`catalog/paper-towels.ts:27-28`). No
     swatch press is needed (`product-page.ts:63`, `product-script.ts:44`).
   - The buy box shows after 700 ms (`product-script.ts:18,47`). Reviews arrive at 900 ms (`product-script.ts:119`).
   - "Val" opens on a timer and is closed with its "×" (`pickup-order-workflow.ts:54-55`).
5. **Add to cart.** The button is `data-testid="atc"`, in `div.atcBar`, a direct child of `<main>`
   (`product-page.ts:64`, `shell/shell.ts:53`).
   - **F20 case:** the first press after any page load is swallowed by `window.vr.wake()`. It sends no request and
     changes nothing (`client/shell-script.ts:44-45`, `product-script.ts:93`).
   - The second press adds qty 1, pickup (the `preferred` method), and opens the "Added to cart" panel with "View cart".
     The recording presses twice (`pickup-order-workflow.ts:56-57`).
6. **Cart and the soap.**
   - Use "View cart", or the header's cart link. The lines draw 500 ms after load (`cart-page.ts:58`).
   - With the towels added there are two lines in one "Pickup at Carden Falls Supercenter" group, soap first
     (`cart-page.ts:43-45`, `state/cart-operations.ts:24-28`). Each line has an identical "Remove" and "Save for later"
     (`cart-page.ts:22`).
   - Press the **soap's** "Save for later" (`L1`) (`pickup-order-workflow.ts:61`). Expect "Saved for later (1)".
   - Order does not matter. Saving before adding gives a one-line cart, and that is also correct.
7. **Continue to checkout.**
   - This is the checkout bar's button (`cart-page.ts:50,74`). It only navigates, so it declares `[]`, not money.
   - The bar exists only while the cart holds a line (`cart-page.ts:50`).
8. **Sign-in wall.** Press "Continue without an account", which is a small link (`checkout-page.ts:20`,
   `client/checkout-script.ts:19`). It sets `checkout: "guest"` for good (`mutate-state.ts:76`).
9. **Pickup times.**
   - The first `checkout/slots` fetch since the reset answers 429 with Retry-After 2 (`route.ts:47-49`).
   - The page keeps its spinner. After 2 s the link "Taking longer than usual? Retry" appears (`checkout-script.ts:28-35`).
   - Press it.
10. **Earliest slot.** Today, store 2291: 11am–12pm, 12pm–1pm and 1pm–2pm are disabled "… Full"; **2pm–3pm** is the first
    open slot (`cart/pickup-slots.ts:9,14-19`, `pages/pickup-slots-fragment.ts:12-15`).
    - Every label from 2pm–3pm to 8pm–9pm appears again under "Tomorrow" without a day. The day is only in the `h3`
      above the grid.
    - The selection is a class toggle (`slotOn`) plus a JS variable `slotId`. No aria state shows it
      (`checkout-script.ts:24`).
11. **Contact.** Type First name "Dana", Last name "Whitfield", Email address "dana.whitfield@example.com", Phone number
    "555-014-2290".
    - These are labelled inputs (`checkout-page.ts:32-33`).
    - Never fill the off-screen `company_website`. It flags the order "VR-417" (`checkout-operations.ts:31`).
12. **Pay at pickup.** Select the radio `name=payment value=pickup` (`checkout-page.ts:37`).
13. **Place order.** This is `button.placeOrder` (`checkout-page.ts:38`), declaring `move_money`.
    - The build asks. The Lab grants because the class is in `missing` and the label equals "Place order".
    - Core then permits the press (P1: `R/flow-bootstrap/action-permissions.ts`; `R/action-permissions/gate.ts:196-208`).
    - The server checks guest status, a non-empty cart, contact, the slot, and the payment (`checkout-operations.ts:26-47`).
    - It then navigates to `order/2000958-40713` (`checkout-script.ts:44-51`).
14. **Read the confirmation.**
    - The record lives in `section` > `h1` "Thanks for your order, Dana!" (`pages/order-page.ts:24`).
    - Each value is in its own element: the order number in `h1 + p > span`, the item in `li a`, the quantity in
      `li > span > span:last-child`, the total in the last `dd`, and the pickup window in `h2 ~ p > span`.
    - The labels "Order#", "Qty" and "Pickup window:" sit outside those elements (`pickup-order-workflow.ts:79-90`).
15. **Expected dataset** `extract-order` (`manifest/expected-values.ts:154-156`):
    `{ order: "2000958-40713", item: "ValueRidge Essentials Select-A-Size Paper Towels, 6 Double Rolls", quantity: "1",
    total: "$9.62", pickup: "Mon, Sep 21, 2pm–3pm" }`.
    - The pickup value uses an en dash, as `slotRangeText` writes it.
    - The total is $8.97 plus 7.25% tax, rounded half up: $0.65, so $9.62 (`cart/cart-totals.ts:15`).
    - Values are compared exactly (`test-runner/src/run-expectations/extraction/value-match.ts:41-53`).
    - Final facts (`expected-values.ts:159-162`): mini cart "0 items · Subtotal $0.00" and "Saved for later: 1 item".
16. **Is the order number deterministic?** Yes.
    - The number is `2000958-${40713 + orders.length}` (`cart/order-number.ts:2-4`, `checkout-operations.ts:40`).
    - The Lab resets before the playback (question 3), so the playback's order is the first since that reset: 40713.
    - The build's own order was also 40713 on a fresh Lab, but it is never judged.
    - The calendar is fixed (`catalog/calendar.ts:5`), not the wall clock.
17. **The instruction's acts as Core reads them.** I ran the real `automationStudioInstructedActs` (commands below).
    - `a1` submit "order", with the requirement `a1.size` = variant "6 Double Rolls".
    - `a2` submit "check out" ("Check out as a guest as Dana Whitfield, … and pay at pickup").
    - There is **no** save act: "should be saved" is not a command-position "save".
    - The completion check wants three distinct, kept, non-optional, mutating steps
      (`R/flow-bootstrap/instructed-acts/check.ts:139-169,249-255`).

## (b) Causes, ranked

### Causes that block the first pass

#### 1. The judgement dry run runs after the real order, against the state that order left

Without a model restructuring the Flow, the checkout chain cannot replay. Owner: **t196** (dry runs).

**Evidence.**
- The dry run is the judgement phase. It runs only after a completion the act check accepted (`R/flow-draft/dry-run.ts:23-30`).
- Such a completion needs a step named for `a1`, and that is Place order (§a.17). So the real order is always placed
  in exploration before any dry run.
- The dry run's reset "is a navigation and nothing more" (`R/flow-draft/verify-only.ts:13-21`; `dry-run.ts:69-73`).
  The dry run therefore meets a site whose cart is **empty**: an order takes every cart line (`BB/state/checkout-operations.ts:44`).
- That site also has `checkout: "guest"` and `slotFetches ≥ 1`, and its consent and offer are answered.

Replaying the §a chain against that state:
- **Add to cart** declares a lasting class, so it is verified, not run (`verify-only.ts:96-100`). The "Added to cart"
  panel therefore never opens, and **View cart** (on the same page) is absent.
  - The excuse rule covers only a verified step that *moved* the target (`verify-only.ts:55-62,150-155`).
  - Add to cart did not move it, so View cart blocks.
- **Continue to checkout** has no bar on an empty cart (`BB/pages/cart-page.ts:50`). It is replay-mode (`[]`), so it
  blocks.
  - Every checkout step after it is then on the wrong page and reads `unreproducible`.
- The guest link and Retry are absent on `/checkout`, which the site remembers (#2).
- The steps that would pass are these:
  - The soap's "Save for later" reads `present` (its line is gone).
  - Place order reads `verified`.
  - The extract is excused by Place order's moved target.

**The model's only way through:**
- Replace View cart and Continue to checkout with navigations to `/cart` and `/checkout`.
- Mark the guest link, Retry, Accept all and No thanks optional.
- Keep `a2` off any optional step: `whyNot` refuses `step_is_optional` (`check.ts:253`).

All of this has to happen inside the 64-call budget, after about 45 calls of exploration. No run has ever reached
this point, because no run has had a granted Place order.

**Fix spec (t196).** Make the dry run follow the draft, not the remembered state. This touches three places.
- **Re-anchor.** Domain host `domain/src/runtime/llm-evidence/node-run/replay.ts` (not in t223's list) and Core
  `R/flow-draft/dry-run.ts`, `verify-only.ts`.
  - Trigger: a step's target is absent, and the replay stands on a page other than the step's own `replay.from.location`
    (`node-run/replay.ts:70-86` writes `{ location }`).
  - Condition: the step before it was verified, present, excused or remembered (below).
  - Action: the host navigates to that `from.location` and tries the step again there.
  - Answer: `core.replay.reanchored`. It does not block, and the model is told in the dry run's step line.
  - A step that cannot be found after a re-anchor is a real failure.
- **Remembered.** For a *replay-mode* step whose target is absent on its own page (`location` equals `from`), the host
  answers `core.replay.remembered`.
  - This is the same test `node-run/verify.ts:147-160` already applies to verify-mode steps (`present`).
  - It does not block, and the step stays in the Flow unchanged, so a fresh visit still runs it.
- **The withheld effect also excuses** the next step on the same page whose target the withheld effect would have
  created (View cart after a verified Add to cart). Today only a moved target excuses (`verify-only.ts:150-155`).
- **Wording.** `DRY_RUN_INSTRUCTION` (`dry-run.ts:247-262`) gains `reanchored` and `remembered`.

**Provider-free tests.**
- Core `R/flow-draft/tests/`: a verdict built from the bigbox post-order outcomes.
  - Outcomes: Accept all and No thanks `remembered`; Add to cart `verified`; View cart absent on the same page right
    after it; Save for later `present`; Continue to checkout `remembered`; guest link `reanchored` then `remembered`;
    Retry `remembered`; 2pm–3pm and the four typings `replayed`; Place order `verified`; extract `withheldBy`.
  - Expect `ok: true`. Today, View cart and Continue to checkout block.
- Domain `node-run/tests/`: the host answers `remembered` when `location === from.location` and the target is absent,
  and `unreproducible` otherwise.
- A fixture check from the scenario's own modules:
  - `renderCartPage(state)` for a state after `placeOrder` contains no "Continue to checkout".
  - `renderCheckoutPage` for `checkout: "guest"` contains no "Continue without an account".
  - These pin the premise, so a change to the scenario shows up in the test.

#### 2. Steps for a first visit only are unreproducible in every dry run, but the reset playback needs them

Owner: **t196** (same fix as #1); the evidence is this lane's.

**Evidence.**
- The playback meets the fresh state, because the Lab resets (question 3). That state has the sign-in wall
  (`checkout-page.ts:14-21`), the 429 on the first slot fetch (`route.ts:47-49`), the consent dialog and the offer.
- Every dry run meets the opposite. `checkout: "guest"` sticks (`mutate-state.ts:76`), and only the *first* fetch is
  429 (`route.ts:48`).
- The dry run's advice offers "optional … or dropped" (`dry-run.ts:258-260`).
- **A dropped guest link or Retry makes the playback fail.** The playback reaches the wall, or a spinner that never
  clears. Every later checkout step is absent, and nothing in the extension presses a stalled section's Retry: a grep
  of `apps/extension/src/content` for retry handling finds only `extraction/load-retry.ts`, which is for lists.
- Run 5 (`run-munovwp3-d898de74`) is the specimen. Its final draft had no guest step: d23 failed and was not kept. It
  had no Retry, because the slots loaded on a later load of `/checkout`. The debug records "a fresh playback would meet
  the wall".

**Fix spec.**
- #1's `remembered` answer removes the reason to drop these steps: the step passes and stays as written.
- The Retry needs no extension change, provided the step is kept. The link appears about 2 s after the 429, inside the
  5 s default target wait (`domain/src/actions/check-wait.ts:52`).
- *(Not a fix, but a cheaper safety net, if t196's change waits.)* Have the dry-run feedback never suggest dropping a
  step that succeeded live in exploration and now reads `unreproducible` on its own page. That means changing the
  `dry-run.ts:258-260` wording and its test.

**Provider-free test.** Covered by #1's Core verdict test, plus one case: a kept guest-link step that is absent on its
own `/checkout` reads `remembered`, and is neither `unreproducible` nor suggested for dropping.

#### 3. The Lab's judge compares `extract-order` with the Flow's first extraction, not the confirmation read

Owner: **t195** (test-runner).

**Evidence.**
- `packages/test-runner/src/flow-lane/creation/judgement.ts:50` passes `candidateOrder: executionOrder(...)`.
- `flow-lane/expectations.ts:203-206` then pairs the single expected step with `ordered[0]`, which is the extraction
  node that ran first.
- A correct Flow that reads any list before the confirmation therefore fails. Examples: the cart lines (run 16 read
  the cart at iterations 21-31), or the search results (run 5's final draft kept `d8`, a results extraction).
- **Proven** by running the built judge (`dist`, newer than `src`) with the scenario's own workflow:
  - The order record alone gives `holds: true paired: d-order matched: 1`.
  - A cart read first, then the order, gives `holds: false paired: d-cart matched: 0`.

**Fix spec.** In `packages/test-runner/src/flow-lane/creation/judgement.ts`, choose the dataset for the expected
step before calling `judgeFlowExtraction`, and pass it the candidate order that results.
- Candidates are the datasets whose records carry every non-optional key of the expected records. The keys come from
  `expected.records[0]` minus `optionalFields`, read from `workflow.expected.extracted` for `stepId`.
- Among the candidates, take the one whose node ran **last** (`executionOrder`).
- With no candidate, keep today's order.
- Leave `expectations.ts` unchanged; the recorded lane pairs by recording order.
- One check across lanes: for `confirm-requests`, the accepted-list read is the later of two reads with the same keys,
  so "last" is also the right rule there.

**Provider-free test.** `flow-lane/creation/tests/judgement.test.ts` (new or extended) runs `PICKUP_ORDER_WORKFLOW` with
two datasets: a cart read `{name}` that ran first, and the order record that ran second.
- Expect `createdFlowDatasetHolds === true` and the pairing to be the order dataset.
- A second case with the order dataset only stays as it is.
- A third case gives two datasets that both carry the keys, and expects the later one.
- The first case fails today; it is my scratch probe, reproduced.

#### 4. F20 cannot see a swallowed Add to cart press on the product page during the first ~900 ms after load

The press scope of the Add to cart button is the whole `<main>`, so the page's own load-time changes count as an
answer. Owner: **t195** (F20).

**Evidence.**
- `apps/extension/src/content/action-runtime/ignored-press/press-scope.ts:14-37` stops at the first `main` within 4
  ancestors. The button's parent `div.atcBar` is a direct child of `<main>`.
- **Proven** by running `pressScope` on that ancestor chain: it printed `main`. For a slot button it printed
  `section 1. Pickup details`, which is correct.
- Inside `<main>`, the buy-box skeleton is removed at 700 ms and the reviews are appended at 900 ms after load
  (`BB/client/product-script.ts:47,119`).
- A press inside the 800 ms window (`actions/click.ts:116`) that overlaps either change is "answered", so it is never
  pressed again (`click.ts:152`). Before 700 ms, `live.hidden` also drops the press after `wake()` has used the page's
  one wake-up (`product-script.ts:93`).
- In the build the model's latency puts the press well past 900 ms, so F20 fires and the model keeps one press.
- At playback, a Flow node may press within a second of the listing's navigation, unless an optional "close Val" step
  waits first. Then nothing is added, and Place order is refused with "Your cart is empty."
  (`checkout-operations.ts:30`), or the order lacks the towels.

**Fix spec.** In `press-scope.ts`, treat the page's main landmark like `body` and `html`: add `main` to `PAGE_TAGS`, and
role `main` likewise. The scope then stays at the control's own container (`div.atcBar`).
- Also: in `ignored-press-watch.ts` or `click.ts`, if the first press is pressed again and the second press also sees
  nothing within the window, do nothing more. That is already the rule (`MAX_EXTRA_PRESSES = 1`).
- Trade-off to check: a toggle with no request whose only visible change lies elsewhere in `main` would now be pressed
  twice.
  - Bigbox's swatch, slot and radio stay safe: their scope is `pdpLayout`, `section` and `section`.
  - The existing tests under `ignored-press/tests/` must still pass. Add a counter-case there: a press whose own
    container changes is not re-pressed.

**Provider-free test.** `ignored-press/tests/press-scope.test.ts` uses the stub tree of `body > div.page > main >
div.atcBar > button` and expects the scope `div.atcBar`. `ignored-press/tests/` also gets a watch test built from the
same tree:
- It injects a MutationObserver stub that reports a child added to `main > section.reviews` 100 ms after the press.
- Expected: `seen` is empty, so `pressAgain` is true.
- Today: `seen = ["change"]`.

### Risks (they can fail the run, but are not certain to)

#### 5. Three distinct steps are needed for `a1`, `a1.size` and `a2`, and they collide with #1 and #2

Owner: **t174** (`instructed-acts/`, per the fix log's "Owned elsewhere"), or t195 if handed over.

**Evidence.**
- I ran the act reader (§a.17); it found these three.
- `step_claimed_twice` stops Place order from holding both `a1` and `a2` (`check.ts:151`).
- The natural step for `a2` is "Continue without an account", which #1 and #2 force to be optional, and `step_is_optional`
  then refuses it (`check.ts:253`).
- `a1.size` is satisfied by naming any other kept, mutating step. Better still, the open-listing click carries the
  default title "…, 6 Double Rolls" in its identity (`choice-evidence.ts:28-40`), but the model has to name it.
- Run 16 (`run-muny5y17-a927214b`) ended its last two completions on `a1:no_step_named`, then `a2:no_step_named`.

**Fix spec.**
- In `R/flow-bootstrap/instructed-acts/instruction-acts.ts`: a `check out` / `checkout` submit act is the same
  transaction as an earlier `order|buy|purchase` submit act in the same instruction, so drop it.
  - Alternatively, in `check.ts`, exempt a check-out act from `step_claimed_twice` when the step holds the
    order/buy act.
- Before choosing, the worker sweeps the ten scenarios' `live-tasks.ts` for "check out" and pins both directions, as
  that file's header asks.

**Provider-free test.**
- `instructed-acts/tests/instruction-acts.test.ts` on `PICKUP_ORDER` expects one submit act carrying `a1.size`.
  Today there are two.
- Or, in `check.test.ts`, a draft with Place order named for `a1` and `a2`, and the listing click for `a1.size`, gives
  `ok: true`.

#### 6. Brief question: after P1, can the build get past a control it wrongly declared?

**Yes, by the gate's code; the risk is the wording.**
- A decline matches only when the action "still declares every class that was declined" (`R/action-permissions/gate.ts:305-313`),
  and an empty declaration is permitted (`gate.ts:287`).
- So "Continue to checkout" pressed again with `[]` goes through, and so does a navigation to `/checkout`.
- A later "Place order" is a new question that gets asked (`gate.ts:316-342`). After a grant, `move_money` is permitted
  for the rest of the build (`gate.ts:207`).
- `assertGrantedAtPermissionPoint` accepts any grant at the point among the thread's asks
  (`flow-lane/creation/lane.ts:393-405`).

But the model is told only the code `consequences_declined`, with no `instead` (`domain/.../node-run/run.ts:323`,
`press.ts:70`). The reason's documented meaning includes "finish without it" (`tool-rejection.ts:299-302`), which
invites abandoning the order. The build then ends without Place order, and the run fails.

**Fix spec.** When the declined press declared a gated class, set `instead` in the refusal detail to the re-declaration
(for example, "declare only what this press itself does; [] for a press that opens a page"). The file and test depend
on who owns them:
- `run.ts` and `tool-rejection.ts` belong to **t223** until it lands.
- `press.ts` is not t223's.
- The tests are `domain/.../tests/{press,tool-rejection-detail}.test.ts`.

**Provider-free pin (Core, t195).** In `R/action-permissions/tests/gate.test.ts`:
1. Decline "Continue to checkout" `[move_money]`.
2. The same control `[]` is permitted.
3. "Place order" `[move_money]` raises a new request.
4. Grant it; the check permits.

No such case exists today: the decline cases are at `gate.test.ts:198-268`.

#### 7. After 4,000,000 shown characters, Core withholds every name, so Place order is asked unnamed and the Lab denies it

Owner: **t195** (Core `action-permissions`).

**Evidence.**
- `gate.ts:74` is `MAX_SHOWN_CHARACTERS = 4_000_000`.
- `observe` stops recording at the budget (`gate.ts:233-241`), and it is fed every execution
  (`R/flow-bootstrap/action-permissions.ts:204`).
- `carriedName` returns `null` for any name not in the recorded text (`gate.ts:367-368`). L1 then denies the unnamed
  ask (`test-runner/src/person-simulation/permission-answer.ts:55-78`).
- Place order is shown last, so it is the name most exposed.
- Not measured: the size of t223's packets is unknown until t223 lands, and 64 whole-page packets could reach 4 MB.

**Fix spec.** In `gate.ts`:
- Keep shown strings deduplicated: a `Set` of normalised strings, so the header and footer of every page count once.
- When over the budget, evict the **oldest** strings instead of refusing new ones.

**Provider-free test.** In `gate.test.ts`, observe 4,000,001 characters of distinct filler, then observe a packet
holding "Place order". `checkFor` with `controlName: "Place order"` should raise a request whose `control.name` is
"Place order". Today it is `null`.

#### 8. The 3pm–4pm slot (runs 5, 17, 22-24, 27, 29)

**There is no cause in the action path.**
- Run 5's trace shows the model's own decision: click `3pm–4pm` at d35, with 2pm–3pm open, as screenshot t7 shows.
- The press goes to the button the model named. The slot buttons have unique `value` attributes, and the grid is
  static once loaded.

**The causes are in what the model is shown.** Owner: **t223**.
- The packet carries no disabled state. Nothing in `apps/extension/src/content/*.ts` or
  `domain/src/runtime/llm-evidence/{elements,capture}.ts` mentions `disabled`.
- Each of 2pm–3pm to 8pm–9pm appears twice. It gets only `alike i of 2`, because `div.slotGrid` is not a record
  (`identity/record.ts:42-48`), and the day is only in the `h3` above.
- Choosing a slot changes only a class, so neither the model nor any check can see which slot is chosen.

**Fixture test for t223.** Render `pickupSlotsFragment("2291", classes)` (`BB/pages/pickup-slots-fragment.ts`) through the
new page view. Assert three things:
- 11am–12pm, 12pm–1pm and 1pm–2pm are marked disabled or full.
- The first enabled slot under the "Today, Mon, Sep 21" heading is 2pm–3pm.
- The two 2pm–3pm buttons are told apart by their day.

#### 9. The towels saved instead of the soap (runs 23, 25, 30), and a loop over cart lines

**What is known.**
- All three runs started 10:50-11:25Z on 2026-09-30, before D1 (`77b269a2`, 19:41Z) and before t200/t223.
- In `run-muo07nnh-9c8f7e46` the wrong save happened during exploration, by iteration 16.

**Code causes in this tree.**
- `div.cartLine` is not a record (`apps/extension/src/content/identity/record.ts:42-48,311-313`). So the two "Save for
  later" buttons carry no `within` words in the packet, and no `context.record` in a built node. The model tells them
  apart only by `alike` order.
- A For Each over the cart lines would be refused on every row, because the row gate fails closed for "a candidate in
  no record" (`record.ts:168-170,225-229`). The loop's Save for later would fail at playback. The instruction does not
  force a loop, since there is no `save` act (§a.17).

**Routing.**
- Look-alike context from a non-record container goes to **t223**.
- Whether the row-values gate may fall back to the smallest ancestor that holds exactly one such control goes to the
  **F5 owner** (t195).

**Fixture test.** Use the existing stub-DOM pattern: `action-runtime/tests/store-chooser-page.ts`. Build the cart
markup from `renderCartPage` with state `{cart: [soap L1, towels L2]}`, then:
- Resolve a node carrying `record.values: ["ValueRidge Ultra Dish Soap, Lemon Scent, 24 fl oz"]`.
- Expect the soap's Save for later. Today the result is "no candidate".

#### 10. Place order with empty fields (runs 26, 31)

The old path is gone: dry runs no longer run at each completion and leave a reloaded, empty form behind
(`77b269a2`). A refused order after a grant can be recovered: `move_money` stays permitted (`gate.ts:207`), and the
page reloads with its error banner (`checkout-script.ts:50-51`). **No fix.**

#### 11. Two Add to cart presses kept in the Flow

If the build kept both presses (the old F17 advice), then at playback F20 either does or does not fire on the first
press (#4). That gives qty 2, which is $19.24 and quantity "2", or qty 1.
- With F20 firing in the build, the model sees the add after one press and keeps one.
- After #4's fix the outcome is deterministic for one press.
- Risk only. A check worth adding to the lane's debug template: the authored Flow has one `atc` press.

### Brief question 3

**Does the Lab reset the site between the build and the judged playback?** Yes.
- `packages/test-runner/src/flow-lane/creation/lane.ts:319` calls `resetScenarioLab`, which posts to `/__control/reset`.
  The server then calls `store.reset()` (`apps/scenario-lab/src/server.ts:110-112`), which recreates every scenario's
  state through `createState` (`apps/scenario-lab/src/state-store.ts:20-23`).
- The playback therefore meets a fresh state: soap in the cart, no orders, consent and offer pending, the sign-in wall,
  `slotFetches` 0, and the robot-check counter at 0.
- Its order is `2000958-40713` (§a.16).

**Does the playback's Place order need a grant?** No.
- A saved Flow replays with no gate "by design" (`R/flow-bootstrap/adaptation.ts:341-353`).
- The grant is needed earlier, in two places:
  - Core's apply refuses a proposal still carrying an unanswered or declined request (`adaptation.ts:355-363`).
  - The lane applies only after `assertGrantedAtPermissionPoint` finds a grant on Core's own thread record at the point
    on the named control (`lane.ts:292,393-405`).
- Only a repair's exploration is gated during playback (`R/recovery/runtime-exploration.ts:393-433`). L1 answers it by
  the same rule. That path still treats a "no" as silence, which is lane B's.

## (c) Causes that belong to other lanes

| # | Cause | Owner |
| --- | --- | --- |
| 1, 2 | The dry run against remembered and post-order state (re-anchor, `remembered`, the withheld-created excuse) | t196 |
| 5 | Check-out and order as two acts; optional steps cannot hold an act | t174 (`instructed-acts/`) |
| 6 (wording) | `instead` on `consequences_declined` in `node-run/run.ts`, `tool-rejection.ts` | t223 until it lands, then t195 |
| 8 | Disabled state, day context for duplicate slot labels, selection state in the view | t223 |
| 9 (view half) | `within` for look-alikes in non-record containers | t223 |
| — | The repair path's decline handled as silence (`recovery/runtime-exploration.ts`) | lane B |

This lane's own fixes: #3 (test-runner), #4 (extension F20), #6 (Core pin test), #7 (Core gate), and #9's record-gate
half (extension identity).

## What changed and why

Only this report was written. No source, test or shared document was edited.

## Commands run and observed results

- **Core act reader.** I bundled a scratch `scratchpad/w19b/acts.ts` that imports
  `R/flow-bootstrap/instructed-acts/instruction-acts.ts`, using Core's esbuild, and ran it with `node`.
  - It printed `a1` submit "order", `requires [{ id: "a1.size", choice: "variant", value: "6 Double Rolls" }]`.
  - It printed `a2` submit "check out", quote "Check out as a guest as Dana Whitfield, … and pay at pickup".
- **Lab judge.** `node scratchpad/w19b/pair.mjs` imports `packages/test-runner/dist/flow-lane/creation/judgement.js`
  (built Sep 30 13:09, newer than `src` from Sep 29) and `apps/scenario-lab/dist/.../manifest/index.js`.
  - `order read only -> holds: true paired: d-order matched: 1`
  - `cart read first, then order -> holds: false paired: d-cart matched: 0`
- **F20 press scope.** I bundled `scratchpad/w19b/scope.ts`, which imports the extension's `press-scope.ts`, with stub
  elements for the bigbox ancestor chains.
  - `Add to cart press scope -> main (holds the buy box skeleton, reviews, rail)`
  - `slot press scope -> section 1. Pickup details`
- **Git facts.** `git log` on `R/flow-draft/verify-only.ts` gives D1 at `77b269a2 2026-09-30 12:41:17 -0700`. The
  bundles' `run.json` give the towel runs' start times: 10:50:51Z, 11:10:25Z and 11:25:00Z.
- Everything else was reading code: grep, sed and cat. No Lab, no browser, no build, no model call, and no file in
  either tree was changed.

## Not verified

- **#1's outcome.** I did not run a dry run, so the post-order sequence is read from code. The exact `replay.from` values
  the domain writes for a click on the Added panel versus the product page come from reading `node-run/replay.ts:70-86`,
  not from running it.
- **#4's timing at playback.** I did not measure when a Flow's Add to cart press lands after the listing navigation, so
  how likely the miss is remains open. The cause, the press scope plus the page's timers, is proven.
- **#7's packet sizes** after t223: unknown.
- **#8 and #9.** No packets survive from runs 5, 17 and 22-30: the trace has no content and `decision-dumps/` is empty.
  The view-side causes are what the current code allows, not what those runs saw.
- **The extraction field mapping on the confirmation page.** I did not check whether the model's `extract_list` can
  address the inner spans ("2000958-40713", not "Order# 2000958-40713"; "1", not "Qty 1"). That depends on t223's view
  and `extraction/infer-fields.ts`. I name it as a risk for t223's fixture work: run structure detection over
  `renderOrderPage`'s markup.
- **The robot check** during the build's dry runs: the third results load since the Lab start. At playback it cannot
  occur.

## Open questions or contradictions found

- **One grant permits money for the rest of the build** (`gate.ts:207`). A live repair after a refused dry run can
  place further real orders without asking. This does not affect the judged playback, because of the reset. Whether
  "ask before every move-money act" (F10) should hold per press within a build is a supervisor decision.
- **A comment that does not match the code.** `run-scenario.ts:289` says "Runs before every Flow run and every
  exploration. The reset and any arm are server-side", but no reset call sits there. For the created lane the reset is
  `lane.ts:319`, and only before the playback. The build relies on the Lab starting with a fresh store
  (`state-store.ts:10`).
- **A stale task comment.** `BB/live-tasks.ts:15-19` says the lane "judges only the record today".
  That is stale since L1 and the honest verdict, but harmless.
