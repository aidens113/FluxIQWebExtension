# t229-core-regressions report

Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t229/!FluxIQ`, branch `task/t229-core-regressions`, base Core dev `fc26cfd6`. Nothing committed.
Paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

## Outcome

Partial. All three named failures are fixed and pass at the default $0.10 ceiling and at `FLUXIQ_LLM_RUN_COST_CEILING_USD=0.25`. tsc exit 0, structure audit passed.

The final full automation-studio run had 1 failure: `tests/service-flows/tests/instruction-readiness.test.ts` timed out at 15000 ms under full-suite load. It passed in isolation at the default timeout on both the original and the fixed source. It does not touch the permission gate or the recovery.

## What changed and why

### 1. `route-state/tests/build-routing.test.ts`: intended behaviour, test updated

- **Causing commit:** `2a5ad68c` (Lane B T3/T2/B1, t193). Bisected: the test passes at its parent `a7174329` (29/29/3) and fails at `2a5ad68c` (30/28/2). It also fails at merge `aafc5e86` and at every later dev merge, and passes at `28ceecf0`.
- **Cause:** T2's dry run now makes steps 3 and 6 optional by itself (`flow-draft/sometimes-present.ts`). Under that rule, everything-store-run4's completion 29 would be accepted. So the same commit changed `llm/decision-context/tests/recorded-runs.ts` to refuse 29, as the current check does, and 29 no longer runs a dry run. A probe of the replay confirmed it. D30 now follows a refusal: no calls before it, so one fewer capture after. Its shown count grows from 23 to 24, so the old high-water rule now catches it: before 29→30, callsBeforeUnseen 3→2. This matches the test's own arithmetic: the logged 32 minus the four completions now refused (29, 40, 44, 46) is 28.
- **Fix:** updated the run4 expectation to `{ before: 30, afterUnreported: 28, callsBeforeUnseen: 2 }` and the comment saying why. The new values fail on the pre-`2a5ad68c` source, which gives 29/29/3.
- **Files:** `route-state/tests/build-routing.test.ts`.

### 2. `tests/service-adaptation/tests/run-consequence-permission.test.ts`: permission defect, source fixed

- **Causing commit:** `2a5ad68c` (T3: "a no in a repair's exploration is a decline, told to the model").
- **Cause:** T3 made `runtime-exploration.ts` settle a person's no as `declined` and let the exploration continue. `AutomationStudioActionPermissionGate.settle("declined")` clears `latest`, so `gate.request` becomes `undefined`. `recovery/annotation/annotate.ts` read only `gate.request` to decide whether the patch is held (`heldForPermission`). So a no that nothing replaced still went on to the replan and patch calls. The debug run showed taskKinds `[runtime_diagnosis, evidence_tool_decision, evidence_tool_decision, runtime_patch]` and no `patchSkippedCode`.
- **Fix:**
  - The gate has a new getter, `standingDecline`. It is set when a person declines, and again when the declined question is refused unasked (the model tried the control again). It is cleared only by a grant.
  - `annotate.ts` computes `permissionStop = gate.request ?? gate.standingDecline` and uses it for the replan guard, `heldForPermission`, and the `patchSkipped` sentence. The result is `patchSkippedCode: llm.runtime_patch_permission_required` and no patch call.
  - The declined request is not written as `metadata.permissionRequest`, because the person has already answered it.
  - T3's behaviour is kept: the exploration still goes on after a no, and a grant on a different control (the c4 deny then c5 grant case in `recovery/tests/runtime-exploration-permission.test.ts`) lifts the stop.
  - `step-failure-decision.ts` already refuses a re-author on that skip code, so a declined act is not re-authored around either.
- **Tests:** the service test is unchanged and now passes. I added two gate tests: "keeps a person's no standing until a grant replaces it" and "stands on no decline when nobody answered". With my two source files reverted, the service test and the first new gate test fail (2 failed, 27 passed).
- **Files:** `action-permissions/gate.ts`, `recovery/annotation/annotate.ts`, `action-permissions/tests/gate.test.ts`.

### 3. `tests/recovery-default-limits.test.ts`: the test's model was wrong, test fixed (no source change)

- **Causing commit:** `fc26cfd6` lowered the default ceiling from $0.25 to $0.10. The test itself is unchanged since `711eab8c` and `c2864786`.
- **Cause:**
  - The test's exploration loop reserved each decision and never completed the lease. Every decision therefore stayed charged at its worst case, about $0.0186 here: 30k input all uncached plus the whole 8k reply allowance.
  - The real path does not work that way. `llm/harness/run.ts:268` completes every lease with the provider's reported usage, and decisions run one after another. So only the next decision's worst case is ever held beside the patch reserve, which is the rule F37 states for builds (`llm/loop-budget.ts`).
  - The reservation price is already shared with the build purse. `build-purse/projected-cost.ts` says it is "used by the run ledger's reservation and the build's purse alike". The purse also holds each call at its worst case.
  - So there is no more realistic reservation in the build path to reuse. F37's realism is in counting the calls after the next one at their actual cost, which the ledger already does by charging reported usage. Reserving less than a call's worst case would let a single call overrun the hard ceiling, against both F37 and the purse's design.
- **Fix:**
  - Each decision now reserves its worst case through `automationStudioLlmProjectedCallCostUsd`, the harness's own projection, under the per-call ceiling.
  - It then completes at a realistic reported cost: 30k input with a 61.8% cache-hit share (the hit rate measured on t195 live runs 36-37) and a 1k reply, about $0.00475.
  - The 8-decision requirement is kept. New assertions check that the ceiling is still the stop: a refusal, if one happens, is `llm_budget.run_cost_limit`; the patch hold is still pending; there are 0 breaches; and spending stays under the ceiling.
  - All amounts derive from `AUTOMATION_STUDIO_SESSION_KEY_PROVIDER_DEFAULTS`, which come from `AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_USD`. Nothing hard-codes 0.1.
  - With no source change, this test does not "fail on the old source". It would fail on a ledger that kept completed decisions at their worst case, which gives 3 decisions, as the original failure showed.
- **Files:** `tests/recovery-default-limits.test.ts`.

## Commands run and observed results

All from `packages/fluxiq` unless noted.

- `npx vitest run <the 3 failing files>` before any change: 3 failed, 9 passed. Same failures as the brief: 30/28/2, `expected 3 to be >= 8`, missing `patchSkippedCode`.
- Bisect of build-routing, using `git switch --detach` on merges and commits and returning to the task branch afterwards:
  - 83a6cc3a, d5730a5a, 43085660, aafc5e86, 2a5ad68c: fail (30/28/2).
  - 28ceecf0, a7174329: pass (29/29/3).
- `npx vitest run <3 files> src/.../runtime/action-permissions src/.../runtime/recovery` after the fix: Test Files 48 passed, Tests 579 passed.
- Revert check (my `gate.ts` and `annotate.ts` reverted temporarily, then restored): service permission test and the new gate test failed, 2 failed / 27 passed.
- `FLUXIQ_LLM_RUN_COST_CEILING_USD=0.25 npx vitest run <3 files>`: 12 passed.
- `npx tsc --noEmit -p .`: exit 0, no output.
- From the worktree root, `node scripts/structure-audit.mjs`: `structure-audit: passed (210 warning(s), 349 baselined)`, exit 0.
  - The `gate.ts` (458 lines) and `annotate.ts` (738 lines) file-lines warnings are advisory. Both files were already over 400 lines.
  - The audit also said "1 baseline entries can be lowered". That entry was not produced by this change.
- `npx vitest run src/programs/automation-studio`, first run, with tsc and the audit running concurrently: 3 failed, 4948 passed, 1 skipped. All three failures were 15000 ms timeouts, in subflow.test.ts, instruction-readiness.test.ts and proposals.test.ts.
- Those three files, rerun:
  - Fixed source, default timeout: 3 timeouts once.
  - Fixed source, `--testTimeout=60000`: 16 passed.
  - Original source, default timeout: 16 passed.
  - Fixed source, default timeout, twice more: 16 passed both times.
- `npx vitest run src/programs/automation-studio`, rerun with nothing else running: **Tests 1 failed | 4950 passed | 1 skipped (4952)**. The failure was instruction-readiness timing out at 15052 ms.

## Not verified

- A full automation-studio run with 0 failures. The remaining failure is a load timeout in `instruction-readiness.test.ts`, about 15 s against a 15 s limit, unrelated to this change. It passes in isolation.
- No live or Lab run, per the brief.
- The rest of Core (non-automation-studio vitest) was not run.

## Open questions or contradictions found

- The brief asked to "fix the reservation" for failure 3. The code shows the reservation is already the shared worst-case projection, released to reported cost on completion. The defect was the test never completing leases, so I fixed the test, not the source. If the supervisor wants a lower per-call hold anyway, that weakens the hard-ceiling guarantee that F37 and the build purse were designed to keep.
- `standingDecline` holds the patch whenever the last word on a lasting act was a no, including when the exploration later found a route that needed no permission at all. That is fail-closed by choice. A grant on another control lifts it.
- `2a5ad68c`'s lead validated only the changed directories, so this service-level test, outside them, broke unnoticed.
- `instruction-readiness.test.ts` sits close to its 15 s timeout under suite load and may need a longer timeout or a smaller fixture.
