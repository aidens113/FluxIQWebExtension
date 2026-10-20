# Debug: run-mvfq959u-b7afdf80 (photo-social-newest-likes, r2)

Status: FAILED. Diagnosis only (brief R7, 2026-10-19). No source edits, builds, browser or paid runs.

## The run

- Task `photo-social-newest-likes`, built from the real extension chat (step 0001 `flow.createHere`),
  workspace `claude-photo-likes-t567-20261019-r2`, slot 4, $0.25 purse.
- Source: downstream 79fbbb7a, Core e11549a8 (`run.json`; the t567 lane trees are at the same heads).
  These carry F2, F5, F6, F8 and the $0.25 purse, the fixes for r1 (`run-mvecxeci-1c2cc227.md`).
- 72 provider calls, $0.0395, about 12 minutes (20:49:11 to 21:01:23 UTC). The purse was not a factor:
  brief 2 was still given $0.211.
- Ended: no Flow. The chat said "FluxIQ could not finish the Flow: i could not finish liking the three
  most recent posts ... has no steps yet". `evaluation.json`: `flowCreated: false`, no oracle verdict,
  no reported verdict, no replay.

## How far it got

| Phase | Steps | Result |
| --- | --- | --- |
| Look and plan | 0002-0008 | Correct plan: one subflow carrying the like part and the table part; the look-alike accounts were named as not to be touched. |
| Brief 1: exploration | 0009-0053 | Opened the right account, read the reels grid (0019) and the posts grid (0047). Liked two posts and opened a third while exploring (0029, 0033, 0043). |
| Brief 1: candidate | 0056-0059 | Revision 1 was refused for a misplaced `only after`. Revision 2 was accepted (0059). |
| Brief 1: trial | 0061 | Refused before running: `candidate.trial_reset_required`, with three acts to undo. |
| Brief 1: reset | 0062-0077 | Every undo was refused (`candidate.undo_unproved`), then the repeat guard ended the brief. |
| Brief 2 (resent) | 0079-0100 | Re-explored, never submitted. It pressed the first tile from the same page until the repeat guard stopped it. |
| Ending | 0101-0102 | The supervisor tried to end. This was refused with `project.completion_reset_first`, which was correct because three acts were still in place. |
| Brief 3 (reset) | 0104-0145 | The same `undo_unproved` refusals, then the repeat guard. |
| Ending | 0146 | Blocked, honestly naming leftovers. No revision was ever tested, so no Flow steps exist. |

No trial ran, so the judge never saw anything.

## The first step where it went wrong, and why it ended with no steps

1. **Step 0022 (model): the first grid tile was taken to be the newest post.** The profile grid puts
   three pinned posts first. The task's own source (`breadth/newest-likes/workflow.ts`) shows that the
   newest three are tiles 4 to 6. The builder opened tile 1 (`D96ahbWGjtY`, the pinned giveaway), then
   liked it at 0029. It liked tile 2 (`DQwjFQMHFgA`, also pinned) at 0033, and pressed tile 3's link at
   0043 while declaring `modify_existing`. That press only opened the post, so it never liked a third
   post. The read at 0047 did offer the pin as a column (`svg... aria-label`, sample "Pinned post icon",
   coverage 0.5), but the page view shows each tile only as its counts (`t432 link "2.9K 47"`). The
   page view shows no pin mark, reel mark or dated alt text, although a person sees the pin icon.
2. **Steps 0061 to 0077 (product): the build could never reach a trial.** The trial gate correctly
   asked for the exploration likes to be undone first. The builder then did the right kind of thing: it
   opened the liked post's own page and pressed its `Unlike` button (`t2174`, 0066) under
   `undoes: act-8`. Core refused the press unrun as `candidate.undo_unproved`. It refused again with no
   declared class (0070). After that, each identical call was refused as a repeat, and the third repeat
   ended the brief.
3. Brief 2 started with the three acts still in place, so it could never have trialled either. It
   stalled by re-pressing the first tile. Brief 3 (reset) hit the same refusal. The supervisor ended
   blocked, and the draft was never promoted. That is why the Flow "has no steps yet".

Why every undo was refused. This is the decisive cause, found in Core
`packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/ledger.ts`:

- The domain's `webTargetSpot` (`domain/src/runtime/llm-evidence/control-spot/target.ts`) always gives a
  control a `scope` token. That token is a complete list's scope, or otherwise the page's resource plus
  its location. So every lasting act here is a strict act (`record`, line 723: `strictReset` is true
  when the spot has a scope).
