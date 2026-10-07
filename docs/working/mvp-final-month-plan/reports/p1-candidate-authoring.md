# P1 explicit candidate authoring

Status: Partial; source frozen for serial integration
Created: 2026-10-06
Owner: p1-candidate-authoring worker (t299)
Scope: Opt-in Core discovery/submission vertical slice; no provider/live calls.

## Current State

Provisioning complete per supervisor. Main Current State, P1/P2 revision and original consultant Core audit read; binding Core rules retained from t296 and code-structure methodology inspected before adding source. Supervisor approved exact ownership and API flag choice. New candidate controller and discovery wrapper implemented; 89 owning/legacy tests pass and final candidate regression 7/7 passes. Service facade remains untouched until serial integration; precise invocation patch will be supplied to supervisor.

## Decisions and ledger

- `authoringMode: "candidate"` request flag requires evidenceGuided:true; omitted preserves legacy.
- New flow-bootstrap/candidate owns session-local complete submissions and static receipts. Uses current completion compiler, schema validation, domain parameter/handle resolver and permission hooks without draftSteps; static validity stays draft, promotionAllowed:false.
- Revisions assigned by Core for every submission; invalid submission clears latest candidate. Canonical plan + accepted base digest fingerprint uses SHA-256; changes report path diffs. Current snapshots are cloned, discovery never mutates candidate.
- Evidence loop adds discoveryOnly opt-in requiring draft:false. No action enters draftRecord; no keep/openers/act completion. Legacy draft:false transcript unchanged.
- Explicit core.submit_candidate tool uses full Flow script or current JSON plan. Completion references latest revision/digest; no builder-authored semantic acceptance.
- Provider-free harness discovers a wrong turn then submits/revises multi-node candidate, proving no amend/add grammar and no wrong-turn contamination. Cancellation and stale handles covered.

## Outstanding

Supervisor must integrate serial facade, draft result/API/persistence contract, and a real service-level scripted regression. Exact invocation template below preserves purse/signal/accounting. Final frozen-source typecheck passed. P2 exact detached runtime execution and durable draft/receipt joins remain separate required work. No promotion claimed.

## Serial facade integration patch (supervisor-owned, not applied)

IMPORTANT: integrate the request flag parser and this facade branch atomically. Until the branch is installed, service.ts does not read authoringMode and would enter legacy authoring despite the flag. This task is not complete or safe to expose solely by merging the parser/modules.

1. Add `runAutomationStudioFlowCandidateAuthoringLoop` to the existing flow-bootstrap barrel import in service.ts.
2. Read `authoringMode` with the existing generation-request destructuring (line 1481 in t299 baseline).
3. Insert the following branch after personNeeded creation, before the legacy `if (input.evidenceGuided)` body. Its `return` requires the draft result contract below; do not fall through to adaptation creation.

```ts
if (authoringMode === "candidate") {
  const signal = AbortSignal.any([creation.signal(permissions.signal), personNeeded.signal]);
  let estimatedInputTokens = 0;
  const authored = await runAutomationStudioFlowCandidateAuthoringLoop({
    submission: {
      projectId, flowId, registry, resolution, size, binding: this.llmEvidenceRuntime,
      permissionFor: permissions.planStep, instructionText: bootstrapInstructionText,
      baseDependencyDigest: binding.executionDigest, signal,
      ...(startLocation === undefined ? {} : { startLocation })
    },
    loop: {
      ...bootstrapLoopLimits.loop, purse: creation.purse, signal,
      tools: harnessOptions.tools, observedStateKeys: harnessOptions.observedStateKeys,
      deniedEvidenceKeys: this.llmEvidenceRuntime?.deniedEvidenceKeys,
      executeTool: routing.recording(personNeeded.executeTool),
      decide: routing.observing(async ({ iteration, tools, evidence, decisionSchema, canComplete, signal }) => {
        creation.endIfReadingRefused();
        const decision = await runHarness({
          taskKind: "evidence_tool_decision", projectId, flowId, ...promptInstructions,
          evidenceLoop: { iteration, tools, evidence: evidence.map((entry) => ({ ...entry })), decisionSchema, canComplete },
          flowBootstrap: { registry, resolution, size, routing: routing.context(), describedNodeIds: nodeDescriptions.ids(), ...(startLocation === undefined ? {} : { startLocation }) },
          provider: unresolvedProvider.provider,
          ...(unresolvedProvider.tokenLimits ? { tokenLimits: unresolvedProvider.tokenLimits } : {}),
          ...(unresolvedProvider.timeoutMs !== undefined ? { timeoutMs: unresolvedProvider.timeoutMs } : {}),
          expectedOutput: "evidence_tool_decision", ...(signal ? { signal } : {})
        });
        estimatedInputTokens += decision.request.estimatedInputTokens;
        if (!decision.ok || decision.response?.kind !== "evidence_tool_decision") throw automationStudioLlmUnusableDecisionError(decision) ?? flowBootstrapHarnessFailure(decision);
        return automationStudioActivityDecisionReason.attach({ ...decision.response.decision, ...(decision.usage ? { usage: decision.usage } : {}) }, decision.response.summary);
      })
    }
  });
  const spent = sanitizedBootstrapAccounting({
    requestId: `candidate.${randomUUID()}`, estimatedInputTokens: estimatedInputTokens + authority.usage.estimatedInputTokens,
    provider: unresolvedProvider.provider.metadata.provider, model: unresolvedProvider.provider.metadata.model,
    inputTokens: authored.loop.accounting.inputTokens + authority.usage.inputTokens,
    outputTokens: authored.loop.accounting.outputTokens + authority.usage.outputTokens,
    totalTokens: authored.loop.accounting.totalTokens + authority.usage.totalTokens,
    estimatedCostUsd: authored.loop.accounting.estimatedCostUsd + authority.usage.estimatedCostUsd
  });
  failureAccounting = spent;
  if (!authored.loop.ok) throw flowBootstrapEvidenceLoopFailure(authored.loop, spent);
  // Supervisor must store this draft under existing Core project ownership,
  // then return its identifier/status. Never create a promotable adaptation here.
  return {
    projectId, flowId, status: "draft", authoringMode: "candidate",
    candidate: authored.candidate!, accounting: spent,
    verification: "not_performed", promotionAllowed: false,
    evidenceTrace: sanitizeEvidenceLoopTrace(authored.loop.trace)
  };
}
```

