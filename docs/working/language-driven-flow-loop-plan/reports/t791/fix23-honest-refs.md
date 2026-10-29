# t791 fixes 2 and 3: honest refs (report)

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t791/!FluxIQ` (branch not switched, no mutating git, no Lab run, no model call).
Root R = `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap`.

## Outcome

Done, with the checks below. Fix 1 (page refs) and fix 4 (unwitnessed trials run) are built on, not undone.

- **Fix 2.** A step with no witness is only ever offered refs read in its own tab. `canMeet` is `no_call` when no call in that tab can make a witness, and its words say the trial is judged by its end view and done-when checks only. This holds at the step door's refusal, at submission (a note on the accepted revision, candidate and subflow), and before a trial (fix 4's note).
- **Fix 3.** A landed exploration press that names an issued ref which witnesses nothing now carries `resetDestinationUnreached: { ref, instruction }` beside the tool's answer.
- **Integration.** `unwitnessed?` is on the admit branch of `AutomationStudioSiteResetStepAdmission`; both gates read it typed, and the validating reader is gone from them; stale comments and builder words are fixed.

## What changed and why

**How a step knows its tab.** It did not: a plan node carries only `resetWitness`, and an unwitnessed node carries nothing. So the step door now keeps it. `admitStep(declared, operation, ask?)` records, per node (definition plus `<subflow>.<node>`), the tab its control sat in and whether it names any item, page or list. A trial step carries the same node key (`trial-steps.ts`, new `definitionId` and `ref`), so `admit` finds it again.

New files (R/reset-admission/):
- `step-reach.ts`: `automationStudioSiteResetStepReach({ resource, identified, issuedHere, sealed })`. `no_call` when the control names no tab, names nothing to read, or the build is sealed and the tab holds no issued ref; otherwise `another_page`.
- `step-resources.ts`: bounded per-node record of what the step door saw (shared through `createBaselines.steps`, so every brief's ledger sees it).
- `step-gaps.ts`: `AutomationStudioSiteResetStepGaps` (`reach`, `ofNode`, `asked`), and the types `AutomationStudioSiteResetStepAsk` (an out slot `gap` the ledger fills, so wrappers that forward `admitStep` need no change), `...StepGap`, `...StepReachAnswer`, `AutomationStudioPlanStepGaps`.
- `unwitnessed-advice.ts`: one advice line per noted step of an accepted plan, by label.
- They live in reset-admission, not site-reset, because site-reset is at the 25-file limit and cannot take a subdirectory (depth limit).

New file (R/site-reset/): `press-notes.ts` (fix 3).

Edited:
- `create-baselines.ts`: `issuedRefsIn(resource)`, `isSealed()`, `steps` registry; `known()` offers `issuedRefsIn` and `sealed`.
- `reset-admission/{admission,contracts,trial-steps,index}.ts`: step-door refusals use `issuedRefsIn` and `stepReach`; port members `issuedRefsIn?`, `sealed?` (optional, so hand-built test ports compile); stale header comment replaced.
- `site-reset/ledger.ts`: `admitStep` takes `ask`; `createBaseline` and `explored` feed the press notes. Held at exactly 800 by condensing comments (no behaviour in them).
- `site-reset/project-ledger.ts`: `stepReach(step)`. `project-reset.ts`: `admit` gives each step its own reach; `unwitnessed-step-words.ts`: `ran(entries)` says per step the refs of its tab or the `no_call` words, once if all share them.
- `site-reset/contracts.ts`: `unwitnessed?` on the admit branch, `admit` and `StepAdmission` docs reworded (refuse branch kept, documented as a reset's own), `admitStep` signature, `TrialStep.definitionId/ref`, `Explored.note`.
- `words.ts`: `stepWitnessRequired` covers a page read whole and the tab; new `stepWitnessUnreachable()`, `destinationUnreaching(ref)`; `actionDeclarations` and `destinationUnissued` say "list or whole page". `undoes-tool.ts` description the same. No site is named; the example is generic.
- `trial-stamp.ts` header: no longer says the trial door refuses.
- `candidate/submission.ts`: advice now also carries the unwitnessed lines.
- `subflow-candidate/scoped-submission.ts` and `builder-loop.ts`: forward `advice` to the accepted subflow evidence.
- `candidate/trial-gate.ts`, `subflow-candidate/subflow-trial-gate.ts`: read `admission.unwitnessed` typed. `automationStudioTrialUnwitnessedOf` stays exported (its own test uses it).

**Outside the owned list (small, needed, none on the must-not-touch list):**
- `action-permissions.ts`: `planStep` passes an ask and notes gaps (`planStep.gaps()`, a property on the function, read by the submission controller); the explored call object keeps its `note`, which is put beside the answer as `resetDestinationUnreached`.
- `subflow-candidate/builder-loop.ts`: one line, `advice` in the accepted evidence.
- `reset-answers`, `service/project-build` forwarders: not touched. The out-slot design avoids them.

## Commands run and observed results

- New and changed single files (`npx vitest run`): `reset-admission/tests/step-tab.test.ts` and `step-door.test.ts` 15 passed; `reset-admission/tests/unwitnessed-advice.test.ts` 2 passed; `tests/action-permissions.test.ts` 37 passed (includes the fix 3 test and the planStep gap test); `candidate/tests/reset-witness` 7 passed (includes the submission-note test); `site-reset/tests/refusal-sites.test.ts` 8 passed.
- Core `pnpm test` over site-reset, reset-admission, candidate, subflow-candidate, trial-change, under the lock: one failure, `refusal-sites.test.ts` (a sealed creation's refusal is now `no_call`); fixed the test (it now asserts `no_call` when sealed with no ref in the tab, and `another_page` when sealed after the tab's ref was issued); re-run, 8 passed.
- Second `pnpm test` (above dirs plus `flow-bootstrap/tests`, `service/project-build`, the 3 prompt tests: `llm/deepseek/tests/system-prompt.test.ts`, `plan/tests/extraction-vocabulary.test.ts`, `plan/tests/issue-feedback.test.ts`), under the lock: **145 files, 1301 tests passed; and 7 files, 35 tests passed**. The grep for "prompt-contract" in tests finds nothing; I used the three files fix 4 named.
- `NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit -p .` in packages/fluxiq: my errors fixed; the only remaining error is `project-agents/supervisor/tests/left-on-target.test.ts(257,72)` (TS2352), which is in a must-not-touch path and is not mine.
- `node scripts/structure-audit.mjs`: after moving files (directory limits 25, depth 9, barrel imports, import cycle), no FAIL lines.
- After the last file moves (new files into reset-admission), the structure audit was clean and these ran directly, without the lock (12 files): `reset-admission/tests` (all 7 files), `tests/action-permissions.test.ts`, `candidate/tests/reset-witness`, `site-reset/tests/{project-reset,refusal-sites,create-baselines}.test.ts`: **12 files, 137 tests passed**.
- The post-move whole-package `tsc` and the directory `pnpm test` were queued under the shared lock for about 50 minutes (other workers' `pnpm check` and a Playwright run kept re-taking it) and I stopped the queued job rather than leave it to be killed while holding the lock. They have NOT been re-run since the move. Before the move both were green apart from the other worker's `left-on-target.test.ts`; the move changed only import paths and file locations.

## Not verified

- No live or browser run, no Lab run. Whether the real extension gives a step's control a `resetResource` at submission (so `identified` and `resource` are known) is unobserved; if it does not, a step is `no_call` at submission although a call could make a witness in its tab.
- The node key is `<subflow>.<node>` plus the definition. Two subflows with the same keys in different briefs of one build would share a registry entry (the latest ask wins), so the tab shown for one step could be the other's. Not observed; bounded to wording.
- Steps whose node the step door was never asked about (for example a predecessor plan from another session) are told `another_page` with no refs offered, rather than guessed.
- Downstream repo untouched; its e2e that expects `candidate.trial_step_unwitnessed` (fix 4 report) still needs updating.

## Open questions or contradictions found

1. `AutomationStudioSiteResetIssuedRef` still has no tab field, so `issuedRefs()` (all tabs) is still what places and the reset loop use. Only step-facing words were filtered, as briefed.
2. The out slot (`ask.gap`) and the function property `planStep.gaps` are conventions chosen to avoid editing forwarders (`service/project-build/acts-record.ts`, `reset-calls.ts`) and `service.ts`. If the lead prefers explicit ports, they can be replaced later.
3. A press naming a ref that shows nothing but whose press is witnessed another way (own list, toggle, repeat) gets no note, since the press is not unwitnessed. Only the unwitnessed case is told.
4. Another worker's `left-on-target.test.ts` fails whole-package tsc (above).
