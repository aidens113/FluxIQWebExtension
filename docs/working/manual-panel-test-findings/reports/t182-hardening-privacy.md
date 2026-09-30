# t182 — Reliability, privacy and diagnostics hardening (lane lead report)

Outcome: **Done, with three supervisor actions** (listed at the end). Nothing
committed. Trees: downstream and Core worktrees under
`C:\Users\osrs_\FluxStuff\fxwork\t182\`, branch `task/t182-hardening-privacy`.

Worker reports (verified by the lead, see Validation):
`t182-w1-core-withholding.md`, `t182-w2-lab-extension-storage-scope.md`,
`t182-w3-core-paired-relays.md` (same folder).

## 1. Reliability (plan 4.3; PANEL-007 "nothing reconnects after a browser restart")

Cause: reconnect ran only on `runtime.onStartup` and on a control page's
`getStatus`. An extension reload or update, and an MV3 worker that Chrome stopped
and an event restarted, never reconnected. The backoff timer also died with a
stopped worker. Two events could build two `FluxIQConnection`s at once and
orphan the first socket.

- `background/index.ts`: reconnect on every worker start (covers browser
  restart, extension reload/update, worker revival); `getConnection` and
  `reconnectIfPaired` are single-flight; `online` event and a reconnect alarm
  call `wakeConnection` (retry now, or reconnect if paired).
- `background/reconnect-watchdog.ts` (new): holds a `chrome.alarms` alarm
  (30 s) only while paired + auto-reconnect + not disconnected-by-person + not
  connected/pairing; cleared once connected. Feature-detected: **inert until the
  manifests grant `alarms`** (supervisor action 1).
- `connection/gateway-session.ts`: `retryNow()` (resets backoff, only when the
  session still wants a connection) and `wantsConnection()`;
  `connection.ts`: `retryConnection()`.
- Invalid saved state: `background/saved-state.ts` (new) validates settings,
  session, client id and offline queue field by field; `storage.ts` writes the
  repair back and reports it (field names only) to the problem log. Before,
  a non-string `coreApiUrl` made every background message throw.
- Timeout: `callCoreProgram` now answers `timed_out` ("may still be working,
  check before trying again") instead of "could not be reached" when its
  120 s limit expires (a conversation turn waits on a model).
  `PanelRelayFailureCode` gains `timed_out`; `panel/relay-failure.ts` excludes it.
- Core LLM-timeout handling itself is in `runtime/llm/**` (forbidden); not changed.

## 2. Privacy (plan 4.4)

- Core framework attempts (W1): `runtime/attempt-withholding.ts` (moved out of
  `packages/fluxiq/src/runtime/service.ts`, which now only imports it) withholds
  caller-marked values in `command.parameters/target/metadata` and
  `result.message/error/payload/target/metadata` and `failure.expected/actual`.
  **Note:** the lead brief forbade "runtime/service.ts"; I read that as
  Automation Studio's `programs/automation-studio/runtime/service.ts` (untouched).
  The framework file `packages/fluxiq/src/runtime/service.ts` was edited
  (imports + removal of the moved helpers only). Revert-able if that was meant.
- Core traces (W1 + lead): every run input is recorded for by-value withholding
  (`trace-withholding.ts` `supply`), so a copy under another key is withheld.
  Lead decision on W1's open trade-off: an input equal to the default the Flow's
  published interface declares is authored, not supplied, and is not withheld by
  value (`executor/contracts.ts` `declaredInputDefaults`, set by
  `composite-executor.ts` for Call Flow children). This fixed
  `composite-executor.test.ts` without changing its assertions. Remaining
  trade-off: a computed value equal to a supplied input reads `[withheld]` in
  the saved trace (never in the executed one).
- Lab attestation (W2): new `extension-storage` scope scans the Chromium
  profile's `Local/Sync Extension Settings/<id>` and `IndexedDB/chrome-extension_<id>_*`
  LevelDB files byte for byte (UTF-8/UTF-16LE), with log-record and Snappy table
  decoding; undecodable tables are counted (`undecodedLevelDbFiles`), not failed
  closed. Not scanned: the panel's `Local Storage/leveldb` (shared with web
  origins); Firefox (no Lab lane).
- Extension logs: `core-api.ts` no longer logs the gateway snapshot body (every
  paired client's session) or upload response bodies; status only.

## 3. Diagnostics (plan 4.8)

- Extension: `PANEL_REPORT_PROBLEM_MESSAGE` (`fluxiq.panel.reportProblem`,
  control pages only) answers `{ ok: true, report: ProblemReport }`, built by
  allowlist in `background/diagnostics/`: extension version, browser name/major,
  connection state/origins (no path/query), client/session/project ids,
  recording and runtime state, activity kinds/tones only, the last 30 redacted
  failures (`ProblemLog`, `chrome.storage.local`, redacted on write), and up to
  10 recent runs from `list-runtime-sessions` (ids, status, times). Never the
  token, pairing code, cookies, page URLs/text, typed values or activity text;
  `withheld` lists these. It still answers when Core is unreachable
  (`recentRuns.available: false` with the reason). The panel button is not
  built (panel UI is another lane's; supervisor action 3).
- Core: Problems view gains "Report problem" (copies
  `fluxiq.core-problem-report/1`: version when the host passes `fluxiqVersion`,
  browser, project/current object ids, validation status, counts, problem
  codes/severity/blocking/scope ids; never labels, messages or names).
  `problems/diagnostic-report.ts`.

## 4. Storage default root

Reproduced: `new AutomationStudioService()` forgot a created project at once and
named cwd-relative paths. Fix: `paths/project.ts` file helpers refuse with a
named error when there is no root (no more cwd writes); `projects/store.ts`
keeps the catalogue in memory for the service's lifetime. A root-less
`createRecording` **with a projectId** now refuses instead of writing into cwd,
because `writeProjectRecordingSession` in the forbidden `service.ts` writes
files unguarded (supervisor action 2 makes it in-memory).

## 5. Scope addition: Simple Mode relays (t181 seam)

- Extension `background/simple-panel/` handles all nine `SIMPLE_PANEL_MESSAGES`
  (same spellings as t181's `SIMPLE_RELAY_MESSAGES`, now in `shared/protocol.ts`
  with `SimplePanelRequest`). Each relay sends Core only named fields; model
  readiness is projected to `{kind, provider, enabled}` here too.
  `callCoreProgram` takes an optional `programId` (for `secret-keys`).
- Remove a recorded step: executable steps are indexed activity id -> `{recordingId, eventId}`
  (`background/recorded-steps.ts`); removal drops it from the offline queue if
  unsent, else calls `remove-recording-entry`; `removedCount: 0` answers
  "FluxIQ has not received that step yet". Index is worker-memory only.
  `lastStoppedRecordingId` feeds `generateFromRecording` (also worker-memory).
- Core (W3 + lead): allowlist adds the nine automation-studio endpoints and
  `secret-keys/snapshot`; `flows.write` added to token permissions (generate and
  review need it). Token requests are narrowed in `program-route.ts`:
  run needs `flowId`, refuses inline `flow`, `inputs`, LLM grant/intent,
  external side effects, `dryRunLlm`, `useReusableContext`, adaptive modes other
  than `no_llm_intervention`/`deterministic` (absent is forced to
  `no_llm_intervention`, since absent means fully adaptive); generate refuses
  `llm_assisted`, `instructions`, `constraints`; review refuses `policyOverride`,
  `reviewerId`, any decision but `approved`, and (lead) `destination`. Snapshot
  responses projected to kind/provider/enabled. `remove-recording-entry`
  (`runtime.control`, `authoring`) removes entries by `metadata.eventId` from an
  unfinalized recording. `durableBehaviorChanged` on run summaries via one
  shared helper (`runtime/durable-behavior/`).
- LLM decision: **no LLM grant or LLM-assisted generation via the pairing
  token.** Accepted residual: a Flow's standing result-check authorization
  (granted by the person in the panel) can still make its checked LLM call on a
  token run.
- `remove-recording-entry` needs the facade in `service.ts` (action 2). Until
  then the handler answers "not available in this FluxIQ yet" (structural guard,
  so Core compiles).

## Validation (lead-run; observed)

- Extension: `npx tsc -p tsconfig.json --noEmit` and `-p tsconfig.test.json` -> exit 0, no output.
  `EXTENSION_TEST_BUILD_LABEL=t182 node scripts/test-extension.mjs` -> `tests 1066, pass 1066, fail 0`.
  `node scripts/build-extension.mjs` -> exit 0; `node scripts/smoke-test.mjs` -> "Extension smoke test passed."
- Extension e2e: `npx playwright test -c e2e/playwright.config.ts e2e/reconnect.spec.ts e2e/resilience-and-isolation.spec.ts --workers=1`
  -> `4 passed (26.9s)`. With the worker-start reconnect line disabled and
  rebuilt, the reconnect test failed (`toBeGreaterThanOrEqual`), so it proves
  the fix; source restored and rebuilt.
- Downstream `node scripts/structure-audit.mjs` -> `passed (114 warning(s), 120 baselined)`.
- test-runner (W2): `tsc --noEmit` exit 0; its 4 test files built in-package and
  run with `node --test` -> `tests 24, pass 24, fail 0`.
- Core `packages/fluxiq`: `npx tsc --noEmit -p .` -> exit 0. vitest:
  withholding set (composite-executor, graph-run, trace-withholding,
  attempt-withholding) -> 44 passed; W3 set (handlers recordings/runs,
  entry-removal, conversions, durable-behavior) -> 29 passed; root-less probe +
  bridge/io-bridge/service-wiring -> 2 + 41 passed; 8 other root-less-service
  files -> 51 passed.
- Core `apps/web`: `npx tsc --noEmit` exit 0; program-route + route tests -> 52 passed;
  problems folder -> 29 passed. Core `node scripts/structure-audit.mjs` -> passed
  (194 warnings, 355 baselined; 1 entry can be lowered, not lowered).

## Not verified

Full Core suite and `pnpm check`/`pnpm test` at repo roots; Core `dist` not
rebuilt; any real pairing, live Core, Firefox, or real Chromium LevelDB
profile; the `alarms` watchdog in a browser (permission absent); removal
against a live recording; the Problems "Report problem" button in a browser.

## Supervisor actions

1. Add `"alarms"` to `permissions` in `apps/extension/manifest.chrome.json`,
   `manifest.e2e.json`, `manifest.firefox.json` (no install warning). Without it
   the reconnect watchdog is inert; worker-start, `online` and panel-open
   reconnects still work.
2. Core `programs/automation-studio/runtime/service.ts` (forbidden to this lane):
   - add the `removeRecordingEntries` facade exactly as in
     `t182-w3-core-paired-relays.md` "Facade lines";
   - add `if (!this.projectPaths.root) return;` as the first line of
     `writeProjectRecordingSession` (and of any other private writer that
     reaches `recordingPaths`/`projectPaths` file helpers, e.g.
     `writeRecordingTimeline`, `writeProjectRecordingIndexSummary`), then flip
     the last assertion of `service/paths/tests/rootless-storage.test.ts` to
     expect the project recording to succeed in memory.
   - optional: pass `declaredInputDefaults` from the Flow interface when the
     service fills top-level run inputs from defaults.
3. Move `SIMPLE_PANEL_MESSAGES`/`PANEL_REPORT_PROBLEM_MESSAGE` into
   `RUNTIME_MESSAGES` if wanted (I kept `shared/constants.ts` untouched) and make
   t181's `panel/simple/relay/messages.ts` a re-export; add the panel's
   "Report problem" button (panel lane).

## Documentation edits needed (not made; docs/architecture forbidden)

- `docs/architecture/sensitive-values.md` ~332-351: attempt withholding now
  covers `command.target/metadata`, `result.payload/target/metadata`,
  `failure.expected/actual`; run inputs withheld by value (defaults exempt);
  remove the "A copy" gap; state the computed-equals-input trade-off. Add the
  extension-storage attestation scope and its Snappy limit (W2 report).
- `docs/architecture/testing-facility.md` "Scopes" (~1666): `extension-storage`.
- Extension architecture/background doc: worker-start reconnect, watchdog,
  `retryNow`, saved-state repair, `timed_out`, Report Problem bundle, Simple Mode
  relays and recorded-step removal.
- Core `docs/architecture/automation-studio.md` ~680-684 (by-value input
  withholding, declared defaults) and `automation-studio/client-gateway.md`
  ~269-297 (token allowlist, narrowing, projection, `flows.write`,
  `remove-recording-entry`, `durableBehaviorChanged`). Details in W1/W3 reports.

## Open questions

- Removing a click leaves its landing entry (`explainedByEventId`, domain-event
  path) and its evidence snapshots in Core.
- `adaptiveMetrics.durableBehaviorChanged` (looser rule) can disagree with the
  new summary field (W3 open question 5).
- Recorded-step index and last stopped recording id are lost on worker restart.

## Follow-ups (supervisor approval, same day)

1. **`alarms` permission** added to `manifest.chrome.json`, `manifest.e2e.json`
   and `manifest.firefox.json`. `e2e/reconnect.spec.ts` gains "while a paired
   browser cannot reach FluxIQ, the reconnect alarm is set and fires, and the
   browser reconnects once FluxIQ answers": the alarm is present with
   `periodInMinutes: 0.5`, an extension page hears it fire, and a gateway
   started on that port then receives the hello. Clearing on `connected` stays
   covered by the unit test, because the stand-in gateway never sends
   `session_ready`.
2. **Automation Studio `runtime/service.ts`**, in one region only:
   - `readonly recordingEntryRemoval = new AutomationStudioRecordingEntryRemoval({...})`
     after `appendRecordingEvents`, plus one import name. The logic is in
     `service/recordings/entry-removal-command.ts`. It is a collaborator rather
     than a method because the class-methods ratchet (222) refused a 223rd
     method. The handler calls `service.recordingEntryRemoval.remove(...)`.
   - `if (!this.projectPaths.root) return;` is the first line of
     `writeProjectRecordingSession`, `writeProjectRecordingIndexSummary` and
     `writeRecordingTimeline`. A root-less service now keeps a project's
     recordings in memory; the rootless test asserts that and that nothing is
     written to the working directory.
   - The file is at 4554 lines against its 4558 budget.
   - New `service/recordings/tests/entry-removal-command.test.ts`: the removal
     persists across a reload, and an unknown event removes nothing.
3. **Panel**:
   - All ten message names are now in `RUNTIME_MESSAGES` (`panelReportProblem`,
     `panelListAutomations`, ...). `SIMPLE_PANEL_MESSAGES` and
     `PANEL_REPORT_PROBLEM_MESSAGE` in `protocol.ts` now read from it.
   - The Advanced view's Connection tab has "Report a problem"
     (`advanced/connection/problem-report-section.ts`, and
     `problem-report-plan.ts` with its tests). It copies the report and offers
     "Save report" as a dated `.json`.
   - New `e2e/problem-report.spec.ts` drives it in the real side panel and
     checks that the report holds no token and no URL query.
   - **Not done:** turning t181's `panel/simple/relay/messages.ts` into a
     re-export. That file is on `dev` but not on this branch, which predates
     the t181 merge, and workers may not merge. After `dev` is merged in, its
     body becomes
     `export { SIMPLE_PANEL_MESSAGES as SIMPLE_RELAY_MESSAGES } from "../../../shared/protocol";`.
     `dev` did not touch `panel/advanced`, `shared/constants.ts`,
     `shared/protocol.ts` or `background/`, so those edits should merge cleanly.
     The manifests may conflict with t183 on the one added line.
4. **Docs edited**:
   - downstream `sensitive-values.md`: at-rest withholding, the declared-default
     exemption and its trade-off, new "At Rest In The Browser, And What The
     Lab Checks" and "Problem Reports" sections;
   - downstream `testing-facility.md`: the `extension-storage` scope and a
     "LevelDB stores" bullet;
   - downstream `extension-client.md`: "Staying Connected", "Problem Reports",
     "Simple Mode Relays";
   - Core `automation-studio.md`: by-value input withholding, and the
     root-less service being in memory;
   - Core `automation-studio/client-gateway.md`: the allowlist, `flows.write`,
     request narrowing, the snapshot projection, `remove-recording-entry` and
     `durableBehaviorChanged`.

Follow-up validation:
- Extension:
  - tsc on src and tests: exit 0.
  - `test-extension.mjs`: 1068/1068 pass.
  - Smoke test passed.
  - Structure audit passed.
  - Playwright, under lab slot slot-1, which was released afterwards:
    - reconnect + resilience: 5 passed (1.3 m);
    - problem-report + install-and-content: the problem-report test passed on
      its second run, after it was changed to restart the worker once storage
      was seeded; the other 3 passed.
- Core:
  - `tsc --noEmit` for fluxiq and web: exit 0.
  - Structure audit passed.
  - Focused vitest: 16 files, 165 tests passed (recordings, paths, handlers,
    conversions, durable-behavior, bridge, io-bridge, storage, and the
    withholding set).
  - web: 9 files, 81 tests passed (program-route, route, problems).
