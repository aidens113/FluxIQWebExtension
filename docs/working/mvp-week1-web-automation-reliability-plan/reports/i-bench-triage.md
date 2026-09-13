# i-bench-triage — why 30 of 67 week1 bench rows failed (read-only)

Bench `bench-mtzqnj6o-f355f75e`, runs dir `F:\fxlab-runs\stage2b\d`, facility
`6c22e22` and Core `5845f5d`, `--repeat 1`, from `l-stage2`'s second attempt. The
bench ran each result once, so **every row below is a single observation**.
Nothing was built, run through the Lab, or edited, apart from this report and
scratch scripts in the session scratchpad.

## Outcome

**Done.** All 30 failing results are classified, each with bundle evidence and
file:line.

| Class | Results | Which |
| --- | --- | --- |
| Product defect | 9 | W02 flow, W03 flow, W13 `banner-absent`, W14 recording, W14 flow, W14 `armed`, W15 flow, W17 flow, W28 flow |
| Harness or expectation defect | 11 | W05 recording, W05 flow, W05 `short-catalog`, W07 flow, W11 flow, W11 `end-early`, W12 recording, W12 flow, W15 `popup-blocked`, W26 `no-context`, W29 `save-and-exit` |
| Environment (single observation) | 3 | W07 recording, W16 flow, W26 flow |
| Already decided in this dispatch | 7 | W09 flow, W18 recording, W18 flow, W19 `expired`, W24 `unannounced`, W25 flow, W25 `too-slow` |

Four findings matter beyond the per-row causes:
1. **Six Flow-lane results passed without any Flow being built**: W04, W06 and
   W08, both unarmed and armed. For these workflows the runner never gave Core
   an identity, so nothing paired, recorded or ran (defect H2 below). The bench's
   37 passes overstate the Flow lane by 6.
2. **Of the 11 harness rows, 4 would still not measure FluxIQ once fixed**
   (W05 ×3 and W07 flow), because of H2 and the extract-node decision.
3. **The recording lane's 0.174 has a ceiling of 6/23 (0.261) as built.** It
   counts a one-field Core probe, not the workflow.
4. **The Flow lane's one false success is W03**, caused by product defect P1:
   a key press recorded ahead of the text typed just before it.

## Triage, per failing result

Categories are the runner's; "Core" is the failure record the Flow reported, when
one exists. Paths are relative to `F:\!FluxIQWebExtension` unless they start
with `F:\!FluxIQ`.

### Product defects

**W02 flow, `run-mtzqq4oa-287f35af`.** Runner `runtime.behavior`, "unexpected
output_not_observed". Core `output_not_observed` / `output_confirmation.not_received`,
stage `confirmation`, on the fifth Flow action.
- **Evidence.** `flow-lane.json` shows 7 candidates. The Flow ran
  `web.dom.keypress`, `web.dom.type`, `web.dom.click`, `web.dom.click`, then
  `web.dom.check`, which failed. `evaluation.json` gives the check 5009 ms.
  Recorded events: `web.keyboard.pressed` 1, `web.element.input_changed` 1,
  `web.element.clicked` 3, `web.element.changed` 2.
- **Cause 1, P1 (order).** The script types, then presses Enter
  (`apps/scenario-lab/src/scenarios/keyboard-forms/manifest.ts:16-17`), but the Flow
  presses first.
  - The recorder holds typed text back until the field has been quiet for 350 ms
    (`apps/extension/src/content/recorder.ts:80-84`).
  - The `keydown` listener emits at once and never flushes that pending text
    (`apps/extension/src/content/dom-events.ts:116-131`). `pointerdown` flushes it
    (`:48`), and so does a text field's `change` (`:98-100`).
  - The type step completed at 11:38:49.420; the press step ran 49.532-49.650,
    112-230 ms later.
- **Cause 2, P2 (check confirmation).**
  - Every mapped candidate waits 5 s for its own input as confirmation
    (`domain/src/web-panel-host.ts:160`).
  - The extension sends a runtime confirmation for navigate, click, type, clear,
    select, keypress and scroll, but not for `web.dom.check`
    (`apps/extension/src/background/connection/runtime-status.ts:93-107`).
  - The replayed check's own `change` event is untrusted, so the recorder ignores
    it (`dom-events.ts:95`).
  - Core therefore records `output_confirmation.not_received`
    (`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\io-policy.ts:135`).
    The 5009 ms is that 5 s timeout. This is the bench's only `web.dom.check` sample.
