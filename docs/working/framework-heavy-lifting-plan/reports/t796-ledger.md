# t796: Core owns a per-pass act ledger (sub-supervisor report)

Trees: `fxwork/t796/!FluxIQ` and `fxwork/t796/!FluxIQWebExtension`, branch `task/t796-fhl-per-pass-act-ledger`.
Nothing committed. No Lab live runs and no model calls. RT below means
`packages/fluxiq/src/programs/automation-studio/runtime` in the Core tree.

## Outcome

All five goals are built with fail-first tests and generic examples (a library or an archive, never photo or social),
and there is a headed provider-free proof on photo-social. The headed proof found that the first version of goal 1
still accepted the debug's exact shape. Core's word lists do not read "like" as an act, so a guarded like passed. I
closed that gap by matching on the part's own `lastingActs` class (Integration, item 3). The spec now proves the like
itself is refused.

## Per worker

| Worker | Tier | Brief | Outcome | What I verified |
| --- | --- | --- | --- | --- |
| w1-rule | worker (Sonnet) | Never-optional rule covers `only after:` and an optional step's `on success:`; refusal words in `guarded-steps.ts` | Done | Read the rule body. My combined run is green. Its consequence match only knew delete, move_money and send_or_publish, which is the gap I closed. |
| w2-ledger | worker-heavy (Opus) | Per-pass act ledger, feedback `notRun`, proof `not_run` | Done, with one gap (the subflow trial path was not wired) | Read the proof rule and the sentence. I wired `service/subflow-trial/run.ts` myself. Combined run green. |
| w3-repeat-order | worker-heavy (Opus) | Core sorts a For Each's rows by the listing's sort before `repeat most` | Done. The span-level `repeat order:` was not done (it needs `parse.ts`). | Combined run green. Docs reference regenerated at integration. |
| w4-layers | worker (Sonnet) | A cleared layer gets a handler even when a step presses its control; learned handlers scoped by layer | Done | Combined run green. |
| w5-ending | worker (Sonnet) | The ending names steps that never ran and each leftover act's page; `leftFromEarlier` gets `where` | Done | I fixed its test's type (tsc TS2322). The headed spec observed the ending text. |
| w6-headed-proof | worker (Sonnet) | Headed provider-free photo-social spec | Done: 8 of 8 photo specs passed, its run | I re-ran it after changing the refused variant (Validation). |

Worker reports: `reports/t796/w1-rule.md` to `w6-headed-proof.md`.

## What changed (by goal)

1. **Never conditional** (`flow-bootstrap/instructed-acts/optional-act-steps.ts`, `script-statements/guarded-steps.ts`,
   `candidate/submission.ts`, `subflow-candidate/scoped-submission.ts`, `plan/flow-script-format.ts` line 431). A step
   doing a requested act is refused when it is behind `optional:`, behind `only after:`, or reached only from an
   optional step's `on success:`. It is matched by its words, or by a declared consequence class that the scope's parts
   ask for (`askedConsequences`, from each part's `lastingActs`). Code `bootstrap.instructed_act_only_optional`, at the
   `only after:` line. A misplaced `only after:` now says what the line does.
2. **Ledger** (`service/candidate-trial/act-ledger.ts`, `not-run.ts`, `feedback.ts`, `run.ts`; `executor/step-skip/guarded-group.ts`,
   `not-run-said.ts`; `flow-bootstrap/trial-change/{proof,contracts,acts,acts-split,part-acting,session,packet,...}.ts`;
   `service/subflow-trial/run.ts`). For each pass, every lasting or guarded step is recorded as one of: ran (changed,
   already_in_state, no_change_seen), skipped, refused, failed, or not_run (guarded, or unreached). The feedback gets a
   top-level `notRun`. Proof `not_run` is decided first, when every acting step of a part missed every pass.
3. **P6 amendment** (`flow-bootstrap/layer-handlers/explored.ts`, `service/runtime-session/interruption-handler.ts`,
   `executor/step-loop/incident-repair.ts`). A press that cleared a layer always becomes Core's handler, scoped to the
   subflow. Run-time learned handlers are scoped to the layer in the subflow, not to one node, and are deduped by layer.
4. **Ordered repeat** (`nodes/control-flow/for-each.ts` `order` option; `script-statements/repeat-order.ts`,
   `listing-repeat-sort.ts`, `listing-order-in-repeat.ts`; `authoring/assemble.ts`). A page-order listing's own sort is
   copied onto the For Each that walks it. Rows are sorted before `stopAfter`, and rows the sort cannot read go last.
   Where the rule still refuses, it names the key the model wrote.
5. **Ending** (`service/project-build-ending/record-told.ts`, `activity/wording/{left-told,act-words}.ts`,
   `project-agents/supervisor/left-on-target.ts`, `flow-bootstrap/site-reset/trial-change-port.ts`). "made N step runs
   … but its step “X” never ran (on any of the 3 passes)". Each leftover names its page. Fleeting moves are no longer
   listed. `leftFromEarlier` falls back to the control's own location for `where`.

## Proposed shape for t795 (computed-first judging)

The judged summary's `siteChange.proofs[]` element may now be
`{ part, effect, proof: "not_run", steps, notRun: [{ nodeId, label, reason: "guarded" | "unreached", after?, passes: number[], of? }] }`.
`notRun` may also sit on a part with another proof, when its act missed only some passes. Lane t795 should:

- add `not_run` to `result-verification/site-change/held.ts` `NOT_PROOF`, or better, make it a Core no under P5's "a
  computed fail is a Core no", naming the step and reason;
- treat a `notRun` entry on a `shown` part as "not every pass ran" for P5's "every repeat pass passed";
- define `not_run` in the judge instruction text (`llm/diagnosis-instructions.ts`).

`AutomationStudioTrialChangeAct` is now a union (`MadeAct | NotRunAct`). `held.ts` still compiles because it uses
`Partial<Record>`, but until t795 lands, a yes over a `not_run` part is not held.

## Integration changes I made

1. `service/subflow-trial/run.ts`: passes `automationStudioTrialNotRun(automationStudioTrialActLedger(...))` into
   `automationStudioTrialChangeAfterRead`. Without it, subflow trials, which are the project-build path, got no `not_run`.
2. `plan/flow-script-format.ts` line 431: w1's sentence ("A step that does what the request asks never takes `optional:`
   or `only after:` …").
3. Part-class match: `optional-act-steps.ts` takes `askedConsequences`. `submission.ts` gains the input and
   `scoped-submission.ts` passes the parts' `lastingActs`. Test: "is refused when it declares the lasting act the part
   asks for, though no word of the instruction reads as an act" (a star-a-book example). Its first assertion shows the
   rule accepts the step without the classes, which is the fail-first. The headed run had already shown the guarded
   like accepted.
4. `service/project-build-ending/tests/ending-truth.test.ts`: typed the helper's `notRun` argument (TS2322).
5. Spec `photo-act-ledger.spec.ts`: the refused variant now guards the like, not the save, and asserts the class sentence.

## Commands run and observed results

- Core, under the lock: tsc `--noEmit` -> exit 0. `pnpm test` over the 21 touched dirs and files (both groups,
  including the prompt-contract tests `llm/deepseek/tests/system-prompt.test.ts`,
  `conversations/instructions/tests/prompt.test.ts` and `plan/tests/flow-script-format.test.ts` via `plan/`) -> parallel
  334 files and 3207 tests passed, "all groups passed: parallel, real-sql". `pnpm structure:check` -> passed (454
  warnings, 1152 baselined). `pnpm docs:reference` wrote 4278 declarations. `pnpm docs:check` -> "Deterministic
  framework reference is current".
- After the part-class change, under the lock: tsc -> exit 0. `pnpm test` instructed-acts, candidate and
  subflow-candidate -> 73 files and 735 tests passed, both groups.
- Final run (Core `pnpm check`, downstream model-text, structure audit, extension check, headed photo specs): see
  Validation below.

## Validation

Final run, all under the shared lock, after every integration edit:

- Core `pnpm check` -> exit 0 (structure-audit:check, fluxiq:build, fluxiq:check and web:check all ran).
- Core `pnpm docs:reference` wrote 4278 declarations. `pnpm docs:check` -> "Deterministic framework reference is
  current", exit 0.
- Downstream `node scripts/check/model-text.mjs` -> "model-text: ok (208 scenario tokens, 377 model-facing Core files,
  11791 string literals)".
