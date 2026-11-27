# Brief t1083: a step passed over as "not arisen" still reaches where it went

**Goal.** In live bigbox run-mwz29d50, attempt 2's replay skipped "Add to cart" as already done, which is correct.
"View cart", written on the "Added to cart" panel that only an add opens, was then not found and was passed over
as `executor.state.not_arisen`. So the cart read ran four times on the product page and found nothing. That step's
own recorded effect was the move to the cart: `routeSignatures.before.path` and `after.path` differ. Passing over
the step must not drop where it went. Fix this at the root, with no new counts, caps or waits.

**Read first.** These are your context:
- `docs/working/page-diff-delivery-plan/reports/run-mwz29d50-bigbox.md`, sections "Why the run was still on the
  product page", "The change and the line" and "F1";
- Core `packages/fluxiq/src/engine/automation/state-routing/not-arisen.ts`, `decision.ts` (`:100-210`, including
  `followOnLasts`) and `reopen.ts`.

**Design constraints.**
- **Core reads no link, address or page words.** Core decides only that a passed-over step whose recorded effect
  changed the page's route still owes that route. The run must be on that route before the next step.
- **The domain reaches the route.** That is the web domain's job (`domain/src`): through a seam that exists already,
  or a new port you name, which Core calls generically. Preference order:
  1. already on that route: go on;
  2. press a visible control on the page whose address resolves to the same route (no `?` params), preferring a
     banner or navigation landmark over a covering layer;
  3. otherwise, go to the recorded destination.
- **Where the destination comes from.** If no step record keeps the destination today (only path hashes), record it
  at save time as the step's effect, beside `routeSignatures`. Never put it in identity: `from-packet.ts:62` keeps
  `href` out of identity on purpose.
- **Guards stand.** Reaching a route is no lasting act, so the already-done and double-add guards still hold. A
  step with no route change (a drawer's Close, a cover's dismiss) is passed over exactly as today.
- **The record says how.** The attempt records how the route was reached, so `replay-stands.ts` can still tell a
  step passed over as saved from a routed one.

**Owned.**
- Core (`fxwork/t1083-not-arisen-reaches-destination/!FluxIQ`): `packages/fluxiq/src/engine/automation/state-routing/**`
  and the step-record and port files the seam needs. Name every file in your report.
- Downstream: `domain/src/**`, for the route-reaching side.

**Must not touch.**
- `runtime/result-verification/**` (t1084).
- `framework/automation-service/service/answer-first/task-memory/better-flow.ts` and
  `runtime/flow-authoring/draft/amendment/**` (t1085).
- `packages/test-runner/**` (t1082, t1086).

**Checks.** Put heavy commands through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1083-<label> -- <cmd>`.
- A state-routing unit test built from this run, as F1's "Offline proof" describes. Today it routes s12 straight
  to s13; after the fix it reaches the cart before s13.
- The Core tests beside the changed files: `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql <dirs>`
  from `packages/fluxiq`.
- The domain tests beside the changed files: `node scripts/test-domain.mjs <dirs>` from `domain/`.
- `node scripts/structure-audit.mjs` in both repositories, and `node scripts/check/model-text.mjs`.
- Update Core `docs/architecture/automation-studio.md` where it describes not-arisen.

No `node -e`, no git, no live or paid runs.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1083.md` in the downstream worktree, ending with the
return contract.
