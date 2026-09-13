# g-core-host-state-node — the after-action capture and state diff get the executed node (Core)

Worker `g-core-host-state-node`, 2026-09-13. Core working tree at `f22f401` (clean before this
edit). No commit.

## Outcome

Done. `enrichAttemptWithHostState` now takes the executed node as its first argument and hands
that node, with its resolved `parameterValues`, to the `after_action` capture and to
`inspectStateDiff`. Every caller passes the node the `before_action` capture already received.
Before-action behaviour is unchanged. The new rows fail under the stub-node mutation and pass
with the fix; the restored file is byte-identical to the fixed version.

## What changed and why

All paths under `F:\!FluxIQ`.

- **`packages/fluxiq/src/programs/automation-studio/runtime/executor/host-state.ts`**
  - `enrichAttemptWithHostState(node, attempt, options, beforeAction, hostCapabilities)`: new
    leading `node: AutomationStudioFlowNode` parameter.
  - The stub `{ id: attempt.nodeId, definitionId: attempt.definitionId, parameterValues: {} }` is
    gone; `captureHostState(... point: "after_action")` and `inspectStateDiff({ ..., node })` use
    the passed node.
  - A three-line comment says why: a host keys its capture or diff on which action ran.
- **`.../runtime/executor/node-execution.ts`**, all four callers:
  - the pinned-version failure (`:56`), the not-executable failure (`:78`) and the
    `catch` failure (`:112`) pass `executionNode`, which is the node with resolved parameter
    values (every one of these branches is reached only after resolution succeeded; the
    missing-path branch at `:39` returns before any capture, as before);
  - `finishAttempt` (`:137`) passes its own `node`, which its callers already set to
    `executionNode` (`:72,76,110`).
- **`.../runtime/executor/tests/node-execution.test.ts`**: a new `describe("what the host is told
  after the action")` with 5 rows. Added to the executor's own `tests/` folder (5 files), not to
  `runtime/tests/`.
  - The node is `builtin.policy.action` with `outputId: "activate-element"` and a state-bound
    `parameters.selector` (`$state` `run.supplied.selector` -> `"#confirm"`), so a row proves
    both the `outputId` and that parameters arrive resolved. The recording host
    `structuredClone`s each node at the call.
  - **Success row:** the captures equal exactly `[before_action: executed, after_action:
    executed]`, the diff receives `[executed]` with `parameterValues.outputId ===
    "activate-element"`, and the attempt carries `stateRefs.afterAction` and `stateDiff`.
  - **Failure rows (`it.each`):** the dispatch returns failed (via `finishAttempt`); the
    dispatch throws (the `catch` branch); the node pins `2.0.0`; the node is not executable
    (`importer.example.unregistered`). Each asserts the attempt's failed status and exact
    message, `stateRefs.afterAction` and `stateDiff` present, and that every `after_action`
    capture and every diff received the executed node.
  - The `outputId` is Core-neutral (`activate-element`), not a web id, per Core's boundary rule.
- **`docs/architecture/package-boundaries.md`**, the unreleased `0.4.0` entry:
  - one paragraph, "A host runtime is told which node ran after the action, as it is before
    it.", saying `after_action` and `inspectStateDiff` now receive the node with resolved
    parameter values on every path that captures after the action, that they used to receive
    only `id` and `definitionId` with empty `parameterValues`, and that an unresolved node is
    still not captured;
  - one bullet in the entry's "Read the whole entry if a host:" list: "binds a host runtime's
    `captureStateSnapshot` or `inspectStateDiff`". This is one line beyond the brief's "one
    paragraph", inside the owned entry, so a host that binds those reads the note.
- **Framework references:** regenerated; neither changed (the function is not exported).

## Commands run and observed results

All from `F:\!FluxIQ`, output redirected to scratch files, exit status echoed.

- `sha256sum host-state.ts` after the fix -> `f8b04857...c13b8493b`, saved as the mutation
  baseline.
- `npx vitest run .../executor/tests/node-execution.test.ts .../runtime/tests/executor.test.ts
  --no-file-parallelism` (from `packages/fluxiq`) -> exit 0; `Test Files 2 passed (2)`,
  `Tests 34 passed (34)` (19 and 15). `executor.test.ts` was added because it also binds
  `captureStateSnapshot` and `inspectStateDiff`.
