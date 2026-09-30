# t191 extension chat UI and status overlay — lane report

## Fix log

- **Round 1 (2026-09-30), status: ready. The lead verified it.**
  - Overlay: it now sits bottom-left and is visible with the panel open and closed. The root cause of the invisible
    overlay: it was drawn bottom-right, under the side panel, which overlays a fixed 1280 px viewport. See
    `t191-overlay-pacer.md` and the screenshots in `C:/Users/osrs_/FluxStuff/evidence/t191-shots/after-*`.
  - Pacer: raw events fold into `display`. On the real t174 build trace (259 lines), the headline changed 103 times
    under t185 and 2 times paced. The sentence changed 188 times (max 4/s) under t185 and 128 times paced (max 2/s,
    at least 1.2 s apart).
  - Chat rebuilt: bubbles, activity folds, a live line, and a composer where Enter sends and Shift+Enter adds a
    newline. See `t191-chat-ui-worker.md`.
  - Validation, through `heavy.sh`:
    - extension `check && test && build` -> EXIT=0, `# tests 1278 # pass 1278 # fail 0`, and chrome, firefox and
      e2e-chromium each "verified 22 files";
    - the structure audit passed after regenerating `docs/working/README.md`.
  - Not yet run: the root `pnpm check`, the e2e overlay spec, and a full Lab run.
- **Next (round 2).** The coordinator relayed these layout directions, and they are not built yet:
  - remove the Simple and Advanced modes (the round-1 screenshot still shows the Simple cards above the chat);
  - chat and automations tabs, with a gear for configuration and a link to the Core panel;
  - a getting-started screen when disconnected;
  - internal reads never shown as steps;
  - human wording instead of tool ids ("Using core.run_node");
  - screenshots of every state, including the Core panel's chat.

- **Round 2, reconciled with dev (2026-09-30, lead, after the shutdown).** The round-2 workers' reports
  (`t191-shell.md`, `t191-chat-2.md`, `t191-wording.md`, `t191-core-wording.md`, `t191-thread-load.md`,
  `t191-overlay-2.md`) record the work in the WIP commits (downstream 47ba62dc, Core f9252172): the modes and split
  are gone, the chat fills the panel, Chat and Automations tabs, the gear, getting-started, human wording in Core and
  the extension, quiet read retries, and overlay placement and legibility.
  - Merge conflicts, both sides kept:
    - `pacer.test.ts` and `overlay-view.test.ts`: both sides' new tests kept. Dev's overlay test read `view.settled`,
      which round 2 renamed `fades` (inverse sense), so it now asserts `fades === false`. Dev's pacer test expected the
      headline "Waiting for you"; round 2's headline for Core's waiting state is "Waiting for you: answer in the
      FluxIQ panel", which stays, because Continue and Stop are pressed in the panel.
    - `panel/chat/header/header-model.ts` and its test: deleted on our side (the chat has no header). Dev's intent,
      show what Core asked while the work waits for the person, moved to the chat's live line:
      `view/live-line-model.ts` now stays up with `waiting: true` when the display's outcome is `waiting`, and
      `live-line.ts` marks `data-state="waiting"` (amber dot, no pulse or shimmer, in `chat.css`). Tested in
      `chat/tests/in-place-updates.test.ts`.
  - Core's `dist` in `fxwork/t191/!FluxIQ` was stale against the merged contracts (`FluxIQClientGatewayOpenError`,
    `effect`, `retryAfterMs`); rebuilt with `node scripts/build-cache/cli.mjs contracts:build fluxiq:build
    client-gateway-websocket:build` -> exit 0.
  - Ready to commit: the four resolved conflict paths (staged), `apps/extension/src/panel/chat/{chat.css,
    view/live-line-model.ts, view/live-line.ts, tests/in-place-updates.test.ts, view/tests/thread-view.test.ts}`;
    validation: `heavy.sh "t191 ext check+test+build"` (label t191-r2) -> `check=0 test=0 build=0`,
    `# tests 1480 # pass 1480 # fail 0`, chrome, firefox and e2e-chromium each "verified 22 files".

