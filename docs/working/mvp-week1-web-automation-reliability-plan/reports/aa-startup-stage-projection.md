# `aa-startup-stage-projection` — completion report

## Result

Implemented the separate closed topology-readiness timeout diagnostic. All four
applicable coordinator HTTP waits now identify only `scenario.health` or
`core.health`. A staged timeout has the fixed category/message and details:

```text
process.startup / Topology startup wait timed out
{ bounded: timeout, operationStage, timeoutMs }
```

The durable projector verifies the exact category, fixed message, timeout kind,
two-value stage allowlist, and positive safe-integer timeout no greater than
300,000 ms. It constructs a fresh three-field object. URL, target, port, path,
body, raw message, cause, and arbitrary detail fields are never projected; the
timeout error's own message contains no target. The run error event publishes
only this projection.

TCP readiness remains `gateway.connection`. The existing HTTP transport
projector and its operation-stage/transport-code allowlists remain separate and
reject the topology timeout shape.

## Files changed

- `packages/test-runner/src/http-control.ts`
- `packages/test-runner/src/coordinator.ts`
- `packages/test-runner/src/run-scenario.ts`
- `packages/test-runner/src/tests/http-control-wait.test.ts` (new)
- `packages/test-runner/src/tests/coordinator-existing.test.ts`
- `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`

These files already contained the supervisor's other accepted-tree work; I
preserved it and changed only the topology-readiness diagnostic and tests.

## Coverage

- Both closed stages are forced through a real bounded `waitForHttp` timeout.
- Exact thrown and projected shapes are asserted.
- A raw sentinel is injected through the URL, extra details, and nested cause
  and proven absent from the durable projection.
- Category, message, bounded kind, stage, and integer/range near misses fail
  closed.
- The topology and HTTP transport projectors are proven disjoint.
- Existing-mode runtime spying and source-boundary assertions cover all four
  coordinator stage assignments and preserve the separate TCP classification.
- Runner event-boundary wiring proves selection and durable publication without
  a direct details spread.

## Mutation evidence

Four deliberate mutations were run against built focused tests and restored:

1. Changed the existing Core readiness assignment to `scenario.health` — two
   coordinator tests failed.
2. Replaced the fresh projector object with a raw `details` spread — the exact
   shape/sentinel test failed.
3. Removed the closed stage-membership check — the `gateway.tcp` near miss was
   incorrectly projected and its test failed.
4. Removed the topology projection from the durable run error event — the
   event-boundary wiring test failed.

## Validation

- Focused build plus 24 owning tests — passed, 24/24.
- `pnpm --dir packages/test-runner check` — passed.
- `pnpm --dir packages/test-runner test` — passed, 705/705 tests.
- Scoped `git diff --check` — passed; only existing line-ending warnings were
  printed.

No browser or Lab run was required for this diagnostic boundary. I did not edit
Core or shared working documents and did not commit or push.
