# Lab And Domain Instruction-Led Implementation

Status: Source frozen; supervisor validation pending
Created: 2026-10-13
Last updated: 2026-10-13
Owner: codex-t516 worker
Scope: Retire recorded-only executable Lab conversion, carry explicit fixture demonstration descriptions and keep generic model guidance instruction-led.

## Current State

Implementation is frozen for supervisor checks. No worker package builds/checks, tests, browser/provider runs or commits were launched. Core/extension sources and shared documents were untouched. Required narrow test selections are below; compilation or live behavior is not claimed.

## Changes

- CLI `run --flow` without a saved Flow value refuses immediately with `automation.instruction_led_authoring_required` and direction to the existing explicit-task created-Flow lane. A `--flow <saved-id>` value remains the persisted Flow selection, not the retired recording lane. Existing/clone deterministic reuse stays available under Core's instruction gate.
- `runScenario` also rejects direct isolated/persistent recorded-lane requests before topology/browser startup, while exempting instruction-led creation and existing/clone targets. This prevents programmatic callers from bypassing CLI refusal.
- The old `runFlowLane` executable conversion body was removed. Its exported entry now always refuses before reading controls, authorizing a provider, proposing, approving, resetting, dispatching or judging. The direct recording approval helper also always refuses without calling Core. Read/mapping diagnostics, finalized-recording checks and candidate coverage diagnostics remain available; no second authoring engine or hidden activation flag was added.
- Existing explicit-task creation/chat remains normal generation. No saved/clone Flow is given synthesized instructions, no demonstration/script becomes task authority and no manually executed work is added to generation metrics. Saved-run missing-instruction refusals propagate unchanged; a new unit regression asserts no saved Flow dispatch or instruction mutation after refusal.
- Fixture contract adds optional `recordingDescription` to primary and named workflows. Workflow resolution preserves only that workflow's explicitly authored field, with no primary/title/task fallback. Runtime recording starts require explicit nonblank text up to the Core/UI-agreed 4000-character bound before topology starts.
- All 42 primary/named workflows across the ten realistic sites have separate authored demonstration descriptions (25 fixture files). These explain what the manual evidence shows; they are not copied automation instructions, generated titles or inferred trace labels. Synthetic/unit-only older fixtures may remain readable without descriptions, but any runtime recording start refuses missing context.
- All three existing/clone/recording start messages in `run-scenario.ts` use the same validated `{type:"fluxiq.startRecording", description}` helper. UI worker confirmed the extension wire and Core worker confirmed `client.start_recording`/create/start/update use top-level description, trimmed length 1..4000.
- Domain model guidance version `web-8` states written instructions define the automation and optional described recordings are untrusted supporting demonstrations that cannot authorize additional acts. Guidance contains no realistic site/task strings, selectors, expected datasets or fixture teaching. Its owning length bound is now 3600, below Core's public 4000 limit.

## Owning paths

`packages/test-runner/src/{commands,run-scenario}.ts`; focused `flow-lane/recording-only/`; `flow-lane/{run-flow-lane,recording-flow-proposal}.ts`; `run-lifecycle/{recording-description,index}.ts`; adjacent command/existing-run/recorded-lane/start tests.

`packages/test-contracts/src/{scenario,scenario-workflow,validation}.ts`; new `src/tests/recording-description.test.mjs` importing the built public API.

Twenty-five authored manifest/workflow files under the ten realistic scenario directories, plus `apps/scenario-lab/src/tests/recording-descriptions.test.ts`.

`domain/src/runtime/llm-evidence/system-instructions/instructions.ts` and its owning test.

## Required narrow validation

Supervisor received this exact source selection after freeze:

- Runner: `src/tests/{commands,existing-flow-run}.test.ts`; `src/flow-lane/tests/{recording-flow-proposal,run-flow-lane,live-repair-lane,finalized-recording}.test.ts`; `src/run-lifecycle/tests/recording-description.test.ts`.
- Contracts: `node --test src/tests/recording-description.test.mjs` after the supervisor's package build.
- Scenario Lab: `src/tests/{recording-descriptions,registry}.test.ts`; `src/scenarios/tests/realistic-site-live-tasks.test.ts`.
- Domain: `src/runtime/llm-evidence/system-instructions/tests/instructions.test.ts` (named domain runner selection).

The two old recorded-lane success suites were replaced with retirement/no-call regressions because their conversion behavior no longer exists. Approval tests now assert zero activation calls. Finalization, mapping-coverage, ordinary persisted-run and repair-judgement tests were retained in their owning subjects. Command tests retain instruction-led creation/replay and saved Flow selection while changing obsolete recorded-lane expectations to refusal.

New description regressions cover explicit preservation, no title/task/primary fallback, missing/whitespace/oversized/malformed values and all 42 real workflows remaining separate from task instructions. Generic guidance tests assert instruction precedence and absence of scenario-shaped teaching. No fixture oracle or recording script data was added to model context.

Touched-package types and structure audit remain supervisor-owned; no full suites. A pre-validation review flagged missing profile/provider placeholders in the refusal help example. Supervisor confirmed validation had not started; corrected it to the complete parser-valid explicit-task command with placeholders and refroze source. No secret example or provider invocation was added.

## Supervisor prerequisite correction

Supervisor's first test-contracts prerequisite build failed because the initial TypeScript test lived in the production source include and imported Node test modules into this browser-safe package, which has no Node type dependencies. Its validation-result union reads also lacked proper narrowing. Replaced that test with adjacent `src/tests/recording-description.test.mjs`, importing `../../dist/index.js` and narrowing invalid results before reading issues. No browser package dependency, production config or source contract was changed for the correction. Source is refrozen for the supervisor's prerequisite build and explicit owning Node test selection; this worker ran no gate.

## Supervisor narrow results and CLI fixture correction

Supervisor independently reports contract 2/2, Scenario Lab 9/9, domain 16/16 and the earlier runner subjects 22/22 passing, with domain/Scenario Lab/test-runner types and builds passing. Commands/existing-run selection initially needed the owning test-evidence build output; after that prerequisite it passed 40/44 with four obsolete CLI expectation fixtures failing. Updated only `commands.test.ts`: retired bare-Flow calls now require the closed `automation.instruction_led_authoring_required` code and retirement message; the no-live-panel success case uses an existing saved Flow selection instead of retired conversion. Product guards were not weakened. Tests are refrozen for the supervisor's command-only rerun; this worker ran no gate.

## Supervisor structure correction

Supervisor's subsequent types pass, but structure audit found `run-scenario.ts` above its 800-line limit and a description test reaching into a scenario implementation file. Removed the unreachable recorded-only dispatch block from isolated recording orchestration (the early guard already refuses this path; existing/clone execute independently), leaving 780 newline-delimited lines. Exposed the existing realistic task inventory through the scenario public barrel and switched the test to that barrel. No statement packing or product guard weakening. Source is refrozen; affected supervisor rechecks are runner source/build and commands, Scenario Lab description/registry/inventory tests, and the structure audit.

## Limits

Supervisor integration also includes adjacent `src/tests/*.test.mjs` in the
owning test-contracts package test command, so the new browser-safe regression
runs in future normal package sweeps as well as the observed explicit narrow run.

No fresh live build/replay or new Core instruction/description gate was exercised here. Core worker owns authoritative persisted instruction validation, described supporting-evidence context assembly and recording-only service approval refusal; UI worker owns user description entry and legacy instruction recovery. This worker relies on those production seams, and did not add local durable storage or model context authority. Prior t518 recordings/code are preserved and were not relaunched.
