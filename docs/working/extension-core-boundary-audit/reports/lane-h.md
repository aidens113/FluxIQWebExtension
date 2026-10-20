# Lane H (t727 guards-and-tooling): report and progress log

Lane lead report for brief `lane-h` in `docs/working/trace-offline-trials-plan.md` (audit phases 0 and 5 of
[the boundary audit](../../extension-core-boundary-audit.md)). Worktrees:
`C:/Users/osrs_/FluxStuff/fxwork/t727/!FluxIQWebExtension` and `.../t727/!FluxIQ`, both on
`task/t727-guards-and-tooling`.

## Plan

Phase 0 (audit findings 9-12, "To verify"), four file-partitioned workers in parallel:

- **H1 provider rule** (Core first, then mirror). A new generic structure-audit rule in Core
  `scripts/structure-audit/rules/` driven by a config key that is empty (inert) in Core. Downstream config lists
  provider hosts, provider SDK specifiers and provider key names, with an explicit allowlist of the Lab's
  Core-driving code. Rule file and its test copied byte-identically downstream. Owns both repos'
  `scripts/structure-audit/rules/<new>*` and `config.mjs`.
- **H2 drift check**. `scripts/check/core-mirror*` downstream: a declared list of mirror sets (the structure audit
  first) compared with the sibling Core's copy after line-ending normalisation; fails on any differing or
  one-sided file. Wired into `pnpm check` right after the Core build gate. Owns `scripts/check/core-mirror*` and
  root `package.json`.
- **H3 cleanup**. Prove no caller, then delete `packages/agent-orchestrator` and
  `domain/src/runtime/reusable-evidence-coordinator.ts` (with test and barrel line); lockfile; build-cache step
  entry; the doc lines naming them. One provider key list; the stale "$0.10" comment. Owns those files.
- **H4 trace**. The three "To verify" suspicions, read-only except `packages/test-matrix/**` if its CI jobs open a
  browser on synthetic scenarios.

The lead then lowers `.structure-baseline.json`, runs both structure audits, the planted-violation proofs and the
narrow tests, and marks phase 0 ready.

Phase 5 (finding 5), after phase 0: Core exports its build-cache engine and the shared task rules (id allocation,
id refs, branch naming, git runner) as importable modules; downstream `scripts/build-cache` and `scripts/task`
import them and keep only repository config; the drift check covers any copy left; `pnpm task` stays
CLI-compatible.

## Progress log

### 2026-10-19 - Phase 0 landed (H1-H4, lead verification)

What changed:

- **Provider rule (finding 12).** New Core rule `restricted-references` (`scripts/structure-audit/rules/` plus test),
  config-driven and inert in Core (`restrictedReferences: []`), documented in Core
  `docs/architecture/code-structure.md`; copied byte-identically downstream. Downstream `config.mjs` lists provider
  hosts, SDK specifiers (code and every package.json) and key names, with 19 exact allowed files, all Lab key
  handling or its tests; none in `apps/extension` or `domain/src`. The lead made the key-name pattern derive from
  `scripts/provider-secret-environment.mjs` so the config does not restate the list. The worker also edited Core
  `AGENTS.md`; the lead reverted that (agent-instruction file, supervisor's call) - suggested text is in
  `lane-h-h1.md`.
- **Mirror drift check (finding 5, structure audit first).** `scripts/check/core-mirror.mjs` and
  `scripts/check/core-mirror/` (sets declared in `mirrors.mjs`; CRLF-normalised; `config.mjs` excluded); runs in
  `pnpm check` right after the Core build gate; `pnpm check:mirror`.
- **Cleanup (findings 9-11).** Deleted `packages/agent-orchestrator/**` and
  `domain/src/runtime/reusable-evidence-coordinator.ts` with its test and barrel line (no caller in either repo,
  evidence in `lane-h-h3.md`); its build-cache step, root script, lockfile importer and doc lines
  (`README.md`, `docs/architecture/testing-facility.md`) removed; `.structure-baseline.json` lowered (3 entries
  removed). One provider key list: `scripts/provider-secret-environment.mjs`; `packages/test-runner/src/environment.ts`
  loads it at run time and re-exports it. Stale "$0.10" comment in `packages/test-contracts/src/llm.ts` fixed.
- **Three suspicions traced** (`lane-h-h4.md`): core-web-build duplicates Core's `web:build` (needed today because of
  a Core identity-stamp defect and no Core publication seam; Core first, then delete ~700 lines downstream);
  `scripts/lab/core/build/` judges Core staleness by mtime (confirmed; swap to Core's exported `decideStep`, not my
  files); `packages/test-matrix` selected synthetic scenarios for browser jobs (confirmed, fixed: selects only the
  ten realistic scenarios). Still opening synthetic pages, not lane H's files: the workflow's scenario-page step
  and `apps/scenario-lab/e2e` Playwright specs.

