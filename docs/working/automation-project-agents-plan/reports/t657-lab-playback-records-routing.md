# t657 lab-playback-records-routing: worker report

## Outcome

Partial. The cleared-layers part is done and tested. The routing-reason part
is stopped as the brief allows, because Core's run detail drops the reason
sentence.

## What changed and why

- `packages/test-runner/src/lab-runs/write-playback-steps.ts`: new
  `clearedLayersOf`. It reads `clearedLayers` from the command attempt's
  `result.payload.result`, the top of the dispatch payload where the domain
  gateway dispatcher lifts it. If nothing is there, it reads one level down,
  in the client's own payload; these are the depths `listRead` already uses.
  - Each layer keeps only `{ kind, control }`, under Core's bound
    (`executor/node-execution/cleared-layers.ts`): Core's five kinds, the word
    with whitespace collapsed and at most 40 characters, and at most 12 layers.
    Layer names, `wayOut` and every other field are dropped.
  - The writer adds `clearedLayers` to `result.json` and `meta.json`, and
    appends `; cleared N layer(s): <kind> "<word>", ...` to the summary. Ran,
    failed and skipped host steps are all covered; the bigbox s5 step that
    cleared the picker was a skipped one.
  - Steps with no layers get no key and no summary text.
  - The header comment says why the routing reason is not written.
- `lab-runs/tests/write-playback-steps.test.ts`: two new tests.
  - Layers at the top level and nested are written to result, meta, summary
    and index. Unknown kinds, over-long words, names and way-outs are dropped.
    A plain step writes no `clearedLayers` and keeps its summary unchanged.
  - A `no_match` consultation writes its outcome and code and no reason.
- `docs/architecture/testing-facility.md`: new paragraphs after the
  state-routing paragraph in the playback-steps section. One explains why the
  reason is not written and records the `refused` drop below. The other
  describes `clearedLayers`.

### Where the routing reason is dropped

Core `packages/fluxiq/src/programs/automation-studio/runtime/service/summaries/state-routing.ts`,
`automationStudioRunDetailStateRouting`, called from `summaries/conversions.ts:192`.
It keeps `outcome`, the asking `code`, `toNodeId` (guard_stopped) and
`refused`. By design it drops `reason`, `candidates` and `matched`; its header
says the reason "repeats the host's words". The full reason exists only on the
session's node attempt trace (`AutomationStudioStateRoutingRecord.reason`,
`executor/contracts.ts:194`). That trace is set in `state-routing/decision.ts`
(for example "The page matched no step's expected starting page.", or the host's
effect-reading sentence). Reading it from session storage would copy host words
that the run detail withholds, which the brief's rules forbid. The no_match
reasons Core can give are listed in `decision.ts` lines 104-134 and 186-190.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-runner check`: tsc finished with
  no errors (`{"build-cache":"build","step":"test-runner:check",...}`, then a
  clean exit).
- `pnpm run build` in `packages/test-runner`: built
  (`"step":"test-runner:build"`, 2042 files).
- `node --test dist/lab-runs/tests/write-playback-steps.test.js dist/run-scenario/tests/playback-skips-wiring.test.js`:
  `# tests 16`, `# pass 16`, `# fail 0`.
- `pnpm structure:check`: `structure-audit: passed (199 warning(s), 639 baselined)`.
  One new advisory warning: `write-playback-steps.ts: 418 lines is past the
  400-line advisory threshold` (it was 369).

## Not verified

- No real command-attempt `attempt.json` with `clearedLayers` exists on disk. A
  search of `fxlab`, `fxwork` and the main checkout's `command-attempts` found
  none, because isolated Lab runs delete `.fluxiq`. The payload depth
  comes from reading `domain/src/io/gateway-output-dispatcher.ts` and the
  writer's existing `listRead` depths, not from a recorded run.
- No live run, as the brief requires.

## Open questions or contradictions found

