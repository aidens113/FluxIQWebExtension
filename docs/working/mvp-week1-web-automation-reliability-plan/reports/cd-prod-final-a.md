# cd-prod-final-a: terminal verification of production-Core campaign A

Campaign `bench-mu2i36f9-ea262b66`, root
`F:\fxlab-runs\prod-core-final\a\bench\bench-mu2i36f9-ea262b66`.

This check was read-only. I created, changed or deleted nothing under `a` or `b`, or in either
repository. The only additions are the `reports` folder and this file. I did not open campaign
B. I read no event messages, page data, environment values or secrets. In Core logs I counted
lines containing the markers `Ready in`, `Compiling` and `(dev)`, and printed no log lines.

The machine has faulty RAM. Each figure below comes from one pass. No script failed or gave an
inconsistent result.

## Outcome

**Done. All eight items are clean.** Nothing contradicts the brief.
- Exactly the nine expected ruled-out variant runs failed.
- **No run has a facility failure.** 0 of 201 `runs.json` rows and 0 of 189 evaluation files
  carry a non-null `facilityFailure`.
- The W28 `gateway.connection` failure seen in the earlier pair did not recur.
- All 190 Core logs show a production start and no dev-compile markers.

Identity:
- Facility commit `118aeb7ffe188d9633d162ee157092e87e50ed67` and Core commit
  `54ae663057983cec0959fbfa782cd23704541de9` (`118aeb7` / `54ae663`). All 189 `run.json` files
  record these commits with `dirty=false`.
- `execution`: `shard-parent`, `result-round-robin-v1`, `shardCount 3`, `jobs 2`.
- `request`: corpus `week1`, repeat 3, target mode `isolated`, evidence `failure`.
- Campaign times: created 09:59:53Z, finished 11:07:29Z, about 67.6 minutes. The root directory
  mtime is 04:07 local, which matches the supervisor's observation.

Things outside the campaign itself, for information:
1. `a\run-mu2i18kx-25eec9be` is an extra run bundle beside the 189 campaign bundles. It is a
   pre-campaign run:
   - It started 09:58:23Z and finished 09:59:31Z, before the campaign was created.
   - Scenario `basic-form`, verdict `passed`, same commits as the campaign.
   - It appears in no checkpoint and not in `runs.json`, and it has no `bench-receipt.json`.
   - It is the only bundle with `logs/core-web-build.log` and a `core-web-build` process exit.
   - Its `bundle.complete.json` digest matches its `artifact-index.json`.
