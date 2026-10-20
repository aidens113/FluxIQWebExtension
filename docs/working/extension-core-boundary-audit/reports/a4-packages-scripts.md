# A4: packages and scripts against the Core boundary

Read-only audit of `packages/*` and `scripts/` on `dev` (2026-10-19), compared against Core at
`C:/Users/osrs_/FluxStuff/!FluxIQ`. No source was edited, built or run.

## Outcome

Nothing under `packages/` or `scripts/` is Core framework or agent logic that clearly has to move. Almost everything
is browser-test or Lab infrastructure and stays. The real problems are three hand-maintained copies of Core
developer tooling. One is a true mirror and is in sync today. The other two (the build cache and the task
lifecycle) are forks that have drifted a lot, and nothing checks either of them. There is also one dead package and
two places where the Lab rebuilds or re-derives knowledge of how Core builds itself.

## Table

| Package or script | Purpose | Class | Core counterpart or mirror state | Proposed owner | Risk |
| --- | --- | --- | --- | --- | --- |
| `packages/agent-orchestrator` | Vendor-neutral task packets, role/path policy, review gate, hash-chained audit log for agent repair work. Invokes nothing. | Generic agent workflow tooling (its roles name "core-repair"/"extension-repair"; it imports only `RunEvaluation`/`CandidateComparison` types from test-contracts) | None in Core. **No consumer**: the only reference is the manual root script `agent:orchestrator`. The repo's own report `agent-git-workflow-plan/reports/orchestrator-gap.md` already found zero imports. | Delete, or leave dormant. Do not promote: no live consumer, and the real workflow is `scripts/task` | Low (dead code still built and tested by `pnpm -r check/test`) |
| `packages/boundary-audit` | Gate that decides whether a package (default `test-contracts`) is eligible to move to Core under the promotion rule. | Repository governance for the test-facility boundary | None in Core (correct: it reads both repos and Core must not depend on this one). Only consumer is the manual root script `boundary:audit`; no CI step runs it. | Stays | Low |
| `packages/real-site-policy` | Fail-closed validator for a future real-site probe policy (exact HTTPS origin, allowlist, operational review). | Web-automation test safety (URLs, origins) | None. No consumer except the manual root script `real-site:policy`; real-site execution is deferred. | Stays | Low |
| `packages/test-contracts` | Schemas and validators for scenarios, runs, evaluations, evidence, bench reports, LLM lab budgets, authored-Flow graph records. | Browser-test facility contracts. Re-exports Core's failure taxonomy rather than copying it (`failure-category.ts`). | `llm.ts` mirrors Core constants by value: `llmModels` = `AUTOMATION_STUDIO_DEEPSEEK_MODELS`, `LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST` = `contextTokens` 1,000,000, `LLM_LAB_MAX_CALLS_PER_RUN` 250 = `AUTOMATION_STUDIO_LLM_RUN_CALL_BACKSTOP`, `LLM_LAB_MAX_ESTIMATED_COST_USD` 10 = `AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_MAX_USD`, `llmActionConsequences` = `AUTOMATION_STUDIO_ACTION_CONSEQUENCES`. **All values match today.** Backstop, cost max and consequences are pinned to Core's exports by `test-runner/src/live-llm/tests/live-llm-plan.test.ts`; the model list is not pinned there by name. | Stays. Optional: Core exports these from `@fluxiq/contracts` so the mirror can become a re-export | Low (doc drift only, see below) |
| `packages/test-evidence` | Evidence capture, redaction, hashing, bundle publication for Lab runs. | Browser-test infrastructure | None in Core | Stays | None |
| `packages/test-matrix` | Maps changed paths to Scenario Lab scenario tags and CI gates; used by `.github/workflows/testing-facility.yml`. | Browser-test CI selection | None | Stays | Low (see suspicion on scenario set) |
| `packages/test-runner` (Lab, about 1,250 TS files) | The Lab: scenario runs, live LLM plans and guards, person simulation, run evaluation, bench, demo workspace, Core panel build for isolated runs. | Browser-test infrastructure. It imports Core only through public subpaths (`fluxiq`, `fluxiq/automation-studio`, `/nodes`, `/action-permissions`). | `core-web-build/` builds **Core's web panel** with `next build` from a staged tsconfig, keyed and cached downstream; Core already has its own `web:build` step. `withoutProviderSecrets` and the provider-key list in `src/environment.ts` duplicate `scripts/provider-secret-environment.mjs` (lists identical today). | Stays, except see `core-web-build` suspicion | Medium for `core-web-build` |
| `scripts/structure-audit.mjs` + `scripts/structure-audit/` | Structure rules and ratchet. | Generic developer tooling, **mirrored from Core by rule** | **In sync.** Entry point identical (only line endings differ in Core's working tree: index LF, worktree CRLF). 55 of 56 shared files identical, no files on one side only. Only `config.mjs` differs, and that is the per-repo config by design (import rules, the `domain`-must-not-import-extension rule). Budgets (`LIMITS`) live in the shared `context.mjs`, so they are identical. **No mechanical check** keeps the mirror in sync. | Core owns; stays mirrored. Add a drift check | Low now, Medium over time |
| `scripts/build-cache/` | Content-fingerprinted step cache, lock, shared store, stamps. | Generic developer tooling, **forked from Core and drifted** | Not a declared mirror; neither side says "keep in step". 10 shared files identical, 30 differ, 11 extension-only, 17 Core-only. Core has since gained: outputs touched only when an input is newer (`touch-stale-outputs.mjs`; the extension still touches on every reuse via `touch-outputs.mjs`), replay of a step's printed output (`output` in stamps and entries), fingerprinting only git-visible files (`git-visible-files.mjs`, uncached run when git cannot list), rooted store entries, bounded parallel scheduling (`schedule-steps.mjs`, `for-each-limited.mjs`), and an unregistered-scripts check. The extension has: Core-package resolution (`core-packages.mjs`, `resolve-core-library.mjs`), `build-order.mjs`, its own input listing/exclusions. The shared on-disk store is kept safe by design: Core writes under `<store>/core`, the extension at the top, and pruning only touches `v1/` and `tmp/` of each. `steps.mjs` and `resolve-step.mjs` differ because they are each repo's registry (expected). | Core owns the engine; the extension should consume it (import Core's engine and keep only its step registry and Core-resolution layer), or declare it a mirror and check it | Medium |
| `scripts/task/` (plus `scripts/worktree/git-command.mjs`, `path-identity.mjs`, `progress-note.mjs`) | `pnpm task start/finish/abandon/list/prune`. | Generic developer tooling, **deliberately split, partly duplicated** | No file identical. Core says it owns the branch half and the extension owns the worktree half; `record-task-id.mjs`, `task-id-ref-prefix.mjs` and `task-id.mjs` both say "keep the two in step", but only Core's side says so in `record-task-id`, and no check enforces it. Differences: Core's `finish` runs a contract-test gate (`contract/`), uses `dirtyLines` and progress notes from `task/`; the extension's equivalents live under `scripts/worktree/` (`git-command.mjs` 26 differing lines, extension adds `gitAnsweredNo`; `path-identity.mjs` 24; `progress-note.mjs` 15). Core's `task-id.mjs` adds a canonical-spelling check for a passed `--id` ("t0042" vs "t042"); the extension allocator compares numbers but has no such check, which is safe only because Core checks the id it is handed. | Shared rules (id allocation, id refs, branch naming, git runner) belong in Core and could be imported; worktree and Core-pairing stay here | Medium (id-allocation drift would put two tasks under one number) |
| `scripts/lab/` (live guards, campaign, pair, prelude, `core/` build staleness, commit, lease) | Lab launch, live-run waste guards, spend ledger, Core build freshness and lease. | Browser-test / Lab infrastructure | No Core counterpart for guards and campaigns. `lab/core/build/` decides whether **Core's** `dist` is older than Core's source by scanning mtimes; Core's own build cache already knows this through its stamps, and Core added `touch-stale-outputs.mjs` specifically because "downstream Lab guards read Core's dist by modification time". | Stays; consider a Core-exported "is the build current" query | Low to Medium |
| `scripts/check/core-build*` | Gate that refuses a stale or missing Core build before any downstream build or check. | Downstream build gate | Reuses `lab/core/` (no duplication inside this repo). Same Core-staleness question as above. | Stays | Low |
| `scripts/worktree/` | Worktree creation, shared Core sibling, install, move, removal. | Developer tooling specific to this repo's layout (Core as sibling) | Core's task tooling explicitly leaves the worktree half here. See `scripts/task` row for the three overlapping helpers. | Stays | Low |
| `scripts/*demo-llm*.mjs`, `run-demo-workspace-flow.mjs`, `record-demo-workspace.mjs`, `setup-demo-*.mjs`, `run-fluxiq-web.mjs`, `scripts/run/`, `scripts/demo/` | Thin CLI wrappers that build and call `test-runner` demo-workspace and UI-e2e entries; `run-fluxiq-web.mjs` starts the domain host. | Browser-test / demo infrastructure | None. All referenced from root `package.json` except `provider-secret-environment.mjs` (a shared helper). Most last changed 2026-09-16. | Stays (A1 covers any model calls) | Low |

## Confirmed

1. `packages/agent-orchestrator` has no consumer anywhere in either repository; it is reachable only from the manual
   root script and is kept alive by `pnpm -r check/test`.
2. The structure audit mirror is in sync with Core except `config.mjs`, which is per-repo by design. No check
   enforces the mirror.
3. `scripts/build-cache` is a fork of Core's build cache that has drifted on both sides (30 of 40 shared files
   differ, 11 and 17 one-sided files). Core-only behaviour the extension lacks: stale-only timestamp touching,
   output replay, git-visible-file fingerprinting, rooted entries, parallel scheduling. The shared store directory
   is still safe because the two use separate namespaces.
4. `scripts/task` overlaps Core's `scripts/task` on id allocation, id refs, branch naming and the git runner, with
   "keep in step" comments and no check. Core validates the canonical spelling of a passed id; the extension does
   not.
5. `test-contracts/src/llm.ts` mirrors five Core constants by value; all match today, and four are pinned by a
   test against Core's exports. Its comment says the per-run ceiling defaults to $0.10, but Core's
   `AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_DEFAULT_USD` is 0.25 (0.10 is the test-run default): the comment is out
   of date, the code is not.
6. The provider-secret variable list is duplicated within this repository (`scripts/provider-secret-environment.mjs`
   and `packages/test-runner/src/environment.ts`); the two lists are identical today.

## Suspected

1. `packages/test-runner/src/core-web-build/` re-implements a production build of Core's web panel downstream (staged
   tsconfig, `next.config`, its own cache key and layout version) while Core has its own `web:build` step. It
   encodes Core-internal build layout outside Core. Only one consumer (the Lab), so the promotion rule is not met
   as test infrastructure, but as "how Core builds itself" it arguably belongs in Core. Not traced in depth.
