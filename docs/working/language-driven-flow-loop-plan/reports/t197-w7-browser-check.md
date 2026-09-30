# t197-w7: headed, provider-free browser check of the robot-check hand-off

Worker w7, 2026-09-30. Tree `fxwork/t197/!FluxIQWebExtension` at `0faee6e6`, with Core `fxwork/t197/!FluxIQ` at
`6b5ffaaa`. Nothing was committed and no product code was edited.

## Outcome

**Partial.** C and D are proven. B is proven through a wait node, not a navigation. A is stopped on a defect that I
reproduced (see "Defects found"). All runs were in `lab-slots/ui-1`: claimed 09:14:04Z, released 10:01:48Z, with an
owner line `t197 w7 robot-check browser check <time>`.

| Item | Result |
| --- | --- |
| A. A self-clearing check is waited out | **Defect.** A click's wait is capped by the command timeout, so an 8 s check is handed to a person after 3.9 s. The bigbox and auction recorded lanes could not reach their Flow runs, because of an existing `recording.persistence` defect. |
| B. A person-only check after a navigation | **Proven, on a wait node.** The first Flow node (`web.dom.wait_for_selector`) reported `USER_INTERVENTION_REQUIRED`. There was no reload loop and nothing was typed. The person cleared the check and the run resumed. No `web.navigate` node exists in a recorded Flow, so no navigation met the check. |
| C. A person-only check after a click | **Proven.** The crossborder filter click reported `USER_INTERVENTION_REQUIRED`, with "captcha: the click was made, …". The hand-off cleared in 3.7 s. |
| D. The ask in the side panel | **Proven.** The chat header shows "FluxIQ needs you:…" (cut off at panel width). The chat shows the full ask with Continue and Stop buttons. The overlay shows "Waiting for you". |

## Environment (every run)

- Command base: `FLUXIQ_LAB_ALLOW_STALE_CORE=1 FLUXIQ_LAB_ALLOW_STALE_BUILD=1 FLUXIQ_LAB_INSTANCE=ui-1
  FLUXIQ_TEST_ENV_FILES=none pnpm lab run <scenario> --target isolated --workflow <w> [--variant <v>] --flow`.
- Browser: Playwright Chromium (`ms-playwright/chromium-1161`, `Chrome/134.0.6998.35`), headed. The live panel was
  the real side panel ("side-panel (verified open)").
- Extension build target: `e2e-chromium` (`apps/extension/.lab-instances/ui-1/dist/e2e-chromium`). The prelude
  rebuilt it from this tree, which has no uncommitted extension edits.
- The run was provider-free: `llm.mode: disabled, calls: 0`.
- **Why the two stale overrides were used.** Another agent is editing this same tree. The edits are uncommitted:
  - Core: `runtime/recovery/**`, `flow-bootstrap/person-needed.ts`, `parking/index.ts` and `person-needed-tool-calls.ts`;
  - domain: `llm-evidence/harness-options/execute.ts`.

  I built Core with `heavy.sh ... pnpm --filter fluxiq build` between 09:02 and 09:03:27Z. The first of those edits
  is dated 09:03:32Z, so the dist is the committed `6b5ffaaa`. After the last run, `find packages/fluxiq/dist -newermt
  09:03:28` returned 0 files, so Core's dist did not change during any run.

  The domain edit touches the build loop's evidence harness, which the recorded Flow lane does not load. The Lab
  runs its own copy of the host bundle (`host-copy`).

  Without the overrides, the prelude refused twice:
  - "FluxIQ Core's build is 9 minute(s) behind its source: …recovery/annotation/exploration.ts";
  - "The domain build is 1 minute(s) behind its source: …harness-options/execute.ts".
- Screen evidence came from a scratch loop. It called the Lab's own window-capture helper
  (`%TEMP%/fluxiq-window-capture/window-capture-cefc27f4ef8f703d.exe capture <browser pid> 70`) once a second, into
  `C:/Users/osrs_/FluxStuff/evidence/t197/w7-*-raw/`. Named copies of the key frames are listed below.

## Runs

### A1: bigbox-retail `pickup-towels`: never reached the Flow

- Run `run-munwefwt-23202a69`. In the recording lane, the third results document (the ValueRidge filter) served the
  bot check. Playwright's `bot-check-passed` wait took 8 s (09:28:40 to 09:28:48) and the check passed.
- Then: `recording.persistence`, "Core was still writing the run's recording after 90000 ms". The details were
  `entryCount 121, entriesAppendedWhileWaiting 80, endedAt null`. No Flow was built.
- The same failure on bigbox is already recorded in `week2-exit-plan/reports/w2x-extract-across-pages.md` and
  `w2x-scenario-selector-audit.md`. It is not a t197 change. Core takes in recording entries at about 0.7 to 0.9 per
  second on this loaded machine (free RAM 2.5 to 3.1 GB, three other lanes live).
