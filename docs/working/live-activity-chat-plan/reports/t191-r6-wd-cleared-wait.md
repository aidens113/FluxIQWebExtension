# t191-r6-wd: a self-clearing robot check, carried to Core as a structured field

Worker report, brief t191-r6-wd. Tree `fxwork/t191/!FluxIQWebExtension`, branch
`task/t191-extension-chat-ui`. Nothing committed.

## Outcome

Partial. The code, tests and docs are done for every hop, and everything passes
against Core's previous dist. The brief's exact validation command did not
complete, and that is the one gap. It failed twice at the same spot: the
extension `test` script's Core-build guard (`scripts/check/core-build.mjs`)
refuses to run because Core's dist is behind its source. Core's source is being
edited by the other worker, and Core is read only for me, so I did not rebuild
it. I then ran the same steps with only that guard skipped (below), so the tests
ran against Core's previous dist, not the Core that will ship.

## What changed and why

The fact "a check stood on the landed page and cleared by itself, untouched,
after N ms" was structured only inside the extension (`LandedCheckWait`) and
left the browser as prose in `validation.actual`. It now travels as a field at
every hop, copied and bounded (whole ms, 0..600,000) rather than passed through.

Hop by hop:

1. **Bound and shape (domain, shared).** New
   `domain/src/actions/cleared-check-wait.ts`: type `WebAutomationClearedCheckWait
   = { waitedMs }`, `WEB_AUTOMATION_CLEARED_CHECK_WAIT_MAX_MS = 600_000`, and
   `webAutomationClearedCheckWaitValue` (:37), which keeps `waitedMs` alone,
   rounds to a whole ms, and drops non-numbers, negatives and anything past 10
   min (dropped, not clamped). Exported through `domain/src/client/index.ts`.
2. **Result type.** `WebAutomationActionResult.checkWait?` at
   `domain/src/actions/types.ts:491`. The extension's `BrowserActionResult` is
   this type (`apps/extension/src/shared/protocol.ts:757`), so it gains the field
   with no redeclaration.
3. **Extension producers (cleared only, success only).**
   - `clearedCheckWait` (`apps/extension/src/runtime/landed-check-wait.ts:121`)
     turns a `LandedCheckWait` into `{ waitedMs }` for outcome `cleared` only.
   - Click: `clickAfterClearedCheck` (`runtime/click-landing.ts:340`) sets
     `checkWait` on the reply (both the answered and the navigated-before-answering
     paths go through it). The prose is kept as it was, and still only when the
     validation passed.
   - Navigate: `navigationResult` success branch (`runtime/action-runner.ts:307-308`)
     sets it beside the existing prose.
4. **Gateway payload.** `webAutomationActionResultPayload`
   (`domain/src/client/gateway-mapping.ts:318`) copies it through the bound.
   `gatewayActionResultFromBrowserResult` (`apps/extension/src/runtime/result-mapping.ts:48-72`)
   spreads that payload, so it needed no edit; the other two builders
   (`background/connection/gateway-payloads.ts:83`,
   `server-command-channel.ts:263`) use the same function.
