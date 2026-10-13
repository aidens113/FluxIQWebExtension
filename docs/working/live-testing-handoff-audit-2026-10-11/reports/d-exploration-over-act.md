# Lane D exploration over-act: root cause (read-only investigation)

Owner: worker (investigation only; no source edited, no Lab run, no provider call)
Date: 2026-10-13
Runs: round 17 `run-mv6lgt3s-c3aa6fac` step 0033/0034; round 15 `run-mv6ep5oy-05d5095c` step 0027/0028
Tree read: `C:/Users/osrs_/FluxStuff/fxwork/t275/` (`!FluxIQWebExtension` and `!FluxIQ`)

## Outcome

Root cause found. Three things combined:

1. **The view was not the problem.** `t763` is printed inside row `- 1/8`, directly under "Tom Becker" and
   "1 mutual friend". Each Confirm is bound to its row in the page view. The press was the model's choice, not an
   element-identity error.
2. **No mechanical guard stops a lasting press on a row that no read kept.** The system prompt says it in prose only:
   "list the items with a where that keeps the ones to act on, do or write the act once on one item it kept". None of
   the exploration reads had a `where` condition. The ≥5 condition existed only in the model's summary sentence, so no
   guard could have compared against it. The model pressed the `at` handle that `web.detect_repeating_structure`
   gave for the "Confirm" column, which is always the first item's control.
3. **Rule 1 did record the act, and then the Lab's start hook erased it silently.** The confirmation became `act-1`
   in the site-reset ledger. Trial 1 was a fixture-reset start (`start: "reset"`), so `beforeTrial(..., {startReset:
   true})` marked every act undone and asked the model for nothing. With `--model-reset-only` the trial would have
   been refused as `candidate.trial_reset_required` naming `act-1`. But the site has no control that undoes an
   accepted request, so the best outcome is "kept" (`startedWith.cannotUndo`), not "undone". Prevention is the only
   way to satisfy Rule 1 here.

## Q1. Where `t763` is, and whether its identity is clear

The view the model received just before the press was step 0033's request, `read-requests-3`, rendered by
`web-llm-page.v3`. These are the lines around `t763`, quoted exactly:

```
--- on screen ---
- 1/8
t754 link ~/people/tom.becker.9/
t760 link "Tom Becker" same href
t761 "1 mutual friend"
t762 "2w"
t763 button "Confirm"
t764 button "Delete"
- 2/8
t766 link ~/people/amara-osei/
t772 link "Amara Osei" same href
t773 "23 mutual friends"
t774 "3d"
t775 button "Confirm"
t776 button "Delete"
```

- **The row is clear.** All eight Confirms are identical lines (`button "Confirm"`), but each one sits under its own
  `- i/8` item marker together with that row's name and mutual-friend line. The markers come from
  `domain/src/runtime/llm-evidence/page-view/structure-markers.ts` `webLlmStructureMarkers`, which prints `- i/n` for
  every list of more than one item. Nothing in the view is ambiguous.
- **The control also carries an opaque row identity.** `domain/src/runtime/llm-evidence/control-spot/target.ts`
  `webTargetSpot` creates it from `elements.ts` `recordAddress` and passes it to Core as `control.item`.
- **The row the decision meant was different from the row it pressed.** The decision said: "I'll confirm the friend
  requests with at least five mutual friends, then read the accepted list for the table." That describes a set
  (Amara, Jonas, Lin, Freya), not one row. `t763` is row 1, Tom Becker, 1 mutual friend. The result (0034) said so in
  `changed`: `t761 "1 mutual friend" gone … t876 "Request accepted" appeared`. Nothing in it pointed out that this row
  fails the model's own criterion.
- **Where `t763` probably came from.** The same request holds two `web.detect_repeating_structure` packets
  (`extraction.3`, `extraction.5`). In each, the Confirm column is printed apart from any row:
  ```
  label: button: 'Confirm'
  kind: text
  coverage: 1
  at: t763
  sample: Confirm
  ```
  together with `atNote`: "at is that item's own element, so acting on it acts on that item only; to act on the rows a
  listing keeps, use the control inside one of the rows it keeps". In both rounds the model pressed the Confirm
  column's `at` handle: round 15 pressed `t757`, which is also the `at` of its packet and also Tom's row
  (`t754 link "Tom Becker"`, `t755 "1 mutual friend"`, `t757 button "Confirm"`). Both rounds used the identical summary
  sentence. The packet that prints it is `domain/src/runtime/llm-evidence/structure/packet.ts` (`AT_NOTE`, and
  `fields[].at`). The packet does not mislabel the handle, but it shows a first-row control as if it were the handle of
  the whole column.

