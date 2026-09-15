# x0-domain: the domain share of X0

## Outcome

Done. The domain package's check, the labelled domain tests and the structure audit all pass. The brief named four domain-side mutations. Each was applied on its own, observed to fail its row, and reverted. The final state was re-checked and re-tested after the reverts.

## What changed and why

**X0.2: each reader checks `extracted` again (D2).** A value read off a control the sensitivity rule marks is now dropped by three independent readers. Each decides from the result's own `element` descriptor, using `isSensitiveElementDescriptor`.

- `domain/src/client/gateway-mapping.ts`
  - `webAutomationActionResultPayload` now carries `extracted` through a new private helper, `secretSafeExtracted`, which sits beside `webAutomationSecretSafeValidation`.
  - The helper returns `undefined` for a sensitive element, so `compactJsonObject` leaves the key out.
  - It consults neither the validation's `redacted` flag nor its status.
- `domain/src/runtime/adapter.ts`
  - Adds `sensitiveTarget`, which is the rule's verdict alone. `withholdComparison` is now `sensitiveTarget && !producerDeclaredRedaction(...)`.
  - A new private helper, `dispatchPayloadWithoutExtracted`, removes `payload.result.extracted` whenever `sensitiveTarget` holds.
  - This runs before, not inside, `secretSafeDispatchPayload`. That function's early return on a `none` validation therefore cannot skip it, and neither can a producer's declaration.
  - I read the dispatcher (`io/gateway-output-dispatcher.ts`) to confirm the client's result sits only at `payload.result`.
- `domain/src/recording/reducers.ts`
  - `runtime.lastActionResult` is written through a new private helper, `actionResultForState`.
  - It strips only `extracted`, and only when the result's `element` is sensitive. The header comment now says so.

**X0.3, domain side: `minItems` (D4).**

- `actions/types.ts`: `WebAutomationExtractListRequest` gains `minItems?: number | undefined`, documented as defaulting to 1. The `maxItems` field now documents the cap.
- `actions/schemas.ts`: adds `minItems: { type: "integer", label: "Minimum items", minimum: 0 }`.
- `client/gateway-action-parameters.ts`, in `extractListRequestValue`:
  - `minItems` is read with `nonNegativeInteger`.
  - A `minItems` that is present but unreadable refuses the whole request.
  - So does a `minItems` greater than the effective maximum. That is the clamped `maxItems` when one is given, otherwise `WEB_AUTOMATION_EXTRACT_MAX_ITEMS`. See open question 1.

**X0.5, domain side: the item cap.**

- `actions/types.ts`: adds `WEB_AUTOMATION_EXTRACT_MAX_ITEMS = 1_000` beside `WEB_AUTOMATION_EXTRACT_MAX_PAGES`.
- `actions/schemas.ts`: `maxItems` gains `maximum: WEB_AUTOMATION_EXTRACT_MAX_ITEMS`.
- The lift clamps a readable `maxItems` to the cap with `Math.min`, the same way `maxPages` is clamped. An absent `maxItems` stays absent, as the existing test at `gateway-command-parameters.test.ts:89` requires; the page applies the cap.

**Tests added**

- `actions/tests/schemas.test.ts`: a new row checks that `maxItems.maximum` equals the cap, and that `minItems` is an integer with `minimum` 0.
- `client/tests/gateway-command-parameters.test.ts` (module-scope script):
  - `maxItems: 5_000` lifts to 1,000.
  - `minItems: 0` is lifted exactly.
  - `minItems: 3` with `maxItems: 3` is lifted.
  - Each of these is refused whole: `minItems: -1`, `minItems: "1"`, `minItems: 5` with `maxItems: 3`, and `minItems: 1_001` with no `maxItems`.
- `client/tests/gateway-mapping-redaction.test.ts` (`node:test`):
  - "a sensitive element's extracted value never reaches the wire" sends the sentinel twice: beside a `none` validation, and beside a declared redaction. Each time it checks that the serialized payload has no sentinel, that the key is absent, and that the element still rides.
  - "an ordinary element's extracted value is carried".
- `runtime/tests/adapter-redaction.test.ts` (`node:test`):
  - `runCommand` now takes an optional command; it defaults to the existing `typeCommand`.
  - Two rows, "a sensitive element's extracted value is dropped from the runtime result". One pairs the value with a `none` validation, the other with a declared redaction. Both check that the serialized runtime result has no sentinel.
  - An ordinary-element control row: "an ordinary element's extracted value reaches the runtime result".
- `recording/tests/reducers.test.ts` (`node:test`):
  - "a sensitive element's action result loses only its extracted value" checks the stored value deep-equals the result minus `extracted`, and that no sentinel remains anywhere in state.
  - "an ordinary element's action result keeps its extracted value".

Structure: no new files and no new exports beyond the one constant. `git diff --stat -- domain/src` reports 11 files changed, 283 insertions and 12 deletions.

## Commands run and observed results

