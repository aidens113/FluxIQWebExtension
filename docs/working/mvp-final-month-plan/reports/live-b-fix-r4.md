# live-b-r4-fix report (worker-high, 2026-10-07)

Brief: "### Brief: live-b-r4-fix" in `reports/live-b.md`. Run evidence:
`test-runs/instances/t262-slot-3/run-muxkyfxz-446c3a4e/steps/0028-0031`.

## Outcome

Done. Core no longer accepts a claim of an act on a press that changed nothing
anyone could see. A new act-judge fault, `step_changed_nothing_seen`, applies
to every kind of act. The claim is refused as it is made, through the existing
`act_not_done_there` path (both `core.run_node` add+act and `amend_draft`), and
the refusal says how out. Red-then-green test is in Core. Domain unchanged.

## Answers

**(1) Where `pageChanged` and the draft's `changed: yes` come from.**

- `pageChanged` is computed in the domain:
  `domain/src/runtime/llm-evidence/node-run/run.ts` (about line 418),
  `JSON.stringify(after.evidence) !== JSON.stringify(current.evidence)`. That
  compares the whole sanitized packet, which includes each element's `box`
  (x/y/width/height) and `onViewport`. The press scrolled the chooser's list,
  which moved the list items' boxes, so the packets differed even though the
  printed page text (`page.txt`) of 0028 and 0030 is byte-identical (`cmp`
  reports IDENTICAL). The extension's second press ("the page ignored the first
  press, so it was pressed once more") changed nothing visible either.
- The draft line `changed: yes` is not a page comparison. `flow-draft/entry.ts`
  line 206 prints `step.effectApplied`. The domain reports
  `effectApplied: true` for every node whose command succeeded (`run.ts`, "The
  node ran and the command succeeded, so this step worked").
- The domain also sends `changed` lines on the draft statement
  (`press-effect/change/statement.ts`). For this press there were none, so
  `changed` was absent: Core reads an absent `changed` as "host said nothing"
  rather than as "nothing changed".
- The host's state digest (`domain/.../state-digest/state-digest.ts`) leaves
  out `box`, `onViewport` and `viewport`. So `stateBefore === stateAfter` on
  that step: Core already held the evidence that nothing changed and never
  read it for acts.

**(2) Why the act judge accepted a1 on step 12, and whether the run_node claim gets the same check.**

- It gets the same check. `llm/evidence-loop.ts` line 212 sends
  `core.run_node` with `add` and `act` to
  `automationStudioLlmEvidenceClaimWrittenAct`
  (`llm/decision-handlers/amendment.ts`). That calls `draft.claimRefused`,
  which is `automationStudioInstructedActClaimVerdict`, the same judge
  `amend_draft` uses through `applyAutomationStudioFlowDraftAmendments`. The
  test `llm/decision-handlers/tests/claim-refused.test.ts` already covers both
  entry points.
- The judge accepted for two reasons:
  - a1's verb "switch" has kind `set`. `act-evidence.ts` judges only `LASTING`
    kinds (add_to, save, claim, submit, move), so `set` and `open` were never
    read.
  - None of its rules looked at whether the step changed anything. `step-fault`
    `step_changed_nothing` fires only for a read or a failed step
    (`effectApplied: false`), and this step had `effectApplied: true`.
- The contrast with 0057/0058: a3 is `add_to`, so the act judge read it.

## What changed and why

All in Core (`C:/Users/osrs_/FluxStuff/fxwork/t262/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/`):

- `flow-bootstrap/instructed-acts/act-evidence.ts`:
  - New private `changedNothingSeen(step)` returns true when all of these hold:
    - the step is a mutate step and `effectApplied` is true;
    - it is not written, has no checked candidate and no prior execution;
    - both digests are present and equal;
    - it has no `changed` lines, no `toggle` and no `interruption`.
  - `automationStudioInstructedActStepDidInstead` checks this first, for an
    act of any kind and whatever the control's words, and returns
    `step_changed_nothing_seen`.
  - The fault is added to `EVIDENCE_FAULTS`, so `claim-verdict.ts` refuses it
    when the claim is made and the checklist gives a `todoSaid`.
  - `automationStudioInstructedActEvidenceSaid` words the fault. When no draft
    step can take the act (`instead`), the new `unseenWayOut` gives the way
    out:
    - It names the words the doing control would carry: the act's verb plus
      the kind words that appear in the person's quote ("switch" or "store",
      which "Set as my store" matches). It says to press that control next to
      the pressed control, not the pressed words themselves.
    - If the pressed control's own words already name the act, it says the
      page ignored the press and to press it again.
  - When the draft has a pressed "Set as my store" step that changed the page,
    `instead` names that step, as for the other evidence faults.
  - The header comment is updated.
- `flow-bootstrap/instructed-acts/contracts.ts`: new
  `AutomationStudioInstructedActMissingReason` member
  `step_changed_nothing_seen`, with its doc; `instead` doc updated.
- `flow-bootstrap/instructed-acts/checklist.ts`: the fault is added to the
  `AutomationStudioInstructedActEvidenceTodo` union.
- `flow-bootstrap/instructed-acts/check.ts`: new `UNSEEN_INSTRUCTION` entry in
  `REASON_INSTRUCTIONS`.
