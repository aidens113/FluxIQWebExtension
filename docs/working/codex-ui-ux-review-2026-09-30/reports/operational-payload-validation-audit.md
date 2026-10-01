# Operational payload validation audit

Status: Complete — read-only, bounded implementation proposed
Owner: deployment_docs_audit worker
Date: 2026-10-01

## Written brief

- Keep Docs tree product/tests frozen for supervisor review. Read only exact Core live-views/background-tasks.tsx, compute-control.tsx and production-runner.tsx plus their rendered payload type declarations and directly owning recovery/freshness tests.
- Parent Current State supplies coordination. Earlier operational-refresh/useOperationalSnapshot lifecycle and Production parameter policy are verified; do not duplicate or change them.
- Determine rendered malformed collection-member or optional nested-field crashes/false empty success after top-level-only snapshot validation. Record exact paths/lines and minimally required rendered shape, preserving legitimate optional fields and zero/false values.
- Propose exact coherent validators/helper paths only when needed; no backend/API/wire/polling/lock/parameter changes or source edits. Distinguish source-confirmed behavior from unexecuted browser hypotheses.
- Write progressively here with prioritized defects, exact tests-first plans and remaining uncertainty. No actual payloads, protected runtime/storage/conversations/context-packet reads, broad checks, browser/provider/panel activity, commits or shared documents.

## Evidence and limits

Read parent Current State, exact background-tasks.tsx/compute-control.tsx/production-runner.tsx, each program's types.ts and api/contracts.ts, and directly owning Background/Compute/Production freshness plus Production parameter recovery test cases/fixtures. Inspected only the small rendered shared helper sections needed to trace countdown/log/JSON consumers. No protected runtime/storage files or actual response data inspected. Findings are source-confirmed execution paths, not run component reproductions or browser outcomes. No execution tests/types/build ran.

Existing recovery/freshness tests cover owner fences, polling/read lifecycle, failure retention, selection, locks and parameter policy. They do not exercise malformed collection members. Preserve those behaviors and requirements. A valid top-level array is currently treated as sufficient even when its members cannot render safely.

## O1: Compute collection members and nested arrays bypass validation

compute-control.tsx:13 checks only that nodes/commands/leases are arrays. At28 node.capabilities is accessed in flatMap; null nodes fail immediately. At33-34 malformed capabilities/domainIds fail includes/join during filter/search. Selected detail unconditionally calls domainIds.join and capabilities.map/length. At41-42 null command/lease entries fail when their target IDs are accessed; command.kind.replaceAll later fails for missing/non-string kind. Rendered label/host/status/error/holder/purpose values that are objects can trigger invalid React-child errors. A malformed optional metadata value can produce meaningless keys instead of a truthful metadata presentation.

Minimal rendered constraints proposed:

- Snapshot: non-null non-array object with nodes/commands/leases arrays; reject an invalid member rather than silently dropping it and announcing no nodes/activity.
- Node: object; id/label/status strings (empty label remains valid for id fallback); domainIds/capabilities string arrays, including valid empty arrays; optional host string; optional finite lastHeartbeatMs, including0; optional metadata object containing JSON-compatible unknown values. Unknown string statuses remain renderable transitional/degraded values; do not tighten to enum membership as an unrelated protocol change.
- Command: object; id/targetComputeId/kind strings; finite createdAtMs; optional status/error strings. kind must be a string because replaceAll consumes it, but permit custom/future string values as current fixtures do. Unrendered claimed/completed times and payload/result do not require invented validation.
- Lease: object; id/computeId/holder/purpose strings; finite expiresAtMs, including0. No uniqueness, authorization, capability allowlist or heartbeat threshold changes.

## O2: Background accepts malformed tasks, a truthy fake scheduler and unsafe run pages

