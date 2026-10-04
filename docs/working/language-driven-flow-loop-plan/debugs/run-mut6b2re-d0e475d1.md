# Run debug - run-mut6b2re-d0e475d1

Status: Complete bounded evidence/source debug; failed creation setup, no acceptance.
Owner: worker resume-ab
Date: 2026-10-03

## Header

- Run/scenario/task: run-mut6b2re-d0e475d1 / crossborder-marketplace / crossborder-marketplace-hub-to-cart; instance t262-slot-2, persistent-isolated workspace t262-a.
- Command: `node scripts/lab/run-lab.mjs run crossborder-marketplace --target persistent-isolated --workspace t262-a --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task crossborder-marketplace-hub-to-cart --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48 --llm-cost-ceiling-usd 0.10`.
- Date/provider/model: 2026-10-03 local; root recorded ending 2026-10-04T02:01:50.451Z; deepseek/deepseek-flash. Frozen downstream7b5a3aa1/Core97e279de.
- Provider calls/tokens/cost: one chat call, 2,021 input/117 output, 896 cache-hit input/1,125 cache-miss input; $0.000241638. Build/read/judge/runtime calls zero. Cost ceiling $0.10 applies to Lab testing only; no breach. No new run by worker.
- Verdict: launcher exit1; `lab.chat_ran_other_capability`, selected `flow.improve`. UI reports `flow_bootstrap.blank_target_required` at `pre_provider_validation`. No created Flow ID, proposal, build test, playback, oracle or saved-Flow reuse.
- Highest stage reached: Stage 1 instruction and one chat-routing turn; no build exploration. Later template stages record nonexecution explicitly.
- Evidence: ignored central `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-03/run-mut6b2re-d0e475d1/steps/0001-chat/`; local `test-runs/instances/t262-slot-2/run-mut6b2re-d0e475d1/`; screenshots in adjacent `.ui-review.local/`. Private values remain there.
- Browser: headed Chromium Chrome/134.0.6998.35, real Chrome extension panel `view-dom` input, win32/x64, en-US, timezone UTC, viewport1280x720. Provider finishReason=stop, HTTP/model-step status ok; command refusal is a separate later result.

## Stage 1 - instruction and expected chain

Root recorded [prelaunch expectations](../../mvp-live-continuation-2026-10-03/reports/live-a-candidate.md) before launch. This worker completes the template post hoc and does not claim blind predeclaration.

Verbatim public authored instruction from `apps/scenario-lab/src/scenarios/crossborder-marketplace/live-tasks.ts`:

> On Farbazaar, put three of the Voltbay USB-C hub sold by Voltbay Official Store in my cart: Space Grey, the 7-in-1 version, shipped from Spain. Collect that store's coupon while you are on the item. Do not buy anything.

Expected chain: independent new creation through actual extension chat; open specified listing/store, choose requested version/colour/origin and quantity3, collect intended coupon, retain a distinct cart-add action, no purchase. Verify both whole-Flow judges, actual terminal status and exact fixture facts `cart-count`, `orders-shipped`, `cart-line`, `store-coupons`. Preserve accepted savedFlow for zero-provider unchanged-Flow reuse. Candidate checks must not masquerade as performed effects; lasting build tests must avoid duplicates.

Wrong answer that looks right: appending the same request to an old failed-draft conversation, reasonably interpreting it as continuation, and attempting improve on that old target. This does not exercise independent creation or the newly changed build-loop behavior.

## Stage 2 - exploration

All provider turns, exact order:

| # / artifact | What asked | What decided | Action and parameters | Result |
| --- | --- | --- | --- | --- |
| 1 / 0001-chat | panel_command routing of task entered in existing extension chat; request has seven messages: system, five historical turns, new user | `do=flow.improve` | `with={flowId:string,change:string}`; target string is an allowed display name resolved to Flow ID, not an ID error; exact values private in decision.json response.content | Model returned normally in1,389ms; later command saved change instruction on existing Flow, then failed blank_target_required before build provider; Lab recorded other_capability/failed |

`request.json` has roles `[system,user,assistant,assistant,assistant,assistant,user]`. First historical user instruction equals the new instruction byte-for-byte. Last retained assistant turn describes the prior unfinished build. System message contains old A2 draft opaque ID `flow.3f11f84c-8eef-4433-8474-6f0d22e08112` and both createHere/improve capability vocabulary. This proves retained routing context, not that a deterministic rule required the model to select improve. Exact prior private content is not copied.

