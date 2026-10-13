# t531 rooted candidate topology reachability

Status: Source/tests frozen; owning tests/types/audit passed; supervisor verification pending
Owner: codex-t517
Pair: task/t531-rooted-topology-reachability in both nested worktrees

Full canonical plan validation previously accepted an orphan helper cycle: the main entry called neither helper, but the helpers called each other, and the validator's global target set counted both as reached. It also accepted a candidate-external call target. Both regressions were observed fail-first before production edits: the orphan returned `ok:true`; the foreign-target check returned no issue.

The fix is confined to Core `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/plan/route-validation.ts`. It builds declared call dependencies, seeds entry roots from Router rules/fallback plus explicit handler registration nodes in recovery Subflows, and traverses calls only from reached callers. A visited set terminates traversal through shared or recursive dependencies. Disconnected helpers remain `bootstrap.subflow_unreachable`; unknown literal or dynamic/state-bound candidate targets now raise `bootstrap.unknown_call_target` at the exact `parameters.subflowId` path. Missing required parameters remain the node contract's refusal.

Candidate normalization in `flow-bootstrap/adaptation.ts` mints a declared symbolic target to its candidate-owned Subflow ID but leaves an unknown string as written. This validation refuses that unknown identity before normalization/execution instead of allowing a saved/foreign graph fallback. Runtime Call Subflow and bindings inside call inputs are unchanged. Canonical candidate Router rules have no enabled/status property: their parser refuses an added `enabled:false` field, and normalization creates active saved rules. The regression tests that actual contract; no new enablement field or general condition solver was invented.

Callable helpers need no Router rules. Reachable shared/nested helpers, repeated calls, explicit recovery registrations and their helper dependencies remain accepted. An unregistered recovery graph or a handler-like node in a utility graph does not invent a root. Rootless/unknown-entry plans cannot obtain an implicit primary entry. Exact duplicate-condition shadow semantics remain unchanged; distinct overlap is still allowed. Reached call cycles remain under normal frame-runner recursion safety rather than a new static ban.

Only three Core files changed: the validator, new `plan/tests/route-reachability.test.ts` and new `authoring/tests/rooted-calls.test.ts`. No helper/export/barrel, runtime loader/executor, candidate trial, held re-author, judge, UI, model guidance or downstream source changes. No source ownership expansion.

## Validation

- Paired worktree allocated through existing nextTaskId/createWorktree helpers with offline-only installs; no whole-workspace build wrapper. Parent restored only the public contracts prerequisite through its ordinary filtered cache. An initial test collection attempt before that prerequisite restored failed to resolve contracts and ran zero tests; it is not the fail-first result.
- Corrected test fixture invocation then reproduced both intended fail-first assertions against unchanged production source. The orphan cycle passed the full validator incorrectly; candidate-external string target had no diagnostic.
- Final owning selection: **66/66 passed across five files, exit 0**, 26.06 seconds. New reachability 12, new script/canonical parity 3, existing canonical validation 24, Router authoring 5 and state-aware authoring 22. Intermediate parity failures were a test script written with unsupported shorthand; changed it to the existing `call:` grammar without changing authoring source.
- Core `node scripts/structure-audit.mjs`: exit 0, 344 advisory warnings/1156 baselined; no new violation.
- Core `pnpm.cmd --filter fluxiq check`: exit 0, 55.33 seconds; package configuration checks source and tests. `git diff --check`: exit 0.

Exact owning rerun from `!FluxIQ/packages/fluxiq`:

`pnpm.cmd exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/plan/tests/route-reachability.test.ts src/programs/automation-studio/runtime/flow-bootstrap/plan/tests/validation.test.ts src/programs/automation-studio/runtime/flow-bootstrap/authoring/tests/routes.test.ts src/programs/automation-studio/runtime/flow-bootstrap/authoring/tests/state-statements.test.ts src/programs/automation-studio/runtime/flow-bootstrap/authoring/tests/rooted-calls.test.ts`

Scope is static candidate correctness. Tests prove acceptance/refusal and script/canonical parity, not detached helper execution, alternate-state result qualification or actual model factoring. Those remain the separately briefed executor/acceptance units. No browser/provider/live run, full suite, shared-document edit, user-panel/process management, override, commit, merge or push.

## Documentation and integration follow-up

Supervisor-owned architecture should state that candidate helpers are reachable by declared calls transitively from Router/fallback/recovery-registration roots, that candidate call targets must be literal declared keys, and that only runtime execution handles recursion limits. Preserve the distinction between static reachability and qualification of every reachable route. Root will merge current dev and t529 dependency into this pair before final integrated verification.
