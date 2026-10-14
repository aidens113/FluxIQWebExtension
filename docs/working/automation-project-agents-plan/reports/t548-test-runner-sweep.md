# t548-test-runner-sweep: report

Brief: `### Brief: test-runner-sweep-failures` (automation-project-agents-plan.md).
Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t548/!FluxIQWebExtension`, branch `task/t548-test-runner-sweep-failures`. Not committed.

## Outcome

Done. I reproduced all 14 sweep failures in the worktree, found the cause of each and fixed each one in its test. No
product file was changed and no product check was relaxed. None of the failures was a product defect. 13 were
stale tests, all broken by one commit. 1 was a timing race inside a browser test.

| Failure(s) | Cause | Breaking commit | Kind |
| --- | --- | --- | --- |
| `runner-wiring.test.ts` x5 (1320, 1321, 1322, 1325, 1326) | t519 removed the recording-built Flow lane (`runFlowLane` call, `flowDispatchStarting`), refuses bare `options.flow` as `recording.contract` before `resolveWorkflow`, and requires a fixture `recordingDescription` on the recording lane | `4ee4e65c` (t519, 2026-10-13 14:54) | stale test |
| `single-run-evaluation.test.ts` x1 (1342) | anchor `flowLaneSnapshot(evidence)` write removed with that lane; the created lane's `createdFlowLaneSnapshot(` write remains | `4ee4e65c` | stale test |
| `build-identity/tests/identity.test.ts`, `core-identity/tests/identity.test.ts` x1 each (1485, 1498) | literal `type: "fluxiq.startRecording"` no longer in `run-scenario.ts`; dispatches now send `startRecording!` (built by `recordingStartMessage`) | `4ee4e65c` | stale test |
| `tests/cli-llm.test.ts` x5 (1821, 1822, 1823, 1828, 1830) | every case used bare `--flow`, which `parseLabCommand` now refuses (`refuseRecordingOnlyFlow`) before any later refusal is reached | `4ee4e65c` | stale test |
| `crossborder-marketplace/tests/browser-paths.test.ts` x1 ("flash-deal-on-arrival") | the test clicked the promotion's close after its own assertions, racing the site's 2 s welcome-modal timer; on a loaded machine the welcome's scrim lands on top and takes the click (`locator.click: Timeout 12000ms`) | racy since it was added in `dc54e2db` (2026-10-09); no regression | timing dependence (environment) |

No environment leak was found in `cli-llm.test.ts`. Its credential refusals read only the env object the test
passes in, with `FLUXIQ_TEST_ENV_FILES=none` and a temp root. This machine's shell also has no `DEEPSEEK_API_KEY` set.

## What changed and why

- `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`
  - 1320: dropped the `await runFlowLane({` anchor. In its place the test now asserts that this call is absent, so "a recording that reached Core short never becomes a Flow" is still pinned. The `discardWindowFrom` regex now matches `runtimeMessage(extensionControl, startRecording!)`.
  - 1321: dropped the Flow-lane ordering anchor. The old `flowDispatchStarting` assertion is replaced by one that this hook is absent, because no Flow dispatches on the recording lane. The browser-close, second-read and topology-close ordering is unchanged.
  - 1322: the Flow-lane anchor is now `runCreatedFlowLane({`, the only remaining lane. The probe's `recording` anchor now uses `startRecording!`. I also updated a stale comment.
  - 1325: retitled. It now pins that a recording-built Flow-lane run is refused as `recording.contract` with `details.code = automation.instruction_led_authoring_required`, that this happens before `resolveWorkflow`, and that no bundle, Core, browser or run directory is created. The static `flowLaneExclusion` assertions are kept, and the doc comment explains the change.
  - 1326: added `recordingDescription` to the test's own `NO_ACTION_SCENARIO`. Without it, the recording lane now refuses the run as `fixture.invalid`, the very category the test says it must not be.
- `single-run-evaluation.test.ts` (1342): the snapshot anchor is now the created lane's `createdFlowLaneSnapshot(` write.
- `build-identity/tests/identity.test.ts` and `core-identity/tests/identity.test.ts`: the recording-dispatch token is now `startRecording!)`. Its first occurrence is the earliest dispatch, and a missing token still fails the test.
- `tests/cli-llm.test.ts`
  - `liveRun` now takes the task arguments. By default it uses the instruction-led lane (`create-flow --instruction-task catalog-first-page`). The one passing "needs the Flow lane" case still uses `diagnose`.
  - 1821 and 1822 now drop `--flow`. The credential and budget refusals still fire before the task is resolved, which I checked by probe.
  - 1823: the `--flow` half now expects `"category":"recording.contract"` and the retirement message, instead of the unreachable "drop --flow".
  - 1828: the two `--flow` command lines were replaced by a plain `run <scenario>` and a live create-flow run.
  - 1830: now uses the live create-flow command line.
- `apps/scenario-lab/.../crossborder-marketplace/tests/browser-paths.test.ts` ("flash-deal-on-arrival"): `close-flash` is now inserted after `dismiss-welcome` instead of before the whole script. Once the welcome is dismissed, the promotion is the topmost overlay at any speed, and it still covers the consent banner pressed next. The claims "there before any step" and "closing it is enough" are both still asserted.

## Commands run and observed results

- Reproduction, before the edits: `pnpm --filter @fluxiq-web-extension/test-runner build` -> exit 0. Then `node --test` on the 5 test-runner files -> `# pass 70`, `# fail 13`, the same 13 tests as the sweep.
- Scenario-lab, before the edits, file run alone with `node --test dist/scenarios/crossborder-marketplace/tests/browser-paths.test.js` -> `# pass 17 # fail 0` (68 s). It does not fail when run alone.
- Race probe, using the harness from dist: clicking the flash close 0 ms after it was visible -> `closed ok 196`. Clicking 2600 ms after -> `welcome 1 FAILED Step close-flash (click) failed: locator.click: Timeout 12000ms exceeded.`, the sweep's exact error.
- Probe with the new order at waits of 0, 2600 and 5000 ms -> `failing facts []` each time.
- CLI probe of the replacement command lines, all from an empty root:
  - create-flow without a key -> `environment.missing ... DEEPSEEK_API_KEY is not set`
  - `--llm-max-cost-usd 0` -> `fixture.invalid ... cannot authorize`
  - bare `--flow` -> `recording.contract`
  - `basic-form` plain and live create-flow -> refused by the realistic-scenario rule, with no credential mentioned
- After the edits: `pnpm --filter @fluxiq-web-extension/test-runner build` -> exit 0 (rebuilt). `node --test` on the same 5 files -> `# pass 83`, `# fail 0`.
- After the edits: `apps/scenario-lab` `pnpm run build` (rebuilt), then `node --test dist/scenarios/crossborder-marketplace/tests/browser-paths.test.js` -> `# pass 17`, `# fail 0`.
- `pnpm --filter @fluxiq-web-extension/test-runner check` -> exit 0.
- `pnpm structure:check` -> `structure-audit: passed (194 warning(s), 644 baselined).` `runner-wiring.test.ts` is advisory-warned at 493 lines. It was already 482 lines before these edits.

## Not verified

- I did not run the whole scenario-lab test script (`dist/**/*.test.js`). I ran its build step plus the one affected file.
- I did not run the full `packages/test-runner` suite, only the 5 affected files, per the narrow-check rule.
- I did not reproduce the race under real sweep load. It was reproduced by delaying the click 2.6 s, which matches the mechanism and the error text exactly.

## Open questions or contradictions found (product or docs, outside my ownership)

1. `live-llm/live-llm-plan.ts:240` still tells a live run without a Flow lane to "pass --flow", but `--flow` is now refused as retired. Live `diagnose`, `repair` and `adapt` on `lab run` therefore have no reachable path. This is misleading guidance and possibly a product defect. A test still pins this message: "refuses a live LLM run that did not ask for the Flow lane", which passes.
2. Some code is now unreachable on the CLI path:
   - `commands.ts:274` and `live-llm-plan.ts:237` ("drop --flow"), because `parseLabCommand` refuses `--flow` first.
   - `resolveWorkflow`'s `flowLaneExclusion`, which is no longer reached for isolated recording-built runs.
   - `run-scenario.ts`'s `discardWindowUntil`, which is now never assigned.
3. `bench/run-bench.ts:505,591` still passes `flow: true` for bench `lane === "flow"` entries, so such entries would now be refused as `recording.contract`. The bench is currently refused anyway by the realistic-scenario rule.
4. `docs/architecture/testing-facility.md:2521` still says a `lab run --flow` of a no-action workflow "is refused as `fixture.invalid`". That is stale since t519, and line 1202 states the new behaviour.
