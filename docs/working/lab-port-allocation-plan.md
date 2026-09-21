# Testing Lab Port Allocation Reliability
Status: Active
Status detail: Live panel smoke exposed a 108-second delay when a requested gateway port fell inside a Windows excluded range; diagnosis and the smallest fail-fast allocation fix are in progress.
Created: 2026-09-20
Last updated: 2026-09-20
Owner: Senior supervisor agent
Scope: Make Testing Lab loopback-port selection reject ports that cannot actually be bound, without changing product runtime networking or the user's running panel.
Paired document: none
Related: [automated testing facility plan](./automated-testing-facility-plan.md), [repository layout](../architecture/repository-layout.md)

---

## Current State

A production panel/extension smoke on pushed `dev` succeeded end to end, but
its first isolated topology attempt selected gateway port `49873`. On this
Windows host that port was inside an excluded range (`49776-49875`), so Core
failed with `EACCES` and the Lab waited through startup recovery before the
test was rerun. The non-product failure added 108.101 seconds to a run whose
successful checkpoint otherwise took 73.974 seconds.

The existing allocator lives in `packages/test-runner/src/allocation.ts` and
obtains ports by binding loopback servers. The open question is whether the
bad port came from its ordinary allocation path or from an explicitly pinned
port in the one-off live observer. Diagnose that before changing code. If the
allocator already proves an ephemeral port bindable, preserve it; make an
explicit requested port fail immediately (or safely fall back where the
contract permits) rather than waiting on topology startup.

Live proof comes first: reproduce with the known excluded port, then show the
corrected path selects or accepts a bindable, distinct replacement without a
long topology wait. Focused allocator checks follow only after that live
proof. Do not run the repository-wide suite during iteration.

**Done:** isolated task `t031-lab-port-allocation` created from pushed `dev`.

**Next:** diagnose the source of the pinned port; implement the smallest
test-facility-only correction if the repository owns the bad behavior; rerun
the live port path and report elapsed time.

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

---

## Open Questions

- Did ordinary allocation return the excluded port, or did a one-off observer pin it after allocation? Owner: `w2-lab-port-allocation`.
- If an explicit requested port is unavailable, does that caller require fail-fast semantics or safe fallback? Owner: senior supervisor after diagnosis.
