# Actual creation callers draft-only (t330)

## Current state

Implementation and approved browser-export/build-hygiene corrections are SOURCE FROZEN during final narrow checks. Initial optimized Next build failed43 server dependency errors; dedicated public browser export now bundles successfully. Fresh owning Core rebuild removed12 relocated orphan artifacts via the approved generator cleanup, not manual deletion. Final narrow validation passed, including optimized production web build; supervisor independent review/integration remains pending. No live browser/paid qualification claim. Provision19564 completed exit0/READY; setup builds are not validation. Pair base downstream8fef15bf/Coread3914cd. Read MAIN Current State/brief and integrated t328 review. Scoped source/test edits and narrow checks recorded below. No providers/panel/git/shared-document actions.

## Actual findings

- Core API already returns candidate envelope for authoringMode candidate and checks mode/status consistency. Existing generator owns draft identity/source instruction IDs/base dependency/settings/accounting; no new graph representation or acceptance authority needed.
- Panel authoring wrappers omit candidate flag and views expect proposed adaptation. Conversation create/explore automatically approve/apply; Improve asks to apply. Their prose still promises applied/ready steps. These all require draft-only request and truthful pending result.
- Conversation execute.ts projects only flow/run/adaptation IDs; background automation turn has attachment kind/ref only. Candidate metadata needs additive projection; avoid changing conversation schema. Proposed separate candidate-draft attachment references draft ID alongside existing capability-result turn, with pending visible text, no action/confirmation.
- Direct Lab timeout polls legacy proposed adaptations. Candidate timeout must instead be pending/unknown spend; no legacy poll, no implication of no provider invocation or charge.
- runCreatedFlowLane alone is insufficient readiness coverage: exported buildCreatedFlowFromChat is also called by extension-chat-check/prove/chat-build.ts. Proposed static owning readiness refusal at lane plus both lower public direct/chat helpers before instruction/auth/chat/provider work. No caller boolean/env/model override. Existing provider-free chat-build probe must honestly report unsupported readiness rather than claim it made a Flow.

## Reviewed closed contracts

Shared program authoring-result module validates/picks the existing generator draft shape: status draft, projectId, flowId, candidateId, positive safe revision, 64 lower-case hex digest, sourceInstructionIds, baseDependencyDigest, nonnegative safe baseSettingsRevision, verification not_performed, promotionAllowed false. Accounted spend stays separate from promotion authority. Candidate consumers refuse legacy adaptation-shaped success. Plain structural generation/raw API legacy remain explicit; evidence-guided website Explore/Improve/chat request candidate.

Chat successful build returns ok:true/status:draft/candidate; failed preserves cause/ending/kept/cancel/permission paths. Command done means successful authoring only; no fabricated adaptationId, approve/apply, accepted write or apply confirmation. UI stores draft result and shows verification pending with reference/revision, no adaptation open action. Background outcome text and candidate attachment carry truthful draft reference.

Lab implementation is statically unready until trusted executor/start/oracle/original-project promotion joins exist. Refusal uses named structured code before any authorizer/chat send/provider. Guard cannot be enabled by incoming JSON. Provider-free response parser tests can exercise draft and timeout shapes without invoking a paid build helper. Do not relabel a skipped/unavailable live probe as passed created-Flow qualification.

## Reviewed additional owners

Core: runtime/flow-bootstrap/authoring-result/{contracts,parse,index}.ts + tests/parse.test.ts and additive candidate/index.ts reexport ../authoring-result/index.ts public barrel; conversations/commands/execute.ts. Existing brief owns authoring commands/models/hosts/views, conversation capability flows catalog and commands build/apply/create-here/explore/improve/command/tests. Background additive attachment seam approved; no conversation storage schema change.

Downstream: flow-lane/creation/readiness.ts + tests/readiness.test.ts; candidate-draft.ts + tests/candidate-draft.test.ts; additive creation/index.ts; extension-chat-check/prove/chat-build.ts and its nearest owning test (discover before assigning); existing-fluxiq-control.ts only if typed request signature requires synchronization. Existing brief owns creation build-proposal/lane/review-proposal/chat build-from-chat and owning tests. Source released within these exact owners.

