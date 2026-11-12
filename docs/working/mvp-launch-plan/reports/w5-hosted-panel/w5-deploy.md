# w5-deploy: container build, deploy configuration, disabled CI deploy (t901, W5 P5 part 1)

## Outcome

Partial. Every owned file is written and every check that can run without Docker passes,
with one exception. `apps/web/next.config.ts` now reads `FLUXIQ_WEB_STANDALONE`, and Core's
build-cache registry test requires every variable that `next.config.ts` reads to be in
`web:build`'s fingerprint. That registry lives in `scripts/build-cache/steps.mjs`, which this
brief does not let me edit. Until the one-line change below lands,
`node --test scripts/build-cache/tests/registry.test.mjs` fails test 6. That test is part of
`pnpm check`.

The test is correct, not just strict. Without the change, the build cache could reuse a
non-standalone `.next` for a standalone build. Inside Docker nothing is cached (no git), so
this only bites locally and in CI.

**Needed outside owned paths:** in `scripts/build-cache/steps.mjs`, entry `"web:build"`, change
`env: ["NODE_ENV"],` to `env: ["NODE_ENV", "FLUXIQ_WEB_STANDALONE"],`.

## What changed and why

All paths are in the Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQ`.

- `apps/web/next.config.ts`: when `FLUXIQ_WEB_STANDALONE === "1"`, it adds `output: "standalone"`
  and `outputFileTracingRoot` = repository root (`path.join(__dirname, "..", "..")`). I checked
  that Next 15.5.24 compiles `next.config.ts` to CommonJS and evaluates it with
  `requireFromString(code, <cwd>/next.config.compiled.js)`, so `__dirname` is `apps/web`.
  Without the variable the config is unchanged, and the registry test's `tsconfigPath` regex
  still matches.
- `deploy/docker/Dockerfile`, two stages on `node:22-bookworm-slim` (`NODE_IMAGE` build argument;
  pin it by digest for releases).
  - **Build stage:**
    - Installs python3, make and g++ so `sqlite3` can fall back to compiling, and installs
      pnpm 9.15.0.
    - Runs `pnpm install --frozen-lockfile` from the manifests and patches first, so the install
      layer is cached.
    - Runs `pnpm build` with `FLUXIQ_WEB_STANDALONE=1`. This builds the libraries, the gateway
      bundle, `next build` and the runtime-identity check. With no git, the build cache runs
      every step uncached (`run-step.mjs` handles `BUILD_CACHE_NO_GIT`).
    - Runs `pnpm --filter ./packages/fluxiq deploy --prod /opt/fluxiq-gateway-runtime`.
  - **Runtime stage:**
    - Copies `.next/standalone`, `.next/static`, `.server-runtime` and
      `/opt/fluxiq-gateway-runtime` (at the same absolute path, so pnpm's symlinks stay valid),
      and links `apps/web/.server-runtime/node_modules/fluxiq` to `/opt/fluxiq-gateway-runtime`.
    - Runs as user `node`. Application files are owned by root. `/data` (mode 0700) is the only
      writable path, plus the `.next/cache` mount point.
    - `HEALTHCHECK` runs `deploy/docker/healthcheck.mjs /api/health`. The default command is
      `node apps/web/server.js`.
- **Why the extra fluxiq deploy:** the gateway bundle keeps `fluxiq` external
  (`build-client-gateway-server.mjs`) and is loaded by a native `import()`, while `fluxiq` is in
  `transpilePackages`. Next's tracing therefore probably never puts `fluxiq` in the standalone
  `node_modules`, so `import "fluxiq/server"` from the bundle would fail. A pnpm deploy reached
  through a link beside the bundle fixes that, and it also gives the operator a path to the
  accounts command line.
- **Image environment:**
  - `FLUXIQ_PROFILE=self-hosted` by default, not `local`, so a container is never open with the
    local admin account.
  - `FLUXIQ_ROOT=/data`.
  - `HOSTNAME=0.0.0.0` and `PORT=3000`.
  - `FLUXIQ_CLIENT_GATEWAY_HOST=0.0.0.0`. That makes the bind public, so the resolver requires
    the Origin allowlist: fail-closed comes from Core's own rules.
  - `FLUXIQ_GATEWAY_SERVER_MODULE`.
  - The provisioning port is deliberately not exposed.
- `deploy/docker/healthcheck.mjs` does a loopback fetch and exits 0 only on a 2xx. Docker's
  `--timeout` bounds it, so it sets no timer of its own.
- `deploy/docker/smoke.sh <image> <self-hosted|service>`:
  - Runs the image with a read-only root, tmpfs mounts, a fresh volume and a 5 s health interval.
  - Waits on Docker's health verdict. It fails immediately on stopped or unhealthy; otherwise
    the CI job timeout bounds it.
  - Checks 200 on `/api/health` and `/api/ready`.
  - Checks that discovery shows `instance.profile` and
    `gatewayUrl == wss://fluxiq.example.org/client`.
  - Checks non-root, that `/app` refuses writes and that `/data` accepts them.
  - Checks that the gateway does not answer 101 to `Origin: https://not-allowed.example`.
  - On `service` only: does `accounts createAccount` then `getAccount` through the private
    listener with a token generated for the run.
  - Removes its secrets, container and volume on exit, and stops the container with
    `docker stop --time 60`.
