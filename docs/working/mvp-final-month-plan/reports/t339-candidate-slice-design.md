# t339: candidate vertical slice design (read-only)

Worker: t339-candidate-design. Read-only on downstream `1e9e9a2e` (docs-only after `56ac438d`) and Core `a2672def` (tree clean).
Nothing was edited except this report. Nothing was built or run, and no provider was called. Every claim comes from
reading source. Core paths are relative to `C:\Users\osrs_\FluxStuff\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`
unless marked "downstream".

## Outcome

Done as a design. The path below goes from candidate submission to a promoted, runnable Flow for lane A
(`crossborder-marketplace-hub-to-cart`). It uses only existing pieces: the candidate loop, the t300 detached runner,
the normal graph executor, run datasets and end view, the build-test judge with t296's two-yes rule, and the
bootstrap adaptation create/approve/apply path. It does not use required mode, the requirement-predicate controller,
the durable session or any other link of the parked chain. It splits into four implementation units, and four points
need a user decision.

## Plain English

**The slice in one paragraph.** The model explores, then submits a whole Flow as now. When it says it is finished,
or asks to test, Core runs that exact submitted Flow once from its declared start, through the normal runtime, under a
short-lived "trial" run record. The trial is never applied to the Flow. Core then shows the existing build judge only
what that trial run did: each step's changes, the page it started on and ended on, and any rows it stored. The judge
must say yes twice (t296). A yes is tied to the exact revision and digest that ran. If the yes stands, Core turns that
same candidate into an ordinary bootstrap proposal. Creating the proposal re-checks the Flow's base digest, and the
chat then approves and applies it exactly as the restored legacy path (t338) does. Applying checks the base digest
again under the adaptation lock. If anything changed in between, the result stays a draft. Anything short of two
yeses also stays a draft, and the model is told why so it can revise. The Lab waits for a promoted Flow, records the
candidate id, revisions and verdicts, then resets the fixture and replays the Flow with its own oracle, as it does
today.

**1. What the candidate-mode model sees today, and what is missing.** It gets the evidence tools, `core.describe_nodes`
and one submit tool, `core.submit_candidate`. `core.run_flow` is removed. The submit tool's description is a single
sentence: "Submit a complete Flow script or existing canonical JSON plan". The completion schema asks only for
`{revision, digest}`. The node catalog arrives as names only, and full definitions come one `core.describe_nodes`
call at a time. The general decision instruction tells the model not to act on the site just to perform a step that
belongs in the result. **Nothing shows the model the Flow script format.** The format text
(`AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT`, with three worked examples) reaches the wire only through the legacy
completion schema, which candidate mode does not use. This is a source finding, not checked against a recorded
request.

What to render from, and what to add:
- Put the format text in the submit tool's `flow` property description. Tool descriptions sit in the request's
  constant head, so the provider cache keeps them.
- The format already names nodes "from nodeCatalog". Per-node parameters are already served by the catalog entry
  (`catalog.ts`, `parameter-text.ts`) through `core.describe_nodes`.
- Add one example of acting on a single item: choose two options, set a quantity, press add with `consequences: none`,
  then press a "collect" control. That is lane A's shape. Today's three examples only navigate, rename, filter and
  read.
- Optionally, the bound domain can add its own worked example through domain system instructions. That is the only
  channel for domain prose, so Core does not hard-code page knowledge.
- Gap: the script format has no loop syntax (`$row` or repeat). Loops exist only on the legacy draft path. Lane A
  needs no loop, but C and D probably do. See Open questions.

**2. How legacy test-runs today, and how a candidate can run.** Legacy does not run the graph. It replays the draft's
recorded steps through the loop's own tools. Its "reset" is only navigation back to the start. A step with a lasting
effect is checked, not repeated. The gate looks at the page just before the replay (`startView`) and after a passing
replay (`endView`), and the judge is told to credit only what changed. `core.run_flow` runs part of the draft "on the
target as it stands now: nothing is reset first".

A candidate can instead run through t300's `runAutomationStudioDetachedCandidate`. That function already:
- revalidates the plan and refuses any rewrite;
- normalises it to a topology that is never stored;
- routes it with the normal router and runs the selected graph with `runCanonicalAutomationStudioFlow`;
- turns off model diagnosis, patches, retries and recovery;
- refuses partial runs;
- re-checks freshness before and after.

