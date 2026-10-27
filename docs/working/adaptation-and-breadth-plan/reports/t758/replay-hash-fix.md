# t758 replay-hash-fix report

## Outcome
Partial. Both defects are fixed and tested, but the package typecheck fails on one line until a one-word edit in a path I may not touch: `readFlowState` in `packages/test-runner/src/flow-lane/repair/apply-repair.ts` (line 279) must become `export async function readFlowState`. `flow-lane/repair/index.ts` already does `export *`, so no other change is needed.

## What changed and why
- `saved-flow-replay/replay-saved-flow.ts`: the receipt gains `flowGraphHash {before, after}`, the repair lane's `stepsHash` (nodes and edges of the parent and every Subflow graph). It is read through the new seam `readFlowGraphHash`, which wraps the lane's own `readFlowState(...).stepsHash` (imported, not copied). The verdict fails with "the saved Flow's executable graph (nodes, edges or Subflows) changed during the replay, so a repair or learned handler altered what the Flow runs". `flowContentHash` is kept.
- `run-lifecycle/pair-extension.ts`: `safeTransport` keeps category `gateway.connection` and appends a bounded cause to the message and to `details.cause {name, code, message}`. The name and code must be short identifiers. The message has URL credentials, bearer/basic values, `key=value` secrets (token, secret, password, cookie, key) and 32+ character opaque runs redacted. Whitespace is collapsed and the message is cut to 160 characters. File paths are kept, since they name a MAX_PATH failure.
- Tests: new `replay-saved-flow.test.ts` cases (graph held passes; graph changed under an unchanged parent hash fails, with the reason). `pair-extension.test.ts` now asserts the cause is carried and the secrets are absent. Its two old tests that required a fixed, cause-free message were updated. `replay-tracing.test.ts` got the new seam.
- `docs/architecture/testing-facility.md`: receipt description now mentions `flowGraphHash`.

## Commands run and observed results
- `tsc -p tsconfig.json --noEmit`: one error only, `replay-saved-flow.ts(23,148): '"../flow-lane/index.js"' has no exported member named 'readFlowState'`. Nothing failed inside Core.
- To run the tests without touching flow-lane, I emitted to a scratch dir, exported `readFlowState` in the emitted JS only, then ran `node --test` on `saved-flow-replay/tests/*.test.js` and `run-lifecycle/tests/*.test.js`: tests 81, pass 81, fail 0. The scratch dir is deleted.
- `node scripts/structure-audit.mjs`: "structure-audit: passed (222 warning(s), 616 baselined)".

## Not verified
- The real `readFlowState` against a live Core (tests use the seam).
- True fail-first ordering: I wrote the tests alongside the fix and did not run them red first. They do assert the failing behavior (graph change gives a failed verdict plus reason).
- The sanitizer cannot recognise arbitrary page data; it only bounds length and redacts credential shapes.

## Open questions
- The `export` on `readFlowState` is owed to the supervisor (flow-lane is read-only for me). A cleaner alternative is a barrel-level helper in flow-lane; either fixes the typecheck.
