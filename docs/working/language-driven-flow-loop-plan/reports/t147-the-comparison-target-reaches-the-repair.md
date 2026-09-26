# t147 — What an extraction compared against reaches the repair, and a reduced URL says so

## Outcome

Done, both parts. A wrong-answer repair is now shown what an extraction's filter
compared against, and whether a column was excluded from the dataset; and a URL
carried as its origin no longer reads as a URL that was never touched.

Changed, all in `F:\!FluxIQ` on `dev`, uncommitted:

- `packages/fluxiq/src/programs/automation-studio/runtime/recovery/repair-context/parameter-screen.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/recovery/repair-context/tests/parameter-screen.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/tests/refuted-result/tests/repair-context.test.ts`
  — **one added assertion, no expectation changed**; justified below.

Net production code: about 12 lines. The rest is the policy argument in the
file's voice and the tests.

## The decision, and the argument for it

**Carry the comparison target.** t141 left it withheld because it is a value
rather than a name, and called carrying it a policy decision. It is, and the
policy was already settled one section away — which is the argument, and it is
checkable rather than a judgement call:

- `recovery/context.ts` carries `expectedState` **whole**, its `expected` text
  included, and says why in its own header: authored document data is what the
  model is reasoning about.
- `repair-context/flow-graph.ts` carries **every router rule's condition whole**
  for that same stated reason. A rule's condition *is* a comparison target:
  `{ signalPath: "page.url", operator: "contains", expected: "/plus" }` reaches a
  provider today, screened for locators and for nothing else. The fixture in
  `refuted-result/tests/repair-context.test.ts` asserts exactly that, unchanged.

So an extraction's `where` is the same kind of authored object on a different
node, and the only reason it was treated differently is that the parameter screen
is the one section that reads parameters. Withholding it here protected nothing
the request as a whole was not already disclosing. That defeats the "it is a
value" objection on precedent rather than on hope.

The remaining objection from the brief — the same shape on a different node could
hold a person's data — is answered by **what position** is carried, not by trust
in the key:

- A comparand is recognised by the *relation* it is written under, and a relation
  is not a place a payload can go. `matches`, `contains`, `startsWith`, `endsWith`
  and `equals` each name a test applied to something the page had already shown.
  A value the step *sends* has to sit under a key that says where it goes, which
  is why `text` and `value` are in none of the lists at any depth.
- Because a comparand is a value rather than a word, it is bounded by
  `MAX_NAMED_KEY_DEPTH` exactly as a name is — below the allowance, `matches` is a
  column somebody invented and its value is the page's own field name. It is *not*
  given the any-depth treatment a classifier gets. This is strictly narrower than
  the classifier rule t141 introduced.
- Only the five canonical relations are listed. The web domain's forgiving
  spellings (`regex`, `includes`, `has`, `min`, `max`, …) are a *domain's*
  grammar, not Core's, so an unrecognised key is withheld — the conservative
  answer this file gives any key nobody has thought about yet. Stated as residue
  in the file rather than left to be discovered.

### The second half: a list's items are read under the list's own key

Reaching a comparand required finishing t141's own rule. "A list and its items
are one level" was only half-applied: an item that was an object was screened at
the list's level, while an item that was a **string** was screened with *no key at
all* (`screenedValue("", item, …)`), so no key rule could ever reach one.

That is not a special case for comparands — it is the same statement from the
other side. If an author cannot key a list, the only key a scalar item can be read
under is the one the definition gave the list. It also removes an incoherence that
was already there: `name: ["Add to cart"]` was a bare count where
`name: "Add to cart"` is carried. And it is load-bearing here, because the
condition grammar takes one value *or* a list of them and means one condition by
both, so a screen that read the two spellings differently would report a
difference the page never sees.

**This carries nothing new beyond the comparand keys:** a scalar item now carries
exactly what the scalar form of that key would have carried, and nothing else. The
class of carried values does not grow.

### t141's open question 2: `handling` — decided, added as a classifier

Added to `CLASSIFIER_KEYS`. It is drawn from the field spec's own closed set
(`include`, `exclude`, `encrypt`) and it decides whether a column reaches the
saved dataset at all, which is the first thing to check when a repair is told the
answer was missing a column the Flow plainly read. It had to be a classifier
rather than a name because it only ever appears at `fields.<column>.handling`,
past the allowance, where a bounded rule would never reach it — the same argument
`kind` already stands on.

### t141's open question 1: `header` — declined, reasoning restated

Not added. t141's reason stands and I did not defeat it: `headers` is a denied key
in the web domain and `header` is one character from it, so a rule carrying
`header` would sit one typo away from an Authorization value. Little is lost
either, because a condition already says which column it read, under `field` or
`read`, and those are the author's own words for it.