It has no production caller. The slice adds a small Core "trial runner" that wraps it:
1. Open a runtime session for the trial (`startRuntimeSession` with `metadata.candidateTrial`). The run-dataset store
   refuses rows for a run id that has no `runtime_runs` row, so the trial needs this record.
2. Build the same graph options `runRuntimeSession` builds: native executor, host runtime, capabilities, effect
   dispatcher, authorised domains, `onRecordBatch` under the trial run id, run control.
3. Call the detached runner from a start receipt.
4. Write the session's final status and trace, and process the run's datasets.
5. Read the end view through the existing run end-view reader.

"Declared start": the candidate's first step navigates to `startLocation`, because the completion check's
reachability test holds the plan to it. A navigation does not reset site state, though. Lane A's exploration and every
earlier trial add hubs to the cart and collect the coupon on the fixture. Unlike legacy, a normal-runtime trial really
performs those acts again. So a second trial starts with three hubs already in the cart. **The Lab needs a fixture
reset before each trial.** Core cannot call the Lab's control API: Core must not depend on scenarios, and today nothing
gives Core a reset port. Core's own verification contract already names a `prepareStart` port, "prepared by the
trusted reset/start adapter". The design adds that as an optional deployment hook. The Lab boots its Core process with
the hook pointed at the fixture reset it already owns. A product deployment leaves it unset, and then the start
receipt records `not_reset`. This needs a user decision (D1).

**3. Which judge, and why it sees only the trial.** Use `automationStudioBuildTestJudge` directly
(`result-verification/build-test/judge.ts`):
- It takes any `AutomationStudioRunResultSummary`.
- It always sets `confirmAnswer: true`, so t296's agreement applies: a lone yes, a yes plus unknown or silence, or a
  disagreement all come back unsure.
- It already handles the build purse, the deadline and `not_judged`.

Build its summary with `summarizeAutomationStudioRunResult`, the same summariser the runtime result check uses, from
the trial only:
- record sets read under the trial run id;
- the executed graph's nodes and edges;
- the trial trace's attempts, which give the "changed" field for each step and the start page;
- the end view;
- the domain's view keys and denied keys.

The draft steps, the evidence window and the exploration history are never passed. Do not use the legacy
`automationStudioFlowBootstrapBuildJudge` wrapper: it builds its summary from `loop.steps`, the exploration draft. Do
not use the requirement-predicate controller either. It returns a draft unless a trusted requirement brief with
`interpretationStatus: "complete"` exists, which needs the parked grammar. Its `create` rule also needs command
receipts, and the detached runner deliberately returns none. That makes it structurally unable to pass lane A, which
is a `create`. That the LLM judge, not trusted predicates, is the acceptance authority is decision D4.

**4. Promotion.** Reuse the bootstrap adaptation path that legacy builds use. After a standing yes:
1. Still inside the generation lock and the creation purse, re-read the authoritative candidate draft
   (`candidateDrafts.getAuthoritative`). Require the same candidateId, revision and digest, and recompute the digest
   over the stored `buildPlan`.
2. Re-read `getLlmExecutionBinding`. Require `executionDigest === candidate.baseDependencyDigest` and
   `settingsRevision === baseSettingsRevision`. This is the same check as legacy's.
3. Call `createFlowBootstrapAdaptation` with the candidate's `buildPlan`, `baseDependencyDigest` and
   `sourceInstructionIds`, the permission outcome, and a `candidateTrial` audit detail. Under the adaptation lock it
   refuses with `FLOW_BOOTSTRAP_STALE` unless the base digest still matches. It also revalidates the plan and
   normalises the topology.
4. Return the normal `{status: "proposed", adaptationId, ...}` result plus a candidate block.
5. The chat command approves and applies as legacy does. `applyFlowBootstrapAdaptation` compares
   `getLlmExecutionDependencyDigest` with `adaptation.baseDependencyDigest` once more under the adaptation lock.

The revision fields are `baseDependencyDigest`, which covers the parent, router, every subflow and graph, the
instructions, graph revisions and publication state, plus `baseSettingsRevision`. This is a compare-then-write under a
process-local lock. It is the same guarantee legacy creation has had, not a crash-atomic transaction. The parked
promotion design says a true atomic promoter needs a storage-authority migration. Whether to accept the legacy apply
guarantee for the MVP is decision D2.

