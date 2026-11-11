# t904 round 4: five content-harness specs from t903's run

Worker report for lane t904. Extension tree `fxwork/t904/!FluxIQWebExtension` at 008cb9d2e (contains dev
2d78a6bb2); Core rebuilt from `fxwork/t904/!FluxIQ` first, since its freshness gate refused the stale build. Every run
went through the slot. Nothing is committed.

## Outcome

**Done.** All five failed on dev's code, and all five were test defects: specs that predate an intended change. Each is fixed, and all five specs now pass. No product regression was found, so no product code changed.

## Per-item table

None of the five comes from t897's dialog node token (4623139de). Each fails on dev's own code because of an older,
intended change the spec never followed. The content harness is not part of the daily sweep, which is how these
went unnoticed.

| Spec / case | Failure on dev | Cause (commit) | Class | Fix |
|---|---|---|---|---|
| dialog-dismissal: "everything-store: the spin-to-win deal wheel..." | `clearedLayers[0].kind` is `other`, expected `dialog` | de843929d (Oct 30, t799 "W6"): cleared layers carry Core's generic kind (`interference/obstruction/generic-kind.ts`: consent becomes `overlay`, a rate limit stays `rate_limit`, any other dialog is `other`), plus a stable `id` and the pressed control's `controlRef` | Test defect | Expect `kind: "other"`, and now also `id` (`layer:...`) and `controlRef.selector`. |
| dialog-refusal: "a cookie wall that can be declined is declined..." | `kind` is `overlay`, expected `consent` (the extra fields were allowed by `objectContaining`) | de843929d (W6), as above | Test defect | Expect `kind: "overlay"`, plus `id` and a `controlRef` naming "Reject non-essential". |
| safe-clearing: "a rate-limit notice offering OK and Try again is closed by its OK..." | Strict `toEqual` met the new `controlRef` and `id` fields | de843929d (W6), as above | Test defect | The exact object now names `id` and `controlRef` (role button, "OK"). |
| shadow-roots: "the chat panel's controls are described inside rf-assistant..." | Wording: `whose own controls are a control with no words in the layer's header, "Send"`; the spec expected `whose controls are "–", "Send"` | 328a1a9fe (Oct 29, t792, `interference/own-controls.ts`): a layer's own controls come header first, and one whose visible content has no letter or digit (the minimise control's dash) is described by where it is, not by the glyph | Test defect | The spec matches the current sentence, still exact. |
| frames: "a click addressed to the cross-origin card frame is performed in that frame" | `status: "failed"`, `web.action.page_reported_failure` | d2302b5f2 (Oct 20, t743): a press the page answers only with a notice in its status or alert region fails `page_reported_failure` and is retried. Here the card form, with no card entered, answers "Check your card details." in its status region, which is what the spec itself says the press brings. | Test defect | Expect `failed` with `page_reported_failure` and `effect: "unacted"`, the frame's own URL, and a validation that says the press landed on the target. The spec's subject (the press is made inside the cross-origin frame) and its later checks (the frame's notice, no order) are unchanged. |

Evidence for each cause: the failing values above come from the run on dev's code (`t904d-content.log`: 5 failed,
40 passed). For the frames case, a temporary probe (removed) logged the whole response: the press landed at 60,143 on
"Use this card" inside `/checkout/payment-frame`, and the page answered only with its status notice.

## Files changed (all specs)

- `apps/extension/e2e/content/tests/dialog-dismissal.spec.ts`
- `apps/extension/e2e/content/tests/dialog-refusal.spec.ts`
- `apps/extension/e2e/content/tests/safe-clearing/tests/social-feed-safe-clearing.spec.ts`
- `apps/extension/e2e/content/tests/shadow-roots/tests/shadow-root-controls.spec.ts`
- `apps/extension/e2e/content/tests/frames.spec.ts`

No product file changed.

## Commands run and observed results

- `pnpm --filter @fluxiq/contracts --filter @fluxiq/sdk --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/ui-components build` (Core) -> exit 0.
- `pnpm test:content -- dialog-dismissal dialog-refusal safe-clearing shadow-roots frames --workers=1` on dev's code -> 5 failed, 40 passed.
- The same after the four receipt and wording fixes -> 1 failed (frames, before its fix), 44 passed.
- `pnpm test:content -- frames --workers=1` after its fix -> 3 passed (3).
- Extension structure audit `node scripts/structure-audit.mjs` -> "structure-audit: passed (247 warning(s), 552 baselined)", none on the changed specs.

## Not verified

- No live browser or extension-loaded run; this is the content harness only.
- The other content specs were not run.
