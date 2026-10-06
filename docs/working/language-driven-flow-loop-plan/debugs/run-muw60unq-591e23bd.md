# Run debug — run-muw60unq-591e23bd (lane A, t262-slot-2)

Written as `run-pending-t262-slot-2-a.md` before launch and renamed when the Lab assigned the id. Everything in
"Expectations" was written before launch.

## Header

Lane A, Phase 1 live round on the fully integrated source. Task
`crossborder-marketplace-hub-to-cart` (scenario `crossborder-marketplace`,
kind form, judged by playback goal `hub-in-cart`). Instance `t262-slot-2`,
slot 2, persistent workspace `t262-a`, tree
`fxwork/t262/!FluxIQWebExtension` at efaf2034 (dev ffd10491 differs only in
docs), Core `fxwork/t262/!FluxIQ` at a83b1471 = Core dev. Previous pass on
older source: run-mutepu6b-656f8882 (2026-10-04, $0.0566, 45 priced rows).

## Expectations (written before launch)

Instruction, verbatim (219 characters, sha256 2e6f5e7d…a3a405):

> On Farbazaar, put three of the Voltbay USB-C hub sold by Voltbay Official
> Store in my cart: Space Grey, the 7-in-1 version, shipped from Spain.
> Collect that store's coupon while you are on the item. Do not buy anything.

Command (the campaign's, from the dry-run; `--max-attempts 1` so no second
paid attempt can start):

```text
FLUXIQ_LAB_INSTANCE=t262-slot-2 FLUXIQ_TEST_ENV_FILES=none
pnpm.cmd lab:campaign crossborder-marketplace-hub-to-cart --max-attempts 1 -- --target persistent-isolated --workspace t262-a
→ pnpm lab run crossborder-marketplace --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task crossborder-marketplace-hub-to-cart --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48 --target persistent-isolated --workspace t262-a
```

Lab dry-run plan: lane created-flow, buildEntry chat, target
persistent-isolated, model deepseek-flash (coreDefaultModel deepseek-flash),
purpose build_and_adapt, maxCalls 48, maxEstimatedCostUsd 0.1 per build,
permittedConsequences [] (a chat build carries no permit; the Lab's person
answers any question in the chat), credential DEEPSEEK_API_KEY from
`.env.local`. No output cap, no guard override.

Actions a correct Flow takes, in order:

1. Navigate to the Farbazaar start page.
2. Clear the cookie/consent layer (and any chat or promo overlay) that covers
   the search box; a covered target must be handled, not retried blindly.
3. Search for the Voltbay USB-C hub and open the item sold by Voltbay
   Official Store (not a sponsored or other-store listing).
4. On the item: select Space Grey, the 7-in-1 version and ships-from Spain.
5. Collect the store's coupon (a page-busy refusal may need one wait/retry).
6. Set quantity to 3 by actually changing the quantity control.
7. Press the item's own Add to cart (not Buy now), once.
8. Never open checkout or place an order.

The saved Flow must hold executable steps for 1-7 (including the overlay
dismissal it needs) and no checkout step; quantity must be a real performed
setting, not a claim attached to another control.

Exact oracle facts (playback goal `hub-in-cart` plus final state):

| Fact | Subject | Expected |
| --- | --- | --- |
| cart-line | mini-cart-line text | the Voltbay hub line: Voltbay Official Store, Space Grey, 7-in-1, ships from Spain, qty 3 |
| store-coupons | coupon flyout text | Voltbay Official Store coupon collected |
| cart-count | mini-cart-count | 3 |
| orders-shipped | orders summary | 0 |

Known fixture trait: the header badge is stale by design (only the flyouts
refresh); judge the cart by the four DOM facts, not the badge image.

Wrong plausible answers: coupon but empty cart; wrong store, colour, version,
origin or quantity; quantity 1 with a "3" claimed; a cart claim attached to an
option control; Buy now pressed; an unfinished draft called a saved Flow.

Cost expectation: under the $0.10 per-build ceiling (previous pass $0.0556
for the build); at most 48 logical build calls.

UI checkpoints (from screenshots and step logs):

- U1 Build start: the instruction typed into the real extension chat as a
  user turn; composer at the bottom; no split screen; no getting-started
  screen.
- U2 Mid-build: one assistant message per step with its reasoning; each
  action as a card with a kind icon, target and outcome; no generic
  "looking at page" headings; no raw tool ids; no flicker.
- U3 On-page overlay: visible on the automated Farbazaar page whenever
  FluxIQ is working, with stable status text.
- U4 Build ending: a clear, honest ending message (Flow saved and tested, or
  why not) with no contradiction between chat, overlay and run result.
- U5 Playback: run status and the finished state shown; Add to cart Done.
- U6 Any refusal or permission card worded plainly.

Replays (only on a pass): two `lab replay` runs on workspace `t262-a`
with the built project and Flow ids, no provider key in the environment,
each with zero provider calls, zero interventions, zero harness
activations, unchanged Flow content hash and all four facts held.