- Downstream `node scripts/structure-audit.mjs` -> passed (232 warnings, 616 baselined).
- `pnpm --filter @fluxiq-web-extension/extension check` (the extension typecheck) -> exit 0.
- `pnpm --filter @fluxiq-web-extension/extension test:e2e -- site-reset/tests/photo-` (headed) -> **8 passed (6.5m)**:
  the new `photo-act-ledger.spec.ts` and the 7 existing photo specs. What the new spec observed:
  - (a) The like behind `only after: notice` was refused: `bootstrap.instructed_act_only_optional` at `flow.line.26`,
    "The step at line 22 declares `consequences: modify_existing`, the lasting act this part asks for. This step does
    what the request asks, and `only after: notice` makes it run only on passes …".
  - (b) In the unguarded loop, `leftOnSite` lists the like and the save on passes 1, 2 and 3 of 3, and 3 posts were
    liked. `notRun` = the wait, `reason: guarded`, `passes [1,2,3] of 3`, "Not run on passes 1, 2 and 3 of 3: it runs
    only after "close the notice if it shows", which was skipped."
  - (c) The ending read "… made 26 step runs, counting each pass of a repeat and stored 3 rows, but its step “wait a
    moment after the notice” never ran (on any of the 3 passes) … These changes the build made are still on the site:
    ran the step “save the post” on the page “…/p/D1OKDvAEHfa/”, ran the step “like the post” on the page
    “…/p/DgYZxS8LJOe/” … and 1 more."

## Not verified

- No live Lab run. Whether the next photo-social live build now gets the like refused at submit depends on the
  dispatcher carrying `lastingActs` into the scope. It does carry them in the scripted harness; live is not checked.
- The span-level `repeat order:` is not built. A model-written JSON plan's sort is not lowered.
- Whether the record rows' field ids match the sort's field names in a live page read.
- The ending case for a clean passing build. It writes no ending row, so this was not provable provider-free.
- Debug fix 6 (closing a dialog the Flow itself just opened) is not in scope and was not traced.
- The proper `where` fix in `site-reset/ledger.ts` `placed()`, which keeps `place` only when something differed. Left
  alone because `place` drives undo admission; w5's fallback fills `where` without changing that.
- Full suites (`pnpm test`, Core's whole vitest run), Firefox.

## Open questions for the lead

- Route the `not_run` shape above to t795.
- The word lists (`kind-words.ts`) still decide acts when no part classes reach the rule (the candidate path with no
  scope). P10 removes English word lists from Core, so the class match is the durable route.
