# Audit A4: page interaction and the Lab harness (2026-09-30)

Read-only audit. No Lab was run and no code was edited.

**Scope:**
- page interruptions: cookie walls, popups, modals, page assistants, robot checks, iframes, rate limits;
- the extension's start, pairing and in-page action execution;
- the Lab: failures around the model, the person simulation, the network guard, timeouts, and missing bundle evidence.

**Evidence read:**
- **Debugs:** the union by filename of the 57 debugs in the dev tree and in `fxwork/{t174,t193,t194,t195}`. The lane copy wins; 13 files exist only in a lane.
- **Lane reports:** t174, t193, t194, t195, t197, t198, and the t200 inventory.
- **Code:** dev in both repositories (downstream `097c9a52`, Core `8f2b2453`). Branches were read with `git diff dev...<branch>` and working trees with `git status`.
- None of the lane reports has a "Top causes for the audit" section yet. Causes are taken from the fix logs, run tables and debugs.

**How runs are counted:** a run is counted when its debug or its lane's run table names the cause. Runs 23, 26, 27, 29, 30, 31, 32 and 33 (t174) and runs 11 to 16 (t195) have no debug file, so their rows in the lane reports are used.

## Ranked causes

| # | Cause | Runs affected (examples) | Stage | Product / Lab | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | The page's own assistant, support or greeting card (bigbox "Val", company-website chat greeting) sits over controls in a viewport corner, and the interference defence never finds it | 14: 12 builds with a press refused `blocked_by_dialog` under the card (`munoa86g`, `munovwp3`, `munpjclw`, `munpwa5r`, `munri5gr`, `muntmwvx`, `munv9eqy`, `munvvc3z`, `munw16g4`, `munwdydi`, `munwmt25`, `muoga8at`); playback died at step 12 (`muntmwvx`); recovery stopped at the covered next-step button (`munu4b4y`) | 2 and 4 | Product | Fixed on branch `task/t195-live-control-flow` (R1). Open on dev |
| 2 | Robot checks: the page FluxIQ lands on is a check. FluxIQ's own pace sets them off, and a model-built click or navigation cannot wait out one that clears by itself | 8: crossborder `munoeac4`, `munp80f5`, `muntcsge`, `munw3g8n`; everything-store `muntc23v`; bigbox `munoa86g`, `munw16g4` (Press & Hold met in dry-run replays), `muoga8at` (a press `action_failed` after 10.5 s on a self-clearing check) | 2 | Product | Split, see 2a-2d |
| 2a | The check is handed to a person and the Lab plays the person | the same 8 | 2 and 4 | Product and Lab | Fixed on dev (t174 F7 and t197). Never exercised in a browser |
| 2b | A model-built click or navigation has no check allowance, so a self-clearing check (bigbox clears after 8 s) gets about 4 s and fails or goes to a person | `muoga8at`; likely every bigbox build that meets its check | 2 and 4 | Product | **Open** |
| 2c | FluxIQ's own page loads trip the site's limiter or check (11 extract reruns in `muntc23v`; fast dry-run replays in `munw16g4` and `munoa86g`) | 3 | 2 | Product | Page pace fixed on branch `task/t194-live-judge-answer` (F9). Replays are removed on branch `task/t196-state-digest-cost` |
| 2d | The dry run's reset landed on the check and said only `reset_failed` | `muntc23v` (10 dry runs) | 2 | Product | Fixed on dev (`0faee6e6`, per the t194 debug) |
| 3 | The extension's start crashed: the Lab's network guard `fetch()`ed into the service worker before its scope existed. The side panel showed `Page crashed` or `ERR_ABORTED`, or `fluxiq.connect` went unanswered | 8, all with 0 calls: `muna3yfq`, `munbu244`, `mundl2j0`, `mundupr5`, `munhpy2m`, `muni3pdr`, `munnetuw`, `munoaqcn` | 0 (start) | **Lab** (plus a product gap: no socket open deadline) | Fixed on dev. The guard waits for scope (`network-guard.ts:143-153`); open timeout 10 s (Core `transport.ts:28,60`). 10/10 clean starts on the merged build, and no start failure since run 13 |
| 4 | The first press after a page load is swallowed as a "wake-up" (bigbox `client/shell-script.ts:45`), so Add to cart never adds. The model will not press twice, and the runtime does not notice | 6 or more: `munuxns5`, `munvmg0n`, `munvz5x0`, `munwmfrs` (t195 runs 11 and 13-15), `munvvc3z` (the goal missed 3 of 5 facts); probably `muoga8at` and `munuks76` | 2 and 4 | Product | Fixed on branch `task/t195-live-control-flow` (F20 `ignored-press/`, unit only). Open on dev |
| 5 | Consent walls | 6 | 4 | Product | Split, see 5a-5b |
| 5a | The defence would not decline cookies, so playback died under the consent wall | `munoa86g`, `munore4o`, `munpwa5r` | 4 | Product | Fixed on dev (t195 F1, `interference/vocabulary.ts:31-45`). Proven live in `muntmwvx` (run 20) |
| 5b | A wall hides a target that is only drawn once consent is answered; recovery clears layers only for `blocking_dialog` and `obstructed_target`, never for `target_absent` | company-website `munu4b4y`, `munvhy0t`, `munwk8ta` | 4 | Product | Fixed on branch `task/t195-live-control-flow` (R2). Open on dev (`recovery/fault.ts:176-178`) |
| 6 | The bundle lacks the in-page account of a build call: which layer blocked, what the defence pressed, attempts, waits. Build steps publish `resultCode` and `resultReason` only | 12 debugs could not answer it: `muncqlr0`, `munnop9n`, `munoa86g`, `munoeac4`, `munore4o`, `munovwp3`, `munpwa5r`, `muntcsge`, `muntmwvx`, `muntufao`, `munu4b4y`, `munvvc3z` | debug | Lab and product evidence | **Open** |
| 6b | No decision record for a build that proposes nothing, and the Core workspace was deleted | runs 30-35 (t174), `munnhi5q`, `muoga8at` | debug | Lab | Keep-state is on dev but opt-in (`run-scenario/keeps-run-state.ts`). The decision dump (F12) is on Core branch `task/t174-live-lane` only |
| 6c | No screenshots in the bundle | about 10: t193 runs 1-2, t195 runs 1-10 (`capture-unavailable`), t194 runs 1-4 | debug | Lab | Fixed on dev (`run-scenario/window-capture/`, `run-scenario/ui-review/`) |
| 7 | Nobody answers a permission ask in a Lab run. The build waits about 120 s, then stops. Since `f2f80024` a stop to ask is never a pass, so no consequential task can pass | 3: `munovwp3`, `munuj2os`, `muny5y17`; also the unanswered "Apply it as it stands? Yes/No" during t193 runs 4-5 | 2 | **Lab** | In progress, uncommitted in the `fxwork/t195` tree (L1, worker t195-w14). dev: `person-simulation/simulation.ts:46` leaves every non-check ask alone |
| 8 | The Lab's call-bound and generation timeouts | 4 | 2 | Lab | Split, see 8a-8b |
| 8a | The Lab's generation request timed out at 300 s and was then polled only for a proposal (`lab.generation_unfinished`) | `mun8tgdh`, `munaiz76` | 2 | Lab | Fixed on dev (`http-control/long-request.ts`) |
| 8b | Launch refusals and relaunch loops against a stale Core build | runs 24, 25, 34a (t174), run 12 (t195), about 60 relaunches (t193) | 0 | Lab and launcher | Fixed on dev: the staleness check runs after the build phase, and relaunch loops are refused (`5363e39b`) |
| 9 | The Lab labels a product build failure as a facility failure | `muntc23v`; `munda7ub` ("Core made none", false) | report | **Lab** | **Open** (`run-scenario.ts:505-507`) |
| 10 | After a failed repair re-run, the Lab waits 300 s for a recovery record Core never writes. The re-author's spend is missing from `live-llm.json` | `munw7ffn` (306 s idle; $0.0425 and 36 calls unreported); probably `munv53gt` and `munq5s8x` | 6 | Lab and Core | **Open** |
| 11 | Site rate limits: a 429 page mid-pagination, and a "too fast" notice on a press | 4: `munnhi5q`, `muntc23v`, `munq5s8x`, `munq51ik` | 2 and 4 | Product | 429 page and rate-limit notice fixed on dev (t194 F6, t195 F7). The waited retry is live-unproven. Pace: see 2c |
| 12 | Child iframes are never in the build's look (`action-runner.ts:354,365` runs the snapshot in the top frame) | 0 so far. It blocks `company-website-book-service`, whose permission point "Confirm and pay £30.00" is inside the Slotwise iframe (`company-website/pages/book.ts:21`); no run has tried that task | 2 | Product | The look is fixed on branch `task/t200-model-sees-whole-page` (D9, uncommitted, in progress). The action path already exists on dev (`resolve-plan-node.ts:28`, `browserFrameId`). Defence into a covering iframe: open, latent |
| 13 | Today: a Core module imported `node:crypto` into the extension bundle, and only the Lab prelude caught it | 1 attempt (t197 w8 browser check) | build | Process / check | Fixed on dev (`parking/person-needed-tool-calls.ts` imports no `node:*`). The check gap is open, see "Checks" |
| 14 | Today: the extension chat could not send before a first recording (`no_project`) | 1 attempt (t198 r3 chat check) | chat | Product | Fixed on dev (`91883ede`, `panel-control-deps.ts:18` `resolveProjectId("panel")`). Browser proof pending |

