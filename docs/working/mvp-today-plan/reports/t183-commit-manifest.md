# t183 — Exact commit manifest

Repository scope: the complete tracked/deleted/renamed/untracked diff against `dev`
in `F:\!FluxIQWebExtension` and `F:\!FluxIQ`, both on
`task/t170-mvp-today-integration`. Read-only inventory except this report; no source,
shared-document, index, build, Lab, commit, or push mutation.

## Outcome

Use the responsibility groups below as the commit manifest after all concurrent work
has stopped. Before this report was created, the downstream candidate set was exactly
141 paths and the Core candidate set exactly 187 paths, where a candidate is the
deduplicated union of `git diff --name-only dev` and
`git ls-files --others --exclude-standard`. This report adds one downstream path, so
the manifest total is **142 downstream paths plus 187 Core paths**.

The groups are non-overlapping and cover every candidate exactly once. Directory
pathspecs below mean every changed, deleted, renamed, or untracked path currently
reported beneath that directory, not every unchanged tracked file. Use deletion-aware
staging (`git add -A -- <pathspecs>`) when the supervisor executes the manifest; this
report does not stage anything.

## Downstream repository — 142 paths

### D1 — Browser execution and web-domain extraction contract (70 paths)

Keep the browser implementation and its domain wire/runtime contract in one commit:

- `apps/extension/**` — all 26 current candidates, including content-action recovery,
  extraction behavior, shared continuation data, E2E assertions, and owned tests.
- `domain/**` — all 44 current candidates, including extraction requests/summaries,
  failure classification, output-node mappings, LLM evidence/name assumptions,
  resolution logic, barrels, and owned tests.

This grouping prevents the extension from landing separately from the failure codes,
extraction shapes, native-runtime mappings, and tests it consumes.

### D2 — Test-facility extraction contract and runner decomposition (52 paths)

Commit these package trees together:

- `packages/test-contracts/**` — all 3 current candidates.
- `packages/test-runner/**` — all 49 current candidates, including the complete
  `run-scenario/**` replacement modules, their barrels/tests, extraction-read lane
  wiring, runner evaluation wiring, and the t181 authored-node assertion updates.

The test-contract extraction shape must not be separated from its runner consumer and
tests. The existing `packages/test-runner/src/run-scenario.ts` spine and every new file
under `packages/test-runner/src/run-scenario/**` belong to the same commit.

### D3 — Working state and worker evidence (20 paths, including this report)

Commit exactly these authored working-document paths together after the supervisor has
applied any final reconciliation:

- `docs/working/README.md`
- `docs/working/mvp-today-plan.md`
- `docs/working/language-driven-flow-loop-plan/reports/t165-every-node-is-defensive-by-default.md`
- `docs/working/language-driven-flow-loop-plan/reports/t166-grants-gate-only-risk.md`
- `docs/working/language-driven-flow-loop-plan/reports/t168-a-provider-fault-is-retried.md`
- `docs/working/language-driven-flow-loop-plan/reports/t169-only-delete-and-money-are-asked-about.md`
- `docs/working/mvp-today-plan/reports/t170-core-integration.md`
- `docs/working/mvp-today-plan/reports/t171-web-integration.md`
- `docs/working/mvp-today-plan/reports/t172-lab-readiness.md`
- `docs/working/mvp-today-plan/reports/t173-cross-repository-review.md`
- `docs/working/mvp-today-plan/reports/t174-remaining-grant-gates.md`
- `docs/working/mvp-today-plan/reports/t175-rerun-seed-regression.md`
- `docs/working/mvp-today-plan/reports/t176-auto-repair-assertions.md`
- `docs/working/mvp-today-plan/reports/t177-domain-extraction-regressions.md`
- `docs/working/mvp-today-plan/reports/t178-live-run-preflight.md`
- `docs/working/mvp-today-plan/reports/t179-release-inventory.md`
- `docs/working/mvp-today-plan/reports/t180-documentation-reconciliation.md`
- `docs/working/mvp-today-plan/reports/t181-runner-authored-node-assertions.md`
- `docs/working/mvp-today-plan/reports/t183-commit-manifest.md`
- `docs/working/mvp-today-plan/reports/t184-runner-build-readiness.md`

`t182-authored-documentation-impact.md` was not present in the working tree at this
snapshot and is therefore not silently included. If it lands before staging, add that
exact report to D3 and refresh the D3/total counts.

## FluxIQ Core repository — 187 paths

### C1 — Flow authoring and name resolution (19 paths)

