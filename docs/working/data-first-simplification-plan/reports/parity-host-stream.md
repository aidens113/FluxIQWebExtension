# Parity report: host-stream events (t986 follow-up)

## Outcome
Done.

## What changed and why
- `comparison/parity-report.ts`: an event is `outside` when it is `kind === "control"` or an `artifact` the tap did not record (`clientGatewayTraceEventSessionBound` false, imported via the `session-references` barrel). `artifacts()` now leaves out manifest artifacts whose id is carried only by such host events (an id also carried by a session-bound artifact event stays compared), so a host artifact the replay never takes is no divergence. Based on recorded event fields, not any receipt id.
- New `comparison/tests/host-stream-parity.test.ts`: (1) a sessionless control-stream artifact listed in the manifest gets an `outside` entry, no divergences, verdict `matched`; (2) a client upload on the tap's `artifact` stream whose bytes the replay cannot take is not `outside` and the verdict is `diverged`.
- `tests/replay-host-stream.test.ts`: now asserts the host artifact's entry is `outside` and that divergences equal the plain replay's (was excluding its sequence).

## Commands run and observed results
- vitest (one worker) `src/client-gateway/trace-replay` + `trace-matcher` -> 15 files, 68 tests passed (first run had my new test 2 failing, fixed by omitting the bytes; second run after a type fix: all pass).
- `pnpm --filter fluxiq check` -> passed (first run caught a TS error in my new test, fixed; rerun clean).
- `node scripts/structure-audit.mjs` -> passed (569 warnings, 903 baselined).

## Not verified
Only the replay and matcher folders were run, no wider suites; header comment of parity-report.ts not updated to mention host artifacts.

## Open questions or contradictions found
None. Note: an extra client upload present in both event list and store is replayed and matches, so "lacks" in test 2 is modelled by missing bytes.
