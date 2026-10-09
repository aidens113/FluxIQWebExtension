# t379 paired tokens reach only what the pairing approved

Worker report, 2026-10-08. Tree `fxwork/t379`, Core `!FluxIQ` on
`task/t379-paired-token-project-scope`. Nothing committed.

## Outcome

Done. The pairing contract is **per account, not per project**: a person
approves a browser for their own account, and the token acts as that person.
Following the brief's second branch, behaviour is unchanged. The contract is now
written into the route's header comment and the client-gateway doc, and tests
check that a token reaches any project only as its approver, never as another
person. Core has no per-person project, so "another person's project" can only
be tested as "a token cannot act as another person"; see Open questions.

## Evidence for the contract (quoted from source)

- Approval names no project. `apps/web/src/app/api/client-gateway/approve-pairing/route.ts`
  reads only `pairingCode` and calls
  `approvePairing(pairingCode, { approvedByUserId: auth.user.id })`.
- The durable trust holds no project. `packages/fluxiq/src/client-gateway/service/pairing-flow.ts`
  `complete()` calls `trustedClients.register({ clientId, clientType, name, approvedByUserId })`.
  `pairing.projectId` is copied onto the live session only, and it comes from
  `session.projectId`, which a fresh session does not have before pairing.
- On reconnect, `lifecycle.ts` `resumeTrustedSession` does not restore a project
  from trust. It re-applies the client's new `hello.metadata`, including
  `domainId`, at every connection (`applyHello`: `if (hello.metadata !== undefined) session.metadata = hello.metadata`).
- The session's project is the current context and it moves.
  `commands.ts:51,130` (`startRecording`, `markActiveRecording`) overwrite
  `session.projectId`.
- The approval screen (`apps/web/src/app/GlobalClientGatewayPairing.tsx:153-160`)
  shows the client name and reference code with "Confirm pairing". It names no
  project and no domain.
