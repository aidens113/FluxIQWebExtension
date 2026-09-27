# t219 — Run 2 preflight delta

## Decision

Run 2 is a **conditional GO** only after t217's focused tests, Core check, and ordered Core root build have passed on the final t217 tree, and the provider-free readiness command passes again immediately before the live invocation.

The live command remains the default **26-call** `mvp-hard-scenario` profile. Do not add `--llm-max-calls 27`. T216 identified 27 as a reversible diagnostic experiment only; a 27-call result is not an MVP measurement and cannot count toward two consecutive default-profile passes.

T217 changes failure classification, not model convergence. Run 2 may still fail to produce a Flow; the expected improvement in that case is that a final refused completion retains its actionable unusable-decision issue instead of being flattened to iteration-limit.

## What changed since run 1

The only required product delta is t217 in FluxIQ Core:

- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop.ts` preserves a final unusable issue at literal loop exhaustion;
- focused loop-budget and unusable-decision tests cover specific final refusal versus generic iteration exhaustion;
- no downstream contract, CLI, scenario, domain, extension, or runner source is part of the fix;
- no call, token, cost, timeout, replay, permission, or answerability limit changes.

Therefore Core must be validated and rebuilt. Downstream outputs from t197 may be reused only if they still exist and remain fresh against their own unchanged inputs; an unconditional downstream rebuild adds no coverage for this internal Core change.

## Ordered validation and rebuild

If the completed t217 report already records these exact gates passing after its final edit, the supervisor may accept those observed results rather than rerun them. Otherwise run from `F:\!FluxIQ`:

```powershell
pnpm exec vitest run `
  packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/loop-budget.test.ts `
  packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/unusable-decision.test.ts
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: t217 focused tests failed' }

pnpm check
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: Core check failed' }

pnpm build
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: ordered Core root build failed' }
```

The root build is required rather than only `--filter fluxiq build`; it rebuilds, in dependency order:

1. `@fluxiq/contracts`;
2. `fluxiq`;
3. `@fluxiq/client-gateway-websocket`;
4. `@fluxiq/web`, including the production application used by the isolated target.

If t217 added its optional directly relevant bootstrap integration test, include that file in the focused Vitest invocation or require its passing result from the t217 report.

## Freshness and immediate no-go checks

After the Core build, require the Core runtime output and web build marker to be newer than t217's runtime source. Do not treat mere existence as freshness:

```powershell
$coreRoot = 'F:\!FluxIQ'
$changedCore = Get-Item -LiteralPath (Join-Path $coreRoot 'packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop.ts')
$coreRuntime = Get-Item -LiteralPath (Join-Path $coreRoot 'packages/fluxiq/dist/index.js')
$coreWeb = Get-Item -LiteralPath (Join-Path $coreRoot 'apps/web/.next/BUILD_ID')
if ($coreRuntime.LastWriteTimeUtc -le $changedCore.LastWriteTimeUtc) { throw 'NO-GO: Core runtime output predates t217' }
if ($coreWeb.LastWriteTimeUtc -le $changedCore.LastWriteTimeUtc) { throw 'NO-GO: Core web build predates t217' }
```

From `F:\!FluxIQWebExtension`, require the unchanged direct-CLI outputs:

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

If a downstream tracked input has changed since t197, rebuild only its dependency closure in the established order before proceeding. A report-only change does not trigger a product rebuild.

Immediately before both the provider-free readiness command and the live command, repeat t178's one-Lab process/lock check. Report only process name and PID. A matching Lab/build process or `.lab-locks/build.lock` is a hard no-go; wait and recheck, never delete the lock manually. Do not set `FLUXIQ_LAB_INSTANCE`.

## Disposable shell and credential safety

Use one disposable PowerShell process rooted at `F:\!FluxIQWebExtension`:

- set `FLUXIQ_CORE_ROOT=F:\!FluxIQ`, `FLUXIQ_TEST_ENV_FILES=none`, and `FLUXIQ_TEST_TARGET=isolated`;
- clear stale base URL, gateway URL, workspace, Flow ID, Lab-instance/path, and run-root overrides exactly as in t178;
- load `DEEPSEEK_API_KEY` only into that process, using `Read-Host -AsSecureString` and the t178 zeroed-BSTR conversion when it was not inherited;
- never place the credential literal in a command, argument, file, transcript, report, or chat;
- never echo or inspect its value—check only whether it is non-empty;
- close the disposable shell after the run, or remove the environment variable first.

A synthetic credential is acceptable only for an isolated dry-run in a shell that will never execute the live command. The live run must use the real process-only credential; readiness remains provider-free.

## Provider-free readiness

Run this exact command after all gates above and immediately before creating the pending debug:

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
  throw 'NO-GO: readiness result is not the intended run-2 lane'
}
```

