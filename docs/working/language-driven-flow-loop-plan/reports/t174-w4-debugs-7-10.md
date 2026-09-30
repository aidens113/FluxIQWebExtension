# t174-w4: debug files for live runs 7 to 10

## Outcome

Done. Four debug files written from each run's own bundle, plus the lane report's Runs rows 7-10,
"Fix 2" and the section before it.

## What changed and why

Created (docs only, under `docs/working/language-driven-flow-loop-plan/debugs/`):
- `run-munda7ub-d9214e3b.md` (run 7, full form): 22-decision timeline (11 tool_call of which 1
  answered from memory, 8 amend_draft, 3 complete), completion verdicts `invalid_subflows` x2 and
  `instructed_act_missing`, one dry run (positions 9 and 10 replayed), throw 27 ms after the
  refused `act1` (`target_not_found`), failure record `pre_provider_validation_failed` /
  `not_attempted` / `not_received`, no issueCodes.
- `run-mune0xh1-2470406a.md` (run 10, full form): 17-decision timeline (15 tool_call, 1 from
  memory, 2 amend_draft, no completion), 4 `target_unobserved` rejections, throw 143 ms after
  `c18`, failure record `provider_output_validation_failed` / `attempted` / `received`,
  `issueCodes: ["thrown.Error"]`.
- `run-mundl2j0-df8e4a32.md`, `run-mundupr5-f1cde5aa.md` (runs 8 and 9, short facility form):
  pairing timeout at pre-approval, 15,000 ms timeout, `connectionState: unreported`, 0 calls.

Causes are marked fixed (Fix 2's `draft-shown.ts` reader; the thrown-issue-codes/stage fix; the
`--enable-source-maps` Lab change) or open with the owner the report names, or "no owner named".

## Commands run and observed results

- Read all bundle files for the four runs with `cat`; `provider-failures.local.json` was read
  only through a node script that printed code/stage/invocation/response/issueCodes/retryable/at
  values and withheld every other value.
- Validation script (header line plus `## Header`, then `ls`-equivalent `-e` checks of every
  backticked artifact path and every run id in each file): all headers present; every cited
  artifact resolved except `logs/core-web-build.log` in runs 7 and 9, which those files cite only
  to state it is absent (confirmed absent). All run ids resolve to bundle directories.

## Not verified

- Stage 1 expected node chain for crossborder: the scenario source was outside the brief and not
  read, so the full-form files give no divergence-from-chain analysis.
- Attribution of run 7's throw to `draft-shown.ts` rests on the report's signature match; the
  bundle has no issue codes or frame for run 7. Draft size (packed or not) is not in any artifact.
- Memory at launch for run 8: not in the bundle or the report.

## Open questions or contradictions found

- The report says run 7's throw came "about 50 ms" after the tool call; the artifacts show 27 ms
  to the Lab failure record and 37 ms to the settle event.
- Run 10: the Lab counts 1 call (`evaluation.json`) while Core logs 17 decide round trips and
  `providerCalls: null`; run 7 counts 0 against 22. The accounting-on-throw gap has no named owner.
- Run 7's build `durationMs` (207,966) is about 10.5 s shorter than dispatch-to-settle (218.5 s);
  not reconciled.
