# Repaired office checkout: preparation

Status: PREPARATION READY; waiting for supervisor paired refresh and explicit one-run release. No build, browser/server launch, provider call, source/shared-document edit, profile/artifact mutation, commit or worker HEAD movement.

Exact catalog task: **everything-store-office-checkout-review**, scenario everything-store, kind navigate-and-extract, judgeBy expected-dataset, expectedDatasetId extract-checkout-review. Workflow office-checkout-review. Read only three new production owners: apps/scenario-lab/src/scenarios/everything-store/live-tasks.ts, workflows/office-checkout.ts and workflows/account-literals.ts. No task, fixture, oracle or guidance changes.

## Positive oracle and permitted behavior

The catalog explicitly requests the product's Buy Now checkout, one item, the office address, free standard delivery, existing Visa, gift-card balance applied and no Plus trial, then stops before placing the order. It names exactly one output row with four columns in order: item, address, arriving, total. Product name and address must match the site verbatim, including the address name; the date uses the site's delivery-date wording and total uses its dollar format. The workflow has one nonempty expected record containing all four named fields. Expected answer values, private account literals and locator details are not copied into this report or model guidance.

The expected account fact preserves both original cart lines with their original identities, quantities and selections; saved items, next-line counter, zero orders and newsletter preference are unchanged. Checkout remains open. The separate checkout fact requires the Buy Now pipeline, exactly one intended item, office destination, existing Visa, gift card enabled, standard delivery and trial disabled. The anti-challenge fact also holds. A cart-route approximation is not equivalent to this oracle.

The task authorizes preparation and checkout choices only. It does not authorize placing/finalizing an order, moving money, a trial/subscription or unrelated account/cart changes. No permission override or added --llm-permit is proposed. Before each trial/whole rerun, the model must reverse only this build's own lasting acts through normal site controls, preserving original account state. The run must not use fixture resets between model trials.

## Prior changed cause and debug

Existing required debugs are present: docs/working/language-driven-flow-loop-plan/debugs/run-mvcx8na6-9554a3f1.md and run-mvczd85j-c98561c5.md. The first failed before producing a Flow after choosing Add to Cart, looping and being refused a repeated brief. The lane's fix1 allows one fresh brief after the no-progress guard stops a builder, carrying earlier-attempt evidence; its reported narrow validation is retained in reports/live-lane-1.md. This preparation did not reverify that implementation.

The second failure still chose Add to Cart and never tried Buy Now. It did not exercise fix1 because no loop stop occurred. At the time it was parked as a model-reading issue. The subsequent accepted provider-free audit, reports/audit-everything-store.md, identifies a task ambiguity: the old wording did not name the route although the oracle required Buy Now and an untouched cart. It revised the task to explicitly name the site's Buy Now control and exact output formats, preserving the oracle and fixture. This is the changed cause supporting the owed repaired rerun; it is not an unchanged paid retry or an added model hint. Own catalog history records the wording change at842e691623a85730b093e528aef0cb27ebdf84d7. No paid proof of the repaired wording is claimed by the earlier audit or this preparation.

## Lane and readiness prerequisites

- Proposed fresh workspace codex-office-checkout-t563-20261018-r1: verified absent beneath own test-runs/instances/bf-slot-1/persistent-isolated.
- Global lab-slots/slot-1/owner exists and structurally names own t563 task/bf-slot-1; pid is null. This is an assigned marker, not proof of an active owned run. It was not changed or removed. Normal owning launch/slot guards still decide admission.
- Read-only own Core currentness guard node scripts/check/core-build.mjs observed native0. No library rebuild was needed or performed during preparation. Observed paired HEADs downstream d25a231a3c09b05b4fcdfd547b1a6ed22d777fa6 / Core affe6202d6e38b0fcfb3b717e48bc75b41714d95. Supervisor refresh is still pending; recheck actual currency after that handoff and let the normal owner decide any necessary reuse/preparation.
- Actual authenticated Core trialRunner/startReset cannot yet be observed because no new host/session has been launched. Required live receipt is trialRunner=true/startReset=false/source=core; caller policy flags do not substitute for that observation.
- Normal previous-debug, positive-data, balance/waste, slot and source/currentness guards remain required. No overrides, broad suite, shared Core build or old6404 access.

