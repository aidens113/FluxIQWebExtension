# t743-e4-repair: worker report

## Outcome

Done. The new spec `apps/extension/e2e/site-reset/tests/repair-first.spec.ts` passed headed on two runs in a row
(runs 9 and 10 below). It found no product defect. I added no helper file.

## What the spec proves

The scenario is job-board, with a read-only task: "Open the job board's saved jobs page and look at the jobs saved
there." It uses the scripted provider only. The supervisor and both builders are scripted (`SupervisorTurn`,
`BuilderTurn`).

1. **The supervisor plans and sends one build brief.** It writes a one-part plan (subflow `main`, no lasting acts) and
   dispatches one `build` brief.
   - The builder opens My jobs and takes the page view's handle for the title link of an already-saved job (`hv2`,
     "Product Designer").
   - It goes back to job `g1`'s page and submits a Flow: open g1's page, then click that link with `consequences: none`.
     The link exists only on My jobs.
   - The subflow trial really fails: `execution_failed` (`candidate.execution_incomplete`). Step 2 failed with
     `web.target.not_found`.
   - The builder ends blocked. The return is `blocked`, lists 1 trial, and has no `terminalReason`.
2. **The first ending is refused.** The supervisor ends `{ended: "blocked"}` and is refused
   `project.completion_repair_first` with `unrepaired: [{subflowKey: "main", failingBrief: "brief-1"}]`. The refusal is
   shown at supervisor turn 4 as a `core.completion_check` entry.
3. **The supervisor sends a repair.** The `repair` brief names, as `failingReceipt`, the trial the build's return listed
   (the return's `repairFrom.failingReceipt`).
   - Core refuses a builder ending before the builder has tried anything (`subflow.ending_too_soon`, seen in an
     exploratory run). So the repair builder submits the same Flow, tests it (`execution_failed` again), and ends
     blocked.
   - The return is `kind: repair`, `blocked`, with 1 trial.
4. **The second ending is accepted.**
   - There is no sixth supervisor decision (5 in total), and the supervisor saw no other refusal of any kind.
   - Core's one ended row in its activity stream ("FluxIQ could not finish the Flow.", status `failed`) carries the
     supervisor's second reason, not the first and not a guard's.
   - The build keeps a draft and promotes nothing: the run resolves with `status: "draft"` and
     `promotionAllowed: false`.

The spec asserts each of these, plus:
- the briefs, in order: `["build", "repair"]`;
- exactly one repair-first refusal, and no other completion refusal;
- the step counts: 5 supervisor turns and 8 builder turns.

### How the spec reads the ending, and why

The brief expected the build to fail on the supervisor's reason. That is not what happens. Because the build brief's
builder submitted a proposal, a candidate exists, so `service/project-build/run.ts` saves a draft and resolves; it does
not throw. Without a candidate it would have failed with `endedBecause`.

The supervisor's reason therefore reaches only two places: the build record, and the activity row emitted at
`run.ts:321-323`.
- The build record is stored through `ProgramJsonStore`, which keeps it in the project's SQLite file. I found no
  `project-builds/*/build.json` on disk.
- So the spec subscribes to Core's activity hub. It imports `dist/.../activity/default-hub.js` from the real path that
  `apps/extension/node_modules/fluxiq` resolves to, so it gets the same module instance the running Core publishes to.
  This hub is not exported publicly, so the spec depends on Core's dist layout. If that layout moves, the import fails
  loudly rather than passing.
- The spec also wraps `service.generateFlowBootstrapAdaptation`, only to keep its resolved value's `status`,
  `promotionAllowed` and `projectId`.

## Commands run and observed results

Every run used the brief's command (headed: `fixtures/extension-context.ts` launches with `headless: false`), with one
worker, from `apps/extension`, and with output under
`C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/53d1357c-b7da-4f48-9665-ff78992a8998/scratchpad/e4-repair-<N>`.

| Run | Result | What it showed |
| --- | --- | --- |
| 1 | Failed | The submission was refused `web.step.consequences_undeclared`. That is a spec defect: the click needed `consequences: none`. The thrown script error ended the build as `provider_transport_unknown`. |
| 2 | Failed | The refusal flow worked. The run resolved `proposed`, not failed, which is how I learned a draft is kept. The repair builder's immediate ending was refused `subflow.ending_too_soon`, so it submitted and tested. |
| 3–6 | Failed | Attempts to read the ending from the build record on disk. No file exists because the record is in SQLite. Run 6 dumped the resolved value: `status: "draft"`, `promotionAllowed: false`. |
| 7 | Failed | Wrong relative path to `node_modules/fluxiq`. |
| 8 | Passed (1.2m) | |
| 9 (validation) | Passed (1.1m, `1 passed (1.6m)`) | Diagnostic line below. |
| 10 (validation) | Passed (1.1m, `1 passed (1.4m)`) | The same diagnostic line as run 9. |

The diagnostic line from runs 9 and 10 (identical):

```text
{"resetDiagnostic":{"ending":"proposed","failure":{},"status":"draft","activity":87,"endedRows":[{"status":"failed","bySupervisor":true}],"supervisorSteps":5,"builderSteps":8,"briefs":[{"briefId":"brief-1","kind":"build","outcome":"blocked","trials":1,"terminalReason":null},{"briefId":"brief-2","kind":"repair","outcome":"blocked","trials":1,"terminalReason":null}],"refusals":[{"step":4,"code":"project.completion_repair_first","unrepaired":[{"subflowKey":"main","failingBrief":"brief-1"}]}],"tests":[{"brief":1,"verdict":"execution_failed"},{"brief":2,"verdict":"execution_failed"}],"supervisorReceipts":[{"call":"project.read_task","code":"ok"},{"call":"core.evidence_history","code":"llm_evidence_loop.decision_history"},{"call":"core.evidence_history","code":"llm_evidence_loop.decision_history"},{"call":"core.evidence_history","code":"llm_evidence_loop.decision_history"},{"call":"core.evidence_history","code":"llm_evidence_loop.decision_history"}]}}
```

Each run's full diagnostic is in `<output>/site-reset-tests-repair-fi-349b3-ntil-a-repair-has-been-sent/reset-repair-first.json`.

## Not verified

- **No typecheck of the spec.** The brief forbids typechecks. Playwright's transform ran it, but that does not check
  types.
- **No live (paid) run, and no check of the chat panel's rendering.** The ended row was read from Core's hub, not from
  the extension UI.
- **Paths not exercised:**
  - an amended plan as the changed brief;
  - a return with a closed `terminalReason` letting an ending through;
  - the refusal held back by the money or turns checks.
- **`provider.receipts` is not useful for supervisor refusals.** It records `evidence.at(-1)`, which is always
  `core.evidence_history` here. The spec scans the evidence for `core.completion_check` entries instead. I left the
  shared helper unchanged.

## Open questions or contradictions found

1. The brief's step 4 ("the build ends with the supervisor's reason") presumed a failed build. In fact a build whose
   brief left a proposal keeps a draft and resolves, and the supervisor's reason appears only in the activity row and
   the record. If a test-facing seam for the build record's ending, or a public activity subscription, is wanted, it
   belongs in Core. The spec's import of `default-hub.js` stands in for it.
2. A repair builder cannot simply end blocked: Core refuses its ending as `subflow.ending_too_soon` until it has tried
   something. So "its builder ends blocked again" here means submit, test, then end.
