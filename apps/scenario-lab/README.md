# Scenario lab

Deterministic loopback-only websites for extension and FluxIQ end-to-end tests.
The lab has no production dependencies and creates an isolated in-memory state
store for each server process.

## Commands

```powershell
$env:SCENARIO_LAB_RUN_TOKEN = "replace-with-a-random-16-character-token"
$env:SCENARIO_LAB_SEED = "42"
pnpm --filter @fluxiq-web-extension/scenario-lab build
pnpm --filter @fluxiq-web-extension/scenario-lab start
```

`SCENARIO_LAB_PORT` defaults to `0`, which asks Windows for an unused port.
The process prints one JSON readiness line containing the selected origin. It
always binds `127.0.0.1`; other bind addresses are rejected.

## Controller API

Every controller and mutation request requires
`Authorization: Bearer <SCENARIO_LAB_RUN_TOKEN>`.

- `GET /__control/health`
- `GET /__control/final-state?scenario=basic-form`
- `POST /__control/reset`
- `POST /__control/seed` with `{ "seed": 42 }`
- `POST /api/<scenario>/<operation>` for fixture-owned mutations

The deterministic pages begin at `/scenarios/basic-form/`,
`/scenarios/dynamic-list/`, and `/scenarios/navigation/start`. Responses use a
same-origin CSP and reject non-loopback `Host` headers. The E2E browser fixture
must additionally deny non-loopback browser requests so extension-originated
traffic is covered too.

## Scenario contracts

Every registered fixture exposes a validated `WebScenario` manifest through
`listScenarioManifests()` or `getScenarioManifest(id)`. A fixture module fails
at import time if its manifest is invalid or if its manifest id, title,
canonical seed, or start path disagrees with its rendering definition. These
canonical seeds are runner defaults; the isolated server may still apply an
explicit run seed to every fixture state.

The deterministic corpus is structurally loopback-only. Real-site probes use a
separate operational lane and must not be added to this registry.
