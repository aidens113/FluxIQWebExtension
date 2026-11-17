# sweep-fix-stale report

## Outcome
Done. All three failures fixed; one caveat on how `domain check` was run (see Commands).

## What changed and why
1. CORE `packages/fluxiq/src/platform/iam/catalog/generated/assistant-tools.generated.json`, regenerated with `FLUXIQ_REGENERATE_ASSISTANT_TOOLS=1`. Diff is +12 lines, only two entries, both in the `hidden` (never offered) list: `automation-studio__list-recent-flow-runs` and `automation-studio__list-workspace-flow-summaries`. Their classification comes from the endpoints' own `assistant: { hidden: "..." }` in `across-projects.ts` (t915). Nothing else changed. Observation: the hidden reasons end with "people ask for their runs / the Flow list", which reads as a reason to offer them, but they duplicate the per-project listings that are offered; the wording is Core's to tidy (not edited, outside owned paths).
2. EXT `carried-row-service-repair.test.ts` line 128 and `carried-service-repair.test.ts` line 110: renamed the fixture port `createSessionRevealAuthorization` to `createUseAuthorization` (same argument-free async return shape, which satisfies Core's `AutomationStudioSessionKeyPorts.createUseAuthorization(input)`). Core not edited.
3. EXT `script-examples/tests/parity.test.ts`: the loop pin moved from 8808 bytes / sha 6713cc27... to 8977 bytes / sha 206bc7db...b817. Cause: the rendered loop section is Core's grammar (`AUTOMATION_STUDIO_FLOW_SCRIPT_LOOP_FORMAT`) plus the EXT example tail. The EXT example sources (`loop.ts`) have not changed since 2026-11-05. Core commit 9f95a265c (2026-11-11, task t885, "Refuse an endless loop when it is written, and stop teaching a count as the way out") rewrote two grammar lines in `flow-script-format.ts`; the changed lines add exactly 169 bytes (714 to 883), equal to 8977 - 8808. So the change is deliberate and fully accounted for. "Never teaches to the test" check: the new text is generic grammar about `repeat while` / `repeat most`, with no scenario, site, product or answer content; the example tail (library search, invoices) is untouched. Re-pinned. Other three section pins and the completion-schema digest still pass.

## Commands run and observed results
- CORE `FLUXIQ_REGENERATE_ASSISTANT_TOOLS=1 pnpm exec vitest run src/programs/_shared/assistant` -> 7 files, 36 tests passed. Then `pnpm --filter fluxiq exec vitest run src/programs/_shared/assistant` (no regenerate) -> 7 files, 36 passed.
- EXT `node scripts/test-domain.mjs script-examples/tests/parity carried-row-service-repair carried-service-repair` (in domain) -> tests 12, pass 12, fail 0.
- Rebuilt Core libs (`pnpm --filter @fluxiq/contracts --filter @fluxiq/sdk --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/ui-components build`) -> exit 0, because the guard in `domain check` demanded it after the JSON changed.
- EXT `pnpm --filter @fluxiq-web-extension/domain check` -> still exit 1, only from the Core-currency guard ("fluxiq:build inputs changed: packages/fluxiq"; "ui-components: no stamp"). The Core build log said inputs changed while it ran: another t918 worker is editing CORE `framework/automation-service/service/fluxnode/tests/*` (visible in `git status`), so the stamp cannot settle. It is not a type error.
- Instead ran the check's own tsc steps directly in `domain`: `tsc -p tsconfig.json --noEmit` and `tsc -p tsconfig.test.json --noEmit` -> no output, exit 0 (both the src and test configs, which previously had the two createSessionRevealAuthorization errors).

## Not verified
- `pnpm ... domain check` end to end through the build cache wrapper (blocked by the concurrent Core edit above); rerun it once the other worker is done and Core libs are rebuilt.
- Full domain suite was not run, only the three files.

## Open questions or contradictions found
- Hidden-reason wording for the two new endpoints (above), Core's to decide.
