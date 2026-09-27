# t184 Runner build readiness

Status: Complete

## Result

The ignored test-runner build lost in the machine crash has been restored. The built CLI now
exists at `packages/test-runner/dist/cli.js`, is ignored by git, and executed the exact isolated
provider-free readiness request successfully.

The named instruction task resolved to:

- scenario `everything-store`;
- workflow `plus-under-fifty`;
- no variant;
- task `everything-store-plus-earbuds-under-50`;
- `navigate-and-extract` lane;
- expected-dataset judgement at `extract-plus-under-fifty`, step index 16.

The readiness result was `status: ready`, `providerCallCount: 0`, lane `created-flow`, and target
`isolated`. `--replays 1` was accepted by command parsing. The returned instruction descriptor
contained only its character count and digest, not its text.

## Commands and validation

1. Restored only the package's ignored generated output through its owning script:

   ```powershell
   pnpm --filter @fluxiq-web-extension/test-runner build
   ```

   Result: passed. The script found the existing `domain/dist/index.d.ts`, cleaned only
   `packages/test-runner/dist`, and compiled the runner. It did not rebuild or edit domain
   source.

2. Ran the exact readiness command from t172/t178 with a synthetic process-only credential,
   `FLUXIQ_TEST_ENV_FILES=none`, target `isolated`, and stale target/instance overrides removed:

   ```powershell
   node packages/test-runner/dist/cli.js run everything-store --target isolated --live-llm --llm-profile mvp-hard-scenario --llm-provider deepseek --llm-task create-flow --instruction-task everything-store-plus-earbuds-under-50 --replays 1 --dry-run
   ```

   Result: passed twice while confirming the top-level and nested request fields. Both
   invocations reported zero provider calls. The synthetic credential was removed from the
   process immediately after each invocation and its value was not printed or copied here.

3. Confirmed `packages/test-runner/dist/cli.js` exists, `git check-ignore` identifies it as
   ignored, and scoped `git status` reports no tracked or untracked entry under the generated
   `dist` directory.

The dry-run path stopped before topology creation, so it started no browser, Core process,
scenario server, provider request, run bundle, or live Lab run.

## Files

- Added only this report as a tracked file.
- Restored ignored generated files under `packages/test-runner/dist/` through the package build.
- Did not edit tracked source, shared working documents, Core, or existing reports; did not
  commit or push.