- `.dockerignore` keeps these out of the build context: `.git`, `.github`, `.claude`, `**/.fluxiq`,
  `**/.env`, `**/.env.*`, `**/*.env`, `deploy/env`, `deploy/secrets`, `*.pem`, `*.key`,
  `node_modules`, `.next`, `dist`, `.server-runtime`, tsbuildinfo files, test output, coverage,
  logs, worktrees (`fxwork`, `fxlab`, `lab-slots`, `worktrees`, `.worktrees`), `spikes` and
  `docs/working`. I removed a `**/build` entry because it would have matched future source
  directories. Every non-`**` pattern is anchored at the root, so `storage` does not exclude
  `src/programs/*/storage`.
- `deploy/compose/self-hosted.compose.yml`:
  - `fluxiq` uses `env_file` `../env/self-hosted.env` (overridable with `FLUXIQ_ENV_FILE`). It
    fixes `FLUXIQ_PROFILE=self-hosted`, `FLUXIQ_ROOT=/data` and `FLUXIQ_TRUST_PROXY=true`.
  - `fluxiq` is hardened: `read_only`, tmpfs at `/tmp` and `.next/cache`, `init`, `cap_drop ALL`,
    `no-new-privileges`, and `stop_grace_period 45s`, which is above the 30 s default drain.
  - `caddy` uses `caddy:2.10-alpine` (overridable with `CADDY_IMAGE`). Only Caddy publishes
    ports: 80, 443 and 443/udp. It mounts `../caddy/Caddyfile.example` (overridable with
    `CADDYFILE`) and starts after `fluxiq` is healthy.
- `deploy/compose/service.compose.yml` is the same, plus:
  - an internal network `fluxiq-provisioning` on subnet `${FLUXIQ_PROVISIONING_SUBNET:-172.31.250.0/24}`;
  - a fixed address for `fluxiq` on that network;
  - `FLUXIQ_PROVISIONING_LISTEN=<that address>:4780`, so the listener binds only that address;
  - `FLUXIQ_PROVISIONING_ALLOWED_CIDRS=<subnet>`;
  - the token file and setup code as Compose file secrets under `/run/secrets/`.

  The sign-up backend joins `fluxiq-provisioning` as an external network from its own project;
  Core's compose ships no website service.
