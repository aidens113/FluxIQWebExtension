# Report: w3-state-identity

Worker: `w3-state-identity`. Wave 3, parallel: Phase 1.3 step 6 and the
recording-state half of Phase 1.4 step 3 — split `web-state.ts` by
responsibility, stop `elementStateId` collapsing repeated controls, and make
the element counts tell the truth about what the state left out.

## Outcome

**Done**, with one seam the brief did not include (see
[The declaration the brief left out](#the-declaration-the-brief-left-out)).
`domain/src/recording/web-state.ts` is now a directory of twelve modules, the
two behaviour changes are made and tested, domain `check` passes, and all 28
new tests pass. Nothing under `domain/src/recording/` appears in the structure
audit, and the extension's production sources still type-check against the
changed domain barrel.

The seam is small but real: two new state paths are produced that
`domain/src/recording/domain.ts` does not declare, and one declared label is
now wrong. That file belongs to `w3-domain-contracts`, which my brief lists
under "Must not touch".

## What changed and why

### 1. The split, first, because the baseline refuses growth

`web-state.ts` was 644 lines — past the 400-line advisory — and held six
unrelated jobs. It is gone (`git rm`), replaced by
`domain/src/recording/web-state/`, whose `index.ts` answers the same import
specifier: every existing `./web-state` / `../recording/web-state` import
resolves to the directory barrel unchanged, so no file outside my Owns needed
editing. Largest module is now 207 lines.

| Module | Holds |
| --- | --- |
| `index.ts` | The public surface, named explicitly, not `export *` |
| `types.ts` | The five recorder input types |
| `compact-json-object.ts` | Dropping `undefined` keys before the wire |
| `geometry.ts` | Rect → `StateBounds`, anchors, frame offset, screenshot scaling |
| `element/identity.ts` | What an element is called; the state-key assigner |
| `element/kind.ts` | Actionable / interactable / primary control / semantic text / enabled |
| `element/selection.ts` | Which elements enter state, the cap, the counts |
| `element/index.ts` | The element barrel |
| `action-target.ts` | One element described for an action (both target shapes) |
| `state-values.ts` | `putStateValue`, the element payload, the element value |
| `visual-frame.ts` | The `screen` and `document` frames and their ids |
| `snapshot.ts` | `createWebAutomationStateFromSnapshot` |
| `tab-state.ts` | `createWebAutomationStateFromTabs` |

Two structural constraints shaped this and are worth recording, because the
next split in this repository will hit both. The naming rule fails at **three**
files sharing a prefix, not four, so `element-identity/-kind/-selection` would
have failed the audit; they became `element/`, which the rule's own remediation
message asks for and which the imports rule explicitly permits to reach back
into its parent's modules. And the public surface stayed exactly what
`web-state.ts` exported plus the new selection types: `putStateValue`, the
geometry conversions and `compactJsonObject` are deliberately **not** on the
barrel, because a second way to write a state value would lose the namespace
header, the default confidence and the undefined-stripping that only hold
because there is one.

The old test moved with its subject: `recording/tests/web-state.test.ts` →
`web-state/tests/snapshot.test.ts` plus `element/tests/{identity,selection}.test.ts`.
Its assertions were carried over intact, converted from top-level asserts to
`node:test` blocks to match the wave's other suites.

### 2. `elementStateId` no longer collapses repeated controls

A shared `data-testid` or `id` produced one state key, and `filterStateElements`
deduped on that key — so **every row's delete button but the first was dropped
from state entirely**, along with every card's "Add to cart" and every repeated
form group. The key is now assigned across the whole selection instead of
per element:

- `elementStateId(element)` still computes the base key exactly as before.
- `elementStateIdAssigner(reservedIds?)` hands out final keys. The first
  occurrence keeps the bare key; later ones get a positional suffix —
  `row.action`, `row.action.2`, `row.action.3`.
- Keys are assigned in **document order**, then the selection is re-sorted back
  into relevance order. A suffix taken from the relevance rank would rename an
  element whenever its score moved, which is the opposite of what a state path
  is for.
- The id-based dedupe in `filterStateElements` is gone. Nothing else replaced
  it: a duplicate entry in the recorder's list is now two state entries rather
  than one silently discarded control.

Two collisions the old code could not see are also closed, both tested: an
element whose own identifier sanitizes to an already-issued suffixed key
(`row-action-2` alongside two `row-action`s) keeps counting rather than
overwriting a sibling, and an element carrying `data-testid="count"` is filed
at `elements.count.2` rather than overwriting `elements.count` with a JSON
blob. The summary keys are declared once, in `selection.ts`, as
`WEB_AUTOMATION_ELEMENT_SUMMARY_STATE_IDS`.

`webAutomationActionVisualTargetFromElement` gained an optional `stateId` in its
input so a caller holding a selection's key can pass it; without one it
rebuilds the base key, which is what it has always done and what
`gateway-mapping.ts` and the extension's three call sites still get.

### 3. `filterStateElements` reports what it left out

It returns a record now, not an array:

```ts
{ elements: WebAutomationStateElement[], total, eligible, captured, truncated }
```

`elements` pairs each kept element with its assigned key, so nothing downstream
can rebuild a key and lose the suffix. The counts are distinct facts, and the
distinction is the point:

- `total` — every element the page offered, before any filtering.
- `eligible` — how many were worth capturing.
- `captured` — how many fit under the cap.
- `truncated` — `eligible > captured`: the cap dropped elements that were worth
  keeping. **Not** `captured < total`, which is the ordinary case of a page full
  of layout nodes carrying no evidence and would be true almost everywhere.

`createWebAutomationStateFromSnapshot` writes three paths from it:
`elements.count` is now the **pre-filter total** (it was the kept count),
`elements.captured` is the kept count, and `elements.truncated` is the flag. A
page of 1,600 elements and a page of three were previously indistinguishable
in state; a consumer can now see that the element list is a selection.

## The declaration the brief left out

`domain/src/recording/domain.ts` declares the `web` namespace's state paths, and
my change makes it inaccurate. It is `w3-domain-contracts`' file, and my brief
lists it under "Must not touch", so I left it alone. Three lines are needed:

1. `elements.count`'s label is `"Captured element count"`. It is now the page
   total. Suggested: `"Page element count"`.
2. `elements.captured` (`integer`, `elementKind: "count"`) is produced and
   undeclared. Suggested label: `"Captured element count"`.
3. `elements.truncated` (`boolean`, `elementKind: "status"`) is produced and
   undeclared. Suggested label: `"Element list truncated"`.

Nothing fails today because of this — the `elements.*` wildcard declaration
covers the two new paths for validation, and the full domain suite passes — so
this is a documentation-of-contract gap, not a broken build. But the panel
reads these declarations for labels and grouping, so left as it is the state
inspector will show a mislabelled count and two unlabelled rows.

`w3-domain-contracts` is editing `domain.ts` in this same wave (removing the
`elements.*.<field>` paths), so the supervisor should hand it these three lines
rather than opening a third edit of the file.

## Commands run and observed results

`DOMAIN_TEST_BUILD_LABEL=w3-state-identity` (and `EXTENSION_TEST_BUILD_LABEL`
for the extension command) were set throughout. Exit status was captured by
redirecting to a file and echoing `$?`, never through a pipe. No `pnpm build`
and no `pnpm lab` run.

**Baseline, before any edit** (ten workers were already running):

- `pnpm --filter @fluxiq-web-extension/domain check` → **exit 0**.
- `pnpm --filter @fluxiq-web-extension/domain test` → **exit 0**,
  `# tests 90 # pass 90 # fail 0`.

**After the change:**

- `pnpm --filter @fluxiq-web-extension/domain check` → **exit 0**, no
  diagnostics. Re-run at the end: **exit 0**.
- `tsc -p tsconfig.test.json --noEmit --listFiles` in `domain/` → **exit 0**,
  and all **16** new files appear in the file list (run because a type check
  that silently skipped them would prove nothing).
- `pnpm --filter @fluxiq-web-extension/domain test` → **exit 1**,
  `# tests 188 # pass 187 # fail 1`. **All 28 of my tests pass** (verified by
  matching each test name against the `ok` lines: 28 of 28). The one failure is
  `runtime/llm-evidence/tests/limits.test.mjs` — `w3-llm-packet`'s file, being
  rewritten right now (`git status` shows `llm-evidence.ts` deleted and
  `llm-evidence/` untracked). An earlier run of the same suite failed two
  *different* llm-evidence tests and had four fewer tests in it, which is that
  worker's tree moving between runs, not a flake in mine. Nothing under
  `recording/web-state` failed in any run. Per the wave's rules I re-ran before
  reporting: the failure reproduced and stayed inside `llm-evidence/`.
- `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (a copy of
  `.git/index` with the new tree added) → **exit 1**, `27 warning(s)`,
  **2 violations, neither mine**:
  `apps/extension/src/runtime/tests/result-mapping.test.ts` reaching past
  `content/evidence`'s barrel (`w3-evidence`), and `docs/working/README.md`
  being out of date. `grep "domain/src/recording"` over the full audit output
  returns **nothing** — no warning and no violation names any file I own, and
  the pre-existing `web-state.ts: 644 lines` advisory is gone. Re-run once:
  identical.
- `pnpm --filter @fluxiq-web-extension/extension check` → **exit 2**, one error,
  in `src/content/evidence/tests/changes.test.ts` (`w3-evidence`'s new test, an
  `exactOptionalPropertyTypes` mismatch on `DomElementDescriptor`). Re-run:
  identical single error. To separate that from my change I ran the production
  config alone: `tsc -p tsconfig.json --noEmit` in `apps/extension` → **exit 0**.
  The extension's sources compile against the changed domain barrel; the failure
  is in another worker's test file.
- `git status --short` / `git diff --cached --name-status` → my changes are the
  16 added files plus the two deletions.

## Not verified

- **No live browser validation.** The recorder's `dom-snapshot.ts` produces the
  input this projection consumes; I proved the projection against constructed
  inputs, not against a page. Whether a real page ships duplicate `data-testid`s
  in the shape the tests assume is unproven here — the `product-catalog` and
  `infinite-feed` fixtures would settle it, and `w3-evidence` owns the spec that
  runs them.
- **No `pnpm build`, no `pnpm lab`, no extension `test` / `test:content`.** The
  first two are the supervisor's per the wave rules; the last two exercise no
  file I touched, and the extension package is mid-edit by two other workers.
- **The three `domain.ts` lines were not applied or compiled.** The suggested
  types and labels above are reasoned from the neighbouring declarations.
- **Downstream readers of `elements.count`.** I grepped `apps/extension/src`,
  `packages/`, `e2e/`, `scripts/` and `docs/architecture/`: the only reference
  anywhere is the declaration in `domain.ts`. If a Flow authored against a live
  panel reads `web.elements.count` expecting the captured count, its meaning has
  changed and no test in this repository would notice.
- **State-path stability across a page edit.** The first occurrence keeps the
  bare key specifically so unrepeated pages see no churn, but a page that gains
  a second control with an existing `data-testid` will still add
  `<key>.2` where Core previously saw nothing. That is the intended behaviour,
  not a regression, and it is untested against Core's transition comparison.

## Open questions or contradictions found

- **`truncated` means two different things in this wave.** Mine is
  `eligible > captured` — the cap dropped something worth keeping.
  `w3-evidence`'s brief asks for "`truncated` with pre-filter totals" in
  `content/dom-snapshot.ts`, and `w3-llm-packet`'s for a `truncated` at the byte
  budget. Three flags with the same name on one evidence path will be read as
  one fact by whoever consumes them. Worth one sentence in the plan fixing the
  vocabulary; I could not coordinate it from inside a parallel brief.
- **`elements.count` changed meaning rather than gaining a sibling.** The brief
  said to report the pre-filter total in `elements.count`, so that is what I
  did, and `elements.captured` carries the old meaning. The alternative —
  leaving `count` alone and adding `elements.total` — would not have broken any
  reader. Flagging it because it is a wire-visible change of meaning on a path
  that already existed, and it is cheap to invert if the supervisor prefers.
- **`domain/src/recording/` still has no barrel**, so `domain/src/index.ts` and
  `client/index.ts` reach into `./recording/web-state` directly. The audit
  permits it (no barrel, no crossing), and adding one would touch files I do not
  own, but the policy says a barrel in every directory and this directory is now
  the only thing standing between the two package barrels and five modules.
- **I staged my two deletions in the real git index** (`git rm`), not in the
  scratch one. The rule about a scratch `GIT_INDEX_FILE` is about the audit
  reading new files, and a deletion cannot be staged that way without also
  removing the worktree file; the new files were added only to the scratch
  index. Worth knowing before the supervisor commits: `git status` will show
  `D domain/src/recording/web-state.ts` and
  `D domain/src/recording/tests/web-state.test.ts` already staged.
