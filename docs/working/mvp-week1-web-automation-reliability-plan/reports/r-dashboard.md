# r-dashboard — a SaaS console fixture at production scale

## Outcome

**Done.** A new Scenario Lab fixture, `member-directory`, is registered, tested,
and driven end to end: an application shell around a 240-row members table where
every class name is a build hash, 240 row action buttons are identical to each
other, the row menu and both dialogs are portalled to `<body>`, and two fixed
surfaces can be painted over controls the DOM still reports as clickable.

Two things a reader should know before the numbers.

1. **I destroyed another worker's file.** I chose the directory name
   `admin-console` at the same time another fixture worker did, and my
   `types.ts` overwrote theirs at ~18:14. The directory was untracked, so git
   had no copy and the content is unrecoverable. I moved my three files out to
   `member-directory/`, deleted my `types.ts` from their directory so they would
   meet a *missing* module rather than a *wrong* one, and reported it
   immediately. They have since re-created it.
2. **The directory moved underneath the final run.** From 18:44 the agent
   `x-identifierless` began adding an identifier-policy axis to files I own
   (`types.ts`, `state.ts`, `markup.ts`, `members.ts`, `tests/scenario.test.ts`,
   plus a new `src/identifier-policy/`). The supervisor confirmed that dispatch
   is deliberate. I did not adopt, extend, or revert any of it. The one failing
   unit test in the final run is theirs, mid-edit, and is described below.

## What changed and why

### The fixture

`apps/scenario-lab/src/scenarios/member-directory/` — a members administration
console for a fictional workspace ("Meridian", workspace "Halden Robotics").

| File | What it holds |
| --- | --- |
| `types.ts` | Member, filter and state vocabulary; the five renderings |
| `members.ts` | The authored roster: 240 people, generated index-by-index, seed-independent |
| `filters.ts` | Search/role/status filtering, the roster per rendering, the header counts |
| `options.ts` | The two filter selects' option lists |
| `styles.ts` | The hashed class names for a build, and the emitted stylesheet |
| `markup.ts` | The shell: sidebar, top bar, page header, footer, help launcher, support drawer |
| `table.ts` | The filter toolbar, the table header, and one row per member |
| `client-script.ts` | Filtering, selection, sorting, the bulk toolbar, the counts |
| `client-dialogs.ts` | The portalled row menu, edit dialog, removal confirmation, toasts |
| `state.ts` | `update-role`, `remove-members`, `set-mode`, and the run oracle |
| `manifest.ts` | Three workflows, four variants, page facts per rendering |
| `scenario.ts`, `index.ts` | The definition and the barrel |
| `tests/scenario.test.ts` | Eight unit tests |

Registered in `apps/scenario-lab/src/types.ts` (`scenarioIds`) and
`apps/scenario-lab/src/registry.ts`; seed **137**, start path
`/scenarios/member-directory/`. New e2e spec at
`apps/scenario-lab/e2e/member-directory.spec.ts` (11 tests).

### The properties it was built for

**Generated class names.** Every class on the page is `css-` plus seven base-36
characters of an FNV-1a hash of `build:role`. There is not one authored class
name in the markup, and the e2e spec asserts that (`authored: []`). A class is a
*style*, not a role: the design system's one icon button wears the same hash on
the notification bell, the table settings control, and all 240 row action
buttons — 244 elements sharing one class, asserted in the unit test. The
`restyled` rendering changes the build hash and **nothing else**: the unit test
compares the two documents with every class replaced by a placeholder and
requires them to be identical apart from the footer's build number.

**Scale.** Measured in the browser at 1280×720:

```
{"elements":4484,"depth":14,"cells":1687,"focusable":510,"classes":53,
 "authored":[],"unnamedButtons":1,"snapshotCandidates":2480}
```

4,484 elements, maximum nesting depth 14, 1,687 `td`/`th`, 510 focusable
controls, 53 distinct class names on the whole page.

**Repetition without distinction.** 240 buttons with the same tag, the same
generated class, the same accessible name ("Row actions"), no id, no test id and
no text. The only thing that separates them is the row they are in. Row
checkboxes, by contrast, carry the member's name — real tables are uneven, not
uniformly bad.

**Sticky header and overlays.** The top bar is `position: sticky` at `top: 0`;
the table header sticks under it at `top: 56px`; a 54px help launcher is fixed
over the bottom-right corner; the `support-drawer` rendering docks a 380px
drawer down the right edge, reflowing nothing. The e2e spec proves all three
bite: scrolled so its centre sits at y=72, a row's action button is still
visible and `elementFromPoint` returns a `th`; at scroll 3000 the launcher
covers row `usr_5170bb`'s action button; with the drawer open, the bulk
toolbar's Remove button reports `support-drawer` as the topmost element and a
real Playwright click fails with *"intercepts pointer events"*.

