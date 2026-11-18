# Enterprise SSO (OIDC) design

Design note, 2026-11-18. This note can be committed. Paths are FluxIQ Core (`!FluxIQ`). Enterprise
licensing comes after launch, so everything here except section 9's "launch" list follows launch.

## 1. Principles

- **Core owns identity.** A person proves who they are through an identity provider behind Core's
  provider port: `packages/fluxiq/src/programs/identity-access/runtime/providers/identity-provider.ts`,
  `IdentityProviderId = "password" | "oidc"`. The port already says that a provider proves the person
  and that Identity Access mints the session. OIDC fits that contract. It never mints a session of its
  own, so session lifetime, revocation, IAM and audit stay the same for every provider.
- **Platform scope.** SSO configuration, verified domains and the sign-in flow are platform scope:
  the identity directory and the platform store on the primary instance (I1). What SSO changes in a
  workspace is memberships and policies. Those change only through provisioning operations, never by
  writing a workspace's IAM directly.
- **The subject is `(issuer, sub)`, never the email address.** Email is used only to decide whether a
  first sign-in may create a membership. Even then it must be `email_verified` and in a domain the
  workspace has proved it owns.
- **SSO is per organisation workspace.** One IdP configuration belongs to one organisation workspace.
  A person may also keep a personal workspace and other memberships, and SSO never touches them.

## 2. What it builds on

HC2b supplies the following. SSO is not started before HC2b lands.

- The platform accessor (`lib/platform`) and the login route signing in through
  `createPasswordIdentityProvider`. That is the seam where the OIDC provider is added.
- Membership-level operations `suspendMember`, `resumeMember` and `removeMember`. IdP deprovisioning
  acts on one membership with these and never disables an account.
- A cascade port that revokes a person's paired clients bound to one workspace, and a custody drop for
  one workspace.
- Session workspace resolution that drops a non-active membership on the next request.

## 3. The invite fix SSO depends on (unit S0)

An organisation workspace must exist, be reachable and be able to take members before SSO can add
people to it. Today:

- no provisioning operation creates an organisation workspace;
- organisation membership needs the `iam.organisation` entitlement, which the web composition does
  not yet supply;
- inviting an email that already has an account answers `email_taken`
  (`operations/create-account.ts:42`), because invite means create an account;
- a person with several memberships always works in their oldest active one (`lib/workspaces/default-workspace.ts`),
  so they cannot choose the organisation.

S0 delivers:

1. **`createOrganisation { requestId, ownerUserId, name }`** (provisioning operation and contract). It is
   entitlement-gated, and the owner becomes the first member with `FluxIQAdministratorAccess`.
2. **Organisation entitlement** comes from commerce grants once enterprise licensing exists. Before
   that it comes from operator configuration on the platform-services composition.
