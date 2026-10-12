# Run debug — run-muz0f12h-eae63685 (lane A round 5, candidate mode with the round 4 fixes, t342-slot-2)

Written as `run-pending-t342-slot-2-a-r5.md` before launch; renamed to the run id when the Lab assigns it.
Everything in "Expectations" was written before launch (2026-10-08 ~03:10 UTC; launch only when the guard admits it
after 04:00 UTC, and not after about 05:30).

## Header

Lane A, t342 round 5: the candidate-mode probe with every round 4 fix merged. Since round 4:

- t355: every node retries automatically on every path (first attempt plus 3 retries), trials included.
- t356: the trial gate allows re-testing a transient failure (up to 3 trials per revision); refused submissions name
  the stale handles and how to recover; a third identical refusal ends the round; trial feedback names each step's
  control in plain words; a control whose label changes after a press keeps one identity.
- t357: candidate scripts can mark optional steps and write choices as desired state (`web.dom.check`/`select`, every
  instructed option its own step).
- t358: a submission may name controls from pages exploration has left (start-page popups).
- t359/t361: a lasting act (click, keypress, dialog, submitting type, declared consequences) is never repeated by a
  retry when its effect is uncertain; everything else retries even after a failed read-back.
- t362: candidate endings name their cause, and the Lab records the candidate and trials.
- t363: the overlay says "Testing your Flow" during a trial.

Instance `t342-slot-2`, slot 2, workspace `t342-a`. Tree at downstream 069af09a (contains dev 3e72200a), Core
a318edb5 (= Core dev), both clean. No `STOP-balance`, no override files. Core libraries (fluxiq rebuilt) and
`pnpm build` exit 0 at 03:04 UTC.

Previous run on this instance: round 4 `run-muyrpbnk-fef374e7`. Two trials, both stopped at step 2:

- C1: the coupon handle was bound to "Collected".
- C2: one attempt per trial step met the page's "Network busy".
- C3-C6: generic handle refusals, thin trial feedback, trial retry refused, wrong ending.

## Expectations (written before launch)

Same instruction (219 characters, sha256 `2e6f5e7d...a405`), oracle and correct-candidate description as round 3's
debug (`run-muyqgopm-1bfa7054.md`).

Command: `FLUXIQ_LAB_INSTANCE=t342-slot-2 FLUXIQ_TEST_ENV_FILES=none pnpm lab:campaign
crossborder-marketplace-hub-to-cart --max-attempts 1 --authoring-mode candidate -- --target persistent-isolated
--workspace t342-a`.

Dry runs (03:05 UTC): one spawned command. Lab `--dry-run` exit 0: `status ready`, `providerCallCount 0`,
created-flow, chat entry, flash, `coreAuthoringMode` candidate, `candidateTrial {trialRunner: true, startReset:
true, source: lab-plan}`, 48 calls, $0.10, `permittedConsequences []`, `coreWeb` key `1ffcee15...` not cached.

To check, by fix:

- R5-a, coupon (C1 and C2 of round 4): trial step "collect the coupon" finds "Get coupons" on the reset page. If the
  page answers "Network busy", it is retried and then succeeds. A lasting press is never repeated when its effect is
  uncertain (t359/t361); watch that the busy refusal, which acted on nothing, is still retried.
- R5-b, Space Grey: written as desired state (select or check), or left out. A toggle press that un-chooses it is
  round 2's trap; the trial's end view and the judge must catch it if present.
- R5-c, popups: start-page popups named from the start page (t358) or marked optional (t357); Add to cart reachable.
- R5-d, quantity 3 set, Add to cart once, a check of the cart.
- R5-e, trial records: start reset, each step's attempts and result, the end view against the four oracle facts, both
  judge verdicts (confirmed second yes needed), and the trial count per revision (at most 3).
- R5-f, promotion if reached: a proposed adaptation with `candidateTrial` detail; the chat applies it and says the
  automation is ready; the Lab resets, plays the saved Flow on its own tab, checks the oracle.
- R5-g, ending names its cause (t362); `snapshots/flow-lane.json` `candidate` record present; overlay "Testing your
  Flow" in trials (t363); no internal tool names ("Submit candidate", "Test candidate", "Revision N") in the chat.
- R5-h, churn: submissions refused, trials repeated, completions refused; spend split by exploration, submissions,
  trials and judges.

Replays and a second candidate run only on an oracle pass that the product accepted.

## Result (written by the t342 lane lead from the run folder and the workspace's trial records, 2026-10-08 ~04:20 UTC)

**Failed: two trials ran to Add to cart's neighbourhood; the colour could not be chosen; nothing promoted.** Verdict
`runtime.behavior` (`lab.chat_build_failed`). Issues: `flow_bootstrap.evidence_repeat_without_progress` and
`llm_evidence_loop.searching_without_acting`. The oracle was not measured.

- Launched 04:01:28 UTC (guard `admitted`, fingerprint `sha256:c6ea45ac...`); panel open 04:03:13; build ended about
  04:04:55.
- 22 calls, $0.022649:
  - chat: 1 call, $0.000071;
  - exploration: 5 runs ($0.007166), 6 finds ($0.005711), 6 describes ($0.005690);
  - submissions: 2 ($0.002152);
  - trial requests: 2 ($0.001860);
  - judges: 0.
- Build $0.022579, recorded consistently in the build record, `perBuild` and the ledger.
- No Lab process was left running (checked).

