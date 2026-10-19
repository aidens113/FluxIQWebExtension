# run-mved5pro-91998cc2 — office checkout review r1 failure

Status: Debugged terminal failure. Read-only analysis; no source edit, build,
browser run, paid run or commit was made for this debug.

## Run

- Task `everything-store-office-checkout-review` (scenario everything-store,
  oracle `extract-checkout-review`), built from the real extension chat on
  bf-slot-1, persistent-isolated, model-reset-only, DeepSeek flash.
- Run folder: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-18/run-mved5pro-91998cc2`.
- Verdict failed, `lab.chat_build_failed`, no Flow created. 62 step folders
  (the run summary counts 27 steps), about 8 minutes (21:54:50 to 22:02:41),
  $0.0208.
- Chat ending: "I could not build this. Clicking Buy Now on the kettle takes it
  straight to checkout, and nothing on the site can undo that, so the run could
  not be put back the way it started and could not be tested."
- `logs/core.log` ends with `build throw ... flow_bootstrap.post_provider_validation_failed`
  after the reset brief's first decision threw
  `flow_bootstrap.provider_evidence_loop_context_invalid` (see secondary defect 2).

## What went right (the earlier wording fix held)

The two earlier failures chose Add to Cart. This time the model followed the
reworded task: it searched, opened the white 1.5 L Basics kettle (0017), pressed
Buy Now (0027) and reached `Checkout (1 item)` with the cart still showing
"2 items in cart". The task wording led to the right route, so wording is not
the cause of this failure.

## Timeline of the divergence

- 0018: builder presses Buy Now and declares `consequences: ["create_new"]`.
- 0019: Core refuses before running it, `candidate.create_baseline_required`:
  an identified create_new must first observe "its destination's complete
  original inventory". Buy Now has no destination list on this site; it opens a
  checkout session. The model picks the cart as the destination (0020/0021),
  which issues `destination-1` and `destination-2` (cart lines and saved items,
  2 each).
- 0026/0027: Buy Now runs with `resetDestination: destination-1` and lands. The
  ledger records it as act-5, a strict reversible act (create_new with a page
  spot, so `strictReset` is true).
- 0036/0037: revision 2 accepted (Buy Now, standard delivery, gift card, trial
  off, four reads).
- **0039 (first divergent step):** `core.test_subflow` returns
  `candidate.trial_reset_required` with act-5 "click Buy Now" under actsToUndo.
  From here no path exists to a trial.
- 0040 to 0053: six `browser-navigate` calls under `undoes: act-5` (product page,
  cart, checkout). Each is a look, so it is not an attempt. The fresh cart reads
  at 0049 and 0053 return the same two destinations with the same counts (2 and
  2): the cart is exactly as the build found it.
- 0051 and 0055: `candidate.trial_reset_unproved` for act-5.
- 0056/0057: builder and supervisor end blocked. 0058: completion refused
  `project.completion_reset_first`. 0059 to 0061: reset brief dispatched; its
  first decision throws in provider preflight with no model call. 0062: honest
  blocked ending.

## Cause

**Class: product defect (Core), with a contributing model mistake the product
should have recovered from.**

Owner: `!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/ledger.ts`,
`AutomationStudioSiteResetLedger.beforeTrial` with `unprovedReset`,
`originalGroupRestored` and `record` (and the create precondition in
`site-reset/create-baselines.ts`, `AutomationStudioSiteResetCreateBaselines.check`).

How the ledger settles a strict act:

1. `originalGroupRestored(act)` needs the act's subject to be in the original
   baseline. That covers an existing item changed back, not a create_new whose
   subject was absent before.
2. `subjectRestored(act)` needs `act.subjectUndo`, which `target()` sets only
   when the subject is now present in the observed destination and a `delete`
   on it is pressed.
3. Anything else stays strict. Once the trial policy admits with leftovers, or
   the model names `cannotUndo`, the act becomes `kept`, and `unprovedReset`
   refuses every ordinary trial for good (`candidate.trial_reset_unproved`).

A create_new whose effect never appears in any collection (here an open
checkout session that the site replaces on the next Buy Now, with no control to
close it) meets neither proof. The precondition at 0019 forces the model to name
some destination. The ledger then has positive evidence that this destination is
wholly unchanged after the act (0049, 0053), but it has no rule that uses it.
The build ends in a dead end that no model behaviour can leave. Every task
whose first lasting act has no on-site inverse and no list to check fails the
same way (a checkout or booking draft, a form saved as draft and replaced on
resubmit, and so on).

Contributing model mistake: Buy Now was declared `create_new` ("create something
new that stays"). An open checkout that the next Buy Now replaces is arguably
not something that stays. Declared `none`, the ledger would have recorded it as
a possibly lasting act that never refuses a trial (header note t593). The cart
was also a wrong destination, since the task itself says Buy Now leaves the cart
alone. Over-declaring is the safe direction for permissions, so the product
must not turn it into a dead end.

Not the cause, noted for the next run: revision 2 had no step that changes the
delivery address to the office. The checkout opened on the home address
(0027, t987), so a trial or the judged run would have failed the oracle's
address field. The trial loop would normally catch that; it was never reached.

## Proposed fix (least and most general)

Let a strict create_new act be settled as "not in its declared destination"
when there is positive evidence for it, and then handled as an honest
unresolved act instead of a permanent block:

1. `site-reset/create-baselines.ts` `check`: when it admits a create_new by a
   baseline, return which original it used: `{ kind: "admit", destination: { scope, group } }`.
2. `flow-bootstrap/action-permissions.ts` (the `permission` closure that calls
   `siteReset.createBaseline`): carry that destination on the `explored` call,
   and have `ledger.ts` `record` store it on the act (`act.destination`).
3. `ledger.ts` `beforeTrial`: add `destinationUntouched(act)`. It holds when
   the act is a single create_new with `act.destination`, a complete read of
   that group landed after the act (`groupObservedAfter >= sequence`), the fresh
   group has exactly the original scopes, every original scope passes
   `collectionRestored`, and the subject is absent from every current scope of
   the group. When it holds, set `act.strictReset = false`. The act stays
   listed. If the model names it under `cannotUndo` (or it is asked twice), it
   is kept, and the trial runs with `startedWith.cannotUndo` and the judge is
   told, as the existing non-strict path already does.
4. `site-reset/words.ts` `resetRequired`: one generic sentence saying that an
   act whose checked destination shows no trace of it, and which no site control
   reverses, is reported under cannotUndo. The sentence must name no site,
   product or task.

Why this keeps the t719 protection: an act whose subject did land in an
observed destination still needs the exact subject removal. An act whose
destination was never read again after it still refuses. Only a destination
proved wholly original, with the subject absent, unlocks the honest
leftover path, and the judge always hears about the leftover. Model guidance is
not changed toward this task, and neither the oracle nor the task is touched.

Proving tests (Core, beside the code):

- `site-reset/tests/ledger.test.ts`: observe a group with two scopes; record a
  create_new act on page subject S admitted against `destination-1`; read the
  same group again, unchanged and S absent; `beforeTrial` with
  `cannotUndo: [act]` admits with `startedWith.cannotUndo` naming the act
  (today it returns `candidate.trial_reset_unproved`).
- Same file, negative cases: (a) the fresh read shows S in the destination: it
  still refuses until S is deleted (unchanged t719 behaviour); (b) no fresh read
  of the group after the act: it still refuses `trial_reset_unproved`; (c) a
  sibling scope changed: it still refuses.
- `site-reset/tests/create-baselines.test.ts`: `check` returns the destination
  scope and group on admission.

## Secondary defect 2: the reset brief cannot make its first decision

At 0060/0061 the supervisor's reset brief (`kind: reset`) opened the store and
then threw `flow_bootstrap.provider_evidence_loop_context_invalid` in 9 ms,
before any provider call. The whole build then threw
`flow_bootstrap.post_provider_validation_failed` instead of ending through the
normal path. The refusal comes from
`runtime/llm/deepseek/preflight.ts` `validateAutomationStudioDeepSeekRequest`:
either `validEvidenceLoopContext(request.context)` or, via
`runtime/llm/harness/request-evidence-check.ts`
`automationStudioLlmRequestEvidenceRefusal`, the gathered evidence check. No
request was written for that decision, so the artifacts do not show which slot
failed. It did not change this run's outcome (the act had no inverse), but it
means a reset brief may fail to start whenever it is dispatched. It needs its
own provider-free reproduction: a project-build test that dispatches a reset
brief after a builder's evidence loop and asserts its first request passes
`validateAutomationStudioDeepSeekRequest`.

## Rerun guidance

Do not rerun this task unchanged. Rerun once after the ledger fix lands and both
trees are synced. Expect the model still to need to add the office-address step
once a trial or the judge reports the home address.
