# Terminal run evidence — worker report

## Current State
- Implemented additive screened terminal metadata and recovered-aware unvisited-node diagnosis in the released downstream Lab owners. Four focused owner files pass **86/86** through the heavy wrapper.
- Source **frozen** after the released coherent `stopped-without-failed-attempt.ts` extraction; `persisted-flow-run.ts` is now 783 lines. No baseline changes.
- Core source is read-only reference. No live run, provider call, environment change, process management, commit or push performed by this worker.

## Changes and boundaries
- `flow-lane/terminal-evidence.ts` projects optional Core metadata into `terminalFailureReason` (closed category), screened opaque `currentNodeId`, and boolean `messagePresent`.
- Core's terminalFailureReason is free text, often trace.message. Exact generic Core fallback sentences and bounded graph templates map to categories. Unknown text or malformed reasons map to `withheld_unrecognized`; raw trace messages, interpolated route/edge values, page data and secrets never appear in the projection.
- Missing terminal metadata remains absent in the outcome and null in recorded/created lane snapshots.
- `persisted-flow-run.ts` retains terminal projection and counts unvisited action nodes using the final attempt of each node. Historical healed failures no longer prevent additive stop diagnosis; a later unresolved failure still does. Existing Core status, headline failure selection, recovery attribution, verdicts and oracles remain unchanged.
- `index.ts`, `run-flow-lane.ts`, and `creation/snapshot.ts` expose the projection. Four owning test files cover safe reasons, unknown text withholding, malformed/missing data, healed versus subsequently unresolved failures, and both lane snapshots.

## Validation ledger
- Failing-before: four owner files, 86 tests, 79 passed / 7 failed. One creation fixture had an async invocation mistake; corrected it and independently reran that owner: 30 passed / 1 intended missing-evidence failure. Six other failing assertions concerned absent safe terminal projection/recovered-aware counting.
- Initial after run: 85 passed / 1 failed because the new regression supplied unsupported failure category `rate_limited`, so the existing parser correctly withheld that failure. Corrected the fixture to supported `action_failed` with the original `web.action.rate_limited` code.
- Final owner run: **86 passed / 0 failed**. Esbuild bundled the four named TypeScript owners into ignored `packages/test-runner/node_modules/.cache/t262-terminal-after`, then Node executed those exact `.mjs` files through `build-slots/heavy.sh` (slot b1).
- Parent still owns package check/build, structure audit and independent verification. Compilation or unit tests do not establish the next live terminal cause.

## Exact focused owner execution
From `packages/test-runner`, use the heavy wrapper with `node --input-type=module`. Resolve esbuild via `createRequire(path.resolve(process.cwd(), '../../domain/package.json'))('esbuild')`; build bundled Node22 ESM with external packages and outbase `src` into `node_modules/.cache/t262-terminal-after`. Entries:

```text
flow-lane/tests/terminal-evidence.test.ts
flow-lane/tests/persisted-flow-run.test.ts
flow-lane/tests/run-flow-lane.test.ts
flow-lane/creation/tests/lane.test.ts
```

Execute `process.execPath` with `--test` and the four absolute bundled `.mjs` paths from package cwd. A direct relative PowerShell invocation did not resolve the test paths reliably; the absolute Node spawn recipe above ran successfully.

## Next live build and deterministic replay
The first A run used disposable `isolated` storage; its cleaned-up Flow cannot be reused. Supervisor must build a new Flow into persistent workspace `t262-a`, preserve its opaque Flow ID, then replay separately without provider credentials.

Public non-secret configuration: `FLUXIQ_LAB_INSTANCE=t262-slot-2`, `FLUXIQ_TEST_ENV_FILES=none`, Lab-only build/run ceiling `0.10`. Keep normal user UI policy untouched.

```text
node scripts/lab/run-lab.mjs run crossborder-marketplace --target persistent-isolated --workspace t262-a --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task crossborder-marketplace-hub-to-cart --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48 --llm-cost-ceiling-usd 0.10
node scripts/lab/run-lab.mjs replay crossborder-marketplace --workspace t262-a --flow <new-flow-id> --instruction-task crossborder-marketplace-hub-to-cart
```

Replay must run in an environment containing no provider credential variables. Its owning path explicitly refuses credentials, removes workspace LLM Secret Keys and requires Core evidence of zero provider calls; do not infer deterministic reuse from the build playback alone.
## Final freeze
- Post-extraction owner rerun: 86 passed / 0 failed. `git diff --check -- packages/test-runner/src/flow-lane` passed (line-ending warnings only).
- Extracted the existing helper into released `stopped-without-failed-attempt.ts`, using type-only imports and existing recoveredByNode. Outcome type remains in its original owner; barrel exports the focused helper. No behavior beyond the bounded brief.
- Final released source group: terminal-evidence.ts, stopped-without-failed-attempt.ts, index.ts, persisted-flow-run.ts, run-flow-lane.ts, creation/snapshot.ts; tests/terminal-evidence.test.ts, tests/persisted-flow-run.test.ts, tests/run-flow-lane.test.ts, creation/tests/lane.test.ts.

Exact PowerShell execution from `packages/test-runner`:

```powershell
$terminalOwnerScript = @'
import {createRequire} from 'node:module'; import path from 'node:path'; import {spawnSync} from 'node:child_process';
const pkg=process.cwd(); const {build}=createRequire(path.resolve(pkg,'../../domain/package.json'))('esbuild');
const entries=['flow-lane/tests/terminal-evidence.test.ts','flow-lane/tests/persisted-flow-run.test.ts','flow-lane/tests/run-flow-lane.test.ts','flow-lane/creation/tests/lane.test.ts'];
const out=path.join(pkg,'node_modules/.cache/t262-terminal-after');
await build({entryPoints:entries.map(e=>path.join(pkg,'src',e)),outdir:out,outbase:path.join(pkg,'src'),outExtension:{'.js':'.mjs'},bundle:true,platform:'node',target:['node22'],format:'esm',packages:'external',logLevel:'silent'});
const result=spawnSync(process.execPath,['--test',...entries.map(e=>path.join(out,e.replace(/\.ts$/,'.mjs')))],{encoding:'utf8',maxBuffer:16*1024*1024});
console.log(result.stdout); console.log(result.stderr); process.exitCode=result.status;
'@
$terminalOwnerScript | & 'C:/Program Files/Git/bin/bash.exe' '/c/Users/osrs_/FluxStuff/build-slots/heavy.sh' 't262 terminal owners' node --input-type=module
```

## Supervisor integration after worker freeze

Structure audit rejected27source files in flow-lane against25limit. Supervisor moved terminal-evidence.ts to terminal/evidence.ts, stopped-without-failed-attempt.ts to terminal/stopped-without-failed-attempt.ts, and its focused test to terminal/tests/evidence.test.ts; added terminal/index.ts and synchronized parent barrel/imports. No logic changed. Fresh supervisor esbuild bundles in node_modules/.cache/t262-terminal-supervisor followed by four exact absolute owner tests from package cwd passed86/86. Final code paths supersede original worker ownership/artifact paths above; historic validation remains preserved.