background-tasks.tsx:16 accepts tasks array and any truthy scheduler. A scheduler={} or string is interpreted as paused via Boolean(snapshot.scheduler?.running), presenting an unsupported successful scheduler state. Null task members crash filter/sort/selection and summary immediately. Nonboolean enabled produces misleading filters/run availability; object name/queue/schedule can become invalid React children.

At17 validPage checks only runs array and total/limit/offset scalars. runs:[null] fails selectedRun lookup/map; malformed run.id later fails selectedRun?.id.slice. Object status/error fields become invalid React children. Current runTask also publishes result.payload without checking it, so malformed mutation success can enter selected detail even when the page validator is repaired. This specific response check can be added without changing locks/POST envelope/action acceptance semantics.

Minimal rendered constraints proposed:

- Snapshot: tasks array of object definitions; scheduler object with running boolean. Do not require snapshot.runs or pollIntervalMs solely to satisfy the complete backend declaration: current frontend does not consume them and accepted freshness fixtures intentionally omit both.
- Task: id/name/queue strings; enabled boolean; optional schedule string; optional finite intervalMs/lastRunAtMs; nextRunAtMs permits undefined/null/finite numbers. Keep0/false/empty string valid. No schedule-format/minimum interval/enabled-action policy change.
- History page: existing integer nonnegative total/offset and limit50; runs array of valid rendered run objects. Optional page.task is not used for rendering, so do not invent a new dependency on its presence. Do not add query total/offset consistency constraints unless separately justified.
- Run: id/taskId/status strings; finite queuedAtMs; optional finite startedAtMs/finishedAtMs; optional error string; payload accepts JSON-compatible values the renderer can summarize, not arbitrary cyclic/function/class objects. Declared payload is JsonObject, but a minimal rendered guard must not reject harmless scalar results simply to strengthen an unneeded wire restriction. Unknown status strings remain representable via StatusBadge.
- Mutation result.payload, if present, must satisfy the same run guard before selection. Invalid payload must not crash or be silently presented as a confirmed run detail; accepted action acknowledgement and snapshot confirmation stay separate. Prefer retain prior detail plus fixed diagnostic/recovery feedback, never automatically replay a task.

## O3: Production accepts malformed targets/runs/executions before derived render work

production-runner.tsx:15 only checks arrays. Null targets fail targetOptions.filter at49; null runs fail activeRuns.filter at60. newestProductionLogRows executes on every view render, so malformed executions can crash even while Console displays Workloads. The referenced flattenRunLogs uses executions.length/map and execution.loop/atMs/ok/error/result; executions:[null] or a non-array with length fail. Object target.name/description/domainId, run.name/status or execution.error can become invalid React children. Nonfinite numeric fields produce unsupported timestamp/progress/sorting output.

Minimal rendered constraints proposed:

- Target: object with id/name/type strings; domainId permits undefined/null/string; optional description string; optional metadata object. Preserve unknown target type strings as displayed metadata rather than reject future registrations. Do not inspect/normalize parameterSchema here: its verified dedicated policy must continue reporting unsupported/invalid declarations and retaining drafts.
- Run: object with id/name/status strings; optional targetType/targetId strings; optional finite loopsTotal/loopsCompleted/startedAtMs/updatedAtMs; nextRunAtMs permits undefined/null/finite numbers. Keep loops0 and optional absence valid; do not add workload policy or percentage clamping. Optional metadata object must permit its message value to retain existing String(...) rendering semantics rather than demand a string solely because it is displayed.
- executions absent is valid and uses summary row; when present it must be an array of non-null objects with finite loop/atMs, boolean ok, optional error string and JSON-compatible result. Empty execution arrays are valid. Do not require result to be an object: production-freshness already intentionally renders result:"external completion".
- Unrendered domain/flow/task IDs, stop/wait fields and metadata properties do not gain artificial constraints. Exact row/optional checks should reject malformed success through existing operational snapshot error recovery, retaining last confirmed same-owner data and drafts.

## Compatibility-safe validator design

