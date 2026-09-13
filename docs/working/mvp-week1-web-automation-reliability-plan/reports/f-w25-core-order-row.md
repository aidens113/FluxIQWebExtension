# f-w25-core-order-row — the live W25 messages through Core's gateway (domain)

## Outcome

**Done.** The row is written, and it fails as the brief requires against Core as built now: 5 of 5 runs, each with 2 web candidates instead of 3.

- **File:** `domain/src/tests/core-gateway-recording-order.test.ts`, 160 lines.
- **What it tests:** the eight messages of a live `delayed-ui` recording, received the way Core's WebSocket host receives them. That means every receive is started without waiting for the one before it. The messages go through Core's real `ClientGatewayService` and `AutomationStudioClientGatewayBridge`.
- **Time per run:** about 0.56 to 0.86 seconds inside the test, and 1.1 to 1.5 seconds for the whole process.
- **Data left behind:** none. The row creates one temporary data folder and removes it; 0 were left before and after the runs. No `.fluxiq` folder appeared in `domain/`.
- **Not skipped or marked expected-to-fail.** Until Core's bridge fix is built, domain `test`, and so root `pnpm test`, will fail on this row.

## What changed and why

Only one file was added. Nothing else in this repository or in Core was edited, and Core was not built.

**Where it lives.** The report suggested a sibling of `web-panel-host.test.ts` if the row would push that file past the advisory size. With its gateway harness the row is 160 lines, so it has its own file. It is named for what it guards: a recording stored in the order Core's gateway receives it.

**The test.** Its title is the report's: "W25: the live delayed-ui messages through Core's client gateway, received as its WebSocket host receives them, propose click, wait, click". It runs in five steps:
1. Build the web IO registry, native runtime (with mappers `web` and `none`) and recording domain, as `recordThroughCore` in `web-panel-host.test.ts` does. The service stores into a `mkdtemp` folder.
2. Create Core's gateway and the bridge, with `stopDrainMs: 0` as the probe used. Connect a session, send `client.hello`, approve the pairing, and start the recording through `bridge.startRecording`.
3. Start all 8 receives at once, wait for all of them to settle, then stop the recording.
4. Read the stored timeline and ask Core for proposals.
5. Close the service and remove the data folder.

**The assertions, in order:**
1. 8 timeline entries;
2. the proposal issues are exactly `["Compacted 3 high-frequency state entries before mapper proposal generation. Raw recording data was preserved."]`;
3. Core's fallback (the `none` mapper) proposes a click on `begin-delay`, then a click on `late-action`;
4. the `web` mapper proposes a click on `begin-delay`, a `web.dom.wait_for_selector` for `late-action`, and a click on `late-action`.

The last one is the guard, so today's failure lands there, after the other three pass. Its failure message prints the stored order, so a failure shows which entry came first.

**How the messages are built.** Each uses the domain's own `createWebAutomationRecordingEvent`, `createWebAutomationStateUpdate` and `createWebAutomationStateFromSnapshot`, and the gateway envelope uses Core's `CLIENT_GATEWAY_PROTOCOL_VERSION`. The domain may not import `apps/extension`, so the extension's additions are copied by hand. Each builder cites the lines it copies, and I read every cited range:
- **A recorded click** (`gateway-payloads.ts:23-36,58-83`). Its metadata carries the input id, taken from the domain's `webAutomationInputIdForRecordedEvent`, and the visual target, taken from `webAutomationActionVisualTargetFromElement`. The captured page travels with it (`recorded-event-intake.ts:172-174`).
- **A click's page state** as `client.snapshot` (`recording-evidence.ts:136-153`). The snapshot id follows `recorded-event.ts:32-35`.
- **Evidence with no DOM snapshot** as `client.state_update` on the evidence input (`recording-evidence.ts:156-169`). Its `latestEvidence` is shaped as `gateway-payloads.ts:38-56` shapes it.
- **Send order** (`active-recording.ts:294-303` and `recorded-event-intake.ts:172-175`):
  1. the browser-state update;
  2. the start's tab evidence;
  3. the initial snapshot;
  4. click 1;
  5. click 1's page state;
  6. the page change;
  7. the late click;
  8. the late click's page state.

Element, page and timing values are the probe's synthetic values: page `http://127.0.0.1:4100/scenarios/delayed-ui/`, tab 7, frame 0, and the page change and late click both 385 ms after click 1.

## Commands run and observed results

