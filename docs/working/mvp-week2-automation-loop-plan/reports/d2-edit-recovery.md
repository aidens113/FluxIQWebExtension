# d2-edit-recovery — `edit_recovery` durable application fails closed

Path prefix: `AS/` = `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`.

## Outcome

**Done.** `edit_recovery` no longer applies. Both durable appliers refuse it
before anything is written, each refusal was red first, and the runtime side is
pinned so it cannot start minting these adaptations again.

**I edited two files outside my brief's owned list** — `AS/runtime/service/adaptations/durable.ts`
and `AS/runtime/service/adaptations/patches.ts` — and created one test directory
there. Neither path is in the brief's "must not touch" list, and `git status`
showed no other worker in them. Details and reasoning in *Files outside my
brief* below. Flagging prominently so the supervisor can check.

## The defect, as observed

`edit_recovery` reached `applyFlowNodeAdaptationPatch`, whose `else` branch
wrote `node.parameterValues.recovery = { ...patch.after }`.

**Nothing reads that key.** No node definition declares a `recovery` parameter
(`builtin.policy.recovery` declares `strategy`, `maxAttempts` and
`fallbackActionDefinitionId`, and is a separate node wired by edges). Grepped
both repositories: `parameterValues.recovery` has no reader in Core, and none in
`apps/extension/src` or `domain/src` either. So the Flow ran exactly as before
while the adaptation was recorded `applied`, with a new graph revision, a
compiled artifact and a rollback patch — indistinguishable from a real repair.

The red run printed the whole thing. Applying an `edit_recovery` adaptation
resolved with:

```
"appliedTo": [ { "id": "node.action", "kind": "action_target" } ]   <- mislabelled
"appliedRevision": 2,  "status": "applied"
"inverseOperations": [ { "op": "set_node_parameters", "nodeId": "node.action",
                         "values": { "target": "#old" } } ]
```

The inverse operation is the proof: the only difference between before and after
is a `recovery` key nothing reads. It was also recorded in `appliedTo` as an
`action_target` change, which is a second false statement in the same record.

## The decision: fail closed, not implement

I chose **fail closed**, for three reasons that are facts about the code rather
than judgement:

1. **There is nothing to write.** A durable recovery path means inserting a
   `builtin.policy.recovery` node and wiring at least two edges. The store's
   graph transaction offers `set_node_parameters` and `add_edge` here; no node
   insertion, and no answer to where the `recovered` port should route.
2. **The patch shape cannot say what to build.** `edit_recovery` is produced
   with two incompatible meanings for the same field — `targetId` is a Subflow
   id from `temporary_recovery_subflow_call` and a node id from
   `temporary_action_sequence` (`AS/runtime/live-patch.ts:442,444`) — and an
   `after` of `{ actionDefinitionIds }` with no durable counterpart.
3. **The model cannot even record it.** `appliedTo[].kind` is
   `"router" | "subflow" | "expectation" | "action_target" | "instruction"`
   (`AS/model/flow-adaptation.ts:354`). There is no recovery kind, which is why
   the old code fell through to a wrong label. Adding one is a model change,
   outside this brief.

Implementing it would have meant inventing the durable semantics, a model field
and a graph operation in a file nobody has a test for. That is exactly the
"half-version that appears to work" the brief rules out.

## What I changed

| File | Change |
| --- | --- |
| `AS/storage/project/adaptation-store.ts` | `graphPatchOperationsForAdaptation` refuses `edit_recovery`; `isGraphTransactionCompatibleAdaptation` deliberately still claims it |
| `AS/runtime/service/adaptations/durable.ts` | `applyFlowAdaptationPatchDurably` refuses `edit_recovery` at the dispatch point |
| `AS/runtime/service/adaptations/patches.ts` | `applyFlowNodeAdaptationPatch` is now total: only the two kinds that write a parameter the executor reads; dead `recovery` write and `appliedTargetKindForPatch` deleted |
| `AS/storage/project/tests/adaptation-store.test.ts` | 1 test (red first) |
| `AS/runtime/service/adaptations/tests/durable.test.ts` | New file, 3 tests (1 red first) |
| `AS/runtime/tests/live-patch.test.ts` | 1 regression guard, green from the start, labelled as such |

**One subtlety worth checking.** `isGraphTransactionCompatibleAdaptation` still
returns `true` for `edit_recovery` even though the transaction now refuses it.
That is on purpose: `service.ts:5125` reads it, and returning `false` would send
the adaptation to the *file-based* durable applier instead, which cannot apply
it either **and records no audit event**. Keeping the claim means the refusal
happens inside `applyApprovedAdaptation`'s `try`, which writes an `apply_failed`
audit event a reviewer can read. Silence was the whole problem, so the refusal
had to be reached at the place that records it. The comment in the source says
this; the test asserts the audit event.