**Verdict on Q1:** element identity was correct, and the view binds every Confirm to its row. The defect is that a
lasting press can be made on a row no structured selection kept.

## Q2. Was the pressed row checked against the intended target?

**No.** These are the checks the press passed:

- `domain/src/runtime/llm-evidence/node-run/run.ts`: the cover, hidden and missing-target checks, then
  `webActionPermission`. That permission check is class-level only. The instruction "Confirm every friend request…"
  grants `modify_existing` (`!FluxIQ/.../runtime/action-permissions/instructed.ts`) for any Confirm on any row.
- `!FluxIQ/.../runtime/flow-bootstrap/action-permissions.ts` `executeTool`: the row check (`siteReset.target`,
  `sameItem`) runs only for an undo (`undoes`). A forward press is never compared to a row.
- `domain/.../node-run/rejected-rows.ts` only shows the rows a read's `where` rejected. It never gates a press.

**Should one exist? Yes, and it can be built without trusting prose.** The structured signal already exists in the
contract the system prompt describes: a read's `extractList.where` and the rows it kept. Every row and control carries
a record address (`recordAddress`, i.e. the `control.item` token). The guard: an exploration press that declares a
lasting class, on a control inside an item of a multi-item list, runs only when the latest read of this build over that
list kept that item through its `where`. Otherwise it is refused unrun, with these words: "read the list with a where
that keeps the rows to act on, then press on one it kept, or write the step (`write: true`)." In this run every read
had no `where`, so the press would have been refused. The model would then have had to write the ≥5 condition into a
read, which it did anyway in rev 1, and Tom's row would have been rejected by structure.

An alternative signal, weaker and needing a new model field: an optional `row: {read: <callId>, index: n}` on the
press, checked as "the control's item token equals that row's token". It catches a mismatch only when the model names
the right row, so the `where`-kept rule is better.

## Q3. Rule 1: why the confirmation was not undone before the trials

- **The act was recorded.** It passed `explored()` in `!FluxIQ/.../flow-bootstrap/site-reset/ledger.ts`: it landed, was
  permitted, was `mutate`, and declared `modify_existing`, which is in `UNDOABLE`. It became `act-1`. The evidence:
  trial 1's `leftOnSite` starts at `act-2` (`trial step 9 "confirm the request" on "Confirm"`). Numbering starts at 1
  and only `record()` advances it, and the only exploration call that declared a lasting class was
  `confirm-requests-1`. Round 15 is the same: its trial acts also start at `act-2`.
- **The effect appeared,** so the `noEffect` exclusion (t475) did not apply. 0034's `changed` lists the row's lines
  gone and "Request accepted" appeared.
- **It was dropped at the start hook.** In `candidate/trial-gate.ts`, `test()` calls `trial.port.prepareStart` first.
  The Lab fixture reset answered `"reset"` (trial feedback `start: "reset"`), so it calls
  `reset.beforeTrial(signal, cannotUndo, { startReset: true })`. In `ledger.ts` `beforeTrial`, the
  `options.startReset === true` branch sets `act.undone = true` for every act, resets the phase, and returns
  `{kind: "admit"}` with no `startedWith`. As a result:
  - `trial-policy.ts` `automationStudioSiteResetTrialPolicy` was never consulted.
  - No `candidate.trial_reset_required` was sent.
  - `cannotUndo` was never offered.
  - `trialRan` left `act-1` out of `leftOnSite`, because it filters `undoable && !undone`.

  The model, the judge and the debug were never told that an exploration act existed.
- **With `--model-reset-only`** (`packages/test-runner/src/environment.ts`, `candidateTrialFixtureReset: false`), there
  is no start hook. `beforeTrial` would look at `act-1` on its own page (`compareAt`) and find "Request accepted" still
  there. The policy would then refuse with `candidate.trial_reset_required`, `actsToUndo: [{act: "act-1", did: "…
  \"Confirm\" button", call: "confirm-requests-1", stillThere: [...]}]`. The fixture has no control that reverses an
  accepted request (`apps/scenario-lab/src/scenarios/social-network-feed/markup/friends.ts` and
  `client/requests-script.ts` render only "Request accepted" and a Message link), so the model could not undo it.
  After that refusal it could name `act-1` under `cannotUndo` (accepted because `askedFor > 0`). Otherwise the ledger
  keeps it after two asks (`ASKED_BEFORE_KEPT`), or the policy admits it on a stalled refusal. The trial would then run
  with `startedWith.cannotUndo`, which the judge is shown. So Rule 1's machinery would have surfaced the act
  honestly, but it could not have removed it. On a real site Tom stays a friend.

## Q4. Proposed general fixes, ranked

Every test below uses a non-scenario fixture: an inbox list whose rows have "Archive" buttons, read with
`where from is "Ana"`.