Causes that are not in A4's area but touch it, left to their owners:
- The dry run replays from the build's state, not a fresh visitor's (consent already answered, cart already changed). t174 D1 and t193 H2 are owned by t196.
- The Withdraw confirm dialog sits after the loop (`munnyvbr`). This is t195's control flow.

## Root causes on dev, and fixes for what is open

### 1. The page's own card in a corner (product; fixed on branch t195)

- **Root:** `apps/extension/src/content/action-runtime/interference/overlays.ts:50-58`. `PROBE_FRACTIONS` probes the centre, the edge midpoints and the quarter lines, with no corner. The bigbox support card opens bottom-right about 3 s after load, over the pinned Add to cart. The company-website greeting card covers the quote drawer's footer.
- **Fix:** merge t195's R1 as it stands. The files, all on `task/t195-live-control-flow` (commit `c22646d0`):
  - `interference/{probe-points.ts (new), presence.ts (new), pressable-way-out.ts (new), overlays.ts, clear.ts, index.ts}`;
  - `recovery/{attempt.ts, fault.ts, index.ts}`;
  - tests `interference/tests/probe-points.test.ts` and `recovery/tests/attempt.test.ts`.
- **Validated (unit only):** extension 1500/1500, per the t195 report.
- **Live proof needed:**
  - `bigbox-retail-pickup-cart`: the napkins add is not blocked;
  - `company-website-quote-request`: playback passes s2 and the drawer's footer.

