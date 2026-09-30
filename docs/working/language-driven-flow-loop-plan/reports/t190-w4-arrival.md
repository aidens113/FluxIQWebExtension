# t190-w4 — arrival is a fact of the build, not of the tab (cause 3)

## Outcome

Done. A build that was given a `startLocation` is now refused `start_location_not_reached` until a navigation node has succeeded in that build. This holds even when the tab is already on the start location, which is what happened in run 6 (`run-muncqlr0-3348202b`). A request without a `startLocation` behaves exactly as before.

## What changed and why

- **New `domain/src/runtime/llm-evidence/node-run/arrival.ts`**: `createWebNodeArrivals()` and the `WebNodeArrivals` type.
  - It keeps a bounded set (16 builds, oldest dropped first) keyed by (sessionId, projectId, flowId). This is the same key shape as `evidenceScope`, and the same bounding as `REMEMBERED_ANSWERS`.
  - `arrived(build)` asks whether the build has arrived; `arrive(build)` records that it has.
  - `opening(build, callId)` resets the build to "not arrived" when the `callId` starts with `initial.`. The header comment says this is Core's naming (`AS/runtime/llm/evidence-loop.ts`).
  - The header records run 6 as the reason.
- **Barrel `node-run/index.ts`**: exports `createWebNodeArrivals` and `WebNodeArrivals`.
- **Owner of the memory: `domain/src/runtime/llm-evidence/tools.ts`**. `createWebAutomationLlmEvidenceRuntime` creates `arrivals` next to `repeatedRefusals` and passes it to `runWebOutputNode`. Nothing else in `tools.ts` changed.
- **`node-run/run.ts`** (only the start-location gate and the hooks; w3's `captureAfterAction` code is untouched):
  - `WebNodeRun` has a new required field, `arrivals`. It is required so a caller cannot forget it; `tools.ts` is the only place that builds this object.
  - When a request has a `startLocation`, `arrivals.opening(...)` runs before the node is looked up. This resets the build on Core's opening call.
  - `currentPage` still takes the capture, so the commands sent to the gateway are the same whichever tab the build was handed. If the build has not arrived, it throws the page away and returns `undefined`. The existing `notThereYet` refusal and the "run from nowhere" path then apply unchanged.
  - After a navigation node's command succeeds (`webMovesThePage`), and only when the request has a `startLocation`, the build is marked arrived. This happens before the after-action capture, so a page that cannot be read afterwards still counts as arrival.
  - Replay path: a replayed **step** that is a navigation node and succeeded also marks the build arrived. A **reset** does not, because it is this domain's own move and not a step of the Flow.
  - The file header and the `currentPage` comment now say the rule also holds for a page that is already open, and cite run 6.
- **`node-run/start-location.ts`**: the header gained a paragraph after "Enforcement is the world, not a rule". It says that when the page is already there, the build still remembers it has not arrived, cites run 6, and explains why Core cannot write the missing step.
- **New `node-run/tests/arrival.test.ts`**: 8 tests. The start location is `http://127.0.0.1:41873/scenarios/bigbox-retail/`, on a gateway whose capture always succeeds on that page.
  - (a) The `initial.core.run_node` inspect is refused `not_at_start_location` with the detail `{reason: start_location_not_reached, startLocation}`, and no page or location is returned.
  - (b) A click after that is refused the same way, and no `web.dom.click` is dispatched. The detail also carries `repeatedAnswer: 2` from the existing repeated-refusal marker, so the test checks the reason and start location rather than the exact object.
  - (c) Navigating to the start location succeeds. Its draft is `effect: mutate`, `proposes: true`, `ranWith` carries the URL, and `replay.from` is the start location.
  - (d) After that, an inspect succeeds and returns the location, and a click succeeds.
  - Re-arm: a second `initial.` call after arrival is refused again.
  - (e) With no `startLocation`, the inspect and click succeed on the open page.
  - (f) After arrival, a dry run (`dryrun.1.reset`, then `dryrun.1.1` navigate, then `dryrun.1.2` click) returns `core.replay.replayed` three times, and a later inspect still succeeds.
  - Resumed build: a fresh runtime with nothing remembered replays the same dry run (all three replayed), and a model inspect afterwards succeeds.

## Dry run and resumed build under the new rule

- **Dry run** (`dryrun.<n>.reset` and `dryrun.<n>.<pos>`): replay calls go to `replayWebOutputNode` before the gate and never call `currentPage`, so the rule never refuses them. Their `callId`s do not start with `initial.`, so they never reset the build. After a normal build has arrived, the dry run behaves exactly as before, and the build is still arrived afterwards (test f).
- **Resumed build** (new process, empty memory):
  - Replaying the saved draft is not refused, because replay is not gated.
  - The draft's first replayed step is the navigation, and when it succeeds the build is marked arrived. Model calls after the replay therefore run normally (resumed-build test).
  - One case is not covered by that: if Core resumes by sending a fresh `initial.` look *before* any replay, that look and any non-navigation call are refused until the model navigates. That is the rule working as designed (this process has not reached the page), but it would add a second navigation step to the resumed draft. I do not know whether Core resumes this way.

## Commands run and observed results

- **Failing before**: I could not run the change against the original code without touching git state, which the brief forbids, so I simulated the old behaviour. I temporarily changed `arrived` to always return `true`, which makes the rule depend on the tab again, as before the change.
  - `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t190-w4 domain test before" env DOMAIN_TEST_BUILD_LABEL=t190-w4 pnpm --filter @fluxiq-web-extension/domain test`, from the worktree `domain` directory.
  - Result: `# tests 900 # pass 897 # fail 3`. The failures were `not ok 486` (opening look), `not ok 487` (press before navigating) and `not ok 490` (re-arm). Tests c–f passed, as expected, since they cover behaviour that should not change.
  - I then reverted the simulation.
- **After**: the same command without "before" in the label, from `C:\Users\osrs_\FluxStuff\fxwork\t190\!FluxIQWebExtension\domain` (confirmed on the pnpm banner).
  - Result: `# tests 900 # pass 900 # fail 0`, with `ok 486` through `ok 493`, which are the eight arrival tests.
  - The existing `start-location.test.ts` tests (`ok 524` and `ok 525` among them), `run.test.ts`, `replay.test.ts` and `reload-click.test.ts` are all in the 900 passing.
  - One run on the way failed only because (b) asserted the exact detail object, which the `repeatedAnswer` marker changes; I loosened that assertion.
  - Another run went to the main checkout by mistake (the shell's cwd reset) and showed 882 tests. I discarded it and re-ran from the worktree.
- **Typecheck**: `bash .../heavy.sh "t190-w4 domain check" pnpm --filter @fluxiq-web-extension/domain check`, from the worktree root.
  - The first run gave exit 2 with `TS2345` at `arrival.test.ts(179)`: `resultCode` may be `undefined`. I fixed it with `?? "no result code"`.
  - The re-run gave `check=0`, which means both `tsc` passes succeeded.
- **Structure audit**: `node scripts/structure-audit.mjs`, from the worktree root.
  - Result: `structure-audit: passed (122 warning(s), 120 baselined).`
  - All warnings are advisory. `run.ts` grew from 657 to 699 lines; it was already past the 400-line advisory threshold.

## Not verified

- No Lab, live or browser run, as the brief required. The run 6 behaviour is covered only by the stub gateway.
- Whether Core sends an `initial.` call when it resumes a build (see the case above).
- Whether a build that ended without the opening call being repeated (for example, an observation node missing from `runsNodes`) keeps its arrival for the next build of the same flow in the same process. In that case the rule does not reset.

## Open questions or contradictions found

- The `node-run/` barrel now exports the arrival memory beside `runWebOutputNode`. `arrival.ts` exports a type plus one factory, the same pattern as `repeated-refusal.ts`, and the audit did not flag it.
- **Resumed build via a fresh `initial.` call**: Core resumes that way, the rule costs one refused call plus a second navigation step in the draft. Core should either not send the opening look on resume, or the domain should mark arrival when the draft replayed at the start of the resume included the navigation (it already does this for the replay path).
