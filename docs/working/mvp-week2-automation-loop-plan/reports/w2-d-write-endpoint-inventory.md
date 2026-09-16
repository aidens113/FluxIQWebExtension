# W2-D — Write endpoint inventory and PIN classification (Core)

Read-only investigation. No code changed in either repository.

## Outcome

Every Core write endpoint is inventoried below with its file:line, permission,
what it writes, and whether it requires a PIN today. Core registers **220
endpoints** across 10 programs. **57 of them call the shared PIN helper, and all
57 are in `automation-studio`.** No other program uses that helper at all —
`secret-keys` and `database-manager` have their own, stronger credential gates,
and the rest have none.

The headline for the L16 decision: the PIN today does **not** track destruction.
It tracks "automation-studio mutation". `delete-run-datasets` deletes a user's
captured rows with no PIN, `run-runtime-session` drives a real browser against
real sites with no PIN, and `POST /api/framework/setup {action:"migrate"}`
rewrites the whole storage backend with no PIN — while `apply-graph-patch`,
which moves a node on a canvas, requires one. The boundary the user described is
a coherent rule that the codebase does not currently implement in either
direction.

## 1. Where the PIN is actually enforced (brief item 3)

**The shared helper.** `authorizeProgramPin(identityAccess, payload)` at
`packages/fluxiq/src/programs/_shared/authorization.ts:14`. It validates the
payload's `authorizationPin` shape (4–12 digits) and calls
`identityAccess.authorizeSessionPin({ sessionId, pin })`.

**It is not middleware.** It is an ordinary `await` on the first line of each
handler body. `GlobalProgramApiRegistry.register()`
(`packages/fluxiq/src/programs/_shared/api.ts:39`) accepts only
`{ programId, endpoint, permission, handler }` — there is no field in which an
endpoint could declare that it needs a PIN. `registry.call()`
(`api.ts:50`) enforces **authentication and the permission** centrally and then
hands off to the handler; the PIN is entirely the handler's own business.

So enforcement is **scattered across 57 call sites in 9 files**:
`subflows.ts` (9), `recordings.ts` (13), `router.ts` (6), `projects.ts` (7),
`flow-lifecycle.ts` (8), `flows.ts` (4), `client-gateway.ts` (4),
`artifacts.ts` (2), `instructions.ts` (1), `runs.ts` (1).

**Could a single classification table drive it?** Yes, and the structure is
unusually favourable:

- There is exactly **one** chokepoint for every program endpoint:
  `registry.call()` at `_shared/api.ts:50`, reached over HTTP through the single
  catch-all route `apps/web/src/app/api/programs/[programId]/[endpoint]/route.ts`.
- The session id the PIN check needs is already injected centrally, not by
  handlers: `withProgramAuthSession()` at `apps/web/src/lib/program-route.ts:15`
  stamps `authSessionId` onto the payload for `automation-studio`,
  `identity-access`, `database-manager` and `secret-keys`.
- So a `DESTRUCTIVE_ENDPOINTS` set consulted inside `registry.call()`, exactly
  where `permission` is checked, would replace all 57 inline calls. The handlers
  would lose their `authorizeProgramPin` lines and their `identityAccess`
  dependency.

The one wrinkle: `registry.call()` lives in `_shared` and does not currently
hold an `IdentityAccessService` reference. It would need one injected at
construction (`createGlobalProgramRuntime`), which is a contained change.

**Two other credential gates exist and must not be confused with this one.**
Any plan that says "remove the PIN from writes" has to say which gate it means:

| Gate | Where | Strength |
| --- | --- | --- |
| `authorizeProgramPin` | `_shared/authorization.ts:14` | PIN only |
| `authorizeSecretMutation` | `secret-keys/api/handlers.ts:88` | password + PIN, plus TOTP except on create |
| `authorizeSensitiveStore` / `recheckSessionCredentials` | `database-manager/api/handlers.ts:114,123` | password + PIN + TOTP, or a 5-minute grant |
| inline `authorizeSessionCredentials` | `identity-access/api/handlers.ts:42,114` and in-service | password + PIN + TOTP, only on some endpoints |

**A PIN cannot be supplied by a cold process.** `authorizeSessionPin`
(`identity-access/runtime/service.ts:347`) verifies against a credential
unlocked **in the current process** by a password login; no PIN verifier is
persisted. After a restart, every PIN-gated action fails with "PIN verifier
upgrade required. Sign out and sign back in." This is the mechanical reason an
autonomous loop cannot supply a PIN, and it is confirmed in
`docs/architecture/package-boundaries.md:138-141`. There is no PIN session
window: every gated call re-verifies.

