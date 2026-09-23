# fa-extraction-rowset — a read must return the right set of rows (task t096)

Worktree `F:\fxwork\t096-extraction-rowset`, branch `task/t096-extraction-rowset`.
Core was not touched. No Lab run, campaign or provider call was started.

## Outcome

**Partial.** Both reported failures were diagnosed to their causes, three of
those causes are fixed and measured model-free, and **the cause that sits
upstream of both is neither mine nor fixed**: the model is never shown the
filter control, so the instruction's page-level narrowing cannot reach the Flow
at all. That is measured below, not inferred.

What changed, each proved in the content harness against the real everything
store with no model attached:

- **a one-page read now returns the whole page**: 16 organic rows where it
  returned 12, with nothing in the test touching the page;
- **a filter the model writes over a column it renamed now reaches the page**:
  refused `web.handle.unknown_field` before, applied after, proved with the fix
  disabled and enabled;
- **a literal `where` naming one of the request's own columns is no longer
  refused by the node's parameter contract**, which it was for every such
  request;
- **the shape the model copies now shows a numeric bound**, not only "leave the
  advertisements out".

## The evidence first: what those two runs actually read

Both runs read **the unfiltered search**, and this is the finding that reorders
everything else. Measured, not read off a screenshot: I dumped the store's own
results page in the content harness at both addresses and compared the cards to
the rows the runs returned.

| | `?k=wireless+earbuds` (unnarrowed) | `?k=wireless+earbuds&rh=plus` (narrowed) |
| --- | --- | --- |
| cards before any scroll | 15 (12 organic + 3 ads) | 15 (12 organic + 3 ads) |
| cards after the end is revealed | 20 (16 organic + 4 ads) | 20 (16 organic + 4 ads) |
| organic #8 | **Kinetra Run … 60H … Graphite, $49.99** | *(absent — not Plus)* |

`run-mudwci8d-de88aa32` returned 12 rows whose 8th is *Kinetra Run … Graphite*,
and `run-mudw1ktb-0557816b` returned that same card at the same position. That
card exists only on the unnarrowed page. Both runs read the unnarrowed list.

**And a `where` *was* written in both runs, and it worked.** The detected run is
every card of the grid — ads and results share tag, role and class, and
`testIdFor` reads only `data-testid`/`data-test`/`data-cy`, so `data-ad-id`
cannot split the run — which makes the run 15 cards before a scroll. Both runs
returned exactly the 12 organic ones. Nothing but a resolved `where` on the ad
mark removes those three. So the brief's premise for (b) — "the model wrote no
`where`" — is wrong: it wrote one, and the one it wrote is the one shape the
catalog showed it.

The other four criteria of `plus-under-fifty` (Plus eligible, rated 4.0+, under
$50, no accessories) produced no condition at all, and `first-page-earbuds`'
"narrow the results to Brightaisle Plus" produced no step at all.

### (a) `run-mudwci8d-de88aa32` — 12 rows where 16 were expected

Two causes, and only one of them is the lazy tail.

1. **The Flow never narrows the page.** Its steps, named by the run's own
   `declaredConsequences`, are: press *Not now*, press *Accept*, enter text in
   *Search Brightaisle*, press *Go*, extract. No facet. The exploration before
   it never touched one either (`dismiss.1`, `cookies.accept`, `search.1`,
   `search.submit.1`, then dry runs). The `target_not_found` the run reports is
   a retried dismissal, not a failed facet press.
2. **The read stopped at 12 because the page had 12.** The store draws twelve
   results and fetches the rest from a sentinel under the twelfth
   (`results-page.ts`: `PER_PAGE = 16`, `EAGER = 12`). The read waited for the
   list to be *present* and to stop changing; it was stable at 15 cards and
   unfinished, and nothing was going to arrive because the page was waiting to
   be scrolled.

Fixing 2 alone gives 16 rows of the **wrong list**, which is why this report
does not present the completeness fix as *the* fix for 12-vs-16. It is
necessary — on the correctly narrowed page the store still draws 12 of 16 — and
it is not sufficient.

### (b) `run-mudw1ktb-0557816b` — 24 rows where 13 were expected

Three causes.

1. **The same unnarrowed page**, reached by a `web.browser.navigate` straight to
   a search URL with no facet and no filter form. Its rows include a $79.99 pair
   and a $12.99 accessory under an instruction asking for earbuds under $50.
