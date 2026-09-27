# t197 -- Core rebuild and isolated readiness

Status: Complete -- GO
Repository scope: `F:\!FluxIQ` and `F:\!FluxIQWebExtension`
Date: 2026-09-26

## Result

The t192 freshness no-go is cleared. Core's complete root build passed in the
required dependency order, every output required by the isolated command is
newer than its owned current inputs, and the exact provider-free dry run
resolved the intended hard scenario with zero provider calls.

No browser, provider request, scenario server, Core process, run bundle, or
live Lab run was started by the dry-run path.

## Core root build

Ran from `F:\!FluxIQ`:

```powershell
pnpm build
```

Result: passed. The root script successfully rebuilt, in order:

1. `@fluxiq/contracts@0.2.0`;
2. `fluxiq@0.7.0`;
3. `@fluxiq/client-gateway-websocket@0.1.0`;
4. the `@fluxiq/web` Next production application, including type checking,
   page-data collection, all 16 static pages, optimization, and build traces.

## Freshness audit

Timestamps are UTC from the post-build snapshot on 2026-09-27.

| Tree | Output | Newest owned input/dependency | Verdict |
| --- | --- | --- | --- |
| Core contracts | `dist/index.js` 00:12:22 | latest package input predates output | Fresh |
| Core runtime | `dist/index.js` 00:12:32 | `packages/fluxiq/package.json` 00:11:30 | Fresh |
| Core gateway | `dist/index.js` 00:12:34 | latest package input predates output | Fresh |
| Core web | `.next/BUILD_ID` 00:13:51 | runtime high-risk classifier 00:06:07 and newest rebuilt package output 00:12:34 | Fresh; required root order is complete |
| Downstream domain | `domain/dist/index.js` 23:51:17 | `domain/src/output-nodes/definitions.ts` 22:04:11 | Fresh |
| Extension E2E | content bundle 23:51:23; manifest present | recovery budget source 22:58:33 | Fresh |
| Scenario Lab | `dist/server.js` 00:02:59 | own latest input predates output; test-contract dependency 00:02:54 | Fresh |
| Test runner | `dist/cli.js` 00:04:24 | runner source 19:53:35; domain/test-contract/test-evidence outputs all predate it | Fresh |

The Core and downstream generated paths are ignored and produced no scoped
status entries. The build did not alter a tracked source, manifest, lockfile,
or shared document.

## Provider-free isolated readiness

Ran the exact t178 command from `F:\!FluxIQWebExtension` with
`FLUXIQ_CORE_ROOT=F:\!FluxIQ`, environment-file loading disabled, the isolated
target selected, stale target/instance overrides removed, and a synthetic
process-only credential that was removed immediately afterward:

```powershell
node packages/test-runner/dist/cli.js run everything-store --target isolated --live-llm --llm-profile mvp-hard-scenario --llm-provider deepseek --llm-task create-flow --instruction-task everything-store-plus-earbuds-under-50 --replays 1 --dry-run
```

Result: exit zero with the exact expected request:

- status `ready`;
- provider calls `0`;
- lane `created-flow`;
- target `isolated`;
- scenario `everything-store`;
- workflow `plus-under-fifty`;
- variant `null`;
- task `everything-store-plus-earbuds-under-50`;
- request kind `navigate-and-extract`;
- expected-dataset judgement at `extract-plus-under-fifty`, step index 16;
- LLM task `create-flow`, provider `deepseek`, purpose `build_and_adapt`;
- one replay accepted by command parsing.

The readiness result exposed only the credential variable's name/source, not
its value. No secret value is recorded in this report.

## Additional checks

- No matching Lab/build process remained after the dry run.
- `.lab-locks/build.lock` was absent.
- All required generated markers were confirmed ignored by Git.

Only ignored/generated build outputs and this unique report were written. No
tracked product file, shared document, lockfile, browser, provider, live Lab
run, commit, tag, or publish was touched.
