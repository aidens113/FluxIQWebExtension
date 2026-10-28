# t775-E2 report: readers of the already_in_state skip

## Outcome
Partial. Three readers fixed with tests; the chat-contract change was left (see Open questions).

## What changed and why
- R/service/summaries/skipped.ts: run detail now keeps `already_in_state` (code, trimmed row) as its own reason instead of falling to `target_absent`.
- src/programs/automation-studio/model/flow-adaptation.ts: the run-detail attempt record's `skipped` union gained `{ reason: "already_in_state"; code; row? }` and its doc says it is no failure and no earlier act. This is the "Flow adaptation model" reader; it holds a type only, so it is covered by the skipped.ts test and the typecheck.
- R/service/candidate-trial/feedback.ts: skippedSaid says "Its control already showed the asked state, so it was not pressed." (before: "The page was already at another step...").
- Tests added: summaries/tests/skipped.test.ts, candidate-trial/tests/feedback.test.ts. Both failed before the change (observed).

## Commands run and observed results
- Before the fix: the two new tests failed (feedback got "The page was already at another step..."; run detail got a target_absent record).
- `node ../../scripts/vitest-groups.mjs --groups=parallel` on summaries/tests, feedback.test.ts, model/tests/flow-adaptation.test.ts: Test Files 17 passed, Tests 161 passed.
- `pnpm check` in packages/fluxiq: tsc ran, no errors printed, exit 0 (build-cache said "not stamped, inputs changed while it ran", other workers are editing).
- `pnpm structure:check` at Core root: see the Validation line in the return.

## Not verified
Contracts package tests/typecheck: not touched.

## Open questions or contradictions found
Chat skip reason not added. Adding `already_in_state` to CLIENT_GATEWAY_ACTIVITY_SKIP_REASONS (packages/contracts/src/client-gateway.ts) is a one-line change, but two exhaustive `Record<ActivityStepSkip["reason"], ...>` readers in fluxiq/src/ui (activity-action/skipped.ts, activity-status/step-skip.ts) must then add the reason, plus the emitter in already-done.ts and its tests, and the extension may map the reasons: more than 3 files, so left. The chat keeps `already_done` with "Already so" wording.
