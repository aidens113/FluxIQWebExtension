# t935 draft-view callId (Core)

## Outcome
Done. Changes are uncommitted in Core tree C:/Users/osrs_/FluxStuff/fxwork/t935/!FluxIQ (branch task/t935-draft-callid).

## What changed and why
- packages/fluxiq/src/runtime/flow-authoring/draft/entry.ts: `stepLine` computes `call` (the step's own `callId` when a non-empty string, via Object.hasOwn) and spreads it into the "replaced" return and the normal return. Same code as t905 280c4bdad, nothing else ported. A checkedCandidate/priorExecution callId is never used.
- packages/fluxiq/src/runtime/flow-authoring/draft/tests/entry.test.ts: new describe "the call identity a draft step line shows": (a)+(b) own callId shown, also on a replaced step; (c) step with callId deleted but with callId on checkedCandidate and priorExecution gets no top-level callId.
- Existing expectations updated only because the new field appears (2): "preserves every non-default value on a step line" (added `callId: "call.1"`), and the replaced-attempt toEqual (added `callId: "call.3"`).
- docs/architecture/automation-studio/llm-flow-bootstrap.md (~line 2615): one clause saying every draft step line, replaced ones included, shows the step's own `callId`, never a check's or prior execution's.

## Commands and results
- Red, on unmodified entry.ts (test added first): vitest entry.test.ts -> 1 failed, 35 passed (36); failure "expected undefined to be 'call.1'". (c) passes on dev already, as it pins the negative.
- After the change, wider run (draft dir, answer-first dropped-act, refuted-result, stalled-amendments-replay, rerun-check, automation-activity), exit 1: 109 files passed, 1 failed; 985 passed, 1 failed. The one failure was the "non-default value" toEqual breaking only on the new callId; updated.
- Green: vitest entry.test.ts -> 1 file, 36 tests passed (exit 0). The other 109 files/985 tests of the wider run passed before the one-line expectation fix; I did not re-run the whole wider set after it (only entry.test.ts, the sole file changed since).
- `pnpm.cmd --filter fluxiq check` -> exit 0.
- `node scripts/structure-audit.mjs` -> exit 0, "passed (549 warning(s), 914 baselined)".
All ran via heavy-slot (labels t935-red, t935-green2, t935-green3, t935-check, t935-audit).

## Not verified
- Downstream extension tests were not run. Files in the paired extension tree that mention flow_draft: domain/src/runtime/llm-evidence/node-run/tests/{call-words,draft-control}.test.ts, domain/src/runtime/tests/carried-{row-,}service-repair.test.ts, packages/test-runner/.../scripted-model/scripts/tests/{local-classifieds-save-dining-tables,professional-network-accept-messaged-invitations}.test.ts, flow-lane/terminal/tests/evidence.test.ts. I did not inspect whether any pins the exact step-line shape; the extension needs Core's build to see the change anyway. Nothing edited there.
- No Lab, browser or paid runs.

## Open questions
- Two earlier attempts launched with a `| tail` pipe lost their output (the background wrapper returned before the run finished); results above come from log-file reruns.

## Proposed commit message
Show each draft step's callId in the flow_draft view

Port of the draft-view callId from t905 280c4bdad. stepLine adds the step's
own callId (non-empty string only) to both the replaced and normal lines; a
checked candidate or prior execution never supplies it. Lets a scripted-model
test match draft steps to the tool calls it made. Two existing expectations
updated for the new field; one architecture line added.

Task: t935
Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
