# w2-button-exemplars: one example per repeating control

Worker report. Worktree `F:\fxwork\t009-button-exemplars`, branch
`task/t009-button-exemplars`, nothing committed. `F:\!FluxIQWebExtension` was
not edited except for this report file.

## Outcome

**Done for steps 1 and 2. Step 3 (live) did not run** because of a worktree
environment gap, described below. The brief says to stop at step 2 in that
case.

On a real capture of the social scheduler (280 rows), the packet a model is
shown now holds every button the page has, one example of each row control
carrying `repeats: 280`, and the bulk bar's **Retry** button whenever it is on
the page. Before the change, after "Select all posts" at rest, Retry was not in
the packet at either budget.

## What "repeating" meant in practice

These rules come from the real captures, not from a guess.

- **Run.** A *record* whose parent holds at least 3 records of its tag. The
  record rule is the one a replay already checks, in
  `content/identity/record.ts`: `tr`, `li`, `article`, the ARIA
  row/listitem/option/treeitem/article roles, or an element with a
  per-instance key such as `data-post-id`. That rule is now exported as
  `isRecordElement`, so there is only one definition. Every many-row Lab page
  is built this way: the scheduler, inbox, desk, order operations and member
  directory use keyed `tr`s, and the catalogue uses keyed `li`s. The nearest
  record that is part of a run is used, so the catalogue's `article` inside
  its keyed `li` is walked past to reach the `li`.
- **Kind.** One position inside the record: the tag and same-tag index at
  every level from the record down to the element, plus role and input type.
  Examples on the scheduler: the row checkbox is `td1>input[checkbox]`, "Post
  actions" is `td6>button`, the post link is `td2>a`. On the inbox, "Mark
  handled", "Assign" and "Reply" share a cell and come out as three kinds.
- **Names are deliberately not part of the kind.** Row checkboxes are named
  per row ("Select the post for Mon 21 Sep 2026, 09:00"), while "Post actions"
  is the same on every row. A name pattern would have to be guessed per page.
  The position is what the template actually repeats.
- **Exempt from folding.**
  - Something you can act on that is its record's whole content, such as the
    sidebar `li > a` navigation links. Each one is a distinct destination.
  - A record that is itself something to act on (an option, a clickable row).
  - Any element the recorder or the runtime interaction ledger saw an event
    reach. This is the "touched" set: `observedEventElementQueue` plus
    `recentlyInteractedElements()`. It is deliberately not
    `isEventBackedElement`, which also counts every `onclick` element and would
    exempt a whole column on a page that writes one per row.
  - Passive wrappers are **not** exempt. The catalogue's `article` cards fold.

**Mechanism.** In `content/repeat-exemplars.ts`, called from
`content/dom-snapshot.ts`:

- The first member of each run (the first row, or a touched member) keeps its
  rank and carries `repeatCount` on its descriptor. This is a new
  snapshot-scoped field in `shared/protocol.ts`, listed in
  `UnwiredElementField`.
- Every other member is ranked after every distinct element. Members are
  demoted, not removed, so when the budget has room the rest of the run still
  appears in order. On the catalogue, all 8 product links are still listed.
- The domain carries the count as the packet element's `repeats`, but only
  when it is 2 or more. The inspect tool description and the recovery inspect
  description each gained one sentence saying what `repeats` means.

## Packet before and after (real capture, content harness, headless Chromium)

The capture came from the real content-script bundle on the `social-scheduler`
fixture, run through the real `sanitizeWebLlmSnapshot` at the exploration
budget. The raw captures and packets are in the session scratchpad and are not
committed.

