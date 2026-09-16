# x5d-fixtures-catalog

## Outcome

**Done.** Every item of the brief is complete.

This report was first filed as **Partial**: adding `web.dom.extract_list` to
`expected.actions` on W04, W05 and W07 was blocked by
`packages/test-contracts/src/recordable-actions.ts`, which my brief forbids me
to touch. `x5g-recordable-actions-contract` has since landed
`extract: ["web.dom.extract_list", "web.dom.extract"]` and deleted the
paginated-click branch, and the three entries are now in place and validated.
See "M5 — the blocked item" and "Follow-up" below; the original evidence is kept
because it records why the sequencing mattered.

Two contradictions between the brief and the contracts it points at are recorded
at the end; one changed how `with-images` had to be built, the other leaves
three Playwright specs failing, now assigned to a dedicated worker.

## What changed and why

### product-catalog (`apps/scenario-lab/src/scenarios/product-catalog/`)

- **`pages` on the paginated reads.** `pages: 3` on W05 (`paginated-extraction`)
  and W07 (`in-stock-only`) as the brief asks. I also added `pages: 1` to the
  `short-catalog` variant and `pages: 3` to the new `link-pagination` variant,
  because a paginated step that covers one page genuinely covers one and leaving
  it unstated would have been the only silent paginated read left in the fixture.
- **`sparse-cards`** (variant of W04): out-of-stock cards drop their price,
  cards rated below 4.2 drop their rating. The elements are *absent*, not empty,
  which is what makes the field read as no value. `optionalFields: ["price",
  "rating"]` and `null` in the expected records. On page 1 that is p03 (price),
  p05 (rating) and p07 (both).
- **`absolute-links`** (variant of W04): card links are rewritten against a
  fixed origin, `https://catalog.example.test`. It is deliberately not the lab's
  own origin: the lab's port moves between runs and an expected record is literal
  text, so an absolute link to the live origin could not be written down. Nothing
  navigates it — W04 extracts the attribute and stops.
- **`link-pagination`** (variant of W05): Next becomes an `<a href>` instead of a
  `<button>`, same test id, same destination, same 23 records over 3 pages. The
  client's click handler now matches `[data-page]` rather than
  `button[data-page]` and calls `preventDefault()`, so either element works.
- **`with-images`** (a **workflow**, not a variant — see Contradiction 1) reading
  `image@src`, `image@alt` and the deferred `data-src`, with a **`lazy-images`**
  variant. Eager cards carry no `data-src` at all, so that field is `null` rather
  than `""`; under `lazy-images` `src` holds a shared placeholder and `data-src`
  holds the real document, so the two attribute reads swap places. Cards now
  always render an `<img>` and the route serves the photo at
  `images/<slug>.svg`, so the workflow works on the unarmed page (a workflow
  cannot arm anything).
- **`numbered-pages`** (new workflow): count 23, `pages: 3`, ending on page 3 per
  D5.
- **Record builders.** `cardRecords` now returns `string | null` and derives
  price/rating presence from the same two predicates the page renders from
  (`cardShowsPrice`, `cardShowsRating` in `format.ts`), so the page and the
  expectation cannot drift. New `imageRecords` does the same for the photo.
- **`extract-specs` stays deferred**, as instructed (D16: nested values have no
  contract and move to Phase 3.7).

### The `testid:` prefix question (resolved)

The report's open question was whether `pages: "testid:pagination-page-"` needs a
new prefix grammar in the target translator. **I used a plain CSS target,**
`[data-testid^="pagination-page-"]`, as the brief directs. Reasons, recorded so
it is not reopened: the controls are `pagination-page-1/-2/-3`, one element each,
so no single test id names the set; a `testid:` target meaning "every id
starting with this" would be a new grammar invented for one fixture; and raw CSS
targets are already an established form here — `admin-console` uses
`[data-record-id="CUS-0128"]` the same way. The JSON Schema types
`pagination.pages` as a plain non-empty string, so nothing else had to change.