## 2. Complete write endpoint table (brief items 1 and 2)

`PIN?` = calls `authorizeProgramPin` today. Proposed: `destructive` keeps the
PIN, `authoring` loses it. Rows marked **[?]** are flagged as genuinely
ambiguous and are discussed in section 3.

### automation-studio — flow graph, flows, settings

| Endpoint | file:line | Perm | Writes | PIN? | Proposed | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| `create-flow` | flows.ts:47 | flows.write | New flow document | yes | authoring | Creating flow content |
| `save-flow` | flows.ts:66 | flows.write | Whole flow document | yes | authoring | Editing flow content |
| `update-flow-settings` | flows.ts:77 | flows.write | Flow name/interface/execution defaults/metadata | yes | authoring | Editing flow settings, no data removed |
| `apply-graph-patch` | flows.ts:111 | flows.write | Graph nodes/edges, revision-tracked | yes | authoring | The core authoring write the loop needs |
| `compile-flow-source` | flow-lifecycle.ts:10 | flows.write | Compiles and saves flow source module | yes | authoring | Editing flow content |
| `convert-flow-to-visual` | flow-lifecycle.ts:20 | flows.write | Replaces code representation with visual | yes | authoring **[?]** | Representation change; may discard the code source |
| `delete-flow` | flow-lifecycle.ts:30 | flows.write | Removes the flow | yes | **destructive** | Named explicitly by the user |
| `publish-flow` | flow-lifecycle.ts:40 | flows.write | Immutable publication snapshot | yes | authoring **[?]** | Additive, but makes a version visible to callers |
| `deprecate-flow-publication` | flow-lifecycle.ts:56 | flows.write | Publication lifecycle status | yes | authoring | Documented non-destructive (`automation-studio.md:747`) |
| `migrate-flows` | flow-lifecycle.ts:95 | flows.write | Canonical copies + ledger; legacy sources preserved | yes | authoring | Creates, removes nothing |
| `record-legacy-retirement-evidence` | flow-lifecycle.ts:106 | flows.write | Retirement audit evidence | yes | authoring | Appends audit rows |
| `verify-legacy-backup` | flow-lifecycle.ts:108 | flows.write | Backup verification report | yes | authoring | Verification record |
| `seal-legacy-writes` | flow-lifecycle.ts:109 | flows.write | Locks legacy writes at schema 0.2 | yes | **destructive** | Irreversible capability removal |
| `rollback-flow-migration` | flow-lifecycle.ts:112 | flows.write | Reverses a migration | yes | **destructive** | Removes canonical artifacts the migration created |
| `inspect-flow-migration` | flow-lifecycle.ts:86 | flows.write | Nothing — read only | no | n/a | Mislabelled permission; see §5 |

### automation-studio — subflows

| Endpoint | file:line | Perm | Writes | PIN? | Proposed | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| `create-flow-subflow` | subflows.ts:47 | flows.write | New subflow | yes | authoring | Creating flow content |
| `update-flow-subflow` | subflows.ts:79 | flows.write | Subflow mappings, overrides, tags | yes | authoring | Editing flow content |
| `rename-flow-subflow` | subflows.ts:102 | flows.write | Subflow name | yes | authoring | Editing flow content |
| `duplicate-flow-subflow` | subflows.ts:112 | flows.write | Copy of a subflow | yes | authoring | Creation only |
| `disable-flow-subflow` | subflows.ts:124 | flows.write | Status → disabled | yes | authoring | Reversible status change |
| `enable-flow-subflow` | subflows.ts:144 | flows.write | Status → active | yes | authoring | Reversible status change |
| `archive-flow-subflow` | subflows.ts:134 | flows.write | Status → archived | yes | authoring | Reversible, and the soft alternative to delete |
| `delete-flow-subflow` | subflows.ts:154 | flows.write | Removes the subflow | yes | **destructive** **[?]** | Removes a separately-addressable authored artifact; `archive` exists as the loop's soft path |
| `migrate-legacy-flow-representation` | subflows.ts:62 | flows.write | Rewrites subflow representation | yes | authoring **[?]** | Representation rewrite |

### automation-studio — router / flow map

