# t789-listener — the private provisioning listener (lane B1, hosted H1)

## Outcome

Done. The listener is built at `apps/web/src/server/provisioning-listener/` in the Core worktree
(`C:/Users/osrs_/FluxStuff/fxwork/t789/!FluxIQ`). All three acceptance checks pass. There is one
open question about how `apps/web` reaches two values from the contracts package (see below).

## What changed and why

All files are new and untracked. `platform-services.ts` was not edited.

- `index.ts`: the barrel. It re-exports `getPlatformServices`, the listener, the env entry, the
  config error and the types. `platform-services.ts` imports `lib/fluxiq`, so `lib/fluxiq` must
  reach this barrel with a dynamic `import()` (see the wiring below). A static import would
  create a load cycle.
- `types.ts`: `ProvisioningListenerServices` (a `Pick` of `PlatformServices`: `provisioning`
  and `provisionerCaller`), the options, the handle `{address, close()}`, the reserved port and
  the rate limit.
- `start-provisioning-listener.ts`: `startProvisioningListener(options): Promise<handle>`. Steps:
  1. Refuses a reserved port.
  2. Builds the allowlist, which refuses any public or invalid entry.
  3. Opens the token verifier.
  4. Creates the `node:http` server with these limits: `headersTimeout` 10 s,
     `requestTimeout` 30 s, `keepAliveTimeout` 5 s, `maxHeaderSize` 16 KiB,
     `maxHeadersCount` 64.
  5. Resolves once it is listening.

  `close()` is idempotent. It stops accepting new connections, closes idle keep-alive ones,
  waits for in-flight requests, and cuts the remaining connections after `drainMs` (default 10 s).
- `start-provisioning-listener-from-env.ts`: `startProvisioningListenerFromEnv(env, getServices,
  overrides?)` returns a handle, or null when it is off.
  - It is off unless `FLUXIQ_PROVISIONING_TOKEN_FILE` is set (blank counts as unset).
  - `FLUXIQ_PROVISIONING_LISTEN` is then required.
  - `FLUXIQ_PROVISIONING_ALLOWED_CIDRS` is a comma list; blank means the defaults.
  - It refuses two reserved ports: `PORT` (default 3000), and `FLUXIQ_CLIENT_GATEWAY_PORT`
    (default 4777, read the same way `lib/fluxiq.ts` `startSharedClientGateway` reads it).
- `provisioning-listener-config-error.ts`: `ProvisioningListenerConfigError`. Every start
  refusal throws it. Messages name the setting and never contain a token.
- `contract/index.ts`: the seam to the frozen contract. It re-exports
  `provisioningOperationForHttpPath` and `PLATFORM_PROVISIONING_ERROR_STATUS`, plus two types
  (see the open questions).
- `bind/`:
  - `parse-listen-address.ts` accepts `host:port` where the host is an IP literal, a bracketed
    IPv6 address or `localhost`, and the port is 1 to 65535.
  - `assert-private-bind.ts` refuses a reserved port or a non-port value.
- `source/`: the source check.
  - `default-allowed-cidrs.ts` lists the default sources: 127/8, 10/8, 172.16/12, 192.168/16,
    ::1/128, fc00::/7, and the `::ffff:` mapped forms of the IPv4 ranges. The same list defines
    which ranges count as private.
  - `parse-cidr.ts` accepts a bare address as a single host. It turns a mapped
    `::ffff:a.b.c.d/p` with p >= 96 into IPv4 `/p-96`.
  - `is-private-cidr.ts` passes a CIDR only if some private range is at least as wide and
    contains its address.
  - `normalize-peer-address.ts` turns a mapped IPv4 peer into plain IPv4.
  - `source-allowlist.ts` is backed by `node:net` `BlockList`. The source is always
    `request.socket.remoteAddress`. Forwarded headers are never read.
- `token/`: the Bearer token.
  - `read-token-digests.ts` reads one or two non-blank trimmed lines, the same rule as
    `cli/read-token-file.ts`. It refuses a token under 32 UTF-8 bytes, more than two tokens, and
    an empty or unreadable file. It keeps only SHA-256 digests.
  - `read-bearer-token.ts` parses the `Authorization: Bearer` header.
  - `provisioning-token-verifier.ts` compares with `timingSafeEqual` against every digest, with
    no early exit. On a request, it checks the file's mtime and size at most every 5 s and
    re-reads the file when either changed. If a reload fails, it refuses every token and logs
    one warning with no secret. The next check reads the file again.
