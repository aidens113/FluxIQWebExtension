# f-bench-campaign-store

Outcome: Complete; ready for orchestration integration

## Implemented

- `campaign-identity.ts` defines schema/semantics `0.2`, canonical JSON and
  SHA-256 helpers, exact six-field campaign-cell identity, repeat-major ordered
  plan construction, canonical plan hashes, and exact stable compatibility
  comparison.
- `campaign-store.ts` strictly parses the immutable campaign manifest and
  immutable checkpoint generations. It publishes both create-only through the
  durable-file primitive, validates canonical hashes and previous-generation
  links, and selects only the longest contiguous chain from generation zero.
- Completed cells must be unique executable plan cells. An active attempt must
  name one exact incomplete executable cell. A `finished` checkpoint must cover
  every executable cell and have no active attempt.
- Temporary/unrecognized checkpoint files and generations beyond a gap are
  ignored but returned in `ignored` for disclosure. Malformed authoritative
  generations, invalid hashes/links, wrong campaign/plan bindings, and
  contradictory cell state fail closed.
- Campaign-owned paths reject absolute paths, Windows separators, traversal,
  aliases, empty segments, and alternate-stream colons. Interrupted staging is
  moved only from a caller-declared source root and only when its basename
  exactly matches `.staging-<runId>`.
- Mutable derived projections use the atomic replacement writer. Manifest and
  checkpoints use the create-only durable writer, so duplicate publication
  returns `EEXIST` instead of replacing accepted state.
- Recursive secret-bearing keys, including token/session/password/PIN and API,
  access, or private keys, are refused before parsing or persistence.

## Public module APIs

Identity:

- `canonicalJson`, `sha256Canonical`
- `campaignCellIdentity`, `campaignCellKey`
- `createCampaignPlan`, `campaignPlanSha256`
- `assertCampaignCompatibility`, `isSha256`
- `CampaignCellIdentity`, `CampaignPlanCell`, `CampaignRequest`,
  `CampaignCompatibility`, schema and semantics constants

Store:

- `writeCampaignManifest`, `loadCampaignManifest`, `parseCampaignManifest`
- `writeCampaignCheckpoint`, `loadCampaignCheckpointChain`,
  `parseCampaignCheckpoint`
- `writeCampaignProjection`, `containedPath`,
  `preserveInterruptedStaging`
- manifest, checkpoint, completed-cell, active-attempt, and loaded-chain types

The assigned brief anticipated one `writeDurableJson(..., {replace})` API. The
landed durability partition instead exposes `createDurableJson` and
`writeDurableJson`; this module uses the former for immutable authorities and
the latter for projections. No durability file was edited here.

## Validation

- Package TypeScript build: pass.
- Focused campaign identity/store tests: **11/11 pass**.
- Root structure check reached only two concurrent-partition failures: the
  receipt import bypasses the bench barrel, and the shared working-doc index
  needs regeneration. Neither is in this partition; no campaign store or
  identity violation or advisory was reported.
- Full test-runner suite while all Stage 4u partitions were present:
  **670/671 pass**. The one failure is an integration issue outside this
  partition: existing `run-bench.test.ts` creates `run-unit-0` more than once
  in one bench, while the concurrently changed report store now correctly
  creates evaluations immutably and refuses the duplicate with `EEXIST`.

Mutation proofs, each restored immediately:

- Removed `repeatIndex` from the cell digest: the lane/repeat uniqueness test
  failed (`2 !== 3`).
- Bypassed compatibility comparison: the browser-version mismatch assertion
  failed (`Missing expected exception`).
- Bypassed checkpoint canonical-hash validation: the corrupted-content test
  failed (`Missing expected exception`).
- Bypassed previous-generation link validation: the contradictory-successor
  test failed (`Missing expected rejection`).

## Integration needs and risks

- The orchestrator must construct the compatibility fingerprint from verified
  clean commits, lock/build hashes, and the stable browser/environment probe.
  This partition deliberately does not inspect repositories or build outputs.
- The orchestrator must validate evaluation hashes, finalized bundles, and
  receipts before adding a completed record; the store validates checkpoint
  structure and plan membership, not external artifact contents.
- Pass the global runs directory as `allowedSourceRoot` when preserving a
  normal `.staging-<runId>` directory into a campaign's `interrupted/` folder.
- Fix the existing fake runner's duplicate run IDs (or complete the deterministic
  supervisor run-ID wiring) before treating the full package suite as green.
- No barrel, orchestration, report-store, Core, shared working document, commit,
  push, or run artifact was changed by this partition.