Sequence:

1. Exploration, 0002-0018: dismissed the layers, searched, opened the item, collected the coupon, read the controls.
2. Revision 1 (0019/0020), accepted. It contained:
   - optional start-page dismissals;
   - the coupon press;
   - `web.dom-check` on Space Grey and the other choices;
   - the quantity typed;
   - Add to cart.
3. Trial 1 (0021/0022, `trial.68c8ae35...`), start reset:
   - navigate succeeded;
   - two optional dismissals skipped (control not on the page);
   - coupon press: attempt 1 `web.action.rate_limited` ("busy ... confirmed nothing", effect `unacted`), retried by
     `retry_node` (1 of 4 attempts used), **attempt 2 succeeded**;
   - `web.dom-check` Space Grey refused `not_checkable: <div> is not a checkbox or a radio`; trial stopped.
4. 0023 described the swatch. Revision 2 (0025/0026) used clicks for the choices.
5. Trial 2 (0027/0028, `trial.69f2eded...`), start reset:
   - coupon busy once, retried, succeeded;
   - Space Grey click (`s7`, un-chooses the preset colour), 7-in-1, Spain, quantity typed;
   - Add to cart (`s11`) refused `web.action.refused_by_page` ("needs something first", not retryable).
6. 0029-0044: eight look-only decisions in a row. The model searched for a hidden radio input behind the swatch ("the
   Color swatch needs a real check"). The look guard ended the build.

Checks:

- R5-a, coupon: **fixed.** On both trials it was found as "Get coupons" on the reset page, and the busy first press was
  retried and succeeded (t355, t356; the busy refusal is `unacted`, so t359's lasting-act rule did not block the
  retry).
- R5-b, Space Grey: **the blocker.** Desired state is refused for a `div` swatch, and a click un-chooses it.
- R5-c, popups: written as optional and skipped on the item page. One "dismissal" was actually a click on a promo
  banner ("Choice Day · free returns on every Choice item"): harmless here, a navigation risk where it is present.
- R5-d: quantity typed 3, Add to cart once (refused because of R5-b).
- R5-e: start reset recorded on both trials; attempts above; no judge call (no trial ran to its end); at most 3 trials
  per revision (`retestsLeft: 2`, unused, correctly, as both failures were not retryable).
- R5-f: not reached.
- R5-g: the ending names its cause in plain words; the Lab records the candidate and both trials. The overlay said
  "Building/Fixing your Flow | Step N of 10" during trials, not "Testing your Flow" (t363 not seen). No internal tool
  names in the chat.
- R5-h: 2 submissions, 0 refused; 2 trials, 0 repeats; 0 completions; 8 looks at the end.

### Causes

**C1: a preselected toggle swatch has no expressible desired state (decisive; round 2's C2 in new form).**

- The swatch is a `div` that the page view shows as `marked`.
- `web.dom.check` sets `checked` only on a checkbox or radio (`apps/extension/src/content/actions/check.ts:13`,
  `:61` `not_checkable`).
- A click toggles it off, and Add to cart then refuses "Please select a Color".
- t357 asks for every instructed option as its own desired-state step, and the acts checklist has no "already chosen"
  state (round 2 C2), so leaving the step out is not offered either.
- Fixes:
  - make `web.dom.check` honour the chosen state the domain already reads for any pressable choice
    (`domain/src/runtime/llm-evidence/node-run/press-effect/chosen-state.ts`, `page-view/element/state-tokens.ts`):
    already chosen does nothing; not chosen gets one press, then confirm chosen. Owners: extension `content/actions/check.ts`
    and the domain mapping that routes `web.dom.check`.
  - and/or tell the model that an option already marked needs no step (round 2's checklist rule).
  - Failing test first: `check` on a marked `div` swatch succeeds without pressing it.

**C2: trial feedback numbers attempts as steps and reports a retried success as a failure.**

- Trial 1's feedback lists 8 "steps" for 7 nodes. "Step 6 failed rate_limited" is attempt 6, and its successful retry
  (attempt 7) appears as an unnamed "step 7 succeeded". Trial 2's feedback lists 12 "steps" for 11 nodes in the same
  way.
- The model was told the coupon press had failed when it had succeeded.
- Owner: Core `runtime/service/candidate-trial/feedback.ts`.
- Fix: one entry per node with its final outcome and the attempt count; name every control (the coupon and quantity
  entries have none).

**C3: stuck on an inexpressible step, the model looks until the look guard stops it.**

- Eight finds and describes searching for a hidden input.
- Consequence of C1; the guard worked as designed. No change beyond C1.

### UI review (7 moments, lead)

- **Plain and good:** "Saving the Flow's steps", "Testing the whole Flow from the start"; cards name Add to cart, 7-in-1,
  Spain; the Stop button; an honest ending that names its cause ("kept trying without getting any further"; draft
  kept; tested twice).
- **Still to fix:**
  - the overlay during trials says "Building your Flow" / "Fixing your Flow" with "Step N of 10" (t363's "Testing your
    Flow" not seen; step numbers);
  - "The quick fixes didn't help — Trying again didn't fix the step" for a refusal that is not retryable;
  - Type and Look cards name no target;
  - a card label cut in the middle ("Choice ... on every Choice item");
  - the ending does not say what blocked the build (the colour could not be chosen).

Not run: replay and second candidate run (no pass). No relaunch.
