# t195-w28b: a build's provider call count includes the judge's calls

## Outcome

Blocked. No files were edited. The judge's call count cannot reach the recorded count through the files this brief owns, and the two carriers the brief suggests would each break an existing contract.

## What changed and why

Nothing changed. I read these files to trace the path:

- `R/result-verification/build-test/judge.ts`
- `R/flow-bootstrap/unfinished-build/{phases.ts, contracts.ts}`
- `R/llm/evidence-loop/accounting.ts`
- `R/service/flow-bootstrap-commands/{evidence-trace.ts, permission-outcome.ts, build-judge.ts}`
- `R/service.ts:1547-1660`

### Finding 1: the count does not reach `evidence-trace.ts` through owned files

`evidenceTraceAuditDetail(trace, additionalProviderCalls)` gets its inputs at `R/service.ts:1793` from `input.evidenceTrace` and `input.additionalProviderCalls`:

- `input.evidenceTrace` is `built.trace`, the trace rows.
- `input.additionalProviderCalls` comes from `automationStudioBootstrapPermissionOutcome(permissions, () => authority.usage.calls)` at `R/service.ts:1633`. `authority.usage.calls` counts only the instruction-authority calls.

The judge is built at `R/service.ts:1564` (through `build-judge.ts`) on `unresolvedProvider.provider` directly, so its calls are in neither input. Whatever the phases or the verdict carry, `evidence-trace.ts` cannot read it unless `R/service.ts` passes it, for example as `() => authority.usage.calls + <judge calls from built>`. Another route is for `build-judge.ts` to count its calls. `R/service.ts`, `permission-outcome.ts` and `build-judge.ts` are all outside this brief's ownership. Changing the trace rows to carry the judge's calls would need the `AutomationStudioFlowBootstrapEvidenceTraceRow` decision vocabulary, which is also not owned and would be a hack.

### Finding 2: the accounting has no call field except `iterations`, and `iterations` cannot hold judge calls

`AutomationStudioLlmEvidenceLoopAccounting` (`R/llm/evidence-loop/accounting.ts`) has these fields: `iterations`, `toolCalls`, `evidenceBytes`, `inputTokens`, `cacheHitInputTokens`, `outputTokens`, `totalTokens`, `estimatedCostUsd`, `budgetBreaches`. The only call count is `iterations`, and `phases.ts` reads it as decisions:

- `numberedAcrossBuild(..., spent.iterations)` numbers the next round's decisions. Judge calls in it would leave gaps in the published decision numbering.
- `remaining()` computes `declaredCalls - spent.iterations`. This one may be a wanted effect.
- `end()` passes `decisions: spent.iterations` to the not-doable, budget, unreadable and provider-unavailable endings. Those endings would tell the person the wrong number of decisions.

So "use the field the accounting already has" means either corrupting `iterations` or adding a new field, which the brief forbids.

### Finding 3: contradiction with `evidence-trace.ts`'s documented reader contract

The doc comment above `evidenceTraceAuditDetail` (`evidence-trace.ts:183-205`) says a downstream reader holds `decisionCount === providerCallCount`. The reader is `packages/test-runner/src/existing-fluxiq-control/adaptation-evidence-loop.ts` in the extension repo. The comment also says that folding extra calls into `providerCallCount` "makes every evidence-guided build fail that contract", measured on `run-mudna2ng-ceadeb69`. Calls outside the loop belong in `additionalProviderCallCount` and `totalProviderCallCount`. The brief asks for `providerCallCount` itself to include the judge's calls, which would break that reader.

## Proposed resolution (needs a brief with wider ownership)

1. `judge.ts`: add `calls: number` to `AutomationStudioBuildTestJudgeSpend`, equal to `bounded.value.interventions.length` (0 on not_judged with no cost left, on the deadline, and on failure). Mirror it in `AutomationStudioFlowBootstrapJudgeSpend` in `contracts.ts`.
2. `phases.ts`: give each outcome (`finished`, `ended`, `unfinished`) a `judgeCalls: number`, summed over every verdict. Alternatively, add an optional `providerCallsOutsideLoop`-style field to the accounting next to `budgetBreaches`, which needs `R/llm/evidence-loop/accounting.ts`. Either way, keep `iterations` as decisions only.
3. `R/service.ts:1633`: pass `() => authority.usage.calls + built.judgeCalls` so `evidenceTraceAuditDetail` publishes the judge's calls in `additionalProviderCallCount` and `totalProviderCallCount`.
4. Tests: `evidence-trace` gets decisions + 0, 1 or 2 in `totalProviderCallCount` with `providerCallCount === decisionCount`. The phases get `judgeCalls` of 0, 1 or 2 for a judge that was not asked, asked once, or asked twice.

The supervisor needs to decide:

- whether the Lab should read `totalProviderCallCount`, or whether `providerCallCount` should really change despite the reader contract above;
- which carrier to use, an outcome field or an accounting field;
- whether to grant ownership of `R/service.ts:1633`, or of `build-judge.ts` plus `permission-outcome.ts`.

## Commands run and observed results

- `git status --short` in the Core runtime directory: clean, nothing printed.
- grep and sed reads only. No vitest, tsc or structure audit was run, because nothing was edited.

## Not verified

- How the Lab actually reads `providerCallCount` and `totalProviderCallCount` today. I took this from the `evidence-trace.ts` comment and did not read the extension's test-runner.
- Whether `verify` reports exactly one intervention per provider call. This is assumed from W3's design. I did not read W3's or W4's reports, because the blocker came first.

## Open questions or contradictions found

- The brief asks that `providerCallCount` include the judge's calls. `evidence-trace.ts` documents that this breaks the downstream reader's `decisionCount === providerCallCount` contract.
- The brief says to use the accounting's existing call field. The only one is `iterations`, which `phases.ts` uses as the decision count for numbering and for the person-facing endings.
- The wiring point, `R/service.ts:1633`, is outside the brief's ownership.
