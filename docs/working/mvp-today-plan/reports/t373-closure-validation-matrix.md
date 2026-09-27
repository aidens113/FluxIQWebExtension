# t373 — closure validation matrix

## Verdict

The cross-repository unit is locally closable without a provider call, but only after validation
runs against a quiescent pair of working trees and in the order below. Core must be built before
downstream checks because the downstream links resolve Core `dist`; downstream `domain/dist` and
the web-panel host must then be rebuilt before test-runner or root tests. A green compile alone is
not closure. Live MVP proof remains separately blocked by the fix-first/no-unchanged-run rule and
requires fresh user authorization.

This matrix consolidates the current-state records and t368/t369/t370. The requested t372 report
did not exist when this report was written, so its documentation findings must be reconciled before
closure if it arrives later.

## Sequencing constraints

1. Stop edits and confirm that no Lab/campaign or other repository-wide validation is running.
   Do not run validation while either linked working tree is changing. Only one live Lab run may
   exist on the machine, although no live run is authorized in this phase.
2. Record both working-tree states and linkage identity. Preserve the output with the validation
   record; do not treat the current commits alone as identity because both trees are dirty.
3. Run focused Core tests first for fast fault localization.
4. Build Core, then prove downstream resolves that exact checkout, then rebuild downstream domain
   and host artifacts.
5. Run package gates, then each repository's full gates. Do not repeat focused tests merely to
   inflate the proof: full package/root suites subsume them after the focused diagnostics pass.
6. Review/update authored documentation and the two Current State records only after results are
   known. Commit/merge this repository before removing a paired Core worktree; finish Core under
   Core's own gates. Push both `dev` branches together only after supervisor verification.

## Validation matrix

All commands are PowerShell commands. `F:/!FluxIQ` is Core and
`F:/!FluxIQWebExtension` is downstream.

| Class | Working directory | Exact command | Required proof |
| --- | --- | --- | --- |
| Preflight / scope | downstream | `git status --short` | Every dirty path is understood and belongs to the coherent MVP unit; generated/runtime state is absent. |
| Preflight / scope | Core | `git status --short` | Same proof for Core; no unrelated or secret-bearing files are included. |
| Text integrity | downstream, then Core | `git diff --check` and `git -C F:/!FluxIQ diff --check` | Exit 0; no whitespace-error masking before expensive runs. |
| Narrow Core projection | Core | `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/tests/evidence-loop-steps.test.ts src/programs/automation-studio/runtime/flow-bootstrap/generation-failure/tests/diagnostics.test.ts src/programs/automation-studio/runtime/service/flow-bootstrap-commands/tests/evidence-trace.test.ts` | Exit 0. This is t370's 100-test projection/diagnostics/stored-trace proof: 129 represented steps survive; 130 is dropped by sanitization and rejected strictly. Record the actual count rather than assuming it remains 100. |
| Narrow Core discriminator | Core | `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts -t "reproduces\|converges"` | Exit 0 for both deterministic branches, zero provider calls. The exhaustion branch must retain completion feedback, exact decision grammar, record-producer visibility, and all 7–22 action inputs through decision 26 inside the 4,000-byte projection; the decision-23 `withoutInput: 4` failure recorded by t368 must be gone. |
| Core package gate | Core | `pnpm --filter fluxiq check` | Source typecheck exit 0 after the bound/projection changes. |
| Core package gate | Core | `pnpm --filter fluxiq test` | Entire `fluxiq` package suite passes; this subsumes the focused Core tests and detects broader runtime regressions. |
| Core artifact freshness | Core | `pnpm build` | Exit 0 and regenerated contracts, `fluxiq`, websocket gateway, and web-panel outputs. This must precede all downstream gates that consume Core `dist`. |
| Link identity | downstream | `Get-Item -LiteralPath domain/node_modules/fluxiq,domain/node_modules/@fluxiq/client-gateway-websocket | Select-Object FullName,LinkType,Target` | Both are junctions into `F:\!FluxIQ\packages\...`, not a store copy, Lab pair, or stale task Core. |
| Runtime identity | downstream | `pnpm --dir domain exec node --input-type=module -e "console.log(import.meta.resolve('fluxiq')); console.log(import.meta.resolve('fluxiq/core')); console.log(import.meta.resolve('@fluxiq/client-gateway-websocket'))"` | Resolved URLs are under `file:///F:/!FluxIQ/packages/` and point at the just-built `dist`. Do not add `@fluxiq/contracts`: it is not a direct domain dependency and is expected not to resolve here. |
| Downstream domain freshness | downstream | `pnpm --filter @fluxiq-web-extension/domain build` | Exit 0; `domain/dist` is regenerated after Core and domain-source changes. The test-runner guard only creates missing output and does **not** refresh stale output. |
| Downstream host freshness | downstream | `pnpm fluxiq:host:build` | Exit 0; regenerates `domain/dist/host/web-panel-host.mjs`, which the ordinary domain build preserves but does not create. Never delete `domain/dist` manually to obtain freshness. |
| Downstream package gate | downstream | `pnpm --filter @fluxiq-web-extension/domain check` | Domain source and tests typecheck against the rebuilt Core. |
| Downstream package gate | downstream | `$env:DOMAIN_TEST_BUILD_LABEL='t373-closure'; pnpm --filter @fluxiq-web-extension/domain test; $code=$LASTEXITCODE; Remove-Item Env:DOMAIN_TEST_BUILD_LABEL; if ($code -ne 0) { exit $code }` | Exit 0 with an isolated bundle; proves the domain behavior without racing the shared `.test-build`. Run an unlabelled domain test later only if the supervisor deliberately needs to regenerate the shared disposable test build. |
| Downstream package gate | downstream | `pnpm --filter @fluxiq-web-extension/test-runner check` | Exit 0 while consuming the freshly rebuilt `domain/dist`; covers propagation/type compatibility without silently refreshing stale output. |
| Downstream package gate | downstream | `pnpm --filter @fluxiq-web-extension/test-runner test` | Exit 0; covers the published progress/privacy/accounting consumers. The Current State's earlier 60/60 focused result remains supporting evidence, not a substitute for this final package run. |
| Downstream package gate | downstream | `pnpm --filter @fluxiq-web-extension/extension check` | Extension type/static checks pass against the finalized domain contract. |
| Downstream package gate | downstream | `$env:EXTENSION_TEST_BUILD_LABEL='t373-closure'; pnpm --filter @fluxiq-web-extension/extension test; $code=$LASTEXITCODE; Remove-Item Env:EXTENSION_TEST_BUILD_LABEL; if ($code -ne 0) { exit $code }` | Exit 0 using an isolated test bundle. |
| Downstream package build | downstream | `pnpm --filter @fluxiq-web-extension/extension build` | Exit 0 and fresh Chrome plus Firefox unpacked bundles. Compilation/build is artifact proof, not browser behavior proof. |
| Core docs | Core | `pnpm docs:check` | Architecture links/reference material pass. Manually confirm `docs/architecture/automation-studio/llm-flow-bootstrap.md` states the corrected represented-draft bound and does not claim iteration-only bounding. |
| Core full gates | Core | `pnpm check`, then `pnpm test`, then `pnpm build` | All three exit 0 from the finalized tree. The final build proves the checked/tested source still produces all distributable outputs. |
| Downstream full gates | downstream | `pnpm check`, then `pnpm test`, then `pnpm build` | All three exit 0 from the finalized tree. Root test/build cover every workspace; root check covers structure, Lab/task tooling, architecture-doc links, and all package checks. |
| Final cleanliness / identity | downstream, then Core | `git status --short`; `git rev-parse HEAD`; `git -C F:/!FluxIQ status --short`; `git -C F:/!FluxIQ rev-parse HEAD` | No generated outputs entered the tracked change set; record the two exact revisions plus dirty-path lists used for validation. After supervisor commits, repeat and require clean trees before claiming commit-level proof. |