1. **Domain: refuse a lasting exploration press on a row no read kept.** This is the structural fix, and it prevents
   the over-act.
   - File: `domain/src/runtime/llm-evidence/node-run/run.ts`. Add the check before `webActionPermission` and after the
     cover checks, using a new focused module such as `node-run/kept-rows/`.
   - Mechanism: after each explored `web.dom.extract_list`, the module remembers the record addresses of the rows the
     read kept, per list, together with whether the read had a `where`.
   - Rule: a non-written press with a lasting class whose target's `page.records` entry belongs to an item of a list of
     more than one item is refused unrun (`row_not_kept`) unless that record is in the latest kept set for that list.
     The refusal names the row's own words and the read's conditions, and offers `write: true`.
   - Needs confirming first: that extract_list rows can carry each row's record address. Playback rows carry
     `context.record.values`, which suggests they can.
   - Fail-first tests in `node-run/tests/`, with the inbox of 3 rows:
     - Press Archive on row 1 with `modify_existing` and no read: refused, nothing dispatched.
     - After a read whose `where` keeps only row 2, the same press on row 1: refused `row_not_kept`, naming row 1's
       words and the condition.
     - The press on row 2: dispatched.
     - Row 1 with `consequences: []` (an expand): dispatched.
     - Row 1 with `write: true`: accepted as written.
   - Cross-lane risk: lane B's exploration "Add to cart" on product cards would now need a kept read first. That
     matches the system prompt's rule, but check lane B's recent build shapes before merging.
2. **Core: the start hook must not erase exploration acts silently.** This makes Rule 1 visible in the Lab.
   - Files: `!FluxIQ/.../site-reset/ledger.ts` `beforeTrial` (the `startReset` branch) and `candidate/trial-gate.ts`.
   - Return the acts the hook absorbed (for example `startedWith.resetByHook: [{act, did, call}]`). Put them on the
     trial evidence and in the run record so the debug and `evaluation.json` count exploration lasting acts.
   - Optionally the Lab flags, as an over-act finding, any exploration lasting act on an item that the passing Flow's
     read rejected.
   - Fail-first tests in `site-reset/tests/ledger.test.ts`: an explored lasting act, then `beforeTrial` with
     `startReset`, returns that act under the hook's list. In `candidate/tests/trial-gate-reset.test.ts`: the trial
     evidence carries it.
   - Also consider running lane D with `--model-reset-only` periodically, so Rule 1's model path is actually
     exercised.
3. **Domain: a lasting press result names the row it changed** (`actedOn`).
   - File: `domain/.../node-run/outcome.ts` (or `press-effect/`).
   - When the target sits in a list item, the result says `actedOn: "item 1/8: Tom Becker · 1 mutual friend"`. When a
     kept set exists and excludes that row, it adds the rejecting condition.
   - Test: the inbox press result carries the row's words and the item marker.
   - This is the fallback for any press fix 1 lets through, for example a list with no read.
4. **Domain: the structure packet's control columns.**
   - File: `domain/src/runtime/llm-evidence/structure/packet.ts`.
   - For a field whose element is a control (button, link that acts), either drop `at`, or print it with the item it
     belongs to (`at: t763 (item 1/8)`), and reword `AT_NOTE` so a control column's `at` reads as one row's control.
     Both rounds pressed exactly this handle.
   - Test: `structure/tests/column-at.test.ts`, where the control column's `at` is item-qualified or absent.
   - This is a supporting change, not a fix on its own.

## Commands run and observed results

Read-only only: listings, `grep`, `sed`, and a `python -c` decision summary over the two runs' `steps/`, plus reads of
the Core and domain sources named above. No test, build, Lab run or provider call.

## Not verified

- The exact `control.item` token sent for `t763`. It is not logged in `steps/`. I inferred it from `webTargetSpot`.
- That `act-1` is the Confirm. This is inferred from act numbering (`leftOnSite` starts at `act-2`, and it is the only
  lasting exploration declaration). No ledger dump exists in `logs/core.log`.
- Whether extract_list rows already carry each row's record address. Fix 1 depends on it.
- How lane B and the other lanes would be affected by fix 1.
- The `--model-reset-only` behaviour is traced in code, not run.

## Open questions or contradictions

- The system prompt already states the rule fix 1 enforces ("do or write the act once on one item it kept"). The
  model broke it twice with identical wording, so prose is not enough. This fits the user's "enforce mechanically"
  standard.
- Rule 1 cannot be satisfied for acts the site cannot reverse (an accepted request). Only prevention keeps the site as
  the build found it.
- The round 17 debug's D1 proposal (a), "refuse a press on a row a read's condition rejected", would not have fired
  here, because no exploration read had a condition. The guard must also refuse when no read kept the row.
