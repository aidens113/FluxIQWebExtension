# t730-c7-redaction-after-merge

## Outcome

Done. Both failing rows had a stale test fixture. The product changed on purpose, and nothing is wrong in src. After the update, the whole of `redaction.spec.ts` passes headed, 13 of 13. No secrecy assertion was weakened or removed.

## What changed and why

**Root cause.** Commit bca31a06 (lane G, "offline queue scoped to its session, project and recording; reconciliation, lease fencing and session pick on Core (audit phases 1 and 3a)") changed how the domain picks a session. The runtime adapter (`domain/src/runtime/adapter.ts`, `selectWebAutomationSession`) and the output dispatcher (`domain/src/io/gateway-output-dispatcher.ts`, `targetSessionId`) now use `pickWebAutomationSession`. That function applies Core's `clientGatewaySessionEligible` under `WEB_AUTOMATION_SESSION_CRITERIA` (`domain/src/runtime/web-sessions/criteria.ts`).

- **Old rule:** a `web.actions` capability counted if it declared the domain id or *any* `web.*` action type.
- **New rule:** it counts only if it declares the domain id or `web.dom.capture_snapshot`.

The spec's helper `throughTheDomain` used a fake gateway session with `capabilities: [{ id: "web.actions", actionTypes: ["web.dom.type"] }]`. Under the new rule that session is not eligible, so no session is picked and the command never reaches the faked `executeAction`. The dispatcher's no-session path then returns `web.action.failed` with no payload and no failure strings. That explains both observed failures:

- **Row "post-condition is secret-free after the hop"**: `payload.result.validation.status` was undefined.
- **Row "runtime adapter withholds undeclared failure record"**: `failure.expected` was undefined, and `failure.code` was `web.action.failed` where `web.validation.output_not_observed` was expected.

The secrecy assertions in those rows passed only because nothing was carried at all. While the fixture was stale, the rows proved nothing.

**Intentional change, not a defect.** bca31a06 updated its own domain fixtures the same way: `domain/src/runtime/tests/adapter-redaction.test.ts` and `adapter.test.ts` gained `metadata: { domainId: "web-automation" }`. `pick-web-session.test.ts` pins the narrower rule.

**Edits** (only `apps/extension/e2e/content/tests/redaction.spec.ts`):

1. The fake session's capability now declares `metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID }`. The constant is imported from `@fluxiq-web-extension/domain` and is not a literal, so the fixture follows the real id.
2. `throughTheDomain` now counts calls to the faked `executeAction` and asserts that exactly one delivery happened ("the adapter has to send the command and map the page's answer, or there is no hop to check"). This makes the rows stricter: if a future pick rule silently drops the command again, the rows fail with a clear message, not on a downstream undefined, and they can never pass vacuously.
3. The helper's doc comment now explains why the domain id is declared, citing bca31a06 and `criteria.ts`.

None of the expectations in the two rows changed.

**t732 (sensitive-cvc-capture) was not involved.** Neither failing row depends on the CVC rule. The new `domain/src/sensitivity/card-security-code.ts` appears to answer b3's open question (that bigbox's `cvc` field had no `autocomplete`). I did not check that in a browser.

## Commands run and observed results

All runs were headed and provider-free, from `C:/Users/osrs_/FluxStuff/fxwork/t730-realistic-only-browser-specs`.

- **Reproduce:** `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/redaction.spec.ts --headed --workers=2 --output=test-results/c7-1` -> `3 failed, 10 passed (9.0m)`.
  - :393 failed at line 428: Expected `"failed"`, Received `undefined`.
  - :533 failed at lines 552-553, soft, in all four states: `failure.expected` undefined, code `web.action.failed`.
  - :220 timed out in fixture setup: `Test timeout of 30000ms exceeded while setting up "page"` / `browserContext.newPage`. This was environmental. It passed on the rerun below with no change to that row.
- **Diagnosis:** `git diff 4441cde5 50500e8a -- domain/src/runtime/adapter.ts domain/src/io/gateway-output-dispatcher.ts domain/src/runtime/web-sessions/ domain/src/runtime/tests/adapter-redaction.test.ts`, then `git log 4441cde5..50500e8a -- domain/src/runtime/adapter.ts domain/src/runtime/web-sessions` -> bca31a06. I also read Core's `packages/client-gateway-websocket/src/session-pick/eligible.ts` and `pick.ts` (read only).
- **After the edit:** `... test:content -- content/tests/redaction.spec.ts --headed --workers=2 --output=test-results/c7-2` -> `13 passed (3.3m)`.
- `node_modules/.bin/tsc -p tsconfig.test.json --noEmit` (from `apps/extension`) -> exit 0, no output.

## Not verified

- I did not check that the new delivery guard fires when a session is ineligible: no mutation run with the old capability shape. By reading the code, the stale fixture gives 0 deliveries, so the guard would fail.
- Firefox was not exercised; the runs used only the harness Chromium.
- I ran no other specs and no full suite.

## Open questions or contradictions found

- Other e2e specs or harness stubs that fake a gateway session with only `web.*` action types, and no domain id or `web.dom.capture_snapshot`, will break the same way after this merge. I did not search outside my file.
