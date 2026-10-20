# Lane S-D4 (t728): the domain keys its build memories off Core's build lifecycle and keeps them in Core's store

Worker report for brief D4, audit finding 8. Domain side only. Nothing committed.

## Outcome

Done.

- The domain no longer works anything out from Core's call ids. It reads `automationStudioEvidenceBuildScope()` instead.
- The four per-build memories (arrival, shown addresses, held literals, own layers) are keyed by Core's `buildId`, plus `callScope` when briefs run side by side. They reset only when `opening === "fresh"`.
- Those four memories, and the cleared way-out registry, now write through to Core's durable domain build state. After a restart they read back from it.
- The repeated-answer reason now comes from Core.

## What changed and why

Domain tree: `C:/Users/osrs_/FluxStuff/fxwork/t728/!FluxIQWebExtension/domain/src`. Below, LE = `runtime/llm-evidence`.

### New adapter: `LE/node-run/build-state/`

This is a subfolder. `node-run/` already holds 25 files, which is the directory-files limit.

- **`build-key.ts`**
  - `webNodeBuildOf(request)` returns `{ build: {projectId, flowId, buildId, callScope}, opening }`, read from Core's frame.
  - A frame for a different project or Flow is ignored.
  - With no frame (a direct call or a test), `buildId` and `opening` are undefined. The memory is then keyed by project and Flow only. It never resets and is never stored.
  - `webNodeBuildSlot(build)` returns the key for the in-process maps.
- **`persistence.ts`**: `createWebNodeBuildStatePersistence(source)`.
  - Store scope is `{projectId, flowId, buildId}`. The key is `<memory>` or `<memory>:<callScope>`.
  - Writes are queued per key, applied in order and coalesced. Each value is encoded when it is written.
  - `settled()` never rejects.
  - Write failures are best effort: the comment says so, and the in-process memory stays authoritative.
  - On read, a Core refusal counts as "nothing stored". Any other error is rethrown, as the audit's failure-as-empty rule requires.
  - It does nothing when there is no `buildId` or no store.
- **`memory.ts`**: `createWebNodeBuildMemory<T>`. A bounded in-process cache sits in front of the store.
  - `restore(build)` reads only when this process holds nothing for that build and has not read it yet.
  - `entry`, `get`, `saved` and `forget` cover the rest. `forget` drops the stored copy too.
  - A build evicted past the bound is read back from the store if it calls again.

### Memories

- **`arrival.ts`**
  - `OPENING_CALL_PREFIX`, `webNodeOpensBuild`, `CALL_SCOPE` and `coreOpening` are removed.
  - `webNodeHeldFlow`, `webNodeRepairedFlow` and `webNodePreparedEntry` now take `{ value, opening }`. Each reads its key only when `opening !== undefined`.
  - `opening(build, opening)` forgets only on `"fresh"`.
  - The key is `web.arrival`, with value `true`.
  - `WebNodeBuildKey` moved to `build-state/` (it now carries `buildId` and `callScope` instead of `sessionId`).
- **`shown-addresses.ts`**
  - Key `web.shown-addresses`. Stored value: `{addresses: [[path, [[k,v]...]]...], typed: [...]}`.
  - It writes only when the set of addresses or typed texts actually changed.
- **`held-literals/memory.ts`**: key `web.held-literals`. Stored value: `{entries, saved, selectors}`.
- **`own-layers/memory.ts`**: key `web.own-layers`. Stored value: the list of handles.
- **`run.ts`**
  - It reads `opening` from the frame. The memories reset on `opening` as before; behaviour is otherwise identical.
  - `buildOf` returns the new key. `stores.targets` only needs `{projectId, flowId}`, so passing the new key there is compatible.
  - The file is now 800 lines, which is exactly the limit. It was 798.

### `LE/tools.ts`

- `createWebAutomationLlmEvidenceRuntime(sessions, clearedWayOuts?, buildState?)` takes a new optional third argument, a source that returns the store.
- `executeTool` does three new things:
  1. It reads the frame.
  2. It calls `repeatedRefusals.startedOver(slot)` on **any** opening (fresh or continuing, scoped or not). Its slots are keyed by build and callScope, so one brief's opening resets only that brief's slots. This fixes the known gap where a scoped brief opening did not reset repeated refusals.
  3. It restores the four memories before dispatch, and in `finally` it awaits `persistence.settled()`. A call's memory changes are stored before its answer returns.
