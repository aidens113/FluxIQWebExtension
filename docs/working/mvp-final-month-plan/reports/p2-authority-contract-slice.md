# P2 accepted-state authority contract foundation

Status: concrete proposal for supervisor approval, not implemented. Worker: p0_acceptance. Date: 2026-10-07. Scope: read-only main Core/downstream inspection; only this report written. No source/build/runtime/provider/panel/git/shared-document changes.

## First executable slice

Implement an isolated project-SQL **staged complete-project snapshot store**. One project head and generation are deliberately coarse: any staged mutation invalidates the whole binding. This avoids independently copied project instructions/settings diverging between separate Flow heads, and makes a complete read one snapshot rather than mixed graph/document queries. Whole-project replacement costs more and may refuse large captures; that is an explicit first-slice limit, not a scalable production claim.

This store is not connected to getFlow, the executor, legacy writers or candidate promotion. Its schema allows only staged/tombstoned states, not adopted/active. It never reads user legacy data automatically or updates existing Flow/graph/router/source rows. A staged snapshot demonstrates internal storage consistency; it does not demonstrate that legacy data stayed unchanged, that normal authorization succeeded or that all writers participate. Preparation continues to return unsupported authority.

Initial supported scope: one project database, complete visual Flow artifacts, project-local source/settings/ownership and no publication dependencies. Refuse JSON authority, code-source captures without a separately approved complete source owner, cross-project resources, global instruction authority and **all** publication-dependent captures, including same-project publications. Local copied publication metadata is not authority over deprecation/global history. Do not introduce a permissive feature flag or silently omit unsupported dependencies.

## Exact immutable payload

`AcceptedProjectSnapshotV1` is a new storage contract using existing model DTOs, with these required sections:

| Section | Complete content, not a summary/projection |
| --- | --- |
| Project descriptor | Project ID, owning scope/domain identity, project lifecycle/source descriptor and capture provenance. Descriptor is captured data, not current project/actor authorization. |
| Flows | Every project Flow document: complete `AutomationStudioFlowArtifact`, including interface, errors, variables, graph nodes/edges, regions/handoffs, executionDefaults, source, publication/history, metadata and timestamps. Owned subflow graph Flows are included. Visual source is represented by the entire graph; code mode explicitly refuses in v1 rather than storing only moduleId/sourceDigest. |
| Settings | Exactly one complete settings record per Flow: interventionMode/version, executionDefaults, training/adaptation/llm/safety JSON and all source revision/provenance. Preserve Flow.executionDefaults and metadata too. A future adapter must resolve/validate disagreement; no silent choice between legacy metadata and SQL settings. |
| Routers/subflows | Full router rules, groups, order/conditions/fallback/status/metadata and complete subflow membership/ownership, mappings, approval override/status and owned graph references. Include categories and policy records affecting execution/hashed metadata. No page limit or selected-branch subset. |
| Instruction sources | Complete `AutomationStudioFlowInstruction` documents with actual body text, ID/title/scope/status/requirement/priority/tags/metadata and original provenance. Include all project-local SQL scopes and bindings (enabled/order/revision), not merely effective selected IDs or maxRevision. Object-backed text must be resolved into full body before staging. SQL inlineBody:null/bodyObjectId:null projection is insufficient. |
| Dependency scope | Explicit same-project references and complete captured membership; publication scope is the literal `none`. Unsupported, missing or unresolved references refuse. Native/canonical dependency interpretation remains a trusted adapter responsibility; an empty caller-supplied publication list is not production proof. |
| Contract provenance | Schema/representation version, compiler/registry/normalizer versions/digests, explicit capture ID and origin `synthetic_fixture` or `explicit_snapshot`. No automatic legacy-capture origin. Permission/consequence provenance may be captured, but is not a granted/current authorization decision. |

The validator requires IDs/ownership/unique node-edge-region and Flow identities; referenced endpoints, router targets, subflow graph owners, instruction scopes/bindings and source associations must resolve within the complete project. Preserve meaningful ordering; canonicalization sorts only set-valued collections, not route/rule/priority semantics. Use current model validators where applicable and explicitly reject ambiguous representation/source/settings rather than reconstructing missing values.

Store derives digest and the complete resource vector internally from the immutable payload. Each vector entry contains resource kind/ID, epoch, project generation and SHA-256 content digest; settings, body text, scope/binding membership and project lifecycle are included. Exact set membership and project generation detect deletion/addition even if a previous per-resource maximum revision does not change. Generation is the foundation's monotonic counter, not a claim that a legacy SQL revision or timestamp has been synchronized. Retained prior snapshots preserve removed resources; no new deletion/re-add can reuse an old binding because generation/epoch differ.

