# install-core-p1 (t707 round 3): the panel notices a stopped worker while pairing

## Outcome

Done. While the panel waits on the background (connecting, pairing or
reconnecting), it now re-reads the status every 3 s. That read is a runtime
message, and any message starts a stopped MV3 worker. The fresh worker answers
`disconnected` with no code, or does not answer at all. The panel then drops the
dead approval code and says "The approval code expired because the extension
restarted. Press Connect for a new code." with Connect as the button. Tests
only; not exercised live in a browser.

## Cause, confirmed from the code

- The panel learns status only from `panel/state/store.ts`. It sends one
  `getStatus` when it is created, publishes the status carried by command
  replies, and listens for `statusChanged` runtime pushes. It has no port and no
  storage listener.
- A stopped worker sends no push, so the store kept the last `pairing` status
  and its `pairingReferenceCode` indefinitely. Nothing in the panel ever sent
  another message, so nothing woke the worker.
- A worker started fresh builds a new `FluxIQConnection`. That connection is
  `disconnected` with no pairing code, and `reconnectIfPaired`
  (`background/index.ts`) skips an unpaired browser. The pairing is therefore
  gone for good, and FluxIQ withdrew its code with the session (live report,
  step 3). Pressing Cancel "fixed" the panel only because its `disconnect`
  message woke the worker, and the reply carried the fresh status.

## What changed and why

- `apps/extension/src/panel/state/background-loss.ts` (new): a pure rule. A
  wait (connecting, pairing or reconnecting) followed by a down status
  (disconnected or error), or by no answer, means the background lost the wait.
  It returns `"pairing"` or `"connecting"`.
- `apps/extension/src/panel/state/status-probe-ms.ts` (new):
  `PANEL_STATUS_PROBE_MS = 3000`.
- `apps/extension/src/panel/state/store.ts`:
  - While the status is a wait, one probe timer re-reads `getStatus`.
  - A probe's answer is dropped if a push, a command reply or a later read
    arrived while it was in flight, so a person's Disconnect pushed by a live
    worker is never taken for a loss.
  - The probe records the loss. A later status that is not down clears it.
  - A probe with no answer does not change the status (rule F1 holds). It only
    marks the loss, redraws the panel, and keeps probing.
  - The default timer is `unref`'d where the host allows it (Node), so a
    waiting store never holds a process open.
  - `createPanelStore(options?)` now returns `PanelStore & PanelStoreLoss`
    (`lost()`). `PanelStore` itself is unchanged, so the test fakes in
    settings, automations and getting-started need no edit.
- `apps/extension/src/panel/state/index.ts`: exports `backgroundLoss`,
  `BackgroundLoss`, `PANEL_STATUS_PROBE_MS`, `PanelStoreLoss` and
  `PanelStoreOptions`.
- `apps/extension/src/panel/getting-started/start-steps.ts`: `startGuide`
  takes an optional third argument, `lost`. With a loss and any non-connected
  status, the guide shows no code, marks the connect step `problem` with the
  expired or restarted line, and offers Connect. A connected status still wins.
- `apps/extension/src/panel/shell/mount-panel.ts`: passes `store.lost()` to
  `startGuide`. The popup and the side panel both mount this shell, so Chrome,
  Edge and Firefox stay aligned.
- Tests (new):
  - `panel/state/tests/background-loss.test.ts`
  - `panel/state/tests/store-probe.test.ts` (7 cases: probe cadence, lost
    pairing, no answer then recovery, still pairing, pushed Disconnect, push
    racing a probe, Connect clears the loss)
  - `panel/getting-started/tests/start-steps-lost.test.ts`

The background is unchanged (no `background/connection*` edit was needed).

## Design choice: resume or say it expired

I chose to show plainly that the code expired and offer Connect, and not to
send `connect` from the panel automatically. A panel-sent `connect` calls
`noteConnectedByPerson`. If its probe raced a Disconnect pressed in the other
surface, it would undo the person's choice. A paired browser still reconnects by
itself: the probe's `getStatus` from a control page triggers
`reconnectIfPaired`, and the panel then shows `connecting`.

## Commands run and observed results

All test commands were run from `apps/extension`.

- Fail-first, step 1:
  `EXTENSION_TEST_BUILD_LABEL=t707-p1 node scripts/test-extension.mjs panel/state panel/getting-started`
  printed `ERROR: Could not resolve "../background-loss"`.
- Fail-first, step 2 (rule and barrel added, store and guide unchanged), same
  command: `# tests 47 # pass 37 # fail 10`. Not ok: the 3 lost-guide tests and
  all 7 store-probe tests.
- First run after the fix, with a plain `setTimeout`: it hung past 300 s and I
  stopped it. A waiting store in an existing test re-armed real timers forever.
  `unref` fixed it.
- After the fix:
  - `... test-extension.mjs panel/state` printed `# tests 28 # pass 28 # fail 0`.
  - `... panel/getting-started` printed `# tests 19 # pass 19 # fail 0`.
  - `... panel/shell` printed `# tests 57 # pass 57 # fail 0`.
- `node scripts/structure-audit.mjs` (repo root) printed `structure-audit:
  passed (205 warning(s), 638 baselined)`, with no line naming
  `panel/state`, `panel/getting-started` or `panel/shell`.
- `node ../../node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` and
  `-p tsconfig.test.json` both exited 0 with no output.

## Not verified

- Live behaviour in a browser: no browser was opened (brief). The fix rests on
  MV3 starting a stopped worker for `runtime.sendMessage`, which is documented
  behaviour and what the live report saw when Cancel was pressed. A live re-run
  of the stop-worker step should show the expired line within about 3 s.
- Firefox popup lifetime: the popup unmounts on close, so the probe only runs
  while it is open. I did not exercise this.
- No full suites or builds were run (brief).

## Open questions or contradictions found

- Keepalive: the probe sends a message every 3 s during a wait, which also
  resets the worker's idle timer. This overlaps with the background keepalive
  added in `4d706dd5`. That is harmless, but the supervisor may want to note it.
- The live report says the panel showed "Connected: Done" during pairing. That
  is the pairing guide's normal step 2 title, not part of this defect.
