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
