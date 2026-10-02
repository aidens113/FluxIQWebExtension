# t195-w26a: the build's test keeps what each step observed (W1)

Worker t195-w26a, 2026-10-01. Core `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ`, branch
`task/t195-live-control-flow`. `R` = `packages/fluxiq/src/programs/automation-studio/runtime/`. Implements section
4.2 of `t195-w25-completion-judge-design.md` with the types of its section 4.1. No Lab, browser or model call.

## Outcome

Done. Nothing committed.

## What changed and why

- `R/llm/node-tools/replay-draft.ts`: `AutomationStudioFlowDraftReplayResult` gains
  `observations: { step; stepId?; resultCode?; evidence }[]`.
  - One entry for each step whose answer could be read, pushed beside its outcome. `evidence` is
    `ran.result.evidence`.
  - A re-anchored step reports its second answer, the one its outcome is read from.
  - The reset is excluded. A failed reset or an unusable draft returns `[]`.
  - The first-failure `evidence` field is unchanged.
  - The shape is written inline rather than imported from the gate, so the replay does not import its gate. It is
    structurally identical to `AutomationStudioFlowDraftTestObservation`.
- `R/llm/node-tools/dry-run-gate.ts`:
  - It exports `AutomationStudioFlowDraftTestObservation` and `AutomationStudioFlowDraftTestReport`, exactly as in
    section 4.1, through the existing `export *` in `node-tools/index.ts`. `index.ts` itself did not need editing.
  - The gate input gains `observed?(report)`.
  - A private `passed(verdict, observations, reused)` helper does two things: it records `clean = { verdict,
    observations }` beside `cleanSignature`, and it calls `observed`.
  - `passed` is called on all four pass paths:
    - reuse of the same signature: `reused: true`, the stored clean verdict and observations;
    - a pass judged from the stored outcomes of a twice-replayed draft: `reused: true`, the re-judged `again`
      verdict and the refused replay's observations, which are now kept in `refused.observations`;
    - a clean replay: `reused: false`;
    - a pass after `madeOptional`: `reused: false`.
  - `observed` is never called on a refusal, and never for a disabled or unreplayable draft.
  - **One small deviation from the letter of the design.** `madeOptional` now returns the verdict that passes, or
    `undefined`, instead of a boolean. This lets the report's `verdict` be "the replay it passed on" (`ok: true`)
    rather than the raw refused verdict. Behaviour is otherwise identical.
- `R/llm/loop-configuration.ts`: `AutomationStudioLlmEvidenceLoopInput` gains
  `observeTest?(report: AutomationStudioFlowDraftTestReport): void`. It is imported as a type from
  `./node-tools/index.ts`.
- `R/llm/evidence-loop.ts`: one line added to the gate input,
  `...(input.observeTest ? { observed: input.observeTest } : {}),`. Nothing else in the file changed.
- Tests:
  - `R/llm/node-tools/tests/replay-draft.test.ts`, new `describe("what a replay observed")`:
    - a clean replay reports one observation per step, including a verify-mode (`create_new`) step, with the scripted
      evidence (including a read's rows), and not the reset;
    - an unreadable (thrown) step answer adds nothing, and a failed reset reports `[]`.
  - `R/llm/node-tools/tests/dry-run-gate.test.ts`: the harness and the `gate` helper now collect `observed`. New
    `describe("what a passing test reports")`:
    - a clean replay reports its observations; a second completion on the same signature reports
      `{ same verdict, same observations, reused: true }`;
    - a refused replay reports nothing, across three refusals, the third judged from stored outcomes;
    - a made-optional pass reports `verdict.ok: true` with every step's observation;
    - a twice-replayed draft that passes when judged from its stored outcomes reports the stored observations, with
      `reused: true` and no new replay calls.

## Commands run and observed results

- `npx vitest run src/programs/automation-studio/runtime/llm/node-tools src/programs/automation-studio/runtime/llm/evidence-loop`
  in `packages/fluxiq`: `Test Files 28 passed (28)`, `Tests 182 passed (182)`.
- Revert check: with `replay-draft.ts` and `dry-run-gate.ts` restored from `HEAD`, the node-tools run gave
  `5 failed | 48 passed (53)`. The 5 failures were exactly the new cases. The changed files were then copied back,
  and the diff stat was confirmed.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195-w26a tsc" npx tsc --noEmit -p tsconfig.json`:
  - First run: no errors printed.
  - Second run, a few minutes later: `exit=2`, with three errors, all in files I do not own (W3's
    `R/flow-bootstrap/unfinished-build/`):
    - `not-done.ts(31,7)`: TS2741, `'judged_wrong'` is missing from the stop-reason record;
    - `phases.ts(223,37)` and `phases.ts(248,89)`: `"judged_wrong"` is not assignable to the loop's exhausted-bound
      union.
  - No error was in a file I own. Another worker was editing those files concurrently.
- `node scripts/structure-audit.mjs` (Core root): `structure-audit: passed (211 warning(s), 349 baselined)`.
  - The only warning on an owned file is the existing advisory `evidence-loop.ts: 761 lines`.
  - The audit also said "1 baseline entries can be lowered". That is not from my change, and I did not run
    `pnpm structure:baseline`.

## Not verified

- Nothing consumes `observeTest` yet. `service.ts` wiring is the lead's, and the judge is W4's.
- There is no loop-level test that `observeTest` reaches the gate through `evidence-loop.ts`. Only the one-line
  spread and tsc cover it.
- The size of the reported evidence on a real site (for example, a large list read) was not measured. Every readable
  answer is kept whole.

## Open questions or contradictions found

- The report's `verdict` in the made-optional path is the re-judged passing verdict, not `replay.verdict`, which has
  `ok: false`. The design says "the replay it passed on", and this reading matches it. The lead should confirm.
- The tsc errors in `unfinished-build/` (`judged_wrong`) belong to the worker that owns those files (W3).
