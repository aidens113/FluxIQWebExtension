# Report: g-flow-lane-followups

Worker `g-flow-lane-followups`. The brief had three items:

1. **D4.** Fail a run when Core kept fewer actions than the extension recorded.
2. **One Flow read.** The Flow lane read the approved Flow twice; make it once.
3. **Packet size.** Carry the size and truncation flag of each sanitized
   evidence packet into the run bundle.

All work is in `packages/test-runner`. No extension, domain, Core,
`run-scenario.ts`, `recording-discards.ts` or `bench/` file was touched.

## Outcome

**Partial: items 2 and 3 are done and proven; D4 stops at a design, as the
brief allows.**

- **Item 2: done.** The lane now reads the approved Flow's nodes once, and both
  the action-type map and the secret requests are derived from that one read.
  Every existing action-type and secret-request test row is unchanged and
  green. A new row pins the single read, with a mutation proof.
- **Item 3: done.** First I confirmed from Core's source that the run detail
  serves each web attempt's `stateRefs` with its `summary`. That summary is the
  sanitized packet. Each action attempt now carries `evidencePackets`: one entry
  per packet, holding the capture point, the UTF-8 byte size and the `truncated`
  flag. The same entries go into `snapshots/flow-lane.json`. No packet content
  travels. Two unit rows and two mutation proofs cover this.
- **D4: design only, and the precondition is only half true.**
  - Core's recording summary carries `actionCount` only through the **paged**
    form of `list-recordings`.
  - The form the lane uses today returns no `actionCount`.
  - The extension's raw event tally exists only inside `run-scenario.ts`, and
    never reaches the lane.
  - The design below names the exact lines to change.

## What changed and why

### Item 2: one read of the approved Flow

**Before.** `readFlowActionTypes` (`flow-action-types.ts`) and
`readFlowSecretRequests` (`declared-secrets.ts`) each did their own walk. Each
walk made `get-flow` on the parent, `list-flow-subflows`, and `get-flow` on
every Subflow graph. The lane called both, so it made every call twice.

**Now.**

- `flow-action-types.ts` gains:
  - `readFlowNodes(control, input, bounds)`, the single walk. It returns
    `FlowNodeRecord[]` (`{ id, parameterValues }`). Order is unchanged: parent
    first, then graphs in listing order, and a graph pointing back at the parent
    is skipped. It keeps the strict `recording.contract` checks the action-type
    walk had.
  - `flowActionTypes(nodes, flowId)`, the pure map. It still throws
    `recording.contract` when no node dispatches an output.
  - `readFlowActionTypes` stays, as `flowActionTypes(await readFlowNodes(...))`.
    `existing-flow-run.ts:105` still calls it, and its test rows are unchanged.
- `declared-secrets.ts` gains `flowSecretRequests(nodes)`, the pure request
  reader. `readFlowSecretRequests` stays as a thin wrapper over one read, so its
  test row is unchanged. The duplicate private walk (`flowNodeSecretRequests`,
  `graphFlowIds`) is deleted.
- `run-flow-lane.ts` calls `readFlowNodes` once, then
  `flowActionTypes(nodes, …)` and `flowSecretRequests(nodes)`.

**Behaviour.**

- **The lane:** unchanged. The same calls happen in the same order, just not
  twice. The same errors are raised: the action-type map is still derived first,
  so an empty Flow still fails `recording.contract` before any secret pairing.
- **Standalone `readFlowSecretRequests`:** one small difference. On a
  non-object `get-flow` or `list-flow-subflows` payload it now throws
  `recording.contract`, where before it returned no requests. In the lane the
  action-type read already threw on such a payload first.

**Exported values.** `flow-action-types.ts` goes from 1 to 3 and
`declared-secrets.ts` from 6 to 7. The advisory limit is 8 and the hard limit
15. The audit reports nothing on either file.

### Item 3: evidence packet sizes

**What I confirmed in Core first (source reading only).** The sanitized packet
here is the state-snapshot summary. It is served like this:

1. The domain builds it: `domain/src/runtime/host-runtime.ts:94-97`.
   - It is a `sanitizeWebLlmSnapshot(...)` result.
   - It carries `truncated: boolean` (`llm-evidence/sanitize.ts:32-39`).
2. Core stores it on the attempt at `stateRefs.beforeAction.summary` and
   `stateRefs.afterAction.summary`:
   - `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\executor\contracts.ts:130-134`
   - `runtime/host-runtime.ts:14-19`
3. The run-detail conversion copies `stateRefs` whole into
   `metadata.stateRefs`: `runtime/service/summaries/conversions.ts:168`.
4. The typed stream store keeps the attempt whole:
   - It stores each attempt record whole as an `action_attempt` payload
     (`storage/project/runtime-stream-store.ts:460`).
   - It reads it back whole (`:480-500`), with payloads included by default
     (`:217-220`).
5. `getFlowRunDetail` (`runtime/service.ts:3847-3850`) does not ask to leave
   collections out.

**Where it lands.** `persisted-flow-run.ts`:

- New type `PersistedEvidencePacket`:
  `{ point: "beforeAction" | "afterAction"; bytes: number; truncated: boolean }`.
- `PersistedFlowAction.evidencePackets?` is set only when at least one packet
  was measured.
- `evidencePacketsOf(attempt)` reads `metadata.stateRefs.<point>.summary`.
  - A summary without a boolean `truncated` is not a packet the domain writes,
    so it is left unmeasured. It is never counted as untrimmed.
  - `bytes` is the UTF-8 length of the summary's JSON: the formula of the
    domain's `serializedBytes` (`domain/src/runtime/llm-evidence/limits.ts:43-45`).
  - That function is not exported on the domain's public surface
    (`llm-evidence/index.ts:10` exports only the bounds and budgets), so the
    same one-line formula is private to this file.

`run-flow-lane.ts`: `flowLaneSnapshot` puts `evidencePackets` on each action in
`snapshots/flow-lane.json` when present, and its doc comment says so.
`run.json` and the observation are unchanged.

**How the bench's consumer can use it.** This matches `RunEvidenceSizes`
(`packages/test-contracts/src/evaluation.ts:34`):

- `sanitizedPacketBytes` = every action's `evidencePackets[].bytes`.
- `truncationCount` = the number of those packets with `truncated: true`.
- `rawSnapshotBytes` still needs the extension-side producer that
  `g-bench-coverage` described.

### Tests added (4 rows)

`flow-lane/tests/persisted-flow-run.test.ts`:

- **Packets travel as sizes and flags, never as content.** Before and after
  packets travel with their exact UTF-8 byte size and flag.
  - The before title is non-ASCII, so bytes differ from characters, and the
    test asserts that difference.
  - The serialized outcome contains none of: the title, the URL, the selector,
    the label, the snapshot ids, `stateRef` or `stateDiff`.
- **No packet, or not a packet.** An attempt with no `stateRefs` carries no
  `evidencePackets` key. So does each of these:
  - a ref without a summary;
  - a summary without the flag;
  - a string flag;
  - an array summary;
  - an array `stateRefs`.

  When a valid packet sits beside an invalid one, only the valid one is
  measured.

`flow-lane/tests/run-flow-lane.test.ts`:

- The fake Core now records `flowReads`. The header comment says so, and
  existing rows do not read it.
- **The approved Flow is read once.** On auth-gate's shape, the reads are
  exactly `get-flow:flow.new`, `list-flow-subflows:flow.new`,
  `get-flow:flow.graph`, and the run still starts with the value under
  `web.secret.password`.
- **Packet sizes reach the snapshot through the lane.** The packet reaches
  `flowLaneSnapshot`'s actions as `{ point, bytes, truncated }`, and neither
  the title, the selector nor the snapshot id is in the snapshot.

### D4: why it stops, and the design

**Is `actionCount` on Core's recording summary? Only on the paged read.**

