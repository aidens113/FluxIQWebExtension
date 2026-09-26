# t141 — An extraction's own vocabulary reaches the repair that must fix it

## Outcome

Done. A filter condition's and a field declaration's own declared keys are now
carried to the repair; every value that could hold a page, a person's data or a
way to address an element stays withheld exactly as before, and no existing
expected screened output changed.

Changed, both in `F:\!FluxIQ` on `dev`, uncommitted:

- `packages/fluxiq/src/programs/automation-studio/runtime/recovery/repair-context/parameter-screen.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/recovery/repair-context/tests/parameter-screen.test.ts`

No other file was touched. **No test that asserts a screened fixture had to
change**: the ten existing cases in `parameter-screen.test.ts` and the fourteen
in `runtime/tests/refuted-result/tests/repair-context.test.ts` pass with their
expectations exactly as they were.

## What changed and why

### The rule I chose, and why neither candidate in the brief is it

The requirement is **not monotone in depth**, and that one observation decides
the design. `extractList.fields.<column>` — two naming levels in, an
author-invented column key whose string value is the page's own field name —
must stay withheld, while `extractList.fields.<column>.kind` — three levels in —
must come through. No setting of `MAX_NAMED_KEY_DEPTH`, at any value, expresses
that: an allowance wide enough to reach the second reaches the first on the way.

That rules out the first candidate (raise the allowance for keys in `NAME_KEYS`,
so Core's vocabulary is Core's vocabulary at any depth). It carries
`extractList.fields.name`, which breaks the guarantee the file argues for at
length — one column's page field carried and its neighbour's withheld "for no
reason a reader could state" — and it opens a real leak in principle: any
author-keyed map whose key collides with the list (`attributes: { name: "<a
person's name>" }`) would have its value carried.

It also rules out the second candidate as stated — stop `nameDepth` advancing
through a level that is a declared parameter *group* rather than an author-keyed
map — because **Core cannot tell a group from a map here**. This module is handed
`(parameters, deniedKeys)` and nothing else; the node definition's parameter
schema is not in reach, and every structural discriminator I tested is unsound.
`{ field, is }` (a declared condition) and `{ name, price }` (an author's field
map) are both objects of two strings; key-vocabulary overlap fails on
`fields: { name, price }`; and a list of the keys that hold maps has an *unsafe*
default, which is the reverse of this file's stated stance that a key nobody has
thought about yet is withheld.

So I implemented a third rule, in two independent halves, each sound on its own
and neither needing to see a definition:

1. **A list and its items are one level, in both counters.** An author cannot key
   a list: an array declares the shape of its item, so a condition inside `where`
   is keyed by the definition exactly as `where` itself is. The position already
   refused to count a list's *index* as a naming level — it then counted the
   object behind the index, which is the same index by another name. This carries
   `extractList.where[i].read`, `.field` and `.is`, and
   `expectedState.conditions[i].kind` with them.
2. **Core's vocabulary splits into classifiers and names.** A *classifier* —
   `kind`, `mode`, `op`, `is`, `role`, `implicitRole`, `tagName`, `status`,
   `type`, `unit` — is carried at any depth. The justification is a property of
   the value rather than a judgement about the key: a classifier is the word a
   node *branches* on, drawn from a set its own schema declares, and a node that
   had to act on a person's data could not have switched on it. A *name* —
   `label`, `name`, `title`, `caption`, `heading`, `placeholder`, `ariaLabel`,
   `accessibleName`, `visibleText`, `key`, `field`, `fieldId`, `column`,
   `columnId`, `read` — is free text somebody wrote and stays behind
   `MAX_NAMED_KEY_DEPTH`, because inside an author-keyed field map `name` is the
   column the model invented. This carries `extractList.fields.<column>.kind`
   while still withholding `extractList.fields.<column>`.

`read` was additionally absent from Core's vocabulary altogether and is now a
naming key. It is one half of the union the extraction schema declares — a
condition names its value by `field`, a key of the field map, or by `read`, a
field of its own (`domain/src/actions/extraction/schema.ts`) — so a repair asked
why an extraction kept the wrong rows has to be shown which of the two the Flow
used and what it pointed at. Where `read` holds a selector rather than a column
reference the locator screen still withholds it, which is the same answer this
file already gives a `name` that turns out to be a selector.

The two lists are a partition of the old `NAME_KEYS` plus `read`: nothing was
dropped, nothing is in both (checked mechanically, below).

