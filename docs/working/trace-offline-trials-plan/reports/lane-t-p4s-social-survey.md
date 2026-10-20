# lane-t-p4s-social-survey: the social task's candidates, traces and oracle, for the P4 gate experiment

## Outcome

Done. Both runs are mapped revision by revision, with each trial's judged result and the tier of every change. The t742 copy of the round-4 store was gone: `fxwork/t742` now holds only `!FluxIQ`. t566 was idle, so I copied the store again into this tree's ignored `test-runs/` and hash-verified it. I made no model call, started no Lab run, changed no tracked file, and opened no source database in place.

The main finding: **the clean tier-1 pair exists only in the untraced run.** In run-mvfq957o, revision 10 differs from revision 9 only in Core-side `recordOutput.process`. Revision 9 produced the exact oracle answer; revision 10 was judged no. Round 4 has no such pair. Its later revisions differ from earlier ones only in `extractList.where`, and that filter runs **inside the extension's read command**: the recorded result holds only the kept rows. So an offline trial can answer a changed `where` only by re-reading the captured DOM snapshot, not from the recorded result.

## What changed and why

- **Copied (ignored, hash-verified):** `C:/Users/osrs_/FluxStuff/fxwork/t746/!FluxIQWebExtension/test-runs/round4/run-mvgw3ve5-294881b5/`, the whole workspace `claude-social-groups-t566-20261020-r7` from `fxwork/t566/!FluxIQWebExtension/test-runs/instances/rr4-slot-3/persistent-isolated/`. The layout is the same as P3's: the Core store root is `.../run-mvgw3ve5-294881b5/fluxiq-root`. It contains `.identity/`, `.sessions/` and the browser profile, which I did not read. It must never be committed.
- **Written:** this report.
- **Scratch:** throwaway copies of `project.sqlite` (+wal/shm) and of `fluxiq-root/.fluxiq/global.sqlite` went into my scratchpad, were read with `node:sqlite`, then deleted. I did not read `secret.keys` or `identity.users`.

## 1. run-mvfq957o-40103539 (2026-10-19, bf-slot-3, no Core trace)

The evidence is in `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-19/run-mvfq957o-40103539/steps/`. The debug note is `docs/working/language-driven-flow-loop-plan/debugs/run-mvfq957o-40103539.md` (main checkout and t566, identical by grep). Subflow `collect_feed_posts` belongs to candidate `candidate.1d12782f-ba98-462e-b496-7b13a513381f`. Submits at 0039, 0041, 0045 (revs 1-3) and 0079 (rev 8) were refused before they became candidates.

| Test step | Subflow rev / digest | Whole rev / digest | Trial | Result | Tier of the change from the previous tested rev |
| --- | --- | --- | --- | --- | --- |
| 0049 | 4 / ab56815e... | 1 / 7dbfc994... | trial.b3a53049-8069-4b83-a4ec-10e54b7c2582 | execution_failed: step 19 scroll `web.action.invalid_parameter` | first (whole plan) |
| 0053 | 5 / cd043949... | 2 / a2e3d8d2... | trial.852a6b81-36d9-4d03-b1f6-18756b3cb5fc | execution_failed: step 20 `web.validation.output_not_observed` (incomplete text) | action parameter (`scroll.maxScrolls`): tier 3 |
| 0057 | 6 / 3832d9f5... | 3 / 1d1ff11b... | trial.51ddf8ae-bbce-48d0-9777-1321095796e2 | no (judges 0058, 0059): right rows, no text column | nodes, edges and read fields: tier 2/3 |
| 0063 | 7 / 280f41ce... | 4 / b21ab900... | trial.4aef7107-a106-4c8a-ba42-abc9d40858aa | execution_failed: step 20, incomplete text | read field `text` plus columns: tier 2 |
| 0083 | 9 / dde41021...be057 | 5 / 720fad7c...dcf0 | trial.807fb6c4-a7a4-46be-87d2-c4a1bc10c406 | **unsure** (0084 no 0.9; 0085 yes 0.82; 0086 recheck yes 0.8). The debug note found an **exact oracle answer** (3 records, all values and order) | loop and row-bound click restructure: tier 3 |
| 0090 | 10 / 2bb898db...80c9 | 6 / 7a59e7fa...94ca | trial.80a73f91-a135-4c83-b44b-5d8637d48b67 | no (0091, 0092): 8 rows, including groups not joined | **tier 1 only**: script diff 0081→0088 is one line, `recordOutput.process` (changedPaths `...nodes.14.parameters.recordOutput.process.where.0.equals`/`.is`) |
| 0096 | 9 again (resubmitted 0094, same digest dde41021...) | 7 | none finished | `TimeoutError` at the 25-minute work limit (150 s in) | revert of the tier-1 change |

