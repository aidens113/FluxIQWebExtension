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

- **Round 4, action cards with icons (2026-09-30, lead).** The user said: "regarding actions in the chat, it should
  show proper cards with icons", reusing "the same card/icon styles as defined by the importing repo or core". The
  dev merge needed nothing: both branches were fast-forwarded to 1b2c6d79 and Core 2ee48b69.
  - **Defined once** (WS, `t191-r4-ws-action-kinds.md`): Core `packages/fluxiq/src/ui/activity-action/` holds
    everything both surfaces import from `fluxiq/ui`:
    - the `ActivityActionKind` values: click, type, navigate, read, look, wait, person_check, permission, draft, test,
      repair and other;
    - `ACTIVITY_ACTION_ICONS` (lucide names) and `ACTIVITY_ACTION_NAMES`;
    - `activityActionOf(event)`, which returns `{kind, target, outcome, why}` using Core's tool ids and generic verbs
      only.

    Core's activity wording now uses the same verb table. The lead added `packages/fluxiq/src/ui/index.ts` to Core's
    `scripts/structure-audit/config.mjs` `browserBundles.entries`, so the audit keeps it browser-safe.
  - **Extension** (WE, `t191-r4-we-extension-cards.md`):
    - each reasoning message carries the cards for the actions it led to;
    - a card shows the lucide icon in a round mark tinted by outcome, the kind name and target, and the outcome in
      words ("Done", "Didn't work: it wasn't on the page", "Waiting for you");
    - the cards use the panel tokens and the getting-started step layout;
    - the icons come from one module, `panel/icons/`, holding lucide path data under the ISC licence.
  - **Core panel** (WW, `t191-r4-ww-core-panel-cards.md`): the same cards through `lucide-react` (one lookup keyed by
    kind), `fluxiqStatusTone` and existing tokens, in `components/action-card/`.
  - Differences left open:
    - once the work moves past a robot-check or permission card, the extension shows no outcome (Core sends no
      "answered" event), while the Core panel marks it Done;
    - the Core panel can show a robot check as two cards (the ask and the tool);
    - "Step N" is no longer shown on run steps on either surface.
  - Ready to commit:
    - downstream: every `git status` path under `apps/extension/src/panel/{chat,icons}`,
      `docs/architecture/extension-client.md` and this report folder. Use `git add -A`, because WE staged the deletion
      of `stream/step/outcome.ts`.
    - Core: every `git status` path under `packages/fluxiq/src/{ui,programs/automation-studio/runtime/activity/wording}`,
      `scripts/structure-audit/config.mjs` and `apps/web/src/features/automation-studio/{conversation,styles/conversation}`.
  - Validation:
    - `heavy.sh "t191 verify we"` -> `check=0 test=0 build=0`, `# tests 1624 # pass 1624 # fail 0`. The build was
      restored from the build cache's stamp ("inputs and outputs match the stamp"); WE's run of the same inputs printed
      "verified 22 files" for chrome, firefox and e2e-chromium. Chrome and Firefox side-panel and popup bundles contain
      the card code;
    - repository structure audit -> `passed (133 warning(s), 120 baselined)`;
    - `heavy.sh "t191 verify ww"`:
      - web `tsc` -> 0;
      - vitest over conversation and styles, without core-contract -> `28 passed (28)`, `205 passed (205)`;
      - fluxiq vitest over `src/ui` and `runtime/activity` -> `16 passed (16)`, `176 passed (176)`;
    - Core structure audit -> `passed (202 warning(s), 354 baselined)`.
  - Not verified:
    - No screenshots. Neither repository has a jsdom or Storybook render harness, and a Playwright render of the
      panel would be a browser run outside the ten scenarios while Labs are stopped.
    - Real Core events.

