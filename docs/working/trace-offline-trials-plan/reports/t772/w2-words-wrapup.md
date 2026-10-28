# t772 w2: words and wrap-up

Outcome: Partial (R4a, R4b, R4c done; R3 done by the fallback, not the exemption).

## What changed
- brief-ports.ts: `told` exported (for test); a call naming an act under `undoes` is never given `outsideBrief` in any role. Build-role note now says the act is recorded as the build's act, undone before a trial, and that if the request needs that change the plan's lasting classes are wrong: say so in the return so the supervisor can amend with `project.amend_plan` (exists: project-agents/dispatch/ending.ts, supervisor/guidance.ts). Reset note: dropped only "and do not do it again".
- site-reset/words.ts `retryRefused`: "go back to that page, look again, and press the same control by its handle in the newest view, naming that list's ref as resetDestination". Other "same as before" hits in the tree are unfinished-build judge text and repeat-guard comments, not reset words; untouched.
- llm/loop-budget.ts `candidateWrapUpInstruction`: added "If a trial is refused as candidate.trial_step_unwitnessed, nothing can give that step a witness now, because exploring is withheld: end blocked, naming that step."
- Tests: new service/project-build/tests/project-build-told.test.ts; words.test.ts (new assertions, dropped "make that call again" which the new wording replaces); loop-budget.test.ts (new words test, updated pinned default wrap-up string).

## Why R3 is the fallback
The refusal lists steps as `{step, label}`; a run_node carries a control and a resetDestination ref. Nothing maps a run_node to a step number, and the loop (evidence-loop.ts, `wrapUp.withholds(toolId, input)`) holds no handle on the latest refusal. An exemption keyed on "any resetDestination" would be too loose; a mapping needs a downstream-aware seam. Not built.

## Commands
- Failing first: `node ../../scripts/vitest-groups.mjs --groups=parallel <told, words, loop-budget tests>` -> 5 failed | 45 passed (told is not a function x3, retryRefused wording, wrap-up words).
- After: same three files -> "all groups passed: parallel". Earlier run with project-build-brief-ports and project-build-reset tests included: only the two expectations above failed, both fixed.
- `tsc --noEmit` (package): no errors in my files. Remaining errors are in site-reset/tests/own-control-agreement.test.ts (another worker's, with a modified undo-claims.ts in the tree).

## Not verified
- After the last test-typing edit I re-ran tsc only, not vitest on project-build-told.test.ts (it passed one edit earlier).
- project-build-brief-ports/reset tests were not re-run after the final fixes; no prompt-contract test files exist in Core (grep found none).
- `told` is a second export in brief-ports.ts; the structure audit was not run.