2. **12 rows read twice.** `flowShape` says `extractNodes: 2`; `run.json` shows
   two `web.dom.extract_list` actions, 1,370 ms and 1,399 ms; the judged dataset
   holds 24 rows whose 13th is the 1st again. Two adjacent extract nodes read
   the same page into one derived dataset, which appends. The duplicate is not
   in my files — the derived dataset is `output-nodes/extract-list/derived-record-output.ts`
   and the plan shape belongs to whoever owns plan validation — and it is worth
   a rule of its own: two extract nodes with the same resolved request and no
   step between them are one node.
3. **No condition but the ad mark**, for the two reasons fixed below.

## The cause upstream of all of it, measured and not fixed

**The model is never shown the Brightaisle Plus facet.** Measured in the content
harness on the store's own results page, with the real content bundle and the
real evidence runtime:

| what | observed |
| --- | --- |
| "Brightaisle Plus" links on the page | 1 |
| the content script's raw snapshot | 611 interactive elements, 493 KB, **contains it** |
| the packet the model reads, at the live 6,000-byte budget | 5,561 bytes, `elementTotal: 611`, ~15 elements, **does not contain it** |
| the same packet at 24,000 bytes | 9,516 bytes, **still does not contain it** |

The packet carries the first `WEB_LLM_EVIDENCE_BOUNDS.elements = 40` of the
capture's own ranking (`llm-evidence/sanitize.ts`), and the facet is not among
them: the top of that list is the sort `select`, the department `select`, the
search input, *Go*, an ad-feedback `span` and a newsletter input. **Raising the
byte budget does not recover it**, so this is the capture's ranking, not the
packet's budget — the ranking lives in `apps/extension/src/content/evidence/`.

A model cannot press what it is not shown, and no amount of prompt text about
narrowing the page changes that. Until a results page's filter rail reaches the
packet, `everything-store-first-page-plus-earbuds` cannot pass, because its
instruction *is* "narrow the results to Brightaisle Plus" and no `where` can
stand in for it: "the first page of the narrowed results" is a different set of
sixteen from "the Plus items on the first unnarrowed page".

