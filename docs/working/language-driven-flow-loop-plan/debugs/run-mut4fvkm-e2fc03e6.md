# A resumed real-chat run - oracle pass, runtime status failed

Status: Active
Owner: Codex senior supervisor
Date: 2026-10-03

## Current State

Run run-mut4fvkm-e2fc03e6 reached real-chat creation, whole-Flow test/judges and persisted playback. All four fixture facts held, but Core returned failed after a recovered coupon busy response. Lab oracle/evaluation/central verdict passed while the launcher exited1 and reported flow_lane.every_failure_recovered. Treat this as a reproduced runtime/reporting defect, not a clean acceptance pass. Root cause investigation is assigned in t262.

## Reproduction and environment

- Task t262, instance t262-slot-2, exclusively claimed slot2. Source checkpoints downstream326ad350/Core9f756676; no source edits during run.
- Command: node scripts/lab/run-lab.mjs run crossborder-marketplace --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task crossborder-marketplace-hub-to-cart --llm-max-input-tokens 992000 --llm-max-output-tokens 8000 --llm-max-total-tokens 1000000 --llm-max-calls 48 --llm-cost-ceiling-usd 0.10
- Public env: FLUXIQ_LAB_INSTANCE=t262-slot-2, FLUXIQ_TEST_ENV_FILES=none, FLUXIQ_TEST_TARGET=isolated, FLUXIQ_LLM_RUN_COST_CEILING_USD=.10, npm_config_workspace_concurrency=1. Lab-owned Core receives scope=test; normal UI unaffected.
- Headed bundled Chromium Chrome/134.0.6998.35; instance-owned e2e-chromium build, isolated fixture/profile/Core/panel. Loopback scenario62036/web62037/gateway62038. Processes stopped by owning lifecycle after run; no other profile/server changed.
- Start2026-10-04T01:07:38.524Z/end01:13:04.486Z (Oct3 local),325.523seconds. Prelude68.768seconds; isolated panel production setup additional, not model-build time. Build170.442seconds.

## Measured results

-30provider calls:26explore,1instruction read,2judge,1chat; no repair decisions, runtime provider calls0.
- Total estimated spend .04025919; per-build incl read/judges .040120068 against .10;0budgetbreach, no override. Both judges answersRequest=yes, confidence.72.
- Created Flow flow.4b9ead90-7b90-4a62-b069-77e51df03df2 through buildEntry=chat, proposal applied. Persisted playback13attempts:10successes,2optional skips,1failed press followed by succeeded retry_node/250ms. Terminal status failed, current failure null, no early-stop/refuted flag observed.
- Four oracle fact IDs held: cart-count, orders-shipped, cart-line, store-coupons. Exact requested options/quantity and coupon were checked by fixture oracle. Authored records intentionally contain no captured page text.
- One recovered failure web.action.rate_limited, effect unacted. Harness not attempted; refusal llm.gate.known_recovery. Reported verdict failed/code flow_lane.every_failure_recovered. Root cause pending; no Lab verdict override.

## Screenshot review

Supervisor viewed steps0016,0071 and final screenshots00022. Early chat/build status and chooser control cards visible; exploratory state held incorrect temporary options. A real cart action eventually occurred. Final screenshot shows correct requested options, coupon busy card followed by retry Done, then failed cart card and Run failed overlay. The latter contradicts successful final oracle and needs runtime-status repair. Final image also shows6tabs; tab lifecycle/repeated opening remains quality follow-up. Overlay/chat failed wording reflects Core status honestly, not a clean success.

21unique screenshots/1duplicate across22events retained in ignored run evidence. No broad screenshot audit, Firefox or installed Chrome/Edge validation performed.

## Persistence and next steps

Disposable isolated cleanup deleted the Core workspace. Definition/node evidence survives, but separate same-workspace reuse is not possible for this run. Correct next command to persistent-isolated named t262 workspace before building, then lab replay same saved Flow with provider absent. Do not claim reuse or repair/persistence proven here.

1. Reproduce generic recovered-run status defect with focused test; preserve genuine final failures and refuted verification.
2. Fix owning Core path, run exact owner tests/typecheck/build plus paired checks/audit. No full sweeps.
3. Launch changed-source A on persistent-isolated at .10; guard must admit without override. Inspect full ending and all4facts.
4. lab replay saved Flow separately, unchanged content hash, zero provider/interventions, same oracle. Keep workspace intact.
5. Continue B explicit repeat-removal feedback blocker and C/D reported partitions; standalone t224 UI review remains paused.