Initial explicit storage bound: canonical payload <=32 MiB UTF-8, IDs <=200 characters and positive safe-integer generations. Reject oversize/non-finite/corrupt/duplicate content; never truncate. This cap belongs only to the staged foundation and does not change existing Flow limits. If the supervisor prefers a different bound, choose it before dispatch; test the chosen bound. No automatic history pruning or user-data deletion.

## Minimal project SQL schema

Add one local numbered migration after the current project ledger migrations, using the existing migration runner without modifying applied checksums/user_version or resetting data. Final migration ID is allocated during dispatch against the then-current tree.

```sql
create table accepted_project_snapshots (
  project_id text not null,
  epoch text not null,
  generation integer not null check (generation > 0),
  payload_kind text not null check (payload_kind in ('state','tombstone')),
  payload_json text not null,
  digest text not null,
  created_at_ms integer not null,
  primary key (project_id, epoch, generation),
  unique (project_id, epoch, generation, digest)
);
create table accepted_project_heads (
  project_id text primary key,
  epoch text not null,
  generation integer not null check (generation > 0),
  digest text not null,
  state text not null check (state in ('staged','tombstoned')),
  foreign key (project_id, epoch, generation, digest)
    references accepted_project_snapshots(project_id, epoch, generation, digest)
);
```

Existing project `mutation_records`/unit-of-work provide the durable idempotency join. No new accepted graph tables, source projections or publication owner are needed for this staged foundation. Immutable snapshots are inserted before the head pointer update in the same actual transaction; historical snapshots are never overwritten. A tombstone is a new generation payload with prior binding/reference and bounded reason, not deletion of old state. Its head cannot fall back to JSON/old snapshots. Epoch is minted once by the store on initial staging; restoring/reusing a tombstoned project is unsupported in this first slice.

## Read/write/CAS and future adoption contract

Proposed owner `AutomationStudioProjectAcceptedStateStore` exposes only:

1. `open({pool, projectId})` / `close()` using the existing project lease and local migration. No bootstrap/adoption scan on open.
2. `readCurrent()` returns a strict joined head+immutable snapshot, or missing/tombstoned. One joined SQL statement gives one generation; digest/schema/project/pointer mismatch throws. No cache or compatibility fallback. Output explicitly says `productionAuthority: unsupported`.
3. `stageInitial({mutationId, snapshot, expected: missing})` validates/clones/digests outside the transaction, then checks head absence and writes generation1 inside the unit-of-work SQL executor. Caller provides explicit complete data; this is staging, not user-data adoption.
4. `replaceStaged({mutationId, expectedBinding, snapshot})` compares full projectId/epoch/generation/digest/state inside that same transaction and inserts next immutable snapshot/head. CAS mismatch returns a conflict without new snapshot/head mutation. No blind upsert or timestamp CAS.
5. `tombstoneStaged({mutationId, expectedBinding, reasonCode})` uses the same CAS and new generation, preserving history. It does not delete a live user project or modify legacy project rows/files.
6. `reconcile({mutationId, requestDigest})` returns exact durable committed result, known failure or outcome_unknown; it does not run the operation again.

The request digest covers operation, expected binding, complete prepared snapshot digest and project scope. Existing committed same key returns the recorded result **before** comparing a now-advanced head; same key/different request refuses. Name returned token `recordedBinding`, so replay of an old committed result is not mistaken for current state; freshness requires readCurrent. Concurrent different mutations against one expected generation yield one winner and one conflict. All writes use context.sql; no calls into separately queued graph/resource writers inside the transaction.

Use UoW atomic mutation/result recording, with explicit handling of its failed/committed records. After lost COMMIT acknowledgement, inspect durable mutation+head/snapshot; committed response replays, unreadable remains unknown. Do not state an exception proves rollback or retry under a new ID automatically. Foundation writes have no browser effects, but uncertainty still cannot become a successful current-authority claim. Do not emit existing Flow change events or project graph projections: staging is not accepted execution state.

Future adoption is deliberately absent from this schema/API. It requires an additional reviewed migration and coordinator: explicit user/project opt-in, cross-process fenced ordinary writers, full legacy document/source capture, refusal of SQL/document ambiguity, fresh original/source/dependency comparisons, and one committed adoption epoch/generation. No automatic adoption on read/cache miss. Maintenance fence alone is insufficient after adoption; all writers below must persistently join the authority protocol. Production preparation/promotion remains closed until adoption plus reader/writer participation and trusted verification adapters are complete.

## Minimal isolated implementation owners

