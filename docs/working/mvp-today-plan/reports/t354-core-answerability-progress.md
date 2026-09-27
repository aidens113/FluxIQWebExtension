# t354 — Core answerability progress source

## Outcome

Implemented the content-free answerability snapshot at its Core source and carried it
through the accepted/refused Flow-bootstrap completion seam. No prompt, feedback,
acceptance rule, provider behavior, or retry behavior changed.

## Contract

`AutomationStudioFlowBootstrapAnswerabilitySnapshot` is defined in
`flow-bootstrap/answerability/contracts.ts`:

```ts
{
  recordsRequested: boolean;
  recordProducerPresent: boolean;
  recordStorePresent: boolean;
  issueCode?: "bootstrap.cannot_answer_instruction";
}
```

- `recordsRequested` is the existing instruction classifier result.
- producer/store presence comes from the existing plan-record-set walk, which now runs
  exactly once for every plan reaching this check.
- `issueCode` is present only on the existing correctable cannot-answer refusal.
- the library-incapable branch still passes and now reports the facts it observed.

The answerability verdict carries the snapshot on both union variants. The completion
verdict carries it in `check.answerability` when the check was reached:

- accepted completion: required `check: { ok: true, answerability }`;
- cannot-answer refusal: the same snapshot with the closed issue code;
- a later reachability refusal: the accepted answerability snapshot;
- refusals before answerability: no snapshot.

The completion seam uses the generic
`AutomationStudioLlmEvidenceLoopAnswerability` added by the supervisor under the LLM
evidence-loop feature; the Flow-bootstrap source owns an identical structural source
type so dependency direction remains intact.

## Files changed

- `F:/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/answerability/contracts.ts`
- `F:/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/answerability/check.ts`
- `F:/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/answerability/tests/check.test.ts`
- `F:/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/bootstrap-completion.ts`
- `F:/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/tests/bootstrap-completion.test.ts`
- this report

## Validation

Command:

```text
pnpm --dir packages/fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/answerability/tests/check.test.ts src/programs/automation-studio/runtime/llm/harness-options/tests/bootstrap-completion.test.ts
```

Result: 2 files passed, 21 tests passed.

The focused cases cover no-record request, returning records, storing records,
cannot-answer refusal, library-incapable pass, accepted completion, cannot-answer
completion refusal, and the later reachability refusal. Existing feedback assertions
continue to pass unchanged.

## Integration requirement and risk

`runtime/service.ts` still converts a successful completion verdict to a new bare
`{ ok: true }`, so it currently drops the accepted snapshot before the evidence loop.
That file was outside this worker's partition. Integration must change the callback to
return `verdict.check` on both branches after the generic completion-check type accepts
the snapshot. The supervisor was notified directly.

No repository-wide validation was run during parallel edits. No provider/live run,
raw artifact, commit, or push was performed.