- My capture loop took no frames of this run. The first version of the script matched no browser; it was fixed
  before B.

### A2: auction-marketplace `kestrel-auctions`: never reached the Flow

- Run `run-munx2v55-ae8b5da6`. The recording lane's 34 steps all completed.
- Then the same `recording.persistence` failure: `entryCount 96, entriesAppendedWhileWaiting 65, endedAt null`. No
  Flow was built.
- Frames: `evidence/t197/w7-A-auction-raw/` (recording lane only).

### B and D: everything-store `first-page-earbuds`, variant `robot-check`

- Run `run-munx9bvj-a7ba7442`. The recording lane finished and Core persisted it. The Flow ran with the variant
  armed; it had 15 candidates.
- **Node 1**, `recorded.candidate.entry.3…`, `web.dom.wait_for_selector`:
  - `failed`, `user_intervention_required` / `web.intervention.required`, `retryable: false`;
  - actual: "no element matched before the timeout; the document is a robot check, which only a person can answer".
- **Hand-off 1** (`person-hand-offs.json`):
  - stage `run`, check `type-the-characters`;
  - the Lab typed the code: `did: cleared`, answer `person_done`, `secondsWaited 1.2`.
  - The person module found the check untampered, so FluxIQ had typed nothing into it and requested no new image.
  - The run resumed at step 2 of 15 on the real store page.
- **Node 6**, `entry.13`, a `web.dom.click` (the search submit):
  - it landed on the store's *soft* check ("Click the button below to continue shopping / We're checking that your
    browser is set up to shop securely. This only takes a moment.");
  - the result: `USER_INTERVENTION_REQUIRED`, actual "captcha: the click was made, and the page it landed on
    (/scenarios/[withheld]/s) is a robot check that said it would clear by itself and had not after 3913 ms, so only
    a person can answer it now".
- **Hand-off 2**: `check: null`, `did: no-check-visible`, answer `person_stop`, `secondsWaited 9.1`. By the time the
  ask was showing, the soft check had cleared by itself (frame 09:50:43 shows the results page).
- The run ended `failed` / `runtime.behavior`, "The Flow reported an unexpected user_intervention_required failure".
  The `person-hand-off` invariant failed: "1 hand-off(s) where no check the Lab knows was showing (run)".
- Frames (`C:/Users/osrs_/FluxStuff/evidence/t197/`):
  - `w7-B1-canvas-check-before-ask.jpg` (09:50:20): the canvas check; the panel reads "Running step 1 of 15: Wait for
    element".
  - `w7-B2-D-canvas-check-ask-header-overlay.jpg` (09:50:21):
    - the chat header reads "FluxIQ · FluxIQ needs you:…";
    - the overlay reads "Waiting for you / FluxIQ needs you: complete the check on this …".
  - `w7-B3-after-continue-store-page.jpg` (09:50:22): the store page after Continue; step 2 of 15.
  - `w7-A-defect1-soft-check-after-click.jpg` (09:50:33): the soft check after the click. The chat shows hand-off 1's
    full ask text and "You chose "Continue"."
  - `w7-A-defect2-soft-check-handed-to-person.jpg` (09:50:37): the soft check, with the header and overlay asking the
    person.
  - `w7-D-ask-continue-stop-in-chat.jpg` (09:50:43): **D.**
    - The chat shows "FluxIQ needs you: complete the check on this page, then press Continue." with **Continue** and
      **Stop** buttons, and the header reads "FluxIQ · FluxIQ needs you:…".
    - The page behind is already the results page; the check had cleared by itself.
  - `w7-B-lab-own-00041-handoff1.jpg`: the Lab's own capture at hand-off 1.
  - Raw frames: `w7-B-everything-raw/`.

### C: crossborder-marketplace `spain-hubs`

- Run `run-munxkfy9-81c5beb5`. The recording lane finished and Core persisted it. The Flow had 15 action results.
- **Node 10**, `entry.40`, a `web.dom.click` (the Free shipping filter, the third results load):
  - `failed`, `user_intervention_required` / `web.intervention.required`, `retryable: false`;
  - expected "the page the click leads to loads";
  - actual: "captcha: the click was made, and the page it landed on (/scenarios/[withheld]/search) is a robot check,
    which only a person can answer".
- **The hand-off:** check `traffic-screen`; the Lab pressed "I'm not a robot": `did: cleared`, `person_done`,
  `secondsWaited 3.7`. The `person-hand-off` invariant passed.
- **Node 11**, `entry.50`, the recorded press on the box: `web.target.not_found`, because the box was already gone.
  The Flow went on: extraction was 13 of 13 records and 52 of 52 fields, and `flow-lane.json` status is `succeeded`.
