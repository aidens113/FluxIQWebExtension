# g-discard-window-evidence: a run shows what the discard window excluded

Worker report, 2026-09-13, brief `g-discard-window-evidence` in
`briefs/finish-week1.md` (twenty-first dispatch). The repository was at `HEAD 49abd93`.
Nothing was committed. Core was not read or edited, and no Lab command ran.

## Outcome

**Done.** Each of the runner's two reads of Core's discard audit now publishes, in its
`runtime.settle` event, the window it judged entries against:

- the window's bounds;
- how many discard entries Core stamped outside the window, per audit type, and by
  whether each named this run's recording, no recording, or another recording.

The failure text now says what the check judges: lost actions inside this run's
recording window. Each recording is named, or "with no recording id". "after
finalization" is added only when Core's `sinceFinalizedMs` says so.

- **Re-verified at HEAD first.** A repository grep found no `recordingDiscardWindow`,
  and the old text "arrived after their recording was finalized" was still at
  `recording-discards.ts:95`. So the item was not already settled.
- **Hashes at HEAD** matched the previous worker's committed versions:
  - `recording-discards.ts F3C38E6A…F92E`;
  - `recording-discards.test.ts D4B26973…64BD`;
  - `run-scenario.ts 6183E1D7…9AB1`;
  - `runner-wiring.test.ts 1BF8ED19…208D`.
- **Mutation proofs:** 17 mutations, each applied alone. Every one failed a test with a
  real assertion diff. Both mutated files were restored byte-identical.

## What changed and why

### `packages/test-runner/src/flow-lane/recording-discards.ts`

**New types.** These are type-only exports, which the `exported-values` rule does not count.

- `RecordingDiscardExclusions`:
  `Record<RecordingDiscard["type"], Record<"thisRunsRecording" | "noRecording" | "anotherRecording", number>>`.
  Both audit types are always present, with zeros.
- `RecordingDiscardWindow`: `{ from: number | null; until?: number; excluded: RecordingDiscardExclusions | null }`.
  - `from` is `null` when the read had no lower bound.
  - The `until` key is present only when the read had an upper bound.
  - `excluded` is `null` when the response carried no audit log, so nothing is
    claimed excluded from a log that was never read.
- `RecordingDiscardAudit` gains `window: RecordingDiscardWindow`.

**The single pass.** `readAuditLog` walks Core's audit log once, using two helpers:

- `discardEntry` parses a discard-typed entry and the recording it names;
- `discardOf` builds the published `RecordingDiscard`.

For each discard-typed entry:
- **Outside the window:** it increments `excluded[type][relation]`.
- **Inside the window:** it is matched by recording or session exactly as before.

Only counts leave the function. No entry id, message, session, client, recording id,
`eventType` label or `inputId` reaches the window.

**One bound helper.** `windowBound` is used both to apply a bound (`outsideWindow`)
and to publish it, so the published window is always the applied one.

- **Behaviour change:** only a finite number is a bound now. Before, `from: +Infinity`
  or `until: -Infinity` excluded every stamped entry. Both now exclude nothing and
  publish as no bound.
- **Unchanged:** `undefined` and `NaN` bounds, which already excluded nothing.
- **Callers:** the runner only passes `Date.now()` values, so it is unaffected.

**The failure text.** It is now `Core discarded recorded actions inside this run's recording window (<groups>)`.

- **Groups:** each group is `N for <recordingId>` or `N with no recording id`, joined by `, `.
- **"after finalization":** a group gets ` after finalization` only when every entry
  showing that group's loss carries `sinceFinalizedMs`. An entry shows a loss when it
  is an `action_discarded` entry, or has `discardedActions` above 0. Evidence that
  shows no loss does not decide it.
- **Why "every" and not "any":** a group that mixes a timed and an untimed loss never
  claims all of it arrived after finalization.

**Unchanged:** the category, the union with `earlier`, entry matching, failing closed on
a missing log, and the failure's `details`. The doc comments now describe the window's
publication and the wording.

### `packages/test-runner/src/run-scenario.ts`, the two `runtime.settle` events only

- **First read**, "Core persisted the completed recording" (`:319`):
  `recordingDiscardWindow: discardAudit.window` is added directly after
  `recordingDiscards: discardAudit.discards`.
