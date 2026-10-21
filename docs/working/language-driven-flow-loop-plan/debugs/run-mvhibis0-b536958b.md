# Debug: run-mvhibis0-b536958b (photo-social-newest-likes, rerun round 5)

Status: FAILED. Diagnosis only (brief debug-rr5-photo, 2026-10-20). No source edits, builds, browser or paid runs.
Posts are named by their place on the studio's profile grid (cells 1-3 are the pinned posts; the task's answer is
cells 4-6). No page text, typed value or token is copied.

## The run

- Task `photo-social-newest-likes`, built from the real extension chat (0001 `flow.createHere`), instance rr5-slot-4,
  lane tree `fxwork/t567` (downstream `e04711f0`, Core `3caf1ff0`), $0.25 purse.
- 81 provider calls, $0.116 spent, about 22 minutes, 167 step folders. The purse was not the limit: about $0.13 was left.
- Ended: no Flow. `evaluation.json`: `verdict: failed`, `runtime.behavior`, `flowCreated: false`, no oracle verdict. The
  supervisor completed `ended: partial` (0167).
- Environment: all 167 `meta.json` are `status: ok`, no provider error, and the Lab log ends cleanly with the cost.
  **The environment is not the cause.**

## How far it got

Further than round 4: trials ran (round 4 never got one past the reset gate). **Furthest point: the judged whole run
of revision 2 (0097), judged no.** Forward progress stopped at **0103**, the first refused revision 3. After that no
revision was ever accepted again.

