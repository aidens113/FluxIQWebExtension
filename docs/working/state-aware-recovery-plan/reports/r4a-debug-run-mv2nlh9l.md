# R4a debug: run-mv2nlh9l-52e476da

Read-only debug of the paid live run R4a. No product code was changed.

- Run: `run-mv2nlh9l-52e476da`, crossborder-marketplace, task
  `crossborder-marketplace-hub-to-cart-flash-deal-during-build`, variant `flash-deal`, candidate authoring
  mode, deepseek-flash.
- Trees: Core `3b54f5b0`, downstream `5a02110f` (`C:/Users/osrs_/FluxStuff/fxwork/t418/`).
- Evidence: `fxwork/t418/!FluxIQWebExtension/test-runs/instances/t418-proofs/run-mv2nlh9l-52e476da/`
  (steps 0001-0068, `logs/core.log`), the UI review `.ui-review.local/` and its `.json`, and the launch log
  `scratchpad/r4a-2.log`.

## Outcome

The verdict is failed and no Flow was created. The run spent $0.0525 of the $0.10 ceiling on 34 model calls.

**How far it got:** exploration reached every control the task needs and acted on each one: it closed the flash
deal, accepted the cookies, collected the coupon, set Space Grey, 7-in-1 and Spain, and added the item to the cart.
Revision 3 of the candidate script passed static checks. One trial ran from a reset start, and its first 8 nodes
succeeded, including the coupon and all three options. Node 9, "set the quantity to three", failed with
`web.target.not_found`. The model never retested and never resubmitted. It spent 15 more decisions hunting a
"current handle" for the quantity field and trying to clear it, and the third repeat refusal in a row ended the
build. The judge never ran and nothing was promoted.

## Decisive cause

**The candidate's quantity step addressed its field by an id the page mints again on every load.**

1. The scenario's quantity input carries `id="${rotatingId(state, "qty")}"`. That is an FNV hash of seed, view
   count and key, written `fb<base36>` (`apps/scenario-lab/src/scenarios/crossborder-marketplace/markup/shell.ts:41-47`,
   `markup/item.ts:60`). It is a deliberate hostile feature ("a Flow that does fails on the next load"). The input
   has no `<label for>`, no `name` and no test id. The "Quantity" beside it is a sibling `<div>`.
2. When exploration bound handle t964, the extension's `selectorFor` used the id as the element's first anchor:
   `#fb1l6ufkg`. `elementAnchors` (`apps/extension/src/content/selector/element-anchors.ts:46`) refuses an id only
   when `isVolatileIdentifier` says it is generated.
3. `isVolatileIdentifier("fb1l6ufkg")` returns **false**
   (`apps/extension/src/content/selector/volatile-identifier.ts:139-144`, `isOpaqueToken`). Two rules let it through:
   - only 2 of its 9 characters are digits, which is under `MIN_DIGIT_SHARE` 0.25 (line 89);
   - `ufkg` matches `LETTER_RUN` (`/[a-z]{4,}/`, line 83) and holds a vowel, so it counts as a "word".

   The id the trial page drew next, `fb8y7yz1`, returns true. A probe copying the rule
   (`scratchpad/r4a-volatile-probe.mjs`) found that **1053 of 1960** of the scenario's rotating ids are not judged
   volatile.
4. The trial reset reloaded the page, so the id became `fb8y7yz1` (seen by `web.describe_element` on t964 after
   the trial, step 0050). The step's `expected` reads "an element matching selector #fb1l6ufkg, element fingerprint,
   …". The selector matched nothing. The identity fallback then scored the 3 same-family controls with the stale
   selector still in the fingerprint, because `apps/extension/src/content/identity/score.ts:264-273`
   (`comparableIdentifier` / `comparableSelector`) drops an id or selector that no candidate carries **only when its
   shape is judged volatile**. Core charges a contradicted identifier -0.8 at weight 26. The input has no visible
   text, because content tags drop it, so the best candidate scored 0.27, which is under the floor. The step failed
   after 4 attempts and 3750 ms of waiting (step 0038).

The other steps survived for a reason. The swatches, the chips and "Close" carry visible text ("Space Grey",
"7-in-1", "Spain"), and that outweighs a contradicted selector. A text input carries nothing else, so its id
decided everything.

### Where to change it

- **Primary, structural:** `apps/extension/src/content/identity/score.ts:264-273`. Drop a recorded id, or a selector
  quoting an id, when **no candidate on the page carries that token, whatever its shape**. The module's own comment
  already argues this ("Only a token the page no longer holds anywhere is set aside"). Gating that on the shape
  guess is what failed. The floor, the margin and `corroboration.ts` still guard against a wrong winner.