- **The lane's read carries none.** `list-recordings` with `summaries: true`
  and no `limit` or `offset` is what `finalized-recording.ts:144` sends. It goes
  like this:
  1. The handler (`api/handlers/workspace.ts:27`) calls
     `listRecordingSessionSummaries`.
  2. That builds from the recording index (`runtime/service.ts:855-873`).
  3. The index item holds only `eventCount` and `noteCount`
     (`runtime/service/indexes/types.ts:78`).
  4. `summaryRecordingSession` (`service.ts:5736-5750`) adds nothing else.
- **The paged read carries it.** Adding `limit` or `offset` switches the
  handler (`workspace.ts:24-25`) to `listRecordingSessionSummaryPage`
  (`service.ts:876-885`). That serves the typed store's rows
  (`runtime-stream-store.ts:314-323`), where `recordingFromRow` (`:578-579`)
  writes `metadata.actionCount: row.action_count`.
- **How Core computes and refreshes it.**
  - The row is `recording.timeline.filter(recordingEventIsActionLike).length`
    (`:574-575`, predicate `:608`).
  - It is rewritten with the full timeline on every append
    (`service.ts:1025` → `:5186-5197`).
  - It is rewritten again at finalization (`service.ts:1022-1023` → `:5407-5411`
    → `putRecording`, `:303-304`).
  - If the typed store holds no rows, the paged read falls back to the index and
    again has no `actionCount` (`service.ts:885-902`).
- **Not usable: the `actionCount` at `service.ts:1538`.** It belongs to
  `getProjectWorkspaceSummary`. It counts an index-built summary whose timeline
  is empty, so it reads 0.

**What Core's count includes: more than operator actions.**

- `recordingEventIsActionLike` counts every `type: "action"` entry, every
  `type: "domain_event"` entry, and any entry with an `actionType` or
  `eventType`.
- The bridge writes:
  - `action` for an executable input with an output binding
    (`runtime/io-bridge.ts:31-49`);
  - `observation`, not counted, for any other registered input (`:53-63`);
  - `domain_event` for an event with no registered input
    (`client-gateway/bridge.ts:363-379`);
  - `action` for a Core-dispatched command's result during a recording
    (`bridge.ts:667-690`).
- So Core's count can be higher than the extension's executable count. The
  comparison must be one-sided (fail only when Core is short). An unrelated
  extra entry can hide one lost action.

**Why the lane cannot compare.**

- **The tally is local to `run-scenario.ts`.** `readExtensionRecordingLog` is
  called only at `run-scenario.ts:279`, inside `assertRecordedEvents`.
- **`assertRecordedEvents` loses it:**
  - it returns without reading anything when the workflow expects no events
    (`recorded-events.ts:26`);
  - it returns counts collapsed by type with the `evidence:` prefix stripped
    (`recorded-events.ts:31-34`, `:45`).
- **The lane never receives it.** `FlowLaneInput` (`run-flow-lane.ts:15-48`)
  has no tally, and `run-scenario.ts:297-331` passes only `recordingEvents`.

**Design, in dependency order.**

1. **`flow-lane/finalized-recording.ts`: add Core's count.**
   - Leave the wait's own poll (`:143-153`) unchanged. It is the
     `L-dropped-action` fix, and it deliberately reads the index that is
     rewritten on every append.
   - Once the wait accepts, make one paged read:
     `list-recordings { projectId, summaries: true, limit: 100, offset: 0 }`.
     Rows are sorted by start time, newest first, so the run's recording is on
     page 1.
   - Return `coreActionCount: number | null` on `FinalizedRecording`. It is
     `null` when the typed store served nothing or the recording is not on the
     page, never a default 0.
   - Test: count read and null fallback.
