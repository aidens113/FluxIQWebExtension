# t826 CC8 consumer and privacy work

Status: implementation complete and sources frozen for lead verification. Lead released the validated interface and approved the helper/barrel before source edits.

## Findings

- Both authoring exemptions use `repeat-guard/retry-later.ts` code/reason word matching. `outcomes.ts` calls it for recorded calls and amendment outcomes; `decision-handlers/refusal-run.ts` calls it for consecutive refusal counting.
- `evidence-loop.ts` holds actual parsed execution facts at all three call sites. Held-amendment settlement currently reconstructs only `resultCode` from a draft step and loses actual `failure`, `resultReason`, `effectApplied` and `personNeeded`. An optional actual-execution argument to settlement can preserve these facts without extending persisted draft contracts or changing failed/no-answer handling.
- The progress wrapper sends raw execution results through step logging before the normal parser, then to `decision-dump.tool`. A shared control projection must run before the wrapper and on the dump's direct tool entry. It must read `failure` through its own data descriptor, remove accessor/malformed metadata alone, preserve actual call/evidence/effect fields, avoid mutating input, and leave opaque non-tool results unchanged.
- Requested helper paths: Core `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-progress/tool-execution-control.ts` and its existing `index.ts` barrel. No other extra source path is presently required. Ordinary rerun-check/step-place envelope annotations preserve outer execution fields.
- Existing temporary fixtures in `outcomes.test.ts` and loop `repeat-guard.test.ts` need typed facts. `reset-precondition.test.ts` currently grants admission from `retry_allowed` alone; its actual precondition lift remains valid and its last assertion should become a negative legacy-reason regression.

## Implemented

- Replaced the code/reason word matcher with strict shared failure projection plus literal `transient === true`, `retryable === true`, `effect === "unacted"`, actual `effectApplied === false` and no person-needed fact. Missing/invalid/ambiguous/acted/nonretryable/policy claims remain cautious. `certainNoEffect` alone never qualifies. No retry dispatch, executor policy, actual execution/evidence or generic transport fallback changed.
- Both authoring guards now receive actual parsed failure and person-needed facts. Amendment settlement accepts the optional sixth actual-execution argument, explicitly selects its failure/resultCode/resultReason/effectApplied/personNeeded facts, and never fabricates effect certainty from a persisted step summary. Missing facts keep the former result-code summary without granting admission.
- Added one helper that sanitizes only recognized execution envelopes' optional failure using the public projector, removes accessor/malformed failure alone through property descriptors, does not invoke the failure getter, preserves the actual result's other descriptors/evidence and leaves opaque non-tool values untouched. The progress wrapper applies it before step logging; the direct dump tool entry applies it before JSON serialization as well. Producer inputs remain unchanged.
- Updated intended temporary fixtures with typed facts; retained negative legacy code/reason coverage. Reset-precondition lifting still depends on a later call that meets it, even with `retry_allowed` wording.

## Exact changed paths

Core paths relative to private paired Core:

- `packages/fluxiq/src/programs/automation-studio/runtime/llm/repeat-guard/retry-later.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/repeat-guard/outcomes.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/repeat-guard/tests/outcomes.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/repeat-guard/tests/reset-precondition.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-handlers/refusal-run.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-handlers/amendment.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/decision-handlers/tests/refusals-of-one-kind.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/tests/repeat-guard.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-progress/tool-execution-control.ts` (new, approved)
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-progress/index.ts` (approved local barrel)
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-progress/progress-trace.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-progress/decision-dump.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-progress/tests/decision-dump.test.ts`

Downstream task-owned `consumer-brief.md` and this `consumer.md` only; no shared document edit.

## Observed validation

From `C:/Users/osrs_/FluxStuff/fxwork/t826/!FluxIQ`:

```text
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/llm/repeat-guard/tests/outcomes.test.ts src/programs/automation-studio/runtime/llm/repeat-guard/tests/reset-precondition.test.ts src/programs/automation-studio/runtime/llm/decision-handlers/tests/refusals-of-one-kind.test.ts src/programs/automation-studio/runtime/llm/evidence-loop/tests/repeat-guard.test.ts src/programs/automation-studio/runtime/llm/evidence-loop/tests/held-amendments.test.ts src/programs/automation-studio/runtime/llm/evidence-progress/tests/decision-dump.test.ts src/programs/automation-studio/runtime/llm/evidence-progress/tests/progress-trace.test.ts --maxWorkers=2 --minWorkers=1
```

Observed exit0: 7 files/70 tests passed,23.49s. Per-file counts: outcomes19,reset-precondition6,refusals-of-one-kind5,loop repeat-guard19,held-amendments7,decision-dump6,progress-trace8.

Coverage includes four real consecutive temporary refusals followed by success (both authoring gates), real same-decision amendment retries carrying typed failure facts, real amendment rejection retaining `retry_allowed` as a diagnostic alone, malformed signal refusal, direct raw-dump and progress/step-log privacy with exact private text/digest absence, getter not invoked, originals untouched, call/effect/person/evidence retained, and opaque non-tool preservation.

The source-only comment cleanup after this run changes no behavior. No worker git/build/typecheck/generated Down tests/API/provider/browser/panel/whole-suite/agent operation, secret or user-data access. Source-wide types, structure audit, SDK build, producer integration, live-browser behavior and public consumer checks remain lead-owned and unverified by this lane.