- **Class: product defect (P1, P2).**

**W03 flow, `run-mtzqs9za-252209c8`.** Runner `runtime.behavior`, "The generated
Flow ran, but the fixture's expected final state did not hold afterwards". Core
reported no failure: `status=succeeded`, all 4 actions `succeeded`.
- **Evidence.** The Flow ran keypress, type, keypress, keypress. The script is
  type, press, wait, press, press (`keyboard-forms/manifest.ts:46-50`).
- **Timing.**
  - The type step completed at 11:40:32.991, and the first ArrowDown started 65 ms
    later, at 33.056. That is inside the 350 ms debounce, so the key was recorded
    first (P1).
  - The pending text flushed at about 33.34, before the second ArrowDown at
    33.363.
  - The replay therefore presses ArrowDown on an empty field, types, then presses
    ArrowDown once and Enter: one highlight short of the second match.
- **Why Core saw success.** A key press is confirmed by the key event itself
  (`runtime-status.ts:105`), so nothing in the Flow observes which option was
  chosen. This is the Flow lane's one false success.
- **Class: product defect (P1).**

**W13 `banner-absent`, `run-mtzrbbbw-8baa698d`.** Runner `runtime.behavior`,
"unexpected target_not_found". Core `target_not_found` / `web.target.not_found` at
`target_resolution`, on the first click (the recorded consent dismissal). Harness
activations 2; the Flow stopped there.
- **What the variant expects.** Arming removes the banner, and the run must still
  publish the draft (`apps/scenario-lab/src/scenarios/modal-flows/manifest.ts:52-57`).
- **The resolver was right to refuse.** No control of that family matched. The
  unarmed W13 Flow (`run-mtzrab17-b9319755`) passed with the same two clicks.
- **The gap:** a recorded dismissal whose target is legitimately absent cannot be
  skipped; the Flow has no optional node.
- **Class: product defect (P7, a design gap).** See open question 3.

**W14 recording `run-mtzrccia-805da2c1`, flow `run-mtzrd12l-1ca54273`, `armed`
`run-mtzrdq9o-26fafdef`.** Runner `recording.contract`, "Recorded events do not
match the scenario's expected recording events". `failureDetails.mismatches`:
`web.element.clicked` expected 2, actual 1. The extension's own log shows
`dom.click` 1.
- **Cause, P3.** The recorder drops the second Add-section click.
  - A `pointerdown` claims a click signature: tab, frame, selector and rounded
    bounds (`apps/extension/src/background/connection/recorded-event.ts:39-52`).
  - The signature is held for 750 ms
    (`apps/extension/src/background/connection/pointer-click-filter.ts:4,9-15`).
  - Any later `pointerdown` with the same signature inside that window is
    discarded (`recorded-event-intake.ts:85-86`).
- **Timing.** The two clicks started 374 ms apart on the recording lane
  (11:56:04.614 to 04.988) and 253 ms apart on the Flow lane (37.451 to 37.704).
  The button does not move between them (`modal-flows/markup.ts:77`).
- **The armed variant** records unarmed (`packages/test-runner/src/run-scenario.ts:57`),
  so it fails the same way before its Flow exists. That is also why it is a
  `failureClassificationAccuracy` miss.
- **Class: product defect (P3).** The extension recorder would lose a real
  user's repeated click the same way.

**W15 flow, `run-mtzrfb2j-3b702818`.** Runner `runtime.behavior`, "unexpected
target_not_found". Core `target_not_found` at `target_resolution` on the second
click: "0 control(s) of the same family are on the page".
- **Evidence.** The recording holds 2 executable actions (`recordedActions`
  extension 2, core 2; `web.element.clicked` 2, `web.tab.state_changed` 1). The
  script also switches to the details tab, extracts, and closes it
  (`apps/scenario-lab/src/scenarios/multi-tab/manifest.ts:22-35`).
- **Cause, P4.**
  - Tab state maps only to a state input (`domain/src/io/input-model.ts:44`).
  - No action input switches or closes a tab (`input-model.ts:90-99`).
  - So the Flow's second click runs wherever the first click left the tab, not on
    the order list. That it ran on the details tab is inferred.
