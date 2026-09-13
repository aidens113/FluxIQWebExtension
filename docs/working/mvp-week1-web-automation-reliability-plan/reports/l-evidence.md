# l-evidence — criterion 2's Lab proofs: the 16 evidence items and `sensitive-input`'s leak check

Worker `l-evidence` (Lab owner), 2026-09-13. Pins: this repository `d639415`, Core
`3cb8976` (`fluxiq` 0.4.0, built read-only in `F:\fxlab\!FluxIQ`). Worktree
`F:\fxlab\fxlab-16ff729`. Bundles are under `F:\fxlab-runs\evidence\a\`, and the kept
Core workspaces are under `F:\fxlab-runs\evidence\keep-a\`. Scratch files are named
`l-evidence-*` in the session scratchpad. Every figure below comes from one campaign
of six runs, run under concurrent load from the three `l-stage3` workers. Each figure
is therefore a single observation.

## Outcome

**Done**, including the supervisor's amendment to Run 2.

1. **`sensitive-input` leaked nothing: 0 on both lanes, in 6 of 6 runs.** Three
   Flow-lane runs and three recording-lane runs all passed.
   - **Runner's attestation:** every run's redaction attestation reported `passed`,
     with `literalCount` 2, `findingCount` 0 and 0 advisories.
   - **My own search:** it found 0 copies of either declared literal in every bundle
     and in every kept Core workspace. It also found 0 copies of the three values the
     page pre-fills into its sensitive controls. SQLite databases were read cell by
     cell, and none was unreadable.
   - **No stop:** no count was above 0, so the campaign was not stopped.
2. **No sanitized evidence packet exists in any of the three passing Flow-lane runs.**
   This is as the supervisor expected.
   - **Bundle:** no action in `snapshots/flow-lane.json` carries `evidencePackets`.
     In `evaluation.json`, `evidence.sanitizedPacketBytes` has 0 entries and
     `truncationCount` is 0.
   - **Core's workspace:** every kept workspace holds 0 bytes of `stateRefs`,
     `beforeAction`, `afterAction` and `web-llm-evidence.v1`.
   - **Core's stored trace:** its 3 attempts are all `builtin.policy.action`. They have
     no `metadata` key and no `stateRefs`.
   - **Consequence:** criterion 2's "packet ≤ budget with `truncated` visible" cannot
     be observed in the Lab at these pins.
3. **The 16 items are readable by key from two other Lab sources.** Both come from
   Flow run 1:
   - the page snapshots Core stored with each action's result;
   - the recording's state objects.

   12 items are present and 4 are absent. Dialogs, repeating structures and blocking
   overlays are absent because the fixture page has none of them. Expected-state
   evidence is absent because this Flow has no assert action.

   A packet derived offline from those stored snapshots is 1,690 to 1,733 bytes
   against the 6,000-byte budget, and its `truncated` key is present and false.
   **This is derived, not a Lab observation.**
4. **The fixture assertions are named in Run 3.** They ran inside the root gate's
   totals at `f840b75`. I infer that from each suite's file selection and from
   `f840b75..d639415` changing no test source. The gate's per-test lines were not
   seen, and no suite was rerun.

## What changed and why

- **No tracked file changed.** I moved the worktree from `16ff729` to `d639415` with
  `git checkout --detach`, then rebuilt its `domain/dist`,
  `packages/test-contracts/dist` and `apps/scenario-lab/dist`.
  - The worktree porcelain count was 0 before and after; so was Core's.
  - Core was not built, checked out or cleaned. The FluxIQ web panel was not started.
- **Scratch scripts, all named `l-evidence-*`.** None prints a value, a hash or page
  data.
  - `setup.ps1`: the builds.
  - `lab-seq.ps1`: the driver, derived from `l-stage2d-lab-seq.ps1`. It adds
    `sensitive-input`'s two secrets and the memory guard.
  - `keep.mjs` and `mem.ps1`: byte-identical copies of `l-stage2c-keep.mjs` and
    `l-stage2c-mem.ps1` (hash compare `True`).
  - `analyse.mjs`: the bundle reader, derived from `l-stage2d-analyse.mjs`. It adds
    per-action packet sizes and the attestation as counts.
  - `search.mjs`: the workspace search, derived from `l-stage2c-search.mjs` with a
    `sensitive` needle set.
  - `marker-count.mjs`: byte counts of fixed key and schema names.
  - `cell-paths.mjs`: where a marker sits in a SQLite database.
  - `packet-keys.mjs`: any `web-llm-evidence.v1` object, as keys.
  - `sources.mjs`: stored attempts, action-result snapshots and recording state, as
    key shapes, plus the offline sanitize.
- **Why two lanes.**
  - The recording lane, `run sensitive-input --target isolated`, is the command
    `i-lab-campaign` and `l-stage2` used.
  - The Flow lane, `run sensitive-input --flow --target isolated`, needs
    `FLUXIQ_TEST_SECRET_SENSITIVE_INPUT_PASSWORD` and `..._PAYMENT`
    (`g-scenario-secrets.md:236-239`; the run fails closed without them,
    `packages/test-runner/src/flow-lane/declared-secrets.ts:59-63`).
  - The driver sets both from the scenario's own `replace-password` and
    `replace-payment` step values. Those are the literals the attestation scans for
    (`redaction-attestation/scenario-redaction-literals.ts:31-49`), so the values the
    Flow actually typed are exactly the values searched for.
- **Extra needles.** The page pre-fills values into its password, payment and billing
  controls (`apps/scenario-lab/src/scenarios/sensitive-input/scenario.ts:54`). I
  searched for those too, labelled `prefilled:*`. The recorder must withhold them,
  although they are not declared secrets.

## Commands run and observed results

### Setup

- **Before starting:**
  - `FreeGB 6.17 TotalGB 25.85`.
  - The worktree was at `16ff729` with a porcelain count of 0.
  - `git cat-file -t d639415` printed `commit`.
  - `node_modules` was present.
- **No install needed.**
  `git diff --stat 16ff729 d639415 -- pnpm-lock.yaml package.json pnpm-workspace.yaml '**/package.json'`
  printed only `apps/extension/package.json | 2 +-`. That diff is the `test:content`
  script and nothing else, with no dependency change.
- **Checkout:** `git -C F:\fxlab\fxlab-16ff729 checkout --detach d639415` gave
  `exit=0`, `HEAD d6394155efb7eecb1815d1b496a283b26b506bae`, porcelain 0.
  `F:\fxlab\!FluxIQ` was at `3cb8976fb665c89f4909a9f49eb35be611cea0fa` with porcelain 0.
- **`l-evidence-setup-status.txt`:**

```
F:\fxlab\!FluxIQ HEAD=3cb8976fb665c89f4909a9f49eb35be611cea0fa porcelain=0
F:\fxlab\fxlab-16ff729 HEAD=d6394155efb7eecb1815d1b496a283b26b506bae porcelain=0
fluxiq version: 0.4.0
core dist contracts newest 2026-09-13T09:51:44 files=36
core dist fluxiq newest 2026-09-13T09:51:52 files=1976
core dist client-gateway-websocket newest 2026-09-13T09:51:54 files=20
build wt @fluxiq-web-extension/domain exit=0 seconds=5.5 freeGBBefore=7.52
build wt @fluxiq-web-extension/test-contracts exit=0 seconds=4.2 freeGBBefore=7.36
build wt @fluxiq-web-extension/scenario-lab exit=0 seconds=3.2 freeGBBefore=7.48
wt dist domain\dist newest 2026-09-13T10:50:03 files=274
wt dist packages\test-contracts\dist newest 2026-09-13T10:50:07 files=36
wt dist apps\scenario-lab\dist newest 2026-09-13T10:50:10 files=166
wt porcelain=0
core porcelain=0
```

- **Pin proof.** `node --experimental-import-meta-resolve l-stage2-pin-proof.mjs F:\fxlab\fxlab-16ff729`
  printed:
  - `exit=0`;
  - nine probes `pinned=true` into `F:\fxlab\!FluxIQ\packages\...\dist`;
  - `import(fluxiq/automation-studio) from packages/test-runner: ... exports=385`;
  - `runner Core root (cli.ts:21 default): F:\fxlab\!FluxIQ -> real F:\fxlab\!FluxIQ`;
  - `unpinned=0`.
- **End of campaign:** the worktree was at `d6394155…` with porcelain 0, and Core at
  `3cb8976f…` with porcelain 0.

### How the runs ran

- **Driver.** `l-evidence-lab-seq.ps1` ran plan `l-evidence-plan-1.txt`:
  `si-flow|3|run sensitive-input --flow --target isolated|si|1` and
  `si-rec|3|run sensitive-input --target isolated|0|1`.
  - Each run was `pnpm -C F:\fxlab\fxlab-16ff729 lab <args> *> <log>`, with the exit
    status taken from `$LASTEXITCODE`.
  - A `CreateNew` lock refused any second start.
- **Environment on every Lab command:**
  - `FLUXIQ_TEST_ENV_FILES=none`;
  - `FLUXIQ_LAB_INSTANCE` and `EXTENSION_TEST_BUILD_LABEL` both set to `l-evidence-a`;
  - `FLUXIQ_TEST_RUNS_DIR=F:\fxlab-runs\evidence\a`;
  - `FLUXIQ_CORE_ROOT` unset.
  - The two `FLUXIQ_TEST_SECRET_SENSITIVE_INPUT_*` variables were set only for the
    Flow-lane runs and removed after each one.
- **Memory guard.** Before each Lab command the driver read free memory, and would
  have waited in 2-minute `node -e "setTimeout(()=>{},120000)"` steps while it was
  under 3 GB. It never waited.
- **Keeper.** Each run's Core workspace was kept by the unchanged `l-stage2c` keeper,
  and each keeper stopped with reason `core-stopped-final-sweep`.

Status lines (`l-evidence-l-evidence-a-status.txt`, start and end times dropped):

```
name=si-flow index=1 seconds=118.9 exit=0 otherLabsBefore=4 freeGBBefore=10.07 lowestFreeGBWhileGuarding=10.07 memoryWaits=0 secretSupplied=True keep=True keeperExited=True keeperExit=0
name=si-flow index=2 seconds=143.4 exit=0 otherLabsBefore=4 freeGBBefore=12.46 lowestFreeGBWhileGuarding=12.46 memoryWaits=0 secretSupplied=True keep=True keeperExited=True keeperExit=0
name=si-flow index=3 seconds=138.7 exit=0 otherLabsBefore=4 freeGBBefore=13.81 lowestFreeGBWhileGuarding=13.81 memoryWaits=0 secretSupplied=True keep=True keeperExited=True keeperExit=0
name=si-rec index=1 seconds=96.5 exit=0 otherLabsBefore=4 freeGBBefore=12.35 lowestFreeGBWhileGuarding=12.35 memoryWaits=0 secretSupplied=False keep=True keeperExited=True keeperExit=0
name=si-rec index=2 seconds=92.6 exit=0 otherLabsBefore=4 freeGBBefore=10.48 lowestFreeGBWhileGuarding=10.48 memoryWaits=0 secretSupplied=False keep=True keeperExited=True keeperExit=0
name=si-rec index=3 seconds=90.4 exit=0 otherLabsBefore=4 freeGBBefore=9.66 lowestFreeGBWhileGuarding=9.66 memoryWaits=0 secretSupplied=False keep=True keeperExited=True keeperExit=0
finished=2026-09-13T11:07:46.3070113-07:00
```

### Run 1 — `sensitive-input` ×3 on each lane, with the run leak attestation

**Common to all six runs** (`l-evidence-analysis-all.txt`):
- `run.json`: `facility=d6394155… dirty=false`, `core=3cb8976f… dirty=false`,
  `path=F:\fxlab\!FluxIQ`, `redactionState=verified`, `automationFailure=null`.
- `evaluation.json`: `verdict`, `oracleVerdict` and `reportedVerdict` were all
  `passed`, and invariant `runner-verdict` passed.
- `runtime.settle` reported `recordedActions={"extension":3,"core":3}` and one
  recording with `entryCount` 10.

**Flow lane, all three runs** (`snapshots/flow-lane.json`):
- `startCandidateIndex=0`, `stoppedWithoutFailedAttempt=null`, `candidateCount=3`,
  `entryCount=10`, `status=succeeded`, `failure=null`, and `flowCreated=true`.
- Actions: `web.dom.type` succeeded/`matched` twice, then `web.dom.click`
  succeeded/`matched`.
- `targetResolution` was `unresolved_no_candidates` on all 3 actions.
- The recording lane has no `flow-lane.json`, and `flowCreated=null`.

**Per run.** "Attestation" is the runner's own `snapshots/redaction-attestation.json`.
"Bundle hits" and "Workspace" come from my searches, the workspace figure over the
kept Core workspace. Every needle count is given as files, then SQLite cells.

| Run | runId | Attestation: status, literals, findings, advisories | Attestation scopes: bundle files/bytes; workspace files/bytes | Bundle: files searched, hits | Kept workspace: files, bytes, SQLite databases, unreadable | `declared:replace-password` / `declared:replace-payment` | `prefilled:password` / `payment` / `billing` | Control needle | Recording discards |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Flow 1 | `run-mu048o43-c5572527` | passed, 2, 0, 0 | 4 / 13,720; 32 / 1,788,723 | 14, 0 | 36, 1,899,643, 3, 0 | 0,0 / 0,0 | 0,0 / 0,0 / 0,0 | 13 files, 5 cells | 0 |
| Flow 2 | `run-mu04bgxv-e42b82e0` | passed, 2, 0, 0 | 4 / 14,064; 32 / 1,788,959 | 14, 0 | 36, 1,871,039, 3, 0 | 0,0 / 0,0 | 0,0 / 0,0 / 0,0 | 14 files, 5 cells | 0 |
| Flow 3 | `run-mu04egfv-c0e958a6` | passed, 2, 0, 0 | 4 / 15,216; 32 / 1,788,965 | 14, 0 | 37, 1,871,557, 3, 0 | 0,0 / 0,0 | 0,0 / 0,0 / 0,0 | 13 files, 5 cells | 1 |
| Recording 1 | `run-mu04hixa-fe17c2a8` | passed, 2, 0, 0 | 3 / 10,747; 21 / 1,397,255 | 13, 0 | 25, 1,520,535, 2, 0 | 0,0 / 0,0 | 0,0 / 0,0 / 0,0 | 11 files, 4 cells | 0 |
| Recording 2 | `run-mu04jh77-e73fc200` | passed, 2, 0, 0 | 3 / 11,278; 21 / 1,397,017 | 13, 0 | 25, 1,545,017, 2, 0 | 0,0 / 0,0 | 0,0 / 0,0 / 0,0 | 10 files, 4 cells | 1 |
| Recording 3 | `run-mu04lf4t-5f5ef0d9` | passed, 2, 0, 0 | 3 / 11,452; 21 / 1,397,308 | 13, 0 | 26, 1,545,820, 2, 0 | 0,0 / 0,0 | 0,0 / 0,0 / 0,0 | 10 files, 4 cells | 1 |

**Search method notes:**
- **Every form was searched.** Each needle was counted in UTF-8 and UTF-16LE bytes
  and in JSON-escaped form, and each SQLite database was read cell by cell.
- **Every value line** read `total needle=... files=0 utf8=0 utf16le=0 sqliteCells=0`.
- **The control needle proves the stores were read.** It is the fixture's own path.
  In Flow run 1 its key paths include `global.sqlite` table `automation.state`
  (`$.session.trace.attempts[...]`) and the command-attempt files
  (`$.attempt.result.payload.result.snapshot...`), which is where a value would sit.
- **One read mode failed three times, as a known kept-file artefact.**
  `global.sqlite` opened alone in every run. In Flow 1, Flow 3 and Recording 1, its
  `with-wal` mode printed `ERR_SQLITE_ERROR`. That is the kept `-wal` being a link to
  a log Core already deleted, as `l-stage2c` recorded. No database counted as
  unreadable.
- **Keeper.** Link errors were 1 (`ENOENT`) on Flow 1 and Recording 2, and 0 on the
  other four runs.
- **The recording discards are counts only.** Every run passed, so discard kinds were
  not read.

### Run 2 — the sanitized packet, and the 16 items

**No packet exists in any Lab source I could read.**
- **Bundle, all three Flow runs:** every action printed `packets=[]`, meaning there is
  no `evidencePackets` key. `evaluation.json` gave
  `evidence.sanitizedPacketBytes.count=0 rawSnapshotBytes.count=0 truncationCount=0`,
  and so did all three recording-lane runs.
- **Kept workspaces, all six runs.** `l-evidence-marker-count.mjs` printed
  `totals {"stateRefs":0,"beforeAction":0,"afterAction":0,"web-llm-evidence.v1":0,"web.dom.capture_snapshot":2,"web-state-diff.v1":0,"expectedState":0,"evidencePackets":0}`.
  - In Flow run 1, the two `web.dom.capture_snapshot` bytes sit only at
    `global.sqlite table=automation.state column=data rowid=6`
    `$.recording.actionChannels[0].actionTypes[10]`. That is the recording's list of
    action types, not a capture.
- **Packet-key reader, Flow run 1:** `filesScanned=36 sqliteDatabases=3
  sqliteCellsWithSchema=0 distinctPackets=0`, and `expectedState keys: none`.
- **Core's stored attempts (Flow run 1), as the supervisor asked.** From
  `l-evidence-sources-flow-1.txt`:

```
sqlite .fluxiq\global.sqlite table=automation.state column=data rowid=21 $.session.trace.attempts
  attempts=3 withStateRefs=0 definitionIds={"builtin.policy.action":3}
  attemptKeys={"attemptId":3,"nodeId":3,"definitionId":3,"startedAt":3,"finishedAt":3,"status":3,"route":3,"inputs":3,"outputs":3,"effects":3,"targetResolution":3,"transitionComparison":3,"hostCapabilities":3}
  metadataKeys={}
  stateRefPoints={} summaryKeys={}
