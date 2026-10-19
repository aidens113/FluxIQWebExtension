# Fix F1: reset ledger, an act whose destination shows no change

Worker report, 2026-10-19. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t719/!FluxIQ`, branch
`task/t719-site-reset-undoable-acts`. Nothing was committed.

## Outcome

Done. Both shapes now let the trial run. Office r1 is a creation admitted against an unchanged destination.
Job r1 is a set of presses with no list of their own, made while the list they land in stayed unchanged. In
both, the act is listed under `startedWith.cannotUndo`, and its `did` ends with
"(left on the site; a complete read of its destination taken after it showed that destination exactly as first
observed)". `automationStudioCandidateStartedWithSaid` passes that text on to the trial judge, and a test proves
it. Every listed refusal case still refuses.

## What changed and why

All paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/`.

- `site-reset/destination-unchanged.ts` (new, one export, added to the barrel): the general rule as a pure
  function, `automationStudioSiteResetDestinationUnchanged`. Each destination group of the act must meet all
  of these:
  - it had a complete original read before the act;
  - it had a complete read after the act (`groupObservedAfter >= sequence`);
  - that fresh read holds exactly the original scopes, and each scope matches its original row for row,
    in the same order and with the same values (`collectionRestored`).

  In addition, at least one destination group held none of the act's subject or page tokens. The act's
  destination is chosen in this order:
  1. the group its creation was admitted against;
  2. otherwise, the group of the list its control sat in (that list must have been read before the act);
  3. otherwise, for a control in no list, every group read complete before the act.

- `site-reset/create-baselines.ts`: added `destination(declared, reference)`, which returns `{ scope, group }`
  for the original a create_new is admitted against, or undefined. `check` now uses it, and its behaviour and
  return shape are unchanged.
- `site-reset/contracts.ts`: `AutomationStudioSiteResetExplored.resetDestination?: string`.
- `action-permissions.ts`: passes the call's `resetDestination` on to `siteReset.explored` for calls that
  are not undos. Nothing else changed there.
- `site-reset/ledger.ts`:
  - `explored` stores `act.destination`, which it resolves through the shared create baselines.
  - The new private `leftUnchanged(act)` is checked again at each use, so if the destination later changes
    the act is pending again.
  - A left act is no longer listed under `toUndo` or `inPlace`, and `unprovedReset` no longer refuses on it.
  - It is added to the kept list with the annotated `did`, so it reaches `startedWith.cannotUndo`.
  - `beforeTrial` skips the page look for a left act.
  - A claim on a left act is answered `candidate.undo_act_kept` and nothing is pressed.
  - Added a header note.
- `site-reset/words.ts`: one generic sentence, `leftUnchanged()`.

**Deviation from the brief:** I did not change the return value of `check` itself. Three tests outside my
ownership compare its result to `{ kind: "admit" }` with `toEqual`:
`service/project-build/tests/reset-calls.test.ts` (lines 17 and 24) and `project-build-acts-record.test.ts`
(line 54). Instead, `action-permissions.ts` passes the ref through `explored`, and the ledger resolves it with
the same admission predicate. `service/project-build/reset-calls.ts` already forwards `explored` and
`createBaseline` unchanged, so project builds keep the destination without any edit there.

## Commands run and observed results

All commands were run from the Core worktree.

**Tests first, before the fix.** `npx vitest run site-reset/tests/{ledger,ledger-subject,create-baselines}.test.ts flow-bootstrap/tests/action-permissions.test.ts`
gave "4 failed | 160 passed". These were the four new positive cases:
- the ledger shape returned `kind: 'refuse'`;
- the job shape returned `kind: 'refuse'`;
- `baseline.destination is not a function`;
- the pass-through check got `[undefined]` instead of `['destination-1']`.

The new refusal cases already passed.

**After the fix:**
- `npx vitest run src/.../site-reset/tests src/.../flow-bootstrap/tests/action-permissions.test.ts`
  gave "Test Files 11 passed (11), Tests 217 passed (217)".
- Neighbouring tests:
  `npx vitest run flow-bootstrap/tests/site-reset-{build,calls,irreversible}.test.ts service/project-build/tests/{reset-calls,project-build-acts-record,project-build-brief-ports}.test.ts`
  gave "2 failed | 39 passed". Both failures expect `WORDS.undoRefused()` to contain
  "this act stays as it is". `git show HEAD:` of `words.ts` contains that string 0 times, and I did not change
  `undoRefused`, so these two failures were already there before this change.