| Phase | Steps | Result |
| --- | --- | --- |
| Plan | 0002-0008 | Correct: one subflow carrying both parts; look-alike accounts put under `notAsked`. |
| Brief 1: exploration | 0009-0067 | Opened the profile, the reels tab, then the clip (cell 5) as the dialog over the profile, and liked it there (0035, act-11, a toggle). Read the grid by address (0051, `extraction.4`, 24 rows). That read offered a field holding the pinned marker (coverage 0.5) and dated `alt` text. 0056-0067: six reads of the profile's `extraction.4` while standing on the post page. Each read 0 rows, with words blaming the selector, and two were refused as repeats. |
| Rev 1 + reset | 0068-0082 | Rev 1 opens grid tiles by click. The trial was refused for act-11 (0071). The undo landed and settled at 0082 (t743's toggle-back works). |
| Trial 1 | 0084 | `execution_failed`. Pass 1 clicked cell 1 (pinned), which opened the post dialog, and liked it (**act-13**). Pass 2 could not find the next tile under the dialog. |
| Rev 2 + reset | 0087-0096 | Rev 2 opens each row's link by address (sound). act-13 was listed **with no address and no `settle` clause** (0090). The builder guessed the clip's page and was refused `undo_wrong_target` (0095, correctly). It then admitted act-13 as `cannotUndo` (0096). |
| Trial 2 (judged whole run) | 0097-0101 | Liked cells 1-3, the three pinned posts. Pass 1 *un*-liked cell 1, taking act-13 back. Stored 24 rows. The judge said **no** (right). Its advice was only "limit the read to 3". It never said that cells 1-3 are pinned and are not the newest. |
| Brief 1: stall | 0102-0117 | Revisions alternated between `recordOutput.process: {limit: 3}` and `extractList.maxItems: 3`, both refused `record_output.process_order_in_repeat` (0103, 0113), and the unchanged rev 2, refused `candidate.unchanged_after_no` (0105, 0109). Four `repeat_refused` ended the brief. |
| Brief 2 (repair) | 0118-0148 | Given the failing receipt. It never submitted. It went back and forth between profile and post page by address and used profile handle `t425` on the post page (`target_unobserved`, 0130, 0142), until `repeat_refused` (0144-0148). |
| End | 0149-0167 | Ending refused `completion_reset_first` (0150). Reset brief 3 (0152-0166), then `ended: partial` (0167). |

## Root cause

### Decisive: Core's listing-order rule cannot be met in the web domain (product, cross-repository contract)

t741 (round-3 fix) added `flow-bootstrap/script-statements/listing-order-in-repeat.ts`
(`automationStudioFlowPlanListingOrderInRepeatIssues`).

**What the rule does.** It refuses a listing whose `recordOutput.process` has `sort` or `limit` when a For Each over
that listing makes a lasting press. Its `instead` says to put the order on `extractList.sort`, narrow with
`extractList.where`, and use `repeat most`. `plan/flow-script-format.ts` gives builders the same advice (request line
450).

**What the web domain does.** In S4, the domain moved `extractList.sort`, `maxItems`, `dedupe` and `minItems` off the
page and into `recordOutput.process` (`domain/src/output-nodes/extract-list/one-page-read.ts`,
`record-output-process.ts` `webAutomationRecordOutputProcessOfRead`: `maxItems` becomes `limit`, `sort` stays
`sort`). Then, at plan time, t510's "one reader" resolver rewrites the step's record output to the one the dispatch
builds (`domain/src/runtime/llm-evidence/plan-resolution/extraction/run-record-output.ts` `webPlanRunRecordOutput`,
called from `resolve-plan-node.ts:683`). So the rule sees a `process.limit` or `process.sort` the model never wrote.

**Seen live.** At 0112 the script had only `extractList.maxItems: 3` and no `recordOutput.process`. It was refused at
`...recordOutput.process.limit` (0113).

**Inferred from the code, not exercised.** The rule's own `instead`, `extractList.sort`, maps to `process.sort` the
same way and would be refused too. Even if it were not refused, it would not change which rows the repeat visits:
the web extract node hands its rows downstream in page order and sorts nothing itself.

**So the gate asks for something no script can give.** In this domain there is no way to:

- order the rows a lasting repeat walks;
- keep the saved answer to the N rows it acts on, which this task's "table of the posts you liked" needs.

The one shape that is both coherent and executable is:

- `extractList.where` leaves out the pinned-marker rows (a field the read offered);
- `repeat most: 3`;
- `process.limit: 3` with no `process.sort`.

That shape saves exactly the rows it acts on, both in page order, but it is refused too: the rule refuses `limit`
even with no sort and a limit equal to `repeat most`.

**Why this is decisive.** Brief 1 spent its last 16 steps between two refused forms and the unchanged revision, and
the guard ended it. Brief 2 saw the same refusal in its history and never risked a submission. This is round 4's
pattern (a) again: a Core answer that left the builder no call it could carry out. This time the source is the
interface between Core's rule and the domain's dispatch, and no test covers that interface:
`listing-order-in-repeat.test.ts` "allows the order on the listing itself" builds a Core plan, not a
domain-resolved one.

### Contributing, and the run's most serious side effect: the reset left a like the person never asked for (product, Core reset settlement)

The end state is very likely wrong. **Cell 1 (the pinned giveaway post) is left liked.**

- 0155: its control reads `Like`, which is the state the build found it in (the fixture starts with nothing liked).
- 0156-0157: the reset pressed it "undoes act-14". It now reads `Unlike`, and Core answered `settled: act-14`.

The chain:

1. **act-13 had no place.** It was pressed in trial 1 inside the post dialog that a grid click opens: the same
   pushed-URL dialog view as round 4. Every listing of it gives only `did`, with no address and no `settle`. By
   contrast, act-14 to act-16 (trial 2, pages opened by address) carry their pages' addresses. `site-reset/ledger.ts`
   `trialRan` calls `tracker.landed` only when the act has `spot.place` and `controls`. So act-13 never seeded the
   start of cell 1's control place. Inferred: no ledger trace is logged.
2. **act-14's own before-state became the place's start.** act-14 was trial 2's pass-1 press on cell 1, which undid
   act-13. Because the place had no start yet, `reset-settlement/control-tracker.ts` `landed` seeded the start from
   act-14's own before-counts: `if (!this.starts.has(place)) this.starts.set(place, before)`. Those counts were the
   liked state act-13 had made. act-14's toggle is liked to unliked, and `standing` calls it "back" when the place is
   liked again.
3. **Core told the reset builder to re-like the post.** The settle words said "press that same control back". The
   builder did, and Core called it restored. This is what "Do not change anything that was there before the build
   began" forbids. The reset brief, the supervisor's reason (0167) and the chat all say the opposite of the real
   leftover.

### Contributing: model choices the product steered badly

- **Grid order including the pinned posts.** Round 4 predicted this ordering gap as the next failure, and it happened.
  The read offered a pinned-marker field and dated `alt` text. The builder used neither, and its decision summaries
  (0104, 0108, 0114) claim "sorted newest first" over scripts that carry no sort.
- **Judge evidence gap (product).** The judge saw only the stored `link` column and the visited ids, never what marks
  a row (the pinned label, a date). It reasoned "s8 liked the three most recent" (0100) and advised only a count
  limit. That steered the builder straight into the refused `limit`.
- **Reads of a list issued on another page (product words).** At 0056-0067, `extraction.4` (issued on the profile) was
  read on the post page six times. The answer said "change the selector rather than the fields", not "this list was
  found at another address; you are on a different page".

### Not a task or fixture defect

The task is achievable and unambiguous. The expected answer (`breadth/newest-likes/expected.ts`) is grid cells 4-6
newest first, each with its own Like on its own page. The grid marks pinned tiles with a visible pin icon, and every
post shows its date.

## Round-4 causes and t743/t748

- **Recurred.**
  - Pattern (a): two briefs ended on repeats after answers with no executable next step (0103-0117, 0130-0148).
  - The dialog-over-profile view: a trial act pressed there carries no place (act-13). t743 closed this view for
    group witnesses only, not for a trial act's toggle and location.
  - The predicted ordering gap.
- **t743 behaved as designed but exposed chain step 2.**
  - Toggle-back settled correctly for act-11, act-15 and act-16 (0082, 0161, 0165).
  - For act-14 the same "press it back" words were applied against a start seeded after the build's own act-13, and
    re-liked the post.
  - No `gate_unsatisfiable` ending occurred in this run. act-13 should have had one: it was unplaceable and was
    instead admitted as a silent `cannotUndo`.
- **t748 item 1** (a step's view is chosen from its preceding steps) did not cause anything seen. The like step's
  saved name followed the latest view of its handle: `Unlike` in rev 1, while act-11 was still in place, and `Like`
  in rev 2 (0088 `changedPaths` `...nodes.7.parameters.element.accessibleName`). The press still resolved, so this
  is noted, not causal.
- **Supervisor.** It did send one changed repair brief (0118) before ending, which is round 4's (b) working as now
  written. It ended with about $0.13 left after that repair blocked.

## UI review (screenshots in `test-runs/instances/rr5-slot-4/run-mvhibis0-b536958b.ui-review.local/`)

- **Chat stream.** Mid-build, it reads as clean turns with a composer and a Stop button (`02`, `06`, `22`, `35`).
  Defects:
  - **Starting state.** `01-start-panel.png` shows "FluxIQ needs a model key before it can build", although the build
    then ran with a key. The welcome text is also scrolled and cut at the top.
  - **Internal terms in the chat.** `15-mid-build-panel.png` shows "Using "Submit subflow"" and "Action · Submit
    subflow". "Reading the list of "link"" reads awkwardly.
  - **A failed read shown as done.** The same panel shows "Done: 0 rows from 1 page" with a success mark, for a read
    of the wrong page.
  - **Misleading reset labels.** `35-mid-build-panel.png` labels the reset "Fixing your Flow". It shows "Click · Like
    Done" under "Undo the three likes": the press that put the like back, displayed as success.
  - **The ending.** `36-failure-panel.png`:
    - three stacked paragraphs repeat one verdict ("judged not to do what was asked", "kept what I wrote as a draft",
      "Saved candidate draft");
    - the leftover is named "used "Unlike"" (a control, not the post, and the reverse of the real leftover);
    - navigation clicks ("Reels", "Close", "Posts" and so on) are listed as possibly lasting changes;
    - no composer is visible at the end.
- **On-page overlay.** It was present in 35 of 35 working moments, but it is not stable:
  - It jumps between three screen positions (y 16, 318 and 620), sometimes within one 3-second window: #5, #8, #15,
    #20, #25, #26 and #35 (`08-mid-build-scenario.png` mid-left, `15-mid-build-scenario.png` bottom-left).
  - At the top-left it covers the site's own logo (`02-mid-build-scenario.png`).
  - It flickered at #6, #15 and #30, and was gone across a page load at #8 and #29.
- **Status text.**
  - Post pages are named "Opening "photo social"" (#11, #16, #23, #30, #33) after a path segment, not the page.
  - It lags what is happening: "Opening "harbourlight studio"" shows over the open reel dialog in `08`.
  - It shows jargon: "Not done: using "Submit subflow" — it was already…" (#28) and "Whole-Flow trial could not be
    confir…" (#22).

## Recommended fix (generic; nothing names this site, likes, posts or pins in model guidance)

**1. One ordering contract between Core and the domain (required; structural, because the same kind of cause has come
back).**

- **Core** `flow-bootstrap/script-statements/listing-order-in-repeat.ts`:
  - admit `process.limit: N` with no `process.sort` when the For Each it feeds has `repeat most` equal to N, since the
    saved rows and the acted rows are then the same first N in the listing's order;
  - build the `instead` from a capability the listing's node definition declares, for example
    `answersRows: "page_order" | "sorted"`. Where rows come in page order, the `instead` names only `extractList.where`,
    `repeat most: N` and `process.limit: N`, never `extractList.sort`.
- **Core** `flow-bootstrap/plan/flow-script-format.ts`: the same condition on the "put the order on the listing step
  too" sentence.
- **Domain** `output-nodes/extract-list/` (node definition): declare `page_order`. Keep the mapping, but have
  `plan-resolution/extraction/run-record-output.ts` refuse at the authored key (`extractList.sort` or
  `extractList.maxItems`) rather than at a `process` key the model never wrote.
- **Tests that fail first:**
  - domain `runtime/llm-evidence/plan-resolution/tests/`: resolve a script with `extractList.where` +
    `extractList.maxItems: 3` + `repeat over` + `repeat most: 3` + a `modify_existing` press, then run Core's
    completion check. Today this gives `process_order_in_repeat` at `process.limit`; after the fix it is admitted.
  - the actionable-answer property: apply this rule's `instead` literally to a resolved web plan. It must pass the
    rule. Today `extractList.sort` would not.

**2. A reset must never move a control away from the build's start (required, Core and domain).**

- **Core** `reset-settlement/control-tracker.ts` `landed` and `read`:
  - seed a place's start only from evidence taken before this build's first lasting act on that page;
  - otherwise mark the start `unproven`. A toggle with an unproven start never settles by pressing back: its words
    are closed, and the ending tells the person the control may differ.
- **Core** `site-reset/ledger.ts` `trialRan`: a trial act with no place and no location is answered
  `gate_unsatisfiable` (closed), not listed with no `settle` and then waved through as `cannotUndo`.
- **Domain:** a trial step's press must report its spot place and its page location in the pushed-URL dialog view as
  well.
- **Test that fails first:** in `reset-settlement/tests/` beside the tracker tests, trial 1 presses place P with no
  controls; trial 2 lands a press at P with before = state B and after = state A. Pressing P back to B must not
  report `holds`. Today it does.

**3. The judge sees what marks each visited row (Core).** In `runtime/result-verification/read-account/`, for a read
walked by a lasting repeat, give the judge each visited row's own label (the read's readable row text), so a "first
N" or "most recent" request can be checked against the rows the run actually visited. The test goes beside the
read-account tests: 24 rows, `repeat most: 3`, and the account carries the three visited labels.

**4. Words (domain).** When an `extraction.N` handle is read away from the address it was issued at and finds
nothing, say so instead of "change the selector". The test goes beside the extract-list read-answer tests.

**5. UI (extension).**

- Keep the overlay at one fixed corner, clear of page landmarks.
- Name pages by title, not by path segment.
- Keep "subflow" out of the chat and the overlay.
- De-duplicate the ending paragraphs, and name a leftover by its item.
- Keep the composer visible at the end.
- Drop the model-key notice when a key is configured.

Not proposed: loosening the repeat guard (it was right every time), or loosening `undo_wrong_target` (0095 was right).

## Rerun notes

- Use a fresh workspace: cell 1's like is very likely still on the site.
- Rerun after fix 1 and fix 2. Without fix 1, any task that acts on the first N of a listing and reports those N
  reproduces brief 1's stall.

## Not verified

- No ledger trace is logged. Steps 1 and 2 of the reset chain (act-13 had no place or controls, and the start was
  seeded from act-14's before-counts) are inferred from the code path and from act-13's listings carrying no address.
  They are not observed.
- That `extractList.sort` is refused through the same mapping is inferred from code. The model never wrote it. Only
  the `maxItems` path was observed (0112-0113).
- The final site state comes from the 0157 page view. No oracle ran.
- That no composer appears in `36-failure-panel.png` is a single frame; it may be scrolled out of view.

## Evidence

- Steps (`lab-runs/2026-10-20/run-mvhibis0-b536958b/steps`):
  - 0029: the dialog view;
  - 0049 and 0051: grid read, fields;
  - 0056-0067: reads on the wrong page;
  - 0068 and 0087: revisions 1 and 2;
  - 0071 and 0082: act-11;
  - 0084: trial 1, act-13;
  - 0090: act-13 with no settle;
  - 0095: `undo_wrong_target`;
  - 0097: trial 2;
  - 0100 and 0101: judge;
  - 0103 and 0113: `process_order_in_repeat` (0112's script has only `maxItems`);
  - 0105: `unchanged_after_no`;
  - 0121 `request.txt` lines 450-452: the sort guidance;
  - 0130-0148: repair repeats;
  - 0150: `completion_reset_first`;
  - 0155 and 0157: cell 1 goes from `Like` to `Unlike` and is reported `settled`;
  - 0167: the ending.
- Code (Core `packages/fluxiq/src/programs/automation-studio/runtime/`):
  - `flow-bootstrap/script-statements/listing-order-in-repeat.ts`;
  - `flow-bootstrap/plan/flow-script-format.ts`;
  - `flow-bootstrap/reset-settlement/control-tracker.ts` (`landed`, `standing`);
  - `flow-bootstrap/site-reset/ledger.ts` (`trialRan`).
- Code (domain `domain/src/`):
  - `output-nodes/extract-list/one-page-read.ts`;
  - `output-nodes/extract-list/record-output-process.ts`;
  - `runtime/llm-evidence/plan-resolution/extraction/run-record-output.ts`.
- Task: `apps/scenario-lab/src/scenarios/photo-social/breadth/newest-likes/{expected,workflow}.ts`; `state.ts`
  (`liked: []` at start).
