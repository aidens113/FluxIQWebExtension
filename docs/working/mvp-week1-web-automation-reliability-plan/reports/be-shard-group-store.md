# `be-shard-group-store` — immutable shard authority

## Outcome

Added schema-0.3 campaign execution identities and a create-only shard-group
store. A sharded parent now deterministically owns exact child identities,
requests, compatibility facts, partitions, and plan hashes. Terminal merge
inputs can be sealed with authenticated parent, child, checkpoint, and
projection digests without persisting secret-bearing keys.

## Changed

- `bench/campaign/identity.ts`: campaign manifests advance to schema 0.3 and
  distinguish serial, shard-parent, and shard-child execution identity. Bench
  evaluation semantics remain 0.3.
- `bench/campaign/store.ts`: strict manifest parsing requires the exact typed
  execution identity and validates the fixed algorithm, shard bounds, parent
  identity, plan digest, and child index. The existing recursive secret-key
  refusal is exported for the shard seal and now normalizes camelCase keys.
- `bench/campaign/shard-group-store.ts`: derives stable child campaign IDs,
  creates the parent and canonical `shards/000` through `shards/007` manifests
  with create-only writes, rejects non-exact directory sets, and re-proves
  inherited request/compatibility/semantics plus deterministic disjoint plan
  coverage on load.
- The same module creates and verifies a create-only `merge-seal.json`. Its
  canonical seal digest authenticates the parent manifest/plan, each child
  manifest/plan and terminal checkpoint/projection digests, and merged
  projection digests.
- Direct tests cover all three execution modes, exact-key/algorithm/index
  rejection, deterministic group round trips, create-only collisions, unsafe
  IDs, unknown child paths, request/identity/coverage corruption, seal
  tampering, incomplete/noncanonical inputs, and secret-bearing data.

The campaign barrel, executor, merge implementation, CLI, commands,
`shard-plan.ts`, and machine-slot files were not edited in this partition.

## Validation

- Focused strict TypeScript check over the owned production files/tests and the
  shard-plan seam: exit 0.
- Focused campaign store, shard-plan, and shard-group tests: 20/20 passed.
- `pnpm --filter @fluxiq-web-extension/test-runner check`: exit 0.
- `pnpm structure:check`: passed with advisory warnings only.
- `git diff --check` over the owned files: exit 0.

An initial package check exposed only the concurrently owned serial manifest
producer missing `execution`; after the supervisor added
`execution: { mode: "serial" }`, the package check passed. No Lab/full corpus
run, Core or extension edit, commit, or push was performed.

## Saved-jobs correction

The shard-parent execution identity now also requires `jobs`, bounded to a
positive safe integer no greater than `shardCount`. Strict parsing rejects an
absent value, zero, a non-integer, and a value above the shard count. Canonical
manifest creation/loading retains the exact value, allowing resume and
shared-load comparison to use the frozen concurrency shape. Child identities
remain unchanged because they do not schedule the parent worker pool.

Correction validation:

- `pnpm --filter @fluxiq-web-extension/test-runner check` — passed.
- `pnpm --filter @fluxiq-web-extension/test-runner build` — passed.
- Focused campaign-store and shard-group-store tests — passed, 16/16.
- Owned-file `git diff --check` — passed; line-ending advisories only.
