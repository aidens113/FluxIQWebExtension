# w2 multi-action permission/state slice

## Outcome

Complete. Core now connects permission evidence observation to the exact
evidence window published before a model decision, while the existing action
wrappers, budget ledger, state recorder, and reduction continue to run once per
listed action. Production remains at the one-action default and no production
caller opts in.

No service diagnostics/trace sanitation, Flow Bootstrap limit derivation,
downstream product, provider/browser, user-state, port, shared-document, or git
operation was performed. No provider was enabled or called.

## Visibility and permission contract

- Added `AutomationStudioLlmEvidenceVisibility`, a narrow binding between an
  already-wrapped executor and its permission gate. The loop publishes the
  exact bounded evidence window to this observer immediately before `decide`.
- Observation is keyed by evidence call ID, so evidence retained across several
  decisions remains available without repeatedly consuming the permission
  gate's bounded shown-text memory.
- Flow Bootstrap and runtime recovery no longer call `gate.observe` when a tool
  merely returns. They bind the existing wrapped executor to the visibility
  boundary instead.
- An initial/singleton result becomes permission-visible only when it is in the
  next decision's evidence window. A batch exposes only its bounded
  `core.batch_result`; an intermediate result omitted from that packet is never
  treated as model-shown.
- Evidence shown before the batch remains in the gate. Focused authoring tests
  prove a pre-batch control name may be carried into a request, while a name
  found only in action 1's hidden intermediate result is withheld from action
  2's request.
- Every listed action still crosses the existing permission wrapper separately
  with its Core call ID. A recovery batch with a successful first action and a
  permission request on action 2 recorded two ledger/state actions, one refusal,
  requested `batch.1.2`, made one provider decision, and never ran action 3.

## Ordered state and reduction proof

No recorder or reducer product change was necessary. The current recorder
already surrounds every invocation of the shared transition, and its call-ID
join preserves several trace rows with the same provider iteration.

The new focused state test executed two mutations in one batch and observed:

- distinct call IDs `batch.1.1` and `batch.1.2`;
- both records joined to provider iteration 1, followed by completion at
  iteration 2;
- ordered state chain `listing -> first-panel-open -> second-panel-open`;
- both original action inputs retained;
- a replayable reduction containing both actions in order with
  `stateChainIntact:true`.

## Core files changed in this slice

- `runtime/llm/evidence-loop.ts`
- `runtime/llm/evidence-batch/visibility.ts`
- `runtime/llm/evidence-batch/index.ts`
- `runtime/flow-bootstrap/action-permissions.ts`
- `runtime/recovery/runtime-exploration.ts`
- `runtime/flow-bootstrap/tests/action-permissions.test.ts`
- `runtime/recovery/tests/runtime-exploration-permission.test.ts`
- `runtime/recovery/exploration-state/tests/state-record.test.ts`

`runtime/recovery/exploration-state/recorder.ts` and `reduction-review.ts` were
inspected but did not require product edits. The existing Core shared working
document modification belongs to the supervisor and was not edited by this
worker.

## Validation

- Focused Vitest: 7 files, 103 tests passed. This covered the new authoring
  visibility tests, recovery permission termination, same-iteration state
  recording/reduction, current recovery behavior, exploration reduction,
  evidence-loop behavior, and the existing production-default Flow Bootstrap
  permission suite.
- `pnpm --filter fluxiq check`: passed.
- `pnpm --filter fluxiq build`: passed.
- `git diff --check`: passed.
- `pnpm structure:check`: no owned structural violation; it remains nonzero
  only because the supervisor-edited working document makes
  `docs/working/README.md` stale, which this brief forbids editing.

No full suite, live run, provider call, commit, or push was performed.

## Deferred by brief

Service trace sanitation/diagnostics, Flow Bootstrap action-limit derivation,
production caller opt-in, downstream stability regression coverage, and the
bounded live comparison remain slice 4/later work.
