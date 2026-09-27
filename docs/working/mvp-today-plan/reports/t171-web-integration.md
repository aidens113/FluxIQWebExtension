# t171 — Web integration

## Outcome

Complete. The in-progress browser/domain defensive-execution and extraction tree is internally
consistent. The two name-resolution expectation changes described by the brief are already
reconciled in the current checkout: the domain suite exercises nearest-name assumptions and the
extension suite exercises exact target corroboration, and both pass without further source edits.

The review follow-up is also complete. Recovery now re-checks the command/defence wall-clock
budget after every backoff and before dispatching another verb. A clipped wait that lands exactly
on `timeoutMs`, and a scheduler wake-up that overshoots it, both return the last real page result;
neither can start another content action. The clock is injectable only at this pure recovery seam
so the boundary and overshoot are deterministic unit tests. Generated domain and extension outputs
were rebuilt through their owning package scripts and remain ignored.

## Validation observed

| Command | Result |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/domain check` | passed |
| `pnpm --filter @fluxiq-web-extension/extension check` | passed |
| `pnpm --filter @fluxiq-web-extension/domain test` | 847 passed, 0 failed |
| `pnpm --filter @fluxiq-web-extension/extension test` | initial integration: smoke passed; 830 passed, 0 failed; deadline follow-up: smoke passed; 832 passed, 0 failed |
| focused compiled `recovery/tests/attempt.test` | 12 passed, 0 failed, including exact deadline and scheduler overshoot |
| `pnpm --filter @fluxiq-web-extension/domain build` | passed; regenerated `domain/dist` |
| `pnpm --filter @fluxiq-web-extension/extension build` | passed; regenerated browser bundles |
| `git diff --check -- apps/extension domain` | no whitespace errors; three existing CRLF conversion warnings |

## Remaining cross-repository failures and limits

No cross-repository compile, type, or test failure was observed through these package gates. The
domain tests exercised the linked Core checkout successfully. Whole-repository gates were not part
of this brief and were not run. Per the brief, no live Lab or browser run was started, so the
integrated tree's real-provider and real-page behavior remains unverified.

## Files changed by this task

- `apps/extension/src/content/action-runtime/recovery/budget.ts`
- `apps/extension/src/content/action-runtime/recovery/attempt.ts`
- `apps/extension/src/content/action-runtime/recovery/tests/attempt.test.ts`
- `docs/working/mvp-today-plan/reports/t171-web-integration.md`
