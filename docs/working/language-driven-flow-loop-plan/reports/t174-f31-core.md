# t174 / F31-core: a build told where its Flow starts opens by going there

Worker report. Repo: Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t174/!FluxIQ`, branch `task/t174-live-lane`. Nothing committed. Core dist was not rebuilt.

## Outcome

Done. When the registry has a `startLocation` and the binding declares `runsNodes.arrival`, the opening call runs the arrival (the start location written into the declared parameter) instead of the look. It runs under callId `initial.core.run_node`, before any provider call, and is recorded exactly as a model `tool_call` with `add: true` at iteration 0. When it works, the step is kept as the Flow's first. When it fails, it is recorded as a failed call. Builds with no startLocation, bindings with no arrival, and continuations (which pass no start) open with the look as before.

## What changed and why

All paths are under `packages/fluxiq/src/programs/automation-studio/runtime/` unless noted.

- `llm/evidence-loop/tool.ts`: `initialObservation` becomes `{ input; arrival?: JsonObject }`. The arrival is an input of the same tool, which keeps Core generic: it never parses a location. I edited this file even though the brief did not list it, because it holds the type definition the other changes need.
- `llm/harness-options/binding.ts`: adds `runsNodes.arrival?: { node; parameter }`. The registry passes `{ ...arrival, location: startLocation }` to the run-node tool only when a startLocation is given. The `executionFor` comment now mentions the arrival. The `scopedOption` copy (~402) needed no change because it copies `initialObservation` whole.
- `llm/node-tools/run-node.ts`: takes `arrival?: { node; parameter; location }` and sets `initialObservation.arrival = { node, parameters: { [parameter]: location }, consequences: [] }`. It does this only when `initial` exists (the arrival rides on it) and the node is in the offered library.
- `llm/evidence-loop.ts`: I moved the main loop's call recording into a shared closure, `runCall(iteration, callId, decision, tool, signature, { replaces, held, verifying })`. It covers the run, digests, the failed-call handler, accounting, epochs, the repeat guard, observation epochs, the evidence push, the history row, `lastAction`, `draftRecord` with add/act, rerun replacement, the trace row, no-progress and searching.
  - The main loop now calls it.
  - The opening builds a synthetic `{ kind: "tool_call", callId: "initial.<toolId>", toolId, input: clone(arrival), add: true }` and calls `runCall(0, ...)` with the request signature at epoch 0.
  - The look path is unchanged, in the `else if`.
  - The file is 791 lines, under the 800 limit.
- Validators: `arrival` is accepted only on a `perCallEffect: true` tool and must be an object. This applies in `llm/evidence-loop-decision.ts` (`automationStudioLlmEvidenceValidTools`), `llm/deepseek/preflight.ts` and `llm/harness-options/option.ts`.
  - Request projection: `request-body.ts` maps each tool to toolId, description, effect and repeatPolicy only, and the decision schema reads only toolId and inputSchema. So the arrival never reaches the model. A test checks the outbound body.
- `llm/deepseek/request-body.ts`: `FLOW_START_LOCATION_NOTE` now says the build opened by going to startLocation, that the first evidence entry is that step, and that it is the Flow's first step, already kept. The model must go there itself only if that entry failed or the evidence does not open with it. That last clause keeps the note true for a binding with no arrival.
- `activity/wording/tool-call.ts`: an opening call whose action reads back as the navigate verb gets the title and label "Opening where the Flow starts". The title starts with "Opening", so a card still reads the navigate verb back from it.
  - **Decision:** I gave it `kind: "tool"` rather than `"note"`, because it is a kept Flow step, not bookkeeping. The opening look stays a note.
- Docs:
  - `docs/architecture/automation-studio/llm-flow-bootstrap.md`: a new paragraph on the arrival after the `initialObservation` paragraph.
  - `docs/architecture/automation-studio.md`: the routing start-state sentence now names the arrival.
- Tests:
  - `llm/tests/evidence-loop.test.ts`: a new `describe("the opening arrival (F31)")` with 5 cases.
    - The arrival runs before any decision under `initial.core.run_node`, and the first decision sees its evidence.
    - It produces a kept step `d1` at iteration 0, a trace row and `toolCalls` 1.
    - The history records it as a call, not a look.
    - A failed arrival keeps no step, is traced as `tool_failed`, and the loop still asks the model.
    - With no arrival, the look runs and its step is `taken`.
    - Validity: accepted on `perCallEffect`, refused on an observe-only tool, refused when not an object.
  - `llm/tests/evidence-loop-provider.test.ts`: the arrival passes preflight and is absent from the outbound body; on an observe-only tool it is refused before any secret is read.
  - `llm/harness-options/tests/binding.test.ts`, 3 cases:
    - the option carries the arrival;
    - the loop's first `executeTool` call is the arrival, with startLocation;
    - no arrival without a start or when the node is not runnable.
  - `llm/node-tools/tests/run-node.test.ts`: 2 cases.
  - `llm/harness-options/tests/option-arrival.test.ts` (new file): 2 cases.
  - `activity/wording/tests/wording.test.ts`: 1 case.
  - The arrival loop tests started in a new file, `llm/tests/evidence-loop-arrival.test.ts`. That pushed `llm/tests/` to 26 files, over the 25-file limit, and `llm/evidence-loop/tests/` is also at 25. So I merged them into `evidence-loop.test.ts` (656 lines).

## Commands run and observed results

- **Failing-first, as a new file at HEAD:** `pnpm --filter fluxiq exec vitest run .../llm/tests/evidence-loop-arrival.test.ts` gave "4 failed | 1 passed (5)". The arrival case failed with "expected spy to be called 1 times, but got 0" (the tool list was refused as invalid configuration), and the validity case failed with "expected false to be true".
- **Failing-first, final location:** I reverted only `evidence-loop.ts` to HEAD (`git show HEAD:<f> > <f>`, my copy saved to scratchpad and then restored), then ran `vitest run .../llm/tests/evidence-loop.test.ts -t "opening arrival"`. Result: "2 failed | 3 passed | 29 skipped". The arrival case failed on "expected {…} to deeply equal {…}" (the look ran instead), and the history case failed on "not to contain '\"look\"'". After restoring, the whole file passed: "Tests 34 passed (34)".
- `bash .../heavy.sh "t174 F31 fluxiq check" pnpm --filter fluxiq check` exited 0. The first run failed on a test-helper type (`runsNodes` possibly undefined under exactOptionalPropertyTypes), which I fixed with `NonNullable`.
- `bash .../heavy.sh ... pnpm --filter fluxiq exec vitest run <44 files>`: "Test Files 1 failed | 43 passed (44); Tests 1 failed | 574 passed (575)".
  - The 44 files are every test grepping for initialObservation, startLocationNote, OPENING_PREFIX, "initial.", initial.core or startLocation; plus every changed or new test; plus `request-prefix.test.ts`.
  - The one failure is `route-state/tests/build-routing.test.ts` › "route-state captures per recorded build": for everything-store-run4, before 29→30, afterUnreported 29→28, callsBeforeUnseen 3→2.
  - **It already fails at HEAD.** With all 9 changed source files temporarily put back to their HEAD versions (mine saved and restored), the same test gave "1 failed | 7 passed (8)". It is not caused by this change.
- `bash .../heavy.sh "t174 F31 structure" pnpm structure:check` exited 0, with advisory warnings only and "1 baseline entries can be lowered". I did not run `structure:baseline`.
- Line endings: every changed file is CRLF with 0 LF-only lines, matching the checkout (autocrlf true).

## Not verified

- Any live or Lab run.
- The downstream web binding: it must declare `runsNodes.arrival` (for example `{ node: <web navigate node id>, parameter: "url" }`). The web domain's arrival rule must also accept a navigation to startLocation that arrives under `initial.core.run_node`. Both are outside this brief.
- Core dist was not rebuilt (the lead rebuilds it), so downstream typechecks will not see `runsNodes.arrival` until then.
- Whole-package suites were not run, as the brief said.

## Open questions or contradictions found

- `route-state/build-routing.ts` (not owned) treats any first `initial.*` call as the "free first look" and takes the start state from it. With the arrival, the start state becomes the page the arrival left, which is the start location. I believe that is correct, but its comments and the constant name `FREE_FIRST_LOOK_CALL_PREFIX` still describe a look.
- `build-routing.test.ts`'s recorded-build table already fails at HEAD and needs its own owner.
- Wording: I chose `kind: "tool"` for the opening arrival (see above). If the extension relies on every `initial.*` call being a hidden note, flip it in `activity/wording/tool-call.ts`.