## Evidence locations

Central ignored bundle: C:/Users/osrs_/FluxStuff/lab-runs/2026-10-03/run-mut4fvkm-e2fc03e6.
Local ignored bundle: test-runs/instances/t262-slot-2/run-mut4fvkm-e2fc03e6; launch-1.log and local UI review retained. No artifact, profile, credential or recorded page value committed.

## Full debug template completion — retrospective

Completed retrospectively by resume-live-prep on 2026-10-03 from the preserved first-run artifacts. Stage 1 below uses the public task instruction and the supervisor's prelaunch readiness expectations; this worker had already investigated the run and cannot claim to have written these expectations before seeing it. Original supervisor narrative above is preserved. This completion establishes an evidence record, not a clean live pass.

### Header

- Run id: run-mut4fvkm-e2fc03e6.
- Scenario / variant / task: crossborder-marketplace / baseline / crossborder-marketplace-hub-to-cart.
- Command/environment/source/browser/timing: exact values in Reproduction and environment above.
- Date/provider/model: Oct3 local / deepseek / deepseek-flash.
- Provider calls/tokens/cost: 30 calls; 550,009 input and 3,606 output tokens, 553,615 combined, from 30 step usage records. Build accounting excludes chat: 548,422 input +3,520 output =551,942; build including read/judges $0.040120068, total $0.040259190. No missing priced step, no budget breach; .10 purse had $0.059879932 remaining.
- Verdict as reported: evaluation/oracle/central verdict passed; Core execution and product reported verdict failed; launcher exited1 with flow_lane.every_failure_recovered. These disagree; do not flatten them into pass.
- Stage reached: 6, terminal harness decision recorded, with repair refused/not attempted. Completion of the diagnostic stages does not imply successful repair or independent reuse.

### Stage 1 — instruction and expected chain

Public instruction verbatim, from authored `apps/scenario-lab/src/scenarios/crossborder-marketplace/live-tasks.ts` HUB_TO_CART:

> On Farbazaar, put three of the Voltbay USB-C hub sold by Voltbay Official Store in my cart: Space Grey, the 7-in-1 version, shipped from Spain. Collect that store's coupon while you are on the item. Do not buy anything.

Expected chain, from public task/manifest and prelaunch readiness report:

1. Open the fixture, dismiss interfering layers using permitted controls, search and locate the intended seller/listing, then drive its item page/new tab.
2. Choose the requested colour, version, origin and quantity before the lasting cart press; retain each choice deterministically rather than depending on exploration residue. Collect the official store coupon, respecting cold-start busy retry.
3. Add the configured item to cart once, never buy, persist the correct Flow, replay it and independently compare cart-count, orders-shipped, cart-line and store-coupons.

Wrong but superficially right: configured controls with an empty cart; defaults/one item instead of requested quantity; coupon appearing only from exploration; cancelling colour pair dependent on initial state; fulfilled facts paired with a failed execution status; a rebuilt Flow mistaken for same persisted-Flow reuse.

### Stage 2 — every model turn in exact order

All 30 priced model turns are listed, including the nested instructed read and both judges. Questions are screened request-purpose descriptions, never copied prompts. `C` means current draft/checklist/page evidence for the next build decision; `R` means actual parameter values remain only in the named ignored decision artifact. Handle/selector/string values are intentionally withheld. Amendment step numbers and act labels are model grammar, not page state.

Each `steps/<folder>/decision.json` contains the exact private decision/argument values; `meta.json` contains timing/usage, request artifacts the exact question. Result folders between this row and the next retain exact tool/test answers. No provider call is omitted or coalesced.