```

  The attempt-key listing was read on Flow run 1 only, so it is a single observation.
  The zero `stateRefs` byte count holds on all six runs.

**Where the 16 items can be observed instead** (Flow run 1, `run-mu048o43-c5572527`,
`l-evidence-sources-flow-1.txt`). The plan names "the 16 items" but never lists them.
The list below is the audit's 16-item table (`reports/audit-evidence.md:31-53`), which
`reports/v-criteria.md:199-200` names as the source of "(16 items)".

- **Source A: the action-result page snapshot Core stored.** Three files,
  `.fluxiq\artifacts\runtime\command-attempts\attempt.*\attempt.json`, at
  `attempt.result.payload.result.snapshot`: two `web.dom.type` and one
  `web.dom.click`.
  - The snapshot keys are `url, title, viewport, frame, focusedElement`,
    `interactiveElements` (13 elements) and `evidence`.
  - `evidence` item keys: `["elements","loading","navigation","regions","forms"]`.
  - Raw snapshot sizes: 8,040, 8,094 and 8,070 bytes. The shape was identical across
    the three.
- **Source B: the recording's state objects.** Five files,
  `recordings\<recordingId>\objects\*.json`, each holding 38 `web` state paths:
  - `page.url`, `page.title`, `viewport.bounds`, `scroll.position`, `focus.target`;
  - 17 `evidence.*` paths;
  - `elements.count`, `elements.captured`, `elements.captureTruncated`,
    `elements.stateTruncated`, `elements.truncated`;
  - 11 per-element `elements.<element key>` paths.
- **Source C, DERIVED.** Source A's three snapshots were run offline through the
  worktree's own `domain/dist/runtime/llm-evidence` `sanitizeWebLlmSnapshot`, with no
  options, which is how `domain/src/runtime/host-runtime.ts:94` calls it.
  **This is not a Lab observation.** The packet's keys are in `sanitize.ts:98-120` and
  `elements.ts:33-66`.

| # | Item | Source A key (stored action result) | Source B state path (recording) | In the Lab, run 1 | Packet key that would carry it | Source C, derived packet |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Interactive elements | `interactiveElements` (13 per attempt); `evidence.elements.{scanned,candidates,matched,returned}` | `elements.count`, `elements.captured`, 11 element paths; `evidence.elements.{scanned,candidates,matched,returned}` | present | `elements`, `elementTotal` | `elements` 10; `elementTotal` a number |
| 2 | Visible text | `interactiveElements[].text` and `.visibleText`, 7 of 13 | not broken out by this reader | present | `elements[].text` | 7 of 10 |
| 3 | Forms | `evidence.forms`: 1 form (`selector, controlCount, submit`), 5 `controls` (`selector` 5, `controlType` 5, `label` 5, `name` 4, `hasValue` 4, `autocomplete` 3, `sensitive` 3) | `evidence.forms` | present | `elements[].form`, `elements[].hasValue` | `form` on 0 of 10; `hasValue` on 1 |
| 4 | Current URL | `url` | `page.url`; `evidence.navigation.{origin,path}` | present | `location` | present |
| 5 | Page title | `title` | `page.title` | present | `title` | present |
| 6 | Navigation state | `evidence.navigation`: `url, origin, path, type, historyLength, visibility` | `evidence.navigation.{origin,path,type,historyLength,visibility}` | present | `navigation`, carried only for a visit that is not ordinary (`page-evidence.ts:118`) | absent |
| 7 | Dialogs and modals | `evidence.dialogs` absent | no `evidence.dialogs` path | **absent**: the page has no dialog (`scenario.ts:54`) | `dialogs` | absent |
| 8 | Page regions | `evidence.regions`: 1 region (`role, selector, bounds`) | `evidence.regions` | present | `elements[].landmark` | 10 of 10 |
| 9 | Repeating structures | `evidence.repeating` absent | none | **absent**: the page has no repeating run | `elements[].item` | 0 of 10 |
| 10 | Selected elements | `focusedElement` (11 to 14 keys); no `selectedText`; `selectedValue` on 0 elements | `focus.target` | present (focus); page selection absent | `selectedText`, `elements[].focused`, `elements[].selectedValue` | `focused` on 1 of 10 in the click attempt, 0 in each type attempt; no `selectedText` |
| 11 | Recently interacted | `evidence.elements.recentlyInteracted`; element flag on 1, 2 and 4 elements across the three attempts | `evidence.elements.recentlyInteracted` | present | `elements[].recent` | 0, 0 and 2 |
| 12 | Changed elements | `evidence.elements.changed` (a number); element `changed` flag on 0 elements | `evidence.elements.changed` | present as a count; no element flagged | `elements[].changed` | 0 |
| 13 | Relevant attributes | `interactiveElements[].attributes` on 6 of 13; `accessibleName` 10, `implicitRole` 7, `testId` 5, `inputType` 4, `label` 4 | not broken out by this reader | present | no attribute map by design; derivations `inputType`, `controlType`, `revealKind`, `expanded`, `href` | none on the 10 elements |
| 14 | Loading state | `evidence.loading`: `documentState, busy, busyRegions` (0), `indicators` (0), `pendingNavigation` | `evidence.loading.{documentState,busy,pendingNavigation}` | present | `loading`, carried only while the page is still settling | absent |
| 15 | Blocking overlays | `evidence.overlays` absent | none | **absent**: nothing on the page is covered | `blockedBy` | absent |
| 16 | Expected-state evidence | 0 `expectedState` bytes in every kept workspace | not applicable | **absent**: the Flow is type, type, click, with no `web.dom.assert` | not a packet item | not applicable |

**Truncation keys:**
- Source A: `evidence.elements.truncated` (a boolean).
- Source B: `elements.captureTruncated`, `elements.stateTruncated`,
  `elements.truncated` and `evidence.elements.truncated`.
- Source C: `truncated` present and `false`. `captureTruncated`,
  `elementsTruncated` and `budgetTruncated` are absent.

**Packet bytes against the budget, DERIVED.**
- **Observed sizes:** 1,690 and 1,690 bytes for the two `web.dom.type` attempts, and
  1,733 bytes for `web.dom.click`.
- **Budget:** the default is 6,000 bytes (`domain/src/runtime/llm-evidence/limits.ts:22-26`,
  exploration budget), under the 12,000-byte ceiling.
  `host-runtime.ts:94` names no budget, and `sanitize.ts:125-128` then applies the
  exploration default.
- **Packet top keys:**
  `["schemaVersion","trust","location","title","frame","elementTotal","elements","truncated"]`.

**The two lists do not match one to one.** The brief asks for both lists in that case.
- **The 16 items:** 1 interactive elements, 2 visible text, 3 forms, 4 current URL,
  5 page title, 6 navigation state, 7 dialogs and modals, 8 page regions, 9 repeating
  structures, 10 selected elements, 11 recently interacted, 12 changed elements,
  13 relevant attributes, 14 loading state, 15 blocking overlays, 16 expected-state
  evidence.
- **The packet's key set** (`sanitize.ts:98-120`): `schemaVersion, trust, location,
  title, frame, loading, navigation, dialogs, blockedBy, selectedText, elementTotal,
  elements, truncated, captureTruncated, elementsTruncated, budgetTruncated`.
- **The packet's per-element keys** (`elements.ts:33-66`): `target, tag, selector,
  frameId, role, name, text, inputType, controlType, hasValue, selectedValue, href,
  options, revealKind, expanded, focused, recent, changed, form, landmark, heading,
  item, cell`.
- **The raw page-evidence contract's eight keys** (`docs/architecture/page-evidence.md`,
  "The Items"): `elements, loading, navigation, dialogs, overlays, regions, repeating,
  forms`.

### Run 3 — the fixture assertions (not rerun)

**The tests.**
- **Content harness, 16 items:** `apps/extension/e2e/content/tests/evidence.spec.ts`
  holds **19 tests**. 14 are table rows (`ROWS`, lines 54-238), each titled
  `<scenario>: <item>`:
  - `product-catalog`: element totals and truncation; loading state at rest;
    navigation state; landmarks and regions; repeating structures; forms model groups
    by the owning form; blocking overlays are not reported on a page with none.
  - `intermediate-state`: element totals agree with the element list; repeating
    structures are not invented where nothing repeats; forms model.
  - `infinite-feed`: repeating structures; forms are not invented where the page has
    none.
  - `modal-flows`: blocking overlays; dialogs are not reported before one opens.

  The other 5 are separate tests:
  - `:247` an open modal is reported with its role, name and modality;
  - `:268` the native dialog the page-world override answered is carried as evidence;
  - `:292` a page caught mid-work reports itself busy;
  - `:311` a region the page marks aria-busy is reported while it loads;
  - `:326` change and recency are fields of a running snapshot.

  Items 2, 4, 5, 10, 13 and 16 have no row. Item 10's focus and selection are
  asserted in domain `sanitize.test.ts:68`.
- **Content harness, `sensitive-input` leak:**
  - `redaction.spec.ts` holds 15 tests on `openHarness("sensitive-input")`, lines 77
    to 453. Among them:
    - `:77` "no password value reaches any recorded message, typed or pre-filled";
    - `:130` "a snapshot reports a sensitive field's presence and never its value";
    - `:146` "an action result's evidence describes a sensitive field without its value";
    - `:287` "a sensitive control's post-condition is secret-free after the hop to the
      domain, on both paths it takes";
    - `:453` "a multi-token autocomplete is sensitive by the shared rule, so no path
      carries its value".
  - `selection-redaction.spec.ts` holds 5 tests (`:53`, `:65`, `:83`, `:95`, `:103`).
  - `identity.spec.ts:187` "sensitive-input: value presence is reported, the value is
    not part of identity".
- **Domain unit tests, packet and budget.** In `domain/src/runtime/llm-evidence/tests/`:
  - `page-evidence.test.ts`, 10 tests (`:33` dialogs, `:53` blocking overlay, `:72`
    loading, `:100` navigation, `:124` element total and capture truncated, `:157`
    recency and change flags, among others);
  - `limits.test.ts`, 9 tests. Among them `:56` "reports truncation and the element
    count exactly at the budget boundary", `:78` "names which limit truncated the
    packet, one row per limit", and `:164` "a failure packet passes Core's
    failure-evidence gate whole";
  - `sanitize.test.ts`, 9 tests (`:5` "sanitizes extension snapshots without values,
    sensitive controls, or URL secrets", `:68`, `:100`);
  - `elements.test.ts`, 7 tests (the sensitive-control refusals).

  Also `domain/src/page-evidence/tests/capture.test.ts`, 5 tests, including `:182`
  "no capture carries a form control's value, only whether it holds one".
- **Test-runner, the Lab leak check's own logic:**
  - `src/redaction-attestation/tests/attest-run-redaction.test.ts`, 10 tests;
    `:98` is "a declared literal a workspace's SQLite store holds is a finding, in the
    database or its write-ahead log, in either text encoding";
  - `scenario-redaction-literals.test.ts`, 4 tests.
- **Scenario-lab and test-evidence:**
  - `apps/scenario-lab/src/scenarios/sensitive-input/tests/scenario.test.ts`, 2 tests;
  - `packages/test-evidence/tests/evidence.test.mjs:365` "suppresses sensitive-action
    pixels while retaining redacted before and after events".

**Did they run in the root gate at `f840b75`?** The plan ledger entry "Integration:
root gates pass" quotes the gate's totals:
- the content harness: "222 passed (42.4s)";
- `pnpm test`: domain "# pass 401", test-runner "# tests 562", scenario-lab
  "# tests 204", test-evidence 16, each "# fail 0".

Each named file is inside those totals by its suite's selection:
- `apps/extension/e2e/playwright.content.config.ts:15`: `testDir: "./content/tests"`;
- `domain/scripts/test-domain.mjs:21-31`: every `src/**/tests/*.test.ts`, and the
  compiled copies exist in tracked `domain/.test-build/runtime/llm-evidence/tests/`
  and `page-evidence/tests/`;
- `packages/test-runner/package.json:13`: `node --test "dist/**/*.test.js"`;
- `apps/scenario-lab/package.json:10`: `node --test dist/**/*.test.js`;
- `packages/test-evidence/package.json:16`: `node --test tests/*.test.mjs`;
- the root `package.json:56`: `pnpm -r test`.

