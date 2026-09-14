# Stage 4q: isolated-authentication code diagnosis

## Status

Complete as a read-only code diagnosis. No source change is justified solely by
the two 401 observations. The authentication construction is byte-identical at
downstream `54e30bc` and `74f6aa0`; the candidate changed the pairing lifecycle
that runs only after authenticated Core startup. The leading code-level cause is
an older, untested process-environment seam in bootstrap storage resolution, but
the Stage 4p evidence available to this brief does not prove that the launcher
process had a conflicting variable.

## Trace and pin comparison

The following authentication-bearing files have identical Git blob IDs at the
two downstream pins:

| File | Blob at both pins |
| --- | --- |
| `packages/test-runner/src/environment.ts` | `838bb57cefe2725ef89c47f6b9a155b1474e3074` |
| `packages/test-runner/src/target-config.ts` | `6187579cb960082146fc4210645ddc6ac4198e39` |
| `packages/test-runner/src/allocation.ts` | `b7d2e1fc05a8ce3152f171d0b5d4b5e3259954e0` |
| `packages/test-runner/src/coordinator.ts` | `d2ce20caed917d7dbdbdecb7b19b5978bfd58eb9` |
| `packages/test-runner/src/http-control.ts` | `1ac32722dad8da79ae7b7d9bc36b9249e3ac10d6` |
| `packages/test-runner/src/lane-rules/core-identity.ts` | `4ab26be58345ce7e55e3c5ad1d90dd57a36fd4c6` |

`git diff 54e30bc 74f6aa0 -- packages/test-runner/src` changes only
`run-lifecycle/*`, the pairing tests/barrel, a pairing wiring assertion, and the
small delegation in `run-scenario.ts`. In that delegation, authenticated Core
startup still precedes `pairExtensionWithColdEpochRecovery`. Therefore the
closed summary `FluxIQ authentication failed (401)` cannot have been emitted by
the new pairing implementation.

The isolated path is:

1. `loadTestEnvironment` reads `.env`, then `.env.local`, then overlays the
   process environment. `FLUXIQ_TEST_ENV_FILES=none` skips both files but does
   not filter the process environment.
2. `resolveTargetConfiguration` validates and trims the optional isolated
   username/password pair. Later, `run-scenario.ts` independently reconstructs
   credentials from the raw environment via `configuredCredentials`.
3. `startTopology` allocates a fresh `fluxiq-root/.fluxiq`. When identity is
   required it calls `ensureBootstrapIdentity` before starting the Core web
   process. A new root gets `lab-runner-admin`; an existing root is
   self-authenticated.
4. The Core child environment is the complete inherited process environment
   with run-scoped `FLUXIQ_ROOT`, `FLUXIQ_IMPORTER_ROOT`, `FLUXIQ_HOST_ROOT`,
   `FLUXIQ_DATA_DIR`, and `FLUXIQ_DATABASES_DIR` overlaid.
5. After the web root and gateway respond, `FluxIQControlClient.freshLogin`
   posts the same selected credentials to `/api/auth/login`. That method is the
   sole downstream source of the exact 401 summary.
6. At Core `19468b72c4472fd5cc58940737702d5e4d72c985`, the login route returns
   400 for missing/malformed input, 429 for lockout, and 401 when identity
   authentication or session secret-key unlocking throws. Pairing has not begun
   at that point.

No credential, token, bundle payload, or Stage 4p runtime state was read.

## Plausible deterministic causes

### 1. Bootstrap and child resolve different database roots (leading hypothesis)

`ensureBootstrapIdentity` calls `FluxIQ.create({ rootDir, loadEnv: false })`.
At the pinned Core commit, `loadEnv: false` disables dotenv loading but the
constructor still reads `process.env` for `FLUXIQ_DIR`, `FLUXIQ_DATA_DIR`,
`FLUXIQ_DATABASES_DIR`, and the other path overrides. The bootstrap therefore
can write `identity.users` to an inherited database directory. The spawned web
process, however, forcibly overlays `FLUXIQ_DATA_DIR` and
`FLUXIQ_DATABASES_DIR` with the new allocation's `.fluxiq` directory. If the
runner process carries either conflicting path setting, bootstrap succeeds in
one database and the web login deterministically searches another, producing
401. `FLUXIQ_TEST_ENV_FILES=none` does not prevent this.

This is a concrete configuration bug whether or not it caused Stage 4p. It is
not proven as the Stage 4p cause because this brief deliberately did not inspect
the launcher environment.

### 2. Bootstrap lifecycle is not closed or verified after creation

