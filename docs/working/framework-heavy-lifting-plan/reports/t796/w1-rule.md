# t796 w1-rule report

## Outcome
Done. A step that does a requested act is refused when conditional (`optional:`, `only after:`, or reached only from an optional step's `on success:`).

## What changed and why
Core tree: C:/Users/osrs_/FluxStuff/fxwork/t796/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap
- instructed-acts/optional-act-steps.ts: `automationStudioInstructedActOptionalScriptIssues` now finds three kinds of conditional step. It refuses `only after:` at the `only after:` line (`flow.line.<n>`) with Core's sentence from the brief. It refuses a step reached only by an optional step's written `on success:` (success/succeeded/done port, non-Core-written branch, no other written branch reaches it) at the branch line. The `optional:` path and message are unchanged. A step is now also read as doing an act when its plan node's declared `consequences` holds the class (`act.consequence`: delete, move_money or send_or_publish) that one of the instruction's lasting acts names by verb. Decline words still exempt it. Header updated.
- script-statements/guarded-steps.ts `strayRefusal` ("labels no step"): adds "A step behind `only after:` runs only on passes where that step acted, so a step that does what the request asks must not carry it."
- candidate/submission.ts: NOT changed. The task parts (`changeParts`) belong to the trial gate and need a candidate, so they are not reachable at the `submit` call site. The consequence match therefore uses the instruction's own acts (their verbs' implied classes), not the parts' typed effects.
- Tests added: instructed-acts/tests/optional-act-steps.test.ts (requested-act behind `only after:` refused at line 16 with the sentence; consequence-match case; plain wait behind `only after:` accepted); script-statements/tests/guarded-steps.test.ts ("a misplaced `only after:` says what it does"). Generic library example.
- No test for the `on success:` kind. It is implemented but untested (see Not verified).

## Commands run and observed results
- Fail-first, before the source change, on the two test files: "3 failed | 16 passed (19)". The failures were the only-after refusal, the consequence-match case, and the guarded-steps message.
- After the change, in packages/fluxiq: `pnpm test .../instructed-acts .../script-statements/tests/guarded-steps.test.ts .../candidate`
  - parallel group: "Test Files 48 passed (48)", "Tests 589 passed (589)"
  - real-sql group: no matching files
  - final line: "[vitest-groups] all groups passed: parallel, real-sql"
- Each run took the shared heavy-check lock and released it.

## Not verified
- No tsc (the supervisor runs it).
- The `on success:` kind has no test. Whether the parser keeps a written `on success:` branch with port text "success" was not checked by running it.
- The consequence match runs only against the instruction's acts, not the task parts.

## Open questions
None.

## Sentence for plan/flow-script-format.ts line 431 (supervisor applies)
"A step that does what the request asks (the press, the save, the claim, the booking) never takes `optional:` or `only after:`: a step behind `only after: <label>` runs only on passes where <label> was done, so on a pass where <label> finds nothing to press the act is passed over and never done; keep both for a banner or popup the page only sometimes shows."
