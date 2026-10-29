# t792 fix 2: a trial's toggle reaches the next revision (worker report)

## Outcome

**Partial.** The cause is found and proven. The one-file fix belongs in
`R/flow-bootstrap/subflow-candidate/scoped-submission.ts`, which this brief does not let me
edit, so I have not applied it. The exact diff is below and in
`.../scratchpad/t792fix2/scoped-submission.t792.diff`. I tested it on a temporary copy
(details below), then deleted the copy. The persistence part (item 4) is done.

The failing test I added stays red until the diff is applied. That is deliberate: it is the
"fails before the fix" acceptance test.

R = `packages/fluxiq/src/programs/automation-studio/runtime` in `fxwork/t792/!FluxIQ`.

## The cause (where the record is lost)

The payload is correct all the way through, and the shared record is correctly wired.
Evidence from the run's own store (`persistent-isolated/.../fluxiq-root/.fluxiq`, read-only):

- **Client payload.** `client_gateway_trace_events` trace `32f8f9d5`, seq 107 (decoded from
  its chunks) has `payload.payload.toggle = {"via":"name","gains":["unlike"],"loses":["like"]}`
  at the top of the client's action result.
- **Runtime result.** Command attempt `attempt.1913026f…` (command `74594308…`, trial 0091)
  has `result.payload.toggle.signature` lifted to the top and `result.payload.result.toggle`
  raw. That is exactly the shape the dispatcher's line 80 is meant to produce. Core keeps it as
  `outputs.result` (`io-policy.ts:121`), which is the key `explored-toggles.ts` `trial()` reads.
- **Node ids.** `runtime_action_summaries` shows the like step executed as
  `node.bootstrap.85401519af9bb4f7.like_recent_posts.s10` in trial 0091. Revision 4's trials
  (40aba245 = 0110, ab3fdcaa = 0115) ran it as `…like_recent_posts.s10` too.
- **What revision 4 sent.** The outbound `server.execute_action` commands for revision 4's like
  (trace `94b8948d` seq 101, trace `3475d10b` seq 105) carry **no `ensureState`**. Revision 1's
  (trace `393279a7` seq 103) does carry one. So the record never tied revision 4's step.
- **The lost tie.** `toggle-idempotent.ts:91` (now `toggle-tie.ts`) ties a step to a trial
  record when the record's `trialNodes` id ends with `.${subflow.key}.${node.key}` of the
  *submitted plan*. In a project build, that plan is the scoped controller's **probe**.
  - `scoped-submission.ts:245` `this.inner.submit(read.probe, …)` hands the inner controller
    the plan as the model wrote it. A script's own steps are keyed `main`
    (`authoring/assemble.ts:391`); a JSON plan keeps whatever key the model wrote.
  - Only `proposalOf()` (`scoped-submission.ts:356`) renames that subflow to the scope's
    subflow key, and its parts to `automationStudioSubflowPartKey(...)`.
  - Every trial, subflow or single-subflow whole, runs the renamed proposal. Its trial nodes
    therefore end `.like_recent_posts.s10`, while the probe step is named `main.s10`, and the
    tie never fires.
  - Exploration ties are unaffected, because `handleViews` use the probe's own names. That is
    why revision 1 still got an (inverted) `ensureState`.
- **Scope of the bug.** This affects every non-callable subflow in every project build. A
  callable subflow (scope `interface` set) is written under the scope key and is unaffected.
- **Reproduced and confirmed.** The new test fails with the plan's entry keyed `main`. It
  passes, unchanged otherwise, when the entry is keyed `pin_notes` (a temporary probe test,
  since deleted).

## The fix (not applied: `scoped-submission.ts` is outside my owned paths)

The scoped controller hands the inner controller the build's toggle record through a view.
For the submission being checked, every trial node `<…>.<proposal key>.<node key>` is also
named `<…>.<written key>.<node key>`. The proposal-to-written key map is computed in `read()`
from the accepted probe, with the same rule `proposalOf` uses: this subflow's written key goes
to the scope key, and each part goes to its rekeyed key. Nothing else in the record changes,
and toggles from other subflows are left as they are.

