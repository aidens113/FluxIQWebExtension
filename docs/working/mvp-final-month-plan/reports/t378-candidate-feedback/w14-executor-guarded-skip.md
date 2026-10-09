# W14: the executor skips a guarded group's absent optional step

## Brief

### Brief: t378-w14-executor-guarded-skip (worker-high)
- Repository: FluxIQ Core. Tree T = `C:/Users/osrs_/FluxStuff/fxwork/t378` (on `task/t378-candidate-feedback`). R = `T/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`.
- Context: W8 added guarded groups to the script: an `optional: yes` step (e.g. close a site's slow-down notice if it shows), then steps with `only after: <its label>` (e.g. a `builtin.timing.wait`) that run only when it was done; optional success -> those steps -> join (Merge); failed -> join. It works inside repeat spans. Report: `T/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/t378-candidate-feedback/w8-loop-guard-and-pace.md` (read "the gap"). The runtime counts a step as optional only when its failed and success edges both enter the same Merge (`R/executor/step-skip/optional-step.ts`), so an absent notice in the guarded shape is retried and recovered on every pass and a long loop fails. User rules: a step whose target is absent and that the Flow marks optional is skipped without spending retry or recovery budget; every other node keeps its 1 + 3 retries.
- Task:
  1. `R/executor/step-skip/optional-step.ts` (and its callers if needed): also accept a step whose failed edge enters a Merge that its success path reaches through steps that do not branch (bounded walk); the failed edge stays the way on. Keep the existing shape and `metadata.sometimesPresent` behaviour. Fail-first tests beside it, including a guarded group inside a for-each over several rows where the notice shows on one pass only.
  2. Flip the two `it.fails` tripwires in `R/flow-bootstrap/authoring/tests/guarded-loop.test.ts` to `it` once they pass.
  3. Structure audit violations in the executor (from `T/!FluxIQ`, `node scripts/structure-audit.mjs`): `as-never` at `R/executor/tests/slowdown-recovery-words.test.ts:47` (typed stub or `satisfies`); `R/executor/tests/` holds 26 files over the 25-file limit (move a test to the `tests/` of the directory that owns its subject, e.g. pacing tests to `R/executor/pacing/tests/`, or group by feature); `R/executor/graph-run.ts` is 814 lines over 800 (W7 and W10 added the timed pause, pacing and slow-down wording: extract a cohesive piece into a focused module under `R/executor/pacing/` or `R/executor/defensive/`, not a catch-all).
- Owns: `R/executor/**` except `R/executor/node-execution/**`, and `R/flow-bootstrap/authoring/tests/guarded-loop.test.ts`.
- Must not touch: `R/executor/node-execution/**` and Core storage files (another task owns them; if the fix needs them, stop and report), every other file, any other tree, lab slots or processes. Another worker edits other Core files now; an error only in a file you do not own is theirs: record it, do not fix it.
- Definition of done: `npx vitest run packages/fluxiq/src/programs/automation-studio/runtime/executor packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/authoring/tests/guarded-loop.test.ts packages/fluxiq/src/programs/automation-studio/runtime/tests/executor.test.ts` from `T/!FluxIQ` passes; `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` clean for your files; the structure audit shows no violation in your files. Never commit; no `pnpm build`; no Lab run or provider call. Core rules: one exported thing per file, a barrel per directory, tests in `tests/` beside the subject.
- Report to: `T/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/t378-candidate-feedback/w14-executor-guarded-skip.md` (paste this brief at its top; protocol report format; return at most 12 lines).

## Outcome

**Done.** The runtime now treats a guarded group's optional step as optional. When the notice is absent, the run skips
it with one press and goes straight to the join, with no retry and no recovery. This holds on every pass of a loop.
Both tripwires are now plain `it` and pass. All three executor audit violations are gone. Every check in the
Definition of done passes.

Paths below are relative to R.

## What changed and why

### 1. The optional-step rule (`executor/step-skip/optional-step.ts`)

- `automationStudioOptionalStepWayOn` counts a step as optional when **both** of these hold:
  - its `failed` edge enters a `builtin.control.merge`;
  - its `success` path reaches that same Merge.
- The success path is walked by a new private helper, `successPathReaches`:
  - It starts at the success edge's target and follows each step's `success` way on (`chooseAutomationStudioEdge`).
  - It ends `true` when it arrives at the join.
  - It ends `false` at any step that branches. A step branches when it has a `failed` edge of its own, or has no
    `success` way on. That covers a For Each's `body`/`done` and a condition's branches.
  - It also ends `false` at a missing node, at a step it has already visited, or after `MAX_GUARDED_STEPS = 32` steps.
  - A Merge in the middle of the path is passed through.
  - Data edges (for example `list.value -> each.items`) do not count as branching, because only route ports are
    followed.
- The old shape is the zero-step case: `success` enters the Merge directly, so the walk finds the join at once.
- The way on is still the `failed` edge, straight to the join and past the guarded steps.
- `metadata.sometimesPresent` behaves as before: the way on is the `failed` edge when the step has the shape, and the
  `success` edge otherwise. A sometimes-present step in the guarded shape now takes the `failed` edge, as the doc
  comment already said it would.
- No caller changed. `absent-step.ts`, `recovery-ladder.ts` (`automationStudioRecoveryPathEdge`) and
  `recovery-budget.ts` all read this one function. They therefore all pick up the guarded shape:
  - an absent notice is skipped as absent;
  - a notice that failed some other way (it timed out, or could not be pressed) keeps its retries, then goes on down
    `failed` without spending recovery or reroute budget.

### 2. Tests, written to fail first, in the new `executor/step-skip/tests/`

- **`optional-step.test.ts`** (11 cases) covers:
  - the lone shape;
  - one guarded step, and several guarded steps with a Merge among them;
  - shapes that are not optional:
    - a guarded step with its own `failed` route;
    - a For Each on the success path;
    - a failed Merge that the success path never reaches;
    - a failed edge into a step rather than a Merge;
    - a success path that cycles;
    - a success path longer than the bound (40 steps);
  - `sometimesPresent`, with and without the shape;
  - a plain step.
- **`guarded-group-run.test.ts`** (2 cases) runs `runAutomationStudioGraph` on the assembled guarded loop:
  - The loop shape is list -> head Merge -> For Each -> confirm -> notice (optional) -> 6 s wait -> join -> head. It
    runs under Core's default recovery budget (2/2/2).
  - **3 rows, notice shown on pass 2 only:**
    - succeeded;
    - 3 confirms and 3 notice presses;
    - notice attempts are `skipped`, `success`, `skipped`, with no `recoveryDecision` and no `retry`;
    - one wait, of 6000 ms;
    - 3 joins.
  - **8 rows, notice shown on pass 5 only:** succeeded, 8 notice presses, no recovery decision anywhere, one wait.
- **Observed before the fix:** 5 of 14 failed.
  - The run tests pressed the notice **10 times for 3 rows and 29 times for 8 rows**: the retries on every pass.
  - The guarded-shape unit cases returned `undefined` (or `notice.success` for `sometimesPresent`).
- **After the fix:** 14 of 14 passed.

### 3. Tripwires (`flow-bootstrap/authoring/tests/guarded-loop.test.ts`)

- Both `it.fails` are now `it`, and their "KNOWN GAP" comments now describe the rule. Both pass.

### 4. Structure audit

- **`as-never` in `executor/tests/slowdown-recovery-words.test.ts:47`.** `slowedOnce` and `played` now take an
  `AutomationStudioFailureRecord` (from `@fluxiq/contracts/automation-studio`), so the cast is gone.
- **26 files in `executor/tests/`.** `absent-step.test.ts` and `optional-failed-route.test.ts` moved to
  `executor/step-skip/tests/`, because their subject is step-skip. `executor/tests/` now holds 24 files.
  - Their relative imports were fixed.
  - Moving `optional-failed-route.test.ts` exposed a **baselined** `as never`. The baseline is keyed by path, so at the
    new path it counted as a new violation. It is fixed: the `attempt` helper now takes an
    `AutomationStudioRecoveryCandidateKind`, which `../../index.ts` exports.
  - The pointer comment in `executor/tests/state-routing-run.test.ts` now names the new path.
- **`executor/graph-run.ts` at 814 lines.** It is now 791. The retry-wait plan that W7 and W10 added moved into a
  new module, `executor/defensive/planned-retry-wait.ts` (`automationStudioPlannedRetryWait`). The plan is:
  - the hint, with the time already passed credited (`credited-hint.ts`);
  - the bounded wait (`retry-wait.ts`);
  - the `siteAsked` words input;
  - the private `nodePresses` helper (formerly `automationStudioNodePresses` at the end of `graph-run.ts`).
- `graph-run.ts` calls the new module once and destructures `{ wait, hint, siteAsked }`. The behaviour is unchanged:
  every pacing and slow-down test passes. The module is exported from `defensive/index.ts`.

## Commands run and observed results

All commands ran from `T/!FluxIQ`.

| Command | Observed result |
| --- | --- |
| `npx vitest run …/runtime/executor/step-skip`, before the fix | `Tests 5 failed \| 9 passed (14)`: "expected 10 to be 3", "expected 29 to be 8", and "expected undefined to be 'notice.failed'" twice |
| The same command, after the fix | `Tests 14 passed (14)` |
| `npx vitest run packages/fluxiq/src/programs/automation-studio/runtime/executor packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/authoring/tests/guarded-loop.test.ts packages/fluxiq/src/programs/automation-studio/runtime/tests/executor.test.ts` (the Definition-of-done command) | `Test Files 45 passed (45)`, `Tests 511 passed (511)` |
| `npx vitest run …/flow-bootstrap/authoring …/flow-bootstrap/verification …/flow-bootstrap/script-statements` (the neighbours that read the optional rule) | `Test Files 25 passed \| 1 skipped (26)`, `Tests 324 passed \| 2 skipped (326)` |
| `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` | exit 0, no output (final run) |
| `node scripts/structure-audit.mjs`, before | 4 violations, 3 of them in the executor |
| `node scripts/structure-audit.mjs`, after | 2 violations, both in files I do not own (listed below) |

Two earlier `tsc` runs failed, and neither failure was in my files:

- One run printed syntax errors (TS1002/TS1005) in `flow-bootstrap/generation-failure/tests/refused-steps.test.ts`.
- One run printed an `EvidenceLoopProgress` accounting type error.

Both were another worker's files while they were being edited. The final run was clean.

## Not verified

- No live browser or Lab run was made, per the brief. The guarded loop was exercised only through
  `runAutomationStudioGraph`, with a stub dispatcher and a hand-built graph of the assembled shape. The
  `guarded-loop.test.ts` tripwires check the graph the real assembler produces, but only through
  `automationStudioAbsentStepSkip`, not a full run.
- No full `pnpm check`, `pnpm test` or `pnpm build` was run.

## Open questions or contradictions found

1. **The rule is broader than script guarded groups.** Any authored step whose `failed` edge enters a Merge that its
   success path reaches through non-branching steps is now optional. Such a step's absent target is skipped with no
   retry, and its other failures go on down `failed` without spending recovery budget.
   - This is the rule the brief asked for. It is also what such a graph means: on failure, skip ahead to the join.
   - The shape's one limit: a guarded step that has its own `failed` route, or a loop between the step and the join,
     stops the step from counting as optional.
2. **Audit violations in files I do not own** (recorded only, not fixed):
   - `runtime/activity/tests/call-context.test.ts` has 11 `as never` casts against a baseline of 4.
   - `runtime/service.ts` is 4382 lines against a limit of 800. This appeared during my session, so it is probably
     another worker mid-edit.
3. **Stale documentation path.** `docs/architecture/automation-studio.md` line 940 cites
   `runtime/executor/tests/optional-failed-route.test.ts` and `absent-step.test.ts`. Both are now under
   `runtime/executor/step-skip/tests/`. The same paragraph could mention the guarded-group shape. I do not own that
   file.