- **Also:** `apps/extension/src/content/selector/volatile-identifier.ts:139-144`. Widen the opaque-token rule. A
  probe rule, "an alphanumeric segment of 6 or more characters with 3 or more letter/digit alternations", catches
  `fb1l6ufkg` and none of the test file's AUTHORED examples, plus `mp3player`, `ipv4addr` and `x86-64`. It still
  catches only 57% of the scenario's ids, and 7% of them hold no digit at all. **No shape rule can be complete**,
  which is why the score.ts change is the one that matters.
- **Optional domain backstop:** `domain/src/runtime/llm-evidence/plan-resolution/element-identity.ts`
  `webPlanElementIdentityAcrossViews`. When a newer view of the same handle differs only by the id token, that is an
  observed rotation. Record it and drop the id instead of replacing the identity whole.

The same scenario puts rotating ids on the search field (`shell.ts:87`, which also has `name="q"`, but the id
anchor is tried first) and on the three sku groups (`item.ts:57-59`). Any Flow that types into the site search
inherits this defect.

## Secondary causes

1. **The model hunted for a handle that had not changed (15 decisions, $0.0219, 42% of the spend).** The trial
   feedback named a CSS selector (`#fb1l6ufkg`) and "best scored 0.27". The model read that as "t964 is stale",
   even though `find_on_page` (0042) and the snapshots (0048, 0056) all printed `t964 field "Quantity"` again. It
   ran `find_on_page "Quantity"` 3 times (2 refused `already_answered`), `capture_snapshot` 3 times and
   `describe_element` 3 times, then `dom-clear` on t964 four times. The feedback never says what it could have
   said: the control is still on the page under the same handle, and the Flow named it by an id the page replaced.
   The trial also labels the step `retryable: true`, and the Core instruction (`flow-bootstrap/candidate/trial-gate.ts:64`)
   says "test this same revision again". A retest of the frozen `#fb1l6ufkg` selector can never pass, so that
   advice is wrong for this failure.
2. **`dom-clear` cannot be observed on this field.** `client/item-script.ts:120` handles `change` with
   `setQuantity(quantity() || 1)`, so a cleared box goes back to "1". The clear ran, the value read "1" again, and
   the result was `output_not_observed` (0054, 0062). The model then sent the identical clear 3 more times
   (0063/0065/0067), and `llm_evidence_loop.repeat_refused` ×3 ended the build (`maxRefusedInARow` 3). It never
   tried `dom-type` with "3", which replaces the value. When the build stopped it still had 16 decisions and
   $0.0488 left.
3. **Handle mistakes in the cookie step.** Submission 1 used `t1036`, which no view printed
   (`web.handle.unknown`, line 10). Submission 2 used `t1034`, the banner's text (`web.handle.not_a_control`).
   Submission 3 resent submission 1 word for word (`repeat_refused`, refusedInARow 1). Submission 4 dropped the
   step because "the banner is already gone". The right control was `t1041` "Accept all", which the model itself
   pressed at 0018. The trial got through anyway because the extension's interference clearing closed the banner
   ("Closed 2 notices the page put in the way").
4. **Weaker script choices that did not cause the failure:**
   - The coupon step is `optional: yes`, although the instruction depends on it. That is against the format text.
   - Exploration added to the cart once at quantity 1 and never ran the quantity step. It was written blind.
   - Two decisions came back as `kind: "callId"` (0011, 0039 → `llm_output.invalid_evidence_decision`), each costing
     one decision.

## Exploration (steps 0002-0028)

| Step | Act | Result |
| --- | --- | --- |
| 0002 | navigate start (initial) | ok; home page covered by layer t476 (welcome coupons) |
| 0004 | click t475 (cookie) | `target_covered` by the welcome layer |
| 0006 | click t478 × (welcome) | ok, welcome popup gone |
| 0008 | type t8 "Voltbay USB-C hub" + submit | ok |
| 0010 | click t647 result | ok, item opened **in a new tab** (`/item/1005008123450`) |
| 0012 | (invalid decision `kind: callId`) | refused |
| 0014 | click t1041 Accept all | `target_covered` by the Flash Deal layer t1046 |
| 0016 | click t1048 Close (Flash Deal) | ok, "⚡ Flash Deal … Hubsmith 8 in 1 … 40% off" gone |
| 0018 | click t1041 Accept all | ok, banner gone |
| 0020 | click t934 Get coupons | ok, "Coupon collected" toast |
| 0022 | check t940 Space Grey | already chosen, nothing pressed |
| 0024 | check t951 7-in-1 | ok |
| 0026 | check t958 Spain | ok, stock "4 pieces available" |
| 0028 | click t1008 Add to cart (create_new) | ok, "Added to cart!"; recovered on attempt 2 after the clearing closed 1 dialog (the store chat) |

