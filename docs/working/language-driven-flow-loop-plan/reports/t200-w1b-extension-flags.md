# t200-w1b-extension-flags report: the information behind the removed ranking is back, as flags

Worker `t200-w1b-extension-flags`, tree `C:/Users/osrs_/FluxStuff/fxwork/t200/!FluxIQWebExtension`,
branch `task/t200-model-sees-whole-page`. Nothing was committed.

## Outcome

**Done.** All four gates in the brief pass:

- `check` exits 0;
- `test` passes 1490 of 1490;
- `build` exits 0;
- `structure-audit` passes.

No browser or Playwright run was made, as the brief required.

## What changed and why

### 1. Lead statements, restored as information

**`apps/extension/src/content/evidence/lead-statements.ts`** is restored from HEAD (t174 F10):

- The rule is HEAD's, clauses 1-4 unchanged: own words under a wordless
  parent, at most 200 characters, `main` is the nearest landmark (a labelled
  `region` is passed through), and no control or record on the way up.
- `mainLeadStatements(candidates, documentOrder)` becomes
  `isLeadStatement(element): boolean`. The cap of three and the sort are gone.
- `dom-snapshot.ts` asks it of every rendered element and writes
  `leadStatement: true` on every element that matches. It moves nothing.
- t200-w1 deleted `isPageControlElement` and `isPrimaryControlElement` from
  `element-traits.ts`, and the HEAD rule needed them. Their tag and role lists
  are now private constants in `lead-statements.ts` (`CONTROL_TAGS`,
  `CONTROL_ROLES`, contentEditable). They are not re-exported.

**`evidence/tests/lead-statements.test.ts`** is restored and adapted, 7 rows:

- the no-results page marks the count and both empty-state lines, and nothing else;
- header, footer and rail words are not marked;
- control words and a bold word inside a line are not marked;
- all seven of seven lines are marked (no cap);
- an item's words and long prose are not marked;
- a labelled region inside `main` counts;
- a page with no `main` marks nothing.

### 2. Front layer, restored as information

**`apps/extension/src/content/evidence/front-layer.ts`** is new. It holds HEAD's
`isFrontLayer` combined with HEAD `dom-snapshot.ts`'s `inFrontLayer`:

- An element is flagged when it, or one of its seven nearest ancestors, has
  computed `position` `fixed` or `sticky`. That is HEAD's
  `MAX_FRONT_LAYER_DEPTH = 8`, counting the element itself.
- The walk stops at `body` and `html`.
- It also asks every open shadow host above the element (`shadowHostsOf`),
  with the same walk.

It is exported as `frontLayerTest()`, a per-capture tester. The tester
remembers each element's computed position, so a capture reads each element's
style once. A test proves 101 reads for 101 elements with 50 descendants
sharing one ancestor.

It is asked of **every** rendered element, not only of page controls as HEAD
did, because the flag is a fact and no longer a promotion. `dom-snapshot.ts`
writes `frontLayer: true` on each match. `evidence/controls.ts` is unchanged.

**`evidence/tests/front-layer.test.ts`**, 5 rows:

- fixed banner: the control and the banner are flagged, the page content is not;
- sticky counts, relative and absolute do not;
- a shadow-root control is flagged through its fixed host, and a static host flags nothing;
- the depth bound, and that the walk stops at body and html;
- the position memo.

### 3. Layer kind on dialogs and blockers

**`apps/extension/src/content/action-runtime/interference/layer-kind.ts`** is new.
It exports `layerKind(layer): LayerKind | undefined`, and each kind is one call
to an existing pure classifier:

| Kind | Classifier call |
| --- | --- |
| `robot_check` | `robotCheckIn(layer, "dialog") !== undefined` (`challenge-evidence.ts`; self-clearing or person-only) |
| `consent` | `isConsentLayerText(boundedLayerText(layer))` |
| `rate_limit` | `isRateLimitLayerText(boundedLayerText(layer))` |

