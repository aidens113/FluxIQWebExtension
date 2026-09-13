# g-discard-window: a discard counts only inside the recording's window

Worker report, 2026-09-13, brief `g-discard-window` in `briefs/finish-week1.md`
(nineteenth dispatch), with the coordinator's mid-task evidence message. Nothing
committed. This repository was at `HEAD 590e735`; Core was not read beyond the
lines named below, and not edited or built.

## Outcome

**Done.** The runner's discard check now counts an entry in Core's audit log only
when Core stamped it inside the window in which this run's recording could lose a
message. The window runs from just before the runner asks the extension to start
recording until the Flow lane starts dispatching its Flow. With no Flow lane, the
window has no end.

- **Before the recording:** the Core action probe's two runtime confirmations, which
  failed all 12 Stage 2 runs, are ignored.
- **After finalization:** the Flow lane's four confirmations, which the diagnosis run
  showed would have failed every Flow run at the second read, are ignored too.
- **A real late loss** still fails the run: a recorded message naming the recording
  that Core audited after finalization but before the Flow was dispatched.
- **An entry with no readable timestamp** still counts, so the check fails closed.
- **Everything else T2 and the completeness check do is unchanged:** matching by
  recording or session, the union of the two reads, the failure text, and failing
  closed on a missing audit log.
- **Mutation proofs:** three clean mutated builds cover each of the brief's four cases,
  the lane's report and the runner wiring. Each file was restored byte-identical.
- **Re-verified at HEAD first:** `readRecordingDiscards` had no window, so nothing was
  already settled.

## What changed and why

### `flow-lane/recording-discards.ts`

- **`RecordingDiscardScope`** (`:37`) gains `from: number | undefined`, a required
  key, and `until?: number | undefined`.
  - Both are epoch milliseconds.
  - `from` follows the `sessionId` pattern: required, so no read can leave it out by
    omission. `undefined` means no lower bound, which counts everything, as before.
  - The doc says what each bound is and why each matters.
- **`outsideWindow`** (`:135`) is called in `discardOf` (`:118`) after the type filter
  and before the recording or session match. So both kinds of entry are judged
  against the window, as the brief and the coordinator require.
  - An entry is outside only when its `timestamp` is a finite number below `from` or
    above `until`. Both bounds are inclusive.
  - A missing, `null`, string or `NaN` timestamp is inside.
  - A bound that is not a number, `NaN` included, excludes nothing.
- **Why the clocks agree.** Core stamps each entry with `this.now()`
  (`client-gateway/service/audit-log.ts:17`). That is `Date.now` by default
  (`client-gateway/service/config.ts:25`), and `programs/_shared/runtime.ts:48-52`
  passes no other clock. The isolated Core is a child process on the same machine as
  the runner, which takes both bounds with `Date.now()`. The diagnosis run agrees:
  the probe's navigate returned to the runner at 13.186, and Core stamped its discard
  at 13.188.
- **Why a probe count cannot leak into the recording.** Core deletes a client's
  remembered closed record when a recording starts (`bridge.ts:166`, `:341`). It
  replaces the record with zero counts when a recording closes (`:465`). So the
  probe's running counts, 1 and 2, never carry into an entry that names the run's
  recording.

### `flow-lane/run-flow-lane.ts`

- **`FlowLaneInput.flowDispatchStarting: (at: number) => void`** (`:58`), required.
  Its doc says it is called just before the Flow run is dispatched, and never when
  the lane fails before that.
- **The call site.** `input.flowDispatchStarting(Date.now())` (`:124`) sits directly
  before `executeRecordedFlowRun` (`:125`). That is after the reset, the page load
  and the one read of the Flow's nodes.
- **Why a callback rather than a field on the outcome.** The lane can throw after
  dispatching, when an expectation fails or a run times out. `lane` is then never
  assigned, yet the second read in `finally` still needs `until`.

### `run-scenario.ts`: only the recording-start timestamp and the two discard reads

- `let discardWindowFrom` and `let discardWindowUntil` (`:109-110`), with a comment
  explaining the window.
- `discardWindowFrom = Date.now();` (`:279`) sits directly before
  `fluxiq.startRecording`. That is after the probe (`:261`) and after `selectProject`.
