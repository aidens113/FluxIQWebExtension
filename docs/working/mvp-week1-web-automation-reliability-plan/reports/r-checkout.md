# r-checkout — a realistic e-commerce checkout fixture

## Outcome

Done. `storefront-checkout` is a new Scenario Lab fixture: a four-step store
checkout (bag, delivery address, delivery speed, payment) with a same-origin
payment iframe, a consent dialog that owns every click until it is answered, a
support chat widget that never leaves, two reveals that arrive after a delay,
generated class names, and card fields marked the way real card fields are —
including two that are not marked at all. One workflow (complete the checkout)
and one variant (`declined-card`).

Nothing in the product was changed. No leak was found *by this worker*, because
finding one needs the extension: this fixture is the page a run will meet, and
what the recorder and the redactor do with it is still open.

## What changed and why

New, all mine:

- `apps/scenario-lab/src/scenarios/storefront-checkout/` — 12 modules plus
  `tests/scenario.test.ts`:
  `order.ts` (catalogue, tariff, address book, money and address formatting),
  `state.ts` / `mutate.ts` (state and the one operation per control),
  `manifest.ts`, `markup.ts`, `checkout-steps.ts`, `overlays.ts`, `styles.ts`,
  `client-script.ts`, `payment-frame.ts`, `scenario.ts`, `index.ts`.
- `apps/scenario-lab/e2e/storefront-checkout.spec.ts` — 7 tests.

Shared files touched, minimally: `src/types.ts` (one id), `src/registry.ts`
(one import, one row), `src/tests/registry.test.ts` (bumped the literal 22 to
23 — since replaced by another worker with `scenarioIds.length`, which is
better and which I left alone).

The properties, and why each is built the way it is:

**The payment iframe is load-bearing.** The card fields *and* the button that
spends the money are inside a second document the fixture serves itself
(`route()` → `/scenarios/storefront-checkout/payment-frame`), same-origin, as
a hosted card form is. Six of the twenty-three recording steps address it as
`frame:Secure card payment/testid:…`. The frame is embedded from the first
load inside the collapsed payment step — that is how an accordion checkout is
actually built, and it means the frame has loaded, and is in the frame tree,
long before it is visible. Traffic crosses the boundary both ways: the store
posts the amount to the frame when the shopper reaches payment, and the frame
posts the result back, so the observable effect of a click made *inside* the
frame lands in the *top* document.

**The marking matrix.** `autocomplete="cc-number"` (card number, in frame);
`autocomplete="billing cc-number"` (billing card, in frame — the multi-token
spelling that has leaked twice); `type="password"` (account signup, top
document); **no marking at all** on the security code (in frame,
`name="csc"`, `inputmode="numeric"`) and on the gift-card number (top
document). Neither unmarked field is labelled as a trap anywhere on the page
or in its test id; both are ordinary things real checkouts ship.

**Interference.** The consent dialog sits over a full-viewport scrim at
z-index 2147483000, so before it is answered every control on the page is
visible, enabled, and unclickable — the e2e proves this with `elementFromPoint`
and with a click that Playwright refuses. The chat widget is fixed in the
bottom-right corner for the whole session, adds ~20 elements to every
snapshot, and covers the store's own "Back to top" control, which is therefore
permanently unclickable. That is not contrived: it is what happens on real
sites, and it is asserted.

**Late reveals.** The postcode lookup (450 ms) *adds* the suggestion list; the
delivery quote (350 ms) *adds* the estimate line and enables the continue
button. Both are elements the document did not have, so the page changes shape
after the action that triggered it. Both are recorded as `waitForState` steps.

**Page facts per rendering.** The workflow and the variant each declare the
same six facts explicitly rather than the variant inheriting them, because
arming changes nothing visible. For that to be *true*, `decline-next-payment`
returns the checkout to its first rendering and sets a gateway decision the
page does not show — otherwise the armed run would open on the confirmation
panel the recording left behind and the declared facts would be lies.

**The fixture cannot leak from its own oracle.** `submit-payment` takes no
payload and reads none; the gift-card value never leaves the browser. So if a
card-shaped value appears in captured evidence, the page is the only place it
can have come from. A unit test and an e2e test both assert the state contains
none of the synthetic values.

All card-shaped values are reserved synthetic test PANs held in one place
(`syntheticCheckoutValues`), matching the `sensitive-input` convention.

## Commands run and observed results

All with `EXTENSION_TEST_BUILD_LABEL=r-checkout`, exit statuses by redirect.

- `npx tsc -p tsconfig.json --noEmit` (apps/scenario-lab) → **exit 0**.
  (Earlier runs were red with 49 then 1 error, all in `admin-console/` and
  `member-directory/`, other workers' in-progress files; clean once they
  landed.)