Contract change. `promotionAllowed: false` keeps its meaning wherever it appears now:
- the loop result (`authoring-loop.ts:38`);
- the submit evidence;
- the stored draft, which still accepts only `draft`/`not_performed`.

The loop itself never promotes. The service's candidate branch gains a second outcome: a proposal whose
`candidate: {candidateId, revision, digest, trial: {runId, verdict: "yes", calls}}` says which candidate and trial
produced it. The draft outcome gains an optional `trial` block (runId, verdict, codes) so the chat and the Lab can say
why nothing was promoted. The API response parser and the Lab parser must accept both shapes.

**5. What the Lab creation lane must do in candidate mode.**
- Readiness admits candidate mode only when the Core under test reports the trial capability. Add a flag to
  `getFlowBootstrapGenerationRuntimeReadiness` and refuse before any provider call if it is absent.
- In the chat build, wait for the command's result. On `proposed` plus `candidate`, the chat applied it, so continue
  exactly as legacy: read the graph, then reset, present the page, play back and run the oracle.
- On `draft`, fail the lane as `runtime.behavior` (not `facility.contract`), carrying the candidateId, the last
  revision, the trial verdicts and codes.
- Record in the run evidence: authoring mode, candidateId, each trial's revision, digest, runId, verdict and judge
  calls, and the promoted adaptationId.
- With D1, point the Lab Core's start hook at the Lab's own fixture reset.
- The post-promotion reset, playback, oracle and zero-call replays stay as they are. They remain the independent
  qualification; Core's judge is only the gate to promotion.

## Implementation units (file-owned, 4)

Order: U1 can start now, since t338 does not own its files. U2 starts after t338 merges, because both touch the
service's candidate branch and the generation request. U3 needs t338 merged and U2's result type. U4 needs U3's
response shape. U1 defines the trial port contract and U2 implements it, so the brief must pin that interface if they
run in parallel.

| Unit | Repo | Owns | Tests (fail-first negatives in bold) | Size |
| --- | --- | --- | --- | --- |
| U1 Candidate authoring: format and trial gate | Core | `runtime/flow-bootstrap/candidate/{authoring-loop,contracts}.ts`; new `candidate/trial-gate.ts` (verdict bound to revision+digest, unchanged-after-no guard); `runtime/flow-bootstrap/plan/flow-script-format.ts` (one act-on-item example); owning `candidate/tests/*`, `plan/tests/*` format test | Submit tool carries the format text. **Completing without a trial is refused `candidate.trial_required`; a loop that ends on an untested candidate returns no promotable verdict.** **Yes on R1, submit R2, complete R2: the R1 verdict does not count.** **Trial unsure, not_judged or execution failed: completion refused, with feedback to the model.** Completing an unchanged revision after a no is refused without a new trial. Trial port called with the exact latest revision and digest. | ~200 src, ~250 test |
| U2 Trial runner, judge and promotion | Core | new `runtime/service/candidate-trial/{run,summary,feedback,index}.ts` and `tests/`; `runtime/flow-bootstrap/verification/detached-execution.ts` (also return the executed graph) and its test; `runtime/result-verification/run-outcome.ts` (export `readRecordSets`); `runtime/service/flow-bootstrap-commands/{candidate-generation,contracts,audit-event}.ts`; `runtime/service.ts` candidate branch (1552-1571) and graph-options sharing; optional `prepareCandidateStart` service option (D1) | Trial writes a `candidateTrial` session, stores rows under the trial run id, processes datasets, reads the end view. **Judge request holds only trial attempts, record sets and start/end views, never draft or exploration evidence** (assert on the captured request). **First yes plus second unknown or silent gives no adaptation.** **Instruction edited between trial and promotion: `FLOW_BOOTSTRAP_STALE`, draft kept, no adaptation.** **Authoritative draft digest differs from the trial digest: refused.** **Cancelled trial: no judge call, no promotion.** Two yeses give a proposed adaptation with `candidateTrial` audit detail; the existing apply-time stale test still holds. Absent start hook: receipt says `not_reset`. | ~400 src, ~450 test |
| U3 API result and chat commands | Core | `runtime/flow-bootstrap/authoring-result/{contracts,parse}.ts`; `api/handlers/llm-generation.ts` response; `runtime/conversations/commands/{build,create-here,explore,improve,execute}.ts` candidate branch; `runtime/service/flow-bootstrap-commands/generation-readiness.ts` capability flag | Candidate `proposed` is approved, applied and said "ready" as legacy. **A draft result never approves or applies, and says the trial verdict.** **Parser refuses a proposed result without a candidate trial block, and a draft that claims `promotionAllowed: true`.** Readiness reports the flag. | ~150 src, ~200 test |
| U4 Lab candidate lane | downstream | `packages/test-runner/src/flow-lane/creation/{readiness,lane,build-proposal,candidate-draft}.ts`, `creation/chat/build-from-chat.ts`, evidence/snapshot types, owning `creation/tests`, `creation/chat/tests`; with D1, `packages/test-runner/src/environment.ts` (Lab Core env) | **Readiness refuses candidate mode when Core lacks the capability (before provider).** **Draft outcome fails `runtime.behavior` with candidate id and verdicts.** Promoted outcome reaches reset, playback and oracle unchanged. Run evidence records mode, candidate and trials. Provider-free `lab:campaign ... --dry-run`. | ~200 src, ~250 test |