## Full-gate exception handling

The recorded machine exception is the downstream root task fixture's inability to spawn
`git worktree add`. It is not a product failure, but it also is not a green `pnpm check`. If and
only if the same task-fixture failure recurs, record its exact stderr and exit code, then run the
remaining root-check constituents explicitly:

```powershell
pnpm structure:test
pnpm lab:test
node scripts/structure-audit.mjs
pnpm -r check
```

Also run `pnpm task:test` separately to retain the exact environmental failure. Report closure as
"all non-worktree gates pass; task fixture environmentally blocked," never as an unqualified root
check pass. Any different failure is a real blocker. Do not delete profiles, worktrees, caches, or
generated directories to try to clear it.

## Documentation proof

- Reconcile t372 if its report appears; it was absent during this matrix review.
- Update t355's stale statement that represented draft-step counts are iteration-bounded: the
  supported ceiling is seed capacity + append opportunities + iteration-zero observation (129).
- Confirm Core's current-state architecture documents describe the privacy-safe structural fields,
  sanitization/strict-parse behavior, and corrected bound. `pnpm docs:check` proves links and
  generated references, not semantic accuracy.
- Update `docs/working/mvp-today-plan.md` and
  `docs/working/language-driven-flow-loop-plan.md` with exact commands, counts, revisions, and the
  distinction between local readiness and still-missing live proof. Working docs are not covered by
  downstream's architecture-only docs-link rule.

## Live/provider boundary

No provider, live Lab, panel, or browser run belongs in this closure pass. The Current State binds
the phase to provider-free fixture evidence, and the task brief explicitly forbids live/provider
tests. A later live rung-1 attempt requires all of the following before it starts:

- the local matrix above is closed (or its exact environmental exception is recorded);
- a fresh no-hindsight authorization and explicit user authorization for the provider/live run;
- explicit panel-management authorization if the panel must be started or restarted;
- confirmation that no other live Lab run is in flight and that the selected checkout pair is
  pinned/current and quiet;
- configured credentials reported only by source/presence, never value; and
- a new run design that tests the source-owned correction — not an unchanged run 5 retry.

Even then, browser/live evidence is required for the MVP claims: successful creation, exact dataset,
self-judgement, applied and persisted repair, zero-provider replay, recursive post-replay judgement,
and terminal grant revocation. None can be inferred from compilation, deterministic fixtures, or
the current failed live measurements.
