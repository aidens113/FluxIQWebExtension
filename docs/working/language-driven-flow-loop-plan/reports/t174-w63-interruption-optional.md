# t174-w63: interruption steps made optional (Core)

## Outcome

Done. The Core tree at `C:/Users/osrs_/FluxStuff/fxwork/t174/!FluxIQ` now carries `interruption: true` from a call's
draft statement onto the draft step. A proposed step that has the flag, claims no act and has no routing of its own
is wired as `optional` (failed -> join) when the Flow is written. Nothing is committed.

## What changed and why

R = `packages/fluxiq/src/programs/automation-studio/runtime/`.

- `R/llm/evidence-loop-decision.ts` (`readCallRecord` only):
  - `"interruption"` is now one of the exact keys.
  - Only the value `true` is carried. Any other value is treated as absent and is never refused, matching how
    `control` is handled.
- `R/llm/evidence-loop/tool-execution.ts`: `draft.interruption?: true`, documented.
- `R/llm/evidence-loop/call-record.ts`:
  - The return type gains `interruption?: true`, and the record copies it.
  - `evidence-loop.ts` spreads `...record` into `draftRecord`, so the flag reaches the step with no edit there. The
    loop test confirms this: `result.steps[0].interruption === true`.
- `R/flow-draft/step.ts`: `interruption?: true`, documented as "the host says this step answered something that stood
  in front of the page ... and was gone after it". The doc comment also says that the stored routing is not rewritten.
- `R/flow-draft/sometimes-present.ts`:
  - The header gains a paragraph on interruption steps.
  - New `automationStudioFlowDraftInterruptionStepIds(steps)` returns the ids of steps that meet all of: proposed
    (`automationStudioFlowDraftStepIsProposed`), `interruption === true`, no `acts`, and `routing === undefined`.
    These are the same exclusions the existing function applies.
  - It is exported through the existing `export *` in the barrel, and the barrel's header comment now mentions it.
- `R/flow-bootstrap/authoring/draft-routing.ts`:
  - A new private `effectiveSteps()` returns a copy of the routed steps. Each interruption step in the copy has
    `routing: {kind: "optional"}`, and the stored draft step is not changed.
  - `routeAutomationStudioFlowDraftSteps` uses that copy everywhere it used `input.steps`: `byId`, `needsLibrary`, the
    main loop and `heldJoin`. An interruption step therefore gets the normal optional diamond, including the held-join
    case.
  - A step that claims an act is excluded by the id function, so it is never made optional.
  - The header gains a paragraph on this.
- `R/flow-draft/site-memory.ts`: the comment that waited for a host to record the press's layer is rewritten (comment
  only). It now says the host records `interruption`, and that such a step is made optional where the Flow is written.
- `docs/architecture/automation-studio/llm-flow-bootstrap.md`: one paragraph after the t174/F33 paragraph.
- Tests:
  - `R/llm/evidence-loop/tests/authored-draft.test.ts`, 3 rows:
    - `true` is carried.
    - `"yes"`, `1`, `false`, `"true"` and an object are each withheld: `effectApplied` is still read, the draft has no
      `interruption` key, and the invalid code is `undefined`.
    - The call record carries it, and so does the step the loop appends.
  - `R/flow-draft/tests/sometimes-present.test.ts`, 4 rows:
    - An interruption step with no acts gives its id.
    - One with an act claim gives none.
    - One already routed gives none.
    - A dropped step or an `effectApplied: false` step gives none.
  - `R/flow-bootstrap/authoring/tests/draft-routing.test.ts`, 2 rows:
    - An interruption step gives nodes click, merge, click, with `failed -> merge:in` and `success -> merge:branches`.
      The step object passed in still has no `routing`.
    - An act step that also has `interruption` stays a straight line with no `failed` edge.

## Commands run and observed results

All commands ran from `packages/fluxiq` unless noted.

1. Failing-first run, before any implementation:
   - Command: `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t174-w63 vitest" pnpm exec vitest run <authored-draft.test.ts> src/.../flow-draft/tests src/.../flow-bootstrap/authoring/tests`
   - Result: `Failed Tests 8`.
     - All 3 parse and record rows failed.
     - All 4 sometimes-present rows failed with `TypeError: automationStudioFlowDraftInterruptionStepIds is not a function`.
     - The draft-routing optional row failed with `expected [ 'web.output.dom-click', …(1) ] to deeply equal [ …(2) ]`.
     - The act-step row passed. That is expected, because it guards behaviour that already held.
2. The same vitest command after the change: `Test Files 23 passed (23)`, `Tests 224 passed (224)`.
3. `bash .../heavy.sh "t174-w63 check" pnpm check`:
   - The build-cache step `fluxiq:check` ran `tsc --noEmit` (34770 ms) and printed no type errors. This includes
     `R/executor`, which another worker is editing concurrently.
4. `node scripts/structure-audit.mjs` (Core root):
   - Result: `structure-audit: passed (217 warning(s), 349 baselined).`
   - Advisory warnings on owned files:
     - `draft-routing.test.ts` is at 442 lines. It was already 409, past the 400-line advisory threshold.
     - `evidence-loop-decision.ts` was already flagged for 525 lines and for 11 exported values.

## Not verified

- No live or browser run.
- The downstream half is not in this tree's scope: the host emitting `interruption`, from the web binding's `run.ts`
  and `answered-layer.ts`.
- The executor skipping absent optional steps belongs to another worker, and I did not check it together with this
  change.
- The w60 report also proposed marking interruption steps optional in two more places. The brief marks both "Must not
  touch", so neither was done:
  - `R/llm/node-tools/dry-run-gate.ts`, the conditional set before the replay verdict;
  - `R/llm/harness-options/bootstrap-completion.ts`.
  - Consequence: the dry-run gate still judges an absent interruption step by the replay rules (`remembered` or
    sometimes-present). Only the written Flow treats it as optional.

## Open questions or contradictions found

- **Brief versus w60 report, parse row placement.** The w60 report puts the parse row in
  `R/llm/tests/evidence-loop-tool-failure.test.ts`. The brief owns only `authored-draft.test.ts`, so the row is there.
- **Instructed-acts check.** Because the stored draft keeps no `routing`, the instructed-acts check
  (`step_is_optional`) and `automationStudioFlowDraftConditionalStepIds` do not see interruption steps as optional.
  This is harmless because those steps claim no act, but the supervisor may want the dry-run gate to use
  `automationStudioFlowDraftInterruptionStepIds` in a follow-up brief.
- **One export per file.** `sometimes-present.ts` now exports two functions. The brief asked for it there, and the
  structure audit did not flag it.
