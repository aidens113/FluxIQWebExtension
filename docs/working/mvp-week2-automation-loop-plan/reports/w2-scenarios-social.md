# W2 — Two social-media fixtures: `social-scheduler` and `social-inbox`

Worker report. No commit made. Both fixtures are new directories under
`apps/scenario-lab/src/scenarios/`; the only shared files touched are the
scenario id list, the registry, and the two live task catalogs.

## Outcome in one line

Two complete fixtures are built, registered, judged and covered by tests: a
280-row publishing console and a 320-conversation inbox, with 15 new live
instruction tasks and 2 new live repair tasks, no refusal case among them, and
`pnpm check` green at exit 0.

## What each scenario contains

### `social-scheduler` — "Cadence", a publishing console (seed 171)

A workspace, `Northwind Outdoors`, publishing to **eight connected accounts**
with a queue of **280 posts**. The page is an application shell: a sidebar of
eleven destinations, a sticky top bar, a page header with a live stat line, a
composer, a filter toolbar, a 280-row table with a sticky header, a table
footer, and a build marker.

- **Queue**: every post carries an account, campaign copy, an optional link, a
  status (`Scheduled`, `Draft`, `Published`, `Failed`, and `Queued`, which
  only a retry can produce) and a slot. Display order is the one a publishing
  queue really has: everything still to go out, soonest first, then the
  history, most recent first.
- **Composer**: text area, account picker, date, time, optional link, a
  character counter, `Schedule post` and `Save as draft`. It ships in the
  document but `hidden`, so nothing inside it is actionable until `New post`
  opens it — which makes opening it a real step rather than decoration.
- **Filters**: search, Account, Status, and a When range (`Next 7 days`,
  `Everything upcoming`, `Last 7 days`, `Already gone out`), with filter chips
  and a `Clear filters` control, and an empty state when nothing matches.
- **Bulk actions**: per-row and header checkboxes, a bulk bar with
  `Export CSV` and `Retry`, and a confirmation dialog before a retry.
- **Own routes**: `rows/<id>` serves a single rendered row (which is how a
  newly composed post appears without the page building markup of its own),
  `posts/<id>` serves the post's page with the whole text, and
  `accounts/<slug>` serves an account page.

Time is not the wall clock. Every relative label is measured from a fixed
reference, Monday 21 September 2026 09:00 UTC, so a run at any real hour reads
the same page.

### `social-inbox` — "Mentio", a mentions and comments inbox (seed 172)

A workspace, `Harbor & Pine`, watching **six accounts** with **320
conversations** — mentions, comments and direct messages — from **83
correspondents**, each of whom writes three or four times.

- **Rows**: From (avatar letters, name, handle), Account, Kind, Age, Status
  (`Unanswered` / `Handled` / `Assigned`), Assigned, Message, and three
  controls: `Reply`, `Mark handled`, `Assign`.
- **Lazy loading, server-side**: only 25 conversations are on the page. The
  `items` route serves each further page as rows and says in
  `x-inbox-matched`, `x-inbox-shown` and `x-inbox-more` headers what is left;
  the page **appends** them, so every row already on screen keeps its element
  and a paginated read takes each conversation exactly once. The control is
  removed, not disabled, when nothing older remains.
- **Filters are the server's**: search, Account, Kind, Status and Age
  (`Last 24 hours`, `Older than a day`, `Older than 3 days`, `Older than a
  week`), each with its own chip.
- **Reply dialog**: one dialog for the page, shipped closed behind a `hidden`
  scrim, filled in and opened by whichever row's `Reply` was pressed. Bulk
  `Mark all handled` and an `Assign to` menu over a five-person team.
- **Own route**: `conversations/<id>` serves the conversation's own page with
  the whole message, and records the visit.

## How many rows, and how identity is made genuinely hard

| | `social-scheduler` | `social-inbox` |
| --- | --- | --- |
| Rows in the fixture | 280 posts | 320 conversations |
| Rows rendered at load | 280 | 25, the rest behind a control |
| Identical row controls | 280 buttons named `Post actions` | 25 × `Reply`, `Mark handled`, `Assign` per screen |
| Accounts | 8 | 6 |
| Class names | build hash, e.g. `css-1x7ab3f` | build hash |

