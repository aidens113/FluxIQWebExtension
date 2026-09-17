# w2-5c — A durable deterministic recovery path

Core `F:\!FluxIQ`, branch `dev`. Nothing committed.

**HEAD moved during this task**, as the coordinator warned it might: `1be6c9e`
when I verified the premise, `e9c26b1` when I finished. The only commit between
them is *"Give Core the task lifecycle, and the rules that go with it"*, which
touches `AGENTS.md`, `package.json`, `scripts/task/**` and
`runtime/tests/live-patch.test.ts` — none of my dependencies, and nothing
bearing on the premise. I re-ran every check on `e9c26b1` rather than trusting
the earlier runs; the results below are from that re-run.

## Outcome

Done, with one safety gap I do not own and must hand back (see *Call sites I do
not own*, item 1 — it is the one thing to act on before this ships).

## The defect: half-fixed before my brief was written

My brief's premise was stale in its details and sound in its substance. I
checked it at HEAD rather than at the revision the scoping report described.

**What the brief said:** `edit_recovery` writes `node.parameterValues.recovery`
at `patches.ts:52-55`, and nothing reads it.

**What is actually at HEAD:**

- `patches.ts:52-55` no longer writes anything of the kind. Commit `4612d4b`,
  *"Fail closed on edit_recovery instead of reporting a repair that never
  happened"* (2026-09-15, an ancestor of HEAD), replaced the inert write with a
  refusal. `edit_recovery` now throws in both apply paths —
  `adaptation-store.ts:445` (graph transaction) and
  `durable.ts:105` (file-based) — and `patches.ts:42` refuses any kind but the
  two that write a parameter the executor reads.
- **No reader of `parameterValues.recovery` exists, and none ever did.** I
  searched by behaviour, not by the brief's line numbers: the only surviving
  `recovery:` keys in Core `src` are `model/policies.ts:60` (`RecoveryPolicy`, a
  policy-graph concept) and `runtime/service.ts:1350` (`recovery: { strategy:
  "pause" }`), neither of which is a node parameter. The recovery ladder still
  considers only `builtin.policy.recovery` nodes and the failed edge.
- I also checked `runtime/flow-change/` and `runtime/recovery/`, where sibling
  work had landed under other names. `runtime/recovery/annotation/patches.ts`
  applies *runtime* patches — temporary, in-memory, for one run. Nothing there
  is durable.

**So the defect reproduces in the half that matters.** The lying is gone; the
missing capability is not. A learned recovery still cannot be recorded durably
at all — it now fails loudly instead of silently. The decisive evidence that I
was building the first mechanism and not a second: at HEAD,
`adaptation-store.ts` contained **zero** occurrences of `add_node`
(`git show HEAD:...adaptation-store.ts | grep -c add_node` → `0`). Nothing in
Core inserted nodes as a repair.

I did not regress the fail-closed decision. `edit_recovery` still refuses,
untouched, and its test still passes. The new kind is additive.

`approvedRuntimePatchNodeIds` is still declared (`executor/contracts.ts:242`,
not `:184`) and read (`recovery-ladder.ts:27`), and **nothing produces it** —
not even tests. `create_subflow` still creates an empty Subflow
(`patches.ts:211-252`). Both are untouched and still open.

## The patch kind

`insert_deterministic_path`. It inserts real action nodes into the owned
Subflow graph and wires them from the failed node's `failed` port.

```
{ kind: "insert_deterministic_path",
  targetId: "<the node that failed>",
  summary: "...",
  after: {
    nodes: [{ nodeId, definitionId, definitionVersion?, label?,
              parameters?, target?, expectation? }],   // 1..16
    returnToNodeId?: "<node the path rejoins on success>"
  } }
```

Why this shape works where `edit_recovery` could not: `edit_recovery` carried
only `actionDefinitionIds`, which named definitions but never said what to run
them on, so no applier could build a node from it. This carries a whole node.
`target` is written through `actionTargetParameterValues`, the same mapping an
`edit_action_target` patch uses, so a policy action is re-pointed inside its
dispatched payload rather than beside it; `expectation` merges over the
parameters.

**It needs no executor change.** The ladder already has a `deterministic_path`
candidate at priority 1, gated on a failed edge existing
(`recovery-ladder.ts:31-40`), and `graph-run.ts:260` will only follow an edge
the ladder selected as `deterministic_path`. Nothing created that edge from a
learned recovery. This does. The recovery runs because the graph now says so.

