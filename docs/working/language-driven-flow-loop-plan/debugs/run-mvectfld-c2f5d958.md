# Debug: run-mvectfld-c2f5d958

- Instance: bf-slot-2, lane tree `fxwork/t719`, task `job-board-save-quillmark-remote`, fresh workspace
  `codex-job-quillmark-t719-20261018-r1`, authoring mode `project`, built from the real extension chat. Frozen
  source downstream `b3b8d71d` / Core `903ebb58`. DeepSeek flash, `--model-reset-only`, $0.25 / 250 calls / 48M
  tokens, `--replays 1`. Core reported `candidateTrial.startReset=false` (no start hook, so the build must undo its
  own acts before each trial).
- Verdict: **failed** (`runtime.behavior`, flowCreated false), 125 calls, $0.069212346, 703 s, harness 0. No Flow,
  no whole-run oracle or reported verdict, no replay.
- How far it got: the builder found the search page, the result cards, the heart (save) icon on cards, in the
  side pane and on the job page, and My jobs. It wrote a whole subflow (navigate, extract the Quillmark remote rows,
  For Each row: open the job, press the heart, wait for "Saved"; then read My jobs). All four trials (0119, 0123,
  0129, 0139) stopped at the first pass of "open the job" with `web.target.not_found`, before any save. The repair
  brief explored again, pressed the heart twice (acts 21 and 23, both on fresh page loads), then trial 0232 was
  refused `candidate.trial_reset_required`, and the undo of act 21 could never be proved (0234, 0236 stale handles;
  0240 `candidate.undo_unproved`). The supervisor's `complete` was refused `project.completion_reset_first` (0248),
  a last dispatch (0250) did one navigation, and the run ended.

## Cause 1 (first divergence): the pass row's values can never match a card (product defect, this repo)

The saved target was present, matched and visible in every trial; it was refused by the For Each row gate.

- Exploration (0018 view, 0019 click): `t125 h2 link "Senior Rust Engineer" ~/viewjob?jk=9acf...`, card 2/7 of the
  Quillmark results. The click landed. No For Each was running, so no row gate applied.
- Saved element: selector `main > div:nth-of-type(3) > div > ol > li:nth-of-type(2) > article > div:nth-of-type(1)
  > h2 > a`, id `jobTitle-...`, fingerprint "Senior Rust Engineer" link (revisions 2 to 4 used the first card's
  `#jobTitle-afcklw` instead).
- Trial view before the click (trial `fdfd4fe1` event `s8.attempt.9`, before-action state): the same link is on the
  page as `t67`, same href, same card 2/7, nothing covering it.
- Failure text, all four trials: "No target resolved from selector ... (refused a#jobTitle-... \"Senior Rust
  Engineer\" in another record), element fingerprint (refused ... in another record)"; `targetResolution
  unresolved_no_candidates`. So both the selector and the fingerprint found the element, and the record gate in
  `apps/extension/src/content/identity/veto.ts` (`vetoExactMatch` -> `agreesWithRecordedRecord`) refused it, and
  the in-row re-resolution found no card that qualified either.
- Not a render race: the step ran 4 times (first attempt plus 3 retries, waits 0.25 s, 1 s, 2 s) and each attempt
  also waited 3.75 s for actionability. The refusal is deterministic, so retries could not help.
- Why the gate refused: on a pass, the domain writes the row's extracted values into `context.record.values`
  (`domain/src/output-nodes/targets/row-scope.ts` `webAutomationScopedToRow`, first 8 distinct non-empty values),
  and `apps/extension/src/content/identity/record.ts` `holdsRowValues` accepts a record only when every value is
  found in its text, a resolved link, or an attribute. The extraction (extraction.3, trial event `s5.attempt.6`)
  included `lines` fields, which `apps/extension/src/content/extraction/field-reader.ts` `readLines` builds by
  joining a container's child lines with `WEB_AUTOMATION_EXTRACT_LINE_SEPARATOR` (" · "). The pass row for the
  first kept card therefore carried, as its third value, `"Quillmark · Remote (UK)"`. The card draws
  `<span>Quillmark</span><span>Remote (UK)</span>`: the " · " exists nowhere on the page, so no card can hold that
  value, every candidate is "in another record", and every pass of every trial fails.
- When it broke: the row-value gate dates from 2026-09-29 (t195, `f8135495`); `lines` fields were added on
  2026-10-17 (`32be00d3`, "Extraction offers whole lines ..."). The gate was never taught the new read. Any For Each
  over an extraction that has a `lines` field among its first 8 non-empty values fails the same way on any site.
- Class: **product defect**. Owner: `apps/extension/src/content/identity/record.ts`, function `holdsRowValues`
  (with `rowValues`). Its own header says a value must be found "by the ways the extraction can have read it";
  `lines` is one of those ways and is missing.
- Least general fix: in `holdsRowValues`, a value that contains `WEB_AUTOMATION_EXTRACT_LINE_SEPARATOR` counts as
  found when each of its separator-split parts is found in the same record (text or exact), as each part was read
  from one child of that record. Import the separator from `@fluxiq-web-extension/domain/client` as
  `field-reader.ts` does. No change to the domain, the extraction, the model's guidance or any oracle.
- Tests that prove it:
  - `apps/extension/src/content/identity/tests/record.test.ts`: a card whose name and place are sibling spans;
    `agreesWithRecordedRecord({ values: [title, "Name · Place"] }, link)` is true on that card and false on a
    neighbouring card with the same name but another place (parts must all be in the one record).
  - `apps/extension/src/content/tests/` (nearest folder holding both `extraction/` and `identity/`): read a
    two-card list with `readLines` through the field reader, pass the first row's values as a pass row, and assert
    the first card's control is accepted and the second card's refused. Use a non-job example (for example recipe
    cards), never this site's markup or words.