- The first read's scope is
  `{ recordingIds: outcome.newRecordingIds, sessionId: paired?.sessionId, from: discardWindowFrom }`
  (`:312`). The comment above it adds "and only inside the recording's window".
- `flowDispatchStarting: at => { discardWindowUntil = at; },` is passed to
  `runFlowLane` (`:336`).
- The second read passes `{ ...firstDiscardRead.scope, until: discardWindowUntil }`
  (`:416`).
- **Size.** The file is now 681 lines, past the 400 advisory and under the 800 budget.
  It is not baselined.

### Tests

**`flow-lane/tests/recording-discards.test.ts`**
- **The fixture clock** uses the diagnosis run's real epoch times:
  - `from`: Record pressed, `1_789_292_715_339`;
  - `inside`: a recorded action, `…717_045`;
  - `finalized`: `endedAt`, `…717_333`;
  - `until`: the Flow's first action start, `…729_664`, an upper bound on the lane's
    report.
  - The existing rows gained `from` in their scopes and are otherwise unchanged.
- **Rows that mirror the diagnosis**, as the coordinator asked:
  - `probeConfirmations`: discards 1 and 2 as Core wrote them, with no recording id,
    counts 1/1 and 2/2, the observed labels, input ids and timestamps, and no
    `sinceFinalizedMs`.
  - `flowConfirmations()`: discards 3 to 6, naming the recording, with the observed
    timestamps and `sinceFinalizedMs` 11165, 12183, 13205 and 14533.
  - `genuineLateAction`: not from that run. It names the recording, arrives at
    `finalized + 40` with `sinceFinalizedMs: 40`, and must count.
- **Four new tests**, one per case in the brief:
  - **a probe confirmation before `from` is ignored.** The same two entries fail with
    `(2 with no recording id)` when `from` is `undefined`, which is Stage 2's failure;
  - **inside the window counts.** One entry exactly at `from`, naming no recording, and
    one naming the recording while it was open;
  - **after `until`, ignored; before it, counts.** Both reads of the diagnosis run give
    no loss, and a session-only entry after `until` is ignored. A genuine late loss
    before `until` fails with `(1 for recording.run)`, while the Flow confirmations
    around it are ignored. With no `until`, the Flow confirmations count as
    `(4 for recording.run)`;
  - **no readable timestamp counts.** A Flow-shaped entry with the key missing, `null`,
    a string or `NaN` counts, and so does an unstamped probe-shaped entry.

**`flow-lane/tests/run-flow-lane.test.ts`**
- `LaneOptions.flowDispatchStarting` is optional, and `runLane` passes a no-op by
  default, so the existing F1 order test is untouched.
- **New test.** The lane reports once, between `list-flow-subflows:flow.new` and
  `start`, with a time within the lane's run. A short proposal that is refused before
  approval reports nothing.

**`run-evaluation/tests/runner-wiring.test.ts`**
- **Changed:** the second test's `secondRead` string now includes `until: discardWindowUntil`.
- **Added**, to pin the reads' window inputs:
  - **first test:** a regex requiring `discardWindowFrom = Date.now();` directly before
    the `fluxiq.startRecording` message;
  - **first test:** the exact `discardScope` construction with `from: discardWindowFrom`;
  - **second test:** the exact `flowDispatchStarting: at => { discardWindowUntil = at; },`
    line.
- See open question 5 on whether adding these is inside the brief.

## Commands run and observed results

Every command ran from `packages/test-runner` through `pnpm -C`, unless noted. No
`pnpm build`, no Lab command, no domain or extension tests. Outputs are in scratch
files prefixed `gdw-`.

