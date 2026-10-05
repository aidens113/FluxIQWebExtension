# t265 extension UI integration — lead report

Status: In progress
Tree: `C:/Users/osrs_/FluxStuff/fxwork/t265/!FluxIQWebExtension` (branch `task/t265-extension-ui-integration`, at `bdda64b1`; Core sibling at `1fbfa5ef`, built and current).
Baseline: `pnpm.cmd --filter @fluxiq-web-extension/extension check` in t265 before any edit -> exit 0 (2m33s).

## Sources

Lane trees (read-only, base `45bd6232`): t174 (A9), t193 (F7, F9), t194 (w83, w76 pacer part), t195 (D2).
Of the files this unit touches, t262 changed only `panel/chat/conversation/{composer,controller}.ts` (scoped chat: `scopeState`, parked `readOnly`); every other lane hunk applies to files equal to the lanes' base.

## Decisions

1. **One clear-on-send: C w83's design (t194), with one hardening from A9.**
   - Composer: the words leave the box the moment they are sent; a failed send puts them back only if the box is still untouched (no newer typing, fill, or owner change). F7 (t193) and w83 (t194) chose this rule independently. A9 (t174) instead prepended the failed words to anything typed since, which merges two messages into one draft.
   - The composer's own send-error notice goes; the failed message stays in the thread as the person's turn, with the send error shown on it (w83: `core-thread.ts`, `thread-view.ts`, `message-view.ts`, `chat.css`). A9 removed the failed message from the thread and left the error in the composer, so the person loses where the message went.
   - The local turn is replaced by Core's once a read holds a person turn that was not there at send (w83). Hardening from A9: after a successful send's refresh whose read succeeded, the local turn is dropped, so it can never linger when Core's turn is not recognised.
   - Kept from t262: the scoped-chat `scopeState` gating of send/answer and the composer's scope placeholders and parked `readOnly`.
2. **`status-dwell.ts` is deleted (A9), and B's overlay-lag fix agrees.** A9 makes the background pacer the one pace (interval 1.2 s -> 1.6 s, so any 3 s shows at most two changes) and the overlay draws each display as it arrives, which removes the up-to-a-second lag between overlay and panel. B's lag fix lived in two places: the pacer (a model thought neither starts the interval nor displaces a waiting action; display marked `kind: "thought"`) and the overlay (a thought display keeps the action line already up, so it cannot occupy the dwell). Without the dwell the second cause is gone; both B parts are kept, the overlay part as `model-prose.ts`/`actionOnly`.
3. **Deferred to after t264 S2 (Core A5/F6/w80/w81):** A9's `wording.ts` hunk that imports `activityActionFailureReason` from `fluxiq/ui` (not exported on Core `dev`; Core lane A's `ui/activity-action/index.ts` adds it) and the test expectations that depend on it (`shared/activity/tests/wording.test.ts` replay-reason lines, `stream/step/tests/card-words.test.ts`, `view/tests/action-card-view.test.ts` replay line); t194's `card-words.ts` `lowerFirst` and its `action-card-view.test.ts` refusal line (w80/w81). `card-words.ts` and `action-card.ts` are left to t264 S2.

## Worker briefs

All: tree above, LF line endings, never touch lane trees or `fxwork/t262`, no commits, no Lab/browser/provider call. Lane change to a file: `git -C C:/Users/osrs_/FluxStuff/fxwork/<lane>/!FluxIQWebExtension diff -- <path>` (+ untracked files). Tests: `node <scratchpad>/t262-gate/run-subset.mjs apps/extension <label> <files>` from the tree root, then `node --test` on the printed bundles.

- **t265-background** (worker-high): owns `apps/extension/src/background/activity/**`, `background/panel/**`, `background/connection.ts`, `shared/activity/**`. A9 (pacer, headline, wording, activity-display, minus the deferred hunk), F9 (send-start, send-answer, activity-relay, index, panel-control, connection, model-thought, display `kind`, pacer thoughts), w76/w83 pacer + unit-situation (hold the meaningful line while deciding; drop the step count during a Flow repair), D2 headline + `headline.test.ts`. Report: `reports/t265/background.md`.
- **t265-panel-chat** (worker): owns `apps/extension/src/panel/chat/**` except `stream/step/{card-words,action-card}.ts` and `stream/step/tests/card-words.test.ts`, `view/tests/action-card-view.test.ts`. Decision 1 in composer/controller/core-thread/thread-view/message-view/chat.css; A9 scroll-follower; tests. Report: `reports/t265/panel-chat.md`.
- **t265-overlay** (worker, after background): owns `apps/extension/src/content/activity-overlay/**`, `docs/architecture/extension-client.md`. A9 dwell removal, F7 overlay (model prose, placement over media, status pill, content-message `kind`); the doc for every unit as landed. Report: `reports/t265/overlay.md`.

## Progress

(filled as work lands)
