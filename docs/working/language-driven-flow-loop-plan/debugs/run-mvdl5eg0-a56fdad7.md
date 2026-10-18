# run-mvdl5eg0-a56fdad7 — canonical model-reset-only r4 failure

Status: Debugged; source investigation read-only; no rerun authorized.

## Actual run and accounting

Normal launcher68904 exited1. Source downstream57ad8dc2/Core2b13e40c
(executable Core e58), fresh persistent workspace
codex-reset-positive-t719-20261018-r4, headed Chromium bf-slot-2, real extension
project chat, unchanged everything-store-kettle-to-cart instruction. DeepSeek
flash; .25USD/250calls/48000000tokens; model-reset-only; requestedreplays1.
Normal waste/staleness guards admitted, no override. Authenticated running Core
reported candidateTrial.startReset=false; Lab fixtureResetBetweenTrials=false.
Closed no-hook receipt node_modules/codex-reset-canonical-r4-readiness.json.

Terminal runtime.behavior, flowCreated=false,108persistedsteps,263342ms.
53actualcalls/$0.032546700:52buildcalls/$0.032338860 plus1chat/$0.000207840.
Final pendingCalls0/budgetBreaches0/unrecordedCalls0/uncountedPhasesempty.
No whole-run oracle, judge, successful Flow or replay; those are unavailable,
not zero-call successes. Source/profile/run artifacts preserved.

Artifacts: test-runs/instances/bf-slot-2/run-mvdl5eg0-a56fdad7/{evaluation.json,
summary.json,snapshots/flow-lane.json,snapshots/live-llm.json}; complete steps
C:/Users/osrs_/FluxStuff/lab-runs/2026-10-18/run-mvdl5eg0-a56fdad7/steps;
normal launcher log node_modules/codex-reset-canonical-r4.log.

## Observed reset sequence

- 0004 through0029 show no Cart destination read. All persisted results with
  location before0035 are non-Cart. 0029 declares create_new and succeeds;
  ledger receipt later identifies this lasting effect as act-8/add-to-cart-1.
- 0033 trial correctly refuses candidate.trial_reset_required with act-8.
  0035 is the FIRST observed Cart page, after the lasting act. Its location
  digest is bbf36f737e9d68c3. This late read cannot become original authority.
- 0037 modify_existing/undoes act-8 then0039 delete/undoes act-8 both refuse
  candidate.undo_unproved without executing. The generic response says exact
  inverse unproved and requires a destination observed before effect creation.
- A second builder repeats exploration. 0066 declares create_new and succeeds;
  0072 trial retains both act-14 and act-8 (same opaque did digest
  924a4c95524db5dce9c1). No clean trial occurred between these lasting adds.
- 0074 empty-consequence inverse for act-14 is refused;0076 revisits the same
  Cart location;0078 delete for act-8 refuses. 0088 cannotUndo-style trial is
  candidate.trial_reset_unproved, so leftovers are NOT admitted as reset.
- 0090 delete for act-14 refuses;0092/0094 quantity-control guesses are
  target_unobserved;0096 undeclared inverse refuses. Final supervisor reset
  dispatch0106 navigates0107 but does not restore/finish the Flow. 0108 ends
  failed; final issueCodes flow_bootstrap.post_provider_validation_failed and
  project.build_blocked. Existing phone-case move was never reached.

## Read-only causal comparison and limits

The passing actual installed-gateway diagnostic explicitly observed complete
original Cart2/2 BEFORE Add, then observed3/2, acted on a positive same-subject
inverse, restored the exact ordered2/2 baseline, and admitted the clean trial.
The canonical model instead first observed Cart AFTER Add. Its0028 pre-Add
provider request ALREADY contained the generic requirement to inspect a complete
destination inventory before creating an effect that must be removed there.
0036 contains that instruction twice. This is a concrete missed precondition,
not missing post-failure wording. The pointer eligibility source fix remains
provider-free proven, but cannot manufacture unobserved original ownership.

The private opaque reset original/current inventories and target subjects are
not persisted in this paid run's sanitized model evidence. We must not invent
exact runtime ledger digests, claim the target lacked a subject, or assert a
specific internal predicate result as observed. Retained act ids/consequence
calls and refusal codes above ARE actual receipts. Subject availability on the
specific paid targets still requires structural instrumentation if it matters;
no complete pre-act Cart authority exists in the observable exploration path.
Original quantities/order cannot be recovered from the late Cart read.

No source changes or paid retries were made. Next investigation is bounded to
pre-action baseline admission and its owning tests/guidance: refuse an unsafe
reversible cross-page effect BEFORE execution when exact later restoration
would need absent original authority, then allow a safe observation/retry. Do
not broaden Delete permission, infer source absence, overwrite baseline with
post-effect reads, or reset the fixture. Supervisor must approve any next
implementation brief; Core ledger remains read-only during this diagnosis.