5. **Domain tool execution (build's evidence loop).**
   `WebLlmEvidenceToolExecution.clearedWait?` (`domain/src/runtime/llm-evidence/capture.ts:174`),
   added to `WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS` (:283), mentioned as
   `undefined` in `toolExecution` (:315, `present` requires every key named).
   New `node-run/cleared-wait.ts` `withClearedWait(payload, execution)` reads
   `payload.checkWait` through the same bound and writes `clearedWait` onto the
   execution, as `withCallStates` writes states. Wired on the successful node run
   in `node-run/run.ts:417` (the `web.action.succeeded` execution).
6. **Flow runs.** A Flow run does not go through the evidence loop. Its web node
   result reaches Core by the dispatch path: `io/gateway-output-dispatcher.ts:32`
   puts the client's gateway payload whole under `payload.result`, and
   `runtime/adapter.ts` passes it on. So in a Flow run Core reads the field as
   **`payload.result.checkWait`** (`{ waitedMs }`) on the dispatch / runtime
   command result. No domain change was needed there; a test pins it.
7. **Docs.** `docs/architecture/extension-client.md` (Robot Checks, new paragraph
   after "Where checks are met") and `docs/architecture/failure-taxonomy.md`.

Tests (beside subjects):

- `apps/extension/src/runtime/tests/landed-check-wait.test.ts`: `clearedCheckWait`
  only for `cleared`.
- `apps/extension/src/runtime/tests/click-landing.test.ts`: cleared check carries
  `checkWait` whose number equals the prose's; frame reply not mutated;
  navigated-before-answering carries it; person-only check carries none.
- `apps/extension/src/runtime/tests/navigate-action.test.ts`: cleared carries it
  (integer, only `waitedMs`, matches prose); not-cleared, person-only, and
  ordinary page carry none.
- `apps/extension/src/runtime/tests/result-mapping.test.ts`: click and navigate
  `checkWait` reach `payload.checkWait`; absent when none; > 10 min dropped.
- `domain/src/actions/tests/cleared-check-wait.test.ts`: bound.
- `domain/src/client/tests/gateway-mapping-check-wait.test.ts`: payload hop.
- `domain/src/runtime/llm-evidence/node-run/tests/cleared-wait.test.ts`: end to end
  through `executeTool`: a press with `checkWait` yields `clearedWait` beside
  `resultCode: "web.action.succeeded"`; no check, no key; a look carries none;
  malformed values add nothing; extra fields do not ride.
- `domain/src/runtime/tests/adapter-check-wait.test.ts`: Flow-run path,
  `payload.result.checkWait` present / absent.

## Commands run and observed results

- `node scripts/structure-audit.mjs`, run before and after the change ->
  `structure-audit: passed (134 warning(s), 119 baselined).` Both runs gave the
  same count, so the change adds no new warning.
- The brief's command, `EXTENSION_TEST_BUILD_LABEL=t191-wd bash .../heavy.sh "t191 wd" bash -c "pnpm --filter @fluxiq-web-extension/extension check && ... test && ... build && pnpm --filter @fluxiq-web-extension/domain test"`:
  - Run 1: `extension check` passed (build-cache `"ms":261848`, "not stamped,
    because inputs changed while it ran (core:packages/fluxiq/src)"). `extension
    test` then failed at the guard: "FluxIQ Core's build at ...\!FluxIQ is 36
    minute(s) behind its source. Stale: ...packagesluxiq\src\programsutomation-studiountime\service.ts",
    `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`, exit 1. The build and the domain test
    did not run.
  - Run 2, the one re-run the brief allows: `extension check` passed again
    (`"ms":93273`), and `extension test` failed at the same guard ("47 minute(s)
    behind"), exit 1.
- The same steps with only the guard skipped, under heavy.sh, with
  `EXTENSION_TEST_BUILD_LABEL=t191-wd DOMAIN_TEST_BUILD_LABEL=t191-wd`:
  - `apps/extension: node scripts/smoke-test.mjs && node scripts/test-extension.mjs`
    -> "Extension smoke test passed.", `# tests 1673 # pass 1673 # fail 0`.
  - `domain: node scripts/test-domain.mjs` -> "Web automation domain smoke test
    passed.", `# tests 1050 # pass 1050 # fail 0`.
  - All the new tests passed, confirmed by name, for example: "a press whose
    page waited out a check that cleared by itself carries clearedWait beside
    its result code", "a press that met no check carries no clearedWait key at
    all", "a Flow run's click that waited out a self-clearing check returns
    checkWait to Core under payload.result", "a robot check that cleared by
    itself reaches the gateway payload as checkWait, and nothing is said when
    none did", and "anything that is not a wait within ten minutes is nothing".
- `pnpm --filter @fluxiq-web-extension/extension build` under heavy.sh -> exit
  0; "chrome: verified 22 files", "firefox: verified 22 files", "e2e-chromium:
  verified 22 files".
- `domain: npx tsc -p tsconfig.json --noEmit` -> exit 0.

## Not verified

- No browser, no Lab (per brief). Live extension behavior on a real
  self-clearing check is not exercised.
- Core's side: Core's reader must accept `clearedWait` in its exact-keys check
  before this ships, or Core refuses the whole tool execution
  (`llm_evidence_loop.tool_result_invalid`). The key is listed here per the
  brief's pin; I did not see the Core change (no `clearedWait` in the sibling
  Core tree when I looked).

## Open questions or contradictions found

- `capture.ts` says to widen `WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS` only
  after Core's list has learned the key. The brief pinned it now; merge order
  must put Core's reader first (or together).
- Success only: a navigation whose check cleared and that then failed for
  another reason (wrong URL, no movement), or a click whose cleared landing was
  then refused (403/404), carries no `checkWait`, and the domain sets
  `clearedWait` only on a successful node run. If the chat card must close as
  cleared in those cases too, the extension's failure branches and the
  domain's refusal path need it as well.

## Run path lift (t191-r6-wd2)

Outcome: Done. Nothing staged or committed. Core untouched (its dist already
declares `clearedWait?: { waitedMs }` on `OutputDispatchResult`, `dist/io/index.d.ts:43`,
and `FluxIQRuntimeCommandResult`, `dist/runtime/contracts.d.ts:61`).

Item 6 above said a Flow run needed no domain change because Core could read
`payload.result.checkWait`. Core instead reads only the result's own
`clearedWait` field, so the domain now lifts it at both hops:

- `domain/src/io/gateway-output-dispatcher.ts`: `dispatchWebAutomationOutput`
  reads the client's action result payload's `checkWait` through the existing
  `webAutomationClearedCheckWaitValue` (`actions/cleared-check-wait.ts`; no
  second parser) and sets `clearedWait` on the `OutputDispatchResult`, absent
  otherwise. Small local `isRecord` guard for the payload.
- `domain/src/runtime/adapter.ts`: `executeWebAutomationRuntimeCommand` copies
  `result.clearedWait` (as a fresh `{ waitedMs }`) onto the
  `FluxIQRuntimeCommandResult`. The payload is unchanged, so
  `payload.result.checkWait` still rides as before.

Bound: the domain helper keeps 0..600,000 ms (ten minutes), stricter than
Core's accepted 0..86,400,000, so every value sent is one Core accepts.

Tests:
- New `domain/src/io/tests/gateway-output-dispatcher-check-wait.test.ts`:
  present and rounded (8,412.4 -> 8,412); only `waitedMs` rides (0 kept);
  absent with no `checkWait` and with no payload; absent for -1, "8412", NaN,
  600,001, null, a string, an array, `{}`.
- `domain/src/runtime/tests/adapter-check-wait.test.ts`: three tests added,
  runtime result carries `clearedWait`, carries no key with no check, carries
  no key for malformed values.

Commands:
- `EXTENSION_TEST_BUILD_LABEL=t191-wd2 DOMAIN_TEST_BUILD_LABEL=t191-wd2 bash .../build-slots/heavy.sh "t191 wd2" bash -c "pnpm --filter @fluxiq-web-extension/domain check && pnpm --filter @fluxiq-web-extension/domain test"`
  -> exit 0. `domain:check` built (`"ms":40755`); core-build guard: "FluxIQ
  Core's build ... is current with its source."; `# tests 1057 # pass 1057 # fail 0`.
  All seven new tests listed by name as `ok`.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (134 warning(s), 119 baselined).`
  (same count as before this round).

Not verified: Core actually emitting the "cleared on its own" activity from a
domain-produced result end to end (no Core test run here, no browser, no Lab).
The extension package was not rebuilt or re-tested in this round (no extension
file changed).