| Command | Observed |
| --- | --- |
| `pnpm exec tsc -p tsconfig.json --outDir dist-gdw` (first version of the tests) | `tsc exit=0` |
| `node --test "dist-gdw/**/*.test.js"` | `test exit=0`; `# tests 514`, `# pass 514`, `# fail 0`, `# cancelled 0` |
| `Get-FileHash` before mutation, then `Copy-Item` backups | `recording-discards.ts F3C38E6A…F92E`, `run-flow-lane.ts B4A6AE88…465A`, `run-scenario.ts 6183E1D7…9AB1`; the backups hash identically |
| First Build A attempt (lower bound written as `false && …`) | `mutated A tsc exit=2`: `src/flow-lane/recording-discards.ts(137,48): error TS18046: 'timestamp' is of type 'unknown'.` **Discarded as proof.** Restored by copy, and all three hashes were identical. |
| The coordinator's evidence arrived. Test rows rewritten to mirror the diagnosis, then `tsc --outDir dist-gdw` and the whole suite | `tsc exit=0`; `test exit=0`; `# tests 514`, `# pass 514`, `# fail 0`. Includes `ok 109 - a runtime confirmation Core audited before the extension was asked to start recording, naming no recording, is ignored`, `ok 110 - a discard Core audited inside the window counts, …`, `ok 111 - once the Flow lane began dispatching, a discard naming the recording is ignored, and a late one Core audited before that counts`, `ok 112 - an entry with no readable timestamp counts, so the window fails closed`, `ok 135 - the lane reports the time just before it dispatches the Flow run, …`, `ok 175 - Core's audit of discarded recording messages is read after the round trip, …`, `ok 176 - Core's discard audit is read a second time, …` |
| **Build A**, four mutations: (1) lower bound `timestamp < Number.NEGATIVE_INFINITY`; (2) the lane's report moved after `executeRecordedFlowRun`; (3) the second read passes `firstDiscardRead.scope`; (4) `discardWindowFrom = Date.now();` moved above `selectProject`. Then the three test files. | `mutated A tsc exit=0`; `test exit=1`; `# tests 32`, `# pass 26`, `# fail 6`. `not ok 8 - a runtime confirmation Core audited before …, is ignored` (`+ discards: [ { discardedActions: 1, discardedEvents: 1, …`). `not ok 9 - … inside the window counts …` (`+ 'audit.probe.navigate', + 'audit.probe.type'`, collateral: the probe rows now count). `not ok 10 - once the Flow lane began dispatching …` (collateral, same cause). `not ok 26 - the lane reports the time just before it dispatches …` (`'list-flow-subflows:flow.new', + 'start',`). `not ok 30 - Core's audit of discarded recording messages …` (`error: 'the window opens just before the extension is asked to start recording, after the Core action probe'`). `not ok 31 - Core's discard audit is read a second time …` (`error: 'secondRead is in the runner'`, `expected: true`, `actual: false`). |
| Restore A | All three hashes identical to the backups |
| **Build B**, three mutations: (1) `timestamp <= from`; (2) `until` excludes every stamped entry, as `(typeof until === "number")`; (3) `discardScope` gets `from: undefined` | `mutated B tsc exit=0`; `test exit=1`; `# tests 32`, `# pass 29`, `# fail 3`. `not ok 9 - … inside the window counts …` (`- 'audit.at-start',`). `not ok 10 - once the Flow lane began dispatching … and a late one Core audited before that counts` (`+ []`, `- [ { discardedActions: 1, discardedEvents: 1, entryId: 'audit.late', …`). `not ok 30 - …` (`error: 'both reads are bounded by that window'`). `ok 31`. |
| Restore B | Hashes identical |
| **Build C**, two mutations: (1) upper bound `timestamp > Number.POSITIVE_INFINITY`; (2) an unreadable timestamp counts as outside (`return true`) | `mutated C tsc exit=0`; `test exit=1`; `# tests 32`, `# pass 29`, `# fail 3`. `not ok 10 - once the Flow lane began dispatching …` (`+ discards: [ { …, entryId: 'audit.flow.1',`). `not ok 11 - an entry with no readable timestamp counts, so the window fails closed` (`+ []`, `- [ 'audit.flow.1' ]`). `not ok 14 - an audit entry without an id is matched by its type, recording and running counts` (`+ []`, `- [ 3, 4 ]`, collateral: those entries carry no timestamp either). |
| Restore C, final hashes | `recording-discards.ts F3C38E6A…F92E`, `run-flow-lane.ts B4A6AE88…465A`, `run-scenario.ts 6183E1D7…9AB1`, all identical to the backups. Test files: `recording-discards.test.ts D4B26973…64BD`, the version the 514-test run compiled; `run-flow-lane.test.ts 17486F51…3AC5` and `runner-wiring.test.ts 1BF8ED19…208D`, unchanged since that run. So the whole-suite pass stands for this tree. |
| `pnpm -C packages/test-runner check` | `test-runner check exit=0` |
| `node scripts/structure-audit.mjs` (repository root; no new files, so no scratch index was needed) | `structure audit exit=0`; `structure-audit: passed (39 warning(s), 17 baselined).` The only line naming a file I changed is `warn [file-lines] packages/test-runner/src/run-scenario.ts: 681 lines is past the 400-line advisory threshold.` |
| `Remove-Item -LiteralPath …\dist-gdw -Recurse -Force` | `dist-gdw exists after delete: False`. An earlier combined command, which named the folder through a variable, was refused by the tool's protected-path check before anything in it ran. |
| `git status --short -- packages/test-runner`; `git diff --stat` | `M` on exactly the six owned files; `6 files changed, 179 insertions(+), 20 deletions(-)`. Git warns `LF will be replaced by CRLF` for each; the stat shows no whole-file line-ending churn. |