1. **`pnpm check` in `domain/`**, run twice, once before and once after a comment-only edit. Both printed `check exit=0`, in 4614 ms and 4648 ms.
2. **The real domain test script under a private build label:** `DOMAIN_TEST_BUILD_LABEL=f-w25-core-order-row node scripts/test-domain.mjs`, from `domain/`.
   - It printed `suite exit=1 ms=4892`, with `# tests 381`, `# pass 380`, `# fail 1`.
   - The one failure is this row, at its web-candidates assertion (`not ok 362`, `duration_ms: 701.982`).
   - Expected: click `begin-delay`, wait `late-action`, click `late-action`. Actual: click `begin-delay`, click `late-action`.
   - Stored order: `web.dom.click [data-testid="begin-delay"], client.state_snapshot, client.state_snapshot, web.dom.click [data-testid="late-action"], input.state, browser.tab, client.state_snapshot, dom.mutation`.
   - Every other domain test file loaded and passed, and the process exited on its own.
3. **Five runs of the row's bundle alone**, one after another, using the scratch script `fw25-five-runs.mjs` (paths below). Before: `web-gateway-order dirs before=0`.

   | Run | Exit | Whole process (ms) | Inside the test (ms) | Tests / pass / fail | Web candidates |
   | --- | --- | --- | --- | --- | --- |
   | 1 | 1 | 1122 | 556 | 1 / 0 / 1 | 2 |
   | 2 | 1 | 1475 | 863 | 1 / 0 / 1 | 2 |
   | 3 | 1 | 1253 | 558 | 1 / 0 / 1 | 2 |
   | 4 | 1 | 1195 | 624 | 1 / 0 / 1 | 2 |
   | 5 | 1 | 1121 | 584 | 1 / 0 / 1 | 2 |

   All five stored the same order as step 2, which is also the order of the probe's back-to-back runs (`iw25-concurrent.log`). After: `web-gateway-order dirs after=0`.
4. **Hygiene:**
   - `git status --short -- domain` printed only `?? domain/src/tests/core-gateway-recording-order.test.ts`.
   - `git status --short -- domain/.test-build` printed 0 lines, so the tracked build was not regenerated.
   - `Test-Path domain\.fluxiq` printed `False`.
   - The label folder `domain/.test-build-scratch/f-w25-core-order-row` was removed; `Test-Path` afterwards printed `False`.
5. **`node scripts/structure-audit.mjs`** from the repository root printed `audit exit=0` and `structure-audit: passed (39 warning(s), 17 baselined)`. No warning names the new file.

**Faulty RAM.** The five failures are identical, but this is the designed failure, not a crash. It is a real assertion diff with a coherent stored order, and it matches the probe's back-to-back result (5 of 5). The two type checks, the suite run and the audit each ran once, one at a time.

## Not verified

- **That the row passes once Core is fixed.** Core's `dist` has not been rebuilt with `g-core-bridge-order`, so no passing run exists. The expectation rests on the probe's prototype of fixes (a) and (b) together, which gave 3 web candidates and "Compacted 3" in 5 of 5 back-to-back runs (`i-w25-live-wait` Task 3).
- **The mutation proof** (remove the chain in Core's bridge, rebuild Core, rerun). It needs a fixed, built Core.
- **Stop waiting for the chain.** The row waits for every receive to settle before Stop, with `stopDrainMs: 0`, so it does not exercise design item 1(a)'s Stop wait. That is `g-core-bridge-order`'s third Core row.
- **The extension's real message shapes.** The row copies them by hand, so a future change to `recording-evidence.ts` or `gateway-payloads.ts` would not fail it.
- **The approved pairing.** The row asserts that the hello opened a pairing, but not what `approvePairing` returned. The recording start succeeding in every run shows the pairing worked.
- **Root gates.** Root `pnpm check`, `pnpm test` and `pnpm build` were not run; only the domain gates above.

## Open questions or contradictions found

1. **Root `pnpm test` stays red until Core's fix is built.** As the brief requires, this row is neither skipped nor marked expected-to-fail. The supervisor's integration step ("root `pnpm test` ... one at a time") will fail on it until the Core build lands, so commit it together with, or after, that build.
2. **The issues assertion is exact.** It requires the one "Compacted 3" message, which is what every live run and every probe mode showed, with or without the fix. If Core's fix, or later Core work, adds a second issue, the row fails there before reaching the candidates. A looser check, that the list contains the message, is an option if the supervisor prefers.
3. **The synthetic late click has the page change's timestamp.** Both use `eventTimestampMs` 385 ms after click 1, copied from the probe, which produced 3 candidates when sent in order. In the live runs the click followed the change. The wait rule gave 3 candidates in order with these values, so it does not depend on them being distinct; the in-order case was not rerun here.
4. **`i-w25-live-wait` open question 4 still stands:** whether an extension-side row should pin what `recording-evidence.ts` sends, since this domain row copies it by hand.

Scratch files, all under `C:\Users\mrjoh\AppData\Local\Temp\claude\f---FluxIQWebExtension\4f264c80-323b-4673-a09a-bde5851669f3\scratchpad\`:
- `fw25-five-runs.mjs`, the runner for the five runs;
- `fw25-runs.log`, the output of those five runs;
- `fw25-suite.log`, the output of the labelled suite run.
