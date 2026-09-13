# i-w04-w08-no-proposal: why W04's and W08's Flow rows get no recording Flow proposal

Worker report for `i-w04-w08-no-proposal` in [finish-week1.md](../briefs/finish-week1.md).
Written 2026-09-13. Read-only: no tracked file was edited, and no Lab command, build or test
was run. Code citations are at HEAD `a096c9e` in this repository, and at Core's working tree in
`F:\!FluxIQ`. Bundle figures are keys, kinds, ids and counts only. No recorded page data,
extracted record or secret is quoted.

## Outcome

**Done. The answer is (a).** Neither W04 nor W08 performs an action a recording can hold.
Their scripts only read the page, so the recording has nothing to map and Core correctly
builds no proposal. Nothing was lost in the recorder, the mapper or Core. The four Flow
rows cannot pass on any product, by design of the runner's own guard, so as planned they
block the week1 bench forever. The fault is in how the bench plans lanes, not in the
product. Stage 2's "pass" on these rows was a false pass. The runner fix H2 (`7a6a8e7`)
exposed it: the change `l-stage2d` saw is that fix working, not a regression.

### 1. What each recording holds, and what each script does

**The scripts.**
- **W04** is `product-catalog`'s primary workflow (`packages/test-runner/src/bench/corpus/week1.ts:33`,
  workflow `null`, variant `text-variant`).
  - Its `recordingScript` is two steps: an `extract` with no `pagination`, then a
    `checkpoint` (`apps/scenario-lab/src/scenarios/product-catalog/manifest.ts:36-39`).
  - Its `expected` holds `pageFacts`, `extracted` and `finalState`, and no `recordingEvents`
    or `actions` (`manifest.ts:40-44`).
  - `text-variant` only rewrites the price text on the page (`manifest.ts:45-52`).
- **W08** is `data-table`'s primary workflow (`week1.ts:37`, workflow `null`, variant
  `column-reorder`).
  - Its `recordingScript` is one step, an `extract` with no `pagination`
    (`apps/scenario-lab/src/scenarios/data-table/scenario.ts:29-31`).
  - Its `expected` holds `extracted` and `finalState` only (`scenario.ts:32-38`).
  - `column-reorder` only reorders the columns (`scenario.ts:39-44`).
- **Neither scenario declares a `playbackGoal`:** a grep over both directories counted 0.

**Neither script acts.**
- An `extract` step with no `pagination` "reads the current page and never clicks"
  (`packages/test-runner/src/scenario-steps/extract-records.ts:46-47`). The click loop
  returns at once when `pagination` is absent (`extract-records.ts:61-67`).
- The shared table of what a recording of each step can yield has `extract: []` and
  `checkpoint: []`. Only a paginated `extract` yields a click
  (`packages/test-contracts/src/recordable-actions.ts:22-26`, `:48`, `:55`, `:68`).
- W05, the same fixture's paginated workflow, does click: it uses `pagination: followNext`
  (`manifest.ts:16`, `:58`).

**Every other week1 recorded workflow acts.** Its script has at least one click, type,
press, check, select, scroll, navigate, upload or tab step. Scanned over each scenario's
`manifest.ts` or `scenario.ts`:
- `basic-form` 19-22; `keyboard-forms` 16-19 and 46-50; `navigation` 33, 35;
  `infinite-feed` 36-40;
- `modal-flows` 22-25, 42-43 and 63-64; `multi-tab` 22-23, 32, 34;
- `file-transfer` 19 and 38-39; `auth-gate` 44-46; `identity-drift` 56-57;
- `intermediate-state` 33-35; `delayed-ui` 39, 41; `ambiguous-targets` 19;
- `failure-surfaces` `manifest.ts:41`; `iframe-checkout` 17-18.

**So W04 and W08 are the only week1 rows whose recorded workflow has no recordable step.**