## Validation

Read-only source discovery only. Missing paths caused by one Core-relative read from downstream cwd corrected; no conclusions use its failed output. Actual behavioral fail-first and narrow compilation/tests now run; no live browser/provider checks. Next: owning behavioral fail-first cases then scoped implementation. Existing sanitized wire uses bare64hex candidate digest (not sha256-prefix); parser follows that actual format.

## Behavioral fail-first and retired legacy invocation contract

Actual provision-built direct helper with a throwing control reached save instruction before readiness (calls1, effect-entry-reached). Required calls0. This is behavioral evidence; the prior node -e quoting syntax failure was harness only. Core valid candidate regression failed ok:false before change; the new path passes its focused test.

The following prior guarded-entry test titles are preserved as historical contract evidence, not current qualification coverage:

tests/build-proposal.test.ts (26 former cases):

- test("proposed and refused builds both preserve the screened call-time refusal account", async () => {
- test("the build saves the instruction, then authorizes, selects the context and explores, as the web panel does", async () => {
- test("a proposed build keeps the decisions Core published on the proposal, in the shape a refused build's carry", async () => {
- test("proposed and refused builds publish the same content-free draft progress row", async () => {
- test("a decision row carries every member Core published on it, and leaves behind anything that could be page content", async () => {
- test("the tools a build called include Core's own node runner, and never its decision names", async () => {
- test("an instruction Core did not activate refuses before the Flow is readied for the model", async () => {
- test("a refusal is read through Core's diagnostic parser, keeping its code, stage, counts and only well-formed tool ids", async () => {
- test("an unnamed provider throw publishes its class and codes, never its message", async () => {
- test("a build that ran out and kept its draft says which revision it kept and how many steps", async () => {
- test("a build Core stopped to ask a person is a permission request naming the missing classes, not an HTTP failure", async () => {
- test("a build stopped on refused plans keeps what refused them, decision by decision, and no tool list of Core's own steps", async () => {
- test("a refusal Core's parser does not accept keeps only its HTTP status, and a malformed success is a refusal too", async () => {
- test("a build that outlives its request is found by polling for its proposal, within the build's deadline and no longer", async () => {
- test("the build request is held open, as a long request, until the build's own deadline", async () => {
- test("a build that fails after the ordinary request cap is recorded with Core's own diagnostic", async () => {
- test("a build request that times out at the deadline still looks once for a proposal", async () => {
- test("a transport failure that is not a bounded wait is not mistaken for a build still running", async () => {
- test("a proposal that cannot be shown to be what was paid for is a failed build, not a Flow", async () => {
- test("a proposal that still carries an unanswered question is a permission request, not a build to be reviewed", async () => {
- test("a build's declarations and Core's cross-check are read from where Core puts them, so a Flow's steps can be read rather than deduced", async () => {
- test("a build's reported calls are every call it made, with the loop's own beside them", async () => {
- test("the build tells Core where the Flow starts, when the run named a start location", async () => {
- test("a proposed build carries the judged yes Core recorded on its proposal, with a yes's advice as unconfirmed and never its words", async () => {
- test("every judgedAt Core writes is read, with no confidence or advice where Core recorded none", async () => {
- test("a judged yes not in Core's shape is no record, and a refused build has none", async () => {

tests/lane.test.ts (33 former cases):

- test("a dataset task is built, settled, applied, run on a freshly presented page, and passes on the records it stored", async () => {
- test("a dataset task whose Flow stored the wrong records fails, after publishing what it measured", async () => {
- test("a dataset task whose Flow has no extract node fails as exactly that", async () => {
- test("a navigate-and-extract Flow that holds no navigation node fails on that, ahead of what its records said", async () => {
- test("a goal task is judged by the fixture oracle, and fails when the goal did not hold", async () => {
- test("a goal task whose goal did not hold names each fact that did not, with its expected and observed value", async () => {
- test("a refused build is settled, then fails the run with Core's code, and nothing is applied", async () => {
- test("a build that stopped to ask a person reports permission.required with the missing classes, and nothing is applied", async () => {
- test("a settlement that refuses -- no provider reached, or a budget breached -- stops the lane before anything is applied", async () => {
- test("a created Flow's secret request is answered by the declared secret, and one that does not pair fails before the run", async () => {
- test("the lane refuses what it cannot build or run honestly, before the step it would corrupt", async () => {
- test("a created Flow's playback runs with the intent it was given, and its spend is settled before anything is judged", async () => {
- test("a repair run that throws is still settled, and an overspend outranks the run's own failure", async () => {
- test("a build that proposed no Flow is written down with what the lane knew, and still fails the run", async () => {
- test("an incomplete snapshot says how the build was started, as the complete one does", async () => {
- test("a settlement that refuses after the build still carries the build, and a failure after the publish leaves the complete snapshot alone", async () => {
- test("a dataset task whose records are right but whose declared final state did not hold fails, naming the final state", async () => {
- test("a dataset task that fails both oracles names both, keeping the records' own account", async () => {
- test("a dataset task whose workflow declares no final state is judged by its records alone, and the page oracle is not asked", async () => {
- test("a build that stops to ask at the task's declared permission point is the pass: nothing is applied or run, and the stop is written down", async () => {
- test("a build that stops to ask about another control than the declared one fails, saying why it is not the declared stop", async () => {
- test("a task that says to ask first fails when FluxIQ builds a Flow without asking, and nothing is applied", async () => {
- test("a task that says to ask first passes on the stop at its point", async () => {
- test("a consequential task whose build proposed a Flow with nobody allowing the act at its point fails as not asked, before anything is applied", async () => {
- test("a consequential task whose build was allowed its act at the point is applied, run and judged", async () => {
- test("a task whose act the operator permitted had nothing to ask, so no grant is required", async () => {
- test("a build started from the extension's chat runs and is judged like any other, and the lane builds and reviews nothing itself", async () => {
- test("a build that left no proposal keeps the instructed consequences its settlement read, and where they came from", async () => {
- test("a chat build, and a direct build that proposed a Flow, are judged and published on the build their settlement answered with", async () => {
- test("a settlement that throws still hands the lane the build it filled from the step log, and the error is unchanged", async () => {
- test("created-lane snapshots preserve terminal evidence without copying Core's trace message", async () => {
- test("a created chat build publishes FluxIQ's ending words and the judged yes it finished on, in flow-lane.json's build", async () => {
- test("a chat build whose settlement refused keeps FluxIQ's ending words on the incomplete flow-lane.json", async () => {

chat/tests/build-from-chat.test.ts (10 former cases):

- test("a job typed into the chat becomes the Flow the chat built and applied, read off its proposal", async () => {
- test("an answer in words with nothing built is a failed build of no Flow, carrying what FluxIQ said", async () => {
- test("a message the chat ran as something else is named as that capability", async () => {
- test("a build that ended without a proposal is a failed build of the Flow it made, with FluxIQ's account of how far it got", async () => {
- test("FluxIQ's ending is carried whole, however long, so the record says why in all its words", async () => {
- test("a build that finished still waiting on a question is the permission ending, never applied", async () => {
- test("a build whose result never arrives is recorded as unfinished once its deadline passes", async () => {
- test("a message the chat never carried to FluxIQ fails the stage with what the chat showed", async () => {
- test("a failed build's spend is read from what Core kept of it, and the failure stays the chat's", async () => {
- test("FluxIQ's ending words are on the chat record on every ending, created or not", async () => {

Core obsolete automatic-apply invocation contracts replaced in execute.test.ts:

-   it("creates a Flow here in the background: create, save, explore from the page, approve and apply", async () => {
-   it("names a page served from this machine as the page the person had open, never its address", async () => {
-   it("says how far a build got in the site's name, never its address", async () => {
-   it("passes what reading the message cost to the build it runs", async () => {
-   it("improves a Flow, then asks before applying, and a yes applies exactly that change", async () => {
-   it("explores onto a blank Flow and applies, and says so when the Flow is not blank", async () => {

Core obsolete automatic-apply invocation contracts replaced in extension-chat.test.ts:

-   it("creates an automation from the page the person is on, builds it by exploring, and puts the steps into it", async () => {
-   it("builds from a job the person only described, taking their message as what the automation should do", async () => {
-   it("explores and builds a blank automation it is told about, and applies it", async () => {
-   it("continues a kept creation through the real explore registry command without adding an instruction or another Flow", async () => {
-   it("improves an automation, asks before applying, sets the change aside on no and applies it on yes", async () => {

## Measured implementation progress

- Core direct candidate regression originally failed1/5: valid candidate was marked authoring failure; candidate request flag absent. After change initial5/5 passed.
- Core owning command+parser directories66/66 passed (8files,28.56s): actual registry-backed chat creation and repeated Explore preserve original instructions/same Flow, empty accepted nodes/router/no adaptation, no judge calls, no apply/confirmation. Local/remote URL masking, successful authoring carry interpretationCostUsd, failed progress, permission/keylocked and ordinary run remain covered. This is synthetic provider/evidence infrastructure with real Core registry/service, not browser/paid proof.
- Shared parser15/15: original subject/exact optional reference mismatch, authority-shaped/malformed payload, legacy/ambiguous envelope, getter/symbol rejection, copied/frozen source references/accounting. Actual wire uses bare64hex digest; accounting remains information, never authority.
- Core nonincremental types0 twice; owning fluxiq build0 (63.984s,6106 outputs) occurred before subsequent comment cleanup/structural relocation, so final regeneration still required.
- Web typecheck0 before final wrapper validation; first owning React test50cases had2 stale apply expectations; second49/50 had1 remaining stale callback assertion. The newly added pending/no-action cases pass. Final rerun pending. These use react-test-renderer (deprecated warning), not actual browser/Next.
- Runner direct nonincremental emit types0 after adding required candidate-mode transport fixture. Actual emitted narrow bundle34/34 passed0skips (4.107s): lane/direct/chat refuse before control/authorize/send, standalone provider-free chat-build probe is unavailable with not_attempted, candidate adapter binding and preserved diagnostic/accounting/HTTP/auth/cancel tests. No actual paid helper work.
- Core structure audit correctly failed3 new depth violations at candidate/authoring-result. Requested relocation one level up to flow-bootstrap/authoring-result, no baseline exception. Final audit pending approved move. No other new violation reported.
- Harness-only failures: one node -e PowerShell quoting error, an intermediate malformed type replacement corrected, and one attempted Core test text edit from downstream cwd (failed, then corrected). These are not behavioral evidence or passing source checks.

## Compatibility and limits

Website panel/Improve/chat wrappers request candidate plus evidenceGuided true. Shared parser validates the API candidate envelope against original project/Flow; old adaptation-shaped success is rejected. UI pending state holds candidate reference/revision, masks stale Flow/project completions and offers no apply action. Chat done means draft authored; background capability result plus candidate-draft ID-only attachment is persisted without turn-schema changes or renderer/action. Original instructions and purse/cancel/session/permission plumbing remain untouched. The raw plain structural generation wrapper/API remains explicit legacy scope; this unit does not claim its model-produced proposals are semantically accepted.

Lab readiness is static unavailable before lane/direct/chat helper IO/auth/provider entry. No caller/env boolean can bypass it. The lower direct helper carries candidate response/unknown timeout accounting and no legacy proposal polling. Chat can record only an observed ID reference/pending, never fabricate revision/digest/readback/charge. Existing provider-free chat-build stage now reports unavailable, not old made-flow proof. The transport client is low-level raw control, not qualification authority. No verifier, execution tickets, accepted-state activation or promoter is enabled. No actual browser/Next/panel, paid provider, fixture execution/oracle, concurrency/crash or final-pair qualification. Root must independently verify before integration.


Readiness diagnostic clarification from root: the blocked entry reports providerInvocation `not_attempted_by_this_entry`, priorProviderCost `unknown`. It cannot prove any proposal's earlier authoring was free, settle prior provider cost, or authorize retry. Public apply may receive a prior paid proposal; zero calls refer strictly to this refused helper invocation. Standalone provider-free chat-build probe's build record `not_attempted` describes only that probe, which sends nothing.

## Final checks and reopened production-build failure

After the approved relocation, Core nonincremental types and structure audit passed (279 warnings, 349 baseline); owning Core build passed (51.172s, 6118 outputs). Web nonincremental types passed. Actual owning React command `pnpm.cmd --filter @fluxiq/web exec vitest run src/features/automation-studio/authoring/tests/blank-flow-authoring.test.tsx src/features/automation-studio/authoring/tests/improve-flow.test.tsx` passed 50/50, two files, 50.72s, zero skips. This is unit React evidence only. Runner final nonincremental emit and structure audit passed (174 warnings,117 baseline). Actual emitted command `node --test packages/test-runner/dist/flow-lane/creation/tests/*.test.js packages/test-runner/dist/flow-lane/creation/chat/tests/*.test.js packages/test-runner/dist/extension-chat-check/prove/tests/chat-build.test.js packages/test-runner/dist/tests/existing-fluxiq-control.test.js` passed 92/92, zero skips, 14.370s.

The required actual `pnpm.cmd --filter @fluxiq/web build` FAILED exit1: Next15.5.24 optimized compilation reported43 Node/server import failures in the client dependency graph. Importing the pure authoring-result parser from the broad automation-studio barrel pulled server storage/runtime dependencies into browser code. Earlier types/React checks do not establish product compilation. No panel/server was started and no provider invoked. Root reopened only the browser-safe public-export correction; exact source alias and public-entry regression owners were requested before further edits. Source is not finally qualified/frozen at this reopened point.

Root also found12 orphan generated files at the old candidate/authoring-result dist path after relocation. TypeScript clean knows only current project outputs; the fresh build retained and stamped the old files. Existing cache restore removes extras relative to cached inventory but does not fix a polluted inventory created by a fresh compile. This is a separate build-hygiene defect, not fresh artifact closure; no generated output was manually removed. Proposed owning clean-script regeneration and cache command invalidation are awaiting scope assignment.

### Root-approved compile and regeneration correction

Root approved additive browser-safe package export `fluxiq/automation-studio/candidate-authoring` to the actual authoring-result dist index; exact root tsconfig alias; authoring-commands and both owned panels import the dedicated entry. Next configuration remains unchanged. New owning browser-export.test.ts bundles the actual compiled public entry with esbuild platform browser and requires only the pure parser's compiled module graph. This is compile evidence, not live browser.

Root also approved sequential owning build hygiene in t330: new scripts/clean-library-output.mjs and scripts/tests/clean-library-output.test.mjs; fluxiq package build and scripts/build-cache/steps.mjs synchronized with its command prefix; registry owning test. Contracts command/scope unchanged. Fixed generated targets are only packages/fluxiq/dist and tsconfig.build.tsbuildinfo; all real parent/owner paths and expected package/build config plus all output children are validated before deletion, with symlink/junction/foreign owner/type refusal. The executable helper is fingerprinted by the existing command resolver; changed command/package/config invalidate polluted cached builds. No generated output hand deletion.

Actual behavioral fail-first reran existing owning TypeScript clean, then expected orphan output closure: failed with12 remaining old-path generated files. Cleanup/registry owning tests passed14/14, zero skips,0.702s; includes old nested output removal, source/unrelated-package preservation, absent outputs, redirected owner/output/nested junction refusal, unexpected owner/buildinfo refusal and exact helper fingerprint/unchanged contracts scope. Fresh owning Core build now running with source held; subsequent compile/UI/runner/type/audit results remain pending.

Current frozen corrections: owning Core rebuild0,38.775s,6106 outputs; generated old nested path absent after owning regeneration. Core audit0,279 warnings/349 baseline. Current Core command/parser/browser-entry bundle passed67/67 across9 files,31.10s. The browser entry check disables tsconfig aliases so it tests actual compiled package exports and rejects any dependency outside the pure authoring-result dist graph. Current owning React rerun passed50/50,26.65s, two files, zero skips; deprecated renderer warnings remain. Actual optimized web build and nonincremental Core/runner types still pending.

Final current runner owning emitted bundle passed92/92, zero skips,10.899s against the freshly regenerated Core. Runner nonincremental emit0; Core nonincremental types0. Downstream audit0 unchanged174 warnings/117 baseline. Optimized Next compile now succeeded70s and internal type checking/static generation17/17 succeeded; full build exit/cache stamp still awaited, so compile alone is not reported as completed product build. No live panel/browser/paid provider proof.

## Final frozen return

All source/test corrections FROZEN; no running worker checks. Final actual `pnpm.cmd --filter @fluxiq/web build` exit0,146.792s,2383 files, with optimized compile/internal types/17 static pages/traces complete. Fresh `pnpm.cmd --filter @fluxiq/web exec tsc -p tsconfig.json --noEmit --incremental false` exit0. Explicit old nested generated path absence assertion passed after the owning clean/build regeneration. Earlier43-error Next build remains real fail-first evidence; it is repaired, not erased.

Final independent-repeat commands from the paired Core root:

- `node --test scripts/tests/clean-library-output.test.mjs scripts/build-cache/tests/registry.test.mjs` ?14/14, zero skips.
- `pnpm.cmd --filter fluxiq build` ?0, 6106 files/38.775s after correction.
- `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/authoring-result/tests src/programs/automation-studio/runtime/conversations/commands/tests` ?67/67,9 files/31.10s, zero skips.
- `pnpm.cmd --filter @fluxiq/web exec vitest run src/features/automation-studio/authoring/tests/blank-flow-authoring.test.tsx src/features/automation-studio/authoring/tests/improve-flow.test.tsx` ?50/50,2 files/26.65s, zero skips.
- `pnpm.cmd --filter fluxiq exec tsc -p tsconfig.json --noEmit --incremental false`; `pnpm.cmd --filter @fluxiq/web exec tsc -p tsconfig.json --noEmit --incremental false` ?both0.
- `pnpm.cmd --filter @fluxiq/web build` ?0,146.792s. Build only; no panel/server launch.
- `node scripts/structure-audit.mjs` ?0,279 warnings/349 baseline.

From paired downstream root:

- `pnpm.cmd --filter @fluxiq-web-extension/test-runner exec tsc -p tsconfig.json --incremental false` ?0.
- `node --test packages/test-runner/dist/flow-lane/creation/tests/*.test.js packages/test-runner/dist/flow-lane/creation/chat/tests/*.test.js packages/test-runner/dist/extension-chat-check/prove/tests/chat-build.test.js packages/test-runner/dist/tests/existing-fluxiq-control.test.js` ?92/92,zero skips/10.899s.
- `node scripts/structure-audit.mjs` ?0,174 warnings/117 baseline.

Corrective final source owners are Core packages/fluxiq/package.json, tsconfig.base.json, the three already-owned authoring UI imports, new flow-bootstrap/authoring-result/tests/browser-export.test.ts, scripts/clean-library-output.mjs, scripts/tests/clean-library-output.test.mjs, scripts/build-cache/steps.mjs and its existing registry.test.mjs. Pure parser remains at flow-bootstrap/authoring-result/{contracts,parse,index}.ts with candidate/index.ts additive reexport. Next config unchanged; server/chat broad imports remain their existing server-compatible scope. Tests/config parse exact public package export, not source-only alias.

This unit makes actual authoring callers draft-only and qualified Lab entry points unavailable before this entry dispatches. It does not implement semantic verification/acceptance, command admission/executor/all-writer joins, server authority activation, actual live browser/production Next process, private oracle execution, paid provider behavior, crash/concurrency, or complete MVP qualification. Accounting retains earlier work unknown where appropriate. Root alone reviews/integrates/commits/pushes; worker made no git mutations/shared doc edits.