- **Mutation:** inserted `node = { id: attempt.nodeId, definitionId: attempt.definitionId,
  parameterValues: {} };` as the first line of `enrichAttemptWithHostState`, restoring the stub
  for both the capture and the diff. `npx vitest run .../node-execution.test.ts
  --no-file-parallelism` -> exit 1; `Tests 5 failed | 14 passed (19)`. The failing rows are
  exactly the 5 new ones:
  - "hands the after-action capture and the diff the node that ran, ..." -> `expected [ …(2) ]
    to deeply equal [ …(2) ]`;
  - "... when 'the dispatch fails'", "... 'the dispatch throws'", "... 'the node is not
    executable'" -> `expected [ { id: 'output', …(2) } ] to deeply equal [ { id: 'output', …(2) }
    ]`;
  - "... 'the node pins a version Core does not…'" -> `expected [ { id: 'output', …(2) } ] to
    deeply equal [ { id: 'output', …(3) } ]`.
- Restored with Edit; `sha256sum -c` -> `host-state.ts: OK`, exit 0.
- The same two test files rerun after the restore -> exit 0, `Tests 34 passed (34)`.
- `pnpm check` -> exit 0; `structure-audit: passed (123 warning(s), 256 baselined).` No warning
  names a changed file. `tsc --noEmit` Done for `packages/contracts`,
  `packages/client-gateway-websocket`, `packages/fluxiq`, `apps/web`. No new file, so no scratch
  `GIT_INDEX_FILE` was needed.
- `pnpm docs:reference` -> exit 0, "Wrote docs/reference/framework-reference.md and
  packages/fluxiq/docs/reference/framework-reference.md (1579 public declarations)."
- `pnpm docs:check` -> exit 0, "Validated local links in 101 authored/reference Markdown files.
  Deterministic framework reference is current."
- `git status --short` -> exactly the four files above modified; nothing untracked.

Every result above was a single observation; none was uniform or impossible, so none was rerun
for the RAM rule. The post-restore rerun was a check, not a retry.

## Not verified

- **`runtime/tests/service.test.ts`:** its two host-state rows (`:1019-1048`,
  `:2695-2720`) were not run; they read only `node.id`, `attemptId` and `point`, so they should
  be unaffected. The supervisor's full suite covers them.
- **No full suite, no `pnpm build`, no Lab run**, by instruction. The Lab Core needs a new build
  and pin containing this change.
- **The domain side** (`f-host-runtime-policy-action`) was not read or run with this change.
  Without it, a recorded Flow still gets no `stateRefs`.
- **What a Lab run must show**, with this commit and `f-host-runtime-policy-action` both in the
  pinned builds: one `lab run --flow` of `product-catalog`, default variant,
  `FLUXIQ_TEST_ENV_FILES=none`.
  1. In `snapshots/flow-lane.json`, every web action's `evidencePackets` has both
     `beforeAction` and `afterAction`.
  2. The run detail's attempts carry `metadata.stateRefs.stateDiff` as a `web-state-diff.v1`
     that does not claim every element removed.
  3. `evaluation.json`: one `sanitizedPacketBytes` entry per packet, each ≤ 6,000, and
     `truncationCount` equal to the packets flagged `truncated`.
  4. The redaction attestation reports 0.
  5. The Flow's statuses and `comparisonStatus` values are unchanged from stage2d.
- **Leak check on a secret-bearing run:** the after-action host now receives resolved
  parameter values. The before-action host already did, so no new kind of value reaches the
  host. But whether the domain's snapshot dispatch copies any node parameter into a saved
  command attempt without `withheldValues` was not read. Repeat step 4 on an `auth-gate` or
  `sensitive-input` run.

## Open questions or contradictions found

1. **Line endings:** `git ls-files --eol` shows `host-state.ts` as `i/lf w/lf` while the other
   three files are `i/lf w/crlf` (`core.autocrlf=true`). The index is LF for all, and
   `git diff --stat` shows 5 changed lines, so content and the committed form are unaffected. I
   cannot tell whether the working copy was already LF before my edit.
2. **The migration note's audience bullet:** added beyond the brief's single paragraph (see
   above). Remove it if the supervisor wants the entry's list unchanged.
3. **Secret exposure after the action:** see the leak-check item under Not verified. It is a
   question for the domain's dispatch, not for this Core change.
