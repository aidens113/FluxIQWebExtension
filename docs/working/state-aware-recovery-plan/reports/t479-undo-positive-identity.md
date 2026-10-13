# t479 report: an undo needs a positive identity match; a start hook's reset asks the model for nothing

Worker report. Core-paired: every change is in the Core worktree
`C:/Users/osrs_/FluxStuff/fxwork/t479/!FluxIQ` (branch `task/t479-undo-positive-identity`). Nothing changed in the
extension worktree except this report. Nothing was committed.

## Outcome

Done. Both defects from `run-mv5yaapd-ad19eaae` were confirmed in code and fixed in Core `flow-bootstrap/site-reset/`,
with tests. Mutation checks show the new tests fail on the old code. No paid run.

## What changed and why

### Defect 1 (safety): two missing item tokens were treated as the same item

Confirmed at `site-reset/ledger.ts:170` (old): `act.spot && item === act.spot.item && dialog === act.spot.dialog`. For
an act with spot `{}` (the B Add to cart sat in no row and no dialog) and a control with no tokens (the cart's only
line, which names no row because `controlRowIdentity` needs a twin row), this compared `undefined === undefined` twice
and admitted the soap's Remove as `on: "own"`. With `modify_existing` declared, nothing was gated, so it ran unasked.
The extension (`record.ts:201-207`) and the domain (`control-spot/target.ts:14-19`) behave as the debug says. No domain
change was needed.

- **`ledger.ts` `target()`**: the `own` rule now uses `sameItem(spot, control)`. It needs both item tokens present and
  equal, and the dialog equal (both absent, or both present and equal). A missing token on either side never matches.
  A shared dialog alone is no identity either, because a drawer can hold several lines with no tokens. Anything else
  falls through to the existing refusal: `candidate.undo_wrong_target`, never pressed, and the act is kept, so the
  next trial runs with it under `startedWith.cannotUndo`.
- **`created` rule**: already needed a present token (`item !== undefined && createdItems.includes(item)`). The
  weakness was where `createdItems` came from (next item).
- **Audit of the other identity comparisons in `site-reset/`** (same "missing counts as equal or absent" pattern):
  - `act-places.ts`, created items. The old `known = seen ?? new Set(before.items ?? [])` meant that with no
    `seenItems` and a before-read that listed no items, every item after the act counted as created. Those items
    could then be removed unasked with `allowed: ["delete"]`. Now an item counts as created only when the read before
    the act listed items and this one was not among them (union of `seen` and `before.items`).
  - `act-places.ts`, "stayed on the page". The old `after.location === before.location` was true when both were
    undefined, so `undoSeen(act, true)` claimed an undo had changed the act's page. Now a read with no location makes
    no claim, and the ledger falls back to its documented rule for a target it cannot read. That fallback is a t471
    policy and was not widened here.
  - `start-check.ts` `settled()`. Two reads with no location were taken as the same page, so lines that differed
    between them were marked "live" and hidden from then on. Now both reads must name the same location.
  - `ledger.ts` `follow_up` (an admission with no item, not an equality). Once a chain started, any number of lasting
    presses in any dialog were admitted, so a second press on another line of an open drawer would pass. Now one
    lasting `follow_up` landing ends the chain, which is the site's single confirmation. Acknowledgements that
    declare nothing lasting do not end it.
  - Checked and fine: `claim`/`explored`/`actOf` id lookups (string ids), and `stillThere`
    (line-string set membership).
- **`words.ts`**: the `resetRequired` and `wrongTarget` text now says a control on an item that "cannot be told apart"
  is refused. The wording is generic and names no site.

### Defect 2: the reset still asked the model for undos after the hook had reset the site

Cause (confirmed from the debug and code): with `startReset`, t475's `beforeTrial` went back to each act's own page
(`compareAt`) and treated whatever still differed as the act's effect. After a full hook reset, the only things that
can still differ are content that changes by itself (act-1's rotating carousel, which the settled read misses when it
rotates slower than `settleMs`), a cover the runtime closed during the act (act-2's chat card, whose `covered-by`
lines the domain keeps because `webIsLayer` does not recognise it), or a gap in the hook. None of these is the model's
to undo, and asking for them led to the soap removal.

- **Fix (`ledger.ts` `beforeTrial`)**: when `startReset` is true, every undoable act not yet undone (kept acts too)
  counts as undone, `stillThere` is cleared, the phase restarts, and the call returns `{ kind: "admit" }`. Nothing is
  compared and nothing is asked. The hook is the deployment's own reset of the whole site
  (`candidate-start-hook/from-environment.ts`: "the endpoint can be a plain reset"). This also fixes debug defect 4:
  the judge is no longer told that acts the hook put back were "already done". The `startReset` branch that compared
  acts with no page against the start was removed, since it is now unreachable. The no-hook path is unchanged.
- Updated wording only: the headers in `ledger.ts`, the `site-reset/contracts.ts` docs (`startReset`, spot, `created`),
  and the comments in `candidate/trial-gate.ts` and `candidate/contracts.ts` about what happens after `prepareStart`.

### Tests added or changed

