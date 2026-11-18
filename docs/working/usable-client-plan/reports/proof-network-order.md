# Proof network order (t915 follow-up)

Outcome: Done. The approved-client proof passes again with the guard unchanged.

## Cause
The panel's reachability probe uses `status.settings.coreApiUrl` from the service worker. The worker builds
its connection from stored settings once and keeps it in memory. The proof set the isolated Core's address
only later, through `fluxiq.connect`, so the panel's first probe went to the default `127.0.0.1:3000`.

## Change (packages/test-runner/src/extension-chat-check)
- `preconfigure-extension.ts` (new): writes the full settings (isolated gateway and the recording proxy as Core API URL) to `fluxiq.settings` through the service worker, reads them back, retries while the worker is not ready.
- `stop-extension-workers.ts` (new): closes the extension worker target over CDP (`Target.closeTarget`), so its successor builds from storage.
- `open-chrome-session.ts`: before the panel page loads, runs write, stop worker, then opens the scenario page (wakes the new worker); the panel is opened last. `addresses` is optional so the other callers (attempt lane, perturbations) are unchanged.
- `run-chat-check.ts` passes the addresses; `index.ts` exports the helper.
- Tests: `tests/preconfigure-extension.test.ts` (4) pin the key, the write-then-stop-then-wake order, and that nothing is stopped when the write fails.
- Guard untouched; default address not allow-listed.

## Tried and dropped
Storage write alone (worker memory stays stale); `chrome.runtime.reload()` (no worker came back in the harness).

## Evidence
- Passing run: `C:/Users/osrs_/FluxStuff/evidence/t198/2026-11-17T01-19-48-302Z-chrome` (exit 0, stage done, 20 of 20 checks true, no guard violation).
- Tests: `node --test dist/extension-chat-check/tests/preconfigure-extension.test.js` 4 pass, 0 fail.
- `node scripts/structure-audit.mjs`: passed.
