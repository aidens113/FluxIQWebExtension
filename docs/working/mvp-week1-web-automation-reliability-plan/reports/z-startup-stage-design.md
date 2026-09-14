# `z-startup-stage-design` — closed topology-wait diagnostics

## Scope and inventory

The smallest useful closed stage set is:

```ts
const TOPOLOGY_STARTUP_STAGES = ["scenario.health", "core.health"] as const;
```

These two labels cover every explicit pre-browser topology readiness wait that
can currently end as a bounded `process.startup` timeout:

| Mode | Coordinator operation | Stage |
| --- | --- | --- |
| isolated / persistent-isolated | wait for the spawned Scenario Lab `__control/health` | `scenario.health` |
| isolated / persistent-isolated | wait for the spawned Core web root | `core.health` |
| existing | wait for the configured Core base URL | `core.health` |
| existing | wait for the spawned Scenario Lab `__control/health` | `scenario.health` |

Mode does not belong in the stage: the durable run configuration already says
which topology was requested, and local versus existing Core does not change
the readiness operation. Four call sites therefore need only two labels.

The TCP gateway poll is pre-browser but is deliberately outside this set. Its
timeout is `gateway.connection`, not `process.startup`; it should retain that
category and must not be made indistinguishable from Core HTTP readiness merely
to reuse this projector. Likewise `auth.login` is `environment.missing`, project
creation is `recording.persistence`, and `project.select` already belongs to the
closed HTTP-operation stage family. They are bounded pre-browser operations,
but they are not topology readiness waits producing the W19-shaped 60-second
`process.startup` timeout.

## Error and projector contract

`waitForHttp` should accept the required stage from each coordinator call and,
only for these staged topology waits, throw a fixed-message `RunnerFailure`:

```text
category: process.startup
message: Topology startup wait timed out
details: { bounded: timeout, operationStage: <closed stage>, timeoutMs: <bound> }
```

One `topologyStartupWaitFailureDetails(error)` projector should return exactly
those three detail fields, and only when all are valid: `RunnerFailure`, category
`process.startup`, the fixed timeout message, `bounded === "timeout"`, a member of
`TOPOLOGY_STARTUP_STAGES`, and a positive safe-integer timeout within the chosen
startup ceiling. It must construct a fresh object rather than spread `details`.
Malformed, foreign-category, abort, unknown-stage, and out-of-range inputs return
`undefined`.

The target URL must disappear from both the thrown message and details. The
last fetch error may remain a private `cause`, but neither the projector nor the
durable event reads it. The projector selects three scalar allowlisted values,
so injected `url`, `target`, `port`, `body`, `message`, nested `cause`, headers,
or tokens cannot survive. `run-scenario.ts` should add this projection to the
existing caught-error event exactly as the other narrow projectors do.

This remains separate from `httpTransportFailureDetails`: the transport
projector recognizes only the fixed `FluxIQ HTTP transport failed` message and
the existing HTTP operation-stage/code allowlists; the topology projector
recognizes only bounded readiness timeouts and the two disjoint readiness
stages. Neither should call, fall through to, or broaden the other.

## Exact implementation and test partition

- `packages/test-runner/src/http-control.ts` — add the two-value topology stage
  type/allowlist, accept a stage on `waitForHttp`, emit the fixed bounded timeout,
  and export the closed projector. Keep the transport projector unchanged.
- `packages/test-runner/src/coordinator.ts` — label all four readiness calls with
  the table above. Do not label or reclassify `waitForTcpGateway`.
- `packages/test-runner/src/run-scenario.ts` — invoke the topology-timeout
  projector in the catch path and publish its result as `failureDetails` without
  ever spreading `error.details`.
- `packages/test-runner/src/tests/http-control-wait.test.ts` (new) — force a
  short staged timeout for each enum member; assert the exact fixed error and
  exact projected object. Feed a raw sentinel through URL, target, port, body,
  message, extra details, and nested cause and prove it is absent. Assert near
  misses (category, message, bounded kind, stage, timeout) project nothing, and
  prove an HTTP transport failure is accepted only by the transport projector.
- `packages/test-runner/src/tests/coordinator-existing.test.ts` — extend the
  injected wait spy to record options and assert existing Core maps to
  `core.health` and Scenario Lab maps to `scenario.health`, in order.
- `packages/test-runner/src/tests/coordinator-persistent.test.ts` — add the
  corresponding isolated/persistent mapping seam, or extract a pure call-site
  mapping if exercising process startup would be disproportionate; assert the
  same two labels and that TCP remains separately classified.
- `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts` — assert
  import, projector invocation, durable `failureDetails` spread, and absence of
  a direct topology `error.details` spread.

The three production files form one serial implementation partition because
they share the new contract. The three owning test files are independent after
that API stabilizes; no test worker needs to touch a production file.

## Mutation proof required

1. In `coordinator.ts`, delete or swap each distinct stage assignment; the
   topology mapping tests must fail (both modes and both services are covered).
2. In `http-control.ts`, independently omit `bounded`, `operationStage`, and
   `timeoutMs`; exact timeout/projector tests must fail.
3. Restore the raw URL-bearing message or spread raw details; the fixed-message
   and sentinel non-disclosure assertions must fail.
4. Broaden one projector gate at a time (category, fixed message, bounded kind,
   closed stage, numeric bound); its matching near-miss assertion must fail.
5. Let either projector accept the other's failure shape; the separation test
   must fail.
6. In `run-scenario.ts`, remove the projector call or durable projection; the
   runner wiring test must fail.

No build, test, browser, or Lab command was run. No product, generated, shared
working-document, Core, commit, or remote state was changed; this report is the
only file written.
