# Pairing push caller scope (t916) — worker report

## Outcome
Done in CORE (`C:/Users/osrs_/FluxStuff/fxwork/t916/!FluxIQ`), uncommitted. `GET /api/client-gateway/changes`
now sends an event only when the caller's own filtered view of the gateway changed.

## What changed and why
- New `apps/web/src/app/api/client-gateway/snapshot/caller-view.ts`: `callerGatewayView(owner, url)` resolves
  the caller, presentation, visible project and `callerGatewaySnapshot(...)` filtering in one place. Returns
  `{ snapshot, project, presentation, webRuntime }`. `snapshot/route.ts` now calls it (behaviour unchanged).
- `changes/route.ts`: passes the stream `view = () => callerGatewayView(selected, request.url).snapshot`.
- `changes/change-event-stream.ts`: constructor is now `(changes, view, options)`. It subscribes, takes a
  sha256 fingerprint of the view, recomputes on each gateway signal (one read at a time, bursts coalesced), and
  emits only when the fingerprint differs. A change heard during the first read is compared against it. An
  unreadable view (authority lost) fails the stream; the owner's per-chunk re-check is unchanged.
- Event payload is now `data: {"version":N}` where N is a per-stream sequence assigned when an event is sent
  (starts at 1, no gaps even when changes coalesce). The `kind` and the gateway's global version are dropped,
  since a coalesced kind could name someone else's change. The browser (`features/client-gateway-changes`)
  only uses the `change` event as a "read the snapshot" trigger and never parses the payload, so it needed no
  change (its tests and `subscription.ts` untouched).
- Tests rewritten: `changes/tests/change-event-stream.test.ts` (7) and `changes/tests/route.test.ts` (uses the
  snapshot fixtures). Route tests cover, for a service-profile panel user and for a paired browser: no event
  for another person's client paired/connected/revoked/disconnected, an event numbered 1 for their own, no event
  for a pairing request or its denial; an unfiltered (local) panel caller gets pairing-request (1) and approval
  (2) events; headers; no gateway version or kind on the wire; 401 and 403 refusals get no stream; mid-stream
  authority lapse errors the stream and releases the lease.
- Doc: "How the panel hears pairing and client changes" in `docs/architecture/automation-studio/client-gateway.md`
  — Route bullet rewritten and an "Only the caller's own changes" bullet added.

## Commands run and observed results
- Temporary config copy `apps/web/vitest.scratch-caller-scope.config.ts` (the repo config minus
  `refuseStaleCoreBuild()`); deleted after use (`ls apps/web | grep -c scratch` -> 0).
- `pnpm --filter @fluxiq/web exec vitest run --config <copy> src/app/api/client-gateway src/features/client-gateway-changes src/lib/app-route-iam src/app/api/tests` -> 18 files, 240 tests passed
  (run before one test-formatting edit).
- After that edit, re-ran `... src/app/api/client-gateway/changes src/app/api/client-gateway/snapshot src/features/client-gateway-changes` -> 5 files, 58 tests passed.
- `pnpm --filter @fluxiq/web check` -> no type errors (tsc exit clean; not stamped because `packages/fluxiq` changed while it ran).
- `node scripts/structure-audit.mjs` -> first run flagged `statement-packing` in my stream test; fixed. Now one
  violation left, none in my files: `[naming] packages/fluxiq/src/platform/iam/store/context/` (other worker's tree).

## Not verified
- Live browser / Next.js flushing; I started no panel or gateway.
- The unfiltered fingerprint covers the whole snapshot (incl. audit log, timestamps), so any audited change
  for that caller sends an event; that is intended (it is their own view) but means extra reads on busy gateways.
- Each signal for a filtered caller costs one `callerGatewayView` read (several IAM revalidations); not measured.

## Open questions or contradictions found
- A `callerGatewayView` failure mid-stream (e.g. selected project becomes unavailable, 403) ends the stream
  with an error and EventSource reconnects; the reconnect then gets a normal refusal from the route. Acceptable?
- `docs/integrations/client-gateway-websocket.md` (not mine) may still describe `data: {"kind","version"}`; the
  earlier report proposed text for it — it should say `{"version"}` as a per-stream sequence.
