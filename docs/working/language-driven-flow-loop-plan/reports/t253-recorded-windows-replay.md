# t253: recorded-windows replay failing on Core dev

Worker: t253-worker. Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t253/!FluxIQ`, branch
`task/t253-recorded-windows-replay` (off Core dev 4895ec4f). Nothing committed.

## Outcome

Done. The cause is an **intended behaviour change** in t193 (merge **62d65481**,
commit 2d45dc80, "Rerun put-back redoes the steps before it on its page"). It
interacts with a simplification in the replay fixture. The fix is to the fixture
only (test code). No source change.

## What changed and why

### 1. The diff (expected vs actual, 48 lines; 45 matched)

```
#32 expected: D32 amend_draft | rerun.23.place core.replay.replayed | rerun.23 web.inspect.succeeded
    actual:   D32 amend_draft | rerun.23.place core.replay.replayed
#38 expected: D38 amend_draft | rerun.24.place core.replay.replayed | rerun.24 web.inspect.succeeded
    actual:   D38 amend_draft | rerun.24 web.inspect.succeeded
#42 expected: D42 amend_draft | rerun.26.place core.replay.replayed | rerun.26 web.inspect.succeeded
    actual:   D42 amend_draft | rerun.26.place core.replay.replayed
```

The result was the same on three runs, so it is deterministic. In the trace,
`rerun.23` and `rerun.26` ended with `llm_evidence_loop.rerun_place_unreachable`.
The evidence shown to the model at 33 reads: "step 2 before it, which started on
the same page, could not be done again". Its `doneAgain` lists steps 2, 3, 4, 5,
6, 14, 18 and 20 (plus 23 and 25 for rerun.26), all marked `failed`. At 38 the
loop judged the target `already_there` because of the earlier failure, so it
sent no reset.

### 2. Bisect (first-parent merges, this test file only, `-t "everything-store-run4: every decision"`)

| Merge | Result |
| --- | --- |
| 109b387c (t195) | passed |
| 489c4a9c (t243) | passed |
| d9340ecd (t174) | passed |
| **62d65481 (t193 lane B)** | **failed** (first failing) |
| 4895ec4f (dev head) | failed (supervisor and me) |

Inside 62d65481, the only commit that touches the rerun path is 2d45dc80
(`step-place.ts`, `replay-draft.ts`, `evidence-loop.ts`). None of t244, t249 or
t250 caused this; they all came after 62d65481.

### 3. Intended or regression: intended

New rule from 2d45dc80 (`runtime/llm/node-tools/step-place.ts`): after a put-back
reset, the loop redoes "the longest unbroken run of proposed steps before [the
rerun] whose `from` is its `from`" under `<callId>.place.<position>`. If one of
those steps fails and is not excused, the rerun is unreachable and runs nothing.
That is exactly what happened here.

The fixture (`recorded-runs.ts`, `executeTool`) gave every step
`replay: { from: { location: START } }`. Because every step had the same `from`,
each rerun redid every proposed step of the build. The harness throws
`the loop ran rerun.23.place.2, which the log never ran` for those call ids. The
loop reads the throw as a failed step, so the rerun becomes unreachable. The
source follows its documented rule, so this is not a source regression. What
broke is the fixture's assumption that all steps start in one place.

Fix (`R/llm/decision-context/tests/recorded-runs.ts`, +16/-1): each step's `from`
is now `{ location: START, state: <world when the call started> }`. A comment
names merge 62d65481 / 2d45dc80 and explains why. In this fixture a reset
restores the state a step started in, so a put-back has nothing to redo. The
`now` lines for 32/38/42 and every other expectation are unchanged and still
pinned. The test again requires each rerun to trace as a reset followed by the
read. The redo rule itself stays covered by `node-tools/tests/step-place.test.ts`
and `evidence-loop/tests/rerun-place.test.ts`. Both pass.

Caveat, also stated in the code comment: on the live addresses, 32 and 38 had no
proposed step before them on the cart page. 42 did: step 25 (`addkettle1`, pressed
on the cart page at decision 34). Today's code would redo it before `rerun.26`.
The replay does not model this, just as it does not model any step's real address.

## Commands run and observed results

- Scratch diff test (temporary file `t253-scratch-diff.test.ts`, since deleted): printed the 3 differing lines above; same result on 3 runs.
- Bisect via `git restore --source=<sha> --worktree -- packages/fluxiq/src`, then `npx vitest run .../recorded-windows.test.ts -t "everything-store-run4: every decision"`, then restore to HEAD. Results are in the table. A leftover untracked `runtime/activity/step.ts` (present in 62d65481/d9340ecd, not in HEAD) was removed after each restore. The tree is clean apart from the fix.
- After the fix: `npx vitest run src/.../decision-context/tests src/.../route-state/tests/build-routing.test.ts` gave **Test Files 8 passed, Tests 52 passed**. recorded-windows.test.ts: 20/20.
- `heavy.sh "t253 dir tests" npx vitest run` over the decision-context dir plus every file that mentions recorded-runs and the step-place/rerun-place tests gave **Test Files 16 passed, Tests 120 passed**.
- `heavy.sh "t253 fluxiq check" pnpm --filter fluxiq check` exited 0 (tsc --noEmit, about 62 s). This ran before the final comment-only edit.
- `node scripts/structure-audit.mjs` gave `structure-audit: passed (223 warning(s), 349 baselined).` (run again after the final edit).
- `node scripts/docs-reference.mjs --check` gave `Deterministic framework reference is current.` (run again after the final edit).

## Not verified

- `pnpm --filter fluxiq check` was not run again after the last edit. That edit changed comment text only.
- No full suites, as the brief required.
- The claim about 42 and `addkettle1` comes from the run 4 log and the fixture's step positions (dry runs replayed 25 = addkettle1, 26 = rerun.24). I did not check it against the live run's recorded addresses.

## Open questions or contradictions found

- If the supervisor wants the replay to model t193's redo on 42 (redoing step 25 before `rerun.26`), the fixture needs per-step page addresses for run 4. It also needs logged codes for `rerun.26.place.25`. That would be a larger fixture change and would invent live data, so I did not do it.
