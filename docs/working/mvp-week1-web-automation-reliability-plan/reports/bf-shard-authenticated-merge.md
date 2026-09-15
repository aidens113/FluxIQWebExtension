# `bf-shard-authenticated-merge` — terminal child merge

## Outcome

Implemented `prepareAuthenticatedShardMerge(directory)` as the authenticated
file-backed seam between terminal shard children and the parent executor. It
reloads the canonical parent/child group and returns:

- the revalidated `CampaignShardGroup`;
- parsed evaluations and immutable completion receipts in full parent-plan
  order;
- parent-relative completion paths for the byte-identical copies; and
- ordered `CampaignShardProjectionDigest` inputs containing each child ID,
  terminal checkpoint hash, and exact `runs.json`, `report.json`, and
  `report.md` byte digests.

The seam never writes projections, reports, parent checkpoints, or a merge
seal. Those remain executor/store responsibilities.

Before publishing any parent evaluation, it requires every child directory to
be directly contained, unleased, and backed by a complete contiguous terminal
checkpoint chain with no ignored generations or active attempt. It relies on
the shard-group store to re-prove parent/child identity, compatibility, plan
hashes, deterministic partitioning, and exact coverage.

Every referenced child evaluation is read as immutable bytes, checked against
its checkpoint SHA-256, required to be direct contained UTF-8, parsed through
the strict `RunEvaluation` contract, and matched to the plan cell's run ID,
scenario/workflow/variant/repeat/lane/expected-failure identity. Duplicate cell
or run identities, missing receipts, orphan files, and incomplete parent
coverage fail closed.

Only after all children and projection inputs validate are evaluations copied
create-exclusively into the parent. Replay accepts an existing copy only when
its bytes are identical; a contradiction or symlink fails closed.

## Validation

- Focused strict TypeScript compilation: passed.
- Focused merge tests: 13/13 passed. Cases cover child-finish permutation,
  parent ordering, exact seal inputs, idempotent and contradictory copies, byte
  corruption, missing/orphan receipts, duplicate run IDs, evaluation identity
  drift, nonterminal chains, residual leases, and path escape.
- `pnpm --filter @fluxiq-web-extension/test-runner check`: passed.
- `pnpm --filter @fluxiq-web-extension/test-runner test`: passed, 766/766.
- `git diff --check` over both owned files: passed.

The first full-suite attempt was 765/766 because a concurrent command test
expected the shard-target error before satisfying the pre-existing persistent
workspace requirement. The supervisor corrected that unrelated fixture; the
rerun above is green.

## Files

- `packages/test-runner/src/bench/shard-merge.ts`
- `packages/test-runner/src/bench/tests/shard-merge.test.ts`
- this report

No executor, store, barrel, CLI, projection/report/comparison source, Lab run,
commit, or push was performed.
