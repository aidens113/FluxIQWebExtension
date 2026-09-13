# Report: x-present-hole

Worker: `x-present-hole`. Fixing the `present<T>()` guard that locked the helper
out of every all-optional type, auditing the modules it protects, and proving
the protection where it was previously impossible.

## Outcome

**Done.** The guard is fixed, the audit is machine-checked rather than read off
the types by eye, and both halves of the proof are quoted below.

The headline the brief was reaching for, and it is good news:

- **No call site was affected.** All fifteen contract types written through
  `present` today have at least one required key, proven by a type-level probe
  over every one of them, not by inspection. Nothing was worked around, and no
  call site is doing something other than it appears to. The guarantee
  `v-producer-safety` reported is real for all fifteen.
- **The hole was still live, one file away.** `DomElementContext` in
  `shared/protocol.ts` is all-optional, it is a wire contract type, and it is
  built today by `compactObject` over a spread in
  `content/identity/context.ts` — the exact pattern `present` exists to
  replace. It **could not have been converted** while the old guard stood. That
  is the concrete cost of the defect, and it is a call-site change in a file I
  do not own.

Validation, every exit status by redirect to a file and `echo $?`, never a pipe:

- Extension `check` **exit 0**.
- Extension `test` **exit 0**, `# tests 288 # pass 288 # fail 0` (286 before;
  my two new rows observed green by name, `ok 282` and `ok 283`).
- Content harness `test:content` **exit 0**, `201 passed, 1 skipped (35.9s)`.
- `node scripts/structure-audit.mjs` **exit 0**, `passed (33 warning(s), 17
  baselined)`, **zero** `FAIL` lines and no line of any severity naming either
  file I changed.
- `.structure-baseline.json` untouched; `pnpm structure:baseline` **not run**.
  No `pnpm build`, no `pnpm lab`, no root `pnpm check`. Nothing committed.

