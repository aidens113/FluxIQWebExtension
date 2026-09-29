# Lane debug: run-mulwm2dc-0bd95f22 (job-board-remote-rust-roles)

Worker lane t172, debug only, no product code changed.

## Outcome

**Failed, but a real product result.** A Flow was created from the instruction,
ran, and stored 12 records. None of the 7 expected records matched. The
verifier refuted the answer twice. Core re-authored the Flow once, the re-authored
Flow also stored 12 unfiltered records, and the Lab stopped waiting before Core
finished its recovery.

| Field | Value |
| --- | --- |
| Task | `job-board-remote-rust-roles` (search, remote-only UK filter, salary floor, dedupe, every page, newest first) |
| Worktree / commits | `F:\fxwork\t172-live-lane-hard-sites` @ 260a4e17, Core `F:\fxwork\!FluxIQ` @ 717f035, both clean |
| Provider | deepseek / deepseek-flash, production profile |
| Build | `proposed`, 25 provider calls (24 in the loop), 309,085 tokens, $0.0242, 172 s |
| Repair | 4 provider calls recorded (all `loop-verification.v1`), $0.0034; the re-author's own calls are not recorded |
| Run duration | 580 s |
| Flow | 3 nodes: navigate, navigate, `web.output.dom-extract_list` |
| Extraction | 12 records, 1 page read, 0 of 7 expected matched |
| Verdict | `failed`, `runtime.behavior`, Flow reported `output_not_observed` / `core.result.does_not_answer_request` |

## Setup failures before this run (not product results)

Two attempts ended before any provider call, both in the Core web panel's
Next.js production build (`logs/core-web-build.log`), both `process.startup`:

- `run-mulwg1fy-bf2507b3`: `memory allocation of 96 bytes failed`, build
  worker exit 3221226505. About 10 GB was free when checked straight after.
- `run-mulwipxd-1b7c71bf`: Turbopack panic, `called Option::unwrap() on a None
  value` at `turbopack\crates\turbo-tasks\src\registry.rs:117:35`, while
  emitting source maps.

Two different native crashes in fresh, isolated build directories
(`.tmp/core-web-build/<key>/b-<attempt>`), with no concurrent build running,
match the machine's known faulty RAM. The third attempt built, published the
cache for this Core key, and every later run reuses it.

## Iteration walk (build loop, `snapshots/live-llm.json`)

| # | +s | Tool | Result | Draft rev | Note |
| --- | --- | --- | --- | --- | --- |
| 0 | 0.0 | run_node `dom-capture_snapshot` | `rejected.not_at_start_location` / `start_location_not_reached` | 0 to 0 | Snapshot before navigating; normal first move |
| 1 | 7.7 | run_node (navigate) | `succeeded` | 0 to 1 | Home page |
| 2 | 11.1 | run_node `dom-type` | `rejected.target_unobserved` / `target_not_a_handle` | 1 to 2 | Model wrote a locator, not an observed handle |
| 3 | 13.9 | run_node (inspect) | `inspect.succeeded` | 2 | |
| 4 | 17.5 | amend_draft (rerun d3) | `draft_rerun`, then `dom-type` `target_not_a_handle` again | 2 to 4 | Same invented locator |
| 5 | 25.3 | detect_repeating_structure | `no_repeating_structure` / `page_is_not_the_content` | 4 | Correct: home page has no results |
| 6 | 28.5 | run_node `dom-type` | `target_unobserved` / `answered_the_same_again` | 4 to 5 | Third identical call |
| 7 | 34.1 | run_node `dom-type` | **`rejected.target_covered`** | 5 to 6 | Now a real handle; the search box is under the consent wall |
| 8 | 37.1 | run_node (inspect) | `inspect.succeeded` | 6 | |
| 9-13 | 40-56 | run_node | **`already_answered` x5** | 6 | Stall: no page or draft change |
| 14 | 61.5 | amend_draft | `draft_amended`, 3 applied, 1 refused | 6 to 7 | Covered steps removed |
| 15 | 66.2 | run_node | `already_answered` | 7 | Sixth stalled turn |
| 16 | 73.3 | decision_unusable | `bootstrap.cannot_answer_instruction` | 7 | Model gave up (no record producer yet); loop continued |
| 17-18 | 86-96 | detect_repeating_structure | `no_repeating_structure` / `answered_the_same_again` x2 | 7 | Still the home page |
| 19-20 | 100-105 | amend_draft | `draft_unchanged`, refused x2 | 7 | |
| 21 | 113.1 | run_node (navigate) | `succeeded`, page changed | 7 to 8 | Second navigate straight to a results URL, bypassing the covered search box |
| 22 | 121.3 | detect_repeating_structure | `structure.detected` | 8 | |
| 23 | 144.2 | run_node (inspect) | `inspect.succeeded` | 8 to 9 | |
| 24 | 162.9 | decision_complete | answerability `changed`, producer and store present | 9 | Draft accepted as a 3-node Flow |

