# f-recorder-mutation-flush — a DOM addition is recorded before the action after it

Worker report, 2026-09-13. Brief: `briefs/finish-week1.md`, "f-recorder-mutation-flush".
Read: `reports/i-late-target-wait.md` Task 2, Task 4 option 2, "Needed under every option".

## Outcome

**Done.** The recorder now sends the pending mutation batch before any event of a kind that can
become an executable action. There is a unit test with a mutation proof. W24's unarmed
`expected.actions` no longer asks for a wait that no rule can produce. Every check the brief named
passed. The one failure seen, a harness fixture teardown timeout, passed on a rerun of that spec
alone. No Lab run was made; what one must show is under Not verified.

Re-verified at HEAD first: HEAD was `3a6d142`, not `2ca97f5`. Neither owned file had changed since
`f8885b8` / `90232b8` (`git log -- <owned files>`), and both still had the debounce-only recorder
and the three-entry W24 action list. The item was not already settled.

## What changed and why

### `apps/extension/src/content/recorder.ts`
- A private `EXECUTABLE_KINDS` set holds `dom.click`, `dom.input`, `dom.change`, `dom.submit` and
  `dom.keydown`. `emit` calls `flushPendingMutation()` for those kinds, after its instance and
  recording gates and before `basePayload`. The flushed `dom.mutation` therefore takes the lower
  `sequence` and is sent first.
- `flushPendingMutation()` clears the quiet-period timer, resets the tally, and sends
  `dom.mutation { mutation }` only when some count is non-zero, so a flush never sends an empty
  batch.
- The 500 ms timer callback now calls the same function. Before, the callback left a stale
  `mutationTimer` id behind after it fired. Now both paths clear it.
- **One addition beyond the brief's literal wording:** the flush also counts
  `observer.takeRecords()`, guarded by the same `captureSettings.mutations && recording` check the
  observer callback uses. Those are changes the page made that the observer has queued but not yet
  delivered. For a trusted event there is effectively nothing queued, because the browser delivers
  queued records between event listeners. It matters for events a page script dispatches itself
  straight after changing the DOM; `submit` is the one the recorder has no `isTrusted` check on. If
  the supervisor wants the brief's exact scope, remove that one line and the test "records the
  observer has queued but not yet delivered are counted in the flush".
- The per-record tally moved into a private `tallyMutations()` shared by the callback and the flush.
- No payload field changed and no page data was added. `dom.mutation` still carries only the four
  counts, and executable events carry exactly the fields they did (the last test pins the key set).
- The file header comment gained two lines saying so. `recorder.ts` has no structure-baseline
  entry.

### `apps/extension/src/content/tests/recorder.test.ts` (new; a unit test, not a harness row)
A unit seam exists. The test puts stub `window`, `document`, `location`, `chrome` and
`MutationObserver` globals in place first, then loads `../recorder` with a dynamic `import()`, which
esbuild evaluates lazily. That is needed because `recorder.ts` builds its observer, and
`instance.ts` claims `window`, while loading. `document.addEventListener` is stubbed as well,
because `evidence/interactions.ts:61`, reached through `dom-snapshot`, starts listening on load.
`setTimeout` is mocked with `t.mock.timers`, and every global is restored afterwards, because all
test bundles run in one Node process. The five tests:
1. A click after a DOM addition sends `dom.mutation` and then `dom.click`. The mutation's
   `sequence` is the lower one, and a 500 ms tick sends nothing more, so the timer was cleared.
2. Each of the five executable kinds flushes first. `dom.scroll`, `dom.focus` and
   `browser.navigation` do not flush; their batch leaves on the timer.
3. With nothing pending, an executable event sends only itself, including after the timer has
   already sent the batch. This catches the stale timer id and an empty batch.
4. Queued records that were not yet delivered are counted in the flush.
5. With mutation capture off nothing is flushed, and the click's payload keys are unchanged.

### `apps/scenario-lab/src/scenarios/intermediate-state/scenario.ts`
Removed `{ action: "web.dom.wait_for_selector", outcome: "succeeded" }` from the unarmed
`expected.actions`, which is now `[type: succeeded, click: succeeded]`. Nothing else changed. The
`unannounced` variant's own `actions` and `failure` are untouched.

### `apps/scenario-lab/src/scenarios/intermediate-state/tests/scenario.test.ts`
One added assertion pins the unarmed `expected.actions` to those two entries.

### How `packages/test-runner/src/flow-lane/expectations.ts:7-19` matches, and what W24's row asserts now
`assertFlowActions` loops over the expected entries. For each one it requires that **some**
persisted attempt has `actionType === entry.action` and `status === (entry.outcome ?? "succeeded")`.
It checks existence only: not order, not count, and not exclusivity. Extra attempts never fail it.
When an entry is unmatched, it throws `RunnerFailure("action.dispatch", …)` listing the attempts
observed.