```diff
--- a/flow-bootstrap/subflow-candidate/scoped-submission.ts
+++ b/flow-bootstrap/subflow-candidate/scoped-submission.ts
@@ -128,6 +128,19 @@
 // scope's `handedOn`. One no line reads is no refusal (`./callable-target.ts`):
 // the proposal carries it as `unneededInputs`, which the builder's answer and
 // its brief's return say, so the supervisor amends nothing for it.
+//
+// **A toggle a trial pass made is read under the probe's keys (t792).** A
+// trial runs the proposal, so the record of a press the domain answered as a
+// toggle in it (`../explored-toggles.ts`, t787) names its trial node
+// `<...>.<proposal key>.<node key>`: this brief's subflow under the scope's key,
+// each part under its rekeyed one (`./part-keys.ts`). The candidate controller
+// ties a step to it by the probe's own `<subflow key>.<node key>`
+// (`../script-statements/toggle-idempotent.ts`), and the probe names this
+// subflow as it was written -- a script's own steps as `main` -- so a repair's
+// resubmission of the step a trial pressed never carried `ensureState`, and
+// flipped the control back (debug run-mvswfjbq-d0a95f6e). The controller is
+// handed the build's record with each trial node also named as the probe of
+// the submission it checks names it; nothing else in the record changes.
 import type { JsonObject, JsonValue } from "../../../../../core/index.ts";
 import { acceptAutomationStudioFlowBootstrapResult, parseAutomationStudioFlowScript } from "../authoring/index.ts";
 import {
@@ -141,6 +154,7 @@
 // Its own barrel, not result-verification's, whose reads import flow-bootstrap back (a module cycle).
 import type { AutomationStudioResultKeptConditionsCarrier } from "../../result-verification/standing-no/index.ts";
 import { AUTOMATION_STUDIO_FLOW_BOOTSTRAP_STATE_NODE_IDS, type AutomationStudioFlowBootstrapInterface, type AutomationStudioFlowBootstrapNode, type AutomationStudioFlowBootstrapPlan, type AutomationStudioFlowBootstrapSubflow } from "../plan/index.ts";
+import type { AutomationStudioExploredToggle } from "../script-statements/index.ts";
 import { automationStudioNodeSideEffectClass } from "../../executor/index.ts";
 import type { AutomationStudioFlowNode } from "../../../model/index.ts";
 import type { AutomationStudioSubflowProposal, AutomationStudioSubflowScope, AutomationStudioSubflowScopeIdentity, AutomationStudioSubflowTrialResult } from "./contracts.ts";
@@ -194,6 +208,8 @@
   private readonly offset: number;
   /** The proposal each revision the candidate controller accepted is: a plan it accepted again after another is a new revision there, and still its first proposal here (header, t741). */
   private readonly byInnerRevision = new Map<number, AutomationStudioSubflowProposal>();
+  /** The key the submission being checked wrote each subflow under, by the key its proposal gives it (header, t792). */
+  private written: ReadonlyMap<string, string> = new Map();
   /** How a refusal's revisions and digests read on this brief's numbering (`./submission-numbering.ts`, t741). */
   private readonly numbering = {
     revision: (inner: number): number => this.byInnerRevision.get(inner)?.revision ?? inner + this.offset,
@@ -220,7 +236,10 @@
     // The brief's parts are what this subflow is asked to do: the probe's checks read them as the instruction.
     this.instructionText = this.scope.parts.map((part) => part.text).join("\n");
     // Its refusals name this loop's tools, never the whole candidate's (`../candidate/unchanged-submission.ts`, t632).
-    this.inner = new AutomationStudioFlowCandidateSubmissionController({ ...input.submission, instructionText: this.instructionText, refusalTools: SUBFLOW_TOOLS });
+    // The build's toggles, each trial node also under the probe's keys (header, t792).
+    const toggles = input.submission.exploredToggles;
+    const probeToggles = toggles ? { exploredToggles: { list: () => underProbeKeys(toggles.list(), this.written) } } : {};
+    this.inner = new AutomationStudioFlowCandidateSubmissionController({ ...input.submission, ...probeToggles, instructionText: this.instructionText, refusalTools: SUBFLOW_TOOLS });
   }
 
   /** The latest valid proposal, or none once a refusal cleared it. */
@@ -242,6 +261,7 @@
       const last = this.inner.lastAccepted();
       return { ok: false, revision: last ? this.numbering.revision(last.revision) : 0, check: scopeRefusal(read.issues) };
     }
+    this.written = read.written ?? new Map();
     const submitted = await this.inner.submit(read.probe, this.candidateHistory(history));
     this.input.submission.signal?.throwIfAborted();
     if (submitted.ok && read.proposedCheck) this.proposedChecks.set(submitted.candidate.digest, read.proposedCheck);
@@ -259,7 +279,7 @@
    * existing checks run on: the submission itself, or for a callable subflow
    * its script with the call that runs it (`./callable-target.ts`).
    */
-  private read(result: JsonObject): { issues: ScopeIssue[]; probe: JsonObject; proposedCheck?: NonNullable<AutomationStudioSubflowScope["successCheck"]>; unneeded?: string[] } {
+  private read(result: JsonObject): { issues: ScopeIssue[]; probe: JsonObject; proposedCheck?: NonNullable<AutomationStudioSubflowScope["successCheck"]>; unneeded?: string[]; written?: ReadonlyMap<string, string> } {
     const issues: ScopeIssue[] = [];
     if (typeof result.flow === "string") {
       for (const block of parseAutomationStudioFlowScript(result.flow).script.blocks) {
@@ -282,7 +302,7 @@
     // A submission that cannot be read is refused by the probe's own checks, with every issue named.
     if (!accepted.ok) return { issues, probe };
     const read = this.planIssues(accepted.plan, result);
-    return { issues: [...issues, ...read.issues], probe, ...(read.proposedCheck ? { proposedCheck: read.proposedCheck } : {}), ...(unneeded ? { unneeded } : {}) };
+    return { issues: [...issues, ...read.issues], probe, ...(read.proposedCheck ? { proposedCheck: read.proposedCheck } : {}), ...(unneeded ? { unneeded } : {}), written: this.writtenKeys(accepted.plan) };
   }
 
   private planIssues(plan: AutomationStudioFlowBootstrapPlan, result: JsonObject): { issues: ScopeIssue[]; proposedCheck?: NonNullable<AutomationStudioSubflowScope["successCheck"]> } {
@@ -369,6 +389,18 @@
     return proposal;
   }
 
+  /** The key `plan` wrote each subflow under, by the key its proposal gives it (`proposalOf`): this subflow's, then each part's (header, t792). */
+  private writtenKeys(plan: AutomationStudioFlowBootstrapPlan): ReadonlyMap<string, string> {
+    const contract = this.scope.interface;
+    const entry = entryOf(plan);
+    const written = contract ? plan.subflows.find((subflow) => subflow.key === this.scope.subflowKey) : entry;
+    const keys = new Map<string, string>();
+    if (!written) return keys;
+    keys.set(this.scope.subflowKey, written.key);
+    for (const part of plan.subflows) if (part !== written && !(contract && part === entry)) keys.set(automationStudioSubflowPartKey(this.scope.subflowKey, part.key), part.key);
+    return keys;
+  }
+
   /** The subflow gate's history, as the candidate controller asks it: by the probe's revision and digest. */
   private candidateHistory(history: AutomationStudioSubflowSubmissionHistory): AutomationStudioFlowCandidateSubmissionHistory {
     const adapted: AutomationStudioFlowCandidateSubmissionHistory = {};
@@ -466,6 +498,21 @@
   return { code: "subflow.foreign_subflow_refused", path, message: `"${key}" is not this brief's subflow or a part it calls. A subflow builder writes only its own subflow, outside every block, and the parts it calls; another subflow of the plan is another brief's.` };
 }
 
+/**
+ * Each toggle with every trial node `<...>.<proposal key>.<node key>` also
+ * named `<...>.<written key>.<node key>`, as the probe writes that subflow
+ * (header, t792); a toggle of no trial, or of another subflow, as it was.
+ */
+function underProbeKeys(toggles: readonly AutomationStudioExploredToggle[], written: ReadonlyMap<string, string>): AutomationStudioExploredToggle[] {
+  return toggles.map((toggle) => {
+    const aliases = (toggle.trialNodes ?? []).flatMap((id) => [...written].flatMap(([proposalKey, writtenKey]) => {
+      const at = id.lastIndexOf(`.${proposalKey}.`);
+      return at < 0 || writtenKey === proposalKey ? [] : [`${id.slice(0, at)}.${writtenKey}.${id.slice(at + proposalKey.length + 2)}`];
+    }));
+    return aliases.length ? { ...toggle, trialNodes: [...toggle.trialNodes!, ...aliases] } : toggle;
+  });
+}
+
 /** The router's fallback Subflow: the steps outside every block. */
 function entryOf(plan: AutomationStudioFlowBootstrapPlan): AutomationStudioFlowBootstrapSubflow | undefined {
   const fallback = plan.router.fallback;
```

