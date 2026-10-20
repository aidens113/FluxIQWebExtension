# Report: lane-t-p4d-prep (prepare the social gate experiment's tools)

## Outcome

Done. All four steps are built and tested, and the CLI is prepared. Nothing was run as an offline trial: Core exports no offline runner yet. Some limits came out of the work:

- **Step 2 (rebuild through Core) works only for revisions 10 and 16** of brief 1, plus brief 2's revision 11. Each rebuild reproduces Core's subflow and whole digests exactly. Revisions 3, 4, 7, 11 and 13 can't be rebuilt. Their reads name a `text` column, and revisions 3, 7 and 13 also click a control. The meanings of those handles lived only in the build process's memory, and no persisted candidate holds them.
- **Step 3 (oracle verdicts)** agrees with every recorded live result. The two judged trials were "no" live and fail the oracle. The six `execution_failed` trials had no judge, and they fail the oracle too.
- **Step 4 (tier-1 correction of revision 10) can't reach the oracle's answer.** Revision 10 never stored a `text` column. Its `group` column holds the author for all 3 expected posts. Core's post-processing can neither add a column nor move values between columns. I propose the nearest honest correction below. As a sample, I also built a tier-1 correction that only changes `minRows` and so leaves the answer unchanged. It shows the correction path works.

I made no model call and started no Lab run. I didn't touch lane trees, lab slots, t743 or t745, and I didn't rebuild or edit Core.

## What changed and why

Everything is under `packages/test-runner/src/offline-trial-experiment/`, with one export per file, a barrel in each directory, and tests in each `tests/`.

**Root files**
- `types.ts`: the report shapes. They hold only identifiers, digests, counts, codes and field names.
- `json-record.ts`
- `lab-subflow-steps.ts`: reads the accepted `core.submit_subflow` steps (with their scripts) and every `core.test_subflow` step from a Lab run's `steps/`.
- `store-trace-manifests.ts`: reads manifests, event counts and artifact counts through Core's `AutomationStudioProjectGatewayTraceStore`.
- `traced-revisions.ts` (step 1): maps each `test` trace to its candidate. The trace's `candidate_trial` context gives the whole revision and digest. The test step gives the subflow proposal. The submission is the latest accepted submit of that proposal before the test.
- `project-build-state.ts`: reads the build record and the `candidate-draft` from the copied `global.sqlite` `automation.state`, read-only and by id. Core exports no reader for them.
- `experiment-session.ts`: opens a copied store once, with everything the survey and the trial command share.
- `survey-experiment.ts`: steps 1 to 4 in one JSON report.
- `offline-trial-request.ts`: the request for the runner. It refuses a recorded revision whose digests do not verify.
- `cli-arguments.ts`, `cli.ts`: the command line.

**`rebuild/`** (step 2)
- `core-authoring.ts`: loads the Core pieces the build runs when a model submits. `fluxiq/automation-studio` doesn't export them, so they are loaded from the resolved Core dist, beside its public entry:
  - `project-agents/dispatch/scope.js`, which maps a brief to its scope;
  - `flow-bootstrap/subflow-candidate/scoped-submission.js`, the scoped controller that makes the proposal and the subflow digest;
  - `project-agents/single-subflow/assemble-latest.js`, which joins the proposal behind the arrival step and submits it through the whole candidate's controller.

  It also loads the domain's `plan-resolution/extraction/conditions.js` from `domain/dist`. Nothing is copied by hand.
- `web-authoring-surroundings.ts`: the web node library and resolution (`webNodeRuntime()`), and the domain's `runsNodes`. These come from an evidence runtime whose gateway has no session and refuses every command.
- `recorded-resolutions.ts`: rebuilds the persisted candidate from its own script (step 0141). Each question Core asks the domain is paired, in order, with the step at the same place in the persisted plan. The pairing proves itself when both rebuilt digests equal the persisted candidate's.
- `recorded-resolution-binding.ts`: the domain binding that rebuilds use. It answers in one of five ways:
  - a step written exactly as a recorded step gets that step's resolution;
  - a step that names no handle is left `unchanged`;
  - a read that differs only in `extractList.where` gets the recorded resolution, with the clause read by the domain's own condition reader. This happens only when that reader gives back the recorded read's own clause.
  - a read that differs only in `recordOutput.process` (tier 1) carries that processing as written;
  - anything else is refused `web.handle.unknown`, with the paths that differ from the nearest recorded step.