1. **`refused` makes the Lab drop the whole routing record.** Core's run
   detail carries `refused: [{ guard, toNodeId }]` (closed guard codes) on
   `no_match`, `routed` and the other outcomes. The SHAPES table in
   `packages/test-runner/src/flow-lane/state-routing-attempt.ts` does not
   allow the `refused` key, so the record becomes `undefined`. The outcome is
   then lost from `flow-lane.json` and `steps/`. Of everything the run detail
   carries, these guards come closest to a "why". This file is outside my
   owned paths, so I did not edit it. Suggested fix: allow `refused` in each
   shape, keep the guard codes Core lists in `GUARDS` and node ids, and print
   them in the writer's `stateRouting` summary.
   - In run mvac0ddx the outcome did reach the steps, so that run had no
     `refused`. Its no_match is therefore one of three cases: the effect
     reading did not hold, some steps' effect still stood, or "matched no
     step's expected starting page".
2. Recording the reason needs a Core change: a bounded closed code for the
   no_match cause on the run detail (`state-routing.ts`), for example
   `no_candidate_matched`, `effect_not_shown` or `acted_effect_stands`. That
   is Core work outside this brief.
3. `write-playback-steps.ts` is now 418 lines, past the advisory limit. A later
   split could move the step-content readers (`listRead`, `clearedLayersOf`)
   into their own files.

## Round 2

### Outcome

Done. Refused guards are now kept, the `noMatchCause` field is read (the
`noMatchCause` name was taken from the coordinator, not from Core), and the
writer is split.

### What changed and why

- `packages/test-runner/src/flow-lane/state-routing-attempt.ts`: the shapes
  now allow `refused` on every outcome, and `noMatchCause` on `no_match`,
  `unobserved` and `no_pre_states`.
  - `refused` keeps an entry only when it has exactly the keys
    `{ guard, toNodeId }`, the guard is one of Core's five and the node has a
    node id's form. An empty list counts as none refused.
  - `noMatchCause` is checked by shape only: snake_case, at most 64
    characters. Its values are not listed because Core t661 is still defining
    them.
  - A malformed entry or cause rejects the whole record, as any key outside
    Core's shapes already did. A record without either field (older Core)
    parses as before.
  - New exported type `PersistedStateRouteRefusal`.
  - Because `run-scenario.ts` spreads the parsed record, both fields reach the
    writer with no wiring change.
- `lab-runs/write-playback-steps.ts`:
  - `PlaybackStateRoutingStep` gains `refused?` and `noMatchCause?`.
  - `withStateRouting` writes both into `stateRouting` in `result.json` and
    `meta.json`.
  - The summary ends, for example,
    `the runtime consulted state: no_match (matching_steps_already_acted; refused repeats_lasting_act at node.s4)`.
    The bracket is left out when the record has neither field.
  - The summary text sits after the cleared-layers text.
- Split, since the file was 418 lines and is now 362: a new directory
  `lab-runs/playback-step/` with a barrel `index.ts`, plus `list-read.ts`
  (`playbackListRead`) and `cleared-layers.ts` (`playbackClearedLayers`).
  Each returns its record and its summary sentence. The writer imports them
  through the barrel. Each has its own tests under `playback-step/tests/`.
- Tests:
  - `flow-lane/tests/state-routing-attempt.test.ts`: three new tests: kept
    fields, rejected shapes, and a persisted Flow run whose `no_match` carries
    refused guards.
  - `lab-runs/tests/write-playback-steps.test.ts`: the round-1 "no reason"
    test is replaced. A `no_match` with a cause and a refusal now writes both
    beside the cleared layers, and an older-Core record writes neither.
- `docs/architecture/testing-facility.md`: the paragraph from round 1 is
  rewritten. It now describes the kept `refused` and `noMatchCause`, the
  summary form, and the reason sentence still being withheld. The
  cleared-layers paragraph points at `lab-runs/playback-step/`.

### Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-runner check`: tsc finished with no
  errors.