Two things below are not mechanical and are worth reading before the rest: the
guard is now **narrower** than the old one and I closed the one gap that
narrowing would otherwise have opened ([The trade](#the-trade-stated-and-then-closed)),
and there are now **four** copies of this runtime in the repository, two of them
byte-identical to each other ([Two helpers, or four](#while-i-was-there-two-helpers-or-four)).

## The fix

`apps/extension/src/shared/present.ts`. The guard was one line:

```ts
type EvidenceFields<T> = object extends T ? never : NoInfer<RequiredFields<T> & OptionalFields<T>>;
```

It is now two clauses, keyed on the type parameter's **default** as the domain
sibling does, plus one clause of my own:

```ts
declare const CONTRACT_TYPE_NOT_GIVEN: unique symbol;
type ContractTypeNotGiven = { [CONTRACT_TYPE_NOT_GIVEN]: true };

type EvidenceFields<T> = [T] extends [ContractTypeNotGiven]
  ? never
  : [keyof T] extends [never]
    ? never
    : NoInfer<RequiredFields<T> & OptionalFields<T>>;

export function present<T extends object = ContractTypeNotGiven>(fields: EvidenceFields<T>): T
```

The runtime body is **unchanged, byte for byte**. This is a types-only change,
which is why no output can move and why the content harness is a regression
check rather than a behaviour check.

`object` is assignable to any *weak* type — one whose keys are all optional — so
`object extends T` was true of every all-optional type as well as of the
un-named call it was aimed at. Keying on an unforgeable default fires when and
only when the caller named no type.

### The required property survived, and that is checked rather than claimed

The brief's constraint was that a bare `present()` must still be rejected. The
existing `@ts-expect-error` row for it is:

```ts
// @ts-expect-error - the type argument is not optional
present({ selector: "#invite", role: "dialog", modal: true, native: false, title: "A label" });
```

`check` is **exit 0** after the fix. An `@ts-expect-error` that stops being an
error is `TS2578: Unused '@ts-expect-error' directive`, so exit 0 *is* the proof
that this row — and all six others — still fire. The property did not survive by
my say-so; it survived because the build fails if it does not.

### The trade, stated and then closed

The new guard is strictly **narrower**. The old condition rejected three things,
and the brief was right to ask which of them I was giving up:

| Rejected by old guard | Still rejected | How |
| --- | --- | --- |
| A call naming no type argument | **yes** | `[T] extends [ContractTypeNotGiven]` |
| `present<object>` / `present<{}>` | **yes** | `[keyof T] extends [never]` |
| Any all-optional type | no — **this was the defect** | — |

The middle row is the trade, and it is the reason I did not simply adopt the
domain sibling's guard unchanged. A literal is excess-property checked against
neither `object` nor `{}`, so `present<{}>({ anything: "at all" })` type-checks
nothing whatsoever — it is the un-named call wearing a type argument, and the
old guard did catch it. The default-based guard alone would have let it through.
`[keyof T] extends [never]` is that clause and nothing else; it does not fire for
an all-optional type, which has keys.

So: nothing the old guard usefully caught is now uncaught, and I did not widen
until things compiled. Two new `@ts-expect-error` rows pin both spellings.

The domain sibling, `domain/src/runtime/llm-evidence/present.ts`, does **not**
have this clause and `present<{}>(...)` is accepted there. It is one clause and
it should gain it, but that file just landed and is outside my Owns.

## The audit: all fifteen types, machine-checked

The brief asked whether any contract type the helper is applied to is
all-optional. I did not read this off the type definitions — the whole point of
this task is that a guarantee established by reading is worth less than one
established by the compiler. A temporary probe asserted
`type IsAllOptional<T> = object extends T ? true : false` is `false` for every
type, so any all-optional type would fail to compile and name itself:

```
src/shared/tests/present.test.ts(257,7): error TS2322: Type 'false' is not assignable to type 'true'.
```

**Exactly one line errored**, and it was the control: `DomElementContext`, which
I included precisely because I expected it to be all-optional. The probe was
removed and the file verified byte-identical afterwards.

The eight producer modules the helper was applied to, with the required-key
counts extracted from `domain/src/page-evidence/types.ts` by script:

| Module | Contract type | Req | Opt | All-optional? |
| --- | --- | --- | --- | --- |
| `dialogs.ts` | `DialogEvidence` | 2 | 2 | no |
| `dialogs.ts` | `DialogEvidenceItem` | 4 | 2 | no |
| `forms.ts` | `FormEvidence` | 3 | 5 | no |
| `forms.ts` | `FormControlEvidence` | 2 | 7 | no |
| `loading.ts` | `LoadingEvidence` | 5 | 0 | no |
| `loading.ts` | `LoadingIndicator` | 2 | 1 | no |
| `navigation.ts` | `NavigationEvidence` | 5 | 3 | no |
| `overlays.ts` | `OverlayEvidence` | 3 | 0 | no |
| `overlays.ts` | `OverlayEvidenceItem` | 3 | 3 | no |
| `page.ts` | `PageEvidence` | 3 | 5 | no |
| `regions.ts` | `RegionEvidence` | 2 | 2 | no |
| `repeating.ts` | `RepeatingStructureEvidence` | 4 | 1 | no |
| `repeating.ts` | `RepeatingStructureEvidence["representative"]` | 1 | 2 | no |

The helper has since gained call sites beyond those eight, so I audited them
too rather than stopping at the brief's boundary:

| Module | Contract type | Req | Opt | All-optional? |
| --- | --- | --- | --- | --- |
| `background/connection/dom-snapshot.ts` | `SnapshotElementTotals` | 7 | 0 | no |
| `background/connection/gateway-payloads.ts` | `WireElementTarget` | 2 | 21 | no |

**Nothing was affected, so nothing was worked around.** There is no call site
where the author reached for a substitute, and none where the code does
something other than what it reads as. The eight modules' protection is exactly
what `v-producer-safety` claimed.

### Why it was inert, and why that is not reassuring

Every one of the fifteen is a page-evidence or wire type, and every page-evidence
type happens to carry at least one structural key — a `selector`, a `role`, a
count. That is a property of what this contract describes, not a rule anyone
wrote down or checks. The first contract type that is pure annotation would have
hit it, and the failure reads `not assignable to parameter of type 'never'`,
which points at the caller rather than at the helper.

`DomElementContext` is that type, and it already exists:

```ts
export type DomElementContext = {
  formId?: string | undefined;
  formName?: string | undefined;
  formAction?: string | undefined;
  fieldsetLegend?: string | undefined;
  landmark?: string | undefined;
  heading?: string | undefined;
  listPosition?: { index: number; total: number } | undefined;
  tablePosition?: { row: number; column: number; columnHeader?: string | undefined } | undefined;
};
```

It crosses the wire as `DomElementDescriptor.context`, and `elementContext` in
`apps/extension/src/content/identity/context.ts` builds it the old way:

```ts
const context = compactObject({
  ...formContext(element),
  fieldsetLegend: fieldsetLegend(element),
  ...
});
```

A spread of a fresh call's result, into a helper that infers `T` from its
argument. Rename `formName` on the contract and `formContext`'s hand-written
return type keeps it; delete a clause and the field leaves the wire in silence.
It is the exact defect, in a type with **no required key to hold any of its
names in place** — the shape most exposed, and the one the guard locked the fix
out of. I have not converted it: `content/identity/` is not in my Owns.

## Proving the protection, both directions

### 1. The defect, reproduced in this repository's own file

`p-llm-spreads` proved this by copying the extension's file into the domain. The
brief is right that a compiler error from a copy is not a surprising failure to
re-run, but it is also not a proof about *this* file. So I restored the old
guard line in `apps/extension/src/shared/present.ts` itself, with the new
`DomElementContext` rows in place. Extension `check` **exit 2**:

```
src/shared/tests/present.test.ts(271,44): error TS2345: Argument of type '{ formId: undefined; formName: undefined; formAction: undefined; fieldsetLegend: undefined; landmark: undefined; heading: undefined; listPosition: undefined; tablePosition: undefined; }' is not assignable to parameter of type 'never'.
src/shared/tests/present.test.ts(284,45): error TS2345: Argument of type '{ formId: undefined; formName: string; formAction: undefined; fieldsetLegend: undefined; landmark: string; heading: string; listPosition: undefined; tablePosition: { row: number; column: number; columnHeader: string; }; }' is not assignable to parameter of type 'never'.
src/shared/tests/present.test.ts(307,30): error TS2345: Argument of type '{ formId: undefined; formName: undefined; formAction: undefined; fieldsetLegend: undefined; landmarc: string; heading: undefined; listPosition: undefined; tablePosition: undefined; }' is not assignable to parameter of type 'never'.
src/shared/tests/present.test.ts(312,5): error TS2578: Unused '@ts-expect-error' directive.
```

**The fourth line is the part worth pausing on.** Under the old guard the
deletion row's directive became *unused* — the call had already failed as
`never`, so the honest `Property 'tablePosition' is missing` diagnostic never
appeared. The guard did not merely block the type; it **replaced the real error
with a meaningless one**, and the third line shows the same thing for the
rename: `landmarc` and `landmark` were rejected identically, so the compiler
could not tell you which one was wrong.

Reverted; `md5sum` back to the pre-mutation hash.

### 2. The protection, on the type where it was previously impossible

Guard restored to the fix. `landmark:` renamed to `landmarc:` in the live,
undirected `present<DomElementContext>` call. Extension `check` **exit 2**:

```
src/shared/tests/present.test.ts(289,5): error TS2561: Object literal may only specify known properties, but 'landmarc' does not exist in type 'RequiredFields<DomElementContext> & OptionalFields<DomElementContext>'. Did you mean to write 'landmark'?
```

A real diagnostic that names the field and suggests the fix, on a type that
twenty minutes earlier could not be passed to this helper at all.

Reverted. `md5sum` of both files matches the pre-mutation snapshots
(`412db9bf…`, `a770b42f…`) and `diff` against them reports byte-identical.

### 3. The guarantee is now asserted by every build

`apps/extension/src/shared/tests/present.test.ts` gains two runtime rows and
four `@ts-expect-error` rows, all live (exit 0 means none is unused):

- an all-optional type is **writable at all**, and `present<DomElementContext>`
  of eight `undefined`s is `{}` rather than a bag of undefined-valued keys. This
  row is the regression guard: restore `object extends T ? never` and it stops
  compiling, which is mutation 1 above.
- a set of values is kept in the literal's key order.
- renaming a field of an all-optional type is an error.
- deleting a field of an all-optional type is an error — the half nothing else
  can catch, and on this type *literally* nothing else can, since every key is
  optional and the value stays assignable however many the producer forgets.
- `present<{}>` and `present<object>` are errors — the trade above, pinned.

One mechanical detail cost a cycle and is worth recording, because two workers
have now hit it: TypeScript reports an **excess** property on the property's own
line and a **missing** one on the argument. A `@ts-expect-error` above a
multi-line call therefore covers the deletion row but not the rename row, which
gave `TS2578: Unused '@ts-expect-error' directive` on the first attempt. The
rename directive sits on the property; the comment beside it says why.

## While I was there: two helpers, or four

The brief asked about two. There are four.

| File | Type-checks the literal | Note |
| --- | --- | --- |
| `apps/extension/src/shared/present.ts` | **yes** | mine |
| `domain/src/runtime/llm-evidence/present.ts` | **yes** | `p-llm-spreads`; no keyless clause |
| `apps/extension/src/content/compact-object.ts` | no | infers `T` from the argument |
| `apps/extension/src/background/connection/value-readers.ts` | no | **byte-identical body to the previous row** |

The last two are the same three lines twice, in two directories, with no
difference at all — `diff` of the two function bodies is empty. That is the
sensitivity-rule pattern already at four copies, and two of them are a straight
unjustified duplication rather than a boundary-forced one.

**Should the two `present`s be one? Yes.**

**Where it would live:** the domain. `domain/src` may not import
`apps/extension/src` — `AGENTS.md`, enforced by the `imports` rule, and
`p-llm-spreads` measured the failure with a probe import rather than assuming
it. The extension may import the domain. So the dependency direction permits
exactly one home, and it is the domain side. Not
`domain/src/runtime/llm-evidence/`, which is one consumer; a shared domain home
reachable from the `./client` subpath.

**What the obstacle was, and why it has since dissolved.**
`v-producer-safety` put the helper in the extension for a specific, correct
reason: `present` is a **value**, not a type, so unlike the contract types it
cannot be erased at the boundary, and a value import of the domain from a
*content* module would pull the domain's node-facing modules toward the content
bundle. The narrower `@fluxiq-web-extension/domain/client` barrel was the
escape hatch and did not export what was needed.

That reason is no longer true, and I checked rather than assumed. Six content
source modules already value-import `domain/client` today:

```
apps/extension/src/content/action-runtime/resolve-target.ts
apps/extension/src/content/action-runtime/results.ts
apps/extension/src/content/actions/execute.ts
apps/extension/src/content/actions/page-identity.ts
```

(plus `identity/` test files and `evidence/tests/forms.test.ts`). The content
bundle already carries that barrel. `domain/package.json` declares `./client` as
a first-class subpath export. So the bundle objection that kept `present` in the
extension has been overtaken by other work in this same wave, and the
consolidation is now a matter of exporting one function from `domain/src/client`
and deleting two files.

**The remaining obstacles, honestly:**

1. `domain/src/client/gateway-mapping.ts` is owned by a live worker right now,
   and `domain/src/client/` is the next path queued for the `contract-spread`
   rule — which will want this helper as its third consumer. Consolidating
   under someone else's feet is how the merge conflict happens.
2. The two guards differ by my `[keyof T] extends [never]` clause. Whoever
   consolidates must take the union of the two, not pick one file and delete the
   other, or the keyless opt-out reopens silently.
3. `apps/extension/src/shared/` has **no barrel** (`index.ts`), against
   `AGENTS.md`'s "a barrel in every directory". Both `present.ts` importers
   reach past it by path. Worth fixing in the same change rather than adding a
   third such import.

**Recommended and not performed**, per the brief. My suggested order: promote to
`domain/src/client`, take the union of the guards, re-point the extension's
`present.ts` to a re-export (so the fifteen call sites do not move), then fold
the two `compactObject` twins — which are a separate and much easier win, since
they are identical and neither has a type-checking claim to protect.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=x-present-hole`, lowercase, on every package
command. Every exit status captured by redirecting to a file in the scratchpad
and echoing `$?`; no pipes. **No `pnpm build`, no `pnpm lab` of any kind, no
`pnpm structure:baseline`, no root `pnpm check`, nothing committed.**

- `pnpm --filter @fluxiq-web-extension/extension check` → run seven times.
  **exit 0** finally and at baseline; every failure between was a deliberate
  mutation or the directive-placement error, all quoted above.
- `pnpm --filter @fluxiq-web-extension/extension test` → **exit 0**,
  `# tests 288 # pass 288 # fail 0`. New rows green by name:
  `ok 282 - an all-optional contract type is writable, and absent stays absent`,
  `ok 283 - an all-optional type's fields are held in place by the compiler`.
- `pnpm --filter @fluxiq-web-extension/extension test:content` → **exit 0**,
  `201 passed, 1 skipped (35.9s)`. Checked its config and global setup before
  running: it builds into a run-scoped `.harness-build/run-<pid>-<ts>/`, touches
  neither `dist/` nor `build/`, and starts no server, so it cannot disturb the
  running Lab instances.
- `node scripts/structure-audit.mjs` → **exit 0**,
  `passed (33 warning(s), 17 baselined)`, `FAIL` count **0**, and `grep` for
  `shared/present` over the output returns nothing.
- One type-level probe over all sixteen candidate types, described above,
  removed and verified byte-identical.
- `git diff --stat` over my Owns: `present.ts` +66/−8, `present.test.ts` +106/−0.
  `apps/extension/src/content/evidence/` **untouched** — the fix needed no call
  site to change, which is itself the evidence that the guard was purely
  over-broad. `.structure-baseline.json` untouched.

### Two environment findings the next worker will want

**The extension test baseline was red when I started, for reasons that were not
mine, and it healed by itself.** My first `test` run was `# fail 1`
(`on a multi-frame page the recorded event carries the whole tab`, an element
ordering assertion in `background/connection/tests/recording-evidence.test.ts`).
Re-run once per the wave rule: `# fail 2`, having *gained*
`a page whose family the scan never reached says the scan was cut short`
in `content/action-runtime/tests/resolve-target.test.ts`. Both files were
modified within the previous thirty minutes by other workers; both failures were
gone by my final run, which is `# fail 0`. Not RAM, not mine, and worth knowing
that a red extension suite in this wave may simply be someone mid-edit — the
distinguishing evidence is `find -newermt`, not a re-run.

**Do not use `git checkout --` to revert a file in this repository.**
`core.autocrlf=true` and the committed blobs are LF, so a checkout rewrites the
working copy to **CRLF** — 230 lines of my test file, a whole-file diff for the
supervisor to read. Worse, `git status --porcelain` said the file was *clean*
both before and after, because the stat cache had not been invalidated; only
`git diff` re-read it. I reverted from a byte copy taken before each mutation
instead, and every revert in this report is verified by `md5sum` and `diff`
against that copy, not by `git status`. `v-producer-safety` and `p-llm-spreads`
both recorded "the repository is CRLF throughout"; at the blob level it is LF
throughout, and the files on disk in my Owns are LF.

## Not verified

- **No browser validation of the change, and none is meaningful.** This is a
  types-only edit: the nine-line runtime of `present` is unchanged byte for
  byte, so no value it produces can differ. The content harness was run and is
  green, which is a regression check on the producers that call it, not evidence
  about the guard.
- **`DomElementContext` is not converted, so the hole it represents is still
  open.** I proved the tool now works on it and pinned that with tests;
  `content/identity/context.ts` is not in my Owns and I did not touch it. Until
  someone converts it, `elementContext` can still lose a field silently.
- **The all-optional audit covers the fifteen types `present` is applied to
  today**, plus `DomElementContext` as a control. It is not a sweep of every type
  in the repository, so there may be other all-optional wire types that no
  producer writes through `present` yet.
- **The domain sibling was not changed.** It still accepts `present<{}>(...)`.
  Outside my Owns, and it just landed.
- **`domain` `check` and `test` were not run.** I changed nothing in the domain,
  and `domain/src` cannot import what I changed.
- **`apps/extension/build/` was not regenerated**, for the reason every worker
  this wave has given: it means running without a label and racing everyone.
- **Root `pnpm check` and `pnpm build` were not run**, per the brief.
- **Nothing committed.**

## Open questions or contradictions found

- **`content/identity/context.ts` needs a brief, and it is small.** One
  `compactObject` call and one `formContext` helper whose return type is a
  hand-written restatement of three contract keys. Converting it to
  `present<DomElementContext>` is now possible and is perhaps fifteen lines. It
  is the only known all-optional wire type and therefore the one with the least
  else holding its field names in place.
- **The `contract-spread` audit rule does not cover the extension.**
  `p-spread-rule` configured it for `domain/src/runtime/llm-evidence/`, and
  `domain/src/client/` is queued. `apps/extension/src/content/evidence/` has zero
  object spreads today by conversion, not by rule, so the fourteenth call site is
  protected by habit — `v-producer-safety` said as much and it is still true.
  `content/identity/` has a live one. Given this repository's stated preference
  for checks that fail the build over written guidance, the extension paths look
  like the cheapest remaining win in this whole area.
- **The two `compactObject` copies are byte-identical and neither has a reason.**
  Unlike the two `present`s, no boundary forces this one — both are in
  `apps/extension/src`. Whoever consolidates the helpers should take these at the
  same time; it is a delete-and-import.
- **`apps/extension/src/shared/` has no `index.ts`**, against `AGENTS.md`'s
  barrel rule, and the structure audit does not flag it. Either the rule is not
  enforced for this directory or it is baselined; either way the next person to
  add a file there will copy the omission.
- **A worker's report is a claim, and one in this chain was slightly off.** Both
  earlier reports state the repository is CRLF; the blobs are LF. Nothing depends
  on it, but it was about to make me hand over a 230-line phantom diff.