- `rebuild-candidate.ts`: the scoped controller, then `assembleLatest`, then the whole controller, then a comparison of Core's digests with the recorded ones. Both controllers are fresh, so the rebuilt revision number is 1. The recorded revision is reported beside it.
- `differing-paths.ts`
- `record-processing-script.ts` (step 4): replaces only one labelled step's `recordOutput.process:` line. Core then compiles the result like any other submission.
- `script-extract-nodes.ts`: counts the reads a script has, as Core's acceptor reads it, for the oracle.

**`oracle/`** (step 3)
- `oracle-expectation.ts`: the live task's expected dataset. It resolves through `loadCreatedFlowRequest` and the scenario manifest, exactly as a Lab run is judged.
- `trial-datasets.ts`: reads a trial's stored rows through Core's `AutomationStudioProjectRunDatasetStore`, using the Lab's own `readRunDatasets`. A store-backed control answers `get-run-dataset-page`.
- `oracle-verdict.ts`: judges the rows with `judgeCreatedFlowDataset` and `assertCreatedFlowDataset`. It returns counts and the first failure's message, and never the failure's details. If no dataset names a read node, it counts the candidate's reads under a placeholder. Without that, the judgement would say "no extract node" for a trial that stopped before its read.
- `tier1-derivability.ts`: says whether post-processing alone could produce the expected rows.

**Run output** stays in this tree's ignored `test-runs/p4d-prep/`:
- `store/` holds my own copy of the round-4 `.fluxiq`, because opening a store applies Core's migrations. The survey's hash-verified copy under `test-runs/round4/` was not opened.
- `out/survey.json` and `out/audit.txt`.
- `out/request-*.json` holds full requests, including candidate plans, so it has page content.
- `out/process-minrows3.json`

### The CLI (arguments)

```text
node packages/test-runner/dist/offline-trial-experiment/cli.js survey --store <copied .fluxiq> --project <id> --steps <lab-runs/.../steps>
     [--scenario social-network-feed] [--task social-network-feed-recent-group-posts] [--brief brief-1] [--from-revision 10] [--out <file>]
node packages/test-runner/dist/offline-trial-experiment/cli.js trial  --store <dir> --project <id> --steps <dir> --trace <source trace id>
     ( --revision <n> | --process <process.json> [--from-revision 10] [--step-label posts] )
     [--brief brief-1] [--request-out <file under test-runs/>] [--runner <fluxiq/automation-studio export>] [--out <file>]
```

- `--revision` names a recorded revision. It is rebuilt and refused unless its digests verify.
- `--process` gives a hand tier-1 correction of `--from-revision`. Only the labelled step's `recordOutput.process` is replaced by the file's object, or removed when the file holds `null`.
- `--request-out` must lie under a `test-runs` directory, because the request holds the plan.
- `--runner` names Core's offline runner once it is exported. It is called provisionally as `runner(request)` and is expected to answer `{ runId }`, whose stored rows are then judged by the oracle. Adjust that call in `cli.ts` to P4c's real signature.
- Exit codes: 0 done, 2 usage, 3 runner not available (request prepared), 4 candidate not prepared.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-runner exec tsc -p tsconfig.json` printed nothing (`tsc exit=0`). This was the final run, after removing the module's stale `dist` and rebuilding.
- `node --test "dist/offline-trial-experiment/**/*.test.js"`, run in `packages/test-runner`, printed `# tests 33`, `# pass 33`, `# fail 0`. That covers 13 test files.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (218 warning(s), 618 baselined).` No line names `offline-trial-experiment`. An earlier flat layout had 24 files and drew `warn [directory-files] ... 24 source files`; splitting the files into `rebuild/` and `oracle/` cleared it.
- The survey `cli.js survey --store test-runs/p4d-prep/store/.fluxiq --project a846814f-becd-4569-934f-f3a10df1ce79 --steps C:/Users/osrs_/FluxStuff/lab-runs/2026-10-20/run-mvgw3ve5-294881b5/steps --out test-runs/p4d-prep/out/survey.json` exited 0. A grep of `survey.json` for page words returned `0`.

### Trace to revision (step 1)

All 8 traces belong to candidate `candidate.3c2da5f6-ac27-4296-a261-53e0f33a1a0d`. Every subflow revision below is brief 1's.