- `pnpm run build` (test-runner): built, 2052 files.
- `node --test` on `dist/lab-runs/tests/write-playback-steps.test.js`,
  `dist/lab-runs/playback-step/tests/{cleared-layers,list-read}.test.js`,
  `dist/flow-lane/tests/state-routing-attempt.test.js`,
  `dist/run-scenario/tests/playback-skips-wiring.test.js` and
  `dist/flow-lane/repair/tests/replay-repair.test.js`:
  `# tests 42`, `# pass 42`, `# fail 0`.
- `pnpm structure:check`: `structure-audit: passed (198 warning(s), 639 baselined)`.
  The 418-line warning on `write-playback-steps.ts` is gone, and nothing is
  reported for `playback-step/` or `state-routing-attempt.ts`.

### Not verified

- Core t661's actual field name and values. The reader assumes the name
  `noMatchCause` at the top level of the run detail's `stateRouting`. If t661
  names it differently, the record is rejected whole by the strict key check.
  Allowing only listed keys is how the record was already parsed, and I kept
  it.
- The other consumers of persisted `stateRouting` (recovery-matrix reads the
  run detail separately) were not run. Their suites are outside the touched
  tests.
- No live run.

### Open questions

- Strict keys are the reason a new Core field silently drops the whole routing
  record. This is the same failure class as the `refused` bug. One option is to
  ignore unknown keys instead of rejecting the record: the parse copies only
  known fields, so page text still could not get through. I did not change this
  because the existing tests assert rejection on purpose.

## Round 3

### Outcome

Done. A routing record with keys the reader does not know is now kept, with
only its known fields copied.

### What changed and why

- `packages/test-runner/src/flow-lane/state-routing-attempt.ts`: each outcome
  now reads only the fields in its shape.
  - Any other key is ignored and never copied. This covers a key a newer Core
    adds and a known key on an outcome that does not take it, such as `code` on
    `routed`.
  - A field that is read must be in its shape, or the record is rejected:
    the code shape, the node-id shape, the closed-word `noMatchCause`, and
    `refused` as a list whose entries have a known guard and a node id.
  - Required fields (`toNodeId` on `guard_stopped`) are still required.
  - An extra key inside a `refused` entry is ignored.
  - This fixes the class of bug: a new Core field no longer drops the whole
    record from `flow-lane.json` and `steps/`.
- `flow-lane/tests/state-routing-attempt.test.ts`:
  - The rejection test keeps only malformed known fields.
  - A new test covers unknown and outcome-foreign keys (`reason`,
    `candidates`, `code` on `routed`, `toNodeId` on `effect_holds` and
    `no_match`). Each record is kept without that key, and no "Sold out"
    text is copied.
  - The refused/cause test now checks that an entry's extra `why` key, and a
    cause on `routed` or `guard_stopped`, are ignored.
  - New test: a record whose cause is under another name (`matchCause`) and
    which has a future object field is kept, with code and refused intact and
    none of the unknown names or values copied.
- `docs/architecture/testing-facility.md`: the state-routing paragraph now
  says that unknown keys are ignored and that malformed read fields still
  reject the record.

### Commands run and observed results

- `pnpm run check` (test-runner): tsc finished with no errors.
- `pnpm run build` (test-runner): built, 2052 files.
- `node --test` on `dist/flow-lane/tests/state-routing-attempt.test.js`,
  `dist/lab-runs/tests/write-playback-steps.test.js`,
  `dist/run-scenario/tests/playback-skips-wiring.test.js` and
  `dist/flow-lane/repair/tests/replay-repair.test.js`:
  `# tests 40`, `# pass 40`, `# fail 0`.
- `pnpm structure:check`: `structure-audit: passed (198 warning(s), 639 baselined)`.
  Nothing is reported for `state-routing-attempt.ts`.

### Not verified

- Core t661's actual field name and placement. If it is not `noMatchCause`,
  the cause is not written, but the record is now kept.
- The recovery-matrix reader of `stateRouting` (`recovery-matrix/records/attempt-records.ts`)
  is separate and was not run or changed.