2. **`run-expectations/recorded-events.ts`: a pure comparison.**
   - Signature:
     `assertCoreKeptExecutableEvents({ recordingId, extensionRecorded, coreActionCount })`.
   - The extension's executable count is the sum of tally entries whose key
     has no `evidence:` prefix.
   - A `null` Core count is recorded as not compared and never fails.
   - `coreActionCount < executable` throws `RunnerFailure("recording.persistence")`.
     Its details hold `recordingId`, `extensionExecutable`, `coreActionCount`
     and the raw `extensionRecorded` tally: kinds and counts only.
   - Tests:
     - equal counts pass;
     - Core short fails;
     - an evidence-only extra does not fail;
     - null is not compared.
   - Mutation: count the collapsed tally, evidence included. The
     evidence-only row must fail.
3. **`run-scenario.ts`: the wiring.** It is owned by `g-redaction-wiring` now,
   so this step is serial after it. Line numbers are at the tree I read, and
   that worker's D3 edit lands in the same region.
   - Near `:92`, declare `let extensionRecorded: Record<string, number> | undefined;`.
   - **The line to pass: `:279`.** Right after `assertRecordedEvents`, while
     still recording, read the raw tally unconditionally:
     `extensionRecorded = await readExtensionRecordingLog(message => runtimeMessage(extensionControl, message));`.
     An alternative is to have `assertRecordedEvents` hand its last tally to a
     sink.
   - After `:287` (`const outcome = await assertCoreRoundTrip(...)`) and before
     the `runtime.settle` event at `:289`:
     - when `outcome.finalized.length === 1` and `extensionRecorded` is set, call
       the comparison with `outcome.finalized[0].coreActionCount`;
     - add `extensionExecutable` and `coreActionCount` to the `:289` details.
   - This sits before `if (options.flow)` (`:290`), so it guards both lanes. A
     Flow is then never proposed from a recording Core kept short.

## Commands run and observed results

Every command was run one at a time from Git Bash in `packages/test-runner`, or
the repository root for the audit. Output went to scratch files and exit
status came from `$?`, never through a pipe.
`EXTENSION_TEST_BUILD_LABEL=g-flow-lane-followups` was set on the first compile.
No extension or domain tests ran, so no domain label was needed.

**Pre-edit hashes.** The owned files matched the hashes the previous workers
reported:

- `persisted-flow-run.ts`: `89eebeca…2b2f4`
- `run-flow-lane.ts`: `e7a33749…35530`
- `declared-secrets.ts`: `bb88f20c…25bf7b`

So nobody else had touched them.

| # | Command | Observed |
| --- | --- | --- |
| 1 | `pnpm exec tsc -p tsconfig.json --outDir dist-g-flow-lane-followups` (after edits) | `tsc exit=0`, no output |
| 2 | `node --test dist-g-flow-lane-followups/flow-lane/tests/*.test.js dist-g-flow-lane-followups/run-expectations/tests/recorded-events.test.js` | exit 1; `# tests 69`, `# pass 68`, `# fail 1`. The failure: `not ok 43 - a discard against another recording is not this run's loss` at `flow-lane/tests/recording-discards.test.js:34`, `g-redaction-wiring`'s untracked file. Every row of mine and every existing action-type and secret-request row was `ok`. |
| 3 | `node scripts/structure-audit.mjs` | exit 1; the only non-warning line was `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks.`, then `structure-audit: 1 violation(s) across 1 rule(s).` No finding names any file I own. |
| 4 | Recompile (exit 0), then `node --test …/recording-discards.test.js` alone | exit 1; `# tests 5`, `# pass 3`, `# fail 2` (`not ok 1`, `not ok 4`). These are **different** failures from run 2, so the file was changing under a parallel edit. No file of mine imports it (grep: only its own test and `flow-lane/index.ts`). |
| 5 | `node --test "dist-g-flow-lane-followups/**/*.test.js"` (first full run) | exit 1; `# tests 483`, `# pass 479`, `# fail 4`. The locations were `recording-discards.test.js:17` and `:50`, `redaction-attestation/tests/attest-run-redaction.test.js:79`, and `run-manifest/tests/create-run-manifest.test.js:50`. All four are `g-redaction-wiring`'s files, mid-edit. |
| 6 | Final: `sha256sum -c`, `tsc`, full suite | hash check `OK` for both files, exit 0; `tsc exit=0`; `full suite exit=0`, `# tests 483`, `# pass 483`, `# fail 0`, `# cancelled 0`. Among the `ok` rows: 67, 77-80 (the existing secret-request and action-type rows), 97-98 and 120-121 (mine), and 118-119 (the W18 lane rows). |
| 7 | `node scripts/structure-audit.mjs` (final) | exit 1, with the same single `FAIL [working-docs] docs/working/README.md …`, and no finding on any file I own |
| 8 | `rm -rf dist-g-flow-lane-followups` | confirmed absent, and not in `git status` |