- **Next failure after P4.** The row also pins a `web.dom.extract` action
  (`manifest.ts:41`) and `expected.extracted` (`:47`), which the extract-node
  decision makes unreachable (see H6).
- **Class: product defect (P4).**

**W17 flow, `run-mtzrjmsu-1e0816ba`.** Runner `runtime.behavior`, "unexpected
output_not_observed". Core `output_not_observed` / `web.validation.output_not_observed`
at `verification`, on the first action, `web.dom.type`: the target is an `<input>`
that holds no typed text.
- **Cause, P5.**
  - The recorder records a file input's `change` as `dom.change`
    (`apps/extension/src/content/element-traits.ts:94-100`).
  - The domain maps every change that is neither a select nor checkable to text
    entry (`domain/src/io/input-model.ts:122-130`).
  - The upload therefore becomes `web.dom.type` with the browser's placeholder
    path, which the type action correctly refuses
    (`apps/extension/src/content/actions/type.ts:52-55`).
- The recording row passed.
- **Class: product defect (P5, domain mapping).**

**W28 flow, `run-mtzs6oyw-7a39cea8`.** Runner `runtime.behavior`, "unexpected
target_not_found". Core `target_not_found` at `target_resolution`: expected frame 4
in the tab; the tab has frames 0, 6 and 7.
- **Cause, P6.**
  - The domain copies the recorded numeric frame id onto the Flow node
    (`domain/src/output-nodes/payloads.ts:28-31`), which is dispatched as `frameId`
    (`domain/src/client/gateway-action-parameters.ts:73`).
  - The extension refuses an id the tab no longer has
    (`apps/extension/src/runtime/action-runner.ts:206-209,271-276`).
  - Frame ids are reassigned whenever a frame navigates (`action-runner.ts:260-262`).
  - The Flow lane now loads the start page before every Flow
    (`run-scenario.ts:344`, decision `f-flow-start-page`), so a recorded
    child-frame id cannot survive to replay.
- The recording row passed.
- **Class: product defect (P6), exposed by the start-page change.**

### Harness or expectation defects

**W05 recording `run-mtzqupxd-4ec51d67`, flow `run-mtzqv7la-ffe52e7e`,
`short-catalog` `run-mtzqvo2d-47b20207`.** Runner `runtime.behavior`, "Scenario
fact failed: page-status".
- **Cause, H1.**
  - The workflow's final state requires `page-status` to read page 3 of 3
    (`apps/scenario-lab/src/scenarios/product-catalog/manifest.ts:64`). The page
    shows that only after Next has been followed.
  - The recording lane's extract reads only the current page and never clicks
    (`packages/test-runner/src/scenario-steps/extract-records.ts:38-43`,
    `run-scenario.ts:293-294`).
  - So `assertFinalState` (`run-scenario.ts:301,612`) fails.
- **Why the Flow-lane results fail too.** Both lanes run the recording script
  first (`run-scenario.ts:290-302`), so they fail before any Flow
  (`flowCreated=false`). The armed variant is judged by the unarmed workflow's
  expectation (`run-scenario.ts:57`).
- **Not in the bundle.** The fact's actual text is absent, because only
  `recording.contract` failures publish details (`run-scenario.ts:377-380`). That
  the page stayed on page 1 is inferred from the code.
- **Class: harness or expectation defect (H1).** Even corrected, these Flow-lane
  results cannot measure FluxIQ: no Core identity starts (H2), and no extract node
  can be proposed (the extract-node decision).

**W07 flow, `run-mtzqyv91-b613aa37`.** Runner `runtime.behavior`, "Scenario fact
failed: page-status".
- **Cause, H1.** The final state lists `active-filters`, `result-count`, then page
  3 of 3 (`product-catalog/manifest.ts:119-123`). The loop stops at the first
  failing fact (`packages/test-runner/src/scenario-assertions.ts:16-34`), so the
  first two held and the page status did not.
- **Class: harness or expectation defect (H1).**

