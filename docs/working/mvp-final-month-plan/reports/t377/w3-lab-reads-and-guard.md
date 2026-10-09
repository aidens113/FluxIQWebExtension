# t377 W3: Lab chat reads retry; `unchanged` guard ignores pre-provider facility failures

Worker W3, tree `fxwork/t377/!FluxIQWebExtension`, branch `task/t377-workspace-read-scaling`. Nothing committed.

## Outcome

Done. Both parts are implemented and tested. Core was not touched.

## What changed and why

### 1. The chat stage's Core reads retry (`packages/test-runner/src/flow-lane/creation/chat/chat-thread.ts`)

- All three reads in the file (`list-flows` via `projectFlowIds`, `list-conversations` via `chatConversationIds`,
  `get-conversation` via `chatThreadTurns`) now go through one private `retriedRead`. Each read gets a first try
  plus 3 retries (`CHAT_READ_RETRIES`), with pauses of 0.5 s, 1 s and 2 s between them. Each try keeps its own 10 s
  bound, so the worst case is about 43.5 s.
- What gets retried: a bounded timeout (`details.bounded === "timeout"`), a transport failure ("FluxIQ HTTP
  transport failed"), or a Core 5xx (`details.status` 500-599). These are not retried: a 4xx refusal (which
  `contractRefusal` turns into `facility.contract`), a caller's abort (`bounded: "abort"`), or any other error.
- When it gives up, it throws a `RunnerFailure` with the **same category, message and details** as the last failure,
  plus `endpoint` (for example `list-flows`), `attempts` (4) and `elapsedMs`, with the last failure as its cause. The
  message has to stay as it is: `projectFacilityFailure` (`facility-failure/project-facility-failure.ts`) recognises a
  timeout by the exact message "FluxIQ HTTP operation timed out". Because it still does, the run's `evaluation.json`
  `facilityFailure` still names the endpoint (`/api/programs/automation-studio/list-flows`). A test checks this.
- `CreatedFlowChatReadControl` gains an optional `readClock` (`now`, `sleep`) so tests can run the retry pauses on a
  fake clock. It is not exported as a new symbol. Production uses the real clock.

### Audit: other Lab control reads before the chat send (report only, files not owned)

Order inside `lane.ts` from dispatch: `readCreatedFlowCandidateTrialReadiness` (`lane.ts:355`), then
`startChatBuild` (`lane.ts:550`), then `buildCreatedFlowFromChat`.

- `readCreatedFlowCandidateTrialReadiness` (`flow-lane/creation/readiness.ts:75-80`) calls
  `get-flow-bootstrap-generation-readiness` once, with `input.bounds` (30 s default). **This is the same single-try
  pattern on a safe read.** It does not touch the workspace table, so it is unlikely to be slow, but under the
  user's rule it should retry too. To fix: wrap the call in the same retry (or move `retriedRead` into a shared
  module, for example `http-control/`, so both use one helper).
- `entry.authorizeChat()` (`run-scenario/chat-build/chat-entry.ts:58`, then `live-llm-run.ts:234`
  `installLiveLlmSessionKey`) writes a secret key, so it is not a safe read. It is left as is. Its
  `assertCreationProjectReady`/`panel.selectProject` act on the panel, not Core.
- `input.control.selectExistingContext` (`lane.ts:556`, `selectProject` -> `automation-studio-context`) sets
  state. It is idempotent but is a write, so it is not covered by "every safe read".
- Inside `buildCreatedFlowFromChat`, before `chat.type`: `projectFlowIds` and `allPersonTurns` (conversation list
  and turns). Both are covered by the change above. After the send, the same reads in the `until` polls also retry.
  A poll can now take up to about 43 s longer than its deadline when Core is down. I judged that acceptable. Tell me
  if it is not.

### 2. The `unchanged` guard ignores a run that failed on the facility before any provider call

- `scripts/lab/live-guards/run-outcomes.mjs`: a finalized run that did not pass now carries
  `facilityFailureBeforeProvider`. It is set only when all of these hold:
  - `evaluation.json` names a `facilityFailure`.
  - `evaluation.llm.calls === 0` exactly. A missing count does not qualify.
  - The run recorded no cost, or a cost of 0.
  - Its step log under `lab-runs/`, if it has one, holds no provider call (`readStepLogOutcome(...).calls === 0`).
  Only closed codes are kept: `stage`, `reason`, and `endpoint` only when it matches `/api/...`. Killed runs get
  `null`.
- `close-launch.mjs`: writes the field on the ledger `finish` entry when it is set, and leaves it out otherwise, so
  older entries keep their old shape. `ledger.mjs`: typedef and header comment updated.
- `rules/unchanged.mjs`: when it looks for the previous run, it skips entries carrying `facilityFailureBeforeProvider`,
  the same way it already skips killed runs. The run before it is the one compared, so an earlier product failure on
  the same source still refuses, and an earlier pass still clears.
- `rules/guard-state.mjs` needed no change. The rules read the field from the ledger entries already in the state.

**Scope note:** the brief named only `unchanged.mjs` and `guard-state.mjs`. The rules read only the ledger, and
nothing in the ledger said a run never reached the provider. Recording that needed `run-outcomes.mjs`,
`close-launch.mjs` and `ledger.mjs` (typedef) in the same `live-guards/` module. No other worker edits this repository.

## Commands run and observed results