What makes a row hard to name:

- **Duplicate accessible names.** Every row's action control carries the
  constant label the design system passes. In the scheduler that is one
  `Post actions` button per row, 280 of them, identical in tag, class, markup
  and accessible name; the only thing separating them is the row. In the inbox
  there are three such controls per row.
- **Duplicate identities among accounts.** The scheduler has two accounts both
  called `Northwind Outdoors`, separated only by network and handle, and two
  whose avatar letters are both `NC`. The inbox has *three* accounts that
  share a display name **and** a handle (`Harbor & Pine`, `@harborandpine`)
  and differ only by network — so a run told to work on "the Harbor & Pine
  account on Chirp" has to read past the name, and the toolbar option value
  carries the network for the same reason.
- **Repeated content.** The scheduler's 280 posts draw on 20 lines of campaign
  copy, so the same sentence appears on fourteen rows; a test asserts the
  excerpts are *not* nearly unique. The inbox's 83 correspondents each write
  three or four times, on different accounts, in different kinds and states,
  so "reply to this person's mention" needs narrowing rather than a lookup.
- **Generated class names.** Every class on both pages is a content hash from
  the build; nothing is authored. The same hash sits on a top-bar icon button
  and on all 280 row action buttons, so a class set says which component was
  used and never which control was pressed.
- **Two controls named `Search`** on each page — the top bar's and the list
  filter's — asserted as a page fact (`label-count:Search` = 2).
- **Uneven labelling.** One top-bar icon button is labelled properly, one only
  through `title`, and one not at all.

