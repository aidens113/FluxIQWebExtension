# t178 Live-run preflight

Status: Complete

## Result

The two-run procedure is ready, but the checkout is **not ready to start a live run yet**.
The read-only snapshot taken after the machine restart found no matching Lab process and no
`.lab-locks/build.lock`, but `packages/test-runner/dist/cli.js` is absent and
`DEEPSEEK_API_KEY` is not present in this process. The supervisor must finish the ordered
Core/domain/scenario-lab/extension/test-runner rebuild and load the credential before the
provider-free readiness check below can be a go.

This procedure deliberately uses the default, unlabelled build and run directory from t172.
Do not set `FLUXIQ_LAB_INSTANCE`: a bare instance label is refused unless the Lab launcher
also exports all of that instance's compiled paths. Only one live Lab run may be in flight on
this machine, so the two runs below are strictly serial.

## One-time shell setup and credential loading

Run from `F:\!FluxIQWebExtension` in a disposable PowerShell process. Never put the key
literal in a command, transcript, report, or chat. If the process did not inherit the key,
load it with a non-echoing prompt:

```powershell
Set-Location -LiteralPath 'F:\!FluxIQWebExtension'

if ([string]::IsNullOrWhiteSpace($env:DEEPSEEK_API_KEY)) {
  $secret = Read-Host 'DEEPSEEK_API_KEY' -AsSecureString
  $address = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  try {
    $env:DEEPSEEK_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($address)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($address)
    $secret.Dispose()
  }
}
if ([string]::IsNullOrWhiteSpace($env:DEEPSEEK_API_KEY)) { throw 'DEEPSEEK_API_KEY is absent' }

$env:FLUXIQ_CORE_ROOT = 'F:\!FluxIQ'
$env:FLUXIQ_TEST_ENV_FILES = 'none'
$env:FLUXIQ_TEST_TARGET = 'isolated'
Remove-Item Env:FLUXIQ_TEST_BASE_URL,Env:FLUXIQ_TEST_GATEWAY_URL,Env:FLUXIQ_TEST_WORKSPACE,Env:FLUXIQ_TEST_FLOW_ID -ErrorAction SilentlyContinue
Remove-Item Env:FLUXIQ_LAB_INSTANCE,Env:FLUXIQ_LAB_EXTENSION_PATH,Env:FLUXIQ_LAB_SCENARIO_ENTRYPOINT,Env:FLUXIQ_LAB_HOST_MODULE,Env:FLUXIQ_TEST_RUNS_DIR -ErrorAction SilentlyContinue
```

The clear-list prevents a repository-local existing-installation configuration, an earlier
instanced run, or a stale workspace/Flow selection from changing what is measured. Close the
disposable shell after the sequence, or remove `Env:DEEPSEEK_API_KEY` first.

## Go/no-go checks

Run all checks immediately before **each** live invocation.

1. Confirm with the supervisor that no worker or other shell is building or running the Lab.
   A run is a no-go if this process query returns anything; report only the name and PID, not
   the full command line:

   ```powershell
   $labPattern = 'scripts[\\/]lab|packages[\\/]test-runner[\\/]dist[\\/]cli\.js|fluxiq-lab|apps[\\/]scenario-lab[\\/]dist[\\/]server\.js'
   $busy = @(Get-CimInstance Win32_Process -ErrorAction Stop |
     Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine -match $labPattern } |
     Select-Object Name,ProcessId)
   if ($busy.Count) { $busy | Format-Table; throw 'NO-GO: another Lab/build process is active' }
   if (Test-Path -LiteralPath '.lab-locks/build.lock') { throw 'NO-GO: a Lab build lock is present; wait for/recheck its owner, do not delete it by hand' }
   ```

2. Confirm the exact outputs the direct CLI needs exist. Absence is a rebuild gate, not a run
   failure:

   ```powershell
   $required = @(
     'packages/test-runner/dist/cli.js',
     'domain/dist/index.js',
     'apps/extension/dist/e2e-chromium/manifest.json',
     'apps/scenario-lab/dist/server.js'
   )
   $missing = @($required | Where-Object { -not (Test-Path -LiteralPath $_ -PathType Leaf) })
   if ($missing.Count) { $missing; throw 'NO-GO: required compiled output is absent' }
   if (-not (Test-Path -LiteralPath $env:FLUXIQ_CORE_ROOT -PathType Container)) { throw 'NO-GO: Core checkout is absent' }
   if ([string]::IsNullOrWhiteSpace($env:DEEPSEEK_API_KEY)) { throw 'NO-GO: provider credential is absent' }
   ```