- `OPENING_LOOK_CALL_ID` and `opensExploration` are removed.
- `bindWebAutomationLlmEvidenceRuntime` passes `webAutomationBuildStateSource(fluxiq)`.
- `returnedEvidence` is still keyed by session. It was outside the brief.

### `LE/repeated-refusal.ts`

- It imports `AUTOMATION_STUDIO_REPEATED_ANSWER_REASON` from `fluxiq/automation-studio`, replacing both literals.
- Comments now describe build-keyed slots.

### `cleared-way-outs/`

- **`build-state-source.ts`** (new): `webAutomationBuildStateSource(owner)`.
  - It asks for the store lazily, on first need, through Core's `automationStudioDomainBuildState(owner, "web-automation")`.
  - An owner without the store's shape (a test double) gets none.
  - An `AutomationStudioDomainBuildStateRefusal` (domain not yet registered) is retried next time. Other errors propagate.
- **`registry.ts`**
  - `keep(wayOut, flow?)` now also writes to that Flow's record. The record is Flow-scoped (no build id), under key `web.cleared-way-outs`, as a list of `[reference, wayOut]` pairs.
  - The record is bounded at 256 entries and 60 KiB. Oldest entries go first, and a single entry too large to store never pushes the others out.
  - New `find(reference, flow?)`: it tries the process cache first, then the Flow's record. A Core refusal on reading returns undefined; other errors propagate.
  - New `settled()`. `get` is unchanged.
- **`owned-by.ts`**: the registry for each instance is now built with that instance's store source.

### Callers of the registry

- **`io/gateway-output-dispatcher.ts`**
  - `dispatchFlow(request)` works out the dispatch's Flow. It takes the owner of `commandContext` (`ClientGatewayCommandContext.owner`) when a run's step is required, and otherwise the frame of Core's evidence build.
  - Ways out are kept with that Flow. When any were kept, the dispatcher awaits `settled()`.
- **`LE/way-out-handles/cleared-control-handles.ts`**: uses `await wayOuts.find(reference, {projectId, flowId})`.

### Tests

**Rewritten to drive Core's frame** (`runWithAutomationStudioEvidenceBuildScope`) instead of `initial.*` ids:

- `node-run/tests/arrival.test.ts`
- `node-run/tests/shown-addresses.test.ts`
- `held-literals/tests/memory.test.ts`
- `own-layers/tests/memory.test.ts`
- `tests/repeat-across-explorations.test.ts`
- `tests/reauthor-reruns-own-extraction.test.ts`
- `retries/tests/uncertain-outcome.test.ts`
- `node-run/tests/press-raw-read.test.ts`

The seam tests in `arrival.test.ts` that go through Core's real registry (`bound(...)`) still send `initial.core.run_node`. Core reads those ids itself, and those tests pass. Several tests now deliberately send `initial.*` ids *without* a frame `opening`, to prove the ids are no longer read.

**New tests:**

- **`node-run/build-state/tests/memory.test.ts`** (5 tests):
  - frame reading;
  - restore after a restart, and a fresh forget dropping the stored copy;
  - briefs kept apart by callScope, and no store without a `buildId`;
  - ordered and coalesced writes, plus a value Core refuses for size (the stored copy and the in-process memory are both kept);
  - a build evicted from the bound being restored.
- **`node-run/build-state/tests/core-store.ts`**: a test-support helper that builds Core's **real** `AutomationStudioDomainBuildStateStore` and accessor in memory (no storage root).
- **Restart tests** (a new runtime instance over the same store), one in each of these files:
  - arrival: arrived before a restart → a press runs after it without navigating; a fresh opening re-arms the rule in the store; plus a test that a different `buildId` is not arrived;
  - shown addresses;
  - held literals: with a control showing that, without the store, the restarted host refuses the call;
  - own layers.
- **Way-out restart tests:**
  - registry: Flow-only lookup, two restarts with merging and the 256 bound, an oversized way out, and the owner-carried store;
  - dispatcher: a dispatch inside the evidence frame, then a restarted fake host whose bound runtime still names the handle, but not for another Flow;
  - cleared-control-handles: after a restart the handle resolves to `#slow-down-ok`.
- **Repeat tests:** a continuing re-author starts over, and a scoped brief starts over without touching the other brief's count.

## Commands run and observed results

All from `D/domain` unless noted.