3. **Invitations as memberships.** Inviting an address that has no account keeps today's path:
   `createAccount` into the organisation, plus the welcome link. Inviting an address that already has
   an account:
   - writes a membership in a new status `invited`, with the chosen policies stored but not attached;
   - emails an invitation link (single use, digest stored, like the welcome link);
   - on acceptance by that account, signed in (the session's user must equal the invited user),
     `acceptInvitation` makes the membership `active` and attaches the policies.
   An invitation never reveals whether the address had an account: the inviting administrator sees
   "invited" either way.
4. **Workspace selection per session.** New platform record `SessionWorkspaceSelection { sessionDigest, workspaceId, selectedAtMs }`
   and a route `POST /api/workspaces/select { workspaceId }` that checks for an active membership.
   `sessionWorkspaceId` reads the selection first and falls back to the oldest active membership. A
   selection whose membership is no longer active is ignored, which keeps HC2b's revalidation rule.
   The panel gets a workspace switcher.

S0 acceptance:

- a two-tenant test where a person with a personal workspace accepts an organisation invitation,
  selects it, and their requests and audit land there;
- a forged selection of a workspace without membership answers 403 and changes nothing;
- an invitation link replayed or redeemed by another account is refused;
- the provisioning, store and accounts route tests, the web and fluxiq typechecks, and the structure
  audit.

## 4. Per-workspace IdP configuration (unit S2)

**The record.** New platform record (in `packages/fluxiq/src/platform/sso/`, the store in the
platform store's repository):

```ts
type WorkspaceIdentityProvider = {
  providerId: string;              // random id; also the path segment of the callback
  workspaceId: string;             // an organisation workspace
  issuer: string;                  // exact issuer URL, https only
  clientId: string;
  clientAuth: "client_secret_basic" | "private_key_jwt";
  clientSecretRef: string | null;  // a sealed secret id (host protection), never the secret
  scopes: string[];                // always includes "openid"; "email" and "profile" by default
  groupsClaim: string | null;      // e.g. "groups"
  groupRoles: { group: string; role: "administrator" | "member" | "viewer" }[];
  defaultRole: "member" | "viewer" | null;   // null: a person matching no group is refused
  jit: boolean;                    // create memberships on first sign-in
  enforce: boolean;                // members in verified domains must use SSO for this workspace
  sessionMaxAgeMs: number;         // SSO-minted sessions end at most this long after sign-in
  status: "draft" | "active" | "disabled";
  createdAtMs: number; updatedAtMs: number;
};
```

**Where the client secret lives.** It is sealed with the platform's host protection (the same custody
that seals model keys), referenced by id, never logged and never returned to the panel. The panel shows
whether a secret is set. `private_key_jwt` is preferred: FluxIQ generates the key pair and publishes
the public half at `/api/sso/<providerId>/jwks`, so no shared secret exists at all.

**Verified domains.** New record `WorkspaceDomain { domain, workspaceId, token, verifiedAtMs, lastCheckedAtMs }`.

- Verification is by a DNS TXT record `fluxiq-verification=<token>` at `_fluxiq.<domain>`, read
  through a resolver port so tests use a fake.
- A domain is verified by at most one workspace at a time.
- Freemail and public-suffix domains are refused (a maintained list, plus the public-suffix rule).
- Domains are rechecked daily. A domain whose record has disappeared stops creating new memberships,
  and existing members keep theirs.

**IAM.** New actions `iam:ConfigureIdentityProvider`, `iam:VerifyDomain` and `iam:ReadIdentityProvider`.
They are workspace resources, held by `FluxIQAdministratorAccess`, and decided by the workspace
registry like every account route. Each change re-proves the administrator's credential, as invites
already do.

**Discovery and egress.** Administrators type the issuer URL, so the server's fetches of that URL are
an SSRF surface:

- https only;
- the resolved address must be public (private, loopback, link-local and metadata ranges refused, and
  checked again after each redirect);
- no redirects across hosts;
- bounded response sizes;
- a fixed timeout per request.

Saving a configuration runs discovery and refuses an `issuer` in the discovery document that differs
from the configured one. That is OIDC Discovery 1.0, section 4.3.

## 5. Sign-in: Authorization Code with PKCE (units S1 and S3)

**Library.** Use a certified relying-party library behind the port (`openid-client`, the current major,
pinned, which builds on `oauth4webapi` and `jose`) rather than hand-written protocol code. Wrap it in
`providers/oidc/` so the rest of Core sees only `IdentityProvider<OidcCallback>`.

**Start.** `GET /api/auth/sso/start?email=<address>` or `?workspace=<slug>`:

1. Find the provider from the email's verified domain, or from the workspace. An unknown domain sends
   the person back to the password form, with no hint about which domains are configured.
2. Generate `state` (32 random bytes), `nonce` (32 random bytes) and a PKCE `code_verifier`, then send
   `code_challenge = S256(verifier)`. `plain` is never used.
3. Store `{ stateDigest, providerId, nonce, verifier, returnTo, createdAtMs }` server-side in the
   platform store. It lives ten minutes and is used once.
4. Set `__Host-fluxiq-sso` (Secure, HttpOnly, SameSite=Lax, path `/`), holding the state, so the
   callback is bound to the browser that started it.
5. `returnTo` is a same-origin path only.
6. Redirect to the discovered `authorization_endpoint` with `response_type=code`, `scope`, `state`,
   `nonce`, `code_challenge` and `redirect_uri=https://<origin>/api/auth/sso/<providerId>/callback`.

**Callback.** Every check below refuses with one generic error page and records the reason in the
audit:

1. **State.** The cookie state equals the query state. The stored record is consumed atomically, and a
   replay finds nothing. The record's `providerId` equals the path's.
2. **Mix-up defence.** When the authorization response carries `iss` (RFC 9207), it must equal the
   provider's issuer. If the provider's metadata advertises
   `authorization_response_iss_parameter_supported`, `iss` is required.
3. **Code exchange** at the discovered `token_endpoint`, with the stored `code_verifier` and the
   configured client authentication.
4. **ID token validation:**
   - the signature is verified against the provider's JWKS, with algorithms limited to
     `RS256`/`PS256`/`ES256`/`EdDSA` (`none` and every `HS*` refused);
   - `iss` equals the configured issuer exactly;
   - `aud` contains `clientId`, and when `aud` has several values, `azp` equals `clientId`;
   - `exp` is in the future, `iat` is not in the future and `nbf` (if present) has passed, each with at
     most 60 s of clock skew;
   - `nonce` equals the stored nonce;
   - `auth_time` is checked against `max_age` when one was sent.
5. **Claims.** `sub` is required. The `email` claim counts only with `email_verified === true`.
   `groups` is read from `groupsClaim`. A groups overage indicator (`_claim_names` / `hasgroups`) is
   refused with "configure group filtering at the IdP". FluxIQ does not call a directory API.

**Key rotation.**

- JWKS is cached per issuer, honouring cache headers, for at most 24 hours.
- An ID token whose `kid` is not in the cache refetches the JWKS once. Concurrent requests for the
  same issuer share one refetch, and a token is not accepted on a key outside the freshly fetched set.
  A removed key stops validating at the next refresh.
- For `private_key_jwt`, FluxIQ's own key pair rotates with an overlap: the new public key is published
  before it is used, and the old one is kept until the IdP's cache window has passed.

**Session.** `identityAccess.createSession(userId, ttl)` with `ttl = min(DEFAULT_SESSION_TTL_MS, provider.sessionMaxAgeMs)`.
The session records `{ provider: "oidc", providerId, idpSid? }`. Identity Access gains optional
session provenance for this, so back-channel logout can find the session by `sid` and enforcement can
see how the session was made. The session's workspace selection is set to the provider's workspace.

## 6. Accounts and membership on first sign-in (unit S3)

The account is found by the identity `(provider "oidc", subject "<issuer>|<sub>")`:

- `PlatformAccountIdentity.provider` gains `"oidc"`.
- The store gains `findAccountByIdentity(provider, subject)`, with a unique index (the email and
  externalId indexes are the models).

**When no account holds that identity:**

1. **Existing account with the same email.**
   - If the account is already an active or invited member of the provider's workspace, link the
     identity to it.
   - Otherwise the person must prove the existing account (sign in with its password, and its second
     factor if set) before the identity is linked. An IdP administrator who can mint any email address
     at their IdP must not be able to take over someone's existing FluxIQ account.
2. **No account with that email**, and all of these hold: `jit` is on, `email_verified`, the email's
   domain is verified by this workspace, and the group mapping yields a role (or a default exists).
   Then create the account through provisioning:
   - `createAccount` with `identities: [{ provider: "oidc", subject }]`, no password, and the
     organisation as its workspace;
   - the account gets no personal workspace;
   - the email is marked verified from the IdP's verified claim.
3. **Otherwise refuse.** That covers a domain that is not verified, unverified email, JIT off, and no
   matching group with no default. People outside verified domains (contractors) join only by
   invitation (S0), and then link their SSO identity on their next sign-in.

## 7. Groups to roles, and deprovisioning (units S4 and S5)

**Mapping.**

- On every SSO sign-in the person's groups are mapped to a role through `groupRoles`. The highest role
  wins, and `defaultRole` applies when nothing matches.
- The mapping is applied through `setPolicies` on that workspace's membership, and the groups are
  written to `PlatformMembershipRecord.groups`, which already exists.
- The IdP can never grant the owner role.
- The existing last-administrator rule applies. If a mapping would remove the workspace's last
  administrator, the sign-in succeeds, the role stays, and administrators are alerted.
- A change from the IdP takes effect at the person's next sign-in, or at once through SCIM.

**Deprovisioning, in three layers that work together:**

1. **SCIM 2.0** (RFC 7643/7644) at `/api/scim/v2/<providerId>/Users` (and `Groups` for mapping only).
   - It authenticates with a workspace-scoped bearer token: a service identity in that workspace's IAM
     with a SCIM policy, stored as a digest, shown once and rotatable.
   - `active: false` calls `suspendMember`. `DELETE` calls `removeMember`. A group change re-applies
     the mapping.
   - SCIM never disables or deletes the account itself. The person may have a personal workspace and
     other memberships.
   - A SCIM-created user is the same path as JIT, with the same domain rule.
2. **OIDC Back-Channel Logout 1.0.** The provider's `backchannel_logout_uri` receives a logout token,
   validated like an ID token plus the `events` claim, no `nonce`, and a `jti` replay check. Every
   FluxIQ session with that `sid` (or that `sub` for the provider) is revoked on the identity
   directory, and the workspace's custody for those sessions is dropped.
3. **Bounded session age.** SSO sessions end at `sessionMaxAgeMs`, and renewing one takes a fresh IdP
   round trip. A person the IdP removed, at an IdP without SCIM or back-channel logout, keeps access at
   most until their session ends.

Deprovisioning also revokes the person's paired clients bound to that workspace, with
`revoked_by_admin` (HC2b's scoped revocation). An account left with no membership and no personal
workspace stays as a dormant account. The platform's retention policy decides when it is deleted, and
that decision is the user's.

**Enforcement** (`enforce: true`). For members whose email domain is verified by the workspace, only a
session minted by that workspace's provider can select the workspace. A password session for that
person still works in their personal workspace and their other memberships. Administrators keep a
break-glass path: an owner may sign in with password and second factor so they can repair a broken IdP
configuration, and it is recorded in the audit.

## 8. Units

| Unit | What | Depends on | Acceptance |
|---|---|---|---|
| S0 | Organisations, invitations as memberships, workspace selection (section 3) | HC2b | Section 3's tests |
| S1 | OIDC provider in Core: discovery, JWKS cache, PKCE, state store, ID token validation (sections 4 and 5, protocol only) | HC2b's provider seam | A fake IdP in tests (a local server signing with test keys). Refusal tests for wrong `iss`, wrong `aud`, missing or mismatched `azp`, wrong or missing nonce, expired, `alg: none`, HS256 with the client secret, unknown `kid` (refetch, then accept the rotated key), a removed key, a replayed state, a wrong PKCE verifier (the fake enforces it), mismatched `iss` in the authorization response, and a discovery issuer mismatch. The SSRF refusal set |
| S2 | Per-workspace configuration, sealed secret or private_key_jwt, domain verification, admin IAM and panel settings | S0, S1 | Configuration routes decided by the workspace registry (two-tenant: A cannot read or write B's configuration). Domain claimed by one workspace only; freemail refused; DNS fake drives verify and lapse |
| S3 | Sign-in routes, sessions with provenance, JIT, account linking with proof | S1, S2 | End-to-end against the fake IdP: first sign-in creates the account and membership in the verified domain only; a lookalike unverified domain is refused; an existing account is not linked without proof; the session lands in the organisation; audit rows on every refusal |
| S4 | Groups to roles | S3 | Highest role wins; owner never mappable; last-administrator protection; groups written to the membership |
| S5 | SCIM and back-channel logout | S3, HC2b's membership operations | SCIM `active:false` suspends A's membership only (the person keeps B and personal); DELETE removes; token is workspace-scoped (A's token on B's provider answers 401); logout token revokes by `sid`; replayed `jti` refused |
| S6 | Enforcement and break-glass | S3 | A password session cannot select an enforcing workspace for a domain member; break-glass recorded |
| S7 | Licensing gate: `iam.sso` entitlement from commerce grants | Enterprise licensing | Without the grant, configuration is refused and existing configurations stop starting new sign-ins. They never end running work (I2's rule for every non-active state) |

Every unit runs the narrow tests beside what it changes, the fluxiq and web typechecks under a heavy
slot, and the structure audit. Live checks against real IdPs (Entra ID, Okta, Google Workspace) are a
manual validation step once staging exists. They need test tenants from the user.

## 9. Launch versus after launch

**Launch (with HC2b, no SSO code):**

- the login route signs in through the provider port (HC2b, section 2 row 4);
- membership-level operations exist (HC2b);
- nothing in launch work assumes email is the only identity key. New code that looks up accounts goes
  through the platform store's lookup methods, which S3 extends.

**After launch, in order:**

1. S0, which also serves non-SSO teams;
2. S1, then S2 and S3;
3. S4 and S5;
4. S6;
5. S7 when enterprise licensing is defined.

SAML is not planned. Enterprise IdPs that matter here all speak OIDC. If a customer requires SAML, it
joins as another provider behind the same port.

## 10. Questions for the user (when SSO is scheduled)

1. Dormant accounts after deprovisioning: delete after how long, if ever?
2. May an IdP group map to the administrator role, or is administrator granted only inside FluxIQ?
3. Which IdPs to certify against first, and test tenants for them.