### What it looks like now

The run's own shape, screened before and after:

    before: extractList: { where:  { count: 1, items: [{ read: null, is: null }] },
                           fields: { name: { kind: null, required: true } } }

    after:  extractList: { where:  { count: 1, items: [{ read: "column:Badge", is: "absent" }] },
                           fields: { name: { kind: "text", required: true } } }

### What did not change

Every guarantee the brief listed holds, and each is asserted:

- `text` and `value` are in neither vocabulary list, so they are never carried at
  any depth — including at the new depth a classifier is carried from.
- A secret-shaped string is still refused first, before the key is read at all.
- A locator-shaped string is still refused, and now that a classifier has no
  depth bound this is the only thing standing in front of one: asserted directly
  with `kind: ".price-text"` and `mode: '[data-role="cell"]'` three levels in.
- `MAX_NAME_LENGTH` still applies to a classifier as it does to a name (asserted
  with an 81-character `op`).
- A withheld value is still named in `withheld` and still keeps its key with
  `null`.
- An absolute URL is still reduced to its origin; userinfo is still refused
  rather than trimmed.
- `MAX_DEPTH`, `MAX_KEYS_PER_OBJECT`, `MAX_ITEMS_PER_ARRAY` and
  `MAX_WITHHELD_PATHS` are unchanged. Recursion stays bounded because a list
  still spends a level of `depth`; what it no longer spends is a second level on
  the object it holds.
- The domain's denied-key declaration, `screenAutomationStudioLlmEvidence`,
  `automationStudioLocatorShapedText` and `automationStudioExecutableTargetKey`
  are untouched, in both repositories.

The file documents all of this in its own voice. A new section, **"Why two kinds
of word, and why the depth of a key cannot decide alone"**, names the run, quotes
what the re-author was handed, gives the non-monotonicity argument, states both
halves of the rule, and states the residue it does not claim to remove: an author
may name a column `kind`, and then that column's page field is carried where its
neighbour's is not — the same incoherence as before, now confined to a column
spelled after a word a node switches on, and still subject to the credential
screen, the locator screen and `MAX_NAME_LENGTH`.

## Commands run and observed results

All from `F:\!FluxIQ` or `F:\!FluxIQ\packages\fluxiq`, as the brief specifies.

**Baselines, before any edit:**

- `node scripts/structure-audit.mjs` → `structure-audit: 4 violation(s) across 2
  rule(s)`, plus `1 baseline entries can be lowered`. All four were already red
  and none is mine: `[failure-as-empty] runtime/llm/deepseek/provider.ts` at line
  248, and `[file-lines]` on `runtime/flow-bootstrap/generation-failure.ts`
  (817), `runtime/llm/deepseek/provider.ts` (811) and
  `runtime/llm/evidence-loop.ts` (941). `evidence-loop.ts` and
  `runtime/llm/index.ts` are modified and `runtime/llm/draft-amendment-feedback.ts`
  is untracked in the working tree from other work in flight; I left them alone.
- `npx vitest run src/programs/automation-studio/runtime/recovery` → `30 passed
  (30)` files, `420 passed (420)` tests.

**After the change:**

- `npx tsc --noEmit` → exit 0, no output.
- `npx vitest run src/programs/automation-studio/runtime/recovery` → `30 passed
  (30)` files, `424 passed (424)` tests — four more than the baseline's 420. The
  fifth assertion block went inside an existing case, so the count stayed at 424
  afterwards.
- `npx vitest run src/programs/automation-studio/runtime/recovery
  src/programs/automation-studio/runtime/tests/refuted-result` → `31 passed
  (31)` files, `438 passed (438)` tests. The second path is the only other place
  in the package that asserts screened parameter output
  (`runtime/tests/refuted-result/tests/repair-context.test.ts`, 14 tests); its
  expectations were not changed and it passes.
- `node scripts/structure-audit.mjs` → `structure-audit: 4 violation(s) across 2
  rule(s)` — identical to the baseline, nothing added, nothing in my files.
  `pnpm structure:baseline` was not run. `parameter-screen.ts` is 296 lines,
  under the 400-line advisory.

**Proof the new tests are a real regression test.** I copied the edited file
aside, wrote the committed version back over it with
`git show HEAD:<path> > <path>`, and ran the test file against the old rule with
the new tests in place: `4 failed | 10 passed (14)`. The four failures were
exactly my four new cases; all ten pre-existing cases passed against the old
rule, which is the evidence that the change is narrow. I then restored the edited
file and re-ran everything green. (`git stash` is denied to workers by a hook, so
this was done with file copies in the scratchpad; no git history was touched.)

