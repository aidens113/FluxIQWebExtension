# Report: w2-b-flow-authoring-surface

Read-only investigation of FluxIQ Core (`F:\!FluxIQ`) for decision L13: the
improvement loop may propose anything a person can do to a flow. This report
establishes what that surface actually is, how much of it a caller inside Core
can reach today, how much of it is covered by a reviewable/applicable/revertible
record, and whether one "proposed flow change" object can express it.

No source file was changed in either repository. Path prefix `AS/` is
`packages/fluxiq/src/programs/automation-studio/`.

## Outcome

**The existing records cannot carry L13, and widening them is not a small
change.** Three findings drive that, each evidenced below:

1. **A flow is six stores, and only one of them is transactional.** The graph
   (nodes, edges) has revisions, per-entity conflict detection, computed
   inverses and idempotent mutation records. Routers, subflows, instructions and
   the flow artifact itself are JSON files plus indexes plus best-effort SQL
   projections, with no revision check, no inverse and no mutation record.
2. **Parts of the surface have no write representation at all.** Flow variables,
   flow errors and graph regions cannot be changed by any endpoint, any graph
   operation, or any adaptation patch. Flow interface and flow settings are
   writable only by rewriting the whole artifact, which leaves no reviewable
   record.
3. **Two different apply engines already run behind one endpoint**, accepting
   different patch kinds with different transactional guarantees, and a third
   record (flow bootstrap) exists for whole-flow creation but refuses to touch a
   flow that is not blank.

The good news is narrower than L13 but real: **expected state, action targets,
timeouts/retries and wiring are all already expressible as node-parameter and
edge operations on the graph**, which is the one fully revertible path. A loop
restricted to graph-shaped changes could be built on today's machinery with no
new contract. Everything else needs one.

## 1. What "a flow" is

A flow is not one document. The authoring surface spans:

| Store | Type / location | Transactional? |
| --- | --- | --- |
| Flow artifact | `AutomationStudioFlowArtifact` (`AS/model/flows.ts:194-221`) | No — JSON file write |
| Graph (nodes, edges, regions) | SQL tables via `AS/storage/project/graph-store.ts` | **Yes** |
| Subflows | `AutomationStudioFlowSubflow` (`AS/model/flow-adaptation.ts:69-96`) | No |
| Router | `AutomationStudioFlowRouter` (`:45-58`) | No |
| Instructions | `AutomationStudioFlowInstruction` (`:119-137`), 8 scope kinds (`:98-106`) | Partly (see §3) |
| Settings / approval mode | flow `metadata` (`AS/model/flows.ts:63-113, 223-276`) | No |

One structural fact governs everything else: **a top-level orchestration flow
owns no nodes.** `assertFlowGraphMutationAllowed` refuses a graph patch against
an orchestration flow (`AS/runtime/service/flows/graph-patch.ts:91-96`); nodes
live in the graph flow owned by each subflow (`graphFlowId`). "Add a node to
this flow" is always "add a node to subflow X's graph flow". Any proposed-change
contract must address targets accordingly.

## 2. The only reviewable record: graph operations

`AutomationStudioGraphPatchOperation` (`graph-store.ts:21-27`) has exactly six
operations: `add_node`, `move_node`, `set_node_parameters`, `delete_node`,
`add_edge`, `delete_edge`.

What this layer provides, and nothing else does:

- `graph_revisions` and `graph_operations` rows carrying before/after JSON per
  entity (`graph-store.ts:17-18`, `insertOperation` `:300-302`).
- Optimistic concurrency on `baseRevision` with per-entity conflict detection
  (`changedEntitiesSince` `:265-269`) returning a typed `conflict` result
  (`:29`) rather than clobbering.
- **`inverseOperations`** computed per operation (`:136, :143, :257-262`) — a
  genuine undo patch, which is what makes revert possible.
- Idempotency through `runIdempotent` and the `mutation_records` /
  `mutation_touched_entities` tables (`AS/storage/project/schema/mutations.ts:5-38`),
  keyed by `mutationId` with request digest, status, response and touched rows.
- A scheduled validation job and partition refresh on commit (`:147-149`).

Two gaps inside this otherwise solid layer:

- **No update operation.** Renaming a node, editing its description, disabling
  it, or re-pointing an edge's ports has no operation. The web editor expresses
  these as delete-then-add (`apps/web/src/features/automation-studio/flow-editor/commands/draft-commands.ts:198-238`:
  changed nodes go into `replacedNodeIds`, emitting `delete_node` then
  `add_node`). It works and stays revertible, but the audit record reads as a
  deletion and a creation rather than an edit.