### admin-console

Deleted the stale comment at `manifest.ts:143` ("No `web.dom.extract`: the
extract step is the runner's own check…"). Nothing else in that directory
changed. Note that the same claim is repeated as a comment in
`admin-console/tests/scenario.test.ts:232`, above two assertions that
`expected.actions` is `undefined`. I left it: those assertions are still true
(admin-console gained no `actions` entry), and the brief named only the manifest
line. It will become stale in the same way once X5.1 lands.

## Commands run and observed results

All run serially, never concurrently (the brief says run alone, and this machine
has a known RAM fault that makes parallel heavy gates unreliable).

- **Baseline before any edit** — `pnpm --filter …/scenario-lab test`:
  `# tests 205 # pass 205 # fail 0`.
- **`pnpm --filter @fluxiq-web-extension/scenario-lab check`** (final state):
  passed, no output, `exit 0`. This runs `tsc -p tsconfig.json --noEmit && tsc -p
  tsconfig.e2e.json`, so the e2e spec still *compiles* (see Contradiction 2 — it
  will still *fail at runtime*).
- **`pnpm --filter @fluxiq-web-extension/scenario-lab test`** (final state):
  `# tests 216 # pass 215 # fail 1`. The single failure is
  `not ok 99 - the load-more mode replaces the sentinel with a button, so nothing
  loads on its own`, which `grep -rln` locates in
  `apps/scenario-lab/src/scenarios/infinite-feed/tests/scenario.test.ts` — the
  `x5e-fixtures-tables-feed` worker's directory, in my "Must not touch" list, and
  in flight while I ran. It is not mine.
- **My two fixtures in isolation** (the attributable result):
  `node --test dist/scenarios/{product-catalog,admin-console}/tests/scenario.test.js`
  → `# tests 27 # pass 27 # fail 0`.
- **`pnpm structure:check`**: `2 violation(s) across 1 rule(s)` — both
  `[working-docs]`, on `docs/working/first-class-data-extraction-plan.md` (841
  lines, over the 800-line compaction threshold) and `docs/working/README.md`
  (out of date, needs `pnpm structure:baseline`). **Neither is mine**: I made no
  edit under `docs/` except this report, and both are the supervisor's documents.
  No finding names any file I touched, and none of the advisory `[file-lines]`
  warnings names a scenario-lab file (my largest edited file is `manifest.ts` at
  260 lines, well under the 400-line advisory threshold).

### Mutation testing (required per fixture)

Each mutation removed one variant's distinguishing change, rebuilt, ran the
product-catalog unit file, then restored the file from a backup in my own
scratchpad. I did **not** use `git checkout` to revert, because the tree holds
uncommitted work from several workers.

| # | Mutation | Observed |
| --- | --- | --- |
| baseline | none | `# pass 11 # fail 0` |
| M1 | `sparse-cards` never drops the price | `# pass 9 # fail 2` — caught |
| M2 | `absolute-links` never writes an absolute href | `# pass 9 # fail 2` — caught |
| M3 | `lazy-images` never defers the photo | `# pass 10 # fail 1` — caught |
| M4 | `link-pagination` keeps Next a button | `# pass 10 # fail 1` — caught |
| restored | none | `# pass 11 # fail 0` |

Restoration was verified by content, not by line count: each of the four
predicates greps back at exactly 1 occurrence, `extract_list` appears 0 times in
the manifest, and no `false ?` mutation residue remains.

### M5 — the blocked item, proven (resolved, see Follow-up)

I temporarily added `actions: [{ action: "web.dom.extract_list" }]` to W04's
`expected` and rebuilt. Observed:

```
ContractValidationError: WebScenario validation failed:
- $.expected.actions[0].action: names web.dom.extract_list, which no step of this
  workflow's recordingScript records; the expectation can never be met, so it is
  a scenario defect, not a product failure
# pass 0
# fail 1
```

The manifest throws at **module load**, because `createScenarioManifest` calls
`assertWebScenario`. So this is not a failing assertion that could be tolerated
until X5.1 lands — it takes the whole fixture out. Reverted immediately.

The cause is `packages/test-contracts/src/recordable-actions.ts:55`, which still
reads `extract: []`, with a paginated extract yielding `ACTIONS_BY_OPERATION.click`
at `:68`. `git diff` and `git status` both show that file unmodified in the
working tree. X5.1's spec (`reports/x3-x5-execution.md:771-772`) is exactly the
change that makes the action legal: `extract: ["web.dom.extract_list",
"web.dom.extract"]`, deleting the paginated-click branch. The `x5a` worker has
modified `evaluation*.ts` and `bench-report*.ts` but not this file.

**To finish this item**, once `recordable-actions.ts` is updated, add to
`product-catalog/manifest.ts`: `actions: [{ action: "web.dom.extract_list" }]` to
the primary `expected` (W04) and to the `paginated-extraction` (W05) and
`in-stock-only` (W07) workflow expectations. Nothing else is needed; the fixtures
and records are already in place.

## Follow-up: the blocked item landed

`x5g-recordable-actions-contract` landed the upstream change. I confirmed it
rather than taking it on trust: `recordable-actions.ts:53` now reads
`extract: ["web.dom.extract_list", "web.dom.extract"]`, and the paginated-click
branch is gone — `recordableActionTypes` no longer takes `pagination` at all.

Added `actions: [{ action: "web.dom.extract_list" }]` to exactly three
expectations, and no others: `manifest.ts:67` (W04, primary), `:111` (W05
`paginated-extraction`) and `:179` (W07 `in-stock-only`). `grep -c 'actions:'`
on the file returns 3. The W04 and W05 variants set only `extracted` (and
`finalState`), so each inherits the workflow's `actions` through
`resolveScenarioWorkflow`'s replace-or-inherit merge, which is the intended
result: every variant of those workflows expects the extract action too.

**Checked for the breakage in the other direction**, as asked. Deleting the
paginated-click branch means a paginated extract no longer yields
`web.dom.click`, so any fixture whose only click-producing step was a paginated
extract would now fail validation. Neither of my directories is affected:
product-catalog declared no `actions` at all before this change, and
admin-console's four entries (`web.dom.type`, `web.dom.click`,
`web.dom.keypress`, `web.dom.scroll`) all come from real `type`/`click`/`press`/
`scroll` steps, never from an extract.