Use the t298 integrated cancellation signal as an additional input if it is not already inherited by creation.signal. This template needs typecheck and a service-level scripted test after integration; it is not a claim the facade route ran. Because draft rounds are not judged, add `unusableDecisions` only with candidate-specific refusals; do not route through legacy stalled draft/act grammar.

## Draft result/persistence contract recommendation

- Extend generation result with a discriminated `status:"draft"` member containing candidate identity, base dependency digest, source instruction IDs, handle-free canonical buildPlan, accounting and screened evidence references. Proposed remains the legacy member and keeps adaptationId. API/UI must display draft/unverified and expose no approve/apply action for that member.
- Persist the candidate through Core's project-owned draft/version mechanism before returning a durable candidateId. The controller here is session-local only; it preserves discovery separation and immutable snapshots but loses draft on process exit. Do not call this durable recovery complete.
- P2 compiles the exact candidate via normalizeAutomationStudioFlowBuildPlan, executes the detached topology with existing runtime, binds candidate/revision/digest/base/start-state/run/evidence receipt, and only then permits creation/promotion. A submission revision, refusal, cancellation or changed base invalidates prior receipts. No conversion back into exploration draft steps.
- Supervisor owns API handler flag declaration/allowlist and typed draft response integration with cancellation owner. No downstream domain adapter change was needed: existing resolvePlanNodeParameters already provides handle/permission resolution.

## Validation ledger

- Initial scripted test: 9 pass/1 fail; stale-handle fixture put a handle in an undeclared parameter and correctly received unknown_parameter before resolver. Corrected fixture to a reserved handle object in declared text parameter; 4 candidate tests then pass.
- Expanded owning run: 4 files/89 tests passed (7 candidate,6 generation flag,39 legacy evidence loop,37 legacy bootstrap completion).
- First typecheck caught fullRunRequired's true-only opt-in and ES2022 lack of findLast; corrected both. Final fluxiq typecheck exit0, executed 37.213s. Structure audit and final signal-change regression pending.
- No provider/live calls, no full suites, no service facade mutation, no git mutation/commit/merge.

- Final structure audit exit0: passed, 279 advisory warnings/349 baselined. Initial audit found cross-directory file import and 802-line evidence-loop coordinator; switched candidate fingerprint to focused local canonical JSON and kept guard statements on existing coordinator lines (800 lines), avoiding a broad coordinator refactor.
- Final candidate regression after shared cancellation signal + strict receipt types and context-bound digest: 7/7 passed, 29.17s. Digest covers canonical plan, accepted base, project/Flow and instruction text; no instruction content is logged.
- An intermediate typecheck exited0 but refused stamping because source changed during execution. Final recheck runs on frozen source; report will record actual result.

## Exact changed paths

Core relative paths under `packages/fluxiq/src/programs/automation-studio/runtime/`:

- `flow-bootstrap/candidate/contracts.ts`
- `flow-bootstrap/candidate/submission.ts`
- `flow-bootstrap/candidate/authoring-loop.ts`
- `flow-bootstrap/candidate/index.ts`
- `flow-bootstrap/candidate/tests/authoring-loop.test.ts`
- `flow-bootstrap/index.ts`
- `llm/loop-configuration.ts`
- `llm/evidence-loop.ts`
- `service/flow-bootstrap-commands/contracts.ts`
- `service/flow-bootstrap-commands/generation-request.ts`
- `service/flow-bootstrap-commands/tests/generation-request.test.ts`

Owned report tree: `C:/Users/osrs_/FluxStuff/fxwork/t299/!FluxIQWebExtension`. Core paired tree: `C:/Users/osrs_/FluxStuff/fxwork/t299/!FluxIQ`. No main/shared docs edited. P1 remains partial, not complete: real facade, durable drafts, exact-candidate runtime verification and live probe are unimplemented.

- Final frozen-source `pnpm.cmd --filter fluxiq check`: exit0, executed 14.828s and stamped successfully. Core/downstream `git diff --check`: exit0. Source frozen; supervisor owns all further source changes/integration.
