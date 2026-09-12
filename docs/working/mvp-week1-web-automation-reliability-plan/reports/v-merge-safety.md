# Report: v-merge-safety

Worker: `v-merge-safety`. Closing the second producer of page evidence — the
background worker's cross-frame merge — and making the merge itself exhaustive.

## Outcome

**Done, with one gate I cannot make green from inside my Owns, and it is a
one-line change in a file the brief forbade.** That is the headline, it is in
[The one line I do not own](#the-one-line-i-do-not-own) below, and I measured
both ways of fixing it so the supervisor is choosing between numbers rather
than between guesses.

The substance:

- All 13 conditional spreads are gone from
  `apps/extension/src/background/connection/dom-snapshot.ts`, together with the
  `boundsOrNone` helper whose `{ bounds?: RectDescriptor }` return type was a
  hand-written restatement of a contract key.
- **The merge is exhaustive.** `mergePageEvidence` no longer names the eight
  keys by hand and hopes; it names them through `present<PageEvidence>()`,
  whose parameter type is a mapped type over the contract's keys that the
  compiler requires to be total. So is `frameEvidenceInTopFrameTerms`, which
  had the same hole one level up — its `...evidence` blanket spread would have
  carried a new selector-bearing field out of a child frame *unqualified*.
- **Both proofs are quoted, and each is a before/after pair.** The before half
  matters more than the after half: it shows the defect was live this morning,
  not that a new guard works.
  - A renamed write key: old code `check` **exit 0** and **249 of 249 tests
    green**. New code `error TS2353`.
  - A field added to the contract: old code produced **zero** errors naming
    `dom-snapshot.ts` — the merge would have dropped it in silence. New code
    fails at **both** `present<PageEvidence>` sites with
    `Property 'scrolling' is missing`.
- **The merged JSON is byte-identical**, md5 `51538f91…` both ways, over a
  two-frame fixture exercising all eight contract keys. This is a safety change,
  not a behaviour change.
- Extension `check` **exit 0**, extension `test` **exit 0**
  (`# tests 249 # pass 249 # fail 0`, two new rows), domain `check` **exit 0**,
  domain `test` **exit 0** (`# tests 310 # pass 310 # fail 0`).
- Structure audit: **3 violations, 32 warnings**. Two violations are the
  supervisor's pre-existing `working-docs` rows, present before I touched
  anything. The third is mine and is the import discussed below. Warning count
  is unchanged from the pre-change run, byte for byte.

**Is any producer of page evidence still unprotected? No.** Named and checked
in [Is that the last one?](#is-that-the-last-one) — there are exactly two
producers of `WebAutomationPageEvidence` in this repository, and after this
change both fail to compile on a renamed, deleted or added contract field.

## The one line I do not own

`present` lives at `apps/extension/src/content/evidence/present.ts`. The brief
said to import it from where it is and not to relocate it, and that is what the
shipped code does:

```ts
import { present } from "../../content/evidence/present";
```

That import fails the structure audit:

```
FAIL  [imports] apps/extension/src/background/connection/dom-snapshot.ts: 1 import(s)
reach into another directory's files instead of its barrel, e.g.
"../../content/evidence/present" at line 32. Import from the directory (its index) instead.
```

`content/evidence/` has an `index.ts`, and `scripts/structure-audit/rules/imports.mjs`
counts any import from outside a barrelled directory that reaches past its
barrel. The barrel does not export `present` — every existing importer is a
sibling inside the same directory, which the rule exempts, so this is the first
consumer from outside and the first to hit it. The rule is `ratchet: true` with
no baseline entry for this file, and the wave's own rule says the baseline
refuses growth, so it cannot be baselined away either. Only the code can change.

There are two remedies and they are not equivalent. I probed both and reverted
both; every file below is byte-identical to how I found it, verified by `diff`.

| Remedy | Audit | Extension `check` | Background bundle |
| --- | --- | --- | --- |
| Shipped: deep import, barrel untouched | **1 FAIL** | exit 0 | 224,870 B |
| **A.** `export { present } from "./present";` in `content/evidence/index.ts`, import the barrel | **clean** | exit 0 | **244,126 B (+19,256)** |
| **B.** Move `present.ts` to a barrel-less directory both producers can reach | clean | — | 224,870 B (unchanged) |

**Remedy A costs 19 KB in the service worker.** Importing the barrel pulls
`dialogEvidence`, `formEvidence`, `overlayEvidence` and the rest of the content
producers into the background bundle, and esbuild does not shake them out. That
is not fatal, but it is a real cost for a one-line convenience, and it is why I
did not simply take it: it is a decision, not a formality.

**Remedy B** is `apps/extension/src/shared/`, which has no `index.ts`, so a deep
import into it is clean by the same rule. There is a precedent argument for it:
`shared/protocol.ts` already re-exports the evidence *types* with the comment
"so a consumer outside `content/` -- the background worker's frame merge, above
all -- reads one wire seam rather than reaching into the content script's
modules for a type." That seam exists for exactly this consumer, and today it
carries the types but not the writer. The cost is that the eight content
producers change one import line each, in a directory the brief called settled.

I did not take either. **The brief should have included whichever file the
supervisor prefers** — `apps/extension/src/content/evidence/index.ts` for A, or
`present.ts` plus the eight sibling imports for B. Reporting it is what the
wave's ownership rule asks for, and the shipped change is not inert while it
waits: it compiles, it runs, its tests pass, and the compile-time guarantee is
live. What is red is one audit line naming one import.

## What changed and why

One source file and its test file.

### `apps/extension/src/background/connection/dom-snapshot.ts`

**The 13 spreads.** Every one is now a plain property written through
`present<T>()`. `boundsOrNone` is deleted; a rect is written as
`bounds: place(...)` and `present` drops it when the placement failed, which is
the same behaviour with the contract's own key name instead of a local
restatement of it. One consequence worth naming: the old code spread a
`{ bounds?: RectDescriptor }` into a `DialogEvidenceItem` position, and a spread
is not checked, so nothing had ever verified that the extension's
`RectDescriptor` satisfies the contract's `WebAutomationEvidenceRect`. It is
checked now, and it passes.

**The merge.** The brief was right that applying the helper to the spreads alone
would not have fixed the hand-enumeration — but `present<T>` is not only a
strip. Its parameter type is

```ts
type EvidenceFields<T> = object extends T ? never : NoInfer<RequiredFields<T> & OptionalFields<T>>;
```

with `-?` on the optional half, so **the literal must mention every key of `T`**,
optional keys included, valued `undefined` when absent. That is exactly "a
mapped type over the contract's keys the compiler requires to be total", and it
was already in the repository. Building the merge's result with
`present<PageEvidence>({ … })` therefore *is* the exhaustive merge; a ninth
contract key stops the file compiling until the merge says what it does with it.
Using the same helper for both jobs beat inventing a per-key merge table beside
it, which would have been a second mechanism doing what the first already does.

`frameEvidenceInTopFrameTerms` got the same treatment and needed it for a second
reason: its `{ ...evidence, … }` carried unnamed fields through untouched, so a
future contract field holding a selector or a rect would have been copied out of
a child frame bare — resolving against the wrong document, or drawn at the top
of the page. That is the same class of silence, one layer down.

**The two shadowing traps.** `mergeDialogEvidence` and `mergeOverlayEvidence`
each declared a local `const present`. Both locals are renamed to `reported`;
the import is untouched, as the brief asked.

**Key order is preserved deliberately.** `present` writes the literal's own key
order, so I matched each literal to the order the content producer writes rather
than to the contract's declaration order. They agree everywhere except
`RegionEvidence`, where the contract declares `role, label, selector, bounds`
and `content/evidence/regions.ts` writes `role, selector, label, bounds`. I
followed the producer and left a one-line comment saying so, because that is
what makes the restated JSON byte-identical. Without it the only difference in
the whole change was two swapped keys on a child frame's regions.

### `apps/extension/src/background/connection/tests/dom-snapshot.test.ts`

The child fixture gained a `repeating` item, so the two frames together now
exercise all eight contract keys — `repeating` was the one key no fixture
carried, which is precisely the shape of item the old merge could have dropped
unnoticed. Two assertions were added to the existing qualification test for the
repeating container and its representative selector, and two rows were added:

- **"the merged page carries every item some frame reported, and no other"**
  derives the expected key set from the fixtures rather than restating it, and
  asserts the set is 8 so the row cannot pass vacuously if a fixture is thinned.
- **"an item no frame reported is absent from the merged page, not present and
  empty"** pins the property most at risk from this change: every key is now
  *mentioned*, so if `present` ever stopped stripping `undefined` the merge
  would start shipping `dialogs: undefined` and `armPending: undefined`. Absent
  and empty are different facts throughout this contract.

The division of labour is stated in the test file: the compiler owns "no key is
forgotten"; these rows own what a compiler cannot see.

## The mutation proofs

Four mutations, each reverted and each verified byte-identical by `diff`. The
two contract mutations were made to `domain/src/page-evidence/types.ts`, which
the brief allowed temporarily; it is byte-identical to how I found it and
`git status` shows the whole `domain/src/page-evidence/` directory in the same
state as before.

### Proof 1 — a renamed write key, before and after

`mergeDialogEvidence` writes the contract's `armPending`. Renaming the *written*
key (the read `dialogs.armPending` beside it stays correct, which is exactly the
accident that used to give partial cover):

**Before**, under the conditional spread:

```
BEFORE-armPending-check-exit=0
BEFORE-armPending-test-exit=0
# tests 249 # pass 249 # fail 0
```

Nothing. No compiler error, no failing test. The field simply stops arriving on
every multi-frame page.

**After**, under `present<DialogEvidence>`:

```
src/background/connection/dom-snapshot.ts(360,5): error TS2353: Object literal may only
specify known properties, and 'armDeferred' does not exist in type
'RequiredFields<WebAutomationDialogEvidence> & OptionalFields<WebAutomationDialogEvidence>'.
```

Extension `check` **exit 2**.

I ran a second rename first — `submit` in the forms restatement — and report it
because it complicates the story honestly: `check` was **exit 0** there too, but
one runtime row failed (`not ok 15 - a child frame's selectors are qualified by
the frame`), because a test happened to assert that qualified selector. So the
old code was not uniformly silent; it was silent wherever no test had thought to
look, which is every key a test does not name. `armPending` is one of those.

### Proof 2 — a deleted key

The `armPending:` line removed entirely from the merge. This is the way a field
leaves the wire that no ordinary shared type can catch, because absence is what
optional means:

```
src/background/connection/dom-snapshot.ts(357,34): error TS2345: Argument of type
'{ open: DialogEvidenceItem[]; modal: boolean; lastNative: NativeDialogEvidence | undefined; }'
is not assignable to parameter of type 'RequiredFields<WebAutomationDialogEvidence> &
OptionalFields<WebAutomationDialogEvidence>'.
  Property 'armPending' is missing in type '{ … }' but required in type
  'OptionalFields<WebAutomationDialogEvidence>'.
```

Extension `check` **exit 2**. The merged page still ships without an
`armPending` key when no frame armed one — that is the second new test row.

### Proof 3 — a field added to the contract. This is the one that matters.

`scrolling?: { containerSelector: string; atBottom: boolean } | undefined` added
to `WebAutomationPageEvidence`.

**Before.** Extension `check` exit 2, and the entire extension error list was:

```
src/content/evidence/page.ts(47,32): error TS2345: … is not assignable to parameter of type
'RequiredFields<WebAutomationPageEvidence> & OptionalFields<WebAutomationPageEvidence>'.
```

**Zero errors named `dom-snapshot.ts`** (`grep -c` returns 0). The first
producer — protected last week — stops the build and demands the new field. The
merge says nothing, and would have produced it per frame and dropped it from
every merged page. A single-frame fixture would have shown it working.

**After.** The same contract field, the same command:

```
src/background/connection/dom-snapshot.ts(216,32): error TS2345: … 'RequiredFields<WebAutomationPageEvidence> & OptionalFields<WebAutomationPageEvidence>'.
  Property 'scrolling' is missing in type '{ … }' but required in type 'OptionalFields<WebAutomationPageEvidence>'.
src/background/connection/dom-snapshot.ts(325,32): error TS2345: … (same, at mergePageEvidence)
src/content/evidence/page.ts(47,32): error TS2345: … (the first producer, as before)
```

Line 216 is `frameEvidenceInTopFrameTerms`, line 325 is `mergePageEvidence`.
Both now demand a decision.

One honest note on that run: with the field added and unhandled, **the extension
unit suite was still exit 0, 249 of 249** — the test runner bundles with esbuild
and never type-checks. `check` is the only gate that says anything here, which
is why the before-half's silence in `check` was total silence.

### Proof 4 — output equivalence

A temporary test dumped `JSON.stringify` of the merged evidence for the
two-frame fixture (all eight keys, a child frame restated and qualified, rects
translated), run against the original file and against mine.

```
md5  51538f9119d1e79111459e6b6d788f5b  json-mine
md5  51538f9119d1e79111459e6b6d788f5b  json-orig
```

Byte-identical, 1,317 bytes. The temporary test was removed and the file
verified byte-identical to my shipped version by `diff`.

## What I had to think about, and what I refused to invent

The brief said to stop rather than invent a merge rule. I invented none: every
one of the eight page-level keys already had a rule from `w3-evidence-seams`,
and I kept each — additive items fold, `loading.documentState` and `navigation`
stay the top frame's because there is no honest merge of two documents. Writing
`documentState: anchor.loading.documentState` as a named key rather than letting
it ride on a spread actually makes that decision visible at the write site,
which it was not before.

What the enumeration *did* force were four item-level questions the blanket
spreads had been answering implicitly. None is a merge rule; each is "does this
field mean the same thing in the top frame's terms?", and I answered each the
way the old code happened to behave, now on purpose:

- **`repeating[].fields`** — test ids found inside the representative item.
  These name fields, they are not selectors, so they pass through unqualified.
  Qualifying them would have been wrong and the old `...structure` got the right
  answer by accident.
- **`dialogs.armPending` and `dialogs.lastNative`** — statements about the
  frame's own document with no selector in them; passed through.
- **`navigation` and `elements`** on a *child* frame's restatement — passed
  through whole, and then discarded and summed respectively by the merge. This
  is the pre-existing shape; the restatement is not the place that decides it.
- **`forms[].controls[]` fields** (`autocomplete`, `sensitive`, `hasValue`, …) —
  page data, passed through, only `selector` qualified.

## Is that the last one?

**Yes, for producers.** I looked rather than assumed: a grep across
`apps/extension/src`, `domain/src` and `packages/` for every evidence type name,
minus tests, gives 40 files, and exactly two of them *construct* a
`WebAutomationPageEvidence`:

- `apps/extension/src/content/evidence/page.ts` — closed by `v-producer-safety`.
- `apps/extension/src/background/connection/dom-snapshot.ts` — closed here.

Everything else is a reader or something else entirely. The `WebLlmPageEvidence`
names in `domain/src/runtime/llm-evidence/` and `reusable-evidence*.ts` are the
sanitized packet, a different shape downstream of the wire.
`domain/src/recording/web-state/evidence/*` declares the contract only as an
input type. `domain/src/page-evidence/capture.ts` is checked-in capture data
typed as `Record<…, WebAutomationPageEvidence>`, so a rename breaks it, and an
optional field legitimately absent from a real capture is data, not a defect.

So the claim `v-producer-safety` could only make of one producer is now true of
both: a renamed, deleted or added contract field fails to compile in every place
page evidence is written.

What still gets through, unchanged by me and worth keeping on the list:

- **A new conditional spread written tomorrow.** Nothing mechanically forbids
  one, in either producer. `v-producer-safety`'s proposed structure-audit rule —
  `ts.isSpreadAssignment` inside a configured directory, written in Core and
  mirrored down — is still the only thing that would close it, and it would now
  need to cover this file as well as `content/evidence/`.
- **A field the contract declares that nobody reads.** Producers must write it;
  no compiler makes a consumer consume it.
- **A value that is wrong rather than missing.** Only the browser harness says
  whether a selector resolves or a rect is on the right page.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=v-merge-safety` and
`DOMAIN_TEST_BUILD_LABEL=v-merge-safety` on every package command. Every exit
status captured by redirecting to a file and echoing `$?`, never through a pipe.
**No `pnpm build`, no `pnpm lab`, no `pnpm structure:baseline`, no root
`pnpm check`, no `test:content`.**

- `pnpm --filter @fluxiq-web-extension/extension check` → **exit 0**, no
  diagnostics. Run nine times; every non-zero run in between was a deliberate
  mutation, all quoted above.
- `pnpm --filter @fluxiq-web-extension/extension test` → **exit 0**,
  `# tests 249 # pass 249 # fail 0`. The two new rows observed green by name:
  `ok 24 - the merged page carries every item some frame reported, and no other`
  and `ok 25 - an item no frame reported is absent from the merged page, not
  present and empty`. Baseline before my change was 247.
- `pnpm --filter @fluxiq-web-extension/domain check` → **exit 0**.
- `pnpm --filter @fluxiq-web-extension/domain test` → **exit 0**,
  `# tests 310 # pass 310 # fail 0`, unchanged.
- `node scripts/structure-audit.mjs` with `GIT_INDEX_FILE` pointed at a copy of
  `.git/index` plus `git add -A -N .`, run five times across the change.
  `md5sum .git/index` identical before and after every run, so the real index
  was never written.
  - Before my change: **exit 1**, 2 violations, both `[working-docs]`
    (the plan document at 858 lines, and `docs/working/README.md` out of date),
    32 warnings.
  - After: **exit 1**, 3 violations, 32 warnings. The added violation is the
    `[imports]` line quoted above. `diff` of the two outputs shows the 32
    warnings are byte-identical and that one line is the only change. Reran per
    the wave rule; identical. Neither `working-docs` row is mine — both predate
    my first edit, and fixing them needs `pnpm structure:baseline`, which
    workers may not run.
  - With remedy A probed in: **the `[imports]` row is gone**, leaving only the
    two `working-docs` rows.
- `node <scratch>/vms-bundle-size.mjs` — calls the extension build's own
  exported `bundleExtensionEntry("background", <scratch dir>)`, which writes
  only into the directory it is given and never touches `dist/` or `build/`.
  Three measurements: 223,718 B before my change, 224,870 B shipped
  (**+1,152 B, +0.5 %** for the enumerated literals and `present`'s nine-line
  runtime), 244,126 B under remedy A.
- Four mutations, all reverted, all verified by `diff`:
  `dom-snapshot.ts` byte-identical to my shipped version,
  `domain/src/page-evidence/types.ts` and
  `apps/extension/src/content/evidence/index.ts` byte-identical to how I found
  them, and `git status --porcelain` on `content/evidence/index.ts` reports
  nothing.
- File length: `dom-snapshot.ts` is 398 lines against the audit's 400-line
  advisory threshold. I trimmed comments and packed short contract literals onto
  shared lines to stay under it, since I cannot split the file without widening
  ownership. Two lines of margin is thin: the next change to this file will
  probably have to split it, and the honest reason is that a per-key restatement
  of a nine-shape contract is simply longer than a blanket spread.

## Not verified

- **No browser validation.** Nothing here was exercised in a real browser. The
  merge runs in the service worker on the recording path, and
  `e2e/content/tests/evidence.spec.ts` is the gate that would catch a behaviour
  regression; I did not run it and do not own it. The byte-identical JSON over a
  fixture and the green real-capture suite in `page-evidence-capture.test.ts`
  are the strongest evidence I have, and they are Node, not Chrome.
- **Output equivalence is proven for one two-frame fixture**, not for every
  input shape. It exercises all eight keys, a qualified child frame and a
  translated rect, and the three real captures in
  `domain/src/page-evidence/capture.ts` go through the same code in
  `page-evidence-capture.test.ts` and still pass `assert.deepEqual`. Beyond
  that the equivalence rests on inspection of each converted site.
- **Remedy B's bundle figure is inferred, not measured.** It equals the shipped
  deep-import measurement by construction — the background entry pulls
  `present.ts` alone either way — but I did not move the file to confirm it.
- **`apps/extension/build/` and `domain/.test-build/` were not regenerated**,
  for the reason every worker this wave has given: it means running without a
  label and racing the other workers.
- **Nothing committed.** Two other workers were editing this tree throughout;
  the two `working-docs` audit rows are theirs or the supervisor's, and I
  reran to confirm they are not mine.

## Open questions or contradictions found

- **The import needs a decision, and it is the only thing standing between this
  change and a clean audit.** Remedy A is one line and costs 19 KB in the
  service worker. Remedy B costs nothing and touches nine files in a directory
  the brief called settled. My own reading is that B is the better shape —
  `shared/` is already the seam this exact consumer uses for the evidence types,
  and the writer belongs beside them — but it is a bigger edit than a worker
  should make unasked, and it partly reopens a question `v-wire-contract`
  answered about where `present` should live.
- **`present<T>` turned out to be the exhaustiveness mechanism, not just the
  spread fix.** The brief expected these to be two jobs. They are one, because
  `EvidenceFields<T>` already requires every key to be mentioned. Worth
  recording in the plan, because the same helper will close the same hole
  anywhere else a contract type is built by hand.
- **`v-producer-safety`'s characterisation of this file was accurate in every
  particular** — 13 spreads, the two shadowing `present` locals, the
  `boundsOrNone` restatement, and the judgement that renames were caught only by
  the accident of an adjacent read. The one thing it could not know is that the
  accident does not hold for `armPending`, which is read and written in the same
  clause and still renamed silently. Reading a key does not protect writing it.
- **The 400-line advisory is now binding on this file.** It sits at 398 and the
  next feature will cross it. The natural split is the frame-restatement half
  from the capture-and-merge half, which would also give the merge its own home
  and a shorter file to reason about. That is a supervisor's call about
  ownership, not something to do inside a safety change.
- **A structure-audit rule banning object spreads in evidence producers would
  make this mechanical rather than conventional**, as `v-producer-safety` said.
  It would now need to name two directories. Given this repository's stated
  preference for checks that fail the build over written guidance, and given
  that this is the fourth time the same class of defect has been found by hand,
  it seems worth someone's hour.
