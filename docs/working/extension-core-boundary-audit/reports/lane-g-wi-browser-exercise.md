# Lane G W-I: browser exercise of the offline queue, trust lineage and host lease

Brief: "Brief: lane-g-wi-browser-exercise" in `lane-g.md`. Worktree `fxwork/t726/!FluxIQWebExtension`,
branch `task/t726-gateway-client-into-core`. No commits.

## Outcome

Done. A new headed Playwright spec runs the real built extension (`dist/e2e-chromium`) against a stand-in gateway
on loopback and the everything-store realistic scenario (Scenario Lab, seed 241), provider-free. It passes. Five
headed runs of the final shape all passed (55.9 s to 1.4 min each). The extension's behaviour matches lane G's
"Queue semantics" at every step exercised. No contradiction was found.

## What changed and why

All files are new, all under `apps/extension/e2e/gateway-session/`:

- `index.ts`: the directory barrel (`export {}`), the same as `e2e/lease/index.ts`. Placement rules require a
  barrel in every directory. This file was not named in the brief's "Owns" line, but the new directory needs it.
- `tests/stand-in-gateway.ts`: a WebSocket stand-in written by hand, built on the one in
  `lease/tests/stale-holder.spec.ts`. It records every client message with the ordinal of the socket it came over,
  and has three moods. `ready` answers a hello with `server.session_ready` and a new synthetic token
  (`e2e-token-N`). `pair` answers a hello with `server.pairing_required`, and `approve()` then sends
  `server.session_ready`. `offline` refuses every upgrade before it opens. It also has `drop()`, `send()` and
  `command()` (a leased `server.execute_action`).
- `tests/queue-across-reconnects.spec.ts`: one test in eight `test.step`s (listed below). The oracles are the page
  and what the gateway received. The session-storage queue (`fluxiq.outbox`) is read only to name the queued entries
  by type, event id and binding, never by content. Settings turn off `captureInputValues`, `captureSnapshots` and
  `captureMutations`. Every typed word and token is a synthetic fixture.
  - The store shows interruptions a real shopper meets: a "Never miss a deal" notifications prompt and a cookie
    banner. The first run failed because that prompt covered the search box. The spec registers Playwright locator
    handlers that click "Not now" and "Decline", as a person would.

## Steps exercised and observed evidence (final run; earlier runs matched)

1. **Connect.** The first `client.hello` carried the stored synthetic token. The stand-in answered
   `server.session_ready`, and the status read `connected`.
2. **Leased command.** `web.browser.navigate` under lease epoch 5 / brief-1 opened the store in a new tab and
   succeeded. `web.dom.type` under the same lease typed "kettle" into `input[name="k"]`: the page's box read
   "kettle".
3. **Recording.** The stand-in sent `server.start_recording` {recordingId, projectId}, and the status read
   `recording`. Using the page (click the box, replace its text, Tab away) produced recording events over socket 1:
   clicked ×2 and keyboard.pressed ×6–7 across runs. Every event since the start names the recording.
4. **First drop.** The mood was set to `offline` and the socket dropped, so the status left `connected`. Using the
   page queued 19 entries: 9 `client.recording_event` and 10 `client.snapshot`. Every entry was bound to the stored
   lineage and the recording's project, and every recording event to the recording. None had been sent before.
5. **Reconnect by token.** The stand-in refused 3 upgrades while offline, then went `ready`. Socket 2's hello
   carried `e2e-token-1`, the token issued on socket 1. All 9 queued event ids arrived once each, in queue order,
   over socket 2 only. Excluding hello and state_update, socket 2's message types equal the queued types exactly, in
   order, snapshots included. The queue ended empty and the lineage was unchanged.
6. **Second drop.** The page was used again, and 23 entries (11 recording events) were queued under the first
   lineage.
