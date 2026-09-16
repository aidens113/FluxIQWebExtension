# G — Graph rollback inverse: cascaded edges restored

Worker report. Repository: `F:\!FluxIQ` (FluxIQ Core), branch `dev`, uncommitted.

## Outcome

Done. The `delete_node` inverse now restores the edges the deletion cascaded
away, and the same class of omission was audited across every other patch
operation. One further instance of the same class was found in
`restoreSnapshot` in the same file and fixed. Core's type check is clean and
the graph-store suite is 9/9 green.

## Inherited versus written

I was handed an unverified, uncommitted work-in-progress from a worker killed
mid-task. I did not assume it was correct. I verified it by copying the fixed
file aside, restoring `graph-store.ts` from `HEAD`, and running the tests
against the unfixed store.

**Inherited (kept, after verification):**

- `graph-store.ts`: the reshaping of `applyGraphOperation` from a single flat
  return into a `GraphOperationEffect` of
  `{ primary, cascaded, inverse[], affectedPartitionIds }`; the `delete_node`
  cascade capture; the `add_node` / `add_edge` overwrite inverses; the
  `operation_count` correction in `applyPatch`. I read every line, reasoned
  through the inverse ordering, and confirmed it is coherent and complete.
  Verdict: correct.
- `graph-store.test.ts`: the `appliedPatch` and `shape` helpers, the
  cascade-conflict test, and the add/overwrite inverse test.

**Written by me:**

- Rewrote the inherited rollback test as *"restores the whole graph, cascaded
  edges included, when a node deletion is rolled back through its inverse"*.
  The inherited version asserted `deletedIds` and inverse-operation *kinds*
  before it ever compared the restored graph, so it failed on bookkeeping and
  never reached the claim that matters. The rewrite makes the graph comparison
  the first post-rollback assertion, compares the full node and edge records
  field by field rather than a summary string, and also asserts the full-text
  search index is restored. Bookkeeping assertions moved after it.
- New test *"restores the graph exactly for every patch operation's inverse"* —
  eight table-driven cases covering `move_node` (across a partition boundary),
  `set_node_parameters`, `delete_edge`, `add_node`, `add_edge`, `delete_node`
  with inbound + outbound + self-loop edges, a mixed batch, and deleting both
  endpoints of an edge. Each applies, asserts the graph changed, rolls back
  through `inverseOperations`, and requires the graph to match the original.
- New test *"restores every field a snapshot captured, not only position and
  parameters"*, plus the `durable` / `withoutVolatileFields` comparison helpers.
- The `restoreSnapshot` fix and the `sameJson` helper in `graph-store.ts`.

## The defect, confirmed

Against `HEAD` (fix reverted, new tests present), the round-trip comparison
fails exactly as described — the restored graph has no edges at all:

```
AssertionError: expected { nodes: [ { …(17) }, …(2) ], …(1) } to deeply equal { nodes: [ { …(17) }, …(2) ], …(1) }
- Expected
+ Received
    "edges": Array [
      Object { "edgeId": "edge.ab", "label": "inbound", "sourceNodeId": "node.a", "targetNodeId": "node.b", … },
      Object { "edgeId": "edge.bc", "label": "outbound", "metadata": { "weight": 3 }, … },
    ],
+   "edges": Array [],
```

Both the inbound and the outbound edge are lost permanently. The node comes
back; the connections do not. A rollback that reports `status: "applied"` and
silently returns a disconnected graph is the failure mode that makes the
autonomous loop's safety guarantee false, because `adaptation-store.ts`
persists `applied.inverseOperations` verbatim as the `kind: "rollback"`
artifact and replays it later to undo an adaptation.

## Audit of every other operation's inverse

Empirically, by running the eight-case round-trip suite against the unfixed
`HEAD` store: only the `delete_node` case failed.

