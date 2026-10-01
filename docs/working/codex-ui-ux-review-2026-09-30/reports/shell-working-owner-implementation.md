# Shell working owner implementation

Status: Complete — exact four source/test paths frozen for supervisor review
Owner: deployment_docs_audit
Date: 2026-10-01

## Written brief

- Read parent Current State and shell-working-owner-audit.md. Root independently reviewed frozen Chat owner helper and118 direct tests/strict8roots0; downstream checkpoint425f58af. Use its actual confirmed tuple/lease policy, not duplicate definitions.
- Own exact downstream apps/extension/src/panel/shell/mount-panel.ts, working-hold.ts, NEW shell/tests/working-owner.test.ts and NEW shell/tests/working-hold-reset.test.ts; this report only additionally. Existing tests/harness/Chat/feed/Automations/recording/extraction/status/protocol/barrels/Core stay read-only.
- Reproduce same-connected A working/B idle and A idle/B running publication via real mountPanel's separate feed using synthetic status/runtime messages. Mask/retire foreign shell feed before current controls observe it; replace owner-scoped request/listeners with exact instance/lease fencing. First unknown-to-confirmed retires unknown leases; reconnect/session/tab/queue/name churn and omitted optional settings preserve owner.
- Actual owner replacement resets working hold timer/raw/shown coherently, publishes current runtime fallback under original400ms-on/1200ms-off policy, then trusts current paced feed. Add focused reset contract in working-hold; canceled/retired timer callbacks cannot publish or clear newer schedule. Preserve stop's existing contract and all original hold/input assertions.
- Preserve shell separate visible/reconnect lifecycle: do not equate Chat active with shell feed need, clear recording/project drafts, change recording-ended navigation, focus/scroll or cancel issued background commands. Unsupported feed stays mounted-lifetime sticky; no retry on every owner observation.
- Tests-first meaningful adverse-order failures; inspect original narrow hold/input/navigation compatibility tests. If existing mounted fake lacks necessary callback capabilities, propose exact local fixture in NEW test only, not shared harness changes. No actual stores/browser/private data.
- Narrow owned tests + existing hold/input/navigation checks through heavy; actual-config scoped four roots with zero owning/global/dependency diagnostics; measure module budget/whitespace, then freeze. No broad gates/commits/push/shared docs/browser/provider/panel operations. Request precise release before extra paths.

## Progress

Read exact brief/parent Current State/audit, frozen actual Chat owner context helper, owning shell hold/input/navigation tests and direct feed/store boundaries. Local new integration fixture uses real mountPanel with synthetic status/runtime messages; shared fake/harness unchanged. Initial native1/session60703 reproduced11fail/2pass (13tests),614.0476ms: A working/B idle, A idle/B running, A/B/A old read/push, unknown lease and hold reset/stale timer defects. No private/live operations.

Source now reuses confirmed Chat owner context in shell's independent feed, replacing and masking feed before recording/automation consume new status. Exact instance+owner lease fences requests/listeners; first observation retires unknown leases. Sticky unsupported is kept mounted-lifetime. Existing shell tab/pagehide subscription and reconnect lifecycle remain separate from Chat activation. WorkingHold now exposes reset and epoch-owned timers; reset clears raw/shown and publishes idle only if changed, retaining400/1200 pacing for subsequent current runtime/feed observations and original stop raw/shown contract. Dependent extraction imports remain provisional until sibling source freezes.

## Validation and exact source return

First postchange five suites33/native0/705.495ms: owner7 + reset6 + unchanged hold4/input6/navigation10. Added same-owner reconnect cadence and current-owner replacement delay cases. Final six-suite native0:60tests/415.0408ms = owner9/reset6/hold4/input6/navigation10/feed25. All original assertions/harnesses unchanged; existing20-runtime-flip histories still prove stable Record/Extract/Run cadence. New mount integration directly checks Record's actual disabled state across owners; it does not claim a browser exercise of every control.

Actual extension tsconfig scoped exact four roots native0/session2223, zero owning/global/dependency diagnostics. First TEMP harness accidentally set types=[] and produced missing inherited chrome/node ambient diagnostics; corrected harness preserves actual inherited types and anchors typeRoots to extension/node_modules/@types. No product/type-setting relaxation or source fix was made to address that harness mistake. Temporary files removed. Actual-config strict checks retain domain/Core imports; parent must independently recheck after sibling extraction source freeze.