Observed results after the change:

- `pnpm --filter @fluxiq-web-extension/scenario-lab check` -> passed, `exit 0`.
- `pnpm --filter @fluxiq-web-extension/scenario-lab test` ->
  `# tests 225 # pass 225 # fail 0`. The package is now fully green: the
  `infinite-feed` failure in my previous run is gone, `x5e-fixtures-tables-feed`
  having landed, and the count rose 216 -> 225.
- My two fixtures in isolation -> `# tests 27 # pass 27 # fail 0`.
- **Negative probe**, to show the three entries are enforced rather than
  silently accepted: swapping one for `web.dom.bogus_action` gives
  `$.expected.actions[0].action: names web.dom.bogus_action, which no step of
  this workflow's recordingScript records`, `# pass 0 # fail 1`. Restored, 0
  residue, and the product-catalog file back to `# pass 11 # fail 0`.

One consequence worth flagging to the supervisor, outside my files: because
`extract` now yields action types, a workflow whose script is only an extract
plus a checkpoint is no longer empty under `recordableActionTypes`, so
`flowLaneExclusion` no longer excludes it. product-catalog W04 and
admin-console's `extract-customer-list` therefore reach the Flow lane for the
first time. D16 intends exactly that ("more Flow-lane rows become judged"), but
it means new Flow-lane rows appear in the next A/B pair, which D7 counts as
measurements rather than regressions.

## Not verified

