# t231: every step of a live run logged as files, and one central place for runs

Lane lead report. Status: Ready to commit (provider-free proof done); live proof waiting for the supervisor's go (t229 merged) and a slot.

The task script allocated id **t228**, so the branch is `task/t228-step-logs` in both repositories:
- Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t228/!FluxIQWebExtension`
- Core worktree: `C:/Users/osrs_/FluxStuff/fxwork/t228/!FluxIQ`

The supervisor's brief calls the work t231.

## Order

The user asked for this (verbatim): "i would like to see exactly what the model sees every single step, the model decisions output exactly as it outputs, etc. Each step in a run should be logged as a file".

The coordinator added a central place for runs: `C:/Users/osrs_/FluxStuff/lab-runs/<YYYY-MM-DD>/<run-id>/`, plus `lab-runs/index.md`.

## Findings that shaped the design

- **The run bundle cannot hold `steps/` while the run is going.**
  - `<runsDir>/<runId>` must not exist before `finalize`, which renames staging over it and throws if it exists (`packages/test-evidence/src/bundle.ts:69`).
  - `.staging-<runId>` is published and redaction-scanned.
  - `.work/<runId>` (`allocation.runRoot`) is deleted after the run unless `FLUXIQ_LAB_KEEP_RUN_STATE=1` is set.
- **Requests are large.** A decision request can be about 1.4 MB (t223-w8: 1,413,957 bytes). A 64-decision run can therefore write well over 100 MB of `request.json` plus `request.txt`, so steps must exist once on disk, not be copied.
- **Core starts once per Lab run.**
  - It starts in `coordinator.ts:135` through `buildFluxIQEnvironment`.
  - Within one loop, `decide` and `executeTool` are strictly sequential.
  - No build mutex exists, but a Lab run builds one Flow at a time.
- **Core has two provider `fetch` sites:**
  - `runDeepSeekTask` (`llm/deepseek/provider.ts`) serves every harness call: build decide, instruction authority, verify/judge, diagnosis, patch, replan and recovery exploration.
  - `panel-command.ts` serves the chat.
  - The exact body is the `body` string at both sites. Today the raw response bytes are decoded inline and discarded.
- **Core knows no phase or round for a build call.** Rounds and phases live in `flow-bootstrap/unfinished-build/phases.ts` (`round`, `repairs`, `announce`).
- **Not every tool call goes through the progress-trace wrapper.**
  - Phase-2 test replays (`service.ts` `test:` line) use the outer `executeTool` and bypass it.
  - In-loop dry-run replays go through it.
- **What the model is given back for a tool call** is the execution result's `evidence` (`evidence-loop.ts:704`).
  - The compact page text is the `page` string inside it. That is `value.page.page` for `core.run_node` (the domain's `web-llm-page.v3`).
- **Junction safety, measured on this machine:**
  - Node 22's `fs.rm(recursive)` unlinks a directory junction and keeps its target. `pnpm task` worktree removal uses this.
  - PowerShell 5.1's `Remove-Item -Recurse -Force` also keeps the target.
  - Scratch test: `jtest`, `jtest2`, "central kept: true".

## Design

**1. Steps live once, in the central folder.**
- The Lab sets `FLUXIQ_LLM_STEP_LOG_DIR=<lab-runs>/<date>/<runId>/steps` for the Core of every live LLM run.
- Core writes there from its first call, so a killed run still leaves its steps.
- After `finalize`, the bundle gets `steps` as a directory junction to that folder, so `test-runs/.../<runId>/steps/` works too.

**2. Core step log** (`runtime/llm/step-log/`) is one env-gated module.
- Model steps are hooked inside both provider adapters: `request.json` holds the exact body and `response.json` the exact raw reply.
- Tool steps are hooked through the evidence loop's wrapper and the phase-2 test's `executeTool`.
- Round and phase come from a step scope that `phases.ts` sets around each round and each test.
- Model steps outside a build take their phase from `taskKind`: `judge` for loop_verification, `repair` for runtime_patch and diagnosis, and `chat` for the panel command.
- `meta.json` is written last, so a folder with `meta.json` is complete.
- `index.md` in `steps/` has one line per step.

**3. Lab** (`packages/test-runner/src/lab-runs/`):
- At run start it opens the central folder and writes `entry.json` (running, pid).
- It runs a screenshot watcher that writes a capture into each completed tool step.
- At the end it creates the bundle junction and copies the run's small key files (report, summary, run, evaluation, screenshots, live-llm snapshot, core log) into the central folder.
- It regenerates `lab-runs/index.md` under a lock. A dead pid that is still "running" reads as "unfinished".

**4. Secrets.**
- No header is ever logged, and Core never holds the resolved key in the step log.
- Every written text is screened for credential shapes.
- The Lab copies only the named files.

## Dispatch

| Worker | Effort | Owns | Report |
| --- | --- | --- | --- |
| w1 Core step log | worker-high | `!FluxIQ` `runtime/llm/step-log/`, `deepseek/provider.ts`, `deepseek/panel-command.ts`, `evidence-progress/progress-trace.ts`, `flow-bootstrap/unfinished-build/phases.ts`, `service.ts` (`test:` line only), `llm/index.ts`, their tests | `reports/t231-w1-core-step-log.md` |
| w2 Lab runs | worker-high | `packages/test-runner/src/lab-runs/`, `environment.ts`, `coordinator.ts`, `run-scenario.ts` wiring, their tests, `docs/architecture/testing-facility.md` | `reports/t231-w2-lab-runs.md` |

## Status

**Ready to commit, provider-free.** The live proof waits on the supervisor: t229 must be merged and a slot named.

Both workers reported Done (reports `t231-w1-core-step-log.md`, `t231-w2-lab-runs.md`). I reviewed both diffs and made two fixes:

- **Core `step-log/screen.ts`: the credential screen is narrower.** The worker's shape (`sk-` plus 16 of `[A-Za-z0-9_-]`, or `Bearer` plus 6 characters) would rewrite ordinary page text inside the exact `request.json`, for example a class `sk-product-card-title` or the phrase "bearer instrument". It now matches:
  - `sk-`, then optional dash-joined segments (`proj-`), then at least 20 key characters;
  - `Bearer` with at least 20 token characters.

  New test: `step-log/tests/screen.test.ts`.
- **Lab `lab-runs/step-screenshot-watcher.ts`: only the newest page step gets a picture.** The watcher photographed every newly complete folder in order, so during quick test replays step 5's folder could hold a picture of the page after step 7. Now two cases get `screenshot.skipped.txt` naming the step that moved the page on:
  - a step that a later page step has already started after;
  - a picture taken while a later page step started.

  Folders sort by number. The tests were rewritten accordingly, and the testing-facility doc was updated.

## Validation

Lead's own runs, 2026-10-01:

**Core**
- `npx vitest run src/.../llm/step-log src/.../llm/deepseek src/.../llm/evidence-progress src/.../flow-bootstrap/unfinished-build` (packages/fluxiq): **17 files, 113 tests passed**, including `screen.test.ts`.
- `heavy.sh ... npx vitest run src/programs/automation-studio/runtime/tests/service-bootstrap`: **21 files, 108 tests passed**. w1's two `adaptation.test.ts` timeouts did not reproduce.
- `heavy.sh ... npx tsc --noEmit -p tsconfig.json` (packages/fluxiq): exit 0.
- `node scripts/structure-audit.mjs` (Core): "structure-audit: passed (211 warning(s), 349 baselined)".
- `heavy.sh ... pnpm run build` (packages/fluxiq): built. `dist/.../llm/step-log/` exists, so the Lab's Core is fresh for the live run.

**Extension**
- `heavy.sh ... pnpm run build` (packages/test-runner), then `node --test dist/lab-runs/tests/*.test.js dist/tests/environment.test.js`: **21/21 passed**.
- `heavy.sh ... node --test "dist/**/*.test.js"` (packages/test-runner): **1769 tests, 1769 pass, 0 fail**.
- `node scripts/structure-audit.mjs`: "structure-audit: passed (154 warning(s), 118 baselined)".