**The recordings: the Flow-lane bundles.**
- **The bundles:**
  - stopped bench `F:\fxlab-runs\stage2d\d\` (facility `d639415`, Core `3cb8976`, both
    `dirty=false` in `run.json`): W04 unarmed `run-mu033kjx-90cb32e0`, W04 `text-variant`
    `run-mu0348yo-078957da`, W08 unarmed `run-mu03cicr-879ef3f0`, W08 `column-reorder`
    `run-mu03d9wv-9550e2b6`;
  - `l-stage2c`: W04 unarmed `F:\fxlab-runs\stage2c\e\run-mtzymzdk-facb23a3`.
- **The runner's recording read,** event `details` in `events.ndjson` (line 7 for W04,
  line 5 for W08), the same in all five bundles:
  - `recordings[0].entryCount` 3;
  - `recordedActions` `{extension: 0, core: 0}`;
  - `recordedEvents` `{}`, the extension's own log: no user event of any type;
  - `recordingDiscards` `[]`.
- **Core's own account,** in the failure event's `details.failureDetails` (line 9 for W04,
  line 7 for W08):
  - `proposalCount` 0 and two `issues`;
  - the four stage2d bundles' issues say: "Compacted 1 high-frequency state entries", and
    the mapper `web-recording-actions` "saw 2 proposal entries from 3 raw entries
    (observation: 3), matched 0, emitted 0 raw candidates";
  - the stage2c bundle has the same shape, 2 issues and `proposalCount` 0. Only the
    lengths of its issue strings were read, and they equal the stage2d W04 bundle's.
- **What those counts mean in Core's code:**
  - "(observation: 3)" is `countRecordingEntryTypes`, a count by entry `type`
    (`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\service.ts:5778-5782`).
    So all 3 raw entries are `observation` entries, and none is an `action` entry.
  - The one compacted entry is removed by `recordingTimelineForProposalMapping`, which
    drops `state_checkpoint` entries and `observation` entries of type
    `client.state_snapshot` or `client.state_update`
    (`...\runtime\service\recordings\timeline.ts:7-12`). Since all 3 are observations, the
    dropped one is a client state observation.
  - A candidate comes only from the mapper's output, or from an entry whose
    `type === "action"` (`service.ts:2402-2415`). With no candidate, Core logs the issue
    and makes no proposal (`service.ts:2433-2438`, `continue`).
  - The domain side agrees: a recorded event becomes executable only through
    `webAutomationRecordedAction`; anything else "stays evidence"
    (`domain/src/io/input-model.ts:66-83`).
- **Kind breakdown by kind, per entry:** for each of the 3 entries only the kind
  `observation` is known. The observation types of the 2 mapper-visible entries are not
  in any bundle.
- **The Core probe was skipped with no step to try.** Each Flow bundle's first event has
  `details.stepIds` as an empty array. `run-scenario.ts:527-529` publishes the skip with
  `choice.stepIds`. Its trigger and summary lengths (14 and 33 characters) match
  `runtime.settle` and "The Core action probe was skipped". That match is an inference
  from lengths and the code.

**The recordings: the recording-lane bundles.**
- **The bundles:** W04 `run-mu0334fe-645983cf` and W08 `run-mu03c3b0-fcf6525f` in
  stage2d, and W04 `run-mtzymiiu-d291f9fa` in stage2c.
- **`evaluation.json`:** `lane=recording`, `verdict=passed`, `oracleVerdict=passed`,
  `reportedVerdict=null`, `flowCreated=null`.
- **No Core recording at all.** W04's bundle has 5 events: step events carrying
  `recordCount` 8, then `final`. There is no pairing, recording, probe or gateway event.
- **Why:** a recording-lane run bootstraps a Core identity only when the recorded workflow
  pins `recordingEvents` or `actions`, or the scenario has a playback goal
  (`packages/test-runner/src/lane-rules/core-identity.ts:26-27`). W04 and W08 have none of
  these. That is also why `l-stage2d` found these rows publish no recording read.

### 2. Why the same Flow rows passed in Stage 2

**Stage 2's bundles still exist,** under `F:\fxlab-runs\stage2b\d\` (facility `6c22e22`,
read from `run.json`). The four Flow-lane rows' `evaluation.json` fields:

| Row | runId | `lane` | `verdict` | `flowCreated` | `oracleVerdict` / `reportedVerdict` |
| --- | --- | --- | --- | --- | --- |
| W04 unarmed | run-mtzqts1z-3d425b18 | flow | passed | **false** | null / null |
| W04 `text-variant` | run-mtzqu7wl-6240a487 | flow | passed | **false** | null / null |
| W08 unarmed | run-mtzqzs6u-48c57af2 | flow | passed | **false** | null / null |
| W08 `column-reorder` | run-mtzr070c-dfb91621 | flow | passed | **false** | null / null |

- **W04 unarmed's events:** 5 events, the same shape as a recording-lane run. The step
  events carry `recordCount` 8, then `final`. There is no probe, recording, proposal,
  dispatch or Core event. (The other three bundles' events were not opened.)
- **The cause is the defect H2 fixed.** Before `7a6a8e7`, a Flow-lane run "followed the
  recording lane's rule". So a workflow pinning no recording events, actions or playback
  goal "ran on the Flow lane with no Core at all and passed on the recording's checks: six
  week1 bench results (W04, W06 and W08, unarmed and armed) never built a Flow"
  (`core-identity.ts:8-13`).
- **H2's two rules:**
  - every Flow-lane run now gets a Core identity (`core-identity.ts:26`);
  - a Flow-lane run that published no `flowCreated` fails (`lane-rules/built-flow.ts:4-17`,
    called at `run-scenario.ts:366`).
- **The archive's record:** entry "g-runner-harness-fixes" (archive lines 2535-2581) lists
  H2. Its "Not verified" names "the W04-W08, W12 and W29 outcomes" (line 2580). This
  failure is that unverified outcome.
- **Which pins carry H2.** `git merge-base --is-ancestor 7a6a8e7 <pin>` printed:
  `6c22e22` (Stage 2) no-H2, `69f40c1` (`l-stage2c`) has-H2, `d639415` (`l-stage2d`)
  has-H2.
- **What changed between the stages:**
  - with H2, Core pairs, the extension records, and the Flow lane asks Core for a proposal;
  - the recording holds no action, so there is none;
  - the runner fails the run as `recording.contract`
    (`flow-lane/recording-flow-proposal.ts:43-44`, reached from `flow-lane/run-flow-lane.ts:104-105`).
  - `l-stage2c`'s W04 Flow rows `run-mtzymzdk-facb23a3` and `run-mtzynpxc-2bdcca0c` show
    `failureCategory=recording.contract` and `flowCreated=false`, the same as stage2d.
- **W06 passed through the same change** (it types and presses), which fits the rule.

**Which archived decisions put these rows on the Flow lane.**
- **`g-bench-coverage`** (archive lines 438-441) decided "every unarmed row runs on both
  lanes". Nothing in that decision checks whether a row's recording can yield a Flow.
  - `lanesForResult` looks only at whether a variant is set
    (`bench/expand-corpus.ts:19`).
  - The count test pins W04 and W08 on the Flow lane as part of "W01-W18 for criterion 1"
    (`bench/tests/week1-corpus.test.ts:91-95`).
- **`g-flow-lane-expectations`** (archive lines 2039-2044) already recorded the underlying
  fact: "A recording never yields an extract node, and authoring one is Week 2 Flow work."
  - It ruled only that extraction is not judged on the Flow lane
    (`flow-lane/expectations.ts:72-74`, `not_applicable`).
  - It did not rule on whether the lane applies to a workflow that does nothing else.

### 3. Which is true

**(a).** Each workflow has no recordable action, so no Flow can be proposed.

- **The script performs no user action.** See section 1: `extract` without
  `pagination`, and `checkpoint`.
- **Nothing was lost on the way.**
  - The extension counted 0 actions and logged no user event (`recordedActions.extension`
    0, `recordedEvents` `{}`).
  - Core held 0 actions (`recordedActions.core` 0).
  - All 3 of Core's entries are observations.
  - Core's mapper matched 0 of its 2 visible entries. No discard was audited.
  - A loss (b) would need an action somewhere upstream, and there is none.
- **The runner's refusal is deliberate and right.** "A recording that yields no candidate
  is a contract failure, not an empty pass — an approved Flow with no action would run
  green having done nothing" (`recording-flow-proposal.ts:27-33`). That empty pass is
  exactly what Stage 2 recorded.
- **So the rows can never pass on any product.** The bench "passes only when at least one
  run was evaluated and every evaluated run passed"
  (`docs/architecture/testing-facility.md:1124-1125`). Every week1 bench at HEAD therefore
  fails on these four rows. Criterion 1's "week1 W01-W19 through the bench, 3 of 3" cannot
  be met for W04's and W08's Flow rows as planned.
- **One more fact for the criterion ruling.** At HEAD, FluxIQ executes no action for W04 or
  W08 on either lane:
  - the recording lane runs no Core identity for them (`core-identity.ts:27`), and its
    `reportedVerdict` is null;
  - the Flow lane cannot build a Flow.
  - Their recording-lane pass measures the runner's own Playwright extraction and the
    fixture's final-state facts, not FluxIQ.

### 4. The smallest correct fix

**What it does:** the bench and the runner say the Flow lane does not apply to a workflow
whose recording script can yield no action, and say why, instead of running it into a
certain `recording.contract`. One rule serves both places:
`recordableActionTypes(unarmedWorkflow.recordingScript).size === 0`. It uses the table the
validator already trusts (`test-contracts/src/validation.ts:190-203`).

**Owning files:**
1. **`packages/test-contracts/src/index.ts`**
   - Add `export * from "./recordable-actions.js";`.
   - Today the barrel does not export `recordableActionTypes` (lines 1-15 checked). Without
     this line, a rule in the runner cannot import it. This is the "caller or barrel you do
     not own" trap from the binding rules.
2. **New `packages/test-runner/src/lane-rules/flow-lane-applies.ts`**
   - Export a reason constant and a predicate, for example
     `flowLaneAppliesTo(script): boolean` plus `FLOW_LANE_NEEDS_A_RECORDABLE_ACTION`. The
     reason text should say that the recording script performs no action a recording can
     hold, so no Flow can be built from it.
   - Export it from `lane-rules/index.ts`, and test it in
     `lane-rules/tests/flow-lane-applies.test.ts`.
   - Placing it here follows H2's precedent, and `src/` is at its file-count limit
     (archive line 2558).
3. **`packages/test-runner/src/bench/expand-corpus.ts`**
   - Resolve the row's unarmed workflow before planning lanes. Today `plannedLanes` runs
     before resolution (`:43-44`, `:53-58`, `:60-70`).
   - When the rule says the Flow lane does not apply:
     - an unarmed result is planned on the recording lane only;
     - each variant, for which the Flow lane is its only lane (`:4-5`, `:19`), is planned
       once, skipped with the reason.
   - The existing skip path already records such an entry and never counts it as a pass
     (`run-bench.ts:100-110`, `render-markdown.ts:39-56`).
4. **`packages/test-runner/src/run-scenario.ts`**
   - In `resolveWorkflow` (`:673-679`), beside the existing variant refusal: refuse a
     `--flow` run of such a workflow as `fixture.invalid` with the same reason, before
     the topology starts.
   - Then a direct `lab run product-catalog --flow` fails at once with the reason, not
     after about 30 s as `recording.contract`.
   - Pin the call in `run-evaluation/tests/runner-wiring.test.ts`, as H2 did.
5. **`packages/test-runner/src/bench/tests/week1-corpus.test.ts`**
   - `:91`: `[67, 23, 0, 23, 21]` becomes `[63, 23, 0, 21, 19]`.
   - `:93`: "Flow unarmed equals recording unarmed" gains a named exception for W04 and W08.
   - `:95`: the criterion-one Flow list drops W04 and W08.
   - `:97`: "no resolved entry is skipped" becomes exactly the four W04 and W08 Flow
     entries, each with the reason.
6. **Comments and docs that state the counts:**
   - `bench/corpus/week1.ts:16-23` (67, 44, "makes W01-W18 a measurement of FluxIQ");
   - `docs/architecture/testing-facility.md:1111-1116`. The page's description of the
     bench planner changes, so it is required documentation.

**Tests and proofs:**
- the predicate's unit test covers an unpaginated extract (false), a paginated extract
  (true) and a script with a click (true);
- the week1 count test;
- the wiring test;
- a mutation proof for each: remove the planner's call and the count test fails; remove
  the refusal and the wiring test fails. Restore each byte-identically.
- **Lab proof:** a week1 bench's `report.md` lists W04 `text-variant` and W08
  `column-reorder` as skipped with the reason, and plans no W04 or W08 unarmed Flow row.
  W04's and W08's recording rows still pass. A direct `lab run product-catalog --flow`
  fails as `fixture.invalid` with the reason, before Core starts.

**Does it change criterion 1's W01-W19 set?**
- The corpus rows stay, and W04 and W08 keep their recording-lane results.
- The Flow-lane unarmed set for criterion 1 shrinks from 18 rows to 16: W01-W03, W05-W07
  and W09-W18.
- `text-variant` and `column-reorder` are no longer run on any lane, because the recording
  lane never arms a variant (`run-scenario.ts:677`).
- Whether W04 and W08 count toward "actions reliable" is a ruling for the supervisor.
  Neither has an action for FluxIQ to execute. The options are to rule them "not
  applicable, no action", or to leave them waiting on Week 2 Flows with extract nodes.

**Rejected alternatives:**
- **Let the Flow lane approve an empty proposal.** That would restore Stage 2's false pass,
  which `recording-flow-proposal.ts:27-33` exists to refuse.
- **Add an action to W04's or W08's script.** That changes what the plan's corpus rows
  mean. W05-W07 and W09 already act on the same fixtures.
- **Author an extract node into the Flow.** The archive already places that in Week 2
  (lines 2042-2044).
- **Refuse in the runner only.** The bench would still plan the four rows and fail them as
  `fixture.invalid` on every repeat. The planner change is the part that unblocks the bench.

## What changed and why

- **Created this report,** the only file the brief owns.
- **Scratch files,** both prefixed `i-w04-w08-`, in
  `C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\4f264c80-323b-4673-a09a-bde5851669f3\scratchpad\`:
  - `i-w04-w08-events-shape.mjs` prints each event's key paths, value kinds and numbers.
    It prints strings only for enum-like keys, and never free text;
  - `i-w04-w08-shape-out.txt` is its output.
- **Nothing else.** No tracked file, worktree, Lab or Core file was touched.

## Commands run and observed results

- `git log --oneline -S "scenarioRequiresCore" -- packages/test-runner/src` printed
  `7a6a8e7 Give every Flow-lane run a Core identity and a built Flow, …` and `5e9d97e …`.
- `git show --stat 7a6a8e7` listed `lane-rules/built-flow.ts`, `core-identity.ts`, their
  tests, `run-scenario.ts`, `extract-records.ts` and `scenarios.ts` (-4 lines), among others.
- **Is H2 in each pin?** `git merge-base --is-ancestor 7a6a8e7 <pin>`, per pin, printed
  `6c22e22 no-H2`, `69f40c1 has-H2`, `d639415 has-H2`.
- **The bench pins,** read from `run.json`: stage2c `69f40c1…`; stage2b `6c22e22…`; stage2d
  `d639415…` with Core `3cb8976…`, `dirty=false`.
- **Finding the W04 and W08 bundles:** a Grep of `scenarioId`, `workflowId` and
  `variantId` over `stage2d\d\run-*\run.json`, and `evaluation.json` read per bundle
  (fields quoted above).
- **A PowerShell tally of `stage2b` `evaluation.json` files** for `product-catalog` or
  `data-table` with no workflow printed 6 rows: 2 recording-lane rows passed, and the 4
  Flow-lane rows shown in the table, each `verdict=passed` and `flowCreated=False`.
- **A key-only Grep of the four stage2d Flow bundles' `events.ndjson`** printed
  `entryCount 3`, `recordedActions {"extension":0,"core":0}`, `recordedEvents {}` and
  `proposalCount 0`, plus the two issue strings. Only their counts are cited here.
- **`node i-w04-w08-events-shape.mjs`** over stage2d `run-mu033kjx` and `run-mu0334fe`,
  stage2c `run-mtzymzdk` and stage2b `run-mtzqts1z` printed `exit=0` and 407 lines, as
  cited above.
- **Grep of the recording scripts** across the 16 week1 scenario `manifest.ts` and
  `scenario.ts` files: listed above.
- **Grep of `.structure-baseline.json`** for `run-scenario`, `expand-corpus`,
  `test-runner/src/bench` and `test-contracts/src/index`: no matches.

## Not verified

- **The observation types of the 2 mapper-visible entries.** No workspace was kept.
  Core's issue string counts entry types only, and does not name observation types.
- **The events of three `stage2b` Flow bundles** (`run-mtzqu7wl`, `run-mtzqzs6u` and
  `run-mtzr070c`): only their `evaluation.json` fields were read. The stage2c
  `text-variant` bundle's issues were not dumped either; only its evaluation fields were.
- **Whether the structure audit's file budgets leave room** in `run-scenario.ts` or
  `expand-corpus.ts`. The baseline names neither, but the audit was not run.
- **Whether `bench/tests/run-bench.test.ts` pins week1 plan counts.** It references
  `expandCorpus` and was not read.
- **Where `test-contracts` keeps a test for the barrel change.**
- **Whether any non-week1 scenario runs a playback goal** (an empty script) on the Flow
  lane, and so whether the rule needs an explicit empty-script case. The validator skips
  empty scripts (`validation.ts:184-192`).
- **No Lab run, build or test, and no fix.** The proof a Lab run must show is under
  section 4.
- **Evidence scope:** I read `F:\fxlab-runs\stage2b\d\` bundles, because the brief's task
  item 2 asks for Stage 2's bundle fields. Nothing under `F:\fxlab-runs\stage3\` or
  `F:\fxlab-runs\evidence\` was opened, and no `F:\fxlab\` worktree was touched.

## Open questions or contradictions found

1. **A criterion ruling is needed.** FluxIQ executes no action for W04 or W08 on either lane
   at HEAD. Does criterion 1 treat them as not applicable (no action), or as Week 2 work
   with extract-node Flows? The "Rulings on how the criteria count" section in
   `finish-week1.md` (line 4292) may already bear on this, but it was not named in my brief
   and was not read.
2. **Lab Stage 3's benches cannot pass as a whole.** They run at `d639415`, so they will
   fail these four rows on every repeat, 12 failures per bench, whatever the product does.
   The two benches should still agree on them. The bench comparison and the blocker ranking
   should treat them as this known planning defect, not as product failures.
3. **Two documents contradict the observed runs.** `bench/corpus/week1.ts:19-21` and
   `bench/tests/week1-corpus.test.ts:92` say the Flow lane "makes W01-W18 a measurement of
   FluxIQ". That is false for W04 and W08, and has been since the lanes were decided.
4. **H2's reviewer flagged this outcome as unverified** ("the W04-W08 … outcomes", archive
   line 2580). No later entry closed that item before `l-stage2c` and `l-stage2d` observed
   the failure.
