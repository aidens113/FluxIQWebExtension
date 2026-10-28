# t769 b13: truthful test labels (worker report)

## Outcome

Partial. Three of the four labels are fixed in Core and covered by tests that failed first. These are the refused
test, the offline (recorded-run) test, and the live test. The setup-rerun label is fixed in the status reader, but
its main source in round 6 cannot be marked from my owned files. That source is the predecessors that a **subflow
trial** runs before its target. The exact change needed is under "Open questions".

## Cause found (2026-10-27)

Evidence came from the round 6 artifacts. The job run's UI review is
`fxwork/t719/.../rr6-slot-2/run-mvrj7qg9-b6dc94f6.ui-review.local.json` and its steps are in
`lab-runs/2026-10-27/run-mvrj7qg9-b6dc94f6/steps/`. The photo run's UI review is
`fxwork/t567/.../rr6-slot-4/run-mvrj7qgf-a44a1427.ui-review.local.json`.

1. **The setup rerun was a subflow trial's own predecessors, not `entry-preparation.ts`.** Job moments 28 and 29
   (03:21:42 and 03:22:02) both fall inside step 0207 `core.test_subflow` (03:21:36 to 03:22:20). Their overlay read
   "Testing your Flow | Step 4 of 4 | Running step 4 of 4: Save the job (row 1)". t753 marked only
   `service/project-build/entry-preparation.ts` with `runAutomationStudioActivityPreparation`. A subflow trial runs
   its predecessors itself, through `flow-bootstrap/verification/detached-subflow.ts`:
   - a callable target runs as Call Subflow nodes in one root graph;
   - a router-run target runs as a separate predecessor run (`before = await run(validated[0]!)`).

   Neither is marked, so the executor's `started.ts` says "Running step N of M", and `candidate-trial.ts` reads any
   build step as the test. The root's arrival step ("Step 2 of 4: Opening another page", moment 28) is setup too.
   A second, smaller cause sits in the status reader: a skipped step's row carries `step`, so it ended a preparation
   and opened "Testing".
2. **A refused test kept the "Testing" words.** In the photo run, moments 21 to 25 read "Building your Flow | Testing
   one part of the Flow" for refused tests (0109 to 0139, `candidate.trial_reset_required`, about 6 s each in the
   pre-trial look). The refused closing row "Testing one part of the Flow — not done" matched the pacer's `REFUSED`
   pattern. The pacer treats such a row as quiet, so the line kept "Testing one part of the Flow". For
   `core.test_candidate`, the tool row's `started` (and the decision thought) opened the "Testing your Flow"
   headline before the gate decided. A refusal then showed "Testing your Flow" for the headline dwell (3.2 s), and
   ended on "The test didn't run. Next: deciding what to do" with no reason. Only `core.test_candidate` was
   recognised, not `core.test_subflow`.
3. **The offline check would have read as a live test.** The offline runner (`service/offline-trial/run.ts`,
   `subflow-run.ts`) runs the real `runAutomationStudioCandidateTrial`/`runAutomationStudioSubflowTrial` against a
   matcher session. So its steps reach `started.ts` and say "Running step N of M". Nothing marked them, and nothing
   told a kept recorded failure apart from a failure on the site.

## What changed and why

Core AS `runtime/activity/step/`:

- `recorded-check.ts` (new). It exports one frozen object, `automationStudioActivityRecordedCheck` (`run`, `active`),
  which is an AsyncLocalStorage mark like `preparation.ts`.
- `started.ts`. Under the mark, a step says "Checking against the recorded run: <action>" and keeps its `step`. This
  mark outweighs the preparation mark. `index.ts` exports it.

Core AS `runtime/llm/step-log/offline-trial-step.ts`: `automationStudioLlmStepLogOfflineTrial` runs `run` under the
recorded-check mark whether the step log is on or off. Its public signature is unchanged. Every gate's offline check
already goes through it (`trial-gate.ts:584`, `subflow-trial-offline-first.ts:35`). No gate file was touched.

Core `ui/activity-status/`:

- `steady/recorded-check.ts` (new). The `RecordedCheck` tracker and two constants. `ACTIVITY_RECORDED_CHECK_WORDS` is
  exported through the UI barrel for `started.ts`. The headline is "Checking your Flow against the recorded run".
- `steady/aside-end.ts` (new). It holds `activityAsideEnds`, the one rule for when a setup or recorded-check run
  ends. Only a step row that *starts* a step (`detail.kind === "step"`, `status: "started"`) ends it, so a skipped
  step no longer does. `steady/page-preparation.ts` uses it.
- `steady/test-ending.ts` (new). `activityTestEnding` gives the closing line of a test call (any `core.test_*`):
  - a verdict;
  - "The test didn't run: <reason>", from Core's `Declined:` words, or from plain words keyed by `trial_*` when
    Core's words are only the generic "the test couldn't start" (for example `project.trial_reset_required`);
  - "Checked against the recorded run, not the site: …" when the recorded run kept the failure. It knows this from
    Core's `Said:` words, or structurally when recorded steps ran and no site step did.
- `candidate-trial.ts`. It now handles every `core.test_*` tool. The tool's `started` row and the decision thought
  only *begin* the call (`calledNow`). The headline stays "Building your Flow", and the decision's line is still
  "Testing … from the start". Only a step on the site opens the test. `observe` takes
  `aside: "preparing" | "recorded" | null`, and a boolean still means preparing. It records whether a recorded check
  or a site step happened, for the closing line.
- `headline.ts`. The live test now reads "Testing your Flow on the site". The new `checkingRecording` situation reads
  "Checking your Flow against the recorded run". The order is preparing, then recorded, then testing, then resetting.
- `pacer.ts`. It wires the recorded tracker in. That run is no repair and is coloured running. It counts its own
  steps, its line is its action, and the decision's test line shows through `calledNow`.
- `steady/agent-states.ts`, `steady/index.ts`, `index.ts`: wiring.

Tests updated by design:

- `candidate-trial.test.ts` and `candidate-trial-live.test.ts`. The decision or `started` row no longer heads
  "Testing". The headline is "on the site". `trial_stale_revision` now says its reason.
- `pacer-steady.test.ts`. The new headline string, so its assertion is not left vacuous.

## Commands run and observed results

2026-10-27. Tests first (failing), from `packages/fluxiq`:

- `pnpm test src/ui/activity-status/tests/truthful-test-labels.test.ts` printed `Test Files 1 failed (1)`,
  `Tests 4 failed | 1 passed (5)`. The four failing were the setup, refused, recorded-kept and on-site cases (for
  example, received headlines `Testing your Flow` x4 where `Building your Flow`, `Checking your Flow against the
  recorded run`, … were expected). The passing one was the plain-words check.
- `pnpm test .../activity/step/tests/recorded-check.test.ts .../llm/step-log/tests/offline-trial-step.test.ts`
  printed `Test Files 2 failed (2)`, `Tests 4 failed | 6 passed (10)` (`TypeError: Cannot read properties of
  undefined (reading 'active')`).

After the change:

- `pnpm test src/ui/activity-status src/programs/automation-studio/runtime/activity/step
  src/programs/automation-studio/runtime/llm/step-log` printed `Test Files 35 passed (35)`, `Tests 226 passed (226)`,
  `[vitest-groups] all groups passed: parallel, real-sql`. Before the by-design updates the same run had 7 failures,
  all in older tests asserting the old "Testing your Flow"-on-decision behaviour.
- Neighbours, read-only, owned by others: `pnpm test src/programs/automation-studio/runtime/activity/tests
  src/ui/person-facing src/ui/activity-action .../service/project-build/tests/project-build-entry-preparation.test.ts
  .../flow-bootstrap/candidate/tests/offline-trial .../subflow-candidate/tests/subflow-trial-offline.test.ts
  .../flow-bootstrap/offline-first` printed `Test Files 35 passed (35)`, `Tests 473 passed (473)`,
  `all groups passed`.
