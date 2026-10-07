# Intake A: the product path today (2026-10-07)

Worker: intake-product-path. Read-only, on downstream `53324d18` and Core `a2672def` (Core tree clean).
Baseline compared: downstream `92d790d7`, Core `e9b7d691`. Nothing was built or run, and no provider was called.
Every claim below comes from reading source and git history.

## Outcome

Done. The questions are answered below, plain English first and file:line evidence after.

## Plain-English answers

**1. Chat instruction to saved Flow: the chain now ends at a draft that nothing promotes.**
A person types into the extension chat. The background relays the message to a Core conversation, and
Core's chat picks one of three commands: "create here", "explore" or "improve". At the baseline,
"create here" and "explore" built by exploring the site, using the legacy draft loop with build tests,
judges and repair, and then **applied** the result automatically. The Flow had steps, and the person
could run it. Today all three commands ask for `authoringMode: "candidate"`. A successful build saves an
unverified *candidate draft* and replies "Saved a candidate draft. Verification pending; the Flow's steps
are unchanged." The Flow stays blank. Nothing in Core's production code executes, verifies or promotes a
candidate draft: the verification controller, the detached-candidate runner and the durable session have
no caller outside tests, and no API endpoint applies a candidate. So a successful chat build no longer
gives the person a Flow they can run. That is a step backwards from the baseline, where it did.
One instruction-to-runnable path survives, but it is not in the extension: the web panel's
"Build from instruction" (`flow.build`). It is structural generation that never explores the site, and it
still returns a legacy proposed adaptation that can be applied.

**2. `pnpm lab:campaign` on A-D: no provider call. A hard-coded readiness hold refuses every creation run.**
A-D are creation tasks (`--llm-task create-flow`). The campaign spawns `run-lab.mjs`, whose live-run
guards run first (balance, behind-dev, debug, peak, loop, unchanged). After admission the Lab boots and
pairs, and `runCreatedFlowLane` calls `assertCreatedFlowVerificationReady()`. That function
unconditionally throws `facility.contract` with code `lab.candidate_verification_unavailable`, stage
`before_provider`. The same throw guards the lower-level helpers too: the chat build, the direct build and
approve/apply. No flag, environment variable, override file or caller JSON lifts it. Its comment says
"Implementation gate, not a caller setting." Lifting it takes a source change, made once trusted candidate
execution, independent verification and original-project promotion exist. The lane must also be rewired
at that point, because its apply step still approves and applies a legacy adaptation, which the candidate
path never produces. Side effect, inferred and not verified: an admitted run that ends this way is still
written to the spend ledger as not passed. The next run of that task on the same instance would then meet
the `debug` and `unchanged` guards. Repair campaign tasks (`--kind repair`) use `runLiveRepairLane`, which
has no such hold.

**3. Authoring language: the default chat build no longer uses add/act/keep/drop/amend. It uses a submit tool.**
`core.submit_candidate` exists, and candidate mode is the default for every chat build and for the web
panel's Explore and Improve. In that mode the evidence loop runs with `draft:false` and
`discoveryOnly:true`: discovery calls are evidence only, no draft is shown, `amend_draft` is not offered,
and add/act claims are not recorded. The model submits a whole Flow script or plan, receives diagnostics
or a revision and digest, and completes with the latest revision. The selector is the request field
`authoringMode: "candidate"`, set in code by callers, and it requires `evidenceGuided:true`. There is no
environment flag. The legacy grammar (`flow-draft/entry.ts`) is still live in the non-candidate
evidence-guided branch, which repair/re-author and raw API callers use.
Three costs of candidate mode, from source:
(a) `core.run_flow` is removed from the tools, so the model cannot test-run its own Flow.
(b) There is no build judge or repair round in that branch.
(c) I found no production code that shows the model the Flow script format
(`AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT`). The format is only embedded in a completion schema that nothing
uses, while the submit tool's description says only "Submit a complete Flow script or existing canonical
JSON plan". This is not confirmed against a recorded provider request.
Separately, stopped candidate builds do not resume from an incomplete draft, because that store is skipped
in candidate mode.

**4. The week-review open causes against t296-t337 on the default path:**

