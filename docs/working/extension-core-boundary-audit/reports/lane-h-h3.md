# Lane H, brief H3 (t727): report

## Outcome

Done. All three items are complete. Tree: `C:/Users/osrs_/FluxStuff/fxwork/t727/!FluxIQWebExtension`. No commits.

## What changed and why

### 1. Removed dead code

Evidence that nothing calls it (git grep in EXT, excluding docs/working, and in Core at `fxwork/t727/!FluxIQ`):

- `git grep -n -i "agent-orchestrator\|agent_orchestrator\|agentOrchestrator"` in EXT, run outside the package and the lockfile, found only these:
  - `.structure-baseline.json:125` (the lead lowers it)
  - `docs/architecture/testing-facility.md:287,3178,3383`
  - `package.json:8` (the `agent:orchestrator` script, which the lead removes)
  - `scripts/build-cache/steps.mjs:176`

  Core: no matches. There are no tsconfig references and no workflow references. `pnpm-workspace.yaml` picks up `packages/*` by glob.
- `reusable-evidence-coordinator`: the only references were `domain/src/runtime/index.ts:11` and two `.structure-baseline.json` lines. I grepped each of its 8 exports by word in both trees, excluding the file and its test: `CompletedWebReusableEvidenceOutcome`, `WebReusableEvidenceReviewerState`, `WebReusableEvidenceValidationState`, `WebReusableLlmContextPutRequest`, `WebReusableEvidenceWritePort`, `CompletedWebReusableEvidenceInput`, `mapCompletedWebReusableEvidenceToPutRequest` and `writeCompletedWebReusableEvidence`. Every one returned zero matches.

Changes:
- `git rm -r packages/agent-orchestrator` removed 14 tracked files. I then deleted the leftover ignored `dist/` and `node_modules/` with `cmd /c rmdir /s /q`, which does not follow pnpm junctions; `test-contracts` and the typescript store were confirmed intact afterwards.
- Deleted `domain/src/runtime/reusable-evidence-coordinator.ts` and `domain/src/runtime/tests/reusable-evidence-coordinator.test.ts`, and removed their barrel line from `domain/src/runtime/index.ts`.
- `scripts/build-cache/steps.mjs`: removed the `library("agent-orchestrator", ...)` line.
- `pnpm-lock.yaml`: the `--offline` run failed (`ERR_PNPM_NO_OFFLINE_META` for `@types/chrome`), so I ran `pnpm install --lockfile-only` online. The diff is 13 deletions, and they are exactly the `packages/agent-orchestrator:` importer block.
- Docs:
  - `docs/architecture/testing-facility.md`: removed the ownership table row, the "bounded-agent workflow contracts" phrase from the intro, the whole "## Bounded agent workflow" section, the `pnpm --dir packages/agent-orchestrator test` line, the two `pnpm agent:orchestrator ...` command lines (around line 3322, which the brief did not list), and the sentence describing those commands.
  - `repository-layout.md` does not mention the package.
  - `README.md` (not in the brief, but an authored doc naming the removed script): removed `pnpm agent:orchestrator` from the root-tools sentence, and removed the "automatic-agent" limits pointer because the section it pointed to is gone.

### 2. One provider key list

`scripts/provider-secret-environment.mjs` is now the only definition. I added a header comment saying so.

`packages/test-runner/src/environment.ts` no longer restates the list. It loads the .mjs at run time with a top-level `await import(new URL("../../../scripts/provider-secret-environment.mjs", import.meta.url).href)`, which resolves from `dist/` (and `src/`). It checks the shape and throws a clear error if the exports are missing. It re-exports `PROVIDER_SECRET_ENVIRONMENT_VARIABLES` (now typed `readonly string[]`, the same frozen array) and `withoutProviderSecrets` (which delegates to the source), so existing callers are unchanged. No new export was added.

