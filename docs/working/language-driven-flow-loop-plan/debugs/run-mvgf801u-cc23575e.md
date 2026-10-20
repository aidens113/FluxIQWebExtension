# Debug: run-mvgf801u-cc23575e (photo-social-newest-likes, rerun round 2)

Status: FAILED. Diagnosis only (brief debug-rr2-photo, 2026-10-20). No source edits, builds, browser or paid runs.

## The run

- Task `photo-social-newest-likes`, built from the real extension chat (step 0001 `flow.createHere`), workspace
  `claude-photo-likes-t567-20261020-r3`, instance rr2-slot-4, lane tree `fxwork/t567`, $0.25 purse.
- Source: downstream `ddf41bf4`, Core `ca23a8ba` (current dev). These carry L1 (icon-only Like/Unlike take their names
  from their labelled svg, so a toggle can settle; one settlement model on observed state), t733, lane S's prompt-rule
  move and chat instruction-fold fix, and lane T's run environment.
- 112 provider calls, $0.137, about 21 minutes (08:28:08 to 08:49:16 UTC), 224 steps. The purse was not the limit.
- Ended: no Flow. `evaluation.json` reports `verdict: failed`, `runtime.behavior`, `flowCreated: false`, no oracle
  verdict, no replay. The chat's last words: "Its test run from the start was judged not to do what you asked, so
  nothing was put into the Flow. I kept what I wrote as a draft."
- Environment: one `llm.provider_http_error` at 0093. The next decision (0094) went through, and nothing was lost. The
  Lab log (`rerun2/slot-4.log`) shows no fault, a clean ending, and the cost recorded. Environment is not the cause.

## How far it got

This is the furthest this task has got. A reset undo was admitted, four trials ran, and one was judged.

| Phase | Steps | Result |
| --- | --- | --- |
| Look and plan | 0002-0010 | Correct plan: one subflow `like_recent_posts` carrying both parts. |
| Brief 1: exploration | 0011-0053 | Opened the studio, read the Reels and Posts grids, and liked the 29 Sep reel `DgYZxS8LJOe` in its dialog at 0027 (act-8, `modify_existing`). That reel is one of the right three. |
| Brief 1: draft | 0055-0057 | Revision 1 was accepted. Its trial was refused `candidate.trial_reset_required` for act-8. The settle words were exact: "Its control at .../p/DgYZxS8LJOe/ still shows the state this act set: press that same control back once". |
| Brief 1: reset | 0059-0069 | The undo press used a stale handle and was refused `target_unobserved` (`page_moved_since_packet`), twice. A press on another post's link was refused `candidate.undo_unproved` (0063, correctly). Three identical repeats ended the brief. |
| Brief 2 (resent): reset | 0099-0107 | The builder went to the reel's page (0101), closed the messages layer (0105), and pressed `Unlike` naming act-8 (0107). **This was admitted and landed.** |
| Brief 2: trials | 0108-0151 | Four trials ran: revision 1 (0109), revision 2 (0117), revision 3 (0127) and revision 5 (0151). Revisions 1 to 3 failed on fixed handles; revisions 2 and 3 reopened the pinned first tile on pass 2. Revision 5 navigated by `$row.link` but had no `repeat most`, so it **liked all 24 grid posts**. The judge said no (0152-0153: "liked every one of them"). |
| Brief 2: revision 6 | 0155-0163 | Revision 6 added `repeat most: 3` and a pin filter. Its trial was refused `trial_reset_required` for acts 27 to 50 (the 24 trial likes). **Every act's settle line read "Its control at [withheld]"**. The one undo tried was refused `undo_unproved` (0163, correctly: it pressed a grid tile link). The brief ended blocked (0164). |
| Ending | 0165-0166 | The supervisor's `complete` was refused `project.completion_reset_first`, correctly. |
| Brief 3 (reset) | 0168-0223 | The builder had no address for any act. It went to the home feed and pressed the first feed post's `Unlike` (`undo_unproved`, 0171). It tried that post's `liked_by` page three times (0203, 0209, 0215: `page_changed`; the site answers "Sorry, this page isn't available"). It went back home in a loop until the repeat guard refused the same navigation three times (0219-0223). |
| End | 0224 | The supervisor completed honestly as failed. |

## Where it went wrong, in order

1. **0027 (model, harmless on its own).** The builder liked a post while exploring. This is a legitimate probe. L1 then
   gave it an exact way to undo the like, and brief 2 used it.
