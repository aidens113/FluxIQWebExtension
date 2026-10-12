# R4a attempt 3 (run-mv4912r9-53b05a51): why repair calls were refused `invalid_input` and `target_unobserved`

Worker report. Investigation only: no source was edited. The tree that ran (`fxwork/t418`, both repos) has the same
HEAD as `dev` (downstream 1d63b2c8, Core 9aeba98c), so every line cited below is the same on `dev`.

## Outcome

Done. The user's reading holds: **the model did not cause any of the eight refusals.** Each came from our pipeline
holding a step in a shape the domain's own gate then refuses. There are four separate defects, one in each stage:

1. **The in-run repair could not work for this step at all.** The domain does not list Set Checked
   (`web.output.dom-check`) as a repairable action, so the model's correct target override (a handle) for "choose
   7-in-1" was refused as `action_not_repairable` before anything was checked. That is why the run did not carry on
   from the failing step, and why the slower re-author loop ran instead.
2. **`invalid_input` / `missing_input_keys` (4 calls).** The saved Flow carries no consequences declaration for its
   navigate, Set Checked and Type steps. Core's Flow-script contract tells the model that only presses declare one. The
   re-author seeds those steps with no `consequences`. The domain's live `core.run_node` refuses any acting node
   without one, so it refuses every rerun of those steps.
3. **`target_unobserved` / `target_not_a_handle` on steps that named a handle (iterations 19 and 42: t942, t870).** A
   step that ran with a handle has its stored `input` screened by the domain. The screen removes `selector` at every
   depth, including from the Flow's saved `element`. A rerun sends that screened `element` back. The held-literals
   memory compares values exactly, so the screened copy no longer matches the Flow's element. It counts as written by
   the model and is refused as a literal (t432). The step did name the control; the chat's "didn't say which control"
   is false in these cases.
4. **`target_not_a_handle` on unchanged carried steps (iterations 39-40), and the `complete` that never landed.** The
   completion gate (`full_run_required`) requires a live rerun of every carried step that has no "scheduled
   candidate". A step gets no candidate when its node has no declaration (defect 2), or when the failed run never
   reached it, so it has no captured start. A live rerun of an unchanged carried element step is exactly what the
   domain refuses (`run.ts:287`). The model said `complete` three times (iterations 24, 37, 46). Each was refused
   `full_run_required`, the call budget ran out (`flow_bootstrap.run_budget_calls_exhausted`), and no fix was ever
   applied. The Flow on disk is the original, so the run ended on the original s9 `target_not_found`.

A provider-free reproduction confirms defects 1-4 against the real modules (output below).

## What changed and why

Nothing in source. This report is the only file written. A scratch reproduction lives only in my scratchpad.

## Evidence used

- `core.log` is at `.staging-run-mv4912r9-53b05a51/logs/core.log` (the brief's `persistent-isolated/.../.sessions/`
  path does not exist). The repair is one re-author attempt with two loop rounds: lines 103-200 and 201-286.
- `.staging-run-.../snapshots/decision-trace.json` and the runtime event chunk `objects/sha256/75/bc/...json`
  (`resultReauthor.attempts[0].evidenceLoop.steps`) hold every loop step. Each has its result code, `resultReason`, the
  domain's `web-build-refusal.v1` diagnostic (which carries the handle the call named and whether the page held it),
  `draftChange.targetedStepIds` / `rerunStepId`, and `amendmentsRefused`. This record replaces most of what the
  missing `steps/NNNN` logs would have shown.
- `flow-lane.json` → `build.declaredConsequences` shows which candidate steps declared anything: the presses s2, s4,
  s6, s12 only.
- The saved Flow `flows/...main.graph.flow.ts`: s1 (navigate), s8, s9, s10 (Set Checked) and s11 (Type) carry no
  `metadata.declaredConsequences`; s2, s4, s6, s12 (presses) carry `[]`.
