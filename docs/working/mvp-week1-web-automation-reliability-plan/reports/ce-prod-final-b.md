# ce-prod-final-b: terminal verification of production-Core campaign B

Campaign `bench-mu2i36jy-ddf2e39f`, root
`F:\fxlab-runs\prod-core-final\b\bench\bench-mu2i36jy-ddf2e39f`, bundles under
`F:\fxlab-runs\prod-core-final\b\`. Verified on 2026-09-15 by a read-only worker,
using the method of `br-sharded-final-2-b.md`.

## Outcome

Done. All eight checks passed. The script's final `PROBLEMS` section printed `none`.

- **Plan:** 201 cells: 189 evaluated and 12 planned skips. No duplicate or missing cell keys.
- **Verdicts:** 180 passed, 9 failed, 0 inconclusive. The 9 failures are exactly
  W05 `short-catalog`, W13 `banner-absent` and W24 `unannounced`, 3 each.
  **Zero facility failures.** Nothing unexpected failed.
- **Chains:** parent and three children are contiguous, hash-linked, end in
  `finished` with no active attempt, and hold no non-generation files.
- **Parity:** all 189 evaluations are byte-identical across the child copy, the parent copy and the bundle.
- **Merge seal:** 24 of 24 digests recompute and match.
- **Residue:** none. That means 0 leases, 0 `.staging-*`, 0 `interrupted`,
  0 `.tmp` anywhere under `b\`, an empty `.work`, 0 symlinks outside the Core
  build cache, and no quarantine folder.
- **Production Core:** all 189 campaign bundles have a `logs/core.log` with exactly one
  "Ready in" and zero "Compiling" or "(dev)". No campaign bundle has
  `logs/core-web-build.log`.
- **Duration:** run duration p50 is 22,034 ms and p95 37,864 ms. The earlier dev-Core pair had p50 92,168 and p95 113,054.

## What changed and why

The only file created is this report, together with its `reports\` folder. Nothing
was created, moved or deleted under `F:\fxlab-runs` or in either repository.
Campaign A (`...\a`) was not touched.

One read-only Node script was used: `verify-pcb.mjs`, output in `verify-pcb.out.txt`. Both are in the
session scratchpad under `ce-prod-final-b\`. It is the earlier `verify-b.mjs`
retargeted, with the follow-up checks folded in and a new section 8 for Core-log marker counts. It
reimplements the product checks from `packages/test-runner/src/bench/`: `campaign/identity.ts`,
`campaign/store.ts`, `campaign/shard-group-store.ts`, `shard-merge.ts`,
`sharded-bench.ts` (raw-byte projection digests) and `distribution.ts` (nearest-rank, epsilon 1e-9).

`git diff 3d6ecd645e92 118aeb7` over those files shows only machine-slot files
and an import regrouping in `shard-merge.ts`, which pulls the same names from
`./campaign/index.js`. There is no change to the hash, chain, seal or merge
rules, so the earlier method applies unchanged.

No `pnpm lab`, build or test was run. No event messages, page data, environment
values or secrets were read or printed. Core logs were only scanned for marker
counts, and no log line was printed.

## Commands run and observed results

- `node verify-pcb.mjs`: exit 0, 158 output lines, final `PROBLEMS: none`.
- PowerShell `Get-ChildItem` listings: names, sizes, times and link targets only.
- `git diff --stat` and `git diff` on the bench campaign and merge sources between the two commits.

### 1. Coverage

- **Parent manifest**
  - Schema 0.3. Execution: `shard-parent`, `result-round-robin-v1`, shardCount 3, jobs 2.
  - Request: corpus `week1`, repeatCount 3, target `isolated`, evidence `failure`.
  - Compatibility: facility commit `118aeb7ffe18`, Core commit `54ae66305798`.
  - createdAt 2026-09-15T09:59:54.096Z.
- **Parent plan**
  - 201 cells: 12 skipped and 189 executable.
  - `planSha256` recompute matches `48ffcbcf…6560`, the same plan hash as the earlier pair.
  - Cell key and ordinal recompute failures: 0. Unique cell keys: 201.
  - Lanes: recording 69, flow 132. Each repeatIndex (0, 1, 2) has 67 cells.
- **Skips (12):** W04 `product-catalog` flow (variant null and `text-variant`)
  and W08 `data-table` flow (variant null and `column-reorder`), 3 repeats each.
  There are two reason texts, 6 cells each, both saying no recording step records an action.
- **Child plans**

  | Child | Plan cells | Skipped | Executable | `planSha256` recompute | Cells not identical to parent |
  | --- | --- | --- | --- | --- | --- |
  | 0 `bench-shard0-6ef701e3` | 69 | 3 | 66 | match | 0 |
  | 1 `bench-shard1-8d8e2558` | 66 | 6 | 60 | match | 0 |
  | 2 `bench-shard2-259c940a` | 66 | 3 | 63 | match | 0 |

  - Union of the child plans: 201 cells, 201 unique, 0 duplicates, 0 missing, 0 not in the parent.
  - Every child's execution identity names the parent ID, the parent plan hash and its own index.
    Each inherits the parent's request, compatibility and createdAt.
- **Completions across children:** 189, with 0 duplicate run IDs, 0 duplicate cells,
  0 executable cells missing and 0 completions outside the plan.
- **Parent `runs.json`**
  - 201 rows: `evaluated` 189, `skipped` 12.
  - Verdicts: passed 180, failed 9.
  - Cell keys: 201 unique, 0 missing, 0 extra.
  - `startedAt` 2026-09-15T09:59:54.096Z, `finishedAt` 2026-09-15T11:07:06.573Z.
- **Parent `report.json`**
  - Workflows: 63, summing to 189 runs.
  - flakeClass: `stable-pass` 60, `stable-fail` 3, `flaky` 0.
  - `notExecutedRuns` 54, `actionsExecuted` 336, `truncationCount` 165.
  - llm: `disabled`, 0 calls.

### 2. Checkpoint chains

Every chain had 0 of each of these defects:

- non-generation files
- bad key sets
- `checkpointSha256` recompute failures
- bad `previousSha256` links
- id or plan mismatches
- duplicate or unknown completions
- non-prefix completion lists
- invalid active attempts

| Chain | Generations | States | Terminal | Completed | Terminal `checkpointSha256` | Terminal file time (local) |
| --- | --- | --- | --- | --- | --- | --- |
| parent | 3 (0..2) | running 1, aggregating 1, finished 1 | finished, activeAttempt null | 189 | `78b6436fa0afd701e4ade3e053b6c360641f51cf60c77990693412c9a375ac4f` | 2026-09-15 04:07:06 |
| child 0 | 134 (0..133) | running 132, aggregating 1, finished 1 | finished, activeAttempt null | 66 | `fb87aad733eacb4464888eeb9f262b13961c76fbc4683dd0ada2629a27741210` | 2026-09-15 03:48:11 |
| child 1 | 122 (0..121) | running 120, aggregating 1, finished 1 | finished, activeAttempt null | 60 | `a2a744b671b8ce6e37f444e3d0ec0b685571b91c140133090677309e6fa5968b` | 2026-09-15 03:42:41 |
| child 2 | 128 (0..127) | running 126, aggregating 1, finished 1 | finished, activeAttempt null | 63 | `a5ec812a779fa8112ee909041e82aac4057947867696812faa9f42845519fc73` | 2026-09-15 04:07:03 |

- Every child's terminal checkpoint covers its executable plan exactly once.
  Every run was attempted exactly once: 66, 60 and 63 run IDs, all with attempt 1.
- Timing, with a local offset of UTC-7 inferred from `startedAt`, is consistent with 2 jobs:
  - Parent generation 0 was written at 02:59:54.
  - Children 0 and 1 wrote generation 0 at 02:59:55.
  - Child 2 wrote generation 0 at 03:42:41, the same second child 1 finished.
  - Parent generations 1 and 2, `merge-seal.json`, `runs.json`, `report.json` and `report.md` were all written at 04:07:06.
  - So the merge ran uninterrupted, with no resume.

### 3. Evaluation parity

- **Children**

  | Child | Receipts | Files | Listing = receipts | SHA mismatches | Non-UTF-8 | Path ≠ `evaluations/<runId>.json` | Run ID not exactly one file | Identity mismatches |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | 0 | 66 | 66 | yes | 0 | 0 | 0 | 0 | 0 |
  | 1 | 60 | 60 | yes | 0 | 0 | 0 | 0 | 0 |
  | 2 | 63 | 63 | yes | 0 | 0 | 0 | 0 | 0 |

- **Parent:** 189 receipts and 189 files, with the listing equal to the receipts. 0 SHA mismatches,
  0 path mismatches, 0 byte differences from the child copies, and 0 record differences
  (cellKey, runId, evaluationSha256). The completed order equals the executable plan order.
- **Bundles**
  - `b\` has 193 top-level entries: 189 `bench-shard*` folders (exactly the child run ID
    set, 0 non-directories), plus `.core-web-build`, `.work`, `bench` and
    `run-mu2i19zw-88ac50e9`. The last is the prebuild run; see section 8.
  - `bundle.complete.json` is present in 189 of 189, with schema 0.1 and keys {artifactIndexSha256,
    schemaVersion}. `artifactIndexSha256` equals the raw-byte SHA-256 of `artifact-index.json` in 189 of 189.
  - `bench-receipt.json`: 0 key-set failures and 0 receipts with any mismatch. Every
    per-field count is 0: campaignId, planSha256, cellKey, cellIdentity, attempt (checked against
    the chain and the `-a<n>` suffix) and runId.
  - Bundle `evaluation.json` is byte-identical to the campaign copy in 189 of 189.

### 4. Merge seal

24 of 24 digests match, with 0 mismatches. In every row exactly one format matched.
Canonical JSON means sorted keys and compact output; raw bytes means the file as stored.
The seal has schemaVersion 0.1, its `parentCampaignId` equals the parent benchId, and the child
indexes and campaign IDs match in order. It has no keys beyond the 24 digests and identity fields.

| Digest | Listed value | Format matched |
| --- | --- | --- |
| parentPlanSha256 | `48ffcbcf20a94a383b6726e10e5a403c6985b23202143dfb20c9af410e2a6560` | canonical JSON of `plan` |
| parentManifestSha256 | `f05f104ce7452280949a881a7efec1fd14365fc29b5c155dc45408f925db4b2a` | canonical JSON of `campaign.json` |
| child0.terminalCheckpointSha256 | `fb87aad733eacb4464888eeb9f262b13961c76fbc4683dd0ada2629a27741210` | canonical recompute of gen 133 |
| child0.runsSha256 | `39ea36aaceeec27b03b8cbff51f1ad9cdc5b32197513c067c873ebe6a3b48558` | raw bytes |
| child0.reportSha256 | `aa8de8a62ce7b363a95a4571786bca8dd1c65f458bf06a1bcf0fc7f579b5d8ac` | raw bytes |
| child0.markdownSha256 | `a105d1515cb137e16a06e792a1bbd1263d49c5660a4eb835978b877d64342cac` | raw bytes |
| child0.planSha256 | `1550a9ffea121ab6c6d862c110a1a41c267cbc08e062f02009354027c916bf2a` | canonical JSON of `plan` |
| child0.manifestSha256 | `188931c867c5cb76c7dcd8554e527a8a42ea71c3bbd8c175394b8ba35577a020` | canonical JSON of `campaign.json` |
| child1.terminalCheckpointSha256 | `a2a744b671b8ce6e37f444e3d0ec0b685571b91c140133090677309e6fa5968b` | canonical recompute of gen 121 |
| child1.runsSha256 | `0503502d28edbc15306f9833aa2b0ea1b8566390912d31f20e0ab62afe66e71a` | raw bytes |
| child1.reportSha256 | `f703c1e57bb346fea22e05608696633cd09c59b5d7d4c7867e963e97d4e2dae5` | raw bytes |
| child1.markdownSha256 | `146b076c3861fb7cc2a00d16be93cacddeb8696c8dd0fa5c7a6d0d2bc51fe82b` | raw bytes |
| child1.planSha256 | `9ab638b22f71eb8df6d196cb15aad7c366949dc222963e0255e681c219034c06` | canonical JSON of `plan` |
| child1.manifestSha256 | `38b41e89b9d70ffa1408974e87f4de1aa0d25577f22882233ae3a952443448b5` | canonical JSON of `campaign.json` |
| child2.terminalCheckpointSha256 | `a5ec812a779fa8112ee909041e82aac4057947867696812faa9f42845519fc73` | canonical recompute of gen 127 |
| child2.runsSha256 | `491054ebc1f9275b9b121c308624f06ad4b15e066e8c8ce6df135451f56742d7` | raw bytes |
| child2.reportSha256 | `7d1ffbc4fe5b2a74255af770bdaa5d92d8ca3614831e75fa40b0f88dbb975fe0` | raw bytes |
| child2.markdownSha256 | `70d23be4a08836f2cfdcfbb4997fa989cc8bc0450a5f670310d8d4e11a35342f` | raw bytes |
| child2.planSha256 | `72a62c204f38391a41845cba6e37d05dcf0e24f372d52cd2c9f7db7fe32627fe` | canonical JSON of `plan` |
| child2.manifestSha256 | `69f48a98ede93ef49d5d0914debbbf1d4898872309ef63198671c1d029ebbeaa` | canonical JSON of `campaign.json` |
| merged.runsSha256 | `2a9facf7a4c9c251e4b95f150444bf806d81c6144e353cb19560244822ca3825` | raw bytes of parent `runs.json` |
| merged.reportSha256 | `753b9e9379b1864d6a843cf889bab0aeb6e7a320c1f6b93025678b5f44eb68da` | raw bytes of parent `report.json` |
| merged.markdownSha256 | `936c8754a0e904eca3deeadb49b7ac4bff3a3d66546a0df5be83c3775c06bd7f` | raw bytes of parent `report.md` |
| sealSha256 | `6c40fbb3e25ab12ce6900b7ae9aa519c550960dc3b1baa11b04d4d070ca021f0` | canonical JSON of the seal without `sealSha256` |

### 5. Residue

- **Walk:** the whole `b\` tree was walked. It holds 6,857 files and 1,027 directories, of which 3,286 files are under `.core-web-build`.
  - `lease`: 0
  - `.lease-candidate-*`: 0
  - `.staging-*`: 0
  - `interrupted`: 0
  - `*.tmp`, anywhere including the cache: 0
  - symlinks outside the cache: 0
- **Lease history:** all four `lease-history/` directories (parent, 000, 001, 002) are empty.
- **`.work`:** exists and is empty: 0 entries, recursively.
- **Quarantine:** `F:\fxlab-runs\prod-core-final\quarantine` does not exist.
- **Core build cache:** `.core-web-build\6ac4f31e34cc2e50f3e864ff\` holds `published.json`, 80 bytes
  written at 02:59:16, and `b-8c16815a9598\`. Its 18 links are all Windows junctions into
  `F:\fxlab\!FluxIQ`: `packages\`, `apps\web\node_modules\.bin`, and 16
  `apps\web\node_modules` package links (next, react and others). They are counted here and not treated as residue.
  The cache folder was created at 02:58:27.

### 6. Outcomes

- **Evaluation verdicts:** passed 180, failed 9, inconclusive 0. Every evaluation has schema 0.2.
- **By lane:** recording passed 69; flow passed 111; flow failed 9.
- **failureCategory:** none 180, `runtime.behavior` 9.
- **Facility failures:** evaluations with a non-null `facilityFailure`: **0**.
  - `runs.json`: 0 rows with a facilityFailure object. The 189 evaluated rows carry
    `null`, and the 12 skipped rows omit the key.
  - Passed runs carrying a category or facilityFailure: 0.
  - `runs.json` verdict and facilityFailure agree with the evaluation in 189 of 189.

Failed runs. All are on the flow lane with flowCreated true. repeatIndex is zero-based. Each run's only failed invariant is `runner-verdict`.

| Run | Ordinal | Cell (row / scenario / workflow / variant / repeatIndex) | Category | facilityFailure | Oracle / reported | Expected / reported failure | Duration ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `bench-shard2-259c940a-c9-a1` | 11 | W05 / product-catalog / paginated-extraction / `short-catalog` / 0 | runtime.behavior | null | passed / failed | none / target_not_found `web.target.not_found` | 22,619 |
| `bench-shard2-259c940a-c10-a1` | 78 | W05 / product-catalog / paginated-extraction / `short-catalog` / 1 | runtime.behavior | null | passed / failed | none / target_not_found `web.target.not_found` | 25,716 |
| `bench-shard2-259c940a-c11-a1` | 145 | W05 / product-catalog / paginated-extraction / `short-catalog` / 2 | runtime.behavior | null | passed / failed | none / target_not_found `web.target.not_found` | 23,069 |
| `bench-shard2-259c940a-c30-a1` | 32 | W13 / modal-flows / consent-then-click / `banner-absent` / 0 | runtime.behavior | null | failed / failed | none / target_not_found `web.target.not_found` | 14,315 |
| `bench-shard2-259c940a-c31-a1` | 99 | W13 / modal-flows / consent-then-click / `banner-absent` / 1 | runtime.behavior | null | failed / failed | none / target_not_found `web.target.not_found` | 18,171 |
| `bench-shard2-259c940a-c32-a1` | 166 | W13 / modal-flows / consent-then-click / `banner-absent` / 2 | runtime.behavior | null | failed / failed | none / target_not_found `web.target.not_found` | 24,720 |
| `bench-shard1-8d8e2558-c51-a1` | 52 | W24 / intermediate-state / null / `unannounced` / 0 | runtime.behavior | null | passed / passed | output_not_observed / none | 28,950 |
| `bench-shard1-8d8e2558-c52-a1` | 119 | W24 / intermediate-state / null / `unannounced` / 1 | runtime.behavior | null | passed / passed | output_not_observed / none | 28,050 |
| `bench-shard1-8d8e2558-c53-a1` | 186 | W24 / intermediate-state / null / `unannounced` / 2 | runtime.behavior | null | passed / passed | output_not_observed / none | 28,644 |

This matches the brief exactly: the nine ruled-out variant runs, 3 each, and nothing else.
The W14 `interstitial` `process.startup` timeout from the earlier pair did not recur.

Expected-failure cells: 33 were executed and 30 passed. The 3 failures are the W24 `unannounced` runs.
The passing groups are W10 `broken-link`, W14 `armed`, W15 `popup-blocked`, W19 `expired`,
W25 `too-slow`, W26 `no-context`, W27 `disabled`, W27 `detached`, W27 `blocked-url` and
W29 `save-and-exit`, 3 each. Zero-action evaluations: 54, all recording-lane passes. That equals
`report.json` `notExecutedRuns` 54.

### 7. Harness, redaction, evidence and duration

- **Harness activations**
  - Sum 0, max 0, 0 runs above zero.
  - llm is `disabled`, profileId null and 0 calls in 189 of 189.
  - `report.json` harnessActivation: recording 0 of 69, flow 0 of 120.
- **Redaction attestations**
  - `snapshots/redaction-attestation.json` is present in 189 of 189, with one key set. No other `*redaction*` files.
  - Status: `not-applicable` 180 (0 scopes, 0 literals); `passed` 9 (2 scopes, 1 literal each).
    The 9 are W18 `auth-gate` recording ×3, W18 `auth-gate` flow ×3 and W19 `auth-gate`/`expired` flow ×3.
  - findingCount sum 0; `findings[]` total 0; count differs from length in 0; advisories total 0.
- **Evidence packets (`sanitizedPacketBytes`)**
  - 612 samples from 120 runs (flow passed 111, flow failed 9).
  - p50 4,069 bytes; p95 5,934; max 5,992; min 528. The p50, p95 and sample count equal `report.json`.
  - `rawSnapshotBytes`: 0 samples.
- **Truncations:** 165 total across 30 runs (flow passed 27, flow failed 3), equal to `report.json`.
- **Evidence policy:** two distinct `evidence-policy.json` values, both with screenshots none, trace off, video off,
  sampleFps 0, maxBytes 26214400 and maxScreenshots 100. `reviewRequired` is false in 165 and true in 24.
- **Run duration**

  | Scope | n | p50 ms | p95 ms | min ms | max ms |
  | --- | --- | --- | --- | --- | --- |
  | All runs (equals `report.json`) | 189 | 22,034 | 37,864 | 4,152 | 48,354 |
  | Recording | 69 | 10,026 | 17,148 | — | 21,855 |
  | Flow | 120 | 25,540 | 39,654 | — | 48,354 |

  The earlier dev-Core pair (`br-sharded-final-2-b`) had all-run p50 92,168 and p95 113,054.

### 8. Production Core

The log files were scanned for marker counts only, and no log line was printed.

- **Campaign bundles:** 189. 189 have `logs/core.log`, and 0 lack it. Every bundle's `logs/`
  holds exactly `core.log` and `scenario-lab.log`.
- **Production start with no dev-compile markers:** **189 of 189**.
  - "Ready in" appears exactly once in every bundle.
  - "Compiling" total is 0 and "(dev)" total is 0.
  - Bundles that fail this: none.
  - `core.log` size ranges from 320 to 349 bytes.
- **`logs/core-web-build.log`:** present in **0** campaign bundles. No campaign bundle has any file
  named `*web-build*`, `*core-build*` or `*next-build*`.
- **Prebuild run:** the one bundle with `core-web-build.log` is the non-campaign bundle
  `run-mu2i19zw-88ac50e9`.
  - It has no `bench-receipt.json` and is not in any plan.
  - Evaluation: lane recording, scenario `basic-form`, verdict passed, 66,107 ms.
  - Its `core.log` shows "Ready in" ×1, "Compiling" 0 and "(dev)" 0.
  - All its files are dated 02:59:31. That is after the cache's `published.json`
    (02:59:16) and before campaign generation 0 (02:59:54), so it is consistent with the
    prebuild populating the cache before any cell ran.

## Not verified

- **Product loaders not run.** `loadCampaignShardGroup`, the `load-report.ts` sealed-report check
  and `parseRunEvaluationJson` schema validation were not executed. Their checks were
  reimplemented in the script.
- **Shard assignment not re-derived.** The round-robin partition was not recomputed. Only an exact,
  duplicate-free union identical to the parent was checked.
- **Bundle internals not checked.** `artifact-index.json` per-file entries were not checked, only the index's
  own digest. Child `runs.json`, `report.json` and `report.md` were checked by digest only.
- **Log content not examined.** The marker test is substring counts of "Ready in", "Compiling" and
  "(dev)". Log content beyond those counts, event logs, page data and `published.json` content were not read.
- **Prebuild role inferred.** That `run-mu2i19zw-88ac50e9` is the prebuild comes from file times and its layout,
  not from a record naming it.
- **Scripts run once.** The script ran once on the machine with known faulty RAM. Every
  comparison was an exact hash or byte match with 0 mismatches, so corruption producing a false match is implausible.

## Open questions or contradictions found

1. **Cache location, observation only.** The Core build cache `.core-web-build` (3,286 files and 18 junctions into
   `F:\fxlab\!FluxIQ`) lives inside the run root `b\`, next to the bundles. It holds no `.tmp` or
   staging residue. Anyone walking a run root for residue, or deleting one, should expect it. The
   junctions point at the shared Core checkout, so a recursive delete that follows junctions would
   reach outside the run root. Whether that location is intended was not judged here.
2. **No contradictions found.** Every `report.json` figure checked (durations, packets,
   truncations, notExecutedRuns and harness counts) equals the recomputed values.