Each suite run is a single observation. None failed in a uniform or impossible way,
and every mutated failure carried real assertion diffs.

## Not verified

- **No Lab run.** This is what a Lab run at the fix commit must show, for
  `basic-form --flow --target isolated`:
  - it passes;
  - the first `runtime.settle` has `recordingDiscards: []`, although Core audited
    the probe's two confirmations;
  - `flow-lane.json` exists, with `candidateCount` 4;
  - the second read's `runtime.settle` has `recordingDiscards: []` and
  `discardsAfterFirstRead: 0`, although Core audited the four Flow confirmations;
  - no `recording.persistence` failure.
- **For `sensitive-input --target isolated`, the recording lane:** it passes the
  discard check.
- **The bundle cannot prove the exclusion.** It records neither the window's bounds
  nor how many entries fell outside it (open question 1). A Lab proof therefore rests
  on the run passing, not on a published count.
- **The timing margins rest on one diagnosis run:**
  - the probe's last confirmation was stamped about 720 ms before Record was pressed;
  - the lane's report comes after its Flow node read, which followed page preparation
    at 26.421, and before the first action started at 29.664. The first Flow
    confirmation was stamped at 30.686.
- **Not run:** root `pnpm check`, `pnpm test` or `pnpm build`; the content harness;
  domain or extension tests. Nothing outside test-runner changed.
- **The inclusive `until` boundary** has no test of its own. The inclusive `from`
  boundary does (`audit.at-start`), and the `until` boundary is covered only by the
  Build B and C mutations.
- **The `existing` and `clone` targets** start recordings but read no discards. They
  are unchanged, and I did not check them.

## Open questions or contradictions found

1. **The bundle should show the window.** Publishing `{ from, until }` and a count of
   excluded entries in both `runtime.settle` events would let a Lab run show that the
   probe's and the Flow's confirmations were excluded, not merely absent. That needs a
   `RecordingDiscardAudit` field and a change to the published details, which lie
   beyond "only the two discard reads". I did not make it.
2. **The failure text is now wrong more often.** "arrived after their recording was
   finalized" also covers an in-window entry that names no recording, such as one Core
   audited after Record was pressed but before the recording opened. I kept the text,
   because the brief says to keep everything else, and a test pins it.
3. **A known blind spot, by the supervisor's decision.** A genuine recorded message
   Core audits after the Flow lane began dispatching is no longer counted, whether it
   names the recording or only the session.
4. **The margin before `from` depends on work the runner does between the probe and
   the start request.** Core stamps each probe confirmation 2 ms after the probe's HTTP
   result returns, not before it. The window is safe because the page check, the tab
   close, `listRecordings` and `selectProject` come in between. If that work shrank to
   nothing, a confirmation could land inside the window. It would fail closed, as a
   false failure rather than a hidden loss.
5. **Runner-wiring pins added, not only replaced.** The brief gives me "only the
   strings that pin those reads". Beyond replacing the second-read string, I added
   three pins of the reads' window inputs:
   - the `from` placement;
   - the scope construction;
   - the `until` source.

   Without them, a mutation of the window's wiring passed every test (Build B's
   `from: undefined` and Build A's `from` move). The supervisor may prefer to rule on
   whether this is inside the brief.
6. **Documentation not checked.** `docs/architecture/testing-facility.md` and
   `failure-taxonomy.md` may describe the discard check. I did not open them; they are
   not mine.
7. **Core wording, for Phase 1.6b as the dispatch records.** Core's message calls a
   runtime confirmation "an executable action … The client believes it was recorded".
   Nothing here depends on that wording.