- In `target()`, an undo declaring no class on a strict act with a scope is refused (line 362). An undo
  declaring `modify_existing` is admitted only:
  - as `own`, when `sameItem` holds: equal item tokens and the same dialog and scope; or
  - by a transfer witness (a row moved between two complete lists); or
  - by the create-then-delete subject proof.

  The like was pressed inside the post's modal dialog over the profile, while the unlike was on the
  standalone post page with no dialog. A post's like button also sits in no row, so no item token
  exists. `aboutTheAct` plus `reverses` passes for `modify_existing`, but only `create_new` to `delete`
  is then accepted, so it falls through to `unproved()` (line 401).
- Even an admitted press could not have cleared the act. In `beforeTrial()` (lines 534-558) a strict
  act is marked undone only by `originalGroupRestored`. That needs a complete collection baseline read
  before the act that holds the act's subject. `webResetCollections`
  (`domain/src/runtime/llm-evidence/control-spot/collection.ts`) makes collections only from complete
  ARIA lists (`aria-setsize` and `aria-posinset` on every row). A post page's own like button is in no
  such list. The place comparison that settles legacy acts (lines 550-557) is skipped for strict acts
  on purpose.
- This is pinned by the Core test "requires exact restoration for modern scope-only controls with no
  usable title" (`site-reset/tests/ledger-subject.test.ts`, line 118). The comment at ledger lines
  384-386 says it directly: an inverse for an edit "needs a deterministic inverse witness, which this
  seam does not yet supply".

So on a site with no start-reset hook, any build that presses an in-place toggle while exploring (like,
follow, save, star, subscribe) can never reach a trial, however correct its undo is. This is general:
it is not about this site or task.

## Were this round's fixes exercised?

| Fix | Exercised? | Behaved as intended? |
| --- | --- | --- |
| F6: the item's own link as a column | Yes. Every grid read offered `item_url` with `kind: link` and coverage 1 (0019, 0047, 0086), and revision 2 kept it as its only column. | Yes. The model named the column `item_url` rather than the asked `link`, which is a model slip the script format allows it to fix (`extractList.fields.<name>`). |
| F2: grid tiles as their own rows | Yes. The posts grid read gave 12 rows with the tile anchor itself as the item (`at: t432`), and `atNote` says acting on it acts on that item only. | Yes at read time. It never ran in a trial. |
| F5: `repeat most` beside `repeat over` | Yes. Revision 2 has `repeat over: posts` and `repeat most: 3`, and Core accepted it (0059). | Accepted. It was never run, so the first-N bound in playback is unproven. |
| Pass scoping for a control that is the item (r1 defect 3) | Not exercised, because no trial ran. | Unknown. |
| F8: the list-continues fact | Not observed. Both grid reads reported `pagination: none`, and no result carried a continuation fact. | Not applicable on this evidence. |
| $0.25 purse | Yes. | It was not the limit: $0.0395 was spent. |

## Other mistakes the trial would have caught

Revision 2 would have failed its trial even with a clean site:

- It likes the three pinned tiles (`repeat most: 3` over a grid that starts with the pinned posts).
- Its like step targets `t1085`. That is the Like button of a pinned comment (`t1081 "Pinned"`,
  `t1084 Reply`, `t1085 Like`), not the post's own Like (`t1300`).
- It closes the post's dialog (optional step `close`), then likes "only after: close", so the like
  runs only after its own dialog is gone.
- The column is `item_url`, not `link`.
- Step 0043 declared `modify_existing` on a link press that only navigated. That became act-11, a
  strict act that nothing can undo.

## Cause class

**Product defect (terminal)**, with model mistakes the product's trial and judge would normally catch,
plus one product contributor.

1. Core `flow-bootstrap/site-reset/ledger.ts`:
   - `AutomationStudioSiteResetLedger.target()` has no admissible inverse for an in-place
     `modify_existing` on a control in no complete list.
   - `beforeTrial()` has no restoration proof for it.

   Together they deadlock every build that toggles something while exploring, on any site without a
   start-reset hook.
2. Model: it took the pinned first tile as newest (as in r1), targeted a comment's Like, closed the
   dialog before liking, used the wrong column name, and over-declared a navigation. In brief 2, it
   re-pressed the same tile into the repeat guard. The guard was right.
