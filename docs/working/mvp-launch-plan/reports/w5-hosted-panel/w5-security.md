# w5-security report (lane t901, W5 P3)

## Outcome
Done, with one section unavailable by design: Activity (no endpoint reads the IAM audit).

## What changed and why
Core worktree `!FluxIQ`, all under `apps/web/src`:
- `app/(panel)/security/page.tsx` now renders `SecurityPage` (placeholder removed). Test: `app/(panel)/security/tests/page.test.tsx`.
- `features/security/` (new): `index.ts`, `security.css` (panel CSS variables only, with the same fallbacks as runs.css).
  - `model/`: types (`Guarded<T>` = denied or ready), `shape/{key-row,access,paired-client}.ts`. Shapers pick named fields only, so a key value or credential hash cannot reach the screen.
  - `data/`: `load/{key-rows,access,paired-clients}.ts`, `revoke-session.ts`, `forget-paired-client.ts`, `answer-is-denied.ts` (status 403), `types.ts`. Loaders return `denied` on 403 and throw on any other failure (the section then shows its error state).
  - `state/`: `SectionBody` (loading, error, "You do not have access to this."), `useReloadableResource` (home's 30 s refresh plus `reload` after a change).
  - `confirm/ConfirmButton.tsx`: ask first, then act; a 403 reads "You do not have access to do this."
  - `keys/`, `access/`, `activity/`, `page/`: the three sections and the page.
  - Tests: `data/tests/loaders.test.ts`, `page/tests/security-page.test.tsx`.
- Access section keeps a marked place (`data-slot="access-admin"`) for creating users, invites and role editing.

## Endpoints used
- Keys: secret-keys `GET snapshot` (via `/api/programs/secret-keys/snapshot`). Never `reveal-key`.
- People and sessions: identity-access `GET snapshot`; `POST revoke-session` with `{sessionDigest}` (snapshot lists sessions by digest, no raw id).
- Paired browsers: `GET /api/client-gateway/snapshot` (`trustedClients`).
- Forget a paired browser: automation-studio `POST revoke-client-trust` `{trustedClientId, reason}`. Reason: `/api/client-gateway/forget-pairing` accepts only the browser's own bearer credential (IAM contract: paired-client only), so a signed-in panel person cannot use it. `revoke-client-trust` is the existing panel-callable endpoint (permission `runtime.control`).

## Missing or imperfect endpoints
- IAM audit read: missing. `IamAuditQuery`/the store in `packages/fluxiq/src/platform/iam/audit` has a query, but no program endpoint or app route exposes it. Needed: a read call (e.g. identity-access `list-audit`, workspace resource, `iam:ListAudit`) returning `IamAuditRecord` (principal, action, decision, time) newest first. The Activity section says plainly it is not available yet. The client gateway's own `auditLog` (in its snapshot) is a different log and was not substituted.
- "Last used" for keys: `SecretKeySummary` has `lastRevealedAtMs` but no last-used time. The screen says "last revealed" rather than claim use.
- The secret-keys snapshot's `unlocked` is reported only for the caller; absent shows "Lock state not known".

## Commands run and observed results
- `pnpm --filter @fluxiq/web exec vitest run src/features/security "src/app/(panel)"` -> 5 files passed, 24 tests passed (includes loader shapes/denied/failure for all three loaders, revoke and forget mapping, section states, a no-key-value-rendered test, confirm flow).
- `pnpm structure:check` -> "structure-audit: passed (529 warning(s), 969 baselined)". The first run flagged 7 violations in my new files (prefix naming, statement packing, failure-as-empty); all fixed and re-run clean.

## Not verified
- apps/web typecheck (left to supervisor per brief).
- Live behaviour in a browser: real 403 shapes, revoke and forget against a running engine, `requiresRecheck` answers on revoke/forget (shown as the generic "did not work" message, not a re-authentication prompt).
- Whether an ordinary signed-in role may call `revoke-client-trust` (needs `runtime.control`); a refusal shows as "no access".
- Test files use `react-test-renderer` (prints a deprecation warning, as existing tests do).
