# t196 merge resolution (Core and downstream)

## Outcome

Done. Both conflicted paths are resolved and staged; no unmerged paths and no
conflict markers remain in either checkout. Nothing was committed and no merge
was aborted.

## What changed and why

### Core `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/check.ts`

- Hunk 1 (claims): t196's authored-draft claims
  (`automationStudioInstructedActDraftClaims(steps)`) followed by the result's
  claims with any act id the draft already claims filtered out, fed to dev's
  choices-aware `assign(acts, choices, claims)`. One small change on top of
  t196: the `annotated` set lowercases the draft claim ids, because the filter
  compares against `claim.action.toLowerCase()`.
- Hunk 2 (per-act verdict): t196's `automationStudioInstructedActStepFault`
  for acts, dev's `actSteps.set(act.id, step)` bookkeeping, dev's
  `step_claimed_twice` check, and dev's whole choices loop (with
  `whyNot(step, onlyArrives(step))` and `choice_is_the_act_step`) unchanged.
- The fault helper covered everything dev's act checks did (kept, changed
  something, only-arrives with the `open` exemption, optional, and the plural
  `act_needs_repeat`), in the same order. To keep one copy of those rules, the
  helper now calls `whyNot` and adds the repeat check, and `whyNot`'s return
  type is narrowed to its four literal reasons.
- Auto-merge defect found by tsc: the helper's declared return type was
  `Exclude<reason, "no_step_named" | "no_such_step" | "step_claimed_twice">`.
  Dev had added `choice_is_the_act_step` to the reason union, so the Exclude
  let that reason through. `checklist.ts` (t196) assigns the helper's result to
  `AutomationStudioInstructedActTodo`, which lacks it, and that failed with
  TS2322 at `checklist.ts(65,3)`. The fix was to add `"choice_is_the_act_step"`
  to the Exclude.

### Downstream `domain/src/runtime/llm-evidence/node-run/`

- `replay.ts`: t196's version taken (`git checkout --theirs`), with the
  `WebNodeRun` import changed from `./run` to `./context`. The three-way diff
  showed dev's only change to this file since the merge base was that import,
  so no other dev behaviour was in it. Lane A's shown-address record
  (`run.shown(page)`) sits in the answer helper, which t196 moved into
  `replay-answer.ts` and kept there.
- `replay-answer.ts`, `verify.ts` (re-added by t196): `WebNodeRun` import
  changed from `./run` to `./context`. Both compile against dev's `context.ts`.

## Commands run and observed results

- `bash .../heavy.sh "t196merge core-tsc" npx tsc -p packages/fluxiq/tsconfig.json --noEmit`
  (Core): the first run exited 2 with the TS2322 at `checklist.ts(65,3)`
  described above. After the fix it exited 0 with no output.
- `bash .../heavy.sh "t196merge core-vitest" npx vitest run instructed-acts runtime/llm/ runtime/flow-draft/ --maxWorkers=2 --minWorkers=1`
  (from packages/fluxiq): 93 test files passed of 93, and 958 tests passed of
  958. It exit 0. The run included instructed-acts `check.test.ts`,
  `checklist.test.ts`, `instruction-choices.test.ts` and
  `instruction-acts.test.ts`.
- `bash .../heavy.sh "t196merge domain-check" pnpm --filter @fluxiq-web-extension/domain check`
  (source and test tsc): exit 0.
- `bash .../heavy.sh "t196merge domain-test" pnpm --filter @fluxiq-web-extension/domain test`:
  1023 tests, 1023 passed, 0 failed, exit 0. The compiled
  `.test-build/runtime/llm-evidence/node-run/tests/replay-verify.test.mjs`
  exists, so the new test was part of the run.
- `git diff --name-only --diff-filter=U` returned empty in both repositories.
  `git grep` found no conflict markers in `packages/fluxiq/src` or `domain`.

## Not verified

- Only the named vitest subsets ran. The full Core suite, `pnpm check`,
  `pnpm test` and `pnpm build` were not run.
- The domain `check` ran after the first Core tsc and before the Core fix. The
  fix changes only a return type inside check.ts, so domain typing does not
  depend on it, but the domain check was not repeated after the fix.
- No live or browser run was made.

## Open questions or contradictions found

- The brief said lane A's F11 deleted `replay-answer.ts` and `verify.ts`. At
  the merge base they were not separate files. The base `replay.ts` held the
  answer helpers inline, and t196 extracted them into `replay-answer.ts`.
  Dev's commit ab3b1381 ("the replay-verify path is removed") may have removed
  an older verify path. Both files are now restored as t196 has them. Whether
  Core's dev still issues the `verify` replay kind, rather than only t196's
  `flow-draft/verify-only.ts`, is worth a glance by the supervisor.
- `checklist.ts` (t196) lists only acts, not an act's choices (`requires`). A
  choice id written in a step's `acts` is still read by the check through
  `automationStudioInstructedActDraftClaims` and `assign`'s choice-id match,
  but the checklist does not show choices. This is a behaviour gap to consider,
  not a merge defect.
- `docs/working/language-driven-flow-loop-plan.md` has an unstaged
  modification in the downstream checkout. It is not mine and I did not touch
  it.
