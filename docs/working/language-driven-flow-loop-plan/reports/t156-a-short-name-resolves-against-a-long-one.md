# t156 — A short name resolves against a long one

## Outcome

**Done.** `url`, `title`, `heading`, `cost`, `prce`, `ratng` and `ratings` now
resolve against the catalog's long detected keys through Core's own
`automationStudioMatchName`, at Core's own unchanged 0.25 floor. The four words
of the live instruction — "with columns name, price, rating and url" — all
resolve, and `url` is the one that did not before.

Two causes, not one, and only one of them was a scoring defect:

| Written | Was | Now | Why it missed |
| --- | --- | --- | --- |
| `prce`, `ratng`, `ratings` | 0.077, 0.089, 0.089 | 0.597, 0.631, 0.646 | **A scoring defect.** A near token counted for exactly as much as an unrelated one. |
| `url`, `title`, `heading`, `cost` | 0.042, 0.042, 0.071, 0.042 | 0.497, 0.497, 0.497, 0.493 | **A vocabulary gap.** No comparison of characters brings `url` near `link`. |
| `name`, `price`, `rating`, `stock`, `link` | 0.733, 0.746, 0.757, 0.764, 0.733 | **identical** | Nothing; they shared a whole token. |
| `banana`, `sponsored`, `description`, `quantity` | below the floor | **still refused** | There is genuinely no plausible answer. |

Every node-id score in Core is unchanged to three decimal places. Measured over
the realistic pairings — 105 written node ids against the whole registry, and
3239 written parameter keys against each node's own parameters — **nothing that
used to resolve stopped resolving, and nothing resolves to a different name than
it did before.** Section 4 is that sweep.

One entry point, not two. Section 4.3 says why, with the evidence.

---

## 1. The diagnosis, in terms of what the measure computes

Asked for before changing a constant, and it is the whole reason the fix is not
a lower floor.

`automationStudioNameSimilarity` blends three signals over two **normalised**
names: containment (0.45), Dice (0.30) and whole-name edit similarity (0.25).
Containment and Dice both came from `automationStudioNameTokenOverlap`, which
counted `shared` tokens as *exact string equality between whole tokens*.

**`name` against `product-name`, normalised `name` / `product name`:**

- tokens `{name}` and `{product, name}` share `name` exactly, so `shared = 1`;
- containment `1 / min(1,2) = 1`; Dice `2·1 / (1+2) = 0.667`;
- edit distance 8 over 12 characters, so the edit term is `1 − 8/12 = 0.333`;
- `0.45·1 + 0.30·0.667 + 0.25·0.333 = **0.733**`.

Containment and Dice supply 0.65 of that 0.733. The edit term supplies 0.083.

**`url` against `product-link`, normalised `url` / `product link`:**

- `url` is not a whole token of `product link`, so `shared = 0`;
- containment 0, Dice 0 — **three quarters of the blend is dead**;
- the only surviving signal is edit distance over the candidate's *entire*
  string: 10 edits over 12 characters, `1 − 10/12 = 0.167`;
- `0.25 · 0.167 = **0.042**`.

`prce` against `product-price` fails identically: `0.25 · 0.308 = **0.077**`.

So the score `url` got was not a measurement of how close `url` is to anything
`product-link` *says*. It was a measurement of how close the four characters
`url` are to the whole twelve-character string — nine of which belong to a token
the written name never claimed. **Lengthen the candidate and the score falls
further while the answer is no less right**: that is the length dependence the
brief names, and it is a property of comparing a short name against a whole long
string rather than against the part of it that was meant.

The typo carve-out could not rescue either, because `withinTypoDistance` bounds
the distance by the **longer** name, and 10 > 2.

Both failing families are one defect seen twice: the token measures were
all-or-nothing on whole-token equality, so **a token one character off a
candidate's token scored exactly as much as a token with no relation to it —
nothing.** `prce`/`price` and `banana`/`name` were indistinguishable to the
measure. And `url`/`link` is not reachable by any character comparison at all:
they share one letter and are two spellings of one idea.

## 2. The fix, and why it is not the floor