- `cd packages/fluxiq && npx tsc --noEmit -p tsconfig.json` gave exit 0 with no output.
- `node scripts/structure-audit.mjs`: the first run failed on statement-packing in my new
  action-permissions test (line 85). After I fixed it, it printed "structure-audit: passed (405 warning(s),
  1152 baselined)". Advisory warnings only: `ledger.ts` is at 775 lines (limit 800) and its class has 27
  methods (advisory 25, limit 40).

## Not verified

- No live, browser or paid run, and no full suite.
- Whether the real domain's subject or page tokens on the office Buy Now and the job heart press are absent
  from their destinations' subject tokens. The rule needs that, and both debugs say it held, but I checked it
  only with test data.
- That the reset brief's own preflight failure is fixed. That is F3, not this brief.

## Open questions or contradictions found

1. **Fallback scope.** For a control in no list, the destination is every group read complete before the act.
   I took this from the job debug, because a save declares no destination. It is the broadest part of the
   rule: an act whose real effect lands somewhere never read is listed as left with no change seen. Its judge
   is told, but no undo is owed. The supervisor may want to narrow it.
2. **Wording on refused claims.** A claim on a left act gets `WORDS.keptAct()`, which still says a reversible
   effect "requires proved baseline restoration before an ordinary trial". For a left act that is slightly
   misleading. I kept this so that `project-agents/supervisor/left-on-target.ts`, which detects kept acts
   through that claim code, still names the act at the end of the build.
3. **Two stale tests.** `site-reset-build.test.ts` and `site-reset-calls.test.ts` (outside my ownership)
   already fail at HEAD on the "this act stays as it is" wording.

## Continuation (2026-10-19): named destinations, no trial on leftovers, keptAct wording

The continuation builds on the commit `133c9ebe` in the same worktree. Nothing was committed. Open questions
1 and 2 above are resolved here.

### Outcome

Done. Two changes:

- An act whose control sits in no list now settles only against a destination named for it.
- No trial runs while a reversible act is still to undo.

### What changed and why

All paths are under `flow-bootstrap/`.

**1. Narrowed fallback.**

- **`site-reset/create-baselines.ts` `destination()`.** Any reversible act can now name where its effect would
  show (classes `create_new`, `modify_existing`, `delete`, all mutate). It does so through an issued ref only,
  with the same resource and a valid group. An identified create_new keeps its existing behaviour: by ref or by
  its own scope, with its subject absent there. `check` is unchanged.
- **`site-reset/ledger.ts` `leftUnchanged`.** The rule that counted every group read before the act is gone.
  An act's destination groups are now:
  - the named destination;
  - plus, for an act that is not a create sent elsewhere, the list its control sat in, which must have been
    read before it. An unread own list refuses.

  If neither applies, the act refuses as before.
- **Naming after the act.** A destination can also be named after the act: `explored` on a call under
  `undoes` that carries `resetDestination` sets it once and never renames it. This is how a job-r1-like act
  that has already happened can still name its list.
- **`site-reset/destination-unchanged.ts`.** `groups` is now required, and the header says why the "every
  list" fallback is unsafe.
- **`action-permissions.ts`.** Passes `resetDestination` to `explored` for undo calls too.
- **Wording.**
  - `site-reset/words.ts`: new generic `nameDestination()` sentence (a module constant). It mentions "a
    saved-items page" as instructed, and is appended to `resetRequired` and to the
    `candidate.trial_reset_unproved` instruction in `ledger.ts`.
  - `site-reset/undoes-tool.ts`: the `resetDestination` description now says any reversible act may name its
    list, on its own call or later under `undoes`.
  - `keptAct(left)`: a claim on a left act now says no undo is owed. It no longer says "requires proved
    baseline restoration". The `candidate.undo_act_kept` code is unchanged, so `left-on-target.ts` still
    names the act.

