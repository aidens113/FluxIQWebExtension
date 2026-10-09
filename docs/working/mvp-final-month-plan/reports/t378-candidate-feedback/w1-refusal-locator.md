# W1 report: candidate refusals point at the model's own script line (t378)

## Brief

### Brief: t378-w1-refusal-locator (worker-high)
- Repository: FluxIQ Core. Tree T = `C:/Users/osrs_/FluxStuff/fxwork/t378` (both repos on `task/t378-candidate-feedback`). R = `T/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`.
- Task: candidate refusals point at the model's own script line (structural fix; lanes B and C were refused, could not find the step, resent unchanged, and the repeat guard ended the build).
  1. Contract for every refusal issue the model sees: `{code, path?, message?, step?, label?, line?, instead?, accepted?, handles?}`. `step` = the step's description as the model wrote it, `label` = its label when written, `line` = 1-based script line the issue is about (the step's `step:` line for a node issue; the exact line for a line issue). Keep `path`.
  2. Build the map during assembly (`R/flow-bootstrap/authoring/assemble.ts` `buildSubflow`; node paths `plan.subflows.S.nodes.M` skip unresolved nodes and empty blocks). Core-generated nodes (optional merge `assemble.ts:342-344`; loop nodes written with `line: 0` in `draft-routing.ts`) map to the written step whose line caused them. `flow.line.N` maps to the step containing line N (or the block for its `subflow`/`when:` lines); edge and router paths to their source step or block. Carry it on `AutomationStudioFlowBootstrapAcceptance` (both answers, `authoring/contracts.ts`) and on the completion verdict; attach in `R/llm/harness-options/bootstrap-completion.ts` `refused()` (every failure, including domain resolution and registry validation) and in `R/flow-bootstrap/candidate/submission.ts` `bindingRefusal`. A JSON-plan submission names the node key and name, no line.
  3. `instead` where Core can say what to write, as fixed sentences quoting only the model's own tokens: for `*.consequences_undeclared` / `*.expected.consequences_classes_or_none`, the step presses or sends its form (`submit: true`), so it needs `consequences: none` (search, filter, navigation) or its classes (interpolate `AUTOMATION_STUDIO_ACTION_CONSEQUENCES`). Put it in `R/flow-bootstrap/plan/issue-feedback.ts` or a new focused module.
  4. `R/flow-bootstrap/candidate/submission-refusal.ts`: `next` names each refused step by line and name. `refusalCode` (:61-64) keys a run of refusals on the same issues (codes plus lines), not the refusal category: lane D's three different filter-list defects ended the build as "the same".
  5. `repeat most:` (lane C): written under another step of a `repeat while` span, it bounds that span (nesting is refused, so it can bound only one). Refuse only where no while span can take it, or where head and member both give one, naming its own line and saying to move it beside `repeat while:` (`draft-routing.ts` `scriptSpan` ~:290-330; `parse.ts:182-189` attaches it to the step it is written under).
  6. Mechanical enforcement: a test that fails when any candidate refusal issue reaches the model (the evidence `automationStudioCandidateSubmissionRefusal` returns) without `line` and `step`, unless its code is in one explicit whole-Flow list. Corpus through the real `AutomationStudioFlowCandidateSubmissionController.submit` with `plan/tests/web-domain-definitions-fixture.ts` and a stub binding (a domain refusal of consequences and of a handle), covering parse, assemble, optional, routing/repeat, binding and resolution refusals; plus a source scan of the refusal codes under `authoring/` so a new code without a corpus case fails.
  7. Fixtures (copy each call's `input.flow` text into a test fixture): lane B `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-08/run-mv0fu9pb-57454dc4/steps/0058-tool-core.submit_candidate/call.json` is refused naming lines 32 and 58 with the consequences `instead`; lane C `.../run-mv0fuotv-805294d7/steps/0036-tool-core.submit_candidate/call.json` passes assembly and routing.
- Required reads: the files above; lane B analysis (read-only) `C:/Users/osrs_/FluxStuff/fxwork/t262/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/lane-b-candidate/w1-refusal-index.md`; its reproduction `.../scratchpad/w1/refusal-index.mjs` is a template (it reads another tree's dist; do not run it against that tree).
- Owns: `R/flow-bootstrap/authoring/**`, `R/flow-bootstrap/plan/issue-feedback.ts`, `R/llm/harness-options/bootstrap-completion.ts`, `R/flow-bootstrap/candidate/submission.ts`, `R/flow-bootstrap/candidate/submission-refusal.ts`, new files beside them, their barrels and `tests/`.
- Must not touch: `plan/flow-script-format.ts`, `llm/repeat-guard/**`, `llm/decision-handlers/**`, `activity/**`, `executor/**`, `service/**`, downstream, any other tree (`fxwork/t377`, `t275`, `t262`, `t274`), lab slots or processes.
- Note: a later worker adds in-span `optional:`, `only after: <label>` and `repeat pace:` to authoring; keep the rule "a Core-generated node maps to the written step that caused it" generic.
- Concurrency: other workers edit other Core files in T now. An error only in a file you do not own is theirs: record it, do not fix it. Core rules: one exported thing per file, a barrel in every directory, tests in `tests/` beside the subject (`T/!FluxIQ/AGENTS.md`, Code Structure).
- Definition of done: tests beside each change pass (`npx vitest run <paths>` from `T/!FluxIQ`); `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` clean for your files; `node scripts/structure-audit.mjs` from `T/!FluxIQ` passes. Never commit; no `pnpm build`; no Lab run or provider call.
- Report to: `T/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/t378-candidate-feedback/w1-refusal-locator.md` (paste this brief at its top; protocol report format; return at most 12 lines).

## Outcome

Done. Every issue a refused candidate shows the model now carries `step` (the step as the model wrote it), `label` (when it wrote one) and `line` (1-based script line), beside the unchanged `path`. A JSON plan's issues carry `step` (the node's name) and `label` (its key), with no line. A test now enforces this for every stage that can refuse a candidate.

- Lane B's real script is refused at lines 32 and 58 ("search for the paper towels", "search for the dinner napkins"). Each step carries one `instead` sentence: it sends its form (`submit: true`), which is a press, so it needs `consequences: none` or its classes.
- Lane C's real script now passes assembly and routing. Its `repeat most: 10` bounds the span it is written in: the Repeat node gets `most: 10`.

`AutomationStudioFlowBootstrapAcceptance` (both answers) and `AutomationStudioFlowBootstrapCompletionVerdict` (both answers) carry the map as `locator`.

## What changed and why

All paths are under `R = T/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`.

**The locator (items 1-2).**
- `flow-bootstrap/authoring/contracts.ts` gains three things:
  - `AutomationStudioFlowScriptPlace` (`{step, label?, line?}`).
  - `AutomationStudioFlowBootstrapIssueLocator`. This is plain JSON: exact `paths`, `nodes` by `S.M`, `edges` by `S.E`, `subflows`, router `rules`, `fallback`, and the script `lines`.
  - `locator?` on both acceptance answers.
- `AutomationStudioFlowScriptStep.cause?`: for a step Core derived (`line` 0), the written line whose statement made it.
- `AutomationStudioFlowScriptRepeat.mostLine?`: the `repeat most:` line itself.
- New `authoring/script-locator.ts` builds the locator from what assembly actually built:
  - Each node maps to the step it was built from, so indexes are never recounted.
  - A derived step maps through `cause` to its written step.
  - A derived step without `cause` falls back to the nearest written step before it in its block, then after it. This keeps the rule generic for the later worker's in-span `optional:`, `only after:` and `repeat pace:`.
  - Blocks map to their `subflow` line, and `when:`/`unless:` lines map exactly. The steps outside every block map to their first step.
- `authoring/assemble.ts`:
  - `buildSubflow` returns `placed` (the step for each node) and `unplaced` (a step that became no node, with its exact `...definitionId` path). The exact path is needed because an unresolved node's path index is shared with the next resolved node.
  - The assembler returns `locator` on both outcomes.
  - The optional join is written with `cause: written.line`.
- `authoring/draft-routing.ts` `routeAutomationStudioFlowScriptRepeats`: after each span is lowered, every new line-0 step without a cause gets `cause` = the line of the step that says repeat.
- New `authoring/locate-issue.ts` exports `automationStudioFlowBootstrapIssuePlace(locator, path)`, published in the barrel. It resolves, in order:
  - an exact path;
  - `flow.line.N` (a block's own line exactly, otherwise the step written last at or before N, with `line: N`);
  - node, edge, Subflow, rule and fallback paths.
  - Whole-Flow paths (`flow`, `plan`, `result`) have no place.
- New `authoring/plan-locator.ts` builds the JSON-plan locator. Node names come from the plan as written, by key, because normalising drops `name`.
- `authoring/accept.ts` attaches the locator: a script's from assembly, a JSON plan's from the normalised plan when accepted, or from the plan as written when refused.
- `llm/harness-options/bootstrap-completion.ts`:
  - `refused()` places every feedback entry of every failure: assembly, domain resolution and registry validation. The field order is `code, path, message, step, label, line, …`.
  - The verdict carries `locator`. The draft path has no locator and is unchanged.
- `flow-bootstrap/candidate/submission.ts` `bindingRefusal` places each binding issue using `verdict.locator`. Its instruction now says each issue names its step, by line where the script has one.

**`instead` (item 3).** `flow-bootstrap/plan/issue-feedback.ts`:
- Any code matching `*.consequences_undeclared` or `*.expected.consequences_classes_or_none` gets one fixed sentence per step, on the step's first issue. The sentences interpolate `AUTOMATION_STUDIO_ACTION_CONSEQUENCES`.
- If the node's written parameters hold `submit: true`, the sentence says it "sends its form (submit: true), which is a press". Otherwise it says the step "presses something".
- Nothing else of the step is quoted.
- `flow_script.repeat_most_misplaced` is added to `AUTHORED_CODES`, so its sentence reaches the model.

**`next` and the run key (item 4).** `flow-bootstrap/candidate/submission-refusal.ts`:
- `next` now opens with "The refused step(s) is/are line N, "<step>" (label); …: correct those steps, where each issue says." Each step's words are capped at 120 characters. The handle and general text follow as before.
- `refusalCode` returns `<category>:<8-hex FNV-1a>` over the sorted set of `code@line` keys (`code@path` when an issue has no line). The category alone is returned only when there are no issues.
- Effects:
  - An identical resubmission is still the same refusal.
  - Correcting one step makes a different refusal, which breaks the run.
  - The model now sees, for example, `call:flow_bootstrap.evidence_completion_parameters_unresolved:e1f0a2ee` in the refused-in-a-row warning.

**`repeat most:` (item 5).**
- New `authoring/repeat-bound.ts` is called first in `routeAutomationStudioFlowScriptRepeats`.
- A `repeat most:` that is a step's only repeat line, written under a member of a `repeat while` span (strictly after its first step, up to and including its last), moves onto the span's first step.
- It is refused as `flow_script.repeat_most_misplaced` at its own line in two cases:
  - no while span takes the step ("Write it beside the `repeat while:` line…");
  - the first step already has a bound (the refusal names both lines).
- Either way it is taken off the member, so the old "repeat inside a repeat" refusal no longer fires.
- `parse.ts` records `mostLine`.

**Enforcement and fixtures (items 6-7).**
- `candidate/tests/live-submissions-fixture.ts`: lane B's and lane C's `input.flow` copied verbatim, plus lane B's summary.
- `candidate/tests/refusal-domain-fixture.ts`: the registry and the binding stub.
  - The registry is the web definitions plus Type Text's `submit`, a row-taking click, and a next-page node with an `ended` branch. It takes optional extra definitions and omitted built-ins.
  - The stub binding refuses an undeclared press, or a type with `submit: true`, with the two consequence codes. It refuses any handle starting `t9` with `web.handle.unknown` and `web.handle.unknown:<param>`. It resolves all other handles.
- `candidate/tests/refusal-locator-corpus.test.ts`: 40 scripts through the real controller and `automationStudioCandidateSubmissionRefusal`, covering parse, assembly, blocks and routes, branches, optional steps, repeats, bindings, domain resolution and registry validation (`bootstrap.missing_parameter`). It asserts:
  - each case is refused with its expected codes;
  - every issue has `line ≥ 1` and a `step`, unless its code is in `WHOLE_FLOW` (`flow_script.no_steps`, `too_many_lines`, `repeat_unavailable`, `bootstrap.invalid_plan`);
  - a source scan of every `"(flow_script|flow_draft|bootstrap|record_output).*"` literal under `authoring/` finds each code met by the corpus, in `WHOLE_FLOW`, or in `NOT_FROM_A_SCRIPT` (warnings, JSON-plan shapes, `loop_unbounded`, `step_binding_source_missing`, and draft-only codes, each with a reason);
  - neither list holds a code that is neither raised nor met.
- `candidate/tests/submission-locator.test.ts` covers:
  - lane B: lines 32 and 58, the `instead` sentence, and `next`;
  - an unchanged resend gets the same result code, while one fixed step gets a different code and only line 59;
  - lane C: accepted, Repeat `most` 10, and the loop node placed at "read this page of results" (label `page`, line 10);
  - a JSON plan: step "press buy now", label "buy", no line.
- `authoring/tests/script-locator.test.ts` and `authoring/tests/repeat-bound.test.ts`: unit tests for placement and the bound.
- Instead tests are added to `plan/tests/issue-feedback.test.ts`.
- Two existing expectations were updated to the new contract:
  - `llm/harness-options/tests/bootstrap-completion.test.ts`: the JSON node entries now carry `step`/`label` "scrape".
  - `candidate/tests/submission-refusal.test.ts`: the refusal kind now carries the digest suffix.

## Commands run and observed results

All commands were run from `T/!FluxIQ`.
- `npx vitest run R/flow-bootstrap/authoring/tests R/flow-bootstrap/candidate/tests R/flow-bootstrap/plan/tests/issue-feedback.test.ts R/llm/harness-options/tests` gave `Test Files 42 passed (42)`, `Tests 430 passed (430)`. This was the final run.
- A wider run covering refusal output: the above plus `R/flow-bootstrap/plan/tests`, `R/activity/candidate/tests`, `R/activity/tests/narration.test.ts`, `R/activity/wording/tests`, `R/conversations/commands/tests/extension-chat.test.ts`, `R/llm/decision-handlers/tests/candidate-repeat-told.test.ts`, `R/llm/repeat-guard/tests/candidate-feedback.test.ts`, `R/service/flow-bootstrap-commands/tests` and `packages/fluxiq/src/ui/activity-action/tests`. It gave `Test Files 98 passed (98)`, `Tests 1022 passed (1022)`. This run came before the final corpus stale-check tweak and the fixture `source` type fix; both are test-only.
- `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` exited 0 with no output. The first run flagged `refusal-domain-fixture.ts(40,32)` (a spread `source`); I fixed that, and the rerun was clean.
- `node scripts/structure-audit.mjs` reported `structure-audit: 4 violation(s) across 2 rule(s)`, exit 1. **None is in a file I own:**
  - `as-never` in `activity/tests/narration.test.ts` (untracked, another worker);
  - `as-never` in `llm/decision-handlers/tests/candidate-repeat-told.test.ts` (untracked, another worker);
  - `as-never` in `service/candidate-failure/tests/submission-refusals.test.ts` (untracked, another worker);
  - `failure-as-empty` in `llm/repeat-guard/outcomes.ts:356` (modified by another worker).
  
  My files raise only advisory warnings:
  - `authoring/` has 24 source files (the hard limit is 25);
  - `authoring/tests/` has 17;
  - `assemble.ts` is 756 lines, `draft-routing.ts` 749 and `bootstrap-completion.ts` 653 (the limit is 800).

## Not verified

- The domain's real `resolveWebPlanNode` was not run. Domain resolution goes through the stub binding, which follows the rule quoted in the lane B analysis (`webPlanStepMustDeclare`). The issue paths it produces match the live refusal: `nodes.10` and `nodes.17` on lane B.
- Lane C was verified through `acceptAutomationStudioFlowBootstrapResult`, which covers assembly and routing as the brief asks. It was not submitted through the controller: its `extractList: extraction.1` handle tokens and record-output keys would need the real domain to resolve.
- No live or Lab run and no provider call were made. I did not check how the UI renders the new fields; that is `activity/**`, which I may not touch. Its tests pass.
- The draft (legacy) path has no locator. Its issues already name `draft.steps.N` and are unchanged.
- I did not re-run the before-fix state to watch the new tests fail. The lane C test exercises the exact refusal (`flow_script.repeat_body_is_routed`) that the brief reports from the live run. The corpus asserts fields that did not exist before this change.

## Open questions or contradictions found

- **`authoring/` is one file under the structure audit's 25-file hard limit.** The later worker who adds in-span `optional:`, `only after:` and `repeat pace:` will need to group files (for example the script-only lowering, or the locator pair) rather than add more.
- **The run key's digest is visible to the model** in the refused-in-a-row warning (`call:<category>:<8 hex>`), because `refusal-run.ts` prints the kind. It is harmless, but the owner of `llm/decision-handlers/refusal-run.ts` may prefer to print only the category.
- **The derived-step fallback is approximate.** A derived step with no `cause` is placed at the nearest written step before it, then after it. That is right for a join after its step, but would point at the step before a span for a loop node. Statements that lower into nodes should keep setting `cause`, as `routeAutomationStudioFlowScriptRepeats` now does after every span.
- `flow_draft.step_binding_source_missing` is listed as never reached by a written script, because a `$step.<label>` binding only names a labelled step of its own block, and that step always becomes a node. If a future authoring form can name a node that may be dropped, the corpus needs a case for it.
