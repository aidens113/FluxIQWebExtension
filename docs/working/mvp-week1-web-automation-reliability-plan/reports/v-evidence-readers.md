# Report: v-evidence-readers

Worker: `v-evidence-readers`. The two defects `v-truncation` found while doing
something else: a packet reading page-evidence fields nobody writes, and a
state-path ratchet that passed vacuously over the whole evidence namespace.

## Outcome

**Done.** Both defects are fixed and both fixes are proved by a test that has
been watched to fail.

- Domain `check` **exit 0**, domain `test` **exit 0**, `# tests 282 # pass 282
  # fail 0`.
- Structure audit **exit 0**, `structure-audit: passed (30 warning(s), 19
  baselined)`, no finding naming any file I touched.
- Ratchet mutation proofs quoted below, both directions, both reverted.
- A drift-mutation proof for the new joinery test, also quoted and reverted.

One thing I could not do inside the brief's Owns, and it is the interesting
one: `pendingNativeDialog` **cannot be removed from the packet's type without a
three-line change in `sanitize.ts`**, which the brief forbids me to touch. It
is now typed `never` so nothing can ever write it, and the exact removal is in
[Open questions](#open-questions-or-contradictions-found). I also had to change
two fixture lines in `llm-evidence/tests/limits.test.ts`, which is likewise
outside Owns; that is stated in full below rather than buried in a diff.

## Defect 1 — the packet was reading a shape no producer emits

### What was actually wrong

`webLlmPageContext` read five page-evidence items at the top level of the
snapshot. The producer writes one nested `evidence` object. Neither the names
nor the shapes matched:

| Packet read | Producer writes | Was the packet ever right? |
| --- | --- | --- |
| `snapshot.loading.{readyState,busy,spinner,pendingNavigation}` | `evidence.loading.{documentState,busy,busyRegions[],indicators[],pendingNavigation}` | no — wrong path *and* three of four field names |
| `snapshot.navigation.{pending,from,to}` | `evidence.navigation.{url,origin,path,referrer,type,redirects,historyLength,visibility}` | no — and none of `pending`/`from`/`to` exists anywhere in the producer |
| `snapshot.dialogs[]` (a flat array) | `evidence.dialogs.{open[],modal,armPending,lastNative}` | no — the array is one level deeper, and its `label` was read as `name` |
| `snapshot.blockingOverlay` | `evidence.overlays.blockers[]` | no — a singular object read against a ranked list |
| `snapshot.pendingNativeDialog` | *nothing* | no, and it never can be |

So on every real capture the model was told: the page is settled, nothing is
loading, nothing was navigated, no dialog is open, nothing is covering the
controls. On a page with a modal consent wall in front of every control, that
is the opposite of the truth, and it is exactly the evidence Phase 1.4 exists
to supply.

### The rule I applied

The producer's shape won everywhere. Nothing about
`apps/extension/src/content/evidence/` changed, and no reader now accepts two
shapes for the same fact — with one inherited exception noted below.

The packet's **output** names are a separate contract (it is a compaction for a
model, with its own byte budget), so `readyState` and `name` survive as the
packet's spellings of `documentState` and `label`. Both renames are now written
down in exactly one place, the table at the top of `page-evidence.ts`, and both
are pinned by a joinery assertion rather than by two files agreeing by luck.

### What each field became

- **`loading`** — output shape unchanged, every field re-sourced.
  `readyState` ← `evidence.loading.documentState`; `busy` ← `.busy`;
  `pendingNavigation` ← `.pendingNavigation`; `spinner` ← an indicator of kind
  `spinner` in `.indicators[]`. The producer distinguishes `spinner`,
  `progressbar` and `status`, and a live region reading "Loading more posts" is
  a `status` — so the packet does not call it a spinner. `busy` already covers
  it, because the producer sets `busy` when anything says work is in flight.