- Screenshots 00021 (the "Choose 7-in-1 ... which control" card), 00025 ("6 steps need fixing"; "Open page ... left out
  something it needs"; "Click ... (2 times) ... which control"), and 00029 (final "Run failed").

Draft ids: `f<n>` is a step carried from the Flow, numbered from its saved node `s<n>` (f9 = s9 "choose 7-in-1",
f8 = Space Grey, f1 = navigate, f2 = "close the flash deal notice if it shows"). `d<n>` is a step this loop ran.

## Per refused call

| Time (UTC) | Iteration | Call | What the model sent (from the trace) | What reached the gate | Where it was dropped |
| --- | --- | --- | --- | --- | --- |
| 20:05:17 | 3 | amend f9 → rerun.9 | rerun of f9 with handle **t942** (the diagnostic's `target: t942, targetObserved: true`) | Core merges the patch over f9's seeded input (`rerun-request.ts:148`, `rerun-input.ts`): `{node: dom-check, parameters: {checked, element (Flow's, with selector), selector (Flow's), timeoutMs, target: {handle: t942}}}` with **no `consequences`**, because the seed never wrote one (`draft-from-flow.ts:191`) | Resolution passed (the held Flow covers the literals, so t942 resolves). Then `run.ts:316-320`: a `mutate` node with `value.consequences === undefined` is refused `invalid_input / missing_input_keys ["consequences"]`. That is the only `missing_input_keys` site reachable on a live run_node call (`tools.ts:763` is other tools; `written-step.ts:77` needs `write: true`). |
| 20:05:19 | 4 | amend d4 → rerun | a rerun of d4, the refused attempt from iteration 3 | the same call again | Same as above. `repeated-refusal.ts` answers `answered_the_same_again` (diagnostic still `missing_input_keys`, t942). Iterations 5-6 were then refused by Core `changes_nothing` without running. At iteration 7 the model added a declaration and f9 ran (succeeded, becoming d6). |
| 20:05:35 | 9 | amend f8 → rerun.8 | rerun of f8 (Space Grey) with handle **t931** | f8's seed input plus the handle, no `consequences` (s8 has no declaration) | `run.ts:316`, the same as iteration 3. Iteration 10 succeeded once the model added a declaration. |
| 20:05:58 | 19 | amend d6 → rerun | rerun of d6, the 7-in-1 step that **succeeded** at iteration 7 with t942 | d6's stored `input`, which is the domain's screened call (`run.ts:500` `input: safeCall(value, written)` → `node-call.ts:41-43` `withoutWebLlmDeniedKeys`): `parameters: {checked, element: {classNames, context, tagName, visibleText} (no selector), target: {handle: t942}, timeoutMs}, consequences: []` | `held-literals/memory.ts:66-80` (`author`, `entry`) compares each parameter's canonical JSON with the held Flow's. The held `element` is the Flow's raw element (Core's opening look sends kept steps' raw inputs, `evidence-loop.ts:533`), so the screened `element` does not match and is counted as model-written. `written-literals.ts:93-98` then flags `element` as `web.handle.not_a_handle`, the resolver refuses, and `run.ts:281` returns `target_unobserved` (reason sharpened to `target_not_a_handle` by `tool-rejection.ts:681-683`, target t942 from `webPlanFirstTargetHandle`). This is chat card 00021. |
| 20:06:50 | 38 | amend f1 → rerun.1 (round 2, one of six reruns the gate asked for) | rerun of f1 (navigate), no handle | f1's seed input `{node: browser-navigate, parameters: {newTab, url}}`, no `consequences` (s1 has none) | `run.ts:316`, `missing_input_keys` (diagnostic `targetObserved: false`). Chat 00025: "Open page ... the request left out something it needs". The other five reruns in that decision were refused `run_by_the_loop` (one rerun per decision, `rerun-request.ts:143`). |
| 20:06:51 | 39 | model's own `core.run_node` call, callId `rerun.2` (model-chosen, like `qty.1` and `coupon.1`) | a click for f2 that named **no handle** (diagnostic has no target) | not determinable without the provider log: either the f2 call as shown in the draft (Flow element without selector, which counts as a model-written literal) or no element at all (`web.handle.required`) | Resolver refusal → `run.ts:281` → `target_not_a_handle`, with no target. |
| 20:06:55 | 40 | amend f2 → rerun | rerun of f2 with a patch naming no handle. The flash-deal notice was not on the page, so there was no honest handle to give. | f2's seed input: the Flow's `element` and `selector`, both held, and no handle | The resolver answers `unchanged` (nothing to resolve, nothing model-written), and `run.ts:287-291` refuses every element node whose parameters name no handle: `target_not_a_handle`, no target. This is the t274-c4 refusal that `carried-step.ts` describes in its header. Chat 00025: "Click ... (2 times)". |
| 20:07:04 | 42 | amend d26 → rerun | rerun of d26, the f2 replacement that succeeded at iteration 41 on **t870** | d26's screened `input` (as for d6) | The same chain as iteration 19: `memory.ts` → `written-literals.ts` → `run.ts:281`, `target_not_a_handle`, target t870, observed. Chat 00029. Iteration 43 then succeeded. |

What the model actually did at iteration 41 matters. Forced by the gate to rerun the optional "close the flash deal
notice if it shows" step while no notice was present, it pressed **t870 = "Welcome back Mara Lindqvist Orders to be
shipped (0)..."**, an unrelated account control. The press "succeeded" (screenshots 00025 and 00029). Defect 4 is
therefore unsafe as well as wasteful: demanding a live rerun of an optional interruption step whose layer is absent
pushes the model to point it at something else.

## Why `target_unobserved` fired

It fired in two distinct ways, and neither involved the model failing to name a control:

- **The host's own literal, laundered** (iterations 19 and 42; and 39 if it restated the draft). The domain stores the
  call's `input` screened of `selector` (`run.ts:500`, `node-call.ts:41`) and Core reruns from that `input`. Core's
  draft screen already says "the shown copy drops the denied keys; the draft the loop keeps is untouched"
  (`runtime/llm/harness/draft-screen.ts` header). The domain breaks that by screening at the source, so the kept copy
  is the screened one. The held-literals memory compares exact values, so the Flow's element without its selector
  reads as a literal the model wrote.
- **An unchanged carried element step run live** (iteration 40). `run.ts:287-291` refuses any element node whose
  parameters name no handle. It does not ask whether the element is the held Flow's own. `written-literals.ts`'s header
  says a step the build's own draft ran or a Flow saved "still runs its literal selectors", and this check contradicts
  that for held steps.

## Why repair "declared complete" yet the run failed again at the same step

The repair never completed. Three `complete` decisions (iterations 24, 37 and 46, at 20:06:11, 20:06:46 and 20:07:13)
each passed Core's completion check (`ok=true`) and were refused by the test gate as
`llm_evidence_loop.full_run_required`, listing the carried steps that are "not run in this build"
(`carried-step.ts:66-70`):

- Round 1, steps 1, 11, 13 = f1 (navigate), f11 (Type) and f12 (Add to cart; at position 13 after the model moved its
  new quantity step to 12).
  - f1 and f11 have no declaration, so `candidate.ts:12` mints no scheduled candidate.
  - f12 (and f10, f11) belong to nodes the failed playback never started: it stopped at s9. `draft-from-flow.ts:208-210`
    and `candidate.ts:12` then have no `from`, so again no candidate.
  - Without a candidate the only way out is a live rerun, and for f1 and f11 the domain refuses that (defect 2).
- Round 2, steps 1, 2, 4, 6, 11, 14: f2, f4 and f6 (presses declared `[]`, all started in the failed run) also lost
  their candidates between rounds. I could not determine why from the stored evidence. `candidate.ts` `read()` drops a
  candidate when anything in the step's configuration differs (id, position, input, disposition, routing, acts, ...),
  or when `ranWith`/`replay`/`effectApplied`/`checkedCandidate`/`priorExecution` is set. The round-2 draft dump that
  the missing `steps/` logs would hold is needed to tell which.

The call budget then ran out (`run_budget_calls_exhausted`, 20:07:13). `resultReauthor.applied: false`, no adaptation
was promoted, and the saved graph is the original. s9 still addresses `#fbaudnsk > div:nth-of-type(2) >
div:nth-of-type(2)` with only class names and text, so the run's terminal error is the original s9
`target_not_found`. The in-run rung that should have held a fix at s9 and carried on was refused at the start
(defect 1). The "Change the Flow — Not done (2 times): that step already does that" card is iterations 12-14, where
the model tried to re-set f11's quantity (`already_so`). It then typed it with a new `run_node` call (`qty.1`), which
worked around f11 being un-rerunnable in that decision (`run_by_the_loop`, `rerun-request.ts:143`).

## Proposed general fix

There are no per-site rules, and the model keeps naming elements by handle only.

**F1. Every element-acting web action is repairable (domain).** `domain/src/runtime/llm-evidence/repairable-parameters.ts:65-73`
is a hand-kept table that predates the D6 actions. It is missing `web.output.dom-check` and `web.output.dom-upload`
(their schemas require `selector`), and `dom-scroll` and `dom-assert`, which take an optional element. Derive the
table from the action schemas (every action whose schema carries `elementProperties` gets `element`), with the role
per action (check → clickable; upload → a file input). Enforce it mechanically: a test asserting that every id in
`written-literals.ts`'s `ELEMENT_REQUIRED_NODE_IDS` has a repairable `element` parameter.
Tests: `domain/src/runtime/llm-evidence/tests/repairable-parameters.test.ts` (that folder is at the audit's 25-file
limit, so extend the existing file) and `target/tests/override.test.ts` (a dom-check override with a shown handle
resolves rather than `action_not_repairable`).

**F2. A step's kept `input` names its element by handle only (domain).** In `node-run/run.ts`, build `input` (line
500, and the refusal's at 593) so that when `written` names a target handle the `selector` and `element` slots are
dropped rather than screened. The handle is the step's name for the control. `ranWith` keeps the resolved selector
and fingerprint for the Flow, as it does now. A rerun then merges over `{target: {handle}}` only, and a stale handle
is answered by the existing handle refusals (`handle_not_in_packet` / `renumbered_by_reload`), which tell the model
to give a fresh one. As defense in depth, make `node-run/held-literals/memory.ts` `entry()` compare a value both raw
and screened (`withoutWebLlmDeniedKeys`), so a held literal stays the host's after any screen.
Tests: `node-run/held-literals/tests/memory.test.ts` (a held element returned without its selector is not
model-written) and `node-run/tests/run.test.ts` (run a click with a handle, rerun its returned `draft.input`
unchanged, expect success rather than `target_not_a_handle`).

**F3. One rule for which steps must declare consequences, read by both sides (cross-repo).** Core's Flow-script
format (`flow-bootstrap/plan/flow-script-format.ts:180`) tells the model that only presses (and a submitting type)
declare. The domain's `run.ts:316` demands a declaration from every `review` action (`actions/safety.ts`: navigate,
type, check, ...). Core's plan resolution already reads an inherited, undeclared step as standing
(`llm/harness-options/plan-parameter-resolution.ts:261-267`). The live rerun path has no such reading. Proposed:
- (a) The domain owns `webNodeNeedsDeclaration(node, parameters)` (press-like actions, a type with `submit: true`, and
  any other action whose act can last) and applies it at `run.ts:316` and in `written-step.ts`. Core's script text
  stays as it is or is generated from the domain's declaration, so the two cannot drift.
- (b) Until that lands, the narrower domain fix: at `run.ts:316`, a call whose node and declaration are the held
  Flow's own (the held Flow's call for this node carries no `consequences` and the model wrote none) is judged as the
  Flow's playback judges it, not refused.