3. Require the supervisor's observed success for the ordered step-3 checks and refreshed
   Core/domain/scenario-lab/extension/test-runner builds. File existence alone does not prove
   freshness. Then run the provider-free readiness invocation. It must exit zero and return
   `status: ready`, `providerCallCount: 0`, lane `created-flow`, target `isolated`, scenario
   `everything-store`, workflow `plus-under-fifty`, task
   `everything-store-plus-earbuds-under-50`, and expected step
   `extract-plus-under-fifty` at index 16. Do not proceed on any difference.

   ```powershell
   $readyRaw = & node packages/test-runner/dist/cli.js run everything-store --target isolated --live-llm --llm-profile mvp-hard-scenario --llm-provider deepseek --llm-task create-flow --instruction-task everything-store-plus-earbuds-under-50 --replays 1 --dry-run
   if ($LASTEXITCODE -ne 0) { throw 'NO-GO: provider-free readiness invocation failed' }
   $ready = $readyRaw | Select-Object -Last 1 | ConvertFrom-Json
   if ($ready.status -ne 'ready' -or $ready.providerCallCount -ne 0 -or $ready.lane -ne 'created-flow' -or $ready.target -ne 'isolated') {
     throw 'NO-GO: readiness result does not describe the intended lane'
   }
   ```

4. Before the command produces any artifact, copy the debug template to a pending file and
   fill all of Stage 1, including the verbatim instruction, expected node chain, and the
   plausible-looking wrong answer. This preserves the template's no-hindsight rule.

## Exact live commands

Use this helper for both independent live runs. It captures the one JSON result line without
printing the bundle contents, preserves the CLI exit code, requires a run id, and validates
the finalized bundle. A scenario verdict of `failed` still has a bundle and must be debugged.

```powershell
function Invoke-T178LiveRun {
  $raw = @(& node packages/test-runner/dist/cli.js run everything-store --target isolated --live-llm --llm-profile mvp-hard-scenario --llm-provider deepseek --llm-task create-flow --instruction-task everything-store-plus-earbuds-under-50 --replays 1)
  $exitCode = $LASTEXITCODE
  $line = $raw | Select-Object -Last 1
  if ([string]::IsNullOrWhiteSpace([string]$line)) { throw "The CLI returned no run result (exit $exitCode); inspect the sanitized stderr" }
  $result = $line | ConvertFrom-Json
  if ([string]::IsNullOrWhiteSpace([string]$result.runId)) { throw "The CLI did not create a run bundle (exit $exitCode)" }

  $expectedPath = Join-Path 'F:\!FluxIQWebExtension\test-runs' $result.runId
  if ([IO.Path]::GetFullPath([string]$result.path) -ne [IO.Path]::GetFullPath($expectedPath)) {
    throw 'Run bundle was written outside the expected default run root'
  }
  & node packages/test-runner/dist/cli.js inspect $result.runId
  if ($LASTEXITCODE -ne 0) { throw "Bundle integrity validation failed for $($result.runId)" }

  [pscustomobject]@{
    RunId = [string]$result.runId
    Verdict = [string]$result.verdict
    FailureCategory = [string]$result.failureCategory
    Path = [string]$result.path
    ExitCode = $exitCode
  }
}
```

Run 1:

```powershell
Copy-Item -LiteralPath 'docs/working/language-driven-flow-loop-plan/run-debug-template.md' -Destination 'docs/working/language-driven-flow-loop-plan/debugs/pending-t178-run-1.md'
# STOP: fill Stage 1 in pending-t178-run-1.md before continuing.
$run1 = Invoke-T178LiveRun
Rename-Item -LiteralPath 'docs/working/language-driven-flow-loop-plan/debugs/pending-t178-run-1.md' -NewName "$($run1.RunId).md"
$run1 | Format-List
```

Fully debug run 1 before any second provider call. If it names a defect, fix it, rebuild every
affected tree, rerun the narrow checks and all go/no-go checks, then start the next independent
run. Run 2:

```powershell
Copy-Item -LiteralPath 'docs/working/language-driven-flow-loop-plan/run-debug-template.md' -Destination 'docs/working/language-driven-flow-loop-plan/debugs/pending-t178-run-2.md'
# STOP: fill Stage 1 in pending-t178-run-2.md before continuing.
$run2 = Invoke-T178LiveRun
Rename-Item -LiteralPath 'docs/working/language-driven-flow-loop-plan/debugs/pending-t178-run-2.md' -NewName "$($run2.RunId).md"
$run2 | Format-List
```