| Trace | Trial run | Whole rev / digest | Subflow rev / digest | Submit step | Test step | Live verdict / code | Live stored rows | Events / artifacts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| trace.7480feb6-8525-45d0-b097-655124513838 | trial.7c8e2301-… | 1 / 480db038a577…a4c2 | 3 / 7b6eb6bbe5ed…b81b | 0063 | 0065 | execution_failed / candidate.execution_incomplete | not reported | 126 / 4 |
| trace.a4d59680-a35f-4100-b8f9-dccc890b35c6 | trial.c9eb5664-… | 2 / 5eb4bae4eb28…5a2a | 4 / 753f7d9e3103…9bdb | 0069 | 0071 | execution_failed / candidate.execution_incomplete | not reported | 115 / 4 |
| trace.b414b6a4-00a5-4799-b663-6b8ca5bd03c3 | trial.154425ca-… | 3 / b7e2fec46c5e…e0a7 | 7 / 3968cb31b5eb…60a6 | 0087 | 0089 | execution_failed / candidate.execution_incomplete | not reported | 332 / 9 |
| trace.e855db8e-a1ec-4afa-bb15-4bc15d57f3f4 | trial.08cc7673-… | 4 / 5eb4bae4eb28…5a2a | 4 / 753f7d9e3103…9bdb | 0095 (resubmit of 0069) | 0097 | execution_failed / candidate.execution_incomplete | not reported | 118 / 5 |
| trace.f53b350b-3146-40b2-a44d-15ddbf0913a7 | trial.9ddb30fe-… | 5 / 86d511cb0b83…1457 | 10 / b0222c6337bc…4a31 | 0109 | 0111 | no / candidate.trial_judged_no | 15 | 89 / 4 |
| trace.b2b5984c-d314-4b60-81a8-64832069c4b9 | trial.746db4d6-… | 6 / 738539e34c6d…9093 | 11 / f5c4c2d74bee…4de0 | 0117 | 0119 | execution_failed / candidate.execution_incomplete | not reported | 117 / 4 |
| trace.92d5ddeb-dbe6-49ff-83a1-680b84d31890 | trial.24935b2b-… | 7 / 613ee2f26a89…6f76 | 13 / 1ec2247949a0…5d22 | 0127 | 0129 | execution_failed / candidate.execution_incomplete | not reported | 124 / 4 |
| trace.3e353455-9e9e-48da-baba-a06b73f0ccc9 | trial.f0b2dfbd-… | 8 / cfa2549ce1e8…28e2 | 16 / a6aaeb05c6a6…bb91 | 0141 | 0147 | no / candidate.trial_judged_no | 0 | 89 / 4 |

These match the P4s survey's table. The exploration trace, `trace.5c07f127-…`, names build `build.6a028d03-…`, Flow `flow.de7e910c-…` and start `http://127.0.0.1:59747/scenarios/social-network-feed/`.

### Digest verification per revision (step 2)

Every rebuild goes through Core's scoped controller, then `assembleLatest`, then the whole controller, with the recorded-resolution binding. The harvest got 8 distinct resolutions from step 0141 and verified itself: `verified=true` with no pairing failure.

| Revision (brief) | Script (step) | Recorded subflow digest | Rebuilt | Recorded whole | Rebuilt | Result |
| --- | --- | --- | --- | --- | --- | --- |
| 16 (brief-1) | 0141 | a6aaeb05c6a61db22199c2d5abaf48f3a5a3c45b836b4b34710d17ec1b64bb91 | same | 8 / cfa2549ce1e8629fb03c1720372bd19c66d2bde51551ba63f80652cc496228e2 | same | **verified**, both in the harvest and in the survey |
| 10 (brief-1) | 0109 | b0222c6337bc2559db975fdbc3ba2f7aa214e46988337bebd02cdfc44a304a31 | same | 5 / 86d511cb0b83e5c4fee3c23daa971863587dc379d601c52928e21a94b29f1457 | same | **verified**, through the `where` seam |
| 11 (brief-2) | 0191 | a6b51dc2fddd23ce866616b523e780a06a4904a97ac9a70c774bcc575bb5ad05 | same | none (test refused) | 86d511cb… | subflow verified. Its whole equals whole 5, which agrees with Core's refusal `candidate.unchanged_after_no` at 0193. |
| 3 (brief-1) | 0075 | 7b6eb6bb… | refused | 1 / 480db038… | – | `web.handle.unknown`: dom-click `target.handle`, and the read differs at `extractList.fields.text`, `where`, `recordOutput.datasetId` and `schema.fields` |
| 4 (brief-1) | 0095 | 753f7d9e… | refused | 2 and 4 / 5eb4bae4… | – | the read differs at `fields.text`, `where` and `schema.fields` |
| 7 (brief-1) | 0087 | 3968cb31… | refused | 3 / b7e2fec4… | – | the same as revision 3 |
| 11 (brief-1) | 0133 | f5c4c2d7… | refused | 6 / 738539e3… | – | the read differs at `fields.text` and `schema.fields` |
| 13 (brief-1) | 0135 | 1ec22479… | refused | 7 / 613ee2f2… | – | dom-click `target.handle`, and the read differs at `fields.text`, `datasetId` and `schema.fields` |