- **`delete_node`'s inverse is incomplete.** Deleting a node soft-deletes its
  connected edges (`graph-store.ts:260`), but the inverse recorded is only
  `{ op: "add_node" }`. Reverting a node deletion therefore restores the node
  and leaves its edges deleted. This is adjacent to, but distinct from, the five
  defects in the plan's Current State.
- **Regions are frozen.** `flow_regions` rows are written only by
  `importMonolithicFlowGraph` (`:111-115`, operation kind `import_region`).
  `applyGraphOperation` has no region case and there is no region endpoint (a
  grep of `AS/api/` for `regions` returns nothing).

## 3. Operation-by-operation: what a caller inside Core can do today

Legend — **Core**: a caller inside Core can perform it programmatically.
**Record**: is it covered by a graph-operation or mutation record, so it can be
reviewed, applied atomically and rolled back?

### Nodes

| Operation | Core | Record |
| --- | --- | --- |
| Add node | Yes — `applyFlowGraphPatch` (`AS/runtime/service.ts:2203`) → `add_node` | **Full** — inverse `delete_node` |
| Move node | Yes — `move_node` | **Full** — inverse restores prior x/y |
| Set parameter values | Yes — `set_node_parameters` | **Full** — inverse restores prior values |
| Delete node | Yes — `delete_node` | Partial — inverse omits cascaded edges (§2) |
| Rename / re-describe / disable / resize | Only as delete+add | Partial — recorded as delete+create |
| Add or remove a node's ports | **Not possible by anyone.** Ports come from the node definition (`AS/nodes/contracts.ts:168-183`) | n/a |

`set_node_parameters` is more powerful than it looks. It is the carrier for:

- **Expected state** — declared as the `conditions` parameter (plus `mode`,
  `timeoutMs`) on `builtin.policy.expectation` (`AS/nodes/policy/expectation.ts:32-46`).
  Core never evaluates it; the host does (`:6-7`, `:74-102`).
- **Action targets** — written to `parameterValues.target` (`AS/runtime/service/adaptations/patches.ts:49-51`).
- **Timeouts and retries** (`AS/runtime/live-patch.ts:310-313`).

So a large and important part of L13's surface is already fully expressible and
fully revertible.

### Wiring (edges)

Add and delete are first-class operations; endpoint validity is checked at write
time (`graph-store.ts:217-218`). Changing an edge's ports or label has no
operation and goes through delete+add (`draft-commands.ts:205-212, 230-237`).

### Flow interface, variables, errors, regions

| Operation | Core | Record |
| --- | --- | --- |
| Edit interface (inputs/outputs) | Yes, but only via `update-flow-settings` (`AS/api/handlers/flows.ts:96`) or deprecated whole-document `saveFlow` (`:68-76`) | **None** |
| Add/edit/remove a variable | **No write path at all** except whole-document `saveFlow` | **None** |
| Add/edit/remove an error definition | **No write path at all** except whole-document `saveFlow` | **None** |
| Create or edit a region | **No write path at all** | **None** |

`update-flow-settings` accepts only name, description, visibility, interface,
executionDefaults, metadata and code-source dependencies (`AS/api/handlers/flows.ts:91-102`).
The panel's inspector shows Inputs / Outputs / Errors / Variables as read-only
counts (`apps/web/src/features/automation-studio/inspector/panel-registry.tsx:13`).
A person cannot add a flow variable through the panel at all.

### Subflows

Create, update, rename, duplicate, disable, enable, archive and delete all exist
as endpoints (`AS/api/contracts/endpoints.ts:103-111`) and service methods
(`AS/runtime/service.ts:4054-4213`), each PIN-authorized (`AS/api/handlers/subflows.ts`
contains 10 `authorizeProgramPin` calls). Creating a subflow also creates its
own blank graph flow (`AS/runtime/service/flows/mutations.ts:109-161`).

**Record: none.** Each write is a JSON file plus an index plus a SQL projection
plus a change-feed entry (`mutations.ts:99-101, 159, 192-203`). No revision
check, no inverse, no mutation record. Rollback exists only as a compensating
action inside the adaptation path (`deleteCreatedFlowSubflow`, `mutations.ts:163-185`).

### Router

Save route, delete route, route groups, fallback, reorder/duplicate/toggle, and
condition testing all exist (`endpoints.ts:127-138`), PIN-authorized
(`AS/api/handlers/router.ts:85-171`).