**Inconsistent accessibility.** One top-bar icon button has no accessible name
at all (no text, no `aria-label`, no `title`) — asserted as exactly one. Its
neighbour is named only through `title`. Two text inputs share the accessible
name "Search" (declared as a page fact, `label-count:Search` = 2) and two
buttons share "Invite people". The row menu's items are properly named; the row
action buttons are named identically 240 times.

### Workflows and variants

| Workflow | What it does | Variants |
| --- | --- | --- |
| primary `edit-member` | Row menu → Edit member → set Role to Admin → Save → toast | `restyled` (positive), `member-left` (negative) |
| `filter-members` | Search "hollis", narrow to admins, extract the rows | `sorted-by-activity` (positive, records reordered) |
| `remove-invitations` | Filter to invitations, select all 32, Remove, confirm | `support-drawer` (negative) |

Page facts are declared per rendering and never inherited: a unit test walks
`scenarioPageFactSchedule` over all seven selections and requires every
rendering to declare its own and every variant's set to be non-empty.

The two negative variants declare a failure category **derived from code I read,
not from a run**: a covered target is refused by
`content/action-runtime/actionability.ts` with code `covered` → ACTION_REJECTED →
`web.action.rejected` → `blocked_by_capability_or_policy`
(`domain/src/runtime/failure/codes.ts:102`); a missing recorded target →
`web.target.not_found` → `target_not_found` (same file, line 103).

`recordingEvents` name event *types* with no counts. No recording lane has run
this fixture, an exact tally would be a guess, and
`run-expectations/recorded-events.ts` treats a stated count as exact.

## Commands run and observed results