Also require expected-dataset judgement at `extract-plus-under-fifty`, step index 16, and one replay accepted by parsing, as t197 observed. Provider call count must remain exactly zero.

The absence of `--llm-max-calls` is intentional and is the attestation that the shared 26-call default remains in force. Reject any wrapper, environment setting, or copied command that adds a call override.

## New pending-debug chronology

Create a new pending file only after Core validation/build/freshness and readiness are green. Never reuse or overwrite the run-1 debug or an old pending file:

```powershell
$pending = 'docs/working/language-driven-flow-loop-plan/debugs/pending-t219-run-2.md'
if (Test-Path -LiteralPath $pending) { throw 'NO-GO: run-2 pending debug already exists; reconcile it before proceeding' }
Copy-Item -LiteralPath 'docs/working/language-driven-flow-loop-plan/run-debug-template.md' -Destination $pending
```

Before invoking the provider, fill Header and all of Stage 1 with the instruction, exact expected chain, oracle, and plausible-looking wrong answer. The expected chain may reuse the pre-run baseline facts, but must not include a prediction derived from run-2 output. Record that the change under measurement is t217's terminal-classification parity only; the default budget is unchanged.

Only after the file is complete may the live command run. Immediately afterward, rename the pending file to `<run-id>.md` before opening any bundle content. If the command creates no run ID, preserve the pending file and report the startup failure; do not guess a name.

## Exact run-2 invocation

Use the unchanged `Invoke-T178LiveRun` helper from t178, whose underlying command is exactly:

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

There is deliberately no `--llm-max-calls`, `--llm-max-run-tokens`, cost override, timeout override, instance label, or alternate run root.

The helper must preserve the CLI exit code, require a run ID, require the default `test-runs/<run-id>` path, and run `node packages/test-runner/dist/cli.js inspect <run-id>` before reporting the sanitized fields `RunId`, `Verdict`, `FailureCategory`, `Path`, and `ExitCode`.

Then:

```powershell
$run2 = Invoke-T178LiveRun
Rename-Item -LiteralPath $pending -NewName "$($run2.RunId).md"
$run2 | Format-List
```

Fully debug run 2 before another provider call. If run 2 passes, it is consecutive pass **1**, because run 1 failed; a third independent default-profile pass is still required. If run 2 fails, fix only an evidence-backed defect, repeat the rebuild/readiness gates for the affected trees, and reset the consecutive-pass count.

## Go/no-go summary

GO requires all of the following:

- t217 focused tests, Core check, and Core root build passed after the final edit;
- Core runtime/web outputs are fresh against t217;
- unchanged downstream CLI/domain/extension/scenario outputs exist and remain fresh;
- no other Lab/build tree or lock is present;
- process-only credential is present without being exposed;
- provider-free readiness returns the exact intended lane/task/oracle and zero calls;
- a new pending debug exists with Stage 1 completed before the provider command;
- the live command contains no call-count or other budget override.

Any failed item is a no-go, not a reason to improvise a different target, stale build, 27-call command, parallel Lab, or second provider attempt.

No source or shared document was changed. No build output, run artifact, browser/provider/Lab state, commit, or existing debug was read or changed while preparing this report.