- **Second read**, "Core's discard audit was read again before the topology closed"
  (`:417`): `recordingDiscardWindow: secondRead.window` is added directly after
  `recordingDiscards: secondRead.discards`.
- **Size:** no line added; the file is still 681 lines.

### `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`, only the two moved pins

- **First-read settle regex (`:81`):** it now requires
  `recordingDiscards: discardAudit\.discards, recordingDiscardWindow: discardAudit\.window, extensionConnectionAfterStop`.
  It also gained a failure message.
- **Second-read `published` string (`:95`):** it now includes
  `recordingDiscardWindow: secondRead.window, discardsAfterFirstRead: `.
- **No pin was added.**

### `packages/test-runner/src/flow-lane/tests/recording-discards.test.ts`

**The old text.** Each assertion of the old failure text now uses the new wording. The
wording is built from a `lostInWindow` constant.
- Rows ending `(1 for recording.run after finalization)` and
  `(4 for recording.run after finalization)` now say "after finalization", because
  those entries carry `sinceFinalizedMs`.
- The second-read regex at the old `:215` is updated the same way.

**The whole-result rows.** Seven rows that compared the entire result with
`{ discards, failure }` now go through a `judged()` helper, because the result gained
`window`. What they judge is unchanged.

**Three new tests:**

1. **"each read publishes its bounds, until only when set, and counts what the window
   excluded by audit type and by the recording each entry names".**
   - **The diagnosis run's first read:** `{ from, excluded: action noRecording 2 }`,
     with no `until` key.
   - **Its second read:** `until` is set, and action `thisRunsRecording` is 4 and
     `noRecording` is 2.
   - **A mixed read covering every group on both sides of the window:**
     - action: this run's recording 4, no recording 3, another recording 1;
     - event: this run's recording 1, another recording 1.
     - An entry exactly at `until` is inside the window. It is neither this run's
       discard nor excluded. This is the first test of the inclusive `until` boundary.
     - Unstamped entries, entries inside the window, and the non-discard pairing entry
       at timestamp 0 are not counted as excluded.
   - **Withheld text:** the three published windows' JSON contains no id, session,
     client, message, label, input id, domain id or recording id.
2. **"a read with no bound publishes from as null and no until, …".**
   - **Unset bounds:** `from: null`, and no `until` key.
   - **Non-finite bounds:** `NaN`, `+Infinity` and `-Infinity` publish as no bound
     and read all 6 entries.
   - **No audit log:** `excluded: null`, with the bounds kept.
   - **JSON round trip:** the published window survives unchanged.
3. **"the failure names lost actions inside this run's recording window, says `with no
   recording id` …, and says `after finalization` only when Core's sinceFinalizedMs
   says so".** Covered cases:
   - untimed, with no recording id and with a recording;
   - timed, with a recording and with no recording id;
   - a timed evidence entry whose running count shows the loss;
   - a timed and an untimed loss of one recording, in both orders: no claim;
   - untimed evidence plus a timed loss: the claim is kept;
   - two groups side by side.

## Commands run and observed results

Every command was run from `packages/test-runner` unless noted. Logs are the scratch
files prefixed `gdwe-`.

| Command | Observed |
| --- | --- |
| `pnpm exec tsc -p tsconfig.json --outDir dist-gdwe` | `tsc exit=0`, no output |
| `node --test "dist-gdwe/**/*.test.js"` | `test exit=0`; `# tests 517`, `# pass 517`, `# fail 0`, `# cancelled 0`. Includes `ok 113 - each read publishes its bounds, …`, `ok 114 - a read with no bound publishes from as null …`, `ok 115 - the failure names lost actions inside this run's recording window, …`, `ok 109`, `ok 111`, `ok 116`, `ok 178 - Core's audit of discarded recording messages is read after the round trip, …`, `ok 179 - Core's discard audit is read a second time, …` |
| `sha256sum` of the four owned files, taken right after that run | `8fad4a8a…c47ce recording-discards.ts`, `b8f42768…e4e49 recording-discards.test.ts`, `5abd3557…13eef run-scenario.ts`, `e16f3b53…c18f4 runner-wiring.test.ts` |
| `node gdwe-mutate.mjs <scratch>`: each mutation applied alone to the original bytes, then restored | `mutate script exit=0`. Rows below. |