**At rest, 12,000-byte budget** (this reproduces the brief's "3 selects + 37
checkboxes"):

- Before: 40 elements. `select Account`, `select When`, `select Status`,
  `checkbox Select all posts`, then 36 row checkboxes ("Select the post for Mon
  21 Sep 2026, 09:00" through "... Wed 23 Sep 2026, 13:30"). No button.
- After: 40 elements.
  - The 3 selects, `Select all posts`, **1** row checkbox
    (`cell r2c1, repeats=280`), 2 search inputs.
  - Buttons: Northwind Outdoors, Import schedule, Connect an account, New
    post, Notifications, What's new, Export queue, `Post actions`
    (`repeats=280`), Priya Raman.
  - One post link (`repeats=280`), one account link (`repeats=280`), all 11
    navigation links.
  - 5 filter labels and 4 navigation spans.

**After "Select all posts" at rest, 6,000-byte default budget:**

- Before: 21 elements: 3 selects, select-all and 17 row checkboxes. No Retry,
  Export CSV or New post.
- After: 25 elements.
  - `target.1-3` selects, `target.4` select-all, `target.5` row checkbox
    (`repeats=280`), `target.6-7` searches.
  - Buttons: `target.8` Northwind Outdoors, `.9` Import schedule, `.10`
    Connect an account, `.11` **Export CSV**, `.12` New post, `.13`
    **Retry**, `.14` Notifications, `.15` What's new, `.16` Export queue.
  - `.17` Post actions (`repeats=280`), `.18` Priya Raman.
  - `.19` post link (`repeats=280`), `.20` account link (`repeats=280`),
    `.21-25` navigation links.

**Is Retry in the packet?** (6k = 6,000-byte default budget, 12k = 12,000-byte
ceiling)

| Page state | Before, 6k | Before, 12k | After, 6k | After, 12k |
| --- | --- | --- | --- | --- |
| at rest (no Retry on the page) | no | no | no | no |
| at rest + select all | **no** | **no** | yes | yes |
| status = failed | no | no | no | no |
| status = failed + select all | **no** | yes | yes | yes |
| failed + last 7 days | no | no | no | no |
| failed + last 7 days + select all | yes | yes | yes | yes |

Retry only exists after a selection, because the bulk bar renders then. Row
checkboxes in the packet, before and after: 36 → 1 at rest (12k), 19 → 1 at
rest (6k), and 10 → 1 on the narrowed page. The narrowed page's exemplar
carries `repeats=10`.

**Other many-row pages at rest (6k), same code:**

- Social inbox: the row checkbox, "Mark handled", "Assign" and "Reply" each
  appear once with `repeats=25`. "Load older", Saved views, Refresh and the 4
  filter selects are all present.
- Support desk: the ticket subject button, row checkbox and "More actions"
  each appear once with `repeats=320`. New ticket, Save view, Import, the
  4 selects and the sort headers are all present.
- Order operations: "Select order" and "More actions" each appear once with
  `repeats=280`. "Dispatch run", New order, Export and the date inputs are all
  present.
- Member directory: "Select <member>" and "Row actions" each appear once with
  `repeats=240`. The sort header buttons are kept, because they are in the
  single-row `thead` and are not a run.

## How handles stay stable

- **The exemplar scheme mints no new kind of handle.** An exemplar is a real
  element with its own selector, and every other member keeps its own selector
  and gets its own number whenever it is described.
- **Pre-existing defect found and fixed.** Row selectors are positional, for
  example
  `[data-testid="queue-rows"] > tr:nth-of-type(1) > td:nth-of-type(1) > input`.
  `stable-handles.ts` keyed on the selector, so after a filter put another
  post in row one, the first post's handle was handed to the second post's
  checkbox. That existed before this change, but the exemplar is always row
  one, which is exactly the row a filter replaces.
- **The fix.** The domain now reads `context.record` into a record address:
  the key attribute plus key, or the record text. It returns that beside the
  selector (`DescribedEvidenceElement.record`) and keeps it in a new binding
  map, `WebLlmSnapshotBinding.records`. Like the selectors, that map never
  reaches the packet, and the budget trim deletes from both maps.
  `stable-handles.ts` now keys on frame + selector + record.
- **Effect.** Another post in the same row is a new address and gets a new
  number. The old number resolves to nothing, which is a refusal rather than a
  wrong row. When the first post comes back it gets its own number again.
- **Mutation check.** With the record removed from the address, the new test
  `a row control whose row now holds another record is given a number of its
  own` fails. With it restored, the test passes.
- **Addressing one specific row's control.** Narrow the page (search or
  filter) until that row is listed, either as the exemplar or through the
  backfill, then use its own handle. The inspect tool description now says
  this.

## Files changed (worktree)

Extension:

- `apps/extension/src/content/repeat-exemplars.ts` (new)
- `apps/extension/src/content/dom-snapshot.ts`
- `apps/extension/src/content/identity/record.ts` and `identity/index.ts`
  (`isRecordElement` exported)
- `apps/extension/src/shared/protocol.ts` (`repeatCount`, and added to
  `UnwiredElementField`)
- `apps/extension/e2e/content/tests/repeat-exemplars.spec.ts` (new; 5 real
  Chromium rows, including the domain sanitizer on the real capture)

Domain:

- `domain/src/runtime/llm-evidence/elements.ts` (`repeats`, `recordAddress`)
- `sanitize.ts` (`records` map, trim keeps both maps in step)
- `stable-handles.ts` (address includes the record)
- `tools.ts` and `harness-options/options.ts` (one sentence each in the tool
  descriptions)
- Tests: `elements.test.ts`, `sanitize.test.ts`, `stable-handles.test.ts`,
  `packet-carries-no-selector.test.ts` (`repeats` added to the allowed keys;
  the record key and text are asserted absent from the packet),
  `present.test.ts`

Docs:

- `docs/architecture/page-evidence.md`, new "Repeated Controls" section.

## Commands run and observed results (all in the worktree)

- `pnpm --filter @fluxiq-web-extension/extension test` (label t009):
  "Extension smoke test passed.", then `# tests 678 / # pass 678 / # fail 0`.
- `DOMAIN_TEST_BUILD_LABEL=t009 pnpm --filter @fluxiq-web-extension/domain test`:
  `# tests 685 / # pass 685 / # fail 0`.
- `pnpm check`: exit 0, `structure-audit: passed (73 warning(s), 122
  baselined)`. That is the same warning count as before the change.
  - The first run failed on `present.test.ts` (TS2345: the literal must name
    every packet key). This is expected behaviour of that guard, and I fixed
    it by adding `repeats: undefined`.
- `pnpm test:content` (full content-harness suite, final code): `296 passed`.
  - An earlier full run (before the last rule change) had 1 failure,
    `actions.spec.ts` "select: chooses the option", with "Target page, context
    or browser has been closed". Rerun alone: `19 passed`. I attribute it to
    the RAM fault.
- `pnpm test:content -- repeat-exemplars`: 5 passed.
- `pnpm lab:campaign social-scheduler-retry-failed social-scheduler-week-ahead`:
  both runs stopped before launch with
  `{"status":"failed","category":"unknown","message":"FLUXIQ_TEST_PROJECT_ID is required for an existing or clone target"}`.
  The summary reported `noResult: 2, providerCalls: 0`.
  - The worktree's `.env.local` sets `FLUXIQ_TEST_TARGET` but no
    `FLUXIQ_TEST_PROJECT_ID`. I read variable names only, not values.
  - This is not the earlier `environment.missing` failure, but it is the same
    class of worktree environment problem, so I stopped here.
  - Campaign output is at
    `F:\fxwork\t009-button-exemplars\test-runs\campaigns\2026-09-18T06-06-55-220Z\`.

## Not verified

- **Live model behaviour.** `social-scheduler-retry-failed` and
  `social-scheduler-week-ahead` have not been run against DeepSeek with this
  change. Nor have the three previously proven tasks. The supervisor needs to
  run them in the main tree.
- **Real Chrome/Edge or Firefox with the extension loaded.** Only the content
  harness was used: the real bundle in headless Chromium with a stub runtime.
  Frame merging was not exercised on a many-row page.
- **Pages whose rows are plain `div`s** with no key or record role (for
  example a card grid of divs). These are not recognised as runs and flood as
  before. No Lab page is built that way.

## Open questions or risks found

1. **Failure packets on a many-row page.** A failure packet marks the failed
   action's control only if that control is among the elements described.
   - A row control the failed action never dispatched an event to is now a
     demoted follower. An example is a click refused by the veto or the record
     gate before dispatch.
   - For rows 2 to 37 of a large table, this now reads `failedTargetMissing`
     where it used to be marked. Rows beyond about 37 were already missing
     before the change.
   - The fix belongs in the action runtime: the failure capture in
     `content/action-runtime/results.ts` should pass the addressed element into
     the ranking as touched.
   - I did not make that change because it is outside this brief. No proven
     task depends on it.
2. **Record text changes invalidate text-keyed handles.** A text-keyed record
   (no `data-*-id`) whose own words change, for example a status badge
   flipping, now gets a new handle, so the old one resolves to nothing. This
   fails closed and matches the record gate's own rule. Every many-row Lab page
   is keyed, so this did not arise here.
3. **Created Flow nodes do not carry the record.**
   `plan-resolution/element-identity.ts` copies no `context.record` into a
   created node's element. At replay the record gate therefore does not
   protect a row control chosen by the model: the positional selector wins.
   This is pre-existing and was not changed.
