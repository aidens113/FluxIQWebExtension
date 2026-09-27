# t249 — Run 3 preflight delta

## Decision

Run 3 is a **conditional GO only if t246 passes on its final tree** and the combined focused,
Core-root, freshness, one-Lab, and provider-free readiness gates below are green. t239 and t243 are
already reported passing their focused/package/root check and build gates; t246 is the remaining
product gate because it closes the selected-Subflow replay defect exposed by t240/t245.

The live invocation remains the unchanged default **26-call** `mvp-hard-scenario` command. Do not
add a call, token, cost, timeout, Lab-instance, or run-root override. A passing run 3 begins the
consecutive-pass streak at **1** because runs 1 and 2 failed; one further independent default-
profile pass is still required.

No source/shared document, build output, run artifact, browser/provider/Lab state, or commit was
changed while preparing this report.

## Delta under measurement

### Core production ownership

- t239: Flow Bootstrap `diagnostic.ts`, `harness-failure.ts`, `failure-state.ts`,
  `diagnostic-parse.ts`, and refuted-result recovery carriage in `reauthor.ts`.
- t243: the scoped untyped-harness boundary in `runtime/service.ts`.
- t246, conditional: optional selected-`subflowId` forwarding in
  `result-verification/run-outcome.ts` and the service's `rerunRepairedFlow` callback.

The combined behavior expected in run 3 is:

- post-resolution setup before the harness remains `not_attempted / not_received`;
- an untyped harness escape is `provider_request / unknown / unknown`;
- returned structured provider failures retain their exact closed diagnostics;
- an applied wrong-answer reauthor replays the selected Subflow graph, then receives exactly one
  post-replay result judgement;
- retry, call/token/cost budgets, grants, permissions, capability lists, and the default profile are
  unchanged.

## Minimum final-tree validation and rebuild

Accept a t246 report only if it records these checks after its final edit. Otherwise run them from
`F:\!FluxIQ` after all Core editing stops:

```powershell
pnpm --filter fluxiq exec vitest run `
  src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts `
  src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/round-trip.test.ts `
  src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/provider-refusal.test.ts `
  src/programs/automation-studio/runtime/llm/harness/tests/run.test.ts `
  src/programs/automation-studio/runtime/llm/provider-retry/tests/call.test.ts `
  src/programs/automation-studio/runtime/recovery/refuted-result/tests/reauthor.test.ts `
  src/programs/automation-studio/runtime/tests/service-bootstrap/tests/accounting.test.ts `
  src/programs/automation-studio/runtime/result-verification/tests/run-outcome.test.ts `
  src/programs/automation-studio/runtime/tests/refuted-result/tests/reauthor-service.test.ts
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: integrated focused Core tests failed' }

pnpm --filter fluxiq check
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: FluxIQ package check failed' }

pnpm test
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: Core root tests failed' }
pnpm check
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: Core root check failed' }
pnpm build
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: ordered Core root build failed' }
```

The focused composition test must keep, not weaken, the exact successful call order:

```text
loop_verification, loop_verification, evidence_tool_decision, loop_verification
```

It must also prove final success, `extend` adaptation status `applied`, and zero active grants. Its
structured failure case must keep exact provider classification and no raw provider text.

The root build is required because it rebuilds contracts, FluxIQ runtime, gateway, and the
production web target in dependency order. A package-only build is insufficient for the isolated
target.

## Core freshness

After the final root build, require both runtime and web outputs to be newer than the newest changed
Core production file:

```powershell
$coreRoot = 'F:\!FluxIQ'
$changedCore = @(
  'packages/fluxiq/src/programs/automation-studio/runtime/service.ts',
  'packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/diagnostic.ts',
  'packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/harness-failure.ts',
  'packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/failure-state.ts',
  'packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/diagnostic-parse.ts',
  'packages/fluxiq/src/programs/automation-studio/runtime/recovery/refuted-result/reauthor.ts',
  'packages/fluxiq/src/programs/automation-studio/runtime/result-verification/run-outcome.ts'
) | ForEach-Object { Get-Item -LiteralPath (Join-Path $coreRoot $_) }
$newestCore = $changedCore | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
$coreRuntime = Get-Item -LiteralPath (Join-Path $coreRoot 'packages/fluxiq/dist/index.js')
$coreWeb = Get-Item -LiteralPath (Join-Path $coreRoot 'apps/web/.next/BUILD_ID')
if ($coreRuntime.LastWriteTimeUtc -le $newestCore.LastWriteTimeUtc) { throw 'NO-GO: Core runtime output is stale' }
if ($coreWeb.LastWriteTimeUtc -le $newestCore.LastWriteTimeUtc) { throw 'NO-GO: Core web output is stale' }
```

## Downstream reuse and freshness

No downstream product/runner source is owned by t239, t243, or t246. The t197 downstream outputs
may therefore be reused only after both conditions are proved:

1. downstream `pnpm check` passes against the rebuilt sibling Core;
2. every required output is present and newer than its own tracked source/config inputs and built
   dependency outputs, using t197's ownership graph.

Required direct-CLI outputs remain:

```powershell
$required = @(
  'packages/test-runner/dist/cli.js',
  'domain/dist/index.js',
  'apps/extension/dist/e2e-chromium/manifest.json',
  'apps/scenario-lab/dist/server.js'
)
$missing = @($required | Where-Object { -not (Test-Path -LiteralPath $_ -PathType Leaf) })
if ($missing.Count) { $missing; throw 'NO-GO: required downstream output is absent' }
```

Do not infer freshness from existence. Rebuild the narrow dependency closure if any downstream
tracked input or declared built dependency is newer: domain first, then test contracts/evidence as
applicable, extension E2E, scenario Lab, and test runner last. Report-only changes do not trigger a
rebuild. Do not rebuild unchanged downstream packages merely for ceremony once the timestamp and
check evidence proves reuse safe.

## One-Lab/process gate

Repeat this immediately before the dry-run and again immediately before the live invocation.
Report only process name and PID. Any match or `.lab-locks/build.lock` is a hard no-go; wait for its
owner and recheck, never delete the lock manually. Do not set `FLUXIQ_LAB_INSTANCE`.

```powershell
$labPattern = 'scripts[\\/]lab|packages[\\/]test-runner[\\/]dist[\\/]cli\.js|fluxiq-lab|apps[\\/]scenario-lab[\\/]dist[\\/]server\.js'
$busy = @(Get-CimInstance Win32_Process -ErrorAction Stop |
  Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine -match $labPattern } |
  Select-Object Name,ProcessId)
