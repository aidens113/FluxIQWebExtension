# Report: lane-t-p2-x2-dedupe-per-scope

## Outcome

Done. The background page capture now remembers what it has uploaded separately for each Core and trace scope.
`scope` comes from `metadata.trace.scope`. When a second trace (a trial after its build) references a digest, that
digest is uploaded once for the new scope. A command with no scope still uses one record per Core, as before. The
number of remembered records is capped at 64; when the cap is reached, the least recently used record is dropped.

## What changed and why

- `trace-capture/read-trace-request.ts` (new): reads `metadata.trace` and returns a `TraceRequest`, which is
  `{ scope? }`, or `undefined` when the metadata is not a trace request. Rules:
  - `artifacts` must be exactly `true`, as before;
  - a scope that is not a nonempty string counts as no scope, and the command is still traced.
- `trace-capture/is-trace-request.ts`: now delegates to `readTraceRequest`. The public behaviour is the same.
- `trace-capture/types.ts`:
  - new `TraceRequest = { scope?: string }`. The field is written locally because Core's built
    `packages/contracts/dist/client-gateway.d.ts` still declares `ClientGatewayTraceRequest = { artifacts: true }`
    without `scope`. Core was not rebuilt, per the brief;
  - `TraceCapture.capture(tabId, scope?)` takes an optional scope.
- `trace-capture/traced-commands.ts`: keeps a `Map<commandId, TraceRequest>` (same 256 bound). `take` now returns
  the request, or `undefined`. It used to return a boolean.
- `trace-capture/stored-digests.ts` (new): `StoredDigests`. It keeps one digest set per `[coreApiUrl, scope|null]`
  key, ordered by last use. Past `limit` records, the oldest is dropped.
- `trace-capture/remembered-scopes.ts` (new): `TRACE_REMEMBERED_SCOPES = 64`.
- `trace-capture/page-capturer.ts`:
  - `capture(tabId, scope?)` picks the record for the current Core and scope, uploads the digests missing from it,
    and references the ones in it;
  - new optional dep `rememberedScopes`;
  - the old flat `"<url> <sha>"` set is gone.
- `trace-capture/index.ts`: exports `readTraceRequest`, `StoredDigests`, `TRACE_REMEMBERED_SCOPES` and the
  `TraceRequest` type.
- `connection/server-command-channel.ts` (`traceFor`): passes `request.scope` to the capture. The two discard-only
  `take` calls (a refused check, and an action that did not run) are unchanged, because they ignore the return value.

Tests were written first, and the first run failed as expected: esbuild could not resolve `../read-trace-request`.
- `tests/page-capturer.test.ts`, four new tests:
  - two scopes each upload a shared digest once;
  - the same scope uploads it once, and the same scope name at another Core is a separate record;
  - no scope behaves as before and is kept apart from every scope;
  - the bound: with `rememberedScopes: 2`, a scope that was used again is kept, and the oldest is dropped and
    uploads again.
- `tests/traced-commands.test.ts`:
  - existing `take` assertions changed to the new return values (`{}` / `undefined`);
  - new test: scope read and handed back; a malformed scope counts as no scope.
- `connection/tests/server-command-channel.test.ts`: the harness also records scopes. New test: the request's scope
  reaches the capture, and an unscoped request passes `undefined`.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/extension exec tsc -p tsconfig.json --noEmit` -> exit 0, no output.
- `pnpm --filter @fluxiq-web-extension/extension exec tsc -p tsconfig.test.json --noEmit` -> exit 0, no output.
- `node scripts/test-extension.mjs src/background/trace-capture/tests src/background/connection/tests` (in
  apps/extension) -> `# tests 286`, `# pass 286`, `# fail 0`.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (214 warning(s), 618 baselined).` The only warnings
  on touched files are advisories:
  - `server-command-channel.ts` is at 468 lines; it was about 466 before this change;
  - `server-command-channel.test.ts` is at 541 lines; it was about 532 before.

## Not verified

- No live browser run, and nothing tested against a running Core that sends `scope`.
- Core's built contracts were not rebuilt, so the extension does not yet type-check against Core's own `scope` field.
  The local `TraceRequest` stands in for it.

## Open questions or contradictions found

- Once Core's dist carries `scope`, `TraceRequest` could be derived from `ClientGatewayTraceRequest`
  (`Pick<..., "scope">`) so that the two cannot drift.
- Unscoped per-Core records count toward the same 64-record cap as scoped ones. A dropped unscoped record only causes
  re-uploads.
