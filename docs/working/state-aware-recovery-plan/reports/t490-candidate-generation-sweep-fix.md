# t490 candidate-generation sweep fix

## Outcome

Done. All four failures had one cause: the test pinned behaviour from before t485. The product is right, so I fixed the test. No product file changed.

## What changed and why

**Cause (all four cases).** In the test, revision 2 was the fixture plan with only the router's `name` changed. Commit `ceacdc33`, merged as `cdc2c374` (Merge task t485), added `automationStudioCandidateSameBehaviour` in `flow-bootstrap/candidate/unchanged-submission.ts` and wired it into `candidate/submission.ts`. A resubmit that differs from the last revision only in display words (the Flow, rule or block `name`, a step `label`, a record-output `label`) is now refused with `candidate.unchanged_submission` (`reworded: true`). It does not become a new revision.

So in the test, call 3 was refused as unchanged. Call 4 (`core.test_candidate` with that refusal's revision and digest) and every later decision came back as `llm_output.invalid_evidence_tool_call` / `invalid_evidence_completion`. The loop then ended as `flow_bootstrap.evidence_unusable_decision` at stage `provider_output_validation`, with 12 decisions, $0.012 and 180 tokens. That explains every reported mismatch:
- proposed: the build threw.
- stale and save_failure: wrong stage and wrong accounting.
- cancel: the cancel was never reached at call 5, so the cause carried accounting of 60 tokens and $0.004.

**Why the product is right.** This rule is t485's deliberate N1 fix: lane D round 12 trialled three reworded copies of one Flow. The header of `unchanged-submission.ts` documents it, and its own tests (`candidate/tests/unchanged-submission.test.ts`) cover it. A renamed router does not change anything a run does.

**Test fix** (`packages/fluxiq/src/programs/automation-studio/runtime/service/flow-bootstrap-commands/tests/candidate-generation.test.ts`):
- Added `revisedPlan()`, which is the fixture plan with the end step's key changed from `end` to `finish` and its edge retargeted to match. The t485 header names a step-key change as a behaviour change, because edges and bindings read the key.
- Revision 2 now submits `revisedPlan()` instead of a router rename.
- Updated the comment to say why a rename alone would no longer make a revision 2.

All the other expectations are unchanged: revision 2, two judge calls, the accounting of 515 tokens and $0.006, and the saved plan's definitionIds still being start and end.

## Commands run and observed results

All run in `C:/Users/osrs_/FluxStuff/fxwork/t490/!FluxIQ`.
- Before the fix: `npx vitest run .../flow-bootstrap-commands/tests/candidate-generation.test.ts` printed "Tests 4 failed | 10 passed (14)", the same 4 failures the sweep reported.
- To diagnose, I temporarily logged the diagnostic in the test (then restored the file). The evidence-loop steps were: inspect, submit, submit -> `candidate.unchanged_submission`, then `core.decision_unusable` x9.
- After the fix, the same file printed "Tests 14 passed (14)".
- `npx vitest run src/programs/automation-studio/runtime/service/flow-bootstrap-commands/` printed "Test Files 24 passed (24)" and "Tests 125 passed (125)".
- `pnpm check` in `packages/fluxiq` (tsc --noEmit) completed with no type errors (build-cache step `fluxiq:check`, 40498 ms).
- `pnpm structure:check` at the Core root printed "structure-audit: passed (338 warning(s), 1159 baselined)". It also said "2 baseline entries can be lowered". Those entries are not from this change, and I did not run `structure:baseline` (the baseline file is not mine to edit).

## Not verified

- I did not run the full Core suite, any Lab run or any provider run, as the brief said.
- I did not bisect. The cause is shown directly by the observed `candidate.unchanged_submission` result and by the t485 diff.
- The suspects t482, t484, t486, t487 and t488 play no part in this failure.

## Open questions or contradictions found

- The comment in `unchanged-submission.ts` says a renamed step key "is a change", and the test now relies on that. If a later task narrows behaviour comparison to ignore keys, this test would need another real change, for example an added node.
- The structure audit can lower 2 baseline entries. That is for the supervisor to record with `pnpm structure:baseline`.