Real-world texture: relative timestamps (`In 3 hours`, `Yesterday`, `2 weeks
ago`; the inbox's terse `25m` / `4h` / `3d` / `10w`), truncated text cut at a
word boundary with the whole string only in the cell's `title` and on the
item's own page, avatar initials that are text in the cell, an empty state on
each list, a sticky header over a scrolling table, and lazy loading in the
inbox.

**Test ids.** Neither list labels its own fields. Rows carry
`data-post-id` / `data-conversation-id` and nothing else; every extraction
field is a `column:<header text>` read, so the automation works from the
column headings a person sees. Test ids exist only on the Lab's oracle
surfaces (stat lines, result counts, build marker, toast), the toolbar
controls, the dialogs, the list container, and the two detail pages — a detail
page is a record with named parts, exactly as `product-catalog`'s product page
is. A test asserts no `data-testid="post-…"` / `"detail-…"` appears in a list
row.

## Judgeable expectations

Both manifests declare a `playbackGoal` **and** `expected.extracted` entries.
Every workflow requires the product to do something; there is no refusal case,
and a test asserts `expected.failure` is undefined on every row of both
scenarios.

`social-scheduler` — 4 workflows, 4 variants:

| Workflow | What it makes the product do | Judged by |
| --- | --- | --- |
| primary `compose-and-schedule` | open the composer, write, pick an account, set a date and time, schedule | goal: toast `Post scheduled to @northwind-trails for Thu 24 Sep 2026, 09:00` and stats `281 posts · 123 scheduled · 14 failed` |
| `retry-failed` | filter to the week's failures, select all, retry in bulk, confirm, then read back what was retried | dataset `extract-retried`, 10 records, every one `Queued` |
| `week-ahead` | filter to one account over the next seven days and read the rows | dataset `extract-week-ahead`, 14 records |
| `whole-queue` | read all 280 rows in one go | dataset `extract-whole-queue`, 280 records |

The retry dataset is the point of that workflow: `Queued` is reachable only by
retrying, so a table of queued posts is evidence the retry actually ran.

`social-inbox` — 4 workflows, 3 variants:

| Workflow | What it makes the product do | Judged by |
| --- | --- | --- |
| primary `reply-and-handle` | find one person among 320, narrow to their single mention, reply, leave it handled | goal: toast `Replied to Priya Duval. The conversation is now marked handled.` and stats `320 conversations · 186 unanswered · 16 assigned` |
| `unanswered-backlog` | filter to one account's unanswered backlog over three days old, load the older page, read it all | dataset `extract-backlog`, 28 records over 2 pages |
| `first-screen` | read what the inbox opens with | dataset `extract-first-screen`, 25 records |
| `open-conversation` | search, narrow, follow the row through to the conversation's page and read it there | dataset `extract-conversation`, 1 record |

## Instruction tasks added

15 entries in `LIVE_INSTRUCTION_TASKS`, mixing all four kinds. Every
instruction is a goal in plain words — no selector, test id, element id, URL
path or numbered step — and names its columns where a dataset is judged. The
catalog's own selector check passes.

`social-scheduler` (8): `social-scheduler-schedule-post` (**form**) and its
`restyled` and `renamed-composer` variants;
`social-scheduler-retry-failed` (**navigate-and-extract**) and its
`quiet-week` variant; `social-scheduler-week-ahead`
(**navigate-and-extract**) and its `reordered-columns` variant;
`social-scheduler-whole-queue` (**extract**).

`social-inbox` (7): `social-inbox-answer-mention` (**form**) and its
`restyled` and `moved-send` variants; `social-inbox-unanswered-backlog`
(**navigate-and-extract**) and its `quiet-inbox` variant;
`social-inbox-first-screen` (**extract**);
`social-inbox-open-conversation` (**navigate**).

## Variants added

Seven, all of which the run is expected to pass.

| Scenario | Variant | What drifted |
| --- | --- | --- |
| scheduler | `restyled` | the CSS-in-JS build hash moved: every class name differs, nothing a person reads does |
| scheduler | `renamed-composer` | **repair row.** The composer footer was redesigned: the recorded submit control lost its test id and now reads `Add to queue`, while `Save as draft`, which schedules nothing, stays where it was |
| scheduler | `reordered-columns` | the queue's columns were reordered (Status leads, Post third): a header-following read survives, a cell-counting read does not |
| scheduler | `quiet-week` | three posts failed last week rather than ten, so the same retry job has a different answer |
| inbox | `restyled` | as above |
| inbox | `moved-send` | **repair row.** `Send` moved out of the dialog footer into its header and lost its test id; `Discard`, which sends nothing, now stands where the recorded control was |
| inbox | `quiet-inbox` | the old backlog has been dealt with: the same job fits one screen and the load control never appears |

Two entries added to `LIVE_REPAIR_TASKS`, both `expect: "repair"` with
`patchKind: "temporary_target_override"` —
`social-scheduler-repair-renamed-composer` and
`social-inbox-repair-moved-send`. Each declares a page fact saying the control
the recording targets by test id is gone, and expectations that are the
*repaired* run's, so the recorded Flow cannot pass without a model, and the
pressable wrong answer beside it (`Save as draft`, `Discard`) fails the
oracle. No refusal task was added.

## Files

New, under `apps/scenario-lab/src/scenarios/`:

- `social-scheduler/`: `types.ts`, `accounts.ts`, `posts.ts`, `format.ts`,
  `queue.ts`, `options.ts`, `styles.ts`, `table.ts`, `markup.ts`,
  `client-script.ts`, `route.ts`, `state.ts`, `manifest.ts`, `scenario.ts`,
  `index.ts`, `tests/scenario.test.ts`.
- `social-inbox/`: `types.ts`, `accounts.ts`, `conversations.ts`, `format.ts`,
  `inbox.ts`, `options.ts`, `styles.ts`, `table.ts`, `markup.ts`,
  `client-script.ts`, `route.ts`, `state.ts`, `manifest.ts`, `scenario.ts`,
  `index.ts`, `tests/scenario.test.ts`.

Modified (shared, three of them concurrently edited by other workers this
session): `apps/scenario-lab/src/types.ts` (two ids),
`apps/scenario-lab/src/registry.ts` (two imports, two entries),
`apps/scenario-lab/src/scenarios/live-instructions.ts` (five instruction
constants and fifteen tasks),
`apps/scenario-lab/src/scenarios/live-repair-tasks.ts` (two tasks).

The brief said to register each scenario in
`apps/scenario-lab/src/scenarios/index.ts`. That file only re-exports the two
live task catalogs; registration actually lives in `src/types.ts`
(`scenarioIds`) and `src/registry.ts`, and that is where the two scenarios were
added.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/scenario-lab test` →
  `# tests 330 / # pass 330 / # fail 0`. That includes the two new suites (16
  tests for the scheduler, 18 for the inbox), the registry test, and the two
  live catalog tests.