W24's unarmed Flow row therefore now asserts that at least one `web.dom.type` attempt succeeded
and at least one `web.dom.click` attempt succeeded. The finalState rows (status, employee, amount,
no confirmation step) still carry the proof that the claim completed. A wait node, should one ever
appear, would not fail the row. The `unannounced` variant still asserts
`[type: succeeded, click: succeeded (default)]` plus failure `output_not_observed`.

### Why the recording-lane `web.dom.mutated` pins still hold
- `packages/test-runner/src/run-expectations/recorded-events.ts:55` reads an entry with no `count`
  as "at least 1". All four pins have no count: `delayed-ui/scenario.ts:40`,
  `intermediate-state/scenario.ts:41`, `dynamic-list/scenario.ts:24` and
  `reconnect/scenario.ts:19`. A grep for `web.dom.mutated` finds no counted pin in any manifest.
- The flush only sends a batch earlier, or splits one quiet-period batch into two. It never discards
  a non-empty batch. It also sends batches that used to be dropped, when an input was still pending
  at stop, because `setRecordingState(false)` flushes the input first. So the number of
  `dom.mutation` events can only rise.
- `web.element.clicked` **is** pinned with exact counts: delayed-ui 2, intermediate-state 1,
  reconnect 3. A `dom.mutation` can now sit between a gesture's pointerdown `dom.click` and its
  click `dom.click`. The background pairs the two by element signature within a 750 ms suppression
  window (`recorded-event-intake.ts:82-93`, `pointer-click-filter.ts`), not by adjacency, so an event
  in between does not double the count. This comes from reading the code; it was not observed live.

## Commands run and observed results

All extension commands ran from `apps/extension` with `EXTENSION_TEST_BUILD_LABEL=frmf`. Output
went to scratch files, and exit status was echoed rather than piped.

| Command | Observed |
| --- | --- |
| `pnpm test` (first run) | `exit=1`, `# tests 400 / # pass 395 / # fail 5`. All five were the new tests. Cause: `document.addEventListener is not a function`, thrown from `evidence/interactions.ts:54` while the recorder loaded (a missing stub; not the faulty-RAM pattern). The other four were knock-ons from the half-loaded module. |
| `pnpm test` (after adding the stub) | `exit=0`, `# tests 400 / # pass 400 / # fail 0 / # cancelled 0`; `ok 283`-`ok 287` are the five recorder tests. |
| `apps/scenario-lab: pnpm check` | `exit=0` (`tsc -p tsconfig.json --noEmit`, no output). |
| `apps/scenario-lab: pnpm test` | `exit=0`, `# tests 203 / # pass 203 / # fail 0`; `ok 100 - the manifest is valid, loopback-only, and resolves its primary workflow and unannounced variant`. Built `dist/scenarios/intermediate-state/scenario.js` has 0 occurrences of `web.dom.wait_for_selector`. |
| **Mutation proof:** `sha256sum` of `recorder.ts` saved, the line `if (EXECUTABLE_KINDS.has(kind)) flushPendingMutation();` removed, then `node scripts/test-extension.mjs` | `exit=1`, `# tests 400 / # pass 397 / # fail 3`: `not ok 283` (click after an addition), `not ok 284` (every executable kind), `not ok 286` (queued records). 283 printed: `Expected values to be strictly deep-equal: + actual - expected [ - 'dom.mutation', 'dom.click' ]`, with `actual: 0: 'dom.click'`, at `recorder.test.ts:83:12`. Tests 285 and 287 need no flush, so they still passed. |
| Restore, then `sha256sum -c` | `apps/extension/src/content/recorder.ts: OK`: byte-identical to `18d37ef2311a822435bba5b76def9fccfdd35da6b8546f7f36358e3bd0d1cb46`, the bytes of the green 400/400 run. |
| `pnpm check` (first run) | `exit=2`. The package type check passed; the test-config type check reported one error in a file I do not own: `src/background/connection/tests/active-recording.test.ts(19,27): error TS2305: Module '"../active-recording"' has no exported member 'RECORDING_START_PROJECT_LOOKUP_BOUND_MS'`. Git status at that moment: ` M …/tests/active-recording.test.ts`, with `active-recording.ts` unmodified and not yet exporting the name. That is `f-recording-start-guard`'s edit in progress. |
| `pnpm check` (rerun once) | `exit=0`. Git status now shows ` M …/connection/active-recording.ts` as well. |
| Structure audit, with the new test staged in a scratch copy of the git index (`GIT_INDEX_FILE=<scratch>/frmf-index`), then `node scripts/structure-audit.mjs` | `exit=0`, `structure-audit: passed (39 warning(s), 17 baselined).` No warning names a changed file. The real index is untouched. |
| `pnpm exec playwright test -c e2e/playwright.content.config.ts --workers=2 e2e/content/tests/recorder-trust.spec.ts` | `exit=0`, `4 passed (4.2s)`. It pins exact event-kind lists, so a flush with nothing pending adds no event. It records with mutations off. |
| Same, `identity-signals.spec.ts` (records with default settings, mutations on) | `exit=0`, `4 passed (2.8s)`. |
| Same, `failures.spec.ts` (records with mutations on) | `exit=1`, `1 failed / 11 passed (33.6s)`. `failures.spec.ts:238` "a post-condition that never appears is OUTPUT_NOT_OBSERVED" failed with `Tearing down "openHarness" exceeded the test timeout of 30000ms.` There was no assertion diff, that test never starts recording (so `emit` returns before the flush), and the spec has no local changes. |
| Same, `failures.spec.ts`, rerun once, alone | `exit=0`, `12 passed (3.7s)`. The earlier teardown timeout is treated as environmental; that rests on a single observation. |

