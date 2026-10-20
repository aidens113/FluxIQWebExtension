# t743-c3-repair-first: worker report

## Outcome

Done, with two lines of wiring left for the lead (listed under Open questions). Paths below are relative to
`C:/Users/osrs_/FluxStuff/fxwork/t743/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/project-agents/`.

## What changed and why

- `contracts/builder-return.ts`: new optional field `terminalReason`, from a closed list:
  `allowance_spent | stopped | person_ended | gate_unsatisfiable`. The list is a module-private const, so the file
  gains no exported name. Parsing uses `shape.oneOf`, so any other value is refused `project.invalid_choice`. `issues()`
  refuses the field on a done return with `project.return_terminal_reason`.
- `dispatch/ending.ts`: the reason is set from Core's own signals and never from the words of the reason
  (`withTerminal`, which never sets it on a done return):
  - `thrown`: `stopped` when the brief was stopped; `allowance_spent` when the allowance had refused.
  - `built` (the loop failed): `allowance_spent` when the allowance refused; `stopped` when the loop code is
    `llm_evidence_loop.cancelled`. Only the build's stop can reach `built` that way, because `untilEnded` in
    run-brief catches the brief's own ending first.
  - `reset` (the loop failed): the same two rules.
  - New `personEnded(brief, outcome, reason, spend)`: the same return run-brief's private `endedAs` builds today, plus
    `person_ended` when the outcome is blocked. This is the person-refusal and person-only-check signal that already
    exists structurally: the ports' `ended` signal, meaning a lasting act the person did not permit or a check only a
    person can pass. I found no other structural person signal on the return path.
  - `gate_unsatisfiable` is accepted by the type and the parser only. Nothing sets it yet.
- `supervisor/state.ts`: new `unrepaired()` (plus a private `changedAfter` and a module helper `short`). For each
  subflow in the plan in force, it looks at the latest build or repair return. That return counts when it is blocked
  or partial and has no terminal reason. A counted subflow is listed unless its trailing run of short returns already
  holds a changed brief that followed an earlier one. A changed brief is a repair, or a brief sent under another plan
  digest (that is, after `project.amend_plan`). A brief whose `sentAs` key equals the one before it is a resend and
  does not count.
- `supervisor/completion.ts`: `project.completion_repair_first` is placed after `ended_too_soon` and before the reset
  rule. It applies only when no rescued pass or fallback stands, so those branches are unchanged.
  - The detail is `unrepaired: [{subflowKey, failingBrief}]`.
  - The money check, `canPayForBrief`, calls `automationStudioProjectSupervisorBriefSizing` with one repair, the same
    way and with the same arguments as `dispatch-tool.ts`. No purse means it can pay, matching dispatch, which sizes
    nothing without a purse.
  - Bound: each subflow is named in at most one refusal (`heldForRepair`), so the rule can never hold the build to its
    ceiling.
- `supervisor/guidance.ts`: step 7 now says that, while money is left, each subflow that came back blocked or partial
  gets one changed brief first (a repair naming the failed trial, or an amended plan with a brief under it), that a
  resend does not count, and that a subflow whose return says nothing more can be done is skipped. There is a new
  `GUIDANCE.completion.repairFirst`. All wording is generic.
- Tests:
  - New `dispatch/tests/terminal-reason.test.ts` (5 tests).
  - 1 test added to `contracts/tests/builder-return.test.ts`.
  - 5 tests added in a new describe block at the end of `supervisor/tests/repair-repeats.test.ts`. They are not in a
    new file because `supervisor/tests` already holds 25 files, the per-directory budget. The 5 tests cover:
    - refused once after one blocked return, then let through;
    - admitted after a repair that also failed;
    - admitted when the return has a closed terminal reason;
    - admitted when the purse is drained;
    - refused after a resend alone.
  - Existing completion tests that ended right after a blocked brief now expect the extra refusal, with one more `end`
    step added: 3 tests in `supervisor-loop.test.ts` and 3 in `reset-next.test.ts`.

## Commands run and observed results

All run from `.../fxwork/t743/!FluxIQ/packages/fluxiq` with `pnpm exec vitest run`:

- Baseline before any edit: supervisor/tests, the dispatch ending, return-reason and stopped-repeating tests,
  contracts builder-return, and system-prompt. Result: `Test Files 31 passed (31)`, `Tests 285 passed (285)`.
- After the edits, over supervisor/tests, dispatch/tests and system-prompt: 7 failed.
  - 6 were my expected completion-order changes. I then updated those tests.
  - 1 was `dispatch/tests/brief-places.test.ts`, an untracked file belonging to another worker that was in progress.
- `supervisor/tests` (whole folder) -> `Test Files 26 passed (26)`, `Tests 210 passed (210)`.
- `llm/deepseek/tests/system-prompt.test.ts`, `supervisor/tests/guidance.test.ts`, `dispatch/tests` and
  `contracts/tests` -> `Test Files 31 passed (31)`, `Tests 238 passed (238)`. brief-places passed on this rerun.
- Prompt contract test: it passed (39 tests), so **no pins moved**. `system-prompt-pins.json` was not edited.

## Not verified

- No typecheck, structure audit or build was run, as the brief forbids them. `ending.ts` is 537 lines, `state.ts` 614
  and `completion.ts` 252, all under 800. `dispatch/tests` now has 24 files: its 22, mine, and another worker's
  brief-places.
- No test covers the amend path ("a brief under an amended plan counts; an amend alone does not"). The logic is the
  planDigest comparison in `state.changedAfter`.
- Not run live.

## Open questions or contradictions found

1. **Wiring for the lead in `dispatch/run-brief.ts`, which I do not own.**
   - Its private `endedAs` should become a single call to `ending.personEnded(brief, outcome, reason, spend)`. Until it
     does, `person_ended` is never set in a real run.
   - Line 285 (`ending.notStarted` when the purse cannot carve the allowance) and the dispatcher's "build was stopped"
     `notStarted` (`dispatcher.ts:83`) carry no terminal reason. `notStarted` takes no reason argument today.
2. **`supervisor/dispatch-tool.ts:631`, which I do not own**, builds what the supervisor sees of a return and forwards
   only `stoppedRepeating`. It should also forward `terminalReason`, so the model sees why a subflow is exempt.
   Completion reads the return directly, so the rule itself works without it.
3. **Two readings of the brief I had to settle:**
   - "Latest return under the plan in force" taken literally would let an amend alone release every failed subflow,
     because the old plan's returns stop being "under the plan in force". So `unrepaired()` takes each subflow's latest
     build or repair return under any plan, provided the subflow is still in the plan in force, and counts a brief
     under the new plan as the changed brief.
   - "Admitted after a repair also failed" holds without needing a refusal first, because the whole trailing run of
     short returns is checked for a changed brief.
