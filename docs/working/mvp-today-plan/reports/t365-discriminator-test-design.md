# t365 — exact provider-free discriminator test design

## Result

Extend only `packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts`. The existing endpoint already sees the exact DeepSeek user payload and retains only closed facts. Add four content-free observations there, then assert them over the failing branch's requests 11–26 and the companion branch's request 11. No production change is selected unless one of these assertions fails.

## Observation shape

Add these fields to `DecisionObservation`:

```ts
completionFeedback: string[];
draft: {
  present: boolean;
  bytes: number;
  budget: number;
  steps: number;
  unlisted: number;
  withoutInput: number;
  inputTooLarge: number;
  overBudget: boolean;
};
registeredRecordProducerCount: number;
visibleRecordProducerCount: number;
```

Keep `offeredDecisionKinds`. `completionFeedback` replaces the need to retain whole completion-check values: take only closed `issues[].code` / `refused[].reason` values from the `core.completion_check` evidence row. For `draft`, find `core.flow_draft`, count its `steps`, `unlisted`, missing `input`, and `inputTooLarge`, and measure only `JSON.stringify(value)` bytes. Use the resolved fixture budget (currently 4,000 bytes) as `budget`; set `overBudget` from `bytes > budget`. Do not retain any step, input, action id, instruction, evidence value, or provider output.

Compute producer ids from the registered fixture definitions with `automationStudioFlowBootstrapDeclaredRecordsPath`, not from a copied id list. `registeredRecordProducerCount` is that set's size. `visibleRecordProducerCount` is the count of provider-visible `context.flowBootstrap.nodeCatalog` entry ids in that set. Retain the two counts, then discard catalog entries and ids. The current fixture has exactly one registered producer, but deriving the count keeps the assertion coupled to the registered contract rather than the name `web.output.dom-extract_list`.

## Exact assertions

For the exhaustion branch, define `postRefusal = run.observations.slice(10)`. Assert it has 16 observations with iterations 11 through 26.

1. Completion feedback retention:

```ts
expect(postRefusal.map(o => o.completionFeedback)).toEqual(
  Array.from({ length: 16 }, () => ["bootstrap.cannot_answer_instruction"])
);
```

This is stronger than the current request-11 assertion: it proves the same correction survives every subsequent context-window rebuild through the terminal request.

2. Offered decision grammar:

```ts
expect(postRefusal.slice(0, -1).map(o => o.offeredDecisionKinds)).toEqual(
  Array.from({ length: 15 }, () => ["complete", "amend_draft", "tool_call"])
);
expect(postRefusal.at(-1)?.offeredDecisionKinds).toEqual(["complete"]);
```

The first assertion covers decisions 11–25; the second pins the final-budget decision at 26. Preserve schema order, because it is the actual grammar presented to the provider.

3. Draft visibility and budget:

The scripted draft has seven action steps before decision 11, gains one after every tool decision 11–24, and gains one from the rerun at 25. Therefore the request-visible action count at every decision 11–26 is exactly `iteration - 4` (7 through 22).

```ts
for (const observation of postRefusal) {
  expect(observation.draft.present).toBe(true);
  expect(observation.draft.steps).toBe(observation.iteration - 4);
  expect(observation.draft.unlisted).toBe(0);
  expect(observation.draft.withoutInput).toBe(0);
  expect(observation.draft.inputTooLarge).toBe(0);
  expect(observation.draft.budget).toBe(4_000);
  expect(observation.draft.overBudget).toBe(false);
  expect(observation.draft.bytes).toBeLessThanOrEqual(observation.draft.budget);
}
```

These checks intentionally fail if the current 4,000-byte projection silently withholds any of this bounded fixture's retained state. A failure is evidence for projection/packing work; it is not permission to raise the provider, call, token, run, or evidence ceilings. Prefer a more compact content-free projection if this fixture outgrows its reserved bytes.

4. Record-producing capability visibility:

```ts
expect(postRefusal.every(o => o.registeredRecordProducerCount === 1)).toBe(true);
expect(postRefusal.every(o => o.visibleRecordProducerCount === 1)).toBe(true);
```

This proves the static context presented on every late decision still contains the sole registered record producer. It retains counts only.

Apply the same assertions to `run.observations[10]` in the success branch: iteration 11, feedback code present, offered kinds exactly `complete/amend_draft/tool_call`, draft exactly seven complete steps within 4,000 bytes, and registered/visible producer counts both one. That pins the two branches to an identical provider-visible prefix immediately before their different scripted decisions.

## Failure-to-owner map

| Failed assertion | Selected Core seam | Required focused proof before production edit |
| --- | --- | --- |
| Feedback absent already at decision 11 | completion-refusal insertion in `llm/evidence-loop.ts` | refused completion adds one closed `core.completion_check` entry to the next request |
| Feedback present at 11 but absent on 12–26 | `llm/evidence-loop/context-window.ts` retention/priority | completion feedback remains selected while later tool evidence accrues |
| `complete` absent on 11–25 | can-complete calculation / `llm/evidence-loop-decision.ts` schema construction | a draft past minimum tool calls retains completion eligibility |
| `amend_draft` absent on 11–25 | draft-amendment allowance in `llm/evidence-loop.ts` / loop configuration | an existing draft with allowance left retains amendment eligibility |
| `tool_call` absent before 26 | eligible-tool/repeat policy or `llm/loop-budget.ts` | the configured tool remains eligible until the final reserved decision |
| Anything besides only `complete` at 26 | `llm/loop-budget.ts` final-decision projection | one remaining decision withdraws tools and amendments but retains completion |
| Draft absent | `llm/evidence-loop.ts` draft-entry/beside packing | a non-empty action draft is always included beside the evidence window |
| Step count differs, or `unlisted/withoutInput/inputTooLarge/overBudget` is nonzero | `flow-draft/entry.ts`, `llm/evidence-loop/draft-shown.ts`, and the configured draft projection | all 7–22 bounded fixture steps and inputs fit and the reported measurement matches what was sent |
| Registered producer count is not one | fixture/registry resolution, not provider policy | the web fixture exposes its one declared-records-path definition under the resolution |
| Registered count is one but visible count is zero or changes | Flow-Bootstrap catalog ranking/compaction and provider-context projection (`flow-bootstrap/plan/catalog.ts`, `llm/deepseek/request-body.ts`) | the ranked producer remains in every static request context |

Do not change answerability checking for any failure above. Only a separate contradiction—producer present in the completed plan while answerability reports it absent—would select that seam.

## All-pass consequence and next experiment

If both branches pass all observations, Core demonstrably preserves the correction feedback, offers the necessary choices until the final reserved decision, shows the complete retained draft within its existing budget, and exposes the registered record producer on every request. The deterministic fixture then selects no Core retention, schema, budget, draft, catalog, or answerability behavior fix.

The next bounded experiment must be a prompt/provider-policy A/B, not another unchanged live retry and not a fake endpoint scripted to obey new wording. Hold the 26-call grant, token/cost/time ceilings, tool/catalog context, instruction, answerability gate, and fixture constant. Change one provider-visible policy variable only—for example, a short closed instruction adjacent to completion feedback that says to choose the catalog's record producer before completing—and predeclare success as reaching an accepted proposal containing a registered record producer. Run the provider-free fixture first to prove no contract or budget regression; only then may the supervisor write a fresh no-hindsight live authorization.

## Scope

This is a read-only design. I inspected the assigned reports, MVP Current State, Core instructions, fixture, request projection, decision schema, draft entry/measurement, catalog, and answerability capability seam. I did not edit source or shared documents, run tests, invoke a provider, inspect live/raw artifacts, commit, or push. This report is the only file written.
