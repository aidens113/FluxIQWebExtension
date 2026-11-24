# t995 F23: a saved Flow's replay loses the same click target every attempt

Worker report, 2026-11-23. Brief: `../briefs/t995-f23-replay-target.md`. No browser, no provider call, no paid call, no git mutation.

## Outcome

Done. The cause is found and reproduced provider-free on the product path. It is not in the target refind. `main.s5`'s control was not on the page. The step before it, `main.s4` (the booking stepper's "Next"), was never pressed on any replay. The attempt's run gate refused it as "already done earlier in the task", because the first attempt's act record held that press as a lasting act and carried it to every later attempt.

The fix belongs in the act record (`runtime/answer-first/act-record/`, unowned) and the run gate (`service/answer-first/run-acts/run-gate.ts`, t994's). The exact change is under "Proposed fix". No product code was changed in the owned paths, because nothing there is wrong: the refind's `gone` was a true reading of the page it was given.

## Evidence (screened metadata only; no page text, selectors or row values copied)

The copies are in the ignored `test-runs/t995-f23/` (`lab-run/` from `lab-runs/2026-11-20/run-mwov0vf8-41ab862a`, `attempts/` from the t960 campaign-b bundle). The scripts printed field names, codes, counts, handles and span names only. Every quoted string was redacted.

1. **What the saved Flow is.** The replay notes (requests 0251, 0365 and 0430) list draft positions 1, 79, 80, 81, 82, 83, then 85 and 86 (attempt 2), or 102 to 108 (attempts 3 and 4). Positions are attempt 1's call numbers, and they map one to one onto attempt 1's tool calls:
   - 79 is `browser-tab` (0213);
   - 80 is `dom-click` t473, pick a branch (0215);
   - **81 is `dom-click` t491**, the stepper's Next (0217);
   - **82 is `dom-click` t497**, pick the service option on the stepper's next step (0219);
   - 83 is `dom-click` t491, Next again (0221);
   - 85 is the extract (0225) and 86 the next page (0227).

   So `main.s4` is position 81 and `main.s5` is position 82.
2. **What happened on each replay.** Steps 0244, 0358 and 0423 are `main.s4`. Each reports `succeeded` in about 40 ms, with no `dispatch` or `send.click` span. The flow-run note reads position 81 as `skipped`: "This was already done earlier in the task, so it was not done again." `steps-ran.ts` gives that sentence only to an attempt the run gate answered `already_done` (asked, not sent) or that the engine's ledger skipped. The engine's ledger is per run and was empty, so this was the gate.
3. **Then `main.s5`.**
   - Steps 0245 to 0247 (and 0359 to 0361, 0424 to 0426) are three attempts, each ending `web.target.not_found` after a real `send.click` of about 3.8 s.
   - The fourth arrival (0248, 0362, 0427) holds only `arrival`, with one `send.capture_snapshot` inside it, then `checkpoint`, `ask-or-park` and `failed-attempt`. That is the source-less identity branch (`unbound-reacquire/step.ts` plus downstream `reacquire-unbound-target.ts`: exactly one scoped `web.dom.capture_snapshot`). It is not source-lineage, which would re-run a source read, and it is not the call-row branch.
   - Its outcome was `gone` (complete coverage). The step ended `executor.target.gone`, so `mayAsk` (incident-repair.ts:217) asks no in-run repair.
4. **Why the gate refused `main.s4`.** Every later attempt's note lists the act `act.6315632b…`, which has: what of 4 characters, state `may_have_landed`, `undeclared: true`, `carried: true`. The first attempt's by-hand Next at 0217 answered `pageChanged: true` with 9 change lines:
   - one `t472 … was …` line: another control's line now reads otherwise, the domain's `how: "reads"` (`domain/.../press-effect/change/statement.ts:58`);
   - seven `… gone` lines: the branch options left;
   - one summary line.

   `act-record/gate/read-answer.ts:81` reads any `reads` line as `changedState`. `act-record/seed.ts` then carries an undeclared press that has `changedState` into every later attempt as `heldOnRepeat`. `record.carried()` counts `heldOnRepeat` entries as `refusable`, whatever `lookedSince` says, so the run gate (`run-gate.ts`, native door) answers `already_done` with nothing sent.

   For contrast, the branch pick at 0215 changed only its own line (`t473 … now …`). It was not carried, and it replayed every time.

## (a) Why a control "still on the page" was concluded gone

It was not still on the page. The authored F23 claim is wrong on that point. The stepper never left the step before it, because its Next (`main.s4`) was refused on every replay. The service option `main.s5` presses exists only on the stepper's next step.

The source-less refind took a complete, same-place look at the very document the failed attempt was on, and correctly found no control with that identity. `gone` was the right reading of that page. It is not a refind defect, and the refind's identity, frame and observation gates should not be weakened.

`state-routing/not-arisen.ts` did not pass over `main.s5` either, and that is correct. `main.s5` is a press, and the domain floor says every press commits (`doesAct`). An act is never silently dropped.

## (b) Why no accepted repair made `main.s5` work on the next replay

Nothing was wrong with `main.s5`, and no repair could change what broke it:

- **Not decided by the Flow.** The refusal of `main.s4` comes from the attempt's act record, which is a union over all earlier attempts (`seed.ts`). The saved Flow does not decide it.
- **No in-run repair.** An `executor.target.gone` step gets none (incident-repair.ts:217).
- **The feedback pointed at the wrong step.** Between attempts, the model is told position 81 "was already done earlier in the task" and position 82 "control was not found… Fix that step". The repairs therefore changed the steps after 82: attempt 2 replaced 85 and 86 with 102 to 108 (the t985 note's d102 `extractList` rerun). Positions 81 to 83 stayed unchanged in every saved digest, and the next replay refused 81 again. The repairs did persist (attempts 2 and 4 saved changed digests), but they were aimed at the wrong step.
- **No overlay was involved.** No temporary target overlay was ever written for `main.s5` (it was found `gone`, never `found`), so nothing was lost between incident repair, draft, save and reload.

## Provider-free reproduction

**Core** (`src/engine/automation/target-reacquire/tests/t995-f23-carried-press.test.ts`). This file was written into an owned folder only so vitest could run it. Its subjects are the act record and the run gate, so the copy for the lead is `test-runs/t995-f23/proposed/carried-press.test.ts`, and the Core copy was removed. It drives the real `runAutomationStudioGraph` through the real `automationStudioAnswerFirstRunActGate` (`settle: true`). The act record is seeded by the real `automationStudioAttemptActSeed` from a record settled with the real `automationStudioAttemptActAnswerRead` of a stepper's Continue answer (one `reads` line and one `went` line). The page is a two-step permit stepper.

- The Continue's answer reads as `changedState` and is seeded with `undeclared`, `changedState`, `heldOnRepeat` and `carried`.
- Today: Continue is answered `already_done` with nothing sent, and the stepper stays on step 1. The option fails `web.target.not_found` three times. The source-less look (on step 1) says `gone`, and the option ends `executor.target.gone`, so the run fails. This is the F23 shape exactly.
- Contrast: with no carried act, an option re-rendered under a new address is found again (`reacquire: identity/found`), and the run succeeds.
- `it.fails`, the proposed fix: with the Continue's recorded effect `not_seen` on the page, it is pressed and the run succeeds. It fails today as expected. Flip it to `it` when the fix lands.

**Downstream** (owned, kept: `domain/src/runtime/target-reacquire/tests/reacquire-unbound-target.test.ts`). It tests `webAutomationReacquireUnboundTarget` directly, with the real `createWebTargetPlaces` and a fake capture dispatch, for the top document and for a proven child frame:

- a control re-rendered under a new address in the same proven frame is `found`, with a fresh selector patch;
- a stepper still on its earlier step is `gone` on a complete same-place look (the F23 page);
- a look that is busy or truncated is `unavailable/observation_incomplete`;
- a reloaded document, or a capture answered by another frame, is `place_unproved`;
- a child frame with no scoped prior capture of its own is `place_unproved`, with no capture sent.

The source-lineage variant and further negatives are covered by existing tests, which were rerun (see below).

## Proposed fix (outside owned paths; for the lead to schedule)

The structural defect: a carried act held only "to a look" (`heldOnRepeat`: undeclared, unclaimed, held because its answer changed a line) can never be looked at on a saved Flow's replay. No model is there, so the run gate refuses it on every later attempt forever. The classification also misfires for any in-page navigation, such as steppers, tabs, calendars and "Page 2 of 5" labels. These stay on one page and change a heading's words, which `read-answer.ts` calls "changed a line of the page it stayed on". F23 is the same class as t897's `run-mwb5cnxg` (a held composer prompt), which was handled downstream (not-arisen pass-over) and not at the hold.

Recommended change: do the look mechanically in the run gate, from the step's own recorded effect, with the host's existing comparison. Core still reads no page.

1. `runtime/answer-first/act-record/record.ts` (unowned, not t994's): add a read beside `carried()` that says whether the matched entry stands only by `heldOnRepeat`, meaning `entry.undeclared && entry.heldOnRepeat === true`. For example, `carriedHold(call: ForRun): { act: AutomationStudioAttemptAct; toALook: boolean } | undefined`, built by the same match as `carried()`. The contract type in `@fluxiq/contracts` is unchanged.
2. `framework/automation-service/service/answer-first/run-acts/run-gate.ts` (t994): in the native door, when the match is `toALook`, look before refusing:
   - Take the node's recorded effect (`automationStudioNodeRouteSignatures(request.node).effect`).
   - Observe the page with `observeAutomationStudioRouteState` (the gate needs the run's `projectId` and `flowId`; `flow-run.ts` `gatedOptions` has them in `ports.input`).
   - Ask `automationStudioRouteEffectSeen(host, effect, state)`.
   - Only `not_seen` (the host's strong evidence that nothing the act brought is on this page) admits the press. It then goes through `settling.stepOf/begin/native/nodeAnswered` like any uncarried press, and the record's `settled` clears `carried` as this attempt's own act.
   - `seen`, `unknown`, no effect, no host or a failed observation refuse as today.
   - Declared or claimed acts, and landed declared acts, are untouched.

   The same look belongs at the `effectDispatcher` door for Core's own `builtin.policy.action` nodes, using the node the settling last saw (`sawNode`).
3. Why this is safe:
   - A cart "Add" held by `rose` still shows its risen count after a reload, so its effect is `seen` or `unknown` and it is refused, as now.
   - A stepper's Next, a tab or a calendar arrow shows none of its effect on a fresh page, so it is `not_seen` and pressed.
   - A toggle already flipped is `seen` and skipped; one undone is `not_seen` and pressed.

   No retry, wait or cap changes.
4. Secondary, optional: `read-answer.ts:81` could stop counting `reads` alone when the same answer also says lines went or appeared (a view swap). That remains a word-shape heuristic, so the look above is the root fix.

Acceptance after the fix: flip the `it.fails` in `proposed/carried-press.test.ts` to `it`, and place it in `run-acts/tests/` once t994 lands. Live acceptance is company-website-saturday-certificate with `lab attempt --attempts 4`: attempts 2 to 4 send `main.s4`, reach `main.s5` and run the saved Flow. Whether attempt 1's saved `main.s4` carries a recorded effect signature could not be checked from the screened metadata; if it does not, the gate keeps refusing, and the build must record one.

## Commands run and observed results

All checks ran through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- …`, one at a time.

**Core** (`fxwork/t995/!FluxIQ`):
- `pnpm --filter fluxiq exec vitest run src/engine/automation/target-reacquire/tests/t995-f23-carried-press.test.ts --maxWorkers=1 --minWorkers=1 --fileParallelism=false` → 1 file, 3/3 passed, 34.2 s. This was the reproduction before the `it.fails` case was added.
- The same flags on the reproduction plus `src/framework/automation-service/executor/unbound-reacquire/tests/graph.test.ts`, `…/unbound-reacquire/tests/safety.test.ts` and `src/engine/automation/target-reacquire/tests` → 6 files, 64/64 passed, 141 s:
  - reproduction 4/4, including the `it.fails` case;
  - source-less graph 19 and safety 22;
  - row-across-call 4, stale-failure 11, read-only-source 4.
- The same flags on `src/framework/automation-service/executor/target-reacquire/tests` (source-lineage: `lineage.test.ts`, `step-reacquire.test.ts`) → 2 files, 17/17 passed, 42.7 s. The reproduction file had already been moved out of Core, so Core's tree is unchanged (`git status --short` is empty).
- `node scripts/structure-audit.mjs` → passed (569 warnings, 903 baselined), exit 0.
- `pnpm --filter fluxiq check` was not run, because no Core file is changed.

**Downstream** (`fxwork/t995/!FluxIQWebExtension`):
- `DOMAIN_TEST_BUILD_LABEL=t995 node scripts/test-domain.mjs runtime/target-reacquire runtime/tests/host-runtime-reacquire` (from `domain/`):
  - First run: 68 tests, 65 pass, 3 fail. The three failures were the child-frame cases, from a fixture fault: my scoped prior capture was keyed without `browserTabId`, so the host's keying never matched.
  - After fixing the fixture: 68/68 pass.
  - After the barrel-import fix: 68/68 pass again.
- `pnpm --filter @fluxiq-web-extension/domain check`:
  - First run: refused by the `core-build` preflight. Core's build was stale only because the temporary reproduction file was inside `packages/fluxiq`.
  - After moving it out: exit 0 (`core-build … current`, `domain:check` 67.5 s).
  - This ran before the one-line barrel-import edit. The test build in the run above compiled that edit.
- `node scripts/structure-audit.mjs`:
  - First run: 1 violation (my test imported `llm-evidence/control-spot/resource` past the barrel).
  - After the fix: passed (258 warnings, 551 baselined), exit 0.

**Evidence scripts:** read-only Python scripts in the session scratchpad, run over the ignored copies in `test-runs/t995-f23/`. They emit only keys, codes, counts, spans, handles and redacted templates.

## Not verified

- The live four-attempt acceptance. No browser or Lab run was allowed.
- Whether attempt 1's saved `main.s4` node holds `routeSignatures.effect`. The saved Flow document itself is not in the screened artifacts.
- The exact words of the carried act and of `t472`'s line. They were redacted by design; the identification rests on handles, positions, spans and counts.

## What changed and why

- **Added `domain/src/runtime/target-reacquire/tests/reacquire-unbound-target.test.ts`** (owned). These are the brief's refind cases plus the F23 page, at the module seam.
- **Added this report.**
- **No product source was changed.** The cause is outside the owned paths, and the refind behaves correctly.
- **Reproduction parked for the lead.** The Core reproduction is in the ignored `test-runs/t995-f23/proposed/carried-press.test.ts`. Its imports are written relative to `src/engine/automation/target-reacquire/tests/`, so re-path them when it is placed under `run-acts/tests/`.

## Open questions or contradictions found

- F23's authored classification ("the stale-target refind concludes gone for a calendar control that is still there") is contradicted. The control was not there, because the previous step was refused by the run gate.
- The campaign debug note's reading "stopped at step 82 of a Flow of 82+ steps" is wrong: 82 is a draft position, and the saved Flow had 8 to 11 steps.
- Not-arisen pass-over (t897) is the downstream patch for this class. With the proposed look, that rule stays correct but would fire less.
