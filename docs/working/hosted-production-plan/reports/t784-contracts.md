# t784-K: hosted H1 contract freeze (Core contracts package)

Worker: worker-heavy (brief t784-K). Tree: `C:/Users/osrs_/FluxStuff/fxwork/t784/!FluxIQ`, branch
`task/t784-hosted-h1`. No git mutations, no model calls.

## Outcome

Done. The interfaces lanes A to F build against are in `packages/contracts`, typed, versioned and
validated, with tests. Two public subpaths are new: `@fluxiq/contracts/iam` and
`@fluxiq/contracts/platform`. Both are also re-exported from the root barrel. Gateway 0.2 is
additive in `client-gateway.ts`. Every check the brief names passed; the exact output is under
"Commands run".

## What changed and why

All paths are under `packages/contracts/`. Validation uses zod schemas where the shape is a wire
or stored document, as `program-api.ts` and the plan ("schema ... (zod)") do. Small grammars use
pure guard and parse functions in the style of `failure/parse-record.ts`. Tests sit in the
`tests/` folder of the directory that owns their subject.

### Contracts by file

| Contract | Files (`src/...`) | Exported names | Version |
| --- | --- | --- | --- |
| Deployment profiles | `platform/profile.ts` | `FLUXIQ_PROFILES`, `FluxIQProfile`, `isFluxIQProfile` | - |
| URL shapes | `platform/url/{is-loopback-hostname,public-url,same-origin-path}.ts` | `isLoopbackHostname`, `isSecureOrLoopbackUrl`, `isSecureOrLoopbackOrigin`, `PublicUrlFamily`, `PUBLIC_URL_MAX_LENGTH`, `isSameOriginPath`, `SAME_ORIGIN_PATH_MAX_LENGTH` | - |
| Discovery | `platform/discovery/discovery-document.ts` | `fluxiqDiscoveryDocumentSchema`, `FluxIQDiscoveryDocument`, `parseFluxIQDiscoveryDocument(value, fetchedFromOrigin)`, `FLUXIQ_DISCOVERY_VERSION` (=1), `FLUXIQ_DISCOVERY_MAX_AGE_SECONDS` (=300) | `fluxiqDiscoveryVersion: 1` |
| Connect paths and limits | `platform/connect/{paths,client}.ts` | `FLUXIQ_CONNECT_PATHS`, `isConnectContinuePath`, `FLUXIQ_CONNECT_CLIENT_ID` (`"fluxiq-browser-extension"`), `FLUXIQ_CONNECT_LIMITS` | - |
| Connect fields and PKCE | `platform/connect/{fields,pkce}.ts` | `connectFieldSchemas`, `connectRedirectUri`, `PKCE_CODE_VERIFIER_PATTERN`, `PKCE_S256_CHALLENGE_PATTERN`, `isPkceCodeVerifier`, `isPkceS256Challenge` | RFC 7636 |
| Authorize, token, revoke | `platform/connect/authorize-request.ts`, `token/{request,response,error}.ts`, `revoke-request.ts`, `account-summary.ts` | `connectAuthorizeRequestSchema`, `connectTokenRequestSchema`, `connectTokenResponseSchema`, `connectTokenErrorSchema`, `CONNECT_TOKEN_ERROR_CODES`, `connectRevokeRequestSchema`, `connectUserSummarySchema`, `connectWorkspaceSummarySchema`, plus their types | - |
| Done fragment | `platform/connect/done-fragment.ts` | `parseConnectDoneFragment`, `ConnectDoneFragment`, `CONNECT_DONE_ERRORS` | - |
| Typed code (Flow B) | `platform/connect/reference-code.ts` | `CONNECT_REFERENCE_CODE_ALPHABET`, `isConnectReferenceCode`, `normalizeConnectReferenceCode`, `formatConnectReferenceCode` | - |
| Connected-client credential | `platform/connect/connected-client.ts` | `connectedClientRecordSchema`, `ConnectedClientRecord`, `ConnectedClientView`, `ConnectedClientStatus`, `connectedClientStatus`, `connectedClientView` | - |
| Session references | `platform/session/{session-digest,session-reference}.ts` | `SESSION_DIGEST_PATTERN`, `isSessionDigest`, `GATEWAY_SESSION_REFERENCE_PREFIX`, `isSessionReference` | - |
| Gateway 0.2 vocabulary | `platform/gateway/{protocol-versions,run-context,revocation-reason,going-away-reason}.ts` | `CLIENT_GATEWAY_PROTOCOL_VERSIONS` (`["0.1","0.2"]`), `CLIENT_GATEWAY_LATEST_PROTOCOL_VERSION`, `clientGatewayRunContextSchema`, `ClientGatewayRunContext`, `parseClientGatewayRunContext`, `CLIENT_GATEWAY_REVOCATION_REASONS`, `CLIENT_GATEWAY_GOING_AWAY_REASONS` | 0.2 |
| Gateway 0.2 wire | `client-gateway.ts` | new: `ClientGatewayHelloMetadata` (`clientLabel`), `ClientGatewayPairingRequired` (`codeEntryUrl`), `ClientGatewaySessionReady` (`user`, `workspace`, `credentialExpiresAt`), `ClientGatewayRevokedNotice`, `ClientGatewayGoingAwayNotice`; `ClientGatewayActionCommand.runContext?`; `server.revoked` and `server.going_away` in `ClientGatewayServerMessage` | 0.2, additive |
| Origin grammar | `platform/origin/{origin-rule,origin-admission}.ts` | `ClientGatewayOriginRule`, `parseClientGatewayOriginRule`, `parseClientGatewayOriginAllowlist`, `CLIENT_GATEWAY_ANY_FIREFOX_EXTENSION_ENTRY`, `CLIENT_GATEWAY_FIREFOX_EXTENSION_PREFIX`, `ClientGatewayOriginContext`, `admitClientGatewayOrigin`, `isPublicClientGatewayBind`, `clientGatewayOriginStartRefusal` | - |
| Provisioning API | `platform/provisioning/*.ts` (one file per operation, plus `fields`, `operations`, `errors`, `response`) | `PLATFORM_PROVISIONING_OPERATIONS` (per operation: `action`, `http`, `input`, `httpInput`, `result`), `PlatformProvisioningOperationName`, `PlatformProvisioningInput<Op>`, `PlatformProvisioningResult<Op>`, `PLATFORM_PROVISIONING_HTTP_PATH_PREFIX`, `provisioningOperationForHttpPath`, `PLATFORM_PROVISIONING_ERROR_STATUS`, `platformProvisioningErrorSchema`, `platformProvisioningResponseSchema(result)`, `PlatformProvisioningResponse<T>`, `provisioningFieldSchemas`, `PLATFORM_ACCOUNT_STATUSES`, and each operation's `<op>InputSchema` and `<op>ResultSchema` with their types | - |
| Locked key | `platform/model-keys/secrets-locked.ts` | `SECRETS_LOCKED_ERROR_CODE` (`"secrets.locked"`), `SecretsLockedError`, `secretsLockedMessage(host)`, `isSecretsLockedError` | - |
| `PanelProduct` | `platform/panel/{panel-product,default-origin-allowlist}.ts` | `panelProductSchema`, `PanelProduct`, `PANEL_PRODUCT_ASSET_PATH`, `panelProductAssetUrl`, `PANEL_EMAIL_TEMPLATES`, `defaultClientGatewayOriginAllowlist` | - |
| IAM services, principals, origins | `iam/{service,principal,request-origin}.ts` | `IAM_SERVICES`, `isIamService`, `IAM_PROGRAM_SERVICE_PREFIXES`, `IAM_PRINCIPAL_TYPES`, `IAM_PLATFORM_ADMIN_PRINCIPAL`, `FLUXIQ_REQUEST_ORIGINS`, `isFluxIQRequestOrigin` | - |
| FRN | `iam/frn/{frn,parse-frn,format-frn}.ts` | `FluxIQResourceName`, `FRN_PREFIX`, `FRN_MAX_LENGTH`, `FRN_SEGMENT_PATTERN`, `FRN_SERVICE_SHAPES`, `parseFluxIQResourceName`, `formatFluxIQResourceName` | - |
| Action catalog format | `iam/action/{action-name,access-level,catalog-entry}.ts` | `IAM_ACTION_NAME_PATTERN`, `isIamActionName`, `iamActionName(service, endpoint)`, `IAM_ACCESS_LEVELS`, `IAM_DEFAULT_ACCESS_LEVEL_BY_CLASSIFICATION`, `iamActionSourceSchema`, `iamActionCatalogEntrySchema`, `iamActionCatalogSchema` and types | - |
| Policy grammar | `iam/policy/{policy-kind,policy-variables,pattern,statement,document}.ts`, `iam/policy/condition/{operators,keys,block}.ts` | `IAM_POLICY_KINDS`, `IAM_POLICY_LANGUAGE_VERSION` (`"2026-10-30"`), `iamPolicyDocumentSchema(kind)`, `parseIamPolicyDocument(value, kind)`, `IamPolicyDocument`, `iamPolicyStatementSchema`, `IamPolicyStatement`, `isIamActionPattern`, `isIamResourcePattern`, `IAM_CONDITION_OPERATORS`, `parseIamConditionOperator`, `IAM_CONDITION_KEYS`, `IAM_RESOURCE_TAG_KEY_PREFIX`, `iamConditionKeyValueType`, `iamPolicyConditionSchema`, `IAM_POLICY_VARIABLES`, `replaceIamPolicyVariables`, limits | Version `2026-10-30` |
| Predefined policy names | `iam/predefined-policies.ts` | `IAM_PREDEFINED_POLICIES` (name, kind, provisionable), `IAM_POLICY_NAME_PATTERN`, `isProvisionablePolicyName` | - |