2. **0057-0069 (product contributor, then model).** `core.test_subflow` refused the trial, but first it moved the tab:
   Core's start check loaded the build's start location (`~/`). The refusal carried no page and did not say the page
   had moved. The model pressed `t1020` from its last view (0059, stale). The stale-handle refusal did carry the home
   page, but the model pressed `t1020` again (0061), then another post's `1d` link (`t88`, 0063, refused
   `undo_unproved`), then `t1020` three more times into the repeat guard. Brief 1 was lost. Brief 2 recovered in the
   right way, by navigating first.
3. **0117 and 0127 (model, caught by the trial).** Revisions 2 and 3 open "the post" through one fixed tile handle,
   the pinned first tile (`control: "Pinned post icon 2.9K47"`). Pass 2 failed with `web.target.not_found`. This is
   the same pinned-first confusion as R7.
4. **0149-0151 (model, caught by the judge).** Revision 5 fixed the navigation (`url: $row.link`). It put `limit: 3`
   only on the stored dataset and dropped `repeat most`, so the loop ran over all 24 rows and liked every post. The
   trial and judge caught this, as they should.
5. **0157-0223 (product, decisive).** Revision 6 was plausibly close; see "Next likely failure". It could never be
   tried, because the 24 likes from the revision 5 trial could not be undone. Each act's `settle` clause told the model
   to "press that same control back once" at **`[withheld]`**: 24 times in the 0158 request and 24 in the 0170
   request. Each act's `did` is "trial step N 'like the post' on 'Like'". Nothing tied an act to a post. The builder
   could not find the 24 posts, and the reset brief wandered (home feed, own profile, `liked_by` pages) until the
   repeat guard stopped it.

### Why `[withheld]` (decisive cause, Core)