**W11 flow `run-mtzr68uy-08cc6cc3`, `end-early` `run-mtzr79eu-9f142b6d`.** Runner
`action.dispatch`, "The Flow did not produce a web.dom.extract action with outcome
succeeded; it produced web.dom.scroll:succeeded ×3". The oracle passed, and Core
reported success.
- **Cause, H6.**
  - The row pins `{ action: "web.dom.extract", outcome: "succeeded" }` in
    `expected.actions` (`apps/scenario-lab/src/scenarios/infinite-feed/scenario.ts:50`).
  - That entry is judged by `packages/test-runner/src/flow-lane/expectations.ts:7-20`.
  - A recording's extract step is the runner's own check, so no extract node
    exists: the same reason as the `g-flow-lane-expectations` decision.
- **Why the decision does not cover it as briefed.** That brief's task 1 names
  the extraction expectation, `expected.extracted` (`expectations.ts:51-58`), not
  an `expected.actions` entry. `expected.extracted` (`scenario.ts:51,65`) would
  fail next, and task 1 does cover that.
- **Class: harness or expectation defect (H6).** See open question 1.

**W12 recording `run-mtzr8a7j-90f8f616`, flow `run-mtzr8xrc-01422ff9`.** Runner
`action.dispatch`, "Core action did not succeed: failed: Action rejected: the
element has a zero-size box". The recording lane's reported failure is
`blocked_by_capability_or_policy` / `web.action.rejected`.
- **Cause, H3.**
  - The Core round-trip probe types into the first `type` step that has a CSS
    target (`run-scenario.ts:515-518`). Here that is `enter-email`
    (`modal-flows/manifest.ts:23`).
  - That field is inside the invite dialog (`modal-flows/markup.ts:33,37`), which
    stays closed until `open-invite` is clicked (`manifest.ts:22`).
  - The extension's actionability check rejects it
    (`apps/extension/src/content/action-runtime/actionability.ts:77`).
- **Scope.** The probe runs before recording on both lanes (`run-scenario.ts:266`),
  so neither lane recorded anything.
- **Class: harness defect (H3).**

**W15 `popup-blocked`, `run-mtzrgg5i-70dd6d6a`.** Runner `action.dispatch`, "The
Flow did not produce a web.dom.click action with outcome succeeded; it produced
web.dom.click:failed".
- **The classification was right.** Core reported `output_not_observed` /
  `web.validation.output_not_observed`, the variant's expected category
  (`multi-tab/manifest.ts:62`).
- **Cause, H4.** The variant's `actions: [{ action: "web.dom.click" }]`
  (`manifest.ts:55`) names no outcome, and `assertFlowActions` defaults a missing
  outcome to `succeeded` (`flow-lane/expectations.ts:9`).
- **Comparison.** Rows that declare `outcome: "failed"` pass: navigation
  `scenario.ts:49`, and failure-surfaces `manifest.ts:73,91,113`.
- **Class: harness or expectation defect (H4).**

**W26 `no-context`, `run-mtzs0ea1-16b84fc9`.** Runner `action.dispatch`, the same
message as W15 `popup-blocked`.
- **The classification was right.** Core reported `target_ambiguous` /
  `web.target.ambiguous`, exactly the expected category and code
  (`apps/scenario-lab/src/scenarios/ambiguous-targets/manifest.ts:40`).
- **Cause, H4.** `manifest.ts:35` names no outcome.
- **Class: harness or expectation defect (H4).**

**W29 `save-and-exit`, `run-mtzs7mxg-bafc0417`.** Runner `runtime.behavior`, "The
generated Flow ran, but the fixture's expected final state did not hold
afterwards".
- **What held.** Core `target_not_found` / `web.target.not_found`, as expected
  (`apps/scenario-lab/src/scenarios/identity-drift/manifest.ts:44`), and the click
  `failed`, as declared (`:42`). Both are judged after the oracle
  (`flow-lane/run-flow-lane.ts:138-148`); the error itself comes from
  `run-scenario.ts:366`.
- **Cause, H5.**
  - For a primary-workflow run, `assertFinalState` also asserts the scenario's
    `playbackGoal.successFacts` (`run-scenario.ts:612`).
  - On identity-drift that is the saved status line (`manifest.ts:8,60-64`).
  - The variant's own final state requires the same status line to stay empty
    (`:43`).
  - Both cannot hold, so this row can never pass. W20-W23 pass only because their
    final state is the same saved fact.
- **Class: harness or expectation defect (H5).**

