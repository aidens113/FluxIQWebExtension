# w1-unknown-tool

## Outcome
Done.

## What changed and why
All under `!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/llm/` (R/llm):
- `evidence-loop/nearest-tool-id.ts` (new, barrel-exported from `evidence-loop/index.ts`): `automationStudioLlmEvidenceNearestToolId(asked, offered)`, Levenshtein plus a shared-last-segment bonus; undefined when nothing is close. Generic.
- `evidence-loop/decision-refusal.ts`: new code constant `AUTOMATION_STUDIO_LLM_EVIDENCE_UNKNOWN_TOOL_REFUSED_CODE = "llm_evidence_loop.unknown_tool_refused"`.
- `unusable-decision.ts`: new `AutomationStudioLlmUnusableDecisionUnknownTool` type, an optional `unknownTool` on the feedback input, and an instruction naming the offered ids (max 40, each clipped to 80 chars) and the nearest; plus an `ISSUE_INSTRUCTIONS` entry for the new code.
- `evidence-loop.ts`: `refuseDecision` takes an optional `unknownTool`. A new block sits after the look-withdrawal block and BEFORE `counters.unusableInARow = 0`; when `input.unusableDecisions` is set and the id is not a known tool (and the call is not a rerun), it goes through `refuseDecision` -> `unusable()`, so it counts toward `noProgress.sameIssuesAgain` / the unusable-in-a-row guard like other refusals. A guard-reached ending returns `repeat_without_progress` (or throws the `stalled` error when `propagateDecisionErrors`).
- `llm_evidence_loop.unknown_tool` is kept as the closed ending for loops with no `unusableDecisions` (asking again impossible there). Greps showed callers/translations (flow_bootstrap/generation-failure codes and evidence-failure, project-agents/stop-reason, recovery/exploration-outcome, service/candidate-failure/stall-code) all remain valid, so I left them untouched. The existing tests that assert `unknown_tool` (evidence-loop.test.ts, inferred-tool-call.test.ts) use loops without `unusableDecisions`, so they still pass unchanged.
- Test: `tests/evidence-loop-unknown-tool.test.ts` (5 tests): (a) refused, feedback shows offered ids and nearest, corrected call runs, loop completes; (b) endless unknown ids end via the guard (not `unknown_tool`, 2 to 4 decisions); (c) known id unaffected; closed `unknown_tool` kept without `unusableDecisions`; nearest-id unit test.

Note: the offered list is what the decision was offered, so a look already answered is not listed (only `page.press` in test (a)).

## Commands run and observed results
- `npx vitest run` on unknown-tool, evidence-loop.test.ts, decision-kind/, evidence-loop-tool-failure.test.ts: 94 passed, 1 failed (my own wrong expectation of the offered list); fixed the test.
- `npx vitest run .../evidence-loop-unknown-tool.test.ts`: 1 file, 5 tests passed.
- `node scripts/build-cache/cli.mjs fluxiq:check` (Core root): completed in 67s with no diagnostics printed.
All under heavy-check.lock, released.

## Not verified
- The full `llm/tests` directory was not run (lock contention made the whole-directory run starve for over an hour); only the 4 relevant test targets above ran.
- Other suites asserting `unknown_tool` mappings (generation.test.ts, stop-reason, exploration-outcome) not re-run; their code was not changed.
- No live behaviour; scripted `decide` only.

## Open questions or contradictions found
- Callers that configure `unusableDecisions` and expected a hard `unknown_tool` ending (none found in tests) now get a repeat_without_progress ending after the guard instead; the stop-reason wording for `unknown_tool_refused` is not mapped because it never becomes a failure code.