Why I did not use the suggested `.d.mts` plus static import: tsc would pull `scripts/provider-secret-environment.d.mts` into test-runner's program. That file is outside every build-cache input root (`scripts/build-cache/workspace/resolve-step.mjs`): the roots are the package, its dependencies, Core, the root lock and config files, and `scripts/build-cache`. Two problems follow:
- `build-cache:prove` would fail.
- An edit to the declaration would not invalidate the cached `test-runner:check`.

A URL specifier keeps tsc out of the file, which follows the existing `webPanelHostModulePath` precedent of reading `../../../domain/package.json`. Root scripts stay build-free. The trade-off is that the list's literal tuple type is lost; no caller used it.

New test in `packages/test-runner/src/tests/environment.test.ts`, "takes the provider key list and its filter from the one root-script source". It checks that:
- the exported array is the same object (`assert.equal`) as the .mjs export, and it is frozen;
- the filter output matches the source filter;
- compiled `environment.js` contains no key literals.

### 3. Stale comment

Core value, from grep in `fxwork/t727/!FluxIQ`: `packages/fluxiq/src/programs/automation-studio/model/run-cost-ceiling/run-cost-ceiling-env.ts:5: export const AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_DEFAULT_USD = 0.25;`

In `packages/test-contracts/src/llm.ts`, "(default $0.10)" now says the default is $0.25, Core's `AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_DEFAULT_USD`. It also notes that $0.10 was the old test default and that Lab tests have run at $0.25 since 2026-10-12.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-runner check` -> `{"build-cache":"build","step":"test-runner:check","reason":"no stamp; stored in the shared store ..."}` with no tsc errors.
- `node ../../scripts/build-cache/cli.mjs test-runner:build` -> built, but "not stamped, because inputs changed while it ran (packages/test-contracts)". Another agent is editing this tree at the same time.
- `node --test dist/tests/environment.test.js dist/tests/process-supervisor.test.js dist/tests/demo-llm-setup-script.test.js` -> `# tests 19 # pass 19 # fail 0`. This includes `ok 5 - takes the provider key list and its filter from the one root-script source`.
- `node --test dist/saved-flow-replay/tests/provider-absence.test.js` -> `# pass 6 # fail 0`.
- `node -e 'import("./dist/index.js")...'` (in test-runner) -> `index loads function`, so the top-level await loads through the package entry.
- `pnpm --filter @fluxiq-web-extension/domain check` -> `domain:check ... stored`, exit 0.
- `pnpm --filter @fluxiq-web-extension/test-contracts check` -> `test-contracts:check ... stored`, exit 0.
- Importing `scripts/build-cache/steps.mjs` -> `19 steps; agent-orchestrator present: false`.
- `node scripts/build-cache/prove-inputs.mjs test-runner:check` -> `ok test-runner:check ... 3347 files, 3156 fingerprinted, 191 under node_modules` and `inputs proved complete`.
- `node --test scripts/build-cache/tests/registry.test.mjs` -> `# pass 9 # fail 0`.
- Root module import of `scripts/provider-secret-environment.mjs` -> 24 keys, and the filter strips `OPENAI_API_KEY`.

## Not verified

- Structure audit: not run. `.structure-baseline.json` still lists the removed files and is the lead's to lower.
- The full test-runner suite and Playwright/ui-e2e paths that import `environment.js` under the top-level await: not run. They are ESM, so this should be fine.
- `prove-inputs` for steps other than `test-runner:check`: not run.
- `.github/workflows/testing-facility.yml`: grep found no orchestrator reference in it, and I did not open it further.

## Open questions or contradictions found

- The brief's suggested `.d.mts` route conflicts with the build-cache coverage proof (see item 2). I chose the runtime URL import instead.
- These uncommitted changes in the tree are not mine (another agent is working concurrently): `package.json` (core-mirror check), `packages/test-matrix/**`, `scripts/structure-audit/config.mjs`, `scripts/structure-audit/rules/restricted-references*`, `scripts/check/core-mirror*`. I did not touch them.