| # / artifact folder | What it was asked | What it decided | Action and parameter shape | Result / next evidence |
| --- | --- | --- | --- | --- |
| 1 / 0001-chat | Interpret the user's request | Create a Flow here | flow.createHere, instruction:string (R) | initial navigation 0002 succeeds; build starts |
| 2 / 0003-decide | C, exploration1 | Dismiss cookies | core.run_node dom-click; target.handle:string; consequences:[] | 0004 target_covered; obstacle remains |
| 3 / 0005-decide | C plus covered-target refusal | Close welcome layer | dom-click; target.handle:string | 0006 succeeds |
| 4 / 0007-decide | C, reachable search | Search requested listing | dom-type; target.handle:string,text:string,submit:true | 0008 succeeds |
| 5 / 0009-decide | C, search results | Open intended item | dom-click; target.handle:string | 0010 succeeds/new item tab |
| 6 / 0011-decide | C, item choices | Choose colour | dom-click; target.handle:string; add:true,act:a1.colour | 0012 succeeds; choice toggle |
| 7 / 0013-decide | C after colour press | Press same colour again | same target shape; add:true,act:a1.colour | 0014 succeeds; repeated toggle, not distinct requirement |
| 8 / 0015-decide | C, layer interference | Dismiss consent | dom-click; target.handle:string | 0016 succeeds |
| 9 / 0017-decide | C, version/origin still needed | Choose version | dom-click; target.handle:string; add:true,act:a1.version | 0018 succeeds |
| 10 / 0019-decide | C, coupon available | Collect coupon | dom-click; target.handle:string; add:true,act:a2 | 0020 refused_by_page; busy |
| 11 / 0021-decide | C plus busy refusal | Retry coupon | same click shape; add:true,act:a2 | 0022 succeeds |
| 12 / 0023-decide | C, claims already present | Add existing claims again | amendments:[step9 add a1.version,step11 add a2] | 0024 draft_unchanged; act_already_named twice |
| 13 / 0025-decide | C plus unchanged refusal | Repeat same amendment | exact same step/change/act shape as turn12 | 0026 same refusals; no progress |
| 14 / 0027-decide | C plus duplicated-claim feedback | Retarget version step to origin; invalid bind | step9 rerun input.parameters.target.handle:string,act:a1; step9 bind same target-shaped input | 0028 rerun; nested read starts; claim repurposing |
| 15 / 0029-decide | Read instruction's lasting consequence classes | Recognize creation and modification | complete.result.instructed:[consequence:create_new/modify_existing,quote:string] | parent rerun 0030 reset,0031 remembered,0032 succeeds; read itself presses nothing |
| 16 / 0033-decide | C after retarget | Restore version, claim coupon, attempt invented quantity/cart steps | amendments:9 rerun target.handle:string;9 keep a1.version;12 keep a2;13 add a1.quantity input{node,parameters{target,text}};14 add a1 input{node,parameters{target},consequences} | 0034 partly applied; act_already_named,no_such_step; reset/remembered/rerun0035–37 |
| 17 / 0038-decide | C plus unavailable steps | Retarget step10 to origin and prune | 10 rerun target.handle:string;10 keep;11 drop;12 drop;13 keep a2 | 0039 partly applied already_out,did_not_work,act_already_named; reset/replay0040–43 |
| 18 / 0044-decide | C after rerun | Keep already-covered claims | amendments:9 keep a1.version;10 keep;14 keep a2 | 0045 unchanged act_already_named/already_in_flow |
| 19 / 0046-decide | C plus unchanged result | Repeat those claims | same amendments as turn18 | 0047 same unchanged refusals |
| 20 / 0048-decide | C, missing actual quantity/cart step | Claim colour; attempt invented select/cart entries | prior keeps;6 keep a1.colour;15 add a1.quantity input{dom-select,target,value};16 add a1 input{dom-click,target,consequences} | 0049 partly applied; duplicate/in_flow/no_such_step; authoring cannot add an unrun invented step |
| 21 / 0050-decide | C plus no_such_step | Retarget current step into quantity | 10 rerun input{target.handle:string,text:string} | 0051 applies; reset/prefix0052–55;0056 succeeds |
| 22 / 0057-decide | C, quantity candidate | Rerun quantity then bind/claim | 10 rerun input{node:dom-type,parameters{text,target}};10 bind input:{};10 keep a1.quantity;11 keep a1 | 0058 applies;0059 succeeds; empty bind does not demonstrate configurable input |
| 23 / 0060-decide | C, missing lasting cart press | Explicitly author cart action | dom-click; target.handle:string; add:true,act:a1 | 0061 refused_by_page; colour missing |
| 24 / 0062-decide | C plus colour refusal | Rerun colour step | step6 rerun input.target.handle:string | 0063 applies;0064 reset;0065 succeeds |
| 25 / 0066-decide | C after colour rerun | Retry cart | dom-click; target.handle:string;add:true,act:a1 | 0067 refused_by_page again; colour still missing |
| 26 / 0068-decide | C plus repeat colour refusal | Fresh colour press | dom-click; parameters{target,consequences:[]},write:false | 0069 succeeds; different grammar/claim placement from earlier action |
| 27 / 0070-decide | C after fresh colour press | Fresh cart press | dom-click; target.handle:string;add:true,act:a1 | 0071 succeeds; lasting cart action finally exists |
| 28 / 0072-decide | C, actual cart action | Complete draft | complete.result.summary:string | one build test0073–85:13steps incl reset, replay/remembered/verified; judges follow |
| 29 / 0086-judge | Whole-Flow test/checklist/end evidence | Approve request | diagnosis answersRequest:yes,patchNeeded:false,confidence:.72 | no build repair requested; coupon claim warning discussed |
| 30 / 0087-judge | Same independent judgement evidence | Approve again | diagnosis answersRequest:yes,patchNeeded:false,confidence:.72 | proposal applied; persisted playback follows; no further provider turn |