- A trial's lasting acts are read off the trial's trace by
  `service/candidate-trial/landed-acts.ts` `automationStudioCandidateTrialLandedActs` → `controlsOf`. The page address
  comes from `attempt.stateRefs.stateDiff.controls.location` (the L1 d7 field "so a ledger that has read no page of it
  knows where to look").
- The trace it reads is the **withheld** copy. `executor/graph-run.ts` returns
  `saved = withholding.apply(...)`, and `service/subflow-trial/run.ts` line 201 passes `executed.trace` (that copy) to
  `automationStudioCandidateTrialLandedActs`. `service/candidate-trial/run.ts:157` and
  `service/project-build/entry-preparation.ts:131` do the same.
- `executor/trace-withholding.ts` withholds, by value, every resolved value found under its `TRACE_DATA_KEYS`, and
  `stateDiff` is one of those keys. The step "open the post" resolved `url: $row.link` to the post's address. That
  same address is the location of the Like press that followed, so it became `[withheld]`.
- The ledger stores that string as the act's place location. `settlement-words.ts` writes it into the settle clause.
  Core's own `lookFirst` / `compareAt` cannot look at it either (not traced, see Not verified).
- Exploration acts are unaffected, because they come from live tool results, not a trace. That is why act-8's settle
  line at 0057 had the real address.

So any trial act on a page reached through a row-bound or input-bound address cannot be reset by the model. Examples
are opening each result by its own link, then pressing save, follow, like or add. This is general, not about this
site.

### Why `page_changed` led to the repeated identical call (0215-0223)

- 0203, 0209 and 0215 reached `/p/D1OKDvAEHfa/liked_by/`. That is the site's "Sorry, this page isn't available"
  page. 0203 and 0209 got there by navigating; 0215 by clicking the feed's "842 likes" link. Each was answered
  `web.action.rejected.page_changed` with **no reason, no `next` and no page**.
- From that page, the model's way out each time was the same `web.output.browser-navigate` to `~/`: 0204
  (`reset.back_home`), 0212 (`reset.home2`) and 0218 (`reset.home3`). The repeat guard
  (`llm/repeat-guard/outcomes.ts`, "A call that goes where it went before is no progress either") marked 0212 as
  `same_result`, because the identical call from the same page ended on the same page as 0204. It therefore refused
  0218, 0220 and 0222 unrun. The third refusal ended the reset brief.
- The guard was right: the model was cycling home → `liked_by` → home with no new information. It did not try the
  page's own "Go back to Framelight." or Home link, which are different calls. The loop is a symptom. The reset brief
  had nothing to go on because of the `[withheld]` addresses. A minor contributor is that `page_changed` carried no
  page view of where the tab landed.

## Is R7's cause gone?

**Yes.** In R7, an Unlike undoing an exploration Like was refused `undo_unproved`, so no trial ever ran. Here, act-8
was liked inside the reel's dialog over the profile and undone on the standalone post page (0107). The undo was
admitted and landed (`control: "Unlike"`, `changed` shows the counts). The next trial ran (0108). The settle words at
0057 named the exact control and page. Acts 24 and 26 (two trial presses on the pinned post's Like, one liking and one
unliking) were later admitted beside the revision 5 trial (0150). That is consistent with the toggle witness seeing the
control back in its first state, but I did not trace it.

## The sibling's failure mode (a press before any witness seals the baselines)

**Did not happen in a way that mattered.** The first lasting act (act-8, 0027) came before any complete list read. It
is an in-place toggle with a stated state (Like → Unlike), though, so L1's own-control witness settles it with no
collection baseline. The 0057 settle clause was the toggle clause, not the "no list was read complete" clause, and it
settled after 0107. The trial likes (acts 27 to 50) were blocked by their missing addresses, not by a sealed
baseline: their settle clauses are the toggle clause too.

## Next likely failure (model, not a product defect)

Revision 6 (0155) excludes the pinned tiles with
`where: svg_x19a3hff_x1w6fp7c_x1x0eia9_aria-label is absent`. The grid read offered that column with sample "Pinned
post icon", but with coverage 0.67 (0139). Only three of the grid's tiles are pinned, so that coverage suggests the
same icon class also marks reel or carousel tiles. If so, `is absent` would drop the 29 Sep reel, and the Flow would
like the wrong third post. The trial and judge would catch that. It is the R7 page-view gap again: the pin mark a
person sees is visible to the model only as a column named after CSS classes. This is not verified.

## Cause class

**Product defect (decisive, Core), with model mistakes the trial and judge caught, and two product contributors.**

1. Decisive (Core): `service/candidate-trial/landed-acts.ts` `controlsOf` reads the act's page location from the
   withheld trace, so a trial act's settle clause says `[withheld]`. With many look-alike acts, the model cannot tie
   any undo to its post, and no further trial can run.
2. Contributor (Core): `flow-bootstrap/subflow-candidate/builder-loop.ts` `executeTool` returns `gate.test(...)` bare.
   The t477 post-trial look (`flow-bootstrap/candidate/trial-view.ts` `automationStudioCandidateTrialView`) is wired
   only in `candidate/authoring-loop.ts:158`. So no `core.test_subflow` answer carries `pageAfterTrial`: not the reset
   refusal that moved the tab (0057), and not the trials that ran (0109, 0117, 0127, 0151). Brief 1's stale-handle
   loop came from this.
3. Contributor (domain, minor): a `page_changed` refusal (0203, 0209, 0215) carries no page and no reason, though the
   tab moved somewhere.
4. Model: a fixed tile handle in a loop (revisions 1 to 4), no `repeat most` (revision 5), a wandering reset brief,
   and the brief-1 repeats.

Not the task, oracle or fixture: the audit row is achievable and unambiguous, and the `liked_by` "not available" page
is not on the honest path. Not the environment.

## Proposed least, general fix and its test seams

**1. Give a trial act a real address (required, Core).**

- In `service/subflow-trial/run.ts`, `service/candidate-trial/run.ts` and `service/project-build/entry-preparation.ts`,
  compute landed acts from the in-memory trace before withholding. `graph-run.ts` already hands both copies to
  `onExecutedTrace(defended, saved)`. Alternatively, have `landed-acts.ts` take the location from that unwithheld
  copy. The ledger then keeps the true address for its own `lookAt` / `compareAt`.
- What the model is shown (supervisor decision): the address is a page URL that the model's own reads and page views
  already showed it (`item_url` samples, `~/p/<id>/` hrefs). The least change is to show it in the settle clause as
  exploration does. If resolved values must stay withheld from model text, the settle clause must never contain
  `[withheld]` and must instead name the act by its loop pass and row: "trial step 7, pass 1 over `posts`, that row's
  `link`". The model can then reopen that row. Either way, `settlement-words.ts` must not emit a place it cannot name.
- Tests: in `service/candidate-trial/tests/landed-acts.test.ts`, a trace whose navigate resolved `$row.link`, followed
  by a toggle press on that page, yields an act whose `controls.location` is the address, not `[withheld]`. In
  `flow-bootstrap/site-reset/tests/settlement-shapes.test.ts`, no settle clause contains `[withheld]`. Generic
  example: opening each book of a reading list by its link and pressing "Want to read".

**2. Show the page after `core.test_subflow` (Core).** In `subflow-candidate/builder-loop.ts` `executeTool`, wrap
`gate.test(call.value, call.signal)` with `automationStudioCandidateTrialView`, exactly as `authoring-loop.ts:158`
does. Test beside the builder-loop tests: an answer with `effectApplied: true` (a refusal that moved the tab, or a
trial that ran) carries `pageAfterTrial`, and one that did not move carries nothing new.

**3. A `page_changed` refusal carries where it landed (domain, optional).** Attach the landed page view to a
`page_changed` refusal, as `target_unobserved` does. The seam is the action-failure capture that builds the
`web-llm-tool-result.v1` refusal (`domain/src/runtime/llm-evidence/action-failure/`). I did not locate the exact
function.

Not proposed: loosening the repeat guard (it was right), admitting trials over unresolved strict acts, or any change
to the task, oracle, fixture or model guidance that names this site.

## Chat and UI

- Ending (`45-failure-panel.png`): "Couldn't reset the site — The builder couldn't finish: it kept trying without
  getting any further". Then: "the likes could not be limited to three and some remain". The second sentence is the
  model's, and it is wrong about the cause: revision 6 did limit to three and was never tried. The panel does not say
  how many likes the build left on the site or where they are. The chat cannot name them either, for the same
  `[withheld]` reason.
- "Saved candidate draft. Verification pending; the Flow's steps are unchanged." is accurate.

## Rerun notes

Workspace `claude-photo-likes-t567-20261020-r3` still holds the build's trial likes (up to 24 studio posts), so a rerun
needs a fresh workspace. Rerun only after fix 1. Without it, any trial that likes the wrong set deadlocks the reset in
the same way, so a rerun now would be an unchanged retry. Fix 2 should land with it.

## Not verified

- That `lookFirst` / `compareAt` failed on the `[withheld]` location. I inferred it; the run logs no ledger detail.
- Why act-24's entry at 0119 had no `settle` clause at all, and how acts 24 and 26 came to be admitted at 0150.
- That revision 6's pin filter drops reels. This rests only on coverage 0.67.
- The exact client branch that answered `page_changed` for the "not available" page (an HTTP status, or an unexpected
  landing).
- Whether the first home-feed post (`D1OKDvAEHfa`, pressed at 0170) was one of the trial's 24 likes or liked before
  the build.

## Evidence

- Run: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-20/run-mvgf801u-cc23575e`. Step folders:
  - 0027: the exploration like.
  - 0057: the reset demand, with the exact toggle clause.
  - 0059 to 0069: brief 1's stale-handle loop.
  - 0101 to 0107: the admitted Unlike.
  - 0109, 0117, 0127 and 0151: the trials.
  - 0149: revision 5, with no `repeat most`.
  - 0152 and 0153: the judge.
  - 0155: revision 6.
  - 0157: 24 `[withheld]` settle clauses.
  - 0158 and 0170 `request.txt`: what the model saw.
  - 0203, 0209 and 0215: `page_changed`.
  - 0219 to 0223: the repeat refusals.
- Run folder and UI: `fxwork/t567/!FluxIQWebExtension/test-runs/instances/rr2-slot-4/run-mvgf801u-cc23575e` and
  `...ui-review.local/45-failure-panel.png`.
- Code, Core at `fxwork/t567/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/`:
  - `service/candidate-trial/landed-acts.ts` (`controlsOf`);
  - `service/subflow-trial/run.ts:201`;
  - `executor/graph-run.ts:201`;
  - `executor/trace-withholding.ts` (`TRACE_DATA_KEYS`);
  - `flow-bootstrap/subflow-candidate/builder-loop.ts:318`;
  - `flow-bootstrap/candidate/authoring-loop.ts:158`;
  - `flow-bootstrap/candidate/trial-view.ts`;
  - `flow-bootstrap/site-reset/ledger.ts` (`beforeTrial`, `lookFirst`);
  - `llm/repeat-guard/outcomes.ts`.
