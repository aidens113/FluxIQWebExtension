# t952: subflow trial A11 host-lease test (worker report)

## Outcome

Done. The test was stale, not the product. t911 (`842588df4`, merged by `e60e82631`) made a trial's
start read its host lease only from its bound lease authority (`ports.leaseBinding`), and it updated
the candidate-trial twin test but not this subflow test. The test now wires the binding the way
production does, keeps every original assertion, and gains a test for the `lease_unbound` refusal.
All four acceptance checks pass.

## What changed and why

**Breaking commit.** `842588df4` "WIP, taken over from Codex: t911 runtime lease isolation"
(merged to Core `dev` by `e60e82631` "Merge task t911: runtime lease isolation, taken over
from Codex", 2026-11-18). It changed `automationStudioCandidateTrialStart`
(`framework/automation-service/service/candidate-trial/run.ts`), the shared start that a
subflow partial trial also calls through `subflow-trial/start.ts`:

- before: `const lease = AutomationStudioHostLeaseScope.current();` (any ambient lease scope)
- after: the lease comes only from the trial's own bound authority, `ports.leaseBinding`
  (`AutomationStudioHostLeaseAuthority.for(owner).forDomain(domainId)`). Under an ambient lease
  scope with no `leaseBinding`, the start fails with `candidate.trial_start_lease_unbound` and
  the hook is not called. A scope bound to a different binding is invisible to the trial
  (`binding.current()` is undefined).

That commit updated the candidate-trial twin of this test (`candidate-trial/tests/start-lease.test.ts`
now sets `fixture.ports.leaseBinding` and builds its scope with `{ binding }`). It did not update
`subflow-trial/tests/run.test.ts`, added earlier by `6aeb7969f` "a start hook gets its lease". That
test still ran the trial under an unbound scope with no `leaseBinding` port, so the start returned
`lease_unbound`, the hook never ran, and `seen[0]` was undefined.

**Which side is wrong: the test.** The product still hands the start hook the brief's lease,
through the bound authority:

- `trial-ports/environment.ts` puts `leaseBinding: collaborators.hostLeaseAuthority.forDomain(domainId)`
  on the build's trial environment.
- `project-build/subflow-trials.ts` spreads `...environment` into the subflow trial ports, so
  `leaseBinding` arrives there. Its session admission also reads `environment.leaseBinding?.current()`.
- `subflow-trial/start.ts` passes every port except `judge` and `execute` to the shared start, so
  `leaseBinding` reaches `automationStudioCandidateTrialStart`, which hands
  `structuredClone(leaseBinding.current())` to the hook.

t911's intent ("runtime lease isolation", and the new candidate test "an ambient foreign domain or
owner cannot reset B while B's lease is held elsewhere") is that an ambient lease from another Core
instance or domain must never authorise a reset. Reading the ambient scope, as the old test relied on,
is exactly what t911 removed on purpose. Restoring it in the product would reopen that hole.

**Test change** (`packages/fluxiq/src/framework/automation-service/service/subflow-trial/tests/run.test.ts`, the only file changed):

1. The A11 test keeps every original assertion at the same strength: the hook's `lease` equals the
   lease the brief's scope issued, the record's start is `reset` with that lease's `resourceKey`, and
   a trial outside any scope gets no `lease` key and resets `everything`. It now wires the trial the
   way production does: `f.ports.leaseBinding = binding`, with the brief's scope constructed with
   `{ binding }`.
2. New test: under a lease scope with no bound authority, a subflow trial runs no start hook
   (`seen` empty), its record's start is `failed` with `candidate.trial_start_lease_unbound`, its
   execution is `not_run`, and nothing is pressed. Before this, no test anywhere asserted the
   `lease_unbound` refusal.

No product file changed, and nothing changed on the extension side.

## Commands run and observed results

All in the Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t952/!FluxIQ` (branch
`task/t952-subflow-a11-host-lease`, HEAD `e8e6886d9`), each through
`node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- ...`.

- Setup: `pnpm install --frozen-lockfile` -> `Done in 2.5s`.
  `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build` -> contracts and sdk
  `reuse`, fluxiq `build` (178561 ms), exit 0.
- Reproduction: the dev copy of `run.test.ts` (`git show HEAD:...`), written to a temporary
  `tests/t952-repro-dev.test.ts` and deleted afterwards:
  `npx vitest run .../subflow-trial/tests/t952-repro-dev.test.ts` -> `× ... hands the start hook the
  brief's host lease under one, and no lease outside any (A11)`,
  `TypeError: Cannot read properties of undefined (reading 'lease')`,
  `Tests 1 failed | 10 passed (11)`, which is the reported failure.
- Acceptance 1: `cd packages/fluxiq && npx vitest run src/framework/automation-service/service/subflow-trial`
  -> `Test Files 14 passed (14)`, `Tests 54 passed (54)`; `run.test.ts (12 tests)`.
- Acceptance 2 (no product directory changed; the related candidate-trial test the t911 change
  mirrors): `npx vitest run src/framework/automation-service/service/candidate-trial/tests/start-lease.test.ts`
  -> `Tests 9 passed (9)`.
- Acceptance 3: `pnpm --filter fluxiq check` -> exit 0 (`fluxiq:check` tsc `--noEmit`, 110906 ms).
- Acceptance 4: `node scripts/structure-audit.mjs` -> `structure-audit: passed (555 warning(s), 911 baselined).`, exit 0.
- `git status --short` -> only `M packages/fluxiq/src/framework/automation-service/service/subflow-trial/tests/run.test.ts`
  (+22/-4). The test file is 177 lines.

## Not verified

- I did not run the whole fluxiq vitest suite (full suites are twice-daily sweeps, by project rule).
- I did not bisect by running tests at each commit. The breaking commit is identified by reading the
  diffs (`git log -S leaseBinding`, `git log -S trial_start_lease_unbound`, history of the test and of
  `candidate-trial/run.ts`) and by tracing the code path. The reproduction confirms the failure mode
  (hook never called) matches the `lease_unbound` early return.
- I did not check live wiring end to end. That production subflow trials carry `leaseBinding` is read
  from `trial-ports/environment.ts` and `project-build/subflow-trials.ts`, not exercised in a run.

## Open questions or contradictions found

- `candidate.trial_start_lease_unbound` had no test anywhere in Core before this change (grep of
  `packages/fluxiq/src`). The new subflow test covers it for subflow trials, but the candidate-trial
  path still has no direct test of it.