### 2. Robot checks (product)

**2a. Hand-off: fixed on dev, never run in a browser.**
- **On dev:**
  - Extension `runtime/landed-challenge.ts`, `runtime/landed-check-wait.ts` and `runtime/click-landing.ts:143-147`.
  - Domain `actions/check-wait.ts`.
  - Core `parking/person-needed-ask.ts`, `flow-bootstrap/person-needed.ts` and `executor/person-needed.ts`.
  - Lab `packages/test-runner/src/person-simulation/**`.
- **What to prove:** the first Lab run after the stop must be one that meets a check, before any other lane relies on it:
  - `crossborder-marketplace-hub-to-cart`;
  - or the provider-free `pnpm lab run everything-store --target isolated --flow --workflow first-page-earbuds --variant robot-check`.

**2b. Model-built commands get no check allowance: open.**
- **Root:**
  - Only recorded candidates carry the allowance: domain `web-panel-host.ts:207-209` sets `checkWaitMs` and `timeoutMs = 5000 + 15000`.
  - A model-built node gets Core's default: Core `nodes/policy/action.ts:62`, `timeoutMs ?? 5000`.
  - The extension's wait is therefore `min(15 s, timeout - elapsed - margin)`, about 4 s (`runtime/landed-check-wait.ts:110-114`; `content/actions/click.ts:245-246`).
  - bigbox's "Robot or human?" clears after 8 s (the `check-wait.ts` header). A build-time press lands on it and ends `action_failed` (`muoga8at` iteration 13), or is handed to a person needlessly.
  - t197's report lists this as not checked.