**How the mutations were built.**
- **The recording-discards mutations:** each was built narrowly, as
  `tsc src/flow-lane/tests/recording-discards.test.ts --outDir dist-gdwe-m`, with
  `tsconfig.json`'s compiler options passed as flags. Then only that test file ran.
- **The wiring mutations:** each edited `run-scenario.ts` on disk, and
  `dist-gdwe/run-evaluation/tests/runner-wiring.test.js` ran against it. That test
  reads the source file, so no rebuild was needed.
- **Controls:** `control-discards: tsc exit=0; test exit=0; # tests 17; # pass 17` and
  `control-wiring: test exit=0; # tests 6; # pass 6`.

**Every mutation compiled (`tsc exit=0`) and failed (`test exit=1`):**

| Mutation | Failing tests and diff |
| --- | --- |
| R1 `until` always published (`until: until ?? 0`) | `not ok 12 - each read publishes its bounds, …` and `not ok 13 - a read with no bound …`: `+   until: 0` |
| R2 unset `from` published as 0 | `not ok 13`: `+   from: 0`, `-   from: null` |
| R3 `noRecording` and `anotherRecording` swapped | `not ok 12`: `+ anotherRecording: 2, + noRecording: 0, - anotherRecording: 0, - noRecording: 2` |
| R4 audit type ignored (every exclusion counted as `action_discarded`) | `not ok 12`: `+ anotherRecording: 2, - anotherRecording: 1, + thisRunsRecording: 5, - thisRunsRecording: 4` |
| R5 entries inside the window also counted as excluded | `not ok 12` (`+ thisRunsRecording: 4, - thisRunsRecording: 1`) and `not ok 13` (`+ thisRunsRecording: 2, - thisRunsRecording: 0`) |
| R6 an unread log published as zero exclusions | `not ok 13`: `+ excluded: { + 'recording.action_discarded': { + anotherRecording: 0, …` |
| R7 input ids spread into the window | `not ok 12` and `not ok 13`: `+ inputIds: [ + undefined, + 'web.user.navigation_requested', + 'web.user.text_entered'`. The exact-shape `deepEqual` caught it first, so the withheld-strings loop after it did not run. |
| F1 the old "arrived after their recording was finalized" text | `# fail 6`: `not ok 3`, `8`, `9`, `10`, `11`, `14`. For example, `not ok 8 - a runtime confirmation Core audited before …`: `+ 'Core discarded recorded actions that arrived after their recording was finalized (2 with no recording id)'`, `- "Core discarded recorded actions inside this …` |
| F2 `with no recording id` becomes `for no recording` | `# fail 5`: `not ok 3`, `8`, `9`, `11`, `14`. For example, `+ "… recording window (1 for no recording)"`, `- "… (1 with no recording id)"` |
| F3 `after finalization` always | `# fail 6`: `not ok 3`, `4`, `8`, `9`, `11`, `14`. For example, `+ "… (1 with no recording id after finalization)"` |
| F4 `after finalization` never | `# fail 3`: `not ok 10` (`+ "… (1 for recording.run)"`, `- "… (1 for recording.run after finalization)"`), `not ok 14`, `not ok 15` |
| F5 `after finalization` when any entry is timed | `not ok 14 - the failure names lost actions …`: `+ "… (2 for recording.run after finalization)"`, `- "… (2 for recording.run)"` |
| F6 `after finalization` decided by the last entry | `not ok 14`: the same diff. The `whileOpen, lateAgain` order row caught it. |
| F7 untimed evidence that shows no loss decides it | `not ok 14`: `+ "… (2 for recording.run)"`, `- "… (2 for recording.run after finalization)"` |
| W1 the first settle event drops `recordingDiscardWindow` | `# pass 5; # fail 1`: `not ok 4 - Core's audit of discarded recording messages is read after the round trip, …`: `error: "the first read's discards are published with the window it judged them in"` |
| W2 the second settle event drops `recordingDiscardWindow` | `# pass 5; # fail 1`: `not ok 5 - Core's discard audit is read a second time, …`: `error: 'published is in the runner'`, `expected: true`, `actual: false` |

**After the mutations:**

