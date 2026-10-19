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
