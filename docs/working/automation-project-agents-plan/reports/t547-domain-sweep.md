# t547-domain-sweep: fix forward the 17 domain sweep failures

## Outcome

Done. All 17 failures had the cause the brief names: Core t519's gates. Only test files changed. No product gate was relaxed.

## What changed and why

- `domain/src/io/tests/required-context.ts`: this is the shared fixture behind the one failing test in `gateway-output-dispatcher.test.ts` and the one in `runtime/tests/adapter.test.ts`. Only those two files use it. The fixture ran an inline Flow `flow.synthetic.web` that was never stored and had no instructions, so the run was refused with "Unknown Automation Studio Flow". The fix stores the Flow with `program.createFlow(...)` and saves an active instruction with `program.saveFlowGenerationInstruction(...)`, which is how t543 did it. The run still passes the same inline flow.
- `domain/src/io/tests/gateway-output-dispatcher-durable-reconcile.test.ts` (4 tests): the same fix in `lostFirstAnswerRun`.
- `domain/src/tests/web-panel-host.test.ts` (10 tests): added `description: "Shows the steps the automation repeats."` to the one `service.createRecording` call.
- `domain/src/tests/core-gateway-recording-order.test.ts` (1 test): added the same description to `bridge.startRecording`.
- The instruction text ("Press the two buttons in order.") is generic and not shaped like any scenario.

## Commands run and observed results

All run in the worktree `C:/Users/osrs_/FluxStuff/fxwork/t547/!FluxIQWebExtension`.

- Before the fix, from `domain`: `DOMAIN_TEST_BUILD_LABEL=t547-domain-sweep node scripts/test-domain.mjs io/tests/gateway-output-dispatcher runtime/tests/adapter tests/core-gateway-recording-order tests/web-panel-host` -> "# tests 100, # pass 83, # fail 17". The failures were exactly the brief's 4 + 1 + 1 + 1 + 10: "Unknown Automation Studio Flow: flow.synthetic.web" and "Describe what this recording demonstrates before starting it."
- After the fix, the same command -> exit 0, "# tests 100, # pass 100, # fail 0".
- `pnpm --filter @fluxiq-web-extension/domain check` -> exit 0. It reported "core-build: FluxIQ Core's build ... is current".
- `pnpm structure:check` -> "structure-audit: passed (194 warning(s), 644 baselined)."
- `git diff --check` -> exit 0.

## Not verified

- No full domain suite or `pnpm -r test` (per the twice-a-day rule).
- I did not search the rest of the domain tests for the same t519 staleness. The sweep stopped at the domain package, so packages after it in `pnpm -r test` have not run against Core t519.

## Open questions or contradictions found

- None.
