# Candidate recovery feedback C — t452

Status: Complete
Owner: candidate-recovery-feedback-c worker
Scope: Generic category guidance and truthful failed-check count fallback, partitioned from B runtime changes.

## Current State

Supervisor verification: reviewed source diffs; independently passed UI 114/114 and domain 15/15. After
B's final prefix correction and dev sync, actual fresh Core build (45.249 s), cache-free Core typecheck,
actual domain freshness/source/test check (9.577 s) and both audits passed. Architecture updated;
ready for integration, with live semantic compliance still unverified.

Owned source edits are stable. No condition, catalog/compiler contract, purse, scenario/task/oracle or runtime-B change. No paid/browser launch, .env edit, commit or merge.

## Changes and evidence

- Domain system instructions version web-7 adds a single generic Lists sentence: Use evidence of an item's type; a title mentioning another type does not mean the item is that type. No scenario-shaped example or category word from the live task.
- Exact text length3182, below unchanged3200 limit. Version/comment/test updated; existing numeric/text filtering and paging guidance preserved.
- Core ui/activity-action/check-why.ts rejects bare stored-count clauses as failure causes. Existing generic not-answering-request fallback is used; readable causal clauses still display as before. No attempt to expose unscreened judge advice or invent expected counts.
- UI regression uses7rows/document language, not realistic scenario answer/site/products. Covers rows/records count, leading Stored count and unchanged readable causal finding.

## Fail-first and focused checks observed

Before implementation:
- Core action-of.test.ts:1failed/113passed; exact observed error:7rows came back, but7rows stored instead of truthful fallback.
- Domain instructions:2failed/13passed (old web-6 version and absent generic type-evidence sentence).

After implementation:
- Core owning action-of.test.ts:114passed.
- Labeled domain instructions tests (t452-c):15passed.
- Both git diff --check passed.

Affected current-output checks completed below after peer coordination; no repository-wide validation ran while B edited. Model compliance with category guidance remains a live-test question; instruction tests prove delivery/version/size, not semantic reasoning.

## Final current-output verification

Shared-tree validation was coordinated with B: no source edits while checks read the snapshot. B's initial strict optional-property errors made the first owning library build fail; B corrected its owned types/tests and structural depth/directory budgets, without changing C files. These intermediate failures are not final passes.

Final stable snapshot:
- Owning Core `pnpm.cmd --filter fluxiq build` actually executed and passed,73.2s; stored7218current emitted files. Compiled ui/activity-action/check-why.js contains BARE_STORED and its guard. Final llm/candidate-receipt compiled feature files exist at the approved corrected location.
- Final `pnpm.cmd --filter @fluxiq-web-extension/domain check` passed Core current-source freshness and actually executed source/test tsc after Core dist/src input changes,21.5s.
- Final labeled instructions rerun against current Core output:15passed.
- C owning action-of regression114passed; supervisor separately confirmed114UI/15instructions on these unchanged C sources.
- B peer covered final actual Core package typecheck, both direct structure audits and104owner/legacy/trial tests after final relocation; peer reports allpassed. These are coordinated peer checks, not commands I independently reran. Supervisor owns final independent verification/integration.
- Both git diff --check commands observed exit0 after final source freeze.

Only C's four named source/test files and this own report changed by this worker. Supervisor authored architecture docs and B owns its runtime files. No full suites, paid/browser calls, source-limit/baseline increases, scenario-shaped guidance, new filter semantics, .env edits, commits/merges/pushes or launch performed. Future0.25test ceiling is process authorization handled by supervisor; this unit changes no purse default.

Ready for supervisor verification/integration. Generic guidance delivery and truthful UI fallback are verified; model compliance and live rendered behavior require a later changed-source live run.

