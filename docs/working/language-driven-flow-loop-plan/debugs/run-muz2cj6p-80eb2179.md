# Run debug — run-muz2cj6p-80eb2179 (lane A round 6, candidate mode, t342-slot-2)

Written as `run-pending-t342-slot-2-a-r6.md` before launch; renamed to the run id when the Lab assigns it.
Everything in "Expectations" was written before launch (2026-10-08 ~04:55 UTC; off-peak until 06:00 UTC, no launch
after about 05:35).

## Header

Lane A, t342 round 6. Merged since round 5:

- t364: `web.dom.check` works on any control whose chosen state the page shows. Already chosen means success with
  nothing pressed; unchosen means pressed once and verified; no readable state is refused plainly. The guidance says to
  check the swatch itself.
- t365: trial feedback has one entry per step, with its final outcome and attempts.
- t366: the overlay says it is testing during a trial; Core never says "trying again" for a step it does not repeat.

Instance `t342-slot-2`, slot 2, workspace `t342-a`. Tree at downstream ee7a2895 (contains dev ab771df2), Core 97772aeb
(= Core dev), both clean. No `STOP-balance`, no override files. Core libraries (fluxiq rebuilt) and `pnpm build` exit 0
at 04:54 UTC.

Previous run on this instance: round 5 `run-muz0f12h-eae63685`.

- The coupon was retried to success.
- The Space Grey `dom-check` was refused (`not_checkable`, div); the click un-chose it; Add to cart was refused.
- The feedback numbered attempts as steps.

## Expectations (written before launch)

Same instruction (sha256 `2e6f5e7d...a405`), oracle and correct-candidate description as round 3's debug
(`run-muyqgopm-1bfa7054.md`). Command: as round 5, `--authoring-mode candidate`.

Dry runs (04:54 UTC): one spawned command. Lab `--dry-run` exit 0: `status ready`, 0 calls, chat entry, flash,
candidate, `candidateTrial {trialRunner: true, startReset: true}`, 48 calls, $0.10, `permittedConsequences []`,
`coreWeb` key `df51d8f7...` not cached.

To check:

- R6-a, colour step: `web.dom.check` on Space Grey on the reset page succeeds with nothing pressed (already chosen);
  7-in-1 and Spain checked by a press each, verified.
- R6-b, coupon: found and, if busy, retried to success, shown once as "succeeded after 2 attempts" (t365).
- R6-c, the trial runs to its end: Add to cart accepted, the cart check passes. Then the build-test judge on trial
  evidence only, a confirmed second yes, and the end view against the four oracle facts:
  - cart line Voltbay Official Store, Space Grey, 7-in-1, Spain × 3;
  - coupon collected;
  - `Cart (3)`;
  - `Orders to be shipped (0)`.
- R6-d, promotion: a proposed adaptation with `candidateTrial` detail; the chat applies it and says the automation is
  ready; the Lab resets, plays the saved Flow on its own tab and measures the oracle.
- R6-e, overlay during trials says it is testing (t366); no "trying again" for an unrepeated step.
- R6-f, risk carried from round 5: an optional "close the popup" step that presses a promo banner would navigate away.

If the oracle passes and the product accepted the Flow: one zero-call `lab replay` and a second candidate run, both
before 06:00 UTC.

## Result (first pass, 05:07 UTC; full detail follows below)

The product passed and the Lab failed it. Revision 4 trial answered yes (0040), both judges yes (0041, 0042), complete (0043); Core promoted and the chat applied the Flow and said it was ready (adaptation `adaptation.bootstrap.1f6b3177...`). The Lab refused the proposal as `lab.proposal_without_evidence_audit` (`packages/test-runner/src/flow-lane/creation/build-proposal.ts:490-494` requires the legacy `evidenceLoop` audit) and never played it. A provider-free `lab replay` (`replay-muz2npvw-b51023b7`, 05:04-05:05 UTC) passed: 0 provider calls, 0 interventions, 0 harness activations, Flow hash `9f513eb7...` unchanged, `playbackGoalHeld: true`.

## Result in full (written by the t342 lane lead, 2026-10-08 ~05:15 UTC)

**The product passed lane A in candidate mode; the Lab failed the run on its own audit check.**

- Launched 04:55:34 UTC (guard `admitted`, fingerprint `sha256:64373650...`); panel open 04:57:23; complete 05:02:4x;
  Lab verdict `failed`, `lab.proposal_without_evidence_audit`.
- 23 calls, $0.026698:
  - chat: 1, $0.000071;
  - exploration: 10 runs ($0.013715) plus 1 find ($0.000948);
  - submissions: 4 ($0.005568);
  - trial requests: 4 ($0.004126);
  - judges: 2 ($0.001283);
  - completion: 1 ($0.000987).
- Build $0.026627, consistent across the build record, `perBuild` and the ledger.
- No Lab process was left running (checked after the run, the replay and the refused second launch).

Sequence:

1. Exploration, 0002-0020.
2. Revision 1 (0021) and revision 2 (0023) accepted.
3. Four trials, all `start: "reset"`:

