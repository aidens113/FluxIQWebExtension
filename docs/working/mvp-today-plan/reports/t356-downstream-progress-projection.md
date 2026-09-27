# t356 — Downstream build-progress projection

## Outcome

Implemented the downstream projection for Core's additive `progress`,
`draftChange`, `draft`, and `answerability` evidence-row members. Proposed and
refused created-Flow builds continue to use the same generic shape screen; no
second snapshot schema or field mapping was introduced.

## Files changed

- `packages/test-runner/src/flow-lane/creation/build-proposal.ts`
- `packages/test-runner/src/flow-lane/creation/tests/build-proposal.test.ts`
- `packages/test-runner/src/existing-fluxiq-control/adaptation-evidence-loop.ts`
- `packages/test-runner/src/existing-fluxiq-control/publishable-step-value.ts`
- `packages/test-runner/src/existing-fluxiq-control/tests/adaptation-evidence-loop.test.ts`
- `packages/test-runner/src/existing-fluxiq-control/tests/publishable-step-value.test.ts`
- `packages/test-runner/src/live-llm/tests/build-usage.test.ts`
- `packages/test-runner/src/live-llm/tests/live-llm-run.test.ts`
- `docs/architecture/testing-facility.md`
- this report

The supervisor explicitly clarified that the sanitizer source was in scope:
Core's exact `draftChange.targetedStepIds` is a bounded scalar-id list nested
inside the one-level `draftChange` record, which the prior sanitizer could not
carry. The shared sanitizer now admits only bounded scalar lists at that one
record level; it still rejects deeper structures.

## Propagation evidence

- `CreatedFlowBuildStep` and `ExistingAdaptationEvidenceLoopStep` name the four
  optional Core members with their exact public member names and closed states.
- Proposed audit rows and parsed refusal rows still converge on
  `publishableStepFields`; snapshot writers still embed `CreatedFlowBuild`
  unchanged.
- The parity test supplies the same Core-shaped progress row to both paths and
  requires exact equality.
- The live-LLM settlement test proves a refused build's row is retained at
  `snapshots/live-llm.json.build.evidenceLoop.steps`.
- Adding progress to a two-row/one-iteration fixture leaves provider-call
  grouping, tokens, and cost unchanged.

## Privacy evidence

The generic screen admits counters, flags, closed/code-shaped strings, and
bounded code-shaped scalar lists. It rejects prose, page values, selectors,
URLs, nested records/lists, and digest-shaped strings. Tests cover unsafe
members both directly and on proposed/adaptation rows, and assert the forbidden
fixture literals do not occur in serialized records or the live snapshot.
These controls do not prove how a syntactically safe id was minted; Core remains
responsible for using sequential build-local ids rather than content-derived
identities.

## Validation

- `pnpm --dir packages/test-runner check` — passed.
- `pnpm --dir packages/test-runner build` — passed.
- The first focused five-file test run was 59/60 against the pre-progress
  linked Core dist; only proposed/refused parity failed because that stale
  parser dropped the refusal fields. After the supervisor refreshed Core's
  production build, the exact rerun passed 60/60, including parity, privacy,
  snapshot, and unchanged accounting.
- Scoped `git diff --check` — passed.

Core's separate test-only typecheck reconciliation remains outside this brief;
the linked production build used by the passing downstream run was fresh.

## Risks and limits

- An older Core omits these optional members; backward compatibility is
  preserved, while exact refusal parity requires the new Core parser/build.
- The row cap remains 24 members including `toolId`; Core's grouped progress
  shape stays within that cap.
- No live/provider call, raw artifact read, commit, push, or repo-wide
  validation was performed.
