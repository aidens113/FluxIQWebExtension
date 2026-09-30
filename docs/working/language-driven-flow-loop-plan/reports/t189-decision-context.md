# t189 — decision context (what the model is sent, and why it repeats)

Lane lead t189, 2026-09-29. **Status: Phase 1 partial; stopped early for a machine restart.**
Reading only: slot-1 existed, so a live run was active and no build, test or dry run was started.
No product code changed and no worktree was created.

Code read: Core in the t174 tree, `C:\Users\osrs_\FluxStuff\fxwork\t174\!FluxIQ` (`259a11b` plus
the uncommitted t174 changes the runs used). Paths below are relative to
`packages/fluxiq/src/programs/automation-studio/runtime/`. Evidence:
`C:\Users\osrs_\FluxStuff\fxwork\t174\!FluxIQWebExtension\docs\working\language-driven-flow-loop-plan\debugs\run-munaiz76-7026748c.md`
(run 4), `...\debugs\run-muncqlr0-3348202b.md` (run 6), `...\reports\t174-live-lane.md` and
`...\reports\t174-w3-bigbox-refusals.md`.

## Phase 1 findings so far

### What one decision is sent

`llm/evidence-loop.ts:546-569`. Each decision gets the offered tools, a decision schema, and
`shown = [...window, draftEntry, budgetEntry]`:

- `window` is `automationStudioLlmEvidenceContextWindow(evidence, maxEvidenceContextBytes - besideBytes, …)`
  (`llm/context-window.ts:82-119`).
- `draftEntry` is `automationStudioFlowDraftEntry({ steps, maxBytes: draftBytes })`
  (`flow-draft/entry.ts:96-143`).
- `budgetEntry` is added from the second decision on.

Everything the model knows about its past comes through these three. The task instruction and
system prompt are added by `input.decide` in the harness; I have not read that path yet.

### Gaps that let the model repeat itself

**G1. Core's own feedback leaves the window with no trace.**
- Refused completions (`core.completion_feedback.N`, `evidence-loop.ts:609-612`), dry-run
  refusals, amendment refusals (`evidence-loop.ts:681-688`), answered-repeat notes
  (`evidence-loop.ts:433`), no-progress redirects (`:323-326`) and unusable-decision feedback
  (`:578-580`) are all pushed without a `call` summary.
- `context-window.ts:42-48` says such notes "leave the window without a line", and
  `historyLine` (`:167-170`) lists only records that have a `call`.
- `priorityOrder` (`:122-135`) keeps only the newest entry per `toolId` as "current". Every
  completion refusal shares one toolId, so each earlier refusal is "older" and among the first
  to be evicted.
- Consequence: by the fourth or fifth refused completion (run 4) the model cannot see that its
  earlier completions were refused, or for what. It cannot tell "the same refusal again" from
  "a new one".
- `stepsWithoutProgress` counts appear in the notes, but there is no persistent refusal ledger.
- Fix direction: a small, always-shown "refusals so far" entry beside the draft, like the draft
  itself (for example `core.completion_history`, listing iteration, issue codes and the
  act/limit named), or a history line for Core notes. Owner: `llm/context-window.ts` or a new
  `llm/evidence-loop/` module.

**G2. A request answered from memory is invisible in the draft.**
- `answerRequest` records the step with `proposes: false, effectApplied: false`
  (`evidence-loop.ts:425`).
- The draft entry lists only `automationStudioFlowDraftStepIsAction` steps
  (`flow-draft/entry.ts:105`), that is `proposes ?? effect === "mutate"` (`flow-draft/step.ts:200-202`).
- Consequence: the model's repeated asks (11 of 37 decisions in run 6, in runs of 4 and 7)
  never appear in the one record that is always shown. Only the per-iteration note does, and
  that note is a Core note subject to G1.

**G3. A failed or no-effect action reads as "already out; do it again".**
- A step with `effectApplied: false` is shown `did_not_work`, and the draft instruction says "A
  did_not_work step is already out: only rerun changes it" (`flow-draft/entry.ts:43` and
  `:308-310`).
