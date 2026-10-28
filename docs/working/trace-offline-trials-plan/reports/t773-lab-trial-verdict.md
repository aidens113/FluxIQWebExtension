# t773 Lab trial verdict

## Outcome
Done (one inference flagged below).

## What changed and why
Core (`C:/Users/osrs_/FluxStuff/fxwork/t773/!FluxIQ`, `packages/fluxiq/src/programs/automation-studio/`):
- `runtime/service/candidate-trial/run.ts`: after a trial's session is written ended, it is rewritten once with `metadata.candidateTrial.verdict` (the gate's yes/no/unsure/not_judged/execution_failed) and, where the gate gave one, `verdictCode`. Applied on all three post-run exits (execution failed, result unreadable, judged). Additive; sessions without the field are unchanged.
- `runtime/service/session-listing/candidate-trial.ts` and `storage/file-store.ts`: the run summary's `candidateTrial` carries `verdict` and `verdictCode` (optional, bounded strings), so the Lab's existing `list-runtime-sessions` read gets them.
- Tests: `candidate-trial/tests/run.test.ts` (verdict on the last session write for yes and execution_failed), `session-listing/tests/listing.test.ts` (summary carries it; absent stays absent).

Downstream (`.../t773/!FluxIQWebExtension/packages/test-runner/src/flow-lane/creation/`):
- `candidate-outcome.ts`: `readCandidateTrials` reads `verdict`/`verdictCode` from each session summary; `createdFlowChatCandidateDraftOutcome` now takes the last trial's recorded verdict first (`chatDraftVerdict(said, trials)`, exported), then Core's per-verdict sentences, then recognises t753's fixed draft sentence as `draft` (not a verdict).
- `chat/tests/build-from-chat.test.ts`: new test for a told (fixed-sentence) project draft: no, unsure, yes read from the session record; not_tested; unknown only when neither record nor verdict sentence exists; a verdict sentence still works for an older session without the field.

## Commands run and observed results
- Core grouped runner (candidate-trial + session-listing): parallel group `Test Files 26 passed (26)`, `Tests 217 passed (217)`; real-sql group `Test Files 1 passed (1)`, `Tests 5 passed (5)`; "all groups passed".
- Core `pnpm check`: exit 0, "structure-audit: passed (443 warning(s), 1152 baselined)", fluxiq:check and web:check built.
- Core `pnpm docs:check`: "Deterministic framework reference is current." (no docs:reference change needed).
- Core libraries rebuilt (contracts, fluxiq, client-gateway-websocket) for the downstream build.
- test-runner `pnpm build`: completed; `node --test` on build-from-chat.test.js: 18 tests, 18 pass, 0 fail; lane-candidate, candidate-draft, build-proposal tests: 45 pass, 0 fail.
- `tsc --noEmit` for test-runner and test-contracts: exit 0 with no output.
- Downstream `node scripts/structure-audit.mjs`: "passed (227 warning(s), 616 baselined)". Core's audit ran inside `pnpm check`.

## Not verified
- No live or paid run; the real project-build path (supervisor whole trials through this trial runner) was not exercised end to end, only the unit paths.
- Re-judged trials (`rejudgeAutomationStudioCandidateTrial`) do not rewrite their original session, so a re-judged verdict is not on the session.
- Trials that never create a session (start failed, purse could not pay the judge) leave no record; the Lab falls back to the sentence for those.

## Open questions or contradictions found
- `not_tested` has no trial session to carry a field. The Lab reports `not_tested` when the told fixed sentence is present and the candidate has zero trial sessions. This is derived from data (no session), not from a verdict sentence, but a project draft whose only trial never opened a session would also read `not_tested` rather than its true not_judged. If that matters, Core should record the build's last verdict on the draft or conversation turn (a schema change I did not make).
- `docs` for `list-runtime-sessions` summary shape were not separately updated; the added fields are optional.