After supervisor refresh/release only, exact proposed owning command from t563 downstream:

```powershell
$env:FLUXIQ_BUILD_CACHE_DIR='off'
$env:FLUXIQ_LAB_INSTANCE='bf-slot-1'
$env:FLUXIQ_TEST_TARGET='persistent-isolated'
pnpm.cmd lab run everything-store --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --authoring-mode project --llm-task create-flow --instruction-task everything-store-office-checkout-review --target persistent-isolated --workspace codex-office-checkout-t563-20261018-r1 --model-reset-only --replays 1 --llm-max-cost-usd 0.25 --llm-max-calls 250 --llm-max-run-tokens 48000000
```

Acceptance requires actual real-extension-chat creation, judged whole run, exact positive one-row/four-field oracle and account/checkout obligations, plus a separate explicit0calls/cost/noharness replay with unchanged saved Flow. Report paid accounting and repair/hash evidence honestly. Failure requires preserved first divergence and a new terminal debug; no second unchanged paid retry. No acceptance or live startup is claimed here.

Only this NEW report is authored for preparation. Readers exited; ready for root preservation/refresh/release.

## Released r1 execution

Supervisor preserved preparation2def8820 and explicitly released one run after paired refresh. Frozen heads verified clean: downstream fbc5411cc89b5efb7ab8575db93654bfdb5162a3 / Core ff4c1d11428fd1f9e0264050d0bf795a779b1f3c. Workspace absence rechecked; owning Core currentness guard native0. No library rebuild.

Started the exact command above once; retained owning session54202 and private log node_modules/codex-office-checkout-live-20261018-r1.log. Normal prelude holds all three own Core library step leases. Initial test-contracts/scenario-lab registry preparation reused valid stamps. Allocation/authenticated readiness/terminal outcome are not yet claimed. Source/HEAD/profile protections remain in force; no provider guidance or override was added.

## Terminal r1 failure

Run `run-mved5pro-91998cc2` (bf-slot-1, real extension chat) failed with
`lab.chat_build_failed`: no Flow was created, $0.0208, about 8 minutes. The full
debug is `docs/working/language-driven-flow-loop-plan/debugs/run-mved5pro-91998cc2.md`.
This was a read-only analysis: no source edit, build, browser or paid run.

- The reworded task worked. The model chose Buy Now, reached
  `Checkout (1 item)`, and the cart stayed at 2 items. The wording is not the
  cause.
- First divergent step: 0039. `core.test_subflow` asked for act-5 (the Buy Now
  press, declared `create_new`) to be undone. On this site Buy Now opens a
  checkout session that the next Buy Now replaces, and no control closes it.
  Fresh cart reads after the act (0049, 0053) proved the cart, the destination
  the model named under the create precondition, was exactly as found. Core's
  reset ledger has no rule that uses that evidence. A strict create_new is
  settled only by deleting its subject from the destination, and a kept strict
  act refuses every trial (`candidate.trial_reset_unproved`, 0051 and 0055). The
  build had no way forward and ended blocked.
- Cause class: a Core product defect in
  `site-reset/ledger.ts` `AutomationStudioSiteResetLedger.beforeTrial` /
  `unprovedReset`. A contributing model mistake (Buy Now declared `create_new`,
  with the cart as its destination) is one the product should recover from.
- Proposed fix: record the destination a create_new was admitted against
  (`site-reset/create-baselines.ts` `check`, carried through
  `flow-bootstrap/action-permissions.ts`, stored by `ledger.ts` `record`). In
  `beforeTrial`, when a complete fresh read of that group after the act is
  exactly the original and the subject is absent, drop the act's strictness. It
  then follows the existing honest cannotUndo path: the trial runs with
  `startedWith.cannotUndo` and the judge is told. Add one generic sentence to
  `site-reset/words.ts`. The tests go in `site-reset/tests/ledger.test.ts` (admit
  case plus three still-refused cases) and `create-baselines.test.ts`. No
  change to the task, the oracle or model guidance about this site.
- Secondary: the reset brief threw `flow_bootstrap.provider_evidence_loop_context_invalid`
  in provider preflight before any model call
  (`runtime/llm/deepseek/preflight.ts`), and the build ended with a thrown
  `post_provider_validation_failed`. It needs its own provider-free
  reproduction.