### 2.1 `token-credit.ts` — new. What one pair of tokens is worth

`automationStudioNameTokenCredit(left, right)` returns, for two single tokens of
a normalised name: `1` for the same token, a length-normalised score for a near
one, the synonym credit for a different word naming the same thing, `0`
otherwise.

**The near-token bound is proportional: at most one edit per four characters of
the longer token, and no token shorter than five characters is forgiven at all.**

Why not reuse the flat whole-name bound (two edits from five characters up):
across a whole name two edits is a small fraction; inside one token it is how
*two different words* look. Reusing it resolved `upload-file` to
`builtin.data.filter-list` — `file`/`filter` is two edits — which is a name this
matcher is measured refusing. Measured and asserted:

| Pair | Credit | |
| --- | --- | --- |
| `prce`/`price` | 0.8 | admitted |
| `ratng`/`rating` | 0.833 | admitted |
| `ratings`/`rating` | 0.857 | admitted |
| `descripton`/`description` | 0.909 | admitted |
| `file`/`filter`, `send`/`set`, `name`/`date`, `extarct`/`extract` | 0 | two edits in one token |
| `send`/`end`, `name`/`game`, `lst`/`list`, `url`/`uri`, `dom`/`dot` | 0 | shorter than five characters |

**The five-character minimum was found by a failing test, not reasoned in
advance.** Without it, `sendEmail` resolved to `builtin.control.end` at 0.285 —
`send` is one edit from `end` — and `canonical-registry.test.ts` caught it. At
four characters one edit is a quarter of a single-syllable word and a slip cannot
be told from a different word.

**Nothing is lost by either bound**, because what they give up is exactly what
the whole-name rule already sees. `lst`/`list` now earns nothing here and
`web.output.dom_extract_lst` still resolves at 0.963: one edit over twenty-seven
characters is a typo by any reading. The two rules are complements — a slip that
is a large fraction of one token and a small fraction of the whole name.

### 2.2 `synonyms.ts` — new. Core's own bounded vocabulary

Three groups, ten words, credit **0.7**:

```
url    link  href
title  name  heading  label
price  cost  amount
```

- **It is beside the matcher, not inside it.** Its own module, its own tests, its
  own barrel entry. `token-credit.ts` consults it; nothing else does.
- **A synonym can never outrank a genuine near match.** 0.7 is strictly below
  0.8, the weakest credit a near token can earn (one edit in the shortest token
  an edit is forgiven in), and below 1 for an exact token. Asserted directly, and
  end to end: `url` against `{product-link, product-url-slug}` resolves to the
  one holding `url` as a token; `price` against `{product-cost,
  product-prices}` resolves to `product-prices`.
- **Both words must be spelled exactly.** `titel`/`name` earns nothing.
  Stacking a misspelling on a synonym is two guesses, and that is where a
  matcher stops being able to say why it answered what it did.
- **Bounded by measurement, not by taste.** Each group is a pair a model was
  measured writing: `url`→`link` on the detected path (t149), `title`→`name` on
  the literal path (t142). `uri` is deliberately absent — it is one edit from
  `url`, so the near-token path would handle it if the length bound allowed, and
  two mechanisms for one pair is one more thing to keep in step.
- **It teaches Core nothing about the web.** The audit's `web-vocabulary` rule
  counts identifiers and string-literal *property keys*; a string in a list is
  data it passes through, which that rule's own header states. `url`, `href` and
  `html` are also explicitly outside its term list, as Core's addressing and its
  docs program's output format. The audit is clean (section 3).

The argument for Core rather than beside one caller: it is the same kind of
knowledge as `normalize.ts`'s rule that a camel-case hump is a separator — how
names are spelled in English, not what one domain's names mean. Held here, a
node id, a parameter name and a name inside a parameter value are corrected by
one vocabulary, which is what t149 asked for.

### 2.3 `token-overlap.ts` — `shared` becomes a weighted, one-to-one pairing