Barrels: `iam/index.ts`, `platform/index.ts` and one per subdirectory. The subpath files
`src/iam.ts` and `src/platform.ts` exist because `tsconfig.base.json` and the vitest alias map
`@fluxiq/contracts/<x>` to `src/<x>.ts`. `src/index.ts` re-exports both, and `package.json`
`exports` gains `./iam` and `./platform`.

### Generated output

`pnpm docs:reference` rewrote `docs/reference/framework-reference.md`: 5 new declarations, all
gateway 0.2 types re-exported through `packages/fluxiq`. The same script also writes the identical
copy `packages/fluxiq/docs/reference/framework-reference.md`. That path is under
`packages/fluxiq/**`, which the brief marks "must not touch". It was written only by the named
command and was not edited by hand. Keep both copies or neither, because `docs:check` compares them.

## Decisions taken (for the supervisor)

The plan left each of these open or in conflict with a mechanical gate. In each case I took the
plan's recommendation, or the narrowest safe reading.

1. **No `browser` in identifiers. The plan's strings are kept.** The structure audit's
   web-vocabulary rule refuses any new identifier or property name containing "browser" under
   `packages/`, and its baseline may only shrink. The wire and record fields therefore use the
   gateway's generic client vocabulary:
   - `connectedClientId` replaces the plan's `connectedBrowserId`, in the token response and the
     credential record.
   - The record and view are `ConnectedClientRecord` and `ConnectedClientView`.
   - `runtime` replaces the record's `browser` field ("Chrome 156"). `os` is unchanged.

   The plan's IAM vocabulary is kept exactly, because the rule does not count string data:
   - resource type `gateway:browser/<id>`
   - condition key `fluxiq:ConnectedBrowserId`
   - policy `FluxIQBrowserSession`
   - `rotateCredentials` scope `"browsers"`
   - connect client id `"fluxiq-browser-extension"`
   - discovery key `"browser-extension"`

   If you would rather have one vocabulary, rename those strings to `client` in a follow-up.
