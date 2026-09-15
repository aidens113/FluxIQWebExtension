# `bj-sharded-cli-wiring` — logical lifecycle dispatch

## Outcome

The CLI now exports and dispatches the completed sharded campaign stack.
Creation remains byte-for-byte on the serial `createResumableBench` path when
`--shards` is absent. With `--shards`, it calls `createShardedBench`, passing the
exact shard count and either explicit jobs or the default
`min(shardCount, 2)` machine cap.

Resume first loads the immutable campaign manifest and uses its execution mode:
serial authority calls `resumeBench`, shard-parent authority calls
`resumeShardedBench`, and a shard child is refused as a logical campaign. No
creation-time shard/job value is accepted or passed during resume; the
orchestrator reads its frozen scheduler shape from parent authority.

The bench branch loads scenario manifests and builds compatibility exactly once
before either serial execution or child scheduling. Both sharded create and
resume receive the same process-independent slot root under `os.tmpdir()`, so
different A/B run roots share the machine cap. That internal path is never
included in lifecycle output.

The existing lifecycle format is preserved. Only logical parent `created` and
`resumed` records print their bench ID and logical directory; child scheduling
receives no lifecycle callback and intermediate orchestration events are not
printed as campaign identities.

## Exports

- `bench/campaign/index.ts` now exposes the machine-slot, shard-group/store, and
  shard-plan seams.
- `bench/index.ts` now exposes authenticated shard merge and the stable
  `createShardedBench` / `resumeShardedBench` orchestrator.
- Earlier comparison imports were routed through the expanded campaign barrel,
  satisfying the repository ownership-boundary audit.

## Tests and validation

The new direct CLI wiring test combines source mutation guards with runtime
barrel imports. It pins serial/sharded create discrimination, saved-mode resume,
absence of resume overrides, the default job cap, single preparation, shared
OS-temp slot root, approved exports, and logical lifecycle filtering.

- Focused CLI wiring test — passed, 4/4.
- `pnpm --filter @fluxiq-web-extension/test-runner check` — passed.
- `pnpm --filter @fluxiq-web-extension/test-runner build` — passed.
- `pnpm --filter @fluxiq-web-extension/test-runner test` — passed, 799/799.
- `pnpm structure:check` — passed with advisory warnings only.
- Owned-file `git diff --check` — passed; line-ending advisories only.

No command parser, orchestrator implementation, store, merge, executor, Lab,
Core, or extension file was edited for this task. No Lab/corpus run, commit, or
push was performed.