**2. No trial on leftovers (F3's note).**

- **Where the admission happened.** The whole trial asks `site-reset/project-reset.ts`, which asks each brief
  ledger's `beforeTrial` and then `site-reset/trial-policy.ts`. That policy admitted the trial on leftovers
  in two cases: a refusal identical to the last one (no progress), or more than 3 refusals in a phase. The
  ledger then marked those acts kept. It also auto-kept an act after `askedFor >= 2`.
- **Reproduced** in the new `site-reset/tests/project-reset.test.ts`: with two unscoped builder acts and no
  look, the second ask was admitted.
- **Fix:**
  - `trial-policy.ts` never admits while acts are still to undo. The no-deadlock admission remains only for
    a start that differs while nothing is left to undo.
  - `ledger.ts` drops the `askedFor` auto-keep for non-subject acts, and drops the "admitted with acts, so
    keep them" step.
  - An act now stays only when it is kept: named under `cannotUndo` after being asked for, or its undo was
    refused. The judge is told under `startedWith.cannotUndo`.
  - The headers of both files are updated.
- **Tests updated to the rule** (my ownership):
  - `trial-policy.test.ts`: two former "never deadlocks" tests;
  - `ledger.test.ts`: four tests;
  - `flow-bootstrap/tests/site-reset-irreversible.test.ts`: two tests, which now name `cannotUndo` to run.

### Commands run and observed results

**Before the fix:**
- Item 1 (named destinations): 4 failed, 215 passed. The failures were the unnamed refusal, the
  invented-ref refusal, the keptAct wording, and `create-baselines` naming for modify.
- Item 2 (leftovers): 6 failed, 191 passed, including the new project-reset reproduction. At HEAD, the second
  ask returned `{ kind: admit, startedWith }`.

**After the fix:**
- `npx vitest run site-reset/tests flow-bootstrap/tests/action-permissions.test.ts flow-bootstrap/tests/site-reset-irreversible.test.ts`
  -> 13 files, 225 passed.
- `npx tsc --noEmit -p tsconfig.json` -> exit 0, no output.
- `node scripts/structure-audit.mjs` -> passed (405 warnings, 1152 baselined). Advisory only: `ledger.ts` is
  at 782 lines out of 800, and the class has 27 methods.
- Neighbours, 19 files: the earlier six, plus `candidate/tests/trial-gate-reset`,
  `trial-gate-explored-on-absorbed`, `subflow-candidate/tests/subflow-trial-{gate,whole}`,
  `supervisor/tests/{whole-trial,supervisor-loop}`, `dispatch/tests/whole-trial-port`,
  `single-subflow/tests/single-subflow-trial`, `project-build/tests/{project-build-reset,trial-reset,phase-start}`,
  `subflow-trial/tests/site-reset` and `flow-bootstrap-commands/tests/candidate-failure-kept`.
  Result: 5 failed, 131 passed.
  - Two failures were already there before this work: the "this act stays as it is" wording in
    `site-reset-build` and `site-reset-calls`.
  - Three are new, and each tests the admission this round removes. I confirmed that all three pass with
    HEAD's sources: I restored the HEAD files temporarily, ran the tests (28 passed), then restored my files
    from a scratch copy.
    - `flow-bootstrap/candidate/tests/trial-gate-reset.test.ts`, "admits the trial without progress, saying
      under startedWith what was still in place": this is the removed stall admission.
    - `project-agents/supervisor/tests/whole-trial.test.ts`, "runs the test with an act the site cannot undo
      kept...": the fixture's reset (`undoes: false`) comes back blocked without naming `cannotUndo` to the
      ledger. That is exactly F3's case, and the whole test is now refused `project.trial_reset_required`.
      The test should be updated so its stand-in names the act through `remainingActs(["act-1"])` (as
      `reset-loop.ts` does), or so it expects the refusal.
    - `service/project-build/tests/project-build-reset.test.ts`, "refuses an undo aimed at another
      item...": the reset completes without naming `cannotUndo`. act-2 is kept by the wrong-target refusal,
      but act-1 (the trial's act) used to be kept automatically by the `askedFor` auto-keep and now stays in
      place, so dispatch returns `blocked` with 1 act in place instead of `done` with 0. The script's
      completion should name `cannotUndo: ["act-1"]`, or the expectations should change.

### Not verified

- No live, browser or paid run, and no full suite.
- Receipts (`resetDestinations`) are issued only for originals observed before the build's first lasting
  act, because `createBaselines.seal()` runs then. In job r1 no receipt was ever printed, so a rerun settles
  only if My jobs is read before the first lasting act of the build. This was not checked against a live
  build.

### Open questions or contradictions found

1. **Tests and docs outside my ownership.** The three failing tests above need updating to the new rule. The
   headers of `project-agents/supervisor/whole-trial.ts` ("the ledgers' no-deadlock admission is for a reset
   that was tried and made no progress") and `dispatch/reset-loop.ts` still describe the removed admission.
2. **Gaming risk.** A model could name any unchanged list as an act's destination. Some protection: the list
   must be an issued original, belong to the same resource, have lacked the act's subject, and the judge is
   told the act was left. But naming is the model's claim, not proof.
3. **Builds that end instead of testing.** Candidate builds whose wrap-up offers only submit and test, and
   whose model never names `cannotUndo`, now end without a trial rather than test on leftovers. That is the
   rule as stated, but it may show up as more honest `blocked` endings in live runs.
