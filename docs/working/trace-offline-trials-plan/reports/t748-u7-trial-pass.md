# t748-u7-trial-pass: name a looped trial act's pass

## Outcome

Done. If a trial step ran in more than one loop pass, each act it landed now reads
`trial step N, pass K of M "<label>"`, with `on "<control>"` after it when the control has words. If the step ran once,
or ran outside a loop, its act keeps today's words. The act ids and call refs were already distinct for each pass, and
I left them unchanged (details below).

## What changed and why

Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t748/!FluxIQ`, R = `packages/fluxiq/src/programs/automation-studio/runtime/`.

- `R/flow-bootstrap/site-reset/contracts.ts`: `AutomationStudioSiteResetTrialActPlace` gains an optional
  `pass?: { number; of }`. It sits on the place type so it travels inside `AutomationStudioCandidateTrialResult.acts`
  without touching `candidate/contracts.ts`, which this brief does not own.
- `R/service/candidate-trial/landed-acts.ts`: new `passesOf(steps)`. It takes the executed steps
  (`executed-steps.ts`) and counts, for each node, the steps that ran inside a loop pass (the step's `pass` is set, which
  covers both for-each and repeat). If that count is 2 or more, each of those steps gets `{ number, of }`. The number
  counts every pass the step ran in, landed or not, so a pass that landed nothing still takes its number. The pass is
  added to the act. A header paragraph explains this.
- `R/flow-bootstrap/site-reset/ledger.ts`: `trialRan` adds `passWords(act.pass)`, which gives `, pass K of M` only for a
  well-formed pass: safe integers with `of > 1` and `1 <= number <= of`. Otherwise it adds nothing. I added two header
  lines. The file grew from 624 to 632 lines.
- `R/service/project-build/acts-record.ts`: no code change was needed (see "Ids" below).
- Tests (generic library site: a renew button pressed in a loop over three loans):
  - `candidate-trial/tests/landed-acts.test.ts`: a new describe with 2 cases. In the first, three passes give three
    acts with pass 1, 2 and 3 of 3, and a step after the loop gets no pass. In the second, a pass that landed nothing
    still takes its number, and a one-pass loop gives exactly today's act. I also updated the first existing case,
    which had two loop passes of `add`, to expect `pass 1 of 2` and `pass 2 of 2`. This change is intended.
  - `site-reset/tests/ledger.test.ts`, 2 cases added to the existing file (no new file):
    - Three passes give `act-1`..`act-3` with the pass words. Each has a distinct sink ref, and a claim of one leaves
      the others in place.
    - A single-pass step keeps `trial step 3 "renew the loan" on "Renew"` and ref `trial.1#step-3`. A pass with
      `of: 1`, or with `number > of`, is ignored.
  - `project-build/tests/project-build-acts-record.test.ts`: 1 case. Three passes are written as three record
    entries, each with its pass words and its own classes.

**Ids.** Every pass is already its own executed step. `executed-steps.ts` folds an attempt into the previous one only
when that one failed on the same node; after a success, reaching the node again starts a new step, and the loop node's
attempt always sits between passes. So `${trialRunId}#step-${act.step}` was already distinct for each pass. Nothing
keys or dedupes trial acts in a way that could merge passes: `record()` makes a new `act-N` every time, the project
ledger keeps `ref` without deduping, and `acts-record` keys `declared` by that distinct ref. The new tests assert all
of this. The brief's premise that every act reads `trial step 10` does not match the debug's own line 37, which says
steps 7, 10, 13 and 16. The acts were told apart only by step number, with no pass and no control words. That gap is
what this change fills.

## Commands run and observed results

- Before implementation, with only the new tests added, on the working tree (which includes other t748 workers'
  uncommitted edits): `pnpm exec vitest run` over the three test files gave 4 failed and 62 passed.
  - The ledger pass-words case received `trial step 2 "renew the loan"`.
  - Both landed-acts loop cases received `pass: undefined`.
  - The acts-record pass case failed on the description words.
  - The single-pass ledger case passed, as expected. I did not swap HEAD files in from scratch: none of my files'
    behaviour was changed by the other workers' edits, so running before my edits is equivalent.
- After implementation, the same three files gave 1 failed: the existing landed-acts first case, which now carries
  `pass` for its two loop passes. I updated its expectation as described above.
- `pnpm exec vitest run` over `service/candidate-trial`, `flow-bootstrap/site-reset`, `service/project-build`,
  `service/subflow-trial`, `project-agents/supervisor`, `llm/deepseek/tests/system-prompt.test.ts` and
  `flow-bootstrap/plan/tests/issue-feedback`: **111 files, 945 tests passed**.
- `node scripts/structure-audit.mjs` (Core root): `structure-audit: passed (436 warning(s), 1152 baselined)`, plus "1
  baseline entries can be lowered". That entry is not mine.
- `pnpm exec tsc --noEmit --incremental` in `packages/fluxiq`, with the tsbuildinfo in scratch: no output, no errors.

## Not verified

- No live or Lab run, and no domain (extension) test.
- I did not check whether the domain shows trial acts' `did` anywhere else that pins the exact words. Core tests with
  single-pass steps are unchanged.
- The pass number counts the passes the step ran in, not the loop's own `index`. The two agree when the body step runs
  in every pass. If a branch skips the step in some pass, the act's "pass 2 of 3" can differ from the feedback's
  absorbed-refusal "on pass 3" (`absorbed.ts`, the loop index).

## Open questions or contradictions found

1. Pass numbering: I chose to count the passes the step ran in, because `repeat` gives no `count` and the brief asks
   for "of N" over the passes the step ran in. If the supervisor wants it to match the feedback's loop index, for-each
   could use `index + 1` and `count`, but repeat still has no total.
2. Steps a node runs several times outside a loop (a route back) get no pass, which keeps the t593 and t475 tests'
   semantics. If those should be numbered too, drop the `step.pass` condition in `passesOf`.
3. Proposed doc text (for the reset/trial-acts architecture doc): "A trial step that ran in more than one loop pass names
   its pass in each act's words, `trial step N, pass K of M "<label>"`, where K counts the passes the step ran in. A
   step that ran once keeps `trial step N "<label>"`. Every pass is its own step, act and call ref
   (`<trialRunId>#step-N`)."