**End-to-end smoke, provider-free** (scratch `t231-smoke/smoke.mjs`, built dist of both halves, temp root):
1. `LabRunRecord.open` created the steps folder.
2. Core's real DeepSeek adapter ran with a fake fetch, then one tool call went through `automationStudioLlmStepLogTool`.
3. A fake capture supplied the step picture, and the record was closed against a fake finalized bundle.

Observed:
- The central tree held `2026-10-01/run-smoke-0001/` with entry.json, the copied report.html, run.json, summary.json, `screenshots/` and `snapshots/live-llm.json`, and `steps/`:
  - `0001-decide/` held decision.json, meta.json, request.json, request.txt, response.json and response.txt.
  - `0002-tool-web.recovery.inspect/` held call.json, meta.json, page.txt, result.json and screenshot.png.
  - `steps/index.md` was present.
- "request.json byte-identical to the body fetch received: true"
- "response.json byte-identical to the reply: true"
- The fetch did carry `authorization: Bearer ...`, yet "secret in any central file: false | 'Bearer' in any file: false".
- "bundle steps is a junction: true -> lists 0001-decide, 0002-tool-web.recovery.inspect, index.md"
- `lab-runs/index.md` row: `| 2026-10-01 18:39:03 | t231-smoke | everything-store/search-and-buy | passed | $0.0123 | 2 | [2026-10-01/run-smoke-0001/](2026-10-01/run-smoke-0001/) |`.

**Junction safety** (scratch `jtest`, `jtest2`): Node 22 `fs.rm(recursive)` and PowerShell 5.1 `Remove-Item -Recurse -Force` on a tree holding the junction both left the target: "central kept: true".

No unit test wrote to the real `C:/Users/osrs_/FluxStuff/lab-runs` (absent after all runs).

## Not verified

- **No live run yet**, so these are unproven:
  - Core writing real decide, tool and test steps under a live build;
  - the native window capture landing in step folders;
  - the junction inside a real finalized bundle;
  - the time cost of writing a ~1.4 MB request plus its render per decision.
- **Fixture credentials in steps.** A Lab redaction literal (a fixture login typed by the model) would be written into `steps/`, exactly as it was sent to the provider. The bundle's redaction attestation does not scan the central folder.
- **Runs outside `runScenario` log no steps:** interactive sessions, chat-check and saved-flow replay.
- **Numbering across processes.** Two Core processes writing one directory could take the same number for different kinds. The Lab gives each run's single Core its own directory.