- `pnpm --filter @fluxiq-web-extension/scenario-lab check` → exit 0, no
  output beyond the command echo.
- `node scripts/structure-audit.mjs` →
  `structure-audit: passed (71 warning(s), 122 baselined)`. Zero findings of
  any severity naming `social-scheduler` or `social-inbox`: the two files that
  were briefly over the 8-exported-value advisory threshold
  (`social-scheduler/format.ts` and `queue.ts`) were tidied by moving
  `POST_LIMIT` to `types.ts` and `SORT_STATUS_TEXT` to `table.ts`, and the
  warning is gone.
- `pnpm check` → **exit 0**, zero `not ok` lines across the whole gate
  (`structure:test` 182 pass, `lab:test` 60 pass, `task:test` 91 pass, the
  structure audit, and `pnpm -r check` for all ten projects).
- `node --test packages/test-matrix/dist/tests/*.test.js` →
  `# tests 17 / # pass 17 / # fail 0`, which is what proves both scenarios
  reach the capability catalog and are selected by a change to their own
  fixture directory.

What the new suites actually assert, rather than merely compiling: the
declared datasets are compared against a reader that parses the *rendered*
markup and takes each `column:<header>` cell as a person would, so a record
that drifts from the page fails. For the inbox, the 28-record backlog is
compared against the concatenation of what the `items` route serves for page 1
and page 2, headers included.

Along the way the two scenarios had to move off seeds 141 and 142, which a
concurrently built pair of fixtures had also taken; they are now 171 and 172,
and `registry.test.ts`'s uniqueness assertion passes.

## Not verified

- **No browser ran.** Everything here is server-render, route and manifest
  behaviour. The client scripts — filtering, chips, selection, the composer
  and retry dialogs, the reply dialog, the load-older append, the toasts —
  were not executed. Three things in particular rest on reasoning rather than
  observation: that `waitForState` on a `hidden` composer or scrim resolves
  only once a control opens it; that the inbox's `loadMore` extraction sees
  the appended rows as unread items (the code appends rather than replacing,
  which is what `list-reader.ts` requires, but that was read, not run); and
  that the `label-count:Search` page fact counts two.
- **No live campaign, no recording lane run.** No Flow has been recorded
  against either fixture, so `recordingEvents` name types without counts, on
  purpose, and the `expected.actions` entries are checked only against
  `recordableActionTypes`, not against a real recording.
- **The repair rows were not exercised.** That a model can re-point the click
  at `Add to queue` or at `Send` is the fixture's claim, not a measurement.
- **Instruction quality is unmeasured.** The wording passes the catalog's
  selector check; whether a model can act on it is what a live run would say.
- The scheduler's start page is about 427 kB of HTML (280 rows rendered
  server-side). Nothing suggests that is a problem, but no run has loaded it.

## Open questions and things the supervisor should know

- **`live-instructions.ts` is now 706 lines** after this session's several
  workers. The hard limit is 800 and it is already past the 400-line advisory
  threshold. One or two more scenarios will fail the build. Splitting the
  catalog per scenario, or into a directory, is worth doing before that
  happens rather than after.
- **`apps/scenario-lab/.probe-build/` is untracked build output** left in the
  tree by another worker. It briefly failed the structure audit's `imports`
  rule; it appears to have been removed since, but it must not be committed.
- **A `kind: "navigate"` task needs a dataset to be judged by**, because a
  manifest can declare only one `playbackGoal`. `social-inbox-open-conversation`
  solves that by navigating to the conversation's own page and reading it as a
  one-record dataset; that is the only shape a navigate task can currently
  take unless a second goal per manifest becomes possible.
