# Run debug — run-muxkzdjw-31a13429 (lane A round 4, t262-slot-2)

Written as `run-pending-t262-slot-2-a-r4.md` before launch; renamed to the run id when the Lab assigns it.
Everything in "Expectations" was written before launch (2026-10-07 ~03:40 UTC; launch not before 04:00 UTC).

## Header

Lane A, Phase 1 live round 4. Task `crossborder-marketplace-hub-to-cart` (scenario `crossborder-marketplace`, kind
form, judged by playback goal `hub-in-cart`). Instance `t262-slot-2`, slot 2, persistent workspace `t262-a`, tree
`fxwork/t262/!FluxIQWebExtension` at 5cad8286 (= dev), Core `fxwork/t262/!FluxIQ` at ffbdea7e (= Core dev). Both trees
clean before launch (`git status --short` empty in both, 03:36 UTC). Previous lane A runs: round 1
`run-muw60unq-591e23bd` (origin unread; fixed), round 2 `run-muwaobm2-882cadd9` (amend/rerun loop; fixed), round 3
`run-mux6n7m4-8273e7a0` (passed, leaning on latent F1) and `run-mux74k5q-1c3c2127` (failed: C1 settings rewrite of a
ran step, C2 empty checks, C3 repeat guard counting a check; all fixed in t281).

## Expectations (written before launch)

Instruction, verbatim (219 characters):

> On Farbazaar, put three of the Voltbay USB-C hub sold by Voltbay Official Store in my cart: Space Grey, the
> 7-in-1 version, shipped from Spain. Collect that store's coupon while you are on the item. Do not buy anything.

Acts the reader must give: `a1` put with choices `a1.quantity` three, `a1.colour` Space Grey, `a1.version` 7-in-1,
`a1.origin` Spain; `a2` collect.

