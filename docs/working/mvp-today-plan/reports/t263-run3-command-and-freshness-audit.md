# t263 — Run-3 command and freshness audit

Status: **Complete (audit only)**

## Decision

**Current decision: NO-GO.** t261 correctly found the Core runtime and web
outputs stale while t258 was still editing. At this audit point the named t258
final report is not yet present, t259 permits only progression to final gates,
and no settled-tree root build/freshness proof exists.

The live command itself remains correct and unchanged: default profile,
isolated target, one replay, and no `--llm-max-calls` or other budget/instance/
path override. A passing run 3 starts the streak at **1**.

Two corrections are required to t249's preflight:

1. Its focused Core list predates t255/t258 and must include continuation,
   hold, and grant suites as well as the integrated real-grant composition.
2. Downstream reuse cannot survive the required final Core root build under
   t249's own “built dependencies participate in freshness” rule. Rebuilding
   Core makes the linked Core outputs newer than downstream outputs. Rebuild
   the resulting downstream dependency closure in order rather than treating
   the t197 outputs as reusable.

## Final changed Core production inputs

Use t249's existing production-owner set plus these t255/t258 additions:

```text
packages/fluxiq/src/programs/_shared/runtime.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/execution/grant-binding.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/execution/grant-checks.ts
packages/fluxiq/src/programs/automation-studio/runtime/llm/execution/grants.ts
packages/fluxiq/src/programs/automation-studio/runtime/service.ts
packages/fluxiq/package.json
```

`service.ts` was already in t249 and remains one entry. The package manifest is
a build/package input and is currently changed. Tests and reports are validation
inputs, not production-output freshness owners.

The complete production list for the final Core runtime/web comparison is:

```powershell
$coreRoot = 'F:\!FluxIQ'
$coreProductionRelative = @(
  'packages/fluxiq/package.json',
  'packages/fluxiq/src/programs/_shared/runtime.ts',
  'packages/fluxiq/src/programs/automation-studio/runtime/service.ts',
  'packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/diagnostic.ts',
  'packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/harness-failure.ts',
  'packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/failure-state.ts',
  'packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/diagnostic-parse.ts',
  'packages/fluxiq/src/programs/automation-studio/runtime/llm/execution/grant-binding.ts',
  'packages/fluxiq/src/programs/automation-studio/runtime/llm/execution/grant-checks.ts',
  'packages/fluxiq/src/programs/automation-studio/runtime/llm/execution/grants.ts',
  'packages/fluxiq/src/programs/automation-studio/runtime/recovery/refuted-result/reauthor.ts',
  'packages/fluxiq/src/programs/automation-studio/runtime/result-verification/run-outcome.ts'
)
```

## Corrected copy-ready serial order

Run only after Core editing stops and t258/t259 have no unresolved finding.
Commands below intentionally stop at provider-free readiness; they do not
authorize a live run.

### 1. Core focused and root gates

From `F:\!FluxIQ`:

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

This matches current scripts: Core root `build` serially builds contracts,
FluxIQ, client-gateway WebSocket, then the web app. `pnpm --filter fluxiq
check` is TypeScript-only; it does not replace root structure/task/check gates.

### 2. Core freshness

Still from `F:\!FluxIQ`, after the root build:

```powershell
$coreProduction = $coreProductionRelative | ForEach-Object {
  Get-Item -LiteralPath (Join-Path $coreRoot $_)
}
$newestCore = $coreProduction | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
$coreRuntime = Get-Item -LiteralPath (Join-Path $coreRoot 'packages/fluxiq/dist/index.js')
$coreWeb = Get-Item -LiteralPath (Join-Path $coreRoot 'apps/web/.next/BUILD_ID')
if ($coreRuntime.LastWriteTimeUtc -le $newestCore.LastWriteTimeUtc) {
  throw 'NO-GO: Core runtime output is stale'
}
if ($coreWeb.LastWriteTimeUtc -le $newestCore.LastWriteTimeUtc) {
  throw 'NO-GO: Core web output is stale'
}
```