- `flow-bootstrap/tests/site-reset-build.test.ts` (real ledger, wrapper and loop; new `rowTokens: false` option, an
  `addElsewhere` add whose line lands on another page, `removeAs` for the declared classes, and a hook `gap` option):
  - **B shape**: a one-line cart with a pre-existing line and no row tokens. A Remove on it under the add's act,
    declared `modify_existing` or `delete`, is refused unrun (`candidate.undo_wrong_target`). The act is kept, the
    next trial runs with `startedWith.cannotUndo: [act-1]`, and the cart still holds `before`.
  - Two lines with no row tokens: even the added line is not removed, because it cannot be told apart.
  - **Two-line cart with tokens**: only the added line is removed (declared `modify_existing`, as in B). The trial
    starts clean and `before` stays.
  - **Hook first with a gap** (the hook leaves the title renamed, standing in for carousel or cover noise): both
    trials run, there is no `startedWith`, `candidate.trial_reset_required` appears nowhere, nothing is removed, and
    the hook runs twice.
- `site-reset/tests/ledger.test.ts`: a positive-match test (six pairs with a missing or mismatched token, each refused
  and kept, plus two positive matches), a test that a follow-up chain ends after one lasting press, and the old t475
  `startReset` test rewritten (every act undone, kept and trial acts too, no `compare` or `compareAt` call, and a
  later act is the reset's again).
- `site-reset/tests/act-places.test.ts`: nothing counts as created when the read before listed no items; a read with
  no location makes no claim.
- `site-reset/tests/start-check.test.ts`: reads with no location are not taken as live content.

## Commands run and observed results

All run in `C:/Users/osrs_/FluxStuff/fxwork/t479/!FluxIQ`.

- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/site-reset src/programs/automation-studio/runtime/flow-bootstrap/tests src/programs/automation-studio/runtime/flow-bootstrap/candidate src/programs/automation-studio/runtime/service/candidate-trial`
  (in `packages/fluxiq`), final run: `Test Files 47 passed (47)`, `Tests 457 passed (457)`.
- An earlier run, before the act-places location change was revised:
  `trial-gate-reset.test.ts > refuses a trial while the build's act is in place...` failed. Its fake domain gives no
  location, and `undoSeen(false)` kept the act. It was fixed by making a location-less read make no claim instead of
  a false one. Rerun: `Tests 189 passed (189)`.
- Mutation check 1: restored the old `own` comparison and ran the build and ledger tests. `Tests 3 failed | 40 passed`:
  the positive-match ledger test and both B-shape build tests. The fix was then restored.
- Mutation check 2: disabled the `startReset` branch and ran `site-reset-build.test.ts`. `Tests 2 failed | 13 passed`:
  the new hook-gap test and t475's hook test. The fix was then restored.
- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo`
  (`packages/fluxiq`): the first run gave `ledger.ts(278,9): error TS2412` (`exactOptionalPropertyTypes`), fixed with
  `delete act.stillThere`. Final: exit 0, no output.
- `node scripts/structure-audit.mjs` (Core): `structure-audit: passed (337 warning(s), 1159 baselined).` It also printed
  `2 baseline entries can be lowered`, and a new advisory warning:
  `site-reset/tests/ledger.test.ts: 408 lines is past the 400-line advisory threshold`.
- `node scripts/structure-audit.mjs` (extension worktree): `structure-audit: passed (187 warning(s), 646 baselined).`
- Domain tests: none run, because no domain or extension file changed.

## Not verified

- No live or Lab run (no paid run, by the brief), so neither fix has been seen against bigbox-retail.
- The full Core vitest suite and `pnpm check` were not run. Only the changed directories and their direct
  neighbours were (flow-bootstrap tests, the candidate tree, service/candidate-trial).
- I did not check whether the "2 baseline entries can be lowered" message predates this change. `pnpm structure:baseline` was
  not run.

## Open questions or contradictions found

1. **Behaviour change for real sites with a hook.** After `startReset`, Core now trusts the hook completely. If a
   deployment's hook resets only part of the site, the trial runs on a partly dirty site and the judge is not told.
   This replaces t475's look-and-ask, which is what drove the destructive undo. The hook's contract says it is a full
   reset.
2. **Without a hook, the noise is still there.** Carousel lines that rotate slower than `settleMs`, and `covered-by`
   lines from a layer `webIsLayer` does not recognise (domain `start-state/page-state.ts:38-47`), still reach
   `stillThere` when there is no hook. Those asks are now safe, because a Remove can no longer pass on missing
   tokens, but they still cost model calls. That is debug defect 2's noise half and round 10's fix 4, which this brief
   did not include.
3. **Under-declared presses.** The `moving` rule admits an undo control with no item, no dialog and
   `consequences: []`. A model that declares nothing on a Remove would pass the site-reset rules, and the permission
   gate would not ask. Nothing ties a press named "Remove" to `delete` (debug defect 1, last bullet). That is the
   general under-declaration gap in the permission gate, not in `site-reset/`, so it was left alone.
4. Single-line lists still have no row identity in the extension, so the reset can never undo an act on a one-line
   list. It keeps the act instead. That is safe but limits what the reset can do. A row identity for a lone repeated
   structure would be extension work (`apps/extension/src/content/identity/record.ts`).
