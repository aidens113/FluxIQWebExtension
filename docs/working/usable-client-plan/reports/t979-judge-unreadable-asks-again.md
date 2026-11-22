# t979: a judge check whose reply could not be read is asked again until it is read

Historical interrupted-work report (2026-11-20). Superseded by
[the 2026-11-22 continuation report](../../data-first-simplification-plan/reports/t979-judge.md):
judge escalation below was removed, aggregate retry accounting was fixed, and
the formerly failing framework tests passed. Lead integration is recorded in the paired plan.

## Outcome
Done in Core (`fxwork/t979/!FluxIQ`), not committed. One framework test outside my paths now times out (Open questions, item 1).

## What changed and why
- **The live path was the Flow-less judge, not `verify.ts`.** F25's 0047 and 0053 were `continuation: used` Answer First judges (`flow-less/judge.ts`). That judge never asked again after an unreadable reply: 0048 was `answer_first.not_judged`, and the decider had to decide again to get another judge. Both judges are fixed.
- New `result-verification/unreadable-asks/` (index, asks, note, reply-said, routing, turn). Unreadable means every error is in `UNREADABLE_REPLY_CODES` or `llm_output.*`, and the call was sent. A cut yes (t653) counts as unreadable too.
  1. Every ask after an unreadable reply carries `summary.unreadableReply`, last on every form of the summary. It reuses `CASE_SAID`/`CODE_SAID` through `automationStudioLlmUnreadableReplySaid`.
  2. A continuing judge goes standalone after its first unreadable reply. It stays on the decider's model (`judgeOnDeciderRung`) and sends no `continuesDecider`, so the adapter sends the judge's own native grammar. The existing test `native-judge-schema.test.ts` asserts the Flow-less schema is `jsonText: false`, and the e2e test checks that the re-ask has no `result_json`.
  3. Each 2 unreadable replies in a row climb one rung (`judgeRungsUp`). The climb lasts for the rest of the check, and a later 2 in a row climb again (to Opus). The attempt's ladder does not move.
  4. No count ends it. `verify.ts` no longer counts unreadable asks against `ASKS_PER_CHECK`, and the Flow-less judge loops inside its existing deadline. A readable reply goes through the same reading and agreement code as before. `agreement/` and the `build-test/judge.ts` table are untouched.
- `role-routing/provider.ts`: `laddered` honours `judgeOnDeciderRung` and `judgeRungsUp`. Nothing climbs without a ladder.
- `deadline.ts`: the judge now gets a signal that aborts at the deadline or on cancel. `run-outcome.ts` and `build-test/judge.ts` pass it to `verify`. Without this, an abandoned check would go on asking, and paying, after its deadline.
- `turn.ts`: a `setImmediate` turn between unreadable asks. A provider that answers in promise jobs alone (scripted, in-process) would otherwise starve the deadline timer forever.
- Flow-less step-log notes say when a check goes standalone or climbs (Core's words only, never the reply's). Verify interventions now carry `verificationAfterUnreadable` and `verificationRungsUp`.
- Temporary faults (timeout, 5xx) keep their 2-ask rule. Nothing arrived to name, the provider retry policy already retries inside the call, and nothing says a stronger model helps.
- Tests changed to match the new behaviour: `verify.test.ts`, `truncated-reply.test.ts`, `flow-less/tests/judge.test.ts`, `reply-required.test.ts` and `left-out-naming-the-item.test.ts` (a no with no defect is unreadable now). In `run-outcome.test.ts`, the pending dispatch is now aborted at the deadline: calls 2, pending 0, charged $0.
- Added tests: `unreadable-asks/tests/asks.test.ts`, `role-routing/tests/judge-climb.test.ts`, `tests/judge-reply/tests/unreadable-reply.test.ts` and `flow-less/tests/judge-unreadable.test.ts`. Together they cover the note, Haiku to Sonnet after 2, a readable reply after re-asks giving an outcome `toEqual` a plain run's, a purse refusal giving `not_judged` with its existing why, a refused key never asked again, the deadline ending it, and a real Anthropic e2e (continuation, then standalone native on Haiku, then Sonnet).

## Commands run and observed results (all through `heavy-slot.mjs run`)
- Targeted tsc on 20 files (`tsconfig.t979.json`): run 1 `exit 0`; run 2 after the test move `exit 0`, no diagnostics.
- `vitest run src/runtime/result-verification src/runtime/models/providers/anthropic/tests src/runtime/llm/anthropic/tests src/runtime/llm/role-routing`: 250/253 files and 1934/1938 tests passed. The 4 failures were stale expectations (run-outcome, 2 in reply-required, left-out). I fixed them, and the rerun of those 3 files passed 59/59.
- Rerun of judge-reply, verify.test, flow-less/tests, unreadable-asks and role-routing: `Test Files 27 passed (27)`, `Tests 208 passed (208)`.
- `node scripts/structure-audit.mjs`: first run, 2 violations (`tests/` had 26 files; one import bypassed a barrel). After the move: `structure-audit: passed (562 warning(s), 909 baselined)`.
- `framework/.../flow-bootstrap-commands/tests/build-judge.test.ts`: `× says a judge reply it could not read in words ... Test timed out in 15000ms`.

## Not verified
- No live or paid run.
- The 253-file folder run was not repeated in full after the fixes; only the failing files and the touched folders were rerun.
- Framework and answer-first suites were not swept, apart from `build-judge.test.ts`.

## Open questions or contradictions found
1. `build-judge.test.ts` (framework, outside my paths) has a judge that always replies `observed: 42` (`llm_output.invalid_diagnosis_text`). It now asks until the 120 s deadline, and the test times out. It needs a readable second reply or a short `deadlineMs`. Other framework mocks that keep returning unreadable judge replies will fail the same way, and none have been swept.
2. On a standalone re-ask the adapter writes `continuation.reason: "no_decision_in_this_attempt"`, which is misleading. The reason is set in `llm/anthropic/provider.ts`, outside my paths. Suggested: a reason keyed on `metadata.judgeOnDeciderRung`.
3. The runtime result check resolves one judge provider with no ladder, so the climb does nothing there (the note and the unbounded asks still apply). The build-test judge climbs only when it is handed the routed provider.
4. The existing deadlines are the only ending, and they end the loop as before: Flow-less "ran out of time"; build-test "did not answer inside its deadline"; runtime `core.result.verification_did_not_finish`. Deadline sizing is unchanged. Outside a build purse, the build-test judge's per-call `maxCostUsd/2` does not bound repeated asks; only the deadline does.
5. Some working copies of edited files now have LF line endings (the index is LF, so diffs are unaffected).

Outcome: Done
Changed: packages/fluxiq/src/runtime/result-verification/{verify.ts,deadline.ts,run-outcome.ts,build-test/judge.ts,flow-less/judge.ts,contracts/run-result-summary.ts,unreadable-asks/*}, runtime/llm/role-routing/provider.ts, tests listed above
Validation: tsc exit 0; vitest 208/208 (27 files) after fixes; structure-audit passed
Not verified: live run; full framework suites; build-judge.test.ts fails (timeout)
Report: C:/Users/osrs_/FluxStuff/fxwork/t979/!FluxIQWebExtension/docs/working/usable-client-plan/reports/t979-judge-unreadable-asks-again.md
Notes: The F25 path was the Flow-less judge; both judges are fixed. A framework test needs an update (item 1). The deadline now also stops the in-flight call.
