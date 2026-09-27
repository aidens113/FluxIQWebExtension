# t270 — Post-remediation gate manifest

Status: **Complete report-only consolidation; live gate remains closed**

Snapshot: `2026-09-26 18:47:52 -07:00`. At this snapshot the named t258 and t269 final reports were
not present. Their slots below are deliberately conditional; absence, an unresolved finding, or a
NO-GO verdict blocks every later step. No gate was executed for this report.

## Current decision

**NO-GO for live run 3.** T268 found that the first t265 remediation still had purpose-wide and
ambient retention. T267 separately found that the exact post-apply binding-read failure lacked a
service-composition regression. Run 3 may proceed only after the invocation-local remediation lands,
t269 returns GO on the settled source, the missing composition proof passes, and all serial gates
below produce fresh evidence on that same settled tree.

## Required report slots

Fill these before executing any command. A blank or adverse slot is a hard stop.

| Slot | Required evidence | Current value |
| --- | --- | --- |
| t258 implementation handoff | Final report path; settled commit/worktree identity; exact focused, package, root-test, root-check, and build results; no unresolved caveat. | **PENDING — report absent.** |
| t269 retention review | Final report path; **GO** proving no purpose-wide, caller-selectable, or ambient retention; exact invocation-local private seam; compatibility assessment. | **PENDING — report absent.** |
| t267 missing proof | Test path and passing result for a post-apply authoritative-binding-read failure through service composition: applied persistence, `applied:true`, `replayReady:false`, three provider calls only, no replay/fourth judge, sanitized detail, zero active grants. | **PENDING — absent in t267 snapshot.** |
| Tree settlement | Core and downstream status/diff identity captured after all implementation workers stop editing; no later source/test mutation through live preflight. | **PENDING.** |

Prior reviews are inputs, not substitutes: t265 and t268 are NO-GO snapshots; t267 is source-GO but
regression-NO-GO; t263 supplies the corrected build/freshness order.

## Deduplicated serial gate list

Stop on the first failure. Do not overlap validation with editing or another Lab run.

### 1. Freeze and inventory the settled tree

1. Confirm t258 and t269 reports exist and their required slots above are satisfied.
2. Confirm the t267 composition case exists in the settled Core test tree.
3. Record `git status --short`, branch, and `git rev-parse HEAD` for both repositories. The dirty
   working-tree inventory is part of the identity; do not mistake HEAD alone for the tested tree.
4. Confirm no worker is still editing either checkout. All later evidence belongs to this inventory.

### 2. Run the integrated Core focused matrix

From `F:\!FluxIQ`, run one Vitest invocation containing:

```powershell
pnpm --filter fluxiq exec vitest run `
  src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts `
  src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/round-trip.test.ts `
  src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/provider-refusal.test.ts `
  src/programs/automation-studio/runtime/llm/harness/tests/run.test.ts `
  src/programs/automation-studio/runtime/llm/provider-retry/tests/call.test.ts `
  src/programs/automation-studio/runtime/llm/tests/execution-grant/tests/execution-grant-continuation.test.ts `
  src/programs/automation-studio/runtime/llm/tests/execution-grant/tests/execution-grant-hold.test.ts `
  src/programs/automation-studio/runtime/llm/tests/execution-grant/tests/execution-grants.test.ts `
  src/programs/automation-studio/runtime/recovery/refuted-result/tests/reauthor.test.ts `
  src/programs/automation-studio/runtime/service/runtime-adaptation/tests/reauthor-continuation.test.ts `
  src/programs/automation-studio/runtime/tests/service-bootstrap/tests/accounting.test.ts `
  src/programs/automation-studio/runtime/tests/service-bootstrap/tests/generation.test.ts `
  src/programs/automation-studio/runtime/tests/service-bootstrap/tests/extend.test.ts `
  src/programs/automation-studio/runtime/result-verification/tests/run-outcome.test.ts `
  src/programs/automation-studio/runtime/tests/refuted-result/tests/reauthor-service.test.ts
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: integrated focused Core tests failed' }
```

If t269 names an additional test file, add it to this single invocation; do not run a duplicate
matrix. Record total passed/failed/skipped, duration, and the exact final path list. The minimum
behavioral evidence is:

- direct public `explore_and_adapt`/`extend` success and pre-provider failure each revoke once;
- a concurrent public call cannot inherit the private reauthor invocation's retention;
- successful reauthor reaches continuation, provider-free replay, fourth verification, and final
  revocation;
- continuation refusal and post-apply binding-read failure both preserve the durable application,
  close replay, avoid a fourth judge, expose no raw error/provider text, and finish with zero grants.

### 3. Run Core package and root gates

Still from Core, serially:

```powershell
pnpm --filter fluxiq check
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: FluxIQ package check failed' }
pnpm test
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: Core root tests failed' }
pnpm check
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: Core root check failed' }
pnpm build
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: Core root build failed' }
```

Record counts/duration for tests and exit status for every command. The root build must finish after
the final Core source edit; an older successful build is not reusable.

### 4. Prove Core output freshness

Use t263's complete `$coreProductionRelative` list, augmented with the final t269 production file if
it introduces one. Require both of these markers to be strictly newer than the newest listed input:

```text
packages/fluxiq/dist/index.js
apps/web/.next/BUILD_ID
```

Record the newest input path/time and both output times. Missing, equal-time, or older output is
NO-GO. The root build also refreshes contracts and gateway outputs used downstream.

### 5. Rebuild the downstream dependency closure

From `F:\!FluxIQWebExtension`, after the Core build, run exactly once in dependency order:

```powershell
pnpm --filter @fluxiq-web-extension/domain build
pnpm --filter @fluxiq-web-extension/test-contracts build
pnpm --filter @fluxiq-web-extension/test-evidence build
pnpm --filter @fluxiq-web-extension/extension build
pnpm --filter @fluxiq-web-extension/scenario-lab build
pnpm --filter @fluxiq-web-extension/test-runner build
pnpm check
```

Check `$LASTEXITCODE` after every command and stop immediately on failure. Record each result and
completion time. This rebuild is mandatory: the final Core outputs invalidate the older downstream
freshness proof.

### 6. Prove downstream freshness

Run t263's tracked-input `Assert-Fresh` procedure unchanged. Required output markers are:

```text
packages/test-contracts/dist/index.js
packages/test-evidence/dist/index.js
domain/dist/index.js
apps/extension/dist/e2e-chromium/content/index.js
apps/extension/dist/e2e-chromium/manifest.json (existence only)
apps/scenario-lab/dist/server.js
packages/test-runner/dist/cli.js
```

Record each output time and its newest source/dependency marker. Use the generated extension bundle,
not the copied manifest timestamp, for freshness.

### 7. Establish one-Lab readiness

Immediately before the dry-run, execute t263's process/lock check. Record only sanitized process
identity if busy; never record command-line secrets. Require no competing Lab/test-runner/scenario
server process and no `.lab-locks/build.lock`.

Run the unchanged provider-free readiness command:

```powershell
node packages/test-runner/dist/cli.js run everything-store `
  --target isolated `
  --live-llm `
  --llm-profile mvp-hard-scenario `
  --llm-provider deepseek `
  --llm-task create-flow `
  --instruction-task everything-store-plus-earbuds-under-50 `
  --replays 1 `
  --dry-run
```

Require exit zero and parsed final JSON with `status:"ready"`, `providerCallCount:0`,
`lane:"created-flow"`, and `target:"isolated"`, plus the scenario/workflow/task/oracle/replay facts
required by t249/t263. The command must have no max-call, budget, instance, or path override; the
default remains 26 provider calls for the later live attempt.

### 8. Hard live GO checkpoint

Live run 3 is authorized only when every prior slot and gate is green on the unchanged settled tree,
and all of the following are true:

- t269's final verdict is GO and t267's missing composition assertion has a passing result;
- Core runtime/web and every downstream marker are fresh by the comparisons above;
- the provider-free dry-run made zero provider calls and resolved the intended isolated lane;
- the no-hindsight pending debug record has been created and populated before any provider call;
- the one-Lab process/lock check is repeated immediately before launch and remains clear;
- credentials are loaded process-only and neither secrets nor raw provider text enter logs/reports;
- the live command is byte-for-byte the dry-run command above with only `--dry-run` removed;
- there is one live attempt and one requested replay; no second live run begins until its bundle is
  inspected and its debug record is completed under the artifact-capture procedure.

A passing run 3 starts the consecutive-pass streak at **1**; it does not complete the two-pass MVP
exit criterion.

## Result record to append at execution time

```text
Settled tree: Core HEAD/status [___]; downstream HEAD/status [___]
t258: [report ___] [GO/NO-GO ___] [unresolved findings ___]
t269: [report ___] [GO/NO-GO ___] [retention invariants ___]
t267 composition proof: [test path ___] [result/count/duration ___]
Core focused: [count ___] [duration ___] [PASS/FAIL ___]
FluxIQ package check: [___]
Core root test/check/build: [___ / ___ / ___]
Core freshness: [newest input ___ @ ___] [runtime ___] [web ___]
Downstream builds/check: [domain ___] [contracts ___] [evidence ___] [extension ___]
                         [Lab ___] [runner ___] [check ___]
Downstream freshness: [all markers and newest dependencies ___]
One-Lab pre-dry-run: [clear/busy ___] [lock absent/present ___]
Dry-run: [exit ___] [status ___] [provider calls ___] [lane ___] [target ___]
Pending debug created before provider call: [path/time ___]
One-Lab pre-live: [clear/busy ___] [lock absent/present ___]
Final live decision: [GO/NO-GO ___] [decider/time ___]
```

No source, shared document, generated output, build, test, dry-run, run artifact, provider/browser/Lab
state, commit, or push was changed or executed. This report is t270's only write.