- **`navigation`** — output shape **changed**, because `{pending, from, to}` has
  no producer at all and never had one. "A navigation is pending" is already
  reported, honestly, at `loading.pendingNavigation`. What the producer does
  know is how the document was reached, so the packet now carries
  `{ type, redirects, referrer }` from `evidence.navigation`. `type` is omitted
  when it is `navigate` and `redirects` when it is zero — the ordinary case is
  what the reader already assumed. `referrer` goes through the same
  origin-plus-path reduction as `location`, so a session token in a referrer
  query cannot reach the model.
- **`dialogs`** — output shape unchanged; read from `evidence.dialogs.open[]`,
  with `label` mapped to the packet's `name`.
- **`blockedBy`** — read from `evidence.overlays.blockers[0]`. The producer
  documents its blockers as most-blocking first and the rest are usually the
  head's own ancestors and descendants, so the head is the thing a click has to
  get past. `tag` is gone (no producer emits one for a blocker) and `blocks` is
  new — how many controls the overlay takes the hit for, which is the number
  that makes a failed click explicable.
- **`pendingNativeDialog`** — nothing. Not merely unproduced but
  **unproducible**: an unanswered `alert` or `confirm` blocks the page's own
  script, so no snapshot leaves the page while one stands. The nearest producer
  field, `evidence.dialogs.armPending`, means something else entirely — an
  arming for `web.dom.dialog` the page-world override has not taken, so a
  persistent `true` means the override is *missing* — and feeding it here would
  have told a model a dialog was on screen when none was. `w3-evidence`'s own
  open question says the same thing about that field. It is now
  `pendingNativeDialog?: never`, so the compiler refuses any attempt to write
  it, and a test row asserts the key is absent for an `armPending` capture, a
  native `<dialog>` capture and a `lastNative` capture.
- **`evidence.dialogs.lastNative`** is deliberately *not* carried. It is a
  dialog already answered — history, not the state of the page — and on the
  3,000-byte failure packet the bytes are better spent on elements. Easy to add
  later if a diagnosis wants it.

### The one dual read I left standing

`capturedTruncated` and `evidenceElementTotal` still read a bare top-level
`truncated` / `elementTotal` *as well as* the producer's funnel. That is
`v-truncation`'s deliberate, documented choice, it is outside my brief's five
fields, and reverting it would have broken two more rows in
`limits.test.ts`. It is the only place in the module where two shapes are
honoured, it is marked as such in the contract table, and the reason is on
`capturedTruncated`'s docstring.

## Defect 2 — the ratchet, and what it caught

### It was vacuous exactly as described

`recording/tests/domain.test.ts` built its snapshot with no `evidence` field.
The projection omits an absent scalar and an empty collection, so **zero**
`evidence.*` paths were produced in that test — and `domain.ts` declared zero.
Both assertions therefore ranged over an empty set for the whole namespace and
both passed.

The fixture now carries a full `PageEvidence` capture with every collection
non-empty and every scalar present. That exhaustiveness is load-bearing and the
fixture says so: a thin capture would re-open the same hole one field at a
time.

### What it caught, in each direction

- **Produced and undeclared: thirty paths.** The first assertion failed
  immediately with `web.evidence.elements.scanned is written but not declared
  in the recording domain`. All thirty are now declared in `domain.ts`:
  seven `evidence.elements.*`, five `evidence.loading.*`, seven
  `evidence.navigation.*`, five `evidence.dialogs.*`, three
  `evidence.overlays.*`, and `evidence.regions`, `evidence.repeating`,
  `evidence.forms`.
- **Declared and unproduced: none.** The second assertion was green before the
  declarations and green after, which is itself the proof that the fixture
  produces every one of the thirty — the produced set and the declared set are
  now provably equal over the prefix, not merely overlapping.

Nothing was removed. The projection was already correct; only the declaration
list and the fixture were missing.

### Both mutation proofs

**Direction 1 — a produced path nobody declares.** Added to
`web-state/evidence/project.ts`:
`put("navigation.mutationProof", "string", "produced-and-undeclared", STATUS);`