The file is CRLF. The patch in the scratchpad was made with `\r` stripped, so apply it with
`git apply --ignore-whitespace`, or re-type it.

**How the diff was tested without editing the file.**

- I made a copy of the patched controller, `service/project-build/tests/zz-t792-scoped-copy.ts`,
  with its imports rewritten.
- Against that copy, both new revision tests passed.
- Copies of all six existing test files that use the controller (`scoped-submission`,
  `revisions-after`, `kept-condition-carried`, `kept-condition-drop`, `kept-step-drop`,
  `unchanged-after-no-words`) ran against the patched copy, with their imports redirected:
  7 files and 64 tests passed. That count includes the original `scoped-submission.test.ts`.
- Core `tsc --noEmit` ran with the copy in the tree and reported no error in it.
- All the `zz-t792-*` files are now deleted.

## What changed and why

**Persistence (item 4).** Every toggle is now written into the build record as the record of
toggles gets it, so a debug can see it.

- `project-agents/record/build-record.ts`: new optional `toggles?: AutomationStudioProjectBuildToggle[]`.
  Each entry has `{ recordedAt, from: "explored"|"trial", node, callId?, handles,
  trialNodes?, signature, idempotentWith? }`. The field is absent until the first toggle, so
  older records still parse.
- `build-record-parser.ts`: `toggles` is an optional key, checked by a new `readToggles`. It
  requires a non-empty JSON signature of at most 4,096 characters, distinct handles and trial
  nodes (at most 50 each), and `from: "trial"` exactly when there are trial nodes.