Repeats/progress: duplicate colour clicks turns6–7; repeated unchanged claims12–13 and18–19; guessed nonexistent add steps16/20; wrong/empty binding forms14/22; choices reused as generic cart claim; colour repair/cart failures23–26. These are paid exploration churn, not post-test repair rounds. Draft revision-changing amendments counted as progress even when not fulfilling a new requirement. No individual-turn causal benefit of claimSaid can be measured from one run.

Feedback: claimSaid is present in request evidence from 0023 onward, including both judges. Later genuine explicit cart action was authored at0060–0070, but intervening churn prevents claiming feedback alone caused that improvement. Coupon warning is a false-positive candidate: existing vocabulary's singular coupon does not match the control's plural form, while judges recognize collected state. The advisory did not withdraw claims or refuse execution.

Refusals: target_covered routed model to close welcome; busy coupon refusal elicited retry; act_already_named/already_in_flow repeatedly elicited identical amendments; no_such_step eventually led to explicit action calls after additional rerun churn; invalid choice/cart configuration refusal led to colour correction. Existing feedback explains the codes, but this run demonstrates that the model did not consistently use it.

Context eviction/truncation: NO EVIDENCE of a complete context-eviction event stream in saved run. No provider-input-budget breach recorded; requests and metadata remain locally inspectable. Lack of breach is not proof no page packet truncated. No raw request/page copied here.

### Stage 3 — proposed Flow and real parameter evidence

Flow flow.4b9ead90-7b90-4a62-b069-77e51df03df2 was proposed/applied from chat; 14 total nodes,12 action nodes:9click,2type,1navigate. `N` below expands to authored node prefix `node.bootstrap.5d04472bfcefa0c3.main.`. Real selector/handle/string values stay in ignored build-tool call records and the locally screened `snapshots/flow-lane.json.authoredNodes`; precise shape is preserved below. Snapshot selectors/strings may already be withheld, so exact original arguments require the private step call/request records.

| Authored ID | Node type / purpose | Parameter shape and private evidence |
| --- | --- | --- |
| N+s1 | browser-navigate/start page | {url:string,newTab:boolean}; initial0002 call; snapshot authoredNodes s1 |
| N+s2 | dom-click/welcome closer | {selector:string,element:{tagName,visibleText,...},timeoutMs:number};0006 call |
| N+s4 | dom-type/search | {selector:string,text:string,submit:boolean,element:{tagName,label,...},timeoutMs:number};0008 call |
| N+s5 | dom-click/item listing | {selector:string,element:{tagName,accessibleName,...},timeoutMs:number};0010 call |
| N+s6 | dom-click/colour | {selector:string,element:{tagName,visibleText,...},timeoutMs:number};0012/0014 and rerun0065 |
| N+s7 | dom-click/least-consent closer | same click shape;0016 call; no matching playback attempt |
| N+s9 | dom-click/version | same click shape;0018 and subsequent rerun calls |
| N+s10 | dom-type/quantity | {selector:string,text:{$state:{path:string,fallback:string}},element:{tagName,label,...},timeoutMs:number,submit:boolean};0056/0059 calls; binding details local only |
| N+s11 | dom-click/origin | same click shape; parent retarget/rerun0032/0043 references |
| N+s12 | dom-click/store coupon | {selector:string,element:{tagName,visibleText,context:{shadowHosts:[string]},...},timeoutMs:number};0020/0022; playback0096/0097 |
| N+s13 | dom-click/colour | same click shape; fresh0069 call; playback skipped0098 |
| N+s14 | dom-click/add to cart | same click shape;0071 call; playback0099 |
| Control nodes / edges | two nonaction nodes counted by shape | NO EVIDENCE of full authored control IDs/edges/actual persisted revision in snapshot; exact graph store was disposed |