Exact whitespace check native0. Module sizes mount-panel255lines, working-hold76lines. Changed only mount-panel.ts, working-hold.ts and NEW shell/tests/working-owner.test.ts, working-hold-reset.test.ts plus this own report. Owner helper, shared harness, Chat/feed/automations/recording/extraction/protocol/barrels/Core source untouched. UI navigation, recording-ended transition, focus/scroll, user project/recording drafts and issued commands unchanged. No broad/private/browser/provider/panel/commit operations; no pending process. Source now frozen.

## Reproducible narrow bundle harness

From downstream t224, temporary harness compiles only named tests to ignored package-local scratch, preserving external dependency resolution. No tracked/generated output edits.

```powershell
$shellTestHarness = Join-Path $env:TEMP ('codex-shell-tests-' + [guid]::NewGuid().ToString('N') + '.mjs')
$env:CODEX_SHELL_TEST_HARNESS = $shellTestHarness
@'
const fs = require('node:fs');
const root = 'C:/Users/osrs_/FluxStuff/fxwork/t224/!FluxIQWebExtension/apps/extension';
const tests = ['panel/shell/tests/working-owner','panel/shell/tests/working-hold-reset','panel/shell/tests/working-hold','panel/shell/tests/working-input','panel/shell/tests/mount-panel-navigation','panel/chat/feed/tests/activity-feed'];
const code = ["import { build } from " + JSON.stringify('file:///' + root + '/node_modules/esbuild/lib/main.js') + ';', "import { pathToFileURL } from 'node:url';", 'const root = ' + JSON.stringify(root) + ';', 'const tests = ' + JSON.stringify(tests) + ';', "const outdir = root + '/.test-build-scratch/codex-shell-owner';", "await build({ entryPoints: tests.map(name => root + '/src/' + name + '.test.ts'), outdir, outbase: root + '/src', bundle: true, platform: 'node', target: ['node22'], format: 'esm', outExtension: { '.js': '.mjs' }, loader: { '.css': 'empty' }, external: ['fluxiq','fluxiq/*','@fluxiq/client-gateway-websocket','@fluxiq/client-gateway-websocket/*'], sourcemap: 'inline', logLevel: 'silent' });", 'process.setSourceMapsEnabled(true);', "for (const name of tests) await import(pathToFileURL(outdir + '/' + name + '.test.mjs').href);"];
fs.writeFileSync(process.env.CODEX_SHELL_TEST_HARNESS, code.join('\n'));
'@ | node
try { & 'C:/Program Files/Git/bin/bash.exe' 'C:/Users/osrs_/FluxStuff/build-slots/heavy.sh' 'codex shell final scoped tests' node $shellTestHarness; $shellTestExit = $LASTEXITCODE } finally { Remove-Item -LiteralPath $shellTestHarness; Remove-Item Env:CODEX_SHELL_TEST_HARNESS }
exit $shellTestExit
```

## Reproducible actual-config strict harness

```powershell
$shellTypeConfig = Join-Path $env:TEMP ('codex-shell-types-' + [guid]::NewGuid().ToString('N') + '.json')
$env:CODEX_SHELL_TYPE_CONFIG = $shellTypeConfig
@'
const fs = require('node:fs');
const root = 'C:/Users/osrs_/FluxStuff/fxwork/t224/!FluxIQWebExtension/apps/extension';
const base = root + '/src/panel/shell/';
fs.writeFileSync(process.env.CODEX_SHELL_TYPE_CONFIG, JSON.stringify({ extends: root + '/tsconfig.json', compilerOptions: { noEmit: true, incremental: false, typeRoots: [root + '/node_modules/@types'] }, include: [], exclude: [], files: ['mount-panel.ts','working-hold.ts','tests/working-owner.test.ts','tests/working-hold-reset.test.ts'].map(file => base + file) }));
'@ | node
try { & 'C:/Program Files/Git/bin/bash.exe' 'C:/Users/osrs_/FluxStuff/build-slots/heavy.sh' 'codex shell actual scoped types' pnpm --filter @fluxiq-web-extension/extension exec tsc --project $shellTypeConfig --noEmit; $shellTypeExit = $LASTEXITCODE } finally { Remove-Item -LiteralPath $shellTypeConfig; Remove-Item Env:CODEX_SHELL_TYPE_CONFIG }
exit $shellTypeExit
```

## Limits

Synthetic mount status/read/push/timer ordering proves local ownership guards and hold policy. It does not certify real browser worker/pagehide/BFCache/popup/sidepanel behavior, persisted user data or cancellation of background operations. Existing subscription across pagehide is intentionally preserved; a new hidden-page teardown policy needs separate scope. Unsupported remains a mounted-shell capability decision, not a claim each owner lacks a stream. Root independently reviews and owns full gates/docs/integration/commit.
