# br-sharded-final-2-b: terminal verification of Week 1 campaign B

Campaign `bench-mu202snn-ec661de2`, root
`F:\fxlab-runs\sharded-final-2\b\bench\bench-mu202snn-ec661de2`, bundles under
`F:\fxlab-runs\sharded-final-2\b\`. Verified on 2026-09-15 by a read-only worker.

## Outcome

Done. All seven checks passed. The only failed runs are the ten the brief
expected, and nothing else is flagged. There are no digest, chain, parity or
residue defects.

Figures at a glance:

- **Plan:** 201 cells: 189 evaluated and 12 planned skips.
- **Verdicts:** 179 passed and 10 failed.
- **Merge seal:** 24 of 24 digests match.
- **Chains:** all four checkpoint chains (the parent and three children) are
  intact and end in `finished`.
- **Evaluation copies:** all 189 are byte-identical across the child copy, the
  parent copy and the bundle.
- **Leftover files:** none.
- **Quarantined temp file:** its hash equals the c15 evaluation's hash.

## What changed and why

The only file created is this report. Nothing was created, moved or deleted
anywhere else under `F:\fxlab-runs\sharded-final-2` or in either repository.
Two read-only Node scripts and their outputs are in the session scratchpad
(`...\scratchpad\brb\verify-b.mjs`, `followup-b.mjs`, `*.out.txt`). They
reimplement the product's checks from these files:

- `bench/campaign/identity.ts`: canonical JSON, cell key and plan hash.
- `bench/campaign/store.ts`: checkpoint chain and hash rules.
- `bench/campaign/shard-group-store.ts`: seal construction.
- `bench/shard-merge.ts`: evaluation directory, identity and receipt checks.
- `bench/sharded-bench.ts:277-279`: the merged projection digests are SHA-256
  of the raw file bytes.
- `bench/distribution.ts`: nearest-rank p50 and p95 with an epsilon of 1e-9.

No `pnpm lab`, build or test was run. No event messages, logs, page data,
environment values or invariant expected/actual strings were read or printed.

## Commands run and observed results

- `node verify-b.mjs`, whose final section `PROBLEMS` printed `none`.
- `node followup-b.mjs`, which explains the `runs.json` `facilityFailure`
  count; see the open questions section.
- PowerShell `Get-ChildItem` directory listings.

### 1. Coverage

- **Parent manifest**
  - Execution: `shard-parent`, `result-round-robin-v1`, shardCount 3, jobs 2.
  - Request: corpus `week1`, repeatCount 3, target `isolated`, evidence
    `failure`.
  - Compatibility: facility commit `3d6ecd645e92`, Core commit `19468b72c447`.
- **Parent plan**
  - 201 cells: 12 skipped and 189 executable.
  - The `planSha256` recompute matches `48ffcbcf…6560`.
  - Cell key and ordinal recomputes: 0 failures. Unique cell keys: 201.
  - Lanes: recording 69, flow 132. Each repeatIndex (0, 1, 2) has 67 cells.
- **Skips (12)**
  - Cells: W04 `product-catalog` flow (variant null and `text-variant`) and
    W08 `data-table` flow (variant null and `column-reorder`), 3 repeats each.
  - Reasons: two texts, 6 cells each. Both say a Flow cannot be built because
    no recording step records an action; one names "extract" only, the other
    "extract, checkpoint".
- **Child plans**

  | Child | Plan cells | Skipped | Executable | `planSha256` recompute |
  | --- | --- | --- | --- | --- |
  | 0 `bench-shard0-0f1bc4b3` | 69 | 3 | 66 | match |
  | 1 `bench-shard1-d0825d39` | 66 | 6 | 60 | match |
  | 2 `bench-shard2-fdae3012` | 66 | 3 | 63 | match |

  - Every child inherits the parent's request, compatibility and createdAt.
    The child execution identity names the parent ID and parent plan hash.
  - Union of the child plans: 201 cells, 201 unique, 0 duplicates, 0 missing,
    0 not in the parent.
  - Every child cell is identical to the parent cell, ignoring ordinal.
- **Completed cells across children:** 189, with 0 duplicate run IDs, 0
  duplicate cells, 0 executable parent cells missing, and 0 completions
  outside the executable plan.
- **Parent `runs.json`**
  - 201 rows: status `evaluated` 189, `skipped` 12.
  - Verdicts: passed 179, failed 10. The 12 skipped rows have no verdict.
  - 201 unique cell keys, with 0 missing and 0 extra against the plan.
  - `startedAt` 2026-09-15T01:35:42.997Z, `finishedAt` 2026-09-15T09:31:13.771Z.
- **Parent `report.json`**
  - Workflows: 63, summing to 189 runs.
  - flakeClass: `stable-pass` 59, `stable-fail` 3, `flaky` 1.
  - `runDurationMs` {samples 189, p50 92168, p95 113054}.
  - `notExecutedRuns` 55, `actionsExecuted` 334, `truncationCount` 165.
  - llm: `disabled`, 0 calls.

### 2. Checkpoint chains

The same checks passed in all four chains:

- Each chain has contiguous generations starting at 0.
- There are 0 non-generation files.
- Every file has the exact key set.
- `checkpointSha256` recomputes (canonical JSON of the checkpoint without that
  field) with 0 failures.
- Every `previousSha256` equals the prior generation's `checkpointSha256`
  (0 bad links). Generation 0 has `null`.
- campaignId and planSha256 match the manifest.
- Completion lists only ever extend the previous generation.
- There are no duplicate or unknown completions.
- Every active attempt is a valid incomplete executable cell.

| Chain | Generations | States | Terminal | Completed | Terminal `checkpointSha256` | Terminal file time (local) |
| --- | --- | --- | --- | --- | --- | --- |
| parent | 3 (0..2) | running 1, aggregating 1, finished 1 | finished, activeAttempt null | 189 | `5aff8ca16f91e228cb421d686f53da49616859c0d01d46b2f7862305d54f8ed2` | 2026-09-15 02:31:13 |
| child 0 | 134 (0..133) | running 132, aggregating 1, finished 1 | finished, activeAttempt null | 66 | `fdbd7bcfa1f8e1663ca887925cc6071b3f1ff03f93e5934c034e1c33186fbeac` | 2026-09-14 22:33:53 |
| child 1 | 122 (0..121) | running 120, aggregating 1, finished 1 | finished, activeAttempt null | 60 | `6096ba1ddfb137161ba8139038568d9d837fb66599e9fea6793f8bbae1c40fc1` | 2026-09-14 22:15:00 |
| child 2 | 128 (0..127) | running 126, aggregating 1, finished 1 | finished, activeAttempt null | 63 | `c160c765ead79ce2d68938090077dafb08e0626cb43090657b358987dd9a60c1` | 2026-09-15 00:04:56 |

- Each child terminal checkpoint covers every executable cell in its plan
  exactly once.
- Every run was attempted exactly once: 66, 60 and 63 attempted run IDs, all
  with attempt 1.
- Parent generation timing, consistent with the recorded history:
  - Generation 0 (`running`) is dated 2026-09-14 18:35:44 local. The local
    offset is UTC-7, inferred from `runs.json` `startedAt`.
  - Generations 1 (`aggregating`) and 2 (`finished`), `merge-seal.json`,
    `runs.json` and `report.json` are all dated 2026-09-15 02:31:13 local.
  - So the original parent left only generation 0. The fail-closed resume
    added no generation, and the approved resume wrote generations 1 and 2 and
    the seal. The latest child finished at 00:04:56 local, matching the brief.

### 3. Evaluation parity

- **Children:** the evaluations directory listing equals the terminal receipt
  names exactly in all three.

  | Child | Receipts | Files | SHA mismatches | Non-UTF-8 | Path ≠ `evaluations/<runId>.json` | Run ID not exactly one file | Identity mismatches |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | 0 | 66 | 66 | 0 | 0 | 0 | 0 | 0 |
  | 1 | 60 | 60 | 0 | 0 | 0 | 0 | 0 |
  | 2 | 63 | 63 | 0 | 0 | 0 | 0 | 0 |

  Shard 002 now holds 63 files, matching its receipts.
- **Parent:** 189 receipts and 189 files, with a listing equal to the receipts.
  There are 0 SHA mismatches and 0 path mismatches. 0 byte differences from
  the child copies. 0 records differ from the child record (cellKey, runId,
  evaluationSha256). The completed order equals the executable plan order.
- **Bundles**
  - 189 folders under `b\`, besides `.work` and `bench`. They are exactly the
    set of child run IDs, with 0 non-directory entries.
  - Every bundle has `bundle.complete.json` with schema 0.1 and keys
    {artifactIndexSha256, schemaVersion}.
  - Extra check: `artifactIndexSha256` equals the SHA-256 of the raw bytes of
    `artifact-index.json` in 189 of 189 bundles.
  - `bench-receipt.json`: 0 key-set failures and 0 receipts with any mismatch.
    Per field, all zero: campaignId (the child's), planSha256 (the child's),
    cellKey, cellIdentity (the six-field identity), attempt, and runId.
    Attempt was checked against the chain's `activeAttempt` for that run ID
    and against the `-a<attempt>` suffix.
  - Bundle `evaluation.json` is byte-identical to the campaign copy in all
    189.

### 4. Merge seal

All 24 digests match: 24 of 24, with 0 mismatches. The table shows which
format matched. In every row exactly one format matched.

- **Canonical JSON** means sorted keys, compact `JSON.stringify`, UTF-8 and
  SHA-256.
- **Raw bytes** means the SHA-256 of the file as stored.

| Digest | Listed value | Format matched |
| --- | --- | --- |
| parentPlanSha256 | `48ffcbcf20a94a383b6726e10e5a403c6985b23202143dfb20c9af410e2a6560` | canonical JSON of `plan` |
| parentManifestSha256 | `1f7fcdb374972890543cc4f194a11df53e992f9d506499e22dcac3421a37d51c` | canonical JSON of `campaign.json` (raw bytes did not match) |
| child0.terminalCheckpointSha256 | `fdbd7bcfa1f8e1663ca887925cc6071b3f1ff03f93e5934c034e1c33186fbeac` | canonical recompute of generation 133 (raw bytes did not match) |
| child0.runsSha256 | `13f238527a02814f1fe2b070db2dd9b11470f764b0e2df35baf3785d9add582d` | raw bytes of `runs.json` (canonical did not match) |
| child0.reportSha256 | `9950817d7c4794a20eb3e8f95e314c52b1285e8877c63c832f9c5c6f35242b35` | raw bytes of `report.json` (canonical did not match) |
| child0.markdownSha256 | `cad0aec53fa5684f471532499eb086cf6598eb5fc54d72b665c65c421307dfae` | raw bytes of `report.md` |
| child0.planSha256 | `1550a9ffea121ab6c6d862c110a1a41c267cbc08e062f02009354027c916bf2a` | canonical JSON of `plan` |
| child0.manifestSha256 | `ac8b415bc742037ef92336805a6e4101f0a40d13f6e64b0d948ea47545d7f208` | canonical JSON of `campaign.json` (raw bytes did not match) |
| child1.terminalCheckpointSha256 | `6096ba1ddfb137161ba8139038568d9d837fb66599e9fea6793f8bbae1c40fc1` | canonical recompute of generation 121 (raw bytes did not match) |
| child1.runsSha256 | `9eee8826d6df489940df55e860164ee8920d736c3c029653600e2d75f080a116` | raw bytes (canonical did not match) |
| child1.reportSha256 | `4fd24f0c1b53415c12d3afedf99be52982f31bd2e1beda659320fbfe2c09e1fe` | raw bytes (canonical did not match) |
| child1.markdownSha256 | `0bcdec4b1577195aaacf6f834d192d28ea9a04c00cd8b1ca63c673c213316987` | raw bytes |
| child1.planSha256 | `9ab638b22f71eb8df6d196cb15aad7c366949dc222963e0255e681c219034c06` | canonical JSON of `plan` |
| child1.manifestSha256 | `af8f44620988684cf272a91ac2bb43eebac9bdf642d9e13b6b4f57cc19fb4638` | canonical JSON of `campaign.json` (raw bytes did not match) |
| child2.terminalCheckpointSha256 | `c160c765ead79ce2d68938090077dafb08e0626cb43090657b358987dd9a60c1` | canonical recompute of generation 127 (raw bytes did not match) |
| child2.runsSha256 | `c65aa27f60a1ce1c7285c6d3609974bbd9e0ee667126f00adf0cd2c46e677a70` | raw bytes (canonical did not match) |
| child2.reportSha256 | `c9aad7fcf565df02eccdf2c78c064d0e57bc125f16d6ca4a86c4ead145904360` | raw bytes (canonical did not match) |
| child2.markdownSha256 | `8500cdc9d126a81ebc243f0eedeceb03e8891e64d228b522d85128d34fb03a97` | raw bytes |
| child2.planSha256 | `72a62c204f38391a41845cba6e37d05dcf0e24f372d52cd2c9f7db7fe32627fe` | canonical JSON of `plan` |
| child2.manifestSha256 | `163e07b9f1b1c652fdf6176a5cee3347a58b0b1e50fbc1a5573524547407fbd1` | canonical JSON of `campaign.json` (raw bytes did not match) |
| merged.runsSha256 | `ae87a48eb123321a95f4783348edfd68ddf74288ed57ab3b170bccdc84be8568` | raw bytes of parent `runs.json` |
| merged.reportSha256 | `7944511c1a9c95da86f6e12147abcbdf6f062d833a8f852e93ef3792445ef1e0` | raw bytes of parent `report.json` |
| merged.markdownSha256 | `a669f762f106b8d03d8f8679969603dba9c9b330f4987b69548aa378cc849ed1` | raw bytes of parent `report.md` |
| sealSha256 | `c26c7e949a41bec1c175604fd3e00daf309197724430655bef522a90b3e5a75d` | canonical JSON of the seal without `sealSha256` (raw file bytes did not match) |

Also confirmed:

- The seal's schemaVersion is 0.1.
- `parentCampaignId` equals the parent benchId.
- Child index and campaignId match in order.
- Every child's terminal `checkpointSha256` field equals its recomputed value.

Full digest values are in `merge-seal.json`.

### 5. Residue

- **Leases and leftovers:** the whole campaign root and the whole `b\` tree
  (3,554 files) were walked. There are 0 `lease` entries, 0
  `.lease-candidate-*`, 0 `.staging-*`, 0 `interrupted`, 0 `*.tmp` and 0
  symlinks. That includes every `evaluations/` and `checkpoints/` directory
  and all bundles.
- **Lease history:** all four `lease-history/` directories (parent and three
  children) are empty.
- **`.work`:** `F:\fxlab-runs\sharded-final-2\b\.work` exists and is empty:
  0 entries, recursively.
- **Quarantine:** `F:\fxlab-runs\sharded-final-2\quarantine\b-shard002-evaluations\`
  has 1 entry, `.bench-shard2-fdae3012-c15-a1.json.10996.7939de78e31b4ee8.tmp`.
  - Size: 1,010 bytes. File time 2026-09-14 22:46:56 local, which is the
    original write time.
  - SHA-256 `9c65986bfbc5f1c365a7668b0f16a43551d862d05ec946e4f0bcdf03ae500895`.
  - That equals the shard 002 terminal checkpoint's `evaluationSha256` for
    `bench-shard2-fdae3012-c15-a1`.
  - It is byte-identical to the current
    `shards\002\evaluations\bench-shard2-fdae3012-c15-a1.json`.

### 6. Outcomes

- **Evaluation verdicts:** passed 179, failed 10, inconclusive 0.
- **By lane:** recording passed 69; flow passed 110; flow failed 10.
- **failureCategory:** none 179, `runtime.behavior` 9, `process.startup` 1.
- **Other checks**
  - Non-null `facilityFailure`: 1.
  - Passed runs carrying a failureCategory or facilityFailure: 0.
  - `runs.json` verdict and facilityFailure agree with the evaluation in 189
    of 189.

Failed runs. repeatIndex is zero-based; all are on the flow lane with flowCreated
true unless stated. Every failure's only failed invariant is `runner-verdict`.

| Run | Ordinal | Cell (row / scenario / workflow / variant / repeatIndex) | Category | facilityFailure | Oracle / reported | Expected / reported failure |
| --- | --- | --- | --- | --- | --- | --- |
| `bench-shard2-fdae3012-c9-a1` | 11 | W05 / product-catalog / paginated-extraction / `short-catalog` / 0 | runtime.behavior | null | passed / failed | none / target_not_found `web.target.not_found` |
| `bench-shard2-fdae3012-c10-a1` | 78 | W05 / product-catalog / paginated-extraction / `short-catalog` / 1 | runtime.behavior | null | passed / failed | none / target_not_found `web.target.not_found` |
| `bench-shard2-fdae3012-c11-a1` | 145 | W05 / product-catalog / paginated-extraction / `short-catalog` / 2 | runtime.behavior | null | passed / failed | none / target_not_found `web.target.not_found` |
| `bench-shard2-fdae3012-c30-a1` | 32 | W13 / modal-flows / consent-then-click / `banner-absent` / 0 | runtime.behavior | null | failed / failed | none / target_not_found `web.target.not_found` |
| `bench-shard2-fdae3012-c31-a1` | 99 | W13 / modal-flows / consent-then-click / `banner-absent` / 1 | runtime.behavior | null | failed / failed | none / target_not_found `web.target.not_found` |
| `bench-shard2-fdae3012-c32-a1` | 166 | W13 / modal-flows / consent-then-click / `banner-absent` / 2 | runtime.behavior | null | failed / failed | none / target_not_found `web.target.not_found` |
| `bench-shard1-d0825d39-c51-a1` | 52 | W24 / intermediate-state / null / `unannounced` / 0 | runtime.behavior | null | passed / passed | output_not_observed / none |
| `bench-shard1-d0825d39-c52-a1` | 119 | W24 / intermediate-state / null / `unannounced` / 1 | runtime.behavior | null | passed / passed | output_not_observed / none |
| `bench-shard1-d0825d39-c53-a1` | 186 | W24 / intermediate-state / null / `unannounced` / 2 | runtime.behavior | null | passed / passed | output_not_observed / none |
| `bench-shard1-d0825d39-c35-a1` | 168 | W14 / modal-flows / interstitial / null / 2 | process.startup | `{boundary: finalized-bundle, stage: scenario.execute, reason: http.timeout, operationStage: project.select, timeoutMs: 30000}` | null / null (flowCreated false, 0 actions) | none / none |

This matches the brief's expectation exactly. The nine ruled-out variant runs
are W05 `short-catalog`, W13 `banner-absent` and W24 `unannounced`, 3 each.
The tenth is W14 `modal-flows`/`interstitial`, repeatIndex 2, `process.startup`
with `http.timeout / project.select / 30000`. Nothing else failed.

Expected-failure cells: 33 were executed and 30 passed. The 3 failures are the
W24 `unannounced` runs above. The passing groups are W10 `broken-link`, W14
`armed`, W15 `popup-blocked`, W19 `expired`, W25 `too-slow`, W26 `no-context`,
W27 `disabled`, W27 `detached`, W27 `blocked-url` and W29 `save-and-exit`, 3
each.

### 7. Harness, redaction, evidence and duration

- **Harness activations**
  - Sum 0, max 0, 0 runs above zero.
  - llm is `disabled`, profileId null and 0 calls in 189 of 189.
  - `report.json` harnessActivation: recording 0 of 69, flow 0 of 120.
- **Redaction attestations**
  - `snapshots/redaction-attestation.json` is present in 189 of 189 bundles.
    No other files are named `*redaction*`. All share one key set.
  - Status: `not-applicable` 180 (0 scopes, 0 literals); `passed` 9.
  - The 9 passed are W18 `auth-gate` recording ×3, W18 `auth-gate` flow ×3 and
    W19 `auth-gate`/`expired` flow ×3. Each has literalCount 1 and 2 scopes,
    with scope keys {name, scannedBytes, scannedFiles, skippedBinaryFiles}.
  - findingCount sum 0; `findings[]` total 0; 0 cases where findingCount
    differs from the length; advisories total 0.
- **Evidence packets (`sanitizedPacketBytes`)**
  - 608 samples from 119 runs (flow passed 110, flow failed 9).
  - p50 4,069 bytes; p95 5,934; max 5,992; min 528. The p50 and p95 equal
    `report.json`.
  - `rawSnapshotBytes`: 0 samples.
- **Truncations:** 165 total across 30 runs (flow passed 27, flow failed 3),
  equal to `report.json`.
- **Evidence policy:** two distinct `evidence-policy.json` values, both with
  screenshots none, trace off, video off, maxBytes 26214400 and maxScreenshots
  100. `reviewRequired` is false in 165 and true in 24.
- **Run duration**
  - All runs: p50 92,168 ms; p95 113,054 ms; min 43,240; max 134,010. Equal to
    `report.json`.
  - Recording, n 69: p50 70,043; p95 89,428; max 92,168.
  - Flow, n 120: p50 100,310; p95 117,161; max 134,010.

## Not verified

- **Product loaders not run.** The product's own loaders were not executed,
  including `loadCampaignShardGroup` and the `load-report.ts` sealed-report
  check. Their checks were reimplemented in standalone scripts from the source
  files named above.
- **Shard assignment not re-derived.** The deterministic round-robin partition
  was not recomputed. Only an exact, duplicate-free union with cells identical
  to the parent was checked.
- **Evaluation schema not validated.** `parseRunEvaluationJson` full schema
  validation was not run. Only the identity fields the merge checks were
  compared.
- **Bundle internals not checked.** Contents of child `runs.json`,
  `report.json` and `report.md` were checked by digest only. Per-file entries
  inside `artifact-index.json` were not checked, only the index's own digest.
  Event logs, page data and attestation scope names were deliberately not
  read.
- **Resume history inferred.** That the fail-closed resume wrote nothing is
  inferred from the unchanged three-generation parent chain, the file times
  and the absence of any residue. The UTC-7 local offset is inferred from
  `runs.json` `startedAt` against the generation 0 file time.
- **Scripts run once.** Each script ran once, on the machine with known faulty
  RAM. Every comparison was an exact hash or byte match with 0 mismatches, so
  corruption producing a false match is implausible.

## Open questions or contradictions found

1. **`runs.json` count, resolved.** `runs.json` has 13 rows whose
   `facilityFailure` is not `null`, while the evaluations have 1. The 12
   skipped rows omit the key entirely (their keys are corpusRowId, lane,
   repeatIndex, scenarioId, skipReason, status, variantId, workflowId). The 1
   remaining row is the W14 object. Anyone counting from `runs.json` should
   test for a non-null object, not for "not null".
2. **`notExecutedRuns` breakdown, not a defect.** `report.json`
   `notExecutedRuns` is 55. That is 54 recording-lane runs with zero actions,
   all passed, plus the W14 flow facility failure. The 54 are rows W04–W17 and
   W25–W28, 3 repeats each. Recorded for the comparison, not judged here.
3. **The temp-file failure can recur silently.** In `bench/durable-file.ts`,
   `removeOwnedTemporary` (lines 156-158) swallows every removal error, and
   create mode removes the temp only after linking (lines 100-111). A failed
   removal on Windows therefore leaves a byte-identical orphan with no signal,
   and `shard-merge.ts:114-123` then fails the merge closed. That matches this
   campaign's history. `reports\ca-durable-temp-cleanup.md` exists but was not
   read, because it is outside this brief.
