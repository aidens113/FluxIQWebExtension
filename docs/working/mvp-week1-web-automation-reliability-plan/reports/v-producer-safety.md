# Report: v-producer-safety

Worker: `v-producer-safety`. Closing the producer-side half of the page-evidence
wire contract, so a producer that renames or drops a field fails to compile.

## Outcome

**Done, for the producer the brief named. One second producer exists, it has the
same hole, and it is not in my Owns.** That is the headline and it is in
[The honest limit](#the-honest-limit-there-is-a-second-producer) below, not
buried.

All thirty-three conditional spreads are gone from
`apps/extension/src/content/evidence/`. Every optional field is now written as a
plain property through a new `present<T>()` helper and checked against the
contract's key set.

- Extension `check` **exit 0**; extension `test` **exit 0**,
  `# tests 247 # pass 247 # fail 0`.
- Domain `check` **exit 0**; domain `test` **exit 0**,
  `# tests 310 # pass 310 # fail 0`.
- Structure audit through a scratch `GIT_INDEX_FILE`: **32 warnings, zero
  findings naming any file I touched**. Two `FAIL` lines appeared mid-session,
  both `working-docs`, both from another agent's edit to the plan document; see
  [Commands](#commands-run-and-observed-results).
- Three mutation proofs, all quoted, all reverted and verified byte-identical by
  `diff`.

The two properties the brief required:

1. **A rename fails to compile.** `v-wire-contract`'s exact mutation, `label` to
   `title` in `dialogs.ts`, is now `error TS2353` — quoted in full below.
2. **Optionality is preserved.** No field became required on the wire, nothing
   writes a default, and an absent value is still an absent key. A test asserts
   `"label" in dialog === false`, and a second test builds the same value both
   the old way and the new way and compares the JSON.

The design went one step past the brief's proposal, because a rename is only
half of how a field goes missing: **deleting** an optional field is now a
compile error too, without making the field mandatory on the wire. That is the
one design decision worth reading before the rest.

## The choice, and why it beat the alternatives

Three approaches were on the table. All three fix the rename; they differ on
what else they buy.

| Approach | Rename caught | Deletion caught | Absent stays absent | Cost |
| --- | --- | --- | --- | --- |
| Construct the whole object, no strip | yes | no | **no** — the key survives with an `undefined` value | none |
| A builder function per evidence item | yes | no | yes | 12 new functions, 12 new names |
| `present<T>()`, all keys mentioned | yes | **yes** | yes | 1 new file, 13 call sites |

**Constructing the whole object and letting excess-property checking do the
work** is the cheapest and it is what `present` does internally, but on its own
it leaves `{ label: undefined }` on the object. `JSON.stringify` drops that, so
the packet is unaffected — but structured clone does not, `"label" in item`
becomes true, and `deepStrictEqual` in the existing suites stops matching. The
contract distinguishes absent from empty deliberately (`armPending` and
`truncated` are both fields where the distinction is the whole point), so
leaving undefined-valued keys on the wire is exactly the erosion the truncation
work was about. Rejected on that, not on style.

**A `satisfies`-typed builder per evidence item** works and reads well at each
site, but it is twelve functions that must each be kept in step with the
contract, which is a smaller version of the restatement problem this seam
exists to end. Rejected.

**`present<T>()`** was `v-wire-contract`'s proposal and it is the one that
landed, with two additions of my own that the probes below justify.

### What `present` actually is

`apps/extension/src/content/evidence/present.ts`, one exported function:

```ts
type RequiredFields<T> = { [K in RequiredKeys<T>]-?: Exclude<T[K], undefined> };
type OptionalFields<T> = { [K in OptionalKeys<T>]-?: T[K] | undefined };
type EvidenceFields<T> = object extends T ? never : NoInfer<RequiredFields<T> & OptionalFields<T>>;

export function present<T extends object>(fields: EvidenceFields<T>): T;
```

Three things are load-bearing, and each was probed against the repository's own
compiler flags (`strict`, `exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`) before it went in.

- **`-?` on the optional half, with `| undefined` restored.** The key must be
  *mentioned* at the call site; its value may be `undefined`, and `present` then
  omits it from the result. Mentioned-but-empty is a statement; missing is a
  mistake. This is what makes a deleted field a compile error while leaving the
  field optional on the wire — the two halves of the brief's second requirement
  pulling in the same direction rather than against each other.
- **`NoInfer<T>` plus `object extends T ? never`.** Without them,
  `present({ ... })` with no type argument would infer `T` *from* the argument
  and check the literal against itself, which is the original silence in a new
  costume. With them, a call that does not name a contract type is
  `error TS2345: Argument of type '{...}' is not assignable to parameter of type
  'never'`. The helper cannot be opted out of.
- **`Exclude<T[K], undefined>` on the required half.** `present` strips
  `undefined`, so a *required* key given `undefined` would be silently removed
  and the returned `T` would be a lie. No contract type has such a key today;
  this is what keeps it that way, checked rather than assumed.

The runtime is nine lines: copy the entries whose value is not `undefined`, in
the literal's own key order.

### Why it lives in the extension and not beside the contract

`domain/src/page-evidence/` would have been the symmetric home — `wire.ts` is
how the contract is read, `present.ts` is how it is written — and both
directories are in my Owns, so it was a free choice.

It went in the extension anyway, for one concrete reason: `present` is a
**value**, not a type. Today the extension's only reach into
`@fluxiq-web-extension/domain` from content code is type-only, and
`v-wire-contract` measured that it is erased and costs the content bundle
nothing. A value import of the domain root barrel from a content module would
pull the domain's node-facing modules toward the content script, and the
narrower `domain/client` barrel does not export page evidence yet (that is the
one line `v-wire-contract` asked the supervisor to add, and it is not in my
Owns). Producing evidence is the extension's job; only the shape is shared.

`domain/src/page-evidence/types.ts` gained a paragraph pointing at it, because
that file's header claimed the shared type made a producer's rename a compile
error, and until today that was true only for required fields.

### The `compactObject` that was already here

`apps/extension/src/background/connection/value-readers.ts` has
`compactObject<T extends Record<string, unknown>>(value: T): T` — runtime
behaviour identical to `present`, used at ten sites. It is **not** a substitute
and it is not wrong: it infers `T` from its argument, so it compacts correctly
and type-checks nothing. Its callers assign the result to a typed target, which
is a different guarantee. Worth knowing before someone folds the two together
and quietly loses the check; the difference is the explicit type argument, and
that is the entire point of `present`.

## What changed

Eight producer modules, thirty-three conditional spreads, thirteen `present`
call sites. `changes.ts` and `interactions.ts` construct no evidence object —
one mutates descriptors, the other keeps an element ledger — so eight is the
complete set, not a sample.

| Module | Spreads removed | `present` sites | Contract types written |
| --- | --- | --- | --- |
| `dialogs.ts` | 4 | 2 | `DialogEvidence`, `DialogEvidenceItem` |
| `forms.ts` | 12 | 2 | `FormEvidence`, `FormControlEvidence` |
| `loading.ts` | 1 | 2 | `LoadingEvidence`, `LoadingIndicator` |
| `navigation.ts` | 3 | 1 | `NavigationEvidence` |
| `overlays.ts` | 3 | 2 | `OverlayEvidence`, `OverlayEvidenceItem` |
| `page.ts` | 5 | 1 | `PageEvidence` |
| `regions.ts` | 2 | 1 | `RegionEvidence` |
| `repeating.ts` | 3 | 2 | `RepeatingStructureEvidence` and its `representative` |

A grep for `...` across the directory now returns only array spreads
(`[...form.elements]`, `[...found.values()]` and four more) and two lines of
prose inside `present.ts`'s own header. Zero object spreads remain.

Two details worth recording:

- **Every truthiness guard was preserved exactly.** `...(label ? { label } : {})`
  became `label: label || undefined`, not `label`. `accessibleNameFor` and
  `boundedText` can return `""`, and the old code dropped an empty label;
  passing the value straight through would have started sending `label: ""`.
  `present` itself keeps `""` — dropping it is the producer's decision and now
  reads as one. A test pins both halves.
- **The repeating structure's `representative` is an inline shape on the
  contract**, so it is written as
  `present<RepeatingStructureEvidence["representative"]>({...})` rather than
  given a new name. Naming it would have been a fifth spelling of an evidence
  shape, which is the thing this seam exists to stop.

### The guarantee is now asserted by every build, not proved once

`apps/extension/src/content/evidence/tests/present.test.ts`, six runtime tests
and seven `@ts-expect-error` rows.

The `@ts-expect-error` rows are the part that matters. A worker proving once
that a rename fails to compile proves it for one afternoon. These fail `check`
the moment any of them *stops* being an error — if TypeScript's excess-property
rules change, if `present`'s signature is loosened, if someone "simplifies"
`EvidenceFields<T>` to `Partial<T>`. The seventh row has no directive and must
keep compiling: it is the one that fails if closing the hole ever makes an
optional field mandatory.

The runtime rows cover what the compiler cannot see: that an optional field
given `undefined` is **absent** rather than present-and-undefined, that `false`
and `0` and `""` survive, and that the JSON is unchanged.

## The mutation proofs

All three reverted; `diff` against a pre-mutation copy reports `dialogs.ts` and
`present.test.ts` byte-identical, and `check` is exit 0 afterwards.

### Proof 1 — the rename the brief asked for

`v-wire-contract`'s exact mutation: `dialogs.ts`, `describeDialog`, `label`
renamed to `title`. Under that worker's tree this gave `check` exit 0 and 229 of
229 tests green. Now:

```
src/content/evidence/dialogs.ts(71,5): error TS2353: Object literal may only specify known
properties, and 'title' does not exist in type
'RequiredFields<WebAutomationDialogEvidenceItem> & OptionalFields<WebAutomationDialogEvidenceItem>'.
```

Extension `check` **exit 2**. The type it names is the domain's contract, in an
error reported from an extension file.

**And the honest half of that result: the unit suite still passes under this
mutation.** `pnpm --filter @fluxiq-web-extension/extension test` was **exit 0**,
`# tests 247 # pass 247 # fail 0`, because the test runner bundles with esbuild
and never type-checks. The gate that catches this is `check`, which `pnpm check`
runs for every package. Anyone reading "the tests would catch it" should read
this line instead.

### Proof 2 — deleting an optional field, which a contract type cannot catch alone

Same file, the `label:` line removed entirely. This is the other way a field
leaves the wire, and it is the one no ordinary shared type can see, because
absence is precisely what optional means:

```
src/content/evidence/dialogs.ts(63,38): error TS2345: Argument of type '{ selector: string;
role: string; modal: boolean; native: boolean; bounds: RectDescriptor | undefined; }' is not
assignable to parameter of type 'RequiredFields<WebAutomationDialogEvidenceItem> &
OptionalFields<WebAutomationDialogEvidenceItem>'.
  Property 'label' is missing in type '{ selector: string; role: string; modal: boolean;
  native: boolean; bounds: RectDescriptor | undefined; }' but required in type
  'OptionalFields<WebAutomationDialogEvidenceItem>'.
```

Extension `check` **exit 2**. The dialog still ships without a `label` key when
the page has no label — that is Proof 3's first runtime row. What is no longer
possible is a producer that stops *considering* the field.

### Proof 3 — the `@ts-expect-error` rows are live, not decorative

A directive that guards a line which has quietly started compiling is worse than
no directive, so the control was run rather than assumed. Making one guarded
line valid (`title:` back to `label:`):

```
src/content/evidence/tests/present.test.ts(158,3): error TS2578: Unused '@ts-expect-error' directive.
```

Extension `check` **exit 2**. `tsconfig.test.json` includes `src/**/*.ts`, so
every row in that file is checked by `pnpm --filter extension check`.

## The cost, measured

`v-wire-contract` deferred this change partly on cost — "an allocation per
described item on a path that runs on every action result" — so it was measured
rather than argued. Six fields, three optional, the shape of `describeControl`;
240 items per capture, which is the producer's own cap of 8 forms by 30
controls; 20,000 captures; three runs.

| | per capture of 240 items | per item |
| --- | --- | --- |
| Conditional spreads | 16 µs | 0.067 µs |
| `present` | 26–30 µs | 0.11–0.13 µs |

About **+12 µs per full capture at the producer's maximum form load**, against a
snapshot that does layout flushes, `getComputedStyle` on every candidate and up
to forty `elementFromPoint` hit-tests — milliseconds of work. The benchmark also
asserts the two produce identical JSON, and does.

The intuition that a spread is cheaper than a copy is right per call but the
gap is small: the old pattern allocated the literal plus one throwaway object
per present optional field, the new one allocates the literal plus one result.

## The honest limit: there is a second producer

**`apps/extension/src/background/connection/dom-snapshot.ts` produces
`PageEvidence` too, it has exactly this hole, and it is not in my Owns.** I did
not touch it. Reporting it is what the wave's binding rule on ownership drawn
around a file rather than around a change asks for.

It is not a bystander. It rebuilds every child frame's evidence in the top
frame's terms and merges the frames into the evidence the recording path
carries, in `frameEvidenceInTopFrameTerms`, `mergePageEvidence`,
`mergeDialogEvidence` and `mergeOverlayEvidence`. It contains **13 conditional
spreads**, plus a `boundsOrNone` helper whose return type `{ bounds?:
RectDescriptor }` is a hand-written restatement of a contract key, spread at
three sites.

Being precise about how exposed it is, because "13 spreads" overstates it:

- **A rename of an existing field is mostly caught there by luck.** Every
  conditional is `evidence.<key> ? { <key>: ... }`, and the *read* on the left is
  type-checked. Rename `dialogs` on the contract and `evidence.dialogs` fails
  first. The same accident covers `submit`, `armPending`, `lastNative` and
  `bounds` (destructured out of a typed item). It is a real protection and it is
  not a designed one — a future clause that writes a key without reading the
  same key loses it.
- **A deleted clause is not caught at all.** Remove
  `...(evidence.regions ? { regions: ... } : {})` and every child frame's regions
  vanish from the merged snapshot, with both packages green.
- **A field added to the contract is not caught at all, and this one is likely.**
  `mergePageEvidence` enumerates the eight keys of `WebAutomationPageEvidence`
  and builds a fresh object. A ninth key would be produced per frame, carried
  through `frameEvidenceInTopFrameTerms`'s `...evidence`, and then **silently
  dropped from every merged snapshot**. The author would see it working on a
  single-frame fixture and lose it on the recording path. That is this plan's
  signature defect, one layer along, and it is live today.

The fix is the same one: `present<PageEvidence>` and friends across those four
functions. One wrinkle for whoever does it — `mergeDialogEvidence` and
`mergeOverlayEvidence` each declare a local `const present = ...`, which would
shadow the import and must be renamed.

**The brief should have included
`apps/extension/src/background/connection/dom-snapshot.ts`.** My change is not
inert without it: the content producer is where all thirty-three spreads and all
three original defects were, and it is fully covered. But the claim "a producer
that renames or drops a contract field fails to compile" is true of one producer
and not of the other, and shipping it as though it were general is the failure
this whole wave is about.

## Is a fourth rediscovery now structurally impossible?

**No. It is a good deal harder, and I can name what still gets through.**

*Now impossible, by compile error:*

- A reader reading a path no producer writes — the three defects this plan hit.
  (`v-wire-contract`, unchanged by me.)
- A **content** producer renaming any field, required or optional. (Proof 1.)
- A **content** producer deleting any field, required or optional. (Proof 2.)
- A field added to a contract type: every content producer of that type stops
  compiling until it says what it writes there. This closes, on the producer
  side, the "field added inside an existing item" gap `v-wire-contract` said
  needed a person.
- Calling the writer without naming the contract type, which would have made the
  whole thing opt-in.
- Any of the above guarantees silently lapsing: seven `@ts-expect-error` rows
  fail the build if they stop being errors. (Proof 3.)

*Still possible:*

- **Everything in the second producer**, above. This is the big one.
- **A new object spread written into `content/evidence/` tomorrow.** Nothing
  mechanically forbids one. Thirteen call sites are converted and the pattern is
  gone from the directory, so the next author copies a neighbour that uses
  `present` — but that is a habit, not a check. There is no ESLint in this
  repository, so the place a real rule belongs is a **structure-audit rule**:
  the audit already parses every file with the TypeScript API, and the rule is
  `ts.isSpreadAssignment` inside a file under `content/evidence/`. That is a
  Core change (`scripts/structure-audit/rules/`, mirrored, changed there first),
  which is why I did not write it. It is small and it would make this
  structurally closed rather than closed-and-conventioned.
- **A field the contract declares that nobody reads.** The producer must now
  write it; no compiler makes a consumer consume it. `capture.test.ts`'s
  `NOT_EXERCISED` list is the check, and it is hand-kept.
- **A value that is wrong rather than missing.** Nothing here says a selector is
  correct or a rect is on the right page. Only the browser harness does.

Put plainly: the wall this plan kept walking into was *the same field with two
names*. For the content producer and both readers that is now a compile error in
both packages at once. For the frame merge it is not, and someone will find that
out the way the last three were found out unless it is briefed.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=v-producer-safety` and
`DOMAIN_TEST_BUILD_LABEL=v-producer-safety` on every package command. Every exit
status captured by redirecting to a file and echoing `$?`, never through a pipe.
**No `pnpm build`, no `pnpm lab`, no `pnpm structure:baseline`, no root
`pnpm check`.**

- `pnpm --filter @fluxiq-web-extension/extension check` → **exit 0**, no
  diagnostics. Run seven times across the change; every failing run in between
  was a deliberate mutation, quoted above.
- `pnpm --filter @fluxiq-web-extension/extension test` → **exit 0**,
  `# tests 247 # pass 247 # fail 0`. The six new rows observed green by name:
  `ok 140`–`ok 145`.
- `pnpm --filter @fluxiq-web-extension/domain check` → **exit 0**.
- `pnpm --filter @fluxiq-web-extension/domain test` → **exit 0**,
  `# tests 310 # pass 310 # fail 0` — unchanged from `v-wire-contract`'s count,
  as expected, since my domain edit is a comment.
- `node scripts/structure-audit.mjs` with `GIT_INDEX_FILE` pointed at a copy of
  `.git/index` plus `git add -A -N .`. Verified the scratch index held both new
  files (`git ls-files` under it lists `content/evidence/present.ts` and
  `content/evidence/tests/present.test.ts`) and that `.git/index` was byte-identical
  before and after, by `md5sum`.
  - First run, mid-session: **exit 0**,
    `structure-audit: passed (32 warning(s), 19 baselined)`, zero `FAIL` lines.
  - Final run: **exit 1**, `2 violation(s) across 1 rule(s)`. Both are
    `[working-docs]`:
    `docs/working/mvp-week1-web-automation-reliability-plan.md: 825 lines exceeds
    the 800-line compaction threshold`, and
    `docs/working/README.md is out of date with the documents' header blocks`.
    Reran once per the wave rule; identical. **`diff` of the two audit outputs
    shows the 32 warnings are byte-identical and the only change is those two
    lines** — the plan document was edited by another agent while I worked. A
    grep for `content/evidence|page-evidence` over both outputs returns nothing,
    so my change contributes no finding of any severity. Neither failure is mine
    to fix: the plan document and `docs/working/README.md` are the supervisor's,
    and regenerating the index needs `pnpm structure:baseline`, which workers may
    not run.
- Three scratch TypeScript probes under the repository's exact flags, to choose
  the signature rather than guess it: the plain `present<T>(fields: T)` form, the
  `NoInfer` form, and the all-keys-mentioned form. Eleven cases each. The third
  is what shipped; it was the only one that caught a deleted optional field.
- A microbenchmark, `node`, three runs — figures in [The cost](#the-cost-measured).
- **No `pnpm build` and no `test:content`.** Both are the supervisor's under the
  wave rules; the second also needs the Lab, which I was told not to touch.

## Not verified

- **No browser validation of anything I changed.** Every producer module here
  runs only in a page, and the whole change was exercised in Node and by the
  compiler. `e2e/content/tests/evidence.spec.ts` asserts these fields on real
  pages and is the gate that would catch a *behaviour* regression; I did not run
  it, and I do not own it.
- **The claim that output is unchanged is proven for the dialog shape and the
  control shape, not for all thirteen sites.** Each conversion was mechanical and
  each truthiness guard was preserved by inspection, and the two shapes with the
  most optional fields are pinned by a test that builds the value both ways. The
  other eleven sites rest on that inspection.
- **The three checked-in captures in `domain/src/page-evidence/capture.ts` were
  not regenerated**, so no real browser has produced evidence through this code.
  They should be unchanged — the JSON is identical by construction and by
  measurement — but that is reasoning, not a fresh capture.
- **`domain/.test-build/` and `apps/extension/build/` were not regenerated**, for
  the reason every worker this wave has given: it means running without a label
  and racing everyone.
- **The frame-merge hole is described from reading the file, not from a mutation
  proof.** I do not own it, so I did not mutate it. The counts (13 conditional
  spreads, two shadowing `present` locals) are from `grep` and are exact; the
  characterisation of which renames are caught by an adjacent read is from
  reading each clause.
- **No live browser, no Firefox, no real site. Nothing committed.**

## Open questions or contradictions found

- **The frame merge needs a brief.** Stated at length above. It is the difference
  between "the producer is safe" and "one of the two producers is safe", and the
  add-a-field case there is a defect waiting rather than a theoretical gap.
- **A structure-audit rule would make this mechanical rather than conventional.**
  One rule, `ts.isSpreadAssignment` in a file under a configured directory,
  written in Core and mirrored down. Without it, the guarantee holds for today's
  thirteen call sites and depends on habit for the fourteenth. Given the
  repository's stated preference for checks that fail the build over written
  guidance, this seems worth someone's hour.
- **`v-wire-contract`'s deferral was correctly reasoned and its cost estimate was
  the one thing slightly off.** It flagged the allocation cost and the risk of
  touching `forms.ts` mid-wave. The allocation cost is 12 µs per maximum-load
  capture, and `forms.ts` needed no change to how `sensitive` is decided — only
  to how the decided value is written. Worth knowing that the deferral was
  cheaper to reverse than it looked, without which the same judgement would be
  made again.
- **`present` and `compactObject` will look like duplicates to the next reader.**
  They are not — the type argument is the whole difference — and someone will
  eventually try to merge them. The header of `present.ts` says why they must
  stay apart. If the background file ever gets the same treatment, the right move
  is probably to make `compactObject` delegate to a shared implementation while
  keeping the two signatures distinct, rather than to unify the signature.
- **`v-wire-contract`'s open question is now answered, and the plan should say
  so.** It asked whether the `present<T>()` helper lands or whether the plan
  records that the browser harness is the producer-side gate. It landed; the
  browser harness is no longer the only gate for a content-producer field name.
  For the frame merge it still is.
