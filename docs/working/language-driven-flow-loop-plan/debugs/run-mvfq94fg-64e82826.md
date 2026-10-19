# Debug: run-mvfq94fg-64e82826

- Instance: bf-slot-2, lane tree `fxwork/t719`, task `job-board-save-quillmark-remote`, fresh workspace
  `claude-job-save-t719-20261019-r2`, authoring mode `project`, built from the real extension chat. Frozen source
  downstream `79fbbb7a` / Core `e11549a8`, which carry F1 (reset destination, no trial on leftovers) and F2 (joined
  row values, a pass row's own control by structure). $0.25 ceiling, no start hook.
- Verdict: **failed** (`lab.chat_build_failed`), 118 calls, $0.059999844, about 15 minutes (20:49 to 21:04 UTC).
  No Flow, no whole run, no oracle, no replay. The chat's ending ("nothing was saved and your saved list is
  unchanged") is true: My jobs held the same two jobs, in the same order, from the first look (0045) to the last
  (0211). No job saved before the build was touched.
- Read-only diagnosis (brief R9). Evidence: `steps/`, `logs/core.log` (timing trace only), and the workspace's
  `project.sqlite` and three trial event chunks, copied to scratch.

## What "kept failing" was

Three trials ran, then every later trial was refused.

| Step | Revision | Outcome |
| --- | --- | --- |
| 0055 | 1 | `web.target.not_found` at step 11 "open the job", pass 1, 4 attempts (first try plus 3 retries, waits 0.25 s, 1 s, 2 s, each with a 3.75 s actionability wait) |
| 0057 | 1, unchanged | the same failure, because the feedback said "The step itself is right ... test this same revision again, unchanged" |
| 0071 | 2 | step 11 "save the job" pressed the heart on its own row; step 12 waited for "Saved" and timed out, 4 attempts. The site answered "Couldn't save this job. Try again." (it fails the first save of each page load), so nothing was saved. This press became act-7. |
| 0075 | 3 | refused `candidate.trial_reset_required`: undo act-7 first |
| 0172 | repair 3 | refused `candidate.trial_reset_required`: acts 7, 9 and 15 |

Acts 9 (0117, the heart on a result card) and 15 (0149, the heart on the job page) were exploration presses
declared `modify_existing`. The site rejected both with the same "Couldn't save this job" notice (0118, 0150). So
all three recorded acts had no effect on the site.

After 0075 the build spent about 25 calls trying to undo acts that had done nothing: eight `candidate.undo_unproved`
refusals (0079, 0089, 0178, 0182, 0186, 0209, 0227, 0231), each aimed at "Unsave job" on Product Designer or
Frontend Engineer, both saved before the build began; stale or covered handles (0085, 0174, 0229); repeat-guard
refusals. The supervisor's `complete` was refused `project.completion_reset_first` (0188), a reset brief (0190 to
0237) made no progress, and the final `complete` (0238) ended the build with no steps. Every refusal was correct on
its own terms: the product never let the model unsave a job it did not save.

## First divergent step

**0045.** The builder opened My jobs before any lasting act and saw the whole list: two rows, Product Designer and
Frontend Engineer, each with "Unsave job". That is the original inventory the reset needed. Core recorded nothing
from it, and issued no `resetDestinations` reference, then or ever: no tool result or later request in the run
carries one (the only match for `destination-` in any request is the schema's own pattern).

It surfaced at 0075, the first trial after a lasting act, and from then on there was no reachable way to a trial.

## Why there was no way out (product defect, both repositories)

A reversible act with a subject, page or scope (`strictReset` in Core's `site-reset/ledger.ts`, which is nearly
every press the web domain declares) leaves the reset in only three ways, all in `ledger.ts`:

1. `originalGroupRestored`: the act's own list was read complete before and after it, and is unchanged.
2. `subjectRestored`: a created subject, seen absent before, was removed again.
3. `leftUnchanged` (F1): a list the act's effect would show in, named by an issued `resetDestination` reference,
   was read complete before and after the act and is exactly as first observed.

Every one of them needs Core's own record of a complete list (`observedScopes`, filled by
`site-reset/create-baselines.ts` `observed` from `read.collections`). The web domain produces that record only in
`domain/src/runtime/llm-evidence/control-spot/collection.ts`, `webResetCollections`, and only for a list whose every
item carries `aria-setsize` and `aria-posinset`. The job board's My jobs list (`board/my-jobs.ts`) and its results
list (`board/results-page.ts`) are plain `<ol>` lists with no such attributes, like most real sites. Among the ten
realistic fixtures, only everything-store (its cart and saved-for-later rows, given the attributes in `e8b2d7fd`
when the rule was written) and the social feed's markup carry them.

So on this site Core can never hold an original inventory, never issues a destination reference, and none of the
three exits can ever open. Naming the act under `cannotUndo` does not help either: a kept strict act is refused by
`unprovedReset` (`candidate.trial_reset_unproved`). Before F1, the trial policy admitted a trial on leftovers after
a stalled, identical refusal; F1 removed that escape (`site-reset/trial-policy.ts`, correctly by the user's
2026-10-12 rule), and its replacement exit depends on evidence this domain cannot produce here. The reset
instruction told the model to "read that list completely and name it with its resetDestination ref", which was
impossible: no reference existed to name.

**Did F1 create the dead end?** Not on its own. The previous run (`run-mvectfld-c2f5d958`) also ended on an
unsettleable strict act. F1 closed the stall escape and added an exit gated on complete-list evidence, and that
evidence never exists on a site without set-size markers, so F1 did not open the dead end and made it certain. Its
tests passed because they build their collections directly.

