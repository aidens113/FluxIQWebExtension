# t287 — Downstream freshness order fix

Status: **Complete (read-only design)**

## Verdict

The original t263/t281 order was wrong for timestamp-based freshness. It treated Scenario Lab as only a consumer of test-contracts, but the Scenario Lab `build` script actively rebuilds test-contracts before compiling itself. Because t263 placed Scenario Lab after test-evidence, that nested write made test-contracts newer than test-evidence and deterministically invalidated the earlier evidence output.

No source defect is required to explain t284. The correction is to treat the nested test-contracts build as a graph mutation and place every test-contracts-dependent output after the final command that can rewrite test-contracts.

## Effective dependency DAG

```text
Core contracts ──> test-contracts ──> Scenario Lab
                         │
                         ├──────────> test-evidence ──┐
                         │                            │
                         └────────────────────────────┼──> test runner
Core FluxIQ/gateway ──> domain ───────────────────────┤
          │                │                          │
          │                └──> extension             │
          ├───────────────────> extension             │
          └───────────────────────────────────────────┘
```

Operationally, `pnpm --filter @fluxiq-web-extension/scenario-lab build` contains this additional write edge:

```text
Scenario Lab build command ──writes──> test-contracts/dist
```

Therefore Scenario Lab must finish before test-evidence and test-runner take their final build timestamps. Extension is independent of the test-contracts/evidence branch once domain and Core outputs are current.

## Minimal recovery from the t284 state

t284 proved that test-contracts was current and that only test-evidence had failed at the first comparison. The runner consumes test-evidence and was built before the later dependency correction. The minimal safe repair closure is therefore:

```powershell
pnpm --filter @fluxiq-web-extension/test-evidence build
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: test-evidence rebuild failed' }

pnpm --filter @fluxiq-web-extension/test-runner build
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: test-runner rebuild failed' }
```

Do not rebuild Scenario Lab or test-contracts after these two commands. Doing so would invalidate test-evidence again. Domain, extension, and Scenario Lab do not consume test-evidence, so they do not belong to this minimal repair closure.

After those two commands, rerun all six t263 freshness assertions from the beginning rather than resuming after the previous failure.

## Correct full rebuild order

For a fresh downstream closure after a Core rebuild, use this serial order:

```powershell
pnpm --filter @fluxiq-web-extension/domain build
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: domain build failed' }

pnpm --filter @fluxiq-web-extension/test-contracts build
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: test-contracts build failed' }

pnpm --filter @fluxiq-web-extension/scenario-lab build
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: Scenario Lab build failed' }

pnpm --filter @fluxiq-web-extension/test-evidence build
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: test-evidence build failed' }

pnpm --filter @fluxiq-web-extension/extension build
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: extension build failed' }

pnpm --filter @fluxiq-web-extension/test-runner build
if ($LASTEXITCODE -ne 0) { throw 'NO-GO: test-runner build failed' }
```

The explicit test-contracts command is technically redundant because Scenario Lab rebuilds it, but retaining it makes the six-owner closure visible and fails early if contracts cannot compile. The Scenario Lab invocation is the final writer of test-contracts; test-evidence and test-runner follow it. Extension may move anywhere after domain, but the order above remains simple and serial.

An equally correct minimal-command full build may omit the explicit test-contracts command because Scenario Lab owns that nested build:

```text
domain → Scenario Lab (including test-contracts) → test-evidence → extension → test-runner
```

## Freshness assertions

Use t263's tracked-input procedure unchanged after the final build command. The required comparisons remain:

1. `packages/test-contracts/dist/index.js` newer than its tracked inputs and Core contracts output.
2. `packages/test-evidence/dist/index.js` newer than its tracked inputs and the final test-contracts output.
3. `domain/dist/index.js` newer than its tracked inputs and Core FluxIQ/gateway outputs.
4. `apps/extension/dist/e2e-chromium/content/index.js` newer than its tracked inputs, domain output, and Core FluxIQ/gateway outputs; separately require the manifest to exist.
5. `apps/scenario-lab/dist/server.js` newer than its tracked inputs and the final test-contracts output.
6. `packages/test-runner/dist/cli.js` newer than its tracked inputs, domain, test-contracts, test-evidence, and Core FluxIQ outputs.

Stop on the first stale comparison and name both timestamps. A package check does not repair or substitute for output freshness.

## Scope

This was a read-only dependency and script audit. No build, check, dry/live, Lab, browser, provider, source, shared-document, generated-output, artifact, commit, or push action was performed. This report is the only write.
