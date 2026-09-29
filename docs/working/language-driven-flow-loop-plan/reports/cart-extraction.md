# Cart extraction on the everything store

Worker report, 2026-09-28. Status: done. The session was cut off by a machine crash
part-way through; this was rewritten and extended afterwards.

## Outcome

**The cause was (b): the cart's markup did not register as repeating to the detector.**
(a) made it worse: the tool gave the model nothing to steer by. **(c) is ruled out**: the
cart was in the expected state.

The detector accepted a list only at three or more same-template siblings
(`MIN_ITEMS_PER_RUN = 3` in `apps/extension/src/content/extraction/infer-list.ts` and
`largest-runs.ts`). After the phone case moves to Saved for later, the cart holds exactly
two lines, so no element on the page could be detected, the two lines themselves included.
The model's choice of target made no difference. Page-wide, the "largest list" was the
four action links (Delete / Save for later / Compare / Share) inside a single cart line.

Fixed at both layers (the extension detector, and the domain tool around it). A
deterministic content-harness spec on the cart, and domain unit tests, both fail against
the pre-fix code and pass with the fix.

## Findings

### Reproduction (deterministic, no provider, no Lab run)

A content-harness spec (headless Chromium, the real content-script bundle, Scenario Lab)
puts the store into the task's end state through the store's own mutation endpoint
(`POST /api/everything-store/<operation>`, the operations the product page's Add to Cart and
the cart's Save for later send): `add-to-cart` Sage Green 1.7 L x2, then `save-for-later` L2
twice (the first fails by design). It then loads `/scenarios/everything-store/cart`.

Observed before the fix:

- The active lines under `[data-name="Active Items"] [data-line]` were exactly two, the Sage
  kettle `B0D7KXS4G7` and the batteries `B0BAAA48CT`, with the same class. The phone case was
  in Saved for later. **The state is correct: this rules out (c).**
- Every targeted `web.dom.capture_snapshot` + `detectStructure` was refused
  `{"ok":false,"refused":"no_repeating_run"}`. The targets were the cart lines themselves,
  a line's title, the `h1`, `[data-testid="cart-subtotal"]`, the checkout button, and the
  quantity `[aria-live="polite"]`.
- Page-wide, the answer was `ok: true`, `itemCount: 4`, with a single field (the
  `data-action` attribute). That list is the four action links inside one line.
- `web.dom.extract_list` with item `[data-name="Active Items"] [data-line]` and the
  workflow's own fields returned exactly the two expected rows: kettle, 2, $44.99; batteries,
  1, $17.49; validation `passed`. **The reader was never the problem; detection was.**

Once pairs were accepted, Saved for later (3 items: two seeded plus the phone case) became
the page-wide answer. That is a real list, but not the one "what is in my cart" asks for. It
was fixed by ranking lists by the data they hold rather than by item count alone (below).

### Targets on iterations 21-33 of `run-mulum3x7-18ceeb75`

**These cannot be recovered from the artifacts.** `live-llm.json`, `flow-lane.json`,
`events.ndjson` and the logs record tool ids, result codes and reasons, but never tool
arguments. The Core failure body in `provider-failures.local.json` is cut off at 8,000
characters. What the trace does prove:

- Every `nothing_repeats_around_target` means the call named a target, because the domain
  only emits that reason when there is one.
- `answered_the_same_again` appears 6 times, so the model repeated identical requests.
- The one success after iteration 20 (iteration 23, 309 bytes) fits the four-action-link
  list reproduced above.

The reproduction shows the choice of target did not matter: every element of the cart,
the lines included, was refused.

The `action_failed` result of `run-mulryg6h-ff241a12` (`extract_list` x3) cannot be
attributed from its artifacts either. It happened on the same page, where no correct item
selector could be detected; the read itself works (see above).

## What changed and why

Extension (`apps/extension/src/content/extraction/`):

- `record-pair.ts` (new): two siblings count as a run when they are plainly two records:
  - the template is named (a class, role or test id, not a bare tag);
  - the items are containers, not leaves;
  - each item holds at least two values of its own, in both items.

  Runs of three or more are unchanged.
- `content-fields.ts` (new): counts the fields read from inside an item. It excludes the
  item's own `data-*` attributes, excluded fields, and live control values.
- `infer-list.ts`: accepts a record pair. Finding a pair does not end the walk up the page:
  if an enclosing run of three or more exists, it wins. The picker gains pairs too.
- `largest-runs.ts`: can scan under any root element; offers plausible pairs (sorted after
  every larger run); the cap on offered runs rises from 12 to 24.
- `detect-structure.ts`:
  - A target with no rich run around it **searches outward** (the enclosing regions, nearest
    first) instead of refusing.
  - A "thin" run (at most one value of its own per item, such as a line's action links or a
    card's stars) loses to a rich run that encloses it.
  - Page-wide ranking is now: rich before thin, then **data held** (items x values that every
    item has), then item count, then fields, then confidence.
  - Sensitive-region and ambiguous-target refusals are decided before any outward search,
    so their pinned behaviour is unchanged.

Domain (`domain/src/runtime/llm-evidence/structure/`):

- `detect.ts`: when the page answers a targeted detection `no_repeating_run`, the page is
  asked once more as a whole before anything is refused. A list found that way is returned
  with **no `target`** in the packet, so the model can see it was found on the page rather
  than around its target. The capture is factored into `capturedDetection`. This holds the
  rule on the domain side of the wire, so it works even against an extension build that
  predates the fix.
- `refusal.ts`: a `no_repeating_structure` refusal now names **where lists exist**. In
  `instead` it lists up to three target handles from the packet the model was already
  shown, each in a different repeating record or drawn several times over. A handle is the
  model's own vocabulary, never a page word or a selector. After a page-wide search, the
  reason given is the page's own (`nothing_repeats_on_page` /
  `repeating_groups_not_readable` / `page_is_not_the_content`), not
  `nothing_repeats_around_target`.
- `tests/detect.test.ts`:
  - The fake gateway can now answer differently around a target (`aroundTarget`).
  - Two refusal expectations are updated: the new `instead`, and the page-wide reason
    together with an assertion that the retry happened.
  - New test: "a target with no list around it gets the page's list, which names no target,
    rather than a refusal".

Tests, in `apps/extension/e2e/content/tests/extraction/tests/everything-store-cart.spec.ts`
(new; this replaces the scratch `zz-cart-repro-worker.spec.ts`, which is deleted):

- The oracle is the fixture's own `ADD_TO_CART_WORKFLOW.expected.extracted[0].records`.
- The end state is asserted from the page itself, not assumed.
- Row 1: the recorded read returns exactly the expected records.
- Row 2 covers the page-wide detection, seven targets, and an unedited read:
  - Page-wide detection finds exactly the two active lines.
  - Seven targets give the same item selector: the lines, a title, a quantity, a line's
    Save-for-later link, the heading, the subtotal, and the checkout button.
  - The proposal's own fields, unedited, read two records carrying each expected item,
    quantity and price, in cart order.

The fixture was not edited. It is correct.

## Commands run and observed results

- Scratch reproduction, `pnpm test:content -- tests/extraction/tests/zz-cart-repro-worker.spec.ts --workers=1`,
  before the fix: `1 passed`; it printed the refusals and the four-link page-wide answer
  quoted above. After the fix, every detection answered `itemCount: 2` with the cart-line
  item selector. The scratch spec is now deleted.
- `pnpm test:content -- tests/extraction/tests/everything-store-cart.spec.ts --workers=2` -> `2 passed (20.0s)`.
- The same spec with `detect-structure.ts`, `infer-list.ts` and `largest-runs.ts` put back to
  HEAD, then restored: `1 failed, 1 passed`, with
  `Error: the cart's lines, not Saved for later's three items nor a line's four action links`.
  **The regression test catches the regression.**
- `pnpm test:content -- tests/extraction/ --workers=3` -> `5 failed, 59 passed (2.5m)`.
  - Every structure-detection, inference, picker, everything-store, item-conditions,
    list-completeness and record-output-schema row passes.
  - The 5 failures are `extract-list-catalog.spec.ts:158` and `:177`, and
    `extract-list-sensitive.spec.ts:27`, `:43` and `:103`.
- Those two files run with my three files at HEAD: the **same 5 fail** (`5 failed, 12 passed`).
  They predate this change, and `list-reader.ts` imports none of the changed modules.
- Final run after the last spec edit: cart + structure-detection + inference +
  extraction-picker + everything-store-extraction -> `18 passed (28.6s)`.
- `DOMAIN_TEST_BUILD_LABEL=cart-worker node scripts/test-domain.mjs` -> `# tests 856 / # pass 856 / # fail 0`.
- The same with `detect.ts` and `refusal.ts` at HEAD, then restored -> `# fail 3`: tests 547,
  548 and the new 549. **The domain tests catch it.**
- `pnpm --filter @fluxiq-web-extension/domain check` -> exit 0.
- `pnpm --filter @fluxiq-web-extension/extension check` -> **exit 1, not caused by this
  change**:
  - The first attempt hit `Cannot find module 'fluxiq'` everywhere, because Core's
    `packages/fluxiq/dist` was being rewritten (timestamp 17:03) during the run.
  - The retry reported one error of mine, an unsafe cast in the new spec. It is fixed.
  - What remains is only `src/popup/index.ts` / `src/sidepanel/index.ts`:
    `Cannot find module './app'` / `'../popup/app'`. That is another worker's in-flight
    popup move: 2,351 lines deleted and `src/popup/app/` not present yet.
- `EXTENSION_TEST_BUILD_LABEL=cart-worker node scripts/test-extension.mjs` -> `# tests 848 / # pass 848 / # fail 0`.
- `node scripts/structure-audit.mjs` -> exit 1 with 4 FAILs, none in my paths:
  - `docs-links` in extension-client.md, pointing at the moved popup extraction;
  - `failure-as-empty` in `panel/copy/page-hostname.ts`;
  - `imports` in `sidepanel/index.ts`;
  - `working-docs`: README.md is out of date.

  My paths raise advisory warnings only: `content/extraction/` has 19 files against a
  15-file advisory, and `detect.test.ts` is 560 lines against a 400-line advisory.

## Not verified

- **No live run** (the brief forbids one). Whether DeepSeek now builds the Flow on this task
  is unproven. The next live run of `everything-store-kettle-to-cart` must use an extension
  **rebuilt** from this tree. The domain-side retry holds even without a rebuild, but the
  cart is only detectable once the content script has the pair rule.
- The end state was reached through the store's operation endpoint, not by replaying the
  recorded UI steps. The operations are the same ones the page's buttons send, and the
  deterministic Lab matrix (`pnpm lab matrix`) replays the UI path; I did not run the Lab.
- The extension check cannot be shown green until the popup move lands.
- Firefox was not exercised; the content harness ran Chromium only.

## Open questions or contradictions found

- **The DOM-level regression test does not gate `pnpm test` or CI.** `test:content` (the
  Playwright content harness) is not part of the root `pnpm test`, and
  `.github/workflows/testing-facility.yml` does not run it either. The domain test does gate
  `pnpm test`. To make the cart spec fail the build, the supervisor would need to wire
  `test:content` (or at least `tests/extraction/`) into a gated step. That is outside my
  brief.
- 5 `extract_list` content specs already fail on HEAD. Their assertions expect
  `status: "failed"` / `"passed"` shapes that the current reader no longer returns; this
  probably came with commit `260a4e17` or `bf3b0c45`. Someone owning `list-reader.ts` should
  look.
- A **one-line cart** is still undetectable, because a single element has no siblings to
  show a template. Page-wide, it would fall to Saved for later. A real fix would need a
  signal beyond sibling similarity, such as a same-template run elsewhere on the page with
  the same data attributes, or the heading the list sits under.
- Two things need follow-up from the supervisor:
  - **Architecture docs.** They should describe detection's outward search, record pairs and
    data-held ranking. I did not edit `docs/architecture/`, which is outside my ownership.
  - **Documentation of the `instead` field.** `tool-rejection.ts` describes `instead` as "the
    keys the tool's own schema declares", while structure refusals now put target handles
    there. The field was already used for more than keys (node ids, handle shapes, resolver
    codes), but the comment on the type should say so. It is outside `structure/`, so I did
    not edit it.
- Per-label test build directories remain: `domain/.test-build-scratch/cart-worker/` and
  `apps/extension/.test-build-scratch/cart-worker/`. Both are ignored, and
  `pnpm task prune` reclaims them.