- The order is robot check, then consent, then rate limit. A check page that
  links "Privacy policy" stays `robot_check`. Consent comes before rate limit
  because that is `way-out.ts`'s order.
- **Skipped:** `promotion` and `assistant`. No existing classifier recognises
  either. The dismissal vocabulary closes a promotion but cannot tell one from
  another dialog, and nothing names a chat or assistant widget. Producing
  either would need a new heuristic, so neither is produced.
- `landed-challenge.ts` is background-side and only relays the content
  script's `challengeIn`. The pure call is `robotCheckIn`, which it ultimately
  reads.

The file is exported through `interference/index.ts`. Consumers:

- `evidence/dialogs.ts` sets `kind: layerKind(element)` on each open dialog.
- `evidence/overlays.ts` sets it on each blocker.
- Both import from the `../action-runtime/interference` barrel.

**Placement.** My first placement, `evidence/layer-kind.ts` importing the leaf
files, failed the structure audit's barrel rule:
`FAIL [imports] ... 3 import(s) reach into another directory's files instead of its barrel`.
Inside `interference/` it may import its own directory's files and its
parent's `challenge-evidence.ts`.

This creates an import cycle between the `evidence/` and `interference/`
barrels. `covering-layer.ts` already imports `isDrawnControl` from `evidence`.
I checked that the cycle is harmless:

- each side calls the other only inside function bodies;
- every top-level constant on both sides is a literal;
- `click-gesture.ts` has no imports.

The file's header comment says so and asks that it stay that way.

**`interference/tests/layer-kind.test.ts`**, 5 rows. They use the fixtures' own words:

- the everything-store cookie banner → `consent`;
- social-network-feed "You can try again in <span>12</span> seconds." → `rate_limit`;
- self-clearing and person-only checks → `robot_check`;
- a check with a privacy link → `robot_check`;
- a spin-to-win promotion and a newsletter layer → `undefined`.

`evidence/types.ts` adds the alias `WebAutomationLayerKind as LayerKind`, and
`evidence/index.ts` re-exports it.

### 4. Descriptor type and frame merge

**`apps/extension/src/shared/protocol.ts`, `DomElementDescriptor`**:

- It gains `frontLayer?: true | undefined` and `leadStatement?: true | undefined`, each documented.
- Both are added to `UnwiredElementField`, with the reason: they are
  snapshot-scoped like `repeatCount`. Only the snapshot's element list writes
  them, and a recorded event target never carries them. This keeps
  `gateway-payloads.ts`'s `present<WireElementTarget>` exhaustive without a
  change there.

**`content/types.ts`** was not edited. It only re-exports `DomElementDescriptor`
from `shared/protocol.ts`, so the flags reach it through the re-export.

**`background/connection/dom-snapshot.ts`**:

- `frameEvidenceInTopFrameTerms` now restates `kind` on each dialog
  (`kind: dialog.kind`) and each blocker (`kind: blocker.kind`). It had to:
  `present<T>` requires every contract key, and the lead added `kind` to the
  contract.
- Element flags already cross the merge. The top frame's descriptors are
  carried as-is, and `translateFrameElements` spreads the child descriptor,
  restating only selector, bounds and frame attributes. The header comment now
  says so.

**`background/connection/tests/dom-snapshot.test.ts`** adds 1 row. A top-frame
`leadStatement`, a child-frame `frontLayer` (through frame translation), a
child dialog `kind` and a child blocker `kind` all arrive on the merged
snapshot, and no other element gains a flag.

**`content/dom-snapshot.ts`**: `snapshotElements` makes one `frontLayerTest()`
per capture. `snapshotDescriptor` writes both flags, only when true. The
header comment is updated.

### 5. e2e specs

- **Deleted** `apps/extension/e2e/content/tests/evidence/tests/budget.spec.ts`. Its subject was:
  - the 6,000-byte packet budget (`WEB_LLM_EVIDENCE_BYTE_BUDGETS`, removed by t200);
  - the withheld self-address `href` (removed by t200);
  - ranking order against job cards.

  None of these exists now. Its two surviving facts moved to `controls.spec.ts`:
  div-drawn filters are present, and a facet link keeps its address.
