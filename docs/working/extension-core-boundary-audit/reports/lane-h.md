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