The two outputs are the required run-time markers. The root build also refreshes
contracts and gateway outputs, which become downstream dependency inputs.

### 3. Rebuild the downstream dependency closure

From `F:\!FluxIQWebExtension`, serially:

```powershell
pnpm --filter @fluxiq-web-extension/domain build
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: domain build failed' }

pnpm --filter @fluxiq-web-extension/test-contracts build
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: test-contracts build failed' }

pnpm --filter @fluxiq-web-extension/test-evidence build
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: test-evidence build failed' }

pnpm --filter @fluxiq-web-extension/extension build
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: extension build failed' }

pnpm --filter @fluxiq-web-extension/scenario-lab build
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: Scenario Lab build failed' }

pnpm --filter @fluxiq-web-extension/test-runner build
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: test-runner build failed' }

pnpm check
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: downstream check against rebuilt Core failed' }
```

Ownership/dependency order is:

```text
Core contracts ──> test-contracts ──> test-evidence ──┐
                         └──────────> Scenario Lab     ├─> test runner
Core FluxIQ/gateway ──> domain ──> extension          ┘
          └─────────────────────> extension/test runner
```

Scenario Lab does not consume Core directly, but it consumes test-contracts;
test runner consumes Core, domain, test-contracts, and test-evidence. Test
runner therefore remains last.

### 4. Downstream freshness

Required outputs and dependency markers:

```powershell
$downstreamRoot = 'F:\!FluxIQWebExtension'
$coreContracts = Get-Item -LiteralPath 'F:\!FluxIQ\packages\contracts\dist\index.js'
$coreFluxiq = Get-Item -LiteralPath 'F:\!FluxIQ\packages\fluxiq\dist\index.js'
$coreGateway = Get-Item -LiteralPath 'F:\!FluxIQ\packages\client-gateway-websocket\dist\index.js'

$testContracts = Get-Item -LiteralPath (Join-Path $downstreamRoot 'packages/test-contracts/dist/index.js')
$testEvidence = Get-Item -LiteralPath (Join-Path $downstreamRoot 'packages/test-evidence/dist/index.js')
$domain = Get-Item -LiteralPath (Join-Path $downstreamRoot 'domain/dist/index.js')
$extensionBundle = Get-Item -LiteralPath (Join-Path $downstreamRoot 'apps/extension/dist/e2e-chromium/content/index.js')
$extensionManifest = Get-Item -LiteralPath (Join-Path $downstreamRoot 'apps/extension/dist/e2e-chromium/manifest.json')
$scenarioLab = Get-Item -LiteralPath (Join-Path $downstreamRoot 'apps/scenario-lab/dist/server.js')
$testRunner = Get-Item -LiteralPath (Join-Path $downstreamRoot 'packages/test-runner/dist/cli.js')

function Get-NewestTrackedInput([string[]]$Pathspec) {
  $relative = @(& git -C $downstreamRoot ls-files -- @Pathspec)
  if ($LASTEXITCODE -ne 0 -or -not $relative.Count) { throw 'NO-GO: tracked input ownership could not be resolved' }
  return $relative | ForEach-Object { Get-Item -LiteralPath (Join-Path $downstreamRoot $_) } |
    Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
}
function Assert-Fresh([System.IO.FileInfo]$Output, [System.IO.FileInfo[]]$Inputs, [string]$Label) {
  $newest = $Inputs | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
  if ($Output.LastWriteTimeUtc -le $newest.LastWriteTimeUtc) { throw "NO-GO: $Label is stale" }
}

$domainInput = Get-NewestTrackedInput @(
  ':(glob)domain/src/**', ':(glob)domain/scripts/**', 'domain/package.json',
  ':(glob)domain/tsconfig*.json'
)
$testContractsInput = Get-NewestTrackedInput @(
  ':(glob)packages/test-contracts/src/**', 'packages/test-contracts/package.json',
  ':(glob)packages/test-contracts/tsconfig*.json'
)
$testEvidenceInput = Get-NewestTrackedInput @(
  ':(glob)packages/test-evidence/src/**', 'packages/test-evidence/package.json',
  ':(glob)packages/test-evidence/tsconfig*.json'
)
$extensionInput = Get-NewestTrackedInput @(
  ':(glob)apps/extension/src/**', ':(glob)apps/extension/scripts/**',
  ':(glob)apps/extension/manifest*.json', 'apps/extension/package.json',
  ':(glob)apps/extension/tsconfig*.json'
)
$scenarioLabInput = Get-NewestTrackedInput @(
  ':(glob)apps/scenario-lab/src/**', ':(glob)apps/scenario-lab/scripts/**',
  'apps/scenario-lab/package.json', ':(glob)apps/scenario-lab/tsconfig*.json'
)
$testRunnerInput = Get-NewestTrackedInput @(
  ':(glob)packages/test-runner/src/**', 'packages/test-runner/package.json',
  ':(glob)packages/test-runner/tsconfig*.json'
)

Assert-Fresh $testContracts @($testContractsInput, $coreContracts) 'test-contracts'
Assert-Fresh $testEvidence @($testEvidenceInput, $testContracts) 'test-evidence'
Assert-Fresh $domain @($domainInput, $coreFluxiq, $coreGateway) 'domain'
Assert-Fresh $extensionBundle @($extensionInput, $domain, $coreFluxiq, $coreGateway) 'extension bundle'
if (-not (Test-Path -LiteralPath $extensionManifest.FullName -PathType Leaf)) { throw 'NO-GO: extension manifest is absent' }
Assert-Fresh $scenarioLab @($scenarioLabInput, $testContracts) 'Scenario Lab'
Assert-Fresh $testRunner @($testRunnerInput, $domain, $testContracts, $testEvidence, $coreFluxiq) 'test runner'
```