Core paths relative to `packages/fluxiq/src/programs/automation-studio/`:

- New `storage/project/accepted-state/{contracts,migration,validation,digest,store,index}.ts`; owning `tests/{validation,store}.test.ts`. Validator/digest are focused and deterministic; store owns lease/CAS/reconciliation only. Keep below hard budgets; split only if a cohesive responsibility exceeds them.
- Existing `storage/project/index.ts`: one additive barrel export after supervisor approval. Do not add a flat project/tests file at its25-file limit; tests live beside the new owner.
- Scoped `docs/architecture/automation-studio/persistence.md` foundation paragraph and own next-task downstream report. No service.ts, existing ledger/controller/promoter, ordinary writer or generated-data edits in this slice.
- Existing project administration/UoW/graph/resource implementation remains unchanged. New opener uses the existing migration runner/admin set plus its local migration; mutation calls acquire/open UoW before entering transaction and perform only direct context.sql inside.

## Invariant tests for this slice

- Real SQLite fresh and fully migrated existing-project fixtures: local schema does not skip tables, change applied checksums/user_version, reset existing rows or read/adopt existing user Flow/source files. Opening alone creates no staged head.
- Complete project fixture with >100 instructions/subflows, full bodies/scopes/bindings/settings/graphs/router groups. Read/reopen is one internally consistent generation with exact membership/vector; missing body/owner/settings, duplicated IDs, dangling target, external/global instruction scope, code source and any publication dependence refuse with no state write.
- JSON/no supported project authority returns explicit unsupported; ordinary legacy JSON files remain byte-for-byte unchanged. Contract cannot represent adopted/active or promoted result. No stage API changes graph/router/source/Flow tables, global repositories or generated files.
- Separate real SQLite owners stage concurrently: one initial winner. Competing replacement/settings/source/membership snapshots with same expected binding yield one generation winner and one conflict. Unrelated mutation also changes coarse generation; old binding cannot succeed.
- Same mutation key/same payload replays one recorded result without another snapshot; conflicting key/payload refuses. Replay after newer head returns prior recordedBinding, never claims freshness. Tombstone blocks stale replacement and legacy fallback; history retained.
- Inject before snapshot insert, before head pointer write and before COMMIT: reopened store exposes old generation only, no orphan committed head. Inject after COMMIT/before acknowledgement: reconciliation exposes exact committed result and same snapshot generation, no duplicate. Unreadable/corrupt persisted payload, mismatched digest/head/epoch/project and mutation receipt stay errors/unknown.
- No caller-provided acceptance/success/source string, model field or compiler success can turn staged state into authority. Test enum/API refusal rather than a fake successful promoter callback. No providers/browser needed.

## Exact writer/reader cutover obligations (excluded from first slice)

Before production adoption, every capability below must join the same authority or refuse mutations for adopted scope; compatibility projections are allowed only with committed generation tags. This is the minimum known gate, not permission to ignore external SDK writes.