### Environment (single observations)

- **W07 recording, `run-mtzqxjr4-86223960`.** `process.startup`, "Timed out waiting
  for http://127.0.0.1:60234". One event (`events.ndjson`, 379 bytes), no `logs/`
  directory, no step. Even after a clean rerun it would reach H1.
- **W16 flow, `run-mtzri9ep-b3f3d974`.** `unknown`, "fetch failed".
  - The error is event 1, with no step and no Core event.
  - `run.json` has empty `steps` and `actions`, and `processExits` of
    `scenario-lab` 1 and `fluxiq-web` 0, over 26.5 s.
  - `logs/core.log` shows Core ready and exit code 0.
  - The W16 recording row passed.
- **W26 flow, `run-mtzryqqc-5c714a1a`.** `gateway.connection`, "Timed out waiting
  for client gateway on 127.0.0.1:62331". One event; `run.json` has empty `ports`
  and `processExits`, `browserVersion` `unavailable`, over 77 s. The W26 recording
  row passed.

### Already decided in this dispatch

- **W09 flow, `run-mtzr1cse-d5d359d4`.** `runtime.behavior`, "The Flow produced 0
  extraction result(s), expected 1". Oracle passed, Core passed, 1 click. Decided
  by the Flow-lane extraction expectation (`g-flow-lane-expectations`).
- **W18 recording, `run-mtzrkocp-cb7b7f50`.** `security.redaction`, 6 files.
  Decided by the auth-gate secret investigation (`i-secret-in-workspace`).
- **W18 flow, `run-mtzrlise-bbd68894`.** Two failures in turn: event 20,
  `runtime.behavior` "0 extraction result(s), expected 1"; event 22, redaction
  with 13 files. Decided by `g-flow-lane-expectations` and `i-secret-in-workspace`.
  The bench labels this run `runtime.behavior` with the redaction message (H7).
- **W19 `expired`, `run-mtzrmrfg-d4fe136c`.** `security.redaction`, 13 files. The
  Flow had already met its expectations (event 20: `auth_required` /
  `web.auth.required`, as expected). Decided by `i-secret-in-workspace`.
- **W24 `unannounced`, `run-mtzru6ka-41941f24`.** `runtime.behavior`, "The Flow
  reported no structured failure, expected output_not_observed". Ruled out of
  Week 1 (F3).
- **W25 flow, `run-mtzrvxys-b0f3fcec`.** `action.dispatch`, no
  `web.dom.wait_for_selector`: 2 candidates from 8 entries, with 1
  `web.dom.mutated`. Decided by the live wait investigation (`i-w25-live-wait`).
- **W25 `too-slow`, `run-mtzrx15x-99d07e66`.** `runtime.behavior`, "target_not_found,
  expected timeout". Same cause as W25 flow: with no wait node, the second click
  resolves at once against a page whose late action is still 20 s away
  (`apps/scenario-lab/src/scenarios/delayed-ui/scenario.ts:25`). It fails
  `target_not_found` instead of the wait's `timeout` (`scenario.ts:49-51`).
  Decided by `i-w25-live-wait`.

### Harness and expectation defects, summarised

| Id | Defect | Where | Failing results |
| --- | --- | --- | --- |
| H1 | The recording lane's final state requires pagination it never follows | `product-catalog/manifest.ts:64,122`; `extract-records.ts:38-43`; `run-scenario.ts:293,301` | 4 (W05 ×3, W07 flow), plus W07 recording behind its startup failure |
| H2 | No Core identity when the workflow's expectations pin no recording events, actions or playback goal, so a Flow-lane run passes without a Flow | `run-scenario.ts:138`; `packages/test-runner/src/scenarios.ts:25-27` | 0 failing; 6 false passes (W04, W06, W08 × 2); W05 and W07 Flow rows can never build a Flow |
| H3 | The Core probe types into the first `type` step whatever the steps before it do | `run-scenario.ts:515-518` | 2 (W12 ×2) |
| H4 | A negative variant's action entry with no outcome defaults to `succeeded` | `flow-lane/expectations.ts:9`; `multi-tab/manifest.ts:55`; `ambiguous-targets/manifest.ts:35` | 2 (W15 `popup-blocked`, W26 `no-context`) |
| H5 | Playback-goal success facts are asserted on a negative primary-workflow variant | `run-scenario.ts:612`; `identity-drift/manifest.ts:43,60-64` | 1 (W29) |
| H6 | An unreachable `web.dom.extract` entry in `expected.actions` | `infinite-feed/scenario.ts:50`; `multi-tab/manifest.ts:41` | 2 (W11 ×2); W15 flow next, after P4 |
| H7 | The bench pairs the runner's first failure category with the last `error` event's message | `bench/read-run-bundle.ts:80-83`; `bench/run-bench.ts:172-174`; `run-scenario.ts:444` | Reporting only: W18 flow labelled `runtime.behavior` with the redaction message |

