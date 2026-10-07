# t289-C (W19 / R2-U-10): previous run's thread at the start of a new build

## Outcome

Done. The cause was in the product, and the product is now fixed. When the panel reads without naming a project, the
extension used the project stored in its own session and asked Core only when nothing was stored. It now asks Core's
current context first and adopts Core's answer. It falls back to the stored project only when Core names none, cannot
be asked, or does not answer within 1 s. No Lab change is needed for moment 01: the Lab selects the run's project in
Core before the browser starts.

## Root cause (established)

- The panel's unscoped reads go `panel-control-deps.ts:18` `projectId: () => connection.resolveProjectId("panel")` →
  `FluxIQConnection.resolveProjectId` → `ProjectContext.resolve("panel")`. (The t276/t277 reports name `current()`. The
  relay actually calls `resolve()`, which returned `current()` whenever a project was stored.)
- In the old `resolve()`, `current()` (the recording slot, else `session.projectId` from extension storage) came first.
  `fetchProjectIdFromCoreSnapshot` ran only when nothing was stored. A preserved browser profile still holds the earlier
  run's project, so Core was never asked and the panel listed the earlier project's thread ("Your automation … is
  ready").
- Lab order (`packages/test-runner/src/run-scenario.ts`): `prepareIndependentCreationProject` →
  `selectExistingContext(projectId)` (line 272) runs **before** `launchBrowser` (277) and `openLivePanel` (295). So Core
  already names the run's project when the panel opens. Moment 01 was not only a matter of Lab timing: the product
  ignored Core's answer.
- Second defect, found by the tests: the old lookup did `activeRecordingProjectId ??= projectId` even outside a
  recording. The first lookup then pinned that project into the recording slot, and later changes to Core's context
  were never followed. This is the fail-first test "a lookup outside a recording pins nothing".

## Core's contract (what is authoritative)

- Durable project ownership is Core's (repository rule). Core answers "which project is current for this client" in
  `/api/client-gateway/snapshot`. `fetchProjectIdFromCoreSnapshot` reads it as the gateway session's binding
  (`sessions[].projectId`, set by Core at recording start or pairing), else
  `webRuntime.automationStudio.activeProjectId`, which is the context the Lab's `selectExistingContext` and Core's
  Studio stamp. The extension's stored `session.projectId` is only a cache of what Core last said.

## What changed and why

`apps/extension/src/background/connection/project-context.ts`:

- `resolve(reason)`:
  - When a recording is running under a known project, that project is returned and Core is not asked.
  - With no pairing token, the stored project is returned and Core is not asked.
  - Otherwise Core is asked first. If Core names a project that differs from the stored one, `adoptProjectId` persists
    Core's project and the activity log records "Project context linked". If Core names the stored project, nothing is
    written or announced.
  - The stored project is returned when Core names none, refuses, is unreachable, or misses the bound.
- Calls that arrive together share one lookup, and a settled answer is reused for `CORE_PROJECT_CONTEXT_REUSE_MS` =
  1000 ms. A burst of reads therefore costs one request, for example the panel opening or one snapshot per runtime step.
- A read waits at most `CORE_PROJECT_CONTEXT_LOOKUP_BOUND_MS` = 1000 ms. This is below
  `RECORDING_START_PROJECT_LOOKUP_BOUND_MS` (1500), so a slow Core starts a recording under the stored project rather
  than under none, as before. A lookup still open past the bound is replaced on the next read, so one hung request
  cannot stand in for Core indefinitely.
- The recording slot is filled from a Core answer only when it is `null`, which means Core accepted a recording with
  no project. It is never filled outside a recording, which fixes the pinning defect above.
- "Project context unavailable" is logged only when there is no stored project to fall back on, as before. An
  unreachable Core with a stored project does not add a warning on every read.
- `ProjectContextDeps` gains two optional members: `now` and `lookupBoundMs`, both for tests. `connection.ts` needs no
  change.

`apps/extension/src/background/connection/tests/core-api.test.ts` gains 12 `ProjectContext` tests, with the header
comment updated. The folder already holds 25 files, so I extended the file that owns the `fetch` stub, as the brief
asked.

## Every other caller checked

- **Panel relays** (`conversation-relay.ts`, `run-control.ts`, `panel-control.ts` via `panel-control-deps.ts`):
  - `projectFor(requested, …)` uses a project the panel names before it calls `resolve`. An explicit selection made in
    the panel (`fluxiq:chat-project` → the panel's `shownTarget.projectId` → `thread-requests.ts:43`) therefore always
    wins on its own reads.
  - Adoption changes `status.projectId`, and `panel/chat/owner-context.ts` resets the chat owner when it changes
    (`shownTarget` goes back to `latest`). The explicit selection therefore holds until Core's context actually
    changes, and is not disturbed while Core names the stored project.
- **Recording** (`active-recording.ts` `lookUpProject` for `recording_start` and retries; `recording-evidence.ts` for
  `recording_evidence`, `initial_state` and `snapshot`):
  - While a recording has its project, nothing changes and no Core request is made.
  - Recording-start retries now really follow Core's moved context, as the comment at `active-recording.ts:451`
    intended.
  - Outside a recording, snapshot reasons ask Core, at most once per second.
- **`current()`** (synchronous; `active-recording.ts` `beginWithoutAcceptance` after the bound) still returns the
  recording's project, else the stored one. That is now the adopted one once a lookup has run.
- **Pairing and reconnection** (`server-command-channel.ts` `handleSessionReady`, the `gateway-session.ts` token
  clear) still write `session.projectId` themselves. They are untouched, and both write Core's own word.
- **`connection.ts:381` and `automation-relay.ts:53`** read `session.projectId` directly, so they benefit from the
  adoption and are unchanged.

## Commands run and observed results

- Fail-first, with the old `project-context.ts` still in place:
  `node …/scratchpad/tools/run-subset.mjs D/apps/extension t289-c src/background/connection/tests/core-api.test.ts`,
  then `node --test --test-reporter=spec <bundle>` → `tests 18, pass 14, fail 4`. The failures:
  - "a read with no project named gets Core's current project over a stale stored one…": `actual: 'project-old'`,
    `expected: 'project-new'`.
  - "Core's gateway-session binding is Core's answer too…": `actual: 'project-old'`, `expected: 'project-bound'`.
  - "a lookup outside a recording pins nothing…": `activeRecordingProject()` was `'project-a'`, expected `undefined`.
  - "reads at the same moment share one lookup…".
- After the fix, `run-subset.mjs` on 10 files: `background/tests/connection-status.test.ts` (it constructs the real
  `FluxIQConnection`), `connection/tests/{core-api,active-recording,active-recording-stop-lifecycle,recording-evidence,page-evidence-capture,server-command-channel}.test.ts`
  and `panel/tests/{conversation-relay,panel-control,run-control}.test.ts`. Then `node --test` → `# tests 110`,
  `# pass 110`, `# fail 0`. This was run again after the final bound change, with the same result.
- `pnpm.cmd --filter @fluxiq-web-extension/extension check` → refused: "FluxIQ Core's build at …/t289/!FluxIQ is 9
  minute(s) behind its source" (Stale: `packages/fluxiq/src/programs/automation-studio/runtime/conversations/instructions/fallback.ts`,
  edited concurrently by another worker). As the brief allows, I ran `node scripts/check-extension.mjs` in
  `apps/extension` instead → exit 0, no output (type-checks both projects and bundles every entry).
- `node scripts/structure-audit.mjs` from D → `structure-audit: passed (172 warning(s), 118 baselined)`. None of the
  warnings concern my files: `project-context.ts` has 141 lines and `core-api.test.ts` 256.
- I removed the scratch bundle directory `apps/extension/.test-build-scratch/t289-c` afterwards.

## Not verified

- I made no live browser or Lab run (forbidden by the brief). Moment 01 showing the run's own empty chat is reasoned
  from the Lab order and the tests; it was not observed.
- The extension check ran against Core's stale dist, so Core's newest edits were not part of it.
- I did not run the panel-side tests (`panel/chat/**`). Their files are unchanged, but the timing of the owner reset
  at panel open changed (see below).

## Open questions or contradictions found

1. **The briefs cite the wrong function.** t276/t277 name `current()` as the panel's path. The panel actually calls
   `resolve("panel")`; `current()` mattered only because `resolve` returned it first.
2. **Residual risk in `core-api.ts` (not mine; owner: extension connection lane).**
   - Core keeps disconnected sessions in its snapshot, with `status: "disconnected"` and their `projectId`
     (`!FluxIQ/packages/fluxiq/src/client-gateway/service/lifecycle.ts:59-68`).
   - `fetchProjectIdFromCoreSnapshot` matches the stored `sessionId`, else the first session with the same `clientId`,
     whatever its status.
   - If the panel reads before the new socket's `session_ready` and the same Core process still lists the previous
     run's closed session with a recording binding, that stale binding would win over `activeProjectId`.
   - Suggested change in `core-api.ts`: consider only sessions whose `status` is `"ready"` (or not `"disconnected"`)
     for `sessionProjectId`, and fall back to `activeProjectId` otherwise.
   - Also suggested: give that `fetch` an `AbortSignal.timeout(...)`. My bound protects reads, but the request itself
     has no timeout.
3. **Panel side (owner: panel stream; no change is required, this is for awareness).** Adoption at panel open changes
   `status.projectId`, which resets the chat owner (`owner-context.ts`) while the first `latest` read may still be in
   flight. The reset owner reads again and gets Core's project (reused answer, no second request). If the panel ever
   showed the discarded controller's result, it would be a brief flash. Worth one look in the next live UI review.
   Before this change the same reset happened later, mid-build, when the recording start linked the project.
4. **Lab change: none needed.** For a stricter moment-01 picture regardless of the product, the optional change in
   `packages/test-runner/src/run-scenario/chat-build/creation/project.ts` would be: after `selectExistingContext`,
   return the project so `run-scenario.ts` dispatches `fluxiq:chat-project` with it (as
   `extension-chat-check/panel-driver.ts:113` does) right after `openLivePanel` and before the start capture. With this
   fix it is redundant.
5. **Docs.** `docs/architecture/` may describe project resolution as "stored first, Core when unknown". I did not
   check or edit it; it is outside my files.
6. `apps/extension/package.json` shows as modified in D. That is not my change; it belongs to another worker.

## Next live UI review must see

Moment 01 shows the run's own (empty) project chat, never the previous run's "is ready" thread, with the same preserved
profile and workspace. If the old thread still appears, look at item 2 first: a stale disconnected-session binding in
Core's snapshot.