## Result

FAILED. `run-muw60unq-591e23bd`, launched 2026-10-06T04:14:46Z (guard
admitted, fingerprint sha256:5afb5722…), Lab verdict failed,
`runtime.behavior`, `lab.chat_build_failed`, flowCreated false, oracle not
measured (no playback), harnessActivations 0, 377.9 s. One person hand-off at
the traffic screen during the build, cleared in 3.6 s. Launch log:
`test-runs/instances/t262-slot-2/launch-9.log` (ignored). Not relaunched.

Cost: 36 priced calls, $0.045303396 in total. The build was 35 calls at
$0.045213738 (explore 18 / $0.027877, repair 11 / $0.013751, judge 6 /
$0.003585), under the $0.10 per-build ceiling (overCeiling 0), plus the chat
read (1 call, $0.000090). Ledger finish line written, balanceFailure null.

## Stages 1-2: instruction, exploration and every priced question

Acts the reader gave the model (first decision request,
`steps/0003-decide/request.txt`): `a1` put (quote ends "...shipped from
Spain") with choices `a1.quantity` three, `a1.colour` Space Grey, `a1.version`
7-in-1; `a2` collect coupon. **There is no choice for "shipped from Spain".**

| Step | Decision | Result |
| --- | --- | --- |
| 0002 | navigate start | succeeded |
| 0003/0004 | click cookie layer (t475), add | target_covered |
| 0005/0006 | close welcome popup × | succeeded |
| 0007/0008 | type "Voltbay USB-C hub", submit | succeeded |
| 0009/0010 | open the Voltbay Official Store item, add | succeeded (traffic-screen hand-off) |
| 0011/0012 | Accept all on the consent layer, add | succeeded |
| 0013/0014 | Space Grey, act a1.colour | succeeded (un-chose the preselected colour) |
| 0015/0016 | Space Grey again, add, a1.colour | succeeded |
| 0017/0018 | 7-in-1, add, a1.version | succeeded |
| 0019/0020 | Get coupons, add, a2 | refused_by_page page_busy_try_later |
| 0021/0022 | Get coupons again, add, a2 | succeeded |
| 0023/0024 | amend drop steps 7, 8 | refused already_out |
| 0025/0026 | amend add step 9 a1.colour, step 11 a2 | partly applied (11: act_already_named) |
| 0027/0028 | amend keep 9, 11 | refused act_already_named |
| 0029/0030 | type 3 in quantity, add, a1.quantity | succeeded |
| 0031/0032 | Spain click with consequences inside parameters | invalid_input unexpected_input_keys |
| 0033/0034 | **Spain (t958), add, act a1** | succeeded (draft step d14) |
| 0035/0036 | **amend step 14 keep a1 + rerun with Add to cart (t1008)** | applied: d14 is now Add to cart; the Spain click is gone |
| 0037-0042 | rerun of d14 from the item page | verified (withheld, lasting) |
| 0043 | complete | full test 0044-0053 |
| 0054/0055 | creation judges | no: Ships From China, Spain unmarked |
| 0056-0058 | repair 1: Spain (t958), add, act a1 | succeeded; a1 moves to the new step |
| 0059/0060 | **drop "now-empty step 9 (Add to cart)"** | applied: d14 (Add to cart) dropped |
| 0061/0062 | drop step 9 again | refused already_out |
| 0063 | complete | full test 0064-0073: Spain step only **verified** (claims a1, lasting) |
| 0074/0075 | judges | no: Spain withheld, nothing in cart |
| 0076-0080 | repair 2: Add to cart (t1008), add, act a1 | succeeded live (cart 3, China origin) |
| 0081/0082 | **drop "leftover step 9 (Spain click)"** | applied: Spain step d16 dropped |
| 0083/0084 | drop step 9 again | refused already_out |
| 0085-0088 | find "Cart", "Cart (3)" | inspect |
| 0089 | complete | full test 0090-0099: no Spain step |
| 0100/0101 | judges | no: Ships From China; the no-progress guard ends the build |

## Stage 3: proposed and saved Flow

No Flow was saved as usable; the draft "Add 3 Voltbay USB-C hubs to cart"
keeps the instruction. The last tested draft (9 steps): navigate, close
welcome ×, search, open item, Accept all, 7-in-1, Get coupons (verified),
quantity 3, Add to cart (verified). No Spain step.

## Stage 4: tests

All three full tests ran the same shape: reset, then 9 steps. Test 1 (0044)
and test 3 (0090) had no Spain step. Test 2 (0064) had the Spain step at
0073 in `replay: verify` mode: it was checked, not pressed, because the step
claimed the lasting act a1, so Ships From stayed China. 7-in-1 (a1.version)
and quantity were performed in every test.

## Stage 5: answer

None: no playback, so the four oracle facts were not measured. Exploration
did put 3 China-origin hubs in the run's own scenario cart (0080, live). The
scenario server is per run, so this changes no later run.

## Stage 6: judges and the cause

All six judges were correct and consistent: the end view showed Space Grey,
7-in-1, quantity 3 and the coupon Collected, with Ships From still China.

**Cause in source (Core).**
`packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/instruction-choices.ts`
reads quantity and the size/colour/version variants as choices, but has no
form for "shipped from <Place>". The Spain press therefore has no choice id
to claim. The model claimed it for the add itself (a1), against the prompt's
"never claim the parent act for preparation", and three effects followed:

1. The Spain press and the Add to cart press compete for the one a1 claim.
   Each new step that claims a1 takes it, and the model drops the other step
   as "no longer doing an act" (0035 retargets Spain into Add to cart; 0059
   drops Add to cart; 0081 drops Spain).
2. As an a1 step, the Spain press is withheld in the build test (verify
   only), so Spain is never chosen even when the step is present (0073).
3. The check counts 5 things asked, not 6, so "5 of 5 have a step" is
   reported while the origin is missing, and the stall guard sees no
   progress.

The 2026-10-04 pass (run-mutepu6b) had the same missing choice and passed by
the model's luck in ordering, not by design.

**Failing test, then the fix (uncommitted, in the lane tree's Core
`fxwork/t262/!FluxIQ`):**

- `.../instructed-acts/tests/instruction-choices.test.ts`: the two
  crossborder rows and the no-cap row expect `a1.origin` "Spain"; a new row
  reads "ships from the UK" as origin "UK"; a new negative row reads nothing
  from "shipped from the warehouse". Before the fix: 4 of 28 failed
  (expected `a1.origin`, got none).
- `.../instructed-acts/instruction-choices.ts`: a closed `ORIGIN` form,
  `(shipped|ships|dispatched) from [the] <capitalised place, up to 3 words>`,
  read as a variant choice with id word `origin`. Choice ids are not lasting
  acts (`action-permissions.test.ts`: "a1.colour" gives []), so the Spain
  press can claim `a1.origin`, is performed in the build test, and no longer
  competes with the cart press for a1.
- `.../instructed-acts/tests/check.test.ts`: the honest HUB draft names its
  Spain step d7 for `a1.origin` (the draft already held it).

Validation (observed): `pnpm.cmd exec vitest run` on instructed-acts/tests,
flow-bootstrap/tests/action-permissions.test.ts,
llm/node-tools/tests/lasting-acts-build.test.ts and
service/tests/instruction-authority.test.ts, which are every Core test using
this instruction: 11 files, 298 passed, 0 failed. `pnpm.cmd run check` (Core
fluxiq `tsc --noEmit`): exit 0.

Not addressed (noted for the supervisor): a tool_call `add` with an act
already claimed by another step moves the claim silently, while amend_draft
refuses the same thing (`act_already_named`). That inconsistency let the
model orphan steps. It is not needed once the origin has its own id.

## UI review (11 moments, side panel and page)

- U1 start (01): the panel first showed the persistent workspace's earlier
  thread, ending in raw codes ("flow_bootstrap.blank_target_required
  (pre_provider_validation: ...)") from an earlier session, before the Lab
  moved to the new project. By 02 the new project chat holds only the user
  turn, with "Sending your message". The composer is at the bottom, with no
  split screen.
- U2 mid-build (03-10): each step is its own assistant message, with the
  model's reason and an action card with icon, target and outcome ("Done",
  "Working on it", "Already done on the site"). Test steps read "Testing:
  Click · ...". The robot check appears as a card ("Done. You pressed
  Continue."). **Defect:** the amendment card reads only "Edit the Flow ·
  Done" (07). It does not say what changed, and here that edit removed the
  Add to cart step. A person watching cannot see the build dropping the
  cart press. Cards must name the change ("Removed step 9: Add to cart").
- U3 overlay: absent at 01 and 02 (02 is the chat read at 04:18:35, before
  any page work). Visible 16/16 at every later moment, and its text matches
  the panel status. The detector's "flickering" at 04, 05 and 07 is three
  real status changes in 3 s, each held 0.6-1.4 s, not a visual flicker. At
  05 the overlay showed the model's own sentence "Adding the Add to cart
  press ... Spain hubs ..." while it was overwriting the Spain step, so the
  text was untrue at that moment.
- U4 ending (11): the overlay reads "Couldn't fix your Flow · Build stopped:
  the Flow is not finished yet". "fix" is the wrong word for a creation
  build. The chat ending is honest but not chat quality: one long paragraph,
  a judge quote cut mid-word ("No step select..."), a raw handle "(t958)"
  shown to the person, and "5 of the 5 things you asked have a step" said
  twice.
- U5 playback: none.
- U6: the refusals on the page (target covered, page busy) appear as "that
  didn't work, trying another way", which is plain and adequate.

Replays: not run (no accepted Flow).