if ($busy.Count) { $busy | Format-Table; throw 'NO-GO: another Lab/build process is active' }
if (Test-Path -LiteralPath '.lab-locks/build.lock') { throw 'NO-GO: a Lab build lock is present' }
```

Use the disposable-shell/environment/credential procedure from t178/t219 unchanged: Core root
`F:\!FluxIQ`, environment-file loading disabled, isolated target, all stale base URL/gateway/
workspace/Flow/Lab-instance/path/run-root overrides cleared, and the real credential present only in
that process. Never print or inspect the credential value.

## Provider-free readiness

After the first one-Lab gate, run this exact zero-provider command:

```powershell
$readyRaw = & node packages/test-runner/dist/cli.js run everything-store `
  --target isolated `
  --live-llm `
  --llm-profile mvp-hard-scenario `
  --llm-provider deepseek `
  --llm-task create-flow `
  --instruction-task everything-store-plus-earbuds-under-50 `
  --replays 1 `
  --dry-run
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: provider-free readiness failed' }
$ready = $readyRaw | Select-Object -Last 1 | ConvertFrom-Json
if ($ready.status -ne 'ready' -or $ready.providerCallCount -ne 0 -or
    $ready.lane -ne 'created-flow' -or $ready.target -ne 'isolated') {
  throw 'NO-GO: readiness result is not the intended run-3 lane'
}
```

Also require scenario `everything-store`, workflow `plus-under-fifty`, task
`everything-store-plus-earbuds-under-50`, expected-dataset judgement
`extract-plus-under-fifty` at step 16, and exactly one replay accepted by parsing. The dry-run must
make exactly zero provider calls. The absence of `--llm-max-calls` attests that the 26-call default
remains in force.

## New no-hindsight debug chronology

Only after validation, build/freshness, and readiness are green, create a new pending debug. Never
reuse or overwrite either failed run's debug:

```powershell
$pending = 'docs/working/language-driven-flow-loop-plan/debugs/pending-t249-run-3.md'
if (Test-Path -LiteralPath $pending) { throw 'NO-GO: run-3 pending debug already exists; reconcile it first' }
Copy-Item -LiteralPath 'docs/working/language-driven-flow-loop-plan/run-debug-template.md' -Destination $pending
```

Before any provider call, complete the Header and all of Stage 1 with the instruction, exact
expected chain, oracle, and a plausible-looking wrong answer. Use only the pre-run baseline; do not
write a prediction learned from runs 1/2 as if it were run-3 observation. Record the measured delta
as t239 three-state provenance, t243 scoped raw-harness classification, and t246 selected-Subflow
post-reauthor replay. The default budget remains unchanged.

Run the second one-Lab gate only after Stage 1 is complete. Invoke the provider once. Immediately
rename the pending debug to `<run-id>.md` before reading bundle content. If no run ID is created,
keep the pending file and record the startup failure; never invent a name.

## Exact run-3 invocation

Use the unchanged `Invoke-T178LiveRun` helper. Its underlying command remains exactly:

```powershell
node packages/test-runner/dist/cli.js run everything-store `
  --target isolated `
  --live-llm `
  --llm-profile mvp-hard-scenario `
  --llm-provider deepseek `
  --llm-task create-flow `
  --instruction-task everything-store-plus-earbuds-under-50 `
  --replays 1
```

There is deliberately no `--llm-max-calls`, token/cost/timeout override, instance label, alternate
target, or alternate run root. The helper must preserve the CLI exit code, require a run ID, require
the default `test-runs/<run-id>` path, and run `inspect` before exposing only sanitized result
fields.

```powershell
$run3 = Invoke-T178LiveRun
Rename-Item -LiteralPath $pending -NewName "$($run3.RunId).md"
$run3 | Format-List
```

Fully debug run 3 before another provider call. Require a finalized, integrity-valid bundle and the
full live-validation contract: authored qualifying chain, own-page reach, authored-node replay,
dataset/field oracle match, Core result judgement, recorded recovery, persisted repair when used,
zero-provider deterministic replay, and facility verdict `passed`.

If run 3 passes, record consecutive-pass streak **1**. Run 4 must repeat the same gated default
profile independently to reach streak 2. If run 3 fails, the streak remains/reset to 0; fix only an
evidence-backed defect, rebuild every affected closure, repeat readiness, and do not make a second
provider call until run 3 is fully debugged.