Both appliers were closed because both are live: `reviewFlowAdaptation` tries
the typed store first and falls back to the file path whenever the store returns
`null` (no runtime project pool, adaptation absent, or no graph revisions).
Closing only one would have moved the silent no-op rather than removed it.

`appliedTargetKindForPatch` was deleted rather than narrowed. Its final line was
`return "instruction"` for anything unmatched — a silent mislabel of the same
family. With the applier restricted to two kinds the target kind is now a
two-way conditional the type checker covers.

## Commands run and observed results

```
# RED 1 — the file-based durable path, before any source change
npx vitest run .../runtime/service/adaptations/tests/durable.test.ts
  -> Tests  1 failed | 2 passed (3)
    "refuses an edit_recovery patch instead of handing it to the Flow node applier"
    AssertionError: promise resolved "{}" instead of rejecting
    (the "{}" is the stub applier's return value — proof it was reached)

# RED 2 — the store's graph-transaction path, before any source change
npx vitest run .../storage/project/tests/adaptation-store.test.ts -t "edit_recovery"
  -> Tests  1 failed | 7 skipped (8)
    "refuses to apply an edit_recovery adaptation rather than writing a
     parameter nothing reads"
    AssertionError: promise resolved "{ adaptation: { …(28) }, …(3) }"
      instead of rejecting
    Received: status "applied", appliedRevision 2,
      appliedTo [{ id: "node.action", kind: "action_target" }],
      inverseOperations [{ op: "set_node_parameters", values: { target: "#old" } }]

# GREEN — the same two, plus live-patch, after the fix
npx vitest run live-patch.test.ts adaptation-store.test.ts durable.test.ts
  -> Test Files  3 passed (3)
     Tests  35 passed (35)
     (durable 3, live-patch 24, adaptation-store 8)

# Nothing else in the two owning areas regressed
npx vitest run src/programs/automation-studio/runtime/service/
  -> Test Files  10 passed (10)   Tests  85 passed (85)
npx vitest run src/programs/automation-studio/storage/project/tests/
  -> Test Files  22 passed (22)   Tests  124 passed (124)

# Core type check
npx tsc --noEmit                 -> exit 0, no output. Run twice, before and
                                    after the last edit; clean both times.

# Structure audit
node scripts/structure-audit.mjs -> structure-audit: passed (137 warning(s),
                                    256 baselined).
                                    "1 baseline entries can be lowered" — I did
                                    NOT run pnpm structure:baseline; other
                                    workers are mid-flight and regenerating
                                    would capture their states.

# Wider runtime suite
npx vitest run src/programs/automation-studio/runtime/tests/
  -> Test Files  1 failed | 24 passed (25)
     Tests  7 failed | 310 passed (317)
     All 7 failures are in service-flow-bootstrap-generation.test.ts. Not mine —
     see below.
```

## The 7 failures that are not mine, with the evidence

Every one is in `AS/runtime/tests/service-flow-bootstrap-generation.test.ts`,
all under `generateFlowBootstrapAdaptation`, and they fail the same way when the
file is run alone, so they are not load flakes.

The cause is another worker's in-flight change, landed as commit `66b1e2e`
("Give the loop a registry of harness options…") while I worked. That file is
**uncommitted and half-edited in the working tree right now**: `git diff` shows
`domainId: "test.domain"` being added to four `evidenceRuntime` fixtures, with
others not yet converted. The failing assertion is
`"flow_bootstrap.evidence_unknown_tool"` now arriving as
`"flow_bootstrap.evidence_invalid_configuration"` — a registry-validation
change, in `runtime/llm/**`, which my brief forbids me to touch and which none
of my files participate in. `git diff --stat` shows that worker also holds
`runtime/service.ts`, `runtime/recovery/**` and `runtime/tests/service.test.ts`.
No file overlaps mine.

## Files outside my brief, and why

My owned list was `AS/runtime/live-patch.ts` and
`AS/storage/project/adaptation-store.ts` plus their tests. The defect lives in
**two** appliers, and the d-five-fixes report named both:
`service/adaptations/patches.ts:52-55` **and** `adaptation-store.ts:382`. Only
the second was in my list. `AS/runtime/service/adaptations/**` is in neither the
owned list nor the "must not touch" list (`service.ts`, `recovery/**`, `llm/**`,
`*/api/**`), and `git status` showed no other worker holding it, so I fixed it
rather than leave the silent no-op live on the file-based path. I also created
`AS/runtime/service/adaptations/tests/`, which did not exist; no other worker
can have a stake in a directory that was not there.

If the supervisor intended that file to stay untouched, the two edits are small
and self-contained: the `edit_recovery` refusal in `durable.ts:97` and the
totality guard plus the deleted `appliedTargetKindForPatch` in `patches.ts`.

## Other patch kinds with the same shape — what I found

I checked every kind in both dispatchers, and the runtime switch as well.