## The coordinator's addition: a reduced URL now says it was reduced

Diagnosed by t143: the screen reduces an absolute URL to its origin and recorded
nothing, so every navigate node in every run bundle read
`"url": "http://127.0.0.1:<port>"` with `"parametersWithheld": []`.

**I took option 1 — name the path in `withheld` — and the reason is not only
taste.** A third state would have to leave this file to be of any use, and the
only channel out is `AutomationStudioScreenedParameters`, consumed by
`repair-context/step-parameters.ts`, which maps `withheld` to
`parametersWithheld`. That file is not mine under this brief, so a new field would
have died in Core and the bundle would still have read `[]`. Naming the path
reaches the record today and needs no file I do not own.

So `withheld` now means: every path whose value in `values` is not what the Flow
authored, a reduction included. A refusal and a reduction are told apart by
`values` rather than by the list — a refused path stands with `null`, a reduced URL
stands with its origin. The type's own doc comment says this. A URL that was
already bare (or bare with a trailing `/`) is **not** named, since nothing was
dropped from it — which is precisely what makes the two cases tellable apart.

**What a reader can now conclude, and what they still cannot.** They can conclude
which *site* a step acted on, and that the Flow asked for something other than
that site's root. They still cannot conclude which page: the path and the query
are not carried, because that is where a search term, an order number and a
session token live. So the honest reading of a navigate step is "this origin, and
there was more after it" — which is enough to tell two runs apart when one opened
a search and the other opened the root, and not enough to tell two different
searches apart.

### The one change to a file I do not own outright

`runtime/tests/refuted-result/tests/repair-context.test.ts`, one **added**
assertion (no existing expectation altered):

```ts
expect(steps[0]?.parametersWithheld).toEqual(expect.arrayContaining(["url"]));
```

Justification: the defect t143 found is a claim about what a **run bundle** reads,
and this is the only test that exercises the bundle-facing shape. The fixture's
navigate node is authored with `https://shop.example.com/search?q=plus+items&session=9f2c`,
so before this change that step's record asserted `parametersWithheld: []` while
carrying a reduced URL — the exact reading the file forbids. My unit test pins the
rule; this pins that the rule reaches the bundle. Both pre-existing
`parametersWithheld` assertions in that file use `expect.arrayContaining` and
needed no change.

## Commands run and observed results

All from `F:\!FluxIQ` or `F:\!FluxIQ\packages\fluxiq`, as the brief specifies.

**Baseline, before any edit:** `npx vitest run …/runtime/recovery
…/runtime/tests/refuted-result` → `31 passed (31)` files, `438 passed (438)`
tests. Matches t141's closing figure.

**Final state:**

- `npx tsc --noEmit` → **exit 0, no output, zero errors.**
- `npx vitest run src/programs/automation-studio/runtime/recovery
  src/programs/automation-studio/runtime/tests/refuted-result` → `31 passed (31)`
  files, `444 passed (444)` tests — the baseline's 438 plus my six new cases. The
  refuted-result file's 14 tests pass with one assertion added and none changed.
- `node scripts/structure-audit.mjs` → `structure-audit: 1 violation(s) across 1
  rule(s)`: `FAIL [file-lines] runtime/flow-bootstrap/generation-failure.ts: 817
  lines`. That is another worker's file and was already red; the brief named it.
  Nothing of mine is a FAIL. `pnpm structure:baseline` was **not** run.

**Narrowness proof.** I copied the edited source aside, put the pre-change source
back in its place with the new tests still there, and ran the test file against
the old rule: `6 failed | 14 passed (20)`. The six failures were exactly:

| Failing case | What it pins |
| --- | --- |
| carries what a condition compared against | comparand carried, list and lone-value spellings |
| carries a column's handling at the depth it lives at | `handling` as a classifier |
| withholds a comparison target that is a credential, a locator or over-length | the three refusals *plus* a carried control target |
| carries a list's scalar items under the list's own key | the list-key rule on a naming key |
| reads a list item's keys as the definition's wherever the list sits | t141's case, whose comparand assertion this task changes |
| carries a URL as its origin … and says that it did | the reduced-URL disclosure |

The other 14 passed against the old rule: the 12 pre-existing cases I did not
touch, plus two of my new cases that are **guards rather than new behaviour** —
"reads a comparand as Core's word only where the keys are the definition's" (the
new rule's bound coincides with the old behaviour, which is the point: nothing
widened below the allowance) and "carries nothing a typing step sent, in either
spelling". I am flagging those two explicitly rather than claiming all six new
cases are regression tests for changed behaviour.

`git stash` is denied to workers by a hook, so this was done with file copies in
the scratchpad. No git history was touched and no commit was made.