Checks run by the lead (observed):

- `node scripts/structure-audit.mjs --update` -> `baseline written: 635 entries across 9 rules (0 lowered, 3 removed)`
- EXT `node scripts/structure-audit.mjs` -> `passed (213 warning(s), 635 baselined)`; Core -> `passed (408 warning(s), 1152 baselined)`
- `node scripts/check/core-mirror.mjs` -> `1 mirror set(s) match FluxIQ Core ... structure-audit (58 files)`
- EXT `node --test` rule test + core-mirror tests -> `pass 21, fail 0`; Core rule test -> `pass 15, fail 0`
- Planted `apps/extension/src/planted-provider.ts` with `fetch("https://api.deepseek.com/chat/completions")` ->
  `FAIL [restricted-references] apps/extension/src/planted-provider.ts:1: contains the string "https://api.deepseek.com/chat/completions"`, exit 1;
  removed -> `passed`
- One space appended to `scripts/structure-audit/rules/naming.mjs` -> `[structure-audit] scripts/structure-audit/rules/naming.mjs differs between this repository and Core`, exit 1; restored -> exit 0
- `pnpm --filter @fluxiq-web-extension/test-matrix test` -> `pass 23, fail 0`; test-runner `check` (tsc) -> clean;
  test-runner build then `node --test` environment, provider-absence, process-supervisor -> `pass 23, fail 0`;
  domain `check` -> clean

UNIT READY: EXT `package.json`, `pnpm-lock.yaml`, `.structure-baseline.json`, `README.md`,
`docs/architecture/testing-facility.md`, `scripts/structure-audit/config.mjs`,
`scripts/structure-audit/rules/restricted-references.mjs`, `scripts/structure-audit/rules/tests/restricted-references.test.mjs`,
`scripts/check/core-mirror.mjs`, `scripts/check/core-mirror/**`, `scripts/build-cache/steps.mjs`,
`scripts/provider-secret-environment.mjs`, `packages/agent-orchestrator/**` (deleted),
`domain/src/runtime/index.ts`, `domain/src/runtime/reusable-evidence-coordinator.ts` and its test (deleted),
`packages/test-runner/src/environment.ts`, `packages/test-runner/src/tests/environment.test.ts`,
`packages/test-contracts/src/llm.ts`, `packages/test-matrix/src/**`, reports `lane-h*.md`;
Core `scripts/structure-audit/config.mjs`, `scripts/structure-audit/rules/restricted-references.mjs`,
`scripts/structure-audit/rules/tests/restricted-references.test.mjs`, `docs/architecture/code-structure.md`.

### 2026-10-19 - Phase 5 landed (H5 build-cache, H6 task rules, lead integration)

What changed:

- **Shared loader (lead).** `scripts/core-scripts/` (`coreRootOf`, `importCoreScript`, test): every EXT import of
  Core tooling goes through it; a Core sibling that is missing or predates the module fails with what to do.
  `scripts/worktree/core-sibling.mjs` now takes its path rule from `coreRootOf` (no second copy).