`git diff --stat f840b75 d639415` lists only `apps/extension/build/`,
`domain/.test-build/`, three working documents and `i-leftover-sizing.md`. No test or
source file changed, so the tests at my pin are the ones that gate ran.

### Memory under concurrent load

- **Per-run guard:** 10.07, 12.46, 13.81, 12.35, 10.48 and 9.66 GB; `memoryWaits=0`
  on every run.
- **15-second sampler:** `l-evidence-lab-mem.csv` held 46 samples. The minimum free
  memory was **5.98 GB**, and the peak summed Chrome and Node working set was 9.83 GB,
  across every Lab instance on the machine.
- **Ad-hoc reads:** 6.17 GB before setup, 6.64 GB during Flow run 1, and 7.10 GB
  later.
- **Lowest seen: 5.98 GB.** Memory was never under 3 GB.
- **Concurrency:** `otherLabsBefore=4` on every run.

## Not verified

- **A Lab packet's bytes against its budget, and `truncated` in a Lab packet.** No
  packet exists at these pins. The 1,690 to 1,733 bytes are an offline derivation from
  Core's stored snapshots, not a Lab observation.
- **Why Core stores no state refs.** Not chased, per the supervisor's note;
  `i-evidence-packets` owns that.
- **The items this fixture cannot show.** Dialogs, repeating structures, blocking
  overlays and expected-state are absent because `sensitive-input` has none. No Lab
  run on a fixture that has them was made.