- Repeats/progress: repeated user task in retained conversation, no build-loop iterations, amendments or node actions. One paid classifier call followed by pre-provider refusal.
- Refusals: UI clearly reports blank_target_required and instruction saved before refusal. No action-parameter repair loop ran; no retries or provider escalation observed.
- Context eviction/truncation: five prior turns reached the actual provider request; finishReason=stop. NO EVIDENCE: broader thread truncation policy audit beyond this exact request. Prior transcript presence suffices to diagnose this run's context mismatch.

## Stage 3 - proposed Flow

No proposal, new Flow or authored nodes. `snapshots/flow-lane.json` reports flowId=null, runtimeRunId=null, actions=[] and stoppedAt=build. No node parameters exist to list; the only command parameters are the screened two-string shape above, with exact ignored reference.

Divergence: request was meant to independently create but selected improve of an existing target, then failed before bootstrap provider. This is a Lab setup/context mismatch rather than demonstrated page misread, Flow grammar failure or inability to express a cart step. Normal UI may legitimately interpret a repeated request after an unfinished build as continuation; do not change that behavior merely to force this creation test.

## Stage 4 - replay

| Node | Executed | Produced | Duration | Retries | Rung that absorbed |
| --- | --- | --- | --- | --- | --- |
| No authored node/test/runtime | None | No build test or playback | Not applicable | None observed | Not applicable |

No node reported success while doing nothing. The chat model returned successfully; the later capability explicitly refused. Provider calls during replay were zero because replay never started; this is not a successful zero-provider savedFlow validation. NO EVIDENCE: existing target's persisted graph/representation directly inspected by worker; live target-policy refusal is known, but store/profile reads are prohibited.

## Stage 5 - answer

No created-Flow result, extraction records or playback-goal oracle. Expected four fixture facts were not reached and cannot be marked matched. No final cart/order/coupon comparison occurred. Counts are not an acceptance criterion here.

Actual mismatch: required capability for independent creation `flow.createHere`; observed selected capability `flow.improve`, stopped pre-provider. Expected new accepted Flow; observed flowId=null. No no-purchase/cart correctness claim from this setup failure.

## Stage 6 - judgement and repair

No whole-Flow judge or repair provider call. Lab recognizes result attachment ref `flow.improve` and reports `lab.chat_ran_other_capability`; this is routing-stage failure, not a model diagnosis of a built Flow.

Context present: prior conversation and old Flow entry reached routing model; normal chat retained prior unfinished message before send. No failing node, new Flow, replay record or built result exists. NO EVIDENCE: full original conversation/store target metadata; worker reads only ignored run artifacts.

Command UI reports that the change instruction was saved on the existing Flow before target validation failed. This product-side mutation is part of the observed authorized run; worker made no store changes. No proposal or accepted repair persisted. Existing target, conversation, project, drafts, recording/profile remain preserved; no destructive reset or direct build API used.

## Causes

| # | Precise cause / certainty | Repo and file | Fix direction | Task |
| --- | --- | --- | --- | --- |
| 1 | Confirmed: independent-creation driver sends into currently open panel without preparing a fresh conversation; actual request contains prior identical task and failed-build response | Downstream packages/test-runner/src/flow-lane/creation/chat/build-from-chat.ts; extension-chat-check/panel-driver.ts | Prepare reversible run-scoped fresh project conversation through owning public API/UI, explicitly select it before typing; preserve existing threads/drafts | t262 additive public preparation design below |
| 2 | Confirmed refusal before provider: improve target validation rejects before any build call; mode=extend is confirmed; target refused before build; exact stored representation/Router/Subflow flags were not inspected | Core packages/fluxiq/src/programs/automation-studio/runtime/service.ts and service/flow-bootstrap-commands/bootstrap-target.ts; conversations/commands/improve.ts and flow-bootstrap/extend.ts | Distinguish blank failed-draft continuation from nonblank existing-Flow improvement. Do not weaken blank-target policy or force model/direct build for Lab | t262 diagnosis |
| 3 | Normal UI continuation selection is plausible, not proven deterministic routing rule; model chose display-name target from retained context | Core runtime/llm/deepseek/panel-command.ts and conversations/commands/execute.ts; conversations/instructions/prompt.ts and invocation.ts | Names are explicitly accepted/resolved; isolate Lab fresh-create preparation from normal unfinished-draft continuation limitation | t262 bounded read expansion requested |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it / retained evidence |
| --- | --- | --- |
| 1 | Worker cannot claim blind predeclaration | Root prelaunch report exists; worker chronology disclosed |
| 2 | NO EVIDENCE: wider all-thread truncation audit | Actual request retains relevant five historical turns |
| 3 | NO EVIDENCE: direct persisted target graph/representation; store reads out of scope | Target validation/UI result; source policy confirmed; exact persisted flags remain uninspected |
| 4 | No node/rung timing exists because no replay began | Build lane stopped at routing/pre-provider |
| 5 | No final fixture facts or oracle | No created Flow/postcreation phase |
| 6 | No repair/proposal/reuse evidence | No build model/judge/runtime call; existing state preserved |