**Line counts after the change:**

| File | Lines |
| --- | --- |
| `persisted-flow-run.ts` | 255 |
| `flow-action-types.ts` | 89 |
| `declared-secrets.ts` | 203 |
| `run-flow-lane.ts` | 162 |
| `tests/persisted-flow-run.test.ts` | 165 |
| `tests/run-flow-lane.test.ts` | 321 |

All are under the 400-line advisory. `git diff --stat` shows 6 files,
205 insertions and 61 deletions.

### Mutation proofs

Hashes were recorded before mutating:

- `persisted-flow-run.ts`: `43cf68e0…deef82f7`
- `run-flow-lane.ts`: `14869fa1…88d42064`

Each run was `tsc --outDir dist-g-flow-lane-followups` (exit 0), then
`node --test` on the compiled `persisted-flow-run.test.js` and
`run-flow-lane.test.js`. Mutations in one run were in different files and broke
disjoint rows.

**Run A.** `# tests 20`, `# pass 16`, `# fail 4`.

- **M1 (item 3, the reader).** `evidencePacketsOf(attempt)` became
  `evidencePacketsOf({})`.
  - `not ok 9 - each packet Core captured around an attempt travels as its UTF-8 size and truncation flag, never as content`: `+ undefined - [ { bytes: 207, …`
  - `not ok 10 - an attempt with no packet, or a summary that is not one, carries no evidence packets`: `+ undefined - [ { bytes: 19, …`
  - `not ok 20 - each action's evidence packet sizes reach the flow-lane snapshot, …`: `- evidencePackets: [`
- **M3 (item 2, one read).** `requests: flowSecretRequests(nodes)` became
  `flowSecretRequests(await readFlowNodes(input.control, …))`.
  - `not ok 19 - the approved Flow is read once for its action types and its requests for values supplied at run time`: the actual list had an extra `+ 'get-flow:flow.new'`, `+ 'list-flow-subflows:flow.new'`, `+ 'get-flow:flow.graph'`.
- **Restored.** `sha256sum -c` printed `OK` for both files, exit 0.

**Run B.** `# tests 20`, `# pass 18`, `# fail 2`.

- **M4 (item 3, byte measure).** `serializedBytes` returned
  `JSON.stringify(value).length`.
  - `not ok 9 …`: `+ bytes: 203, - bytes: 207,`
- **M2 (item 3, snapshot).** Removed the `evidencePackets` line from
  `flowLaneSnapshot`.
  - `not ok 20 …`: `- evidencePackets: [ - { - bytes: 138,`
- **Restored.** `sha256sum -c` printed `OK` for both files, exit 0 (row 6
  above).

No failure had the uniform or impossible shape of the RAM fault. The only
reruns were of the other worker's file (row 4).

## Not verified

- **No Lab run.** None is allowed in this dispatch. What a Lab run must show:
  - **Item 3.** Run `FLUXIQ_TEST_ENV_FILES=none pnpm lab run basic-form --flow --target isolated`.
    - Every web action in `snapshots/flow-lane.json` that Core captured
      snapshots for carries `evidencePackets`: a `beforeAction` and an
      `afterAction` entry, each with a positive integer `bytes` and a boolean
      `truncated`.
    - The file holds no page text: no titles, selectors, labels or snapshot
      ids.
    - No `bytes` value exceeds the domain's configured packet byte budget
      (`WEB_LLM_EVIDENCE_BYTE_BUDGETS`).
    - An action with no packets is expected only where the client answered
      without a snapshot (`domain/src/runtime/host-runtime.ts:91-93`).
  - **Items 2 and 3 on the secret path.** Run
    `… pnpm lab run auth-gate --flow --target isolated` with
    `FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD` set.
    - There is no `fixture.invalid` pairing failure, so the single read still
      yields the password request, and the Flow passes as W18 did.
    - `evidencePackets` appear.
    - The supplied value is nowhere in the bundle.