## The two rates the brief asked about

### Recording lane `initialExecutionSuccess`: 4 / 23 = 0.174

- **Definition** (`packages/test-runner/src/bench/aggregate-report.ts:66,96-99`).
  The runner passed, the oracle passed, and FluxIQ reported success. A run with
  `reportedVerdict` null is counted as a miss (`:80`).
- **Where FluxIQ's verdict comes from on this lane:** only the Core round-trip
  probe (`bench/evaluate-run.ts:14`; `flow-lane/lane-observation.ts:15-33`). The
  probe needs two things:
  - a paired extension on a Core with an identity (`run-scenario.ts:266`), which
    starts only under the H2 rule (`run-scenario.ts:138`);
  - a `type` step with a CSS target (`run-scenario.ts:515-518`).
- **17 of 23 recording results executed nothing.**
  - W09, W10, W11, W13, W14, W15, W16, W17, W25, W26, W27 and W28 have no `type`
    step.
  - W04, W05, W06, W07 and W08 get no Core identity (H2). W06's `search` has a
    `type` step and is excluded by H2 alone.
- **The probe ran in 6:** W01, W02, W03, W12, W18 and W24.
  - Hits: W01, W02, W03, W24.
  - W12 missed because the probe itself was rejected (H3).
  - W18 missed because the run failed the leak attestation (decided).
- **Ceiling.** As built the rate cannot exceed 6/23 (0.261); fixing H2 would add
  W06, for 7/23. It measures whether Core can type one probe string into one
  field, not whether FluxIQ executed the workflow.

### Flow lane `falseSuccess`: 1 / 6 = 0.167

- **Definition** (`aggregate-report.ts:112-115`, positive at `:47`). The
  population is positive runs whose oracle failed and where FluxIQ gave a verdict;
  a hit is FluxIQ reporting success.
- **The 6:** W02 (reported failed), W03 (reported passed), W13 `banner-absent`
  (failed), W15 (failed), W17 (failed), W28 (failed).
- **Excluded:**
  - W29, a negative run;
  - W05, W07, W12, W14, W16 and W26 on the Flow lane, where no Flow was created so
    the oracle is null.
- **The hit is W03.** The Flow ran 4 actions, all `succeeded`, with
  `status=succeeded`, but the final state failed. P1 reordered the key presses, and
  a key press's confirmation cannot show that the wrong option was chosen.

### The other Flow-lane rates, for Phase 1.6b

- **`flowCreationSuccess` 30/44.** The 14 without a Flow:
  - 9 from H2: W04 ×2, W05 ×2, W06 ×2, W07, W08 ×2;
  - W12 (H3);
  - W14 unarmed and `armed` (P3);
  - W16 and W26 (environment).
- **`fuzzyRecovery` 4/10.** The 4 not executed are W04 `text-variant`, W05
  `short-catalog`, W06 `no-results` and W08 `column-reorder`, all H2. The 4 hits
  are W20-W23. The misses are W11 `end-early` (H6) and W13 `banner-absent` (P7).
- **`failureClassificationAccuracy` 8/11.**
  - Misses: W14 `armed` (P3, not executed), W24 `unannounced` (F3), W25 `too-slow`
    (`i-w25-live-wait`).
  - W15 `popup-blocked`, W26 `no-context` and W29 count as hits here although
    their runs failed, on H4 and H5.

## Product defects ranked by corpus impact (input to Phase 1.6b)

Ranked by failing results in this bench, then by how many recordings the defect
reaches. The decided product items are listed after the ranking for completeness.

