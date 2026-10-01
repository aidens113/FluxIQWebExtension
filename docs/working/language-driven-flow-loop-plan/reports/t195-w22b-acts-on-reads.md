# t195-w22b: an act is never named on a read, `keep` never erases a loop, and the draft shows each act

R = `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/`

## Outcome

Partial. Every owned change is made and tested, and the new cases fail with the change reverted. Two things
outside my files are still needed:

1. **Core tsc fails** in `R/flow-bootstrap/evidence-loop-steps.ts:181`. Its exhaustive
   `EVIDENCE_STEP_AMENDMENT_REFUSAL_REASONS` needs `act_on_a_read: true, act_already_named: true`. The brief
   did not give me that file.
2. **The stall-note fix is inert until it is wired.** `stall-redirect.ts` now takes an optional `acts`, the
   checklist as the draft carries it. The loop's `facts()` in `R/llm/evidence-loop.ts` (about line 286) has to
   pass it, for example `acts: input.draft ? input.draft.acts?.(draftSteps) : undefined`. That line is outside
   the act-recording lines I was allowed to touch. Until it is added, the loop always uses the old "run it"
   wording.

## What changed and why

- `R/flow-draft/amendment.ts`
  - New refusal `act_on_a_read`. It covers an amendment carrying `act` on a step whose `effect !== "mutate"`.
    The check sits after the look check, so a look still gets `not_a_kept_step`, as `look-positions.test.ts`
    pins. That makes it the refusal for reads a Flow holds, such as a listing (cause 2, E11).
  - New refusal `act_already_named` for a kept step that already names the act. It replaces the
    `already_in_flow` that contradicted the checklist (cause 5). A non-kept step still gets `already_out`.
  - `keep` no longer clears a `repeat`. A `keep` that carries `act` clears no routing at all. A bare `keep`
    still clears `optional`, `only_if` and `on_failed` (cause 3, E21 and E26).
  - The header, the `act` field docs and the schema descriptions for `keep` and `act` now say all this.
- `R/flow-draft/entry.ts`
  - `stepLine` shows `act: "a1"` (several are comma-joined) on a step that names acts, and nothing otherwise.
  - The authored per-item sentence ends "..., and never act yourself on the items your listing left out." It
    stays one sentence with "repeat", so the entry test's `/every item of a list[^.]*repeat/` still holds.
- `R/llm/evidence-loop/rerun-replacement.ts`: acts carry onto the rerun only when `rerun.effect === "mutate"`.
  They are removed from the replaced step either way, so an act wrongly named on a listing disappears when the
  listing is rerun.
- `R/llm/evidence-loop.ts`: one line, 212. `appended.acts` is set only when `appended.effect === "mutate"`. A
  read run with `act` is still added to the Flow, without the act.
- `R/llm/evidence-progress/stall-redirect.ts`
  - New optional input `acts?: JsonValue`, the checklist value.
  - When the first missing act, or a choice under one, has a `step` and a `todo` other than `no_step_added`,
    the note says "Step S already names aN, and the checklist says it is not done because <todo>: correct step
    S for that reason. Do not run another step for aN, and never act yourself on an item your listing left out."
  - Otherwise the note still says "run it and add it with act aN".
  - A `todo` that is not code-shaped, or a `step` that is not a positive integer, is ignored.
- `R/llm/draft-amendment-feedback.ts`: explanations for `act_on_a_read` and `act_already_named`. The second
  says to correct the checklist's todo: repeat the press over its listing, or rerun the read that names the
  act, since a rerun of a read now drops it.
- Downstream `packages/test-runner/src/existing-fluxiq-control/publishable-step-value.ts`:
  `AMENDMENT_REFUSAL_REASONS` gains `changes_nothing`, `act_on_a_read` and `act_already_named`. Core already
  had `changes_nothing` and the Lab copy was missing it.