- `request/`: one request.
  - `sliding-window-rate-limiter.ts`: per source, default 120 requests per 60 s. Refused
    requests do not count. Idle keys are swept once per window.
  - `read-json-body.ts`: a 64 KiB cap. A body over the cap is read and discarded up to 1 MiB so
    the caller still gets its 413. Past 1 MiB, or a declared `content-length` over 1 MiB, it
    answers 413 and closes the connection.
  - `write-provisioning-answer.ts`: always sends `cache-control: no-store` and
    `x-content-type-options: nosniff`. It never sends Set-Cookie or any CORS header.
  - `format-request-log-line.ts`: `[FluxIQ] provisioning <op|-> <status> <code|-> <n>ms`.
  - `handle-provisioning-request.ts` applies the checks in the brief's order:
    1. allowlist: 403 `forbidden`, before the body is read;
    2. rate limit: 429 `rate_limited`, with `retry-after`;
    3. POST and a path accepted by `provisioningOperationForHttpPath`: otherwise 404
       `operation_unavailable`;
    4. any `Origin` header: 403 `forbidden`;
    5. Bearer token: otherwise 401 `unauthorized`, with `www-authenticate: Bearer`;
    6. `application/json` (a charset parameter is allowed): otherwise 400 `invalid_input`;
    7. body: 400 or 413, `invalid_input`;
    8. `services.provisioning.run(op, body, services.provisionerCaller(peerIp))`, answered with
       200 or `PLATFORM_PROVISIONING_ERROR_STATUS[code]`.

    Every refusal before the body is read sends `connection: close`. Cookies are never read.

    Any unexpected throw answers 500 with `{ok:false, error:{code:"internal_error", message:
    <generic>}}`. The request log records the operation only if it is a known one, so a path
    sent by an attacker never reaches the log.
- Tests:
  - `tests/start-provisioning-listener.test.ts`: 13 tests over a real socket on 127.0.0.1:0,
    using real `createPlatformServices` with memory repositories, a real
    `IdentityAccessService` (weak test KDF), `MemoryEmailSender` and `MemoryIamAuditSink`.
  - `tests/start-provisioning-listener-from-env.test.ts`: 6 tests.
  - Unit tests: `source/tests/source-allowlist.test.ts`,
    `request/tests/sliding-window-rate-limiter.test.ts`,
    `token/tests/read-bearer-token.test.ts`, `bind/tests/parse-listen-address.test.ts`.
  - Support files: `tests/listener-fixture.ts` (a raw `node:http` client, so a test controls
    the Origin and Authorization headers exactly) and `tests/memory-record-repository.ts`.

  Together they cover every case the brief lists:
  - the round trip: created, then exists, then getAccount;
  - token missing, wrong, or sent as Basic;
  - rotation: two lines accepted, the old token refused after the file changes, and a 5 s
    recheck window;
  - fail-closed reload;
  - the allowlist set to only 10/8, with calls from 127.0.0.1;
  - Origin refused;
  - wrong content type, invalid JSON, and a 65 KiB body;
  - setPassword, unknown names, GET and OPTIONS all unavailable;
  - a password field refused and not echoed;
  - the rate limit, and its recovery after the window;
  - the log lines: their format, and no token, email or externalId in them;
  - a generic 500;
  - close() draining a request in flight;
  - off without a token file;
  - each public-bind refusal: default and custom panel and gateway ports, public and invalid
    CIDRs, and malformed listen values;
  - token-file refusals whose messages contain no token.

### Wiring for lanes A/C (not applied; `lib/fluxiq.ts` was not edited)

In `lib/fluxiq.ts`, add to the runtime state type (`FluxIQWebGlobal["__fluxiqWebRuntime"]`):

```ts
provisioningListener?: import("../server/provisioning-listener").ProvisioningListenerHandle | null;
```

In `initializeFluxIQWebRuntime()`, after `startSharedClientGateway(state);`:

```ts
  await startSharedProvisioningListener(state);
```

with, beside `startSharedClientGateway`:

```ts
async function startSharedProvisioningListener(state: NonNullable<FluxIQWebGlobal["__fluxiqWebRuntime"]>): Promise<void> {
  if (state.provisioningListener) return;
  // Dynamic: the listener's barrel re-exports getPlatformServices, which imports this module.
  const { getPlatformServices, startProvisioningListenerFromEnv } = await import("../server/provisioning-listener");
  state.provisioningListener = await startProvisioningListenerFromEnv(process.env, getPlatformServices);
  if (state.provisioningListener) console.info(`[FluxIQ] Provisioning listener on ${state.provisioningListener.address.host}:${state.provisioningListener.address.port}`);
}
```

In `closeFluxIQWebRuntime()`, at the start of the `closePromise` body, before the gateway closes:

```ts
    const provisioningListener = state.provisioningListener ?? null;
    state.provisioningListener = null;
    if (provisioningListener) await provisioningListener.close();
```

`reloadFluxIQWebInstance` needs no change. `getServices` is resolved on every request, and
`getPlatformServices` keys its cache by FluxIQ instance, so after a reload the listener uses the
new instance. Startup throws `ProvisioningListenerConfigError` on a refused configuration, so a
misconfigured hosted server fails to start instead of serving without the listener.

## Commands run and observed results

Run in this order, from `C:/Users/osrs_/FluxStuff/fxwork/t789/!FluxIQ`:

- `pnpm structure:check` before my changes: one pre-existing failure in another lane's file
  (`[statement-packing] apps/web/src/app/welcome/PasswordForm.tsx` line 24). It was gone on
  later runs.
- From `apps/web`: `pnpm exec vitest run src/server/provisioning-listener`. First run: 12 of 13
  passed. The failure was in my test: `node:http` refuses a raw `\n` in a path. I fixed the test.
- From `apps/web`: `pnpm exec vitest run src/server/provisioning-listener` -> "Test Files 6
  passed (6), Tests 31 passed (31)".
- From `apps/web`: `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit` ->
  no output, exit 0.
- Root `pnpm structure:check` -> one failure in my code:
  `[swallowed-failure] .../request/handle-provisioning-request.ts line 43`, the 500 catch. I
  added a `/* best-effort: ... */` reason: the failure is answered as a 500 and logged as
  `internal_error`, and its detail is never logged.
- Root `pnpm structure:check` -> "structure-audit: passed (451 warning(s), 1152 baselined)". No
  warning names a file under `provisioning-listener`.
- Mutation check: I removed the Origin, allowlist and rate-limit checks in
  `handle-provisioning-request.ts` and ran the listener test file. Those 3 tests failed (10
  passed). I restored the file and confirmed with `grep`. Re-run: 6 files, 31 tests passed.
- Final runs after the last edit: vitest 31/31 passed; tsc exit 0; structure audit passed.

## Not verified

- The production `next build` (`pnpm build`, a full suite): not run. It is unverified whether
  Turbopack bundles `contract/index.ts`'s relative import of
  `packages/contracts/src/platform/provisioning/index.ts` under `tsconfig.build.json`. tsc
  resolves it, and the structure audit's package-exports rule permits a type-checked static
  import of a sibling package's source.
- The wiring lines above were not applied or run, so live startup inside the Next server was
  not exercised.
- The early 413 path for a declared `content-length` over 1 MiB (close without reading) is not
  tested. Only the read-and-discard 413 for 65 KiB is.
- IPv6 peers are tested only at the allowlist unit level; no test listens on `::1`.
- Behaviour behind Docker's userland proxy (where the peer may appear as the bridge gateway) was
  not checked.

## Open questions or contradictions found

1. **The brief's contract values cannot be reached through a package export.** `apps/web`
   depends only on `fluxiq`, and `fluxiq/platform` does not re-export
   `provisioningOperationForHttpPath` or `PLATFORM_PROVISIONING_ERROR_STATUS`. `@fluxiq/contracts`
   cannot be resolved from `apps/web`: it is not in `apps/web/node_modules`, and the
   `tsconfig.base.json` paths alias applies only to tsc and `next dev`, not vitest or
   `next build`.

   I isolated the import in `contract/index.ts`, as a static relative import of the contract's
   TypeScript source. The cleaner fix needs a `packages/` change, which the brief forbids me:
   add `export { PLATFORM_PROVISIONING_ERROR_STATUS, PLATFORM_PROVISIONING_HTTP_PATH_PREFIX,
   provisioningOperationForHttpPath } from "@fluxiq/contracts/platform";` (and the two types) to
   `packages/fluxiq/src/platform/provisioning/index.ts`, rebuild, and point `contract/index.ts`
   at `fluxiq/platform`.
2. **The 500 body is outside the frozen error enum.** It uses `code: "internal_error"`. The CLI
   transport would report it as "not a provisioning response (HTTP 500)". Either add a code to
   the contract or accept this.
3. **"At least 32 bytes" is read as at least 32 UTF-8 bytes of token text.** It is not the
   decoded entropy. A 32-byte base64url token (43 characters) passes. A token generator must
   still produce 32 random bytes.
4. **Listen host form.** It must be an IP literal or `localhost`. A Compose service hostname
   such as `fluxiq:4780` is refused. The plan's own example, `0.0.0.0:4780`, is accepted
   because the brief refuses only reserved ports and public allowlist entries, not a wildcard
   host. Say if a wildcard host should also be refused outside a container.