**Mechanical check of the three vocabulary lists** (script in the scratchpad):
`naming: 15 | classifier: 11 | comparand: 5`; `duplicates across the three lists:
[]`; `'text' or 'value' anywhere: []`; `classifier added vs t141: ["handling"]`;
`naming unchanged vs t141: true`. The three sets are disjoint, and `text`/`value`
are in none of them.

**Every guarantee the brief listed, asserted:**

- A credential-shaped comparison target is refused first, before the key is read.
- A locator-shaped comparison target is refused (`\.price-text`).
- A comparison target over `MAX_NAME_LENGTH` is refused (81 characters).
- All three keep their key with `count` only and are named in `withheld`.
- `text` and `value` are uncarried at every depth, in scalar *and* list form.
- Carrying is justified by the position — the relation key plus the definition-depth
  allowance — not by a hope about the key.

## Not verified

- **Nothing was run live.** No provider call, no browser, no rerun of
  `run-muhubegx-9469de5e`. That a repair *behaves* differently once shown the
  comparison target is an expectation; what is verified is that the value reaches
  the request.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run**, per the brief. Only
  the `fluxiq` package was type-checked and only two test paths were run. A
  consumer of this screen outside those paths would not have been caught; a grep
  says `step-parameters.ts` is the only one in `packages/fluxiq/src`.
- **The extension repository was not type-checked or tested.** Nothing there
  imports this Core-internal module, but I did not prove it.
- **The run's own authored parameters still could not be read back.** As t141
  found, `test-runs/run-muhubegx-9469de5e` records no `extractList`, so I could
  not confirm from evidence what that Flow actually compared against. I designed
  from the schema (`domain/src/actions/extraction/schema.ts` and
  `condition-grammar.ts`), which declares `equals`/`matches`/`contains`/
  `startsWith`/`endsWith` as lists of values and the bounds as numbers.
- **Whether a regex comparison target survives the locator screen in practice.** A
  pattern escaping a literal dot before a letter (`\.price`) trips the locator
  shapes and is withheld. That is fail-closed and correct by the screen's
  contract, but it means some legitimate `matches` patterns will still arrive as a
  count. I did not measure how often.
- **A transient tooling failure, reported for completeness, not as a result.** One
  intermediate `tsc` run showed 13 errors in `runtime/llm/evidence-loop.ts` and a
  later one 25 errors around `runtime/llm/deepseek/provider.ts` being momentarily
  absent, and one intermediate vitest run showed 17 files failing to *collect*
  (188 tests ran, all passed). Those were another worker's half-landed edits in
  files I never touched; my own directory passed throughout
  (`…/repair-context` → `2 passed (2)` files, `26 passed (26)`). Both cleared on
  re-run. Final figures above are from the settled tree.

## Open questions or contradictions found

1. **My file is now 426 lines, past the 400-line advisory** (it was 296). This is
   a `warn`, not a FAIL — the hard limit is 800 — and the audit's FAIL count did
   not change. I condensed roughly 50 lines of prose that duplicated the doc
   comments on the sets themselves, and stopped there rather than delete reasoning
   the brief asked me to write. **The clean fix is a structural one I did not take
   because it is outside my ownership:** the file is a policy document with a
   ~60-line function attached, and the natural split is a sibling
   `parameter-vocabulary.ts` exporting `coreVocabularyKey` and the three sets,
   which would move ~120 lines of doc-plus-data out and leave
   `step-parameters.ts`'s import untouched. That is a supervisor's call, and worth
   making before the next task adds prose to this file.
2. **`expectedState.conditions[].expected` is still withheld by this screen while
   an extraction's comparand is carried.** I left it alone: the brief did not ask
   for it, and the existing case asserts it withheld with a person's name as the
   value. But the two are structurally the same thing — a predicate over page text
   — so the distinction now rests on the key rather than on a property a reader
   could state. It is not a live inconsistency in the *request*, because
   `context.ts` already carries the whole `expectedState` in `expected_transition`;
   it is an inconsistency between two sections of one request. Worth settling
   deliberately rather than leaving as an artefact of which task touched what.
3. **A domain's forgiving spelling of a relation is withheld.** A Flow that wrote
   `regex` or `includes` rather than `matches` or `contains` shows the repair a
   count. Fixing it properly means either Core knowing a domain's grammar (wrong
   direction) or the authored parameters being canonicalised at build time, which
   is a change in another area. Named in the file as residue.
4. **The parameter screen cannot say which page a step acted on, by design**, so
   run-to-run comparison of navigate steps is now "same origin, both non-root"
   rather than exact. If the loop needs to tell two different searches apart in the
   record, that wants a separate decision about run evidence — which is not the
   repair context and not this file.