- Tests:
  - `R/flow-draft/tests/amendment.test.ts`: new block "acts on the draft" with 3 cases.
  - `R/flow-draft/tests/entry.test.ts`: 2 cases, and the `Entry` type gains `act?`.
  - `R/llm/evidence-loop/tests/rerun-replacement.test.ts`: the old case that expected a read rerun to carry
    `a1` now covers routing only. Three new cases: acts carry onto a mutating rerun, acts do not carry onto a
    read rerun, and a loop-level case where a read run with `act` records no act.
  - New file `R/llm/evidence-progress/tests/stall-redirect.test.ts` with 3 cases.
  - `R/llm/tests/draft-amendment-feedback.test.ts`: `everyReason` gains the two reasons.
  - Downstream `tests/publishable-step-value.test.ts`: the reason list and its comment are updated.

## Commands run and observed results

- Vitest, run in `packages/fluxiq`:
  - Command: `npx vitest run R/flow-draft R/llm/evidence-loop R/llm/evidence-progress R/llm/tests/draft-amendment-feedback.test.ts`
  - Result: `Test Files 37 passed (37)`, `Tests 241 passed (241)`.
- Revert check, Core:
  - Restored the HEAD versions of my five source files and of my one line in `evidence-loop.ts`, then ran the
    five test files.
  - Result: `Tests 10 failed | 31 passed (41)`. Every failure was one of the 10 new cases.
  - I then restored my files. A check with `\r` stripped shows `evidence-loop.ts` has the same content as
    before, CRLF kept, and its diff against HEAD is the one line.
- Core typecheck:
  - Command: `bash heavy.sh "t195-w22b core tsc" npx tsc --noEmit -p tsconfig.json`
  - Result: exit 2, with two errors:
    - `flow-bootstrap/evidence-loop-steps.ts(181,7): TS2739 ... missing the following properties ...: act_on_a_read, act_already_named`.
      This one is mine to report (item 1 above).
    - `flow-bootstrap/instructed-acts/tests/checklist.test.ts(7,3): TS2724 '"../index.ts"' has no exported member named 'automationStudioInstructedActDraftClaims'`.
      This belongs to the instructed-acts worker. I did not touch it.
- Downstream typecheck:
  - Command: `bash heavy.sh "t195-w22b test-runner check" pnpm --filter @fluxiq-web-extension/test-runner check`
  - Result: exit 0.
- Lab pin:
  - Built with `bash heavy.sh "t195-w22b test-runner build" node ../../scripts/build-cache/cli.mjs test-runner:build`
    (exit 0), then ran `node --test dist/existing-fluxiq-control/tests/publishable-step-value.test.js`.
  - Result: `# pass 18`, `# fail 0`.
  - Revert check: with the old list put back in the compiled `publishable-step-value.js`, the run gave
    `not ok 17 - every reason Core's draft refuses an amendment with travels`, `# pass 17`, `# fail 1`.
  - After restoring the compiled file: `# pass 18`, `# fail 0`.
- Structure audit:
  - Core `node scripts/structure-audit.mjs`: `structure-audit: passed (210 warning(s), 349 baselined)`. The only
    warning on a file I touched is the existing 758-line warning on `evidence-loop.ts`, whose length my change
    did not alter.
  - Downstream: `structure-audit: passed (154 warning(s), 118 baselined)`. Nothing on my files.

## Not verified

- No full suites, Lab runs, browser or model calls, as the brief requires.
- Core tsc does not pass yet, because of the two errors above. My own files report no type errors.
- The stall note's new wording is reached only once the `facts()` line is wired (item 2), so it is covered by
  the unit tests only and not through the loop.
- I did not check whether the per-act checklist reasons from the parallel `check.ts` and `checklist.ts` work
  still use the `todo`/`step` field names. I read them in the current tree before that worker's edits landed.

## Open questions or contradictions found

- `amendment.ts` and the Lab copy both say a new refusal reason must also be allowed in
  `flow-bootstrap/evidence-loop-steps.ts`. The brief left that file out, so the supervisor needs to add the
  two lines.
- Brief item 5 needs data the stall note never received. I added an optional input, but the wiring is
  outside my lines (item 2).
- `act_on_a_read` refuses the whole amendment, so `add act a1` on a listing does not add the listing. The
  model is told to add it without `act`. Partially applying it instead would hide the refusal.
- On the tool-call path, a read run with `act` is added without the act and with no refusal. That follows the
  brief ("do not record acts"). The model now sees no `act` on that step in the draft, but nothing tells it
  why.