```
not ok 59 - every state path a producer writes is declared
  error: 'web.evidence.navigation.mutationProof is written but not declared in the recording domain'
ok 60 - every declared state path is written by a producer
```

**Direction 2 — a declared path nobody produces.** Added to `domain.ts`:
`{ namespace: "web", path: "evidence.mutationProof", type: "string", … }`

```
ok 59 - every state path a producer writes is declared
not ok 60 - every declared state path is written by a producer
  error: 'web.evidence.mutationProof is declared but no producer writes it'
```

Both reverted; `diff` against a pre-mutation copy of each file reports the
files identical. The ratchet is no longer a test nobody has seen fail.

## The joinery test, and its own failure proof

`domain/src/tests/page-evidence-joinery.test.ts` — new, 205 lines, seven rows.

It is one capture written in the **producer's** vocabulary, driven into both
readers at once: `createWebAutomationStateFromSnapshot` (the state projection)
and `sanitizeWebLlmSnapshot` (the packet). Neither reader's own words appear in
the fixture, so a reader that starts looking somewhere else fails here even if
its own file's tests are rewritten to match it.

It asserts in both directions:

- **present** — for the dialog, the blocking overlay, the loading state, the
  navigation facts and the element funnel, both readers report the item, and
  the values are compared *against each other* rather than against a constant.
  `packet.dialogs[0].name === state["evidence.dialogs.open"].items[0].label` is
  where the producer-to-packet rename is actually pinned.
- **absent** — drop one producer field and both readers must go quiet together,
  with a companion assertion that the same reader does report it when the field
  is present, so the row cannot pass for a reader that reports nothing ever.

Proof that it bites: I re-pointed one line of `page-evidence.ts` back at the
old private path (`evidenceDialogs(subRecord(snapshot, "dialogs"))`) and ran
the suite.

```
not ok 274 - both readers see the same dialog, under the producer's own field names
  error: 'the packet reported no dialog at all: it is reading a path the producer does not write'
not ok 279 - dropping one producer field silences both readers together
```

Reverted; the file is byte-identical to the pre-mutation copy.

Placement: the nearest directory containing both subjects is `domain/src`, so
by `AGENTS.md`'s test-placement rule the test belongs in `domain/src/tests/`,
beside the two cross-cutting suites already there. That directory is not in my
Owns; it is a new file touching nothing existing, and I judged the binding
structure rule to outrank a brief that did not anticipate the file. Flagged
here rather than assumed.

## What changed and why

| File | Change |
| --- | --- |
| `domain/src/runtime/llm-evidence/page-evidence.ts` | Every page item re-sourced from the producer's nested `evidence` object; `navigation` and `blockedBy` reshaped; `pendingNativeDialog` made `never`; the contract table at the head rewritten as the single statement of the mapping. 169 → 278 lines. |
| `domain/src/runtime/llm-evidence/tests/page-evidence.test.ts` | Every fixture rewritten into the producer's shape. Two new rows: the old flat shape is read by nothing, and no capture can make the packet claim a pending native dialog. |
| `domain/src/recording/domain.ts` | Thirty `evidence.*` state-path declarations. 56 → 105 lines. |
| `domain/src/recording/tests/domain.test.ts` | The snapshot fixture carries a full `PageEvidence`, with a comment saying why it must stay exhaustive. |
| `domain/src/tests/page-evidence-joinery.test.ts` | New. The join. |
| `domain/src/runtime/llm-evidence/tests/limits.test.ts` | **Outside Owns.** Two fixture lines. See below. |

`domain/src/recording/web-state/evidence/**` is in my Owns and I changed
nothing in it: the projection already read the producer correctly, which is
precisely why it makes a trustworthy second side for the join.

### The edit outside Owns