Cause class: **product defect**. Decisive owner: the domain's completeness rule,
`domain/src/runtime/llm-evidence/control-spot/collection.ts` `webResetCollections`. The Core consumer
(`site-reset/ledger.ts` `leftUnchanged`, `originalGroupRestored`; `create-baselines.ts`) is right as written once it
is given the evidence.

## F2: did row matching create a dead end? No

- Revision 1 read all seven cards with no conditions. Pass 1 was therefore the first card: a sponsored card for
  another company (Verity Legal Tech), whose title links through the ad redirect `/pagead/clk?ad=...`. The build's
  control was the second card's title link, `/viewjob?jk=...`.
- The row gate refused the build's link "in another record", correctly: it is in card 2, and pass 1 is card 1.
- F2's structural placement (`apps/extension/src/content/action-runtime/pass-row/row-slot.ts`, `row-data.ts`
  `sameLinkPattern`) then refused card 1's copy, because its link has a different path shape (four segments, not
  three). That is defensible: an ad-redirect link is not the same kind of link. It never decided anything, because
  revision 1 was wrong anyway. Its read kept every company, and its "save the job" step targeted the title link,
  not the heart (both steps named `t309`).
- Revision 2 filtered by `span_1 equals "Quillmark"` and `span_2 equals "Remote (UK)"`, which kept 3 of 7 and
  correctly excluded the similarly named employer. Pass 1 was Senior Rust Engineer, and the heart resolved on its
  own row by selector and was pressed. The row values included the joined value "Quillmark · Remote (UK)", which
  the r1 gate refused. Under F2 the gate held it, so F2's joined-value fix worked live.
- Not exercised: F2's placement on passes 2 and 3, because the trial stopped at pass 1's wait.

## Secondary defect: the unchanged-retest advice (cost one trial)

At 0055 the trial said the step "could not find its control where it was saved, though one like it is on the page.
The step itself is right ... test this same revision again, unchanged", and the model did (0057), with the same
result. Core's near-miss rule (`runtime/service/candidate-trial/target-on-page.ts`) read the extension's resolution
(`candidateCount 1, bestScore 0.407`), but that one candidate was the build's own control, refused by the row gate
as another record's. A row refusal is not address drift. Least general fix: the extension's miss metadata
(`apps/extension/src/content/action-runtime/resolve-target.ts`) says when every scored candidate was refused by the
pass row, and `target-on-page.ts` does not set `targetOnPage` for such a miss. The step should instead say that pass
N's row holds no such control. Test: beside `target-on-page.ts`, a resolution flagged row-refused yields no
`targetOnPage`; in the extension, a two-row list where pass 1's row lacks the control reports the flag.

## Model mistakes (not decisive)

- Revision 1: no conditions on the read, and the save step pressed the title link. Corrected in revision 2.
- The site fails the first save of each page load and saves on a second press. Twice the builder saw "Couldn't save
  this job. Try again." (0117, 0149) and went looking for another save control instead of pressing again. Revisions
  2 and 3 press once. Once the reset dead end is fixed, this is the next likely failure: the judged run would save
  nothing. The product reported the notice faithfully. Not a product defect, and model guidance must not be taught
  this site's behaviour.
- Undo attempts aimed at jobs saved before the build. All were refused.

## Proposed fix (least general) and its test seam

**Decisive, downstream domain plus extension.** Let `webResetCollections` treat a native list as complete without
set-size attributes when the passive capture can vouch for it:

- The list is a real `ol` or `ul` (role `list`) whose direct items each hold exactly one subject, all distinct (the
  existing checks).
- The capture is not truncated.
- The extension's existing continuation detectors find no way on: no Next, no Load more, no growing or declared
  feed. These are the `apps/extension/src/content/extraction/read-coverage/list-continues.ts` detectors (F8),
  reported per list on the passive capture as one closed fact.
- The `aria-setsize` path stays as it is, and `aria-setsize="-1"`, a pager, or a feed still means "not complete".

No Core change is needed: the ledger then records the original at 0045, issues `resetDestinations` references, and
both `originalGroupRestored` (act 9, pressed in the results list) and `leftUnchanged` with a named My jobs
destination (acts 7 and 15) can settle. Do not add set-size attributes to the job-board fixture instead: that would
fit the site to the product and leave seven other realistic sites stuck.

Tests:

- `domain/src/runtime/llm-evidence/control-spot/tests/collection.test.ts`: a plain `<ol>` of three items, each with
  one subject and no set-size, untruncated, reported "does not continue", yields one collection. The same list with
  a "continues" fact, a truncated capture, an item with two subjects, or a duplicate subject yields none.
- `apps/extension/src/content/extraction/read-coverage/tests/`: the per-list fact on a passive capture, for a list
  with a pager, a Load more, a growing feed, and none.
- Use a non-job example, such as a reading list, with no words from this site.
- Core regression (`site-reset/tests/ledger-subject.test.ts`, already shaped for it): a no-effect press in no list,
  with a named destination read before and unchanged after, admits the trial. Tests of this shape exist (around
  lines 523 and 651; not run in this diagnosis) and guard the consumer.

**Secondary (Core plus extension):** the row-refused flag above, so a pass-row miss is never sent back for an
unchanged retest.

Not proposed: reopening a trial on unproved leftovers, accepting `cannotUndo` for strict acts, or any change to the
task, fixture, oracle or model guidance.