Divergences: N+s6 and N+s13 retain colour corrections/optional skips rather than a clearly idempotent single choice; page-state misunderstanding. Coupon cold-start needed retry, legitimate runtime behavior. Misnamed generic cart claims/retargeted choices and nonexistent add amendments are grammar/action-identity confusion, not inability to express a new cart action. Quantity became a state-backed form but no separate reuse demonstration proves its binding stable. Authored N+s7 absent from replay while replay N+s3 is absent from authoredNodes: revision/identity mismatch, cause unproven without graph/trace. Do not infer persisted chain from only node-count shape.

### Stage 4 — node-by-node persisted replay

Private refs are central `steps/0088–0099-run-*` plus `snapshots/flow-lane.json.actions`. Optional skip may lack a standalone action execution file; snapshot holds complete order. “Matched” is Core comparison status, not a fresh provider judgement.

| Node / attempt | Executed | Produced | Duration ms | Retries | Rung absorbed |
| --- | --- | --- | ---: | --- | --- |
| s1 | succeeded | navigation, matched |1351|none|none|
| s2 | succeeded | click, matched |711|none|none|
| s3 | succeeded | comparison matched; not in authored node snapshot |0|none|NO EVIDENCE actual node definition/result; trace omitted|
| s4 | succeeded | type/search, matched |649|none|none|
| s5 | succeeded | item click/new tab, matched |1694|none|none|
| s6 | skipped | target_not_found optional outcome |4103|none|declared optional/skip, no lasting press|
| s9 | succeeded | version click, matched |965|none|none|
| s10 | succeeded | quantity type, matched |149|none|none|
| s11 | succeeded | origin click, matched |945|none|none|
| s12 attempt1 | failed | coupon busy, rate_limited/unacted |1075|retry follows|retry_node selected|
| s12 attempt2 | succeeded | coupon click, matched |1346|attempt2/3;250ms backoff|retry_node|
| s13 | skipped | target_not_found optional outcome |4089|none|declared optional/skip, no lasting press|
| s14 | succeeded | cart click, matched |1243|none|none|

13 recorded attempts:10 succeeded,2skipped,1failed; healed fault retained. The zero-duration s3 success cannot be explained from retained action metadata: NO EVIDENCE of whether it executed a real action or was synthetic/satisfied routing. It is an instrumentation finding, not proof of a no-op defect. Provider calls during replay:0, interventions0; deterministic coupon retry verified. Core final failed status still blocks a clean deterministic-run claim.

### Stage 5 — answer / final-state comparison

This task declares no extracted dataset. Records expected/returned: not_declared, no count-only dataset pass. Four independently compared final-state facts held; exact page strings remain private oracle artifacts.

| Fact ID | Expected predicate from public manifest | Observed comparison | Mismatch |
| --- | --- | --- | --- |
| cart-count | requested three pieces |held|none|
| orders-shipped | zero purchases/shipped orders |held|none|
| cart-line | intended listing/seller/colour/version/origin/quantity |held exact text comparison|none|
| store-coupons | intended store coupon collected |held exact text comparison|none|

Fields compared4,matched4,mismatched0. No observed string dump needed. These assert fixture state after playback, not that Core reported success, that a new purchase was authorized, or that separate replay reused an unchanged Flow.

### Stage 6 — judgement, repair and persistence

Build judges0086/0087 each approved with confidence.72,patchNeeded:false after actual whole-Flow build test. Their evidence includes replayed configuration and verify-only lasting coupon/cart targets; their text distinguishes exploration effects from the build test's withheld lasting presses. Both saw checklist/claimSaid and coupon collected state. Acceptance applied the proposal and persisted a Flow for this playback.

Runtime resultVerification:null. The failed execution prevented a normal successful-run result check. The fixture oracle independently found a correct final state. Harness attempted:false, interventions/patch attempts/adaptation IDs empty; refusal known_recovery. No wrong-answer repair or persisted adaptive patch occurred; no rerun of a repaired Flow, and no independent same-workspace reuse. First workspace was disposable and deleted.