- `npx tsc -p tsconfig.json` in `packages/test-runner`. First attempt: TS2448/TS2349, because the helper named `read`
  collided with a local `read` in `chatThreadTurns`. Renamed it to `retriedRead`, re-ran, and got no output (exit 0).
- `node --test dist/flow-lane/creation/chat/tests/chat-thread.test.js dist/flow-lane/creation/chat/tests/build-from-chat.test.js`:
  `# tests 21 # pass 21 # fail 0`. That is 5 new chat-thread tests plus the existing build-from-chat tests.
- `npx tsc -p tsconfig.json --noEmit` in `packages/test-runner`: `tsc exit 0`.
- `node --test scripts/lab/live-guards/tests/*.test.mjs`: first run 42/43 pass. The failure was a fixture default
  (`calls = 0` replacing an explicit `undefined`), fixed by passing `null`. Re-run: `# tests 43 # pass 43 # fail 0`.
  That is 3 new tests in `tests/facility-failure-run.test.mjs` plus the existing guard tests, the killed-run
  exclusion among them.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (181 warning(s), 257 baselined).`
- Read-only check against the real evidence: `readRunOutcomes` on `fxwork/t342/.../test-runs/instances/t342-slot-2`
  (since 04:01 UTC, real `lab-runs/`) returns `run-mv0fu9uq-107ab0de`, verdict `failed`, cost `null`,
  `facilityFailureBeforeProvider {stage: scenario.execute, reason: http.timeout, endpoint:
  /api/programs/automation-studio/list-flows}`. That bundle would now be classified correctly. Nothing was written.

I did not use the package `build`/`check`/`test` scripts. They run `scripts/check/core-build.mjs`, which may rebuild
the shared t377 Core while W1 and W2 are editing it. I ran `tsc` directly against the Core dist already built.

## Not verified

- No live or provider-free Lab run. The retry has not run against a real slow Core.
- The existing ledger `finish` entry for run 8 in `lab-slots/spend-ledger.jsonl` was written before this field
  existed, so `unchanged` still refuses `t342-slot-2` / `crossborder-marketplace-hub-to-cart` on that old fingerprint.
  Once t377 merges, the source changes and the refusal clears on its own. I did not touch the ledger.
- No full suites (per AGENTS.md).

## Open questions or contradictions found

- To name the endpoint in the human summary line (events.ndjson `summary`, now "FluxIQ HTTP operation timed out"),
  `boundedHttpFailure` in `facility-failure/project-facility-failure.ts` would need to stop matching the exact
  message, for example by keying on `details.bounded`. That file is not mine. The endpoint already reaches
  `evaluation.facilityFailure.endpoint`.
- `docs/architecture/testing-facility.md` line about 3060, the `unchanged` row ("did not pass and the source
  fingerprint is unchanged"), should add: "a killed run, or one that failed on the facility before any provider call,
  is skipped". That is supervisor-owned documentation.
- The readiness read (`readiness.ts:80`) is still single-try (see the audit).

## Follow-up (coordinator, same session)

### What changed

- The retry is now one shared module, `packages/test-runner/src/flow-lane/creation/retried-read.ts`. It exports one
  function, `retriedRead(endpoint, read, clock?)`, and the `creation/index.ts` barrel re-exports it. Its behaviour
  is unchanged: a first try plus 3 retries, pauses of 0.5/1/2 s, and on giving up the same message and details plus
  `endpoint`, `attempts` and `elapsedMs`. `chat/chat-thread.ts` now calls it through a local `chatRead`.
- `readiness.ts` `readCreatedFlowCandidateTrialReadiness` now reads `get-flow-bootstrap-generation-readiness` through
  `retriedRead`, keeping the caller's bounds. Its control type gains an optional `readClock`.
- `tests/readiness.test.ts` has a new test. Three timeouts followed by an answer make 4 tries with pauses
  [500, 1000, 2000]. A read that never answers gives up after 4 tries with the original message, `path`,
  `endpoint` and `attempts`. A 400 refusal is thrown after 1 try.
- A separate `tests/retried-read.test.ts` was written, then removed. It pushed `flow-lane/creation/tests/` to 26
  files, and the structure audit failed with `directory-files: 26 source files exceeds the 25-file limit`. Its cases
  are already covered by the chat-thread and readiness tests. Its stale `dist` outputs were deleted too.
- `docs/architecture/testing-facility.md`, "Live-run waste guards":
  - The `unchanged` row now says a killed run, or one that ended in a facility failure before any provider call, is
    not counted, and that the run before it is compared.
  - A new paragraph after the table explains `facilityFailureBeforeProvider`: the evidence it needs, that it is left
    out when uncertain, and that the debug rule still applies.
  - The ledger paragraph names the new finish field.

### Commands run and observed results

- `npx tsc -p tsconfig.json` (emit) and `--noEmit` in `packages/test-runner`: no output, `tsc=0`.
- `node --test dist/flow-lane/creation/tests/readiness.test.js dist/flow-lane/creation/chat/tests/chat-thread.test.js dist/flow-lane/creation/chat/tests/build-from-chat.test.js`:
  `# tests 29 # pass 29 # fail 0`. With `retried-read.test.js` still included, before it was removed, the run was 32/32.
- `node --test scripts/lab/live-guards/tests/*.test.mjs`: `# tests 43 # pass 43 # fail 0`.
- `node scripts/structure-audit.mjs`: first run 1 violation (the directory-files limit above); after the test file
  was removed, `structure-audit: passed (181 warning(s), 257 baselined).`