Reject entire invalid snapshot/page rather than filtering invalid rows into false empty success. A missing required rendered field is failure; legitimate optional absence, null explicitly declared for timestamps/domainId, zero, false and empty collections remain valid. Preserve unknown displayable status/type/kind strings. Do not change enums, defaults, backend data, action locks, request counts, polling/backoff, owner identities, launch metadata or parameter policy.

Use focused presentation guards, not a claimed full protocol/security/schema validator. The fact that unrendered required backend fields may be omitted in frontend compatibility fixtures must remain explicit. JSON received over the real wire cannot contain functions/cycles/BigInt; a recursive JSON-compatibility helper is only justified if tests/providers can supply such non-wire values and the renderer's shortJson needs defensive protection. Avoid gratuitous traversal of arbitrary private payloads or logs. No raw bad payload/error dumping.

For optional JSON summary values, null/undefined/false/0 are currently rendered by shortJson as a dash. This existing display choice is separate from payload-shape recovery and should not be silently changed by validators. Likewise heartbeat0 currently means offline/Never; accepting0 preserves policy rather than claiming it is a live heartbeat.

## Proposed exact implementation ownership after release

Three presentation validators warrant one cohesive directory with one exported owner per file and a barrel, not additional helper duplication inside already busy views:

- programs/operational-payloads/validateComputeSnapshot.ts, validateBackgroundSnapshot.ts, validateBackgroundRunPage.ts, validateBackgroundRun.ts, validateProductionSnapshot.ts and index.ts.
- One small primitives.ts module only if needed for shared record/string-array/finite/optional JSON predicates; obtain exact ownership before creating it.
- Owning operational-payloads/tests/{validateComputeSnapshot,validateBackgroundSnapshot,validateBackgroundRunPage,validateBackgroundRun,validateProductionSnapshot}.test.ts or a nearest owning combined validators.test.ts when it materially avoids repeated fixtures.
- Exact existing live-views/{compute-control,background-tasks,production-runner}.tsx integration only replaces local validators and guards Background selected mutation payload. Lifecycle, parameters and action routing unchanged.
- New live-views/tests/operational-payload-recovery.test.tsx covers actual view recovery. Existing freshness/selection/operations/parameter tests remain unchanged; root owns global source-contract reconciliation if names move.

This is proposed ownership, not permission to create files. A supervisor may choose separate view-owned validator directories instead; do not broaden paths without an exact release.

## Tests-first plan

1. Reproduce against actual views with synthetic API fixtures: null member in each rendered collection; missing/non-array Compute domains/capabilities; non-string command.kind; fake scheduler; unsafe history member/id; Production executions non-array/null member. Never use actual production payloads.
2. Pure guards reject those exact unsafe shapes plus wrong React-child types/nonfinite rendered numbers, and accept complete and minimal compatibility fixtures with optional absence/null/zero/false/empty collections/custom status/kind/type/scalar execution.result. Preserve invalid parameterSchema acceptance at snapshot level and its existing dedicated policy feedback.
3. Initial malformed success produces unavailable/recovery feedback rather than false no-content success; malformed refresh retains prior current-owner selection/drafts/detail, marks freshness failure, and direct manual retry confirms corrected data. No added POST/polling loops or automatic mutation replay.
4. Background malformed history preserves confirmed prior run page; wrong mutation run payload cannot crash detail or erase accepted-action context. Same-owner and current-query lifecycle requirements remain covered by unchanged existing freshness tests.
5. Run narrow helper/view plus unchanged freshness/selection/operations/parameter checks through heavy after release, followed by scoped strict types. Freeze and return observed evidence for supervisor verification. No broad/live gates belong to this worker.

## Return

Only this worker report changed. Highest priorities are immediate null/nested-array crashes and scheduler false-success state; no runtime reproduction or browser certification claimed. No product/tests changed, no gate ran, and no backend/API/polling/lock/parameter policy change is requested.
