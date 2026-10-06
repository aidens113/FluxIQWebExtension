# t193-1003-w11: overlay from the send, display kind, and docs (worker report)

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t193/!FluxIQWebExtension`. X = `apps/extension/src`.

## Outcome

Done, with one ownership stretch that needs the supervisor's approval. To put
the start where the send already passes, I edited three background wiring
files that the brief did not list: `X/background/panel/panel-control.ts`,
`X/background/panel/panel-control-deps.ts` and `X/background/connection.ts`.
I also added one test to `X/background/panel/tests/panel-control.test.ts`.
Each change is a few lines and is described below. Without them, no route
reaches `ActivityRelay` from the send.

## What changed and why

**Task 1, D14: the starting status from the send.**
- New `X/background/activity/send-start.ts` (`SendStart`, `STARTING_HEADLINE = "Starting…"`, `STARTING_HOLD_MS = 20_000`). It holds an override of the pacer's display:
  - `putUp(shown)`: puts up `{headline "Starting…", working: true, detail: null, kind: "starting", activityId "starting:N", sequence 0}`, unless the shown display is working or waiting on the person.
  - `takeDown(display)`: only if that display is still up. Afterwards no display is shown, and an earlier "Flow ready" or "Build failed" is not redrawn.
  - `coreSpoke()`: called on any accepted Core event, which replaces the override.
  - A hold timer takes the status down after 20 s if Core said it started but no activity came.
- New `X/background/activity/send-answer.ts` (`sendStartedWork`): true only when `{ok: true, payload.response.execution.status === "started"}`. That is Core's `AutomationStudioConversationCommandExecution`, which I read in Core's `api/handlers/conversations.ts` and `commands/start.ts`; I changed nothing in Core. The answer is read by shape. A failed send, words only, `done` or `failed` are not a start.
- `activity-relay.ts`:
  - New `sending(send)`. It starts the send at once. If `deps.live()`, it awaits the stored overlay preference and puts the start up. It awaits the answer and hands it back unchanged, a rejection too. It takes the status down on a throw or a non-start answer.
  - `accept()` calls `start.coreSpoke()` and redraws when it replaced the override.
  - Every display read (state, content message, contentReady answer) now goes through the private `display()`, so the panels and the page agree.
- Wiring, outside the owned list:
  - `panel-control.ts`: `PanelControlDeps.activity.sending?` is optional. A `panelConversationSend` that is not `kind: "open"` runs as `deps.activity.sending(() => relayConversation(...))`. The control-page refusal still comes first.
  - `panel-control-deps.ts`: `sending: (send) => connection.activitySending(send)`.
  - `connection.ts`: a one-line `activitySending` method that delegates to the relay.
- Side effects in the panel (no panel file changed):
  - While the start is up, `display.working` is true. The chat live line therefore reads "Starting…" instead of "Sending your message", and `working-input.ts` treats FluxIQ as working.
  - "Sending your message" remains when no session is live.

**Task 2, D6 and the w7 residual: a display-level kind.**
- `X/shared/activity/activity-display.ts`: optional `kind?: "action" | "thought" | "starting"`. It is optional so the panel test literals I may not touch still compile; absent reads as `action`.
- New `X/shared/activity/model-thought.ts` (`isModelThought`), exported from the barrel. A thought is a `thought` row with non-blank text, unless its title is Core's own "Deciding the next step". That exception keeps Core's provider-outage sentence ("The AI model provider did not answer…") as status, which an existing pacer test relies on.
- `pacer.ts`:
  - A thought goes to `acceptThought`. It keeps the detail, phase and step of the waiting action, or of the shown display, for the same unit; it takes headline, working and outcome from the event; and it sets `kind: "thought"`.
  - A headline or outcome change still shows at once, carrying the waiting action.
  - Otherwise the thought is folded in quietly. It never resets `detailChangedAt` and never displaces a pending action.
  - Every other display gets `kind: "action"`.
- `X/content/activity-overlay/model-prose.ts`: `isModelProse(display)` now keys on `display.kind === "thought"` instead of matching the raw `activity`. `overlay.ts` was updated to match.
- `content-message.ts` accepts only the three kinds, or none.

**Task 3, docs.**
- `docs/architecture/extension-client.md`:
  - New relay bullet on the starting status.
  - Pacer bullets on thoughts and on `kind`.
  - The overlay paragraph now says what it shows (phase plus current action, never thoughts, on the page from the send).
  - "Where it sits": content in the probe, least content among clear corners, and docked corners for w7 D5.
  - Live line bullet: Starting… or Sending.
  - The composer paragraph and the draft paragraph now say the box clears on send and how a failed send's words come back (w7 D1).
- `docs/architecture/build-loop.md`: new section "A Layer The Build Opened Is Not An Interruption" covering w8's rule. It includes the guard "a layer recognised by kind is never the build's own" (`own-layers/memory.ts` `recognisedByKind`: element `kind` or `isDialog.kind`, already in the tree from another worker) and the known gaps. The intro line was updated.

## Commands run and observed results

- Failing tests first, scoped runner from the brief. It matches `apps/extension/scripts/test-extension.mjs` except that it builds without sourcemaps; it needs an absolute package root (`pwd -W`).
  - Pacer, before the fix, with the two new-module test files set aside: `not ok 61`, `62`, `63` (the three new thought tests), `# tests 68 # pass 65 # fail 3`.
  - send-start, send-answer and model-thought could not be bundled before their modules existed, so they did not fail as assertions first.
  - Negative check instead: with `if (false && this.deps.live())` in `sending` and the routing branch in panel-control disabled, the result was `# tests 128 # pass 122 # fail 6`. The failures were five send-start tests and the panel-control wiring test. Both files were restored from copies afterwards (`grep -c "false &&"` gave 0 for both).
