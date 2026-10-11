# run-mv4dcf2j-cb68009a: paid proof R4a passed after t436-t441

Launched 2026-10-11 22:02 UTC by the supervisor from `fxwork/t418` (instance `t418-proofs`, workspace `t418-r4a-5`;
downstream `8c4ba42c`, Core `cf8a0001`, both at `dev`, rebuilt). Supervised live to its end. Verdict **passed**;
$0.0365 for the whole Flow against the $0.10 ceiling (`buildsOverCeiling` 0). Gate before launch: provider-free
recovery matrix, every case (1, 2, 3, 4a, 4b, 5-11, 13a, 13b) passed (`rmx-2026-10-11T21-44-45-153Z-962fd9` and the
explicit-case run after it).

## What happened

- Build (22:02-22:04, 20 decisions, 81 s; the previous attempt took 24 and 138 s): explored, submitted; two submits
  refused `flow_bootstrap.evidence_completion_parameters_unresolved` (same digest `c140a77e` twice: the model resent an
  unchanged draft once), the third accepted. One decision (iteration 10) was unusable
  (`llm_output.invalid_evidence_decision`) and the next one carried on.
- Trial 1 passed (`candidate.trial_yes`, 22 s); completion check ok; Flow applied.
- Lab replay on a freshly loaded page: 8 steps, oracle passed, no harness activation, no repair. The saved chips
  (7-in-1, Spain) were found where saved: the t436 defect is gone live.
- Bundle published normally; 52 step logs in `~/FluxStuff/lab-runs/2026-10-11/run-mv4dcf2j-cb68009a/steps`.
- Supervision watched the session's Core log by polled reads (no handle held inside the staging folder).

## UI review

Chat-first, one message and card per step, the result check card, and a plain ready message. Wording defects:
"Closed 2 notices the page put in the way — It was covering the page" mixes plural and singular; trial cards repeat
the verb ("Choose · choose shipping from Spain"); a search box is named by its promotional placeholder ("Autumn Mega
Sale: up to 70% off").

## Next

R4b (in-run repair after the basket redesign), same supervision.
