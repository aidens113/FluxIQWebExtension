# t203 -- Final commit manifest refresh

Status: Complete
Repository scope: `F:\!FluxIQWebExtension` and `F:\!FluxIQ`, both on
`task/t170-mvp-today-integration`
Date: 2026-09-26

## Outcome

This manifest covers the deduplicated union of `git diff --name-only dev` and
`git ls-files --others --exclude-standard` after t202. Before this report was
added, the downstream set was 166 paths: 67 tracked differences and 99
untracked paths. Adding this report makes the final downstream set **167
paths**. Core has **191 paths**: 109 tracked differences and 82 untracked paths.

The predicates below assign every final candidate exactly once, with no
unmatched or multiply assigned path. Directory pathspecs mean every current
candidate beneath that directory, not unchanged files. Recompute once more if
anything changes before staging.

## Downstream repository -- 167 paths

### D1 -- Browser execution and web-domain extraction contract (70 paths)

Commit together:

- `apps/extension/**` -- all 26 current candidates;
- `domain/**` -- all 44 current candidates.

This remains t183's browser/domain atomic boundary and now includes the t189
send/publish integration assertions already under `domain/**`.

### D2 -- Test-facility extraction contract and runner decomposition (52 paths)

Commit together:

- `packages/test-contracts/**` -- all 3 current candidates;
- `packages/test-runner/**` -- all 49 current candidates.

Keep the tracked `packages/test-runner/src/run-scenario.ts` spine and every
replacement module and test beneath `packages/test-runner/src/run-scenario/**`
in this commit.

### D3 -- Downstream authored architecture (4 paths)

Commit exactly:

- `docs/architecture/failure-taxonomy.md`;
- `docs/architecture/sensitive-values.md`;
- `docs/architecture/testing-facility.md`;
- `docs/architecture/web-capabilities.md`.

These include the t187 reconciliation and t198 precision corrections and
should follow the implementation groups whose current behavior they describe.

### D4 -- Working state, authored pre-run record, and worker evidence (41 paths)

Commit together, last in the downstream repository:

- `docs/working/README.md`;
- `docs/working/mvp-today-plan.md`;
- authored no-hindsight Stage-1 record
  `docs/working/language-driven-flow-loop-plan/debugs/pending-mvp-today-run-1.md`;
- the four reports under `docs/working/language-driven-flow-loop-plan/reports/`:
  t165, t166, t168, and t169;
- every report from
  `docs/working/mvp-today-plan/reports/t170-core-integration.md` through
  `docs/working/mvp-today-plan/reports/t203-final-commit-manifest-refresh.md`,
  inclusive -- all 34 numbered reports, with no missing task number.

The pending debug document is authored pre-run input, not a generated run
artifact. It belongs in D4. No file under `test-runs/**` belongs here.

## FluxIQ Core repository -- 191 paths

### C1 -- Flow authoring and name resolution (19 paths)

