# Debug: run-mvubv0rc-7e3d7b44 (social-network-feed recent group posts, demo run)

Status: Settled; fixed on Core `dev` (4d7c2264)
Run: `run-mvubv0rc-7e3d7b44`, lane t566, instance `demo-slot-3`, 2026-10-29, the user's requested demo run
Cost: none. The run ended in the Lab's prelude, before Core started, with 0 steps and no model call.

## What happened

- The Lab prelude rebuilt the extension, the domain and the test runner, then built Core's web panel
  for the run (`logs/core-web-build.log`).
- `next build` compiled, then failed its type check:
  `./src/server/security-audit/attach-gateway-audit-persistence.ts:2:46 Type error: Cannot find module
  '@fluxiq/contracts/client-gateway'`.
- With no panel, the scenario failed at `scenario.execute` (reason `unclassified`) and the run was
  recorded as failed, with `flowCreated: false` and no cost.

## Cause

Hosted lane A (t802, merged to Core `dev` 2026-10-29) added a web-app module that imports
`@fluxiq/contracts` directly. The web app does not depend on that package. Its everyday typecheck
(`tsconfig.json`, extending `tsconfig.base.json`) resolves it through the base `paths`, so
`tsc --noEmit`, the web tests and `pnpm check` all passed. The production build
(`tsconfig.build.json`) has no `paths` and cannot resolve it. Lane A's own code notes this rule
elsewhere (`client-gateway-websocket/origin-grammar.ts`, `request-guard/platform-contracts.ts`), and
the type is already re-exported by `fluxiq/client-gateway`.

The lead's verification of t802 ran the web typecheck and tests, not `next build`, so the defect
reached `dev`. The full sweep's `pnpm build` would have caught it; the next live run caught it first.

## Fix

- Core `dev` 4d7c2264: the module and its test import `ClientGatewayAuditEntry` from
  `fluxiq/client-gateway`.
- Validation: in lane t566 after syncing to that commit, `vitest run src/server/security-audit` ->
  "Tests 3 passed (3)"; the relaunched demo run's prelude runs the same `next build`.
- Structural follow-up: a structure-audit import boundary so nothing under `apps/web/src` imports
  `packages/contracts` directly, failing `pnpm check` at merge time instead of in a live run.