**Record: none.** `saveFlowRouter` validates, writes the JSON file, writes a SQL
projection and updates an index (`mutations.ts:51-71`). The router carries a
`revision` column that adaptations read for binding (`AS/storage/project/adaptation-store.ts:287`),
but the save path performs no compare-and-swap.

### Instructions

Only `save-flow-instruction` exists (`endpoints.ts:115`) — **there is no delete
endpoint**. Scopes include `on_error` and `adaptation_review`
(`AS/model/flow-adaptation.ts:98-106`).

The SQL store is the one non-graph store with real concurrency control:
`upsertInstruction(..., expectedRevision)` bumps a revision, refuses on
mismatch, and invalidates the effective-instruction digest cache
(`AS/storage/project/flow-resource-repository.ts:363-378`). But the service
writes the JSON file and index first and then calls
`writeSqlFlowInstruction(...).catch(() => undefined)` (`AS/runtime/service.ts:4222`)
— **the projection failure is swallowed**, so the revisioned store is
best-effort rather than authoritative.

Critically for L13: **an instruction change cannot be applied as an adaptation.**
`applyFlowAdaptationPatchDurably` throws for `edit_instruction`
(`AS/runtime/service/adaptations/durable.ts:103`), and the typed store refuses
it as not graph-transaction compatible (`adaptation-store.ts:391, 397-403`).

### Publication and settings

Publish, deprecate and list publications exist (`endpoints.ts:50-52`), PIN-
authorized. Approval mode lives in flow metadata as `adaptationMode`
(`fully_adaptive` | `manual_approval` | `no_llm_intervention`,
`AS/model/flows.ts:61-113`), written through `update-flow-settings`.

## 4. The two existing proposal records

### 4a. Flow bootstrap — whole-flow creation, blank flows only

`AutomationStudioBootstrapAdaptation` (`AS/runtime/flow-bootstrap/adaptation.ts:68-90`)
carries a `buildPlan` plus a fully materialized `topology` of `{ router,
subflows[{ subflow, graphFlow }] }`, a status lifecycle, `auditEvents[]`, an
`application` record holding `parentBefore`, and a `revert` record. It is
reviewed through the same endpoint as adaptations (`service.ts:4277-4291`).

Its apply path has the best integrity property in the codebase: it re-validates
the plan against the live node registry and **re-derives the topology, comparing
it byte-for-byte with what was proposed** before writing anything
(`service.ts:4411-4432`). A stale dependency digest is refused (`:4406-4409`).

Two hard limits:

- **It only works on a blank flow.** `assertBlankBootstrapTarget` requires an
  orchestration flow with zero nodes, zero edges, no router and no subflows
  (`service.ts:4364-4373`), re-checked at apply (`:4405`). It can create a flow;
  it can never improve one.
- **Its plan cannot express most of the surface.** The contract
  (`AS/runtime/flow-bootstrap/plan/contracts.ts:9-46`, schema in
  `plan/output-schema.ts`) covers subflows, nodes (definition, version,
  parameters, output action), edges and router rules with route tags. It cannot
  express instructions, flow interface/variables/errors, regions, node labels or
  descriptions, router rule **conditions** (which exist in the model at
  `AS/model/flow-adaptation.ts:38` but not in the plan), or any edit to an
  existing entity. Limits are ≤8 subflows, ≤64 nodes and ≤128 edges each, ≤8
  router rules (`output-schema.ts:26, 34, 95-96`).

Its multi-store apply is a try/catch with a hand-rolled compensating rollback
(`service.ts:4488-4515`), which reports "rollback was incomplete" when the
compensation itself fails.

### 4b. Runtime adaptation — edits, via two divergent engines

`AutomationStudioFlowAdaptation.patch` is an array of
`AutomationStudioChangeProposalPatch` = `{ kind, targetId?, summary, before?,
after?, metadata? }` (`AS/model/flow-adaptation.ts:160-167`) across 8 kinds
(`:150-158`). **`before` and `after` are untyped `JsonValue`** — there is no
per-kind schema, and each applier re-interprets `after` in its own way
(`patches.ts:46-55, 113-158, 180-192`).

One endpoint, `review-flow-adaptation`, routes to **two different engines**:

| | Typed / graph store | File-backed durable |
| --- | --- | --- |
| Entry | `reviewTypedFlowAdaptation` (`service.ts:5099-5131`) → `applyApprovedAdaptation` (`adaptation-store.ts:159-195`) | `applyFlowAdaptationDurably` (`durable.ts:31-63`) |
| Requires | project DB pool + storage root + `supportsGraphTransaction` | storage root |
| Accepts | `edit_expectation`, `edit_action_target`, `edit_recovery`, `edit_router` **with `toNodeId`** only; throws otherwise (`adaptation-store.ts:391`) | `create_subflow`, `edit_subflow`, `edit_router`, and the three node kinds; throws for `edit_instruction` (`durable.ts:103`) |
| Concurrency | Stale-base detection against the graph revision (`:174-177`) | None |
| Rollback | Stored inverse graph patch as a `rollback` artifact (`:183-184`), replayed by `rollbackAdaptation` (`:221-241`) | Best-effort loop restoring `before` snapshots (`durable.ts:146-184`), which can itself throw mid-way (`:161, :164, :171`) |
| Also does | Compiles the applied revision (`:182`), writes audit events | Stamps the adaptation onto the flow |

The typed path returns `null` and **silently falls through** to the file path
when `supportsGraphTransaction` is false (`service.ts:5106`). So the same
proposal gets different transactional guarantees depending on deployment
configuration and on whether its patches happen to be graph-shaped.

### 4c. Change proposals are read-only, and they gate structural applies

Only `list-flow-change-proposals` and `get-flow-change-proposal` exist
(`endpoints.ts:116-117`). There is **no create, review or apply endpoint** for a
change proposal; `saveFlowChangeProposal` exists on the service
(`service.ts:4251-4256`) but no handler calls it.

Yet `evaluateFlowAdaptationPromotionGates` **requires** `adaptation.proposalId`
for any structural adaptation (`service.ts:5638`), and "structural" means
`create_subflow`, `edit_subflow`, `edit_router` or `edit_recovery`
(`durable.ts:187-189`). Nothing reachable over the API can create that proposal
id. **On the file-backed path, a structural adaptation can therefore never be
applied through the API.** That is a hard blocker for L13 today.

### 4d. Authorization is already human-gated

Every write endpoint calls `authorizeProgramPin`, including
`review-flow-adaptation` (`AS/api/handlers/runs.ts:120`) and `apply-graph-patch`
(`AS/api/handlers/flows.ts:117`). L13's "only the final application waits for a
person" is therefore already structurally true. The live problem is the mirror
image: in fully-adaptive mode an autonomous loop still cannot apply anything
over the API without a human PIN.

## 5. The design question: what one "proposed flow change" must contain

To express any of the operations in §3, be shown to a person, be applied
atomically and be reverted, the object needs all of:

1. **Target addressing that survives the orchestration split** — (projectId,
   flowId, subflowId?, graphFlowId) per operation, because nodes live in subflow
   graphs. Today the graph flow is re-derived at apply time
   (`patches.ts:83-106`, `adaptation-store.ts:292-302`) rather than pinned.
2. **A typed, closed operation union covering every entity** — graph
   (add/**update**/delete node and edge, move, parameters, regions), subflow
   (create/update/delete, mappings, role, status), router (rule, group,
   fallback, ordering, condition), instruction (create/update/archive with
   scope), and flow-level fields (interface, variables, errors,
   executionDefaults, settings). Each with `before` and `after` typed to the
   entity, replacing today's untyped `JsonValue`.
3. **A base version per entity class touched.** An adaptation already binds four
   revisions — flow, router, settings, instruction (`adaptation-store.ts:18, 281-290`)
   — but only the graph revision is enforced at apply (`:174`). A whole-flow
   proposal must check all of them.
4. **A precomputed inverse for every operation.** The graph layer does this; no
   other store does.
5. **One transaction spanning the stores it touches.** This is the honest
   blocker: the graph is SQLite with a unit of work, while routers, subflows and
   instructions are JSON files plus indexes plus best-effort projections. No
   transaction spans them, so today's "atomic" multi-store apply is a
   compensating-rollback loop that can fail partway.
6. **A review projection** — summary, per-operation human-readable diff, risk,
   and provenance (run, evidence, instructions, prompt/response).
7. **Status and approval gating** — already present and adequate.

### Can the existing records carry it? No.

- `AutomationStudioChangeProposalPatch` is structurally too weak: an untyped
  `after` behind 8 kind labels, of which one engine accepts 4, the other accepts
  5, and `edit_instruction` is accepted by neither. Adding more kinds keeps the
  untyped payload and multiplies the two-engine divergence.
- Three required targets — **flow variables, flow errors, regions** — have no
  write representation anywhere: no endpoint, no graph operation, no patch kind.
  Two more — flow interface and flow settings — are writable only by whole-
  document `saveFlow`, which leaves no reviewable or revertible record.