Every pair of tokens is scored, sorted best-first, and claimed one-to-one; the
credits are summed and containment and Dice are computed from that sum exactly
as before. When every shared token is spelled the same the sum is the same
integer, **so nothing that already resolved has moved** — which is what makes
the 0.733/0.746/0.757/0.764 rows in section 0 identical rather than merely close.

One-to-one matters: without it `rating`, `ratings` and `ratng` would each claim
the same `rating` and a name sharing one column would look like a match on
three. Ties fall back to written order, so the answer never depends on set
iteration.

### 2.4 The floor did not move, and that is recorded on the floor

`score-floor.ts` now says why. Lowering 0.25 far enough to admit `url` (0.042)
would have admitted `banana` (0.042) and `sponsored` (0.068) in the same
movement — it would make every refusal arbitrary. The two names now land at
0.497 and 0.597, *inside* the band the floor was measured to accept, and that
they land there is the evidence the measure and not the bar was at fault.

### 2.5 A performance note, because this is on the authoring path

The old token comparison was a set lookup; this walks an edit-distance matrix per
token pair. Measured over Core's 41 real node ids, 20000 matches:
**173µs → 358µs per call**. A provable prefilter — a difference in length is
already a lower bound on edit distance, so a pair the bound cannot admit is
rejected without the matrix — brought it to **266µs**, a 1.53× cost. The sweep in
section 4 is byte-identical before and after the prefilter. A third of a
millisecond per name resolved, a handful of names per authored plan.

## 3. Commands run and observed results

All from `F:\!FluxIQ` or `F:\!FluxIQ\packages\fluxiq`. Nothing was committed and
Core was not built.

| Command | Observed |
| --- | --- |
| `npx tsc --noEmit` (packages/fluxiq) | **exit 0**, no output |
| `npx vitest run src/programs/automation-studio/nodes` | **12 files, 114 tests, 114 passed** |
| `npx vitest run .../nodes .../runtime/flow-bootstrap` (final) | **36 files, 641 tests, 641 passed** |
| `node scripts/structure-audit.mjs` (**baseline, before any edit**) | exit 1 — `1 violation(s) across 1 rule(s)`: `FAIL [imports] .../flow-bootstrap/tests/t152-scratch-projection.test.ts` |
| `node scripts/structure-audit.mjs` (final) | **exit 0 — `passed (182 warning(s), 358 baselined)`** |
| `node scripts/structure-audit.mjs \| grep -c name-match` | **0** — no finding, and no advisory warning, in any file of mine |

The pre-existing `t152-scratch-projection.test.ts` failure is gone; another
worker closed it mid-run. The brief expected `flow-bootstrap/generation-failure.ts`
at 817 lines; that file has been split into a directory by another worker and no
longer appears. The audit reports `2 baseline entries can be lowered` (1 at
baseline); **I did not run `pnpm structure:baseline`.**

Line counts, all far under the 400-line advisory: `token-credit.ts` 82,
`token-overlap.ts` 76, `synonyms.ts` 72, `match-name.ts` 80, `similarity.ts` 66,
`score-floor.ts` 39. The directory holds 12 source files (limit 25, warn at 15).
`token-credit` joins `token-overlap` as a prefix group of two and `synonyms` has
no prefix, so `prefixGroup: 3` is untouched — which is why the vocabulary is
`synonyms.ts` and not `name-synonyms.ts`.

### 3.1 The flow-bootstrap figure was taken over another worker's tree

`generation-failure.ts` is deleted and its tests renamed in the working tree
right now. The 641 were green, so that worker's state was consistent when I ran,
but the figure is theirs as much as mine. The 114 in `nodes/` is entirely mine.

## 4. Every caller, and the proof none of them regressed

`automationStudioNameSimilarity`, `automationStudioNameTokenOverlap`,
`automationStudioNameEditDistance`, `normalizeAutomationStudioName` and the
floor have **no caller outside `name-match/`** — verified by grep over
`packages/`. Only `automationStudioMatchName` and the types cross the boundary,
to four places:

1. `nodes/canonical-registry.ts::matchDefinition` — written **node ids**. It has
   no production caller yet; only `tests/canonical-registry.test.ts` exercises it.