Then one bounded live probe on lane A in candidate mode, compared with a legacy run of the same task (Current State,
Next order step 3). Before the probe, check that the trial's step activity reaches the chat: wrap the trial in run
activity so the chat shows the test run.

## User decisions

- **D1. Fixture reset before each trial.** Without it, the second and later lane A trials start with exploration's or
  the previous trial's cart, because a normal-runtime trial really repeats the add. Recommended: an optional Core
  deployment hook (`prepareCandidateStart`: an authenticated POST to a deployment-trusted URL, whose result is recorded
  in the start receipt). The Lab sets it to its own reset when it boots Core; product leaves it unset. Alternatives:
  no hook, so trials accumulate and the judge must reason from start/end views; or the Lab triggers trials itself,
  which breaks the chat-started single command.
- **D2. Promotion guarantee.** Recommended: reuse the legacy create/approve/apply path, with its lock plus base-digest
  compare, which is not crash-atomic. Revisit in the October 29 - November 4 hardening window. The alternative is the
  parked transactional promoter (many units).
- **D3. Trials on real sites.** In product, each trial repeats lasting non-consequence acts such as add to cart on the
  person's real account. P2.7 says never to repeat purchases, posts or messages for test evidence. Steps with declared
  consequence classes already need permission. Choose whether product trials run, ask first, or stay Lab-only for the
  MVP.