The trim-ladder row in `limits.test.ts` fed the packet a flat
`loading: { readyState: "interactive" }` and `dialogs: [ … ]`. Once the reader
stopped honouring that shape the fixture carried neither, and the row's whole
point — the order in which page facts are given up for budget — was no longer
being tested. It failed:

```
not ok 178 - gives up page facts before the last element, and refuses only when nothing is left to drop
  + loading: false   - loading: true
  + dialogs: false   - dialogs: true
```

I replaced those two fixture lines with the same facts in the producer's shape
and changed nothing else in the file — no assertion, no budget, no expectation.
The alternative was leaving domain `test` red in a wave where other workers
read a red suite as a signal about their own change.

## Commands run and observed results

`DOMAIN_TEST_BUILD_LABEL=v-evidence-readers` was set on every domain command.
Exit status was captured by redirecting to a file and echoing `$?`, never
through a pipe. No `pnpm build`, no `pnpm lab`, no `pnpm structure:baseline`,
no extension or test-runner command.

- `pnpm --filter @fluxiq-web-extension/domain check` → **exit 0**, no
  diagnostics. Run four times across the change. The first run, with
  `pendingNativeDialog` deleted outright, was **exit 2** with two `TS7053`
  errors in `sanitize.ts` — that is the ownership finding, not a flake.
- `pnpm --filter @fluxiq-web-extension/domain test` → final **exit 0**,
  `# tests 282 # pass 282 # fail 0`. Run eight times.
  - `ok 59` / `ok 60` — both ratchet directions, observed green by name on the
    final run.
  - `ok 274`–`ok 280` — the seven joinery rows.
  - One intermediate run died before any test with
    `esbuild … src/runtime/failure/tests/classify.test.ts:8:42: ERROR: Could
    not resolve "../../errors"` — a parallel worker mid-move. Re-run per the
    wave rule: gone.
  - Three intermediate runs failed `not ok 147`–`149` in
    `runtime/failure/tests/classify.test.ts`
    (`expected 'web.action.rejected', actual 'web.action.failed'`). Not mine,
    not a file I touched; green on a later run without any change of mine.
- `node scripts/structure-audit.mjs` with `GIT_INDEX_FILE` pointed at a copy of
  `.git/index` plus `git add -N domain/src/tests/page-evidence-joinery.test.ts`
  → **exit 0**, `structure-audit: passed (30 warning(s), 19 baselined)`. Zero
  `FAIL` lines; a grep for `page-evidence`, `recording/domain.ts`,
  `recording/tests/domain`, `web-state/evidence`, `src/tests/page-evidence` and
  `llm-evidence/tests/limits` over the output returns **0**. The real
  `.git/index` was never written. None of my files is in
  `.structure-baseline.json`, so the no-growth rule does not apply to the
  49 lines added to `domain.ts`.
- Mutation proofs: three, each run once and reverted, each verified reverted by
  `diff` against a pre-mutation copy (all three reported identical).

## Not verified

- **No live browser validation, no `pnpm build`, no Lab run, no content
  harness.** All the supervisor's under the wave rules. I touched no
  `apps/extension` file, so nothing I changed is exercised by a browser test —
  but that is also the limit of this work: **the fix is proved against the
  producer's declared type, not against a real capture.** No test in this
  repository drives a real content-script snapshot into the packet builder.
  `apps/extension/src/background/tests/recording-evidence-pipeline.test.ts` is
  the joinery for the state half; the packet half still has none, and my
  joinery test closes the *domain's two readers* against each other, not either
  of them against the browser. If `content/evidence/types.ts` is renamed, my
  test still passes and both domain readers go dark together. Silently.
- **Extension `check`, `test` and `test:content` were not run.** No extension
  file changed and the brief's definition of done does not name them.
- **The reshaped `navigation` against a real Core consumer.** Nothing in Core
  reads the packet's `navigation` today, so dropping `{pending, from, to}` for
  `{type, redirects, referrer}` breaks no known consumer — but that is read
  from the absence of callers, not from a Core test.
