# E4: Take over / Hand back in the chat, and the chat showing a followed run

## Outcome

Done. Nothing committed.

## What changed and why

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t376/!FluxIQWebExtension`. Every path below is under `apps/extension/src/`.

- **New `panel/chat/hold-control.ts`** (`createHoldControl(request, eligible)`). It is built like `stop-control.ts`: an owner lease (`generation`) is checked again when the reply comes back, a press is disabled while it is in flight, the status line is polite, and `eligible()` is checked at click time.
  - While a run works (`subject.kind === "run"`, not final, not done or failed, not `waiting_permission`), it shows a button named exactly **Take over**. Pressing it sends `{type: panelTakeOverRun, projectId, runId: subject.id}`.
  - While the run is held (phase `paused`), it shows "You have the page. FluxIQ continues from step N when you hand back." (N is `step.index`; "from step N" is left out when there is no step) and a button named exactly **Hand back**, which sends `panelHandBackRun`. Stop stays visible beside it, because the Stop control already treats `paused` as active.
  - Builds never show this control.
  - An in-flight press says "Taking over…" or "Handing back…" and stays disabled until Core's activity moves: to `paused` for a take-over, or out of `paused` for a hand-back. One press is never sent twice.
  - A failure (the relay fails, the reply has `ok:false`, or the request throws) says "Couldn't take over. Try again." or "Couldn't hand back. Try again." and the button can be pressed again.
  - A reply for an older run, or for an owner that is no longer eligible, changes nothing.
- **New `panel/chat/stream/run-target.ts`** (`followedRunTarget`, `threadKey`), a pure retarget rule. It decides "does this chat show the run?" by asking `activityForTarget` about the run's own event, so the two can never disagree.
  - If the thread on screen already shows the run, it returns null and the person stays where they are.
  - A run with no `conversationId` (started from the strip, or over the API) opens the Flow's automation thread when the chat knows the Flow's name. Otherwise it opens the latest chat. I checked that both of these show such a run.
  - A run with a `conversationId` (started from some chat) shows only in that thread. The rule opens the latest chat or the automation chat only when this chat has read that thread before and its id is the run's `conversationId`. Otherwise it opens the run's own thread: a `question` target with `subjectKind: "run"` and the title "Run of <name>" or "This run". `activityForTarget` always shows a run's own events there, and Core asks any question the run has in that thread.
  - Stream barrel exports were added.
- **`panel/chat/chat-panel.ts`**:
  - The dock is now `[.chat-run-controls (hold control, Stop), composer]`. The hold control gets the same project-scoped raw activity as Stop.
  - New `ChatPanel.followRun(run)`. It holds the run as pending. On every render the chat then tries to open the target from `followedRunTarget`.
  - It waits while the composer textarea has focus and holds text, and while the thread on screen has not been read yet (`mode === "loading"`).
  - It drops the pending run if the run ends, a recording is running or paused, or the chat no longer owns its context.
  - Learned conversation ids are kept per `threadKey`, and automation names per flowId taken from the targets it opens. Both are cleared when the owner resets. The header comment was updated.
- **`panel/chat/chat.css`**: styles for `.chat-run-controls` and `.chat-hold*`. The row is centred and wraps, the sentence sits on its own full-width line, and the buttons match the Stop pill, so everything fits a 380 px popup.
- **`panel/chat/index.ts`**: exports `createHoldControl`, `followedRunTarget` and `RunTargetInput`.
- **`panel/shell/mount-panel.ts`**: when `runFollow.observe` says to follow, the shell switches to Chat and then calls `chat.followRun(feed.state.current)`. The header comment was updated. `run-follow.ts` is unchanged, because its rule still decides when to switch tabs.

**Retarget choice:**
1. Keep the chat on screen if it already shows the run.
2. Otherwise prefer the Flow's automation thread (when the name is known and that thread shows the run).
3. Otherwise use the latest chat (when it is checked to show the run).
4. Otherwise open the run's own thread.

It never retargets while the person types a message, and never during a recording. Drafts are stored per owner and project, not per thread (`conversation/draft-storage.ts`, `project-navigation/draft-owner.ts`), so a retarget keeps the text in the box. The tests assert that.

## Commands run and observed results

- Subset test runner, using the esbuild options from `scripts/test-extension.mjs` with label dir `.test-build-scratch/e4-take-over`, over every `tests/` directory under `panel/chat/**` and `panel/shell/`:
  - `node <scratchpad>/e4-run-tests.mjs <ext> <12 test dirs>` printed `# tests 369 # pass 369 # fail 0` before the two shell tests were added.
  - The shell tests on their own then printed `# tests 57 # pass 57 # fail 0`.
- Probe: I commented out the `chat.followRun` call in `mount-panel.ts` and the new shell test failed (`not ok 18 … # fail 1`). I restored the line afterwards.
- `pnpm --filter @fluxiq-web-extension/extension build`: it exited 0, with "chrome: verified 22 files", "firefox: verified 22 files" and "e2e-chromium: verified 22 files".
- `npx tsc -p tsconfig.test.json --noEmit` (in `apps/extension`): 0 errors.
- `node scripts/structure-audit.mjs`: one FAIL, `[working-docs] docs/working/README.md is out of date`, which was already there before this work. No other FAIL.

## New tests

- `panel/chat/tests/hold-control.test.ts` (5 tests):
  - shown only for runs while they work
  - sends the run id
  - held sentence with Hand back
  - sentence without a step
  - in-flight and failure states
  - a stale owner or an older run is ignored
- `panel/chat/stream/tests/run-target.test.ts` (4 tests): the retarget rule.
- `panel/chat/tests/chat-run-controls.test.ts` (6 tests), the chat-panel wiring:
  - Take over beside Stop
  - the held state through the dock
  - a build never shows Take over
  - automation, latest and own-thread retargets, including the latest chat verified through its read conversation id
  - waits while typing, keeps the draft
  - a recording blocks the retarget
- `panel/shell/tests/mount-panel-navigation.test.ts`: 2 tests added, for a followed run of another Flow (moves to the latest chat) and a run of the Flow on screen (kept).

## Not verified

- Not checked in a live browser: the Take over and Hand back round trip against Core, the held sentence when a real `paused` event arrives, and the layout at 380 px in the Firefox popup. The CSS was only reasoned about.
- `pnpm check` and the full `pnpm test` were not run, per the policy that full suites run at most twice a day.

## Open questions or contradictions found

- The design says "the live line shows Take over". I put the control in the dock beside Stop, as the brief says, and did not touch `view/live-line*.ts`.
- When a `paused` event comes from a non-person pause (Core label "Paused"), it also shows "You have the page…" with Hand back. The brief defines "held" as phase `paused`, and the activity contract has no `byPerson` field, so the chat cannot tell the two apart.
- A run started from a FluxIQ-web chat thread this panel has never read opens the run's own thread, not the latest chat. Without reading, the panel cannot check which thread that is.
- Flow names come only from automation targets the chat has opened, because the automations controller exposes no lookup and `panel/automations/**` is not mine to edit. A run of a Flow the person has never opened in this session goes to the latest chat (or its own thread).