**Mechanical check of the vocabulary split** — a node one-liner comparing the old
`NAME_KEYS` against the two new sets: `dropped: []`, `added: [ 'read' ]`,
`overlap: []`. A grep over `packages/fluxiq/src` confirms no remaining reference
to `NAME_KEYS` anywhere.

New test cases added (five assertion blocks across four `it` cases):

- carries the run's own extraction shape — `where[i].read`, `where[i].is`,
  `where[i].field`, `fields.*.kind`, `fields.*.required` — while
  `extractList.item` (a selector) is withheld and named;
- a classifier at any depth versus a name only at the definition's depth:
  `fields.price.kind` and `paginate.mode` carried, `fields.name` and
  `paginate.next` withheld and named;
- a list item's keys read as the definition's wherever the list sits, including
  `expectedState.conditions[i].kind` carried with `expected` withheld, and a
  comparison carried as `matches: { count: 1 }` with
  `extractList.where[0].matches[0]` named in `withheld`;
- a person's text, a locator-shaped string, a credential-shaped string and an
  over-long string, all at the depth a classifier is now carried from, all
  withheld and all named.

## Not verified

- **Nothing was run live.** No provider call, no browser, no rerun of
  `run-muhubegx-9469de5e`. That the *repair* now behaves differently when it is
  shown `read` and `kind` is an expectation, not an observation; what is verified
  is only that those words reach the request.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run**, in Core or in the
  extension repository; the brief named `tsc --noEmit`, the recovery suite and
  the structure audit, and said not to build Core. Only the `fluxiq` package was
  type-checked, and only two test paths were run, so a consumer of this screen
  outside those paths would not have been caught (a grep says there is none in
  `packages/fluxiq/src`).
- **The extension repository was not type-checked or tested.** Nothing there
  imports this module — it is Core-internal recovery code — but I did not prove
  that.
- **The run's own authored parameters could not be read back.**
  `test-runs/run-muhubegx-9469de5e` contains no `extractList`, `where` or `read`
  anywhere in `bundle.complete.json`, `run.json`, `summary.json` or
  `snapshots/live-llm.json`, so I could not confirm from the evidence whether
  that Flow's `read` was authored as a string or as a field-spec object. I used
  the screened shape the brief quoted and designed for both forms.
- **Whether `type`, `status` and `unit` are only ever classifiers.** I kept the
  old list's membership and only re-partitioned it, so those three are now
  carried at any depth on the argument that a node branches on them. The argument
  holds for every use I read in the web domain; I did not audit other domains.

## Open questions or contradictions found

1. **A condition's `read` in its object form still loses its column name.** The
   schema declares `read` as the same union a `fields` entry is, so it may arrive
   as `{ kind: "text", header: "Price" }`. `kind` now comes through; `header`
   does not, because `header` is in neither vocabulary list. I deliberately did
   not add it: `headers` is a *denied* key in the web domain (HTTP headers, which
   can carry an Authorization value) and `header` is one character away from it.
   If a repair turns out to need the column header, that is a vocabulary decision
   to make on purpose rather than fold into this change.
2. **`handling` is a classifier and is not in the list.** The extraction's field
   spec declares `handling` from a closed set
   (`WEB_AUTOMATION_EXTRACT_FIELD_HANDLINGS`) and it says whether a column is
   excluded from the saved dataset — exactly the kind of thing a wrong-answer
   repair would want. It was not in the old `NAME_KEYS`, and adding vocabulary is
   not the rule this task asked for, so I left it out and am naming it instead.
3. **What a condition compared *against* is still withheld, by design, and may be
   the next gap.** `matches`, `contains`, `equals` and the rest are lists of
   values the author wrote, and their items are carried as a count only —
   `matches: { count: 1 }`, with `extractList.where[0].matches[0]` named in
   `withheld`. So a repair can now see that the Flow filtered on *this column*
   with *this comparison*, but not what it compared against. For the refuted run
   in question — 43 rows kept where 13 were wanted — the comparison's target may
   well be the thing that was wrong. It is a value rather than a name, so
   carrying it is a policy decision, not an oversight to patch quietly.
4. **The `1 baseline entries can be lowered` line predates this work** and is
   unrelated to it; `pnpm structure:baseline` was not run, per the brief.
