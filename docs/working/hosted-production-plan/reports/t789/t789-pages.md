# t789-pages (lane B1, hosted H1): welcome and reset pages

## Outcome
Done. Files are in the Core tree `C:/Users/osrs_/FluxStuff/fxwork/t789/!FluxIQ/apps/web/src/app/{welcome,reset}/`. No git, model or Lab use.

## What changed and why
- `/welcome` (page + `WelcomeClient`): reads `#token=` from the fragment, clears it at once with `history.replaceState`, asks for a password and confirmation (12+ characters, same rule as the service), POSTs `{token, password}` to `/welcome/submit`, then navigates to the returned `continueUrl` (or `/`). No or invalid token: one message ("invalid or expired, resend it from the site you signed up on").
- `welcome/submit/route.ts` is thin. Logic is `welcome/server/submitWelcome.ts` with injected `WelcomeDeps`. It refuses cross-site with 403, enforces JSON of at most 8 KiB, calls `links.redeemWelcome`, `identityAccess.createSession(userId, DEFAULT_SESSION_TTL_MS)`, `secretKeys.unlockSession`, revoking the session on unlock failure (answers 500 `sign_in_failed`), then `provisioning.recordSignIn`. The cookie uses the login route's options (`sessionCookieOptions.ts`). Responses carry `cache-control: no-store`. Only codes are echoed, never the token.
- `/reset`: no fragment gives an email form posting to `/reset/request` (always `{ok:true}`; shown text "If an account uses that address, we sent a link"). `#token=` gives a new-password form posting to `/reset/submit`, then a "Sign in" link to `/`. Both modes state that model keys saved under the old password cannot be opened after a reset and must be added again. `reset/requestReset.ts` and `submitReset.ts` are the injected-deps functions (`ResetDeps`).
- Layout: `welcome/server/` (request checks, answer type, submit), `welcome/client/` (frame, password form, fragment hook, posting helpers; the reset page reuses these through the barrels). Styles are one small `welcome/client/account-link.css`.
- Does `redeemReset` revoke other sessions? Yes. `redeemAccountLink` (shared by welcome and reset) calls `identity.revokeUserSessions` after `setPassword`. A test confirms an old session is invalid after reset. A reset does not sign the person in.

## Commands run and observed results
- From apps/web, `pnpm exec vitest run src/app/welcome src/app/reset`: 5 files passed, 15 tests passed. They use the real `IdentityAccessService` and `SecretKeysService` (weak KDF test options) under `createPlatformServices` with an in-test memory repository and `MemoryEmailSender`. Covered: welcome gives cookie session, validateSession and authenticate with the new password OK; reused token is `invalid_link`; weak password is refused and the link stays usable; cross-site (Origin and sec-fetch-site) gives 403 without calling redeem; oversized and malformed bodies; unlock failure revokes the session; reset request answers identically for known and unknown emails and mails only the known one; reset submit sets the new password, old password and old session fail, reuse refused. Render tests cover WelcomeClient and ResetClient (fragment cleared, input counts, messages).
- apps/web `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit`: no output (clean), run after the last edit. The other worker's provisioning-listener changes were present and compiled.
- Root `pnpm structure:check`: no violations in my files (after fixing barrel imports and statement packing). One remaining FAIL is not mine: `[swallowed-failure] apps/web/src/server/provisioning-listener/request/handle-provisioning-request.ts` line 43 (the other worker's file).

## Not verified
- No browser run: the pages were not loaded in a real browser, and the route files (`route.ts`) are not exercised by tests (only the injected functions are). The vitest run was not repeated after the final route import change to the `provisioning-listener` barrel (tsc and the audit were).
- Cross-site check compares `Origin` with `new URL(request.url).origin`. Behind a TLS-terminating proxy that rewrites the host, `request.url` may differ from the public origin; check this in the hosted deployment.

## Open questions or contradictions found
- Whatever gates routes for unauthenticated visitors (outside my paths; no `middleware.ts` found at `apps/web/src`) must allow `/welcome`, `/welcome/submit`, `/reset`, `/reset/request` and `/reset/submit`. I did not verify how existing pages are gated.
- Welcome and reset have no rate limit or human check (not in the brief). Reset requests can be spammed per address; a throttle belongs in the throttling work.
- `welcome/server/tests/accountLinkHarness.ts` is test support imported by `reset/tests`; it contains a local memory repository copy because Core's one is test-only and unexported.
