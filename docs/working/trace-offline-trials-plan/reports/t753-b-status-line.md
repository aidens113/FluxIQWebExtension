# t753-b status line: report

## Outcome

Done. All seven items have a test that failed first and passes now. One item (6) has its source outside my files, so I neutralised it in the pacer and name the source below. In the Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t753/!FluxIQ`, `packages/fluxiq`:

- the type check is clean;
- the structure audit passes;
- 312 of 313 tests in the validation set pass. The one failure is in a refused-call row, a file another worker is editing (see Open questions).

## What changed and why

RA = `src/programs/automation-studio/runtime/activity`.

1. **Stutter "Build failed | Build failed: ...".**
   - New `ui/activity-status/steady/said-once.ts` (`activitySaidOnce`) drops a later clause or sentence whose words an earlier one already holds.
   - `headline-echo.ts`:
     - new `activityWithoutHeadline` removes an opening that repeats the headline, such as "Build failed:", "The build failed:" or "Build failed —".
     - `isHeadlineEcho` now checks containment both ways.
   - The pacer applies both to every detail.
   - `RA/build.ts` applies `activitySaidOnce` to the cause, so Core's row reads "Build failed: FluxIQ could not finish the Flow", text "FluxIQ could not finish the Flow.".
2. **"Fixing your Flow" stuck through a reset.**
   - `unit-situation.ts` reads the supervisor's brief and return cards:
     - a brief card resets repair: repairing is true only for a `repair` brief, and `resetting` is set for a `reset` brief;
     - a return card ends both.
   - New headline "Putting the site back" (`headline.ts`).
   - State is now per agent (item 4), so a new brief starts fresh, and a brief card also ends the repair in the unit-wide (no-agent) state.
3. **Setup rerun read as a test, counts jumping.**
   - New `RA/step/preparation.ts` is an AsyncLocalStorage mark. `entry-preparation.ts` runs the detached run inside it (`runAutomationStudioActivityPreparation`).
   - `RA/step/started.ts` labels such steps "Getting the page ready: <action>", with no count in the label. `step` stays on the wire for the cards.
   - New `steady/page-preparation.ts` keeps the pacer's headline at "Getting the page ready", with no step, no test and no repair. `CandidateTrial.observe` takes a `preparing` flag, so a preparation row never opens a test and closes any test still open.
   - Counts never jump within one run: new `steady/run-count.ts` keeps the count a run first said. A part's own steps (a nested subflow graph counts its own) keep the calling step's number, and their detail drops "Running step N of M:". A new run starts the count afresh: a test starting or ending, the page being got ready, or a repair re-run.
   - I did not edit `phase-start.ts`.
4. **Flicker.**
   - Removed every bypass: `showsAtOnce`, `opensStage`, and the step-after-decision rule at the old line 196.
   - Only these show at once: the first display, a new unit of work, settling, a wait on the person or a change of what is waited on, and resuming after that wait.
   - A new headline otherwise waits for its turn and for the one up to have had `ACTIVITY_HEADLINE_DWELL_MS` (3.2 s).
   - A change that returns to what is shown before its turn cancels the pending change, so it shows nothing.
   - New `steady/agent-states.ts`: the test, repair, preparation and count state is kept per agent (brief id), so one builder's tool row no longer ends another's test.
   - New `steady/agent-focus.ts`: the line follows one agent until it has been quiet for 4 s, unless something urgent happens. Rows from other agents are parked, and the newest is offered when the followed agent goes quiet.
   - A refusal said word for word ("Not done: ..." or "— not done") is treated like a thought: the line keeps what it said.
5. **Long silent loops.**
   - `started.ts` adds a list loop pass's row number to the label: "Running step 4 of 6: Press Confirm (row 3)". The card title is unchanged.
   - There is no total: the pass type carries none (see Open questions).
6. **"The check cleared on its own after 10 s."** The sentence comes from `RA/ask/cleared-text.ts`, emitted after the fact as a pair of rows by `RA/ask/cleared-wait.ts`: a `waiting_permission` started row, then a `waited_out` row. Neither file is mine. In the pacer both rows of that pair (title "Waited for a check to clear") now change nothing, so there is no flash of "Waiting for you" and no unexplained sentence.
7. **Cut mid-word.**
   - `build.ts` and `started.ts` cut their label or title at a word boundary within 160 characters, before Core's bound in `RA/bounded.ts` (not mine) can cut by count.
   - The pacer repairs a sentence that Core cut at exactly 160 characters ending in "…": its last word, whole or not, gives way to the ellipsis.

New-file note: `ui/activity-status/` already held 24 files, against a limit of 25, so the new modules live in `ui/activity-status/steady/`, which has its own barrel. The barrel `ui/activity-status/index.ts` now also exports `activityWithoutHeadline`, `ACTIVITY_HEADLINE_DWELL_MS`, `ACTIVITY_PAGE_PREPARATION_WORDS` and `activitySaidOnce`. Core imports the last two through `ui/index.ts`; I did not edit `ui/index.ts`.

Tests I updated because the brief changes the behaviour they pinned:

- `pacer.test.ts`:
  - a repair's headline now waits for its dwell;
  - a step after a decision now shows when its turn comes;
  - the result-check and run-repair tests advance by the dwell;
  - "Build failed: no list was found" is now shown as "No list was found".
- `supervisor-ending.test.ts`: the "Build failed: " opening is removed under the headline.
- `candidate-trial*.test.ts`: the feed helpers space events by the dwell instead of the interval, so every headline shows.

## Commands run and observed results

All commands ran from `C:/Users/osrs_/FluxStuff/fxwork/t753/!FluxIQ/packages/fluxiq` unless marked.

- **Before editing `entry-preparation.ts`:**
  - `git -C C:/Users/osrs_/FluxStuff/fxwork/t751/!FluxIQ status --short` printed nothing (clean).
  - Rechecked at the end: t751 has 22 changed files, none of them `entry-preparation.ts` or `phase-start.ts`.
- **Failing first:** `pnpm exec vitest run src/ui/activity-status/tests/pacer-steady.test.ts src/ui/activity-status/steady src/programs/automation-studio/runtime/activity/tests/build-ending.test.ts src/programs/automation-studio/runtime/activity/step/tests/started.test.ts src/programs/automation-studio/runtime/service/project-build/tests/project-build-entry-preparation.test.ts` reported "Tests 16 failed | 6 passed (22)", plus said-once failing to load (module missing). Among the failures:
  - `expected 'Build failed: FluxIQ could not finish…' to be 'FluxIQ could not finish the Flow.'`
  - `expected 'Fixing your Flow' to be 'Putting the site back'`
  - `expected Set{ 3, 5 } to strictly equal Set{ 3 }`
  - `at most two changes in any three seconds: expected 8 to be less than or equal to 2`
  - `a stage does not skip the pace: expected 2 to be 1`
  - `expected 'Not done: opening “Listings” — it was…' not to match /not done|already tried/iu`
  - the cleared check: `expected 3 to be 1`
  - the Core cut: `... with ever…: expected false to be true`
  - `build.ts` received the label `"Build failed: FluxIQ could not finish the Flow: I could not finish this"`
  - `started.ts` received `'Running step 4 of 6: Press Confirm'`, without the row number
  - the preparation mark: `expected [] to deeply equal [ true ]`
  - After I made its text cut inside a word, the `build-ending` long-ending test failed with `"...will not go on without the…"`.
- **Passing:**
  - `pnpm exec vitest run src/ui/activity-status src/programs/automation-studio/runtime/activity/step`: "Test Files 24 passed (24), Tests 166 passed (166)".
  - `pnpm exec vitest run src/ui/activity-status src/ui/tests/person-facing-sweep.test.ts src/programs/automation-studio/runtime/activity/tests src/programs/automation-studio/runtime/activity/step src/programs/automation-studio/runtime/service/project-build/tests/project-build-entry-preparation.test.ts`: "Test Files 1 failed | 40 passed (41), Tests 1 failed | 312 passed (313)". The one failure is `activity/tests/person-facing-sweep.test.ts > decision-answer/refused-call.ts: a refused repeat of a subflow's submission`, with fault `repeated phrase "part of the flow"`. It comes from the label written by `refused-call.ts`, which is not mine.
  - The other worker's `ui/tests/person-facing-sweep.test.ts` pacer case failed at first (`repeated phrase "could not finish"`, from the "...Flow. I could not finish this." sentence form). It passes after `activitySaidOnce` learned to compare sentences as well as colon clauses.
