# Workstream D: background, shared protocol, and the Core seam

Status: done (2026-09-28). A machine crash cut the session off partway
through. Afterwards every file was checked: all were present and complete, and
every check below was re-run.

## Outcome

Done. All six "Background changes the simple view needs" (audit §4) are in
place, built to the §5 pinned contracts. Core now accepts the pairing token on
an allowlist of seven program endpoints. `cancel-runtime-session` is
registered, so Stop no longer returns a 404. Nothing was tested live (see Not
verified).

## What changed and why

### Core (`F:\!FluxIQ`, uncommitted on `dev`)

- `packages/fluxiq/src/programs/automation-studio/api/handlers/runtime-execution.ts`:
  registers `cancel-runtime-session` beside `start-runtime-session`
  (`runtime.control`, `authoring`, so no PIN is asked). The payload is
  `{ projectId, runId, reason? }` and the answer is `{ runtimeSession }`: null
  for an unknown run, and the run as it ended if it is already over. Before this,
  nothing registered the endpoint, so every Stop, including the web panel's
  (`run-commands.ts:21`), got `endpoint.not_found`.
- `.../api/handlers/tests/cancel-runtime-session.test.ts` (new, 6 tests): the
  endpoint is registered as authoring/runtime.control, no longer answers
  not-found, validates its ids, requires runtime.control, and stops a real
  queued run end to end, twice.
- `apps/web/src/lib/program-route.ts`: `PAIRED_CLIENT_ENDPOINTS` (frozen):
  `list-conversations`, `open-conversation`, `get-conversation`, `append-turn`,
  `answer-ask`, `list-runtime-sessions`, `cancel-runtime-session`. New helpers:
  `isPairedClientEndpoint`, `isPairedClientClassification` (read or authoring
  only), `readBearerToken`, `pairedClientActor` and `pairedClientDomainScope`.
- `apps/web/src/app/api/programs/[programId]/[endpoint]/route.ts`: a valid
  cookie works exactly as before and always wins. With no valid cookie, a
  bearer token goes through these checks in order:
  1. The endpoint name must be on the allowlist, checked before the token is
     looked up (403 otherwise).
  2. The registry must classify it as `read` or `authoring` (403 otherwise).
  3. `clientGateway.authorizeToken` (401 on failure).
  4. The actor is the person who approved the pairing, with role permissions
     narrowed to programs.read, programs.write and runtime.control. The call
     is refused with 401 if that person is disabled or gone.
  5. The domain is the one the session declared, and a URL naming another
     domain gets 403.

  No `authSessionId` is injected, and one the caller supplies is removed, so a
  handler's PIN check fails closed. The token is never logged or echoed; the
  actor session id is `client-gateway:<gatewaySessionId>`.
- Both route tests extended (32 tests). They prove every other Automation
  Studio endpoint (over 100, by GET and POST) and other programs' endpoints
  refuse the token with 403. They also cover the destructive-classification
  guard, permission narrowing, domain mismatch, disabled approver, and that the
  token is never echoed.
- `docs/architecture/automation-studio/client-gateway.md`: the bearer rules.

Delete and money movement: no endpoint on the allowlist is `destructive`. A
one-off probe of the real registry confirmed all seven are read or authoring.
The route refuses anything else, so the token cannot skip the PIN. Answering an
ask is `authoring`, and the act it answers is still gated where it happens.

### Extension

- `shared/constants.ts`: the six `panel*` messages exactly as pinned, plus
  `STORAGE_KEYS.disconnectedByPerson`.
- `shared/protocol.ts`: `ExtensionStatus.paired: boolean` and
  `RuntimeCommandStatus.targetName?: string`, as pinned. Also new request and
  reply types: `PanelConversationReadRequest`, `PanelConversationSendRequest`,
  `PanelConversationAnswerRequest`, `PanelStopRunRequest`,
  `PanelSaveSettingsRequest`, `PanelRelayResponse` and `PanelRelayFailureCode`.
- `background/connection.ts`: `paired` in status. New public
  `coreApiCredentials()`, `isPaired()`, `projectId()` and `currentSettings()`.
  The token never enters the status (tested).
- `background/connection/gateway-session.ts`: clears `lastError` on every
  transition to `connected`.
- `background/connection/server-command-channel.ts`: clears `lastError` on
  `session_ready`.
- `background/connection/runtime-status.ts`: `runtimeTargetName`. It uses the
  accessible name, then the label, then the visible text. For
  input/textarea/select it uses only the accessible name or label, because
  their text can be what was typed. It never uses a selector, XPath, attribute
  or value, rejects locator-shaped strings, collapses whitespace and caps the
  name at 80 characters. It is set on start from the command's element and on
  finish from the resolved element.
- `background/connection/core-api.ts`: `callCoreProgram`, which POSTs to
  `/api/programs/automation-studio/<endpoint>` with the bearer token and
  `credentials: "omit"`, with a 120 s timeout. It returns Core's payload
  unchanged, or `not_paired` / `unreachable` / `refused` (401 or 403) /
  `failed`.
- `background/connection/index.ts`: one barrel line exporting
  `callCoreProgram`. This file is not on D's list; see open questions.