- **Rewrote** `apps/extension/e2e/content/tests/evidence/tests/controls.spec.ts`
  against `harness.capture()` through `captured-snapshot.ts`, not the domain
  packet. That keeps it independent of t200-w2b's in-flight domain packet. 7 rows:
  1. everything-store: every narrowing control is present, and the footer
     links are present and after the facet in document order;
  2. the facet link keeps `href`, and `attributes.href` contains `k=wireless+earbuds`;
  3. under the consent banner: Accept and Decline carry `frontLayer: true`, the
     facet does not, and a blocker has `kind: "consent"`;
  4. a no-results search (`/s?k=zzqxv+wqpf+nonexistent`): "No results for..."
     and "Try checking your spelling..." carry `leadStatement: true`, the
     header search precedes the first statement, and the footer is not flagged;
  5. crossborder-marketplace: the div filters, OK, Best Match and Accept all are present;
  6. bigbox-retail: the facets, Sort by and Next page are present;
  7. job-board: the filters, sort and Next are present, and article cards are listed.

### 6. Test-only fix required by the contract change

**`apps/extension/src/shared/tests/present.test.ts`** failed to compile. Its
`present<DialogEvidenceItem>` literals did not name the new optional `kind`
key, which `present` requires. The error was:
`Property 'kind' is missing ... required in type 'OptionalFields<WebAutomationDialogEvidenceItem>'`
at lines 51, 66, 119, 148 and 236.

I added `kind: undefined` to all 11 literals, including the
`@ts-expect-error` rows, so that each still fails for its stated reason only.

## Wire fields added (extension → domain)

- `DomElementDescriptor.frontLayer?: true`: present only when true, on elements of `DomSnapshot.interactiveElements`.
- `DomElementDescriptor.leadStatement?: true`: present only when true, on the same elements.
- `evidence.dialogs.open[].kind?: "consent" | "rate_limit" | "robot_check"`. The contract type also allows `promotion` and `assistant`, which are never produced.
- `evidence.overlays.blockers[].kind?`: same values.

All of them survive the multi-frame merge.

## Files changed by this worker

Added:

- `apps/extension/src/content/evidence/front-layer.ts`
- `apps/extension/src/content/evidence/tests/front-layer.test.ts`
- `apps/extension/src/content/action-runtime/interference/layer-kind.ts`
- `apps/extension/src/content/action-runtime/interference/tests/layer-kind.test.ts`

Restored and rewritten (deleted in the working tree by t200-w1):

- `apps/extension/src/content/evidence/lead-statements.ts`
- `apps/extension/src/content/evidence/tests/lead-statements.test.ts`

Modified:

- `apps/extension/src/content/evidence/index.ts`
- `apps/extension/src/content/evidence/types.ts`
- `apps/extension/src/content/evidence/dialogs.ts`
- `apps/extension/src/content/evidence/overlays.ts`
- `apps/extension/src/content/action-runtime/interference/index.ts`
- `apps/extension/src/content/dom-snapshot.ts`
- `apps/extension/src/shared/protocol.ts`
- `apps/extension/src/shared/tests/present.test.ts`
- `apps/extension/src/background/connection/dom-snapshot.ts`
- `apps/extension/src/background/connection/tests/dom-snapshot.test.ts`
- `apps/extension/e2e/content/tests/evidence/tests/controls.spec.ts`

Deleted:

- `apps/extension/e2e/content/tests/evidence/tests/budget.spec.ts`

## Commands run and observed results

All were run from the tree root. The final runs came after `layer-kind` was
moved into `interference/`.

1. `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t200 ext check" pnpm --filter @fluxiq-web-extension/extension check`
   → exit 0. It printed no TS errors, only the build-cache line
   `"not stamped, because inputs changed while it ran (core:packages/fluxiq/src)"`.
   - Earlier runs, in order:
     - An intermediate direct `tsc -p tsconfig.json --noEmit` showed only
       domain errors from t200-w2b's in-flight edits (`look-alikes.ts:140`,
       `state-digest.ts:164`, missing `kind`/`isDialog`/`inDialog`/`covers`).
       They were gone by the next run.
     - The first official check failed only on `present.test.ts`, fixed as
       described above.
     - The second official check exited 0, before the move.