## Screenshot review and worker boundary

Privately reviewed01-start-panel and03-failure-panel. Start visibly retains prior unfinished-build ending. End shows fresh task appended, improve selection and explicit blank_target_required with saved-instruction notice. Local review contains three moments/three panel and scenario pictures, zero capture failures; no build progress or runtime moments to claim. Root separately reviewed final image. Images and raw page/prompt values stay ignored.

Worker owns only this debug and `reports/persistent-chat-creation-context.md`. No source/tests/build/runtime/store/profile/environment/provider/launch/guards/slots/shared docs/commit activity. B2 remains active/source frozen. No paid retry.

## Confirmed source path and exact preparation boundary

Twenty-seven source files read total through explicitly approved8+8+4+2+3+2 scope, no broad implementation.

1. Lab creation/lane.ts startChatBuild prepares page, authorizes chat and selects existing project with undefined Flow; then build-from-chat.ts records old IDs and types into current panel. It never prepares fresh conversation.
2. Extension conversation/controller.ts defaults target latest; thread-requests.ts lists project/open/limit1 and sends into shown conversationId. It is intentional normal-chat continuation. store.ts sorts most recently updated first (updated_at_ms descending, conversation_id tie break).
3. Core conversations/conversations.ts openConversation without explicit internal ID reuses ambient/open-subject thread. Public api/contracts/conversation.ts ConversationOpenRequest exposes only subjectKind/subjectId/title; it does NOT expose internal conversationId or fresh semantics. Thus passing a caller-chosen ID to the public API is not a supported fix.
4. Core instructions/prompt.ts lists existing Flow names/IDs, and new-job guidance is conditional on no listed Flow already doing the job. Actual A3 system says nothing particular open, lists only old A2 Flow, and retains identical prior task/failed response. A fresh transcript removes historical turns, but that old Flow listing remains; fresh thread alone cannot be promised to force independent create.
5. Core instructions/invocation.ts settleFlow resolves allowed display-name argument to known opaque Flow ID. Name argument is expected behavior, not actual failure cause.
6. commands/improve.ts saves change instruction then builds mode extend. service.ts validates target under blank_target_required phase code before provider resolution; flow-bootstrap/extend.ts requires top-level orchestration with empty parent graph and existing Router/Subflow for extend. Current target is rejected. Exact failing topology flags were not inspected from store, so do not claim which flag alone caused it.

### Preferred minimal proposed unit (downstream only, not implemented)

Prepare a NEW run-owned project for independent real-chat creation in the existing persistent workspace. Existing public control.createProject uses Core create-project; selectExistingContext/selectProject uses public client-gateway automation-studio-context. isolated-flow-importer.ts already demonstrates public creation without deleting source projects. Do not reuse the clone helper directly: it takes clone source hash and clone naming irrelevant to creation.

run-scenario.ts clone branch replaces topology.projectId and selects new project before launchBrowser/pairExtension. Mirror that timing for persistent independent real-chat creation, before new chat/person/lane scopes are captured. Later creation branch captures createdProjectId and passes it to createdFlowChatEntry, startLabPerson, flow lane, settlement and repair. lane.ts selects that project with no Flow; new project has neither prior conversation nor matching old Flow catalog. Normal composer/Send and model routing remain actual entry. New project changes no old project, Flow, thread, recording, instruction or profile; persistent workspace remains for reuse.

coordinator.ts currently picks the matching Persistent E2E workspace project (or creates it). Keep default behavior for other workflows; independent creation replaces only its effective topology project. Existing clone context selection before browser launch is confirmed source pattern, not a live demonstration of the new creation branch. A readiness regression should verify paired extension reflects selected new project before typing, and mismatch should fail before provider rather than send into old scope.

