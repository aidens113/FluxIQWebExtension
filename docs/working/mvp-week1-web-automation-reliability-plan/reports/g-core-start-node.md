# g-core-start-node — a Flow without a declared start begins at its graph's root (Core)

Worker report, 2026-09-13. Core `F:\!FluxIQ`, branch `dev`, working tree on `604d0d3`
with `g-web-timeout-forwarding`'s uncommitted edits present and untouched. Nothing was
committed.

## Outcome

**Done, with two deviations from the brief's file list, both named below.**

- **The rule.** A run with no named start no longer begins at the first node in the list.
  It begins at the Flow's one Start node, or else at the one node that no edge enters. An
  unwired End node does not count while another root exists. Anything ambiguous is refused
  before any node runs.
- **The compiled plan.** Its `startNodeId` uses the same function.
- **The Lab's shape.** A recorded chain read back through the graph index now starts at
  candidate 1, proven through the real service, SQLite graph index and `getFlow`.
- **Mutation proofs.** Three mutations each fail the tests, and each file was restored
  byte-identical.
- **No explicit start is written at approval** (task 2). The reason is under Open questions.

## What changed and why

### 1. The start rule (`runtime/executor/start-node.ts`, new)

`chooseAutomationStudioStartNode(graph)` reads only node ids, definition ids and edge
endpoints, so a Flow document and a compiled plan give the same answer.

| Graph | Today, before this change | Now |
| --- | --- | --- |
| Exactly one `builtin.control.start` node | That node | That node (`declared`) |
| Several Start nodes | The first one listed, which after the graph index is the smallest id | Refused (`several_declared`) |
| No Start node, exactly one root | The first node listed, the smallest id, **not** the root | The root (`root`) |
| No Start node, one root plus unwired End node(s) | The first node listed, which could be the End node | The root that is not an End node (`root`) |
| No Start node, only End nodes as roots, exactly one | That node if listed first | That End node (`root`) |
| No Start node, several roots | The first node listed | Refused (`several_roots`), naming up to five roots |
| No Start node, no root (every node has an edge in, so a cycle) | The first node listed | Refused (`no_root`) |
| No nodes | Failed, "No start node is available in this flow." | Unchanged message (`empty`) |

- **What counts as an edge into a node.** An edge from another node the graph holds. A
  node's edge to itself (a retry loop) and an edge from a node the graph does not hold never
  make the node reachable, so neither counts.
- **An unwired End node.** An End node that no edge enters is a root only when no other
  node is, because a run that begins at End finishes there.
  - **Why this was added.** My first version counted it like any other root. The whole
    Automation Studio suite then failed one test:
    `runtime/tests/service-adaptation-subflow.test.ts:78`, "applies and reverts a
    parent-scoped adaptation against its explicitly owned Subflow graph", with
    `expected undefined to deeply equal { selector: '#new' }`.
  - **It was real.** Rerun alone, it failed the same way.
  - **The cause.** The test saves a Subflow graph of `action.submit` and an End node with
    no edge between them. That is two roots, so the run was refused. It used to pass only
    because `action.submit` sorts before `end`.
  - **What the change does.** It keeps that shape, a common one while authoring, starting
    at the working node without any id order. The test file is unchanged.
- **Why refuse rather than tie-break.**
  - No tie-break is free of id order. Positions exist on Flow documents but not on
    compiled plan nodes (`AutomationStudioCompiledPlanNode` has no position), and list
    order is id order once a Flow passes through the graph index.
  - A graph with several roots cannot visit every node, because a root is reachable only by
    starting there. So without an End node it already failed after running actions from an
    arbitrary node; refusing stops that before anything is dispatched to a page.
- **Refusal messages** (exact text, pinned by tests):
  - "This Flow has N Start nodes (a, b), so where a run begins is ambiguous. Keep one Start node."
  - "This Flow has no Start node, and N nodes have no edge into them (a, b), so where a run begins is ambiguous. Add a Start node, or connect those nodes."
  - "This Flow has no Start node, and every node has an edge into it from another node, so no node is where a run begins. Add a Start node."

### 2. Who uses it

- **`runtime/executor/graph-navigation.ts`.** The old `findStartNode`
  (`flow.nodes.find(start) ?? flow.nodes[0]`) is removed, along with its now-unused type
  import. It was internal: no barrel exported it, and nothing downstream imports it (grep
  over `F:\!FluxIQWebExtension` found nothing).