2. `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t200 ext test" env EXTENSION_TEST_BUILD_LABEL=t200-ext pnpm --filter @fluxiq-web-extension/extension test`
   → exit 0: `Extension smoke test passed.`, `# tests 1490`, `# pass 1490`, `# fail 0`.
   - All 18 new rows are listed as `ok`.
   - The first run had 1 failure,
     `a labelled region inside the main region is still the main region's`.
     The message was `element2.hasAttribute is not a function`: the stub page
     has no `hasAttribute`, which `landmarkRole` needs for `<section>`. The row
     now uses `role="region"`, which exercises the same pass-through.
3. `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t200 ext build" pnpm --filter @fluxiq-web-extension/extension build`
   → exit 0. It printed `build\content\index.js 601.2kb` (597.9kb before this
   work), `chrome: verified 22 files`, `firefox: verified 22 files` and
   `e2e-chromium: verified 22 files`.
4. `node scripts/structure-audit.mjs`
   → `structure-audit: passed (128 warning(s), 119 baselined).` and
   `1 baseline entries can be lowered`.
   - The earlier run failed on the barrel rule for `evidence/layer-kind.ts`,
     fixed by the move described above.

## Not verified

- **No browser run.** None of the rewritten `controls.spec.ts` rows was run,
  as the brief required. They compile but are unproven. In particular:
  - that the no-results query returns zero results;
  - that `nameOf` reads "No results for..." on the flagged span or `<p>`;
  - that the everything-store banner is the blocker `overlayRoot` names, with
    `kind: "consent"`;
  - the crossborder, bigbox and job-board names, which were copied from the
    deleted packet-based rows.
- **Runtime order of the new `evidence` ↔ `interference` import cycle in the
  real content bundle.** The unit tests and the smoke test pass, and every
  top-level value on both sides is a literal. The bundle was not loaded in a
  browser.
- **Capture cost.** Both rules are now asked of every rendered element:
  - `isLeadStatement` does a text read, a landmark walk of up to 30 levels,
    and `visibleText` on short candidates;
  - `frontLayerTest` reads one memoised computed position per element on the
    walk.

  Neither is measured on a large page. `layerKind` runs once per dialog and
  per blocker. `robotCheckIn` reads `innerText` for up to 4,000 characters of
  the layer, which is also unmeasured on a page-sized blocker.
- Other e2e specs that may assert removed ranking (`page-evidence.spec.ts`,
  `repeat-exemplars.spec.ts` and so on) compile and were not reviewed. The
  brief named only `budget` and `controls`.

## Open questions or contradictions found

1. **The front layer is asked of every element, not only of page controls.**
   HEAD deliberately asked only controls, so that a sticky header's twenty
   links were not promoted. As a flag this seemed right, but a sticky header
   or a fixed app shell will now flag many elements. The depth bound of 8
   still limits the app-shell case. t200-w2b should decide how the packet
   presents it.
2. **`promotion` and `assistant` are never produced.** A new classifier would
   be needed; for example, a chat widget recognised by a composer plus a
   message log. That is a new heuristic and outside this brief.
3. **`robot_check` on an overlay blocker uses `robotCheckIn(layer, "dialog")`.**
   That reads the whole layer's text, which is right for a banner or dialog.
   A blocker that is a large page region would be read in full too, up to
   4,000 characters.
4. **The `evidence` ↔ `interference` barrel cycle is new.** It is harmless as
   it stands, but a future top-level constant computed from the other side
   would break it. The audit has no cycle rule configured to catch that.
5. **Baseline.** The audit again reports `1 baseline entries can be lowered`.
   `.structure-baseline.json` is not mine, so I did not run
   `pnpm structure:baseline`.