- `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p .` exited 2 with 13 errors. All 13 are
  in `src/programs/automation-studio/runtime/service/project-build/subflow-trials.ts`, which another worker is
  editing (TS7031/TS7006 implicit any at l.85-94, and TS2540 `offlineFirst` read-only at l.126). None are in my
  files. One error of mine, a test skip reason `"not_shown"`, was fixed to `"optional_absent"`.
- Core root: `node scripts/structure-audit.mjs | grep -E "FAIL|structure-audit:"` printed `structure-audit: passed
  (444 warning(s), 1152 baselined).` with no FAIL. The advisories on touched directories were already there:
  activity-status 24 files, its tests/ now 17, and pacer.ts at 628 lines.

UNIT READY: packages/fluxiq/src/ui/activity-status/{candidate-trial.ts,headline.ts,index.ts,pacer.ts,
steady/agent-states.ts,steady/index.ts,steady/page-preparation.ts,steady/aside-end.ts,steady/recorded-check.ts,
steady/test-ending.ts,tests/truthful-test-labels.test.ts,tests/candidate-trial.test.ts,
tests/candidate-trial-live.test.ts,tests/pacer-steady.test.ts},
packages/fluxiq/src/programs/automation-studio/runtime/activity/step/{index.ts,started.ts,recorded-check.ts,
tests/recorded-check.test.ts},
packages/fluxiq/src/programs/automation-studio/runtime/llm/step-log/{offline-trial-step.ts,
tests/offline-trial-step.test.ts}

The last two files are untracked B4 files that I edited: the mark and one `it.each`. `llm/step-log/index.ts` shows as
modified only because of B4's export. I did not touch it.

## Not verified

- Whether the offline runner's steps actually reach the activity stream in a real build. No live or paid run was made,
  and no offline run was observed. The mark is correct whether or not they do.
- The extension's bundle and overlay rendering of the new strings. There was no build and no browser.
- `packages/fluxiq/docs/reference/framework-reference.md` is generated from `activity-display.ts`, whose doc still
  says "Testing your Flow". I left it alone so `docs:reference` stays in step. A supervisor may update the doc
  comment and regenerate it.

## Open questions or contradictions found

- **Setup rerun inside a subflow trial (the round 6 job case) needs non-owned files.** Today's status reader already
  reads "Getting the page ready" for any step row Core marks. What is missing is the mark itself:
  - Router-run target: in `flow-bootstrap/verification/detached-subflow.ts`, change `before = await
    run(validated[0]!)` to `before = await runAutomationStudioActivityPreparation(() => run(validated[0]!))`.
  - Callable target: predecessors and target are calls in one root graph, so the mark must be per call frame. One
    way is for `composedPlan` to tag the predecessor calls and the arrival node, and for the executor's
    `executor/frames/call-subflow.ts` and arrival step to run a tagged child frame under
    `runAutomationStudioActivityPreparation`. Another is to run a callable target's predecessors as their own marked
    run, as the router-run path already does. That is a design choice for the flow-bootstrap owner.

  `flow-bootstrap/**` is must-not-touch and `executor/**` is not owned, so I stopped there. A test for it belongs
  beside `detached-subflow.ts`. It would check that predecessor and arrival step rows say "Getting the page ready"
  and that the target's say "Running step".
- B5's `activity/candidate/trial-words.ts` `NOT_RUN` map has no `project.*` codes, so the supervisor's refused
  whole-Flow test card says "the test couldn't start". The status line now gives the reason through its own fallback
  map in `steady/test-ending.ts`. That map partly duplicates B5's words.
- Detecting a kept recorded failure from Core's `Said:` words couples to B5's prefix "checked against the recorded
  run". The structural fallback (recorded steps, no site step) covers a Core that words it differently.
- The trial step-log `meta.json` for refused tests showed `effectApplied: true` for `candidate.trial_reset_required`
  (photo run 0079 to 0139, about 6 s each, after a pre-trial look) and `false` for the 10 ms ones (0161 to 0190).
  The brief's assumption that refusals carry `effectApplied:false` therefore holds only for the latter. The labels do
  not depend on it.