- **Fix, partitioned by file:**
  - Domain `domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts`: when the resolved output satisfies `webAutomationActionWaitsOutChecks(outputId)`, add `checkWaitMs: WEB_AUTOMATION_CHECK_WAIT_MS` to the node's parameters. Also set its policy `timeoutMs` to `WEB_AUTOMATION_DEFAULT_ACTION_TIMEOUT_MS + WEB_AUTOMATION_CHECK_WAIT_MS`, exactly as `web-panel-host.ts` `candidate()` does. A model-given `timeoutMs` keeps its value plus the allowance.
  - The worker must first confirm which field Core's executor reads for a built node's deadline: the plan node's `timeoutMs` policy, and `nodes/policy/action.ts:62`.
  - Domain `domain/src/runtime/llm-evidence/node-run/run.ts`: the build call's own dispatch must carry the same allowance. The worker locates where the build call's command timeout is set; it is not in `run.ts` by name, and may be the Core default.
  - **Tests:**
    - `plan-resolution/tests/resolve-plan-node.test.ts`: a click and a navigate carry `checkWaitMs`, and the timeout includes it; an extract does not.
    - Parity with `domain/src/tests/web-panel-host.test.ts`.
  - **Conflicts:**
    - `node-run/run.ts` is also edited by t200 (uncommitted) and by `task/t174-live-lane` (F11 context split, P1 A), so do the `run.ts` part after both land.
    - `resolve-plan-node.ts` is not touched by t200.

**2c. FluxIQ's own pace sets off checks.**
- Merge t194 F9 (`apps/extension/src/background/page-pace/**`, `runtime/{action-runner.ts, command-router.ts}`, `shared/protocol.ts`, `content/extraction/pagination.ts`).
- t196's branch removes build-time replays (`77b269a2`: replays only in judgement and repair; a lasting step is checked, not rerun). That removes the replay-triggered checks in `munw16g4` and `munoa86g`.
- **Conflict:** t194's `action-runner.ts`, `command-router.ts` and `shared/protocol.ts` are also modified in t200's tree.

**2d.** Nothing further.

**Minor, open:**
- Recovery exploration's 600 s clock keeps running while a person is asked (t197 w6).
- The self-clearing cover watch misses local-classifieds' pushState feed cover (t197 w3). No run has met it.

### 3. Extension start (Lab; fixed on dev)

No further action. The start trace (`run-scenario/extension-start-trace/`) is on dev and would name any regression.

### 4. The swallowed first press (product; fixed on branch t195)

- **Root:** on dev, a press that dispatches and sees no effect is reported as succeeded with the page unchanged (`content/actions/click.ts`). The model never repeats it: F17's hint and F19's catalog sentence both had no effect live, and F19 was reverted on dev (`379763fb`).
- **Fix:** merge t195 F20:
  - `content/action-runtime/ignored-press/{ignored-press-watch, page-press-listener, press-again, press-scope, index}.ts` plus 4 tests;
  - `actions/{click.ts, types.ts}` plus `click.test.ts`;
  - `action-runtime/{execute-action.ts, index.ts}`;
  - `docs/architecture/web-capabilities.md`.
- **Guard to keep:** press again only when no request, mutation, navigation or focus move happened within 800 ms, never on a link, and never after a robot check or rate-limit notice.
- **Live proof:** `bigbox-retail-pickup-order` or `-pickup-cart` adds on the first visit.

### 5. Consent walls

