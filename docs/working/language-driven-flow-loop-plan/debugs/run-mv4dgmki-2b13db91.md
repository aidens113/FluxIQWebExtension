# run-mv4dgmki-2b13db91: paid proof R4b failed; the repair worked but could not be judged a success

Launched 2026-10-11 22:05 UTC by the supervisor from `fxwork/t418` (instance `t418-proofs`, workspace `t418-r4b`;
downstream `b5986d1c`, Core `cf8a0001`, both at `dev`). Supervised live to its end. Verdict **failed**
(`web.target.not_found`); $0.0887 for the whole Flow against the $0.10 ceiling (one purse, t438). The bundle
published normally and the ledger recorded the real verdict (t437 held).

## What happened

- Build (22:05:58-22:07:12, 16 decisions, 74 s): two submits refused
  `flow_bootstrap.evidence_completion_parameters_unresolved`, the third accepted; one unusable decision (iteration 8,
  the model wrote `kind: callId` for `kind: tool_call`, every other field correct) and the next carried on. Trial 1
  passed; Flow applied.
- After the basket redesign, the replay failed and the repair loop (22:07:58) amended step 7 (add to basket) in three
  decisions and reran every step (`core.replay.replayed/verified`); completion check passed.
- Judge 1 (22:09:25) `no`: step 7 "was withheld and only verified, so the cart was not actually filled in this test";
  and the coupon step "targets a bare div with class b inside a shadow host ... the coupon is already collected in
  startView ... the Flow has no step that actually collects it". The model then declared complete without a change
  (refused `bootstrap.flow_unchanged_since_judged_wrong`), amended step 2, reran; judges 2 and 3 `unknown`. The ladder
  stopped and the run ended on the original `web.target.not_found`.

## Defects

1. The repair's test withholds the committing act (never pressed twice), and the judge refuses because the act was not
   performed: two rules that contradict each other. Report: `state-aware-recovery-plan/reports/r4b-withheld-act-judge.md`.
2. The optional coupon step is saved against the control's post-click words ("Collected") because the model authored
   it from a view after exploration had pressed it; on a fresh page ("Get coupons") it cannot match, and an optional
   step that does not match is passed over, so the requested act silently never happens. Report:
   `state-aware-recovery-plan/reports/r4b-coupon-step-identity.md`.
3. Recurring in both runs: the model's first one or two submits are refused for unresolved parameters (cost one or two
   calls each run), and a decision whose only fault is `kind: callId` is discarded whole although its shape is
   unambiguous.

## Next

Fix 1 and 2 (and 3), merge, sync `fxwork/t418`, run the provider-free matrix, relaunch R4b.