- **Packet sizes after Core's trace withholding.** On a run that resolved
  supplied values, withholding (`executor/trace-withholding.ts:60`, `:146-170`)
  can rewrite a string under a `metadata` data key. `bytes` would then be the
  size of the stored, withheld summary, which can differ slightly from the
  domain's own pre-send measure. Not exercised.
- **Core serving `stateRefs.summary`: source reading only.** The unit tests use
  a fake Core. Whether the Lab's isolated Core has the typed stream store
  enabled, and so which run-detail path serves the record, was not checked.
  Both paths keep `metadata` whole by my reading.
- **D4 is not implemented.** Its design rests on source reading of Core.
  - That the typed store is active in the Lab's isolated Core is not
    established. If it is not, the paged read falls back to the index and
    `coreActionCount` would be `null`.
  - That the paged row's `action_count` is current at finalization rests on
    reading `service.ts:1022-1025` and `:5186-5197`.
- **The package scripts were not run.** `pnpm check` and `pnpm test` in
  `packages/test-runner` both start with `pnpm domain:dist`, which rebuilds the
  shared `domain/dist` other workers use. I ran the equivalent `tsc` into a
  private `--outDir` and `node --test` over the whole suite instead. The
  test-runner compiled against the existing `domain/dist`. Root `pnpm check`,
  `pnpm test` and `pnpm build` were not run.
- **No extension or content-harness test.** No extension code changed.
- **Standalone `readFlowSecretRequests` strictness.** The new throw on a
  malformed payload is covered by reading only; no test sends a non-object
  payload to it.

## Open questions or contradictions found

1. **D4's ownership was drawn around the files, not around the change.** The
   extension's tally exists only in `run-scenario.ts` (`:279`), so a real D4
   needs these three files in one brief, after `g-redaction-wiring` lands:
   `run-scenario.ts`, `flow-lane/finalized-recording.ts` and
   `run-expectations/recorded-events.ts`.
2. **D4's comparison can hide a loss.** Core's `actionCount` counts
   `domain_event` entries and Core-dispatched action results as well as
   operator actions. An extra of either kind hides one lost action. Two
   options:
   - accept that, and publish both counts in the settle details so it is
     visible;
   - make one full, unsummarized `list-recordings` read after finalization and
     count only `type: "action"` entries with `origin: "operator"`
     (`io-bridge.ts:43`). That hydrates the timeline once, not per poll.

   A Core summary field for operator actions would be cleaner, but it is a
   Core change and needs the user alert.
3. **`readFlowSecretRequests` now has no production caller.** Only its own test
   row uses it. I kept it because the brief required that row unchanged. The
   supervisor may prefer to delete it and move the row onto
   `flowSecretRequests`.
4. **The audit's one violation is not mine.** It is
   `FAIL [working-docs] docs/working/README.md is out of date`. The fix is the
   supervisor's regeneration, which workers may not run.
5. **No structure-baseline entry should change.** None of my files is
   baselined, and none has a finding.
6. **Documentation.** `snapshots/flow-lane.json` actions gain
   `evidencePackets`. I did not search `docs/architecture/` for a description of
   that file's fields, since it is outside my brief. If one exists, it needs a
   line.
7. **What the bench's evidence size measures.** It is the state-snapshot
   packet only. The failure packet (`metadata.failureEvidence`) is still not in
   Core's run detail (`g-bench-coverage` item 3), so the bench's
   `FLOW_LANE_SOURCES.evidenceSizes` text should name the state-snapshot summary
   as its source.