- `pnpm test` (apps/scenario-lab: build + `node --test dist/**/*.test.js`) →
  **exit 0**, `# tests 175 # pass 175 # fail 0`. My own file contributes 15.
- `npx playwright test -c e2e/playwright.config.ts e2e/storefront-checkout.spec.ts`
  → **exit 0**, `7 passed (12.3s)`.
- Whole scenario-lab e2e suite → **exit 1**: `91 passed, 3 failed`. All three
  failures are in `admin-console.spec.ts` (another worker's fixture, mid-work);
  all 7 of mine passed inside that run.
- `node --test packages/test-runner/dist/bench/tests/week1-corpus.test.js`,
  against a `dist/` rebuilt with this fixture registered → **exit 0**:
  `runnable: 43 (23 recording, 20 flow); skipped: 0`, `unresolved results: none`,
  `# tests 4 # pass 4 # fail 0`.
- `GIT_INDEX_FILE=<scratch> node scripts/structure-audit.mjs`, with the new
  directory and spec staged into a scratch index → **exit 0**:
  `structure-audit: passed (32 warning(s), 17 baselined)`. No finding names any
  file of mine, and the fixture adds no baseline entry. One warning moved
  because of me: `apps/scenario-lab/e2e/: 16 source files is past the 15-file
  advisory threshold` — advisory only, unratcheted, fails at 25. The other two
  fixture workers' specs will push it to 17–18.

Measured, from the e2e run:

- **194 elements** in the top document at first load; **34** in the card frame;
  **2 frames** (main + card frame). The next-largest fixture here is an order
  of magnitude smaller.

## Not verified

- **Anything about the extension.** No recording, no snapshot, no evidence
  capture, no redaction was run against this page. Whether the unmarked
  security code and gift-card values survive into evidence — the question the
  fixture exists to answer — is untested and deliberately not asserted
  anywhere.
- **What the recorder emits for frame-scoped events.** `expected.recordingEvents`
  deliberately carries no counts for that reason; a count written from the
  outside would be invention.
- **The variant's failure category.** `unexpected_state` is a judgement: the
  page answers promptly and says exactly what happened, so `timeout` and
  `output_not_observed` both read wrong. No run has classified it. The code is
  left unstated.
- **The collapsed-frame case.** The card frame loads inside a `hidden` section.
  Whether the cross-frame evidence merge sees a loaded, zero-size, invisible
  frame is exactly the kind of thing this fixture can now be pointed at, and
  was not exercised here.
- `pnpm check` / `pnpm build` at the repository root were not run (the brief
  forbids the build; the tree was busy with three concurrent fixture workers).

## Open questions or contradictions found

1. **Secrets: a Flow run of this scenario will need three environment
   variables.** `secrets` declares `enter-card-number`,
   `enter-billing-card-number` and `enter-account-password`, so the Flow lane
   resolves `FLUXIQ_TEST_SECRET_STOREFRONT_CHECKOUT_CARD`, `…_BILLING_CARD`
   and `…_PASSWORD` and fails closed with `environment.missing` without them.
   Worth knowing before this row joins a corpus. The asymmetry is the point:
   `enter-security-code` needs no secret because nothing withholds an unmarked
   field — which is the finding waiting to be made.
2. **A page fact cannot assert a seed-derived string.** `createState` is called
   with the *lab* seed, not the manifest seed, so the order reference differs
   between a lab on seed 42 and the manifest's 131. I asserted `contains
   "NLO-"`. Any fixture with a generated identifier has the same limit.
3. **`pageFacts` still has no reader.** `scenario-workflow.ts` says so plainly.
   My e2e implements the predicates itself, including an `iframe-count`
   evaluator for `subject: "document"`, copying the shape `iframe-checkout`
   invented. Two fixtures now spell that predicate with no runtime behind it.
4. **The shared `page()` stylesheet fights a realistic page.** `max-width:
   48rem`, `li { display: flex }` and no `[hidden]` rule mean any fixture that
   wants to look like a real site must override them. Worth moving into a
   fixture-owned reset if more realistic pages are coming.
5. **A misrouted coordinator message reached me.** Mid-task I received a
   message addressed to `r-admin` about `admin-console/types.ts` being
   overwritten. I did not act on it: `admin-console` is not my directory and my
   brief forbids touching it. Flagging it so the instruction is not assumed
   delivered — if `r-admin` never got it, `types.ts` may still be missing.
6. **`src/tests/registry.test.ts` was a three-way collision.** I bumped the
   literal count 22 → 23; another worker replaced both literals with
   `scenarioIds.length`, which resolves it for everyone. Left as they wrote it.
