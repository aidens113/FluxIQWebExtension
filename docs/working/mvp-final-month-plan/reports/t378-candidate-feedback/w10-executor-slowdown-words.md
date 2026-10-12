# w10: executor slow-down words (t378)

## Brief

### Brief: t378-w10-executor-slowdown-words (worker)
- Repository: FluxIQ Core. Tree T = `C:/Users/osrs_/FluxStuff/fxwork/t378` (on `task/t378-candidate-feedback`). R = `T/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`.
- Context: W4 gave the recovery wording (`R/activity/wording/recovery-choice.ts`) new `run` options `siteWaitMs`, `slowedDown` and `presses`, so a retry after a site's slow-down reads "The site asked FluxIQ to slow down, so it is waiting 6 seconds before pressing again". Nothing passes them yet. W7 changed `R/executor/graph-run.ts` (retry wait credited with elapsed time, pacing). Reports: `w4-runtime-wording.md` (items 6, "Not verified") and `w7-runtime-pace.md`.
- Task:
  1. At `R/executor/graph-run.ts` (~:622), pass `siteWaitMs` (the wait actually taken, after W7's credit; or the failure's hint), `slowedDown` (the failure carries a site wait hint; domain-agnostic: read the hint and category, never a web code), and `presses` (the node is a press). Do not edit `recovery-choice.ts`.
  2. `R/executor/tests/failed-step-reason.test.ts:90` still expects "the page was busy" for a rate-limited press; update to the new words (check `ui/activity-action/failure-reason.ts`).
  3. A test beside graph-run: a hinted refusal followed by a successful retry emits the slow-down recovery words with the wait in seconds.
- Owns: `R/executor/graph-run.ts`, `R/executor/tests/**`.
- Must not touch: `R/executor/node-execution/**`, `R/activity/**`, every other file, any other tree, lab slots or processes.
- Definition of done: `npx vitest run .../runtime/executor/tests .../runtime/activity` from `T/!FluxIQ` passes; `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` clean for your files. Never commit; no `pnpm build`; no Lab run or provider call.
- Report to: this file.

## Outcome

Done.

## What changed and why

- `R/executor/graph-run.ts`:
  - The retry wait (hint credited with time since the refusal, then bounded by `automationStudioBoundedRetryWaitMs`) was computed after the recovery thought was emitted, so the words could not know it. It is now computed right after the ladder returns, only when `ladder.kind === "retry"`, before the thought is worded. The retry branch reuses that `wait`/`hint` unchanged (same defence-ledger record, `pendingRetry`, and `automationStudioRunWait`). The branch condition is `ladder.kind === "retry" && wait`; `wait` is always set for a retry. `recordDefendedFault` still receives the attempt with `recoveryDecision` on it, as before.
  - When the failure carries a site wait hint (`fault.hintedWaitMs`, which `assess.ts` reads from the record's `retryAfterMs`, a `retry-after` header, or outputs), the choice gets `slowedDown: true`, `siteWaitMs: wait.waitMs` (the wait actually taken), and `presses`. No domain code is read. No failure category means "rate limited" in Core's class list (`contracts/src/failure/adaptive-class.ts`), so the hint alone decides.
  - New private helper `automationStudioNodePresses(node)`: a domain action (`builtin.policy.action` or a non-`builtin.` node) that does not declare `effect: "observe"` in `metadata` or `parameterValues`. Core's other built-ins press nothing.
- `R/executor/tests/failed-step-reason.test.ts`: the rate-limited press's `why` is now "the site asked FluxIQ to slow down", which matches `ui/activity-action/failure-reason.ts:48`.
- New `R/executor/tests/slowdown-recovery-words.test.ts`, which checks two cases:
  - A press refused with `retryAfterMs: 6000` and then retried successfully waits 6000 ms. It emits "Waiting: the site asked to slow down" / "The site asked FluxIQ to slow down, so it is waiting 6 seconds before pressing again."
  - A refusal with no wait keeps the ordinary retry words.

## Commands run and observed results

- `npx vitest run .../executor/tests/slowdown-recovery-words.test.ts .../executor/tests/failed-step-reason.test.ts` -> 2 files, 9 tests passed.
- `npx vitest run packages/fluxiq/src/programs/automation-studio/runtime/executor/tests packages/fluxiq/src/programs/automation-studio/runtime/activity` -> Test Files 56 passed (56), Tests 607 passed (607).
- `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` -> no output (clean, whole package).

## Not verified

- Live browser or Lab behaviour: no run was made.
- The structure audit was not run.
- I did not confirm that the web domain marks its read/wait outputs `effect: "observe"`. If it does not, a hinted retry of a read would say "pressing again".
- A hinted wait whose credit uses it all up gives `siteWaitMs: 0`. `recovery-choice.ts` then says "waiting a moment" (covered by its logic, not by a test here).

## Open questions or contradictions found

- The brief says to read "the hint and category". Core has no rate-limit category, so only the hint is used.