2. `a\.core-web-build\6ac4f31e34cc2e50f3e864ff\` is the cached production Core build: 3286
   files, 239 directories, and a `published.json` with keys `schemaVersion`, `key`,
   `attempt`. Every symlink under `a` is inside it (section 5).

## What changed and why

Nothing in the campaign or the repositories. I created
`F:\fxlab-runs\prod-core-final\reports\` because it did not exist, then wrote this report there.
Scratch scripts are in my session scratchpad (`...\scratchpad\cdpfa\`).

## 1. Coverage

**189 evaluated plus 12 planned skips = 201 cells. 0 duplicates, 0 missing, 0 extra.**

Parent plan (`campaign.json`):
- 201 cells, 201 unique `cellKey`s, all 201 `resolved: true`.
- 189 have `skipReason: null`. All 12 skips are flow lane: 6 for W04 and 6 for W08.
  Both reasons say the Flow lane builds its Flow from the workflow's own recording, and no step
  of the recording script records a usable action.
- By lane: recording 69 cells, all evaluable; flow 132 cells, 120 evaluable.

Parent `runs.json`:
- 201 rows: 189 `evaluated`, 12 `skipped`.
- The rows match plan order, identity and skip status with 0 mismatches.
- All 189 evaluated runIds are unique, and all are in the parent terminal checkpoint.

Parent `report.json`: 63 workflows (23 recording, 40 flow). The lane run totals are recording 69
and flow 120, which add up to 189.

Shards:

| Shard | benchId | Plan cells | Skips | Terminal `completed` | Completed outside plan | Non-skipped not completed |
| --- | --- | --- | --- | --- | --- | --- |
| 000 | `bench-shard0-ea2a98f6` | 69 | 3 | 66 (unique) | 0 | 0 |
| 001 | `bench-shard1-c746dc2e` | 66 | 6 | 60 (unique) | 0 | 0 |
| 002 | `bench-shard2-20ef5c84` | 66 | 3 | 63 (unique) | 0 | 0 |

- The shard plans total 201 keys, all unique. Every parent key is in exactly one shard, and no
  shard key is outside the parent plan.
- Shard cells equal their parent cells in identity, `resolved`, `skipReason` and
  `expectedFailure`, with 0 differences.
- Across shards, 189 keys were completed and 189 are distinct: **0 duplicates, 0 missing and
  0 extra** against the parent's 189 evaluable keys.
- The parent terminal checkpoint also holds those 189 keys, all unique, with 0 missing and
  0 extra.

## 2. Checkpoint chains

| Chain | Generations | States | Terminal | activeAttempt | completed | Self-digests recomputed | Non-generation files | Issues |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| parent | 3 (0..2) | running 1, aggregating 1, finished 1 | finished | null | 189 | 3/3 | 0 | 0 |
| shard 000 `bench-shard0-ea2a98f6` | 134 (0..133) | running 132, aggregating 1, finished 1 | finished | null | 66 | 134/134 | 0 | 0 |
| shard 001 `bench-shard1-c746dc2e` | 122 (0..121) | running 120, aggregating 1, finished 1 | finished | null | 60 | 122/122 | 0 | 0 |
| shard 002 `bench-shard2-20ef5c84` | 128 (0..127) | running 126, aggregating 1, finished 1 | finished | null | 63 | 128/128 | 0 | 0 |

These properties held for every generation of all four chains:
- Filename index = `generation` field = position in the chain.
- Generation 0 has `previousSha256: null`. Every later `previousSha256` equals the prior
  generation's `checkpointSha256`.
- `completed` never shrinks, and earlier entries are never rewritten.
- `finished` appears only at the last generation.
- Each chain has one `campaignId` and one `planSha256`, and each terminal checkpoint's
  `campaignId` and `planSha256` equal its `campaign.json`.

This time I recomputed every generation's self-digest, not only the terminal ones: 387/387
match. The digest is sorted-key JSON of the checkpoint without `checkpointSha256`.

## 3. Evaluation, receipt and bundle parity

**All checks passed for all 189 runs, with 0 issues.**

Parent `evaluations/`:
- 189 files, 0 strays.
- All 189 checkpoint entries point to `evaluations/<runId>.json`.
- SHA-256 of the file bytes equals `evaluationSha256` in 189/189. The file's `runId` equals the
  entry's in 189/189.

Shard `evaluations/`:
- 66/60/63 files, 0 strays.
- The digest matches in 189/189.
- Each shard entry's `cellKey` and `evaluationSha256` equal the parent entry's in 189/189.
- The files are byte-identical to the parent copies in 189/189.

`runs.json` rows:
- `evaluation` equals `shards/NNN/evaluations/<runId>.json` in 189/189.
- `verdict` and `facilityFailure` equal the evaluation file's in 189/189.

Bundles:
- `a\` holds 193 directories: `.core-web-build`, `.work`, `bench`, `run-mu2i18kx-25eec9be` and
  189 campaign bundles. No campaign bundle lacks a completed runId.
- `bundle.complete.json` is present in 189/189, and its `artifactIndexSha256` equals the raw
  bytes of `artifact-index.json` in 189/189.
- `bench-receipt.json` matches in 189/189:
  - `campaignId` equals the shard `benchId` and the shard checkpoint `campaignId`.
  - `cellKey` and `runId` equal the entry.
  - `planSha256` equals the shard plan.
- `cellIdentity` has exactly the six identity fields, equal to the parent plan cell, in 189/189.
- `attempt` equals the runId's `-aN` suffix in 189/189. All 189 runs are attempt 1.
- The bundle `evaluation.json` is byte-identical to the campaign copy in 189/189.

## 4. Merge seal

**Every listed digest recomputes and matches: 24/24, 0 mismatches.**

| Digest | How recomputed | Result |
| --- | --- | --- |
| `parentPlanSha256` 48ffcbcf… | sorted-key JSON of parent `.plan`; also equals `campaign.json` `planSha256` | match |
| `parentManifestSha256` 19126407… | sorted-key JSON of the whole parent `campaign.json` | match |
| child 0/1/2 `terminalCheckpointSha256` (bba7451e…, 7d934186…, 8f70ff61…) | terminal checkpoint field, and recomputed as sorted-key JSON without that field | match x3 |
| child 0/1/2 `runsSha256` | raw bytes of `shards/00N/runs.json` | match x3 |
| child 0/1/2 `reportSha256` | raw bytes of `shards/00N/report.json` | match x3 |
| child 0/1/2 `markdownSha256` | raw bytes of `shards/00N/report.md` | match x3 |
| child 0/1/2 `planSha256` | sorted-key JSON of the shard plan; also equals the shard `planSha256` field and the terminal checkpoint `planSha256` | match x3 |
| child 0/1/2 `manifestSha256` | sorted-key JSON of the whole shard `campaign.json` | match x3 |
| `merged.runsSha256` 8ac9ea5d… | raw bytes of parent `runs.json` | match |
| `merged.reportSha256` 0ca9ed85… | raw bytes of parent `report.json` | match |
| `merged.markdownSha256` 8dc04e3b… | raw bytes of parent `report.md` | match |
| `sealSha256` 8279d0eb… | sorted-key JSON of `merge-seal.json` without `sealSha256` | match |

The count of 24 is 18 per-child digests, 3 merged, 2 parent and the seal itself.

Identity checks also matched:
- `parentCampaignId` equals the parent `benchId`.
- Each child's `index` is 0/1/2.
- Each child's `campaignId` equals the shard `benchId` and checkpoint `campaignId`.
- Each shard's `execution` is `shard-child`, with `parentCampaignId`, `parentPlanSha256` and
  `shardIndex` all correct.

As expected, hashing the raw bytes of the terminal checkpoints and of the parent `campaign.json`
does not match: those digests use the sorted-key form.

## 5. Residue

- **Lease files: 0.**
  - The four `lease-history` directories (parent and three shards) hold 0 files each.
  - No file anywhere under `a` has a name containing `lease`.
  - 0 `*.lock` files.
- **`.staging-*`: 0. `interrupted`: 0.** 0 `*.partial` or `*.incomplete` files.
- **`.tmp`: 0 anywhere under `a`.** The search covered `*.tmp`, `*.tmp.*`, `*.tmp-*` and any
  name containing `tmp`, case-insensitive. That includes `bench`, all bundles and
  `.core-web-build`.
- **`a\.work`: exists and is empty** (0 entries).
- **Symlinks: 18 found by `find -type l`, all inside `a\.core-web-build\…\b-69f7b481e10f\`.**
  - One is `packages`. The other 17 are under `apps\web\node_modules`: `.bin`,
    `@axe-core/playwright`, `@playwright/test`, `@types/node`, `@types/react`,
    `@types/react-dom`, `@types/react-test-renderer`, `@xyflow/react`, `fluxiq`,
    `lucide-react`, `next`, `react`, `react-dom`, `react-test-renderer`, `sqlite3`,
    `typescript` and `vitest`.
  - Windows' `dir /AL /S` lists 49 reparse points, also all under `.core-web-build`. It recurses
    through the links, so it counts nested entries too.
  - **0 symlinks or reparse points** are in `bench`, the campaign bundles or the pre-campaign run
    bundle.

## 6. Outcomes

Verdict counts from parent `runs.json`: **passed 180, failed 9, skipped 12**. The evaluation
files agree: 180 passed, 9 failed.

**Facility failures: 0**, in both `runs.json` and the evaluation files.

| Row | Scenario / variant | Lane | Repeat | runId | failureCategory | facilityFailure | Oracle / reported verdict | Reported automation failure | Plan expectedFailure |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| W05 | product-catalog / short-catalog | flow | 0 | bench-shard2-20ef5c84-c9-a1 | runtime.behavior | null | passed / failed | target_not_found, web.target.not_found | null |
| W05 | product-catalog / short-catalog | flow | 1 | bench-shard2-20ef5c84-c10-a1 | runtime.behavior | null | passed / failed | target_not_found, web.target.not_found | null |
| W05 | product-catalog / short-catalog | flow | 2 | bench-shard2-20ef5c84-c11-a1 | runtime.behavior | null | passed / failed | target_not_found, web.target.not_found | null |
| W13 | modal-flows / banner-absent | flow | 0 | bench-shard2-20ef5c84-c30-a1 | runtime.behavior | null | failed / failed | target_not_found, web.target.not_found | null |
| W13 | modal-flows / banner-absent | flow | 1 | bench-shard2-20ef5c84-c31-a1 | runtime.behavior | null | failed / failed | target_not_found, web.target.not_found | null |
| W13 | modal-flows / banner-absent | flow | 2 | bench-shard2-20ef5c84-c32-a1 | runtime.behavior | null | failed / failed | target_not_found, web.target.not_found | null |
| W24 | intermediate-state / unannounced | flow | 0 | bench-shard1-c746dc2e-c51-a1 | runtime.behavior | null | passed / passed | null (expected output_not_observed) | output_not_observed |
| W24 | intermediate-state / unannounced | flow | 1 | bench-shard1-c746dc2e-c52-a1 | runtime.behavior | null | passed / passed | null (expected output_not_observed) | output_not_observed |
| W24 | intermediate-state / unannounced | flow | 2 | bench-shard1-c746dc2e-c53-a1 | runtime.behavior | null | passed / passed | null (expected output_not_observed) | output_not_observed |

**The failed set is exactly the nine expected ruled-out variant runs**: 3 each for W05
`short-catalog`, W13 `banner-absent` and W24 `unannounced`. Nothing else failed. For every
failed run, `run.json` `status` is `failed` and its `automationFailure` category and code equal
the evaluation's reported failure.

For information:
- 30 passed runs sit in plan cells with a non-null `expectedFailure`.
- Flow-lane rates:
  - `failureClassificationAccuracy` 30/33
  - `falseFailure` 3/84
  - `falseSuccess` 0/3
  - `fuzzyRecovery` 18/24
  - `flowCreationSuccess` 40/40
  - `initialExecutionSuccess` 27/29
  - `deterministicReplaySuccess` 54/58
- Recording-lane rates:
  - `initialExecutionSuccess` 5/23
  - `deterministicReplaySuccess` 10/46
  - `falseFailure` 0/15

## 7. Evidence

- **Harness activations: 0.** Recording 0/69 (23 workflows), flow 0/120 (40 workflows), both
  rate 0. Summed across the 189 evaluation files: 0, with 0 runs non-zero.
- **Redaction attestation findings: 0.**
  - `snapshots/redaction-attestation.json` is present in 189/189, with status
    `not-applicable` 180 and `passed` 9.
  - `findingCount` sums to 0. The `findings` arrays total 0 and `advisories` total 0.
  - `run.json` `redactionState` is `not_applicable` 180 and `verified` 9.
  - `report.json` has no attestation field; these figures come from the bundles.
- **Packet bytes (`sanitizedPacketBytes`):**
  - `report.json`: 612 samples, p50 4069, **p95 5934**.
  - The 189 evaluation files give the same 612 samples, all in the flow lane, and the same p50
    and p95 by nearest rank.
  - **Max 5992**, min 528. The maximum is not in `report.json`; it comes from the evaluation
    files.
- **Truncations: 165.** `report.json` and the evaluation files agree. They come from 30 runs,
  all in the flow lane.
- **Run duration:**
  - `report.json`: 189 samples, **p50 21235 ms, p95 35059 ms**. Recomputing by nearest rank
    gives the same values. Max 53342 ms, min 3637 ms.
  - By lane, as n / p50 / p95 / max:
    - recording: 69 / 10633 / 17934 / 21417
    - flow: 120 / 25475 / 40195 / 53342
  - The earlier `sharded-final-2` campaign A report gave p50 93100 ms and p95 113134 ms.
- Other figures:
  - `notExecutedRuns` 54 and `actionsExecuted` 336.
  - `llm` is disabled, with 0 calls.
  - `rawSnapshotBytes` has 0 samples.
  - `harnessRecovery` and `adaptationPersistence` are null.
  - All 189 runs have target mode `isolated`.

## 8. Production Core

- **Bundles with `logs/core.log`: 190.** That is all 189 campaign bundles plus the pre-campaign
  run `run-mu2i18kx-25eec9be`. No bundle lacks a `logs` directory.
- **Production start with no dev-compile markers: 190/190.** Each log has exactly 1 line
  containing `Ready in`, 0 containing `Compiling` and 0 containing `(dev)`.
- **Bundles that fail this: none.**
- **`logs/core-web-build.log`: present in 1 bundle only**, the pre-campaign run
  `run-mu2i18kx-25eec9be`. It is absent from all 189 campaign bundles.
  - Consistent with that, the 189 campaign `run.json` files record process exits for
    `fluxiq-web` and `scenario-lab` only. The pre-campaign run also records `core-web-build`.
  - This fits a single cached production build made before the campaign and reused by every
    run. I did not read the build log or the cache contents to confirm this.

## Commands run and observed results

All from the Bash tool, read-only, over `F:\fxlab-runs\prod-core-final\a`:
- `find` / `ls` to list the layout, `.work`, `.core-web-build` and one sample bundle. 189
  campaign bundle directories; `.work` empty.
- A `node` shape script printing key structure only.
- A residue `find`:
  - leases 0, locks 0, `.staging-*` 0, `interrupted` 0, `.tmp` 0, partial/incomplete 0
  - `.work` 0 entries
  - symlinks 18, all under `.core-web-build`
- `cmd /c dir /AL /S /B` piped to counts: 49 reparse points, 49 under `.core-web-build`, 0
  outside.
- A `grep -c -F` loop over `logs/core.log`: `core.log bundles=190 prodOk=190 webBuildLogs=1`,
  with `ready=1 x190`, `compiling=0 x190`, `dev=0 x190`.
- `node scratchpad\cdpfa\verify.js`: every figure in sections 1–4, 6 and 7. It ended with
  `ISSUES 0 []`.
- `mkdir -p F:\fxlab-runs\prod-core-final\reports` (the folder was missing).
- No `pnpm`, build, test or `pnpm lab` commands were run, and no git commands.

## Not verified

- The canonical sorted-key hashing form was not read from source. I reused the earlier report's
  inferred form, and it matched all 24 seal digests and all 387 checkpoints.
- Whether the nine variant failures were formally ruled out as defects. I checked only that
  they are the expected cells and carry no facility failure.
- The contents of `logs/core-web-build.log`, the `.core-web-build` cache and
  `F:\fxlab-runs\prod-core-final\logs\`. I did not open them, so it is unconfirmed that exactly
  one build served every run.
- The durable-writer temporary fix beyond observing 0 `.tmp` files anywhere under `a`.
- The slot-probe PowerShell churn fix. Campaign artifacts carry no process-spawn evidence.
- Campaign B.

## Open questions or contradictions found

No contradictions with the brief. Two observations for the supervisor:
1. Two new items sit at the bundle root `a\`, outside the campaign: `.core-web-build`, which is
   the cached production Core build with 18 internal node_modules/packages symlinks, and
   `run-mu2i18kx-25eec9be`, a passed pre-campaign run bundle. The earlier campaign A root held
   only `bench` and `.work`. If the residue gate requires no symlinks under the run root, it
   needs to exclude `.core-web-build`.
2. The W28 `gateway.connection` facility failure from the earlier pair did not recur. That is one
   observation, so it is not proof the defect is fixed.
