# t265-background — worker report

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t265/!FluxIQWebExtension` (branch `task/t265-extension-ui-integration`). Nothing committed; no git history or index writes (single-lane hunks were applied to the working tree with `git apply` without `--index`).

## Outcome

Done. All four units are ported into the owned paths, and one coherent pacer replaces the four lane pacers. All 168 tests under the owned directories pass (plus the two `background/tests` files that import `connection.ts`). `extension check` exits 0. The structure audit passes.

## What changed and why

Owned files are identical to the lanes' base `45bd6232` on dev (`git diff --stat 45bd6232 HEAD` over them printed nothing). Files that only one lane changed were applied from that lane's diff. The files that several lanes changed were merged by hand.

### A9 (t174)

- `background/activity/pacer.ts` (merged, see "Pacer design"): the interval is 1.6 s (`ACTIVITY_DETAIL_INTERVAL_MS = 1_600`). A step that finished well is said by its action alone (`statusSentence`). A step that starts while the display up came from a decision row shows at once (`shownDeciding`/`pendingDeciding`, `isDeciding`, `startsStep`). The retry and repair split is in `RunRetry`.
- New `background/activity/run-retry.ts`: A9's `RunRetry`, moved out of `pacer.ts` (one class per file; keeps `pacer.ts` at 366 lines, under the 400-line advisory). Its signature is now `observe(event, kind)`, and it returns `RetryState { line, ended, repairing }`. `ended` is new (see the pacer design). It imports `activityActionOf` from `fluxiq/ui`, which Core dev exports (`packages/fluxiq/src/ui/activity-action/index.ts`).
- `headline.ts`: A9's comment on retry versus repair, merged with D2.
- `shared/activity/activity-display.ts`: A9's doc (1.6 s, no pace of its own on the overlay).
- `shared/activity/wording.ts`: typing steps now name their field. Plan-ok now reads "looks right, testing it next".
- Tests: the `activity-relay.test.ts` hunks (PACED_MS) applied as-is. `activity-replay.test.ts` was applied, then its exemption was changed (see "Changed test expectations"). In `shared/activity/tests/wording.test.ts`, the typing-field rows and the plan-ok test were applied. The pacer tests are A9's five, as written.
- **Deferred (decision 3):** the `wording.ts` import of `activityActionFailureReason` and its `toolOutcome` use (confirmed not exported from Core dev's `ui/activity-action/index.ts`). Also the two `wording.test.ts` hunks expecting replay reasons ("the page wasn't in the same state…", "it did nothing this time…"). The old "it didn't work the same way again" expectations stay.

### F9 (t193)

- Applied unchanged: `activity-relay.ts` (`sending`, `display()` override), `background/activity/index.ts`, `background/connection.ts` (`activitySending`), `background/panel/{panel-control,panel-control-deps}.ts`, and `panel/tests/panel-control.test.ts`.
- New, copied with LF line endings: `send-start.ts`, `send-answer.ts` and their tests; `shared/activity/model-thought.ts` and its test.
- `shared/activity/index.ts` exports `isModelThought`.
- `activity-display.ts` gains `kind?: "action" | "thought" | "starting"` and its doc. The `sequence` doc now says it is 0 for the starting status.
- Pacer: `acceptThought` and `thoughtDisplayFor`, merged (see the pacer design). The three F9 pacer tests pass unchanged.

### w76/w83 (t194)

- `unit-situation.ts`: applied unchanged (`rebuilding`: set by Core's "Result repair started" or "Repairing the Flow" row, cleared by the run's next step).
- Pacer: `holdMeaningfulLine` and `decisionUnderWay`. The step carried over only when `!unit.rebuilding` (in `displayFor` and in the thought display).
- Tests: the "build headed", "quiet interval", U2 and U3 tests are as written. Two tests changed: "recovering keeps step" and both U9 tests (see "Changed test expectations").

### D2 (t195)

- `headline.ts`: a failed unit reads `REPAIR_FAILED` only when `kind === "run" && repairing`. A build reads "Build failed". The comment is merged with A9's.
- `activity-display.ts`: doc merged.
- New `tests/headline.test.ts`: passes unchanged.
- The pacer test's build-repair rename and its "Build failed" expectation are as written. "a run whose recovery fails" changed (see "Changed test expectations").

### Pacer design (one pace, four lanes)

`accept` passes every event through `UnitSituation.observe` and `RunRetry.observe` first, thoughts included. Then:

- **A model thought** (F9 `isModelThought`) gets `thoughtDisplayFor(event, pending ?? shown, unit, retry)`:
  - Headline, outcome and working state come from the event.
  - Phase and step come from the kept line, and the step is dropped while rebuilding.
  - Detail is `retry.line ?? keptLine`. A recovery-choice thought ("Trying the step again") therefore keeps A9's "The page was busy, trying again" rather than blanking it.
  - New: a kept line equal to `retry.ended` (the retry line this very event ended, e.g. "The quick fixes didn't help" or the start of a real repair) is dropped. This stops "…, trying again" from standing under "Fixing your Flow".
  - A thought that changes nothing a person reads is folded in quietly. A waiting action keeps its place and its turn (F9), and the decision flag is carried over, so a step after "deciding row + reason thought" still shows at once.
  - New: a thought whose detail does change (only through the retry line) is paced like an action instead of skipping the pace.
- **Any other event** gets `holdMeaningfulLine(event, displayFor(...), pending ?? shown)` (t194), then goes into `offer`. That shows the event at once on a new headline or outcome, a stage (`opensStage`), or `shownDeciding && startsStep(event)` (A9, keyed on the event, so it coexists with the held line). Otherwise it pends to the interval's end.
- The headline uses `repairing: unit.repairing && retry.repairing` (A9). `activityHeadline` applies D2's build/run rule.

### Changed test expectations

1. **`pacer.test.ts` "a run recovering from a failed step keeps that step's number" (t194).**
   - Change: the expected headline after "Recovering from a failed step" goes from "Fixing your Flow" to "Running your Flow". I added a step: a "Working out what went wrong" repair thought, after which the test asserts "Fixing your Flow" with the step still `{3,5}`.
   - Why: this contradicts A9's D12 (a retry is not a repair). Resolved toward A9, and t194's point (the step is kept) is still asserted.
2. **`pacer.test.ts` "a run whose recovery fails says it could not fix the Flow" (D2).**
   - Change: renamed to "a run whose repair fails says it could not fix the Flow; one that only retried a step says the run failed". A repair thought now comes before the failure ("Couldn't fix your Flow"). A second case (Recovering, then failed, with no repair) expects "Run failed".
   - Why: D2's fixture had only "Recovering from a failed step", which under A9 is a retry. D2's own point (build versus run) is unaffected.
3. **`pacer.test.ts` both U9 tests (t194).**
   - Change, fixture: t194 sent the decision's reason as a thought titled "Deciding the next step" carrying the model's text. Core does not emit that: `runtime/activity/observer.ts` emits the reason through `emitAutomationStudioActivityThought` titled `chose.title`. Its only "Deciding the next step" row with text is the provider-outage `failed` row. The fixtures now use Core's real shape, `decided(title, text)` with the chosen action as title, plus `stepStarts`.
   - Change, expectations: the old ones were "each decision's reason" as the detail ([repair, first, second, first, second]) and "Reading the results list next." reaching the screen. The new ones are [repair line, "Clicking “Search”"] (held through every decision; never the flash, never the reasons) and ["Deciding the next step", "Clicking “Search”", "Clicking “Next page”"] (the waiting line still shows; the reason never does).
   - Why: with Core's real shape the reason is an F9 model thought, and the brief resolves this toward "thoughts never the detail". t194's U9 intent (no "Deciding the next step" flash; it shows only when nothing meaningful is up; a waiting line is never overtaken) is kept.
4. **`activity-replay.test.ts` measurement (A9).**
   - Change: A9 exempted a gap when the *previous detail text* was "Deciding…/Thinking…". With t194's hold, a decision keeps the previous line, so a step shown at once after a decision follows a non-deciding text. The exemption now keys on what the pacer keys on: the change's display came from a step-start event (walked back over its own "succeeded" row, whose words are the same under D6), and the display up before it came from Core's decision row.
   - Observed: shortest paced gap 1600 ms (floor 1350); 3 changes exempted. The before/after rates and the "≤ 2 detail changes in any second" bound are unchanged.

## Commands run and observed results

- `node <scratchpad>/t262-gate/run-subset.mjs <abs>/apps/extension t265-bg <19 files: every test under background/activity/tests, background/panel/tests, shared/activity/tests, plus background/tests/{connection-status,scripted-navigation-control}.test.ts>` then `node --test <bundles>` printed `# tests 168 # pass 168 # fail 0`.
  - The first run (lanes' tests as written) had 3 failures: the replay measurement, "recovering keeps step", and "a run whose recovery fails". These are the contradictions above.
  - Note: the runner needs an absolute package dir. A relative `apps/extension` throws `ERR_INVALID_ARG_VALUE` from `createRequire`.
- `pnpm.cmd --filter @fluxiq-web-extension/extension check` exited 0 in 19 s. The core-build step said Core is current, then `extension:check` ran (incremental `tsc` on `tsconfig.json` and `tsconfig.test.json`; "no stamp", 16.6 s). The whole extension compiled, including the concurrent panel worker's files at that moment.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (168 warning(s), 118 baselined)`. The new advisory warnings in my paths are `pacer.test.ts` at 557 lines and `connection.ts` with 35 methods (F9's `activitySending`). Neither fails.
- Cross-check, outside my directories (run only, no edits): the 17 tests importing shared/background activity, plus `content/activity-overlay/tests` and `panel/shell/tests`, gave 191 tests, 190 pass, 1 fail.
  - The failure is `panel/shell/tests/mount-panel-navigation.test.ts` "list rename synchronizes open chat labels without … scroll reset": `scroller.scrollTop` 1200 !== 140.
  - That is chat scroll behaviour, and `panel/chat/view/scroll-follower.ts` is currently modified by the concurrent panel worker. Nothing I own touches scrolling. Not verified against dev.