- `background/panel/**` (new):
  - `panel-control.ts`: gates all six messages on `isControlPage`, so a page
    or another extension is refused before anything is touched.
  - `conversation-relay.ts`: Read covers list and get. Send covers open,
    append, and a first message (open then append, with the reply adding the
    opened `conversation`). It sends `capabilities: []` when none are given, so
    Core answers. Answer maps to answer-ask.
  - `run-control.ts`: stops a named run. With no run named, it lists the
    project's runs and stops every one that has not ended.
  - `settings-save.ts`: stores only known, well-typed settings fields and
    never connects.
  - `open-fluxiq.ts`: opens only http(s) addresses.
  - `toolbar-badge.ts` and `toolbar-indicator.ts`: "REC" while recording, and
    "..." while a step runs plus 10 s after it (so the badge does not blink
    between steps). Written through `chrome.action` in both browsers, and only
    when the text changes.
  - `auto-connect.ts` and `session-disconnect-memory.ts`: connect on
    `onStartup` and on a control page's `getStatus` when paired, auto-reconnect
    is on, the state is disconnected or error, and the person has not pressed
    Disconnect. That Disconnect is remembered in `chrome.storage.session`, so
    it survives the MV3 worker being stopped when idle.
  - `relay-context.ts`, `relay-failure.ts`, `panel-control-deps.ts` and
    `index.ts`.
- `background/index.ts`: wires the panel control and the toolbar, and the
  auto-connect on start, panel open, Connect, Disconnect and Reset.
- Tests: `panel/tests/{panel-control,conversation-relay,run-control,toolbar-indicator,auto-connect}.test.ts`,
  `connection/tests/{core-api,gateway-session}.test.ts`,
  `background/tests/connection-status.test.ts`, and additions to
  `runtime-status.test.ts` and `server-command-channel.test.ts`.

### Reply shapes for B and C

- A relay's success reply is `{ ok: true, payload: <Core payload> }`, so
  `panelRequest` gives `value.payload`.
- A failure is `{ ok: false, error, code, httpStatus? }`, and `error` passes
  through A's `errorSentence`.
- Save settings returns `{ ok: true, status }`. Open FluxIQ returns
  `{ ok: true, url }`.
- Stop with a `runId` returns `{ runtimeSession }`; without one it returns
  `{ runtimeSessions: [...] }`.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/extension test` (label ws-d):
  "Extension smoke test passed."
  - Earlier runs: 918/918 pass.
  - After the crash, `node scripts/test-extension.mjs`: `# tests 939 # pass 939 # fail 0`.
  - One intermediate run failed 9 tests in `content/` suites (shadow roots,
    record scan) while other workers were editing them. They passed on the
    next run. None are in my files.
- `npx tsc -p tsconfig.json --noEmit` (extension): no errors on the final run.
  An earlier run showed errors only in `src/panel/simple/*` (Workstream B,
  mid-edit).
- `pnpm --filter @fluxiq-web-extension/extension check`: exit 1. The only
  errors are in `e2e/content/tests/extraction/tests/{job-board-listing,pagination-stop}.spec.ts`
  (`validation.actual`) and `src/content/actions/tests/extract-list-paging-account.test.ts`.
  None are mine; they belong to the content/cart worker.
- `node scripts/structure-audit.mjs` (extension): 1 violation, the
  `[working-docs] docs/working/README.md is out of date`. That rule indexes
  only top-level working docs, not reports, so it is not mine. My own
  failure-as-empty and swallowed-failure hits were fixed (named TypeError
  catch, and best-effort comments).
- Core `npx vitest run src/programs/automation-studio/api src/programs/tests`:
  31 files, 131 tests passed. That includes cancel-runtime-session (6),
  domain-scope and endpoint-classification.
- Core web `npx vitest run src/app/api src/lib`: 10 files, 108 tests passed.
  That includes the route (19) and program-route (13) tests.
- `pnpm --filter fluxiq check`: fails, only in
  `runtime/recovery/refuted-result/**` and
  `runtime/tests/refuted-result/tests/repair-context.test.ts`, which another
  worker is editing. There are no errors in my files. `apps/web` `tsc --noEmit`
  showed no errors on the last run.
- `node scripts/structure-audit.mjs` (Core):
  - It passed once, with an advisory warning:
    `program-route.ts: 9 exported values` against an advisory 8 (the hard
    limit is 15).
  - The last run shows 1 violation,
    `[file-lines] runtime/result-verification/tests/run-outcome.test.ts: 813 lines`.
    That file belongs to another worker.
- A one-off registry probe, since deleted, printed programs.read/read or
  programs.write/authoring for all seven allowlisted endpoints, and
  `runtime.control authoring` for cancel.

## Not verified

- No live browser test. Not exercised: the badge in Chrome or Firefox,
  auto-connect on a real browser start or panel open, `chrome.storage.session`
  on Firefox, the relays against a running Core, and a real Stop.
- Core dist was not rebuilt, as instructed. Until it is rebuilt and the web app
  restarted:
  - The running Core has no `cancel-runtime-session`, so a token Stop gets 403,
    because the registry gives no classification.
  - Old route code accepts no token at all, so the relays answer
    `refused`.
- `pnpm build` was not run for the extension.

## Open questions or contradictions found

1. There is no `start-conversation` endpoint. `open-conversation` is the one
   that starts a thread, and it is on the allowlist.
2. `background/connection/index.ts` is not on D's list. I added one barrel
   line (`callCoreProgram`), because the audit's imports rule ratchets
   past-barrel imports.
3. A's `panelRequest` drops the relay's `code`. So B cannot tell `refused`
   (an older Core, or a token Core will not accept) from other failures, and
   `unsupported` fires only for "Unknown FluxIQ extension message.". If B's
   "Open FluxIQ" fallback should also cover `refused`, A's wrapper must pass
   `code` through, or B must match on `detail`.
4. Stop with no `runId` stops every run in the project that has not ended,
   including one started from the web panel. This is deliberate, because a
   gateway command carries no run id (audit open question 2).
5. `paired` means a token is stored. A revoked token still reads as paired
   until the gateway clears it on the next connect.
6. `docs/architecture/extension-client.md` (A's file) should document the six
   new messages and the badge.
