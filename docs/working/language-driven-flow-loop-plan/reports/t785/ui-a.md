# t785 UI-A report

## Outcome
Done for Core; one non-owned edit needed in apps/web (see Open questions).

## What changed and why
Paths under C:/Users/osrs_/FluxStuff/fxwork/t785/!FluxIQ/packages/fluxiq/src/.

1. Ending words (goal 1)
   - Before: chat "Run failed: it saved 3 rows, but the check found they don't answer what you asked, and the fix didn't finish"; headline/toast "Couldn't fix your Flow".
   - After, when the recorded verdict is `does_not_answer` with basis `model`, `resultVerification.repair.findings` is empty (no grounded defect), and the repair changed nothing (`resultReauthor.outcome = nothing_to_change`, or the repair stopped `result_repair.not_converging`): "Run failed: it saved 3 rows, but the check doubted them, the repair changed nothing, and the saved Flow is unchanged." Headline/toast: "The check doubted the result". Today's words are kept for grounded refutations or any other repair ending.
   - Files: programs/automation-studio/runtime/activity/wording/run-ending.ts (doubtOnly, doubted), new ui/activity-status/doubted-ending.ts (shared closing phrase, headline, endsOnDoubt), headline.ts (`doubted` situation), pacer.ts (sets it from the settling row's label/text), ui/activity-status/index.ts. run.ts needed no change (it already uses the ending as label and text).
2. Check card attribution (goal 2): new ui/activity-action/check-subject.ts; action-of.ts sets the card's `name` for a result check: "Check of a test's result" (count says "would be stored", the repair's/build's round test) or "Check of the run's result" (count says "came back"). Text without a count keeps "Check result".
3. "Judge call N:" (goal 3): check-words.ts strips `Judge call(s) N [(because)]:` labels in `plain()` at display. agreement/ untouched.

Tests added: ui/activity-status/tests/doubted-ending.test.ts, ui/activity-action/tests/check-subject.test.ts, plus cases in run-ending.test.ts and check-words.test.ts.

## Commands run and observed results
- `pnpm test src/ui/activity-status src/ui/activity-action src/programs/automation-studio/runtime/activity src/.../result-verification/tests/check-words.test.ts` (packages/fluxiq) -> 89 files, 871 tests passed (check-words re-run alone after a type fix: 12 passed).
- `pnpm check` (packages/fluxiq) -> after fixing a type error in my own new test, no errors printed; the build cache did not stamp it because other workers changed inputs during the run.
- Core root `pnpm structure:check` -> FAIL on 4 directory-files violations, none mine: flow-bootstrap/unfinished-build/ (+tests/), result-verification/agreement/, result-verification/read-account/ (26 files each, others' work). My directories pass.
- apps/web and the extension were not touched, so not run.

## Not verified
- apps/web tests/typecheck (no change there). Live look at the rendered chat.
- Whether "repair changed nothing" should also cover other repair endings; I limited it to nothing_to_change and not_converging.

## Open questions or contradictions found
- apps/web card ignores `action.name`: apps/web/src/features/automation-studio/conversation/components/action-card/ConversationActionCard.tsx line 26 `const name = ACTIVITY_ACTION_NAMES[action.kind];` should be `action.name ?? ACTIVITY_ACTION_NAMES[action.kind]` (check ConversationStepAction carries `name`). The extension already honours `card.name` (card-words.ts:104), so the attribution shows there. Not my path, so not edited.
- The "a Core-only text marker" approach for the headline means the headline depends on the phrase "the saved Flow is unchanged" in the settling row; both sides share one constant.

## Follow-up: build ending names the build's lasting acts (run-mvskptb1-c9cef4fe)
Outcome: Partial. Nothing built; the wiring lives in files other workers own, and the words already exist.

Findings (read-only):
- The sentence module already exists: `activity/wording/left-told.ts` (`automationStudioActivityLeftTold(acts, possibly)`), generic by rule: "These changes the build made are still on the site: <acts>." / "The build left no change on the site that it knows of." It is fed by `project-agents/supervisor/left-on-target.ts` (`automationStudioProjectSupervisorLeftOnTarget(ports).told`, from the site-reset ledger via `projectLedger`) and placed in the ending row by `service/project-build-ending/ending-told.ts` (`left`).
- That path runs only for a build that FAILS or ends as a draft (`ports.leftAtEnding` -> failed build's chat). A build that succeeds ends on `activity/build.ts` ("Your Flow is ready", no text) and the supervisor's "Built <flow>" card (`project-agents/dispatch/ending.ts:471` says "Revision N of the subflow was tried on its own and its trial answered yes."), neither of which says what is left. That is why run-mvskptb1-c9cef4fe's ending was silent about the four likes.

Exact edit needed (not mine to make; flow-bootstrap/**, project-agents/**, service/** are owned by others):
1. In the project build's success path (where `project-agents/dispatch/ending.ts` / the supervisor completion builds the "Built ..." ending), call `automationStudioProjectSupervisorLeftOnTarget(ports)` and append its `.told` only when `.told` differs from the "left no change ... knows of" sentence (or always, to keep "nothing left" explicit), through `automationStudioProjectBuildEndingTold({ reason, left: { note, told } })`, so success rows get the same third paragraph failure rows have.
2. Emit that text on the build's final row: `activity/build.ts` line `emitAutomationStudioActivity({ phase: "done", label: "Your Flow is ready", detail: { ..., title: "Build finished", status: "succeeded" } ...` takes a `text`. That file is in runtime/activity (not in my owned list); it needs a `left` string passed in from the build result.
3. Optional follow-on in words: a count form ("this build left 2 items liked that were not liked before it began") would need the ledger's before-state per act, which `automationStudioActivityLeftTold` does not receive (only `did` words); `left-told.ts` can say it as "pressed Like twice" via act-words grouping already.

Commands: none run (no code changed in this follow-up).
