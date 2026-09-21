# Testing Lab Port Allocation Reliability
Status: Complete
Status detail: Explicit demo panel and gateway ports are now bind-preflighted before setup; the known excluded port fails in milliseconds instead of after a 108-second startup wait.
Created: 2026-09-20
Last updated: 2026-09-20
Owner: Senior supervisor agent
Scope: Make Testing Lab loopback-port selection reject ports that cannot actually be bound, without changing product runtime networking or the user's running panel.
Paired document: none
Related: [automated testing facility plan](./automated-testing-facility-plan.md), [repository layout](../architecture/repository-layout.md)

---

## Current State

A production panel/extension smoke exposed a 108.101-second startup delay on
gateway port `49873`, which lies in this Windows host's excluded range. Fifty
ordinary allocations all returned distinct bindable ports, proving the
allocator was healthy and the one-off explicit demo URL pin owned the defect.

`assertLoopbackPortBindable` now checks explicit demo panel and gateway ports
before path preparation, builds, identity setup, or process startup. The
known excluded port fails with labeled `EACCES`; normal ephemeral allocation
is unchanged. Live source and compiled-caller probes rejected `49873` in
13.316 ms and 4.009 ms respectively, and a bindable replacement passed in
2.591 ms. The supervisor independently reproduced the labeled rejection in
13.166 ms, rebuilt the package, and observed all 19 focused tests pass.

**Done:** live diagnosis, test-facility-only fix, live rerun, focused build and
tests, and supervisor review.

**Next:** merge task t031 to `dev`; no additional product work is implied.

**Blockers:** none.

---

## Worker Briefs

### Brief: w2-lab-port-allocation
- Repository: this repository, task `t031-lab-port-allocation`
- Task: reproduce the Windows excluded-port delay and make the smallest Testing Lab fix that rejects an unbindable requested port before a long topology wait; do not change product networking.
- Required reads: this document's `Current State`; `packages/test-runner/src/allocation.ts`; `packages/test-runner/src/tests/allocation.test.ts`; follow direct callers only as needed to identify where the explicit port entered.
- Owns (may edit): `packages/test-runner/src/allocation.ts`; `packages/test-runner/src/tests/allocation.test.ts`; a directly owning caller under `packages/test-runner/src/` only if diagnosis proves it necessary; `docs/working/lab-port-allocation-plan/reports/w2-lab-port-allocation.md`.
- Must not touch: product runtime or extension sources; Core; the user's panel/profile/store; provider-backed tests; any other working document; git history.
- Definition of done: live-first reproduction using known excluded port `49873`; corrected live path fails fast or selects a bindable distinct port without the prior startup delay; then focused allocator tests/build; exact timings and any host-specific limitation recorded.
- Report to: `docs/working/lab-port-allocation-plan/reports/w2-lab-port-allocation.md`

---

## Work Ledger

### 2026-09-20 — Live delay isolated
- Agent: supervisor
- Changed: created this task document and worker brief.
- Why: a Windows-excluded port added 108.101 seconds to an otherwise successful full UI smoke.
- Validation: task worktree setup and recursive production build completed successfully; live defect evidence is recorded in `mvp-week2-automation-loop-plan/reports/w2-integrated-dev-ui-smoke.md` on task t027.
- Outcome: Partial
- Follow-up: worker diagnosis and live rerun.

### 2026-09-20 — Explicit demo ports fail fast
- Agent: supervisor, with worker `w2-lab-port-allocation`
- Changed: loopback bind preflight, persistent demo Core entry point, focused allocation coverage, and worker report.
- Why: explicit demo endpoints bypassed ordinary bind-proven allocation and could consume the full topology-startup wait before reporting a stable host error.
- Validation: supervisor compiled probe against `49873` -> labeled `EACCES` in 13.166 ms; `pnpm --filter @fluxiq-web-extension/test-runner build` -> passed; focused Node tests -> 19/19 passed in 4188.372 ms; `git diff --check` -> passed.
- Outcome: Accepted
- Follow-up: merge task t031 to `dev`.

---

## Open Questions

None.