- `packages/fluxiq/src/programs/automation-studio/nodes/name-match/**`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/**`
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/plan/**`
  except `plan/risk.ts`, which belongs to C3.

These pathspecs include the new synonym/token-credit implementation and tests, plan
catalog/evidence/parameter vocabulary and tests, and draft-entry behavior/tests.

### C2 — Bootstrap diagnostics and provider resilience (74 paths)

Treat the generation-failure split as one atomic delete/rename/add operation. Include:

- deleted `runtime/flow-bootstrap/generation-failure.ts`;
- the complete replacement `runtime/flow-bootstrap/generation-failure/**`, including
  `generation-failure/tests/diagnostics.test.ts` (the renamed former
  `runtime/flow-bootstrap/tests/generation-failure.test.ts`) and new owned tests;
- `runtime/flow-bootstrap/evidence-loop-steps.ts`,
  `runtime/flow-bootstrap/tests/evidence-loop-steps.test.ts`, and
  `runtime/flow-bootstrap/index.ts`;
- `runtime/provider-refusal/**`;
- `runtime/llm/deepseek/**`;
- both `runtime/llm/evidence-loop.ts` and `runtime/llm/evidence-loop/**`;
- `runtime/llm/provider-retry/**`, `runtime/llm/harness/**`, and
  `runtime/llm/harness-options/**`;
- `runtime/llm/provider-contract.ts`, `loop-configuration.ts`,
  `diagnosis-instructions.ts`, `draft-amendment-feedback.ts`, and `index.ts`;
- `runtime/llm/tests/draft-amendment-feedback.test.ts`,
  `evidence-loop-draft-shown.test.ts`, and `harness.test.ts`;
- `runtime/tests/deepseek-recovery-requests.test.ts`.

All paths above are relative to
`packages/fluxiq/src/programs/automation-studio/` unless already shown from `runtime/`.
Do not commit the tracked deletion or renamed test without the replacement directory.

### C3 — Defensive execution and risk-only grants (50 paths)

Include these complete contract-and-test sets:

- `packages/fluxiq/src/programs/_shared/runtime.ts`;
- `packages/fluxiq/src/programs/automation-studio/api/**`;
- `runtime/action-permissions/**` and `runtime/executor/**`;
- `runtime/flow-bootstrap/action-permissions.ts` and
  `runtime/flow-bootstrap/plan/risk.ts`;
- `runtime/llm/execution/**`, `runtime/llm/grant-capabilities.ts`, and
  `runtime/llm/runtime-session-grant.ts`;
- `runtime/llm/tests/execution-grant/**` and
  `runtime/llm/tests/verify-result-grant.test.ts`;
- `runtime/tests/service-bootstrap/**`.

The API contract/handler assertions, retry allowance, grant metadata, permission rules,
defensive executor and their tests stay together in this group.

### C4 — Judge directives, repair context, and service projection (43 paths)

- `runtime/recovery/**`
- `runtime/result-verification/**`
- `runtime/service.ts` and `runtime/service/**`
- `runtime/tests/refuted-result/**`
- `runtime/tests/service-adaptation/**`
- `runtime/tests/service-flows/**`

This keeps the structured repair directive with its verdict/run-outcome projection,
recovery consumer, service summaries/evidence trace, rerun seeding, automatic repair
assertions, and owned tests.

### C5 — Structure baseline after the complete Core tree (1 path)

- `.structure-baseline.json`

This baseline records reductions spanning `generation-failure.ts`, grant execution and
`runtime/service.ts`, so it follows C1–C4 and must be validated against their combined
tree. It must not be used to hide a new violation or committed without the refactors
whose removed entries it records.

## Explicit exclusions

No current candidate falls under these paths/forms, and none belongs in any proposed
commit:

- either repository's `.fluxiq/**` or `node_modules/**`;
- `apps/extension/dist/**`, `apps/extension/build/**`,
  `domain/.test-build/**`, or `domain/.script-build/**`;
- `test-runs/**`, browser profiles, Playwright/coverage reports, screenshots, video,
  HAR files, process logs, temporary files, archives, or `.env` files;
- any generated build output or runtime/recorded page data that appears after this
  snapshot.

## Coverage and execution checks

- Downstream predicate coverage before this report: D1 70 + D2 52 + D3 19 = 141,
  with zero unmatched and zero multiply assigned paths. Adding this report makes D3 20
  and the downstream total 142.
- Core predicate coverage: C1 19 + C2 74 + C3 50 + C4 43 + C5 1 = 187, with zero
  unmatched and zero multiply assigned paths.
- No staging/index command was run. Before executing the manifest, recompute the two
  candidate unions after all workers stop. Any new path must be assigned explicitly;
  do not rely on a blanket repository-wide add.
- After staging each repository, compare `git diff --cached --name-status` with the
  refreshed candidate union and confirm there is no remaining intended status entry,
  especially the generation-failure deletion/replacement pair.

## Files changed

- Added only `docs/working/mvp-today-plan/reports/t183-commit-manifest.md`.
