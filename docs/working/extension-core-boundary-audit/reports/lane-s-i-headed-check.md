# Lane S-I: headed, provider-free check of the chat's activity headline (t728)

## Outcome

Done. In a visible Chromium window, on everything-store (one of the ten realistic scenarios), with no model key, the extension chat's live line showed **"Building your Flow"** while a real Core build was running. The page overlay showed the same text, and when the build ended the overlay showed **"Build failed"**. Both strings are exactly what Core's `activityHeadline` returns (`WORKING.build` and `FAILED.build` in `!FluxIQ/packages/fluxiq/src/ui/activity-status/headline.ts`). In the built background bundle the headline wording comes only from Core's `ui/activity-status` sources (`headline.ts`, `pacer.ts`, `ending-kind.ts`). The extension has no copy of its own any more.

The harness exited 2, not 0. One of its 14 checks, `theMessageIsTheInstruction`, failed. That check covers the saved instruction, not the headline (see Open questions). All the activity, relay and build checks held.

## What changed and why

No source or test file was edited. Only build and run output was written, all to ignored paths:

- A Lab build phase under instance label `lane-s-i`. It ran through the Lab's own `runBuildPhase`, `buildOrder`, `runStep` and `withBuildLock`, called from a scratch driver: `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/53d1357c-b7da-4f48-9665-ff78992a8998/scratchpad/lane-s-i-build.mjs`. The outputs:
  - `apps/extension/.lab-instances/lane-s-i/` (e2e-chromium extension)
  - `apps/scenario-lab/.lab-instances/lane-s-i/dist/`
  - `domain/.lab-instances/lane-s-i/host/web-panel-host.mjs` (copied from the shared host)
  - The shared `test-evidence` and `test-runner` dists were also rebuilt by the build cache, because their inputs had changed in this tree. Those two have no per-label output.
- Evidence went to `test-runs/lane-s-i/` (ignored by `.gitignore:15`).

Why this harness: `packages/test-runner/dist/extension-chat-check/cli.js --build` is the documented headed, provider-free proof (testing-facility.md, around line 1711). It runs an isolated Core with no model key, pairs the real extension, opens Chrome's real side panel, and types a build request into the chat. Core reads the request without a model as `flow.createHere`, starts a real build and emits real `server.activity`, and the build stops on the locked key. I rejected the other candidates:

- `activity-overlay.spec.ts` sends a hard-coded display, so Core's headline is never involved.
- `cancel-build.spec.ts` uses a hand-written gateway and no realistic scenario page.
- The `ui:e2e` journeys drive Core's web panel, not the extension chat, and the suite refuses to run (non-realistic fixtures).
- `panel:golden` needs a paid creation proposal.

## Commands run and observed results