Eleven of 25 turns (#6, #9-13, #15, #17-20) produced no progress. The loop
only escaped by navigating to a results URL directly.

## Playback and repair (`snapshots/flow-lane.json`)

1. navigate (home), 2.3 s, succeeded.
2. navigate (results URL, parameter withheld), 1.3 s, succeeded.
3. `web.output.dom-extract_list`, 10.1 s, succeeded: 12 records, `pagesRead: 1`,
   fields `title, company, location, salary, posted, link`, no `where`.
4. Verification, 2 checks, both `does_not_answer`. The verifier's advice was
   specific and correct: "Fix the title field selector ... so it extracts the
   job title text rather than the link URL, and add filtering/dedupe/sort".
5. Core routed the refuted result to a re-author (`resultReauthor.routed: true`,
   adaptation `adaptation.bootstrap.d4d15cff-...`, `applied: true`).
6. Re-authored `dom-extract_list` (new node id `...4857e51b1cd43d24.main.s3`)
   ran at 00:03:16: 12 records again, 1 page, `posted` dropped, still no filter.
7. Verification again, 2 checks, `does_not_answer`.
8. The Lab stopped at 00:03:46 with `unsettled: "recovery"`.

Rows stored (`snapshots/extraction-mismatches.json`): the first row is a
sponsored card (`/pagead/clk?ad=...`), every `title` is a URL, rows include a
£65,000 to £80,000 posting under the floor, and only page one was read. The rows
do contain the right jobs (Quillmark's Senior Rust Engineer, Copperline's
Settlement Systems role), so the results URL was a Rust search. The filters
were never applied.

## Divergence point and causes

The build diverged at **#7**: the first well-formed action on the search box
was refused as covered, and the model never had a way to clear what covered it.
The final answer diverged at **#24 / playback step 3**: the extraction read
titles as URLs and applied no filter.

### Cause 1 (new): shadow-DOM consent wall is invisible to the model and to the dismissal runtime

The job board's consent wall is a custom element whose Accept, Reject and
Manage buttons live in an open shadow root, fixed over the whole viewport
(`apps/scenario-lab/src/scenarios/job-board/board/widgets-script.ts:18-37`).

- **The model is never shown the buttons.** The snapshot's control list is
  built with `document.querySelectorAll(...)`
  (`apps/extension/src/content/dom-snapshot.ts:254`), which does not enter
  shadow roots. With no handle for "Reject non-essential", the model could not
  answer the wall itself, which is what the product's consent policy expects
  it to do.
- **The dismissal runtime cannot see them either.** `coveringDialog` looks
  inside the covering layer with `overlay.querySelector(DIALOG_SELECTOR)`
  (`apps/extension/src/content/action-runtime/interference/overlays.ts:111`),
  and `firstDismissal` scans `overlay.querySelectorAll("*")`
  (`.../interference/way-out.ts:59`). Neither enters a shadow root, and
  `document.elementFromPoint` returns only the host. So 260a4e17's "every verb
  absorbs the obstruction" cannot absorb this wall.
- **Even with shadow piercing, policy would still refuse.** Accept or reject
  cookies is deliberately not a dismissal
  (`.../interference/vocabulary.ts:31-37`), and this wall has no close glyph.
  So the runtime must never clear it. The model must be able to, which puts the
  fix on the snapshot side (show shadow-DOM controls as handles), not on the
  vocabulary.

This is related to, but not the same as, the known "dialogs blocking clicks"
cause. 260a4e17 fixed light-DOM dialogs with a way out. This wall is in shadow
DOM and has no way out the runtime may press.

### Cause 2 (known): stalled loop on `already_answered` / `answered_the_same_again` / `draft_unchanged`

#6, #9-13, #15, #17-20: twelve turns with no progress, because the model had no
move that changed anything (cause 1). The repeat detector
(`domain/src/runtime/llm-evidence/repeated-refusal.ts:84`) labels the repeats
but nothing redirects the model. It escaped only by thinking of a direct
results URL at #21. This matches the known stall cause.

### Cause 3 (new): a detected list offers an anchor only as its URL, never its text

`elementSources` gives an `<a href>` exactly one source, `kind: "link"`, and
the text branch is an `else if`, so an anchor's visible text is never offered
as a column (`apps/extension/src/content/extraction/infer-fields.ts:308-309`).
`kind: "link"` reads the href (`.../extraction/field-reader.ts:61-62`). On the
job board, as on most listing sites, the title is `h2 > a`, so in the detected
form the only column for the title is its URL. The model mapped `title` to it,
and every title came out as a URL. The verifier named exactly this. The
re-author, still using detection, could not fix it: no detected column holds the
title text.

### Cause 4 (model posture, by design): no `where`, no pagination beyond page one

The extract node carries no `where`, although the node supports one
(`domain/src/output-nodes/extract-list/catalog-text.ts:179-181`). That is the
posture the catalog asks for: write the least, let the verifier narrow it
(`catalog-text.ts:203-213`). Here the repair was the step that should have
narrowed it, and the re-authored Flow still had no filter. `pagesRead: 1` with
`paginate.maxPages: 50` and a `next` selector (withheld) is unexplained. The
extraction record carries no pagination stop reason, and this board's Next
link is deliberately broken (`job-board/manifest.ts:48-60`), so the cause is
not determinable from the bundle.

### Cause 5 (measurement): the re-author is unrecorded, and the Lab stops before Core's recovery ends

- `live-llm.json` `repair.observed.perCallRecords: "not recorded"`. The
  re-author ran about four minutes and produced an adaptation, yet none of its
  provider calls, decisions or iterations are in the bundle. A full debug of
  the repair is therefore impossible from this run's artifacts.
- The Lab waits `RECOVERY_RECORD_WAIT_MS = 300_000`
  (`packages/test-runner/src/flow-lane/terminal-run-wait.ts:124`). The re-authored
  Flow's refutation landed at 00:03:46, and the Lab gave up at the same second.
  Whether Core would have tried a second re-author is unknown.

## Ranked for fixers

1. **Cause 3**, anchor text never offered as a column. It blocked the answer
   directly, and it will do the same on every site whose titles are links.
2. **Cause 1**, shadow-DOM controls missing from the snapshot. It blocked the
   search box and cost half the build loop. The fix goes in
   `dom-snapshot.ts:254` (and the overlay scans, for classification). The
   vocabulary stays as it is.
3. **Cause 5**, unrecorded re-author calls. Without them no repair can be
   debugged.
4. Cause 2 is a consequence of cause 1 here.
5. Cause 4, pagination stop reason missing from the extraction record.

## Not verified

- What the model typed or targeted at each turn. The bundle keeps result codes,
  not decisions or evidence text.
- The results URL the second navigate used, and the `next` selector (both
  withheld).
- That the consent wall, rather than the job-alert offer or the chat panel (also
  shadow DOM, `widgets-script.ts:56-59`), was the covering layer at #7. The wall
  covers the full viewport at z-index 50, so it is the likeliest, but the
  refusal's `covered:` text is not in the bundle.