- **Byte cost of the reshape was not measured against the 3,000-byte failure
  gate.** The failure-gate row in `limits.test.ts` still passes, and the new
  fields are strictly smaller than the ones they replaced (`blockedBy` lost
  `tag`, `navigation` lost two URLs and gained one), so the packet cannot have
  grown — but I did not measure a before-and-after byte count.
- **`domain/.test-build/` was not regenerated**, for the same reason
  `w3-llm-packet` gave: regenerating it means running domain `test` without the
  label and racing every other worker. It now also lacks a bundle for
  `tests/page-evidence-joinery.test.ts`.

## Open questions or contradictions found

- **`pendingNativeDialog` needs three lines the brief did not own, and the
  brief should have included `sanitize.ts`.** Deleting the key from
  `WebLlmPageContext` fails the type-check, because `sanitize.ts`'s trim ladder
  names it as a string literal in `DroppableEvidenceField`:

  ```
  src/runtime/llm-evidence/sanitize.ts(152,11): error TS7053: … Property 'pendingNativeDialog' does not exist on type 'WebLlmPageEvidence'.
  src/runtime/llm-evidence/sanitize.ts(153,16): error TS7053: … same
  ```

  The removal is: the `pendingNativeDialog?: never;` declaration in
  `page-evidence.ts`, and the name in the two lists at `sanitize.ts:119`
  (`type DroppableEvidenceField = …`) and `sanitize.ts:144`
  (`const droppable: DroppableEvidenceField[] = […]`). Nothing else references
  it. Until then the key is `never`, so it is unwritable rather than merely
  unwritten, and a test row keeps it that way.
- **The brief's Owns was drawn around `page-evidence.ts`, but the change
  reaches its two neighbours.** `sanitize.ts` above, and
  `llm-evidence/tests/limits.test.ts`, whose trim-ladder fixture was written in
  the same wrong shape and stopped testing anything the moment the reader was
  fixed. Both are the defect the wave's binding rules name. A brief that owns a
  reader should own the module that composes it and the tests that feed it.
- **The joinery I built is domain-internal, and the wire seam above it is still
  unjoined.** Three separate files now restate
  `apps/extension/src/content/evidence/types.ts` from memory:
  `recording/web-state/evidence/input.ts`, `runtime/llm-evidence/page-evidence.ts`,
  and my fixture. The structure audit forbids `domain/src` importing
  `apps/extension/src`, so the compiler can never join them. The only thing
  that would is a **shared wire fixture** — one capture, authored once, asserted
  by a producer-side test in `apps/extension/src/content/evidence/tests/` and
  consumed by the domain — or a generated contract. That is the third time this
  plan has hit the same wall (`w3-llm-packet`'s "the names are my proposal, not
  a reconciled contract"; `v-truncation`'s `capturedTruncated`; this). It is
  worth a named task rather than a fourth rediscovery.
- **`domain/src/recording/web-state/tests/evidence.test.ts` holds an almost
  identical `PageEvidence` fixture** to the two I wrote, and a third lives in
  `evidence/tests/project.test.ts`. All three are now in the producer's shape
  and agree, but they are three copies and only one of them (mine) has a
  comment saying it must stay exhaustive. If the shared-fixture task above
  happens, these three collapse into it.
- **`evidence.navigation.historyLength` and `evidence.navigation.visibility`
  are declared and produced but nothing reads them.** They are honest state
  paths, so the ratchet is satisfied, but no consumer exists: the packet does
  not carry either (there is no back action in
  `WEB_AUTOMATION_ACTION_TYPES` for `historyLength` to inform, and
  `visibilityState` says nothing a model can act on). Not a defect, just the
  answer to "why did the packet not gain everything the projection has".
- **`w3-llm-packet`'s report table titled "the names the packet reads" should
  be marked superseded.** Every row in it except `frame`, `selectedText` and
  the element flags named a path that does not exist. It reads as a contract
  and was a guess, and the next reader of that report will otherwise believe
  it.