2. **`CLIENT_GATEWAY_PROTOCOL_VERSION` stays `"0.1"`.** The new
   `CLIENT_GATEWAY_PROTOCOL_VERSIONS = ["0.1","0.2"]` is what discovery publishes. The stamped
   constant is also the `client-gateway.protocol` trace contract version. Offline trials refuse
   any trace recorded under another version (`offline-trial/reader-contracts.ts`), so raising it
   here would make every stored trace `incompatible_contract`. That change belongs to lane D, done
   together with a trace-compatibility decision. Compatibility holds today: both sides compare
   major versions (`protocol-version.ts`), and 0.1 and 0.2 share major 0.
3. **`client-gateway.ts` holds only the 0.2 types.** It sits at 14 of the 15 exported values the
   audit allows, and at 726 lines. The 0.2 constants and the run-context parser are therefore in
   `platform/gateway/`, and `client-gateway.ts` imports their types (type-only, no cycle).
4. **Every 0.2 addition is optional in the types.** This covers `runContext`, `session_ready.user`
   / `workspace` / `credentialExpiresAt`, `pairing_required.codeEntryUrl` and `clientLabel`.
   0.1 messages still type-check, and a test pins that. The plan says a 0.2 gateway sends
   `runContext` on every command. Whether a 0.2 client refuses a command without one under a
   public profile is lane D's rule; the contract does not enforce it.
5. **`startedFromSessionId` takes one of two forms.** Either a 64-hex SHA-256 session digest, the
   form identity-access already uses (`session-digest.ts`), or `client-gateway:<gateway session
   id>`, the prefix already in `caller.ts`. A raw UUID is refused, and so is a bare gateway
   session id, since both are UUIDs. The field is optional for work no session started
   (`schedule`, `cli`). `approvingSessionId` is held to the digest form only, and is nullable for
   migrated trusted clients.
