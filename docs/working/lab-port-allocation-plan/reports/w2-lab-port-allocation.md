# Testing Lab Explicit Port Preflight

Status: Complete; explicit unbindable demo ports now fail before topology startup
Updated: 2026-09-20
Owner: `w2-lab-port-allocation`

## Result

The 108.101-second delay was caused by an explicitly pinned demo gateway port,
not by ordinary Testing Lab allocation. The ordinary allocator proves each
ephemeral port by binding `127.0.0.1:0`; the demo workspace instead parsed the
ports in `FLUXIQ_DEMO_BASE_URL` and `FLUXIQ_DEMO_GATEWAY_URL` and did not test
them until Core tried to bind after setup/build work.

The smallest test-facility fix adds an explicit loopback bind preflight to the
allocator and invokes it for both demo panel and gateway ports before path
preparation, builds, identity setup, or Core startup. The ordinary port-0
allocation and product runtime networking are unchanged.

## Live-first evidence

Before editing, a direct bind of the known Windows-excluded port produced:

- requested port: `49873`
- result: `EACCES`
- elapsed: `13.026 ms`

In the same pre-change environment, 50 calls to the ordinary compiled
`allocateLoopbackPort()` produced 50 distinct ports from `53793` through
`53842` in `35.169 ms`; none was `49873`. This confirms that the allocator did
not select the excluded port. The prior smoke's one-off explicit
`FLUXIQ_DEMO_GATEWAY_URL` pin owned the delay.

After the source change, the live preflight produced:

- `FLUXIQ_DEMO_GATEWAY_URL 49873 cannot be bound on 127.0.0.1 (EACCES)`
- rejection elapsed: `13.316 ms`
- bindable replacement selected through the ordinary allocator: `53970`
- replacement was distinct from `49873` and passed the same preflight in
  `2.591 ms`

After the focused package build, the compiled real `withPersistentDemoCore`
caller rejected the pinned `49873` with the same labeled `EACCES` in
`4.009 ms`. The configured disposable workspace path did not exist afterward,
confirming rejection occurred before topology preparation. Compared with the
observed 108.101-second delayed failure, this is a fail-fast reduction of more
than 108 seconds for this host condition.

## Changes

- `packages/test-runner/src/allocation.ts`
  - added `assertLoopbackPortBindable(port, label)`;
  - validates the requested range, binds the exact loopback port, closes it,
    and preserves the OS error code in a labeled failure;
  - reused a small close helper for the existing allocator.
- `packages/test-runner/src/demo-workspace/core-process.ts`
  - preflights explicit panel and gateway ports immediately after parsing and
    distinctness validation.
- `packages/test-runner/src/tests/allocation.test.ts`
  - proves a free requested port is accepted;
  - proves an already held requested port is rejected with its label, port,
    loopback address, and `EADDRINUSE` code.

## Focused validation

- `pnpm --filter @fluxiq-web-extension/test-runner build` — passed.
- `node --test packages/test-runner/dist/tests/allocation.test.js packages/test-runner/dist/demo-workspace/tests/core-process.test.js`
  — passed, 19/19 tests in `4198.398 ms`.
- `git diff --check` — passed with the source changes and this report present.
- No repository-wide suite or provider-backed test was run.

## Limits and recommendation

Windows excluded ranges can change with host networking configuration, so the
fix intentionally trusts the bind result rather than parsing `netsh` output.
As with the existing ephemeral allocator, a narrow time-of-check/time-of-use
race remains after the probe socket closes and before the child process binds;
that race already surfaces as startup failure and is unrelated to the stable
excluded-port failure fixed here.

Explicit demo ports retain fail-fast semantics rather than silently changing
the caller's requested endpoints. Persistent Scenario Lab ports keep their
existing safe-fallback contract, and ordinary disposable ports keep using the
allocator. No Core, extension, product runtime, panel/profile/store, or
provider behavior was touched.
