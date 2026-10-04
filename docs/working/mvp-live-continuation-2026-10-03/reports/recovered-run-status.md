# Recovered coupon versus terminal run status

Status: Complete
Owner: resume-live-prep worker
Updated: 2026-10-03
Scope: Read-only causal trace of run-mut4fvkm-e2fc03e6; no status/verdict override.

## Current State

The coupon press (`s12`, Get coupons) failed with retryable `web.action.rate_limited`, effect unacted, then succeeded on retry_node attempt 2 after 250 ms. The final Add-to-cart (`s14`) action record is succeeded. All four final oracles held. Core nevertheless reports failed, result verification is null, and harness did not attempt repair, recording `llm.gate.known_recovery`. Lab correctly retains the healed coupon fault under recoveredFailures while preserving Core's failed status; a passed fixture oracle does not override the product's execution result.

This is **not proven to be a bad final-status reducer**. `executor/graph-run.ts` returns succeeded at graph completion and existing `executor/tests/ladder-run.test.ts` covers successful retry continuation. `service.ts` forwards `trace.status`. `persisted-flow-run.ts:539` reads Core run-detail summary status rather than inventing failure from historical attempts.

## Proven separate defect

Both canonical execution callbacks in Core service.ts (2624/2710 at inspection) select reverse().find(status failed) across the full trace. They can therefore pass the coupon's historical healed failure as `failedTraceAttempt` to runtime terminal recovery. Annotation calls `decideAutomationStudioRuntimeLlmInvocation` before its own action-attempt fallback; invocation correctly sees a deterministic retry available for that supplied retryable fault and refuses LLM as known_recovery. Annotation's fallback also selects historical failed/unknown attempts without filtering later same-node success.

Minimal repair: focused generic unresolved-attempt selector shared by those callbacks and annotation fallback, preserving all attempts and actual status. Ignore failed/unknown superseded by a later success of the same node; retain unknown without proven success, latest failure following success, unresolved other-node failure, and synthetic refuted-result failures. No unresolved attempt should retain the existing no_failed_attempt/provider-free refusal rather than bill speculative diagnosis. This fix improves cause selection; it does not establish why this run's graph was terminally failed.

## Terminal evidence gap

Privately inspected the full 16,102-byte/155-line core.log and structured snapshots. Core log has no trace.message, terminalFailureReason, currentNodeId or graph termination message; its relevant lines trace the build. Central flow snapshot omits edges and nonaction control attempts. The disposed isolated `.work` directory is empty, so the underlying durable trace cannot be read afterward.

Core already projects terminalFailureReason, message and currentNodeId into run-detail.metadata in service/summaries/conversions.ts. Lab discards those fields when composing the saved outcome. Additive projection of that bounded metadata is needed before a persistent replay; root supervisor owns that work. Preserve failed status, existing failure history and oracles. Do not speculate that a healed fault caused the terminal status.

One concrete mismatch warrants tracing: authoredNodes contains `s7` (Reject non-essential) without a playback action, while playback includes succeeded `s3` absent from authoredNodes; remaining action IDs align. Since snapshots contain no graph edges or control trace, this alone cannot establish graph reachability, revision identity or missing-End cause. Save and compare actual executed Flow revision/edges against authored snapshot before deciding.

## Suggested narrow verification

Core selector tests: healed same-node fault excluded; unresolved other-node retained; unknown excluded only by real later success; success followed by newer failure remains unresolved; synthetic result-refutation preserved; no IDs must not group unrelated attempts.

Real annotation boundary test in recovery/annotation/tests/ladder-fixes.test.ts: failed summary with healed coupon attempt/success stays failed and preserves both records, resolves no provider, reports no_failed_attempt rather than stale known_recovery. Genuine unresolved failures and existing refuted-result suites remain unchanged.

Lab provider-free test: terminal metadata and healed-aware unvisited diagnostics survive artifact projection without changing status/verdict; historical failed attempt no longer masks missing-node diagnostics. Then a persistent/provider-free replay of the saved actual Flow can expose the terminal trace. A new paid authoring run is not the narrowest way to diagnose this already-created Flow.

No source edits, checks, tests or provider/browser operation were performed in this read-only investigation. The separate released selector implementation will report its own validations.