Command (the campaign's; `--max-attempts 1`, so no second paid attempt):

```text
FLUXIQ_LAB_INSTANCE=t262-slot-2 FLUXIQ_TEST_ENV_FILES=none
pnpm.cmd lab:campaign crossborder-marketplace-hub-to-cart --max-attempts 1 -- --target persistent-isolated --workspace t262-a
```

Dry-runs (03:37-03:38 UTC): the campaign printed one spawned command (`pnpm lab run crossborder-marketplace
--live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow
--instruction-task crossborder-marketplace-hub-to-cart --llm-max-input-tokens 992000 --llm-max-output-tokens 8000
--llm-max-total-tokens 1000000 --llm-max-calls 48 --target persistent-isolated --workspace t262-a`); that command with
`--dry-run` exited 0: `status ready`, `providerCallCount 0`, lane created-flow, buildEntry chat, persistent-isolated,
deepseek-flash, maxCalls 48, maxEstimatedCostUsd 0.1 (= maxTotalEstimatedCostUsd), permittedConsequences [], key
DEEPSEEK_API_KEY from `.env.local`, instruction 219 characters sha256 `2e6f5e7d...a405`. The prelude rebuilt the
instance's scenario-lab, domain host, extension, test-evidence and test-runner builds (inputs changed since round 3).

Actions a correct Flow takes, in order:

1. Navigate to the Farbazaar start page.
2. Dismiss the welcome popup and the consent layer (optional steps).
3. Search for the Voltbay USB-C hub and open the Voltbay Official Store item.
4. Space Grey is preselected: no press in the Flow (a press un-chooses it). If a press is kept, it must be one that
   leaves Space Grey chosen from a fresh page; a kept toggle half whose partner is out must be taken out (t281 F1
   fix 3).
5. 7-in-1 (claims `a1.version`) and Spain (claims `a1.origin`), each performed in the build test.
6. Collect the store coupon (`a2`; a page-busy refusal may need one retry).
7. Quantity 3 (`a1.quantity`), a real performed setting (typed or set, not a check).
8. Add to cart (`a1`), once, after the choices; never Buy now, never checkout.

Exact oracle facts (playback goal `hub-in-cart` plus final state):

| Fact | Subject | Expected |
| --- | --- | --- |
| cart-line | mini-cart-line text | Voltbay hub line: Voltbay Official Store, Space Grey, 7-in-1, ships from Spain, × 3 |
| store-coupons | coupon flyout text | Voltbay Official Store coupon collected |
| cart-count | mini-cart-count | `Cart (3)` |
| orders-shipped | orders summary | `Orders to be shipped (0)` |

Wrong plausible answers: China origin; coupon but empty cart; wrong store, colour (un-chosen Space Grey), version or
quantity; Buy now pressed; an unfinished draft called a saved Flow; a Flow whose Add to cart step is a retargeted
choice press.

New on this source since round 3, each to be checked in the debug:

- R4-1 act claims judged by the page change the step caused, refused when made: `act_not_done_there`,
  `step_only_chooses` / `_arrives` / `_clears_the_way` / `_opens_its_choices` (t285). **Must be seen: the Spain press
  never claims `a1`** (nor `a1.quantity`).
- R4-2 every amendment refusal names its way out (t287 group 1).
- R4-3 three same-kind refusals in a row end the round, warned at two; identical reruns count as no progress (t287
  group 2).
- R4-4 no second copy of a step and no second read of a list (`second_copy`, t281 W15).
- R4-5 a settings rewrite of a ran step refused (`settings_rewrite_run`, t281 C1a). **Must be seen: no settings
  rewrite applied.**
- R4-6 a checked rerun naming another node does not take (t281 C2); a rerun answered as a check is not recorded as
  an attempt by the repeat guard (t281 C3).
- R4-7 F1: the title-named Space Grey swatch is re-found after a reload (extension resolver, t281 F1 fix 1); a
  not-found replayed press whose control was shown answers `core.replay.failed`, not `remembered` (F1 fix 2); a kept
  toggle half whose partner is out is taken out (F1 fix 3). Consequence to watch: a kept Space Grey press that
  un-chooses now really runs in playback, so it must not be in the Flow.
- R4-8 node definitions given on first use (t280); readable field labels and samples.
- R4-9 judges see only what this run changed; an unconfirmed yes never passes; no round opens without room for its
  judge pair; the re-author may end "nothing to change" (t286, t275).
- R4-10 the read reads one page (S4+S5); not exercised on A (no list), but the check card must not say "no rows".
- Carried from round 3: N1 (no identical amend/rerun loop), N3 `web-state.v4`.

Cost: under $0.10 per build; at most 48 build calls.

UI checkpoints (round-3 set plus t288 "Next live UI review must see", groups 1 and 2):

- U1 start: the instruction as a user turn in the new project's chat; composer at the bottom; no previous run's
  thread at start (t289 "no previous thread at start").
- U2 mid-build: one assistant message per step with its reason; action cards with icon, target and outcome; edit
  cards say what changed; a partly done edit says what landed ("Only partly done: added ...; not done: ...");
  repeated refusals folded ("Not done (N times)"); repeated identical successes folded ("Done (N times)"); a step
  written without running reads "Added to the Flow, not run yet"; a press that un-chose a choice is not a bare "Done".
- U3 overlay: "Starting…" in panel and page from the send (if missing, `extension-start.local.json` names why);
  visible whenever FluxIQ works; text matching the panel; never "Couldn't fix your Flow" on a creation build.
- U4 words: no "Step N", "the judge", "next call", "extraction", "dedup", "reading the list handle"; no quote cut
  inside a word (the act list "shipped from Spain" whole); no thought ending on ";"; a completion sent back reads "The
  Flow isn't finished yet"; an unusable model reply says so; "Judging the Flow" says how many steps the test ran; no
  "no rows would be stored" on a cart task (round-3 gap, not on t288's list: check).
- U5 ending: whole, plain; a pass says the Flow is saved and tested; a failure never says "ran, or could run"
  (checked-only acts said as "only checked, not run"); repair headings have no step numbers.
- U6 playback: run status, each step's card, Add to cart done, result shown; a failed run's row says what the check
  objected to.

Replays (only on a pass): two `lab replay` runs on `t262-a` with the build's project and Flow ids (from
`snapshots/creation-context.json`), no provider key in the environment: zero provider calls, zero interventions, zero
harness activations, unchanged Flow hash, `playbackGoalHeld` true. Then a second independent live pass.

## Result (written by the lane A lead from the run folder, 2026-10-07 ~04:30 UTC)

**Failed**, `runtime.behavior`, no Flow saved, oracle not measured. Launched 04:00:20 UTC (off-peak; live guard
`admitted`, fingerprint `sha256:e2224bcb...`); instruction sent 04:04:09.8; build ended ~04:08:35 at the call allowance
(ending: "stopped at its limit of 48 model calls"). 47 provider calls, $0.066767 in total, build $0.066594 of the $0.10
ceiling (`snapshots/live-llm.json` `observed.perBuild`). Ledger `finish` recorded (`lab.live-guard` "recorded").

Phases (`steps/index.md`): exploration 0003-0058. Part one ended after three `rerun_changed_nothing` in a row (0039,
0046, 0053), the new three-same-kind rule. Build test 0059-0067. Both judges refuted (0068, 0069: "no step presses
Add to cart", the quantity field still 1, the "+" step only verified). Repair round 1 ran 0070-0139, with its test at
0140-0149. Repair round 2 ran 0150-0166 (every amendment refused), with its test at 0167-0176. Then the calls ran out.

Exploration went right until 0026:

- navigate;
- the cookie banner's × (the "Reject non-essential" press was covered, and Core said which control closes the layer);
- the search, typed and submitted with Enter;
- the Voltbay Official Store item;
- Accept all;
- Space Grey pressed twice (0014 un-chose it, 0016 chose it). Core took both presses out as a pair that changed
  nothing (F1 fix 3 working);
- 7-in-1 (`a1.version`);
- Spain (`a1.origin`), after one `invalid_input` for a misplaced `consequences`;
- Get coupons (`a2`): page busy once, then "Coupon collected".

The reader gave all four choices and both acts. Then:

1. **C1, the root (0027-0030). An `add` carrying a new action's `input` was answered "applied", and the input was
   dropped without a word.**
   - 0027 tried to add the quantity step and Add to cart by amendment. It was refused `no_such_step`: "a step enters
     the draft only by running. Run that action first as a call with add true".
   - 0029 then sent `{"step":13,"change":"add","to":14,"act":"a1.quantity","input":{"node":"web.output.dom-type",
     "parameters":{"target":{"handle":"t964"},"text":"3","submit":false},"consequences":[]}}`. Step 13 was the Get
     coupons press (act `a2`).
   - Core (`flow-draft/amendment/apply.ts`) reads `input` only for `rerun` and `bind`. On `add` it was ignored, and
     `to: 14` named no step, so the only effect was the claim: step 13 now held `a2, a1.quantity`. The answer said
     `verdict: applied` (0030).
   - The checklist then showed `a1.quantity` as todo `step_acts_on_another_object` (actsOn `a2`), but the claim stood.
     The claim-time act judge (`flow-bootstrap/instructed-acts/claim-verdict.ts`) judges only an act's own id, never a
     choice.
   - Same habit as round 3's C1 (`settings.target`), which t281 closed for `settings` only.
2. **C2, why it could not be undone (0031-0058).**
   - Believing step 13 was now its quantity step, the model reran it onto the "+" control (t965).
   - Step 13 does the lasting act `a2` and had already done it, so the rerun went as the dry run's check (`replay:
     "verify"`, `core.replay.verified`, "it was not run"). The check still took the new target
     (`llm/node-tools/rerun-check.ts` `checked()`). The node was the same, so t281's C2 guard did not apply; taking a
     new target is the lane D R7 design.
   - Step 13 became an unrun "+" press claiming the coupon and the quantity. Every later rerun of it was another check
     that ran nothing (0039, 0046, 0053 `rerun_changed_nothing`).
   - Part one ended with no Add to cart and no quantity ever set.
3. **Repair rounds (0070-0166), downstream of C1 and C2.**
   - 0075 reran that step (now shown as step 8) with `{target: t964, text: "3"}`. This was again a check, and again it
     took, so the step became a *click* on the quantity field with a `text` parameter a click does not accept.
   - 0082 bound that `text` as an input. From then on, every rerun to a dom-type was refused `rerun_holds_binding`.
     The rest of both rounds was `act_already_named`, `already_so` and `not_a_kept_step`.
   - The model never ran Add to cart, or a typed quantity, as a new call.

**Fix (in this tree, uncommitted; Core only).** The rule covers an `input` on any amendment change that takes none:
everything but `rerun` (already answered `run_by_the_loop`) and `bind`.

- Such an `input` is refused whole as `settings_rewrite_run`, before anything about the amendment changes, when it names
  another node or gives a parameter the step ran with another value (written out or as a patch).
- An `input` that repeats what the step ran with passes.
- With this, 0029 is refused and told "only rerun and bind take an input, and an amendment never makes a new step. To
  act on another control or with another value, run that as a new call with add true and its act". That is the move
  that passed round 3 run 1.

Files, all in Core under `packages/fluxiq/src/programs/automation-studio/runtime/`:

- `flow-draft/amendment/settings-rewrite-run.ts`;
- `flow-draft/amendment/apply.ts`;
- `flow-draft/amendment/tests/settings-rewrite-run.test.ts`: 3 new cases. Fail-first: 2 failed, 5 passed;
- `llm/draft-amendment-feedback.ts`: the `settings_rewrite_run` reason sentence (line 180) only.

Validation is in the lane report.

Not fixed (described):

- **C1b: choice claims are not judged when they are made.** A bare `add act a1.quantity` on the coupon press would
  still stand, with todo `step_acts_on_another_object`.
  - `claim-verdict.ts` could refuse a choice whose standing is `step_acts_on_another_object`, as `act_not_done_there`
    with the checklist's `todoSaid`.
  - Not done: it reverses a deliberate "a choice is a setting" rule, and lane B's claim work is in that area.
- **C2b: a check retargets a lasting-act step to an unrelated control.** `checked()` lets a rerun answered `verified`
  or `present` take a new target and keep the step's acts (the lane D R7 design). That is how the coupon act moved onto
  "+" without running.
  - It also took `text` on a click (0075), a parameter that node does not accept.
  - A checked rerun could at least be refused when its value holds a parameter the step's node does not declare.
  - Taking a new target at all needs a design call by the supervisor.

New-on-this-source checks:

- R4-1, claims judged when made: `act_not_done_there` did not fire, because act ids were claimed only on the right
  presses. The one wrong claim was a choice, which the rule does not judge (C1b). The Spain press never claimed `a1`:
  **seen**.
- R4-2, refusals name their way out: **seen** (0028, 0039, 0046 and 0053 each carry a `next`).
- R4-3, three same-kind refusals end the round: **seen** (part one ended after three `rerun_changed_nothing`).
- R4-4, second copy: not exercised.
- R4-5, settings rewrite refused: no `settings` were sent. The same rewrite came as `input` (C1, now fixed).
- R4-6: C2 (another node) and C3 were not exercised.
- R4-7, F1: **seen working in the build.** Both Space Grey presses were taken out as a pair. The repair round's test
  found and pressed the swatch ("Testing: Click · Space Grey · Done", moment 16), so the resolver fix is in effect.
  Playback was not reached.
- R4-8, node definitions on first use: `describedNodes` came on each node's first result (0004).
- R4-9, judges: both judges cited only this run's state; they correctly did not credit a coupon already "Collected" in
  the start view. No round opened without room for its judge pair.
- R4-10: not applicable.

UI review (16 moments, `run-muxkzdjw-31a13429.ui-review.local/`):

- U1: the moment 1 panel shows the new project's chat and no previous thread (t289 seen fixed).
- U3 / R2-U-5 (overlay from the send):
  - The send was at 04:04:09.79. The panel read "Sending your message" at that instant. The overlay was up 1.4 s
    later ("Building your Flow"), right after the 0.93 s chat call; in round 3 this took about 4.7 s.
  - No "Starting…" was sampled, and `extension-start.local.json` holds no "starting status not shown" line.
  - The overlay was visible 16/16 from moment 3 on, except one absent sample at a page load in moment 7 (the build
    test's reload).
- **Gap: "Couldn't fix your Flow" on a creation build.** At moments 15-16 the overlay read "Couldn't fix your Flow |
  Build stopped: a budget ran out", at the end of a creation build whose last unit was a repair round. t288 W27 expected
  this never on a creation build. Also, the build ran out of calls, not money, and "a budget" does not say which.
- U2, cards: icon, target and outcome are shown; "Testing: Click · + · Checked, not pressed" marks the verified step.
  **Gaps:**
  - "Edit the Flow · Done: made a value in "clicking on the page" vary": a bind on a click step, said as "clicking on
    the page".
  - The rerun lines "Trying again: clicking on the page" and "typing into the page" name no control.
- U4, words: "Judging the Flow — The test ran 7 of the Flow's 8 steps from its start; 1 was only checked, not run"
  (t288 seen fixed). Quotes are cut at word ends ("shipped...", "Space..."). **Gaps:**
  - The check card says "Didn't pass: no rows would be stored, and no step presses "Add to cart"". "No rows" on a cart
    task is the round-3 gap, still open.
  - The repair heading quotes page-view syntax ("quantity field ="1"", "in start view").
  - "Reading your instruction gave no answer for ... so the build's tests check the steps that do them rather than do
    them again" describes mechanics, not in plain words.
- U5, ending (moment 16): whole and honest. It says "3 of the 6 things you asked have a step that ran ..., and 2 more
  have a step that was only checked, not run", names the 48-call limit and says the draft is kept. No "ran, or could
  run" (t288 W24 seen fixed).
- U6, playback: not reached.
