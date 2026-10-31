# t799 / w1-rung: obstruction on the attempt, the `clear_interference` rung, generic layer kinds

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t799/!FluxIQ`. RT = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. Results are in "Commands run".

## What changed and why

- **Generic kinds, one reading.** `RT/executor/node-execution/layer-kind.ts` (new) maps the client's kind word to Core's
  generic kind (old words: consent to overlay, promotion to notice, dialog to other). Three places use it:
  `cleared-layers.ts`, `obstruction-of.ts`, and `service/candidate-trial/interruptions.ts` `runOpenedLayers`. That
  last one is the bug fix: it now maps the raw payload's word before matching it to the parsed layer, so an old client's
  `dialog` and a new client's `other` both still attribute `openedByStep`.
- **`cleared-layers.ts`** now also keeps `id` (token `[A-Za-z0-9._:-]{1,80}`) and `controlRef`. `controlRef` is kept
  only beside `wayOutDefinitionId` and only when it passes `opaque-ref.ts`.
- **`opaque-ref.ts` (new)** accepts a plain JSON object of at most 8 KB as JSON and at most 16 levels deep. It refuses
  the whole reference if any key starts with `$`. Reason: the reference becomes a node parameter, and
  `{ $state: { path } }` is resolved from run state (`nodes/parameter-bindings.ts`). An untrusted client reference could
  otherwise read run values into the press dispatched back to it.
- **`obstruction-of.ts` (new)** is a defensive parser for `outputs.result.obstruction`, following I2:
  - The whole obstruction is dropped when the kind is not usable or `dismiss` is not a list.
  - Bad fields are dropped one at a time: `id` and `covers` must be tokens; `name` goes through the activity bound (120).
  - `retryAfterMs` must be an integer from 1 to 600000, and is kept only on `rate_limit`.
  - Each way out is kept only when its `intent` is one of the three words. Its `definitionId` must be an identifier,
    its `controlRef` must pass `opaque-ref`, and `action` may only be `back`. At most 6 are kept.
- **`obstruction-way-out.ts` (new)** picks the way out to press: the first `dismiss`, else the first `neutral`, never
  `accept`. It must have a `definitionId`, and also a `controlRef` unless it is `action: "back"`.
- **`node-execution/attempt.ts`** reads `obstruction` off each dispatch answer's `outputs.result`, at the same place as
  `clearedLayers`. The latest reported obstruction wins. It is put on the attempt trace in both the native path and the
  definition path.
  - Verified that a failed web dispatch reaches this point. `io-policy.ts` puts `result: result.payload` into
    `outputs` on failure as well as success (both the IO path and the runtime path). `IoRegistry.dispatchOutput` passes
    the payload through. The web domain's `gateway-output-dispatcher.ts:99` builds `payload` whether or not the
    dispatch succeeded. Nothing is dropped on the Core side.
  - The web domain must lift `obstruction` to the top of that payload, as it does for `clearedLayers` (see "Open
    questions").
- **`recovery-ladder.ts`**:
  - `AutomationStudioLadderState.obstructionPressable` is new.
  - `clear_interference` is offered for a pressable obstruction (it takes precedence, because it is the layer actually
    in the way), otherwise for the Flow's own interference node.
  - Both cases are gated on `mayRepeat`, attempts left and not consumed, and never on `retryable`. A non-retryable
    `blocked_by_dialog` therefore gets the rung.
  - The new candidate carries `clearsObstruction: true` (`contracts.ts`, rung field only) and no `targetNodeId`.
  - With no obstruction, the condition is the same as before.
- **`ladder-run.ts` `clearObstruction`** builds a transient node and runs it through `executeNode`. No Flow node is
  added. The node is:
  - `id: <node>.clear-interference`
  - `definitionId` from the way out
  - label "Close what was over the page"
  - `parameterValues: { target: controlRef }`, or `{}` for back
  - `metadata.declaredConsequences: []`

  After running it:
  - It emits one interference recovery row about the failed step. The row reads "Closed something the page put over
    itself" when the press worked, or "Tried to close ..." with outcome `failed` when it did not.
  - On success it waits for the node's readiness (`automationStudioAwaitNodeReadiness`, as the await rung does), then
    retries.
  - A failed press consumes the rung and the ladder goes on.
- **`activity/step/interference.ts`** takes an optional `outcome` and words a failed press. The words for each kind are
  unchanged for a success.
- **Tests:**
  - Updated to the generic words: `activity/step/tests/interference.test.ts`,
    `service/candidate-trial/tests/interruptions.test.ts`, `executor/node-execution/tests/cleared-layers*.test.ts`.
  - One test in each of `cleared-layers.test.ts` and `obstruction-of.test.ts` proves the old words are mapped.
  - `interruptions.test.ts` has a new test covering a raw `dialog`, a raw `other` and a raw unknown word.
  - New: `executor/node-execution/tests/obstruction-of.test.ts`.
  - New: `executor/tests/ladder-run/tests/clear-interference.test.ts`. The brief named the file
    `executor/tests/ladder-run-clear-interference.test.ts`. It moved because that made `executor/tests/` hold 26 files,
    and the structure audit's directory-files rule caps a directory at 25. The new folder follows the existing
    `tests/<feature>/tests/` pattern, as in `tests/effect-check/tests/`.
  - It is fail-first. Before the change, 6 of its 9 tests failed; the 3 that passed check that the rung is not offered.
  - Examples use a library site (a reading-club overlay, a holds notice).

## Commands run and observed results

- Fail-first, before the change: `pnpm test -- .../executor/tests/ladder-run-clear-interference.test.ts`. Result:
  `Tests 6 failed | 3 passed (9)`. Example failure: "expected 'failed' to be 'succeeded'", and "expected [] to have a
  length of 1".
- `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p .`. The first run after the code changes
  showed 11 errors: 10 were in the old-word tests I then updated, and 1 was in `obstruction-way-out.ts`, which I fixed.
  The second run exited 0 with 0 errors.
- `pnpm test -- src/programs/automation-studio/runtime/executor src/programs/automation-studio/runtime/activity/step
  src/programs/automation-studio/runtime/service/candidate-trial`. Results:
  - parallel group: `Test Files 159 passed (159)`, `Tests 1278 passed (1278)`.
  - real-sql group: no tests in these directories (`--passWithNoTests`).
  - Ending: `[vitest-groups] all groups passed: parallel, real-sql`.
- `node scripts/structure-audit.mjs` (Core root) found 4 violations of mine, now fixed:
  - `executor/tests` had 26 files; the test moved to a subfolder.
  - `opaque-ref.ts` turned a caught failure into an absent value; it now validates first and has no try/catch.
  - `contracts.ts` was 804 lines against the 800-line limit; the doc comment was cut to one line.
  - My test packed several statements on lines 130-131; they were split.

  The remaining violations are not mine: `as-never` and `directory-files` in `llm/harness-options/tests/`.
- Re-run after the audit fixes:
  - tsc exited 0.
  - Tests exited 0: `Test Files 159 passed (159)`, `Tests 1278 passed (1278)`. This includes
    `executor/tests/ladder-run/tests/clear-interference.test.ts (9 tests)`.
  - The structure audit exited 1 with `structure-audit: 2 violation(s) across 2 rule(s)`. Both are in files I do not
    own: `[as-never]` in `llm/harness-options/tests/plan-parameter-resolution-control.test.ts:35`, and
    `[directory-files]` in `llm/harness-options/tests/` (26 files).

## Not verified

- No live run or browser run.
- The web client does not send `obstruction` yet (see below), so the rung is unproven against a real client.
- A persisted trace or run-detail reader may whitelist attempt fields and drop `obstruction`. Only the in-memory trace
  was checked.
- In command-run (required-command) mode, a native or composite definition makes `executeNode` throw
  `executor.unsupported_native_or_composite` (attempt.ts, before its try). This is the same as for any Flow node, but I
  did not test the transient press in that mode.
- The transient press's outputs are written to run `values` under its id and its bare keys by the step loop's
  `executeNode` (`failed-attempt.ts`). This is the same as today's Flow interference node. I did not change it.

## Open questions or contradictions found

- **The UI says the step failed, then retries it (lead, `failed-attempt.ts:128`).** For a non-retryable failure,
  `settleFailed()` runs unless `ladder.kind === "retry" && retryable`. A `blocked_by_dialog` that the new rung clears
  and retries therefore first shows a red "Didn't work" card, and then the step works. This is the t774 defect on a path
  that was dormant until now. The await rung already behaves this way today. I did not change it: it is outside "only if
  the ladder call must change", and changing it would also alter the await rung's behaviour with no obstruction.
  - Suggested fix: settle only when `!(ladder.kind === "retry" && (retryable || ladder.rung !== "retry_node"))`.
- **Downstream (W6, web domain):**
  - `domain/src/io/gateway-output-dispatcher.ts` must lift `obstruction` to the top of its dispatch `payload`, as it
    lifts `clearedLayers` at line 99. Core reads `outputs.result.obstruction`, not the nested client result.
  - Each way out needs a `definitionId` the host can run as a node, and a `controlRef` in the form that node takes as
    `target`.
  - The web press guard must still refuse anything committing.
- **Other lanes:**
  - Another worker has edits in `service/candidate-trial/contracts.ts` and `run.ts`. I did not touch them, but they
    were in the tree when the candidate-trial tests ran green.
  - The flow-bootstrap lane (`explored-interruptions.ts`) can now rely on `clearedLayers[].id` and `controlRef` being
    parsed. `controlRef` is refused when it holds `$` keys.