Tests: `node-run/tests/unwritten-consequences.test.ts` (a rerun of a held Set Checked / navigate step with no
declaration runs) and Core `llm/node-tools/tests/draft-from-flow.test.ts`. The existing Core fixture
`runtime/tests/refuted-result/tests/carried-steps-between-rounds.test.ts` gives every node `declaredConsequences: []`,
which is why this never showed in tests. Add a fixture with a script-authored Flow: presses declared, check, type and
navigate undeclared.

**F4. The completion gate never demands a live rerun the domain cannot do (Core).**
`flow-draft/scheduled-candidate/candidate.ts:12` should schedule an unchanged carried step whether or not its node
holds a declaration (the saved Flow ran it that way in its judged trial), and without a captured start when the
test runs the Flow from its start. The test reaches that step through the steps before it, as playback does, so `from`
is only needed for a partial run. An unchanged optional carried step (an interruption) is satisfied by the test's
skip, as in playback, and is never listed for a live rerun. Then `carried-step.ts:66-70` lists only steps the model
changed.
Tests: `flow-draft/scheduled-candidate/tests/candidate.test.ts`, `flow-draft/scheduled-candidate/tests/draft-from-flow.test.ts`,
`runtime/tests/refuted-result/tests/carried-steps-as-saved.test.ts`. Also find and test why f2, f4 and f6 lost their
candidates between rounds: `flow-bootstrap/unfinished-build/judgement.ts:105-118` `RepairSeed` and `candidate.ts`
`read()`.

