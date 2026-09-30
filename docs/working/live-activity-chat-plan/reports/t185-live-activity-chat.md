# t185 live activity overlay and extension chat — lane report

## Step 1: merge `dev` into `task/t185-live-activity-chat` (downstream)

- Conflict: `apps/extension/src/background/connection.ts`, imports only. HEAD added
  `ActivityRelay, overlayPreferenceStorage` from `./activity/index`; dev (t182) added
  `RecordedStepIndex` from `./recorded-steps` and `removeQueuedRecordingEvent` from `./storage`.
- Resolution: the union of both import sets. `git diff dev -- connection.ts` afterwards shows only
  t185's additions (ActivityRelay field, construction, `noteSessionReady`, `noteContentReady`,
  `activityState`, `setActivityOverlay`); dev's recorded-step removal is intact. The reconnect
  watchdog lives in `background/index.ts` and `background/reconnect-watchdog.ts`, merged cleanly.
- Staged with `git add apps/extension/src/background/connection.ts`; no unmerged paths remain.
- Validation, under build slot b1 (claimed 2026-09-29T18:20-07:00, released after):
  `pnpm --filter @fluxiq-web-extension/extension check` -> `EXIT=0` (both tsc projects plus
  in-memory bundle of every entry).

## Step 2: the remaining phases (2026-09-29, after the merges `860beb32`, `5ce53b42`, Core `12f76ec`)

State found: P2 C1, C2, E1 and E2 landed before the restart (their reports), and P3 is in place:
`programs/_shared/runtime.ts:84` subscribes `automationStudioActivityHub` to
`clientGateway.publishActivity`. Core `runtime/service.ts` is 4,549 lines after the t176 merge, against a
4,558 budget; the C2 wrappers survived the merge (`service.ts:94`, `:1490`, `:1591`, `:2637`).

Dispatched in parallel, foreground, disjoint files: E3 `ext-chat-panel`, E4 `lab-live-panel`, C3
`core-activity-endpoint`. Their reports are beside this one.

Lead decisions and edits after reading the reports:

- **`get-activity` is not a paired-client endpoint.** C3 added it to `PAIRED_CLIENT_ENDPOINTS`. The extension has
  no HTTP consumer: it is pushed `server.activity`, which Core filters by the session's project. An HTTP read by
  token would let a paired client name any project id. I reverted `apps/web/src/lib/program-route.ts` and its test,
  so the endpoint is the Core panel's (`programs.read`) only; the handler comment says so. This departs from the
  plan's C3 brief and is recorded as D8.
- **Core chat styles**: C3 could not edit the stylesheet. I appended the activity header and row rules to
  `apps/web/src/features/automation-studio/styles/conversation/01-thread.css` (no new stylesheet, since the
  architecture test pins two).
- **Turn timing**: E3 timed turns by first sight because `core-thread.ts` dropped Core's `createdAt`. Core stamps
  turns and activity on the same clock, so `CoreTurn` now keeps an optional `createdAt`
  (`panel/simple/conversation/core-thread.ts`), `chat/stream/turn-clock.ts` prefers it, with new tests in
  `conversation/tests/core-thread.test.ts` and `chat/stream/tests/turn-clock.test.ts`.
- **`--no-live-panel` pass-through**: `packages/test-runner/src/cli.ts` now passes `livePanel: false` to the
  interactive, run and matrix calls. The bench still opens the panel by default; t187 owns the bench files.
- **Docs**: `docs/architecture/extension-client.md` (overlay, panel chat, `isExtensionUiNode`),
  `docs/architecture/testing-facility.md` ("The live panel beside the page").
- The `runner-wiring.test.ts` "redaction attestation" failure E4 saw is not t185's: HEAD's `run-scenario.ts:609`
  passes `workspaceWrittenSince: writtenSince, extensionStorage`, which the test's literal does not match; this is on HEAD before any t185 edit to that file (not traced to a
  task).

### Step 2 validation, all run by the lead

Heavy commands ran through `build-slots/heavy.sh`.

- Core:
  - `pnpm --filter fluxiq check` -> EXIT=0.
  - `pnpm --filter @fluxiq/web check` -> EXIT=0.
  - `node scripts/structure-audit.mjs` -> "passed (197 warning(s), 355 baselined)".
  - `pnpm --filter fluxiq build` -> EXIT=0.
  - vitest on `api/handlers/tests/activity.test.ts`, `runtime/activity` and `src/client-gateway` -> 6 files, 49 tests passed.
  - Web vitest on `features/automation-studio/conversation` and `lib/tests/program-route.test.ts` -> 17 files, 219 tests passed. This was after I fixed one C3 fixture, whose label already said "of 5".
- Downstream:
  - `pnpm check` -> CHECK_EXIT=0. It includes structure "passed (121 warning(s), 120 baselined)" and each `-r check`.
  - Extension `test` -> 1213/1213.
  - Extension `build` -> EXIT=0.
  - `DOMAIN_TEST_BUILD_LABEL=t185-lead` domain `test` -> 885/885.
  - test-runner `build` and `check` -> EXIT=0.
  - The live-panel and commands tests -> 45/45.
- Pre-existing, not fixed here: `runner-wiring.test.ts` "redaction attestation". On `dev` itself,
  `run-scenario.ts` does not contain the literal the test asserts; `grep -c` gives 0 in `run-scenario.ts` and 1
  in the test. t185 does not change the test (the diff against dev is 0 lines).
- Browser: none.
  - Attempt 1 in slot-2 was refused before launch, because Core's dist was older than its source.
  - After the rebuild, free RAM was 3.75 GB, under the 4 GB floor, so I skipped the run.
  - The Playwright content specs E2 ran before the restart used the content harness, not a realistic scenario.
  - What the live lane's next run must confirm is in the plan's Current State, "Next".