| Endpoint | file:line | Perm | Writes | PIN? | Proposed | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| `save-flow-map-route-group` | router.ts:80 | flows.write | Route group upsert | yes | authoring | Editing flow content |
| `save-flow-map-route` | router.ts:106 | flows.write | Route upsert incl. condition | yes | authoring | Editing flow content |
| `save-flow-map-fallback` | router.ts:129 | flows.write | Router fallback target | yes | authoring | Editing flow content |
| `mutate-flow-map-route` | router.ts:155 | flows.write | move/duplicate/toggle, **and delete** | yes | authoring **[?]** | Fine-grained in-flow edit; one of its five actions deletes |
| `delete-flow-map-route` | router.ts:166 | flows.write | Removes one route | yes | authoring **[?]** | Fine-grained in-flow edit, re-creatable |
| `delete-flow-map-route-group` | router.ts:96 | flows.write | Removes a group | yes | **destructive** **[?]** | Removes a container and its grouping, not one rule |

### automation-studio — instructions, adaptations, generation

| Endpoint | file:line | Perm | Writes | PIN? | Proposed | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| `save-flow-instruction` | instructions.ts:53 | flows.write | Instruction create/update | yes | authoring | Creating and editing flow content |
| `review-flow-adaptation` | runs.ts:114 | flows.write | Approve/apply/reject an adaptation | yes | authoring **[?]** | The loop's key write; "apply" changes durable flow behaviour |
| `save-flow-generation-instruction` | llm-generation.ts:55 | flows.write | Generation instruction | **no** | authoring | Already un-gated; guarded by session-id match |
| `generate-flow-bootstrap-adaptation` | llm-generation.ts:71 | flows.write | Proposed adaptation (spends LLM budget) | **no** | authoring **[?]** | Already un-gated; real money, gated by execution grant |
| `issue-llm-execution-grant` | llm-generation.ts:38 | runtime.control | Spend authorization grant | **no** | authoring **[?]** | Already un-gated; authorizes cost |

### automation-studio — projects, categories, hierarchy, artifacts, caches

| Endpoint | file:line | Perm | Writes | PIN? | Proposed | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| `create-project` | projects.ts:62 | programs.write | New project | yes | authoring | Creation only |
| `update-project` | projects.ts:72 | programs.write | Project name/description/category | yes | authoring | Editing metadata |
| `delete-project` | projects.ts:82 | programs.write | Removes a project | yes | **destructive** | Named explicitly by the user |
| `create-project-category` | projects.ts:92 | programs.write | New category | yes | authoring | Creation only |
| `update-project-category` | projects.ts:102 | programs.write | Category name | yes | authoring | Editing metadata |
| `delete-project-category` | projects.ts:112 | programs.write | Removes a category | yes | **destructive** **[?]** | Removes persisted user data, but low-stakes organizational only |
| `reorder-project-categories` | projects.ts:122 | programs.write | Category order | yes | authoring | Ordering only |
| `save-project-hierarchy` | projects.ts:174 | programs.write | Hierarchy nodes **and `deletedHierarchyIds`** | **no** | **destructive** | Deletes user-authored organization — see §5 |
| `put-project-hierarchy-node` | projects.ts:192 | programs.write | One hierarchy node | **no** | authoring | See §5 (doc says it should be gated) |
| `delete-project-hierarchy-node` | projects.ts:209 | programs.write | Removes a hierarchy node | **no** | **destructive** | See §5 |
| `save-project-artifact` | artifacts.ts:19 | flows.write | Project artifact document | yes | authoring | Editing content |
| `delete-project-artifact` | artifacts.ts:32 | flows.write | Removes artifact, cascades with `deleteOwnedArtifacts` | yes | **destructive** | Removes persisted user data, with a cascade |
| `save-project-ui-cache` | caches.ts:18 | programs.write | Per-user editor UI state | **no** | authoring | Disposable per-user cache |
| `delete-project-ui-cache` | caches.ts:27 | programs.write | Clears UI cache keys | **no** | authoring | Disposable cache |
| `put-reusable-llm-context` | caches.ts:66 | flows.write | Reusable LLM context record | **no** | authoring | Derived, regenerable cache |
| `delete-reusable-llm-context` | caches.ts:75 | flows.write | Removes one context record | **no** | authoring | Derived cache, regenerable |
| `clear-reusable-llm-context-scope` | caches.ts:85 | flows.write | Bulk clears a scope | **no** | authoring **[?]** | Bulk delete, but of derived cache |
| `purge-expired-reusable-llm-contexts` | caches.ts:94 | flows.write | TTL purge | **no** | authoring | Expiry housekeeping |

### automation-studio — recordings and the mining pipeline