- After the change: `node scoped-test.mjs <root> t193-w11 src/background/activity/tests src/shared/activity/tests src/content/activity-overlay/tests src/background/panel/tests` gave `[scoped] 22 entries`, `# tests 185`, `# pass 185`, `# fail 0`.
- A wider run that adds `src/panel/chat/view src/panel/shell src/panel/chat/conversation/tests` gave `# tests 344 # pass 325 # fail 19`. The failures are in `panel/shell/tests/mount-panel-navigation.test.ts` and `working-owner.test.ts`, and they are not mine:
  - `src/panel/shell` alone: `43/43 pass`.
  - The same set without `background/panel/tests`: `292/292 pass`.
  - `background/panel/tests` plus `panel/shell` with panel-control.test.ts reverted to HEAD's content: `# tests 94 # pass 75 # fail 19`.
  - So this is existing cross-file interference within one process (likely `installChrome`'s global `chrome`), and my change did not cause it.
- `npx tsc -p tsconfig.json --noEmit` gave `src-exit=0`. `npx tsc -p tsconfig.test.json --noEmit` gave `test-exit=0` (apps/extension).
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (164 warning(s), 118 baselined).`, exit 0, the same warning count as w7. `connection.ts` was already warned for its method count and now has 35 methods, still under the 40 fail line. The docs-links rule is part of this audit.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t193 w11 build" pnpm --filter @fluxiq-web-extension/extension build` printed:
  - `chrome: verified 22 files`;
  - `firefox: verified 22 files`, with the existing gecko.id placeholder warning;
  - `e2e-chromium: verified 22 files`;
  - build-cache: `not stamped, because inputs changed while it ran (core:packages/fluxiq/src)`, which was the Core worker.
- All changed files have LF line endings (0 CR bytes). Scratch bundles `.test-build-scratch/t193-w11*` were removed.

## Not verified

- No live or browser run (forbidden). Not observed on a real page:
  - that "Starting…" is drawn within the send's first ~100 ms;
  - that Core's `append-turn` answer really carries `response.execution.status: "started"` for a chat build. This rests on reading Core's handler.
- If Core ever emits a build's first activity on a session that is not `live()` from the extension's view, no start is shown. That is intended.
- The 20 s hold is a guess at "long enough". The Lab trace shows about 1 s from answer to first activity.
- A dialog layer handle that has no element of its own in the look is not checked by kind in `own-layers/memory.ts` (`byHandle.get` is undefined, so it is never treated as recognised by kind). I documented the rule as the code has it and did not touch domain.
- Full suites were not run, per the narrow-checks rule.

## Open questions or contradictions found

- Ownership: the three background wiring files and the one panel-control test are outside the brief's owned list. Please confirm or reassign.
- The 19-test interference between `background/panel/tests` and `panel/shell/tests` when they share a process probably shows up in the full `pnpm test` as well. Someone should check it on the next sweep.
- The chat live line now says "Starting…" rather than "Sending your message" during a live send, because the panels share the display by design. If the panel should keep "Sending", `liveLineModel` (panel/chat/view, not mine) could key on `display.kind === "starting"`.