| Cause | Changed on the default path? |
| --- | --- |
| Act-claim trust | Removed rather than fixed. Candidate mode records no act claims, but nothing replaces them with executed-effect attribution, because candidates are never executed. Legacy act-claim code is unchanged since the baseline (no diff in `flow-draft/`, `instructed-acts/` or `decision-handlers/`). |
| Judges reading exploration leftovers | Not on the default path, because the default build has no judge at all. The planned remedy (reset, declared start, then detached execution) exists only as pieces: the t336 Lab fixture reset and an unwired detached runner. |
| Lone unconfirmed yes | Fixed, but only in the legacy build judge. t296 `agreement.ts` now makes a build-test yes without a confirming yes "unsure". The default chat build does not use that judge. |
| Refusal churn | The legacy churn sources (keep, drop, act, amend, rerun refusals) cannot occur in candidate mode. New churn is possible on submit diagnostics and `candidate.latest_submission_required`, and is unmeasured. Legacy refusal code is unchanged. |
| Read-list | Small improvement: same-row paging now detects records rewritten in place, and pager churn no longer counts as a page change (t301). The causes the model controls (blind parameters, its own filter mistakes) are unchanged. The read-list S1-S6 redesign predates the baseline. |

**5. Net: today's default product is further from passing A-D than the baseline was, but its
foundations are more trustworthy.**
At the baseline a chat build could produce a runnable Flow that the Lab ran and judged. That path had
produced lane A's five historical passes, although round 4 had just failed A-D. Today no chat build can
produce a runnable Flow, and the Lab refuses A-D before any provider call, so A-D cannot even be
attempted. The work since then is real groundwork that targets the review's top causes by design:
- fences against false acceptance
- the confirming yes
- a submit tool in place of the amend language
- receipts and journals, original-source binding, and fixture reset
- typed check, navigation, assert and typing fixes
- identity checks and Stop

None of it yet closes the loop of declared start → execute candidate → verify requirements → promote,
and that loop is the only route back to a runnable Flow. Before an A-D attempt is possible again, these
must exist and be wired:
1. Detached candidate execution in the normal runtime.
2. Requirement verification.
3. A promotion gate.
4. Lane changes to use them.

The candidate prompt also has to teach the Flow format and probably restore a way to test. Until then,
the legacy loop's fixes from the week sit off the default path.

## Evidence (file:line)

Core paths are relative to `C:\Users\osrs_\FluxStuff\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`.

**Q1: chat path today**
- Extension relay: `apps/extension/src/background/panel/conversation-relay.ts:88,93` (open-conversation, append-turn).
- Core's chat command set has only create-here, describe, explore, improve, run-flow and answer-ask: `runtime/conversations/commands/catalog.ts:12-25`.
- Every build asks for a candidate: `runtime/conversations/commands/build.ts:33-38`. Success is `{ok:true,status:"draft",candidate}`: `build.ts:48-50`.
- create-here success with no apply: `runtime/conversations/commands/create-here.ts:52`. Explore: `explore.ts:43`. Improve: `improve.ts:44`.
- Draft-only chat turn: `runtime/conversations/commands/execute.ts:70-73`.
- The candidate branch saves a draft with `verification:"not_performed"` and `promotionAllowed:false`: `runtime/service.ts:1552-1570`. The loop result is also `promotionAllowed:false`: `runtime/flow-bootstrap/candidate/authoring-loop.ts:38`.
- No production consumers: `AutomationStudioCandidateVerificationController`, `runAutomationStudioDetachedCandidate` and `AutomationStudioCandidateDurableSession` (`runtime/flow-bootstrap/verification/`) have 0 references outside that directory and its tests (grep over `packages/fluxiq/src`). `api/handlers` has no candidate apply or promote endpoint.
- Baseline (`e9b7d691`): `create-here.ts:64` applied the adaptation, and `:69` said "Your automation ... is ready". `build.ts:51-55` returned `adaptationId`. `service.ts` had no candidate mode. The change landed in Core merge `66a310cc` (t330) and commit `330b5338`.
- Surviving web-panel structural path: `apps/web/src/features/automation-studio/conversation/capabilities/catalog/flows.ts:57-71` → `authoring/authoring-commands.ts:11-13`, a legacy request with no `authoringMode`.