| Command | Observed |
| --- | --- |
| Restore, as the script printed it | `restored recording-discards.ts 8FAD4A8A…C47CE identical=true`, `restored run-scenario.ts 5ABD3557…13EEF identical=true` |
| `sha256sum -c gdwe-hashes-before-mutation.txt` | `OK` for all four files, so the 517-test pass stands for this tree |
| `ls -d dist-gdwe-m` | `No such file or directory`: the script removed it. This `ls` was the only source of the call's exit code 2. |
| `pnpm -C packages/test-runner check` | `test-runner check exit=0` |
| `node scripts/structure-audit.mjs` (repository root; no new files) | `structure audit exit=0`; `structure-audit: passed (39 warning(s), 17 baselined).` The only line naming a changed file is `warn [file-lines] packages/test-runner/src/run-scenario.ts: 681 lines is past the 400-line advisory threshold.` That warning is the same as before the change. |
| `rm -rf packages/test-runner/dist-gdwe` | `dist-gdwe exists after delete: False` |
| `git status --short`; `git diff --stat -- packages/test-runner` | `M` on exactly the four owned files, and nothing else listed; `4 files changed, 207 insertions(+), 44 deletions(-)`. Git warns `LF will be replaced by CRLF` for each file; no whole-file line-ending churn. |
| `wc -l` | `recording-discards.ts` 211, `run-scenario.ts` 681 |

Every suite run was a single observation. None failed in a uniform or impossible way:
- the controls passed;
- every mutated failure carried real assertion diffs.

## Not verified

- **No Lab run.** For `basic-form --flow --target isolated` at the fix commit, a Lab
  run must show all of the following. The numbers come from the one instrumented
  diagnosis run in `l-stage2.md`, so they are single observations.
  - **The run passes.**
  - **The first `runtime.settle`** ("Core persisted the completed recording") has
    `recordingDiscards: []`, and
    `recordingDiscardWindow: { from: <epoch ms just before Record>, excluded: { "recording.action_discarded": { thisRunsRecording: 0, noRecording: 2, anotherRecording: 0 }, "recording.event_discarded": { all 0 } } }`,
    with no `until` key.
  - **The second `runtime.settle`** has `recordingDiscards: []`,
    `discardsAfterFirstRead: 0`, and a `recordingDiscardWindow` with the same `from`.
    Its `until` falls between the Flow page being prepared and the Flow's first action
    starting. Its `excluded` has `"recording.action_discarded": { thisRunsRecording: 4, noRecording: 2, anotherRecording: 0 }`.
  - **The bundle contains no** discard message, `eventType`, `inputId` or recording id
    inside `recordingDiscardWindow`.
- **For a recording-lane run with no `--flow`,** for example
  `sensitive-input --target isolated`:
  - both settle events have no `until`;
  - both show the probe's exclusions, `noRecording` equal to the number of probe
    actions for that scenario. I did not check that number per scenario.
- **The failure wording has not been seen in a real bundle.**
- **Not run:** root `pnpm check`, `pnpm test` or `pnpm build`; the content harness;
  domain or extension tests. Nothing outside test-runner changed.
- **The narrow compile is not the package build.** The recording-discards mutations
  were compiled with `tsconfig.json`'s options passed as flags. The unmutated tree was
  proven with the full `-p tsconfig.json` build and the whole suite.

## Open questions or contradictions found

1. **The "no recording" exclusion count includes every session's entries.** The window
   is judged before the session match, so the count covers what the window excluded,
   whoever sent it. An isolated Core has only this run's session, so the Lab reading is
   unaffected. Against a shared Core, the count could include another client's
   entries. The brief groups only by recording, so I did not split by session. The
   test states this in a comment.
2. **Counts are per read, not unioned.** Each read counts what it excluded from that
   snapshot. Core's snapshot keeps 100 entries, so on a busy Core a second read may
   no longer see an entry the first read excluded. `recordingDiscards` is unioned
   across reads; `excluded` is not.
3. **Non-finite bounds changed meaning** (see the source section). No caller is
   affected. The supervisor may want it recorded as a deliberate change.
4. **Other places still quote the old failure text.** They are not mine and not
   changed:
   - the plan at `mvp-week1-web-automation-reliability-plan.md:658`;
   - `reports/g-run-scenario-followups.md:62`;
   - `reports/l-stage2.md` at `:30`, `:237`, `:333`, `:435` and `:663`.
   A repository grep found no copy in `docs/architecture/`.
5. **The failure's `details` still carry only `recordingDiscards`.** The runner does not
   publish them for this category, and the window already reaches the bundle through
   the settle events that come first. So I did not add the window there.