**Why it failed.** The build ran out of time (Core's 30-minute build limit; work stops at 25). The cause was a judge mistake on the correct revision 9: the first call (0084) said no, although every row it named it also granted was rightly out. That split made the verdict unsure. The gate set `retestAdvised: false`, the builder followed the no's advice into the wrong revision 10, and the revert had no time left. **The fatal defect was tier 1:** a post-read filter in Core's `recordOutput.process`. The reads were right.

**Store.** The workspace still exists, unopened, at `fxwork/t566/!FluxIQWebExtension/test-runs/instances/bf-slot-3/persistent-isolated/claude-social-groups-t566-20261019-r4/` (project `64030f2d-58a6-428d-9cc6-58c6245ecf79`). It predates P2, so it holds no trace. I did not copy it or check its tables (not asked).

## 2. run-mvgw3ve5-294881b5 (2026-10-20, round 4, rr4-slot-3, traced)

The evidence is in `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-20/run-mvgw3ve5-294881b5/steps/` and the debug note `debugs/run-mvgw3ve5-294881b5.md`. The source commits were downstream 0cada957 and Core 3b13e394. Candidate `candidate.3c2da5f6-ac27-4296-a261-53e0f33a1a0d`, flow `flow.de7e910c-4fa5-4106-8a2f-620cdb9a4a26`, project `a846814f-becd-4569-934f-f3a10df1ce79`. I opened a throwaway copy of the copied store's `project.sqlite`. It has 9 traces, 2002 trace events and 89 trace artifacts, all `origin_kind: live`, `claimed_completeness: complete`, `terminationReason: completed`. It also has 8 `runtime_runs`, one per trial: 6 failed, 2 succeeded (9ddb30fe and f0b2dfbd).

Exploration trace: `trace.5c07f127-aad7-4151-bae6-818d6693eb41`, activity `exploration`, episode `build.6a028d03-e39f-492a-95cd-a976bc7712f7`, 892 events, 51 artifacts.

Each trial trace's manifest `context.value` carries `candidateId`, the whole `revision` and `digest`, which I checked against the step files:

| Test step | Subflow rev / digest | Whole rev / digest | Trace (activity `test`) | Episode (= trial run id) | Events / artifacts | Live result |
| --- | --- | --- | --- | --- | --- | --- |
| 0065 | 3 / 7b6eb6bb... | 1 / 480db038... | trace.7480feb6-8525-45d0-b097-655124513838 | trial.7c8e2301-8d6d-4b3a-b23e-f2a999f4f7b6 | 126 / 4 | execution_failed: step 13 See more press `web.target.not_found` |
| 0071 | 4 / 753f7d9e... | 2 / 5eb4bae4... | trace.a4d59680-a35f-4100-b8f9-dccc890b35c6 | trial.c9eb5664-4f22-4703-b1a5-c601dbb8d8ea | 115 / 4 | execution_failed: step 10 read `output_not_observed` (incomplete_text) |
| 0089 | 7 / 3968cb31... | 3 / b7e2fec4... | trace.b414b6a4-00a5-4799-b663-6b8ca5bd03c3 | trial.154425ca-ba56-46de-9914-9105828958bb | 332 / 9 | execution_failed: stop past step 40, not listed (`steps_left_out`) |
| 0097 | 4 / 753f7d9e... (same as 0071) | 4 / 5eb4bae4... (same digest as whole 2) | trace.e855db8e-a1ec-4afa-bb15-4bc15d57f3f4 | trial.08cc7673-d519-433a-9fd7-468129d5f8a4 | 118 / 5 | execution_failed: step 10, same as 0071 |
| 0111 | 10 / b0222c63...4a31 | 5 / 86d511cb...1457 | trace.f53b350b-3146-40b2-a44d-15ddbf0913a7 | trial.9ddb30fe-3dfe-4525-a56c-843ec7f9572c | 89 / 4 | **no** (0114, 0115, conf 0.9): the read kept 17 of 32 items; 15 rows stored (17 dataset rows, 15 answer rows); no text column; group/author swapped |
| 0119 | 11 / f5c4c2d7... | 6 / 738539e3... | trace.b2b5984c-d314-4b60-81a8-64832069c4b9 | trial.746db4d6-397b-4279-9a0d-1f7d0d10d62a | 117 / 4 | execution_failed: step 10, incomplete_text |
| 0129 | 13 / 1ec22479... | 7 / 613ee2f2... | trace.92d5ddeb-dbe6-49ff-83a1-680b84d31890 | trial.24935b2b-d5d6-423c-8ac9-a82852028557 | 124 / 4 | execution_failed: first read kept 0 of 30; final read failed at step 14, incomplete_text |
| 0147 | 16 / a6aaeb05...bb91 | 8 / cfa2549c...28e2 | trace.3e353455-9e9e-48da-baba-a06b73f0ccc9 | trial.f0b2dfbd-f6fc-44e6-be93-d08124438b3b | 89 / 4 | **no** (0150, 0151, conf 0.85): read kept 0 of 30, 0 rows stored |
| 0193 | brief-2 rev 11 / a6b51dc2... | none | none | none | none | test refused `candidate.unchanged_after_no` (its script is byte-identical to rev 10's) |

**Tier of each change.** I compared the canonical scripts key by key (`result.json` `script` at each submit step):

- **rev 16 (0141) vs rev 10 (0109): only `extractList.where`.** Same nodes, fields, dedupe and columns.
- rev 11 (0117) vs rev 4 (0069): only `extractList.where`.
- rev 13 (0127) vs rev 7 (0087): only `extractList.where`, in both reads.
- rev 10 vs rev 4: dropped the read field `text` (fields, dedupe, schema): tier 2.
- rev 7 vs rev 3: the click becomes optional and repeats over the rows: tier 3.
- brief-2 rev 11 (0191): identical to rev 10.

**`extractList.where` is not tier 1 in mechanism.** It travels in the `web.dom.extract_list` command's parameters (outbound `server.execute_action`). Rev 10 sends 3 conditions and rev 16 sends 2. The extension applies them during the read. The recorded `client.action_result` for the rev-10 read (trace f53b350b, seq 80) holds:

- `extracted`: the 17 kept records, with 4 fields;
- `extraction.conditions` (`applied` 32, `kept` 17);
- `rejectedSamples`: 2 per condition.

It does **not** hold the 15 rejected rows. A changed `where` is therefore a new gateway command that the recorded result cannot answer. It can be answered only by re-reading the DOM snapshot attached as that result's primary artifact: `text/html`, sha256 a89251e6c353..., 193,438 B, at seq 79 of f53b350b.

**Same page across trials.** The single read of rev 10, and the identical first read of revs 3 and 7 (same fields, same `where`), saw the same snapshot a89251e6c353 in three live trials: 7480feb6, b414b6a4 and f53b350b. All three saw 32 items and kept 17. Revs 13 and 16 (traces 92d5ddeb, 3e353455) instead read a different snapshot, 639e1b0f9e2d, with **30 items**. So live rev 16 did not read the same document as live rev 10.

**Why it failed** (from the debug note, consistent with the above): the build hit the 25-minute work limit with no trial judged yes. The primary cause is tier 2/3, in the extension: `list-reader.ts` runs the disclosure check before `where`, so a collapsed post on a row the `where` rejects still refuses the read. This makes the shape that discloses full text impossible to pass on this page. A model error contributed: group and author bound to each other's selectors for all of brief-1, which is tier 2 (field mapping in the read). The trial feedback hid the stop past step 40.

**No round-4 revision can pass the oracle:** none ever stored a text column.

## 3. Where the candidates are stored, and the oracle

- **The latest candidate only.** The copied `fluxiq-root/.fluxiq/global.sqlite`, table `automation.state`, id `projects/a846814f-becd-4569-934f-f3a10df1ce79/flows/flow.de7e910c-4fa5-4106-8a2f-620cdb9a4a26/candidate-draft`. It holds `kind: flow_candidate_draft`, `candidateId` candidate.3c2da5f6-..., `candidate.revision` 8, `digest` cfa2549ce1e8629fb03c1720372bd19c66d2bde51551ba63f80652cc496228e2 (= subflow rev 16), `status: draft`, the full `buildPlan` (1 subflow, 10 nodes, 12 edges), `changedPaths`, `baseDependencyDigest` 341cc3b6..., `originalInstructionsDigest` 51bd8298..., and `originalSources`.
- **Earlier revisions are not in the store.** The trial session records (`.../runtime/sessions/trial.*`, 5-82 MB each) carry `metadata.candidateTrial` = {candidateId, revision, digest, start, execution} and a `flow` with 0 nodes. `project.sqlite` has 0 rows in `compiled_artifacts`, `graph_revisions` and `subflows`, and `staging/` holds 482 empty directories. The full text of every revision is in the Lab step files: `steps/<NNNN>-tool-core.submit_subflow/result.json` `script` ("script is its whole text", as Core accepted it) with its `revision` and `digest`, plus `call.json`. The same holds for run 1.
- **The build's handle map.** Scripts name targets by build handles (`t271` and the like). `automation.state` `.../domain-build-state/web-automation` holds `web.shown-addresses` (129 addresses) and `web.own-layers` for build.6a028d03. I assume that is what resolves them; not verified.
- **The brief returns.** `.../project-builds/build.6a028d03-.../returns/brief-1` lists the 8 trials with receipt ids, verdicts, and a third digest family per trial (for example 6347756f90f3... for 9ddb30fe). `returns/brief-2` proposes rev 11 / a6b51dc2...
- **The oracle.** `apps/scenario-lab/src/scenarios/social-network-feed/qualification/recent-group-posts/expected.ts`, `recentGroupPostsExpected`. The `extracted` entry is step `extract-recent-group-posts`, `count: 3`, records with columns group, author, posted, text, comments, in feed order. It also has pageFacts and finalState (the account unchanged). The live task (`live-tasks.ts`, id `social-network-feed-recent-group-posts`) has `judgeBy: "expected-dataset"`, `expectedDatasetId: "extract-recent-group-posts"`. The assertion code is `packages/test-runner/src/run-expectations/extraction/judgement.ts` (with `mismatches.ts`).

## 4. Recommendation for the P4 gate experiment

**Primary (traced, both live results known):**
- **Source trace:** `trace.f53b350b-3146-40b2-a44d-15ddbf0913a7` (trial 9ddb30fe, subflow rev 10 b0222c63, whole rev 5 86d511cb). It is short (89 events, 23 commands, 4 HTML snapshots) and was judged, with 15 stored rows.
- **Corrected candidate:** subflow rev 16 (a6aaeb05..., whole rev 8 cfa2549c...). It is the persisted `candidate-draft`, so it loads from the store directly, and it differs from rev 10 only in `extractList.where`.
- **Live result to match:** trial f0b2dfbd, trace 3e353455: execution completed, read kept 0, 0 rows stored, judged no.
- **What it proves:** that the offline trial re-reads a captured snapshot under new read conditions. That is exactly the change the builder made.

**Caveats:**
- The offline trial reads snapshot a89251e6c353 (32 items), while live rev 16 read 639e1b0f9e2d (30 items). "0 kept" should hold on both, because its group condition tests author values, but that is unverified. A different count would be a reading divergence, not necessarily a defect.
- Rev 10's own trace contains no read with rev 16's conditions, so this needs snapshot re-execution of `extract_list`. If P4's runner only answers commands from recorded results, this pair falls outside it.

**Control (the same candidate, two live traces):** whole revs 2 and 4 share digest 5eb4bae4... (traces a4d59680 and e855db8e). Both failed at step 10 with the same incomplete_text refusal. An offline trial of that digest against either trace should reproduce the other's outcome. That is a parity check with no correction involved.

**The only true tier-1 pair (needs a new trace):** run 1's rev 10 → rev 9, which changes only Core's `recordOutput.process` filter. With a trace of rev 10's live trial, the offline trial would answer every read from recorded results and recompute the stored rows. The known live result of rev 9 is the exact oracle answer (judged unsure). This is the cleanest gate, and the only one where the oracle verdict is a pass, but run 1 has no trace. A hand correction of round 4 cannot substitute: its defects (missing text column, swapped field selectors, conditions applied inside the read) are all in read parameters.

**What "reproduces the judged result" can mean provider-free:**
- (a) The **trial outcome data the judge saw** matches the live trial's:
  - the verdict class (completed vs execution_failed) and the stopping step and code;
  - each read's `extraction` counts (itemsSeen, kept, recordCount);
  - the stored run dataset (the dataset `list-the-posts-in-the-feed-collect_feed_posts-s9` rows and answer rows: 17/15 for rev 10, 0/0 for rev 16), compared record by record;
  - the feedback's `stored.rows`.
- (b) The **Lab oracle's verdict**: `judgement.ts` over the stored rows against `expected.extracted` gives the same pass or fail. For both round-4 candidates that is a fail (no text column, wrong count).

The LLM judge's yes or no cannot be reproduced without a model call. Matching the judge's input (a) is the provider-free substitute.

## Commands run and observed results

- Idle check at 12:42 local, before the copy:
  - `Get-CimInstance Win32_Process` filtered on `fxwork[\/]t566` → `procs: 0`;
  - files under `rr4-slot-3` newer than 10 minutes → `recent: 0` (PowerShell) and `0` (bash `find -mmin -10`);
  - destination absent (`Test-Path` False).
- `cp -a` of the workspace, then both sides measured as file count, `du -sb`, a SHA-256 over the per-file hashes of all `*.sqlite*`, and a SHA-256 over all files outside the profile, identity and session directories:
  - source `794 849290136 62a40a83dd0d c33569e948b3`;
  - copy `794 849290136 62a40a83dd0d c33569e948b3`.
  - The SQLite hash equals P3's (62a40a83dd0d).
  - `git check-ignore -v` → `.gitignore:15:test-runs/`.
  - `git status --short` shows only a pre-existing untracked `reports/lane-t-p4.md`, which is not mine.
- Throwaway copy of `project.sqlite`, read with `node:sqlite`:
  - table counts: `client_gateway_traces` 9, `client_gateway_trace_events` 2002, `client_gateway_trace_artifacts` 89, `runtime_runs` 8, `flows` 1, `run_datasets` 5;
  - trace rows, manifests, per-trace command sequences and `extract_list` result shapes (tables above).
  - The extract results were read from the copy's `objects/sha256/...json` files.
- Throwaway copy of `global.sqlite`: `automation.state` ids and record shapes only.
- Step-file summaries (python `-I`) over both runs' `submit_subflow`/`test_subflow`/judge folders, and key-level `difflib` diffs of the canonical scripts.

## Not verified

- That rev 16 keeps 0 rows when its `where` is evaluated over snapshot a89251e6c353 (32 items), and why rev 13 and rev 16 read a different 30-item document.
- That the build handle map in `domain-build-state` is what an offline loader needs to resolve script targets.
- What the third digest family in the brief returns hashes.
- Whether the run-1 store (bf-slot-3) holds a `candidate-draft` for rev 9 or any trace tables (not opened).
- Whether Core's trace reader accepts the round-4 traces (only rows were read, not through Core).
- The oracle-match claim for run 1's rev 9 is the debug note's, not re-checked here.

## Open questions or contradictions found

1. The debug note for round 4 mixes subflow and whole revision numbers (for example "0111 rev 5" is whole 5 / subflow 10, and "0147 rev 15" is subflow 16 / whole 8). The tables here give both.
2. The P4 gate needs a decision: does an offline trial re-execute `extract_list` over captured snapshots (needed for any round-4 correction), or only answer commands from recorded results (needed for a pure tier-1 pair, which only an untraced run has)?
3. Earlier candidate revisions persist only in Lab step files. If P4 must load "an earlier revision" from the project store, Core keeps only the latest draft.
