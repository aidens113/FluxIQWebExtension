# Part-run driving gate fix (Core, task t915 tree)

## Outcome
Done. `driving-gate.test.ts` > "a build another run stands in the way of gets an ordinary tool answer, and nothing happens" passes, along with the rest of the file. The code was wrong and the test was right.

## Cause
`runtime-session/admission.ts` returns early, before it reads any session, when the caller is inside a current strict host lease that names a session. That lease-admits shortcut was added for managed hosts, where independent leased resources in one project may run together. `project-parts/run/driving-gate.ts` reuses `admitAutomationStudioRuntimeSession` for a different question: is any other run active right now? It always asks from inside a lease: the build's own lease for a build's call, or the part's own `part-run` lease for a person on a host with resources. So the shortcut always fired, the session read never ran, and a plain Flow run (which holds no lease, see `service.ts:2466`) was invisible to the gate. The part ran and pressed the page.

The bug also hit a person's part run on any host with `hostResources`, which is production's web domain. The test file had no case for that path.

## Introducing commit
`fded721c0` (2026-11-12, t907, "Bind managed browser executions to scoped hosts and drain owned work on shutdown"), which added the shortcut to admission.ts. It is on Core `dev` before `04e7b1650`, so t914 did not cause this. Nothing in the gate, part-run, runtime-session or project-agents paths changes between `04e7b1650` and `592a188a4` (`git diff --stat` printed nothing). The test (last changed `dbbeb9799`, 2026-11-05) has failed since `fded721c0`.

## Contract check
The test's contract has not been replaced. t907's own doc (`docs/architecture/managed-hosts.md`, "Selection and lifecycle") says: "Runs without such a current lease retain the project admission gate." A plain Flow run is such a run.

## Fix
- `service/runtime-session/admission.ts`: new optional port `ownLeaseAdmits` (default true, so managed-host behaviour is unchanged). When it is false, the lease shortcut is skipped and the project's sessions are read.
- `service/project-parts/run/driving-gate.ts`: the gate passes `ownLeaseAdmits: false`; the header explains why.
- Tests: `project-parts/run/tests/driving-gate.test.ts` gains "refuses a person on a host with resources while a plain Flow run is running". `runtime-session/tests/admission.test.ts` gains a case showing that `ownLeaseAdmits: false` reads sessions under a strict lease.
- No assertion was weakened, and no wait or cap was added.

## Commands run and observed results
- Before the fix, the driving-gate file: 1 failed | 15 passed. The build call returned `status: succeeded`, `effectApplied: true`.
- After the fix, the driving-gate and admission test files: 2 files passed, 29 tests passed.
- With the flag temporarily flipped back to true and filtered to the two cases: 2 failed. This proves both tests catch the bug. The flag was then restored to false.
- `vitest run project-parts/run/tests runtime-session/tests`: 28 files passed, 251 tests passed.
- `pnpm --filter fluxiq check`: exit 0.
- `node scripts/structure-audit.mjs`: passed (550 warnings, 914 baselined). None of the warnings name the changed files. The audit also reported "2 baseline entries can be lowered"; those are not from these changes.

## Not verified
- Core's full vitest run and `service-wiring.test.ts`. That test calls admission without the new port, so its default path is unchanged.
- The t914 tree was not edited or run.
- No live browser run.

## Open questions
- `docs/architecture/managed-hosts.md` could add one line saying that the part-run driving gate opts out of the lease shortcut. Docs were outside the owned paths, so this was not done.
