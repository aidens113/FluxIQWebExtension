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

The deterministic pages include `/scenarios/basic-form/`,
`/scenarios/dynamic-list/`, `/scenarios/navigation/start`, and
`/scenarios/llm-target-drift/`. Responses use a
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

## Controlled LLM diagnosis fixture

`llm-target-drift` records one successful click against
`data-testid="diagnosis-target"` in baseline mode. Its visible controls switch
the persistent in-memory fixture to a missing target, a deliberately renamed
replacement, or the restored baseline. Every transition is available through
the authenticated fixture API as well:

- `POST /api/llm-target-drift/set-mode` with `{ "mode": "missing" }` or
  `{ "mode": "renamed" }`
- `POST /api/llm-target-drift/restore`
- `GET /__control/final-state?scenario=llm-target-drift`

The final-state response is the exact oracle: seed marker, mode, activation and
transition counts, last operation, recorded/rendered target IDs, target
presence, and expected result text. Missing mode remains unchanged across page
reloads and rejected activation mutations, so a diagnosis run and a fresh
no-LLM run encounter the same deterministic failure. `restore` clears the
activation count; the global reset restores the original seeded state.