Repair context: failed coupon record and deterministic retry are retained; node parameter shapes and execution metadata survive. NO EVIDENCE of the exact terminal graph trace, control-node/edge state, actual last failing node/reason, or the full context the refused harness would have received. No provider request was made for runtime repair, so no repair prompt exists to review. Do not describe missing prompt as an executed repair receiving incomplete input.

### Causes — source owners and follow-up

| # | Cause precisely | Repo/file | Fix / status | Task |
| --- | --- | --- | --- | --- |
| C1 | Two calls target already-chosen colour, then later colour/cart attempts churn | Core flow-draft/reversal.ts; downstream domain press-effect | cancellation integration existed; actual optional colour pair still merits state-proof review, no new fix verified here |t262|
| C2 | add amendments name unrun/nonexistent steps, unchanged claims repeat | Core flow-draft/amendment.ts and llm harness feedback | explicit author-new-action path eventually worked; feedback/grammar quality follow-up |t262|
| C3 | same action's choices temporarily carry generic cart claim | Core instructed-acts/claim-doubt.ts/checklist.ts | advisory present; causal savings not proved; judges retain authority |t262|
| C4 | Get coupons plural triggers warning against singular kind vocabulary | Core instructed-acts/kind-words.ts and claim-doubt.ts | false-positive advisory candidate; no extra refusal or source edit in this debug |pending|
| C5 | healed coupon selected as terminal recovery cause | Core runtime/service.ts callbacks and recovery/annotation/annotate.ts | later t262 unresolved selector fix tested separately; cannot explain first run's graph status |t262|
| C6 | status failed despite no unresolved action failure; authored s7/playback s3 mismatch | Core executor graph termination/actual Flow revision | NO EVIDENCE terminal trace, precise cause remains unproven; preserve status |t262 investigation|
| C7 | saved Lab artifacts lose existing terminal trace metadata and full graph identity | downstream persisted-flow-run.ts/creation snapshot | later additive closed diagnostic projection/persistent workspace work; not evidence first run was fixed |t262|

### UI review — screened findings

Worker privately viewed four preserved pictures: screenshots00001,steps0016,steps0071,final screenshots00022. Supervisor's earlier findings above remain.

- Start00001: side panel loading conversation with composer; no overlay visible yet. This is before active model work, so not proof an in-work overlay was missing. NO EVIDENCE sampled picture alone measures startup delay/flicker.
- Mid0016: readable message stream, composer and visible Building your Flow overlay; repeated colour cards expose real build churn. Temporary defaults differ from requested final state. Notification layer remains; no evidence it blocked cart press.
- Cart0071: site acknowledges cart action, latest card Done, earlier page-turn-down card remains legible. Overlay carries an already-settled done detail while status still Building; snapshot demonstrates stale-detail presentation, not measured flicker. Visible temporary/default choices illustrate why exploration success does not prove final Flow correctness.
- Final00022: coupon busy card followed by retry Done; later cart Didn't work card/Run failed overlay despite action snapshot succeeded and all4facts held. This is a product-status contradiction needing exact trace, not a reason to rewrite Lab status. Six visible tabs at ending versus three initially; ownership/cleanup cause unmeasured.
-21unique screenshots/1duplicate, no complete temporal audit of all pictures; no Firefox/installed Chrome/Edge coverage. UI flaws and terminal uncertainty remain open; this run does not meet MVP exit criteria.

### Instrumentation gaps found

| Stage | What cannot be answered | Owner that drops/omits it |
| --- | --- | --- |
|1|worker cannot retroactively establish pre-read authorship|debug completion timing; prelaunch source/readiness exist and are identified|
|2|precise eviction/truncation chronology|no complete eviction event stream; requests local but no authored chronology|
|3|full authored/executed graph edges, control IDs, immutable revision comparison|creation snapshot keeps shape/action nodes; isolated graph store disposed|
|4|s3 zero-duration actual operation and terminal trace.reason/control attempt|persisted-flow-run outcome/screens omit control trace/terminal metadata|
|6|actual graph failure reason and why s7/s3 differ|Core fields exist in durable run-detail; Lab omitted them before lifecycle deletion|
|6|independent saved-Flow reuse/repair persistence|not exercised; disposable first workspace prevents later identical-state replay|
|UI|complete flicker/startup/tab-owner attribution|selected screenshots insufficient for timing and ownership proof|
