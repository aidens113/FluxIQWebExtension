# A Flow that assembles wins, and a repair is told what did not assemble

Fixes 5 and 6 of `priya-not-assembled.md`, for run-mwblz4aq-0baa810a. Core paths are relative to
`C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ/packages/fluxiq/src/framework/automation-service/service/answer-first/`.

## Outcome

Done. Both parts are covered by tests. The run's shape is reproduced through the real service, and that test fails when the fix is taken out. The first `pnpm structure:check` failed on the parallel worker's `draft-routing.ts`, which was mid-edit. The rerun passed.

## What changed and why

**1. A Flow that does not assemble never wins.**
- `task-memory/better-flow.ts`: assembly is now ranked before the label table.
  - Where exactly one of the two Flows assembles, that one is kept.
  - Where neither assembles, `next` is kept, since it was built from the kept one.
  - Where both assemble, the label table applies as before.
  - `next` counts as assembling when it has a `candidateId`, which is set only after its draft assembled and was saved. The kept Flow is judged by the caller's new `keptAssembles`. Where the caller cannot say, the kept Flow's own `candidateId` decides. `candidateId` has been on saved Flows since they were introduced (git `91d746678`), so an old memory reads correctly.
- `attempt/remember.ts`: passes `keptAssembles`, read from the attempt's route.
  - A `use` route means the saved steps assembled at the opening, so it passes true.
  - A `repair` route means they did not, so it passes false. This is the case in this run: on a repair route `run.flowRun` is unset and `flowFailedLive` is false, so the old table kept attempt 1's steps.
  - It passes this only when the route's saved Flow is still the task's best (same `stepsDigest`). Otherwise it passes undefined.

**2. The repairing model is told what failed to assemble, and where.**
- `flow-run/assemble.ts`: a refusal now also returns `told: {code, step?, said?}[]`, built from error issues only. `step` comes from a `draft.steps.<n>` path. `said` is Core's sentence, given only for an explicit allow-list (`TOLD`) of `flow_draft.*` codes whose sentences quote only step numbers, node ids and Core's words. I read each sentence in `assemble-draft.ts`, `draft-bindings.ts` and `draft-routing.ts` to build that list. Left out, so told only by code and step, are `flow_draft.input_conflict` (it quotes test values with `JSON.stringify`), `row_binding_unknown_field`, `input_shadowed` and `step_binding_unknown_output` (they quote written names). The existing `issues` step-log strings are unchanged.
- `route/route-type.ts` and `route/route.ts`: the `repair` route carries `issues?` from the assembly's `told`.
- `attempt/opening.ts`: hands `told` to the route.
- `attempt/round-note.ts`: `flowRunTold` for a repair now adds `why` (a generic sentence) and `issues: [{code, step, said}]` beside `happened: NOT_ASSEMBLED`. The note names no scenario, site or task.
- `attempt/draft-save.ts`: the end-of-attempt step-log note now lists each issue as `<code> at <path>` after the codes, as `opening.ts` does. It never includes the issue's words.

**Tests**
- `task-memory/tests/better-flow.test.ts`:
  - The existing rows' Flows now carry a `candidateId`, since that table describes Flows that assembled. All existing assertions are unchanged.
  - New `describe "a Flow that does not assemble"` has 5 cases: the repair-route shape over every label pair; the kept Flow known not to assemble even though it saved once; a `next` that does not assemble never winning; neither assembling; and both assembling, which leaves the label table to decide.
- `route/tests/route.test.ts`: a repair carries `issues`, and carries none when nothing was told.
- `attempt/tests/round-note.test.ts`: the repair note carries `{code: "flow_draft.repeat_while_never_ends", step: 7, said}`, and a code with no sentence. Without issues the note is unchanged.
- `attempt/tests/assemblable-flow-wins.test.ts` (new; the folder now has 20 files): the run's shape, through the real service, real assembly and a scripted model.
  - Attempt 1 reads, then sends `amend_draft {step 2, repeat, while 2}`, and is achieved. Its draft is refused (`repeat_while_never_ends`). Best is attempt 1: confirmed, with no `candidateId`.
  - Attempt 2 is on the `repair` route. Its first decision's `core.attempt_note.flowRun.issues` contains `{code: "flow_draft.repeat_while_never_ends", step: 2, said: /^Step 2 repeats while step 2 succeeds/}`. It reads again and drops step 2. Its draft saves, and best becomes attempt 2.
  - Attempt 3 opens on the `use` route, started from attempt 2, with path `run_flow`.