- **5a** is fixed on dev.
- **5b root:** `apps/extension/src/content/action-runtime/recovery/fault.ts:176-178`. `faultNeedsInterference` is true only for `blocking_dialog` and `obstructed_target`, so `target_absent` behind a wall only waits.
- **5b fix:** merge t195 R2 (`faultMayHideBehindLayer`, `interference/presence.ts`, `recovery/attempt.ts`), on the same branch as cause 1.
- **Not recommended:** t174's R2 part A, which would return a refused attempt's page change as its own step (domain `node-run/run.ts:531-546` sets `replay: undefined` on every refusal; Core `flow-draft/step.ts:186`). With R2 B the runtime answers the wall in playback, and t196 is redefining what a dry run replays.

### 6. In-page evidence missing from the bundle (open)

- **Root:**
  - `content/action-runtime/recovery/record.ts:48-68` writes the `RecoveryAccount` (`recovery/account.ts:36-54`: `attempts`, `absorbed[]`, `waitedMs`, `dismissed`, `outcome`) only as a sentence appended to `failure.actual`, truncated to 1,024 characters.
  - The build tool result and the Lab's `flow-lane.json` keep `resultCode` and `resultReason` only (`packages/test-runner/src/existing-fluxiq-control/publishable-step-value.ts:81-117`).
- **Fix, partitioned by file.** Closed words and counts only, never page text:
  1. Extension `content/action-runtime/recovery/record.ts`: also set a structured `result.recovery = { attempts, absorbed, waitedMs, dismissed, outcome, layer }`. `layer` is a closed word from the classification that `interference/vocabulary.ts` and `layer-text.ts` already make: `consent` | `promotion` | `assistant` | `rate_limit` | `robot_check` | `dialog` | `unknown`. Test: `recovery/tests/record.test.ts`.
  2. Extension `shared/protocol.ts`: `BrowserActionResult.recovery?`. **Conflict:** t200 (uncommitted) and `task/t194-live-judge-answer` both edit this file, so land it after them.
  3. Domain `runtime/llm-evidence/node-run/run.ts` and `tools.ts`: copy it to the tool result's detail as `inPage`. **Conflict:** t200, and `task/t174-live-lane`.
  4. Core `flow-bootstrap/evidence-loop-steps.ts`: publish `inPage` on the step. Core `llm/evidence-loop/progress-trace.ts`: one `inpage=` token. **Conflict:** `progress-trace.ts` is edited on both `task/t174-live-lane` (F12) and `task/t196-state-digest-cost`.
  5. Test-runner `existing-fluxiq-control/publishable-step-value.ts` and its test: admit the closed fields.
- **For 6b:**
  - Test-runner `run-scenario/keeps-run-state.ts`: keep the run state by default when `--live-llm` is set.
  - Merge F12 (Core `llm/evidence-loop/decision-dump.ts`, from `task/t174-live-lane` `c013b547`), and have the Lab set `FLUXIQ_BUILD_DECISION_DUMP` under the run's ignored instance tree. Lane launchers do both by hand today.

### 7. Permission asks nobody answers (Lab; in progress)

- **Root:** `packages/test-runner/src/person-simulation/simulation.ts:40-48` answers only `control.kind: "person_check"`.
- **Fix:** commit and merge t195 L1 from the `fxwork/t195` working tree:
  - `person-simulation/{asks, hand-off-record, index, lab-person, simulation}.ts` and `permission-answer.ts` (new);
  - `flow-lane/creation/{index, lane, permission-point}.ts`;
  - `run-scenario.ts`;
  - tests;
  - `docs/architecture/testing-facility.md`.
- Its rule: `grant` at the task's declared permission point, `deny` elsewhere. Reports w14 and w16 are in that tree. Validation status is not recorded in the t195 fix log (row L1 says "in progress"), so the supervisor must run its tests before merging.
- **Also:** decide whether the Lab answers a Flow-run "Apply it as it stands?" confirm, which t193 saw unanswered in runs 4-5.

### 9. Facility mislabel (Lab; open)

