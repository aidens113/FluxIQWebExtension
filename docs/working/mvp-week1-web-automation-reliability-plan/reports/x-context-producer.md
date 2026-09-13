# Report: x-context-producer

Worker: `x-context-producer`. Converting `content/identity/context.ts` to build
`DomElementContext` through `present<T>()`, and closing the third of the three
defects found on the `context` signal's path today.

## Outcome

**Done.** The producer is converted, and the protection is proven in both
directions on this file rather than on a copy of it: the two mutations are hard
compile errors now, and the **same two mutations against the pre-conversion file
compile cleanly**. The defect was live, not theoretical, and the proof of that is
quoted below.

Validation, every exit status captured by redirecting to a file and echoing `$?`,
never a pipe. `EXTENSION_TEST_BUILD_LABEL=x-context-producer`, lowercase, on
every package command:

- Extension `check` **exit 0**.
- Extension `test` **exit 0**, `# tests 294 # pass 294 # fail 0` (288 before; my
  six new rows green by name, `ok 174` through `ok 179`).
- Content harness `test:content --workers=4` **exit 0**, `201 passed, 1 skipped
  (27.5s)`. The first run was `1 failed`; that failure and why it is not mine are
  in [Commands run](#commands-run-and-observed-results).
- `node scripts/structure-audit.mjs` **exit 0**, `passed (33 warning(s), 17
  baselined)`, **zero** `FAIL` lines and no line of any severity naming either of
  my files.
- No `pnpm build`, no `pnpm lab` of any kind, no `pnpm structure:baseline`, no
  root `pnpm check`. `.structure-baseline.json` untouched. Nothing committed.

Two things below are worth reading past the mechanics: the harness turns out to
give this change **real browser coverage of every field I touched**
([What the harness actually proves](#what-the-harness-actually-proves)), and
`x-present-hole`'s count of the duplicated runtime is one short — there are
**three** `compactObject`s, not two
([Two helpers, or five](#while-i-was-there-two-helpers-or-five)).

## What changed and why

`apps/extension/src/content/identity/context.ts`, +31/-14.

Before, the eight-key wire value was assembled by a spread into a helper that
infers its type parameter from its argument:

```ts
const context = compactObject({
  ...formContext(element),
  fieldsetLegend: fieldsetLegend(element),
  ...
});
```

Nothing in that expression is checked against `DomElementContext`.
`compactObject` reads `T` off the literal, and `formContext` restated three of
the contract's key names in a hand-written return type, so the contract and the
producer agreed only by coincidence. After:

```ts
const form = owningForm(element);
const context = present<DomElementContext>({
  formId: formAttribute(form, "id"),
  formName: formAttribute(form, "name"),
  formAction: formAttribute(form, "action"),
  fieldsetLegend: fieldsetLegend(element),
  landmark: nearestLandmark(element),
  heading: nearestHeading(element),
  listPosition: listPosition(element),
  tablePosition: tablePosition(element)
});
```

Three changes, each with a reason:

1. **The spread is gone, and with it the hand-written key names.** `formContext`
   returned `{ formId?; formName?; formAction? }` — three contract names written
   a second time, in a type nothing joins to the contract. It is now
   `owningForm`, which returns the `Element` and names no field, plus
   `formAttribute(form, name)`, which reads one bounded attribute and answers
   `undefined` when there is no form. The three keys are now written exactly
   once, in the literal `present` checks.
2. **The nested `tablePosition` is converted too.** It had its own
   `compactObject` over its own restated shape, and its `columnHeader` is
   optional — the same defect one level down. It is now
   `present<NonNullable<DomElementContext["tablePosition"]>>`, and mutation 3
   below shows that key is now held in place as well.
3. **`listPosition` and `tablePosition` return the contract's own slice**
   (`DomElementContext["listPosition"]`) instead of a restatement. No `present`
   is needed for `listPosition`: both its keys are required, so its literal is
   already excess-checked against the return type and a deletion is already an
   error. The change removes the duplicate spelling, not a hole.

**The runtime output is unchanged, and that is the point of the conversion, not
a side effect.** `present` and `compactObject` build identically — drop the
`undefined`s, keep the literal's key order. Where there was no form, the old code
spread `{}` and produced no form keys; the new code writes three `undefined`s and
drops them. Same keys, same order, same JSON.

`apps/extension/src/content/identity/tests/context.test.ts` is new, 101 lines, six
rows. It exists for the half a compile-time guarantee cannot state: that the
conversion changed no byte of the value. The rows pin the two form paths
(`form="id"` association and `closest("form")`), bounded legend text, key order,
and — the one that matters most on an all-optional type — that an unset field is
**absent** rather than present with value `undefined`. `deepStrictEqual` compares
key sets, so `{ formName: undefined }` fails those rows; it would satisfy the
contract type, satisfy `check`, and put a null-valued field on the wire.

## Proving it, and proving it was worth doing

Four mutations. Each was applied to a byte copy, `check` was run, and the file
was restored **from a copy taken before the mutation** — never `git checkout --`,
per `x-present-hole`'s finding. Every restore is verified by `md5sum` and `diff`
against that copy; the file's final hash is `716ab677…`, identical to the
pre-mutation snapshot.

### 1. A renamed field is now an error

`landmark:` renamed to `landmarc:` in the live call. Extension `check`
**exit 2**:

```
src/content/identity/context.ts(58,5): error TS2561: Object literal may only specify known properties, but 'landmarc' does not exist in type 'RequiredFields<DomElementContext> & OptionalFields<DomElementContext>'. Did you mean to write 'landmark'?
```

### 2. A deleted field is now an error

`heading:` removed. Extension `check` **exit 2**:

```
src/content/identity/context.ts(53,46): error TS2345: Argument of type '{ formId: string | undefined; ... }' is not assignable to parameter of type 'RequiredFields<DomElementContext> & OptionalFields<DomElementContext>'.
  Property 'heading' is missing in type '{ formId: string | undefined; ... }' but required in type 'OptionalFields<DomElementContext>'.
```

This is the half nothing else in the repository can catch. Every key of
`DomElementContext` is optional, so a producer that forgets one still returns a
valid `DomElementContext`; no reader, no type and no test can tell a page that
has no heading from a producer that stopped looking for one.

### 3. The nested shape is held too

`columnHeader:` renamed to `columnHeadr:` inside `tablePosition`. Extension
`check` **exit 2**:

```
src/content/identity/context.ts(167,5): error TS2561: Object literal may only specify known properties, but 'columnHeadr' does not exist in type 'RequiredFields<{ row: number; column: number; columnHeader?: string | undefined; }> & OptionalFields<{ row: number; column: number; columnHeader?: string | undefined; }>'. Did you mean to write 'columnHeader'?
```

### 4. The control: both mutations were silent before

A compile error proves the new code rejects the mutation. It does not prove the
old code accepted it, and that is the claim the conversion rests on. So I applied
the **same two mutations to the pre-conversion file**, with my new test file in
place:

| Mutation, applied to the pre-conversion file | `check` |
| --- | --- |
| `heading:` deleted | **exit 0** |
| `landmark:` renamed to `landmarc:` | **exit 0** |

Both compile. The renamed one is worse than it looks: `compactObject` infers `T`
from the argument, so `landmarc` becomes part of the inferred type, and assigning
the *variable* `context` to the declared return type is not excess-checked — only
fresh literals are. The field would have left the wire, `check` would have been
green, `test` green, and both readers would have gone on compiling against a
`landmark` no producer sends. That is defect 3 of the three found on this
signal's path today, reproduced in the file it lives in.

### 5. The new test rows have teeth

An ordering assertion that cannot fail is decoration, so I mutated the key order
too. Swapping `formAction` with `fieldsetLegend` did **not** fail — correctly, as
neither key is present in that fixture. Moving `formName` below `fieldsetLegend`
did, **exit 1**:

```
not ok 178 - the keys keep the contract's order, with the absent ones simply gone
    + actual - expected
      [
    +   'fieldsetLegend',
    +   'formName'
    -   'formName',
    -   'fieldsetLegend'
      ]
```

Restored; `293 pass` at that moment, `294 pass` after.

## What the harness actually proves

I expected the content harness to be a bare regression check. It is better than
that: `e2e/content/tests/identity.spec.ts` asserts the output of this exact
function in a real Chromium page, field by field, and every field I touched is
covered.

| Assertion in the harness | What it covers of this change |
| --- | --- |
| `context: { formId: "settings-form", landmark: "region", heading: "General" }` | `formAttribute(form, "id")`, and two untouched signals |
| `expect(save.context?.formName).toBeUndefined()`, and the same for `formAction` | **the exact regression this refactor could have caused** — `formAttribute` returning `undefined` for an attribute the page never set, and `present` dropping the key rather than emitting it |
| `context: { fieldsetLegend: "Preferred contact method", landmark: "form", … }` | the legend path |
| `context: { listPosition: { index: 9, total: 12 } }` | `listPosition`'s retyped return |
| `context: { tablePosition: { row: 1, column: 2, columnHeader: "Category" } }` | the **nested `present`**, including the optional `columnHeader` |

All green, in a browser, at `201 passed`. The claim that the value is
byte-for-byte what it was is therefore measured on a real page, not only argued
from the two helpers' bodies.

## While I was there: two helpers, or five

`x-present-hole` reported four copies of this runtime idea. **There are five**,
because a third `compactObject` is private to a module and does not appear in a
search for the import:

| File | Type-checks the literal | Note |
| --- | --- | --- |
| `apps/extension/src/shared/present.ts` | **yes** | `x-present-hole` |
| `domain/src/runtime/llm-evidence/present.ts` | **yes** | `p-llm-spreads`; no keyless clause |
| `apps/extension/src/content/compact-object.ts` | no | exported |
| `apps/extension/src/background/connection/value-readers.ts` | no | body byte-identical to the row above |
| `apps/extension/src/runtime/result-mapping.ts:75` | no | **module-private**, same body, no `export` |

The three `compactObject` bodies are one line each and identical:

```ts
return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
```

`md5` of the exported two, declaration line included, is the same
(`85188fa3…`); the third differs from them by the absent `export` keyword and
nothing else.

**Can the `compactObject`s now be one? Yes — and it is the easier of the two
consolidations, because none of them has a type-checking claim to protect.**
Unlike the two `present`s, no boundary forces this duplication: all three are in
`apps/extension/src`, and the content and background bundles already share
`src/shared/`.

**Where it would live: `apps/extension/src/shared/`, beside `present.ts`.** That
is the directory both bundles already import from, and it is where the honest
statement of the pair belongs — `compactObject` is what `present` does *without*
the check, and the two sitting together is the clearest way to say that a caller
assigning to an already-typed target may use one while a caller writing a
contract must use the other. `value-readers.ts` would re-export it if the
background barrel's shape matters; `result-mapping.ts` would import it and delete
its private copy.

One caveat for whoever does it, which is `x-present-hole`'s point 3 and still
true: `apps/extension/src/shared/` has **no `index.ts`**, against `AGENTS.md`'s
barrel rule, and every `present.ts` importer reaches past it by path — with
`context.ts` there are now **twelve**, eleven of them spelled
`../../shared/present`. Adding a thirteenth path import is the wrong moment;
adding the barrel in the same change is the right one.

I have **not** performed either consolidation, per the brief.

## The domain sibling's missing clause — reported, not fixed

`domain/src/runtime/llm-evidence/present.ts:102` is the whole guard:

```ts
type PacketFields<T> = [T] extends [ContractTypeNotGiven] ? never : NoInfer<RequiredFields<T> & OptionalFields<T>>;
```

It has the default-brand clause and **not** the `[keyof T] extends [never]`
clause the extension's helper gained. So `present<{}>(...)` and
`present<object>(...)` are accepted there, and a literal is excess-checked
against neither — the call type-checks nothing at all while looking exactly like
a checked one. The fix is one clause, copied from
`apps/extension/src/shared/present.ts`, plus the two `@ts-expect-error` rows that
pin it. **Not fixed**: `domain/**` is outside my Owns and a worker may still be
in that directory.

## Commands run and observed results

Every command below was run with `EXTENSION_TEST_BUILD_LABEL=x-context-producer`
and its exit status captured by redirect and `echo $?`. No pipes.

- `pnpm --filter @fluxiq-web-extension/extension check` — run eight times.
  **exit 0** at baseline and finally; the five failures between were the four
  deliberate mutations and the controls, all quoted above.
- `pnpm --filter @fluxiq-web-extension/extension test` — **exit 0**,
  `# tests 294 # pass 294 # fail 0`. My rows, green by name:
  `ok 174 - a form-associated control reports the form that owns it`,
  `ok 175 - a control inside a form reports it too, found by walking up`,
  `ok 176 - a form attribute the page never set leaves its key out, not undefined`,
  `ok 177 - the fieldset legend is reported as bounded text`,
  `ok 178 - the keys keep the contract's order, with the absent ones simply gone`,
  `ok 179 - an element with nothing around it has no context at all`.
- `pnpm --filter @fluxiq-web-extension/extension run test:content --workers=4` —
  first run **exit 1**, `1 failed … 200 passed`; second run **exit 0**,
  `201 passed, 1 skipped (27.5s)`.
- `node scripts/structure-audit.mjs` — **exit 0**,
  `structure-audit: passed (33 warning(s), 17 baselined)`, `FAIL` count **0**,
  and no line naming `identity/context.ts` or `identity/tests/context.test.ts`.
- `git status --porcelain apps/extension/src/content/identity/` — during the run
  my two files were `M context.ts` and `?? tests/context.test.ts`. The other
  modified files in that directory (`candidates.ts`, `score.ts`, `veto.ts`,
  `index.ts`, `tests/veto.test.ts`) are other workers' and I did not touch them.

**Both of my files were committed while I worked, and not by me.** `git status`
went clean for them near the end of the run; the cause is not the stat cache but
commit `ab736a1` ("Live validation: what the green gates were actually
measuring"), which HEAD moved to at 19:07 and which swept them up. I ran no git
command that writes. What was committed is exactly what I validated:
`git diff HEAD` is empty for both files, and `git show HEAD:…/context.ts`
`diff`s byte-identical to the working copy at `md5 716ab677…`, the same hash as
the pre-mutation snapshot. Worth flagging only so the supervisor knows the
mutation proof and the harness run were performed against the bytes that landed
in that commit, not against something later restored over them.

### The one harness failure, and why it is not mine

First run: `e2e/content/tests/evidence.spec.ts:241 › infinite-feed: forms are not
invented where the page has none`, and the message is

```
Tearing down "openHarness" exceeded the test timeout of 30000ms.
```

Not an assertion — a **fixture teardown timeout**, at 30.2s against a suite whose
whole second run took 27.5s. Its subject is `content/evidence/forms.ts`, which I
did not touch, and its route to my change is nil: the row asserts that no form
evidence is invented, and `elementContext` is not in the form-evidence path.
`find -newermt -90min` lists roughly thirty files edited by other workers in that
window. It passed on the rerun, with the same bytes on disk. Recorded rather than
waved away, since it did cost a run.

### One test-authoring detail worth passing on

My six rows failed on their first run — all six, with
`TypeError: Cannot read properties of undefined (reading 'toLowerCase')` from
`landmarkRole`. The stub element I wrote had every member `context.ts` reads
**except `tagName`**, which `landmarkRole` reaches for before anything else. The
failure names `context.ts:112` rather than the test, so it reads at a glance like
a defect in the module under test. It was not; it was an incomplete stub, and the
distinguishing evidence is that the same six rows were the only failures. The
stub now hands back `"DIV"` uppercase, as a real element does, so the
`.toLowerCase()` in the rule is exercised rather than bypassed.

## Not verified

- **No manual browser session.** The content harness runs real Chromium and
  covers every field of this function (table above), which is stronger than a
  smoke test, but I opened no browser myself and loaded no unpacked extension.
- **Firefox was not run.** `test:content` is the Chromium content harness. This
  change touches no browser API, no manifest and no permission, so there is no
  mechanism by which the two could differ — but that is an argument, not a run.
- **`domain` `check` and `test` were not run.** I changed nothing there.
- **The `present<{}>` gap in the domain sibling is reported, not fixed, and not
  reproduced.** I read the guard; I did not write a probe against it, because the
  file is not mine to add a test to.
- **The consolidation of the three `compactObject`s is recommended, not
  performed**, per the brief. My claim that they are identical is checked
  (`md5` of the bodies); my claim about where it should live is a judgement.
- **`apps/extension/build/` was not regenerated** — that means running without a
  label and racing the other workers.
- **Root `pnpm check`, `pnpm build` and every `pnpm lab` command were not run**,
  per the brief. `pnpm structure:baseline` was **not** run, though the audit says
  `3 baseline entries can be lowered` — that is someone else's improvement to
  record, and recording it would take the whole repository's baseline with it.
- **Nothing committed.**

## Open questions or contradictions found

- **`DomElementContext` was the only known all-optional wire type, and it is now
  protected.** `x-present-hole`'s audit covered the fifteen types `present` is
  applied to plus this one as a control; it was not a sweep of every type in the
  repository. If another all-optional contract type exists and is written by
  hand, nothing will find it until someone runs that probe over the whole set.
  That probe is about ten lines, and it found this one.
- **The extension is still outside the `contract-spread` audit rule.**
  `content/identity/` had the last known live spread into a contract producer and
  no longer does, so `apps/extension/src/content/` is now clean by conversion,
  not by rule. Every argument `x-present-hole` and `p-spread-rule` made for
  pointing the rule at the extension still holds, and the cost of pointing it
  here just dropped, because there is nothing left to fix first.
- **The five copies are now the clearest structural debt in this area**, and the
  `compactObject` three are a delete-and-import away from being one. Worth doing
  while the reason is still written down.
- **`apps/extension/src/shared/` still has no barrel**, and the structure audit
  does not flag it — so either the rule is not enforced for that directory or it
  is baselined. Counted: twelve modules now import `present.ts` by path.