`ensureBootstrapIdentity` never closes the temporary `FluxIQ` instance. The
existing-user branch authenticates, but the new-user branch only awaits
`upsertUser`; it does not authenticate the just-created credentials before the
web process starts. A storage/credential-write problem therefore first appears
as the less-specific HTTP 401. An unclosed SQLite owner is also an avoidable
cross-process lifecycle risk on Windows. This is a coverage and hardening gap,
not evidence that a lock caused these observations.

### 3. Wrong Core process accepted by readiness polling (lower confidence)

The runner allocates and releases a port, starts Next through a shell, accepts
any successful response at the selected origin, and then intentionally accepts
an unauthenticated gateway-snapshot response to initialize the gateway. There
is no run-identity assertion before login. A stale process winning the port race
could therefore answer with a different identity database and return 401. Two
successive observations make a random race less attractive than a stable
configuration mismatch, but source alone cannot exclude it.

### 4. Duplicate credential parsing (latent, not a sufficient explanation)

The resolved target contains validated, trimmed credentials, yet
`configuredCredentials` rereads raw environment strings and its result takes
precedence over `target.credentials` in `startTopology`. This permits the
configuration used by execution to diverge from the configuration already
validated by the parser. In the ordinary CLI path the same raw values are used
for both bootstrap and login, so this alone does not explain the 401, but it
widens the failure surface and has no direct test.

## Existing coverage and gaps

- `target-config.test.ts` covers isolated credential pairs and proves
  `FLUXIQ_TEST_ENV_FILES=none` skips repository env files.
- `environment.test.ts` proves the child gets the allocation's root/data/database
  values and that provider secrets are removed. It does not test conflicting
  inherited generic `FLUXIQ_*` path variables against bootstrap.
- `http-control-auth.test.ts` uses mocked HTTP to cover session-cookie parsing,
  one re-login after an authenticated request returns 401/403, and secret-safe
  failures. It does not exercise bootstrap through the real Core login route.
- Coordinator tests cover external topology ownership, startup cleanup, and
  persistent cleanup/locking. There is no successful disposable-isolated test
  proving that the bootstrap writer and spawned Core reader share one identity
  repository.
- The pinned Core login-route unit test covers only TOTP syntax. It does not
  integrate a runner-created identity with the web route.
- No test requires the bootstrap `FluxIQ` instance to close, requires a
  post-upsert self-authentication, or rejects a stale/wrong Core runtime before
  credentials are sent.

## Smallest safe probe and fix boundary

The smallest discriminating live probe is one fresh W27 primary Flow run with
all generic Core path variables removed from the launcher process while keeping
the same process-only `FLUXIQ_TEST_*` credential mechanism. Record only closed
facts: whether any generic path override was present before removal, whether
bootstrap `paths.databases` equalled the allocation database directory, whether
post-bootstrap self-authentication passed, the spawned Core process identity
check, and the HTTP status. Do not record values or paths. If that passes, a
second disposable run with a synthetic conflicting database override scoped to
its own run root should reproduce the old mismatch without inspecting a secret.

The smallest safe source repair stays downstream in the test-runner coordinator:

1. Make bootstrap construction explicitly use the allocation's FluxIQ and
   database directories instead of ambient Core path variables.
2. Authenticate the newly upserted identity once, revoke that probe session,
   and close the temporary `FluxIQ` in `finally` before spawning Core.
3. Remove the second raw-environment credential reconstruction or make one
   validated credential object the sole input to bootstrap and login.
4. Add a focused test with a synthetic conflicting `FLUXIQ_DATABASES_DIR`, plus
   a successful isolated bootstrap/login integration test. A mutation that
   restores ambient path resolution must fail that test.

Do not change Core: its documented environment precedence is internally
consistent. Do not broaden the pairing retry or HTTP login retry: a deterministic
401 is neither a pairing epoch nor a transient authenticated-request failure.

## Read-only checks performed

- `git rev-parse HEAD` and `git status --short` (observed downstream
  `74f6aa0713941206fdc61a739653579ca9fa14bb`; did not alter existing work).
- `git diff --name-status 54e30bc 74f6aa0` and scoped source diffs.
- `git rev-parse <pin>:<path>` for the six authentication-bearing files above.
- `rg`, `Get-Content`, `git show`, `git grep`, and `git ls-tree` over downstream
  source/tests and pinned Core source/tests.
- No Lab run, build, test command, process launch, bundle read, source edit,
  Core edit, commit, or push.

## Remaining uncertainty

The code establishes where 401 can originate and exposes a deterministic path
divergence, but it cannot establish which condition occurred in Stage 4p without
one secret-safe launcher/runtime probe. In particular, ambient Core path-variable
presence, a stale-port responder, storage write visibility, and the login route's
internal authenticate-versus-unlock branch remain unobserved.