- `deploy/caddy/Caddyfile.example`:
  - `{$FLUXIQ_SITE_ADDRESS}` with automatic TLS and `email {$ACME_EMAIL}`.
  - `handle /client` sends traffic to `fluxiq:4777`. It sets no `stream_timeout`, so there is no
    cap on sockets, and `stream_close_delay 5m` keeps sockets open across config reloads.
  - Everything else goes to `fluxiq:3000` with `flush_interval -1` for streaming.
  - Both routes use `header_up X-Forwarded-For {remote_host}`. Combined with Caddy's default of
    no `trusted_proxies`, a client cannot choose the address Core trusts.
  - It sets HSTS, nosniff and `Referrer-Policy`, and removes the `Server` header.
  - There is no access log, because connect query strings must stay out of proxy logs.
- `deploy/env/self-hosted.env.example` and `deploy/env/service.env.example` contain only
  `example.org` placeholders. The `chrome-extension://<...>` entries are rejected by Core's
  allowlist grammar (`[a-p]{32}`), so the gateway fails closed until they are replaced.
  `deploy/env/.gitignore` and `deploy/secrets/.gitignore` ignore everything except the examples
  and themselves.
- `.github/workflows/deploy.yml`:
  - Triggered by `workflow_dispatch` only, with `contents: read`.
  - Job `image` builds with buildx (GHA cache) and runs `smoke.sh` for both profiles.
  - Job `deploy` has `if: ${{ vars.FLUXIQ_DEPLOY_ENABLED == 'true' }}` (that variable is unset),
    names no target and no secret, and fails with a message if it is ever enabled before a
    target is added.
  - `ci.yml` is untouched.
- `docs/operations/self-hosting.md` covers:
  - topology and profiles;
  - files, building, the smoke test, server and DNS;
  - running self-hosted, claiming the owner (the generated code at
    `/data/.fluxiq/security/setup-code`) and connecting the extension;
  - the service profile, the provisioning listener (binding, CIDRs, token format and rotation,
    the command line) and the `multi` licence note linking `COMMERCIAL-LICENSING.md`;
  - the settings reference, secrets, health, readiness, logs and drain;
  - backups (with the server stopped, as a volume tar), upgrades (forward-only, no implicit
    migration), restores, running without Compose, and CI.

  `docs/README.md` links it under the operations entries.

## Commands run and observed results

All were run in `C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQ`.

| Command | Result |
| --- | --- |
| `pnpm structure:check` | `structure-audit: passed (529 warning(s), 969 baselined).` Filtered for `deploy/`, `.dockerignore`, `self-hosting`, `next.config`, `healthcheck`, `smoke` and `workflows/deploy`: no lines, so no violations or warnings come from these files. |
| `node scripts/structure-audit.mjs --rule docs-links` (the docs-links half of `pnpm docs:check`; `docs/` is in its scope) | `structure-audit: passed (0 warning(s), 0 baselined).` Exit code 0. |
| `node <scratch>/w5-deploy-yaml-check.mjs <core>` (`yaml@2.9.0` from `node_modules/.pnpm`, strict mode with `uniqueKeys`) | All three files OK, with 0 errors and 0 warnings. deploy.yml: `on={"workflow_dispatch":null}`, `jobs=image,deploy`, deploy `if` as written. Both compose files: `fluxiq.ports=null`, `caddy.ports=["80:80","443:443","443:443/udp"]`, `read_only=true`. Service file: networks `edge,provisioning`, secrets `provisioning_token,setup_code`. |
| `bash -n deploy/docker/smoke.sh` | Exit code 0. |
| `node --check deploy/docker/healthcheck.mjs` | Exit code 0. |
| `pnpm exec biome check apps/web/next.config.ts deploy/docker/healthcheck.mjs` | "No files were processed": `biome.json` ignores both paths, so biome does not apply. |
| `node --test scripts/build-cache/tests/registry.test.mjs` | pass 9, fail 2. Test 6 fails with `next.config.ts reads FLUXIQ_WEB_STANDALONE, which web:build does not fingerprint`; this is caused by my change, and the fix is above. Test 5 fails with `fluxiq:build runs before the build of @fluxiq/sdk`. That one is not mine: my diff touches no `package.json` or `steps.mjs`, so it predates this brief or comes from another lane. |
| A scan of the new files for URLs, long tokens and `sk-` keys | Only `example.org`, loopback, `172.31.250.x` and long path strings. No secrets and no real hosts. |

