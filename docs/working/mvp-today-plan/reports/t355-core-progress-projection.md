# t355 — Core stored/public progress projection

## Result

Implemented partition C's privacy-safe projection in Core. Stored trace
sanitization and public evidence steps now preserve `draft`, `progress`,
`draftChange`, and `answerability` without changing provider-call folding or
accounting.

## Files changed

- `F:/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/service/flow-bootstrap-commands/evidence-trace.ts`
- `F:/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/evidence-loop-steps.ts`
- `F:/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/service/flow-bootstrap-commands/tests/evidence-trace.test.ts`
- `F:/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/tests/evidence-loop-steps.test.ts`
- `F:/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts`

`generation-failure/diagnostic-parse.ts` did not require a source edit: it
already delegates every evidence-loop step to
`parseAutomationStudioFlowBootstrapEvidenceSteps`, whose exact parser was
widened in this change. The diagnostics test proves that enriched failed-build
records traverse that delegation.

## Preservation and rejection contract

- `progress` keeps only two bounded revisions and the three exact closed enums.
- `draftChange` keeps at most 16 safe ids plus bounded applied, refused, kept,
  and optional rerun identity fields.
- `draft` keeps exact known count/flag fields. Bytes are evidence-byte bounded;
  step counts are iteration bounded; listed plus unlisted cannot exceed that
  bound; omitted/oversized-input counts cannot exceed listed steps; optional
  flags must be literal `true`.
- `answerability` keeps exactly three booleans and the one optional closed issue
  code `bootstrap.cannot_answer_instruction`.
- Unknown keys, prose, unsafe ids, out-of-bound counts, inconsistent counts,
  and nonliteral flags cause that optional nested member to be omitted while
  sanitizing a completed build.
- The exact stored-step parser rejects the whole claimed Core step when any
  present nested member is malformed. Older steps with all four members absent
  remain valid.
- No prompt, instruction, page value, selector, tool argument, provider output,
  state digest, content hash, feedback, or script is projected.
- Existing iteration-based provider-call folding and every accounting field are
  unchanged.

## Validation

Focused command:

`pnpm --filter fluxiq test -- src/programs/automation-studio/runtime/flow-bootstrap/tests/evidence-loop-steps.test.ts src/programs/automation-studio/runtime/service/flow-bootstrap-commands/tests/evidence-trace.test.ts src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts`

Result: 3 files passed, 96 tests passed.

`git diff --check` for the owned files reported no whitespace errors (only the
repository's existing LF-to-CRLF checkout warnings). Per the brief, no
repository-wide validation ran while parallel edits were active.

## Integration notes and risks

- The loop-owned public types were imported from the evidence-loop barrel; no
  duplicate public contract was introduced.
- The loop-owned `trace.ts` comment saying `draft` stops before stored
  projection became stale. The supervisor was notified because that file is
  outside this partition.
- The maximum represented draft-step count follows the evidence-loop iteration
  ceiling, matching the design contract. Supervisor verification should confirm
  this remains aligned if the loop later permits seeded drafts longer than its
  iteration ceiling.
- The supervisor still needs package/repository type checks and full validation
  after all parallel partitions settle.

No provider call, live run, raw artifact inspection, commit, push, or shared
plan edit was performed.