- The extension follows Core's current project
  (`apps/extension/src/background/connection/project-context.ts` header: "Core
  owns the current project; the one stored in the extension session is only
  what Core last said ... A project the panel names explicitly never reaches
  here"). The panel also opens other projects
  (`panel/chat/project-navigation/binding.ts`), and the relays pass a named
  project through (`background/panel/conversation-relay.ts` `projectFor`).
- Core has no per-person project. Projects carry a `domainId` and no owner.
  Handlers read who acts from `request.actor` only. The existing
  `automation-studio/api/handlers/tests/domain-scope.test.ts` header already
  says: "any authenticated actor can name any domain. So
  `assertProjectDomainAccess` is not an authorization gate against a hostile
  caller".

## What changed and why

- `apps/web/src/lib/program-route.ts` (header comment only): adds the section
  "What a pairing approves (t379)", which states the per-account contract with
  its evidence. It also states the true strength of the domain rule: the client
  declares it, and only the endpoints that return stored content (threads and
  datasets) check a project's domain. The fourth rule's sentence now says it
  holds "through the endpoints that assert a project's domain". No code changed.
- `docs/architecture/automation-studio/client-gateway.md`: adds a paragraph,
  "What a pairing approves", before the four rules. It adds the binding-not-approval
  caveat to the domain rule. In the pause/resume bullet, "in its own domain"
  becomes a pointer to that paragraph, because those handlers do not assert a
  project's domain.
- `apps/web/src/app/api/programs/[programId]/[endpoint]/tests/route.test.ts`:
  - Adds `pause-runtime-session`, `resume-runtime-session` and
    `get-runtime-run-control` to the test's `ALLOWLISTED`/`CLASSIFICATIONS`.
    t376 allowlisted them, but this suite still treated them as "other"
    endpoints, which passed only because their mock classification fell back
    to `destructive`.
  - Adds a `describe("reaches a project only as the person who approved the pairing")` with:
    - 8 endpoints whose body names another person's project and identity
      (`actorId`, `userId`, `operatorUserId`, `authSessionId`). The actor is
      still exactly the approver with the approver's narrowed permissions, the
      scope is the declared domain, and no auth session is passed on.
    - A review naming `reviewerId` of another person is refused with 403.
    - A call naming a project other than the session's current one reaches Core
      as the approver. This pins the per-account contract so a change to it is
      deliberate.
    - A disabled approver reaches nothing, even while another person is enabled.

## Commands run and observed results

- Baseline before edits:
  `npx vitest run src/lib/tests/program-route.test.ts "src/app/api/programs/[programId]/[endpoint]/tests/route.test.ts"`
  (in `apps/web`) -> 2 files passed, 55 tests passed.
- After the edits, same command -> 2 files passed, 69 tests passed (20 + 49).
- `npx tsc --noEmit -p tsconfig.json` (in `apps/web`) -> exit 0, no output, 1m08s.
- `node scripts/structure-audit.mjs` -> "structure-audit: passed (291 warning(s), 710 baselined)", exit 0.
  New advisory warning: `route.test.ts` is 429 lines, past the 400-line
  advisory threshold (the hard limit is 800). The `program-route.ts` warning,
  11 exported values, was already there.
- `pnpm docs:check` -> "structure-audit: passed (0 warning(s), 0 baselined).
  Deterministic framework reference is current.", exit 0.

## Not verified

- No live pairing or browser run, and the panel was not started. The tests
  mock `getFluxIQ`, so Core's real handlers are not exercised through the
  route.
- I did not run a fail-first mutation of the route to prove that the new tests
  fail when the actor is taken from the body. Their assertions compare the
  forwarded actor exactly, so they would.
- No full suites, per the twice-a-day rule.

## Open questions or contradictions found

1. **"Another person's project" does not exist in Core.** Projects belong to a
   domain, and every person whose role grants the permission reaches every
   project of that domain by cookie. A token therefore reaches exactly what its
   approver's login reaches, with fewer permissions. The tests check the
   boundary that does exist: another person.
2. **The domain rule is weaker than the old header claimed.** The client
   self-declares `metadata.domainId` at every `client.hello`, and the person
   never approves it. Of the allowlisted endpoints, only the conversation
   endpoints and `export-run-dataset` assert a project's domain. These do not:
   `list-runtime-sessions`, `cancel-runtime-session`, `cancel-flow-bootstrap`,
   `pause-runtime-session`, `resume-runtime-session`, `get-runtime-run-control`,
   `list-flow-summaries`, `list-flow-runs`, `get-flow-run-detail`,
   `list-flow-adaptations`, `run-runtime-session`, `generate-recording-proposal`,
   `review-recording-flow-proposal` and `remove-recording-entry`. A
   web-automation token can therefore pause, cancel or run a saved Flow in
   another domain's project, as its approver could by cookie. This is not a
   privilege beyond the approver, but it contradicts the old wording. The docs
   now say so. Whether to make domain a gate (assert it in the run-control and
   Flow handlers, and bind the domain into the trust record at approval) is a
   supervisor decision. It needs Core handler files this brief did not own.
3. If the product wants per-project pairing, the approval screen, the trust
   record (`trusted-clients.ts`) and the extension's project navigation would
   all need to change first. The route alone cannot enforce it, because no
   approved project exists to compare against.

## Follow-up (coordinator, same day): the domain is now a real gate

### Outcome

Done. Open question 2 above is resolved by this follow-up. The domain is no
longer only a binding: a pairing now binds the domain, and the program route
enforces it on every token call that names a project.

### What changed and why

- **Trust binds the domain.** `packages/contracts/src/client-gateway.ts`:
  `ClientGatewayTrustedClient.domainId?: string | null`, with a doc comment.
  `client-gateway/service/declared-domain.ts` (new, exported from the service
  barrel) provides `declaredDomainId(metadata)`. `pairing-flow.ts` `complete()`
  registers `domainId: declaredDomainId(session.metadata)`, and
  `trusted-clients.ts` `register` stores it.
- **A different declared domain is refused.** `lifecycle.ts`
  `resumeTrustedSession` refuses to resume when the trust's `domainId` is
  absent (trust minted before this change) or differs from the hello's
  declared domain. It records the audit entry `session.domain_rejected` with the
  bound and declared ids, and returns `false`. That falls into the existing
  path unchanged (`server.pairing_required` and a new approval), which binds the
  new domain. Nothing is rotated. `access.ts` `authorizeToken` also returns null
  for a ready session whose declared domain is not its trust's, so the route's
  `metadata.domainId` is always the bound domain.
- **The route gate.** `apps/web/src/lib/program-route.ts`: new
  `pairedClientProjectTarget(programId, payload, currentProjectId)`.
  - For Automation Studio calls it returns the body's `projectId`, checked
    exactly as sent, or the session's current project when the body names none,
    or null when neither does.
  - A non-string `projectId` is refused.
  - The secret-keys snapshot names no project, so it is not checked.

  `route.ts`: after narrowing, by GET and POST, `refuseProjectOutsideDomain`
  calls `fluxiq.programs.automationStudio.assertProjectDomainAccess(project, boundDomain)`.
  Any throw is answered 403 `"A paired client may only reach projects in the
  domain it was approved for."`, including for a project that does not exist,
  so the answer reveals nothing about which ids exist. Cookie callers are
  untouched. The header comment's fourth rule and "What a pairing approves" now
  state the gate.
- **Doc.** `docs/architecture/automation-studio/client-gateway.md`: the domain
  rule now states the binding, the re-pair on a domain change or on legacy
  trust, the `authorizeToken` guarantee, and the route gate. The pause/resume
  bullet, the "What a pairing approves" paragraph and connection-flow step 7
  were updated to match.
- **Tests.**
  - `client-gateway/tests/trust-domain.test.ts` (new, 5 tests):
    - The bound domain is recorded and kept on a same-domain reconnect.
    - A client approved with no domain is bound to none.
    - A different declared domain is refused with the audit entry and nothing
      rotated, and the existing re-pair binds the new domain.
    - Legacy trust without `domainId` needs a new approval.
    - The bound domain persists across a restart.
  - `apps/web/.../tests/route-domain-gate.test.ts` (new, 15 tests):
    - Another domain's project is refused on a run, a pause, a Flow and a
      recording endpoint.
    - The same-domain project passes on all four.
    - A missing project and a non-string id are refused.
    - When no project is named, the session's current project is checked, by
      POST and GET.
    - Nothing is checked when no project is known.
    - A client with no domain reaches only projects with none.
    - The secret-keys snapshot is not gated.
    - Cookie calls are ungated.
  - `route.test.ts`: the mock gains `automationStudio.assertProjectDomainAccess`
    (resolves by default).

### Commands run and observed results

- `pnpm --filter @fluxiq/contracts --filter fluxiq build` -> both built (the web
  vitest config refuses a stale Core dist), then reused on the second run.
- `pnpm --filter fluxiq --filter @fluxiq/contracts check` -> both Done, no TS errors.
- Fail-first on the route gate: `if (outside) return outside;` replaced with
  `void outside;`, then the gate tests run -> 8 failed, 7 passed. Source
  restored, and the grep count of the restored line is 2.
- Fail-first on the resume check: condition replaced with `false`, then
  trust-domain tests -> 4 failed, 1 passed. Source restored, and the grep
  confirms the check is back.
- `npx vitest run src/lib/tests/program-route.test.ts "src/app/api/programs/[programId]/[endpoint]/tests/"`
  (apps/web) -> 3 files, 84/84 passed (20 + 15 + 49).
- `npx vitest run src/client-gateway src/programs/automation-studio/client-gateway/tests/bridge.test.ts`
  (packages/fluxiq) -> 8 files, 86/86 passed.
- `npx tsc --noEmit -p tsconfig.json` (apps/web) -> exit 0.
- `node scripts/structure-audit.mjs` -> "passed (291 warning(s), 710 baselined)".
  The advisories on touched files:
  - `program-route.ts` has 12 exported values.
  - `client-gateway/service/` has 19 files.
  - `route.test.ts` is 434 lines.
- `pnpm docs:check` -> passed, and "Deterministic framework reference is
  current". The service barrel is not public, and the contract field did not
  change the reference.

### Extension compatibility (read only, downstream `apps/extension`)

The extension needs no code change.
`background/connection/gateway-session.ts` `clientHello()` always declares
`metadata.domainId: WEB_AUTOMATION_DOMAIN_ID` (`"web-automation"`, from
`domain/src/constants.ts`), so its trust binds `web-automation` and every
reconnect matches.

There is one visible effect. A browser paired before this change holds trust
with no `domainId`, so on its next connect it gets `server.pairing_required`.
The extension already handles that, through the same path as an expired
credential (`client.on("pairing_required")` sets `pairing` and shows the
reference code). The person approves it once. The Lab pairs fresh through
`approve-pairing` (`test-runner/src/run-lifecycle/pair-extension.ts`), so it is
unaffected.

### Not verified (follow-up)

- No live extension pairing or browser run.
- No real `AutomationStudioService` behind the route: the gate's Core check is
  mocked in the route tests, though it is the same method the content handlers
  already use.

### Open questions (follow-up)

1. **The extension can adopt a project in another domain.** It takes Core's
   current project from `/api/client-gateway/snapshot` (`project-context.ts`).
   If the person has a non-web-automation project open in the web panel, or a
   recording started under one sets `session.projectId`, the extension's token
   calls are now refused with 403, where before they were allowed. The snapshot
   route could name only a project in the session's bound domain. That is not
   changed here.
2. **Other token routes are not gated.**
   - `GET /api/recordings` lists recording summaries for any valid token across
     all domains.
   - The state-assets upload route checks only the session's project, not its
     domain.

   Both are outside the program route.
3. **`run-runtime-session` accepts `authorizedDomainIds`** in its body
   (`runtime-execution.ts:17`), and token narrowing does not refuse it. Worth
   deciding whether a token run may name domains at all.
4. **A deleted session project blocks project-less token calls.** If the
   session's current project is deleted, token calls that name no project are
   refused until the client reconnects, which clears it. This fails closed by
   design.

## Second follow-up: the three openings closed

### Outcome

Done in Core. Openings 1 to 3 of the previous follow-up are closed. The
extension needs one small change before a person sees the new refusal sentence
in the chat (see "Extension display").

### What changed and why

1. **Every token route gates on the bound domain.**
   - A new shared helper, `apps/web/src/lib/paired-client-project-domain.ts`,
     provides `pairedClientProjectDomainRefusal(automationStudio, projectId, domainId)`.
     It calls `assertProjectDomainAccess` and returns null when the project is
     in the domain. Otherwise it returns
     `{ errorCode: "authorization.project_domain", error: <plain sentence> }`,
     and a project that does not exist gets the same answer. The program
     route's gate now uses it.
   - `state-assets/[projectId]/[sha256]/route.ts` (PUT): the token branch now
     also applies `pairedClientDomainScope`, then the helper, so nothing is
     stored in a project outside the bound domain. Refusals carry `errorCode`.
     GET was already cookie-only.
   - `app/api/recordings/route.ts`: a token caller now lists with
     `listRecordingSummaries({ page, pageSize, domainId: <bound> })`, and a URL
     naming another domain is refused with 403. Cookie callers are unchanged:
     no `domainId` is passed. An invalid token still falls back to the cookie.
   - Core `runtime/service.ts` `listRecordingSummaries` accepts an optional
     `domainId`, passed to `listProjects`. The change is two lines, net zero,
     because the file is at its frozen 4381-line baseline. Note that without a
     domain, `listProjects()` returns only projects with no domain. A token
     therefore used to list unscoped projects' recordings; it now lists its own
     domain's.
2. **`authorizedDomainIds` is refused.** `narrowRunRuntimeSession` refuses it
   with 403 "A paired client's run may not carry authorizedDomainIds."
   (`runtime/composite-execution/owner.ts` uses it to bind extra domains into a
   composite run). None of the other allowlisted handlers reads a
   domain-widening field from the body. I checked by grepping the handlers for
   `domainId` and `authorizedDomainIds`; only `caches.ts`, which is not
   allowlisted, does.
3. **The refusal has a reason a person can act on.** The answer is 403 with
   `errorCode: "authorization.project_domain"` and the sentence: "This browser
   was paired for web automation projects, and this project is not one. Open a
   web automation project in FluxIQ, then try again." The domain id has its
   hyphens turned into spaces. There is a separate sentence for a browser paired
   with no domain.

Docs updated:
- `client-gateway.md`: three token routes, the error code and sentence, and
  `authorizedDomainIds` added to the narrowing list.
- `persistence.md`: the guard column of the state-asset row.

### Extension display (read only): needs a change

`apps/extension/src/background/connection/core-api.ts:157` `callCoreProgram`
maps every 401 and 403 to `code: "refused"`, keeping Core's `error`. The chat's
`panel/chat/conversation/controller.ts:169,176` then turns any `refused` into
the "Talk to FluxIQ in the FluxIQ window." fallback and drops the sentence. So
today a person whose web-panel project is in another domain sees that fallback,
not the reason.

Needed change: in `callCoreProgram`, answer a 403 whose body carries
`errorCode: "authorization.project_domain"` as `code: "failed"`, with Core's
`error`, so the existing failure path shows the sentence. Other panels that show
`error` for `refused` already show it.

The state-asset upload (`core-api.ts:~100`) throws "FluxIQ state asset upload
failed (403)." without the sentence. That is acceptable for a background
screenshot upload, but it could carry `error` too.

### Commands run and observed results

Fail-first: each guard was removed, the tests ran, then the source was
restored and the full suites were re-run green.

| Guard removed | Tests run | Result |
| --- | --- | --- |
| `domainId` not passed in `/api/recordings` | recordings route tests | 2 failed, 3 passed |
| State-asset refusal line | state-asset tests | 2 failed, 2 passed |
| `authorizedDomainIds` dropped from the refused list | gate tests | 1 failed, 15 passed |
| `authorizedDomainIds` dropped from the refused list | unit tests | 1 failed, 20 passed |
| Error code set back to `authorization.forbidden` | gate tests | 6 failed, 10 passed |
| Service domain filter (`listProjects()` restored) | `summary-domain.test.ts` | 1 failed |

After the edits:
- `pnpm --filter fluxiq build` and `check` -> built, exit 0.
- apps/web
  `vitest run src/lib/tests/program-route.test.ts ".../[endpoint]/tests/" src/app/api/recordings ".../state-assets"`
  -> 5 files, 95/95 passed.
- packages/fluxiq
  `vitest run src/client-gateway .../client-gateway/tests/bridge.test.ts .../runtime/tests/service-recordings`
  -> 129/129 passed on 5 of 6 runs. One run, right after the rebuild, reported
  1 failed of 129, and I did not capture which test. The five runs since were
  all 129/129. Treat it as an unidentified flake in these suites; I did not
  investigate it.
- apps/web `npx tsc --noEmit -p tsconfig.json` -> exit 0.
- `node scripts/structure-audit.mjs` -> first it failed `[file-lines]
  runtime/service.ts 4382 > baseline 4381`, caused by my doc comment, which I
  removed. Then "passed (291 warning(s), 710 baselined)".
- `pnpm docs:check` -> passed, and "Deterministic framework reference is
  current".

New tests:
- `apps/web/src/app/api/recordings/tests/route.test.ts` (5)
- `apps/web/src/app/api/programs/automation-studio/state-assets/[projectId]/[sha256]/tests/route.test.ts` (4)
- `packages/fluxiq/src/programs/automation-studio/runtime/tests/service-recordings/tests/summary-domain.test.ts` (1)
- 2 tests added to `route-domain-gate.test.ts` (the `authorizedDomainIds`
  refusal and the no-domain sentence)
- 1 test added to `program-route.test.ts`

### Not verified

- No live extension run.
- The extension change above is not made: the downstream tree is read only
  for me.
- The one unidentified Core test failure in a single run.