1. `node scripts/check/core-build.mjs` (in D) printed: `core-build: FluxIQ Core's build at C:\Users\osrs_\FluxStuff\fxwork\t728\!FluxIQ is current with its source.` Exit 0. I did not rebuild Core.
2. `node <scratchpad>/lane-s-i-build.mjs` (with FLUXIQ_LAB_INSTANCE=lane-s-i) exited 0 after 12m18s. The build-cache log shows `extension:build` built, with all three targets verified at 22 files each; `test-evidence:build` built; `test-runner:build` built; `host-copy` ran.
3. A search of the source map of `apps/extension/.lab-instances/lane-s-i/dist/e2e-chromium/background/index.js` for "Couldn't fix your Flow" and "function activityHeadline" found only `!FluxIQ/packages/fluxiq/src/ui/activity-status/{ending-kind,headline,pacer}.ts`.
4. The harness run:
   `FLUXIQ_LAB_INSTANCE=lane-s-i FLUXIQ_LAB_EXTENSION_PATH=<D>/apps/extension/.lab-instances/lane-s-i/dist/e2e-chromium FLUXIQ_LAB_SCENARIO_ENTRYPOINT=<D>/apps/scenario-lab/.lab-instances/lane-s-i/dist/server.js FLUXIQ_LAB_HOST_MODULE=<D>/domain/.lab-instances/lane-s-i/host/web-panel-host.mjs node packages/test-runner/dist/extension-chat-check/cli.js --browser chrome --scenario everything-store --page ./ --no-ask --build --evidence <D>/test-runs/lane-s-i/chat-check`
   - Exit 2, after 9m39s (most of it spent preparing the Core web build and starting the topology).
   - Browser: Playwright's bundled Chromium, always headed (`launchBrowser` sets `headless = false`). Build target: e2e-chromium. Panel mode: Chrome's real side panel, driven through `view-dom`.
   - Stage reached: `done`, with `failure: null` and no network-guard violations.
   - Checks that held (13): capabilityIdsAreTheSix, pageUrlIsTheScenarioPage, carriedABearerCredential, coreAccepted, coreAnsweredWithAnAutomationTurn, panelShowedTheAnswer, serviceWorkerSentIt, stageFoundThePersonTurn, fluxiqStartedABuild, fluxiqMadeTheFlow, theBuildEndedInTheThread, noModelMeansNoFlowIsApplied, fluxiqSaidWhy.
   - Check that failed (1): theMessageIsTheInstruction.
   - Build record: became `build`; ending `failed` after 7.4 s; failure `lab.chat_build_failed`; issue `flow_bootstrap.provider_secret_unavailable`. No provider call was possible, because no key was installed and the CLI strips provider secrets from its environment.
5. What the screenshots show. They are under `test-runs/lane-s-i/chat-check/2026-10-20T03-30-12-360Z-chrome/`. The panel had no page of its own, so its content appears in the `*-window.jpg` captures.
   - `03-chat-build-sent-window.jpg`: chat live line and overlay both say "Starting…". This is the extension's own send-start placeholder (`send-start.ts`), shown before Core's first activity arrives. It is not Core wording.
   - `04-chat-build-answered-window.jpg`: chat live line **"Building your Flow"** with a "Stop build" button; the overlay at the top-left of the page says **"Building your Flow"**. This is Core's `WORKING.build`.
   - `05-chat-build-ended-window.jpg`: overlay **"Build failed"** with detail "Build failed: your model key is locked" (Core's `FAILED.build`). The chat live line is gone, as designed: `liveLineModel` hides once the work stops. The thread shows Core's result turn, "The build failed: your model key is locked. …".

## Not verified

- I did not see the chat live line show a settled headline. By design the live line shows only working and waiting states. "Build failed" was seen in the overlay, not in the chat.
- Only Chrome/Chromium was tested; Firefox was not run.
- Repair, testing, waiting and paused headlines ("Fixing your Flow", "Testing your Flow", "Waiting for you: …", "Paused: …") were not exercised. They need a run, a candidate trial or an ask, and this provider-free build does not reach any of them.
- The headline text was read from screenshots. The harness does not record the live-line DOM text, and I did not add a sampler, because that would have meant writing a custom driver.
- No full suites were run.

## Open questions or contradictions found

- **`theMessageIsTheInstruction` failed.** Core saved the instruction as "What can you do?\n\nCreate a flow that lists …" and named the Flow "What can you do?". "What can you do?" is the relay claim's earlier question in the same conversation, so it was folded into the build turn. Screenshot 05 shows the person bubble re-rendered with both lines; in 03 and 04 it held only the build request. This is unrelated to the headline. The t728 Core diff to `runtime/conversations/` touches only cost and priced-call accounting plus a balance-exhausted message, so I could not tie the change to this task. I did not check whether `dev` behaves the same.
- The harness's default `--evidence` root is `C:/Users/osrs_/FluxStuff/evidence/t198`, which is outside the tree. Any caller has to pass `--evidence` to keep evidence inside the tree.
- The instance build also rebuilt the shared, unlabelled `packages/test-runner/dist` and `test-evidence` dists in the t728 tree. Another worker running from the same tree at that moment would have seen them change.