Wiring: `targetId --failed--> nodes[0] --success--> nodes[1] ... --success-->
returnToNodeId`.

Refusals, all before any operation reaches the store: no failed node named; a
failed node not live in this graph; an `after` that does not parse; a rejoin
node not live in this graph; a rejoin that points at an inserted node (a loop
with no exit); and **a node id already in use** — `add_node` replaces a live
node of the same id, so a colliding id would destroy real behaviour rather than
insert a step.

The strict parser `parseAutomationStudioDeterministicPath` allows no key it does
not name, at either level, so an LLM response cannot smuggle page text or extra
node fields into a graph write. It is enforced twice: at `putAdaptation`
validation and again at apply.

## Rollback, and cascaded edges

Everything goes through `graph.applyPatch` on the transactional store, as one
request: a refused patch leaves the graph untouched, an applied one has a single
inverse. The store builds the inverse — `add_node` → `delete_node` (which
cascades to every edge on the node and restores each by `add_edge`), `add_edge`
→ `delete_edge` — and collects them with `unshift`, so they undo in reverse
order.

I did not hand-write an inverse, which is how the earlier `delete_node` defect
arose. I tested the cascade rather than assuming it: after applying, the test
attaches a *further* edge to the inserted node the way an author would, then
rolls back. The rollback's `delete_node` cascades that edge too, and the
rollback's own inverse carries all three edge ids back —
`["adaptation.adaptation.path.path.node.action.recovery.dismiss",
"adaptation.adaptation.path.path.recovery.dismiss.node.other", "edge.author"]`,
including `edge.author`, which the change never added. An inverse that listed
only the node would have dropped it silently.

Inserted nodes carry their adaptation stamp in `add_node`'s own metadata rather
than via a later `set_node_metadata`, so deleting the node removes the stamp
with it.

## The mutation

The brief asked for one; I ran two, because the first showed the guard firing
and the second showed the guard is load-bearing.

**Mutation A — drop the entry edge only.** `assertInsertedNodesAreWired` refused
the apply: `Deterministic path would insert unreachable node recovery.dismiss;
adaptation.path refused.` Two tests failed (the store test and the next-run
test).

**Mutation B — drop the entry edge *and* the guard.** The node is really
inserted unwired, and the **next run** breaks, which is what the brief asked
for. Observed:

```
AssertionError: expected { status: 'failed', …(6) } to match object { status: 'succeeded' }
- "status": "succeeded"
+ "status": "failed"
```

and the run's own message:

```
This Flow has no Start node, and 2 nodes have no edge into them
(action.submit, recovery.dismiss), so where a run begins is ambiguous.
Add a Start node, or connect those nodes.
```

That is the point worth keeping: an unwired inserted node is **not inert**. It
becomes a second root, so `chooseAutomationStudioStartNode` cannot decide where
a run begins and the whole Flow stops running — a worse outcome than the defect
being fixed. Both mutations were reverted from backups and both suites re-run
green; no `MUTATION` marker remains in either file.

## Call sites I do not own

**1. This is the one to act on.** Three places classify patch kinds and do not
list `insert_deterministic_path`, so it is currently gated *less* than
`edit_recovery` was, despite inserting executable nodes:

- `runtime/service/adaptations/durable.ts:197` `adaptationRequiresChangeProposal`
  — consumed by `runtime/recovery/adaptation-promotion.ts:29`, which therefore
  does **not** require a linked change proposal for it. Confirmed empirically,
  not inferred: my service test applies a path adaptation with no `proposalId`
  and it succeeds.
- `runtime/training-modes.ts:311` (`majorPatch`) — mixed proposal mode would
  auto-approve it instead of routing it to manual review.
- `runtime/training-modes.ts:325` (`structuralPatch`) — a validated low-risk
  path could be auto-applied with no manual review.

Inserting executable action nodes is at least as structural as `edit_router`,
which only adds an edge between nodes that already exist. My recommendation is
to add `insert_deterministic_path` to all three lists. I did not do it because
those files are outside my brief.

**2. The LLM cannot propose one yet**, which is fail-closed and safe but means
the loop cannot yet *learn* a path from the model — only code building the patch
directly can. The allowed-kind sets are
`runtime/llm/harness/output-validation.ts:56` and
`runtime/llm/harness/provider-result.ts:196`; a path patch from a provider is
currently rejected as `llm_output.unsupported_patch_kind`.