2. `scripts/lab/core/build/` derives Core build staleness from mtimes instead of asking Core's build cache; a Core
   query would remove a cross-repo assumption Core already has to accommodate.
3. `packages/test-matrix` selects synthetic Scenario Lab scenarios (basic-form, dynamic-list and others) for CI
   browser gates, which may conflict with the AGENTS.md rule that browser test runs use only the ten realistic
   scenarios. Not checked whether those CI jobs open a browser.

## Summary

Keep the packages where they are, apart from deleting `agent-orchestrator`, which does nothing. The work worth
doing is on developer tooling. Core should own the build-cache engine and the shared parts of the task lifecycle,
and this repository should use them rather than keep a fork. Each declared mirror (the structure audit, the task-id
rules and the `llm.ts` constants) should get a check that fails when it drifts. The structure-audit mirror is
correct today. The build cache is not: it lacks several fixes Core made after the fork.

## Commands run and observed results

- `ls`, `find`, `head`, `grep` over `packages/*` and `scripts/` to read READMEs, headers and entry points.
- Consumer search for each package across `apps`, `domain`, `packages`, `scripts`, `package.json` and
  `.github/workflows` (agent-orchestrator, boundary-audit and real-site-policy: root `package.json` only).
- `diff --strip-trailing-cr` of every same-named file in `scripts/structure-audit*`, `scripts/build-cache`,
  `scripts/task` against Core's copy (counts above), plus `comm` for one-sided files. A first diff without
  `--strip-trailing-cr` reported every file different; `git ls-files --eol` showed Core's working tree is CRLF
  with LF in the index, so that difference was line endings only.
- Grep of Core for the constants mirrored in `llm.ts` and comparison of values.

## Not verified

- No build, test or structure audit was run (read-only brief).
- `test-runner` was skimmed by directory and header, not read file by file; `core-web-build` and the demo wrappers
  were not traced end to end.
- Whether `test-matrix`-selected CI jobs open a browser on synthetic scenarios.
- Model calls inside `test-runner/live-llm` and the demo scripts (A1's scope).

## Open questions or contradictions found

- AGENTS.md calls only `structure-audit.mjs` a mirror, but `build-cache` and `task` are also partial copies of Core
  with no stated policy. Is each a mirror (checked), a fork (owned here), or a consumer of Core?
- `llm.ts` cost-ceiling comment ($0.10 default) contradicts Core's current default ($0.25).