| Endpoint | file:line | Perm | Writes | PIN? | Proposed | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| `create-recording` | recordings.ts:73 | runtime.control | New recording session | yes | authoring | Creation only |
| `update-recording` | recordings.ts:83 | runtime.control | Recording metadata | yes | authoring | Editing metadata |
| `delete-recording` | recordings.ts:93 | runtime.control | Removes a recording | yes | **destructive** | Named explicitly by the user |
| `delete-recordings` | recordings.ts:103 | runtime.control | Removes many recordings | yes | **destructive** | Bulk removal of user data |
| `delete-proposal` | recordings.ts:113 | runtime.control | Removes a proposal | yes | **destructive** **[?]** | Removes persisted data, though derived |
| `append-recording-entry` | recordings.ts:146 | runtime.control | Appends a captured event | yes | authoring | Append-only capture; high frequency from the extension |
| `append-recording-note` | recordings.ts:156 | runtime.control | Appends a note | yes | authoring | Append-only |
| `append-recording-marker` | recordings.ts:166 | runtime.control | Appends a marker | yes | authoring | Append-only |
| `finalize-recording` | recordings.ts:176 | runtime.control | Seals the recording | yes | authoring **[?]** | Ends capture; not reopenable |
| `repair-recording-state-index` | recordings.ts:56 | runtime.control | Rebuilds the state index (`mode:"write"`) | yes | authoring **[?]** | Maintenance rewrite of a derived index |
| `approve-policy-proposal` | recordings.ts:308 | flows.write | Writes a canonical flow from a proposal | yes | authoring **[?]** | Creates flow content via an approval gate |
| `review-recording-flow-proposal` | recordings.ts:333 | flows.write | Approves/rejects, writes canonical flow | yes | authoring **[?]** | Same shape as above |
| `replay-policy-against-recording` | recordings.ts:346 | runtime.control | Replay result | yes | authoring | Replays against stored data, no external effect |
| `process-finalized-recording` | recordings.ts:186 | flows.write | Pipeline artifacts | **no** | authoring | Derived artifacts, already un-gated |
| `generate-recording-proposal` | recordings.ts:195 | flows.write | Proposal | **no** | authoring | Derived, already un-gated |
| `normalize-recording` | recordings.ts:217 | flows.write | Normalized timeline | **no** | authoring | Derived, already un-gated |
| `create-normalization-review` | recordings.ts:226 | flows.write | Review record | **no** | authoring | Derived, already un-gated |
| `mine-recording-evidence` | recordings.ts:271 | flows.write | Mining run | **no** | authoring | Derived, already un-gated |
| `learn-task-model` | recordings.ts:283 | flows.write | Learned task model | **no** | authoring | Derived, already un-gated |
| `propose-policy-from-model` | recordings.ts:295 | flows.write | Policy proposal | **no** | authoring | Derived, already un-gated |
| `create-recording-flow-proposals` | recordings.ts:324 | flows.write | Flow proposals | **no** | authoring | Derived, already un-gated |

This block matches `docs/architecture/automation-studio/persistence.md:515-521`,
which states that proposal-generation endpoints "write derived inert artifacts"
and deliberately "do not require a PIN recheck".

### automation-studio — runtime execution and the client gateway

| Endpoint | file:line | Perm | Writes | PIN? | Proposed | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| `start-runtime-session` | runtime-execution.ts:10 | runtime.control | Creates a run | **no** | authoring **[?]** | Already un-gated; begins real execution |
| `run-runtime-session` | runtime-execution.ts:19 | runtime.control | Executes the flow against real sites, writes run records, may auto-apply adaptations | **no** | authoring **[?]** | Already un-gated; the single most externally-consequential endpoint — see §3 |
| `append-recording-domain-event` | runtime-execution.ts:92 | runtime.control | Appends a recording event | **no** | authoring | Inconsistent with the PIN-gated `append-recording-entry` — see §5 |
| `execute-client-action` | client-gateway.ts:91 | runtime.control | Clicks/types/submits in the operator's real browser | yes | **destructive** | The clearest irreversible external action in Core |
| `revoke-client-trust` | client-gateway.ts:42 | runtime.control | Removes a trusted client | yes | **destructive** | Removes persisted trust; security boundary |
| `start-client-recording` | client-gateway.ts:54 | runtime.control | Starts capture on a paired browser | yes | authoring **[?]** | Creation, but drives a live browser |
| `stop-client-recording` | client-gateway.ts:65 | runtime.control | Stops capture | yes | authoring **[?]** | Ends capture |
| `capture-client-snapshot` | client-gateway.ts:77 | runtime.control | Queues a snapshot on a live client | **no** | authoring | Already un-gated |

### automation-studio — datasets

| Endpoint | file:line | Perm | Writes | PIN? | Proposed | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| `delete-run-datasets` | datasets.ts:71 | flows.write | **Deletes captured dataset rows** | **no** | **destructive** | The user named datasets explicitly; un-gated today — see §5 |