**3. The natural producer.** `runtime/live-patch.ts:539-541` converts
`temporary_action_sequence` → `edit_recovery`, which still throws on apply.
Converting it to `insert_deterministic_path` is the obvious next step and would
close the loop end to end. `live-patch.ts` is owned by another agent this round.

## Files changed

| File | Change |
| --- | --- |
| `model/flow-adaptation.ts` | kind added to the union; `AutomationStudioDeterministicPath{,Node}` types |
| `model/validation/adaptation.ts` | strict parser; per-patch validation |
| `model/validation/index.ts` | one line, to export the parser (see below) |
| `storage/project/adaptation-store.ts` | operation builder, wiring guard, transaction claim |
| `runtime/service/adaptations/patches.ts` | comment only, recording why this kind never reaches the legacy applier |
| `storage/project/tests/adaptation-store.test.ts` | 2 tests + fixture + 3 helpers |
| `runtime/tests/service-adaptation/tests/subflow.test.ts` | the next-run test + 2 helpers |

Two notes on files. `model/validation/index.ts` is not in my brief; it lists its
exports explicitly rather than star-exporting, so the parser in my owned file is
unreachable without one line there. I made that edit and am flagging it. And the
brief named `AS/runtime/tests/service-adaptation-subflow.test.ts`, which does not
exist; the file has since moved to
`runtime/tests/service-adaptation/tests/subflow.test.ts` and I treated that as
the owned file.

## Commands run, and what they printed

| Command (from `packages/fluxiq`, never the repo root) | Observed |
| --- | --- |
| `npx tsc --noEmit -p tsconfig.json` | clean, no output |
| `npx vitest run .../storage/project/tests/adaptation-store.test.ts` | **21 passed** (21) |
| `npx vitest run .../service-adaptation/tests/subflow.test.ts` | **5 passed** (5) |
| both together, after restoring the mutations | **26 passed** (26) |
| `npx vitest run .../runtime/tests/service-adaptation .../runtime/service/adaptations` | **13 files, 56 passed** |
| `npx vitest run .../automation-studio/model` | **9 files, 70 passed** |
| `npx vitest run .../automation-studio/storage` | 36/37 files, **185 passed, 5 failed** — see below |
| `node scripts/structure-audit.mjs` (repo root) | `structure-audit: passed (160 warning(s), 361 baselined)` |

The audit caught one violation of mine on the way through and I fixed it rather
than baselining it: my test imported `graph-store.ts` by file, and the rule
requires the directory's barrel (`storage/project/index.ts`). Typecheck also
caught a loosely typed test helper that vitest had happily run, since vitest
does not typecheck — worth remembering that a green suite is not a green build.

The 5 storage failures are all in `runtime-stream-store.test.ts`:
`EBUSY: resource busy or locked, unlink ...\project.million\project.sqlite`.
That file uses a **fixed** temp path, and several agents are running Core tests
concurrently in this one checkout, so two runs collide on the same SQLite file.
I did not assume it was unrelated — I re-ran that file alone and it passed
**10/10**, and my diff does not touch it or anything it imports.

Two runs also died inside `tinypool`'s own worker init (`RangeError: Maximum
call stack size exceeded`, then `Cannot read properties of undefined (reading
'toString')`). Per the standing instruction I re-ran alone before reporting;
both re-runs were green. Consistent with this machine's known faulty RAM and
with concurrent load, not with a code defect.

## Not verified

- **No live browser validation.** Everything here is Core-side: the store, the
  model and the executor against a registered test node runtime. The inserted
  node dispatches through `AutomationStudioNativeNodeRuntime`; a real
  web-domain action node against a real page is unexercised.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run whole**, only the
  narrowest relevant suites plus the structure audit. Running a repository-wide
  gate while other agents edit this same checkout would report false failures.
- **The gating gap in item 1 above is real and unfixed.** I confirmed the
  missing proposal requirement; I did not confirm the two `training-modes.ts`
  paths by execution, only by reading the two lists.
- **Multi-node paths and `returnToNodeId`-absent paths are covered by the parser
  and the builder but not by an executed run.** The run test exercises a
  single-node path that rejoins an End node.
- No provider or DeepSeek call was made, and no cross-repository change was
  needed; the web extension repository is untouched.