**Flash deal:** the model met it on the item page (view 12, covering 51 elements) and closed it itself with the
deal's own Close. The extension's interference clearing did not close it first. The cookie press was refused
`target_covered` with closeWith, which worked as designed. The clearing acted only on the add-to-cart press, where
it closed the store chat.

## Submissions

| # | Step | Result | Refusal and line | Fixed? |
| --- | --- | --- | --- | --- |
| 1 | 0029/0030 | refused, rev 1 | `web.handle.unknown` + `:target`, line 10, t1036 | no (wrong replacement) |
| 2 | 0031/0032 | refused, rev 2 | `web.handle.not_a_control` + `:target`, line 10, t1034 | no |
| 3 | 0033/0034 | `repeat_refused` (same as #1 word for word) | same as #1 | no |
| 4 | 0035/0036 | **ok, rev 3**, digest `2c24e235…` | none | dropped the step |

The script for revision 3 has 8 steps:
1. navigate to `/item/1005008123450`
2. click t1048 (Close the flash deal, optional)
3. click t934 (coupon, optional)
4. check t940
5. check t951
6. check t958
7. type t964 "3"
8. click t1008 (create_new), with `done when: text t1099 contains "Added to cart"`

It uses no parts, `call:`, `start at:`, checkpoints or `on <event>` handlers.

## Trial (0038, 37.7 s, start `reset`)

| Node | Step | Result |
| --- | --- | --- |
| 1 | open item page | succeeded |
| 2 | close flash deal (optional) | succeeded, control "Close" |
| 4 | collect coupon | succeeded on attempt 2. Absorbed `web.action.rate_limited` (the scenario's coupon fails its first claim with "Network busy" by design, `item-script.ts:11`), waited 250 ms |
| 6-8 | Space Grey, 7-in-1, Spain | succeeded |
| 9 | type quantity | **failed**, `web.target.not_found`, 4 attempts (0.25/1/2 s waits), "3 control(s) of the same family; best scored 0.27" |

Nodes 3 and 5 are merges after the optional steps. Verdict `execution_failed` (`candidate.execution_incomplete`),
`retestsLeft` 2. The trial never reached "Add to cart", so the `done when:` fact was never used. During the
quantity step the interference clearing closed 2 notices; the cookie banner shown at the reset in moment 5 is gone
by moment 6.

## Judge, promotion and ending

No judge verdict: the trial failed in execution. No promotion. At 17:17:53 Core threw
`AutomationStudioFlowBootstrapGenerationError` after the third repeat refusal in a row (0068). The chat's final
message:

> The build failed: it kept trying without getting any further, so it was stopped. I kept the latest version of
> the Flow's steps that I wrote as a draft, but nothing was put into the Flow. A version of it was test-run from the
> start once, and that test run did not get to the end. …

## Cost and calls

34 calls, $0.05252. Input was 811,781 tokens, of which 488,832 (60%) hit the cache; output was 4,352 tokens.

| Phase | Calls | Cost |
| --- | --- | --- |
| chat routing (0001) | 1 | $0.00016 |
| exploration (0003-0027) | 13 | $0.0226 |
| submissions and trial (0029-0037) | 5 | $0.0079 |
| after the trial, no progress (0039-0067) | 15 | $0.0219 |

The prompt grew from 17.0k to 29.1k input tokens per call. No call came near the ceiling.

## Did the state-aware features play a part?

No, not in the failure.
- **Grammar refusals:** none. All three refusals were handle refusals, plus one repeat.
- **Parts and handlers:** the model used no part, `call:`, handler, checkpoint or `start at:` syntax. Its only new
  construct was `done when:` on the add-to-cart step. It was accepted (t1099 bound to view 25), but the trial never
  reached that step.
- **Requirement gate:** no gate refusal appears.
- **Facts:** none were evaluated, for the same reason.
- **Guidance text:** the new section ("A part is steps…" through the handler rules) is about 3.1k characters, about
  750 tokens per decision. That is about 25k input tokens over the run, mostly cached, roughly $0.001-0.002. It did
  not cause the failure.
- **What the task called for:** one interruption at one place, which the model correctly wrote as an `optional: yes`
  step. A `before everywhere` handler was not needed.

## UI review (10 moments)

1. **start, panel:** shows the yellow card "FluxIQ needs a model key before it can build. Add one in FluxIQ." The
   build then ran with a key, so the warning was wrong at that moment and confusing. Overlay absent, which is
   correct.
2. **mid-build, overlay** "Starting…" → "Building your Flow | Opening where the Flow starts". **Panel:** the user's
   message, "Starting…", and a Stop button. Fine.
3. **Overlay** "The AI model's answer didn't make sense, so FluxIQ is asking it again. If that keeps happening, the
   build stops." This is internal detail on the page overlay. **Chat:** "Click · Accept all — Didn't work: a popup
   or banner on the page was covering it" is clear. **Scenario:** flash deal, cookie banner and the "Never miss a
   price drop" notice are all up. The overlay sits bottom-left over the gallery and covers no control the build
   used.
4. **Chat cards** "Tick · Space Grey", "Ticking “7-in-1”". "Tick" is the wrong verb for a colour swatch or a size
   chip; "Choose" would fit.
5. **Chat:** "Change the Flow · Not done: the same Flow was sent again unchanged" reads well. A **"Test run" card
   shows no status line** while the test runs. "Saving the Flow's steps — …I drop that optional step and resubmit
   the Flow" says "resubmit", which is internal wording. **Overlay** "Testing your Flow · Step 1 of 8", consistent
   with the 8 script steps (Core's feedback counts 9 because it includes merge nodes, but this is never shown).
6. **Chat:** "Type · set the quantity to three — Didn't work: **it wasn't on the page**". **This is wrong.** The
   scenario screenshot shows the Quantity box plainly on screen at that moment; the step had named it by an address
   the page had replaced. Then "Closed 2 notices the page put in the way" and "Trying the step again — a step like
   this often works on a second try". The overlay says the same.
7. **Chat:** "Trying again didn't help — … so the test follows what the Flow says to do when this step fails." The
   Flow said nothing about this failure, and the test simply ended, so the sentence promises a branch that does not
   exist. The model's summary "The quantity field **handle** failed in the trial; I will re-read the item page to
   find the current quantity input **handle** before **resubmitting**" leaks jargon into the person's chat.
8. **Chat:** "Clear field · Quantity — Didn't work: **the step wasn't accepted**". This is misleading: the clear ran
   and the page put "1" back. "Wasn't accepted" sounds like a permission refusal. "Reading the details of
   “Quantity” — This is exactly the step it had already tried, so it was not done again" is clear.
9. **Overlay** "Build failed". **Chat:** two "Clear field · Not done: it was already tried exactly this way and did
   not work" cards, then the final message.
10. **failure:** the overlay reads only "Build failed" with no reason; the reason is in the chat alone. The final
    message is honest and plain. It never says which step failed or why ("the quantity box"). The scenario shows
    the Quantity box focused at "1", the cart at 0, and the price-drop notice still open.

## Commands run and observed results

- Read `steps/index.md`, every `decide/response.txt`, and every tool `call.json`/`result.json`; summarised with
  inline python.
- `node scratchpad/r4a-volatile-probe.mjs` printed:
  - `fb1l6ufkg false`
  - `fb8y7yz1 true`
  - `rotatingId values not flagged volatile: 1053/1960`
- `node scratchpad/r4a-alternation-probe.mjs` printed:
  - every AUTHORED example false
  - `rotating ids caught by alternation rule: 3349/5880; ids with no digit at all: 431`
  - `fb1l6ufkg true`
- Viewed panel screenshots 01-10 (not 09 scenario) and scenario screenshots 03, 05, 06, 10.

## Not verified

- **Build-time locator:** the plan's stored locator for t964 is not dumped in the run. `#fb1l6ufkg` comes from the
  trial feedback, and the absence of name or label strategies is read from its `expected` text.
- **0.27 score:** I did not re-run the matcher. That the stale selector caused it is inferred from `score.ts` and
  Core's -0.8×26 weighting described there.
- **Fixes:** neither recommended fix was tested. Whether dropping the absent id alone lifts the right input above
  the floor depends on the page's computed name for that input. The page infers "Quantity" as its label, but its
  computed accessible name may be empty.
- **Trial notices:** which 2 notices the trial's clearing closed is not shown in the evidence.

## Open questions or contradictions

- `retryable: true` on a `target_not_found` whose frozen selector cannot match on any reload contradicts the
  "test this same revision again" advice. Should retryability come from whether the selector's token is still on
  the page?
- At start the panel said a model key was missing, yet the build ran. Is that check stale?
