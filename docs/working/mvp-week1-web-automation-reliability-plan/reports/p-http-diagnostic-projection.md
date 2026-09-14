# `p-http-diagnostic-projection` — persist the closed startup diagnostic

## Outcome

Implemented and verified. A run-level error event now retains the safe HTTP
transport projection that identifies the failed control stage. The projector
accepts only the five fixed stages, literal transport category `network`, and an
optional code from the existing transport-code allowlist. It constructs a new
object and never spreads the source details.

Invalid stages, invalid transport categories, invalid codes, other messages,
non-`RunnerFailure` values, and property-access failures project to nothing.
Path, URL, request body, credentials, raw error message, arbitrary detail keys,
and cause cannot cross this boundary.

## Files changed

- `packages/test-runner/src/http-control.ts`
- `packages/test-runner/src/run-scenario.ts`
- `packages/test-runner/src/tests/http-control-auth.test.ts`
- `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`
- this report

No extension, Core, contract, shared-plan, architecture, or generated tracked
file was changed.

## Implementation

`httpTransportFailureDetails` is owned beside `boundedFetch` and reuses the
same fixed operation-stage and transport-code sets. It additionally requires
the exact safe transport-failure message and `transportCategory: "network"`.
Its result contains exactly:

- `operationStage`;
- `transportCategory: "network"`; and
- `transportCode` only when present and allowlisted.

`runScenario` calls the projector in its catch boundary and places only its
return value under the durable error event's existing `failureDetails` field.
The run still retains its normal failure category and safe generic summary.

The HTTP control test now counts rejected fetch calls and proves a
`project.create` transport rejection makes exactly one attempt. It also feeds a
synthetic failure carrying path, body, message, cause, and credential-like
sentinels through the projector and proves only the three closed fields survive.
Negative rows reject an incorrect message, an unknown stage, and a non-allowlisted
code. The runner wiring test pins the projector call and its event-boundary
publication.

## Mutation proof

I replaced the run catch's projector call with `undefined`, rebuilt, and ran the
owning runner-wiring test. It exited 1 with exactly the intended new test failing:

`the runner publishes only the closed HTTP transport projection in its durable error event`

The failure stated that the caught startup failure was no longer passed through
the closed projector. The mutation was restored, and the focused suite returned
to 20/20 passing.

The final source hashes after restoration equal the pre-mutation hashes:

- `http-control.ts`: `39267FFF8EBF00D6EE1EB079AB80D11FD9747AB36409AE04B9E076295F453F6E`
- `run-scenario.ts`: `67EEDD39A84C3F0BFF5A6A70602650C03C5C3E040A4287EEA9E60020FC3C06AB`
- `http-control-auth.test.ts`: `7709A8609F167A859FC984B600F5E04229DAC61E427FD44B54B1B888B59B4342`
- `runner-wiring.test.ts`: `CE93C4997B68889A6F24AD7BD9B883CD0A1952AE4B7BDB905A2EB16C3E064F36`

## Validation

- `pnpm --filter @fluxiq-web-extension/test-runner check`: passed.
- Test-runner build: passed.
- Focused `http-control-auth` plus `runner-wiring` tests: 20/20 passed after
  restoration.
- `git diff --check` over the four owned tracked paths: exited zero; only the
  repository's existing LF-to-CRLF working-tree warnings were emitted.

The complete test-runner and root suites were not rerun in this worker because
the brief asked for focused checks and the supervisor owns final integration.
No Lab run was needed: this change controls durable failure-event projection,
and its event-boundary wiring and closed-field behavior are directly tested.

I did not commit or push.