**Q2: Lab hold**
- `packages/test-runner/src/flow-lane/creation/readiness.ts:4-5`: an unconditional throw, code `lab.candidate_verification_unavailable`, stage `before_provider`.
- Called at `lane.ts:338` (`runCreatedFlowLane`), `chat/build-from-chat.ts:92`, `build-proposal.ts:362` and `review-proposal.ts:26` (approve/apply).
- The creation lane is entered from `packages/test-runner/src/run-scenario.ts:417`.
- Campaign → `run-lab.mjs`: `scripts/lab/live-campaign.mjs:28`. Guards run first: `scripts/lab/run-lab.mjs:237-256`. Guard rules: `scripts/lab/live-guards/rules/index.mjs`, including `unchanged.mjs:8-18` and `debug.mjs:7-16`.
- The file did not exist at `92d790d7` (`git show` fails). It was added by downstream t330 (`4db30a78`).
- A is a creation task: `apps/scenario-lab/src/scenarios/crossborder-marketplace/live-tasks.ts:59`. The repair lane is unguarded: `packages/test-runner/src/flow-lane/repair/run-repair-lane.ts:97`.

**Q3: authoring interface**
- Submit tool and loop settings: `runtime/flow-bootstrap/candidate/authoring-loop.ts:13-21` (`core.submit_candidate`, `draft:false`, `discoveryOnly:true`, `core.run_flow` filtered out). Completion requires the latest revision and digest: `:23-27`.
- Whole-candidate validation through the existing completion checker: `runtime/flow-bootstrap/candidate/submission.ts` (`submit`).
- Loop behaviour: `runtime/llm/evidence-loop.ts:177` (discoveryOnly requires draft:false), `:204` (no draft step recorded), `:647-648` (`canAmend` only when drafting).
- Mode selection: `api/handlers/llm-generation.ts:68` and `runtime/service/flow-bootstrap-commands/generation-request.ts:51` (candidate requires evidenceGuided).
- The legacy branch is still present: `runtime/service.ts:1572` onward (build judge, rounds `:1582-1584`). Legacy grammar: `runtime/flow-draft/entry.ts:83-89` (`AUTHORED_INSTRUCTION`).
- Format not shown: `AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT` (`runtime/flow-bootstrap/plan/flow-script-format.ts:90`) is imported only by `plan/evidence-schema.ts:22,53`, whose `automationStudioEvidenceFlowBootstrapCompletionSchema` and its constant (`:46,67`) have no non-test consumer.
- Incomplete-draft resume is skipped in candidate mode: `runtime/service.ts:1536`.

**Q4: causes**
- `git diff --stat e9b7d691 a2672def` over `runtime/flow-draft`, `runtime/llm/decision-handlers`, `runtime/flow-bootstrap/instructed-acts`, `runtime/llm/evidence-loop` and `runtime/llm/repeat-guard` is empty. Only `result-verification/agreement.ts` and `service/runtime-adaptation/{held-candidate,reauthor-build,repair-rerun}.ts` changed.
- Unconfirmed yes: `runtime/result-verification/agreement.ts:45-47` (no second check → unsure) and `:56-59` (unknown or silent confirmation → unconfirmed).
- Read-list paging: `apps/extension/src/content/extraction/page-advance/list-change.ts` (diff `92d790d7..53324d18`: `previousRecords`/`recordMeaning`; pager detach no longer counts), commit `4d7a1447`.

## Commands run and observed results

- `git log --first-parent` on both repositories over baseline..head: 40 downstream and 22 Core task merges (t295-t336).
- `git diff` / `git show` at the paths above, as quoted.
- Greps for consumers of the verification controller, the detached runner, the durable session, `AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT` and `assertCreatedFlowVerificationReady`: results as stated.
- Core `git status --short`: clean. Head `a2672def1d3c`.

## Not verified

- No live or provider-free run. "No provider call" for A-D is from source order, not observed.
- That the Flow script format never reaches the model: no recorded provider request was inspected, and refusal diagnostics from the completion checker may partly teach it.
- How the ledger records a readiness-refused run, and so whether the `debug` and `unchanged` guards then trip.
- What `run-flow` does on a blank Flow, and how the extension chat UI renders the `candidate-draft` attachment.
- The uncommitted t334, t335 and t337 trees (intake B's scope).

## Open questions or contradictions found

- Current State calls t330 "combined draft-only callers independently verified" as progress. In product terms it removed the only extension path that produced a runnable Flow, before a promoter existed. That trade should be stated explicitly in Current State.
- In candidate mode the model loses the test-run tool and, apparently, the Flow format text. P1's "Exit" in the consultant revision expects a representative Flow to be proposed and revised; nothing yet measures whether a model can author a valid whole candidate this way.