6. **The credential record adds `clientInstallId`**, which the plan's field list lacks. The connect
   code is bound to the install id, so a reconnect from the same install can replace its record
   instead of counting toward the 10-client cap. It is nullable for migrated clients. Drop it if
   lane D disagrees.
7. **Provisioning action names all contain `Account`:**
   - `platform:CreateAccount`
   - `platform:SendAccountWelcome`
   - `platform:SetAccountPassword`
   - `platform:SetAccountPolicies`
   - `platform:AddAccountMembership`
   - `platform:DisableAccount`
   - `platform:EnableAccount`
   - `platform:DeleteAccount`
   - `platform:RotateAccountCredentials`
   - `platform:GetAccount`

   The plan's `FluxIQProvisioner` allows `platform:*Account*`. Operation names such as
   `sendWelcome` or `rotateCredentials` would otherwise fall outside that pattern. A test pins the
   coverage.
8. **`requestId` is required on every mutating operation.** The plan says every operation is
   idempotent by `requestId`. `getAccount` is a read and takes no `requestId`. Reusing a
   `requestId` with a different input returns `request_conflict`.
9. **Transport errors added.** The plan's 5 typed errors are kept. I added `invalid_input`,
   `unauthorized`, `forbidden`, `operation_unavailable`, `request_conflict`,
   `entitlement_required` and `rate_limited`, each with an HTTP status
   (`PLATFORM_PROVISIONING_ERROR_STATUS`). Over HTTP, `createAccount` for an existing email is
   `{status:"exists"}` with no ids; in-process it is `email_taken`.
10. **Listener paths use camelCase operation names**, for example `POST /provisioning/createAccount`.
    `setPassword` is not served (`operation_unavailable`). `createAccountHttpInputSchema` refuses a
    `password` field.
11. **Timestamps are epoch milliseconds everywhere**, matching the gateway's existing numbers.
12. **Token endpoint is OAuth-shaped.** It takes a JSON body and requires
    `grant_type: "authorization_code"` (RFC 6749). Errors are OAuth-shaped
    `{error, error_description}` and add `email_unverified`, `client_limit_reached`,
    `account_disabled` and `rate_limited`. Revoke follows RFC 7009: `{token}`, always answered 200.
    The done fragment adds a decline path: `#error=access_denied|server_error&state=`.
13. **Typed-code alphabet** is `23456789ABCDEFGHJKMNPQRSTUVWXYZ`, which drops 0, 1, I, L and O.
    Input is normalised by upper-casing and dropping spaces and hyphens. Codes are displayed as
    `ABCD-EFGH`.