2. `runtime/flow-bootstrap/plan/name-correction.ts` — written **parameter keys**
   against one node's declared parameters, in two entry points, reached from
   `authoring/assemble.ts` and `authoring/normalise.ts`.
3. Downstream: `domain/src/actions/extraction/field-match.ts` (a request's own
   literal keys) and `.../plan-resolution/extraction/column-match.ts` (a
   detection's keys). Section 5.

### 4.1 Written node ids against the whole registry — 2 of 105 changed

Core's 41 real ids, plus 64 names a model plausibly writes for a capability Core
does not have. Before against after:

| Written | Was | Now |
| --- | --- | --- |
| `joinLists` | REFUSED | `builtin.data.filter-list` 0.323 |
| `builtin.data.join-lists` | `builtin.data.constant` 0.645 | `builtin.data.filter-list` 0.702 |

Nothing else moved, at all. `screenshot`, `sendEmail`, `http.request`,
`upload-file`, `sleep`, `banana`, `x`, `downloadFile`, `readFile`, `writeFile`,
`sendMessage`, `openTab`, `closeTab`, `waitForLoad`, `assert`, `log`, `print`,
`sortList`, `groupBy`, `countRows`, `sum`, `average`, `parseJson`, `stringify`,
`encrypt`, `hash`, `uuid`, `now`, `today`, `sleepMs`, `abort`, `retryOnce`,
`runPython`, `callApi`, `postJson`, `readCsv`, `writeCsv`, `translate`,
`summarize`, `classify`, `web.output.dom-hover`, `web.output.dom-drag`,
`builtin.text.replace` and all ten vocabulary words are refused exactly as
before. The second row is an improvement — a wrong answer replaced by a less
wrong one. The first is a wrong answer where there was a refusal, at 0.323, in
the same band `score-floor.ts` already admits deliberately (`click-element` →
`web.output.dom-click` at 0.338, which that file argues *should* resolve); it
shares the word `list` with the node it picks. No node id contains any word of
the synonym vocabulary, so the vocabulary cannot reach this path at all.

Pinned in the tests so a retune cannot move them silently: `dom-extract-list`
0.823, `filterList` 0.765, `for_each` 0.733, `navigate` 0.644, `compare` 0.683,
`web.output.dom_extract_lst` 0.963, `click-element` 0.338. These are the figures
`score-floor.ts` argues 0.25 from.

### 4.2 Written parameter keys against one node's own parameters — the realistic pairing

41 node definition files × 79 written keys = **3239 comparisons.
19 newly resolving, 0 newly refused, 0 resolving to a different parameter.**

That last pair of zeroes is the proof the brief asked for: no caller resolves to
a different name than it did, and nothing that resolved stopped.

All 19 are in three families, every one of them the intended behaviour:

- **the vocabulary doing its job (11)** — `title`, `name`, `heading` or `label`
  resolving to the node's human-readable-name parameter: `builtin.control.start`
  → `label` (0.525–0.625), `builtin.data.constant` → `valueLabel` (0.478–0.5),
  `builtin.data.get-variable` and `set-variable` → `name` (0.561–0.625);
- **a plural (5)** — `modes` → `mergeMode`, `matchMode`, `writeMode`,
  `failureMode`, each the only `*Mode` its node declares (0.583–0.595);
- **a typo and an odd context (3)** — `valu` → `missingValue` on
  `builtin.logic.not`, which declares no plain `value` (0.597); and `price` /
  `cost` → `amount` on `builtin.random.jitter` (0.525, 0.608), the only numeric
  quantity there. Nobody writes `price` on a jitter node, and if they do, the
  standing rule prefers a recorded assumption to a refusal.

Only three Core parameter ids are words of the vocabulary at all — `label` on
`builtin.control.start`, `name` on the two variable nodes, `amount` on
`builtin.random.jitter` — and no node declares two words of one group, so the
vocabulary never has to choose between two synonyms of the same thing.

One near-tie worth recording rather than engineering around: `cost` resolved to
`count` at 0.600 before (two edits, admitted only by the flat whole-name bound)
and resolves to `amount` at 0.608 now. The margin is 0.008. `amount` is the
better answer and `cost`/`count` is not a near match by this change's own
per-token rule, but the two mechanisms are competing closely there.

### 4.3 One entry point, not two, and why

The brief allows a second named entry point if the change were right for columns
and wrong for node ids. It is not.

- **The near-token fix is right for every caller.** It strictly *adds* the signal
  a typo inside one token of a long name was missing, which is as true of
  `web.output.dom-extract_list` as of `product-price`. Measured, it changed one
  written node id out of 105 and zero parameter resolutions for the worse.
- **The synonym vocabulary cannot reach node ids at all**: not one of Core's 41
  ids contains any of the ten words. On parameters it fires 11 times out of 3239
  and each is the answer a person would give.

A gated vocabulary would also defeat the point t149 argued for: if the column
path has to opt in, the vocabulary is not shared, and a node id and a column name
are no longer corrected by one thing. So: one entry point, unchanged signature,
no option added.

## 5. What this breaks downstream, which is intended and is not mine to fix

Two assertion sites in `F:\!FluxIQWebExtension` assert that `title` and `prce`
are refused. They were written as *measurements* of Core's floor, and this task
is the change that moves them. Both will fail the moment Core is rebuilt:

1. `domain/src/runtime/llm-evidence/plan-resolution/extraction/tests/column-match.test.ts`,
   test *"a column with no plausible candidate is still an honest failure"* — the
   loop `["banana", "title", "prce", "#card > .price:nth-child(2)"]`. **`title`
   now resolves to `product-name` at 0.497 and `prce` to `product-price` at
   0.597.** `banana` and the selector still refuse. Two of four rows move out,
   and the comment above them ("both fall in the band the floor was measured to
   reject") is now wrong.
2. `.../extraction/tests/slot.test.ts`, the `unknownField` list — its third
   entry `{ fields: { name: { handle: extraction, key: "title" } } }`. **Now
   resolves.** `banana` and `column:Name` still refuse. The comment there names
   `title` as a measured miss and points at `column-match.test.ts`.

Nothing else downstream flips, verified against the real key sets:

- `domain/src/actions/extraction/tests/item-conditions.test.ts` — `sponsored`
  against `{name, price, rating, url}` is **still refused** (the honest-failure
  row), `badge` against a one-key request is **still refused** (the excluded-column
  row), `ratng`→`rating` 0.833, `Price`→`price` normalized, `productName`→`name`
  0.733 all unchanged.
- t149's pinned ties are unchanged to three decimals: the `STARS` pair at
  **0.688**, the `product-image` pair at **0.881**, `product-lnk` **0.917**,
  `product-ratings` **0.933**, `product-prce` **0.923**.

Newly available downstream, beyond the two words above: `link`, `href`, `cost`,
`heading` and `label` now resolve as column names, and `url`→`product-link`
0.497 is the one the live instruction has been asking for fourteen times.

## 6. Files changed

Owned by the brief, all under
`packages/fluxiq/src/programs/automation-studio/nodes/name-match/`:

- `token-credit.ts` — **new**. What one token pair is worth: the proportional
  edit bound, the five-character minimum, the length prefilter.
- `synonyms.ts` — **new**. The three groups, the 0.7 credit, and the argument for
  both.
- `token-overlap.ts` — `shared` is a weighted one-to-one pairing.
- `similarity.ts` — comments only. The weights and the code are unchanged; the
  header and the typo carve-out's comment now say what each rule is actually for.
- `score-floor.ts` — comment only. Why the floor did not move.
- `match-name.ts` — comment only. A synonym is `nearest`, never `normalized`.
- `index.ts` — two barrel entries.
- `tests/token-credit.test.ts` — **new**, 9 tests.
- `tests/match-name.test.ts` — 3 new tests (the node-id score pins, the catalog
  measurement, the exact > near > synonym ordering).
- `tests/similarity.test.ts` — 3 new tests on token overlap.

`git status` confirms my diff is confined to that directory. I touched none of
`runtime/flow-bootstrap/`, `runtime/llm/harness/`, `runtime/recovery/context.ts`,
`runtime/recovery/repair-context/` or `runtime/service.ts`, all of which are
being edited by other workers right now. I committed nothing and did not build
Core.

## 7. Not verified

- **No live run, no provider, no browser.** That a resolved column reads the
  values a person meant is argued from the names, not observed. The fourteen-times
  instruction has not been run against this change.
- **Core was not built, and the downstream repository was not tested.** The
  web-extension repository consumes `packages/fluxiq/dist`, which is stale, so
  running `pnpm --filter @fluxiq-web-extension/domain test` now would measure the
  old matcher and prove nothing. Section 5's predictions come from running this
  change's exact algorithm over the exact key sets those tests use, not from
  running those tests. **They are predictions and should be confirmed by running
  them after Core is built.**
- **`pnpm check`, `pnpm test` and `pnpm build` were not run whole**, as
  instructed. Nor was any suite outside `nodes/` and `flow-bootstrap/`; the grep
  for callers says there is nothing else to run, but that is a grep, not a run.
- **The sweep in section 4 tests the matcher, not the callers.** It replays each
  caller's candidate-set shape (all node ids; one node's own parameters) through
  the algorithm. It does not exercise `matchDefinition`'s scope filtering or
  `name-correction`'s claimed-candidate exclusion, both of which only ever
  *narrow* the candidate list.
- **The parameter sets in the sweep were scraped from source by regular
  expression**, per node definition file, not read from the built registry. 41 of
  Core's 54 node ids were found this way; the 13 missing are ids declared away
  from their parameters (the web output nodes are declared downstream). Web node
  parameters are therefore **not** in the sweep.
- **The benchmark is the algorithm re-implemented in a scratch script**, not the
  compiled TypeScript, and was run once on a machine with four other workers
  active. Treat 1.53× as an order of magnitude, not a figure.
- **The five-character minimum is fitted to the one failure that exposed it.**
  `sendEmail`/`end` is the only case that forced it; I did not measure whether
  four-character near tokens would have helped anything.

## 8. Open questions found

1. **`joinLists` now resolves to `builtin.data.filter-list`** (section 4.1). This
   is the standing rule working as designed — a wrong correction is visible and
   repairable, a refusal costs a call the model does not act on — but it means the
   matcher will now answer for capabilities Core does not have when they share an
   intent word. If that is ever wrong, the place to argue it is
   `score-floor.ts`, which already admits `click-element` at 0.338 for the same
   reason.
2. **Nothing carries the assumption to a person or a repair.** t142 and t149 both
   reached this wall and it is still there: `plan-resolution/resolve-plan-node.ts`
   drops `assumed`, and Core projects a corrected *parameter* name
   (`flow-bootstrap/plan/name-correction-assumption.ts`) but not a corrected name
   *inside* a parameter value. A synonym resolution is a bigger assumption than a
   typo correction — `url` became `product-link` on a vocabulary decision, not a
   spelling — so the case for publishing it is stronger now than it was. One Core
   task closes both paths at once.
3. **`web.handle.ambiguous` is still the one naming refusal a near miss cannot
   survive**, unchanged from t149 and now the *only* one left for a plausible
   word. Two columns with the same folded header still refuse.
4. **The vocabulary will be asked to grow, and the discipline should hold.** The
   obvious next candidates are `image`/`img`/`photo`/`thumbnail`,
   `description`/`summary`/`details`, `rating`/`score`/`stars` and
   `count`/`total`/`quantity`. None is in, because none was measured missing. The
   bar to keep is a *measured* miss on a real run, not a plausible one — the
   moment it becomes a thesaurus, the matcher stops being able to refuse anything.
5. **`cost`/`count` versus `cost`/`amount` differ by 0.008** (section 4.2). The
   flat whole-name typo bound admits two-edit pairs that this change's per-token
   bound calls different words, so the two mechanisms disagree about what a typo
   is. Nothing is wrong today. If a future task wants one rule, the whole-name
   bound is the one to revisit, and it will move node-id scores, so it needs its
   own measurement.
