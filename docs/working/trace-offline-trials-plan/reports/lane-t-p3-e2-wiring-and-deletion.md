# lane-t-p3-e2-wiring-and-deletion: report

Repository: FluxIQ Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t742/!FluxIQ` (branch `task/t742-trace-intake-parity`). Nothing committed.

## Outcome

Done. Both gaps are fixed, and each has a test that failed before the fix and passes after it.

1. In production, traces are now sealed with the host's project content protection whenever one is configured. This is the same protection the service's own protected content store uses (`reusableLlmContextContentProtection`), read from the same field. With no protection configured, traces are stored exactly as before.
2. In the object-store (`storageRootDir`) layout, deleting a project now removes its `projects/<id>/` directory. That directory holds `project.sqlite` (traces, chunks, events and the content-object index), the content objects and the recording objects. Another project's data stays and reads back exactly.

## What changed and why

All paths are under `packages/fluxiq/src/programs/automation-studio/`.

**Protection wiring (`runtime/gateway-trace/wiring/`)**

- **Why the protection is read late.** The framework binds the host's protection *after* the service is built (`framework/index.ts:244` calls `bindReusableLlmContext`). A protection captured at construction would therefore always be empty. The wiring instead reads the service's field each time a trace store opens.
- `types.ts`: adds `AutomationStudioGatewayTraceProtectionSource = () => AutomationStudioProjectContentProtection | undefined`.
- `service-pools.ts`:
  - `adopt(owner, pool, protection)` now takes the protection reader as a required argument. It keeps the reader in a WeakMap keyed by the pool.
  - New `protectionOf(pool)` returns that reader. For a pool no service adopted, it throws `gateway trace pool was adopted by no service, so its content protection is unknown`. It does not guess "unsealed". The episodes already report a store that cannot open and carry on untraced (`episodes.ts` `bindPending`/`open`).
  - `of(owner)` is unchanged, so `programs/_shared/runtime.ts` did not need editing.
- `project-store.ts`: the constructor now requires `protection` (the reader). Each operation reads it and passes it to `AutomationStudioProjectGatewayTraceStore.open` when it is set; when it is unset, nothing is passed.
- `host.ts`: `storeFor` builds the project store with `protection: AutomationStudioGatewayTraceServicePools.protectionOf(pool)`.
- `runtime/service.ts`, one in-place edit (line 438): `adopt(this, new AutomationStudioProjectDatabasePool(...), () => this.reusableLlmContextContentProtection)`. No line, method or statement was added.

**Project deletion**

- `runtime/service/projects/files-removal.ts`: `removeAutomationStudioProjectFiles` no longer returns early in the object-store branch. It deletes the program-state documents, then closes the project's idle connection, then removes the directory (`rm -r`). The folder layout behaves as before.
- `runtime/service.ts` `deleteProject`, object-store branch: an in-place expression edit. The transaction's closing `});` became `}).then(() => removeAutomationStudioProjectFiles({ objectStore, pool: this.runtimeProjectDatabasePool, projectId, projectDirectory }))`.
  - Files are removed only after the index and documents transaction commits. If the commit fails, no data is removed.
  - The document deletion inside the removal runs a second time, after the transaction already did it, and changes nothing. This is noted in the file's doc comment.
  - The order is now the same as the folder branch: write the index, remove the files, purge the UI cache.
- The program-state databases (`program.state` / `automation.state`) sit at the storage root (`_shared/storage.ts` `sqliteStateForPath`), not under `projects/<id>/`, so removing the directory cannot touch them.

**Tests**

- New `runtime/gateway-trace/wiring/tests/host-protection.test.ts` (real-sql, 3 tests):
  - **Sealed.** Builds a real `AutomationStudioService` and the host wiring over its pool, as `runtime.ts` does, and calls `bindReusableLlmContext` after construction. It records a small event, a large chunked event and an artifact through `host.source.current()` inside an episode, then closes the project's connection.
    - None of the three markers appears in any file under the project directory.
    - Reading through `AutomationStudioGatewayTraceProjectStore` returns all three.
    - A bare store opened without the protection throws `protected`.
  - **Control.** Without a protection, the markers for the small event and the artifact appear on disk, and everything reads back. The large event is deflated into chunks, so its plaintext is not expected on disk.
  - **Refusal.** An unadopted pool throws, and an adopted service with no protection gives `undefined`.
- New `runtime/service/projects/tests/delete-project-object-store.test.ts` (real-sql):
  - Uses the object-store layout (`config.json` `layoutVersion: 2` and `storageRootDir`). It creates two projects, each with a trace (with chunks and an artifact) and a recording object asset, then deletes one.
  - The deleted project's directory is ENOENT, its asset no longer reads, and it is missing from `listProjects`.
  - The kept project's trace events read back byte-exact, and its artifact and asset still read.
  - Reopening the deleted project gives zero rows in `client_gateway_traces`, `_events`, `_chunks`, `_chunk_uses`, `_artifacts` and `objects`.
- `wiring/tests/gateway-tap-episodes.test.ts`: the `adopt` call now passes `() => undefined`, because the argument is now required.
- **Fails before the fix.** Before the code changes, both new files failed:
  - 3 wiring tests: "gave no open trace" and "adopted by no service".
  - The deletion test, at `access(deletedDirectory)`: "promise resolved undefined instead of rejecting". It had reached that line, so asset writes, the before-counts and `deleteProject` all worked.
- **Mutation check.** I set `service.ts`'s reader to `() => undefined`, and the sealed test failed (1 failed, 2 passed). I restored the file and checked the diff.

## Commands run and observed results

All from `packages/fluxiq`, unless noted.

- `pnpm exec vitest run src/programs/automation-studio/storage src/programs/automation-studio/runtime/gateway-trace src/programs/automation-studio/runtime/service/projects src/programs/automation-studio/api/handlers/tests/caches.test.ts`
  - `Test Files  95 passed | 2 skipped (97)`
  - `Tests  618 passed | 4 skipped (622)`
  - The added paths are the tests beside `files-removal.ts`, plus the only other test that calls `deleteProject`.
- After the last test edit: `pnpm exec vitest run src/programs/automation-studio/runtime/gateway-trace/wiring`
  - `Test Files  4 passed (4)`
  - `Tests  17 passed (17)`
- `pnpm exec tsc --noEmit`: `tsc exit 0`, run after the last edit.
- `node scripts/structure-audit.mjs` (from the worktree root):
  - `structure-audit: passed (428 warning(s), 1152 baselined).`, exit 0.
  - It also printed `1 baseline entries can be lowered`. Lanes A and E saw the same, and I did not touch the baseline.
  - The first audit run failed `[shared-temp-root]` on my stray-pool path under `os.tmpdir()`. I moved it under the test's own temporary directory, and the audit then passed.

## Not verified

- No live host run, so the framework's real `bindReusableLlmContext` call with its real key resolver was not exercised. The test calls the same method with an AES-GCM test key.
- On Windows, a project whose database is held by a live lease (for example a trace write in flight) during deletion. `closeIdleProject` closes only an idle connection, so `rm` could fail with EBUSY *after* the index transaction committed. The project would then be gone from the index while its directory remains. The folder layout already had this behaviour. `withProjectRemoval` guards parked runs, but not trace writes.
- No full package suites were run, per the twice-a-day rule.

## Open questions or contradictions found

1. **Writing without a protection.** With no protection configured, traces are still written unsealed. This keeps "behaviour unchanged" as the brief asks. Report E's question 1, whether the trace store should refuse to write without a protection, is still a supervisor decision.
2. **Folder-layout `.json` side state.** In the folder layout with `dataDir` and storage layout v2, `removeAutomationStudioProjectFiles` is called with `objectStore` undefined, so it never calls `ProgramJsonStore.deletePath`. If such a layout keeps project documents in program state, they would outlive the project. I did not investigate this, because it is outside the brief's object-store gap.
3. **Duplicated deletion route.** The object-store branch of `deleteProject` deletes the documents inside its transaction and again (as a no-op) inside `removeAutomationStudioProjectFiles`. Removing that duplication would need a second exported removal function and a new import line in the frozen `service.ts`, which the brief's in-place-only rule did not allow.