- **Root:** `packages/test-runner/src/run-scenario.ts:505-507`. When `flowObservation?.reportedVerdict == null`, any error is projected as `facilityFailure: scenario.execute/unclassified`, including `RunnerFailure("runtime.behavior")` from a build that proposed nothing.
- **Fix, same file:** project a facility failure only when `classifyRunnerFailure(error)` (already computed at `:503`) is not a product class such as `runtime.behavior`. The worker reads `classifyRunnerFailure`'s closed set first. `run-scenario.ts` is shared with t195 L1, so this change comes after L1.
- **Test:** a new case in `run-evaluation/tests/` (or a `run-scenario` projection test): a `runtime.behavior` failure with no reported verdict has `facilityFailure: null`.

### 10. The repair re-run record and re-author spend (open)

- **Core `runtime/service/runtime-adaptation/repair-rerun.ts:169-186`:**
  - When the re-run's status is not success, write the marker `coreRecoveryState` reads as `ended` (the Lab's `flow-lane/terminal-run-wait.ts:315-317` already stops waiting on it).
  - The worker reads `coreRecoveryState` in `terminal-run-wait.ts` for the exact field.
  - Test: `service/runtime-adaptation/tests/repair-rerun.test.ts`.
  - **Conflict:** `task/t194-live-judge-answer` edits `repair-rerun.ts` (F12 attempt numbering), so this comes after it.