| Operation | Inverse | Verdict |
| --- | --- | --- |
| `add_node` (new id) | `delete_node` | Complete |
| `add_node` (over a live node) | `add_node` of the replaced record | Was broken — inherited fix; previously emitted `delete_node`, which would have deleted a node that existed before the patch |
| `move_node` | `move_node` to prior x/y | Complete |
| `set_node_parameters` | `set_node_parameters` with prior values | Complete |
| `delete_node` | `add_node` + one `add_edge` per cascaded edge | **Was the defect** — fixed |
| `add_edge` (new id) | `delete_edge` | Complete |
| `add_edge` (over a live edge) | `add_edge` of the replaced record | Was broken — inherited fix |
| `delete_edge` | `add_edge` | Complete; no cascade exists |

Ordering was reasoned through rather than assumed. Within one `delete_node` the
inverse is `[add_node, add_edge…]` so the node exists before its edges; across
operations `unshift(...inverse)` prepends each block whole, preserving
reverse-operation order. Batches that delete both endpoints of an edge, or
delete an edge and then its endpoint node, restore correctly — covered by two
of the eight cases.

`flow_regions` rows are not touched by `delete_node`, so there is no region
cascade to lose. The `graph_nodes_fts` row *is* deleted by `delete_node`, and
`upsertNode` re-inserts it, so the search index survives a rollback; the
rollback test now asserts this.

## Second instance of the same class, found and fixed

`restoreSnapshot` (same file, mine) rebuilt its patch by emitting only
`move_node` when x/y differed and `set_node_parameters` when parameters
differed. Every other field a snapshot captured was silently not restored: node
`label`, `definitionId`, `definitionVersion`, `description`, `width`, `height`,
`zIndex`, `disabled`, `metadata`, and *all* edge fields for an edge present in
both — endpoints, ports, label, metadata. The pre-existing test only asserted
`{ x: 0 }`, which is why this was never caught.

Confirmed with a probe test before changing anything:

```
-       "label": "first",          +       "label": "second",
-         "weight": 1,             +         "weight": 99,
-       "sourcePortId": "success", +       "sourcePortId": "failure",
-       "targetPortId": "in",      +       "targetPortId": "alt",
-       "definitionId": "builtin.start", …
```

Fix: for each node and edge in the snapshot, emit a full `add_node` /
`add_edge` upsert when it is missing or differs from the current record,
replacing the three partial loops. This also simplifies the function — the
"missing" and "drifted" cases collapse into one. The difference check uses
`sameJson` on the stripped records; key-order noise can only cause a redundant
operation, never a missed one.

This is beyond the literal brief (it is not an operation *inverse*) but it is
the same correctness class, in a file I own exclusively, so I fixed it rather
than deferring. Flagging it so it can be reverted if the supervisor disagrees.

## Commands run and observed results

All from `F:\!FluxIQ`.

1. Graph-store suite, inherited state as found:
   `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/storage/project/tests/graph-store.test.ts`
   → `Test Files 1 passed (1) / Tests 7 passed (7)`.

2. Same suite with `graph-store.ts` restored from `HEAD` (fix removed, tests
   kept) → `Tests 3 failed | 4 passed (7)`:
   - `expected [ 'node.b' ] to deeply equal [ 'edge.ab', 'edge.bc', 'node.b' ]`
   - `Unknown edge: edge.ab` (thrown from `requiredEdge`, not a conflict)
   - `expected [ 'delete_edge', 'delete_node' ] to deeply equal [ 'add_edge', 'add_node' ]`

3. Rewritten rollback test against `HEAD`, `-t "restores the whole graph"`
   → `Tests 1 failed | 6 skipped (7)`, diff quoted above (`"edges": Array []`).

4. Eight-case round-trip test against `HEAD`, `-t "every patch operation"`
   → `Tests 1 failed`, failing on
   `delete_node with inbound, outbound, and self-loop edges rollback should restore the graph`.
   The other seven cases passed, which is the evidence for the audit table.

5. Same test with the fix restored → `Tests 1 passed | 7 skipped (8)`.