14. **Origin grammar.** Accepted entries:
    - exact canonical `https:`/`http:` web origins
    - `chrome-extension://` followed by 32 characters from a to p
    - an exact `moz-extension://<uuid>`
    - `moz-extension://*` as the only prefix rule

    Refused entries: any other wildcard (including `chrome-extension://*`), paths, `null` and
    other schemes. The rule for a missing Origin follows N7. Public means the `service` profile or
    any bind beyond loopback, so self-hosted beyond loopback is treated as `service`:

    | Gateway | Missing Origin | Present Origin | Start without an allowlist |
    | --- | --- | --- | --- |
    | Public | refused | must match a rule; with no rules, none is admitted | refused |
    | Non-public, with rules | accepted | must match a rule | - |
    | Non-public, no rules | accepted | admits every origin (today's open behaviour) | allowed |

    `defaultClientGatewayOriginAllowlist(product)` returns the product's `extensionClients` origins
    plus `moz-extension://*`.
15. **Policy grammar:**
    - `Version` must be `"2026-10-30"`.
    - `Statement` must be a non-empty array of at most 100 statements.
    - `Sid` is optional, alphanumeric and unique.
    - Unknown fields and condition keys are refused, as are mismatched operator and key types.
    - The only variables are the plan's two. No `${$}`-style escapes, so a literal `$`, `{` or `}`
      in a pattern or string value is refused.

    Five kinds:

    | Kind | Rules beyond the common ones |
    | --- | --- |
    | `identity` | the common grammar |
    | `session` | the common grammar |
    | `boundary` | the common grammar |
    | `guardrail` | `Deny` statements only |
    | `trust` | a `Principal: {FluxIQ: ...}` element, `Action: "iam:AssumeRole"`, no resource element |

    The plan defines no trust-policy grammar. This is the AWS shape, and only a trust policy may
    carry `Principal`.
16. **FRN rules:**
    - Workspace segment: required for `studio`, `secrets` and `gateway`; empty for `platform`;
      optional for `iam` and `ops`. A platform-level `iam` FRN may only be `policy/` or
      `service-identity/`.
    - Studio children are `flow`, `recording`, `run` and `dataset` pairs, at any depth under
      `project/<id>`.
    - Identifiers are 1 to 128 of `[A-Za-z0-9._~@+=,-]`.
17. **`PanelProduct`:**
    - The brand accent subset is `{primary, primaryHover, focus}` per light and dark mode, taken
      from the theme's interaction tokens.
    - Assets are file names only.
    - `extensionClients[].origins` are Origin-grammar entries.
    - Email templates are keyed by `PANEL_EMAIL_TEMPLATES`, as `{subject, text}` with `{{name}}`
      placeholders.

## Commands run and observed results

- `node packages/contracts/node_modules/typescript/bin/tsc --noEmit -p packages/contracts/tsconfig.json`
  -> no output (clean), source and tests.
- `pnpm --filter @fluxiq/contracts test`
  -> "Test Files 35 passed (35) / Tests 487 passed (487)". The first full run failed one test:
  `https://*.getfluxiq.com` was accepted, because WHATWG URL parsing takes `*` as a host
  character. I fixed it in `origin-rule.ts` by refusing `*` and `?` before parsing, then reran.
- `pnpm structure:check` (`node scripts/structure-audit.mjs`)
  -> "structure-audit: passed (448 warning(s), 1152 baselined)". That matches the run before my
  changes. A middle run failed three `[naming]` shared-prefix findings (`condition-`, `connect-`,
  `token-`); I fixed them by moving those files into `policy/condition/`, `connect/` and
  `connect/token/`.
- `pnpm docs:reference`
  -> "Wrote docs/reference/framework-reference.md and packages/fluxiq/docs/reference/framework-reference.md
  (4225 public declarations)" (was 4220).
- `pnpm docs:check`
  -> "structure-audit: passed (0 warning(s), 0 baselined)" and "Deterministic framework reference
  is current.", exit 0.
- `pnpm check` (Core root)
  -> exit 0. The structure-audit node tests passed, then "structure-audit: passed (448 warning(s),
  1152 baselined)". All four type checks passed: `contracts:check`, `client-gateway-websocket:check`,
  `fluxiq:check` and `web:check`. The structure-audit step was not cached ("inputs changed while it
  ran"), because `pnpm docs:reference` was writing files at the same moment. It still passed.

## Not verified

- Behaviour in `packages/fluxiq` and `apps/web`. The contracts only describe it; lanes A to F
  implement it. `pnpm check` covers type compatibility only.
- The downstream web extension's build against the new types.
- `pnpm --filter @fluxiq/contracts build` (dist and `exports` resolution).
- The ten realistic scenarios and any live browser behaviour: not applicable.

## Open questions and what lanes will need that the plan does not define

- **Package version.** `@fluxiq/contracts` is published (it has `publishConfig`) and this unit adds
  features. The global rule asks for a minor bump (0.2.0 to 0.3.0) when it merges into `dev`. I
  left `version` alone, since the brief owns only `exports`.
- **The action catalog file itself.** `iam/actions.generated.ts` is not created. B2's generator
  writes it in the `iamActionCatalogSchema` format. Not defined by the plan:
  - the operator program ids that map to `ops`;
  - the action names for the 15 app routes;
  - each list or create endpoint's parent resource type. The format uses the parent type's chain,
    or `"*"`.
- **Role sessions.** The FRN for an assumed-role session (AWS `assumed-role/<role>/<session>`) is
  undefined, as is whether the audit's principal names it.
- **Hooks.** The server hook event names (`account.created` and the others) and the shapes of
  `registerFluxIQPlatform`, `registerEmailTemplate`, `registerHumanCheck`, `registerBillingProvider`
  and `registerEntitlementPolicy` are server-side function types. They belong to lane E in
  `packages/fluxiq`, so they are not frozen here.
- **Audit row and `authorize()`.** The decision audit row (`{time, requestId, principal, ...}`) and
  the `authorize(principal, action, resources, context)` signature are B2's, and not in contracts.
  If the panel's audit view or the extension needs the row shape, it should be added here.
- **Email template variables.** Each template's placeholder names, for example
  `{{welcomeUrl}}` or `{{displayName}}`, are B1's to define.
- **Credential format.** The credential is opaque (32 to 512 characters). A recognisable prefix,
  for example `fxc_`, would help secret scanning and log redaction; lane D decides.
- **Deferred deletion.** How long a `scheduled` deletion waits (`scheduledFor`) is not in the plan.
- **Existing allowlist entries.** Any configured entry that is not canonical, for example a short
  test `chrome-extension://abc` id, is refused by `parseClientGatewayOriginRule`. Lane A should
  surface refused entries at startup rather than drop them silently.
