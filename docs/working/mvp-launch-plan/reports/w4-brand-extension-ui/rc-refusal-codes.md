# W4-RC: Core refusal codes reach the panel

Outcome: Done (structure audit has one violation in a file I did not touch).

## What changed and why
- Field is `coreCode`, not `code`: `code` already holds the relay failure code (`failed`, `refused`, `not_paired`), and a ChatResult `code: "refused"` triggers Core's "refused this browser" fallback. `coreCode` cannot collide.
- `src/background/connection/core-api.ts`: on the general failed path, Core's body `errorCode` is carried as `coreCode` if it matches `^[A-Za-z][A-Za-z0-9_.-]{0,63}$`; otherwise dropped. Only `body.errorCode` is used, never `payload.diagnostic.code` (an existing test requires arbitrary diagnostics stay private). Authority errors, project_domain and 401/403 refusals are unchanged.
- `src/shared/protocol.ts` (not in the owned list; one-field type change, needed): `PanelRelayResponse` failure gains `coreCode?: string`. Relays pass the response through, so `relay-failure.ts` needed no change.
- `src/panel/state/request.ts` and `result.ts`: panelRequest re-validates and keeps `coreCode`; PanelResult failure type gains it. Sentences unchanged.
- `reply/thread-change-of.ts`: forwards `coreCode` (failureOf already spreads the failure, so it carries it).
- Note: ChatResult (Core ui-components) has no `coreCode` type; it exists at runtime on the object, a consumer needs a typed read or a Core type addition.

## Commands
- `node scripts/test-extension.mjs background/connection panel/state panel/chat/transport background/panel` -> tests 516, pass 516, fail 0.
- `node scripts/structure-audit.mjs` -> 1 violation: statement-packing in untracked `apps/extension/e2e/content/tests/screens/tests/all-screens-capture-company-website.spec.ts` (not mine, pre-existing in the worktree). No violation from my files.

## Tests added
core-api.test.ts (conversation_run_active carried; spaced/oversized/token-bearing code dropped), new panel/state/tests/request.test.ts (code + sentence carried, oversized dropped, authority unchanged), thread-list-ports.test.ts (coreCode reaches the list, code stays failed).

## Not verified
check-extension, live browser.