I did not fix this: `content/evidence/` and `llm-evidence/sanitize.ts` are
outside my files, and the fix is a ranking decision (a filter rail is a control
a task's instruction names) that deserves its own brief.

## What changed and why

### `apps/extension/src/content/extraction/list-wait.ts` — completeness

A new `awaitListComplete`: reveal the end of the list, wait up to 900 ms for it
to grow, and repeat while it does, bounded by four reveals and the command's
deadline. A reveal is `scrollIntoView({block: "end"})` on the element *after*
the last item — the loader, where a page has one — which scrolls whatever
ancestor actually scrolls and fires the scroll a page is listening for.

Three things it deliberately does not do:

- **it does not scroll to the end of the document.** A virtualised list unmounts
  what it has scrolled past, and the read has not read these items yet;
- **it does not pay when there is nothing to reveal.** A reveal that moves the
  last item by 2 px or less reveals nothing and the wait is skipped, so a page
  whose list already ends on screen costs neither a scroll nor a wait — which is
  most fixtures, and is why this is not a fixed cost on every read;
- **it does not run for a read that has everything it can use.** `awaitListComplete`
  stops when the run already holds the read's `maxItems`, so the picker's
  five-row preview does not scroll a page a person is looking at. Only an
  unfiltered read can say that from the page, since a filtered read's items are
  not its records, so a read with a `where` always reveals.

### `list-reader.ts` — the order of the three waits

```
awaitListPresent(item, 1, settle)   // the list is there and has stopped arriving on its own
awaitListComplete(item, wanted)     // ...and is all there          (one-page reads only)
awaitListPresent(item, minItems)    // ...and holds what the request said it must
```

The middle step is new; the third moved. It used to be first, and that was the
trap: told `minItems: 16` on a page that holds 15 and will hold 20 after a
scroll, the old order waited out its whole 10-second command budget for a
sixteenth that was never coming, then read twelve. A paginated read is
unchanged — it waits for its first item and reaches the rest by
`pagination.ts` — and the old call for it, `Math.min(1, required)` under
`Math.max(1, …)`, was already exactly "wait for one".

### `domain/src/runtime/llm-evidence/plan-resolution/extraction/conditions.ts` (and `slot.ts`)

A condition may now name its column **by the key the plan keeps it under**, not
only by a detected key. A plan writes `fields: {rating: "css-1f32dgn"}` and then
`where: [{field: "rating", atLeast: 4}]` in the words it invented two lines
earlier; that named no detected column and was refused. The detected vocabulary
is still read first, so a name the detection knows goes on meaning what the
detection showed; only a name it does not know is looked for among the columns
this plan keeps. Both are declared in the same object — nothing is guessed.

This explains the shape of the live evidence exactly: **the one condition that
survived is the one over a column the plan did not keep and therefore did not
rename** — the advertisement mark, named by its detected key.

### `domain/src/output-nodes/extract-list/catalog-text.ts` — the shape a model copies

The grammar showed one condition, `{field, is: "absent"}`, and the numeric
bounds lived only in the detect tool's prose, whose paragraph about conditions
is about telling an advertisement from a result. Both live runs wrote exactly
that and nothing else. The grammar now shows a bound beside the mark, over a
column under the plan's own key, and the example carries one too:

```
where?: [{field: "colKey", is: "absent"}, {field: "yourKey", atLeast: 4, lessThan: 50}]
```

It fits: 581 of Core's 600 characters. Three things went for the room, each said
better elsewhere or by the shape itself — "those columns renamed" (which
`{yourKey: "colKey"}` shows), and, in the literal branch the text itself calls a
guess, `required?: false` and its own `where` example. The resolver still
accepts all of them.

### `domain/src/output-nodes/extract-list/issues.ts` — a contract bug this uncovered

Adding a bound to the example turned the node's own definition test red, and the
reason was a real defect rather than the example. `webAutomationExtractListIssues`
probed `where` against a stand-in request whose only column is `probe`, so
**every literal `where: [{field: "price", lessThan: 50}]` was refused
`web.extract_list.invalid_where` for naming a column the probe does not have** —
while the page would have run the request as written. The probe now keeps the
request's own `fields`, falling back to its own when those are themselves
unreadable, so a bad `fields` still reports one fault rather than two. Live this
bit only the literal branch, since a resolved handle turns `field` into `read`
before the contract sees it; it would bite the first model that wrote a literal
request with a filter in it.

### `domain/src/extraction/proposal.ts` — why `scroll` stays unproposed

Ownership handed over mid-task. I did **not** start proposing `scroll`, and
wrote down why: the store's results page continues by its *Next* control, so
proposing `scroll` would say the list goes on by scrolling where it goes on by a
control, and `scroll` mode also makes a read content-aware, so a page that
recycles a row would count it again. The lazily loaded tail is not another page
of the list — it is the rest of this one — so the read completes the page it is
on. The line is now a documented decision rather than a bare sentence.

## Commands run and observed results

All in `F:\fxwork\t096-extraction-rowset`. No Lab run, no campaign, no provider.

| Command | Observed |
| --- | --- |
| `pnpm test:content -- extraction/tests/list-completeness.spec.ts` (new) | **3 passed**. Row 1: the store shows **15** cards before the read, the read returns **16** rows with the ad condition, and the page then holds **20** cards — the test never scrolls, so every scroll was the read's. Row 2: `minItems: 0` still returns **20**. Row 3: a bound over a renamed column resolves and keeps exactly the rows the store's own values say. |
| the same row 3, with the `conditions.ts` fallback disabled (negative control) | **failed**, `web.action.rejected.target_unobserved`, `reason: parameters_not_resolved`, `instead: ["web.handle.unknown_field", …, "web.handle.unknown_field:extractList.where.0"]` — the refusal a live build hits. |
| `pnpm test:content` (whole harness suite) | **348 passed, 0 failed**, 1.9 m. (t092 recorded 339 + 1 pre-existing failure; that one is gone and my 3 rows are in.) |
| `pnpm test:content -- extraction/tests` (final state) | **60 passed, 0 failed** |
| `node domain/scripts/test-domain.mjs` | `# tests 762 / # pass 762 / # fail 0` |
| `node apps/extension/scripts/test-extension.mjs` | `# tests 731 / # pass 731 / # fail 0` |
| `pnpm check` | **exit 0**; `structure-audit: passed (97 warning(s), 121 baselined)` |
| harness probe: the store's results page at both addresses, cards dumped before and after a scroll | the table at the top of this report |
| harness probe: the evidence packet at 6,000 and 24,000 bytes | the table under *the cause upstream* |

Both probes were temporary specs, run and deleted; nothing of them is left in
the tree.

**One intermediate failure worth recording**, because it is a behaviour and not
a test detail: the first run of the extraction suite failed
`extraction-picker.spec.ts` — *"a preview reads at most the limit … and is never
recorded"* — because the reveal scrolled the page while the recorder was on and
the lazy images that loaded were recorded. That is what the `maxItems` exemption
above is for, and the row passes on its own terms now rather than by being
loosened.

## Files changed

Owned: `list-wait.ts`, `list-reader.ts`, `plan-resolution/extraction/{conditions,slot}.ts`
and its `tests/conditions.test.ts`, `extract-list/catalog-text.ts`,
`extraction/proposal.ts`.

**Four outside the brief's list**, none of them the three the concurrent task
owns (`field-reader.ts`, `field-spec.ts`, `infer-fields.ts` were not touched):

- `apps/extension/e2e/content/tests/extraction/tests/list-completeness.spec.ts`
  — **new**; the brief's validation had to live in the content harness, and a
  new file cannot collide with another worker's edits;
- `apps/extension/e2e/content/tests/extraction/tests/item-conditions.spec.ts`
  — two rows counted the page's cards *before* the read and compared the read to
  that. A read now completes the page, so they count after it. Nothing was
  weakened: both still assert the read leaves out exactly the advertisements;
- `domain/src/output-nodes/extract-list/tests/catalog-text.test.ts` — the paired
  test of a file I own; it pinned grammar strings I changed, and it gained a row
  for the bound;
- `domain/src/output-nodes/extract-list/issues.ts` — the contract bug above. I
  judged that leaving a known refusal of every literal filter in place, having
  found it, was worse than the deviation. One line plus a helper.

## Not verified

- **That any of this makes a built Flow return the right rows.** No live run was
  started, as instructed. Everything above is model-free measurement of the
  engine and the resolver.
- **The upstream cause is not fixed.** Until the filter rail reaches the evidence
  packet, `first-page-earbuds` reads the wrong list however complete the read is,
  and the supervisor's verification run should be read with that in mind: expect
  16 rows of the unnarrowed page rather than 12, which is the fix working and the
  answer still wrong.
- **`plus-under-fifty` cannot reach 13 rows by `where` alone, even now.** Three of
  its four criteria are expressible — the Plus badge is a real coverage<1 column
  (`<i class=plusBadge role=img aria-label="Brightaisle Plus">`, rendered only
  for Plus listings), `rating atLeast 4` and `price lessThan 50` are bounds — but
  **"accessories such as ear tips or charging cases" is not**. The detect tool's
  own text says there is no test against the text in a column, and the store
  gives an accessory no mark: the brand line it lacks is also lacked by two
  ordinary earbuds. That task needs a judgement the vocabulary cannot carry, and
  I did not add a keyword filter, as the brief required.
- **The lazy tail of pages 2..n of a paginated read.** Completeness runs for a
  read of one page. A `next`-mode read still takes the eager part of each page it
  moves to; `awaitPageRendered` waits for an unread item and stops there. That is
  `page-render.ts`, outside my files, and it is the same fix one level in.
- **Whether the model would now write a bound.** The grammar change is proved to
  change the *shape the model is shown*; that it then writes one is a model
  behaviour and only a live run measures it.
- **No browser beyond the harness's Chromium.** No Firefox run, no unpacked
  extension.
- **Why two extract nodes were authored.** Measured as a duplicate read; the
  reason is in the build loop, which I did not read.

## Open questions or contradictions found

1. **The brief's diagnosis of (b) was inverted, and the artifacts say so.** The
   `where` mechanism was not unused: it was used, resolved and applied, and it
   removed exactly the advertisements. What was missing was every *other*
   condition. Anyone measuring this path should count the rows the run returned
   against the cards the page holds before concluding a filter was absent — the
   ad-mark condition is invisible in the row count unless you know the run holds
   15 cards and not 12.
2. **A run bundle cannot answer "what did the model write".** `live-llm.json`
   records `perCallRecords: "not recorded"`, and `flow-lane.json` carries tool
   ids and result codes but no draft and no refusal detail. I could name the
   *mechanism* of each defect and prove it in the harness; I could not prove from
   the bundle which of the two `where` defects that run hit. Publishing each
   decision's refusal codes — not its prompt — would have turned hours of
   inference into one grep, and `core.decision_unusable` /
   `llm_evidence_loop.draft_rerun` appear four times in run (b) with nothing
   saying why.
3. **Two adjacent extract nodes reading one page should be refused, not
   appended.** 24 rows where 13 were expected is 12 read twice. A plan rule
   ("two extract nodes with the same resolved request and nothing between them")
   is cheap and would have turned this run's failure into a build refusal the
   model could act on.
4. **`page-render.ts` still owns a growth settle that now runs before a
   completeness wait that supersedes part of it.** They ask different questions —
   "has the page stopped drawing" and "is there more behind the fold" — and the
   settle costs 900 ms on a page that is already still. Worth folding into one
   wait by whoever owns that file; I left it alone because it is outside my list.
5. **The packet's element ranking is a product-level decision that nothing
   tests.** There is no row anywhere asserting that a control the instruction
   names survives into the packet. The measurement above took ten minutes to
   write; it would make a good permanent test, against the two campaign sites,
   for whoever owns `content/evidence/`.
