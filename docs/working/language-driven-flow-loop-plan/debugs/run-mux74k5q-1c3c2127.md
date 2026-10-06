# Run debug — run-mux74k5q-1c3c2127 (lane A round 3, second independent live pass, t262-slot-2)

Written before launch (2026-10-06 ~21:35 UTC, off-peak); renamed to the run id when the Lab assigns it.

## Header

Lane A round 3, the second independent live pass after `run-mux6n7m4-8273e7a0` passed (4/4 facts) and replayed with
zero calls. Same source and fingerprint as that run (`sha256:6475d56e...`; no source edited since), same instance
`t262-slot-2`, slot 2, workspace `t262-a`; the chat build makes a new run-owned project in that workspace, so the
first pass's Flow is not reused.

## Expectations (written before launch)

Everything in `run-mux6n7m4-8273e7a0.md` "Expectations" holds unchanged: the instruction (219 characters), the
command (campaign, `--max-attempts 1`), the dry-run plan (created-flow, chat, persistent-isolated, deepseek-flash,
48 calls, $0.10, permittedConsequences []), the eight actions a correct Flow takes, the four exact oracle facts
(`Cart (3)`; `Orders to be shipped (0)`; the Voltbay Official Store line with Space Grey, 7-in-1, Ships from Spain,
× 3; the store's coupon collected), the wrong plausible answers, the new-on-this-source checks N1-N6 and the UI
checkpoints U1-U6.

Watch points from the first pass:

- F1: whether the build again keeps a Space Grey toggle press, and whether playback skips it as unresolvable
  (`state_routed`, `web.target.not_found`). A Flow that actually presses the preselected swatch un-chooses it and
  Add to cart is refused ("Please select a Color.").
- U3 / R2-U-5: the overlay from the send (first pass: absent until ~4.7 s after the send).
- U2: a press that un-chose a choice must not read "Done" with nothing else.
- U4: the act-list quote cut mid-word ("shipped f..."), "no rows" words on a cart task.
- N1: no identical amend/rerun decision re-sent; history rows never "applied" for refused work.

## Result (written by the lane A lead from the run folder, 2026-10-06 ~21:55 UTC)

**Failed**, `runtime.behavior`, no Flow saved, oracle not measured. Launched 21:33 UTC; build ended 21:39 at the call
allowance (47 provider calls; ending: "stopped at its limit of 48 model calls"). $0.071043 in total, build $0.070953 of
the $0.10 ceiling. Part one (0003-0068) stopped `unusable_decisions` after two `repeat_refused`; the build test
(`replayed_clean`, 7 steps, acts todo `a1.colour`, `a1.origin`) opened a repair round (0069-0152) that ended with
`complete` refused twice (`bootstrap.unknown_parameter`, 0115, 0152) and the calls exhausted.

The cause chain, each link in source:

1. **C1, the root (0025). Core accepted an `add` that rewrote a ran step and claimed acts it never did.** The model
   ran Space Grey (un-chose it, 0011; re-chose, 0013), the coupon (page busy, then done), 7-in-1, Spain (0023, run
   without `add`), then amended `[{"step":12,"change":"add","act":"a1.quantity","settings":{"target":{"handle":"t964"}}},
   {"step":12,"change":"add","act":"a1"}]`. Both applied (0026): step 12, a press of "Spain", then held
   `act: a1.origin, a1.quantity, a1` and `settings.target` = the quantity field (0027 request). Core only advised
   (`claimSaid`: "a1 is claimed by step 12, whose control is "Spain"..."). `flow-draft/amendment/apply.ts:225` merges
   `settings` over the step unchecked, and `llm/node-tools/draft-step.ts:44-63` writes `step.settings` over what the
   step ran with, so the Flow would press the quantity field and never Add to cart. In run 1 the same habit (add an
   act by amendment before running it) was refused `no_such_step` only because it named a step that did not exist.
2. **C2, why step 12 could never be corrected (0027-0064, 0116-0150).** Step 12 claims the lasting act `a1` and its
   run succeeded, so `flow-draft/verify-only.ts` `automationStudioFlowDraftStepActDone` counts the add-to-cart act as
   done and `llm/node-tools/rerun-check.ts` sends every rerun of it as a check (`replay: "verify"`), never run. The
   model's reruns to type 3 into the quantity field came back `core.replay.present` (`found: missing`, not run) and
   "took": `checked()` (~L100-130) sets `step.input` to the new value but changes `step.actionId` only when the answer
   declares one, and a check that ran nothing declares none. Step 8 in the final draft: `actionId:
   web.output.dom-click`, `input.node: web.output.dom-type`, `text: 3`, `submit: false`, `priorExecution: pick.spain`.
   Completion compiles `node: step.actionId` and refuses `text`/`submit` on a click, naming click's accepted keys,
   while the draft shows a type node; the model could not reconcile the two (four identical reruns refused
   `changes_nothing`, one `dom-select` that failed, two `rerun_holds_binding`).
3. **C3, what ended part one (0065-0068). The repeat guard counted a check that never ran as a failed attempt.** The
   model's direct live call `dom-type t964 "3" add=true act=a1.quantity`, the call that set the quantity in run 1,
   was refused twice `repeat_refused`, `sameAsCall: rerun.12.6`, `then: {outcome: failed, resultCode:
   core.replay.present}`. `rerun.12.6` was the verify-only check of item 2: it acted on nothing. With `web-state.v4`
   the digest after the put-back equals the live page, so the guard (`llm/repeat-guard/outcomes.ts`) matched it. Two
   refusals in a row ended the round `unusable_decisions`.
4. F1 again (0082-0099): reruns of the Space Grey toggle un-chose it three times ("This press un-chose "Space
   Grey""); 0103 added `a1.colour` to the 7-in-1 press (step 6 holds `a1.version, a1.colour`), accepted on the same
   rule as C1.

Fixes, smallest and most decisive first (not applied: lane B has uncommitted Core source edits in this tree):

| # | Where | Change | Failing test first |
| --- | --- | --- | --- |
| C1a | Core `flow-draft/amendment/apply.ts` (where `changesSettings` is computed) | Refuse an amendment whose `settings` names a key the step ran with (`ranWith` or `input.parameters`: target, selector, element, text, value, ...); new reason (e.g. `settings_rewrite_run`), next: "a different target or text is a different step: run it with add true"; settings that add a wait or expected state still apply | `flow-draft/amendment/tests/`: a click step that ran on handle tA; `add` with `settings: {target: {handle: tB}}` is refused and `step.settings` stays unset; `settings: {expectedState: ...}` applies |
| C3 | Core `llm/repeat-guard/outcomes.ts` (and where `llm/evidence-loop.ts` records a rerun's outcome) | A rerun answered as a check (`replay: "verify"`, `core.replay.verified`/`present`, nothing run) is not recorded as an attempt of its input; an ordinary call with that input on that page runs | `llm/evidence-loop/tests/repeat-guard.test.ts`: lasting-act step, rerun answered `core.replay.present`, then the same input as a plain `tool_call` on the same digest is run, not `repeat_refused` |
| C2 | Core `llm/node-tools/rerun-check.ts` `checked()` | When the new value names a node other than `step.actionId` and the answer declares none, do not take it: answer like a rerun that did not work ("the check ran nothing, so the step keeps its node; run the new step with add true") | `llm/node-tools/tests/rerun-check.test.ts`: click step with done lasting act, rerun value `node: web.output.dom-type`, host answers `core.replay.present` with no draft: `took` false, `actionId` and `input` unchanged |
| C1b | Core claim rules (`flow-bootstrap/instructed-acts/claim-doubt.ts` area, which lane B is editing now) | A lasting act claimed on a step whose own run reported a `choice` of one of that act's values ("This press chose "Spain"") is refused, not advised | supervisor to coordinate with lane B |

With C1a the 0025 amendment is refused and the model has to run the quantity typing and Add to cart for real, as
in run 1. C3 alone would have let 0065 run.

New-on-this-source checks:

- N1: no loop of identical decisions: identical reruns were refused `changes_nothing` (0046, 0100, 0128-0130, 0150).
  But about 20 decisions went on step 12/8, which C2 made impossible to correct. `same_amendment` did not fire.
- N2 keep-only, N4 t278, N6 `strands_a_step`/unreached: not exercised. N5 `whereToFix`: not applicable (part one's
  test `replayed_clean`, no failed step).
- N3 `web-state.v4`: observed. The repeat guard fired across a reset (0066, 0068), wrongly, because the matched call
  was a check that never ran (C3).

UI review (17 moments, `run-mux74k5q-1c3c2127.ui-review.local/`):

- Repeated refusals fold: "Type · Not done (2 times): it was already tried exactly this way and did not work"
  (R2-U-7 seen working). The card repeats C3's false claim: that type never ran.
- Edit cards say what was partly done and why ("that step already does that; and that step was already tried
  exactly this way on this same page...").
- "The result didn't pass its check — Sent back because some steps weren't written in a way the Flow can run" heads
  a completion refusal, not a result check.
- Overlay present 15-16/16 from moment 3 on; one absent sample in moment 3 around the search page load. **Gap
  (U3):** the last two moments show "Couldn't fix your Flow | Build stopped: a budget ran out" on a creation build.
- Ending: whole and plain, no dollar sums, but it **overstates**: "6 of the 6 things you asked have a step that
  ran, or could run, when the Flow was run from its start". Add to cart never ran and the quantity was never typed
  (act `a1` was claimed by the quantity-field step). It does not say that completion was refused twice.
- A robot check near the end, answered by the Lab's person ("Done. You pressed Continue.").
