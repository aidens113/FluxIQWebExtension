# t826 Phase1 transient failure readers

Status: Phase1 done; all owned sources frozen after named tests. Source roots are private paired `C:/Users/osrs_/FluxStuff/fxwork/t826/!FluxIQ` and its downstream sibling. This is the only worker report; no MAIN copy.

## Frozen API implemented

- Existing `AutomationStudioFailureRecord` gains `transient?: true`. Only literal true is admitted; undefined means absent. The existing never-retryable category set also rejects transient policy/auth/person-needed/invalid-graph claims. Temporary cause is independent of retry permission and act certainty: nonretryable temporary non-prohibited records and ambiguous temporary effects remain valid without inference.
- New public pure `projectAutomationStudioFailureControlRecord(value: unknown): AutomationStudioFailureRecord | undefined` strictly parses the whole input, then returns a new minimal record. Required fields: category, code, retryable. Present optional fields: stage, effect, retryAfterMs, certainNoEffect, transient. It drops expected, actual and evidenceDigest. Invalid descriptive/unknown fields reject instead of being repaired before validation. Original normal parsing preserves valid comparison fields.
- The helper is exported by `packages/contracts/src/failure/index.ts`, through its existing contracts automation-studio wildcard, and explicitly reexported by Core `packages/fluxiq/src/programs/automation-studio/index.ts` for `fluxiq/automation-studio`. No package subpath or JSON export was added.
- Existing `AutomationStudioLlmEvidenceToolExecutionResult` and its parsed type gain `failure?: AutomationStudioFailureRecord`. Exact execution key allowlist recognizes failure before any producer phase. The reader uses the same control projection. Invalid optional failure drops only that field; actual evidence, effectApplied, personNeeded and other existing facts stand. Optional accessor metadata is not executed and is treated as absent data. Unknown outer keys retain the existing rejection policy.

No emitter, repeat consumer, authoring decision handler, retry policy, browser wire or model guidance was changed. Readers alone are not CC8 end-to-end acceptance.

## Exact paths

Core paths relative to private Core:

- `packages/contracts/src/failure/record.ts`
- `packages/contracts/src/failure/parse-record.ts`
- `packages/contracts/src/failure/index.ts`
- `packages/contracts/src/failure/control-record.ts` (new)
- `packages/contracts/src/failure/tests/parse-record.test.ts`
- `packages/contracts/src/failure/tests/control-record.test.ts` (new)
- `packages/fluxiq/src/programs/automation-studio/index.ts` (explicit helper reexport only)
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tool-execution.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop-decision.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/evidence-loop-tool-failure.test.ts`

Failure directory held 5 source/2 test files before addition. Both llm/tests and evidence-loop/tests already held 25 files, so the existing owning parser test file is extended. No baseline/depth budget change or cast-through-never was introduced.

## Observed validation

From private Core:

```text
pnpm.cmd --filter @fluxiq/contracts exec vitest run src/failure/tests/parse-record.test.ts src/failure/tests/control-record.test.ts --maxWorkers=2 --minWorkers=1
```

Observed exit 0: 2 files/15 tests passed (12 parser, 3 projection), 1.34s. Legacy complete/minimal copies, strict true/false/null/unknown handling, category contradictions, transient independent of retry/effect, full control-field preservation, private comparison/digest stripping, whole-input validation, hostile optional input and no mutation are covered. Contracts source freeze sent immediately; lead owns library build before Core tests.

The lead independently reran the two contract files 15/15, passed contracts check, and reported its contracts-only cached library build completed in 6.5s. Only then did the worker run Core readers. Core Vitest aliases contracts imports to source; the requested dependency checkpoint was still honored.

```text
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/llm/tests/evidence-loop-tool-failure.test.ts src/programs/automation-studio/runtime/llm/evidence-loop/tests/authored-draft.test.ts src/programs/automation-studio/runtime/llm/evidence-loop/tests/diagnostic.test.ts --maxWorkers=2 --minWorkers=1
```

Observed exit 0: 3 files/119 tests passed (44 reader/loop, 72 authored-draft, 3 diagnostic), 48.49s. Public `fluxiq/automation-studio` source-barrel reexport is exercised by the owning reader test import. New cases prove exact key recognition, sanitized valid failure roundtrip, legacy envelopes unchanged, malformed optional metadata dropping only its field, true/false effectApplied and personNeeded preservation, existing unknown outer-key rejection, and hostile/accessor metadata leaving the call intact. Two actual-loop cases return valid/private and malformed/private failures: both execute once, account one call, preserve effectApplied true and expose neither comparison markers nor digest in model requests or trace rows. Existing draft and diagnostic assertions remain unchanged.

Worker green total: 5 distinct named files, 134/134 tests. No worker build/typecheck/audit/full-suite/API/browser/panel/git/agent action. Lead owns independent Core checks/builds and end-to-end phase coordination. All owned sources frozen after the Core command; only this report changed after the freeze.

## Privacy path requiring lead/producer ownership

Confirmed source-traced bypass outside this brief: `runtime/llm/evidence-progress/progress-trace.ts` wraps the raw execute result and passes it to `decision-dump.ts.tool` before the normal parser. That serializer writes the entire raw result into its opt-in dump. Adding a safe parsed failure field does not sanitize an unprojected producer result on that path. Lead was notified before any unowned edit; host producers should call the public control projection before returning the new field. No unowned source edit was made.

The neighboring `runtime/llm/step-log/tool-step.ts` also wraps raw execution but writes `execution.evidence` for recognized tool envelopes; it is not the demonstrated new raw-failure bypass. Normal evidence-loop model entries derive from parsed execution.evidence, and its log/trace rows are explicit projections. New tests assert private failure markers/digest do not appear in parsed results, actual-loop model requests or trace rows. Debug serializer behavior remains source-traced, not runtime-tested in this phase.

Lead explicitly retained raw progress-dump handling for the next consumer brief. This report does not claim raw debug artifacts are sanitized, a host emits transient, a repeat guard consumes it, or CC8 is accepted end to end. No required reader work remains in Phase1.
