# Shared projects fix (D1/D2, task t915)

CORE = `fxwork/t915/!FluxIQ`. Nothing committed. No EXT or apps/web source changed.

## Outcome
Done in Core. The panel and a paired extension now list, open and chat in one set of projects for one person. IAM is unchanged.

## Cause (evidence)
- **Same store, same owner, different domain.** In the live `.fluxiq/global.sqlite`, all four projects are in one `projects/index` and all are owned by `admin`:
  - Panel-made: "Walkthrough A" and "Walkthrough B2" have `domainId: null`.
  - Extension-made: "Walkthrough C" and "My automations" have `"web-automation"`.
  - The trust record binds the extension to `domainId: "web-automation"`.
- **Lead 1 is the cause: the two clients resolve "which domain" differently.**
  - Paired client: the domain the session declared and the trust bound (`program-route.ts:257` `pairedClientDomainScope`). Credential issue uses the instance's active domain (`apps/web/src/server/connect/issue-credential.ts:23`).
  - Panel (cookie): only the URL's `?domainId=` (`handle-program-request.ts:154` → `program-route.ts:13`). The new Projects, Chats and Home pages carry none (`features/programs/program-api.ts:126-131` reads it from the page URL). So every panel call ran in "no domain".
  - `lib/resolve-setup-domain.ts` once carried the domain for setup and has no callers now. Its comment states the rule that was lost: "setup must never fall through to a domain-less Studio while a domain is installed".
- **Strict equality made "no domain" a partition of its own.** The project list compared `(project.domainId ?? null) === (scope ?? null)` (`service/catalogue.ts:28-31`), and so did the gate (`service.ts:1382` `assertProjectDomainAccess`). As a result:
  - Each client listed only what it had made itself.
  - The Chats page's list across projects (`conversation-requests/list.ts:23`) missed the extension's projects for the same reason.
  - Panel-made projects were global, so their Flows have the global scope (`flows/writer.ts:340`). Web nodes are domain-only (EXT `domain/src/output-nodes/definitions.ts:269`), so a web Flow could not be built in them.
- **Lead 2 is not the cause here.** There is one instance and one store in the local profile.
- **Lead 3 is a symptom.** `first-project` creates in the session's declared domain (`client-gateway/first-project/route.ts:23`), which is correct; the panel just could not see it.

## Fix
1. **The panel's Automation Studio calls use the instance's domain.** New `server/program-route/person-domain-scope.ts` (`personDomainScope`), used at `handle-program-request.ts:154`:
   - A signed-in person's `automation-studio` call that names no domain works in `fluxiq.activeDomainId`. A domain named on the URL still wins.
   - A project, category or recording the panel creates is therefore stored in the domain, so its Flows can use web nodes.
   - Other programs keep the URL scope, because Database Manager and Production Runner key their stores by it.
2. **The project list and the domain gate treat "no domain" and the instance's domain as one view.** New `service/projects/domain-match.ts` (`projectDomainMatches`), used in `catalogue.ts` `listProjects` (projects and categories) and in `service.ts` `assertProjectDomainAccess`. The service gets the domain through `bindIoRuntime`, which receives `activeDomainId` from the `FluxIQ` constructor.
   - Existing global projects (A and B2) stay visible to both clients.
   - apps/web routes that name no domain still reach domain projects: run-dataset export, the cookie snapshot, and context validation.
   - Global stays global. Flow scope, the same-domain groupings and creation through the service are untouched; `canonical-persistence`'s global orchestrator depends on that.
   - Another named domain stays separate, and an instance serving no domain is unchanged.
3. **Docs:** CORE `docs/architecture/automation-studio/client-gateway.md` has a new section, "One person, one set of projects (t915)".

## Hosted multi-tenant
- Each tenant instance is created with the host's single domain active (`apps/web/src/lib/fluxiq.ts:410-417`).
  - A cookie is routed to that tenant's instance (`workspaceProgramContext`).
  - A paired token is routed to the same instance (`resolveServiceClientHttpRoute`, per `core-project-access.md`).
  - Both sides therefore take the domain from the same `activeDomainId`, and the fix holds per tenant.
- Another tenant's projects are in another store and are still refused with `authorization.project_domain`.
- The `service` profile still filters per person. The new test proves this on that profile with two people and a second domain.
- **Remaining gap:** an instance with several domains installed and none active. There the panel stays global while a code-paired client binds its declared domain, so the split remains. Connect issuance already refuses that setup, but gateway code pairing does not.

## Commands run and observed results
| Command | Result |
|---|---|
| `vitest run` program-route, automation-studio/api, ownership, conversation-requests, client-gateway-routes, service/projects, canonical-persistence, state-index, flows creation, conversation-parking | 96 of 97 files passed, 661 of 662 tests. The one failure was my own test: its global project had no owner. Fixed, then the two new route test files passed, 8 of 8. |
| Earlier: the same set plus domain-hooks, io-bridge, proposals, service-wiring, project-focus, llm-run-caller, reauthor | 15 of 16 passed. The failure was `canonical-persistence`, which exposed my first attempt (stamping in the service). That attempt is reverted, and the file passes now. |
| New `service/tests/catalogue-domain-view.test.ts` and `service/projects/tests/domain-match.test.ts` | 2 of 2 and 3 of 3 passed |
| Fault injection: old matching rule restored | New e2e test failed 4 of 4 |
| Fault injection: route default removed | 1 failed: the panel project was stored with a null domain |
| `pnpm --filter fluxiq check` (final) | exit 0, no errors |
| `node scripts/structure-audit.mjs` (CORE, final) | passed. It also reports that 2 baseline entries can be lowered; they are not mine and I did not run `structure:baseline`. |

## Not verified
- **Live panel and extension:** the running panel uses the built Core and was not rebuilt or restarted.
- **Hosted server and the multi-domain case:** not run.
- **`@fluxiq/web check` and extension tests:** not run, because no file in those packages changed.

## Open questions
1. **A and B2 are visible but still global**, so web Flows cannot be built in them. Making them domain projects is a data migration. Code cannot tell an accidental panel-made global project from a deliberate orchestrator, so the lead or user must decide whether to re-stamp them, for example per instance when exactly one domain is served.
2. **Gateway activity** (`acceptsActivity`) still follows the session's project, as `gateway-project-focus.md` notes. This change does not affect it.