3. Contributor in this repository: the compact page view drops an icon's accessible label inside a
   list item, so the pin mark a person sees on a tile is invisible on the page view. The model saw it
   only as a column of the read with a class-soup label. I did not locate the exact page-view function
   that drops it.

Task wording is not at fault: the instruction says "most recent ... published", which is unambiguous
against a pinned-first grid. The oracle should not change.

## Proposed least, general fix and its test seam

**1. An in-place toggle witness in Core's site-reset ledger (required).**

Teach the ledger the one inverse it lacks: a press that flipped its own control's state on the page it
sits on, undone on that same page, proved by that control's state coming back.

- Record (`site-reset/act-places.ts`, where `ledger.placed` is fed at line 95). For an act whose only
  class is `modify_existing` and whose pressed control is still present at the same location after the
  act, keep a witness: `{ scope, subject?, before, after }`. `before` and `after` are digests of that
  control's own state (name, pressed, checked, selected), the same way `witnessTransfer` keeps a move.
  Then add one field to `AutomationStudioSiteResetPlace` in `contracts.ts`.
- Admit (`ledger.ts` `target()`). Admit an undo naming that act when all of these hold:
  - its control has the act's `scope` token (the same resource and location; the dialog may differ);
  - its control has the same `subject` token where both have one;
  - it declares `[]` or `["modify_existing"]`;
  - the control's current state digest equals the witness's `after`.

  This admits `on: "own"` with nothing unasked. A control already in the `before` state is refused, so
  a second press can never re-toggle.
- Settle (`ledger.ts` `beforeTrial()`). Mark such an act undone only when a fresh look at its location
  (`compareAt`) shows the witnessed control in its `before` state and none of the act's own changed
  lines still differing. This is positive, exact, same-page evidence. Every other strict act keeps
  today's rule, and the test at line 118 stays as it is for `create_new`.
- Tests: new cases in Core `site-reset/tests/ledger-subject.test.ts` (or a sibling `ledger-toggle.test.ts`):
  - a toggle undone on the same location from outside the dialog is admitted and settled;
  - refused on a different location or subject;
  - refused when the control is already in its `before` state;
  - not settled while the fresh look still shows `after`;
  - unchanged for a scope-only `create_new`.

  Add a witness case in `site-reset/tests/act-places.test.ts`. If the domain must add the control's own
  state to the place lines, add a case beside `domain/src/runtime/llm-evidence/control-spot/tests/`.

Nothing here names a site, a task or an answer.

**2. Show an item's icon marks on its page-view line (recommended, this repository).** A short
accessible label on an icon inside a list item, such as a pin or a video mark, belongs on the item's
line, because a person sees it. This follows the standing rule that the model sees every visible
element. The test goes beside the page-view renderer. The owner function is still to be found under
`domain/src/runtime/llm-evidence/`.

**3. Optional.** A press that only followed a link to its own address, with nothing changed in place,
should be recorded as a navigation even when the model declared `modify_existing`. Then a
mis-declaration cannot leave an act that cannot be undone. The seam is the permission wrapper's act
recording that feeds `ledger.explored`.

## Rerun notes

The workspace `claude-photo-likes-t567-20261019-r2` still holds this build's likes. `D96ahbWGjtY` was
last seen as "Unlike" at 0065, and `DQwjFQMHFgA` was seen as "Unlike" at 0121. Brief 3's presses never
ran, so a rerun needs a fresh workspace. Rerun only after fix 1, because without it every toggle task
deadlocks the same way. This is not an unchanged retry.

## Evidence

- Run: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-19/run-mvfq959u-b7afdf80`.
- Step folders:
  - `steps/0029` and `steps/0033`: the likes.
  - `steps/0043`: the link press declared lasting.
  - `steps/0047`: the posts grid read.
  - `steps/0059`: revision 2.
  - `steps/0061`: the reset demand.
  - `steps/0066` and `steps/0067`: the unlike, refused.
  - `steps/0069` to `steps/0077`: repeat refusals.
  - `steps/0079`: brief 2's return.
  - `steps/0102`: `completion_reset_first`.
  - `steps/0119` and `steps/0141` to `steps/0145`: brief 3.
- `logs/core.log` holds only build-trace timings, with no ledger detail.
- Not verified:
  - the exact item, dialog and subject tokens of act-8 and of `t2174`, which are not logged;
  - whether act-8 had a recorded `place`: the 0061 refusal listed no `stillThere` for it.