- **Round 5: both chats settle a wait from one Core event (2026-09-30, lead).** Dev was merged by the supervisor
  (downstream 5f665174, Core 9653b7dd), with nothing to resolve.
  - **Core** (WR, `t191-r5-wr-resolved-asks.md`):
    - `ClientGatewayActivity.detail` gains optional `resolution` (`CLIENT_GATEWAY_ACTIVITY_RESOLUTIONS`: waited_out,
      answered, allowed, declined, timed_out, cancelled). It is re-exported by client-gateway-websocket, bounded to ask
      rows in `activity/bounded.ts`, and restated in Core web's `activity/contracts.ts`.
    - Every announced wait gets a waiting row and a resolved row with the same `ref` (the ask id) and title, emitted
      from `runtime/activity/ask/` and at its call sites: `executor/graph-run.ts`, `executor/resume.ts`,
      `flow-bootstrap/person-needed.ts`, `flow-bootstrap/action-permissions.ts`, `recovery/runtime-exploration.ts`.
    - The lead asked for `cancelled`: when the work stops, fails, or loses its thread before an answer, the row is
      failed, "The work stopped before this was answered." No card is left waiting after its wait ended.
    - `fluxiq/ui`: `activityActionOf` takes an ask's outcome from `resolution` only, and the new `activityActionKey`
      gives one key per ask.
    - Core panel: the "work moved on, so it's Done" inference is removed, and a check's intervention tool event and
      its ask fold into one card, whichever comes first.
  - **Extension** (WX, `t191-r5-wx-extension-resolved.md`): ask cards are keyed by `activityActionKey` and updated in
    place from the resolved row ("Done. You pressed Continue.", "Didn't work: you pressed Stop"). The forced
    ask-to-waiting rule is removed, and one check is one card, with the same rule as the Core panel.
  - **Lead edits, so the surfaces agree.**
    - `stream/step/card-words.ts`: a waiting card says "Waiting for you" until Core's resolved row, even after its unit
      ends. It previously went blank, which inferred the end from the work moving on. Two tests were updated to match.
    - `stream/step/messages.ts`: an ask's card goes under the reasoning message before it, as tool cards do and as the
      Core panel does; it is its own message only when no reasoning came first. A new test in
      `stream/step/tests/messages.test.ts` also pins `cancelled` to failed, "the work stopped first".
    - CRLF line endings in `chat-panel.ts` and `view/step-message-view.ts` normalised to LF.
  - Ready to commit:
    - downstream: every `git status` path under `apps/extension/src/panel/chat/**`,
      `docs/architecture/extension-client.md` and this report folder;
    - Core: every `git status` path under `packages/contracts/src/client-gateway.ts`, `packages/client-gateway-websocket/src`,
      `packages/fluxiq/src/{ui, programs/automation-studio/runtime}`, `packages/fluxiq/docs/reference`,
      `docs/reference` and `apps/web/src/features/automation-studio/conversation/**`.
  - Validation (lead's runs):
    - `heavy.sh "t191 r5 ext check+test+build"` -> `check=0 test=0 build=0`, `# tests 1633 # pass 1633 # fail 0`,
      chrome, firefox and e2e-chromium each "verified 22 files" (a fresh build, "inputs changed");
    - repository structure audit -> passed;
    - `heavy.sh "t191 verify wr"`:
      - fluxiq vitest over `src/ui` and runtime/{activity, executor, flow-bootstrap, recovery, parking} -> `126 passed
        (126)`, `1856 passed (1856)`;
      - `pnpm --filter fluxiq check` -> 0;
      - `pnpm --filter @fluxiq/contracts test` -> 9 files, 55 passed;
      - web `tsc` -> 0, and web conversation vitest -> `26 passed (26)`, `261 passed (261)`.
  - Core structure audit FAIL, not this lane's: `runtime/llm/evidence-loop/` has 26 files against a limit of 25. This
    tree has no edits there; HEAD's copy came from dev's t196 merge (957a0226). Current dev has regrouped the
    directory to 20 files (t200, t208; dev is 11 commits ahead), so the next dev merge clears it.
  - Not verified:
    - Browser rendering and real Core events.
    - `waited_out` is never emitted, because Core never sees a check clear by itself after announcing a wait.
    - A durably parked run that is abandoned keeps its wait open.

- **Round 6: `waited_out` emitted, and cancelled parked runs settled (2026-09-30, lead).**
  - Dev merge into Core (started by the supervisor): only the two generated `framework-reference.md` copies
    conflicted. They were regenerated with `pnpm docs:reference` (never hand-merged) and staged; `pnpm docs:check` ->
    "Deterministic framework reference is current". The merge is left for the supervisor to commit. Downstream merged
    clean (0b03eae3).
  - **Cleared check, carried end to end** (WD and WD2 in `t191-r6-wd-cleared-wait.md`; WC and WC3 in
    `t191-r6-wc-waits-settled.md`):
    - the extension's `LandedCheckWait.waitedMs` was previously turned into prose only. It is now
      `BrowserActionResult.checkWait`, for click and navigate, when the check cleared by itself, and travels in the
      gateway payload;
    - the domain puts it on the evidence-loop tool execution as `clearedWait: { waitedMs }` and adds it to
      `WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS`;
    - for Flow runs, the domain lifts it onto Core's generic `OutputDispatchResult.clearedWait` (`fluxiq`) and
      `FluxIQRuntimeCommandResult.clearedWait` (`fluxiq/runtime`), in `io/gateway-output-dispatcher.ts` and
      `runtime/adapter.ts`;
    - Core reads it defensively and emits a person_check waiting row followed by a resolved `waited_out` row, "The
      check cleared on its own after N s.". Builds emit it in `activity/observer.ts` and runs in
      `executor/node-execution.ts`, inside the run's scope (`activity/ask/{waited-out, cleared-wait, cleared-text}.ts`).
      Core never reads web shapes.
  - **Cancelled parked run** (WC): `cancelRuntimeSession` (`service.ts`, through `service/runtime-session/parked-wait.ts`)
    emits the parked ask's resolved row with `cancelled` and the same ref, inside a run activity scope. A negative
    control (the call removed) fails its test.
    - Other paths: nothing expires a parked run past `expiresAtMs`, and `resume.ts` already emits `timed_out`.
    - No run discard or supersede exists; a parked run blocks a newer one rather than being replaced.
    - `deleteProject` removes parked runs unsettled; the project's chat goes with them.
  - Ready to commit:
    - downstream: every `git status` path under `apps/extension/src/runtime/**`, `domain/src/{actions, client, io,
      runtime}/**`, `docs/architecture/{extension-client, failure-taxonomy}.md` and this report folder;
    - Core: every unstaged path under `packages/fluxiq/src/{io, runtime, programs/automation-studio}`, and both
      `framework-reference.md` copies, which were regenerated again after the staged merge resolution and are current.
  - Validation (lead's runs):
    - `heavy.sh "t191 r6 downstream verify"` -> extension `check=0 test=0 build=0`, `# tests 1673 # pass 1673
      # fail 0`, chrome, firefox and e2e-chromium each "verified 22 files" (a fresh build); domain `# tests 1057 # pass
      1057 # fail 0`; repository structure audit passed;
    - `heavy.sh "t191 r6 core verify"`:
      - fluxiq vitest over `src/ui`, runtime/{activity, executor, service/runtime-session}, `cancel-parked-run` and
        `io-policy` -> `51 passed (51)`, `593 passed (593)`;
      - `tests/service-flows` with one worker and a 60 s timeout -> `14 passed (14)`, `63 passed (63)`. WC's wider run
        had 11 of these time out at the 15 s default with more workers;
      - `pnpm --filter fluxiq check` -> 0;
      - `pnpm docs:check` -> current;
    - Core structure audit -> `passed (203 warning(s), 354 baselined)`. The evidence-loop failure was cleared by the
      dev merge.
  - Not verified:
    - Browser rendering and real Core or extension events end to end.
    - A cleared check followed by a failed navigation or a refused click carries no `clearedWait`, so its card does
      not close as cleared on its own.
    - The transport-client runtime path does not read `clearedWait`.

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