- `flow-bootstrap/unfinished-build/not-done.ts`: a person-facing clause for
  the reason. `TODO_WORDS` is an exhaustive Record, so the type requires one.
- `llm/draft-amendment-feedback.ts`: only the `act_not_done_there` text, which
  now adds "or changed nothing on the page at all". The `settings_rewrite_run`
  line in the same file's diff is NOT mine; another lane edited it in this
  tree at the same time.
- New test:
  `flow-bootstrap/instructed-acts/tests/unchanged-press.test.ts`. It
  reproduces step 9 (the chooser opened) and step 12 (the store's name
  pressed, digests equal) from the run, and checks:
  - the claim verdict refuses a1 with the sentence;
  - the checklist reports `step_changed_nothing_seen`;
  - `instead` names a "Set as my store" step that changed the page;
  - it does not catch a press whose digest moved, a press with a `toggle`, a
    press with `changed` lines, or a host with no digests;
  - an add whose cart count rose still stands.

Other changes in this Core tree that are not mine: `flow-draft/amendment/apply.ts`,
`flow-draft/amendment/settings-rewrite-run.ts` and its test (another lane's work
in progress).

## Commands run and observed results

All from `fxwork/t262/!FluxIQ` or `packages/fluxiq`.

- `git status --short` before editing: Core clean. Downstream had only docs
  modified or untracked (`live-b.md`, two debug notes).
- RED: `npx vitest run src/.../instructed-acts/tests/unchanged-press.test.ts`
  gave `Tests 3 failed | 2 passed (5)`:
  - "is refused as it is made ..." failed with "expected undefined to match
    object { act: 'a1' }". The claim was accepted, as in the run.
  - "is not done on the checklist ..." failed with "expected { id: 'a1', verb:
    'switch', …(2) } to match object { todo: 'step_changed_nothing_seen', step:
    12 }". a1 was shown done.
  - "names the step ..." failed with "expected undefined to match object { act:
    'a1', instead: 13 }".
  - The two guard tests passed.
- GREEN: the same command gave `Tests 5 passed (5)`.
- Neighbours, run twice:
  - `npx vitest run` over `flow-bootstrap/instructed-acts/tests`,
    `flow-bootstrap/unfinished-build/tests`, `flow-draft/amendment/tests`,
    `llm/decision-handlers/tests`, `llm/evidence-loop/tests`,
    `llm/harness-options/tests` and `llm/tests`: `Test Files 117 passed (117)`,
    `Tests 1569 passed (1569)`.
  - `npx vitest run` over `runtime/flow-bootstrap`, `runtime/flow-draft` and
    `src/ui/activity-action`: `Test Files 131 passed (131)`,
    `Tests 1908 passed (1908)`.
  - After the test typing fix, `instructed-acts/tests` alone:
    `11 passed (11)`, `332 passed (332)`.
- `node scripts/build-cache/cli.mjs fluxiq:check`:
  - First run failed with TS2379 in my new test, because
    `stateBefore: undefined` is not allowed under exactOptionalPropertyTypes.
    I fixed it with `delete`.
  - Rerun exited 0: `{"step":"fluxiq:check","reason":"no stamp; stored in the
    shared store ..."}`.
- `node scripts/build-cache/cli.mjs structure-audit:check`:
  `structure-audit: passed (277 warning(s), 349 baselined).` The brief's
  `pnpm structure-audit:check` does not exist as a script ("Command not
  found"); the build-cache step is the equivalent.
- I did not run `pnpm build`, any full suite, the domain typecheck (the domain
  is unchanged), or a live run.

## Not verified

- The run's actual `stateBefore` and `stateAfter` for step 12. The run
  artefacts do not record digests (searched `steps/`, `snapshots/`). Equality
  is inferred: the page text is byte-identical, and the digest leaves out only
  layout and scroll fields. If some digested field outside the printed view
  changed, the fix would not fire on this exact run.
- Live behaviour: no Lab run. Core `dist` was not rebuilt, so the lane does not
  pick this up until the supervisor rebuilds.
- Pages that settle after the post-press capture (for example a cart badge
  updated late) would read as "changed nothing" and be refused. The way out
  (press again, keep the press that changes the page) covers it, but this is
  not exercised live.

## Open questions or contradictions found

1. Remaining gap in the same run: before step 12, a1 sat on step 5, the press
   of "Pickup or delivery? Carden Falls Supercenter" that opened the chooser,
   and the act judge still does not judge `set` acts by their words or by what
   they changed. With this fix the step-12 claim is refused, but a1 stays done
   on step 5 on the checklist, which hides the act there. A rule that "a set
   act claimed on a press that only opened a layer is not done" would need
   its own evidence.
2. The domain's `pageChanged` still compares whole packets including element
   boxes, so the model is told `pageChanged: true` after a press that only
   scrolled, and is not given `unchangedPress`. Basing it on the state digest
   (or the change walk) would make it honest. I left it unchanged: it is a
   domain contract change, outside the smallest fix.
3. The brief's `pnpm structure-audit:check` is not a Core script; the
   build-cache step above is what `pnpm check` runs.
