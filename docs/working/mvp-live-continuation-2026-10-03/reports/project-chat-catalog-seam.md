# Project chat setup seam investigation

Status: read-only investigation complete; implementation not released. Worker resume-cd, 2026-10-03 local.
Brief: `project-chat-catalog-seam`; supervisor clarified this is Lab setup selection, not an instruction to build a normal product project catalog/dropdown.

## Confirmed initial findings

Existing conversation wire already supports explicit projectId for list/get/open/append/answer. Relay projectFor prefers explicit requested project over session project. Listing project threads uses subjectKind project and the selected project ID as subjectId. No change to Core conversation contracts is demonstrated necessary.

Existing Core public project catalog registration exists: automation-studio endpoint AUTOMATION_STUDIO_ENDPOINTS.projects, programs.read/read classification, calls service.listProjects(request.scope.domainId). This observation is domain-scoped endpoint evidence, not a claim of independently verified actor-level project ACL filtering. Core project store contains project index/read machinery; no new catalog API is justified by the inspected code. Gateway authorization/endpoint literal and listProjects implementation were not traced because supervisor narrowed to the simpler setup navigation seam.

Exact existing driver/receiver: packages/test-runner/src/extension-chat-check/panel-driver.ts. pagePanelDriver uses actual Playwright composer/buttons. extensionViewPanelDriver invokes local inView in the control page; inView uses chrome.extension.getViews to locate the actual mounted panel, reads DOM, sets composer via its own value setter/input event, and clicks Send/answer buttons. Its existing actions are text/send/press. There is no separate extension driver receiver or project-navigation action.

apps/extension/src/panel/shell/mount-panel.ts owns local openInChat, which calls chat.open and redraws target/strip. createChatPanel publicly returns open(ChatTarget), target() and onTargetChange. However mountPanel retains that object locally and returns void: the existing driver cannot directly access the mounted chat.open handle. ChatTarget currently includes latest/automation/question only, with no project field.

Therefore a minimal Lab context selection needs an explicit mounted view-navigation action reaching this existing chat.open owner, plus project-scoped target/thread identity and actual read/send scope. It does not require a product dropdown, project catalog runtime message, Core capability, reconnect, recording start or store patch. Selecting the known public newly created project during Lab setup does not decide what the model does; ordinary composer Send and capability choice remain unchanged.

## Proposed direction, pending final thread owner reads

Add a narrowly typed project target with public project identity. Have an explicit supported mounted-panel navigation receiver call local chat.open for that target and activate Chat, exposed through the same actual extension view that current Lab driver uses. Do not expose arbitrary controller internals or mutate state from the driver. A documented view event/action receiver is one candidate; exact transport design belongs to the supervisor's implementation brief. A mere DOM data-attribute write is insufficient because it would not change controller scope.

Render selected chat project and successful thread-read/empty-read state from the actual owner. Lab's setup action selects the known project and waits for that rendered factual state before typing/Send. Actual shown thread project, when present, must agree; no session.projectId equality or retained old transcript can substitute. Ordinary endpoint authorization continues to govern requested project reads/sends. No caller can acquire access merely by changing a DOM target.

Initial six source reads: extension background/panel/conversation-relay.ts, shared/protocol.ts (matching sections), panel/automations/choose-automation.ts; Core api/handlers/projects.ts, runtime/service/projects/store.ts, client-gateway/contracts.ts (public barrel only). Approved next reads: extension panel/shell/mount-panel.ts, panel/chat/chat-panel.ts, panel/chat/target.ts, test-runner extension-chat-check/panel-driver.ts. Driver receiver is inside that last owner. Requested final bounded same-thread/controller/thread-requests reads; no broad source discovery or Core monolith read.

Only this report written. No source edits, tests, builds, provider/browser/runtime calls, environment/profile/store/slot/guard changes, commits or shared docs.

## Final source-confirmed thread behavior

Supervisor approved final exact reads panel/chat/same-thread.ts and conversation/{thread-requests,controller}.ts, bringing total source reads to13 (6+4+3). Existing sameThread considers every latest target the same. threadListRequest(latest) omits projectId and lets relay infer session project. threadSendRequest uses only shown.projectId; empty first Send has undefined projectId. Controller already advances generation and drops late reads when thread identity changes, resets shown/anchor/turns/loaded/read/send/answer errors, and reads the next target. With project absent from identity none of that happens for a different desired latest project.

Controller readOnce trusts the listed first conversation's projectId, then fetches its tail in that project. It has no comparison with a desired project target. It also accepts a parseable first-send opened conversation without checking desired project. State exposes conversationId but not shown project or successful scoped-read identity. send allows connected/readable regardless of whether an initial read is complete. The setup/readiness contract therefore must demand successful selected-project read (including a confirmed empty read) and refuse mismatch, not merely compositor enabled/target selected/session connected.

## Minimal proposed contract and exact partition

This is a supervisor proposal, not source release. **No Core changes, catalog feature, new gateway API/runtime project message, permission widening or normal unscoped default change required.** A new documented in-view navigation action is necessary because no current receiver reaches mounted chat.open.

App/UI lane (AB ownership):