The only content-harness specs that call `setRecording(true)` with mutations on are
`failures.spec.ts:101` and `identity-signals.spec.ts:112`. `redaction`, `selection-redaction`,
`click`, `identity-wire-chain` and `recorder-trust` all pass `captureMutations: false`.

## Not verified

- **No Lab run** (no Lab commands in this dispatch). A Lab run must show:
  - **Recording lane:** `delayed-ui`, `intermediate-state`, `dynamic-list` and `reconnect` still
    pass their `web.dom.mutated` "at least 1" rows, and their `web.element.clicked` counts are
    unchanged (delayed-ui 2, intermediate-state 1, reconnect 3).
  - **Order in Core's recording for W25 (`delayed-ui`), 3 of 3:** the `input.event` observation
    whose `latestEvidence.kind` is `dom.mutation` sits before the late click's `action` entry. Before
    this change it came after the click in 3 of 3 Stage 1 recordings. This is the precondition the
    `w25-wait-mapper` rule needs.
  - **W24 `intermediate-state --flow`, unarmed:** passes with actions including
    `web.dom.type:succeeded` and `web.dom.click:succeeded`, and its four finalState rows.
  - **`--variant unannounced`:** still reports `output_not_observed`. It is out of Week 1 but stays
    in the corpus.
- **Order through the background worker and Core.** The unit test proves the order in which the
  content script calls `chrome.runtime.sendMessage`. I did not observe the order in which those
  messages are handled downstream. Report Task 2 notes that a click waits for its merged DOM snapshot
  before the background sends it, while evidence does not wait. That should keep an earlier-sent
  mutation ahead of the click, but it has not been observed.
- **No real-browser row for "a click after a DOM addition".** The unit test drives a stub observer.
  A harness row with a real `MutationObserver` and a trusted click would need a spec I do not own,
  such as `recorder-trust.spec.ts`. The brief allowed a harness row only where no unit seam exists.
- **Mutation proofs not run:** only the flush call itself was mutation-proven. The empty-batch check
  (guarded by test 3) and the stale-timer clearing were not broken and restored.
- **Not run:** root `pnpm check`, `pnpm test`, `pnpm build`, the extension build, the full content
  harness, Firefox, and domain or test-runner tests. I changed nothing in domain or the test-runner.

## Open questions or contradictions found

1. **`takeRecords()` goes beyond the brief's wording** (see What changed). Keep it or drop it; it is
   one line and one test either way.
2. **`dom.input` is sent at the end of its 350 ms quiet period, not at the keystroke.** A DOM change
   the typing itself caused, such as live validation text, is therefore now sent before that
   `dom.input` rather than possibly after it. The brief lists `dom.input` explicitly, so this
   follows the brief. For `w25-wait-mapper`, this means a mutation observation just before a
   type-derived entry does not imply that the change preceded the typing. That rule only reads
   mutations before a `web.dom.click`, so it is unaffected, but the builder should not generalise to
   `dom.input`.
3. **The brief assumed HEAD `2ca97f5`;** it was `3a6d142`. Neither owned file had changed in
   between.
4. **Type error seen in a file I do not own:**
   `apps/extension/src/background/connection/tests/active-recording.test.ts(19,27)` TS2305. At the
   time its git status was ` M`, with `active-recording.ts` unmodified. It cleared on the rerun, once
   `active-recording.ts` was modified too. Left alone.