### Other programs — none use the shared PIN helper

| Endpoint | file:line | Perm | Writes | PIN? | Proposed | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| `secret-keys/create-key` | secret-keys/api/handlers.ts:24 | secrets.manage | New secret | password+PIN | **destructive** (unchanged) | Keeps its own stronger gate; out of L16's scope |
| `secret-keys/update-key` | :37 | secrets.manage | Secret metadata | password+PIN+TOTP | **destructive** (unchanged) | Same |
| `secret-keys/rotate-key` | :50 | secrets.manage | Replaces the secret value | password+PIN+TOTP | **destructive** (unchanged) | Old value unrecoverable |
| `secret-keys/reveal-key` | :62 | secrets.manage | Reads plaintext (may re-seal) | password+PIN+TOTP | **destructive** (unchanged) | Secret disclosure |
| `secret-keys/delete-key` | :74 | secrets.manage | Removes a secret | password+PIN+TOTP | **destructive** (unchanged) | Removes persisted data |
| `identity-access/create-user` | identity-access/api/handlers.ts:24 | identity.manage | New user | **none** | **destructive** | Identity write with no recheck — see §5 |
| `identity-access/update-user` | :34 | identity.manage | User fields; credentials rechecked **only if `roleId` present** | partial | **destructive** | Conditional gate |
| `identity-access/set-password` | :52 | identity.manage | Password | in-service | **destructive** (unchanged) | Credential rotation |
| `identity-access/set-pin` | :69 | identity.manage | PIN | in-service | **destructive** (unchanged) | Credential rotation |
| `identity-access/begin-totp` | :86 | identity.manage | Starts TOTP enrolment | **none** | **destructive** | No recheck — see §5 |
| `identity-access/confirm-totp` | :96 | identity.manage | Enables TOTP | **none** | **destructive** | No recheck |
| `identity-access/disable-totp` | :106 | identity.manage | Disables 2FA | password+PIN+TOTP | **destructive** (unchanged) | Correctly gated |
| `identity-access/create-session` | :121 | identity.manage | **Mints a session for any user id** | **none** | **destructive** | No recheck — see §5 |
| `identity-access/revoke-session` | :131 | identity.manage | Removes a session | **none** | **destructive** | No recheck |
| `identity-access/unlock-vault` | :141 | identity.manage | Unlocks the vault | payload creds | **destructive** (unchanged) | Verifies supplied credentials |
| `identity-access/lock-vault` | :151 | identity.manage | Locks the vault | **none** | authoring | Fails safe |
| `database-manager/put-record` | database-manager/api/handlers.ts:73 | data.manage | Arbitrary record write | creds **only for sensitive stores** | **destructive** | Un-gated for every non-sensitive store |
| `database-manager/delete-record` | :87 | data.manage | Removes a record | creds only for sensitive stores | **destructive** | Same |
| `database-manager/run-migration` | :100 | data.manage | Runs/reverses a migration | **none** | **destructive** | No gate at all — see §5 |
| `deployment-sync/upsert-target` | deployment-sync/api/handlers.ts:17 | runtime.control | Deployment target | **none** | authoring | Configuration record |
| `deployment-sync/upsert-artifact` | :27 | runtime.control | Deployment artifact | **none** | authoring | Configuration record |
| `deployment-sync/sync` | :47 | runtime.control | **Performs a deployment** | **none** | **destructive** | Irreversible external action |
| `deployment-sync/rollback` | :57 | runtime.control | Rolls a target back | **none** | **destructive** | Irreversible external action |
| `background-tasks/run` | background-tasks/api/handlers.ts:29 | runtime.control | Executes a task now | **none** | authoring **[?]** | Effect depends on the task |
| `background-tasks/set-enabled` | :39 | runtime.control | Enable flag | **none** | authoring | Reversible |
| `background-tasks/save-schedule` | :49 | runtime.control | Schedule | **none** | authoring | Reversible |
| `background-tasks/control` | :59 | runtime.control | Starts/stops the scheduler | **none** | authoring | Reversible |
| `compute-control/register-node` | compute-control/api/handlers.ts:21 | compute.control | Node record | **none** | authoring | Registration |
| `compute-control/heartbeat` | :31 | compute.control | Node status | **none** | authoring | Liveness |
| `compute-control/command` | :41 | compute.control | **Enqueues a command to a compute node** | **none** | **destructive** **[?]** | External action on another machine |
| `compute-control/complete-command` | :63 | compute.control | Command result | **none** | authoring | Bookkeeping |
| `compute-control/acquire-lease` | :73 | compute.control | Lease | **none** | authoring | Reversible |
| `compute-control/release-lease` | :85 | compute.control | Releases a lease | **none** | authoring | Reversible |
| `production-runner/register-target` | production-runner/api/handlers.ts:18 | programs.write | Target record | **none** | authoring | Configuration |
| `production-runner/start` | :28 | runtime.control | Starts a production run | **none** | authoring **[?]** | Real execution |
| `production-runner/advance` | :38 | runtime.control | Advances runs | **none** | authoring | Scheduler step |
| `production-runner/stop` | :48 | runtime.control | Stops a run | **none** | authoring | Reversible |
| `production-runner/cancel` | :58 | runtime.control | Cancels a run | **none** | authoring | Reversible |
| `docs/rebuild` | docs/api/handlers.ts:12 | data.manage | Regenerates the docs cache | **none** | authoring | Regenerable |
| `docs/register-source` | :28 | data.manage | Docs source record | **none** | authoring | Configuration |

