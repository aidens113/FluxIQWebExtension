Outcome: Done
Changed: docs/working/framework-heavy-lifting-plan/reports/codex-1030/sweep-cache-cli-result.md
Validation: not run (read-only discovery; brief prohibited checks)
Not verified: no commands/tests were run; no changes were made to product or campaign sources.
Report: docs/working/framework-heavy-lifting-plan/reports/codex-1030/sweep-cache-cli-result.md
Notes: Product's build and check scripts both lack registered cache steps; the registry test first surfaces build. The campaign failures are stale expected strings only.

## Findings

- The log's first failure is `scripts/build-cache/tests/registry.test.mjs:92`: `apps/product` has an unregistered build step. The same test loops over both `build` and `check`, so product check also needs registration/wrapping or will fail next.
- Minimal product paths: `apps/product/package.json` and `scripts/build-cache/steps.mjs`.
- Add `product:build` with command `node scripts/build-host.mjs`, `generated: ["dist"]`, output `dist/host`, required output `dist/host/platform.mjs`, and `env: ["NODE_ENV"]`. This matches `apps/product/package.json`'s `fluxiqHostModule` (`./dist/host/platform.mjs`) and `scripts/build-host.mjs`'s esbuild output.
- Add `product:check` using the cache's `checkProject("tsconfig.json", "check")`, `generated: ["dist"]`, `tsconfigs: ["tsconfig.json"]`, and `env: ["NODE_ENV"]`.
- Wrap package build/check scripts with `node ../../scripts/build-cache/cli.mjs product:build -- "node scripts/build-host.mjs"` and analogous check command, while preserving the existing leading `node ../../scripts/check/core-build.mjs &&` prerequisite. Do not register the Core-build guard as part of the cache command.
- Leave product `bundles` unset: current downstream `bundle-listings.mjs` and registry bundle assertions are specifically wired to the extension's `build-extension.mjs` entries. Product's own package files and linked Core dependency are already fingerprint roots; broadening bundling proof is outside these three failures.
- `scripts/lab/provider/defaults.mjs` currently defaults to Anthropic / `claude-sonnet-5-5`. In `scripts/lab/live-campaign/tests/command-line.test.mjs`, the two dry-run tests at lines 59 and 92 hard-code the former DeepSeek strings. The log's actual output exactly matches current defaults. Update only those expected strings; no production CLI change indicated.
- Narrow acceptance commands after edits: `node --test scripts/build-cache/tests/registry.test.mjs`; `pnpm --filter @fluxiq-web-extension/product check`; `pnpm --filter @fluxiq-web-extension/product build`; `node --test scripts/lab/live-campaign/tests/command-line.test.mjs`. Campaign tests use stub catalog/Lab and assert no invocations for dry runs; they do not require provider calls.