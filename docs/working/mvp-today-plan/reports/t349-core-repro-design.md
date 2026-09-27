# t349 — Deterministic Core Stage-2 reproduction design

## Decision

Add the reproduction to one existing Core integration-test file only:

- `packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts`

Do not change production code to obtain the reproduction. That file already crosses the required
service boundary: `AutomationStudioService.generateFlowBootstrapAdaptation`, a real execution grant,
the real DeepSeek adapter, the real evidence loop, completion validation, proposal persistence, and
terminal grant revocation. Its endpoint and evidence tools are deterministic stand-ins, so extending
them is smaller and stronger than adding another low-level loop test.

## Fixture changes

Extend the existing test helpers without changing their default behavior:

1. Let `create` accept an optional instruction body, evidence binding, and node definitions/registry
   fixture. For this case bind the `web-automation` resolution and the existing
   `webDomainNodeDefinitionsFixture()` so `web.output.dom-extract_list` is known to the answerability
   check. Keep all calls fake and local.
2. Let `endpoint` receive a finite `Reply[]` script (or an index-to-reply callback) and collect a
   content-free observation per decision: iteration, offered decision kinds, and the tool ids plus
   closed issue codes in `context.evidenceLoop.evidence`. Do not retain provider message text,
   instruction text, selectors, arguments, or tool results.
3. Add two completion helpers:
   - `cannotAnswerCompletion()`: a valid parsed plan made only of navigation/action nodes and no
     record-producing or record-storing node;
   - `answeringCompletion()`: the same minimal plan with a registered
     `web.output.dom-extract_list` node retained.
4. Use an instruction that unambiguously requests rows with named columns. Keep it synthetic and
   local to the test.
5. Issue `maxCalls: 27`. The existing service fixture demonstrates that one grant call is reserved
   outside the evidence-decision sequence (`maxCalls: 12` yields 11 sent iterations); 27 therefore
   gives the loop the measured 26 decision iterations. Keep the existing per-call usage at 1,200
   input and 150 output tokens and a run token allowance large enough for all 26 calls.

## Exact failure script

Use these 26 provider decisions. `look(n)` always names a unique synthetic area, so each indicated
tool execution succeeds and is not answered from the repeat cache.

| Decisions | Scripted decision | Purpose |
| --- | --- | --- |
| 1–6 | `look(iteration)` | Opening observation plus successful evidence gathering. |
| 7 | `amend_draft` with `{ step: 1, change: "rerun", input: { area: "area.rerun.7" } }` | One paid provider decision producing both an amendment row and a tool row at iteration 7. |
| 8 | `amend_draft` with `{ step: 2, change: "optional" }` | Applied edit. |
| 9 | Repeat the same `optional` amendment to step 2 | Unchanged/refused edit and exactly one amendment-feedback entry. |
| 10 | `cannotAnswerCompletion()` | Parsed plan rejected with `bootstrap.cannot_answer_instruction`. |
| 11–24 | `look(iteration)` | Deterministic successful work after corrective feedback; each success resets evidence no-progress state. |
| 25 | `amend_draft` rerun of a retained look step with a new synthetic input | Late correction/rerun, with amendment and tool rows sharing iteration 25. |
| 26 | `cannotAnswerCompletion()` | Final answerability refusal at the iteration boundary; exhaustion must preserve this issue. |

This yields 26 paid decisions and 22 tool executions: 20 ordinary looks plus the two reruns. It also
contains the measured mixed shape—successful tools, applied and refused draft edits, rerun double
rows, a completion refusal, visible corrective feedback, a late correction, and final exhaustion—
without claiming that the sanitized live runs proved identical provider content.

At decision 10, inspect only the decision-11 input projection and assert that it contains exactly one
completion-feedback entry carrying the closed code `bootstrap.cannot_answer_instruction`. Likewise,
inspect decision 10's input projection and assert exactly one amendment-feedback entry from decision
9. These assertions prove feedback delivery rather than merely proving that trace rows were written.

## Failure-branch assertions

Assert all of the following in the new service test:

- `sentIterations` is exactly `[1, 2, ..., 26]`, `revealed` has length 26, and the endpoint is never
  called a 27th time;