- **Lab `packages/test-runner/src/live-llm/live-llm-run.ts:372-392`:**
  - The repair's observed usage is read from the run detail only. Add the re-author build's usage from its proposal or adaptation record (`build-usage.ts` already reads a build's `totalProviderCallCount`).
  - Test: `live-llm/tests/live-llm-run.test.ts`, where a re-author's calls appear in `repair.observed`.

### 12. Iframes (product; latent)

- **The look:**
  - t200 D9 adds every frame, and names a frame that does not answer. Today `background/connection/dom-snapshot.ts:77,126` drops a frame silently after 150 ms.
  - The manifest's missing `match_about_blank` (`manifest.chrome.json:39-42`) is also t200's.
- **Acting:** a handle in a child frame already writes `browserFrameId` (domain `resolve-plan-node.ts:28`, `elements.ts:313-321`), and `action-runner.ts:344-367` routes to that frame.
- **Open and latent:**
  - A top-frame target covered by a cross-origin consent or check `<iframe>` cannot be cleared, because the defence runs in the target's frame.
  - Do not build this until a scenario or run shows it. Record it as a known gap.
- **Check once t200 lands:** `company-website-book-service` must be able to reach its "Confirm and pay £30.00" permission point, which is inside the Slotwise iframe.

## Should the checks change? Yes

**The `node:crypto` class.**
- t197 w8 wrote that "`pnpm check` and the unit tests do not bundle the extension". That is not correct on dev: `apps/extension/scripts/check-extension.mjs` bundles every browser entry in memory with the same `node:` guard (`build-extension.mjs:158-248`).
- What it bundles against, however, is Core's `dist`: `fluxiq/package.json` maps `./automation-studio` to `./dist/...`.
- So a Core source change is invisible to the downstream check until Core is rebuilt. t197's report says Core's dist was stale (02:03) during its round, and not rebuilt after the fix.
- The Lab caught it because its prelude builds Core and runs `scripts/lab/core/build/staleness.mjs` first.

Recommended changes:
1. **Root `package.json` `check`:**
   - Before `pnpm -r check`, fail with the stale files named when Core's dist is older than its source. Reuse `scripts/lab/core/build/staleness.mjs`.
   - Or build the linked Core libraries through the build cache (`scripts/worktree/core-build.mjs` `buildCore`), which reuses from its stamp when nothing changed.
   - Either way, `pnpm check` then bundles the extension against the Core that will ship.
2. **Core, its own gate:**
   - `runtime/parking/ask-effect.ts:120` already documents that the parking barrel reaches the browser.
   - Add a Core structure-audit rule, or a vitest, that fails on any `node:` import under the browser-reachable Core directories. At minimum that is `runtime/parking/**` and `nodes/routine/**`; the chain was `nodes/routine/approval.js` -> `parking/index.js`.
   - This catches the class in Core's own check, before any downstream build.

**The `no_project` class** (state set only by another flow):
- Add a background test that starts from empty extension storage, pairs with a fake Core, and sends a chat with no recording made. t198 added a narrower unit case in `background/panel/tests/conversation-relay.test.ts`.
- Make the provider-free `extension-chat-check` (it runs on `social-network-feed`, one of the ten scenarios) a build-cache step gated on the extension bundle's fingerprint. It then runs once per extension change before a live run, not on every run.

**This audit's causes** (each needs a test that fails before its fix):
- Cause 2b: a domain unit test that a built click carries the allowance.
- Cause 9: a Lab unit test on the facility projection.
- Cause 6: a publishable-step test.
- Lab person answers (causes 2a and 7): a provider-free Lab run on `everything-store --variant robot-check` after every change to `person-simulation/**` or `runtime/parking/**`. This proves the ask, the answer and the resume without spending money.

## Conflicts with t196 and t200

**t200** (uncommitted, 87 paths in its tree):
- **Deletes on purpose (no ranking):** `content/evidence/lead-statements.ts`, which is t174 F10 on dev, the fix that gave the model "No results for …".
- **Removes front-layer-first ordering** (domain `front-layer.ts`). Build-time interruption handling relies on the model noticing a covering dialog. t200 must keep dialogs and blockers as flagged facts on the element or packet, since `evidence/dialogs.ts` and `background/connection/dom-snapshot.ts:392` "blockers" are now uncapped. Otherwise interruption handling regresses silently.
- **Shared files:**
  - with `task/t194-live-judge-answer`: `shared/protocol.ts`, `runtime/action-runner.ts`, `runtime/command-router.ts`, `node-run/run.ts`;
  - with `task/t174-live-lane`: `node-run/{run.ts, replay.ts}`, `capture.ts`, `sanitize.ts`, `stable-handles.ts`, `structure/detect.ts`, `tool-rejection.ts`, `tools.ts`;
  - none with t195's branch or tree.
- Fixes 2b, 6 and 12 of this audit touch t200 files, so they come after t200 merges.

**t196** (branch `task/t196-state-digest-cost`, `8610d2ae`/`77b269a2`):
- It removes build-time replays and checks lasting steps instead of rerunning them. That addresses the replay-triggered robot checks (2c) and `reset_failed` onto a check (2d).
- **Shared files:**
  - with `task/t174-live-lane`: domain `node-run/replay.ts`; Core `llm/evidence-loop/progress-trace.ts` (t174 F12 and fix 6 step 4);
  - with t200: domain `node-run/replay.ts`, and t200's Core scope of `flow-draft/**`, `evidence-loop/**` and `node-tools/**`.
- None of the t195 branch's extension fixes (causes 1, 4 and 5b) conflict with t196 or t200, so they can merge first.

## Suggested merge order for this area

1. t195 branch (R1, R2, F20) and t195 L1 once validated: causes 1, 4, 5b and 7.
2. t194 F9 page pace: cause 2c.
3. t196.
4. t200.
5. Then fixes 2b, 6, 9 and 10.

The first live run after these merges should be `bigbox-retail-pickup-cart`: it exercises the corner card, the swallowed press, consent, and a self-clearing robot check in one scenario.

## Not verified

- No run, test or build was executed for this audit.
- t195 L1's validation is not recorded.
- Run counts for runs without a debug come from the lane run tables.
- Whether `muoga8at`'s seven `action_failed` presses were all the check-allowance defect is not established: its Core workspace was deleted. Only iteration 13 is tied to a self-clearing check.
- Whether t197 w8's downstream `pnpm check` actually ran against a stale Core dist is inferred from its report, not reproduced.
- The exact field the Lab reads for `recoveryState` (cause 10) and the build call's timeout source (cause 2b) are left for the fix worker to confirm, as noted.
