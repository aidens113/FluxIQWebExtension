# P2 detached execution worker report

Status: Partial; detached adapter implemented, facade/receipt integration pending
Created: 2026-10-06
Owner: p2-detached-execution worker (t300)
Scope: New Core adapter, owning tests, verification barrel; supervisor owns integration.

## Current State

- Status: source frozen for supervisor independent verification; final validation recorded below.
- Ownership: Core `runtime/flow-bootstrap/verification/detached-execution.ts`, its owning test, verification barrel; this downstream report only. Controller/contracts remain frozen.
- Design approved by supervisor: canonical revalidation/normalization, normal router and composite graph executor, no accepted store/apply calls, stable candidate namespace, existing native/effect authorization retained, full execution only, cancellation/fresh identity checks, no LLM/patch recovery.
- Command attribution is not wired: receipts deliberately contain no commands. Successful graph/node execution is not evidence of a lasting action or subject provenance. Create cannot promote with this adapter alone.

## Findings

- Router host observation failure normally falls back to caller state. Adapter refuses missing fresh host state when routing reads `state.*`.
- Normalizer generates new subflow graphs with blank execution defaults. Adapter carries trusted parent execution defaults so composite executor retains its normal domain authorization intersection.
- Normal graph/composite executor accepts native/effect dispatch boundaries; adapter preserves those, does not invent an authorize-all runtime.
- Existing effect callback supplies effect payload and cancellation/withheld-values context, but no node/attempt ID or trusted subject receipt. Native callback supplies node, inputs, cancellation, host context but also has no durable command acknowledgement. Neither saved trace node success nor a model output can fill this gap.

## Validation

- First checks exposed test fixture mistakes (route condition field names, custom native input port, host capabilities). Corrected fixtures to actual normal contracts. Native/effect fixtures also initially assumed identical signal object; normal region execution supplies a derived cancellation signal, so fixtures assert propagation/outcome instead.
- First complete detached owning file: 24/24 pass. Expanded verification directory: controller 31 + detached 26 = 57/57 pass. Final post-execution owner-read failure coverage: 58/58 pass across 2 files (18.90s), including 27 detached adapter tests.
- Final frozen-source fluxiq typecheck passed exit0, executed/stamped (17.041s). Final frozen-source Core structure audit passed exit0 (279 advisory warnings, 349 baselined).
- No provider calls, browser/live validation, full suites, storage writes, commits or merges.

## Contract and integration seam

`runAutomationStudioDetachedCandidate` consumes the trusted candidate owner record (revision/digest/base/buildPlan), exact verification identity, accepted parent snapshot, prepared start receipt, currentIdentity callback, current registry/resolution, pinned published snapshots and normal graph options. It clones graph artifacts before awaits, revalidates without permitting compiler rewrites, and normalizes IDs from project/flow/revision/digest, independent of run ID. Existing parent graph nodes are never read for execution. Only the router-selected submitted subflow executes; observation requirements must relate to that requested outcome rather than demand outputs from unselected branches.

The return holds `{ receipt, code?, trace?, route? }`. `receipt` is the controller's existing execution contract; trace/route are internal saved runtime evidence, not safe to dump as raw stdout/API logging. `executedNodeCount` counts root graph attempts, not confirmed effects or nested child actions. A failed identity read after execution preserves completed trace and count while refusing acceptance. Waiting, cancellation, max-step termination, no route, unavailable routing host state and partial-start/stop requests never return a succeeded receipt. State routing needs a fresh host observation; supplied caller state cannot substitute.

Supervisor's controller execute port can call the adapter and return `result.receipt`, retaining `result.code/trace/route` under its session diagnostics. Bind its currentIdentity to the same durable candidate/requirements/base owners as the controller. Supply the same normal runtime host/native/effect options used by service; adapter forces zero repair/LLM budgets, no approved patches and one attempt rather than invoking apply/repair code. Parent execution defaults keep normal authorization intersection. No automatic permissions are granted here.

## Required command attribution before create promotion

The existing effect boundary lacks node/attempt attribution and durable action acknowledgement. A follow-up must carry candidate identity/run/start, stable graph/node/attempt path, domain-issued command ID, authoritative subject IDs, acknowledgement outcome (`performed`, `withheld`, `no_op`, `unknown`) and completion time from the actual dispatch boundary. Native execution already has node context but needs the same trusted acknowledgement. Observer newness must independently cite that exact command plus start observation and page generation. Keep receipts in run/session evidence; never read subject IDs or success claims out of builder/model-authored parameters, trace node succeeded status or ordinary outputs.

Until that trusted dispatch adapter is wired, commands stay empty and create remains unknown. Ensure can only verify supported independently observed final-state predicates. Controller original-intent interpretation, prepared-start reset/observer adapters, durable candidate storage/CAS/idempotency, accepted graph promotion and service facade wiring remain unimplemented by this bounded task. Normal native/effect operations may affect their permitted target; detached means no accepted graph persistence, not dry-run actions. Cancellation inside host/native callbacks uses normal executor cooperative/region-bound semantics; this adapter adds no independent browser reset or transport cancellation protocol.

## Supervisor verification

Reviewed exact normalization/router/runtime boundaries and retained trace/error limits. Independently ran verification directory58/58 before integration and again58/58 after current dev merge (15.31s); touched fluxiq typecheck executed/stamped0 (39.15s). Infrastructure exported from flow-bootstrap barrel; production interpreter/start/oracle/commands/durable promotion joins remain absent. No provider call or accepted graph write.
