# t994 W3: parallel-group sweep failures (worker report)

## Outcome
Done. All 12 listed files pass (193 + 1 tests; the one failure in my first run was a new corpus case that exposed a real product gap, fixed at its cause, see file 7). One product fix, eleven test updates.

## Per file: cause, breaking commit, fix

1. `src/tests/anthropic-session-panel.test.ts` ("invalid message envelope"). Test wrong. `002650596` (t983, U1) made the panel command model default to Haiku; the fixture replies as Sonnet, so the envelope check refuses it. Test now passes `model: "claude-sonnet-5-5"` to both `createAutomationStudioAnthropicPanelCommandModel` calls, keeping the priced `0.000555` pins.
2. `runtime/llm/tests/run-call-record.test.ts`. Test wrong. `89e40b545` (t966): a failed call that reported no cost settles at zero and is recorded as reported zero, not kept at the hold. Expectation updated to `charged {totalTokens 0, tokens/cost "reported"}`, `reported.totalTokens 0`; the failed call's validation-invalid check stays. The now-meaningless "reserved at measured size" assertion was dropped with its comment.
3. `node-tools/tests/dry-run-gate.test.ts` (two cases). Test wrong. `cf5160993`/`284eb77ba` added `effectApplied` and `consequences` to replay observations. Expected observations now carry them (consequences `["create_new"]` for the declaring step).
4. `node-tools/tests/replay-draft.test.ts`. Same cause; the verified step is `effectApplied: false`, which the new expectation pins.
5. `node-tools/result/tests/answer.test.ts`. Wording pin superseded by t984: the description now says criteria apply "without a processing model call, page change or step". Pin updated to that sentence (same meaning: touches no page, needs no step); the "Rows a later step acts on are still narrowed" pin is unchanged.
6. `authoring/tests/record-output-part-defaults.test.ts`. Test wrong. t970 (`46b38f66b`, documented in `record-defaults/process-defaults.ts`) declares `process.columns` even where a `where` tests a hidden field; the schema keeps the tested field. Test now expects `columns ["amount"]` and schema fields `["amount","title"]` (matches the sibling sort test).
7. `candidate/tests/refusal-locator-corpus.test.ts` plus product `bootstrap/authoring/accept.ts`. `record_output.process_declaration_framework_owned` (t984/P2, accept.ts) is reachable from a script but no corpus case met it. Added a corpus case. It then showed a real defect: the early script refusal (before assembly) carried no locator, so the refusal named no step or line (the t378 rule). Fixed at the cause: the early return now carries `automationStudioFlowScriptLocator({ script, subflows: [], unplaced: [], rules: [], fallback: undefined })`, which places `flow.line.N` from the script's own lines.
8. `plan/tests/loop-format.test.ts`. Wording pin superseded (t984/t989): the text now says "Neither result-processing path changes which rows a repeat visits; narrow action targets on the listing before acting." Pin updated to that sentence (same meaning).
9. `draft/amendment/tests/apply.test.ts`. Test wrong. `8c50dc21c` (t984) made a Flow input's name follow FluxNode's identifier (`^[A-Za-z_][A-Za-z0-9_]*$`), so a capital "Query" is valid. Malformed case now uses `"1query"`.
10. `answer-first/attempt/tests/remember-acts.test.ts`. Test wrong. `e2b1f2635`/t970 made `automationStudioAnswerFirstRemember` write the held processing into the steps first, reading `run.result.processingDeclaration()`. The fake runs had no `result`; both now carry `{ processingDeclaration: () => undefined }` (nothing held, steps unchanged).
11. `answer-first/loop-signal/tests/completion-refused-again.test.ts`. Test pins the removed ladder (U1; `002650596` made `automationStudioLlmModelLadderClimb` a no-op). The climbing test is replaced by one asserting the refusal never changes the served model (level stays 0, no escalations) while still steering then stopping the round. The steer/stop tests are unchanged.
12. `answer-first/result-processing/tests/inputs.test.ts`. Test wrong. `e2b1f2635` writes an automatic declaration only into a record output the step already has; the shared fixture's read step has none. The test now gives each fixture step `recordOutput: {}` before saving.

## Commands run and observed results
- Targeted run (all 12 files, `heavy-slot ... vitest-groups --groups=parallel ... --maxWorkers=1`): `Test Files 1 failed | 11 passed (12); Tests 1 failed | 193 passed` (the failure was the new corpus case before the accept.ts fix).
- `node scripts/structure-audit.mjs` (Core root, after the accept.ts change): `structure-audit: passed (569 warning(s), 903 baselined).`
- After the accept.ts fix: `vitest-groups --groups=parallel` on the corpus test, `authoring/tests/bindings` and `candidate/tests` -> `Test Files 42 passed (42)`. The 11 other listed files passed in the first run.
- A wider run of whole `authoring/tests`, `llm/tests`, `node-tools`, `harness` directories was started and stopped (too slow behind the shared slot); not completed.

## Not verified
- Only the named files and directories beside edited source were run; no whole suite.

## Open questions / for other workers
- Dead call, W1's path: `answer-first/loop-signal/completion-refused-again.ts` still calls `automationStudioLlmModelLadderClimb` (a no-op since U1) and its header describes a model climb. Should be removed with the header text (proposed: delete the import and the call at line 55, drop the "climbs one model rung" row from the header).
- `result-feed/tests/automatic.test.ts` ("holds an explicit evidenced amendment", lane t993/W1) fails for the same cause as item 12: `automaticFeed`'s read step has no `recordOutput`, so the declaration is never written. Fix belongs in `result-feed/tests/automatic-support.ts` (give the read step `parameters.recordOutput: {}`), or the test; not touched.