- **Build cache (H5).** Core `scripts/build-cache` takes a repository configuration (`buildCacheFor`,
  `repository/` with `CORE_REPOSITORY`, store namespace `core`); Core's own CLI unchanged. EXT
  `scripts/build-cache` binds Core's engine to its configuration (`core-engine.mjs`, `bound-engine.mjs`,
  `repository.mjs`) and keeps only its registry, resolver, Core-package resolution and esbuild listing; the
  forked engine and its generic tests are deleted (about 2,290 lines out). EXT gains Core's output replay,
  git-visible fingerprinting, stale-only touching, rooted entries and parallel scheduling. CLI, JSON lines,
  `prove-inputs` and the `index.mjs` names consumers use are unchanged.
- **Task rules (H6).** Core `scripts/task` exports the shared rules side-effect free (`allocateTaskId` with a
  `pairedRepositories` option, id refs, branch naming, `runGit`, new `git-answered-no.mjs`, `path-inside.mjs`,
  `path-identity.mjs`). EXT deleted its copies (`task/{task-id,task-id-ref-prefix,record-task-id,branch-name}.mjs`,
  `worktree/{git-command,path-identity}.mjs` and their tests) and loads Core's; `worktree/index.mjs` still exports
  the same names for the Lab callers. New CLI-pinning tests (`task/tests/start.test.mjs`, `command-line.test.mjs`)
  also pass against the old scripts.