- failure is exactly `flow_bootstrap.evidence_unusable_decision` at
  `provider_output_validation`, non-retryable, with issue codes exactly
  `["bootstrap.cannot_answer_instruction"]`;
- `failure.evidenceLoop` reports `iterationCount: 26`, `decisionCount: 26`,
  `toolCallCount: 22`, and a positive bounded evidence byte count;
- trace/projection rows contain one applied edit at iteration 8, one refused/unchanged edit at 9,
  two rows sharing iteration 7, two rows sharing iteration 25, and answerability refusals at 10 and
  26; the amendment refusal and each delivered feedback entry occur once;
- accounting has no budget failure and reports the scripted decision usage: 31,200 input tokens,
  3,900 output tokens, and 35,100 total tokens (26 × the existing 1,200/150 billing fixture). If the
  service intentionally includes a separate non-loop accounting bucket, assert the loop bucket
  exactly and the service total as that bucket plus the already-pinned extra call rather than
  weakening this to `greaterThan`;
- `result` and `stored` are absent, adaptation count is zero, and no proposal/review/adaptation was
  persisted;
- exactly one grant id was revoked and `activeGrantsAfter` is zero.

Do not assert raw request bodies, prompt text, page values, or provider output. All assertions can be
made from closed codes, counts, iterations, tool ids, and synthetic fixture state.

## Companion success branch

Run a second test from the same decisions 1–10. On decision 11, after asserting the one corrective
completion-feedback entry, return `answeringCompletion()` instead of continuing the failure suffix.
Assert:

- sent iterations are exactly 1–11;
- status is `proposed`, stored adaptation exists, and adaptation count is one;
- the stored plan contains the registered `web.output.dom-extract_list` node;
- the stored trace contains the refusal at iteration 10 followed by completion at 11;
- the same real grant is released exactly once and no grant remains active.

This branch proves the fake provider, domain registry, answerability seam, and persistence path are
capable of convergence. It also catches a fixture accidentally configured so every completion must
fail.

## Production decision after the reproduction

The fixture is diagnostic first. Run it unchanged against current production code. If it reproduces
all invariants, add the privacy-safe revision/step/progress fields proposed by t348 and use the same
script to select a policy fix. Do not change answerability, raise the call ceiling, or add retries.
The script deliberately makes structural progress, so any later production fix must preserve the
success branch and may only alter the failure branch when a measured repeated semantic state selects
that change.

## Commands

After implementing the test, run from `F:/!FluxIQ`:

```powershell
pnpm --filter @fluxiq/core test -- --run packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts
pnpm check
pnpm test
pnpm build
```

If the package's Vitest wrapper does not forward a repository-relative path, use its existing focused
test syntax for `deepseek-bootstrap-exploration.test.ts`; do not broaden the first iteration to a live
provider or browser run.

## Files inspected

- downstream `docs/working/mvp-today-plan.md`, `Current State` only;
- downstream `docs/working/mvp-today-plan/reports/t348-repeated-build-exhaustion-diagnosis.md`;
- Core `AGENTS.md`;
- Core `runtime/tests/deepseek-bootstrap-exploration.test.ts` and
  `runtime/tests/llm-deepseek-flow-bootstrap.test.ts`;
- Core `runtime/llm/evidence-loop.ts`, `repeat-policy.ts`, and `loop-budget.ts`;
- Core `runtime/loop-limits/flow-bootstrap-evidence-loop.ts`;
- Core `runtime/flow-bootstrap/answerability/check.ts` and its focused test;
- Core `runtime/flow-bootstrap/generation-failure/evidence-failure.ts`;
- Core `runtime/service/flow-bootstrap-commands/evidence-trace.ts`;
- Core focused evidence-loop/repeat/rerun tests needed to confirm decision and rerun shapes.

## Validation and risks

No tests, builds, live runs, provider calls, or browser calls were run; this is a read-only design.

The only implementation detail to confirm while editing is the existing service constructor/binding
seam for registering `webDomainNodeDefinitionsFixture()`. The answerability test proves the required
registry/resolution combination, but the bounded inspection did not open broader service wiring.
If the service fixture cannot register those definitions without production changes, stop and add a
test-only constructor option or use the already-established service test registry seam; do not move
the reproduction down to an isolated answerability unit test, because that would no longer cover the
measured service path.