- `attempt/tests/draft-save.test.ts`: its mocked refusal lacked `issues`, which a real verdict always has (the type requires it), so the new log line threw. The mock now has the real shape. The step-log test now asserts `draft.refused at draft.steps.4`, and asserts that the issue's words are absent.

## Commands run and observed results

Every command went through `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t885 -- ...`.
- `npx vitest run .../task-memory/tests/better-flow.test.ts .../route/tests/route.test.ts .../attempt/tests/round-note.test.ts` → 3 files and 33 tests passed, exit 0.
- `npx vitest run .../attempt/tests/assemblable-flow-wins.test.ts` → 1 passed, exit 0 (7.3 s of test time).
- **Fix reverted.** I took out the two assembly lines in `better-flow.ts` and ran the integration test with the better-flow test → exit 1, with 5 failures:
  - the integration test failed at `afterSecond.best`. Expected attempt 2 with its `candidateId`; received attempt 1's id. This is the live run's failure.
  - the 4 new better-flow cases failed with `expected 'k' to be 'n'` or the reverse.

  Afterwards I restored the fixed file from a scratch copy and confirmed `grep -c REVERTED` gave 0.
- `npx vitest run <answer-first>/task-memory/ route/ attempt/ flow-run/ tests/` → 80 files and 520 tests. 518 passed and 2 failed, both in `draft-save.test.ts` because of the mock described above, exit 1. After fixing the mock, `npx vitest run .../attempt/tests/draft-save.test.ts` gave 4 passed, exit 0. I did not rerun the whole set afterwards; only that file changed.
- `pnpm --filter fluxiq check` (tsc) → exit 0. This ran before the draft-save test fix, which changed only a `vi.mock` factory's literal.
- `pnpm structure:check` (Core root) → exit 1, with 1 violation: `FAIL [file-lines] runtime/flow-authoring/bootstrap/authoring/draft-routing.ts: 826 lines exceeds the 800-line limit`. That file belongs to the parallel worker (must-not-touch). It has 800 lines at HEAD and 800 now, so it was mid-edit when the audit read it. None of my files was flagged. My only note was an advisory: `task-memory/` has 19 source files against a 15-file threshold, unchanged by me.
- `pnpm structure:check`, rerun → `structure-audit: passed (531 warning(s), 969 baselined).`, exit 0.

## Not verified

- No live or Lab run (as the brief says). I did not check that a live repair model actually fixes step 32 once told. The note now carries the step and Core's sentence. But that sentence still offers `most` as a fix until the parallel worker's `draft-routing.ts` change lands.
- I did not rerun the full answer-first set after the draft-save mock fix; only that file was rerun.
- tsc ran before the draft-save test edit.

## Open questions or contradictions found

- `runtime/llm/harness-options/completion-issue-feedback.ts` (`DRAFT_ROUTING_CODES`) does not list `flow_draft.repeat_while_never_ends`. So a legacy or in-attempt completion that is refused for it still shows the model the code without Core's sentence. That file is outside my paths. It belongs with the parallel worker's guidance fix, or with fix 7.
- `flow-run/flow-run.ts` and `outcome.ts`: a `use`-route run whose assembly fails at run time gives `outcome.kind === "not_assembled"` with no issues. `round-note.ts` then still says only `NOT_ASSEMBLED`. This is rare, because the opening already assembled those steps, and those files were not mine. Carrying `told` on that outcome would close it.
- The repair note's `issues` stay in every round of the repair attempt, including after the model has fixed them, as `happened` already did. That is "what the task brought with it", not the draft's current state.