- A step whose domain result says `proposes: false` is not listed at all.
- Hypothesis for run 6, pending the domain check: `pick-millbrook` reloads the page, so the
  domain's post-condition could not confirm the effect. The step was then `did_not_work` or
  unlisted, never proposable, and the model re-picked 3 times.
- Answering this needs `domain/src/runtime/llm-evidence/node-run/run.ts` (how `effectApplied`
  and `proposes` are set across a reload, and whether the evidence carries a post-action page
  observation). This was dispatched to an Explore agent and had not returned at stop time.

**G4. The draft's own projection drops arguments, then steps, under its byte budget.**
- Trimming order (`flow-draft/entry.ts:155-181`): shorter instruction, then arguments withheld
  oldest first, then the oldest steps dropped and counted as `unlisted`.
- A single argument over `MAX_STEP_INPUT_BYTES = 512` (`:77`) is replaced by `inputTooLarge`.
- In a long build (run 4, about 30 steps), the early steps' arguments are the first to go, so
  the model cannot see what it already clicked or typed. This is not measured for runs 4, 6 or 7,
  because `draftShown` is not in any bundle.

**G5. What the model was sent is unrecoverable after a run.**
- `llm/evidence-loop/progress-trace.ts` is content-free by design: it logs `kind`, `resultCode`
  and completion issue codes only.
- It records neither `missingActs[].id/reason` nor `limitsExceeded[].limit`, and not
  `effectApplied` (`progress-trace.ts:43,52-54`, per w3). Nor does it record whether an
  answered request was `already_answered`, `already_observed` or `not_offered`.
- The Lab deletes the Core store, so the loop trace rows with `draft` (`draftShown`) are lost
  on a failed build.
- Every "what was it asked" cell in both debugs is NO EVIDENCE for this reason.
- Fix direction: log the code-shaped fields (act ids and reasons, the limit name,
  `effectApplied`, the answered-request code, `draftShown` counts), or keep the loop trace on
  a failed build.

**G6. The missing-act refusal cannot say which step to change.** This is w3's finding, which I
agree with from its citations.
- `flow-bootstrap/instructed-acts/check.ts:130-138` falls back to in-order claim assignment.
  Completion #1 in run 6 passed with a consent click and a chip click.
- `instruction-acts.ts` folds "add A … and B" into one act, and both acts carry the same
  200-character quote.
- So the refusal can only name an act. It cannot say that step N is not that act, or that the
  napkins add is missing.
- Still to read: the exact feedback text built from `missingActs`
  (`llm/harness-options/bootstrap-completion.ts:292-298`, `llm/evidence-loop/completion-attempt.ts`).

### Not yet read (next step)

- `llm/evidence-loop/completion-attempt.ts` and `completion-check.ts`: the completion feedback
  text.
- `flow-draft/dry-run.ts:176-214`: the dry-run instruction text.
- `llm/evidence-loop/answered-request.ts`, `no-progress.ts` and `stall-redirect.ts`: the note
  and redirect text.
- The harness `decide` prompt: whether the instruction is resent every decision, and whether
  earlier decisions' own text is ever included. It appears not to be; only evidence entries are
  sent. To confirm in `llm/harness/run.ts` and `llm/stages/`.
- The domain `node-run/run.ts` reload answer (G3).
- Core `dev` (`e85a02a`) versus the t174 tree for these files, before any Phase 2 edit.

## Next step

1. Finish the "not yet read" list above.
2. Write a replay fixture in Core `runtime/tests/deepseek-bootstrap-exploration.test.ts` style,
   reproducing run 6's sequence: pick, reload, answered-from-memory ×7, refused completion ×2.
3. Fix G1 to G3 in their owning modules. G5 is instrumentation.

This is only once slot-1 is free and the worktree exists
(`pnpm task start decision-context --worktree --core` from `C:\Users\osrs_\FluxStuff\!FluxIQWebExtension`).

Overlaps to watch: t186 (grants, `llm/**`) and t188 (`flow-bootstrap/plan/limits.ts`,
profile-limits). None of G1 to G6 touches those files.