- **No Playwright e2e was run or added**, as instructed. So nothing here is
  evidence about real browser behaviour: the records, the `null`s, the attribute
  reads and the pagination modes are verified as *manifest data and served
  markup*, not as anything an extractor actually read off a page.
- **`pages` is asserted by no unit test.** I added the values the brief asked
  for, but no unit assertion reads `expected.extracted[].pages` — it is exercised
  only by the harness/e2e, which I may not run. A wrong `pages` number would not
  be caught by anything I ran. My mutation campaign therefore covers the four
  card/pagination properties but not the page counts.
- **`numbered` pagination is refused by the page until X3** (D14), so the
  `numbered-pages` workflow cannot pass end-to-end yet by design.
- **No content-harness rows added**, as instructed; the supervisor runs those
  once X3-B lands.
- The full-suite run's one failure is in another worker's file and was still
  changing while I ran; I did not investigate or touch it.
- An early full-suite run reported `# fail 1` and a rerun reported none. I did
  not attribute that to the machine's RAM fault — I isolated it instead, and it
  was my own new test (see below). Worth noting only because the tree is shared:
  `pnpm … test` builds and runs *every* scenario, so a neighbouring worker's
  half-written file lands in your run.

One defect of my own, found and fixed rather than reported as passing: my new
markup test used the file's `count()` helper for a *prefix*
(`"pagination-page-"`). That helper appends a closing quote, so it searched for
`data-testid="pagination-page-"` and matched 0 against the real
`pagination-page-1`. Fixed by counting the bare prefix; the assertion now
observes 3.

## Open questions or contradictions found

1. **`with-images` cannot be a variant, and I built it as a workflow.** The brief
   and the report both list it among "the variants", but a variant cannot change
   what is extracted: `ScenarioVariant` has no `recordingScript`, and
   `resolveScenarioWorkflow` merges only `expected`, so the `fields` of an
   extract step belong to the workflow and every variant of it shares them. A
   `with-images` *variant* could therefore not read `image@src`, `image@alt` or
   `data-src` at all — it could only assert that adding photos does not disturb
   the four text fields, which is not what the report specifies. I kept the
   substance (the attribute reads the report names) and changed the vehicle: a
   `with-images` workflow with a `lazy-images` variant. `sparse-cards`,
   `absolute-links` and `link-pagination` are genuine variants and are
   implemented as such. **If the supervisor wants the literal wording instead,
   the fixture loses the attribute-reading coverage.**

2. **The matching e2e spec is unowned, and it now fails.** My brief says I must
   not touch `apps/scenario-lab/e2e/**` and must not run Playwright. But the
   report's own partition (`reports/x3-x5-execution.md:1060`) assigns each
   fixture worker "`apps/scenario-lab/src/scenarios/{…}/**` **and matching
   `apps/scenario-lab/e2e/<id>.spec.ts`**", and X5.4 lists
   `product-catalog.spec.ts` among the product-catalog files. That spec contains
   a test, `"every manifest workflow and variant has an e2e run"`
   (`product-catalog.spec.ts:50-56`), which asserts its hand-written `runs` table
   equals the manifest's full workflow/variant enumeration. I took that
   enumeration from 7 to 13, so **that assertion will now fail**, and its
   `runs` table needs six new rows plus per-variant handling (its local `extract`
   helper also throws on any pagination mode other than `next`, so
   `numbered-pages` needs handling there too). It still *type-checks* — `pnpm …
   check` passes — so this will only surface when Playwright is run.
   **Now assigned:** the coordinator has given this spec, with the two other
   broken ones, to a dedicated worker; I left `apps/scenario-lab/e2e/**`
   untouched and ran no Playwright.

3. Minor, for the record: `absolute-links` points card links at
   `https://catalog.example.test`, which is off-origin. Nothing in W04 navigates
   them, but if a future workflow clicks a card link under that variant it would
   leave the lab and meet the `loopback-only` network policy.