7. **Reconnect that had to pair.** In mood `pair`, socket 3 opened and the status read `pairing`. The queue still
   held exactly the 11 event ids: nothing was flushed or dropped before session_ready. After `approve()` the status
   read `connected`, the queue emptied, and the lineage became a new value. After a 2 s wait none of the 11 events
   had been received. Excluding hello and state_update, socket 3 had carried nothing, so no snapshot leaked either.
   As a negative control, the page's next events arrived live over socket 3 (clicked + keyboard.pressed ×8–9).
8. **Lease takeover.** `web.dom.type` under epoch 6 / brief-2 succeeded, and the box read "travel mug". The old
   holder's late command under epoch 5 / brief-1 was answered `failed` with
   `{category: blocked_by_capability_or_policy, code: host_lease.stale, retryable: false, stage: dispatch, effect: unacted}`
   and payload `{status: refused, code: host_lease.stale}`. After 1.5 s the box still read "travel mug". The refusal
   was the only message about that command, and no recording event was added.

The spec logs a one-line `gateway-session evidence {...}` summary with counts and event kinds only. It contains no
ids, values or tokens.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/extension test:e2e:build`: exit 0. Core build current; tsc clean;
  chrome/firefox/e2e-chromium each "verified 22 files" (the usual gecko.id placeholder warning).
- `npx tsc -p tsconfig.test.json --noEmit` (in `apps/extension`, covers `e2e/**`): no output, exit 0, after each
  edit.
- `pnpm --filter @fluxiq-web-extension/extension exec playwright test -c e2e/playwright.config.ts e2e/gateway-session/tests/queue-across-reconnects.spec.ts`:
  - Runs 1–4 failed while the spec was being developed. Run 1: the store's notifications prompt covered the search
    box. Run 2/3: events from the leased commands sent before the recording started name no recording, so the
    check was narrowed to events since the start. Run 4: the recording's start marker does not cross as a
    `client.recording_event`, so that wait was removed.
  - Every run after that passed: `1 passed` five times (1.3, 1.2, 1.7, 1.3, 1.4 min). The last run was after the
    final edit.
  - pnpm prints `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "playwright" not found` after a failing run only. The
    passing runs exit 0.
- `node scripts/structure-audit.mjs`: first one violation (`statement-packing`, `stand-in-gateway.ts` line 75), now
  fixed. Then "structure-audit: passed (215 warning(s), 638 baselined)".

## Not verified

- Firefox (popup build) and Edge. Only Chromium ran.
- A service-worker restart while entries are queued. The queue surviving in `chrome.storage.session` is
  not exercised here.
- The project and recording sides of the flush rule, which are judged in the outbox's unit tests:
  - entries queued under another project or another recording are dropped;
  - a recording whose `client.stop_recording` was queued is still delivered;
  - the 1,000-entry cap and the byte budget, with their loss marker;
  - a send failing mid-flush.
- `queuedActionResult` (an action result queued while down answering a reconcile request).
- Sends made while a socket is open but waiting for approval (`pairing`) go straight to the wire, because the Core
  transport's `connected` means socket open, not session ready. The spec deliberately does not use the page during
  that window, so that path is not covered.
- No live Lab run, no paid run, and the FluxIQ web panel was not started.

## Open questions or contradictions found

- No contradiction with the queue semantics.
- Start marker (corrected by the lead, 2026-10-19, after `g-recording-start-marker.md`): by design the
  recording's start marker (`browser.tab`, `recordingState: started`) is passive evidence and crosses as a
  `client.state_update` (`reason: "recording-evidence"`), never as a `client.recording_event`; this spec looked
  only at recording events. The lead added an assertion that the state update arrives once and that no
  recording event carries the marker.
- Resolved by the lead: Core's connection now queues what is sent while a socket pairs or its token is checked,
  and writes to the socket only after `server.session_ready`.
- Observation: while the browser waits for approval (`pairing`), anything it sends goes over the open socket
  before trust is re-established, not into the queue (see "Not verified"). Worth a supervisor decision on whether
  that matches intent.
