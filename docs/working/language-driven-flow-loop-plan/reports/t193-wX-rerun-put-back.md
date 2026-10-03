# t193-wX: rerun put-back re-does the same-place steps before it

Worker t193-wX (worker-high), 2026-10-02. Core tree `fxwork/t193/!FluxIQ`. `R` = `packages/fluxiq/src/programs/automation-studio/runtime`. Nothing committed.

## Outcome

Done. Cause 2 from `t193-lead-1002L.md` is fixed. If a rerun's reset puts the target back, the steps before it that started on the same place are now run again before the rerun. Those are the proposed steps immediately before the replaced step whose `replay.from` equals its `from`. They run in draft order, through the same per-step logic the draft replay uses. If one of them fails and the test from the start would not pass over that failure, the rerun becomes `unreachable` and its own call never runs.

## What changed and why

- `R/llm/node-tools/replay-draft.ts`: I moved the per-step loop of `replayAutomationStudioFlowDraft` out unchanged into a new exported function, `automationStudioFlowDraftReplaySteps({ executeTool, signal?, steps, run, callIdOf, reanchor })`, which returns `{ outcomes, observations, evidence? }`. It keeps the verify-not-repeat mode, `withheldBy`, the observations and first-failure evidence, and it still asks every step even after one fails. `replayAutomationStudioFlowDraft` now does its own reset and then calls this function with `callIdOf = dryrun.<attempt>.<position>` and `reanchor: true`, so its behaviour is the same as before. The private functions `call` and `reanchor` now take only `{ executeTool, signal }` (the type `ReplayCaller`). All replay-draft tests and dry-run-gate tests pass unchanged (they ran in the `llm/node-tools` run below).
- `R/llm/node-tools/step-place.ts`:
  - `automationStudioNodeRerunFromItsPlace` now takes `steps` (the draft).
  - The `in_place` shortcut is unchanged: no `from`, or `now === stateBefore`.
  - The reset and the way it is judged are unchanged.
  - After a successful reset, `stepsBefore` walks back over the proposed steps before the replaced one while their `from` is the same (compared as whole JSON). Non-proposed steps such as looks are skipped: they neither break the run nor join it.
  - The run is done through `automationStudioFlowDraftReplaySteps` with call ids `<callId>.place.<position>` and `reanchor: false`. Every step of the run starts on the place the reset just put back, so reanchoring would only reset away the earlier steps.
  - The outcome is judged by `firstBlocking`, which passes over exactly what the dry-run gate passes over: conditional/routing steps, withheld steps, and sometimes-present steps (`automationStudioFlowDraftSometimesPresentStepIds`). It does not rewrite the draft's routing.
  - `put_back` now carries `doneAgain: [{ step, stepId?, actionId, callId, outcome }]`. `outcome` is the replay word (replayed, verified, present, remembered, failed, and so on).
  - `unreachable` evidence now also carries `doneAgain` and `failedStep { step, actionId, outcome, evidence? }`. The `detail` text was reworded for both the reset-failed case and the step-failed case. `code` and `resultCode` are unchanged.
  - I rewrote the header comment to state the new rule and the run-muqiojz4 failure behind it.
- `R/llm/evidence-loop.ts` line 425: the only change is `{ step: rerunReplaces, steps: draftSteps, now: ... }`. At this point the replaced step is still in `draftSteps`, because `automationStudioLlmEvidenceRerunReplaced` runs later.
- Tests:
  - New file `R/llm/node-tools/tests/step-place.test.ts`, 7 tests on a towel-page fake where a reset restores only the address. They cover:
    - [navigate, swatch, look, "+", add, go-cart]: rerunning the add from the cart page gives reset, then `.place.2` swatch, then `.place.4` "+", then the rerun. The look is skipped, navigate is not re-done, and the result is quantity 2.
    - A lasting step inside the run is sent as `verify`, and the steps after it still run.
    - A failed "+" makes the rerun unreachable and the rerun is not executed. The answer carries `failedStep` and `doneAgain`.
    - An optional step whose target is absent is passed over.
    - With no same-place steps before it, `doneAgain` is `[]`.
    - With no `from`, the rerun runs in place.
    - With `now === stateBefore`, the rerun runs in place.
  - `R/llm/evidence-loop/tests/rerun-place.test.ts`: one new loop-level test (Blue, "+", Add to cart, Cart, then rerun step 3) through `runAutomationStudioLlmEvidenceLoop`. It checks the exact call sequence and that the rerun's evidence shows quantity 2.

## Commands run and observed results

Failing-first: I wrote the tests before the fix and ran `heavy.sh "t193-wX failing-first" npx vitest run <R>/llm/node-tools/tests/step-place.test.ts <R>/llm/evidence-loop/tests/rerun-place.test.ts` in `packages/fluxiq`:

```
× a rerun's put-back > does again, in order, the proposed steps before it ... → expected [ …(2) ] to deeply equal [ …(4) ]
× ... checks a step whose effect lasts rather than repeating it ... → expected [ [ 'rerun.5.place', 'reset' ], …(1) ] to deeply equal [ [ 'rerun.5.place', 'reset' ], …(4) ]
× ... runs nothing when a step before it cannot be done again ... → expected [ 'rerun.5.place', 'rerun.5' ] to deeply equal [ 'rerun.5.place', …(2) ]
× ... passes over a step the Flow would not always run ... → expected [ 'rerun.4.place', 'rerun.4' ] to deeply equal [ 'rerun.4.place', …(3) ]
× ... does nothing again when no step before it started on its page → expected { kind: 'put_back', …(1) } to deeply equal { kind: 'put_back', …(2) }
× a rerun of a step that built on the press before it on the same page > does the swatch and the "+" again ... → expected [ [ 'blue.1', null, 'Blue' ], …(5) ] to deeply equal [ …(7) ]
Failed Tests 6
```

The two in-place tests and the four existing rerun-place tests passed before the fix, as expected.

After the fix:

- The same two files: `Test Files 2 passed (2)`, `Tests 12 passed (12)`.
- `heavy.sh "t193-wX dir tests" npx vitest run <R>/llm/node-tools <R>/llm/evidence-loop <R>/llm/tests`: `Test Files 58 passed (58)`, `Tests 608 passed (608)`.
- `heavy.sh "t193-wX tsc" npx tsc --noEmit -p .` in `packages/fluxiq`: exit 2. All errors are in files I do not own and that another lane is editing:
  - `src/ui/activity-action/tests/failure-reason.test.ts`, lines 47, 51 and 52: TS2554.
  - `src/ui/activity-action/tests/icons.test.ts`, line 4: TS2322 `"result_check"`.
  - `src/ui/activity-action/tests/record.test.ts`, line 21: TS2339 `reason`.

  None are in my files.
- `node scripts/structure-audit.mjs` at the Core root: `structure-audit: passed (218 warning(s), 349 baselined)`. No warning names any file I touched.
- `git diff --stat` on `evidence-loop.ts`: 1 insertion, 1 deletion (only my expression).

## Not verified

- No Lab run and no live browser. I have not checked whether the web host answers `{ replay: "step" }` for a swatch or "+" press on the real bigbox towel page with `core.replay.replayed`. The fix relies on the host's existing replay support, the same support the dry run uses.
- The real domain records `ranWith` on these steps (my tests supply it). A same-place step without `ranWith` has nothing to replay with, counts as `failed`, and would now make the rerun unreachable where before it ran. That is deliberate, matching replay-draft ("a step with nothing to run it with is a failed step"), but I have not observed it on live data.
- No full suites were run, per the brief.

## Open questions or contradictions found

1. **The model does not yet see `doneAgain`.** `put_back.doneAgain` is returned, but `evidence-loop.ts` does nothing with a `put_back` result. It has never surfaced the reset either: the rerun's evidence is the rerun call's own result, `ran`. Showing the model that its rerun ran after the steps that were done again needs one more edit in `evidence-loop.ts`, for example annotating `ran`'s evidence with `place.doneAgain` when `place.kind === "put_back"`. That line is outside the one expression I was allowed to change. The `unreachable` case does reach the model, because the rerun is answered with that result, and it now carries `doneAgain` and `failedStep`. Each step that was done again is also its own `executeTool` call, so it appears in step logs.
2. **Chat wording needs a change; I did not edit it.** `R/activity/wording/tool-call.ts` matches `RERUN = /^rerun\.(\d+)(?:\.|$)/`. A step that is done again (`rerun.10.place.9`, value `replay: "step"` or `"verify"`) therefore gets the label "Trying step 10 again: clicking “+”", which is wrong: it is step 9 being done again before step 10. A `verify` call would read as an action. Suggested fix: for a callId `rerun.<n>.place.<m>` with a `step` or `verify` replay value, show it as `kind: "note"` with wording such as "Doing step <m> again before step <n>" (or "Checking step <m>" for verify).
3. **Docs.** No paragraph in Core `docs/architecture/**` describes the rerun put-back. The only "rerun" hits are about live-patch rerun seeding: `automation-studio.md:746`, `automation-studio-native-nodes.md:187` and `package-boundaries.md:926`, which are unrelated. The doc owner may want to add the rule.
4. **If a step that was done again fails, the remaining steps in the run are still asked before the rerun is refused.** This is replay-draft's run-every-step behaviour, kept on purpose so its per-step logic is reused unchanged. Those are replays of steps that already ran on that page, so no new kind of act is introduced.
