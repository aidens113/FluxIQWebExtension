# Continuation recovery triage

Status: read-only discovery complete. Only this report was written; no source, tests, processes, builds, live/provider runs, commits, merges or t518 state changed.

## Recommendation

Extract only the generic native SQLite long-path repair before instruction-created isolated Lab qualification. Keep the remaining t518 recording conversion, historical signing and terminal completion work parked. No evidence establishes that the unmerged terminal conversion is necessary for the current instruction-first journey, and its historical social replay remains failed.

The independently mergeable source unit is Core commit `e60bfbe06581ac9c96647f31b0837564e4d3ad20`, restricted to:

- `packages/fluxiq/src/programs/database-manager/storage/sqlite-repository.ts`: apply `path.toNamespacedPath(filePath)` only at both native sqlite3 constructors (normal read/write and pinned read-only). Preserve ordinary resolved repository paths and pool identities.
- `packages/fluxiq/src/programs/database-manager/storage/tests/sqlite-repository.test.ts`: existing long-workspace write/reopen/read-only regression and namespaced helper native open.

The commit also contains a paragraph in `docs/architecture/recorded-replay-state.md`. Do not import that recording-conversion document as a dependency. Put any required authored note in the generic database-manager/program documentation under its owner, explaining native-open normalization without tying it to recordings. There is no schema migration, public type change, downstream source dependency or recording approval dependency. Node path is already imported in the source.

## Exact instruction-first ownership

Current main Core still uses raw `filePath` in generic SQLiteRepository constructor calls at lines125/363. Its automation-specific project database opener also remains raw; the measured failure belongs to the generic repository, not that separate opener.

This is not confined to the retired recording approval caller:

1. `automation-studio/runtime/service.ts:1508` instruction bootstrap target validation calls `listFlowSubflowSummaries` to count existing subflows. Bootstrap exploration/extend and publication/review target validation also use it (1771/3404).
2. `runtime/service/summaries/store.ts:399` first tries the typed SQL projection but probes the generic summary repository even when the typed page exists (428). An empty or unreadable generic inventory cannot establish projection completeness, so it falls through to `ensureFlowSubflowSummaryIndex` (444).
3. `ensureFlowSubflowSummaryIndex` (170) requires the project then performs an uncaught generic `listPage` (175). This opens storage even for an initially empty subflow inventory.
4. `runtime/service/flows/mutations.ts:205` owns the generic `flow.subflows` layout1 repository rooted at `projectFile(projectId, "runtime", "sqlite")`; saveFlowSubflow also writes its summary through this repository (101/187).
5. Persisted run subflow enumeration (`service.ts:2549`) and `runtime/service/adaptations/unit-repair-apply.ts:87` recovery-handler graph lookup/creation use the same summary path. Thus instruction-created, repaired and resumed automation infrastructure can hit the identical native opening defect.

The downstream persistent-isolated allocator (`packages/test-runner/src/allocation.ts:95-101`) adds `persistent-isolated/<workspace>/fluxiq-root` beneath its configured run root. Project artifacts add another nested suffix. User task instructions do not shorten these paths. Existing measured root global/project SQLite files were175/250 characters; the failing generic summary filename was264. The relevant normalized shape is `<workspace>/.fluxiq/artifacts/automation-studio/projects/<uuid>/runtime/sqlite/global.sqlite`.

## Existing exact evidence, without a new run

Preserved t518 report `adaptation-and-breadth-plan/reports/codex-t518-live-debug.md` identifies both original provider-free controls failing with native `SQLITE_CANTOPEN` after parent Flow creation and before primary subflow migration. Each actual generic filename was264 characters with an existing parent and absent database.

The authorized private-copy probe kept the same root length and exact suffix: raw native open failed; the same filename through `path.toNamespacedPath` opened/closed; the built fixed generic repository wrote a generic row, reopened and read it. No recorded content was copied into fixtures or exposed. Supervisor independently observed a separate greater-than300-character owning regression fail first, then13 repository/pool tests pass; types/audit/build passed. Fresh controls subsequently cleared approval and entered playback. Those runs demonstrate the opening defect cleared, not instruction-first qualification or terminal replay success.

