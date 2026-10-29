# t789-store report (lane B1, hosted H1)

## Outcome
Done. `PlatformStore` seam (types.ts untouched) is implemented twice, plus `createPlatformStore`.

## What changed and why
All under `packages/fluxiq/src/platform/store/` (Core tree fxwork/t789/!FluxIQ), plus one line in `platform/index.ts`.
- `index.ts` barrel; `create-platform-store.ts` (`createPlatformStore({ repository? })`).
- `errors/` `PlatformStoreConflictError` (`field: "email" | "externalId"`).
- `rules/` `normalizeEmail`, `isLinkTokenUsable` (purpose match, unused, `expiresAtMs > nowMs`), `SerialQueue`.
- `memory/MemoryPlatformStore` (Maps, structuredClone in and out).
- `repository/` `PlatformRecordRepository` port (structural, no `programs/` import), `PlatformRecords` (ids `<kind>/<key>`, envelope kind `platform.<kind>`, scope `domainId: null`), `RepositoryPlatformStore`. Email and externalId index rows (`email/<enc email>`, `external/<enc id>` -> `{userId}`) keep `findAccountBy*` a get; stale index rows (account gone or value changed) are ignored. `putAccount` writes new indexes, then the account, then removes the old indexes. `consumeLinkToken` is serialized per process (SerialQueue); across processes it is last-writer-wins, as the seam says. No caching between calls.
- `platform/index.ts`: added `export * from "./store/index.ts";`.
- Tests in `store/tests/`: `platform-store-suite.ts` (shared suite and builders), `fake-record-repository.ts`, `memory-platform-store.test.ts`, `repository-platform-store.test.ts` (same suite over a fake repo, plus row layout, get-not-scan, stale index, second store sees writes), `sqlite-platform-store.test.ts` (`// @fluxiq-test-group real-sql`, real `SQLiteRepository` in a temp dir, reopened).

## Finding for the supervisor (affects the brief and lane B2)
`SQLiteRepository.put` writes `kind: this.kind` (the repository's own kind) over the envelope's kind, so on a real SQLite repository every row reads back with the repository kind, not `platform.<kind>`. Filtering by envelope kind (as `iam/store/repository/records.ts` does with `iam.<kind>`) returns nothing there. I therefore tell kinds apart by id prefix (`<kind>/`) and still write `platform.<kind>` as the envelope kind (honoured by other repositories, ignored by SQLite). The IAM `IamRecords` has the same latent defect on SQLite (its tests use only a fake); I did not touch it (not owned). The real-SQL test caught this.

## Commands run and observed results
- `pnpm test src/platform/store` (packages/fluxiq) -> parallel group: 2 files, 35 tests passed; real-sql group: 1 file, 1 test passed; "all groups passed: parallel, real-sql".
- `node --max-old-space-size=6144 node_modules/typescript/bin/tsc --noEmit -p .` -> no output, exit 0.
- `pnpm structure:check` (Core root) -> "structure-audit: passed (450 warning(s), 1152 baselined)". An earlier run failed `[test-placement]` for a test in `tests/real-sql/`; fixed by flattening to `tests/`.

## Not verified
- Cross-process behaviour (two OS processes on one SQLite file); only two stores in one process share a repository.
- `consumeLinkToken` atomicity across processes (not provided; seam says last-writer-wins).
- No full package suite, no `pnpm check` (per the validation policy). Nothing committed.

## Open questions
- Should IAM's `IamRecords` be fixed for the SQLite kind override (lane B2)?