Exit status captured by redirect and `echo $?`, never through a pipe.
`EXTENSION_TEST_BUILD_LABEL=r-dashboard` was set for every Playwright run.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/scenario-lab check` | **0** | `tsc -p tsconfig.json --noEmit`, no diagnostics (run three times; last one after `x-identifierless` began editing) |
| `pnpm --filter @fluxiq-web-extension/scenario-lab test` (18:38, before the identifier axis) | **0** | `# tests 188 / # pass 188 / # fail 0` |
| `pnpm --filter @fluxiq-web-extension/scenario-lab test` (final, twice) | **1** | `# tests 197 / # pass 196 / # fail 1`. My eight tests (117–124) all `ok`. The one failure is `not ok 127 - no-identifiers replaces every author-stable id and keeps every reference pointing at one`, added to my test file by `x-identifierless`, failing because `markup.ts` imports `applyIdentifierPolicy` and does not yet call it. Identical on the rerun. |
| `npx playwright test -c e2e/playwright.config.ts member-directory` | **0** | `11 passed (11.4s)` — every workflow, both negative variants, the page-shape test, and the interaction test. Green both before and after the identifier-axis edits began. |
| `npx playwright test -c e2e/playwright.config.ts` (whole scenario-lab suite, 18:47) | **0** | `105 passed (48.2s)` |
| `node <scratchpad>/rd-corpus.mjs` — `expandCorpus(week1Corpus, loadScenarioManifests(root))` against the rebuilt registry | **0** | `registry scenarios 25; member-directory present: true` / `total 43 / runnable 43 (23 recording, 20 flow) / skipped 0 / unresolved 0` / `expectedFailure 10, of which 6 carry a code` / `corpus rows naming member-directory: 0` |
| `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (copy of `.git/index` + `git add` of my paths only) | **0** | `structure-audit: passed (33 warning(s), 17 baselined)`; **no finding names any `member-directory` path**. The real index was left untouched (`git diff --cached` names zero member-directory files). |

An intermediate audit run did name one: `filters.ts` at 9 exported values against
the 8-value advisory threshold. I split the two option lists into `options.ts`
and it went away; the count above is one warning lower than that run.

## Not verified

- **Nothing has run in a browser with the extension attached.** Every claim
  about snapshots, recording events, target resolution, failure categories and
  the actionability gate is arithmetic against code I read, or a Playwright
  measurement of the page — not an observed extension run.
- The declared `failure` categories on `member-left` and `support-drawer` are
  derived from the code path, never produced by a run.
- `recordingEvents` types are unverified even as "at least one".
- The whole-suite e2e run (105 passed) predates the identifier-axis edits; I did
  not re-run the whole suite afterwards, only my own spec.
- I did not add corpus rows, did not touch `packages/test-runner/**`, and did not
  update `docs/architecture/testing-facility.md`, whose scenario table has a row
  per fixture and now lacks one for this scenario. That file is not in my
  ownership and other workers are adding fixtures to it; it needs one row.
- `apps/extension/e2e/content/tests/zz-descriptor-census.spec.ts` hard-codes a
  list of 22 scenario ids. It asserts nothing (it is a scratch census), so it
  does not fail, but it silently omits this fixture and the other two landing
  today.

## Open questions or contradictions found

### 1. This page asks the snapshot for more than it is allowed to keep

`apps/extension/src/content/dom-snapshot.ts:46` caps a snapshot at
`MAX_SNAPSHOT_CANDIDATES = 2_000`. Running that file's own three candidate
queries against this page returns **2,480** elements before any filtering. The
truncation happens after a bucket-and-priority sort, so what falls off the end
is the low-priority tail — but 480+ candidates are dropped on a page a person
would call ordinary, and no existing fixture comes close to that number. The
count is asserted in the e2e spec, so the property cannot quietly disappear.

I have not measured what the extension actually keeps (`counts.matched` reports
it); this is the candidate count only.

### 2. The identity signals this page needs are the ones the wire drops

This is the finding the supervisor asked me to check against a realistic page,
and the answer is that this fixture is the worst case for it.

- **240 row action buttons.** Tag, class, accessible name, role, text and every
  attribute are identical. The only separating signal is `context` — and inside
  `context` (`content/identity/context.ts`) only `tablePosition.row`, because
  `landmark`, `heading`, `columnHeader` ("Actions") and `column` (7) are the
  same for all 240. So: with `context` dropped, the recorded button is
  indistinguishable from 239 others; with `context` carried, it is
  distinguishable **only by a row index**, which this page's own filtering and
  sorting invalidate — the fixture's `filter-members` and `sorted-by-activity`
  workflows both move a member's row index without changing the member.
- **The two "Invite people" buttons** (sidebar footer and page header) have no
  ids and identical names; only `landmark`/`heading` context separates them.
- **The unnamed top-bar icon button** has only `implicitRole` plus a class
  shared with 243 other elements.
- **The two "Search" inputs** survive: both carry ids, so `label` and `context`
  being absent costs nothing there.

`domain/src/output-nodes/targets.ts:103` builds the element fingerprint with
`implicitRole` and `label` present and **no `context` field at all**, which
matches the "context is dropped" half of the report. I did not trace the
command path to the page, so I cannot confirm the `implicitRole`/`label` half or
whether the landed fix covers it.

### 3. Three things about the existing tooling that a realistic page exposes

- **A page fact can only name a `data-testid`.**
  `playwrightScenarioFactProbe` resolves `fact.subject` as
  `[data-testid="<subject>"]` and nothing else, so any state a manifest wants to
  assert must have a test id. On a page whose whole point is that identifiers
  are scarce, that forces test ids back on: I gave nine elements one (stats,
  search, both filters, tbody, result count, sort status, build marker, toast
  region) purely so facts could read them. Nine test ids among 4,484 elements is
  still realistic, but the constraint pushes the wrong way.
- **A `text` fact reads `textContent.trim()` and does not collapse inner
  whitespace**, so a fact can only be declared on an element whose text is a
  single node. I could not declare the filter-chip row's text and had to fall
  back to `exists`.
- **`column:` extraction reads the whole cell.** The person cell yields
  `"JH Joon Hollis joon.hollis@halden-robotics.test"` — the avatar's initials
  are text in the cell like anything else. I kept it and declared it truthfully
  rather than making the cell easier than a real one, but the line breaks
  between the spans are load-bearing: without them the three run together into
  one word.

### 4. Two ways this page silently loses behaviour, both real-world

- `position: sticky` inside a wrapper with `overflow-x: auto` does nothing: the
  wrapper becomes the header's nearest scrolling ancestor and never scrolls. My
  first draft had exactly that and the sticky-header overlay case failed. The
  fix is in `styles.ts` with the reason written next to it.
- **Playwright's click auto-scroll centres the target**, which is the only
  reason the sticky header does not break every click in my own spec. A replay
  that scrolls minimally — `scrollIntoViewIfNeeded` semantics without centring —
  will land controls under the header on this page. Worth checking what
  `content/action-runtime/scroll-element-into-view.ts` does before assuming the
  extension is safe here.

### 5. The ownership process, twice

Two workers picked `admin-console` simultaneously and one file was destroyed;
then a third agent began editing the directory I had just been confirmed to own.
Both were caught only because a write landed on a file I had open. A worker
cannot see another worker's tree, so the only defence is that directory names
are assigned in the brief, not chosen by the worker.
