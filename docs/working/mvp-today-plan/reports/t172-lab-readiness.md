# t172 Lab readiness

Status: Complete

## Result

- Reconciled the changed extraction-read contract and runner ingestion lane. The contract now carries bounded `itemsSeen`, `emptyRecords`, and `listWait`; the runner preserves those counts and maps a newer producer's unfamiliar wait-stop word to the closed `unknown` value before strict validation.
- Reviewed the `run-scenario.ts` split into focused modules and its wiring coverage. No corrective edit was needed: the integrated package builds and its complete test suite passes.
- The named task resolves to scenario `everything-store`, workflow `plus-under-fifty`, expected dataset step `extract-plus-under-fifty` at index 16, with no variant. Its instruction is present and safely summarized by the readiness output rather than printed.

## Validation

- `pnpm --filter @fluxiq-web-extension/test-contracts test` — passed, 145 tests.
- `pnpm --filter @fluxiq-web-extension/test-runner test` — passed, 1,462 tests; this also rebuilt the runner.
- Provider-free readiness invocation with a dummy process-only credential and `--dry-run` — passed with `status: ready`, `providerCallCount: 0`, lane `created-flow`, target `isolated`, and `--replays 1` accepted. It started no topology, browser, or provider call.
- `pnpm structure:check` — package changes introduced no reported violation; the command failed only because `docs/working/README.md` is out of date with working-document headers, which is shared and outside this brief.

## Exact isolated live run

After Core, domain, scenario-lab, extension E2E, and test-runner builds are refreshed, run from `F:\!FluxIQWebExtension` in a PowerShell process where `DEEPSEEK_API_KEY` is already populated (do not print it):

```powershell
$env:FLUXIQ_TEST_ENV_FILES='none'
$env:FLUXIQ_TEST_TARGET='isolated'
Remove-Item Env:FLUXIQ_TEST_BASE_URL,Env:FLUXIQ_TEST_GATEWAY_URL,Env:FLUXIQ_TEST_WORKSPACE,Env:FLUXIQ_TEST_FLOW_ID -ErrorAction SilentlyContinue
node packages/test-runner/dist/cli.js run everything-store --target isolated --live-llm --llm-profile mvp-hard-scenario --llm-provider deepseek --llm-task create-flow --instruction-task everything-store-plus-earbuds-under-50 --replays 1
```

`FLUXIQ_TEST_ENV_FILES=none` is required in the current checkout because its repository-local test configuration selects an existing installation; without the override, the CLI correctly refuses the conflicting isolated target. `--replays 1` asks the run to execute the created Flow and then prove it once more without another execution grant.

## Files

- Added only this report. Existing changes under `packages/test-contracts/**` and `packages/test-runner/**` were validated unchanged.