6. `restoreSnapshot` probe before its fix, `-t "every field a snapshot captured"`
   → `Tests 1 failed`, diff quoted above.

7. Final graph-store suite:
   `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/storage/project/tests/graph-store.test.ts`
   → `Test Files 1 passed (1) / Tests 9 passed (9)`. All nine named tests green.

8. Type check: `pnpm --filter fluxiq check` (`tsc --noEmit`) → no output,
   exit 0. Clean across the whole package, including the files other workers
   are editing concurrently.

9. Structure audit: `node scripts/structure-audit.mjs`
   → `structure-audit: passed (136 warning(s), 256 baselined)`.

10. Downstream safety check, beyond the brief:
    `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/storage/project/tests/adaptation-store.test.ts`
    → `Tests 6 passed (6)`, including
    `applies approved adaptations through graph patch transactions and rolls them back`.
    This is the consumer that stores `inverseOperations` as the rollback artifact.
    Caveat: `adaptation-store.ts` and its test were unmodified when I ran this,
    but another worker edited both afterwards. That green result therefore
    describes a state that has since moved on and should be re-run by the
    supervisor at integration.

## Side effects worth knowing

- **A stale patch on a cascaded-away edge now conflicts instead of throwing.**
  Because cascaded `delete_edge` rows are now written to `graph_operations`,
  `changedEntitiesSince` sees them, so a stale patch touching such an edge
  returns `status: "conflict"` with `conflictingEntityIds: ["edge.ab"]`. Before
  the fix it threw `Unknown edge: edge.ab` out of `requiredEdge` — an unhandled
  exception where a conflict response was the contract. That is a second real
  bug closed by the inherited change; the inherited cascade-conflict test pins
  it.
- **`deletedIds` and `changedEntities` now include cascaded edges**, and
  `graph_revisions.operation_count` counts cascaded operations. Consumers seen:
  `adaptation-store.ts` maps `changedEntities` into `appliedTo` (an adaptation
  that deletes a node will now list its removed edges too — more accurate, but a
  visible change in recorded metadata) and `testing/scale-graph-store.ts`
  reports `deletedIds.length` as a benchmark figure.
- **`graph-store.ts` is now 413 lines**, past the audit's 400-line advisory
  threshold (it was 333). The audit still passes — this is a warning, not a
  failure, and 136 such warnings already exist. I did not split the file: doing
  so would mean creating a sibling module I do not own under the brief.

## Not verified

- No commit, no push, no working-document edit, per the brief.
- I did not run Core's full `pnpm check`, `pnpm test`, or `pnpm build`. The
  brief scoped me to the graph-store tests and the type check, and the suite is
  red elsewhere for an unrelated in-flight reason.
- `runtime/tests/live-patch.test.ts` was not run or read; another worker owns it
  and it is known red.
- No live browser or end-to-end validation; this is storage-layer work.
- The `restoreSnapshot` change is covered by the new test and by the
  pre-existing snapshot/restore test, but `restoreSnapshot` has no production
  callers anywhere in Core, so its behaviour change is unexercised outside
  tests.
- Biome does not lint these paths (`No files were processed`), so formatting is
  unchecked by tooling; I matched the surrounding style by hand.

## Open questions or contradictions found

- None blocking. One judgement call to confirm: fixing `restoreSnapshot` was
  beyond the literal brief. It is in my exclusively-owned file and is the same
  correctness class, so I fixed it rather than filing it, per the standing rule
  to act on a recommendation instead of asking. It is isolated to one function
  and can be reverted alone if the supervisor wants it split into its own
  change.

## Files changed

- `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\storage\project\graph-store.ts`
- `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\storage\project\tests\graph-store.test.ts`

Nothing in `automation-studio/runtime/**`, `model/flow-adaptation.ts`,
`storage/project/adaptation-store.ts`, `programs/_shared/**`, or
`programs/identity-access/**` was edited. `git status` confirms the other
modified files in the tree belong to other workers.
