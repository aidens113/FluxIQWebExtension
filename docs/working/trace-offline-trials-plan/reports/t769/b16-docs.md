# t769 b16-docs

## 2026-10-27
- Core `docs/architecture/automation-studio/client-gateway.md`: added "Offline trials in builds (P6)" under "Gateway traces and offline trials" (scope, source, host install and `FLUXIQ_OFFLINE_TRIALS=0`, outcome mapping, offline yes never stands, live-only accounting, no reset/look, live view fallback, tier 2 not bound, chat/status words, `NNNN-offline` folder).
- Core `docs/architecture/automation-studio/llm-flow-bootstrap.md` (the only other page describing the trial gate; no page names `NNNN-reset` or `core.test_subflow`): a three-line pointer after the gate bullet's refusal list.
- Downstream `docs/architecture/testing-facility.md`: paragraph + command block in "Offline trials over recorded traces" for the two headed specs, env vars, and the Lab `offline` category with `liveTrialCount`/`offlineTrialCount`.

## Commands
- `pnpm docs:check` (Core root) first: `Error: docs/reference/framework-reference.md is stale: the public surface changed.` (stale because of earlier source work, not these docs).
- `pnpm docs:reference` -> `Wrote docs/reference/framework-reference.md and packages/fluxiq/docs/reference/framework-reference.md (4178 public declarations).` Rewrote those two files.
- `pnpm docs:check` -> `structure-audit: passed (0 warning(s), 0 baselined).` / `Deterministic framework reference is current.`

## Not verified
Downstream relative link `../../../!FluxIQ/...` to Core not checked by a tool. Spec description taken from B14's report (job-board whole window "no offline folder" predates D48; I did not assert it in the docs).

UNIT READY: Core docs/architecture/automation-studio/{client-gateway.md,llm-flow-bootstrap.md}, Core docs/reference/framework-reference.md, Core packages/fluxiq/docs/reference/framework-reference.md, downstream docs/architecture/testing-facility.md