- apps/extension/src/panel/chat/target.ts and same-thread.ts: additive project-scoped target; identity includes actual projectId. Preserve all existing unscoped latest/automation/question behavior. Do not infer target from recording session or old conversation.
- apps/extension/src/panel/chat/conversation/thread-requests.ts: project target list explicitly carries projectId/project subject; empty first Send explicitly carries chosen projectId and no stale conversation/onScreen Flow. Existing shown get/answer stay scoped to authoritative matching shown project. Controller must not permit a stale/mismatching shown value to override target.
- apps/extension/src/panel/chat/conversation/controller.ts: desired-project versus list/opened response validation; selected-project successful read identity/empty outcome exposed; clear state at target change; reject mismatched responses and stale-generation results. A matched listed thread should not be declared ready until its actual read completes. A successful empty selected-project list can be ready without synthesizing a thread or build. Unknown/unreadable/unauthorized project cannot become ready. Existing endpoint authorization is the authority for whether a known public selected project can be read, not an unchecked event or data attribute.
- apps/extension/src/panel/chat/chat-panel.ts: render factual selected target, read readiness and shown project/conversation/empty result from controller state; no raw turn/provider/credential state. Prevent Send when selected-project read is not successful. Keep actual composer/controller/relay execution and existing owner lease cancellation.
- apps/extension/src/panel/shell/mount-panel.ts plus proposed cohesive apps/extension/src/panel/chat/project-navigation.ts and its barrel: bind a narrow typed mounted view action to local openInChat/chat.open and Chat activation. Validate event/action payload's known public project identity shape before changing target; actual project read confirms existence/access. No arbitrary code/capability arguments, controller injection, forced creation, build API or global mutable controller handle. Event transport is a candidate for this ordinary view-navigation boundary; choose one explicit supported contract in the implementation brief and synchronize both lanes.
- Owning tests: panel/chat/tests/{same-thread,chat-panel,project-navigation}.test.ts and conversation/tests/{thread-requests,controller}.test.ts; filename existence of new proposed navigation test/module is not implied. Required root barrel edits follow existing one-export/cohesive-module rules. Public rendered field names/action contract must be finalized in writing before concurrent Lab implementation.

Lab lane (CD ownership proposed):

- packages/test-runner/src/extension-chat-check/panel-driver.ts: add setup-only project selection/readiness action to both pagePanelDriver and existing inView receiver; action drives mounted project-navigation contract and reads actual owner-rendered readiness, then ordinary send/text/press remain unchanged. No raw text matching on old transcript as readiness.
- packages/test-runner/src/run-scenario/chat-build/chat-entry.ts: select actual run-owned project through panel driver before task typing/Send. Do not select model capability or call generate directly.
- packages/test-runner/src/run-scenario/chat-build/creation/readiness.ts and run-scenario.ts wiring: replace unsupported session.projectId equality as chat readiness with real mounted selected-target/actual read-ready proof. Preserve connection/pairing checks as their own prerequisites, public create/select setup and final creation-context identity bookkeeping. These Lab owners beyond panel-driver were identified by exact filenames/prior AB report, not read in this task; the supervisor must release their content for implementation before claiming exact wiring verified.
- Owning tests: extension-chat-check/tests/panel-driver.test.ts (new if absent), chat-build/creation/tests/readiness.test.ts and chat-build/tests/chat-entry.test.ts (placement/existence to verify), nearest scenario integration fixture as supervisor selects. Do not add broad suites.

Normal product project picker/catalog is expressly excluded from this minimal setup unit. Existing user-accessible project preparation provides the known actual project ID; the event should display a human context label rather than expose an ID textbox as normal default UI. Public DOM scope metadata for test readiness may contain the opaque ID. No selected-data mutation or synthetic recording adoption.

## Meaningful fail-before fixtures

1. ProjectA and ProjectB targets differ even when both are latest/project chats; changing to B resets old shown conversation/turns/anchor/errors and drops late A replies. Existing unscoped behavior unchanged.
2. Explicit B list uses B/project subject; empty B result becomes read-ready for B with no conversation; first Send names B and opens B's project thread, with ordinary capabilities and no old A conversation/onScreen Flow.
3. A response returned for B fails before get/display/read-ready/Send. Opened response for wrong project is not adopted. Unknown/forbidden/malformed read never becomes readiness. No old thread/catalog/store removal.
4. Mounted setup receiver rejects malformed/unrecognized action; valid known project opens real chat owner, activates Chat and renders its actual load/empty/thread state. Mere DOM data attributes cannot manufacture read-ready proof. Owner/session change must invalidate a prior readiness result.
5. Both trusted popup and view-dom sidepanel driver issue same setup action and wait for matching selected project plus actual read-ready/shown-project match or confirmed empty. Disabled/error/mismatch aborts before task Send; ordinary send still runs real composer/relay/model capability choice.
6. Lab integration old persistent session/old shown chat + new run-owned project reaches new target/empty list before Send, preserves old project/draft/thread/profile and creation-context IDs. No reconnect/recording workaround, provider call or default-budget change.

Actual UI validation after implementation: headed isolated persistent A/B before provider task confirm ordinary panel target/readiness and actual request project match run-owned identity, then Send full task through existing composer. Record real chat-selected capability, final project/Flow/hash and six-stage results; pairing success/session fields alone are insufficient. Normal old-context chat/automation/question navigation must retain existing behavior. Any paid launch remains separately root-authorized on new verified source; no automatic retry.

Known limits: Core public list endpoint's actor-specific ACL/filtering and literal gateway allowlist not examined; neither is needed for selected known project's existing conversation endpoint route. New navigation transport/action names and rendered readiness fields are proposed, not an already implemented contract. No compile/unit/live proof was produced by read-only investigation.
