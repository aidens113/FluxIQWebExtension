# G2 - K5 defaults in the dry run and whole-Flow builds

## Outcome
Partial. (a) done as plumbing. (b) not done: no caller outside the forbidden paths has a plan.

## What changed
Core runtime/llm/node-tools: `replay-draft.ts` gains optional `partOf` on the replay input and steps input, forwarded to the span run and to the single-step pass call (the `partOf` argument already existed on `automationStudioFlowDraftReplayPassCall`). `dry-run-gate.ts` gains `partOf` and passes it to the replay. Absent `partOf`: identical behaviour.
Tests added to `llm/node-tools/tests/replay-parity.test.ts` (that dir is at the 25-file limit): half-written record output + one owing part gets the saved Flow's output via both replay and gate; no part, or a part owing none, equals today.

## Not wired (caller side)
- Nobody passes `partOf` to the gate or replay yet. The gate's caller is `llm/evidence-loop.ts:376` (forbidden: evidence-loop*), and service.ts:1666 builds a gate for an instruction build with no plan.
- (b) whole-Flow candidate: `AutomationStudioFlowCandidateSubmissionController` and `runAutomationStudioFlowCandidateAuthoringLoop` already accept `partOf` through the submission input; `candidate-generation.ts`/service.ts instruction builds have only the instruction text, no task-spec parts. The only whole-Flow paths with a plan are `project-agents/single-subflow/rebuild.ts` (`whole` has no partOf) and `project-agents/supervisor/supervisor-loop.ts`, both forbidden. Needed there: `authoringScopePartOf(parts)` over the plan's parts into `submission.partOf` and into the gate. Not invented.

## Validation
- `npx vitest run` over llm/node-tools and flow-bootstrap/record-defaults: 27 files, 315 tests passed.
- `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` (packages/fluxiq): no output (plain `npx tsc` hit heap OOM).
- `pnpm structure:check`: passed (460 warnings, 1152 baselined).

## Not verified
Fail-first order not demonstrated (git stash forbidden); tests would fail without the forwarding. Did not run `pnpm test` groups, only the touched dirs.