- **Lead fixes.** `scripts/build-cache/tests/check-prefix.test.mjs` pinned the old `pnpm check` prefix and failed
  since phase 0 added the mirror gate (a phase-0 miss, now fixed); `scripts/core-scripts/tests` added to the
  `task:test` and `check` globs; `scripts/lab/prelude/tests/build-phase.test.mjs` fixture made a git checkout
  (Core's engine runs uncached where git cannot list files); `docs/architecture/repository-layout.md` says Core
  owns the engine and the task rules.
- **No mirror left** besides the structure audit: H5 and H6 each report no byte-identical copy, so
  `core-mirror/mirrors.mjs` is unchanged.

Merge order (supervisor): EXT now needs a Core with this change beside it. Merge Core's t727 into Core `dev` first
(its side is additive for `scripts/task`; `scripts/build-cache` keeps Core's CLI), update the main checkout's Core
and the shared `fxwork/!FluxIQ` / `fxlab` Cores, then merge EXT; lanes with their own Core branch (t726, t728)
merge Core `dev` into it when they next merge EXT `dev`. Until then they get the "Core predates" message, never a
wrong id or a corrupted store.

Decisions and items for the supervisor:

- Host-identity inventories (`domain/scripts/host-build-identity/inventory.mjs`, test-runner `host-identity/inventory.ts`)
  hash EXT `scripts/build-cache/*.mjs`; the engine is now in Core, so an engine change no longer moves that
  identity. Left as is: the receipt detects a stale host bundle, and the engine does not change bundle content.
- Core `AGENTS.md` still says to keep `task-id.mjs`/`record-task-id.mjs` "in step on both sides" (line 287), and
  phase 0's worker had proposed a `restricted-references` sentence there; both are the supervisor's call.

Checks run by the lead (observed):

- EXT `node --test` over every `check` glob (structure-audit, lab, task, worktree, core-scripts, build-cache,
  check) -> `pass 664, fail 0`
- EXT `node scripts/structure-audit.mjs` -> `passed (213 warning(s), 635 baselined)`; `node scripts/check/core-mirror.mjs`
  -> `1 mirror set(s) match ... structure-audit (58 files)`; `node scripts/build-cache/prove-inputs.mjs` ->
  `inputs proved complete for 31 listing(s)`; `node scripts/task/run-task.mjs list` -> exit 0
- Core `node --test` task, build-cache, structure-audit and `scripts/tests` -> `pass 394, fail 0`; Core
  `node scripts/structure-audit.mjs` -> `passed (409 warning(s), 1152 baselined)`
- Real package checks through the new engine: `pnpm --filter @fluxiq-web-extension/<pkg> check` for domain,
  test-runner (with `domain:build`), extension and test-contracts -> each `"build-cache":"build"` with reason
  `inputs changed: core:scripts/build-cache, ...` (Core's engine is fingerprinted), exit 0; domain again ->
  `"reuse" ... "inputs and outputs match the stamp"`

UNIT READY: EXT `package.json`, `docs/architecture/repository-layout.md`, `scripts/core-scripts/**`,
`scripts/build-cache/**`, `scripts/task/**`, `scripts/worktree/**`, `scripts/lab/prelude/tests/build-phase.test.mjs`,
reports `lane-h.md`, `lane-h-h5.md`, `lane-h-h6.md`; Core `scripts/build-cache/**`, `scripts/task/**`.

### 2026-10-19 - Core build staleness asked of Core's build cache (supervisor addition 1; lead, no worker)

The concurrent-subagent limit was reached (other lanes' workers), so the lead did this one directly.

What changed: new `scripts/lab/core/build/currency.mjs` (`coreBuildCurrency`): for each Core library build step
(`contracts:build`, `fluxiq:build`, `client-gateway-websocket:build`, from `CORE_PACKAGES`) it asks
`decideStep` from the exact Core checkout's `scripts/build-cache/index.mjs` (as the build lease loads Core's
locks), with `FLUXIQ_BUILD_FORCE` removed from the environment; any `build` decision is stale, reported with the
step and Core's own reason. `scripts/check/core-build/freshness.mjs` (the `pnpm check` / package gate) and
`scripts/lab/run-lab.mjs` (the Lab's refusal, `FLUXIQ_LAB_ALLOW_STALE_CORE=1` override kept) switched to it;
`stale.mjs` (`coreBuildStaleness`) and `scanCoreSources` deleted with their tests; `staleness.mjs` keeps only
`scanNewest`, which this repository's own builds still use (`domain-build-staleness.mjs`). "Never built"
(`unbuilt.mjs`) and "changing under a run" (`watch.mjs`) are unchanged. Comments in `unbuilt.mjs` and
`worktree/shared-core-move.mjs` updated.

Downstream readers of Core's `dist` by modification time that remain: only `watch.mjs` (quiescence during a run).
Core's `touch-stale-outputs.mjs` existed for the staleness comparison this removes; a Core follow-up can drop it
once every downstream tree has this change (older lane trees still run the mtime guard against shared Cores).

Checks (observed):

- `node --test "scripts/lab/**/tests/*.test.mjs" "scripts/check/**/tests/*.test.mjs" "scripts/worktree/tests/*.test.mjs"` -> `pass 318, fail 0`
- Real probe `node scripts/check/core-build.mjs` -> `not current ... Core's build cache would rebuild contracts:build: inputs changed: scripts/build-cache` (and the other two), exit 1: true, the t727 Core libraries were stamped before phase 5 changed Core's engine, an input of every step; the old mtime guard had reported this Core "current". After `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` in the t727 Core (three builds, `inputs changed: scripts/build-cache`) -> `core-build: ... is current with its source.`, exit 0, twice
- `node scripts/structure-audit.mjs` -> passed; `--update` -> `1 removed` (freshness test packing entry)

Consequence for integration: every Core that takes phase 5 rebuilds its three libraries once (their stamps name
the old engine); the gate says so by step and reason.

UNIT READY: EXT `scripts/lab/core/build/**` (`currency.mjs`, `tests/currency.test.mjs`, `tests/staleness.test.mjs`
new; `stale.mjs`, `tests/stale.test.mjs` deleted; `index.mjs`, `staleness.mjs`, `unbuilt.mjs`,
`tests/unbuilt.test.mjs`), `scripts/check/core-build/freshness.mjs`, `scripts/check/core-build/tests/freshness.test.mjs`,
`scripts/lab/run-lab.mjs`, `scripts/worktree/shared-core-move.mjs`, `.structure-baseline.json`, `lane-h.md`.