The scratch script is
`C:/Users/osrs_/AppData/Local/Temp/claude/bc302d3e1bd85154/1d7e40a9-22b4-41e1-ad74-ba7e457da62b/scratchpad/w5-deploy-yaml-check.mjs`.

## Not verified

- **No Docker on this machine.** Nothing about the image is proven:
  - that the Dockerfile builds;
  - that `pnpm install --frozen-lockfile` works from the manifests alone (pnpm may warn that it
    cannot link the `fluxiq` bin before `dist` exists);
  - `pnpm deploy` under pnpm 9 (selection by path, `--prod`, the auto-installed `typedoc` peer,
    whether it needs the registry);
  - that the server starts, that the health check runs, and that `--read-only` works with Next
    at runtime (if any page revalidates, ISR writes to `.next/server` would fail);
  - two copies of the native `sqlite3` in one process (the standalone trace and the gateway's
    deploy). Both are N-API and loaded from different paths, which should be fine.
- **The standalone build itself:** whether `next build --turbopack` (15.5) emits
  `.next/standalone` with `apps/web/server.js` under `outputFileTracingRoot`, whether it traces
  `sqlite3` and the instrumentation hook, and whether the identity check still passes.
- **Caddy was not run:** `caddy validate` has not been run, and `stream_close_delay`,
  `flush_interval -1` and `header_up X-Forwarded-For {remote_host}` replacing a client header are
  untested. This is the same gap as H0-S2.
- **The `caddy:2.10-alpine` tag** is from memory and not checked against the registry. The base
  images are not pinned by digest; I could not look one up offline and would not invent one.
- **Compose behaviour:** `docker compose config` was not run, so `env_file` interpolation,
  `ipv4_address` on an `internal` network and file secrets readable by uid 1000 are unproven.
- **The workflow** has not run. The action versions (`docker/setup-buildx-action@v3`,
  `docker/build-push-action@v6`) are not checked against what is current in 2026-11. The service
  smoke's `createAccount` flags (`--policy FluxIQUserAccess --workspace new`) are inferred from
  the contracts and the CLI flag map, not executed. Whether provisioning is allowed before the
  owner is claimed on `service` is unknown.
- **Shutdown:** the doc and the smoke assume SIGTERM leads to a drain and then an exit (the code
  in `lib/fluxiq.ts` exits with 143). The smoke prints the exit code but does not assert it.

## Exact command to verify the standalone build (for the supervisor, serially)

Apply the `steps.mjs` change first. Then, from the Core worktree, in Git Bash:

```sh
cd "C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQ" && FLUXIQ_WEB_STANDALONE=1 pnpm build && ls apps/web/.next/standalone/apps/web/server.js && ls apps/web/.next/standalone/node_modules/.pnpm | grep -E "^(sqlite3|next)@"
```

Note: the `!` in the worktree path broke webpack under `next dev` in H0, but this build uses
turbopack. A cached non-standalone `web:build` would be reused only if the `steps.mjs` change is
missing. With Docker available:

```sh
docker build -f deploy/docker/Dockerfile -t fluxiq-core:local . && bash deploy/docker/smoke.sh fluxiq-core:local self-hosted && bash deploy/docker/smoke.sh fluxiq-core:local service
```

## Open questions or contradictions found

1. The plan says a public profile "defaults to the product's extension IDs plus
   `moz-extension://*`". The code has no default: `clientGatewayOriginStartRefusal` requires the
   allowlist to be set. The env examples therefore ship placeholders that fail closed until the
   store IDs exist.
2. `.gitattributes` has no `*.sh text eol=lf`. On a Windows checkout with `autocrlf`,
   `smoke.sh` could get CRLF line endings and fail locally (CI on Linux is unaffected). I did not
   change it because the path is not mine.
3. Registry test 5 (`fluxiq:build runs before the build of @fluxiq/sdk`) already fails in this
   worktree, independent of this brief.