- Secondary, same seam: the failure says "0 control(s) of the same family are on the page" and marks it retryable,
  which contradicts "refused ... in another record" and sent the model to swap targets three times. When every
  candidate was refused by the row gate, the miss should say that the pass row matched no record
  (`apps/extension/src/content/action-runtime/resolve-target.ts` miss text). Cheap, but optional to the fix.

## Cause 2: acts 21 and 23 had no effect, and nothing can settle them (product defect, Core)

- Act 21 (0202, `save.icon1`): a press on the heart `t431` in the search page's side pane (`landmark complementary`,
  heading "Senior Rust Engineer"), declared `modify_existing`. The site answered "Couldn't save this job. Try
  again." Act 23 (0210, `save.icon2`): the heart `t572` on the job page; same answer. The fixture fails the first
  save of each page load by design (`apps/scenario-lab/src/scenarios/job-board/board/client-script.ts`), and the
  builder never pressed twice on one load. My jobs was read completely before the acts (0166, 0192: 2 saved jobs)
  and after them (0212, 0226): the same 2 jobs, in the same order, no Senior Rust Engineer. Both acts truly
  failed; there was nothing to undo.
- Core still recorded both as lasting reversible acts (landed, permitted, `mutate`, `modify_existing`) and, because
  each carries a subject/page spot, as strict (`strictReset`) in
  `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/ledger.ts` (`record`). A strict
  act leaves the reset only by (a) `originalGroupRestored`, the "truly failed press" path, which needs the act's
  own spot to be a scope in an observed collection that held the subject before the act, or (b) a subject undo
  (`subjectRestored`), which needs a `create_new` whose subject was witnessed new in the destination and then
  removed. A press from a side pane or a detail page has no collection scope of its own, and a failed save leaves
  no subject to remove, so neither path applies. `cannotUndo` is refused for strict acts (`unprovedReset`), by
  design. The build was therefore stuck with no honest way forward.
- Why the undo attempts failed: 0232 moved the tab to the start page and returned no page view, so 0234 (`t572`)
  and 0236 (`t522`) were stale handles (`page_moved_since_packet`); nothing was pressed. After reloading My jobs
  (0238), 0240 aimed "Unsave job" `t522` on Product Designer, a job saved before the build began; Core refused it
  `candidate.undo_unproved`, correctly. These are **model mistakes the product caught**: the stale guard and the
  ownership guard both held, and no pre-existing save was touched.
- Class of the deadlock: **product defect** (Core). Owner: `ledger.ts`, `AutomationStudioSiteResetLedger.beforeTrial`
  and `originalGroupRestored`. The header already names "a truly failed act" as a way to settle; the code only
  recognises one whose own control sat in an observed collection.
- Least general fix: let `originalGroupRestored` (or a sibling `failedActProved`) also settle a strict act whose spot
  has a subject but no collection scope when there is positive whole-destination evidence: every collection group
  read completely before the act (`observedScopes` with `beforeAct` below the act's sequence) has been read again
  after it (`groupObservedAfter`), each scope is exactly restored (`collectionRestored`: same subjects, order and
  row states), and at least one such group did not hold the act's subject before and still does not. Anything
  unread since, changed, malformed or missing keeps the act pending as now. This uses only evidence the reset rules
  already demand ("inspect that destination's complete item inventory first") and never infers absence from the
  source page.
- Test that proves it: `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/tests/ledger-subject.test.ts`,
  beside "settles a truly failed declared press from fresh complete original evidence": a press with spot
  `{ subject: "s:document", page: "s:document" }` (no scope), a destination group read before it without
  `s:document`, read again after it unchanged -> `beforeTrial` admits. Negatives: no read before the act; no read
  after it; the subject now present (stays pending and the existing delete path applies); a partial or malformed
  group; a second baseline group not read again.

## Model mistakes that did not decide this run

- The "narrow to remote jobs" step pressed the "Remote" filter button, which only opens its menu (trial view shows
  "Remote only", "Hybrid", "On-site" links); exploration never saw it work (0067 was a stale handle). Harmless here
  because the read's conditions filtered.
- The read's condition `company contains "Quillmark"` keeps "Quillmark Labs" (4 rows kept, one of them the
  similarly named employer the task excludes). Had the trial reached its end it would have saved a wrong job and
  failed the oracle. Correct wording is in the task; the read feedback reported 4 kept. Not a product defect.
- The Flow's save step waits for "Saved" after one press; the site fails the first press of each page load. Not
  reached in any trial; untested.

## Checked, not a cause

- Icon visibility (the earlier draft's hypothesis): refuted. Every heart is in the page view as `clickable icon
  class=...` (`t291`, `t310`, `t431`, `t572`), so the t567 icon fix holds.
- Retries: present and working (4 attempts with waits, plus the actionability wait).
- Task wording and oracle: unchanged and not implicated.

## UI review (from the 0119 screenshot only)

The chat shows the failed step as "Didn't work: FluxIQ couldn't find it where it was saved", then "Trying again
didn't help". Honest, but it repeats the misleading not-found reason; the control was on screen.

## Evidence

Run steps `lab-runs/2026-10-18/run-mvectfld-c2f5d958/steps` (0017-0019, 0067, 0117-0139, 0200-0240); trial event
chunks in the workspace project's object store (trials `fdfd4fe1`, `ccbccfcd`, `0cd8d418`, `493c0f2d`; events
`s5` extraction and `s8` attempts). Raw page, model and account data stay private.