| Trial | Revision | Result | Step that decided it |
| --- | --- | --- | --- |
| 0025/0026 `trial` 1 | 2 | execution_failed | `wait_for_text "added to cart"` timed out after 4 attempts (the toast reads "Added to cart!" and is gone by then) |
| 0029/0030 `trial` 2 | 2 (re-test) | execution_failed | the same timeout; the re-test of a deterministic timeout was spent for nothing |
| 0035/0036 `trial` 3 | 3 | execution_failed | `wait_for_text "Cart (3)"` marked `optional: yes`, still failed the trial after 4 attempts |
| 0039/0040 `trial` 4 | 4 | **yes** | added a press on the mini-cart ("3Cart") before the wait; every step succeeded |

In every trial:

- navigate succeeded;
- the two optional dismissals ("Welcome back, Mara!", the cookie notice) were skipped as absent;
- the coupon press **succeeded after 2 attempts** (busy once);
- **`dom-check "Space Grey"` succeeded with nothing to press** (already chosen; t364), and 7-in-1 and Spain were checked;
- quantity typed 3;
- Add to cart succeeded.

Then:

- Judges (0041, 0042): both `answersRequest: yes`, confidence 0.9. They cite Cart (3), the line "Space Grey · 7-in-1 ·
  Ships from Spain" × 3 (subtotal 68,97 €), the coupon collected, and no purchase. That is all four oracle facts.
- 0043: complete. Core promoted the candidate (`adaptation.bootstrap.1f6b3177...`). The chat applied it and said: "Your
  automation ... is ready ... a test run of the whole Flow from its start was judged, twice, to do what you asked."
- The Lab read the proposal and refused it: `lab.proposal_without_evidence_audit`. It never reset, played or judged the
  saved Flow, and recorded `candidate: null`.
- **Provider-free replay** (05:04:11-05:05:10, `replay-muz2npvw-b51023b7`) of project `b35b7fd6-...` Flow
  `flow.d1642aeb-...`: verdict `passed`.
  - Model: `coreProviderCallCount 0`, `interventions 0`, `harnessActivations 0`, `modelProvidersEnabled false`.
  - Flow hash `9f513eb7...` unchanged before and after.
  - Run `succeeded`: the coupon press failed once and succeeded on retry; three checks; type; two presses (Add to
    cart, mini-cart); `wait_for_text` succeeded.
  - `playbackGoalHeld: true`.
- Second candidate run (05:05:52): refused by the guard's `unchanged` rule (the Lab recorded this run as failed and the
  source is unchanged), $0. No override was created.

Judge versus oracle: agreement. Both judges said yes, and the private oracle held on the zero-call replay.

### Causes and findings

**L1 (Lab, blocks every candidate pass): the Lab requires the legacy evidence audit on a promoted candidate.**

- `packages/test-runner/src/flow-lane/creation/build-proposal.ts:490-494` (`readCreatedFlowBuild`) fails a proposal
  without `detail.evidenceLoop` as `lab.proposal_without_evidence_audit`. A promoted candidate carries its
  `candidateTrial` audit, not an evidence-loop audit.
- The chat path reads the build before the candidate promotion (`chat/build-from-chat.ts:199` fails the build, so the promotion branch at 203-205 never runs),
  so the run fails before playback and the candidate record stays empty.
- Fix (one of):
  - the Lab accepts a candidate proposal by its `candidateTrial` audit (trial verdict yes, judge calls, revision and
    digest), and still requires a call count and page evidence;
  - or Core attaches the candidate loop's evidence counts to the promoted proposal (Core
    `runtime/service/candidate-trial/promotion.ts`).
- Then make the `unchanged` guard's "did not pass" mean the product verdict, so a Lab defect does not block the second
  run. That is a design question.

**F1: an optional `wait_for_text` that times out still fails the trial** (trial 3, revision 3). Owner to check: Core
optional routing (t357) for failures other than an absent target. Not traced.

**F2: a deterministic timeout invites a re-test.** Trial 2 re-tested revision 2 after a timeout and failed the same
way. The trial gate (t356) should count a timeout of the same step on the same revision as not transient after one
re-test. Low cost here ($0.0009).

**F3, UI:**

- the confusing "Reading your instruction gave no answer for ..." paragraph appears right before the ready message
  (18);
- the ready line keeps legacy words ("I tried its steps on the page you had open and put the ones that worked into
  it");
- the overlay headline switches between "Building" and "Testing" while the model decides (12, 16);
- the coupon and dismissal lines name no control ("Clicking on the page").

**Seen working:**

- t364: the preset Space Grey checked with nothing pressed;
- t365: one feedback entry per step, with attempts;
- t366: the overlay says "Testing your Flow" in trials; no "trying again" for unrepeated steps; "Flow ready | Your Flow
  is ready" at the end;
- t355/t356: the coupon retried;
- t357/t358: optional popups skipped where absent;
- t362: plain ending;
- the round 2 traps all closed: Add to cart in the Flow, quantity 3, Space Grey kept chosen.

### UI review (19 moments, lead; panel 18 viewed)

The overlay is plain throughout trials ("Ticking “Space Grey”", "A step didn't work in the test: the page took too
long"); the "Check result · Passed" card; an honest ready message. Defects as F3.

Replay done (zero calls, passed). Second run refused by the `unchanged` guard. No relaunch.