- **Round 2 finish and round 3, the per-step chat (2026-09-30, lead).** Workers W1-W4 (round 2 leftovers) and WA-WC
  (the user's per-step chat direction). Each worker report is under `reports/t191-r2-*` and `reports/t191-r3-*`.
  - W1, Core `storage/project/database.ts`: the lease race behind "Couldn't load the conversation." mid-build. `acquire`
    re-checks that its entry is still current after the await and counts the lease with no await in between. A new
    race test failed before the fix ("... project.race is closed.") and passes after it.
  - W2, the Core panel: the dock is titled by name, never by UUID; the Refresh text button is gone; the composer is
    rebuilt; the Projects page has one search box. The lead wired `projectName={activeProject.name}` into
    `live/components/AutomationStudioSession.tsx`, and made `.sr-only` share the global `.visually-hidden` rule
    (`app/styles/global-foundation/09-panels-and-pagination.css`). It was defined nowhere, so the search labels showed
    visibly in the sidebar, problems and router views.
  - W3, the extension `panel/{recording,automations,shell}`: record, extract and automation controls are keyed on the
    paced `display.working`, with a 400 ms on and 1,200 ms off hold (`shell/working-hold.ts`). Twenty `runtime.state`
    flips change each control once each way.
  - W4, the extension `panel/chat`: a waiting unit of work always shows. When its question is in a thread not on
    screen, a "Show the question" button opens that thread.
  - WA, Core runtime: the model's required per-decision `summary` is kept, held in a WeakMap against the decision so it
    never enters decision rows, traces or the model's context. Emission sites:
    - `activity/observer.ts` emits a decide-end `thought` (phase exploring, building or verifying; the human action;
      the reason in `detail.text`);
    - repairs (`graph-run.ts`, `annotate.ts`, `refuted-result/repair.ts`) emit a `thought`;
    - the result check (`result-verification/check-activity.ts`) emits a `check`.

    Reasons are screened for token-shaped text and bounded (`activity/wording/reason-text.ts`). The summary prompt
    asks for one plain sentence (`llm/deepseek/system-prompt.ts`).
  - WB, the extension: every thought, check and repair is its own assistant message. It shows the action in bold, the
    reason, and a quiet outcome line. Folds, disclosures and step counts are deleted.
    `background/activity/unit-history.ts` keeps up to 500 events for each of the last 10 units, so the messages outlive
    the hub's 60-event window and stay after the work settles. `docs/architecture/extension-client.md` is updated.
  - WC, the Core panel: the same per-step messages and the same client-side unit history; `ConversationActivityBlock`
    is deleted.
  - **Decision for the supervisor (D9, supersedes part of D4).** Activity now carries the model's own words about the
    page, as the user directed. It is bounded and screened, but no longer content-free. The contract comment in
    `packages/contracts/src/client-gateway.ts` says so, and the wire shape is unchanged.
  - Ready to commit:
    - downstream: every path in `git status` under `apps/extension/src/{background/activity, shared/activity, panel}`,
      `docs/architecture/extension-client.md` and `docs/working/live-activity-chat-plan/reports/`. Stage with
      `git add -A`: `step-filter.ts` was renamed to `shared/activity/internal-step.ts`, and the lead ran `git add -N`.
    - Core: every path in `git status` under `packages/fluxiq/src/programs/automation-studio/{runtime,storage}`,
      `packages/contracts/src/client-gateway.ts` and `apps/web/src/{features/automation-studio, app/styles}`.
  - Validation:
    - `heavy.sh "t191 verify wb"` (extension check, test and build) -> `check=0 test=0 build=0`,
      `# tests 1502 # pass 1502 # fail 0`, and chrome, firefox and e2e-chromium each "verified 22 files";
    - repository `node scripts/structure-audit.mjs` -> `passed (129 warning(s), 120 baselined)`;
    - `heavy.sh "t191 verify wa"`: vitest over runtime/{activity, result-verification, recovery/refuted-result,
      recovery/annotation, executor} -> `51 passed (51)`, `622 passed (622)`, and `pnpm --filter fluxiq check` ->
      `check=0`;
    - `vitest run storage/project/tests/database.test.ts` -> 4 passed;
    - `heavy.sh "t191 verify wc"`: web `tsc --noEmit` -> 0, and vitest over conversation plus ProjectBrowser (with
      core-contract excluded) -> 186 passed, 1 failed;
    - Core `structure-audit` -> `passed (200 warning(s), 354 baselined)`.
  - Known failures that are not this lane's:
    - `conversation/capabilities/tests/registry.test.ts` "pins the classes": Core dev 25c8b32f added `send_or_publish`,
      and t191 never touched `capabilities/`;
    - `core-contract.test.ts` timed out at 30 s in one run and passed 60/60 in WC's run;
    - `permission.test.ts` "goes ahead with nothing permitted": WA reversed its patch, and the test failed the same way.
  - Not verified:
    - Every browser screenshot. The user stopped all Labs, and the defect screenshots of round 2 predate this work.
    - Real Core events end to end, and whether DeepSeek follows the new summary sentence.

- **Supervisor's screenshot defects 1-9: the fix for each.** Each fix is unit-tested. None has been re-shot in a
  browser, because the user stopped all Labs; the live lanes' UI reviews will show them.
  1. The Simple/Advanced toggle: the modes are deleted (`t191-shell.md`), and the Lab now leaves settings through the
     Chat tab (`demo-workspace/browser-session.ts:255`).
  2. The half split with status cards: the cards are gone. The chat is one full-height screen under a top bar with the
     Chat and Automations tabs, the gear and Open FluxIQ (`panel/shell/`).
  3. Contradictory status: the only status left is the paced display. It drives both the chat's live line and the
     overlay, and the controls hold it (W3), so there is no second source to disagree.
  4. "Couldn't load the conversation.": quiet retries, with a named notice only after about 6 s of failures
     (`t191-thread-load.md`). The real-Core cause, the project-database lease race, is fixed (W1).
  5. Raw "Using core.run_node: ..." wording: human wording in Core (`activity/wording/`) and in the extension
     (`shared/activity/wording.ts`, `stream/step/words.ts`). Tests assert that no dotted id appears.
  6. The unlabelled "Page | Full | Small | Off" control: it now lives in Settings as "Status on the page", with a
     one-line explanation (`shell-settings-light.png`).
  7. The pill covering the cookie banner: it now avoids fixed and sticky layers and dialogs, and becomes a dot when
     every corner is busy (`content/activity-overlay/placement/`, `overlay2-01`, `overlay2-08b`).
  8. The tiny, low-contrast pill: larger type and stronger contrast on light and dark pages (`overlay2-05`,
     `overlay2-06`).
  9. The false "Add an AI model key: To do": the Simple checklist is deleted, and a test pins that the panel has no
     model-key step.

## The user's verdict on t185, after watching live runs (2026-09-29)

1. The extension's UI is "not at all like chatgpt styled chat area".
2. The status overlay does not appear on the site, or appears only in a state they could not see.
3. The status bar "flickers constantly and looks bad".

## Evidence found before dispatch

- In t174's live run `run-munmmj5n-52d8a67d` (crossborder-marketplace, a real build), `snapshots/live-panel.json`
  recorded `{"mode":"side-panel"}`. The panel opened, so the chat and its header were on screen.
- That run's `logs/core.log` holds 259 `[FluxIQ build-trace]` lines with timestamps. They are real build events:
  - `decide start`/`end`;
  - `tool start`/`end`, with the tool id and result code;
  - `completion check`.

  Each maps one-to-one onto the Core activity observer's emissions:
  - `thinking` on decide;
  - `exploring` or `building` on a tool start and end;
  - `verifying` on the completion check.

  The build ran about 200 s and made 62 decisions and 46 tool calls. That is about 160 status changes, and one
  decision cycle flips the label thinking -> exploring -> exploring (end) -> thinking within one or two seconds.
  This is the flicker's input. The measurement fixture is built from these lines.

## Contract seeded by the lead

- `shared/activity/activity-display.ts`: `ActivityDisplay`, the paced status. It has:
  - `headline`, stable for the whole unit of work;
  - `detail`, Core's latest sentence at a readable pace;
  - `phase`, `step`, `working`, `outcome` and `sequence`.
- `ExtensionActivityState.display` and `ActivityContentMessage.display` carry it. The existing sites set `null`,
  which the workers replace.
- The overlay and the chat header render `display` only. The chat stream still reads `recent`, which holds every
  event.