`runtime-control` registers five endpoints, all `programs.read`. No writes.

### Write routes outside the program API

These bypass `registry.call()` entirely and therefore would **not** be covered
by a classification table installed there.

| Route | file:line | Guard | Writes | Proposed |
| --- | --- | --- | --- | --- |
| `PUT /api/programs/automation-studio/state-assets/[projectId]/[sha256]` | state-assets/route.ts:43 | `programs.write` **or a gateway bearer token** | Uploads a binary state asset | authoring |
| `POST /api/client-gateway/approve-pairing` | approve-pairing/route.ts:5 | `runtime.control`, no PIN | **Grants a client trust** | **destructive** |
| `POST /api/client-gateway/dismiss-pairing` | dismiss-pairing/route.ts:5 | `runtime.control`, no PIN | Dismisses a pairing request | authoring |
| `POST /api/framework/setup` (`setup`) | framework/setup/route.ts:20 | permission contract, no PIN | Initializes storage | authoring |
| `POST /api/framework/setup` (`migrate`) | framework/setup/route.ts:30 | permission contract, no PIN | **Migrates the whole storage backend, reloads the instance** | **destructive** |
| `POST /api/framework/setup` (`rollback-migration`) | framework/setup/route.ts:33 | permission contract, no PIN | **Rolls the storage migration back** | **destructive** |
| `POST /api/auth/login` | auth/login/route.ts:48 | rate limiting | Session + attempt trackers | authoring (by design) |

`GET /api/programs`, `GET /api/framework/io`, `GET /api/recordings`, and the
run-dataset export route are reads.

## 3. Rows flagged as genuinely ambiguous (brief item 2)

These are the ones I will not decide silently. Each has a recommendation.

1. **`run-runtime-session` / `start-runtime-session`** — the user's boundary says
   "anything taking an irreversible external action keeps the PIN". Running a
   flow clicks buttons and submits forms on real websites, which is exactly
   that. But these endpoints have *never* required a PIN, and the loop cannot
   function without them. **Recommendation: leave un-gated**, and treat the
   existing `authorizedExternalSideEffects` request flag as the real boundary
   for side effects. Flagging because it makes the rule "destruction keeps the
   PIN" not literally true.