The old recording-only approval endpoint is now correctly retired by t519. Its historical failure identifies a generic storage owner that current instruction bootstrap also reaches; restoring that endpoint is unnecessary and unauthorized by the new direction.

## Other t518 changes

| Unit | Effect on instruction-first work | Recommendation |
| --- | --- | --- |
| Historical snapshot clock selection, before-action metadata, recorded state projection and route signatures | Improves diagnostics/supporting recording evidence and obsolete manually demonstrated recovery sequences. Ordinary instruction-created signatures already come from live state; t519 does not approve recorded graphs. | Park; not a launch prerequisite. |
| Recorded sequence control-port correction (`434c0d86`/`d35dab42`) | Fixes required-value links created by recorded proposal conversion; does not repair generic graph/data dependency semantics. | Park; do not weaken unbound-value guards. |
| Complete historical control proof, signature bound export | Strict-controls branch applies to historical signatures; legacy live fuzzy signature behavior remains. Public bound is needed by the related downstream proof implementation. | Keep paired/parked; no independent current failure requiring it. |
| Settled terminal producer, canonical admissions, terminal roles, graph-bound generated End, opaque strong-terminal callback | Designed to skip obsolete recorded readiness/final manual retries using proven terminal effect. Instruction-created graphs have no generated recorded End suffix. | Park entire contract together; social terminal success remains unverified. Never use the external oracle or a timeout as completion proof. |
| Explicit empty dialog/overlay capture and descriptor parity | Shared evidence producer changes can improve live completeness and failure propagation, but the documented blocker was historical projection refusing unknown layers. No current instruction-first qualification failure is attributed to old absence representation. | Optional separate evidence-integrity unit only if a new owning failure requires it, with adjacent producer tests. Not required for native storage extraction. |
| Passive fact classification/projection and v2 effects | Does affect ordinary live effect signing once complete facts exist, so it is not exclusively conversion code. It is a broader browser/domain effect contract, not a proven prerequisite for current instruction-created replay. | Park until independently scoped with positive/negative regressions and live proof; do not pull merely to unblock storage. |
| Request body-idle tracking and stop ordering | Exists to establish a settled terminal recording snapshot; broader page-world wrappers require their own lifecycle validation. | Park with terminal producer. |

Already delivered t516/t517 guarded interruption learning and certain-no-effect automatic re-press/exhausted-lasting failure remain on dev. Do not reintroduce, overwrite or condition those fixes on t518. The t518 defensive/generated-End guards are only needed if that End mechanism is promoted later. No generic missing-control/timeout skipping is recommended.

## Narrow checks for the extraction

Run from Core `packages/fluxiq` after applying the two-file unit:

```powershell
pnpm.cmd exec vitest run src/programs/database-manager/storage/tests/sqlite-repository.test.ts src/programs/database-manager/storage/tests/connection-pool.test.ts
pnpm.cmd exec tsc --noEmit
```

Run the root structure audit (`node scripts/structure-audit.mjs`) and build only the changed public library (`pnpm.cmd --filter fluxiq build`) before downstream uses its built runtime. Preserve the meaningful long-path write, fresh reopen and existing-read-only assertions; the read-only helper must also use native normalization so it does not recreate the same defect outside the subject. No whole package suite is needed.

For an additional targeted public-boundary regression, add one generic Core owning test under `runtime/service/flows/tests/` (or the existing owning summary test directory) using an isolated long workspace and real project/blank Flow plus explicit saved task. Assert empty subflow listing succeeds, then create/save/reopen a generic subflow and read its summary. This verifies the current non-recording caller, with zero providers/actions; it must not call diagnostic recording approval. Choose root depth so project.sqlite itself remains below the prior native threshold while the deeper generic summary file crosses it, or separately scope project-opener behavior if a longer root exposes that distinct owner. Do not change that second opener merely on speculation from the existing264-character proof.

No checks were executed during this read-only triage. Historical13-test/type/audit/build evidence above is explicitly from t518, not claimed against current dev. Parent must independently integrate and verify the extracted unit; instruction-first live adaptation/breadth qualification remains outstanding.