- The graph-operation record is the right *shape* but is scoped to a single
  graph flow and six operations; it cannot name a router rule, a subflow or an
  instruction.
- The bootstrap record proves the right *pattern* — propose a whole topology,
  re-derive and compare it at apply, keep `parentBefore` for revert — but it is
  create-only on a blank flow and expresses no edits.

### Recommendation

A **new proposed-change contract** that:

- reuses the graph revision / operation / inverse / mutation-record machinery
  verbatim for everything graph-shaped, since that part is already correct;
- adds typed operations for router, subflow, instruction and flow-level fields,
  each carrying `before`, `after` and an inverse;
- pins a base revision per entity class and checks every one at apply;
- persists through the existing adaptation artifact and audit-event tables
  (`AS/storage/project/schema/adaptations.ts:24-45`), which are genuinely good
  and need no change;
- is applied by **one** engine, not two.

Two prerequisites are not contract problems and should be decided explicitly
rather than discovered later:

- The non-graph stores must either become transactional, or the design must
  accept compensating-rollback-only semantics for non-graph operations and say
  so as a disclosed risk.
- The change-proposal gate (§4c) must be resolved — either by shipping a
  proposal-creation path or by removing `proposalId` from the promotion gate —
  or structural changes stay unapplyable regardless of contract work.

**Sequencing note.** Because expected state, action targets, retries and wiring
are already fully expressible and revertible through graph operations (§3), a
first loop increment covering those needs **no new contract at all**. The new
contract is required for router, subflow, instruction and flow-field changes.
That split is a natural phase boundary if capacity runs short.

## What changed and why

Nothing. This was a read-only investigation; the brief forbids touching any
source file in either repository, and none was touched. The only file written is
this report.

## Commands run and observed results

No repository gates, builds, tests or Lab runs were executed — the brief states
"Validation: none" for this investigation and forbids repository gates. All
findings come from reading source with Read and Grep. Every claim above cites
the file and line it rests on.

## Not verified

- **No runtime verification of any kind.** I did not execute an apply, a revert,
  a graph patch or a bootstrap application. Every behavioural claim is read from
  source, including the `delete_node` inverse gap (§2) and the structural-apply
  blocker (§4c). Both should be confirmed with a test before being treated as
  fact.
- **The UI enumeration is not exhaustive.** It is drawn from the `*-commands.ts`
  files, the inspector panel registry, the flow-editor components and
  `draft-commands.ts`. A UI affordance implemented elsewhere could have been
  missed.
- **Node rename/description/disable in the panel**: I confirmed the graph record
  carries `label`, `description` and `disabled` (`graph-store.ts:14`) and that
  `add_node` sets them, but `inspector/widget-model.ts` exposed no matching
  editor, so whether the panel offers a rename control is unconfirmed.
- **Regions**: I found no endpoint and no graph operation, and the web hits for
  "region" are live-session surfaces rather than flow regions. I did not
  exhaustively read `FlowGraphCanvas.tsx`, so a canvas-only region affordance
  cannot be fully excluded.
- I did not assess performance, or how large a whole-flow proposal would be on
  the wire.

## Open questions and contradictions found

1. **Which apply engine is authoritative?** One endpoint routes to two engines
   with different accepted patch kinds and different rollback guarantees, chosen
   by deployment configuration (§4b). This should be decided before Phase 2.5
   builds on either.
2. **Structural adaptations are unapplyable through the API** (§4c): the
   promotion gate requires a `proposalId` that no endpoint can create. Is the
   intent to ship proposal creation, or to drop the gate?
3. **`delete_node`'s inverse omits cascaded edges** (§2). This resembles the five
   defects in the plan's Current State and may belong with phase D, but it is not
   one of them.
4. **Instruction SQL projection failures are swallowed** (`service.ts:4222`),
   leaving the revisioned instruction store best-effort while adaptations bind
   against its revision (`adaptation-store.ts:288`).
5. **The persisted adaptation status enum is narrower than the domain enum** —
   `disabled`, `reverted` and `superseded` all collapse to `'failed'` and are
   recovered from `status_detail_json.canonicalStatus`
   (`adaptation-store.ts:355, 435-436`). Lossy but recoverable; worth deciding
   whether to widen it before adding more lifecycle states.
6. **L13 versus the PIN boundary**: every write endpoint requires a human PIN
   (§4d), so a fully-adaptive loop cannot apply its own proposal over the API.
   L13 asks for approval mode to gate only the final application; today
   *everything* is gated. This needs an explicit decision about how an
   autonomous apply is authorized.