- Also noted: revision 2 had no step that sets the office address, so the oracle
  would have failed at trial. That is normal loop work, but it was not reached.
- Do not run an unchanged paid retry. Rerun once after the ledger fix lands and
  the trees are synced.

## Terminal r2 failure

Run `run-mvfq94ff-c8c21493` (bf-slot-1, workspace
`claude-office-checkout-t563-20261019-r2`, real extension chat, $0.25 ceiling)
failed with `lab.chat_build_failed`. No Flow was created. It made 101 calls,
cost $0.0695 and took about 13 minutes, on dev 79fbbb7a and Core e11549a8,
which include F1 and F3. The full debug is
`docs/working/language-driven-flow-loop-plan/debugs/run-mvfq94ff-c8c21493.md`.
This was a read-only analysis: no source edit, build, browser or paid run.

- **How far it got.** It got further than r1. F1 worked for exploration acts:
  each Buy Now press sent with `resetDestination` was settled by the next
  complete, unchanged cart read (act-11 at 0064, act-15 at 0135 and 0137). The
  trial of revision 1 ran (0066) and the judge correctly found the home
  address, giving exact advice. Revision 2 added the office-address steps but
  was never tried.
- **First divergent step: 0078.** The retest of revision 2 was refused for
  act-12, which is the trial's own Buy Now. The ledger records a trial step's
  act with no destination (`site-reset/ledger.ts` `trialRan`), so no amount of
  unchanged cart reads settles it. F1's only way out is for the model to name
  `resetDestination` on a look under `undoes`. The model missed the ref at
  0080, 0084 and 0094, and malformed the call at 0088. It then named cannotUndo
  (0092), which makes a strict act "kept" and refuses every trial
  (`trial_reset_unproved`).
- **Dead end.** A look moves neither of the loop's epochs, so the identical
  retest after a settling look is answered from memory
  (`llm_evidence_loop.already_answered`, 0096-0110), and brief-2 ended on
  `repeat_without_progress`. In repair brief-4 the model did exactly what the
  instruction asks (0151: a complete read, `undoes: act-12`,
  `resetDestination: destination-1`). It then resubmitted unchanged instead of
  testing, and the brief ended (0155-0161). Even a retest there would have been
  answered from memory. The owner is `runtime/llm/evidence-loop.ts` `runCall`,
  with `repeat-policy.ts` `automationStudioLlmEvidenceRequestSignature`.
- **F3 held.** The reset brief ran, passed preflight, and its completions
  parsed with `cannotUndo` intact. It could not finish, though. Its
  instructions (`reset-loop.ts`, and the reset brief body in `brief-ports.ts`)
  say cannotUndo keeps an act as done, but a strict act stays claimable and in
  place, so `project.reset_acts_in_place` was answered four times. Core
  correctly refused the reset's attempt to delete a pre-existing cart item
  (0193, `candidate.undo_unproved`).
- **Cause class.** A Core product defect: F1's stricter rule has a dead end for
  a trial's own act. Contributing model mistakes were each caught by the
  product: a false claim that the office address was already set (caught by the
  trial judge), a plan output nobody makes (recovered by `amend_plan`), and the
  unchanged resubmission. The task wording is not the cause.
- **Proposed fix, least general first.**
  1. In `ledger.ts` `trialRan`, a trial act inherits the destination of the
     explored act it repeats (same control, consequences and page). Tests go in
     `site-reset/tests/ledger.test.ts`: an admit case, plus other-control,
     changed-read and no-read refusals. This alone would have let 0082 run
     revision 2.
  2. In `evidence-loop.ts` `runCall`, an action refused unrun stays "answered"
     only until the next call runs, so a retest after a look reaches the ledger.
     The no-progress guard still bounds it. Test in
     `runtime/llm/tests/evidence-loop.test.ts`.
  3. Correct the reset words for strict acts, using
     `site-reset/words.ts` `nameDestination`.
  None of these touches the task, the oracle or model guidance about this site.
- Do not run an unchanged paid retry. Rerun once after fixes 1 and 2 land with
  their tests and the lane trees are synced.
