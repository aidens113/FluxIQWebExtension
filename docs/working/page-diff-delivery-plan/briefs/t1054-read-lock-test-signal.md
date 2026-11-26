# Brief t1054: the build-cache read-lock test waits on a signal, not on a fixed 400 ms

**Goal.** Core's `scripts/build-cache/tests/step-read-lock.test.mjs:182`, "a build of a step waits for its read lock,
then decides again", fails under machine load. It failed twice in a row today inside `pnpm task finish` with
`'no stamp'` instead of `waited N.Ns for pid P's read lock on this step, then ...`. It passes alone, 3 of 3. That
blocks every Core merge whenever the machine is busy.
- **Why it fails.** The test takes a read lock, starts a build in a child process, then waits a fixed
  `delay(400)` and releases the lock, assuming the child has reached the lock by then. Under load the child starts
  later, finds the lock already released, never waits, and reports `no stamp`. The test fails on scheduling, not
  behaviour.

**Do.**
- Release the reader only once the child is observably waiting on the lock. Use a signal the build-cache already
  gives: a line the build prints when it starts waiting, a waiter record beside the lock, or a hook the step-run
  code already exposes. Read `scripts/build-cache/` to find it.
- If no observable signal exists, add the smallest honest one in the build-cache code: a line it prints when it
  begins to wait for a read lock. A waiting build saying so is useful to a person too. The default behaviour must
  not change.
- Wait on that signal with no fixed sleep. Bound the whole test only by the test runner's own timeout.
- Keep every assertion: nothing built under the reader, the build runs after release, the reason names the wait,
  and the run is recorded.
- Never raise or add a delay (user rule: never cap the symptom).
- Check the other tests in that file, and in `scripts/build-cache/tests/`, for the same fixed-delay pattern around a
  child process. List any you find in the report, and fix those that share this exact pattern.

**Proof.**
- The test passes 20 times in a row while another heavy test run is going. If none is going, run 4 copies at once.
- With the wait-for-signal removed (a temporary local edit you revert), it fails under that load as before.

**Owned paths (Core).** `scripts/build-cache/tests/step-read-lock.test.mjs`, other `scripts/build-cache/tests/*`
with the same pattern, and the build-cache source that would print the signal, only if needed.
**Must not touch.** `packages/fluxiq/**` and any other task's files. No git, no paid runs, no `node -e`.
Downstream mirrors build-cache scripts only where `scripts/check/core-mirror.mjs` says so. If your change touches a
mirrored file, say which; the lead mirrors it.

**Checks.**
- `node --test scripts/build-cache/tests/step-read-lock.test.mjs`, repeated as above.
- `node --test scripts/build-cache/tests/` with all passing.
- Core `pnpm check`, through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1054-check -- pnpm check`.

Work in Core `C:/Users/osrs_/FluxStuff/fxwork/t1054/!FluxIQ` (branch `task/t1054-read-lock-test-signal`).
**Report.** `C:/Users/osrs_/FluxStuff/fxwork/t1054/!FluxIQWebExtension/docs/working/page-diff-delivery-plan/reports/t1054.md`,
ending with the return contract.