**F5 (wording, after F1-F4).** `ui/activity-action/failure-reason.ts:100-104` reads `_not_a_handle_` as "the step
didn't say which control on the page to use". After F2 that refusal only fires for a model that wrote a literal, so
the words become true. No change is needed unless F2 is deferred.

Order: F1 (smallest, unblocks the in-run rung, which is the user's chosen design), F2, F3(b), F4, F3(a).

## Commands run and observed results

- Read `core.log` (286 lines). Found 4 `invalid_input` and 4 `target_unobserved` lines at the times the brief gives;
  `decide throw iteration=18 ... code=flow_bootstrap.run_budget_calls_exhausted`; `[exit] code=1`.
- Dumped `resultReauthor.attempts[0].evidenceLoop.steps` from the event chunk and `decision-trace.json` with node: 62
  steps, giving the per-iteration codes, reasons, diagnostics and draft changes in the table above.
  `inRunRepairs[0]`: `code: patch_refused`, `reason: "...Target override is absent from current sanitized evidence:
  the failed action offers nothing a repair may re-point (action_not_repairable)."`
- Copied `project.sqlite` (+wal/shm) to the scratchpad and listed its tables. It holds no evidence-loop decision
  records (only runtime chunks, action summaries and conversations), so the model's exact patches are not stored
  anywhere I could find.
- Provider-free reproduction: scratchpad `repro-r4a4.ts`, bundled with the domain's esbuild to CJS and run with node
  against `dev` source (`domain/src` plus Core `src`). Output:
  ```
  webRepairableParameters(dom-check): []
  webRepairableParameters(dom-click): ["element"]
  failure packet repair parameters for dom-check: {}
  validate override {element: t942} on dom-check: {"status":"absent","reason":"action_not_repairable"}
  seeded f1 (web.output.dom-click) has consequences / scheduled / notRunInThisBuild: [true,true,false]
  seeded f2 (web.output.dom-check) has consequences / scheduled / notRunInThisBuild: [false,false,true]
  rerun input: {"node":"web.output.dom-check","parameters":{"checked":true,"element":{...,"selector":"#fbaudnsk > ..."},"selector":"#fbaudnsk > ...","timeoutMs":10000,"target":{"handle":"t942"}}}
  run.ts:316 refuses missing consequences (mutate node, value.consequences undefined): true
  d6.input (what Core keeps and reruns from): {"node":"web.output.dom-check","parameters":{"checked":true,"element":{"classNames":[...],"context":{"landmark":"main"},"tagName":"div","visibleText":"7-in-1"},"timeoutMs":10000,"target":{"handle":"t942"}},"consequences":[]}
  f9 rerun: model-written keys: ["target"]
  f9 rerun: literals refused: []
  d6 rerun: model-written keys: ["element","target"]
  d6 rerun: literals refused: [{"code":"web.handle.not_a_handle","path":["element"]}]
  ```
  (In the reproduction the seed numbers its two nodes f1/f2; f2 there is s9's shape.)

## Not verified

- The model's actual amendment patches and run_node arguments. The `steps/NNNN` provider logs are missing, so the
  handles come from the domain's refusal diagnostics. That the merged inputs carried the Flow's literals and no
  `consequences` is inferred from the seed code, the saved node metadata and the refusal reasons, which have one
  reachable site each. Iteration 39's exact arguments (a restated draft element, or no element) cannot be told apart.
- Why f2, f4 and f6 lost their scheduled candidates between round 1 and round 2.
- `run.ts:316` and `run.ts:287` were not executed end to end through `runWebOutputNode`. The reproduction exercises the
  pure modules on either side of them (seed, merge, screen, held-literals, written-literals, repairable-parameters,
  override). `node-run/tests/unwritten-consequences.test.ts` already covers the `run.ts:316` refusal itself.
- Why the playback could not find the saved 7-in-1 chip at s9 (another worker's brief).
- No fix was implemented or tested. No Lab or browser run.

## Open questions or contradictions found

- The brief's `core.log` path (`persistent-isolated/t418-r4a-4/.sessions/run-mv4912r9-53b05a51/logs/`) does not
  exist. The log is under `.staging-run-mv4912r9-53b05a51/logs/core.log`.
- The brief says the replay failed at "step 6". In the graph that is node s9; "Step 6 of 9" in the chat counts
  non-Merge steps.
- Contradiction (defect 3 vs. its own docs): `written-literals.ts` says a Flow's or the build draft's literal
  selectors still run. `run.ts:287` refuses an unchanged held element step, and `run.ts:500` turns a ran step's
  literal into a "model-written" one on rerun.
- Contradiction (defect 2): Core's script contract exempts check, type and navigate from declaring, while the domain's
  run_node requires it. The Core test fixture for carried steps hides this by declaring every node.
- Safety: the `full_run_required` gate pushed the model to point an optional notice-closing step at an unrelated
  account control (t870), and the press ran. F4 removes the demand. It may also deserve a guard: an optional
  interruption step re-pointed at a control that is not a way out (t423's way-out vocabulary).
