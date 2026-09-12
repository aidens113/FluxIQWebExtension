# Report: v-wire-contract

Worker: `v-wire-contract`. Giving the page-evidence wire contract one home, and
joining the producer to its two consumers by data as well as by a type.

## Outcome

**Done.** The shape is declared once, in `domain/src/page-evidence/`, and both
sides of the wire import it. `pendingNativeDialog` is gone from the packet, root
and branch. Three real browser captures are checked in and asserted by both
domain readers and by the extension's cross-frame merge.

- Domain `check` **exit 0**; domain `test` **exit 0**, `# tests 310 # pass 310
  # fail 0`.
- Extension `check` **exit 0**; extension `test` **exit 0**, `# tests 229
  # pass 229 # fail 0`.
- Structure audit through a scratch `GIT_INDEX_FILE` **exit 0**,
  `structure-audit: passed (31 warning(s), 19 baselined)`, zero `FAIL` lines and
  zero findings naming any file I touched.
- Four mutation proofs, all quoted below, all reverted and verified
  byte-identical by `diff`.

Two things the supervisor must decide on, both flagged in full below:

1. **The contract is exported from `domain/src/index.ts`, not
   `domain/src/client/index.ts`.** The brief forbade the client barrel. The
   exact line it should gain is in
   [What the supervisor must wire](#what-the-supervisor-must-wire).
2. **`domain/src/runtime/llm-evidence/page-evidence.ts` is not in my Owns and I
   edited it.** It is one of the two readers the task is about; the brief owned
   the module that *composes* it (`sanitize.ts`) but not the module itself.
   Details in [Ownership](#ownership-the-brief-drew-the-line-around-the-wrong-module).

## The scratch directory, and what was kept

The supervisor's mid-task message asked me to decide what
`apps/extension/.wire-contract-capture/` was. **I chose the first form and the
second substance, as asked: the machinery is deleted and the captured data is
committed as a reviewed file.**

`apps/extension/.wire-contract-capture/` is gone (`ls` reports no such
directory), and nothing in the tree references it. It held a throwaway
Playwright config and a four-test spec whose only job was to `console.log` the
`evidence` of a real capture. What it produced is now
`domain/src/page-evidence/capture.ts` — a reviewed, compiler-checked,
commented data file.

I did **not** keep the capture spec, because the only place a content-harness
spec may live is `apps/extension/e2e/content/tests/`, which my brief forbids me
to touch. Instead `capture.ts`'s header carries the recipe: the four lines of
spec, the three page states to drive, the one mechanical edit (the Lab's
per-run port rewritten to `4173`), and — the part that matters — *when* to
regenerate and what to look for in the diff. If the supervisor wants the spec
committed, it is about 30 lines and belongs at
`apps/extension/e2e/content/tests/page-evidence-capture.spec.ts`.

## Where the contract lives, and why there

`domain/src/page-evidence/`, four source files and one test folder:

| File | What it is |
| --- | --- |
| `types.ts` | The shape. Sixteen types, no behaviour, no DOM lib. |
| `wire.ts` | `PageEvidenceWire<T>` and `pageEvidenceWire<T>()`: how an untrusted capture is read *with the contract's own keys*. |
| `capture.ts` | Three real captures from a real browser. |
| `index.ts` | The barrel. |
| `tests/capture.test.ts` | What the captures do and do not reach. |

The direction was forced, as the brief said: the structure audit forbids
`domain/src` importing `apps/extension/src`, and the extension already imports
the domain, so the contract goes in the domain. It sits at the top of
`domain/src/` rather than under `recording/` or `runtime/` because both read
it, and putting it under either would make one depend on the other —
`domain/src/sensitivity/` is there for exactly the same reason and was the
precedent I followed.

### The shape is the producer's, not either reader's

I read `apps/extension/src/content/evidence/` first, as instructed, and the
producer won everywhere. Every field name, every optional marker, every nested
level is the producer's. Two deliberate departures, neither a shape change:

- **`RectDescriptor` became `WebAutomationEvidenceRect`.** The producer imported
  its rect from `shared/protocol.ts`, which the domain cannot see. The contract
  declares its own, structurally identical to both the extension's
  `RectDescriptor` and the projection's `WebAutomationRect`. That is a third
  four-number rect and I am not pretending otherwise; see
  [Residual](#residual-what-i-could-not-reach).
- **`DocumentReadyState` and `DocumentVisibilityState` became written-out
  unions.** They are TypeScript DOM-lib types, and the domain package must not
  depend on the browser. `WebAutomationDocumentReadyState` and
  `WebAutomationDocumentVisibility` are identical member for member, so the
  producer still assigns `document.readyState` and `document.visibilityState`
  straight into them and the compiler checks the two agree.

**No genuine producer-versus-domain bug turned up.** `v-evidence-readers` had
already reconciled the five items the packet was reading at the wrong paths, and
the state projection had always read the producer correctly. What was left was
the restatement itself, not a disagreement.

### The names, and the one place they are aliased

The domain's exported names carry the package's `WebAutomation` prefix, as
`WebAutomationDomSnapshotInput` and `WebAutomationElementStateInput` already do.
The extension keeps its shorter spellings — `PageEvidence`, `DialogEvidence` —
because eight producer modules, `shared/protocol.ts`, the frame merge and two
test suites already read that way.

The aliasing happens in exactly one file,
`apps/extension/src/content/evidence/types.ts`, which went from **235 lines of
declaration to 51 lines of which 33 are the header explaining why**. Each alias
is the same type object as the domain's, so the two spellings cannot come to
mean different things: mutation 1c below renames one field in the contract and
both packages fail, naming `WebAutomationDialogEvidenceItem` in an error
reported from an extension file.

### How the readers reach the wire now

This is the part that makes drift a compile error rather than a habit.

Both domain readers used to reach an untrusted capture through
`Record<string, unknown>` and read it by string literal — which is exactly how
`webLlmPageContext` spent months reading `snapshot.loading` against a producer
writing `evidence.loading`, with a green suite on both sides.

They now go through `PageEvidenceWire<T>`:

```ts
export type PageEvidenceWire<T> = { [K in keyof T]?: unknown };
```

`T`'s **keys**, which are the producer's keys because the producer's declaration
*is* `T`; every **value** `unknown`, so it still has to pass one of the
defensive readers before it can be used. A field the producer renames stops
compiling in both readers. A field the page corrupts still reports nothing
rather than throwing.

`WebAutomationPageEvidenceInput` in `recording/web-state/evidence/input.ts` is
derived the same way and no longer names a single item:

```ts
export type WebAutomationPageEvidenceInput = { [K in keyof WebAutomationPageEvidence]?: unknown };
```

## The real captures

`domain/src/page-evidence/capture.ts` holds three, each the `evidence` of a
snapshot the real content-script bundle produced in headless Chromium on a
Scenario Lab fixture, through `apps/extension/e2e/content/`'s harness. One
mechanical edit: the Lab binds a fresh port per run, so
`http://127.0.0.1:<port>` became `http://127.0.0.1:4173` throughout. Nothing
else was touched.

| Capture | Page state | The items only it exercises |
| --- | --- | --- |
| `modal-flows` | An ARIA modal opened over a consent banner, after a native `confirm` was answered | `dialogs.open`, `dialogs.modal`, `dialogs.lastNative`, `overlays`, a five-landmark `regions` |
| `infinite-feed` | Inside the 300 ms fetch after scrolling to the bottom | `loading.busy`, `loading.busyRegions`, `loading.indicators`, `repeating` |
| `sensitive-input` | A login and payment form at rest | `forms` with `autocomplete` and `sensitive` controls |

Between them they populate **57 contract fields**, each pinned in
`page-evidence/tests/capture.test.ts` by a typed accessor rather than a path
string, so a rename breaks the file at compile time and a regenerated capture
that lost the field breaks it at run time.

Ten fields no capture reaches are listed with the reason, in the same file, as
`NOT_EXERCISED`, and a test asserts that list is exactly right — a row that
starts being reached must be moved up rather than left as a stale excuse. They
are: `navigation.referrer` and `navigation.redirects` (the harness opens
fixtures directly and none redirects), `dialogs.armPending` (observable only
where the page-world override is missing), `overlays.blockers[].role` and
`.label` (the backdrop is a bare div), `forms[].name`, `.label`, `.action`,
`.method` (neither fixture form carries them) and
`forms[].controls[].disabled`. Also absent and documented in the file header:
`elements.truncated: true`, `loading.pendingNavigation: true`,
`navigation.visibility: "hidden"`, and a native `<dialog open>`.

That list is the honest limit of the data join, and it is a test rather than a
comment so it cannot rot.

## `pendingNativeDialog` is gone

Three lines, exactly as `v-evidence-readers` predicted: the `?: never`
declaration in `page-evidence.ts`, and the name in the two lists at
`sanitize.ts` (`type DroppableEvidenceField` and
`const droppable: DroppableEvidenceField[]`). Nothing else referenced it.

Removing it from the trim ladder changes no behaviour: the ladder only acts on a
field that is `!== undefined`, and this one could never be present. The
`llm-evidence/tests/page-evidence.test.ts` row that asserts no capture can make
the packet claim a pending native dialog still passes — it reads
`"pendingNativeDialog" in packet`, which is now false by construction rather
than by a `never` type.

The reason it had to go rather than stay unwritten is in the contract's
`armPending` docstring and in `page-evidence.ts`'s header: a native dialog on
screen is not merely unobserved but **unobservable**, because an unanswered
`alert` blocks the page's own script, so no snapshot can leave the page while
one stands. A packet field for it can only ever mislead.

## The tests, and the mutation proofs

Three new suites and one rewritten fixture:

- `domain/src/page-evidence/tests/capture.test.ts` — 6 tests. What the captures
  reach, what they do not, the item-level ratchet, and that no capture carries a
  control's value.
- `domain/src/tests/page-evidence-joinery.test.ts` — 5 new rows on top of
  `v-evidence-readers`' 7, driving the real captures into both domain readers.
  Its constructed fixture is now typed `WebAutomationPageEvidence`, so it is a
  compiler-checked instance rather than a fourth restatement; it survives for
  the four facts no Lab fixture produces (a capture already truncated, a
  referrer with a query string, a redirect chain, a back-forward navigation) and
  the rows that use it say so.
- `apps/extension/src/background/connection/tests/page-evidence-capture.test.ts`
  — 3 tests. Two real captures through the extension's cross-frame merge and
  into the domain's projection: producer data → extension code → consumer code,
  in one process.

### Proof 1a — a producer renaming an *optional* field is **not** caught

This is the one the brief asked for, and the honest answer is that it does not
fail. I changed `content/evidence/dialogs.ts` line 70 from
`...(label ? { label } : {})` to `...(label ? { title: label } : {})`:

```
M1_EXT_CHECK_EXIT=0
M1_EXT_TEST_EXIT=0
# tests 229 # pass 229 # fail 0
```

Green. TypeScript performs **no excess-property check through a conditional
spread**, in any form. I proved that separately rather than inferring it — a
five-line probe compiled clean under `--strict
--exactOptionalPropertyTypes` for all three of `satisfies T`, a `T` return
annotation, and a `const x: T =` annotation. The producer uses that spread
pattern 33 times across 8 modules, which is how every optional evidence field is
emitted.

What does catch it: `apps/extension/e2e/content/tests/evidence.spec.ts`, which
asserts `label: "Invite a collaborator"` on the real page — a browser gate, not
a Node one — and regenerating the capture. What would close it in the compiler
is in [Residual](#residual-what-i-could-not-reach).

### Proof 1b — a producer renaming a *required* field is caught

Same file, `selector:` → `target:`:

```
src/content/evidence/dialogs.ts(63,5): error TS2353: Object literal may only specify
known properties, and 'target' does not exist in type 'WebAutomationDialogEvidenceItem'.
```

Exit 2. Note the type it names: an extension file, failing against the domain's
contract. That error is only possible because the extension is no longer
declaring its own.

### Proof 1c — renaming a field in the contract breaks both packages together

`label` → `title` in `WebAutomationDialogEvidenceItem`. Domain `check`, exit 2:

```
src/page-evidence/capture.ts(115,11): error TS2353: Object literal may only specify known properties, and '"label"' does not exist in type 'WebAutomationDialogEvidenceItem'.
src/recording/web-state/evidence/project.ts(184,27): error TS2339: Property 'label' does not exist on type 'PageEvidenceWire<WebAutomationDialogEvidenceItem>'.
src/runtime/llm-evidence/page-evidence.ts(252,34): error TS2339: Property 'label' does not exist on type 'PageEvidenceWire<WebAutomationDialogEvidenceItem>'.
```

Extension `check`, exit 2, the same three through the workspace link. This is
the join: the real capture, the state projection and the packet reader all fail
at once, and neither package can be made green alone.

### Proof 2 — a reader drifting to a private path fails the joinery test

`page-evidence.ts`, `evidence?.dialogs` → `snapshot.dialogs` — the exact defect
`v-truncation` found. Domain `test` exit 1, `# pass 304 # fail 5`:

```
not ok 296 - both readers see the same dialog, under the producer's own field names
  error: 'the packet reported no dialog at all: it is reading a path the producer does not write'
not ok 303 - real capture: the modal a page was actually showing reaches both readers
  error: 'the packet reported no dialog, and a real browser sent one'
not ok 195 - gives up page facts before the last element, and refuses only when nothing is left to drop
not ok 197 - reports the open dialogs the producer lists, by the producer's own field names
not ok 301 - dropping one producer field silences both readers together
```

The second one is the new capability: the failure message is not "the fixture
disagrees" but "a real browser sent one".

### Proof 3 — a capture that lost a field a producer used to send

Dropped `"label": "Invite a collaborator"` from the `modal-flows` capture, which
is what a regenerated capture from a regressed producer would look like. Domain
`test` exit 1, `# pass 308 # fail 1`:

```
not ok 67 - the captures between them populate every contract field the data join claims to cover
  error: |-
    these fields are declared and read but no real capture carries one, so nothing proves a producer writes them
    + [ 'dialogs.open[].label' ]
    - []
```

### Proof 4 — an item added to the contract cannot slip in unnoticed

Added `scrollDepth?: number` to `WebAutomationPageEvidence`. Domain `check`,
exit 2:

```
src/page-evidence/tests/capture.test.ts(133,7): error TS2741: Property 'scrollDepth' is missing in type
'{ elements: "always"; loading: "always"; navigation: "always"; dialogs: ...; forms: ...; }'
but required in type 'Record<keyof WebAutomationPageEvidence, "always" | "when the page has one">'.
```

All four mutations reverted; `diff` against a pre-mutation copy reports
`dialogs.ts`, `types.ts`, `page-evidence.ts` and `capture.ts` identical.

## Restatements: before and after

The supervisor counted ten files carrying some version of the shape. Counting
them by what each actually did:

| Kind | Before | After |
| --- | --- | --- |
| Full declarations of the shape | 1 (`content/evidence/types.ts`) | 1 (`domain/src/page-evidence/types.ts`) — and the extension's is now 16 aliases of it |
| Types restating the item names | 1 (`web-state/evidence/input.ts`) | 0 — derived from the contract by a mapped type |
| Modules reading evidence fields as free string literals | 2 (`web-state/evidence/project.ts`, `llm-evidence/page-evidence.ts`) | 0 — every read is `PageEvidenceWire<T>` with the contract's type |
| Re-export surfaces | 1 (`shared/protocol.ts`) | 1, unchanged in shape, its header now saying where the contract lives |
| Extension modules naming fields to fold them | 1 (`background/connection/dom-snapshot.ts`) | 1, already typed through `PageEvidence`, so now typed through the contract — **no edit was needed and I made none** |
| Test fixtures free to state a shape nothing produces | 7 | 6, of which 2 are deliberately loose |

So: **one declaration, down from one declaration plus three independent
restatements in production code plus seven free-form fixtures.** In production
code the count of independent statements of the shape is now **zero besides the
contract itself**. The four fixtures that could still be pinned with a one-line
type annotation are all outside my Owns and are listed below.

### Is a fourth rediscovery structurally impossible?

**No. It is much less likely, and one specific route is still open.** Being
precise, because "structurally impossible" is the claim that matters:

*Now impossible:*

- A reader reading a path no producer writes — all three of the plan's actual
  defects. Compile error in both readers (proof 1c, proof 2's compile half).
- A producer renaming or removing a **required** field. Compile error (1b).
- An item added to the contract with no capture and no reader. Compile error (4).
- Either side adding a field the other has never heard of. Compile error.

*Still possible:*

- **A producer renaming or dropping an optional field emitted through a
  conditional spread** (1a). TypeScript does not check it, and the checked-in
  captures are static so no Node test notices. It is caught in the browser by
  `e2e/content/tests/evidence.spec.ts` for the fields that spec asserts, and by
  regenerating the capture. This is the live hole.
- **A field added inside an existing item, read by nobody.** The item-level
  ratchet is exhaustive; the field-level `EXERCISED`/`NOT_EXERCISED` lists are
  hand-kept. Nothing in TypeScript can enumerate a nested optional key at run
  time, so this one needs a person.

## What the supervisor must wire

**One line, and the change is inert-free without it — but narrower with it.**
The extension reaches the contract today through
`@fluxiq-web-extension/domain` (the root barrel), because
`domain/src/client/index.ts` is another worker's. It works, and both `check`s
and both test suites prove it. The narrower seam the extension uses for
everything else is the client barrel, and it should have this line, beside
`export * from "../sensitivity";`:

```ts
export * from "../page-evidence";
```

With that line in place, `apps/extension/src/content/evidence/types.ts` line 51
can change its specifier from `"@fluxiq-web-extension/domain"` to
`"@fluxiq-web-extension/domain/client"`, and
`apps/extension/src/background/connection/tests/page-evidence-capture.test.ts`
line 26 likewise. Neither is required; both are tidier. **The root-barrel import
is type-only in production code and I verified it costs the content bundle
nothing** — see Commands below.

`domain/src/runtime/index.ts` needs nothing from me.

## Ownership: the brief drew the line around the wrong module

Two files I edited that the brief's Owns did not list. Both are the class of
defect the wave's binding rules name, and both were unavoidable rather than
convenient.

1. **`domain/src/runtime/llm-evidence/page-evidence.ts`.** This is one of the
   two consumers the whole task is about — the packet reader whose five wrong
   paths are the third of the three defects the brief cites. The brief owned
   `sanitize.ts`, which *composes* it, but not the reader itself. There is no
   way to point that reader at a shared contract without editing it. The brief
   should have read `domain/src/runtime/llm-evidence/{page-evidence,sanitize}.ts`.
2. **`domain/src/index.ts`**, one line. The contract is unreachable from the
   extension otherwise, and the two barrels the brief forbade are the only
   others. It is not in the forbidden list and no other worker has it modified.

Everything else was inside Owns. `apps/extension/src/background/connection/dom-snapshot.ts`
is in my Owns and I changed nothing in it: it already reads the evidence types
through `shared/protocol.ts`, so it began compiling against the contract the
moment `content/evidence/types.ts` did. Editing it to "use the contract" would
have been a change with no effect.

## Residual: what I could not reach

Each with the exact reason, as the brief asked.

- **Four test fixtures still state the shape free-form**, any of which could
  assert a shape nothing produces. Each needs one type annotation and each is
  outside my Owns:
  - `domain/src/recording/web-state/tests/evidence.test.ts:25` —
    `const evidence = {` → `const evidence: WebAutomationPageEvidence = {`
  - `domain/src/recording/tests/domain.test.ts:56` — the `evidence:` literal
    inside the snapshot fixture; extract it and annotate it.
  - `domain/src/runtime/llm-evidence/tests/limits.test.ts:122` — the
    trim-ladder fixture's `loading:` and `dialogs:` literals.
  - `apps/extension/src/background/tests/recording-evidence-pipeline.test.ts:40,65`
    — the two frame fixtures, currently reaching the merge through `as never`.
- **Two fixtures are deliberately loose and must stay that way.**
  `domain/src/recording/web-state/evidence/tests/project.test.ts` and
  `domain/src/runtime/llm-evidence/tests/page-evidence.test.ts` plant malformed
  and legacy-shaped payloads on purpose, to prove the readers report nothing
  rather than throwing. Annotating either would delete the test.
- **The optional-spread hole (proof 1a) is closable, at a price.** A
  `present<T>(fields)` helper in `content/evidence/` — drop the undefined
  entries, argument typed `{ [K in keyof T]?: T[K] }` — makes every optional key
  compiler-checked, because a plain property is excess-checked where a spread is
  not. It is one new file and 33 call sites across 8 producer modules, all in my
  Owns, and it emits byte-identical JSON. I did not do it: it is a
  construction change in `forms.ts`, which decides `sensitive`, late in a wave
  with several workers in the tree, and it adds an allocation per described item
  on a path that runs on every action result. It is a deliberate deferral, not
  an oversight, and it is the single highest-value follow-up here.
- **A four-number rect is declared three times**:
  `WebAutomationEvidenceRect` (mine), `RectDescriptor`
  (`apps/extension/src/shared/protocol.ts`, element geometry) and
  `WebAutomationRect` (`domain/src/recording/web-state/types.ts`, element
  geometry). They are structurally identical, which is what lets a descriptor's
  bounds and a dialog's bounds be compared. Folding them needs
  `web-state/types.ts`, which is not in my Owns; the fix is to move
  `WebAutomationRect` into `page-evidence/types.ts` (or a rect module beside it)
  and alias the other two to it.
- **`WebAutomationDomSnapshotInput` and `WebAutomationElementStateInput` in
  `domain/src/recording/web-state/types.ts` restate the *element and snapshot*
  wire shape** the same way page evidence used to. Same wall, different fields,
  and the same fix now has a precedent to follow. Out of scope for this brief
  and not in my Owns.
- **`domain/src/recording/web-state/evidence/tests/` holds only
  `project.test.ts`.** The projection's main coverage lives at
  `web-state/tests/evidence.test.ts`, one directory up from its subject. Not
  mine to move.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=v-wire-contract` and
`DOMAIN_TEST_BUILD_LABEL=v-wire-contract` were set on every package command.
Every exit status was captured by redirecting to a file and echoing `$?`, never
through a pipe. **No `pnpm build`, no `pnpm lab`, no `pnpm structure:baseline`.**

- `pnpm --filter @fluxiq-web-extension/domain check` → **exit 0**, no
  diagnostics. Run six times across the change.
- `pnpm --filter @fluxiq-web-extension/domain test` → **exit 0**,
  `# tests 310 # pass 310 # fail 0`. New rows observed green by name:
  `ok 66`–`ok 70` (`page-evidence/tests/capture.test.ts`) and `ok 303`–`ok 307`
  (the real-capture joinery rows).
- `pnpm --filter @fluxiq-web-extension/extension check` → **exit 0**. An early
  run was **exit 2** with two `TS2304` errors in
  `src/content/identity/candidates.ts`, a file I do not own, mid-edit by
  another worker; gone on re-run per the wave rule.
- `pnpm --filter @fluxiq-web-extension/extension test` → **exit 0**,
  `# tests 229 # pass 229 # fail 0`. New rows green by name: `ok 35`–`ok 37`.
- `node scripts/structure-audit.mjs` with `GIT_INDEX_FILE` pointed at a copy of
  `.git/index` plus `git add -A -N .` → **exit 0**,
  `structure-audit: passed (31 warning(s), 19 baselined)`. Zero `FAIL` lines. A
  grep for `page-evidence|content/evidence|shared/protocol|connection/dom-snapshot|web-state/evidence|llm-evidence`
  over the audit output returns **0**. The warning count rose from 30 to 31
  between two runs; `diff` of the two warning lists shows the new one is
  `apps/extension/e2e/content/tests/redaction.spec.ts: 435 lines`, another
  worker's file. I verified the scratch index actually held my new files
  (`git ls-files` under `GIT_INDEX_FILE` lists all five of
  `domain/src/page-evidence/*` and the new extension test) and that the real
  `.git/index` was never written.
- **The content bundle**, built through `bundleExtensionEntry("content", …)`
  into a scratch directory — the same call `e2e/content/global-setup.ts` makes,
  and *not* `pnpm build`, so nothing in `dist/` or `build/` was touched. It
  bundles clean at 225,689 bytes and the output contains no `node:path`, which
  is the proof that the type-only import of the domain root barrel is erased
  rather than pulling the domain's node-facing modules into the content script.
- **The captures themselves**: `npx playwright test` against a throwaway config
  in the now-deleted scratch directory, four specs, `4 passed (2.4s)`. This
  starts its own in-process Scenario Lab; it is not a `pnpm lab` command and
  ran no Lab scenario suite.

## Not verified

- **No `pnpm build`, no `pnpm check` at the repository root, no
  `pnpm test:content` suite run, no Lab run.** All the supervisor's under the
  wave rules. I did build the content bundle in isolation (above) and I did run
  Playwright against a four-spec throwaway config to take the captures, so the
  content bundle is known to build and load; the 178-spec harness suite was not
  run and other workers were mid-edit in `e2e/` throughout.
- **No live browser validation of the changed code paths.** The captures came
  from a real browser, but everything I changed downstream of them was exercised
  in Node. Nothing here is proven across extension contexts, in Firefox, or on a
  real site.
- **The optional-spread hole is proven open, not proven harmless.** I showed the
  rename passes `check` and `test`; I did not run `test:content` to confirm
  `evidence.spec.ts` catches it. I read the spec and it asserts
  `label: "Invite a collaborator"` on the real page, so it should — but that is
  read from the source, not observed.
- **The three captures are one browser, one platform, one moment.** Chromium
  headless on Windows, at the fixture's own seed. A field a different browser
  omits would not show here.
- **`domain/.test-build/` and `apps/extension/build/` were not regenerated**, for
  the reason every worker this wave has given: doing so means running the suites
  without a label and racing everyone. `domain/.test-build/` now also lacks a
  bundle for `page-evidence/tests/capture.test.ts`.
- **Byte cost of the packet was not re-measured.** I removed a field
  (`pendingNativeDialog`) that could never be written and added none, so the
  packet cannot have grown, and `limits.test.ts`'s 3,000-byte failure-gate row
  still passes — but I did not take a before-and-after byte count.
- **Nothing was committed.** As instructed.

## Open questions or contradictions found

- **The brief's premise that a shared type joins the two sides is only
  three-quarters true, and the missing quarter is worth a decision.** A
  conditional spread defeats TypeScript's excess-property check, so the
  producer's optional fields — which is most of them — are outside the compiler's
  reach. Either the `present<T>()` helper above lands, or the plan should record
  that the browser harness is the producer-side gate for optional field names
  and that regenerating `capture.ts` is part of changing the producer. Choosing
  neither leaves a hole that reads as closed.
- **`w3-llm-packet`'s report table titled "the names the packet reads" is still
  unmarked as superseded**, as `v-evidence-readers` asked. It reads as a
  contract and was a guess. Now that a real contract exists, that table should
  point at `domain/src/page-evidence/types.ts` rather than list names.
- **Three of the four remaining free-form fixtures are in files that three
  workers have already edited this wave.** Whoever pins them should do it in one
  pass on a still tree, not as a side effect of another change.
- **The capture regeneration recipe has no committed runner.** That was the
  supervisor's call and I think it is the right one for now, but it means the
  next person to change the producer has to reconstruct a spec from a comment.
  If a `page-evidence-capture.spec.ts` is wanted under `e2e/content/tests/`, it
  is about 30 lines and I can hand over exactly what I ran.
- **`elements.changed: 14` and `recentlyInteracted: 2` in the `modal-flows`
  capture are artefacts of the capture procedure**, not of the page: the spec
  clicked two controls before capturing, and the diff is against the previous
  snapshot in that frame. They are honest values for that sequence, and they are
  the only two fields in any capture whose value depends on what the capture
  script did rather than on what the page is. Worth knowing before anyone reads
  a meaning into them.