- **The source listings for runs other than Flow run 1.** The source-shape and
  16-item listing was read on Flow run 1 only. Flow runs 2 and 3 and the three
  recording-lane workspaces were read for leak counts and marker counts only.
- **The gate's per-test lines at `f840b75`.** The ledger quotes totals, so "ran in
  the gate" is inferred from each suite's selection and the unchanged sources.
- **One raw descriptor carries a `value` key.** It is on 1 of the 13
  `interactiveElements` in each stored action-result snapshot, and I did not check
  which element it is. None of the five sensitive needles appears anywhere in those
  files.
- **Whether the runs were headed or headless.** The single-run default was used and
  the mode was not recorded.
- **Three kept `global.sqlite -wal` files could not be read with their database.**
  This was in Flow 1, Flow 3 and Recording 1. The database itself was read alone, and
  the runner's own attestation read the live store before cleanup.
- **Timing under load.** Every figure is a single observation under concurrent load;
  no failure needed a rerun.

## Open questions or contradictions found

1. **The plan never enumerates "the 16 items".** Its Objective says
   "(16 items)" and Phase 1.4 says "a 16-row table test". The list used here is
   `audit-evidence.md:31-53`. `evidence.spec.ts` has 19 tests covering 10 of those
   items, with no row for items 2, 4, 5, 10, 13 or 16. The criterion's wording and the
   spec do not match one to one.
2. **Criterion 2's packet proof has no Lab source at these pins.** Core's stored trace
   attempts are all `builtin.policy.action`, with no `metadata` and no `stateRefs`.
   While reading the packet budget I saw, and did not chase, that
   `domain/src/runtime/host-runtime.ts:76-78` refuses to capture state for a node whose
   `definitionId` is not a web output node id. That is for `i-evidence-packets` to
   weigh.
3. **The derived packet carries no `form` key** on any of its 10 elements, although
   the page's form holds five controls. `elements.ts:56` fills `form` from the owning
   form's id or name. I did not check whether this fixture's form has either.
4. **Three passing runs reported one recording discard each** (Flow 3, Recording 2,
   Recording 3). None failed, and the kinds were not read.
