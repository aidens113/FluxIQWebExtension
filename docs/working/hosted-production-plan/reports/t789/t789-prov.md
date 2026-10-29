# t789-prov: provisioning service (lane B1, hosted H1)

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t789/!FluxIQ` (branch `task/t789-hosted-b1-platform-store`). No git mutations, no model calls, no Lab runs.

## Outcome

Done. `createPlatformProvisioning(deps)` and `createPlatformServices(options)` are built under
`packages/fluxiq/src/platform/provisioning/`, with the `none`, `file` and memory email senders.
All three acceptance checks ran. Typecheck and structure audit pass. `pnpm test src/platform`
passes the real-sql group (3 files) and 32 of 33 parallel files. The one failing file is
`iam/catalog/tests/live-registry.test.ts`. It fails only because of line endings in this
worktree (CRLF in the working copy, LF in the index). Its content has not drifted, and I did not
touch it (details under "Commands run").

The seams `provisioning/types.ts` and `store/types.ts` were read and not changed; no defect in them
blocked the work. One brief instruction could not be followed literally (the `"*"` account FRN for
create, below).

## What changed and why

All new, under `packages/fluxiq/src/platform/provisioning/` (types.ts and cli/ untouched):

- `index.ts`: barrel; exports `cli/` (its barrel existed when I finished), `email/`, `service/`, and types from `context/` and `types.ts`. Operations, links, policies and idempotency stay internal.
- `context/`: `PlatformProvisioningDeps`, `PlatformTenancy`, `PlatformProvisioningService` (= `PlatformProvisioning & PlatformAccountLinks & { recordSignIn(userId, nowMs?): Promise<boolean>; runDueDeletions(nowMs?): Promise<number> }`), the internal `ProvisioningContext`/`ProvisioningGrant`, `ProvisioningRefusal`, lifetimes (24 h / 1 h / 7 d), `isWeakPassword` (<12 chars), `createProvisioningContext` (defaults), and `deliverProvisioningEmail`.
- `authorization/`: `authorizeProvisioningOperation`, which makes each call exactly one decision on `frn:fluxiq:platform::account/<id>`, with context `workspaceId: null` and origin `provisioning`. A service identity goes through the authorizer, which records the row itself. Platform-admin (origin `cli`) and in-process callers get a recorded allow citing `{policy: "platform-admin" | "in-process", sid: null}`. An in-process acting user is recorded as its user FRN.
- `idempotency/`: `canonicalJson`, `provisioningInputDigest` (SHA-256 of canonical JSON, `password` removed), `runIdempotent`. The same digest replays the stored answer; a different one is `request_conflict`.
- `policies/`: `checkProvisioningPolicies` (raises `forbidden_policy`), `policyGrantsPlatformAccess`, `identityRoleForPolicies` (Owner/Administrator map to `admin`, the rest to `viewer`), `syncMemberPolicies` (attach and detach through `iamAttachments`, each change citing the grant's matched statement).
- `links/`: `issueLinkToken` (32 bytes, base64url, only the SHA-256 hex stored, supersedes the previous link), the welcome, reset and account-exists mails, `redeemAccountLink`, `createPlatformAccountLinks`.
- `operations/`: one module per contract operation, a typed table (a missing operation is a compile error), and `completeAccountDeletion` / `runDueDeletions`.
- `email/`: `NoneEmailSender`, `FileEmailSender({directory, templates?, now?})` (one 0600 JSON file per message, holding the rendered text), `MemoryEmailSender` (test double, `failNext`), `STOCK_PLATFORM_EMAIL_TEMPLATES` for all 5 `PANEL_EMAIL_TEMPLATES`, `renderPlatformEmail` (own-property `{{name}}` filling; an unknown name becomes empty text).
- `service/`: `runProvisioningOperation`, `parseProvisioningInput`, `provisioningInputIssues`, `createPlatformProvisioning`, `ensureProvisionerIdentity`, `createPlatformServices({repository, identity, publicOrigin, tenancy, email, auditSink, serviceIdentityName?, ...optional ports})`.
  - `createPlatformServices` returns `{store, provisioning, links, provisionerCaller(sourceIp?)}`.
  - The service identity defaults to `website-backend`; creating it and attaching `FluxIQProvisioner` is idempotent.
  - `auditSink` is a required option, so no default sink silently drops rows.
- Tests:
  - `tests/`: create-account, authorization, idempotency, links, lifecycle, plus fixture files with one class per file.
  - `email/tests`, `idempotency/tests` and `policies/tests`.

Decisions worth checking:
- **Order of a call:** parse, then authorise, then the per-process queue, then idempotency, then execute. `getAccount` takes no requestId, so it skips the queue and idempotency.
- **Recording and errors:** only successes are stored for replay. Because the digest leaves out the password, a `weak_password` retried with a stronger password runs again. A non-refusal error (for example identity-access's "last enabled administrator") propagates as a throw.
- **Email failures** are reported (by default one `console.warn` naming the template and the error class) and never fail the operation, so the answer cannot reveal whether an address has an account. `resetSent` is false when the send failed.
- **`sendWelcome` by account state:** an unverified active account gets a new welcome link; a verified one gets "account-exists"; unknown, disabled or deleted accounts get nothing. The answer is always `accepted`.
- **The "account-exists" email** links to `${origin}/` and `${origin}/reset` and issues no token.
- **`createAccount` checks run first and change nothing:** policies, password, workspace, then email. An externalId that already names another account is `invalid_input` with path `externalId`.
- **Multi tenancy:** an existing workspace id must name an organisation workspace (personal ones are `not_found`) and needs the `organisation` entitlement.
- **Single tenancy:** the single workspace's row (`kind: "single"`) is written the first time it is used.
- **Redemption:**
  - The token is consumed only after every check passes, so `weak_password` and `disabled` leave it usable.
  - Both link purposes set `emailVerifiedAtMs` if it is unset and revoke all sessions.
  - Any token that is not 43 base64url characters is `invalid_link` without a store read.
- **Deletion:**
  - Immediate: the identity user is deleted before any data, so a refusal from identity-access loses nothing. Then IAM attachments are detached, personal workspaces are deleted (data hook first, then the row), and finally the store row.
  - Scheduled: status becomes `deleted`, identity is disabled, and sessions and clients are revoked. Asking again returns the same receipt.
  - `runDueDeletions` collects failures into one `AggregateError`, so a failed account stays scheduled for the next sweep.
- **"Granting platform:*"** is decided by the evaluator, not by reading patterns. A provisionable policy is refused if, attached to a member of a test workspace, it would allow any provisioning action (or `platform:Create/DeleteWorkspace`) on an account FRN or on another workspace's FRN. Among the predefined policies only `FluxIQProvisioner` matches.
- **Input issues never echo values:** an unknown field (including `password` over HTTP) is reported as `{path: "<field>", message: "Unknown field."}`. Enum, literal and discriminator issues get fixed messages.

## Commands run and observed results

All from `packages/fluxiq`, one at a time:

- `node --max-old-space-size=6144 node_modules/typescript/bin/tsc --noEmit -p .`: exit 0, no output. Run three times; the last run came after the final test edits.
- `pnpm exec vitest run src/platform/provisioning`: 11 files, 73 tests passed (my 49 plus the CLI worker's 24).
- `pnpm test src/platform`:
  - real-sql group: 3 files, 16 tests passed.
  - parallel group: 32 files passed and 1 failed (2 of 328 tests): `src/platform/iam/catalog/tests/live-registry.test.ts`, "keeps the generated action lists current" and "keeps the generated action catalog in the contracts package current".
  - Cause: every line of the diff is textually identical. `git ls-files --eol` shows `i/lf w/crlf` for `read-only-actions.generated.ts` and `contracts/src/iam/actions.generated.ts`, and `core.autocrlf` is `true` in this worktree. It is an environment artefact; git shows both files unmodified. Outside my paths, so not fixed.
- `pnpm structure:check` (repository root): "structure-audit: passed (451 warning(s), 1152 baselined)". The first run failed because the test fixture held 3 classes; I split it, and the rerun passed. One advisory warning is mine: `provisioning/operations/` has 20 source files, past the 15-file advisory threshold and under the 25 limit.

## Not verified

- **Real `IdentityAccessService`:** never wired in. Tests use a structural fake, so nothing proves the real service fits `PlatformIdentityPort`, and its behaviour is untested here (password hashing, session revocation subscribers, the final-admin guard).
- **SQLite repository:** `createPlatformServices` ran only over an in-memory repository that keeps envelope kinds. The B1 store report says `SQLiteRepository` overwrites the envelope kind. `IamRecords.get/list` filter on `kind === "iam.<kind>"`, so over a real SQLite repository the provisioner identity and attachments may read back as absent. The authorizer would then deny every call (fail closed). Not tested.
- **Concurrency across processes:** not handled; serialisation is per process only, as the brief says. A crash between the identity-user write and the account write leaves an orphan identity user.
- **Real downstream wiring:** no real mail transport, listener or lane C/D ports were exercised.
- **Full suites:** `pnpm check` and the full `pnpm test` were not run (brief and AGENTS.md: narrow checks only).

## Open questions or contradictions found

1. **The brief's create FRN cannot work.** The brief says create is decided on `frn:fluxiq:platform::account/*`. The evaluator implicitly denies any resource that is not a concrete FRN (`parseFluxIQResourceName` rejects `*`; a test pins this). So create is decided on `account/<id it will mint>`, and that id becomes the user id. Lookups by email or externalId that find nothing are decided on `account/unresolved`. Please confirm or choose another placeholder.
2. **Not exported upward.** `platform/index.ts` (not mine) does not export `./provisioning/index.ts`. Add it if provisioning should be on the platform barrel.
3. **Docs not updated.** `docs/architecture/platform.md` (not mine) describes only the IAM engine. It needs a Provisioning section per the documentation rule.
4. **Username uniqueness.** `PlatformIdentityPort` has no lookup by username, so provisioning cannot detect an identity-access user that already has the email as username but no platform account (for example from before migration). It trusts the platform store's email index alone.
5. **Costly audit request ids.** The IAM decision row uses the caller's `requestId`. Ids that are not decimal take a dictionary row each in the audit store (platform.md, Audit). Decide whether the listener should send decimal ids.
6. **Final-admin refusal is a throw.** identity-access refuses to disable, delete or demote the last enabled admin. That surfaces as a thrown error from `run`, not a typed refusal; no contract error code fits.