- The run was still judged `failed` / `runtime.behavior`, "The Flow reported an unexpected user_intervention_required
  failure" (see "Defects found", item 3).
- Frames:
  - `w7-C1-crossborder-check-ask-header-overlay.jpg` (09:59:37): "Sorry, we have detected unusual traffic… I'm not a
    robot", with the header and overlay asking the person;
  - `w7-C2-lab-person-pressed-box.jpg` (09:59:38): the Lab's press, now "Checking your browser…";
  - `w7-C-lab-own-00058-flow-failed-verdict.jpg`;
  - raw frames: `w7-C-crossborder-raw/`.
- In C's frames the chat body shows only "Worked for 24s · 12 steps" while the header and overlay ask. The ask card
  with its buttons appeared in B's second hand-off, but not within C's 3.7 s window.

## Defects found (reproduction for the lead; not fixed)

1. **A self-clearing check after a click is handed over early.**
   - `apps/extension/src/runtime/landed-check-wait.ts:105` `checkWaitBudgetMs` returns
     `min(15 s, timeoutMs - elapsed - 1000)`. `click-landing.ts:143` passes the click command itself.
   - A recorded click carries a 5 s confirmation (`domain/src/web-panel-host.ts:203`,
     `expectedConfirmation.timeoutMs: 5_000`). That the command's `timeoutMs` is also 5 s is inferred from the
     3,913 ms figure, not read.
   - So a click gets about 3.9 s of waiting. That is too short for the everything-store soft check (8 s) and bigbox
     (8 s), and probably for auction (5 s from load).
   - Reproduction: the B command above. Node `entry.13` reports "…would clear by itself and had not after 3913 ms…".
     Core asks a person for a check that clears itself about 4 s later. The Lab person answers Stop, and the run fails.
   - This contradicts the design line "a self-clearing check is waited out in place … at most about 15 s".
2. **The Lab person does not know the everything-store soft check.**
   - `everything-store/person-check.ts` recognises only the canvas check. Given defect 1, a hand-off at the soft
     check always ends `no-check-visible` → `person_stop`.
   - Once 1 is fixed this hand-off should not happen at all, so 1 is the cause.
3. **A run that succeeds after a cleared hand-off is judged a failure.**
   - In C, `flow-lane.json` has `status: succeeded`, but its `failure` still holds the cleared node's
     `user_intervention_required`.
   - The runner turns that into "The Flow reported an unexpected user_intervention_required failure"
     (`runtime.behavior`), even though the `person-hand-off` invariant passed and the extraction matched 13 of 13.
   - Reproduction: the C command above. Owner: w5's evaluation, or the Flow-lane reader in the runner.
4. **Existing, not t197:** `recording.persistence` on long recordings under load (bigbox and auction here). This
   blocks every recorded Flow over about 80 entries on this machine.

## Commands run and observed results

- `heavy.sh "t197 w7 core build" pnpm --filter fluxiq build` (Core): exit 0, 58.9 s.
- First A attempt, without overrides: the prelude refused on stale Core (exit 1).
- Second attempt, with `FLUXIQ_LAB_ALLOW_STALE_CORE=1`, through `heavy.sh`: the prelude refused on a stale domain
  build, because a source changed during the build (exit 1).
- A1, A2, B and C: as above. Each exited 1 with the verdicts quoted.
- After the runs:
  - `find ../!FluxIQ/packages/fluxiq/dist -type f -newermt '2026-09-30 09:03:28' | wc -l` printed `0`;
  - no t197 Lab processes were left;
  - the ui-1 heartbeat loop was stopped and the slot directory removed.

## Not verified

- A positive A: a check waited out in place and reported as success. Not reached: bigbox and auction never got past
  recording, and the only self-clearing check a Flow met was handed over at 3.9 s.
- B through a `web.navigate` node. A recorded Flow has none; the check was met by the first wait node.
- A navigation to the same address held behind a check, without a reload. Not exercised.
- The company-website in-place check (the press raises "Checking you are human…"). Not run: its recording is about
  25 steps and would most likely hit `recording.persistence`. C used the crossborder click-landing path instead, so
  the content-side `watchRobotCheck` / `needsPerson` path is untested live.
- The build-stage ask (a created-Flow build). Every build path needs a model call, so it cannot run provider-free.
- A person pressing Continue or Stop in the side panel by hand. The Lab answered through the API every time.
- The header's full ask text. It is cut off at the panel width. Only the chat body and the overlay show more of it.

## Open questions or contradictions found

- The t197 tree was being edited by another agent while I validated it. By AGENTS.md, a validation run in that
  situation should run in its own worktree. I pinned the committed Core build instead and checked it did not change.
- `lab:interactive`'s `extension-action` goes straight to the content script and returns only `status`, without the
  code. It skips the worker's navigate and click-landing paths, so it cannot prove A to C. I used the recorded Flow
  lane instead.