Exact minimal creation partition proposed:

- packages/test-runner/src/run-scenario/chat-build/creation-project.ts (new cohesive helper using public create/select control) and tests/creation-project.test.ts.
- packages/test-runner/src/run-scenario/chat-build/index.ts barrel.
- packages/test-runner/src/run-scenario.ts: creation-only pre-browser preparation, replacement topology scope and owning artifact identity. No source change to Core, conversation freshness, normal UI continuation or generic budgets.

Persist ignored structured creation identity BEFORE Send and update after ending: schema/runId/workspace/projectId/domainId, resulting Flow ID or null, build outcome, and saved definition hash when available. Exact Flow ID alone is insufficient. Current A3 run.json and flow-lane.json contain no projectId; decision-trace.json has projectId but is a best-effort diagnostic, not an explicit savedFlow binding contract. Proposed owning snapshot creation-context.json should supply deterministic replay identity without searching names or guessing the default project. Runtime snapshot must be emitted by owning code, never hand edited.

Confirmed replay gap: existing-flow-run.ts APIs explicitly accept projectId/flowId. But commands.ts replay union/parser only accept workspace/flow/instruction-task/seed; SavedFlowReplayOptions has no projectId; replay-saved-flow.ts always destructures coordinator topology.projectId, then lists/hashes/executes Flow only in that default project. A saved Flow in new run-owned project would fail lookup. Add optional explicit --project ID and projectId option; preserve legacy default only when flag absent. No search by name/Flow or guessing across projects. Apply actual selected project to topology and public gateway context before replay browser, hash/read/run/detail/accounting/returned identity.

Regressions: seed persistent default project with old unfinished Flow/chat; independent creation prepares distinct new public project before browser/chat scope capture; assert old data untouched and no direct build invocation; chat, person simulation, settlement, decision trace and identity snapshot all use new project. Failure before provider still persists new project identity. Ordinary repair/replay retains original project and unchanged Flow. Separately verify explicit savedFlow project binding, hash equality, no provider calls and no default-project fallback. Then changed-source headed real-chat creation and actual persisted replay establish live behavior; no tests or launch performed here.

Public fresh-thread flag is NOT the preferred repair: public ConversationOpenRequest lacks it, and even a new thread within old project still lists matching failed Flow. No generic Core API expansion is needed for run-owned new project.

### Separate normal UI unfinished-draft limitation

A2 ending tells the person unfinished Flow remains and can be built again. A3 repeated task reasonably continues that conversation, but improve always chooses extend and rejects the unfinished target. That is a separate product continuation limitation. A future bounded product unit should select supported creation/continuation mode from actual generic target eligibility and retain that same draft/instruction history, or provide honest actionable guidance to build unfinished draft. It must not silently create a second Flow or weaken extend policy. Nonblank real improvements must remain extend with apply confirmation. Exact choice/UI continuation contract requires its own source brief; this worker did not implement or validate it.

### Exact additive replay partition and command proposal

- packages/test-runner/src/commands.ts and tests/commands.test.ts: replay projectId optional field, --project parsing/validation/usage; reject empty identifier; preserve old noflag shape.
- packages/test-runner/src/cli.ts replay dispatch (discovered call forwarding, not read; implementer must read after release) forwards parsed explicit projectId.
- packages/test-runner/src/saved-flow-replay/replay-saved-flow.ts and new tests/project-selection.test.ts: explicit project selection occurs before savedFlow lookup/hash/browser/run. Assert no lookup in default when override given; invalid/mismatched explicit project fails and never falls back. All hash/Flow/run calls and result.projectId use actual selected ID. Existing credential/provider absence and deterministic replay semantics unchanged.
- Creation helper/metadata partition above plus these parser/dispatch/replay owners form one coherent downstream unit. No coordinator default policy change or Core freshness API needed.

Proposed future command (NOT executed, flag not implemented):

~~~text
node scripts/lab/run-lab.mjs replay crossborder-marketplace --workspace t262-a --project <actual-project-id-from-creation-context> --flow <actual-saved-flow-id> --instruction-task crossborder-marketplace-hub-to-cart
~~~

Require matching persisted identity and definition hash; zero provider calls and actual final facts/runtime success remain acceptance gates. Existing noflag replay supports old default-project saved Flows. This design does not claim any savedFlow exists after A3.
