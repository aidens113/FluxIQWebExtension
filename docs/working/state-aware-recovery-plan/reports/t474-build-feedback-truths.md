# t474 report: what the build tells the model is true

Worker report. All edits are in the Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t474/!FluxIQ` (branch `task/t474-build-feedback-truths`). Nothing is committed. The downstream worktree is unchanged.

## Outcome

**Done.** I checked all four defects against the run evidence and the source, and fixed and tested each one. One edit falls outside the brief's file list: a 3-line call-site change in `service/candidate-trial/run.ts`, which defect (3) cannot work without (see Open questions).

## What changed and why

### (1) The row check called correct advice "not supported" (`result-verification/request-rows/checked-rows.ts`)

The defect is confirmed in the lane C step log.

- **Trial 2:** both judges wrote "Two are accessories the request excludes: …" (`0048-judge`, `0049-judge`). Core's feedback at `0047` said both stored accessories were "in the result, although the check calls it left out … not supported". It also tagged the charging case `(600MAH)`.
- **Trial 4:** the judges named the left-out "… Ivory with Wireless Charging Case". The feedback at `0061` called the stored "… Ivory" misread.

The fix has three parts:

- **A left-out word counts only when it is said of the run.** The new `saysLeftOut` checks each match of `LEFT_OUT`, which is now global, against the text before it. It skips three kinds of match:
  - words said of the request (`ASKED_BY`): "the request explicitly excludes", "the instruction says to leave out";
  - words saying what should happen, or what did not (`NOT_DONE`): "should be excluded", "to exclude", "was not / wasn't filtered out";
  - words with no subject (`NONE_DID`): "has no condition that excludes".
- **The longest label wins (`longestNamed`).** It replaces the per-prefix `automationStudioRequestTextNamesRow` call. Matching works on word positions. A row's match that lies inside a longer match by another row in the same sentence is given to the longer row.
- **A measure is not an id (`MEASURE`).** An id made of digits followed by a unit, such as "600MAH", is not taken as a row id unless it is the whole of one stored row's cell.

The file header records the round-9 reason. The lines Core prints (wording and format) are unchanged.

### (2) The zero-pass exemption failed on the compiled graph (`executor/graph-navigation/zero-pass-loop.ts`)

The defect is reproduced on the compiler's own output. The new test compiles a script through `acceptAutomationStudioFlowBootstrapResult`, `validateAutomationStudioFlowBootstrapPlan` and `normalizeAutomationStudioFlowBuildPlan`. Its registry has the web fixture, with click and wait_for_text declaring an `item` input.

- The graph that comes out has `s4:item -> s5:item` and `s4:item -> s6:item`.
- Before the fix, a run whose listing kept 0 rows failed `executor.graph.unvisited_nodes`.

The fix: the loop's way on now excludes its value ports.

- `VALUE_PORTS` is read from the loop definitions in `controlFlowNodes`: output ports with `role: "data"`. For For Each those are `item`, `index` and `count`; for Repeat it is `pass`.
- A port the definition does not name, such as `failed`, still counts as a route. That keeps the conservative behaviour (steps stay owed) that the existing "keeps a step the loop's way on also reaches owed" test checks.
- The `flow` parameter is widened to `Pick<AutomationStudioFlowDocument, "edges">`, so feedback can pass the trial's `AutomationStudioFlowArtifact`.
- `graph-navigation.ts` did not need to change.

### (3) Execution-failed feedback blamed the wiring and carried no reads (`service/candidate-trial/feedback.ts`, `reads.ts`, and `run.ts`)

- **`executionFailed` takes `reads`.** It accepts `reads?: AutomationStudioResultReadAccount[]` and emits `reads` through the same `automationStudioTrialReadsFeedback` that judged trials use. That includes the t466 kept-none sentence.
- **`run.ts` supplies them.** It builds the reads with `automationStudioResultReadAccounts({ actionAttempts: ports.actionAttempts?.(ended), flowNodes: executed.graph?.nodes, deniedEvidenceKeys: ports.deniedEvidenceKeys })`. These are the same inputs the judged summary uses (`result-summary.ts:175`).
- **The `unvisited_nodes` ending now reads the run's loops** with `automationStudioZeroPassLoopBodies`, imported from the `executor/graph-navigation/index.ts` barrel (service already imports nested executor barrels). There are three cases:
  - **Every step never reached lies inside a loop that ran no passes:** the feedback says so, says that this is not a fault in the Flow's connections, says "do not rewire it", and points to `reads`. It gives no wiring instruction.
  - **A loop ran no passes, and another step was also not reached:** the feedback says the loop's steps are not the ones owed, and asks the model to check connections to the steps outside that loop.
  - **No loop ran without passes:** the original text is kept.
- The `reads.ts` header now notes that reads are given under every verdict. Its code is unchanged.

### (4) Unchanged resubmission after a refusal (`flow-bootstrap/candidate/submission.ts`)

- **The comparison is now with the last accepted revision.** `submit` compares with `last = this.current ?? this.previous`, both in the text check and in the digest check. `currentText` was never cleared on a refusal, so it already held the last accepted revision's text.
- **The new private method `sameAsLast` decides what stands.**
  - The matching revision stands again (a `structuredClone`), so its receipts and trial history in the gate still apply.
  - If the judge refuted that digest, it is named in the `unchanged_after_no` refusal but not reinstated.
- `unchanged-submission.ts` needed no change. Its "Revision N still stands" wording is now true after a reinstatement.

### Tests

- **`zero-pass-loop.test.ts`:** a new describe block that compiles a generic "accept each pending invitation" script.
  - It asserts the `item` edges, the zero-pass bodies, a succeeded run at the last read, and that a 2-row run still runs the body twice.
- **`checked-rows.test.ts`:** a new describe block with a generic outdoor-gear catalogue ("… Blue" and "… Blue with Carry Bag", plus a "2600mAh" accessory). Six cases cover:
  - the request as subject;
  - should, not and no-subject wording;
  - a real misread, which is still flagged;
  - the measure;
  - longest-label attribution;
  - the shorter label when it is named alone.
- **`reads.test.ts`:** four execution-failed cases: reads carried; no wiring blame when every step not reached is inside a zero-pass loop; the "outside that loop" wording; the original wording when no loop is empty.
- **`run.test.ts`:** an execution-failed trial carries the read accounts built from the `actionAttempts` port.
- **`unchanged-submission.test.ts`:** a new block of three cases: refused and reinstated with its last trial; a differently written script that reads to the same plan; a refuted revision named but not reinstated. The last t464 case now resubmits a changed Flow, because it previously asserted the gap itself.
- **`authoring-loop.test.ts`:** the test "invalidates prior receipts … including a refused revision" asserted that an identical resubmission becomes revision 3. It now submits a changed Flow for revision 3 and keeps its invariant (the refused submission still invalidates earlier receipts).

## Commands run and observed results

All commands ran in `packages/fluxiq` unless noted.

- **Before the zero-pass fix:** `npx vitest run …/graph-navigation/tests/zero-pass-loop.test.ts` printed "2 failed | 8 passed (10)". One of the failures read `expected 'executor.graph.unvisited_nodes' to be undefined`. That is the live defect, reproduced on the compiled shape.
- **After the fix:** the same command printed "Tests 10 passed (10)".
- **New checked-rows tests against the original file:** I swapped in `git show HEAD:…/checked-rows.ts` and ran `npx vitest run …/request-rows/tests/checked-rows.test.ts`. It printed "5 failed | 9 passed (14)". After restoring the fix it printed "14 passed (14)".
- **Changed directories:** `npx vitest run …/runtime/executor/graph-navigation …/result-verification/request-rows …/service/candidate-trial …/flow-bootstrap/candidate` printed "Test Files 27 passed (27)" and "Tests 251 passed (251)".
- **Wider check:** `npx vitest run …/runtime/result-verification …/runtime/executor` printed "Test Files 146 passed (146)" and "Tests 1302 passed (1302)".
- **Typecheck:** `pnpm check` (tsc --noEmit) printed `{"build-cache":"build","step":"fluxiq:check","reason":"inputs changed: packages/fluxiq; …"}` and `pnpm check exit=0`.
- **Structure audit:** `pnpm structure:check` (repo root).
  - The first run failed on two problems in my new `run.test.ts` code: an `as never` cast and a packed statement line. I fixed both with a typed `AutomationStudioFlowRunActionAttemptRecord`.
  - The rerun printed `structure-audit: passed (333 warning(s), 1159 baselined).`
  - It also printed "2 baseline entries can be lowered". Those entries are `service.ts` file-lines and `runtime-stream-store.ts`, neither of them mine. I ran `--update` to see them, then restored `.structure-baseline.json` byte for byte from a scratch copy. It is unmodified in `git status`.
- **Downstream:** a grep of the downstream worktree for the changed texts and codes found no matching files, so no downstream test needs to follow.

## Not verified

- No Lab run, live or provider-free (the brief rules out paid runs). Nobody has watched the model act on the new texts.
- Full suites (`pnpm test`, root `pnpm check`, `pnpm build`) were not run, per the validation rule. I ran only the directories listed above.
- I matched the new `checked-rows` sentences against the round-9 judge replies by reading them, not by replaying the stored summaries. The Lab's trial summaries are not in the step folders as `AutomationStudioRunResultSummary` objects.
- The `ASKED_BY`, `NOT_DONE` and `NONE_DID` rules are lexical. A judge sentence such as "add a condition that excludes <stored row>" (a subject other than the request, in the present tense) would still be read as a left-out claim.
- Authored docs were not updated. I found no `docs/architecture` page that states the t466 exemption or the t464 rule, but I did not search exhaustively.

## Open questions or contradictions found

- **Edit outside the file list:** `service/candidate-trial/run.ts` changed by 3 lines: an import, a comment, and passing `reads` to `executionFailed`. Defect (3) cannot carry reads without it. Read accounts need the session's action attempts, which only `run.ts` has (`ports.actionAttempts(ended)`).
- **Tests outside the file list:** `service/candidate-trial/tests/run.test.ts` and `flow-bootstrap/candidate/tests/authoring-loop.test.ts` are in the `tests/` directories beside owned files. I read them as covered by "the tests beside them".
- **Design choice in (4):** an identical resubmission after a refusal makes the old revision current again. That includes its gate history, so a standing "yes" for it would allow completion without a new trial. It is the same Flow by digest. Without the reinstatement, the refusal would name a revision that cannot be tested, and the model would be stuck. A refuted revision is not reinstated.
- **Debug correction (D):** the D debug suggested also excluding edges into data inputs by target port. Merge's control input `branches` has no role, so classifying by target port would misread route edges into a merge. I classified by the loop's own declared source-port roles instead.