| Rank | Id | Defect | Owning files | Failing results | Also reaches |
| --- | --- | --- | --- | --- | --- |
| 1 | P3 | The recorder drops a repeated click on the same, unmoved control within 750 ms | `apps/extension/src/background/connection/pointer-click-filter.ts:4,9-19`; `recorded-event-intake.ts:82-94` | 3: W14 recording, flow, `armed` | Any quick repeated click on a fixed control |
| 2 | P1 | A key press is recorded before the text typed just before it (keydown does not flush the 350 ms pending input) | `apps/extension/src/content/dom-events.ts:116-131`; `recorder.ts:80-96` | 2: W02 flow, W03 flow, including the only false success | W06 `search` (type then Enter), hidden today by H2 |
| 3 | P2 | No runtime confirmation for `web.dom.check`, so every check node fails its 5 s confirmation | `apps/extension/src/background/connection/runtime-status.ts:93-107`; the wait comes from `domain/src/web-panel-host.ts:160` | 1: W02 flow, which would still fail after P1 | Every recorded checkbox or radio; W07 `in-stock-only`, hidden by H1 and H2 |
| 4 | P6 | A recorded child-frame id is replayed after the page, and so its frames, reloaded | `domain/src/output-nodes/payloads.ts:28-31`; `apps/extension/src/runtime/action-runner.ts:206-209` | 1: W28 flow | Every action inside a child frame |
| 5 | P4 | A recording cannot switch or close a tab, so a Flow continues in the wrong tab | `domain/src/io/input-model.ts:44,90-99` (and the recorder) | 1: W15 flow | Any popup or new-tab workflow |
| 6 | P5 | A file input's change is mapped to text entry | `domain/src/io/input-model.ts:122-130` | 1: W17 flow | Any upload |
| 7 | P7 | A recorded dismissal whose target is absent cannot be skipped | The Flow node model (Core and domain); no single line | 1: W13 `banner-absent` | Optional consent banners and overlays |

Already decided, so not ranked:
- the declared secret persisted in Core's workspace, 3 results (W18 ×2, W19);
- no wait node on a live delayed-ui recording, 2 results (W25 ×2);
- no extract node from a recording, 2 results (W09, W18 flow), a runner-side
  decision.

## What changed and why

- **Written:** this report only.
- **Scratch files,** all in the session scratchpad, outside every tree:
  - `ibt-extract.mjs`, which prints evaluation, `flow-lane.json` and event
    evidence per run, with capture details stripped;
  - `ibt-steptimes.mjs`, which prints step timestamps;
  - `ibt-report-scan.mjs`, `ibt-report-scan2.mjs` and `ibt-report-scan3.mjs`,
    the declared-value scans below;
  - their outputs: `ibt-failed.txt`, `ibt-passing.txt`, `ibt-steptimes.txt`,
    `ibt-report-scan.txt`, `ibt-report-scan2.txt` and `ibt-report-scan3.txt`.
- **Not touched:** no repository file, no build, no test and no Lab command.

## Commands run and observed results

- **`node ibt-extract.mjs`** over every failing run in `runs.json` printed
  `lines 551`, exit `True`. Every row above comes from that output plus the
  bundle files named in each row.
- **`node ibt-extract.mjs <6 passing run ids>`** (W06 recording and flow, W08
  flow, W13 unarmed flow, W20, W27 `detached`) printed `lines 98`, exit `True`.
  This is where the no-Core runs showed: W06's two runs and W08's Flow run have no
  gateway, recording or Flow event at all.
- **`node ibt-steptimes.mjs`** over W14 ×2, W02 flow, W03 flow and W02 recording,
  exit `True`. The timings quoted in the W02, W03 and W14 rows are its output.
- **`Select-String`** over the logs of the three environment runs. W16 matched
  `L9: [stdout]  ✓ Ready in 4.5s` and `L25: [exit] code=0 signal=null`. W07 and
  W26 have no `logs/` directory.
- **The bench's `report.md`, `runs.json`, and the named `evaluation.json`,
  `run.json`, `summary.json`, `flow-lane.json` and `events.ndjson` files** were
  read directly.