- `packages/fluxiq/src/programs/automation-studio/nodes/name-match/**`;
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/**`;
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/plan/**`,
  except `plan/risk.ts`, which belongs to C3.

### C2 -- Bootstrap diagnostics and provider resilience (74 paths)

Keep the complete generation-failure replacement, provider refusal, DeepSeek,
evidence-loop, provider-retry, harness, and harness-options work together as in
t183. The deletion and replacement paths are inseparable:

- deleted
  `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure.ts`;
- renamed
  `runtime/flow-bootstrap/tests/generation-failure.test.ts` to
  `runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts`;
- every new path under
  `runtime/flow-bootstrap/generation-failure/**`;
- `runtime/flow-bootstrap/{evidence-loop-steps.ts,index.ts}` and the owned
  evidence-loop-steps test;
- `runtime/provider-refusal/**`;
- `runtime/llm/{deepseek,evidence-loop,provider-retry,harness,harness-options}/**`,
  plus the t183-listed direct LLM files/tests and
  `runtime/tests/deepseek-recovery-requests.test.ts`.

Paths without the full prefix above are relative to
`packages/fluxiq/src/programs/automation-studio/`.

### C3 -- Defensive execution and risk-only grants (50 paths)

Use t183's complete C3 path set:

- `packages/fluxiq/src/programs/_shared/runtime.ts`;
- `packages/fluxiq/src/programs/automation-studio/api/**`;
- `runtime/action-permissions/**` and `runtime/executor/**`;
- `runtime/flow-bootstrap/action-permissions.ts` and
  `runtime/flow-bootstrap/plan/risk.ts`;
- `runtime/llm/execution/**`, `runtime/llm/grant-capabilities.ts`, and
  `runtime/llm/runtime-session-grant.ts`;
- `runtime/llm/tests/execution-grant/**`,
  `runtime/llm/tests/verify-result-grant.test.ts`, and
  `runtime/tests/service-bootstrap/**`.

This includes t189's final three-class high-risk seam and tests. Coordinate
this Core commit with downstream D1 so the domain assertions never describe a
different permission boundary.

### C4 -- Judge directives, repair context, and service projection (43 paths)

- `runtime/recovery/**`;
- `runtime/result-verification/**`;
- `runtime/service.ts` and `runtime/service/**`;
- `runtime/tests/refuted-result/**`;
- `runtime/tests/service-adaptation/**`;
- `runtime/tests/service-flows/**`.

### C5 -- Structure baseline after the complete Core source tree (1 path)

- `.structure-baseline.json`.

Commit this only after C1-C4 and verify it against their combined tree.

### C6 -- Core architecture and public release metadata (4 paths)

Commit together, after C1-C5:

- `docs/architecture/automation-studio.md`;
- `docs/architecture/automation-studio/llm-flow-bootstrap.md`;
- `docs/architecture/package-boundaries.md`;
- `packages/fluxiq/package.json`.

This group keeps the reconciled current architecture, final three-class
high-risk wording, 0.7.0 migration entry, and `fluxiq` 0.7.0 package identity
in one release-metadata commit. `pnpm-lock.yaml` is unchanged and excluded.

## Current staging state and execution rule

The downstream index is empty. The Core index is not empty: before this audit,
it already contained the deletion of `generation-failure.ts` and the rename of
`flow-bootstrap/tests/generation-failure.test.ts` to
`generation-failure/tests/diagnostics.test.ts`. Both belong to C2, but the rest
of C2 is not staged yet. Do not commit that partial index.

When the supervisor executes this manifest, use deletion-aware staging for one
group at a time and inspect `git diff --cached --name-status` before each
commit. For C2, stage the complete group so the deletion, rename, replacement
directory, provider contracts, and tests land together. This report did not
stage or unstage anything.

## Explicit exclusions

Exclude every generated, runtime, sensitive, or machine-local path, including:

- `.fluxiq/**`, `node_modules/**`, `.env*`, credentials, and local storage;
- Core `packages/*/dist/**` and `apps/web/.next/**` generated by t197;
- downstream `domain/dist/**`, `apps/extension/dist/**`,
  `apps/extension/build/**`, `apps/scenario-lab/dist/**`, and package `dist/**`;
- `domain/.test-build/**`, `domain/.script-build/**`, and labelled test output;
- `test-runs/**`, browser profiles, Playwright/coverage output, screenshots,
  videos, HAR files, logs, archives, and temporary files;
- recorded page data and any provider/browser/Lab runtime artifact.

The ignored build outputs remain available for the live command but are not
release candidates.

## Coverage checks

- Downstream: D1 70 + D2 52 + D3 4 + D4 41 = **167**, with zero unmatched and
  zero multiply assigned paths after adding this report.
- Core: C1 19 + C2 74 + C3 50 + C4 43 + C5 1 + C6 4 = **191**, with zero
  unmatched and zero multiply assigned paths.
- Both repositories remain on `task/t170-mvp-today-integration`.
- No run artifact was opened or read. No staging mutation, source/shared-doc
  edit, build, commit, browser, provider call, or Lab action was performed.