All commands ran from `F:\!FluxIQWebExtension`, one at a time, never concurrently with another check, test or audit.

1. `pnpm --filter @fluxiq-web-extension/domain check` exited 0. Both `tsc -p tsconfig.json --noEmit` and `tsc -p tsconfig.test.json` printed nothing.
2. `DOMAIN_TEST_BUILD_LABEL=x0-domain pnpm --filter @fluxiq-web-extension/domain test` (green baseline):
   - Exit 0; `# tests 412`, `# pass 412`, `# fail 0`.
   - The module-scope scripts printed "Web automation gateway command parameter tests passed." and "Web automation gateway mapping tests passed.", among others.
   - The only lines matching "error" were two passing test names. A shell grep for them was refused by the permission classifier, so I read them with the Grep tool.
3. Mutations. Each was applied alone, run with the same labelled test command, then reverted.
   - **M1**, wire guard reverted to `extracted: result.extracted`: exit 1, `# fail 1`, `not ok 24 - a sensitive element's extracted value never reaches the wire`.
   - **M2**, adapter guard reverted to `const readable = result.payload`: exit 1, `# fail 2`. The failing rows were `not ok 331 - ... beside a validation with no comparison` and `not ok 332 - ... beside a declared redaction`.
   - **M3**, reducer guard reverted to pass `payload.actionResult`: exit 1, `# fail 1`, `not ok 136 - a sensitive element's action result loses only its extracted value`.
   - **M4**, the lift's unreadable-`minItems` refusal removed: exit 1. The loader reported "Domain test entry failed to load: src/client/tests/gateway-command-parameters.test.ts", with `AssertionError [ERR_ASSERTION]: web.dom.extract_list was dispatched: a negative minimum`. The `node:test` count stayed at 412 of 412, because that file is a plain script.
4. After the reverts, a Grep confirmed all four guarded lines are present.
5. `pnpm --filter @fluxiq-web-extension/domain check` exited 0.
6. The labelled test command (final run): exit 0; `# tests 412`, `# pass 412`, `# fail 0`. All four module-scope scripts printed their pass lines, and no entry failed to load.
7. `node scripts/structure-audit.mjs`: exit 0, "structure-audit: passed (53 warning(s), 17 baselined)". Among my files, only the existing 400-line advisory warnings appear: `domain/src/actions/types.ts` at 461 lines, `domain/src/client/gateway-mapping.ts` at 448 and `domain/src/runtime/adapter.ts` at 433. All were past 400 before this change and are well under 800.

No single-observation crashes occurred; nothing needed a rerun.

## Not verified

- **The extension control test.** `apps/extension/src/runtime/tests/result-mapping.test.ts:123-133` (ordinary element, `extracted` kept) was not run, because the brief excludes extension builds. The domain row "an ordinary element's extracted value is carried" covers the same rule on the domain side.
- **The page side of X0.3 and X0.5** belongs to the W1-A worker and is not done here. That covers:
  - `minItems` enforcement;
  - `authGateFailure`;
  - the page's `EXTRACT_MAX_ITEMS` mirror and its agreement test;
  - the e2e cases.

  Until W1-A lands, the domain lifts `minItems` but the page ignores it, so an empty list still succeeds. The page also still has no item default.
- **No `pnpm check`, `pnpm test` or `pnpm build` across the whole repository.** Only the domain-package commands above ran.
- **Tracked `domain/.test-build/` was not written.** Every run used the `x0-domain` label, and `git status` shows no change there.

## Open questions or contradictions found

1. **Minimum compared with the cap (judgement call).** The report's X0.3 says a request is refused when "`minItems > maxItems`". When `maxItems` is absent, I compare against `WEB_AUTOMATION_EXTRACT_MAX_ITEMS`, since the page applies that bound. When it exceeds the cap, I compare against the clamped value. A minimum above 1,000 can never be met either way.
2. **Schema and lift disagree at the edge.** The `minItems` schema has `minimum: 0` and no `maximum`, exactly as specified. The schema therefore allows `minItems: 1001`, which the lift refuses. Recommend adding `maximum: WEB_AUTOMATION_EXTRACT_MAX_ITEMS` to `minItems` in X1.4. I did not add it because the brief specified `minimum: 0` only.
3. **An unreadable `maxItems` is still dropped silently (behaviour that predates this change).** Values such as `"40"`, `0` or `2.5` are not refused, so the page applies the cap. `minItems` and `paginate` are refused whole in the same situation. The inconsistency is outside this brief.
4. **The guards reach only as far as the `element` descriptor, as the comparison guard already does.** A result that carries `extracted` and no `element` passes through all three readers. I did not verify whether a `web.dom.extract_list` result carries an `element`. Its fields are refused on the page (X0.1, owned by W1), and no domain reader re-checks them.
5. **Line endings.** `git diff` warned "LF will be replaced by CRLF" for 9 of the 11 files. Git will normalize on its next touch; the content is unaffected.
