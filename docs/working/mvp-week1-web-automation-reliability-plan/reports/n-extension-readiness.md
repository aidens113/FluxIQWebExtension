# `n-extension-readiness` — harden cold MV3 readiness

## Outcome

Implemented and verified. The runner now gives a cold Manifest V3 worker one
fixed 30-second readiness window, accepts only a `chrome-extension:` service
worker, and closes the observation-zero/subscription race. A timeout is an
`extension.worker` failure whose details contain only `timeoutMs`, the number
of observed worker objects, and whether the browser is connected. Worker URLs
never enter the diagnostic.

`run-scenario.ts` now obtains the worker through the lifecycle barrel before it
creates the extension control page. The former first-worker, 10-second inline
wait is gone.

## Files changed

- `packages/test-runner/src/run-lifecycle/extension-readiness.ts` (new)
- `packages/test-runner/src/run-lifecycle/tests/extension-readiness.test.ts` (new)
- `packages/test-runner/src/run-lifecycle/index.ts`
- `packages/test-runner/src/run-scenario.ts`
- `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`
- this report

No Core file, shared architecture document, Lab artifact, commit, or remote was
changed.

## Behavior and focused proof

The helper checks the current service-worker list before subscribing, then
subscribes and checks the list again so a registration at that boundary cannot
be missed. Both event and timeout completion remove the listener and clear the
timer. A `Set` counts worker objects without retaining or publishing their URLs.

The five focused tests cover:

1. an extension worker present at observation zero, without subscription;
2. an extension worker arriving at 12 seconds, beyond the old deadline;
3. refusal of an unrelated HTTPS service worker followed by acceptance of the
   extension worker;
4. exact closed timeout diagnostics and listener/timer cleanup; and
5. a worker registered while the listener is attached.

The runner-wiring test pins the lifecycle-barrel import, readiness before
`context.newPage()`, and absence of the old `waitForEvent("serviceworker")`.

## Mutation proof

The final source hash before mutation and after both restorations was
`8FD5FA66F22839FD4D7960668DCB7CB71A9D608D28DFF8E4726488F92648F404`.

- Deadline mutation: changed the fixed deadline from 30,000 to 10,000 ms. The
  focused suite failed `a Chrome extension worker arriving after the old
  ten-second boundary is accepted` with `10000 !== 30000`; the exact timeout
  diagnostic test also failed with actual `timeoutMs: 10000` versus expected
  `30000`.
- Protocol mutation: accepted any parseable URL protocol. The focused suite
  failed `an unrelated service worker is observed but never accepted` and the
  timeout test failed with `Missing expected rejection.`

Both mutations were restored; the focused suite then passed 5/5 and the hash
matched byte-for-byte.

## Validation

- `pnpm --filter @fluxiq-web-extension/test-runner check`: passed after the
  final restoration.
- Focused private-output compile plus
  `node --test .../run-lifecycle/tests/extension-readiness.test.js`: 5/5 passed.
- `pnpm --filter @fluxiq-web-extension/test-runner test`: 697 tests passed,
  zero failed. This shared run included the concurrently completed HTTP startup
  diagnostics at their stable source.
- Structure audit with a scratch `GIT_INDEX_FILE` containing the five owned
  source/test paths: passed with 51 advisory warnings and 17 existing baselined
  entries; no baseline change.
- `git diff --check` on the owned source/test paths: passed.

## Not verified

No Lab command was authorized for this brief. A live cold-start run must still
show that a worker which appears after 10 seconds but before 30 seconds proceeds
to the side panel, and that a true 30-second absence produces the bounded
`extension.worker` diagnostic without a URL. The final narrow stress matrix in
`m-runner-flake-diagnosis.md` remains the live acceptance proof.