Do not use the extension manifest's timestamp as the extension build marker:
`copyFile` may preserve the source manifest time. Use a generated bundle such
as `content/index.js`, while separately requiring the target manifest to exist
(and, if desired, comparing its bytes/hash with `manifest.e2e.json`).

### 5. One-Lab gate and provider-free readiness

Repeat t249's process/lock gate immediately before the dry-run:

```powershell
$labPattern = 'scripts[\\/]lab|packages[\\/]test-runner[\\/]dist[\\/]cli\.js|fluxiq-lab|apps[\\/]scenario-lab[\\/]dist[\\/]server\.js'
$busy = @(Get-CimInstance Win32_Process -ErrorAction Stop |
  Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine -match $labPattern } |
  Select-Object Name,ProcessId)
if ($busy.Count) { $busy | Format-Table; throw 'NO-GO: another Lab/build process is active' }
if (Test-Path -LiteralPath '.lab-locks/build.lock') { throw 'NO-GO: a Lab build lock is present' }
```

Then run the unchanged zero-provider readiness command:

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

Require the same parsed scenario/workflow/task/oracle/replay facts named by
t249. The dry-run must make zero provider calls. The absence of
`--llm-max-calls` proves the default 26-call profile remains selected.

Only after this passes may the supervisor create/populate the no-hindsight
pending debug, repeat the one-Lab gate, and make the single unchanged live
invocation. t261's zero-process/no-lock result was a snapshot, not a reservation.

## Files inspected

- `t249-run3-preflight-delta.md`
- `t261-run3-machine-readiness-snapshot.md`
- Core root, FluxIQ package, and web package scripts
- Downstream root, domain, test-contracts, test-evidence, extension, Scenario
  Lab, and test-runner package scripts/dependencies
- Extension build ownership for the E2E Chromium manifest and generated bundle
- Final t255/t258 production/test ownership visible in the settled shared tree

No build, test, dry-run, live/provider/browser/Lab, generated-output, source,
shared-plan, run-artifact, commit, or push action was performed.