Each facility run writes to `F:\!FluxIQWebExtension\test-runs\<run-id>`. The facility run id
is generated as `run-<time>-<random>` and is returned as `runId`; the Flow runtime's distinct
id is in `snapshots/flow-lane.json` as `runtimeRunId`. `--replays 1` may apply a repair and
prove it once without a second provider grant; that replay is recorded inside the same bundle
and does **not** count as the second independent live run.

Two commands are only enough to close the scenario if both independent runs pass in sequence.
If run 1 fails and run 2 passes after a fix, run 2 is consecutive pass 1 and a third run is
required. Continue the same gated sequence until two consecutive independent bundle verdicts
are `passed`.

## Per-run debugging checklist

Fill every field in the copied template. Use `NO EVIDENCE: <what was needed>` wherever the
bundle cannot answer a field; do not infer. Read the artifacts in this order:

1. `bundle.complete.json` and `artifact-index.json`: integrity was already checked by `inspect`;
   confirm every artifact named below is either indexed or explicitly absent.
2. `run.json`, `summary.json`, `evaluation.json`: header, scenario/workflow/variant, start/finish,
   reported verdict, failure category, browser/build identity, stage reached, and top-level
   measurements.
3. `review/timeline.json`: exact event order and the last completed stage. Correlate every
   observation with the rule/change it exercises; do not collapse repeated turns.
4. `snapshots/live-llm.json`: provider/model, build outcome, calls, tokens, cost, exploration
   decisions/tool calls/stop code, verification verdicts/calls, repair settlement, and every
   absent/truncated context marker. Never copy raw prompts or responses.
5. `snapshots/flow-lane.json`: proposed/reviewed Flow, screened `authoredNodes`, `ownPage`,
   `runtimeRunId`, run status, result verification, reported/oracle verdicts, terminal and
   recovered failures, route, harness recovery/re-author result, unsettled fields, extraction,
   and each action's node id/output/attempt/duration/recovery rung. For an incomplete lane,
   record `stoppedAt` and every null field as not reached.
6. `snapshots/extraction-mismatches.json`: expected and returned record counts, every compared
   field, matched/mismatched values, missing/extra rows, and whether any comparison was only a
   count. Summarize values in the debug document; do not paste recorded page data.
7. `snapshots/repair-lane.json`, when present: declared repair verdict and target, application
   outcome, replay count, each replay's outcome/provider-call count/goal verdict, and whether
   the persisted repaired Flow was actually the one replayed. Its absence must be explained.
8. `logs/*.log` only for a process/startup failure not answered above. If
   `provider-failures.local.json` exists, treat it as local-only diagnostic evidence and
   summarize only its sanitized category/status; never publish or quote its body.

For the template's causes table, name the exact value/node/selector/parameter/missing step,
the owning repository and file, the smallest fix, and a task id. A row such as “extraction was
wrong” is not sufficient. Attribute these changes explicitly where observed: defensive
runtime/retries and the rung that absorbed a fault; removed non-high-risk gates; exploration
failure feedback; read/list-wait behavior; visible filter vocabulary; judge instructions;
repair proposal/application; and deterministic provider-free replay.

Before declaring a pass, require all of the following from the bundle: the instruction's full
qualifying chain is present in the authored Flow; the Flow reaches its own page; replay actions
match the authored nodes; returned rows and fields match the expected dataset rather than just
the count; Core's result judgement ran; every recoverable fault is both absorbed and recorded;
any repair is persisted and its replay makes zero provider calls; and the facility verdict is
`passed`. A model claim, build success, or runtime `succeeded` status alone is not a pass.

## Current restart snapshot

- Matching Lab/build processes: 0.
- `.lab-locks/build.lock`: absent.
- `domain/dist/index.js`, extension E2E manifest, scenario-lab server, and sibling Core checkout:
  present.
- `packages/test-runner/dist/cli.js`: absent — current hard no-go until rebuilt.
- `DEEPSEEK_API_KEY` in this worker process: absent — expected to be loaded only in the
  supervisor's disposable live-run shell.

## Files

- Added only this report.
- Did not run the Lab, call a provider, build, edit product/shared files, inspect recorded page
  data, commit, or push.