- **`runtime/executor/graph-run.ts` (outside the brief's Owns).** It now calls the new
  function and fails with its message (2 changed lines plus 1 import). Without this edit a
  refused graph would still fail, but with the misleading "No start node is available". No
  other worker touches this file.
- **`runtime/executor/index.ts`.** Exports `chooseAutomationStudioStartNode` and
  `AutomationStudioStartNodeChoice`. This is required: the structure audit counts an import
  from `runtime/compiled-plan.ts` into `runtime/executor/start-node.ts` as reaching past a
  barrel. Through `runtime/index.ts` the export is public in `fluxiq`, so a host (for
  example the Flow lane's start guard) can ask Core where a Flow begins instead of restating
  the rule.
- **`runtime/compiled-plan.ts`.** `startNodeId` is now
  `chooseAutomationStudioStartNode({ nodes, edges }).node?.id ?? null`, replacing
  `nodes.find(start)?.id ?? nodes[0]?.id ?? null` over the id-sorted `nodes`. The import was
  extended on its existing line, so no line cited in the framework reference moved.
  `runAutomationStudioCompiledPlan` is unchanged. A `null` start makes the graph run choose
  again, and it refuses with the same message.

### 3. Task 2: an explicit start at recording approval — not written

`appendRecordingProposalToFlow` (`runtime/service/recordings/proposal-candidates.ts`) does
know the order. It builds nodes in candidate order and chains them with `success` edges.
Even so, I did not make it write a start, for three reasons:

- **The only explicit start Core has is a `builtin.control.start` node.** A Flow has no
  start field. `AutomationStudioFlowArtifact`, the graph index and the compiled plan's
  inputs carry none.
- **Adding a Start node changes every recording-derived run.**
  - The Start node executes and records an attempt before candidate 1.
  - The runner check `g-runner-start-guard` is being built from the investigation's Fix 2
    ("the first attempt's `nodeId` is candidate 1's node"). It would fail every Flow-lane
    run.
  - It also changes node counts and attempt lists that Core tests assert
    (`proposal-candidates.test.ts` expects `graph.nodes` to have one node per candidate) and
    that the Flow lane's evidence reports.
- **The root rule already makes the order explicit in the graph.** A chain generated into
  an empty Subflow has exactly one root, candidate 1.

The file is unchanged. See Open questions.

### 4. Task 3: other readers of the id-sorted node list

Every reader found, and whether its order matters:

| Reader | What it does with the order | Wrong? |
| --- | --- | --- |
| `graph-navigation.ts` `findStartNode` | Took `nodes[0]` | **Yes: fixed** |
| `compiled-plan.ts:100` `startNodeId` | Took `nodes[0]` of a `localeCompare` sort | **Yes: fixed** |
| `compiled-plan.ts:86` node sort, `graph-store.ts:160` revision snapshot | Canonical order for `planDigest` and the graph revision digest | No. Id order is the intended canonical order, and changing it would change every digest. |
| `graph-run.ts` `hasUnvisitedAutomationStudioNodes`, `recordDeclaredStateBindings` | Set membership, and every node | No |
| `flows/store.ts:202` `replaceFlowGraphIndex`, `graph-patch.ts:62` | Delete-and-add operations | No |
| `graph-store.ts:51` `listNodesByIds`, the paged viewport query (`order by node_id limit ?`) | Lookup and stable paging; the canvas places nodes by `x`/`y` | No (display paging only) |
| Source editor output and the publication snapshot of an indexed Flow | Nodes appear in id order | Cosmetic only: stable but not authoring order. A published child run chooses its start with the fixed rule. |
| `chooseAutomationStudioEdge` over `exportSnapshotData` edges (`order by edge_id`, `graph-store.ts:190`) | When a node has **several edges on the same route**, the smallest edge id wins | Same kind of problem, not fixed. A recorded chain never has that shape, and choosing among duplicate routes is ambiguous by construction. Reported, not touched. |

### 5. Tests

- **`runtime/executor/tests/start-node.test.ts` (new, 13 tests).** Every graph lists its
  nodes in binary id order, as `order by node_id` returns them.
  - An unwired End node beside an action is skipped even though the id sort lists it first:
    the run's attempts are `["submit"]`.
  - A lone End node is still where an End-only graph begins.
  - The several-roots row includes an unwired End node that the refusal does not name.
  - A precondition row pins the id order itself. `entry.1` to `entry.12` lists `entry.1`
    first. `entry.2` to `entry.13` lists `entry.10` first. W15's shape (entries 4, 8, 13,
    14, 19) lists `entry.13` first.
  - A recorded chain begins at its first node, and the run visits it in chain order and
    succeeds. This runs for all three chains: `entry.1`–`entry.12`, `entry.2`–`entry.13`,
    and the W15 shape.
  - Several roots: refused with no attempt and no dispatched effect, and the exact message.
  - The five-name cap in a refusal message.
  - No root (a cycle): refused with no attempt, and the exact message.
  - A self-loop and an edge from a missing node do not count as edges in. The root is the
    node that sorts last.
  - One declared Start node wins beside an orphan node.
  - Several Start nodes: refused with no attempt.
  - An empty graph keeps its old message.
- **`runtime/tests/executor.test.ts` (outside the brief's Owns; 4 tests appended).** These
  are the compiled plan's rows:
  - a twelve-node chain at `entry.2`–`entry.13` compiles to `startNodeId` candidate 1,
    while `plan.nodes[0]` is `entry.10`, and `runAutomationStudioCompiledPlan` runs it in
    chain order;
  - a declared Start node that sorts last;
  - several roots give `null`, the plan still passes `assertAutomationStudioCompiledPlan`,
    and the run refuses with no attempt;
  - a cycle gives `null`.

  They were first written as `runtime/tests/compiled-plan.test.ts`. The structure audit then
  failed:
  `FAIL [directory-files] packages/fluxiq/src/programs/automation-studio/runtime/tests/: 26 source files exceeds the 25-file limit.`
  By the placement rule compiled-plan's tests belong in `runtime/tests/`, so the rows moved
  into the existing executor test there and the new file was deleted. The directory is back
  at 25.
- **`runtime/service/recordings/tests/proposal-candidates.test.ts` (1 test added).** It
  goes through the real service, and a synthetic mapper emits a candidate for each click:
  - three state snapshots and then twelve clicks are recorded, so the candidates sit at
    `entry.3` to `entry.14`;
  - the proposal is approved, and the primary Subflow graph is read back through `getFlow`;
  - the test pins that `getFlow` lists nodes in binary id order, and that the first listed
    node is **not** candidate 1 (it was `candidate.entry.10…` under the mutation);
  - `chooseAutomationStudioStartNode` returns candidate 1's node;
  - `runCanonicalAutomationStudioFlow`, the function the runtime session path calls, runs
    the Flow, which succeeds with attempts in candidate order.

### 6. Documentation

- **`docs/architecture/automation-studio.md`.** A new `### Where a run begins` subsection
  under Canonical Flow Foundation. It covers the rule, the refusal cases, compiled plans,
  and what a recording-derived chain means. No existing page described how a run chooses
  its first node, so this is now that page.
- **`docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md`.**
  Regenerated. The diff contains:
  - my two new rows, citing `start-node.ts:15` and `:40`;
  - `runAutomationStudioGraph` moving from `graph-run.ts:42` to `:43`;
  - the declaration counts;
  - **`RuntimeService` and `RuntimeServiceOptions` moving from `runtime/service.ts:28` and
    `:22` to `:29` and `:23`.** That shift is `g-web-timeout-forwarding`'s edit, which left
    the reference stale before I ran anything: `docs:check` failed first. Whoever commits
    last should regenerate the reference again.
- **`docs/architecture/package-boundaries.md`.** Not edited, per the supervisor's
  correction. The line to merge is below.

### Migration Notes line for the unreleased 0.4.0 entry (for the supervisor to merge)

Add `- runs a Flow that has no Start node;` to the entry's "Read the whole entry if a host"
list, and this paragraph:

> **A run with no named start begins where its graph says, not at the first listed node.**
> `chooseAutomationStudioStartNode` is a new export, and both a graph run and a compiled plan
> use it:
> - exactly one `builtin.control.start` node is where a run begins, as before;
> - with no Start node, a run begins at the one node no edge from another node enters, where an
>   End node no edge enters counts only when no other node does. It used to begin at the first
>   node listed, and a Flow read back through the project graph index lists nodes by id, so a
>   recorded Flow of more than ten entries could begin at a later action;
> - several Start nodes, several such roots, or no root now fail the run before any node runs,
>   with a message naming the case. They used to begin at the first node listed.
>
> A compiled plan's `startNodeId` follows the same rule and is `null` where a run would refuse,
> so a recompiled plan of such a Flow can have a different `startNodeId` and `planDigest`. A plan
> already compiled for a Flow revision is reused as stored, and keeps its earlier `startNodeId`
> until that revision is compiled again.

## Compatibility effect

- **Recording-derived Flows.**
  - **Start node and plan digest.** Where candidate 1's entry id did not sort first, these
    Flows now start at candidate 1. A recompiled plan gets a changed `startNodeId` and
    `planDigest`. That covers W15 (7 of 7 runs), W28 run 2, and any recording crossing
    `entry.9`/`entry.10` or `entry.99`/`entry.100` with the first candidate below the
    crossing.
  - **Already starting at candidate 1:** unchanged. The investigation measured W17, W18,
    W19 `expired`, W25, and W28 runs 1 and 3 as such.
- **Hand-built or imported Flows with no Start node.**
  - **Exactly one root:** they now start at that root rather than the smallest id. Where
    those differed, the start node and plan digest change.
  - **One working root plus unwired End nodes:** they start at the working root, which is
    what they got before only if it sorted first.
  - **Several non-End roots or no root:** they now fail before running, where before they
    ran from the smallest id.
- **Flows with several Start nodes:** they now fail before running.
- **Stored compiled artifacts:** not rewritten, and not invalidated. See Open questions.
- **Public surface:** additive only. There are two new exports, and no type or export was
  removed. The removed `findStartNode` was never exported.

## Commands run and observed results

All Core commands ran in `F:\!FluxIQ`. Heavy gates ran one at a time.

1. **First run of the three test files.** From `packages/fluxiq`:
   `npx vitest run .../executor/tests/start-node.test.ts .../runtime/tests/compiled-plan.test.ts .../recordings/tests/proposal-candidates.test.ts --no-file-parallelism`
   -> `exit=0`, `Test Files 3 passed (3)`, `Tests 21 passed (21)`.
2. **First `pnpm check`.** The three new files were marked intent-to-add in a copied index
   (`GIT_INDEX_FILE=<scratch>`) so the audit would see them.
   -> `exit=1`: `structure-audit: 1 violation(s)`, the `runtime/tests/: 26 source files`
   failure quoted above. Type checks did not run, because the audit fails first.
3. **Package type check.** `pnpm run check` in `packages/fluxiq` (`tsc --noEmit`) -> `exit=0`.
4. **The move.** The compiled-plan rows moved into `runtime/tests/executor.test.ts` and the
   standalone file was deleted. `ls runtime/tests | grep -c test.ts` -> `25`.
5. **Second `pnpm check`**, with a fresh scratch index holding `start-node.ts` and
   `start-node.test.ts`:
   - `structure:test`: `# fail 0`;
   - the audit passed, printing only the three pre-existing advisory warnings;
   - `packages/contracts check: Done`, `packages/client-gateway-websocket check: Done`,
     `packages/fluxiq check: Done`, `apps/web check: Done`;
   - `check exit=0`.
6. **Mutation proofs**, run by the scratchpad script `gcsn-mutations.mjs`. Each mutation
   edits one line, runs the three test files (start-node, executor, proposal-candidates;
   32 tests), and restores the file in a `finally`. The script was run twice, before and
   after the move, with the same kills; the results after the move:
   - **M1, `start-node.ts`: the root rule restored to first-by-id**
     (`const roots = nodes.slice(0, 1);`).
     - Result: `vitest exit 1`, `Tests 10 failed | 22 passed (32)`.
     - What failed: the `entry.2`–`entry.13` and W15-shape chain rows, the three
       compiled-plan rows, the four refusal and self-loop rows, and the service row.
     - The service row's failure:
       `expected 'candidate.entry.10.e9869a7a-…' to be 'candidate.entry.3.550afb81-…'`.
     - The compiled-plan chain's failure:
       `Expected: "recorded.candidate.entry.2.4f1c2d3e-0000-4000-8000-000000000002"` /
       `Received: "recorded.candidate.entry.10.4f1c2d3e-0000-4000-8000-000000000010"`.
     - **The brief's literal `entry.1`–`entry.12` row passes under this mutation.** The id
       sort already lists `entry.1` first, because `.` (0x2E) sorts before `0` (0x30). The
       rows that catch the regression are `entry.2`–`entry.13`, the W15 shape and the
       service row.
     - sha256 before and after: `69a9ea19…a586`, `identical=true`.
   - **M2, `compiled-plan.ts`: `startNodeId` restored to its old expression.**
     - Result: `vitest exit 1`, `Tests 3 failed | 29 passed (32)`, all three the compiled
       plan's `startNodeId` rows. One of them: `expected 'chain-a.1' to be null`.
     - sha256 `e4ae3dc7…fa49`, `identical=true`.
   - **M3, `graph-run.ts`: a refused choice falls back to `flow.nodes[0]`.**
     - Result: `vitest exit 1`, `Tests 4 failed | 28 passed (32)`: the three refusal run
       rows and the compiled plan's refusal run row. For example
       `expected [ { …(11) }, { …(11) } ] to deeply equal []`.
     - sha256 `462ac8c2…a44e`, `identical=true`.
7. **Docs gates.**
   - `pnpm docs:check` before regenerating -> `exit=1`,
     "docs/reference/framework-reference.md is stale".
   - `pnpm docs:reference` -> "Wrote … (1579 public declarations)"; diff as described above.
   - `pnpm docs:check` again -> `exit=0`: "Validated local links in 101 authored/reference
     Markdown files." and "Deterministic framework reference is current."
8. **Whole Automation Studio suite, first version of the rule.** From `packages/fluxiq`:
   `npx vitest run src/programs/automation-studio --no-file-parallelism`
   -> `exit=1`, `Test Files 1 failed | 108 passed (109)`, `Tests 1 failed | 809 passed (810)`.
   - The failure: `service-adaptation-subflow.test.ts:78`,
     `expected undefined to deeply equal { selector: '#new' }`.
   - Rerun alone -> `exit=1`, `Tests 1 failed | 3 passed (4)`, the same assertion. So it is
     real, not the RAM.
   - Fixed by the End-node rule in section 1. That test file was not edited.
9. **After the End-node rule: the four test files.** start-node, executor,
    proposal-candidates and service-adaptation-subflow, `--no-file-parallelism` ->
    `tests exit=0`, `Test Files 4 passed (4)`, `Tests 38 passed (38)`.
10. **`pnpm check` again,** with a fresh scratch index ->
    - `check exit=0`: `# fail 0`;
    - `packages/contracts check: Done`, `packages/client-gateway-websocket check: Done`,
      `packages/fluxiq check: Done`.
11. **Mutations again.** M4 added; the adaptation test was added to the file list from M4 on.
    - **M1 (first-by-id):** `vitest exit 1`, `Tests 11 failed | 23 passed (34)`. The new
      unwired-End row fails as well. sha256 `b2e0f63e…6516`, `identical=true`.
    - **M2:** `vitest exit 1`, `Tests 3 failed | 31 passed (34)`. sha256 `e4ae3dc7…fa49`,
      `identical=true`.
    - **M4, `start-node.ts`: an unwired End node counts as a root like any other**
      (`const startable = roots;`). `vitest exit 1`, `Tests 3 failed | 35 passed (38)`.
      - What failed: the adaptation test, the unwired-End row, and the several-roots row
        (whose message then names 3 nodes).
      - sha256 `b2e0f63e…6516`, `identical=true`.
    - **M3:** `vitest exit 1`, `Tests 4 failed | 34 passed (38)`. sha256 `462ac8c2…a44e`,
      `identical=true`.
12. **Docs again.** `pnpm docs:reference` -> `exit=0`, the new rows now cite
    `start-node.ts:15` and `:40`. `pnpm docs:check` -> `exit=0`, "Deterministic framework
    reference is current."
13. **Whole Automation Studio suite, final code.** From `packages/fluxiq`:
    `npx vitest run src/programs/automation-studio --no-file-parallelism`
    -> `exit=0`, `Test Files 109 passed (109)`, `Tests 812 passed (812)`, `Duration 303.31s`.
14. **Downstream grep.** `findStartNode|graph-navigation` over `F:\!FluxIQWebExtension`,
   excluding build output and docs -> no files.

No Lab command, no Core `pnpm build`, no commit.

## Not verified

- **Live Lab behaviour.** A Lab recheck must show all of the following:
  - W15 unarmed: the first attempt is the first click, and the chain runs click → switch →
    close → switch → click;
  - W15 `popup-blocked`: it meets the blocked click first;
  - a W28 recording of 11 or more entries: it starts at its first click;
  - with Core's workspace kept: `getFlow` lists a later candidate first while the first
    attempt's `nodeId` is candidate 1's node.

  Whether W15 then passes depends on `g-core-dispatch-deadline` / `g-web-timeout-forwarding`
  and on the tab close having its tab. That is not measured here.
- **The Core release-tree gates.** `pnpm test` over the whole repository and `pnpm build`
  were not run (build forbidden). Only the Automation Studio directory suite (item 8) and
  the root `pnpm check` ran.
- **Stored artifacts and hosts.** A compiled artifact stored before this change, for a Flow
  whose start changes, was not exercised. The web panel's handling of the new refusal
  message was not checked.
- **The full downstream suites** (test-runner, domain) were not run. Only the grep for the
  removed internal function was.

## Open questions or contradictions found

1. **Task 2 contradicts `g-runner-start-guard`.**
   - **Why.** Writing an explicit start at approval means adding a `builtin.control.start`
     node, which adds an attempt before candidate 1. The runner guard as designed ("first
     attempt is candidate 1's node") would then fail every Flow-lane run.
   - **What I did.** I left approval unchanged; the root rule already starts a recorded
     chain at candidate 1.
   - **If the supervisor wants a Start node anyway:** the runner guard must skip
     `builtin.control.start` attempts, and the count of attempts and nodes in Core and
     Flow-lane tests changes.
2. **Stale compiled artifacts.** `compileFlowRevision` returns an existing `ready` artifact
   for the same Flow revision and compiler version (`compiled-plan-store.ts:128-129`), so a
   plan compiled before this change keeps its old `startNodeId`.
   - **The clean fix:** bump `AUTOMATION_STUDIO_COMPILED_PLAN_COMPILER_VERSION` from
     `compiled-plan.v1` to `v2`, since the compiler's output changed.
   - **Why I didn't.** That changes a public constant and artifact ids that
     `storage/project/tests/compiled-plan-store.test.ts` and `content-store.test.ts` pin,
     and neither file is mine.
   - **What runs through it.** The Flow-lane run path (`runRuntimeSession` →
     `runCanonicalAutomationStudioFlow`) runs the Flow document, not a compiled plan, so the
     Lab is unaffected either way.
3. **Appending a recording beside existing nodes.** With `writeMode` other than
   `replace_recording_derived` on a non-empty Subflow, approval gives the graph a second
   root, and a run is now refused before it starts. Before, it started at the smallest id
   and failed on unvisited nodes. If appending is meant to extend the existing graph, the
   approval path should link the old chain's last node to candidate 1. That is a product
   decision, not done here.
4. **The End-node rule is my own design choice** (section 1), made so an unwired End node
   is not a refusal. The alternative is to refuse, and edit
   `service-adaptation-subflow.test.ts` to wire its End node. That test also asserts the
   exact `edges` array after a reroute, so wiring it would need further edits there.
5. **Duplicate edges on one route.** `chooseAutomationStudioEdge` picks among them in
   `edge_id` order after the graph index (section 4 above). It has the same shape as this
   defect and was not fixed.
6. **Brief defects.**
   - **The test ids.** The brief's `entry.1`–`entry.12` example cannot fail under a
     first-by-id mutation (M1 above); the defect needs the first candidate at a
     single-digit entry of 2 or more.
   - **Files outside Owns.** The Owns list left out `runtime/executor/graph-run.ts` (the
     caller that reports the refusal) and `runtime/executor/index.ts` (the barrel the shared
     rule must be exported through). The compiled plan's natural test home,
     `runtime/tests/`, is at its 25-file limit, so its rows went into
     `runtime/tests/executor.test.ts`.
   - **Structure baseline.** No baseline entry needs changing.