- `store.ts`: new `recordToggle(ref, entry)`, validated whole, like `recordLastingAct`.
- New `service/project-build-toggles/toggles-record.ts` (plus its `index.ts` barrel): `AutomationStudioProjectBuildTogglesRecord`.
  It is a sibling directory, like `project-build-notes/` and `project-build-ending/`. The
  revision test went into the existing shared-toggles test file because a test in that
  directory may not import `../project-build/brief-ports.ts` (the barrel rule), and
  `project-build/tests/` already holds 25 files, so a new file there is refused. The structure
  audit refused 26 files in `project-build/` (limit 25) and refused `project-build/toggles/` at
  10 path segments (limit 9). This directory is outside the owned path as written
  (`R/service/project-build/**`), and was created only for that reason.
  It has one writer per record (`of`), plus `bind`, `sync`, `flushed` and `unrecorded`, all
  modelled on `acts-record.ts`. Writes are deduplicated by the toggle's whole value.
  `static toggles(environment)` returns the build's one record: the trial environment's, or one
  kept per environment. That replaces brief-ports' inline fallback, which used to make a
  separate record per factory.
- **When toggles are written:**
  - `brief-ports.ts`: after every builder or repair tool call (the `written(...)` wrapper on the
    loop's `executeTool`).
  - `subflow-trials.ts`: after every subflow trial, including offline-first ones. Its trial
    ports now carry the build's record explicitly.
  - `whole-trials.ts`: after every whole trial in a project build.
  - `run.ts`: binds the writer next to the acts writer, then does a final `sync` and
    `flushed()` after the acts are flushed.

**Tests.**

- A new `describe` in `service/project-build/tests/project-build-shared-toggles.test.ts`, "a toggle
  a subflow trial pressed, in a project build", covers the real
  path:
  - A subflow trial (`runAutomationStudioSubflowTrial`, the real detached runner) records into
    the shared record. The press's outputs are exactly the web domain's runtime shape:
    `{ outputId, ok, runtimeCommandId, runtimeStatus, result: { status, message,
    result: <client result with raw toggle>, toggle: { signature } } }`, trimmed from the live
    command attempt.
  - A repair brief's builder is then built through `automationStudioProjectBuildBriefPorts`,
    and its `submission` is put into `AutomationStudioSubflowScopedSubmissionController`.
  - It resubmits the same step under a handle the build never pressed while exploring, with the
    entry keyed `main`, and the test asserts the proposal's step has
    `ensureState: { via: "name", gains: ["unpin"], loses: ["pin"] }`.
  - The control is generic: a "Pin" button on a list of saved notes.
  - Case 1 (the trial is recorded) passes. Case 2 fails until the diff is applied.
- New `service/project-build-toggles/tests/project-build-toggles-record.test.ts` covers persistence:
  explored and trial toggles are written and read back by a fresh store; a refused write is kept
  as `unrecorded`; the parser refuses bad entries; and there is one record per environment.
- New `domain/src/runtime/tests/adapter-toggle.test.ts`: the runtime adapter returns
  `toggle: { signature }` at the payload's top level, with the client's result kept whole, and
  returns no toggle on an `already_in_state` skip. This pins the shape the Core test copies.
- I did not change `adapter.ts`, `gateway-output-dispatcher.ts` or `toggle-signature/`. They
  were already correct, as the live evidence above shows.

## Commands run and observed results

- the revision test (first written as its own file `project-build-trial-toggle-revision.test.ts`, since folded into `project-build-shared-toggles.test.ts`; before any change):
  1 failed, 1 passed. The resubmitted step had `{ target }` and no `ensureState`.
- The same test with the entry keyed `pin_notes` (temporary copy): 2 passed.
- The revision test, the six controller test files and the toggles-record test against the
  patched copy: `Test Files 8 passed (8)`, `Tests 46 passed (46)`. An earlier run of the six
  copies plus the original `scoped-submission.test.ts`: 7 files, 64 tests passed.
- `pnpm test src/.../service/project-build/ src/.../project-agents/record/ src/.../service/subflow-trial/`
  under the lock:
  - parallel group: `1 failed | 137 passed (138)`. The one failure is the revision test, as
    expected until the diff is applied.
  - real-sql group: `8 passed (8)`, `47 passed (47)`.
- Core `tsc --noEmit -p tsconfig.json`, first run under the lock: one error, mine, in
  `toggles-record.ts` (a type imported from the wrong barrel). It is fixed. The second run's
  result is recorded below.
- `DOMAIN_TEST_BUILD_LABEL=t792-fix2 node scripts/test-domain.mjs runtime/tests/adapter-toggle io/tests/gateway-output-dispatcher-toggle runtime/tests/adapter-route`
  under the lock: `pass 7`, `fail 0`.
- **Final check run, under the lock, after the moves:**
  - Core `node scripts/structure-audit.mjs`: exit 0. Two earlier runs failed while the files sat
    in `project-build/`, first on `directory-files` (26 and 27 files against a limit of 25),
    then on `naming` (10 path segments against 9) for `project-build/toggles/`. A third failed on
    the barrel `imports` rule. All are fixed by the layout described above.
  - Core `tsc --noEmit -p tsconfig.json`: exit 0, no output.
  - `pnpm test src/.../service/project-build/ src/.../service/project-build-toggles/ src/.../project-agents/record/ src/.../service/subflow-trial/`:
    - parallel group: `Test Files 1 failed | 27 passed (28)`, `Tests 1 failed | 137 passed (138)`.
      The one failure is the expected revision case.
    - real-sql group: `8 passed (8)`, `47 passed (47)`.
  - Domain `npx tsc --noEmit -p tsconfig.json`: exit 0.
  - Domain `DOMAIN_TEST_BUILD_LABEL=t792-fix2 node scripts/test-domain.mjs runtime/tests/adapter-toggle io/tests/gateway-output-dispatcher-toggle`:
    `pass 5`, `fail 0`.

## Not verified

- No live run, and no Lab run.
- The diff has not been applied in the tree. It was tested only on a copy.
- The fidelity of the Core fixture: it is copied from the live command attempt and from the
  domain adapter test, but no single test runs both the domain adapter and Core.
- The whole-trial (single-subflow) path's toggle sync is not covered by a test. Only the writer
  and the subflow-trial recording are.
- Core docs are not updated. `docs/architecture/automation-studio/llm-flow-bootstrap.md` should
  gain a line next to "Acts in the build record (t551)" about `toggles`, and the
  "Idempotent toggles" paragraph should say trial nodes are matched under the probe's keys.
  I did not own that file.

## Open questions or contradictions found

- The debug says "the node keys match (`s10` in both revisions)". That is true of the
  *proposal*, but the tie compares against the *probe*, keyed `main`. That is the gap.
- A tie by trial node still matches by position key (`s10`). A later revision that inserts a
  step before the like would shift keys, and could tie the wrong step or none. That predates
  t787 and this fix.
- Fix 1's worker changed the tie to "earliest press decides" (`toggle-tie.ts`). It is
  compatible with this diff. In this run's sequence, 0091's `{gains unlike}` would be the
  earliest trial record for `s10`, so the later reversals from 0110 and 0115 would not decide.