- **Baseline, before any edit:** the 11 named test fragments → `# tests 84 # pass 84 # fail 0`.
- **First post-change runs failed because the machine was out of memory, not because of the code.**
  - V8 printed `Fatal process out of memory: Zone`, esbuild printed `fatal error: out of memory`, and the structure audit exited 3 with the same crash.
  - PowerShell showed only 214 MB of free commit memory, with other workers running.
  - I waited until free commit memory was above 2.5 GB, then reran in two groups.
- **`pnpm --filter @fluxiq-web-extension/domain check`**, which runs tsc on src and tests:
  - The first run failed: `TS2300 Duplicate identifier 'before'` in own-layers/memory.ts, where I had shadowed a parameter. Fixed.
  - Final run: exit 0. Output: `core-build: ... is current with its source.` and `{"build-cache":"build","step":"domain:check",...}` with no errors.
- **`node scripts/structure-audit.mjs`** (repo root):
  - The first clean run showed 8 FAILs, all mine:
    - `as-never` in core-store.ts;
    - 4 `contract-spread` (conditional spreads in LE tests);
    - 2 `failure-as-empty` (registry queue `.catch`, persistence read);
    - `file-lines` (run.ts at 801).
  - All fixed: a typed `Pick<ProjectPaths,"root">` stub, frames written without conditional spreads, refusal-only catches, and run.ts trimmed to 800.
  - Final run: `structure-audit: passed (210 warning(s), 638 baselined).`
- **Final narrow runs, after all fixes:**
  - `DOMAIN_TEST_BUILD_LABEL=lane-s-d4 node scripts/test-domain.mjs node-run/tests/arrival node-run/tests/shown-addresses held-literals/tests/memory repeat-across-explorations reauthor-reruns-own-extraction uncertain-outcome` → `# tests 69 # pass 69 # fail 0`.
  - `... press-raw-read own-layers/tests/memory build-state/tests/memory cleared-way-outs/tests/registry gateway-output-dispatcher-cleared-layers cleared-control-handles` → `# tests 33 # pass 33 # fail 0`.
- **Wider runs beside the changed files.** These ran before the audit fixes. Those fixes changed only the read-failure handling in the registry and persistence, a test helper and test frame literals, and the two final runs above re-covered them.
  - `... llm-evidence/node-run/tests/` → `# tests 251 # pass 251 # fail 0`.
  - `... runtime/llm-evidence/tests/ src/io/tests/ harness-options/tests/` → `# tests 278 # pass 278 # fail 0`. The dispatcher's cleared-layers subtests appear in that output.
- **Grep of `domain/src` (non-test) for `initial.` / `OPENING_CALL_PREFIX` / `OPENING_LOOK_CALL_ID` / `CALL_SCOPE`:** only two history comments remain (arrival.ts:62 and build-state/build-key.ts:5). No call-id parsing is left.

## Not verified

- No live or browser run.
- No test against a real `FluxIQ` instance with an on-disk storage root. The restart tests use Core's real store in memory mode, behind the real accessor.
- No test of the dispatcher's `commandContext` branch (`ClientGatewayCommandContext.owner`). The test uses the evidence-frame branch.
- Not checked whether a candidate trial's dispatches carry either a `commandContext` or a frame. If they carry neither, ways out pressed during trials stay in process memory only, as before.
- No full suites, per the twice-a-day rule.
- The wider directory runs were not repeated after the final audit fixes (see above).

## Open questions or contradictions found

1. **Where `build-state-source.ts` lives.** It sits in `cleared-way-outs/` because that is the only owned place both the registry and the evidence runtime already import. A neutral home, such as a domain-level `build-state/` module, would be cleaner, but it is outside this brief's ownership.
2. **Shown addresses can exceed Core's 64 KiB limit on one value.** A build that has seen very many links, such as a page with 1,200 links, will have that write refused. It stays at its last stored copy, or none. After a restart that can only cause extra refusals, never extra permissions. Fixing it would need chunking across keys or a larger Core bound.
3. **A continued stopped build gets a new `buildId`** (lane S-E question 3). Its build-scoped memories therefore start empty, as the old "new process" comments already said. Way outs are Flow-scoped and survive it.
4. **`node-run/context.ts`** (not owned) still describes `arrivals` as "held by the runtime for the life of the process". That is now stale: arrival is also in Core's store. It is a one-line comment fix for whoever owns that file.
5. **run.ts is at exactly 800 lines**, the hard limit. The next addition there will need a split.