- **Declared-value scan of this report,** in three passes. Each prints only a
  name or step id, a length and a hit count, never a value.
  - `node ibt-report-scan.mjs` checked 62 literals across 15 fixture
    directories. Every typed, selected and uploaded value scored `hits=0`, among
    them sensitive-input's `replace-password` and `replace-payment`, and so did
    the `WORKSPACE_NAME` and `UPLOAD_NAME` constants. The 32 total hits are key
    names (Enter, ArrowDown) and fixture path fragments inside this report's own
    file-path citations.
  - `node ibt-report-scan2.mjs` checked 229 auth-gate literals of 6 or more
    characters. The 207 hits are ordinary words and ids such as `expired` and
    `succeeded`; `auth-gate/constants.ts` printed no hit rows.
  - `node ibt-report-scan3.mjs` checked every literal in `auth-gate/constants.ts`,
    of any length, `authGateDemoCredentials` included, and printed
    `constants.ts literals checked=8 total hits=0`.

## Not verified

- **The generated Flows' node order and parameters.** Core's workspace is deleted
  after each run, and `flow-lane.json` keeps only action types, statuses and
  failure records. W02's node sequence (keypress, type, the Enter's submit click,
  checkbox click, check) is inferred from counts, timings and code.
- **Whether Chrome fires `change` before the Enter's synthetic submit click.**
  That decides exactly where W02's pending text flushed, not whether P1 applies.
- **The actual text of W05's and W07's `page-status`,** which the bundle does not
  publish.
- **Which tab W15's second click ran in.**
- **Whether W28 passed before `f-flow-start-page`.**
- **The three environment results.** None was rerun; the bench runs each result
  once.
- **No probe through Core's proposal generation, no unit test and no content
  harness** were run for any cause. Each one rests on this bench, which is a
  single observation, and on code reading.
- **Core citations** come from the main Core tree at `240c73e`, not re-read at
  `5845f5d`. Current State says the tenth commit between them is plan-only.
- **What a Lab run must show for each fix:**
  - **P3:** W14 unarmed records `web.element.clicked` 2 on both lanes and passes,
    and `armed` reports `user_intervention_required`.
  - **P1:** W03's Flow actions come in script order and its final state holds, and
    W02's keypress follows its type.
  - **P2:** W02's `web.dom.check` succeeds.
  - **P6:** W28's click reaches its iframe after the start-page load.
  - **P4:** W15's confirm click runs on the order list.
  - **P5:** W17's Flow runs no `web.dom.type` on the file input.
  - **P7:** W13 `banner-absent` publishes.
  - **H1:** W05 recording passes.
  - **H2:** W04, W06 and W08 on the Flow lane show `flowCreated=true`, or are no
    longer counted as Flow-lane passes.
  - **H3:** W12's probe passes or is skipped.
  - **H4:** W15 `popup-blocked` and W26 `no-context` pass.
  - **H5:** W29 passes.
  - **H6:** W11 ×2 pass on the Flow lane.

## Open questions or contradictions found

1. **H6 against `g-flow-lane-expectations`.** That brief's task 1 stops the Flow
   lane judging "a workflow's extraction expectation" when the Flow has no extract
   node. W11 fails an `expected.actions` entry for `web.dom.extract`
   (`infinite-feed/scenario.ts:50`), and W15 pins both kinds. As worded, W11 ×2
   stay red after that change. Should the task cover `expected.actions` extract
   entries too?
2. **H2.** Six Flow-lane results pass although no Flow was ever created, so the
   bench's 37 overstates by 6, and W05's and W07's Flow rows can never create one.
   There are two ways to fix it:
   - the product-catalog and data-table workflows pin recording events or actions,
     which makes them real Flow-lane measurements that then meet the extract-node
     decision;
   - or the Flow lane refuses to pass a run in which no Flow was created.
3. **W13 `banner-absent` (P7)** is the only failing row that needs a new Flow
   capability, skipping an absent optional dismissal, rather than a fix. Is it Week
   1 scope, or a Week 2 entry point?
4. **H7.** `report.md`'s "Why the failed runs failed" table lists W18 flow as
   `runtime.behavior` with the redaction message, which hides its extraction
   failure. The category is the runner's first failure (`run-scenario.ts:444`); the
   message is the last `error` event (`read-run-bundle.ts:80-83`).
5. **W03's false success remains possible after P1.** A key-press node has no
   outcome check in Core, so a wrong selection by key is visible only to the
   runner's oracle. Is an expected state for key presses in scope?
