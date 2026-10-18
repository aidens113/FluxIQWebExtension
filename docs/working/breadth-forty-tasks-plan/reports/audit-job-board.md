# Audit: job-board (t711, worker `audit-job-board`)

## Outcome

**Done.** All 13 job-board tasks have a verdict. Three instruction fixes are in, covering 6 rows. Five of those
rows are original tasks, so the supervisor needs to update the shared baseline fixture (exact entries below). The
d4/hl1 same-date tie is fixed by wording, as the coordinator asked after the fixture edit was refused. No fixture
data changed. Site tests, `scenario-lab check` and the structure audit pass.

## What changed and why

- `apps/scenario-lab/src/scenarios/job-board/live-tasks.ts`
  - `REMOTE_RUST_ROLES` (3 rows) now ends with " If no job qualifies, an empty table is the right answer." On the
    `no-exact-matches` variant the right answer is an empty table, and the old text never said that could be right.
  - `APPLY` and `APPLY_CHECK_FIRST` (2 rows) now say "the **full-time** Senior Rust Engineer job at Quillmark that is
    fully remote in the UK". Before, two jobs fit: m1 and d12 "Senior Rust Engineer (Contract)". d12 is also
    Quillmark, also Remote (UK), and also applied for on Quillmark's careers site, and the manifest itself calls it
    "the same title on contract". The site tags them "Full-time" and "Contract", so "full-time" uses the site's own
    label and leaves only m1 (the oracle).
  - `REMOTE_EASY_APPLY` (1 row, an addition) now ends "newest posting first, and where two postings show the same
    posting date, in the order Rolefinch's results list them." Why: d4 (Trust & Safety, 50 h) and hl1 (Halvard Labs,
    52 h) both show "Posted 2 days ago", and both panes print "19 September 2026". Order is judged exactly, so before
    this the order of those two was undecided. The tiebreak is something the site shows: the order its results list
    them in. Relevance and date sort agree on it, with or without the fresh posting live, so it holds whichever sort
    the run uses. The oracle's order is unchanged (d4 before hl1). The same clause also settles d9 and d15, which
    both show "Posted 10 days ago" on their cards (their panes' dates differ).
- `apps/scenario-lab/src/scenarios/job-board/tests/task-wording.test.ts` (new) checks the wording against the catalog:
  - the apply target is unique only once "full-time" is added;
  - all three Rust-roles rows state the empty answer, and the quiet-market oracle is empty;
  - no two of the seven Rust roles share a posting date;
  - remote easy apply: the answers include a same-date pair (d4, hl1 asserted). For every same-date pair, the
    oracle's order matches the order `searchPostings` lists them in, for `wp=remote&limit=50` under both relevance
    and date sort and with the fresh posting live or not. The instruction carries the tiebreak clause.
- Fixture change refused, not applied: `catalog/postings.ts` hl1 `postedHours` 52 -> 74 was refused by the
  permission system. The coordinator then said to fix the tie by wording instead, which is done above.
  `postings.ts` is unchanged.

## Verdicts per task

| Task id | Verdict |
| --- | --- |
| job-board-save-halvard-week | ok. Halvard Systems in the last 7 days (the site's "Last 7 days" = 168 h): hv1, m5, hv2 (already saved), h2. hv3 at 226 h ("Posted 9 days ago") is out, and nothing sits on the boundary. The traps (Halvard Labs hl1, the Oakridge snippet, pressing hv2's filled heart again) are excluded by the wording. Honest path: `browser-paths.test.ts` shortlist test. About 8 acts. |
| job-board-save-halvard-week-redesigned | ok. Same oracle on `overflow-save`, saving through the pane's More actions menu. Honest path: `browser-paths.test.ts` "on the redesign" test. The instruction does not forbid following, and the goal facts check only the saved list, so a run that also follows still passes. That is not ambiguity. |
| job-board-save-halvard-week-redesigned-after-creation | ok. Same path on the variant, run as a repair. Uses the most of the purse of the three save rows (a build plus a repair). |
| job-board-remote-rust-roles | reworded (rows share the text). Old: "...link is the address of the job's own page on Rolefinch, newest posting first." New: the same, plus " If no job qualifies, an empty table is the right answer." The baseline oracle is unchanged: m1, m2, m5, m3, m4, m6, m7, each with its own day and date. Links are root-relative, and the judge resolves absolute links on the run's origin (`run-expectations/extraction/value-match.ts`). About 6 acts at 50 a page. |
| job-board-remote-rust-roles-quiet-market | reworded (same text). Its oracle is the empty table, which the instruction now says can be right. Honest path: `browser-paths.test.ts` quiet-market test. |
| job-board-remote-rust-roles-quiet-market-after-creation | reworded (same text). Built on baseline, played on the quiet market. The empty answer is now stated for the judge too. |
| job-board-apply-quillmark | reworded. Old: "Apply for the Senior Rust Engineer job at Quillmark that is fully remote in the UK, ..." New: "Apply for the full-time Senior Rust Engineer job at Quillmark that is fully remote in the UK, ...". Why: d12 "Senior Rust Engineer (Contract)" also fit. Every answer the form needs follows from the text (+44 or a typed +44, Bristol England, Enter manually, Yes, No, 1 month, 88000, Rolefinch, talent community unticked). The privacy box is ticked because the form requires it, which is not "signing up". Honest path: `browser-paths.test.ts` application test. The heaviest task: about 28 acts across two tabs and a framed form. Still plausible for $0.25, since breadth runs used $0.01-0.05 for 60-80 calls. |
| job-board-apply-quillmark-check-first | reworded the same way ("Get an application ready for the full-time Senior Rust Engineer job ..."). The right ending is the stop at Submit application. The path up to it is the honest application path. |
| job-board-remove-closed-saved-jobs | ok. Unsave px ("No longer accepting applications"). One row remains: Product Designer / Halvard Systems / Leeds / Accepting applications. After unsaving, the list on screen stays stale until reload. "my remaining saved jobs" still decides the answer. Honest path: `browser-paths.test.ts` "qualification final" tests. About 4 acts. |
| job-board-remote-easy-apply | reworded. Old ending: "..., where salary is written exactly as the posting shows it, newest posting first." New ending: "..., newest posting first, and where two postings show the same posting date, in the order Rolefinch's results list them." Why: d4 and hl1 share a posting date at every place the site shows one. The oracle (7 rows) is unchanged and matches the catalog, the served page and the tiebreak. Live pass on the old text: run-mvcw0qct-0f4257a5. About 8 acts. |
| job-board-save-quillmark-remote | ok. m1, d12 and g5 are Quillmark's Remote (UK) jobs. The saved list (newest first) matches the 5-row oracle. The live failure run-mvcwf9u2-28bb44fd was the page view leaving out the icon-only heart. That is a product defect, not wording. About 7 acts. |
| job-board-halvard-labs-office-jobs | ok. Halvard Labs has only hl1, and it is remote. The empty answer is stated. The live failure run-mvcwqwec-0aa4f98b was a product defect (script loop cardinality and the page view), and its note says the empty answer was not a cause. |
| job-board-halvard-careers-roles | ok. The careers list of 6 roles, in its own order, with root-relative links. "All open roles" is the site's label. Live pass: run-mvczav2x-b9c5dafc. About 10 acts. |

Every task, variant rows included, already had an honest browser path in `job-board/tests/` that reaches its
oracle. I added none.

## Entries the shared files need (supervisor; I must not touch `scenarios/tests/*`)

`apps/scenario-lab/src/scenarios/tests/fixtures/realistic-task-baseline.ts` pins the original 57 instructions. Its
test "qualification additions preserve the complete ordered original 57 tasks" now fails, as expected. In that
file, set `instruction` on these five rows to the text `live-tasks.ts` now produces:

- `job-board-remote-rust-roles`, `job-board-remote-rust-roles-quiet-market`,
  `job-board-remote-rust-roles-quiet-market-after-creation`: add at the end of the current text (after
  `newest posting first.`) the words ` If no job qualifies, an empty table is the right answer.`
- `job-board-apply-quillmark`: `Apply for the Senior Rust Engineer job` -> `Apply for the full-time Senior Rust Engineer job`.
- `job-board-apply-quillmark-check-first`: `Get an application ready for the Senior Rust Engineer job` ->
  `Get an application ready for the full-time Senior Rust Engineer job`.

`job-board-remote-easy-apply` is an addition, so the baseline needs nothing for it. Nothing else in
`scenarios/tests/` changes: ids, permission points, datasets and counts are the same.

## Commands run and observed results

Last run, after the easy-apply rewording:

- `node ../../scripts/build-cache/cli.mjs scenario-lab:build` (in `apps/scenario-lab`): built.
- `node --test dist/scenarios/job-board/tests/*.test.js dist/scenarios/job-board/breadth/tests/expected.test.js dist/scenarios/job-board/qualification/tests/expected.test.js`:
  `# tests 52 # pass 52 # fail 0`, the browser specs included. An earlier version of the easy-apply test compared
  the whole relevance order to the oracle. It failed because relevance is not newest-first. The test now checks
  only the same-date pairs, which is what the clause decides, and passes.
- `node --test dist/scenarios/tests/realistic-site-live-tasks.test.js dist/scenarios/tests/live-instructions.test.js`:
  16 pass, 1 fail, `not ok 17 - qualification additions preserve the complete ordered original 57 tasks`. This is
  the baseline fixture above and nothing else.
- `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab check`: exit 0.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (204 warning(s), 638 baselined).`, exit 0.

## Not verified

- No live run of the reworded tasks. The apply rows' purse estimate comes from counting acts, not from a run.
- The tiebreak test reads the catalog's `searchPostings`, not a browser-served page. The served page's organic
  order is `searchPostings` with sponsored cards inserted (`board/results-page.ts`).

## Open questions or contradictions found

- Lane debug notes name no job-board task that failed on wording. Both failures (save-quillmark-remote,
  halvard-labs-office-jobs) were product defects: icon-only controls missing from the page view, and the loop
  cardinality refusal.