- **D4. Acceptance authority.** The slice promotes on the LLM build judge's confirmed yes over trial evidence. It does
  not use Core-checked requirement predicates (the consultant's evidence-receipt contract), which need the parked
  requirement grammar and command receipts. The Lab oracle stays the independent check.

## Evidence (file:line)

**Q1: what the candidate model sees**
- Candidate tools: run_flow and the old submit are filtered out, and one submit tool is added, with its single-sentence
  description and input schema `{flow, plan, summary}`: `runtime/flow-bootstrap/candidate/authoring-loop.ts:13-21`.
  Completion schema `{revision, digest}`: `:22`. Latest-revision completion check: `:23-28`. Submit evidence
  `verification: "not_performed", promotionAllowed: false`: `:33`. Loop result `promotionAllowed: false`: `:38`.
- The same completion schema is sent on every decision: `runtime/service/flow-bootstrap-commands/candidate-generation.ts:58`.
- The format text and examples: `runtime/flow-bootstrap/plan/flow-script-format.ts:90-160` (no loop or `$row` line;
  the only examples are rename, narrow-then-read and two situations, `:122-159`). Its only production reference is the
  legacy completion schema description: `runtime/flow-bootstrap/plan/evidence-schema.ts:22,46-53`.
- Wire: an evidence decision sends catalog names plus described nodes, never the whole catalog:
  `runtime/llm/harness/context-packet.ts:237-256,323-336`; `runtime/llm/deepseek/request-body.ts:170-210,258-264`,
  with the catalog note at `:317`. Tool descriptions are in the request head: `request-body.ts:194-201`.
- System prose: `runtime/llm/deepseek/system-prompt.ts:62,70-80`. Decision instruction ("Never mutate merely to
  perform an eventual workflow step that belongs in the generated result"; the draft exception applies only when a
  `core.flow_draft` entry is shown): `runtime/llm/evidence-loop-decision.ts:71`. Domain prose channel:
  `system-prompt.ts:52-57`, `runtime/llm/domain-instructions/index.ts:1-11`.
- Per-node sources: `runtime/flow-bootstrap/plan/catalog.ts` (`buildAutomationStudioFlowBootstrapContext`, catalog
  entries with whole parameter text); `runtime/llm/node-tools/describe-nodes.ts:30-36`. Node ids the format names
  exist downstream (`web.dom.click`, `web.dom.type`, `web.dom.select`, `web.browser.navigate`, and others: grep over
  downstream `domain/src`).
- Legacy authored-draft grammar (not used in candidate mode): `runtime/flow-draft/entry.ts:89`.
- Loops exist only on the draft path: `runtime/flow-bootstrap/authoring/assemble-draft.ts:253,343` (`repeatSpans`).

**Q2: legacy test and the candidate run**
- Legacy test: the dry-run gate replays the draft through the loop's executor:
  `runtime/service.ts:1631` (`automationStudioFlowDraftDryRunGate`). The rule, start view, "its reset is a navigation,
  and a lasting step is only checked": `runtime/llm/node-tools/dry-run-gate.ts:15-63`. `core.run_flow` "nothing is
  reset first": `runtime/llm/node-tools/run-flow.ts:37-44`. It is offered only where the loop drafts: `run-flow.ts:9-11,91-93`.
- Legacy judge wiring: `runtime/service.ts:1582`. Rounds and phases: `:1583-1637`.
- Detached runner: `runtime/flow-bootstrap/verification/detached-execution.ts:13-84`. It revalidates without rewrite
  (`:50-53`), normalises (`:54-57`), routes (`:58-64`), checks ownership (`:66-68`), runs with no LLM, patch, retry or
  recovery (`:70-73`), and returns `commands: []` (`:38`). No production caller: intake A,
  `reports/intake-1007/product-path.md:107`.
- Graph options the trial must mirror: `runtime/service.ts:2544-2562` (effect dispatcher, native executor, host
  runtime, `onRecordBatch` at `:2561`, parking). Router path and `runCanonicalAutomationStudioFlow`: `:2595-2616`.
- `startRuntimeSession` accepts a projectId plus flowId with metadata: `runtime/service.ts:2396-2425`. Dataset hook:
  `runtime/service/datasets/run-datasets.ts:64-86`. Processing at run end: `:115-121`. The append insert reads
  `runtime_runs` for the run, and its comment says an unknown run aborts at the run_id guard:
  `storage/project/run-dataset-store.ts:178-186`.
- End-view reader: `runtime/service/end-view/run-reader.ts:17`. Its read wrapper:
  `runtime/result-verification/result-summary.ts:221-233`.
- Reachability holds the plan to `startLocation`: `runtime/llm/harness-options/bootstrap-completion.ts:231-239`. The
  candidate submission passes `startLocation`: `runtime/service.ts:1557`.
- Core's named start port: `runtime/flow-bootstrap/verification/contracts.ts:32-39,100`.
- Lab reset exists downstream and is used before playback: downstream
  `packages/test-runner/src/flow-lane/reset-scenario-lab.ts:8-20`, `flow-lane/creation/lane.ts:422-423`. Lab Core env:
  downstream `packages/test-runner/src/demo-workspace/core-process.ts:122-128` (`buildFluxIQEnvironment`).
- Lane A is a state-changing `form` task judged by playback goal: downstream
  `apps/scenario-lab/src/scenarios/crossborder-marketplace/live-tasks.ts:4,58-63`.

**Q3: judge**
- `automationStudioBuildTestJudge` takes `{summary: AutomationStudioRunResultSummary, budget}`:
  `runtime/result-verification/build-test/judge.ts:144-147,158`. Always `confirmAnswer: true`: `:194`. Yes only on a
  standing `answers`: `:220`. not_judged on purse, deadline or refusal: `:175-177,200-217`.
- t296 agreement: `runtime/result-verification/agreement.ts:45-47` (an unconfirmed lone yes is unsure), `:53-60`
  (unavailable, unknown or `no` confirmation is unsure).
- Two calls with `confirmAnswer`: `runtime/result-verification/verify.ts:154-170`.
- Summariser from a real run (record sets, flow shape with each step's changes, start view from session attempts, end
  view): `runtime/result-verification/result-summary.ts:109-201`. Its runtime use: `run-outcome.ts:478-530`. Private
  `readRecordSets`: `run-outcome.ts:597`.
- The legacy wrapper reads the exploration draft (`loop.steps`): `runtime/service/flow-bootstrap-commands/build-judge.ts:134-150`.
- Why not the predicate controller: interpretation-complete gate at `runtime/flow-bootstrap/verification/controller.ts:35`;
  `create` needs a performed command at `verification/predicates.ts:19,38-45`, while the runner returns `commands: []`
  (`detached-execution.ts:38`).

**Q4: promotion**
- Candidate branch today: `runtime/service.ts:1552-1571`. It returns `verification: "not_performed",
  promotionAllowed: false` at `:1570`.
- Generation stale check: `runtime/service.ts:1671-1675`. Legacy create: `:1679-1707`.
- `createFlowBootstrapAdaptation` base-digest check under the adaptation lock: `runtime/service.ts:1730-1735`. Plan
  validation: `:1738-1749`. Topology normalisation: `:1785-1792`.
- Review (approve checks the permission answer; apply): `runtime/service.ts:1808-1827`. Apply re-checks the digest:
  `:3432-3442`. Plan and topology equality: `:3443-3465`.
- Dependency digest scope: `runtime/service.ts:1319-1345`. Binding (`executionDigest`, `settingsRevision`): `:1446-1468`.
- Draft store accepts only `draft`/`not_performed`; authoritative read: `runtime/service/candidate-drafts/store.ts:23-37,65-71`.
- Draft persistence and its own stale check: `runtime/service/flow-bootstrap-commands/candidate-generation.ts:73-85`.
- Parsed API contract (exact fields, `promotionAllowed: false`): `runtime/flow-bootstrap/authoring-result/contracts.ts:2-8`,
  `parse.ts:5-11`. The chat build consumes it: `runtime/conversations/commands/build.ts:33-50`.
- Atomic promoter prerequisites (parked): `reports/p2-promotion-design.md` ("Result" and "Inspected current behavior").

**Q5: Lab**
- Unconditional hold: downstream `packages/test-runner/src/flow-lane/creation/readiness.ts:4-5`. It is called at
  `lane.ts:338`, `chat/build-from-chat.ts:92`, `build-proposal.ts:362` and `review-proposal.ts:26`.
- Draft outcome thrown as `facility.contract`: downstream `lane.ts:384`. Chat-applied proposal path: `lane.ts:393`.
  Reset, present and playback: `lane.ts:422-447`. Build request is fixed to `authoringMode: "candidate"`:
  `build-proposal.ts:77,382`. Draft mapping: `build-proposal.ts:395-398`.
- Generation readiness owner (capability flag goes here): `runtime/service.ts:1443-1444`.

## Commands run and observed results

- `git rev-parse --short HEAD` in both repositories gave downstream `1e9e9a2e` and Core `a2672def`. Core
  `git status --short` was empty.
- Source reads with `cat -n`, `sed -n`, `grep` and `wc -l` at the paths above, as quoted. No build, test, Lab run,
  provider call or panel action.

## Not verified

- That no recorded provider request shows the format (source-only, as in intake A).
- Whether the normal graph executor gates declared consequences in a trial without `permittedConsequences` in the
  graph options. `runRuntimeSession` does not set them on `graphOptions` in the lines read. U2 must confirm this before
  the probe.
- The exact `runtime_runs` guard line in `appendBatch`. Only the insert and its comment were read.
- That the executed (`candidate.<...>`) normalised ids differ from the promoted adaptation's ids. Normalisation takes
  the adaptationId. The verdict should bind the plan digest, never node ids.
- Whether a trial's steps emit chat activity without `withAutomationStudioRunActivity`.
- t338's final names for the authoring-mode setting and readiness change (designed against, not depended on).

## Open questions or contradictions found

- The plain-line script format cannot express loops (`$row`, repeat-while). Loops come only from the legacy draft
  assembler. Lane A is unaffected, but C (paging) and D likely need one. Either the format grows a loop grammar or the
  JSON plan route is taught. This needs a decision before candidate becomes the default.
- The consultant's binding contract says Core checks trusted predicates and a model `success:true` is not a fact. This
  slice's acceptance is a model judgement (D4). It is fail-closed (two yeses), but it is not the receipt contract.
- `AutomationStudioCandidateVerificationIdentity.requirementsDigest` has no producer outside the parked chain. U2
  should fill it with the candidate's `originalInstructionsDigest` only to satisfy the runner's identity equality, and
  say so in code.