**How I checked the rebuilds**
- The rebuilt revision 10 differs from revision 16 only at `nodes.9.parameters.extractList.where.*`, in both `plan` and `buildPlan.subflows`.
- I also recomputed revision 8's digest from the stored draft with `automationStudioCandidateFingerprint.candidate`, and it matched.

### Oracle verdicts of the recorded live outcomes (step 3)

The oracle is task `social-network-feed-recent-group-posts`, step `extract-recent-group-posts`, which expects 3 records.

| Trace | Datasets / stored rows | Oracle | Message | Live | Agreement |
| --- | --- | --- | --- | --- | --- |
| f53b350b (rev 10) | 1 / 15 | fail; fields 12/15, matched 0/0 | yielded 15 record(s), expected 3 | no (judges 0114, 0115) | agree |
| 3e353455 (rev 16) | 1 / 0 | fail | yielded 0 record(s), expected 3 | no (0150, 0151) | agree |
| 7480feb6 (rev 3) | 1 / 15 | fail; fields 12/15 | yielded 15, expected 3 | execution_failed, no judge | consistent: rows were stored before the step-13 failure |
| b414b6a4 (rev 7) | 1 / 15 | fail; fields 12/15 | yielded 15, expected 3 | execution_failed | consistent |
| 92d5ddeb (rev 13) | 1 / 0 | fail | yielded 0, expected 3 | execution_failed | consistent |
| a4d59680, e855db8e (rev 4), b2b5984c (rev 11) | 0 / 0 | fail | stored no extraction records | execution_failed at the read | consistent |

The `fields 12/15` figure means the stored rows hold 4 of the 5 required fields at each compared position. `text` is the field that is missing.

### Tier-1 derivability of revision 10 (step 4)

The verdict is `derivable: false`, from 15 stored rows and 3 expected records. These are counts only:
- **Missing column:** `missingColumns: ["text"]`. The read never stored the post text.
- **Wrong element:** `columnsHoldingOther: [{stored: "group", holds: "author", expectedRecords: 3}]`. The stored `group` column holds the expected author for all 3 posts.
- **No match at all:** `coveredOnSharedColumns: 0`. None of the 3 expected records equals any stored row on the 4 shared columns.
- **The posts are present but mislabelled:** an earlier count-only probe found that stored rows 1, 8 and 11 equal the 3 expected posts on the combination of group-equals-author, posted and comments. So revision 10 read the right posts, but bound the wrong elements to `group` and `author`, and never read `text`.

Core's `recordOutput.process` has only `dedupe`, `where`, `sort`, `limit`, `columns` and `minRows`. It cannot add `text` or rename columns. Even selecting the 3 rows would need conditions on the true group, and the true group isn't stored. The only alternative is to list the oracle's own values, which would be teaching to the test.

**Nearest honest correction (tier 2, plus a tier-1 follow-up)**
1. In revision 10's read, bind `group` to the group link and `author` to the people link. Today `author`'s selector is the same link that `posted` reads.
2. Add `text`, the full post body. This is a change to the read's parameters. Offline it needs `extract_list` re-executed over the captured snapshot `a89251e6c353…` (trace f53b350b, seq 79). The recorded result can't answer it.
3. Move the group and date filter from `extractList.where` into `recordOutput.process.where`. The read then keeps every item, and any later filter change becomes a true tier-1 correction.
4. Live, the full text still needs the extension's disclosure-before-`where` defect fixed (P4s, `list-reader.ts`). That is tier 3.