| Owner/functions | Cutover obligation |
| --- | --- |
| `runtime/service/flows/writer.ts` saveFlowInternal/saveFlowUnheld/deleteFlowArtifact; service.ts saveFlow/deleteFlow | Whole document, representation, settings/interface/source, ownership/tombstone CAS and projection outbox. |
| service.ts compileAndSaveFlowSource/convertFlowToVisual/synchronizeCanonicalFlowGraphProjection | These bypass ordinary save; must join or refuse. Generation-tagged projection must never become an authoritative save. |
| `storage/project/graph-store.ts` importMonolithicFlowGraph/applyPatch/upsertFlowFromArtifact/upsertNode/upsertEdge/upsertRegion/refreshPartitionCounts | Public low-level graph mutation and rehome must participate, not only facade patch. t307 import atomicity is one graph transaction, not an authority-generation CAS. |
| `runtime/service/flows/graph-patch.ts` applyFlowGraphPatch; `flows/store.ts` reconcileCanonicalGraphFromDocument/replaceFlowGraphIndex/loadProjectFlow/ensureSqlFlowRouterProjection/writeSqlFlowMetadata/writeSqlFlowSubflow/writeSqlFlowInstruction | Join generation, or refuse adopted lazy repairs/imports. Missing/tombstoned authority cannot rebuild from mirrors or blank graph. |
| `runtime/service/flows/mutations.ts` saveFlowRouter/saveFlowSubflow/createFlowSubflow/deleteCreatedFlowSubflow; service route/group/rule/fallback and update/rename/duplicate/disable/archive/enable/delete subflow methods | Atomic full router/subflow/membership/owned graph changes, preserving normal validation and prior state. |
| service.ts saveFlowInstruction/saveFlowGenerationInstruction; api/handlers/instructions.ts | Actual instruction document body/scope/status/priority/tags and source identity, without swallowed SQL failure. |
| `storage/project/flow-resource-repository.ts` upsertFlow/upsertInstruction/upsertInstructionBinding/upsertAdaptationPolicy/upsertSubflowCategory/upsertRouterGroup/upsertRouterRoute/upsertSubflow/replaceRouterProjection/markFlowDeleted | Public independent SQL writers must participate; optional expectedRevision alone is insufficient. Shared source/binding/policy changes invalidate project generation. |
| `storage/project/flow-resource-mutations.ts` saveInstruction/deleteResource | SQL-only source/body/scope edits/deletes are real competing writers. Required authority CAS; no cache-based freshness or projection resurrection. |
| service.ts publishFlow/deprecateFlowPublication; `storage/sqlite-repository.ts` Flow/publication put/delete; matching memory repository capabilities; `runtime/service/catalogue.ts` history synthesis | Adopted v1 publication operations refuse. Raw global Flow put/delete must be projection-only or refuse adopted identity. Broader publication support needs common authority across projects and all writers. |
| service.ts deleteProject; `runtime/service/projects/store.ts` project index/record writes; migration-cutover import jobs | Lifecycle fencing/tombstones; no delete/recreate or migration escape around adopted epoch. |
| `runtime/service/flows/store.ts` getFlow/getFlowRouter/getFlowSubflow/materializeCanonicalGraphFlow; summaries/store.ts/indexes/store.ts source/subflow pagination/fallback; service.ts getLlmExecutionBinding/getLlmExecutionDependencyDigest; runtime executor settings/dependency consumers | Coherent authority reader supplies actual execution data and complete scope. SQL settings counter alone is not execution authority. Warm/cold caches and empty lists cannot fall back to stale documents. |

Candidate draft/receipt freshness still uses uncached owner reads. Normal permissions, actor/project access, compiler/registry compatibility and consequence rules remain apply-time gates; the foundation snapshot does not replace them. Requirement interpretation, reset/start, independent oracle and performed domain acknowledgements remain separate missing production adapters.

## Proposed bounded implementation brief (next unit, <=40 lines)

```text
Task: p2-staged-project-authority-foundation; paired isolated Core/downstream task.
Read: this report and main Current State; project database/UoW/migration conventions.
Own: new storage/project/accepted-state/{contracts,migration,validation,digest,store,index}.ts
and owning tests/{validation,store}.test.ts; project/index.ts additive export;
scoped persistence architecture paragraph and own downstream report only.
Implement one immutable complete-project visual snapshot/head, staged/tombstoned only.
Two local SQL tables plus existing UoW mutation/result ledger; no existing data reset.
No service/executor/promoter/current ledger/legacy writer/adoption or generated-data edits.
Full artifacts/settings/router/subflow/categories/policies/instruction bodies/scopes/bindings.
Store derives complete membership/resource digest vector; coarse project generation.
Support local visual project only; refuse JSON, code, global/external source and publications.
Bound canonical UTF-8 payload32MiB and IDs200 chars; reject, never truncate.
API: readCurrent, explicit stageInitial, replaceStaged CAS, tombstoneStaged, reconcile.
Normal production preparation returns unsupported authority; no adopted/active enum/API.
Initial stage does not scan/import legacy user data; open creates no head.
CAS compares project/epoch/generation/digest/state inside actual transaction.
Same mutation request replays recordedBinding; changed request refuses before writes.
Never call separately queued owner methods inside UoW SQL executor.
Lost COMMIT acknowledgement reconciles durable result; unreadable remains unknown.
No automatic operation retry, lifecycle restore, history pruning or adoption.
Real SQLite failures/reopen/concurrent owners/idempotency/corrupt joins/tombstone tests.
Existing migrated DB preserves prior ledger/user_version/rows; >100 source/member fixture.
No graph/source/router/Flow/global/generated writes from this isolated foundation.
Narrow owner tests, Core typecheck/build, both structure audits; no providers/full suites.
Freeze exact source/report; supervisor reviews/repeats before integration.
```

## Inspection and decision

Read main Current State, written authority brief, prior promotion design/inventory; verified current full instruction.body/source/Flow/settings/scope/binding types and existing SQL-only mutation methods. This report defines the first contract/storage implementation; no atomicity or production migration was tested. Recommended approval is this staged foundation only. Production cutover remains a separately partitioned reader/all-writer/adoption unit with explicit unsupported publication/code scope; accepting promotion is later.
