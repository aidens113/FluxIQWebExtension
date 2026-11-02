# Browser matcher integration

Outcome: Done. SOURCE FROZEN. Production source remains unchanged.

## Findings

The lead's initial selected run finished with 25 passing and 9 failing cases. Five failures asserted the old non-retryable ambiguity contract; the current closed failure map declares ambiguity retryable and unacted, and the existing target wait appends its five-poll exhaustion account. Three failures asserted full-page candidate counts or corroboration diagnostics while sending newer recorded place context, which correctly admitted fewer candidates or refused another landmark before scoring. The checkout case likewise sent its recorded summary landmark, making its target unique; it placed an order in the isolated fixture and navigated before the harness could receive the response.

Read-only comparisons against downstream `dev` found byte-identical `identity/place.ts`, `identity/veto.ts`, `identity/context.ts`, `action-runtime/resolve-target.ts`, `action-runtime/recovery/fault.ts`, `action-runtime/recovery/attempt.ts`, `actions/execute.ts`, `domain/src/runtime/failure/codes.ts`, and the three selected browser specs. After applying only the factory/import migration to `dev`'s `identity/score.ts`, TypeScript's emitted JavaScript with comments removed is byte-identical to the current scorer. The separate original Core matcher comparison still passes all 582 score/rank/selection/projection comparisons with identical default weights.

## Changes

Only four browser test files changed:

- `identity-fixtures.ts` expects the authoritative retryable, unacted ambiguity record.
- `identity-ambiguity.spec.ts` retains exact candidate descriptions/scores and additionally expects the existing exhaustion suffix.
- `identity-resolution.spec.ts` explicitly exercises legacy descriptors without place context for the original calibrated ranking and ambiguity assertions. Current recorded row and summary landmark context is separately checked through read-only extraction using the same target resolver. The checkout ambiguity case retains its exact scores, empty orders assertion, and now also asserts zero clicks. Cart ranking retains its exact winner score/confidence, adds the exact runner-up score, and names the existing `scored-candidate` strategy. Redesigned-submit retains its full recorded place and exact original scores/no-form-action assertions, expecting the four candidates admitted by that scope.
- `identity-veto.spec.ts` explicitly exercises an older recording without place context so its original positive-score corroboration refusal remains the deciding safety rule. The recorded banner is asserted before omitting context.

No production weights, thresholds, target filters, retry behavior, fixture data, or matching implementation changed. Every browser page is one of the approved realistic scenarios, with a separate run-scoped Scenario Lab; no user browser data, model calls, or panel server is used.

## Validation

- Lead initial command: `pnpm.cmd --filter @fluxiq-web-extension/extension test:content -- --workers=2 identity-resolution.spec.ts identity-ambiguity.spec.ts identity-veto.spec.ts` -> 25 passed, 9 failed, 2.5 minutes; causes above.
- `node node_modules/.cache/matcher-migration/parity.mjs` in `domain` -> 582 exact comparisons passed, all default weights identical.
- `node domain/node_modules/.cache/matcher-migration/identity.mjs` -> 25 isolated source-alias unit entries, 222 tests passed, 0 failed.
- TypeScript `transpileModule` parse probe for the four edited browser files -> 0 diagnostics.
- Same selected Chromium command after the lead confirmed the Core build stamp current -> 31 passed, 3 failed, 2.9 minutes. The checkout no-order/zero-click assertions and both scoped reads passed, as did ambiguity retry and legacy corroboration. Two remaining cart failures expected `selector` instead of the existing `scored-candidate` label; exact winner score/confidence were unchanged. One redesigned-submit failure came from unnecessarily removing its place context, admitting an unrelated header control; full context was restored and the admitted count corrected to four.
- Final same selected Chromium command after those test-only corrections -> **34 passed, 0 failed, 1.8 minutes**, Chromium with two workers. The Playwright `.last-run.json` independently records `status: "passed"`, `failedTests: []`; HTML report is `apps/extension/e2e/test-results/content/report` (ignored). Log: `.fluxiq/refactor-browser-final.log` (ignored).
- The final PowerShell `*>` log wrapper returned status 1 after treating Playwright's `NO_COLOR`/`FORCE_COLOR` stderr warning as a `NativeCommandError`, despite the completed passing test report. No test or pnpm failure appears in the final log. The repository test runner directly propagates Playwright's status; future redirected invocations should explicitly return `$LASTEXITCODE` to avoid the shell wrapper ambiguity.

Not verified: package-wide type/structure checks, full browser suites, extension installation/background lifecycle, live provider execution, or a separate launched `dev` checkout. Baseline equivalence is established by the read-only source comparisons and original scorer parity above. These are outside this brief; Core source is frozen. No processes from these browser runs remain in flight.
