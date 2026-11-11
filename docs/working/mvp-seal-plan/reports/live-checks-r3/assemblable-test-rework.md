# Rework of assemblable-flow-wins.test.ts

## Outcome
Done.

## What changed and why
Only `packages/fluxiq/src/framework/automation-service/service/answer-first/attempt/tests/assemblable-flow-wins.test.ts`.

- Attempt 1's unassemblable draft no longer uses the endless repeat-while (now refused at write time). It is now a recovery into a step already run: step 3 (a second read of the same node, with a different record-output label, so the loop's repeat guard does not refuse it) is set `on_failed` to step 2. The write accepts that; assembly refuses it with `flow_draft.recovery_behind_step`.
- Assertions on the told issue now check code `flow_draft.recovery_behind_step`, step 3, and Core's sentence `^Step 3 recovers into a step the Flow has already run`. The repair drops step 3. Every other assertion (attempt 1 has no candidate, best stays attempt 1 "confirmed", repair route startedFrom attempt 1, repair's candidate becomes best, attempt 3 uses the repair and runs the Flow) is unchanged.
- New test: "refuses an endless repeat-while as it is written, so the draft still assembles". Attempt 1 sends the repeat-while on the read; the next decision's `core.amendment_check` evidence has a refusal `{step: 2, reason: "repeat_never_ends"}`; attempt 1 has a `candidateId`, and the kept best is attempt 1's with that candidate.
- Findings on the way: the opening look (step 1) is not a kept step, so `on_failed` to it is refused at write time (`not_a_kept_step`); an identical second read is refused by the loop's repeat guard (`no_such_step` for the amendment). Hence the distinct second read.

## Commands run and observed results
All through `heavy-slot.mjs run t885 --`, in `packages/fluxiq`.
- Reworked file alone: 2 passed (exit 0).
- Acceptance command (the test file plus `task-memory` and `route`): `Test Files 8 passed (8)`, `Tests 57 passed (57)`, `EXIT 0`.
- Mutation: commented out the two ranking lines in `task-memory/better-flow.ts` (`if (keptAssembles !== nextAssembles) ...` and `if (!keptAssembles) return next;`, lines 37-38). Result: the reworked first test FAILED (`AssertionError: expected { ...(9) } to match object { ...(3) }`), the new second test passed; `Tests 1 failed | 1 passed`, `EXIT 1`.
- Restored better-flow.ts from a byte copy; `git diff --stat` for it is empty (only the CRLF warning) and lines 35-39 read as original. Status of that file shows no modification.

## Not verified
Full package suite; Lab/browser. Two earlier debugging runs were of the same test file only.

## Open questions or contradictions found
None. The scratch debug `console.log` added in one run was removed (grep for DBG is empty).
