# t814 E/D5 ownership acceptance review

Outcome: Done (read-only review). **D5 is not complete against the existing plan while its seed ignores `ownerUserId`.** The resumed worker completed its assigned verification scope; that does not complete the broader E/D5 unit.

## Requirement versus scope

- Downstream `docs/working/hosted-production-plan.md:414–415` explicitly requires the `workspace.created` hook to seed “My automations”, **owned by the new user**, through that workspace's Automation Studio service. D5's phase row (`:613`) includes the seeding-hook test and says the package can merge inert. Inert describes deployment/wiring, not a relaxation of the seed's behavior.
- Core's plan `:267–269` requires project ownership and owner inheritance by children; `:563–564` assigns the default-project hook downstream. The ownership sentence above is an explicit authored-plan requirement, not a newly discovered verbatim user instruction.
- Core `docs/working/hosted-production-plan/reports/t814-e-d5.md`, “Open items”, says ownership was outside the worker's owned paths. That is a worker partition boundary, not an approved phase deferral. The resumed downstream report explicitly retains the gap and claims “Done within the assigned resume scope”; this limited claim is accurate.
- The current C2/C3 provisioning, host-loading and caller-routing wiring can remain separate. Fixing the already-authored hook's ownership behavior does not require completing that later wiring now.

## What the frozen source actually does

- Downstream `apps/product/src/hooks/seed-default-project.ts:10–15` never reads `payload.ownerUserId`: it lists by name, returns for an existing match, and calls the direct service `createProject({ name })`. Its tests assert only the name/count/error behavior. `src/host/platform.ts` subscribes this hook directly to `workspace.created`.
- Core `platform/panel/types.ts:16` already supplies the authoritative workspace owner ID and that workspace's `FluxIQ` instance. No new hook-payload field is needed for a trusted ownership recording operation.
- Direct `AutomationStudioService.createProject` (`runtime/service.ts:3731` onward) takes no owner and does not record one. The owner field on `api/contracts/project.ts` is explicitly an API enrichment, not the runtime record.
- Lazy migration is not a reliable substitute: `api/ownership/ownerships.ts:32–37` provides only Identity Access users as defaults, **not** the supported `workspaceOwner` callback. `default-owner.ts` therefore chooses a local enabled admin, or nobody; C1's `apps/web/src/lib/workspaces/service-iam.ts` supplies policy source/audit only. A platform personal-workspace owner is not thereby assigned as this project's creator.

## Existing public B3 seam and its limit

The old report's implication that creation necessarily needs a new Core ownership API is incomplete. `fluxiq/programs` publicly exports `GlobalProgramApiRegistry`/`ProgramApiActor`, and `FluxIQ.programs.api.call(...)` is available. `create-project` declares `creates` (`api/handlers/projects.ts:89–102`); registry `afterSuccess` records `request.actor.userId` through the registered project resolver (`programs/_shared/api.ts:279–285`). Existing `api-iam.test.ts:157–164` tests the creator-recording mechanism. This is the correct existing gated path when a legitimate caller context is available.

It is not a drop-in fix for this hook: the event supplies no actor/session; `ProgramApiActor` requires a session ID, role and permissions. Do not invent an authenticated session or give the new user admin permissions. Under `service`, the call also needs attached policies. Current provisioning calls `onWorkspaceCreated` inside `placeWorkspace`, before `putMembership` and `syncMemberPolicies` (`platform/provisioning/operations/create-account.ts:73–75, 87–88`). A future integration using this registry path must supply legitimate context and emit after the required attachments. This timing is source evidence, not a claim that hook emission is currently wired.

There is also a retry boundary: the registry runs the handler before `recordOwner`. If owner persistence fails, the project can already exist while the call returns a failure. An API-only seed cannot repair that existing project's creator: direct name lookup skips it still unowned, while a gated list can hide it and lead to a duplicate. A proposed API-only solution must solve this partial-completion case, not just pass the successful create case.

## Minimal recommended fix before D5 acceptance

Use a narrow additive trusted-host ownership helper, avoiding any dependency on unfinished session/provisioning wiring:

1. Core: add `programs/automation-studio/api/ownership/record-created-project-owner.ts`, exporting `recordAutomationStudioCreatedProjectOwner(service, projectId, userId): Promise<void>`. Delegate to the existing `AutomationStudioProjectOwnerships.of(service).recordOwner(...)`; refuse a missing registered resolver rather than silently succeeding. Export **only this helper** through the owning barrel and `automation-studio/api/index.ts`, making it reachable from existing public `fluxiq/automation-studio`. Do not export the mutable stores/whole ownership registry or duplicate ownership persistence.
2. Downstream: use that public helper after selecting or creating the named seed, passing `payload.ownerUserId`. Repeating the event must repair an incompletely assigned seed without duplicating it; the existing `recordOwner` permits the same creator, replaces a migration default once and rejects a different recorded creator. Preserve that conflict refusal instead of taking another creator's project.
3. Tests: add the owning Core helper test (registered resolver, same creator idempotence, different creator refusal, unavailable resolver failure). Replace/extend the downstream seed fixture with a throwaway real public `FluxIQ` instance (`loadEnv: false`, `modelProvidersEnabled: false`), whose fallback admin differs from `ownerUserId`; assert the public project answer identifies the new user, duplicate events do not duplicate it, a retry repairs missing ownership, and a conflicting existing creator is not reassigned. Keep the host registration test covering the same real behavior. Existing persistence tests already cover the delegated owner store; rerun them rather than duplicate that implementation coverage.
4. Update the product host's authored architecture paragraph to state owner assignment and its Core public dependency. Run product tests/typecheck and owning Core ownership tests/typecheck, plus both structure audits. No broad suite or browser/model run is needed for this seed-only fix.

Compatibility: additive public Core export; no wire protocol, persisted format, project-creation signature or existing caller change. Rebuild paired Core before downstream acceptance, and integrate/push both repositories together. The helper is for trusted in-process host code, matching the plan's host-module trust boundary; it must not become an unauthenticated route.

**Lifecycle timing with this recommendation:** leave the generic `onWorkspaceCreated` timing unchanged. The helper records the authoritative owner without requiring a login or already-attached user policy; subsequent ordinary user access still passes through IAM. If the lead instead selects `api.call`, move the generic callback from `placeWorkspace` to after `syncMemberPolicies` in `create-account.ts`, update `context/types.ts`'s timing contract and its owning tests, and solve trusted caller context plus partial-create repair explicitly. Do not move generic provisioning into downstream or broaden this unit into the future event emitter wiring.

**Real service-IAM regression:** use public `createPlatformServices`/`workspaceIam`/`MemoryIamAuditSink` from `fluxiq/platform`, real provisioning `createAccount` with `FluxIQUserAccess` and a throwaway public repository, and a real `FluxIQ` workspace configured with `profile: "service"` and that actual `workspaceIam(workspaceId)` as its source. Emit through the registered product hook. After membership attachment, public `projects` must expose exactly the seed with `ownerUserId` equal to the minted user (not local `admin`); an ordinary owned-project read must succeed for this user's real test caller and fail for another separately provisioned user's caller against this workspace/project. Give that non-owner the same ordinary policy in the test workspace through the public IAM store, so the refusal proves the resource-owner condition rather than merely a missing policy. Repeat the event and an owner-assignment repair and confirm no duplicate/creator takeover. The regression must not use a universal allow policy, a private Core ownership/IAM import, the host's admin actor, or an owner-answer stub. Construct the fixture entirely in ignored temporary state, close every instance/repository and disable model providers; no browser concepts belong in Core.

## Review limits

Static source and named report/plan inspection only, in the frozen t814 pair. No tests, builds, browser/model calls, git commands, runtime data or environment values were read or run. Existing test results above are cited as source coverage, not independently executed acceptance evidence.

Outcome: Done
Changed: docs/working/framework-heavy-lifting-plan/reports/codex-1030/t814-ownership-result.md only
Validation: `rg` and `Get-Content` on the named frozen source/plan/report files -> ownership requirement and public registry/ownership flow confirmed by inspection; tests/builds not run as instructed
Not verified: runtime seed ownership, lifecycle event wiring/order after future integration, compiled public exports, browser behavior
Report: docs/working/framework-heavy-lifting-plan/reports/codex-1030/t814-ownership-result.md
Notes: Ownership is a D5 completion gap. Later C2/C3 wiring remains separate. No source or shared working document changed.