**Sample correction (path check only):** `trial --trace trace.f53b350b-… --process out/process-minrows3.json`, where the file holds `{"minRows": 3}`.
- Core compiled the corrected script to subflow `294843134791ea0bd9a62a7cf5ef5af433fbc3a92b1d2367f2492d62c8186df9` and whole `751bed0edfaa12b4d6e660d5d8f032ae6d4f4142c5ebe7784abe4941b659dd22`, and the command exited 3 (prepared).
- Its plan differs from revision 10's only at `nodes.9.parameters.recordOutput.process.minRows`. Its reads and actions are identical, so under strict matching it should replay revision 10's trace whole.
- Since `minRows` is report-only, the expected offline answer is still revision 10's 15 rows, and the oracle still fails.

### Trial preparation (step 4 CLI), observed

| Command | Exit | Prepared |
| --- | --- | --- |
| `trial --trace trace.f53b350b-… --revision 10` | 3 | `recorded_revision`, subflow b0222c6337bc, whole 86d511cb0b83; twin f53b350b, no, 15 rows |
| `trial --trace trace.f53b350b-… --revision 16` (the P4s primary pair) | 3 | subflow a6aaeb05c6a6, whole cfa2549ce1e8; twin 3e353455, no, 0 rows |
| `trial --trace trace.3e353455-… --revision 16` | 3 | parity on revision 16's own trace |
| `trial --trace trace.a4d59680-… --revision 4` (cross-trace control) | 4 | `A refused rebuild makes no candidate to run` |
| `--runner runAutomationStudioOfflineTrial` | 3 | `fluxiq/automation-studio exports no function runAutomationStudioOfflineTrial yet` |
| `--request-out` outside `test-runs` | 2 | refused, and nothing was written |

## Not verified

- **No offline trial was run.** The runner doesn't exist yet. Whether revision 16 on trace f53b350b reproduces "0 kept" depends on how P4c handles a changed `extract_list` command. Under strict matching it is an evidence gap, and the run is inconclusive.
- **The `recordOutput.process` seam has no recorded twin.** It assumes a written processing replaces Core's default `{minRows: 0}` whole. A correction is a new candidate that no recorded digest can confirm. The `where` seam, by contrast, is confirmed by revision 10's digests.
- **The domain condition reader runs with a reconstructed `detected` vocabulary.** It maps each written field name to the column the build resolved it to. This proved right for revisions 10 and 16 only.
- **`--runner`'s call shape is a placeholder.**
- **Rows read by a trial that stopped early:** I didn't check whether Core's stored "answer" rows for those trials equal what their reads collected.
- **Disclosure:** while investigating, I printed some page content to this session's own output: the task instruction from the exploration manifest, revision 10's and 16's scripts with their `where` values, and accessible names from the persisted plan. None of it is in this report or in any tracked file. Only the ignored `test-runs/p4d-prep/out/request-*.json` files hold plans, by design.

## Open questions or contradictions found

1. **The cross-trace control (revisions 2 and 4) in lane-t-p4's gate plan can't be built.** Revision 4's read names a `text` column whose handle meaning is gone. In round 4, only revisions 10 and 16 have verified candidates, and each has a single live trace. Brief 2's revision 11 is the same whole candidate as revision 5 and has no trace. The gate needs another parity control: for example, revision 10 on f53b350b and revision 16 on 3e353455, each against its own trace. Alternatively, the domain could persist handle meanings so that every revision can be rebuilt.
2. **The rebuild depends on Core modules the package does not export:** `dispatch/scope.js`, `subflow-candidate/scoped-submission.js` and `single-subflow/assemble-latest.js`. It also depends on the domain's `plan-resolution/extraction/conditions.js`. The digest check fails loudly if they drift. Even so, Core could export a "rebuild candidate from script" seam, perhaps with P4c, so this stops reaching into `dist`.
3. **Handle meanings are build-process memory only.** These are the domain's `targetPackets` and `extractionHandles`. Earlier revisions survive only as scripts, so any revision whose handles the latest candidate doesn't use can never be recompiled. This blocks offline trials of earlier revisions in general, not just here.
4. **The derivability result only half-confirms P4s's "group/author swapped" claim.** Revision 10's `group` does hold the author (3 of 3). But its `author` holds no expected column's values. Its selector is the same link that `posted` reads by `aria-label`, so it is probably the time label's text, not the group. I inferred that from the selector and did not verify it by value.