**Already closed, confirmed not defective:** `edit_instruction` and
`promote_adaptation` throw in both durable paths; `create_subflow`,
`edit_subflow` and router-settings `edit_router` are refused by the store's
final `throw` and routed to the file applier, which applies them for real;
`edit_action_target` writes `target`, which node definitions declare and the
executor reads; `edit_expectation` writes `timeoutMs`, which
`builtin.policy.action`, `builtin.policy.expectation` and
`builtin.timing.timeout` all declare.

**Found, deliberately not changed, in rough order of how much it matters:**

1. **`retryCount` is written and never read.** `applyRuntimePatchToFlow`'s
   `temporary_wait_retry` branch writes `retryCount` onto the node, and
   `changePatchFromRuntimePatch` carries it into the durable `edit_expectation`.
   No node definition declares `retryCount` — only `maxAttempts`, on the
   recovery node — and neither repository reads it. So the flagship first test
   in `live-patch.test.ts` ("executes a successful temporary wait/retry patch…")
   passes a patch whose only field is `retryCount: 1` and asserts `validated`.
   **I decided this is not the same defect**, and the reason is worth recording:
   a `temporary_wait_retry`'s effect is the rerun itself — running the failed
   node again *is* the wait-and-retry — so the patch is not claiming a parameter
   write that did not happen. `edit_recovery` by contrast claimed a durable
   structural change and produced none. `retryCount` is a contract wart (a field
   the model may emit that nothing consumes), not a silent no-op. Renaming or
   dropping it is a product decision about the repair vocabulary.
2. **`appliedTo` is mislabelled on the store path.** `applyApprovedAdaptation`
   maps changed entities with
   `kind: entity.entityKind === "node" ? "action_target" : "router"`, so an
   `edit_expectation` applied through the graph transaction is recorded in
   `appliedTo` as an `action_target` change. It is a wrong label on a real
   change rather than a fabricated success, and fixing it properly means mapping
   each changed entity back to the patch that produced it, which is not 1:1 for
   a multi-patch adaptation. In my owned file; left alone deliberately.
3. **Node parameters are not filtered by the definition.**
   `node-execution.ts:109` passes the whole `parameterValues` map as
   `context.parameters`, so an undeclared key is carried to native executors and
   hosts rather than rejected. That is why the `recovery` write validated
   cleanly and survived a round trip. A structural check — reject a
   `parameterValues` key no definition declares — would have caught this defect,
   the `retryCount` one, and the next one of its kind, at the point of writing.
   That is a Core-wide change well outside this brief, and is the strongest
   candidate for a follow-up.

## Not verified

- **No live browser or end-to-end run.** Everything here is unit and
  store-level. The user-visible path (a reviewer clicking Apply on an
  `edit_recovery` adaptation in the panel and now seeing an error) was not
  exercised in a browser.
- **The file-based durable path is tested at the dispatcher only.** My
  `durable.test.ts` drives `applyFlowAdaptationPatchDurably` with stub
  collaborators, so it proves the refusal and that no applier is reached. It
  does not exercise `applyFlowAdaptationDurably` end to end against real Flow
  storage — there was no existing harness for that, and building one was wider
  than the fix.
- **No legacy data was migrated or inspected.** Adaptations already recorded
  `applied` from this defect keep that status and their `appliedTo` label. They
  can still be rolled back (the store's stored inverse operations path is
  untouched, and I kept `isGraphTransactionCompatibleAdaptation` true partly for
  that), but nothing marks them as having applied nothing. I did not look for
  any in a real project.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run whole.** I ran the
  structure audit and `tsc --noEmit` directly, plus the four suites above.
- **The "nothing reads `recovery`" claim rests on grep**, across Core and the
  extension repository, plus reading every node definition's parameter list. It
  is not an execution trace.
- **The 7 bootstrap failures were not reproduced at a clean HEAD.** I did not
  stash, because other workers hold uncommitted changes in the same tree.
  Attribution rests on the failing assertion matching that worker's own visible
  in-progress diff.

## Open questions for the supervisor

1. **Two of the files I edited were outside my owned list** (`durable.ts`,
   `patches.ts`). Confirm that was the right call, or revert those two hunks —
   in which case the file-based path keeps the silent no-op and needs its own
   brief.
2. **`edit_recovery` can still be created, just never applied.** The LLM change
   proposal surface still accepts it (`llm/harness/output-validation.ts:53`,
   `provider-result.ts:152`), so a model can still propose one, it will be
   stored, a reviewer can approve it, and Apply will fail with the refusal. The
   runtime no longer mints them. Whether the proposal surface should stop
   offering a kind nothing can apply is a product call.
3. **Item 3 in the findings above** — parameters not being checked against their
   node definition — is the mechanism that let this defect exist. Worth its own
   brief if standards are to be enforced by a check rather than by review.