2. **In-flow deletions: `delete-flow-map-route`, `mutate-flow-map-route`
   (delete action), `delete-flow-map-route-group`, `delete-flow-subflow`.**
   These remove authored content, but they are how you *edit* a flow. A loop
   that cannot delete a route cannot refactor. **Recommendation:** treat
   fine-grained route edits as authoring, and `delete-flow-subflow` and
   `delete-flow-map-route-group` as destructive, because both remove a
   separately-listed, separately-addressable artifact and both have soft
   alternatives the loop can use instead (`archive-flow-subflow`, and setting a
   group's status to disabled).
3. **`review-flow-adaptation`** — "approve" and "apply" change durable flow
   behaviour without a human reading the diff. It is the loop's central write.
   **Recommendation: authoring**, since it applies a flow edit and nothing is
   removed.
4. **`publish-flow`** — additive and reversible via deprecation, but it is a
   release action that other flows then depend on. **Recommendation: authoring.**
5. **`convert-flow-to-visual` / `migrate-legacy-flow-representation`** —
   representation rewrites that may discard the previous form.
   **Recommendation: authoring**, but worth confirming the code source survives.
6. **`generate-flow-bootstrap-adaptation` and `issue-llm-execution-grant`** —
   these spend real money. Not destruction, and already un-gated.
   **Recommendation: authoring**, cost stays governed by the grant system.
7. **`delete-project-category`, `delete-proposal`, `clear-reusable-llm-context-scope`** —
   deletes of low-stakes or derived data. **Recommendation: destructive** for the
   first two (they remove persisted records), **authoring** for the third (cache).
8. **`finalize-recording`, `repair-recording-state-index`,
   `start`/`stop-client-recording`** — lifecycle and maintenance operations on
   capture. **Recommendation: authoring.**
9. **`compute-control/command`, `background-tasks/run`,
   `production-runner/start`** — these cause work to happen elsewhere. Their
   blast radius depends on configuration I did not trace.
   **Recommendation: leave as they are (un-gated)** and treat separately from
   L16, which is about flow authoring.

## 4. Can a build-failing test assert every write endpoint is classified? (brief item 4)

**Yes for coverage. Not yet for enforcement.**

**Endpoints are enumerable at test time.**
`GlobalProgramApiRegistry.endpoints()` (`_shared/api.ts:92`) returns
`{ programId, endpoint, permission }` for every registration. This is already
exercised: `packages/fluxiq/src/programs/tests/permission-matrix.test.ts:14`
builds the whole runtime with `createGlobalProgramRuntime()` and loops over
every endpoint, asserting each rejects anonymous and permission-less actors.
A classification test can be written the same way, in the same file's style:

```
for (const endpoint of createGlobalProgramRuntime().api.endpoints())
  expect(CLASSIFICATION[key(endpoint)]).toBeDefined();
```

Adding an endpoint without adding a row then fails the build. `pnpm check` runs
this package's vitest suite, so the gate is real.

**The limitation.** `endpoints()` does **not** expose whether a handler calls
`authorizeProgramPin` — the PIN lives inside an opaque handler closure. So the
coverage test proves every endpoint is *classified*, but not that the
classification is *enforced*. Two ways to close that, in preference order:

1. **Make the classification declarative.** Add a required field to
   `register()` (e.g. `destructive: boolean`, or reuse a `pinRequired` flag),
   have `registry.call()` enforce it, and have `endpoints()` return it. Then one
   test asserts the table and the registry agree, and TypeScript itself fails
   the build when a new `register()` call omits the field — no test needed for
   coverage at all. This is the strongest option and fits the user's standing
   preference for mechanical enforcement over written guidance.
2. **Behavioural test.** Call every endpoint classified `destructive` through
   `registry.call()` with no `authorizationPin` and assert each is rejected.
   This proves enforcement but needs a fully wired runtime and per-endpoint
   valid payloads, so it is slower and more fragile.

Option 1 also removes the 57 scattered call sites, which is the structural
defect underneath this whole question.

## 5. Endpoints that write persisted user data with no PIN gate today (brief item 5)

This is the finding section. Each of these is a real gap under the user's own
boundary, independent of whether L16 is implemented.

1. **`delete-run-datasets`** (`datasets.ts:71`, `flows.write`) — deletes a run's
   captured dataset rows, or a whole dataset. The user named datasets
   explicitly. There is no PIN check. It is audited (`actorId` is recorded) but
   not gated.
2. **`delete-project-hierarchy-node`** (`projects.ts:209`) and
   **`save-project-hierarchy`** (`projects.ts:174`, which honours a
   `deletedHierarchyIds` array) — both remove user-authored organization with no
   PIN, while `put-project-hierarchy-node` next door is also un-gated. This
   contradicts the repository's own architecture document:
   `docs/architecture/automation-studio/persistence.md:515-518` says mutating
   endpoints that "apply, execute, publish, delete, or edit user-authored state
   are privileged and should use the same shared PIN authorization path as
   project and category edits." The hierarchy endpoints do not.
3. **`identity-access/create-session`** (`identity-access/api/handlers.ts:121`) —
   mints a session for **any** `userId` with no credential recheck. A holder of
   `identity.manage` can obtain a session as another user. `create-user`
   (`:24`), `begin-totp` (`:86`), `confirm-totp` (`:96`) and `revoke-session`
   (`:131`) are likewise un-rechecked, while their siblings `set-password`,
   `set-pin` and `disable-totp` are fully gated. The asymmetry looks unintended.
4. **`database-manager/run-migration`** (`database-manager/api/handlers.ts:100`) —
   runs or reverses a migration with no credential recheck of any kind. Its
   neighbours `put-record` and `delete-record` are gated only when the target is
   one of two sensitive stores (`identity.users`, `secret.keys`); every other
   store is writable and deletable on `data.manage` alone.
5. **`POST /api/framework/setup` with `action: "migrate"` or
   `"rollback-migration"`** (`apps/web/src/app/api/framework/setup/route.ts:30-35`) —
   migrates or rolls back the entire storage backend and reloads the running
   instance, behind a permission check only. This is the most destructive
   operation I found anywhere in Core, and it is outside the program API, so a
   classification table in `registry.call()` would not cover it.
6. **`POST /api/client-gateway/approve-pairing`**
   (`approve-pairing/route.ts:5`) — **granting** a browser client trust needs no
   PIN, while **revoking** it (`revoke-client-trust`, `client-gateway.ts:42`)
   does. The gate is on the safe direction.
7. **`deployment-sync/sync` and `/rollback`** (`:47`, `:57`) — perform and
   reverse deployments with no credential gate.
8. **`append-recording-domain-event`** (`runtime-execution.ts:92`) — appends
   recording data with no PIN, while the three sibling append endpoints
   (`append-recording-entry`, `-note`, `-marker` in `recordings.ts:146-166`) all
   require one. Same data, two different rules.

Note also **`PUT .../state-assets/[projectId]/[sha256]`**
(`state-assets/route.ts:43`), which accepts a client-gateway **bearer token** in
place of an operator session. That is deliberate (the extension uploads
screenshots), but it means at least one persisted-data write path is reachable
without any operator credential at all.

## Commands run and observed results

- `find F:/!FluxIQ/packages/fluxiq/src/programs -type f -path "*/api/*" -name "*.ts"` →
  61 API source files across 10 programs.
- Custom read-only extractor (scratchpad `w2d-extract.mjs`), parsing every
  `registry.register(` block for programId, endpoint, permission and the
  presence of `authorizeProgramPin` →
  `TOTAL 220 registrations; PIN 57; no-PIN 163`.
  All 57 PIN call sites are in `automation-studio`.
- `grep -rn "registry.register(|api.register(" packages --include=*.ts -l | grep -v "/api/"` →
  only component/test files; **no endpoint registers outside a program `api/`
  directory**, so the 220 is the complete program-API surface.
- `find F:/!FluxIQ/apps/web/src/app/api -name route.ts` → 14 routes; read all,
  classified above.
- `grep -rn "\.endpoints()"` → `permission-matrix.test.ts:14`,
  `global-program-runtime.test.ts:10`, `_shared/docs-generators.ts:67,106`, and
  four per-handler tests. Confirms test-time enumeration already works.

No test suite, build, or lint was run — this was an inventory task and I changed
no code.

## Not verified

- I did not execute any endpoint, so "writes X" is read from the handler and the
  service method it calls, not observed at runtime.
- I did not trace service implementations below the API layer. An endpoint I
  classified as authoring could delete more than its name suggests inside the
  service — `save-project-hierarchy` is the one case where I confirmed a
  deletion hides behind a "save" name, and there may be others.
- I did not confirm whether `delete-flow-subflow` or `convert-flow-to-visual`
  are recoverable, which is what my recommendation for both depends on.
- The 220/57/163 counts come from a regex over `registry.register(` blocks. It
  agreed with the per-file reads I did for all 16 automation-studio handler
  files and all 9 other programs, but a `registry.register` call written in an
  unusual shape could be miscounted.
- I did not assess how much of the extension repository's `test-runner` would
  break; I only confirmed it supplies `authorizationPin` to `createProject`,
  `saveFlow`, `createFlow` and the adaptation review endpoints
  (`packages/test-runner/src/coordinator.ts:150`,
  `isolated-flow-importer.ts:26,55`, `existing-fluxiq-control.ts:174,181`).

## Open questions / contradictions found

1. **`persistence.md:515-521` is already violated.** It says every endpoint that
   deletes or edits user-authored state should use the shared PIN path; the
   three project-hierarchy endpoints and `delete-run-datasets` do not. Whatever
   L16 decides, that document needs rewriting, because it currently describes a
   rule the code does not follow.
2. **Which gate does "remove the PIN" mean?** My table assumes L16 touches only
   `authorizeProgramPin` and leaves `secret-keys` and `database-manager`
   credential rechecks alone. If it is meant more broadly, the secret and
   identity endpoints need their own decision.
3. **`identity-access/create-session` looks like a live privilege-escalation
   path**, not just a classification gap. It may deserve a fix independent of
   L16.
4. **The `flows.write` permission is used for reads.** `inspect-flow-migration`
   (`flow-lifecycle.ts:86`) writes nothing but demands `flows.write`; the
   dataset reads next door correctly use `programs.read`. Worth tidying while
   the classification table is introduced.