- `pnpm exec tsc --noEmit -p .`: exit 0, no errors, after fixing types in my own test.
- From the repository root, `node scripts/structure-audit.mjs`: "structure-audit: passed (441 warning(s), 1152 baselined)", exit 0. Warnings for my files: `pacer.ts` is 619 lines (advisory limit 400, hard limit 800), and `activity-status/` holds 24 files (advisory).
- `apps/web`, `pnpm exec vitest run src/features/automation-studio/conversation/activity`: refused to start with "Core's library build is 69 minute(s) behind its source". It needs a Core rebuild, which the brief forbids, so it was not run.

## Not verified

- **Core web panel:** `apps/web/src/features/automation-studio/conversation/activity/tests/pacing.test.ts` ("shows a repair, a settling or a new unit of work at once") will now see `["Building your Flow", "Build failed", "Running your Flow"]` instead of also seeing "Fixing your Flow". A repair headline 10 ms after the first headline now waits for the dwell and is overtaken by the settle. This is intended by item 4. The file is not mine and could not run.
- **Downstream extension:** overlay and pacer-consuming tests may pin at-once headlines, "Build failed: ..." details, or "Running step N of M" without a row number.
- **Live use:** no browser or Lab run. The flicker numbers come from a synthetic two-agent feed, not from the round-5 samples.
- **Agent keys:** that real reset briefs' rows carry `agent.briefId` matching the card's `briefId` was taken from `run-brief.ts` and not observed live. If they do not, "Putting the site back" shows only on the card row, but "Fixing your Flow" still clears.

## Open questions or contradictions found

- **Item 5 totals:** "pass 3 of 10" needs a total. For Each's body route outputs `count`, but `RA/loop/row.ts` and `types.ts` (not mine) do not carry it into `AutomationStudioActivityLoopPass`. Adding `of?: number` there would let `started.ts` say "(row 3 of 10)".
- **Item 6:** the wording lives in `RA/ask/cleared-text.ts` and `RA/ask/cleared-wait.ts`. The pair announces a wait after it has already ended; the chat card may still need a plainer sentence.
- **Item 7:** `RA/bounded.ts` and `project-card-bounds.ts` still cut by count, inside words. The pacer repairs only an exact 160-character cut.
- **Behaviour change:** D7 and D10 used to let a step after a decision, and a new stage, skip the pace. Now they wait at most one interval (1.6 s). The brief asked for this.
- **Other workers' in-flight files:** `refused-call.ts` fails its sweep. `ui/person-facing/stutter.ts` overlaps `activitySaidOnce` in purpose; the supervisor may want one of the two.