- Line endings: zero CR bytes in every owned changed or new file (`tr -cd '\r' | wc -c`).

## Not verified

- No live run, browser or Lab (forbidden by the brief).
- Whether the `mount-panel-navigation` failure exists without the panel worker's edits (I did not run it on a clean dev tree).
- Core's real ordering of recovery rows against a "The quick fixes didn't help" thought: the `retry.ended` drop is covered by reasoning, not by a dedicated test.

What a live run must look at:

- **A9:** any 3 s of status shows at most two detail changes, and the overlay moves in step with the panel's status row. The status never ends a line with "— done". A step's line replaces the decision line the moment its card appears. A rate-limited retry reads "Running your Flow · The page was busy, trying again" (never "Fixing your Flow"). Typing steps name their field. A passed completion check reads "… — looks right, testing it next".
- **F9:** "Starting…" appears on the page and panel as a message is sent, and is replaced by Core's first activity. It disappears on a failed send or a words-only answer. The model's reason or refusal prose never appears in the status. An action after a thought is not delayed. `display.kind` is `thought` or `starting` where expected (the overlay worker consumes it).
- **w76/w83:** during a result-repair re-author there is no "Step N of M", and the count returns with the re-run's own steps. Through a re-author the status holds the stage or last step line instead of flashing "Deciding the next step".
- **D2:** a creation build that fails mid-repair reads "Build failed". A run whose repair fails reads "Couldn't fix your Flow". A run that only retried and failed reads "Run failed".

## Open questions or contradictions found

- t194's U9 fixtures did not match Core's wire (the reason is never titled "Deciding the next step"). They were rewritten as described above. If a future Core does send reason text on the deciding row, F9's `isModelThought` treats it as status (shown), because it exempts that title for the outage sentence.
- A9 versus D2 versus t194 on "Recovering from a failed step": resolved toward A9 (retry is not a repair). As a result, "Couldn't fix your Flow" for a run now requires Core to send a real repair row ("Working out what went wrong" or similar), not just the recovery ladder.
- `background/activity/index.ts` does not export `RunRetry` (nothing outside the pacer uses it).
