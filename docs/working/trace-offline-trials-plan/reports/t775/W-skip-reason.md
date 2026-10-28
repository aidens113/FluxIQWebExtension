# t775-W report: chat skip reason already_in_state

## Outcome
Done.

## What changed and why
- Core packages/contracts/src/client-gateway.ts: CLIENT_GATEWAY_ACTIVITY_SKIP_REASONS gained `already_in_state` (doc line says no failure, not a lasting act).
- Core ui/activity-action/skipped.ts: words "Not pressed: it already showed the asked state".
- Core ui/activity-status/step-skip.ts: reason added to the exhaustive Record (subject kept as for already_done).
- Core executor/step-loop/already-done.ts: the t775 emitter now sends `already_in_state` (was `already_done`); doc comment updated. Chat row words stay "Already so for <row>" / "Already so: <step>".
- Extension apps/extension/src/panel/chat/stream/step/messages.ts: `already_in_state` added to SKIPPED_AFTER_ANNOUNCING so the announced step's card carries the words and the skip row is no second card.
- Tests (failing first, 3 Core failures observed): ui/activity-action/tests/skipped.test.ts, ui/activity-status/tests/step-skip.test.ts, executor/node-execution/tests/already-in-state.test.ts (emitted reason), runtime/activity/step/tests/skipped.test.ts (reason list, count now four); extension step/tests/skipped-step.test.ts (new case).

## Commands run and observed results
- Core, packages/fluxiq, vitest-groups --groups=parallel over src/ui, executor/node-execution/tests, executor/step-loop/tests, runtime/activity: Test Files 100 passed, Tests 976 passed. src/ui includes the t774 truthful guard (activity-action/tests/action-of.test.ts "reports a successful empty read truthfully"), green.
- contracts: `pnpm test` 19 files / 250 tests passed; `pnpm check` no errors.
- Core `pnpm check` (packages/fluxiq): no errors printed, exit 0 (build-cache: not stamped, inputs changed while it ran).
- Core `pnpm structure:check`: "structure-audit: passed (443 warning(s), 1152 baselined)".
- Core rebuilt so downstream sees the union: `pnpm build` in packages/contracts and packages/fluxiq (both finished; dist/ui/activity-action/skipped.js contains already_in_state).
- Extension: `EXTENSION_TEST_BUILD_LABEL=t775-w node scripts/test-extension.mjs src/panel/chat/stream/step/tests`: tests 99, pass 99, fail 0.
- apps/extension `npx tsc -p tsconfig.json --noEmit` and `-p tsconfig.test.json --noEmit`: no output, exit 0.
- Downstream `node scripts/structure-audit.mjs`: passed (229 warnings, 616 baselined).

## Not verified
No live browser check of the card. The extension tests were run only in step/tests. Other extension readers of skip reasons were not searched beyond messages.ts, already-done.ts and action-card.ts.

## Open questions or contradictions found
isAlreadyDoneStep (extension) still matches only `already_done`, as wanted: an already_in_state row is not treated as a completed-act skip. No foreign errors seen from the result-verification worker.
