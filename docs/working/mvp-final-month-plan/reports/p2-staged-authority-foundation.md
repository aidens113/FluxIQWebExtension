# P2 staged project authority foundation — t309

Status: source/report frozen; owning tests/types/build/audits passed. Not integrated or independently verified. Worker: p0_acceptance. Date: 2026-10-07.

## Scope and implementation

Approved owners: Core `storage/project/accepted-state/{contracts,migration,validation,digest,store,index}.ts`, owning `tests/{validation,store}.test.ts`, supervisor-approved shared synthetic `tests/fixtures.ts`, additive project barrel and scoped persistence paragraph. This report is the only downstream change. No ordinary writer, runtime service, controller, receipt ledger or promoter changed. No git operations, providers, full suites, browser or panel management.

Local migration `0026_staged_project_snapshots_v1` adds the two snapshot/head tables without changing existing migrations. The opener runs unchanged administration migrations plus this local migration, then opens the existing UoW before any mutation transaction. It never reads existing Flow/source files to capture or adopt data. Snapshots retain complete canonical documents plus SQL resource records, full resolved instruction bodies/scopes/bindings, ordered routers/subflows, settings/categories/policies and explicit capture/dependency scope. The derived vector includes every captured resource, project epoch/generation and content digest; it is computed internally rather than trusting a supplied vector.

Structural validation reuses current Flow/router/subflow/instruction validators and checks ownership/references, canonical/SQL disagreements, actual intervention-mode interpretation, known publications/composite-call declarations and full supplied membership. It preserves array order. Canonical serialization rejects non-JSON/non-finite/cyclic/sparse data, depth beyond128, IDs over200 and canonical UTF8 snapshot/request payloads over32MiB. No truncation or pruning.

Store state is only staged/tombstoned, with productionAuthority always unsupported. CAS compares complete project/epoch/generation/digest/state. Initial staging mints epoch/generation 1; replacement and tombstone preserve epoch and increment generation. New immutable snapshot, head pointer and mutation result share one actual UoW transaction, using only context.sql inside. Committed same-key replay occurs before current-head CAS and returns recordedBinding, not a current-authority claim. Different request/same key refuses. Before mutation success the store checks durable owner/operation/status/request/response and the exact request-specific result binding. Reconciliation reconstructs the original bounded request from its committed immutable snapshot and actual same-epoch prior row, including tombstone prior binding/reason, and recomputes the request digest. It refuses borrowed otherwise-valid receipts and foreign/incompatible mutation operations. Closed request/binding envelopes prevent silently losing extra fields during reconstruction. Unreadable/corrupt/missing joins remain outcome_unknown and never repeat a mutation. Tombstone retains prior history and does not delete a real project or permit restoration.

## Validation log

- Provision81370 completed0; source edits began after notifying supervisor while provisioning could still finish a source/cache scan. Provisioning is not final validation. All recorded owning checks below run after the ready signal.
- First owning run: validation18/18, store10/11; fully migrated fixture failed because its test imported a nonexistent GraphStore name. Core typecheck identified the same test-only import. Corrected to actual AutomationStudioProjectGraphRepository; product source was not implicated.
- Supervisor review identified the shared UoW digest-only replay seam. Fail-first targeted real-SQL negatives: four failures showing foreign owner kind, foreign owner ID, foreign operation and a borrowed newer snapshot could return success. Store-only ownership/operation/result checks fixed these. A separate fail-first reconciliation test then demonstrated an unchanged generation-2 request digest borrowing a valid generation-3 receipt; immutable-row request reconstruction fixed it. UoW source/schema unchanged.
- Final frozen owning tests: 37/37, zero skips, two files, 20.34 seconds. Covers >100 full sources/subflows/settings, separate-pool initial/replacement CAS, stale/changed binding/different request, exact replay after head advancement, tombstone/history, rollback at snapshot/head/pre-COMMIT faults, actual COMMIT followed by lost acknowledgement/fresh-owner reconciliation/no repeated writes, corruption/borrowed joins/unsupported scope and fully migrated existing DB/legacy-file preservation.
- Final frozen `pnpm.cmd --filter fluxiq check`: exit 0, actual command 30.112 seconds, stamped.
- Final Core structure audit: exit 0, 279 warnings/349 baselined. Downstream audit: exit 0, 176 warnings/117 baselined. No baseline changes or budget increases.
- Final owning `pnpm.cmd --filter fluxiq build`: exit 0, actual command 41.033 seconds, stamped; 5,994 generated files/17,440,012 bytes. Generated output not edited/tracked.

Exact owning commands, from paired t309 Core unless stated:

```powershell
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/storage/project/accepted-state/tests/validation.test.ts src/programs/automation-studio/storage/project/accepted-state/tests/store.test.ts
pnpm.cmd --filter fluxiq check
pnpm.cmd --filter fluxiq build
node scripts/structure-audit.mjs
# Paired t309 downstream:
node scripts/structure-audit.mjs
```

## Limits

This is staged storage consistency, not production accepted-state authority. Snapshot completeness is only the membership explicitly supplied; no trusted legacy capture/permission/publication interpreter is implemented. Unknown native dependencies cannot be certified by caller-supplied none literals. JSON/code/global/cross-project and ALL publication-dependent scope are refused; ordinary readers/writers never consult this store. No automatic user-data adoption, legacy partial-import repair, production cutover, browser reset/effect/outcome proof or candidate promotion is claimed. Fresh-owner reopen and injected lost acknowledgement are real SQLite storage tests, not literal OS kill or power-loss tests. History has no pruning. Whole-project coarse generation/32MiB bound is an initial foundation limit.

The corrupted/borrowed-join tests do not claim tamper resistance against an SQL owner rewriting every payload, history row and hash. The trusted original capture, all-writer migration and authorization remain separate work. Unsupported scope is checked from explicit stored declarations and known canonical publication fields; no native registry dependency resolver or automatic existing-data capture was added. Existing partial-import ambiguity is retained unchanged. Recursive fixture cleanup checks the resolved immediate temporary parent and owned staged-fixture name before deletion.
