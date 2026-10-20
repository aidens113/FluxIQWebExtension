# t730-b1-identity: identity specs moved to realistic pages

## Outcome

Mostly done. 43 of the 45 identity rows now run on realistic scenarios, and they pass headed. The other two rows are **Blocked**, because no realistic page has the construct they need. Both are left unchanged and still open a synthetic scenario. The hooks they need are listed below.

Three rows are partial retargets: the claim holds, but the realistic page changes what the row can show. Each one is flagged in the table and explained under "Deviations".

The final headed run of the six changed specs, plus the two realistic specs that import the shared fixtures, gave **62 passed**.

## What changed and why

All files are under `apps/extension/e2e/content/tests/`. No scenario, harness, `src/` or `packages/` file was touched, and no logic moved to a unit test.

- **`identity-fixtures.ts`** (shared helpers):
  - `armMode` now arms the harness's own scenario instead of a hard-coded `identity-drift`. It behaves the same for `large-page-resolution.spec.ts`.
  - New helpers:
    - `labMutate` posts a site's own `/api/<scenario>/<op>` mutation, which is how the traps are answered before a page loads.
    - `openPath` opens a path and waits for `contentReady`.
    - `trackClicks` logs every click on the page as `<landmark>|<label>`.
    - `quoteDrawer` drives company-website's quote drawer. It answers consent, the newsletter and the chat greeting, then opens the drawer and walks to step 2 or 3 using the scenario's own `quoteDrawerIds` and `QUOTE_INPUT`.
  - Removed `PRIMARY`, `SECONDARY`, `BELOW_FOLD`, `DRIFT_MODES` and `viewportRect`, which only the retargeted rows used.
  - Kept `SAVE_BASELINE`, `DISPLAY_NAME` and `armMode` for `large-page-resolution.spec.ts` and the blocked reworded-aria row.
  - The file exports 13 values; the audit limit is 15.
- **The six spec files:** every row was retargeted as shown in the table. The main hosts are:
  - **company-website:**
    - The quote drawer has a test id on Send request only, generated ids and hashed classes, and a footer with Back, Continue and Send request.
    - The `redesigned-quote-submit` variant puts "Save and finish later" in Send request's slot.
    - The next deploy is another lab seed, which redraws every id and class.
    - The home page has two "Get a free quote" buttons, a sticky header and a footer link below the fold.
    - The price table supplies the table-context row.
  - **everything-store:** the cart's line checkboxes, and the checkout:
    - a ticked Plus-trial box and an unticked gift-card box;
    - a region named by reference to its heading;
    - a delivery fieldset with a legend;
    - two identical "Place your order" buttons;
    - the cookie-preferences region, which is named by `aria-label`.
  - **One row each:**
    - bigbox `redesigned-buy-box`;
    - crossborder `basket-redesign` and its colour swatch titled "Silver";
    - auction's "Watch this item" hearts;
    - local-classifieds' "Sort by", which is named by `aria-labelledby`;
    - professional-network's search combobox;
    - photo-social's sign-in and payment fields.
- **Why the press rows leave the privacy box unticked.** With the box ticked, pressing Send request (or its redesign) starts the site's human check. The content script then correctly reports `web.intervention.required`. With the box unticked, the press shows the form's own error instead, which is a clean, observable press.

## Table

All runs are headed, from the final run.

| Spec | Original test | Capability | Disposition | New home (file › test) | Headed |
| --- | --- | --- | --- | --- | --- |
| identity | identity-drift baseline: Save carries test id, name, role and context | descriptor signals for a button | Retarget | identity › company-website: the quote drawer's Send request carries test id, name, role and context | pass |
| identity | identity-drift baseline: a labelled field takes its name from its label | label → accessible name; form, legend and dialog context | Retarget | identity › company-website: a labelled field takes its name from its label, and its fieldset's legend is context | pass |
| identity | identity-drift ×4 modes: Save keeps the signals the drift leaves | which signals survive a redesign | Retarget (4 realistic variants) | identity › {company-website redesigned-quote-submit, bigbox-retail redesigned-buy-box, crossborder-marketplace basket-redesign, everything-store redesigned-header}: the redesigned control keeps the signals the redesign leaves | pass ×4 |
| identity | identity-drift wrapped-aria: name is the aria-labelledby target's text | name via `aria-labelledby` | Retarget | identity › local-classifieds: Sort by takes its name from the element aria-labelledby points at | pass |
| identity | ambiguous-targets: identical controls share every name signal | twins share name signals and differ only by place | Retarget | identity › company-website: the header's and the hero's Get a free quote share every name signal | pass |
| identity | ambiguous-targets: a wrapping label names both duplicate fields | name from a wrapping `<label>` | Retarget (partial: no same-named duplicate fields exist) | identity › company-website: a wrapping <label> names each radio of the contact group | pass |
| identity | keyboard-forms: legend, list position, dressed-up control | fieldset legend, list position, named region, role vs implicit role | Retarget | identity › a fieldset legend, a list position, a named region and a dressed-up control | pass |
| identity | data-table: row, column and column header | table position | Retarget | identity › company-website prices: a cell's context is its row, its column and the column's header | pass |
| identity | sensitive-input: value presence, not value | sensitive fields report `hasValue` and no value | Retarget | identity › photo-social: value presence is reported, the value is not part of identity | pass |
| ambiguity | an ambiguous selector fails TARGET_AMBIGUOUS | selector tie reported | Retarget | ambiguity › an ambiguous selector fails TARGET_AMBIGUOUS and names what tied | pass |
| ambiguity | ambiguous fingerprint text fails; a unique test id resolves | fingerprint tie reported | Retarget (partial, see Deviations) | ambiguity › an ambiguous fingerprint text fails TARGET_AMBIGUOUS; one twin's own class set still does not separate them | pass |
| ambiguity | gate: a disabled twin | gate narrows a tie | Retarget | ambiguity › the gate breaks the tie: a disabled twin is not the control the Flow meant | pass |
| ambiguity | gate: a hidden twin | gate narrows a tie | Retarget | ambiguity › the gate breaks the tie: a hidden twin is not a candidate | pass |
| ambiguity | a single hidden match still resolves | resolve, then actionability refuses | Retarget | ambiguity › a single hidden match still resolves… | pass |
| signals | checked state for checkbox and radio only | `checked` in the descriptor | Retarget | signals › the recorder describes a checked state for a checkbox and a radio, and for nothing else | pass |
| signals | landmark named by reference and by aria-label | `landmarkName` | Retarget | signals › the recorder names the landmark around a control, by reference and by aria-label | pass |
| signals | a sensitive checkbox is described without its state | state withheld for a sensitive toggle | **Blocked** (unchanged, opens ambiguous-targets) | hook B-1 | pass (synthetic) |
| signals | a recorded toggle becomes a check step | recorded change → check step, with state and landmark name | Retarget (dispatched-state assertion corrected, see Open questions) | signals › a recorded toggle becomes a check step carrying the state it was left in, and its landmark's name | pass |
| veto | class set on a destructive control refused | Level 1 veto refuses an impostor | Retarget | veto › the recorded class set on a different action in Send request's slot is refused, not clicked | pass |
| veto | a vetoed strategy is a miss | veto demotes; scoring recovers the moved control | Retarget | veto › a vetoed strategy is a miss, not the end: the Continue that moved is still found | pass |
| veto | the recorded id still resolves through the veto | strong identifier survives a restyle | Retarget | veto › a strong match is not second-guessed… | pass |
| veto | no stable identifier: corroboration refuses | second veto rule | Retarget | veto › a recording with no stable identifier: the score would act, corroboration refuses | pass |
| wire-chain | element+selector / dispatched: reworded-aria resolves | wire projection loses no scored signal | Retarget (the bar is now the full on-page descriptor's resolution after a redeploy, not a pinned 0.602) | wire-chain › {the node's element and selector, the whole command a replay dispatches}: Send request is pressed on the redeployed page, scored as the full descriptor scores it | pass ×2 |
| resolution | identity-drift ×4 modes: the recorded descriptor resolves the drifted Save | replay recovers a drifted control | Retarget (3 realistic drifts; see Deviations) | resolution › company-website's next deploy: Continue…; …Send request by its surviving test id; bigbox redesigned-buy-box: the recorded Add to cart is found in the buy box… | pass ×3 |
| resolution | selector-only: the fingerprint's text recovers | fingerprint-only recovery | Retarget | resolution › a redeploy took the recorded id and class, and with no selector the fingerprint's text recovers Continue | pass |
| resolution | the recorded twin wins the tie ×2 | scored tie-break | Retarget | resolution › everything-store cart: the recorded line {1,2}'s box wins the tie its selector could not break | pass ×2 |
| resolution | a descriptor that cannot tell twins apart leaves them tied | unbroken tie carries scores | Retarget | resolution › a descriptor that cannot tell company-website's two quote buttons apart leaves them tied… | pass |
| resolution | no-context: recorded bounds on identical twins fail TARGET_AMBIGUOUS | a point on a twin is scored | Retarget | resolution › everything-store checkout: recorded bounds on one of the two Place your order buttons fail TARGET_AMBIGUOUS, not an order | pass |
| resolution | every recorded signal drifted → refused | no approximation | Retarget | resolution › crossborder basket-redesign: a control whose every recorded signal has drifted is refused… | pass |
| resolution | renamed-redesign refused on both paths | refusal plus scores on replay and Flow paths | Retarget | resolution › company-website redesigned-quote-submit: the recorded Send request is refused on both paths… | pass |
| resolution | a persisted repair resolves; the veto refuses when stale | repair target wins; stale repair refused | Retarget | resolution › a persisted repair of the recorded Send request resolves Get my free quote, and refuses once that is gone | pass |
| resolution | reworded-aria: the surviving accessible name resolves | Level 2 recovery on the accessible name alone | **Blocked** (unchanged, opens identity-drift) | hook B-2 | pass (synthetic) |
| resolution | long-document: document bounds win | visual target prefers document bounds | Retarget | resolution › document bounds win over the viewport bounds recorded beside them (company-website home) | pass |
| resolution | long-document: stale viewport bounds refused | no click on what scrolled in | Retarget | resolution › stale viewport bounds no longer click whatever scrolled into their place | pass |
| resolution | an exact match reports its strategy | diagnostics on success | Retarget | resolution › an exact match reports the strategy that answered… (company-website Continue) | pass |
| resolution | a verb that resolves nothing gains no measurement | no resolution on scroll | Retarget | resolution › a verb that resolves nothing gains no measurement | pass |
| resolution | near-miss R1, R2, R3, R4, R7, R8 | corroboration refuses a containing label | Retarget | resolution › R{1,2,3,4,7,8}, recording with/without Continue's id: … ("Continue to site") | pass ×6 |
| resolution | near-miss control | the real control still resolves | Retarget | resolution › control: the same near-miss beside the Continue it imitates… | pass |
| resolution | a title-only swatch resolves by its title | name scan for role-less controls | Retarget | resolution › crossborder: the stale selector misses and the title alone names the Silver swatch, which is pressed | pass |
| resolution | two swatches sharing a title are ambiguous | title tie reported | Retarget | resolution › auction: every unwatched card's heart is titled Watch this item, so the title is ambiguous and none is pressed (25 twins, inside shadow roots) | pass |

## Blocked: hooks needed

- **B-1, `identity-signals` › "a sensitive checkbox…"**
  - What it needs: a realistic checkbox that the sensitivity rule marks, that starts ticked, and that sits inside a named landmark. The rule marks a control with `data-sensitive="true"`, or with `autocomplete` set to `one-time-code` or `cc-*`.
  - Suggested hook: an armable everything-store variant (for example `sensitive-save-card`). It would add a box like `<label><input type="checkbox" data-sensitive="true" checked> Save this card's security code…</label>` inside the checkout's `section[aria-labelledby="pay-heading"]`. The default site stays unchanged.
- **B-2, `identity-resolution` › "reworded-aria…"**
  - What it needs: a realistic redesign where one control keeps its accessible name but loses everything else (visible text, id, test id, classes), next to a look-alike sibling.
  - Suggested hook: a company-website variant `reworded-quote-submit`. Send request would be redrawn as `<button aria-label="Send request" class="<new build>">Send</button>`, with no test id and a new generated id, beside Back and Continue.

## Deviations

1. **`identity-ambiguity`, second half of row 2.** No realistic look-alike pair has a test id on exactly one twin. The row now shows that the header twin's own hashed class still ties (1.00 against 0.86). An optional hook would restore the original half: a page where two visible look-alikes differ only by a test id.
2. **The `identity-resolution` drift loop.** The four synthetic modes became three realistic drifts:
   - company-website's redeploy, for Continue;
   - company-website's redeploy, for Send request;
   - bigbox's moved Add to cart.

   The "text-only" case (the id survives a text change) is covered by veto row 3. A replay where an `aria-labelledby` name survives a drift is not reproduced. Its hook would be a local-classifieds variant that redraws "Sort by" with new classes and keeps `aria-labelledby`.
3. **The persisted repair target.** It is built from the page's own descriptor of "Get my free quote", in the shape `validateWebRuntimeTargetOverrideEvidence` produces. It is not taken from that domain function's real output for this page. The original row copied its target from a domain unit test.
4. **Near-miss rows.** Where the original gave the near-miss button both an id and a test id, it now gets only an id that looks generated, because the site draws no test ids on these buttons. Continue's own id is generated, so the two recordings the rows compare are "with its id" and "without".

## Commands run and observed results

- Probes. These were exploration, not validation. They ran in my own `identity.spec.ts` (originals backed up in the scratchpad) to avoid adding files to a directory at its 25-file limit, and that file was then overwritten by the final spec. They measured every realistic outcome before I wrote any assertion.
- First full run of the six specs, headed, `--workers=2`: `49 passed`, `3 failed`. The failures and their fixes:
  - Signals row 4 failed on a dispatched-state assertion that was already stale before this work (see Open questions).
  - The two wire-chain rows failed because the second press on an unchanged page came back failed although it reported "Element clicked.". Each replay now gets a freshly loaded step 3.
- Rerun of `identity-signals.spec.ts` and `identity-wire-chain.spec.ts`: `6 passed (3.0m)`.
- **Final:**
  - Command:

    ```
    pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/identity.spec.ts content/tests/identity-ambiguity.spec.ts content/tests/identity-signals.spec.ts content/tests/identity-veto.spec.ts content/tests/identity-wire-chain.spec.ts content/tests/identity-resolution.spec.ts content/tests/dialog-identity/tests/dialog-bound-identity.spec.ts content/tests/selectors/tests/volatile-selector-replay.spec.ts --headed --workers=2 --reporter=list --output=test-results/content/b1-artifacts
    ```

  - Result: `62 passed (4.0m)`. By spec: identity 12, ambiguity 5, signals 4, veto 4, wire-chain 2, resolution 25, dialog-bound-identity 6, volatile-selector-replay 4.
  - `--output` points at a private folder because other workers' runs were deleting the shared `test-results/content/artifacts` mid-run.
- Narrow typecheck, run instead of a whole-package one:
  - Command: `tsc -p <scratchpad>/tsconfig.b1.json`. That config extends `apps/extension/tsconfig.test.json`, and its `files` are the 7 owned files plus the three fixture importers (`large-page-resolution`, `dialog-bound-identity`, `volatile-selector-replay`).
  - Result: exit 0, no output.
- `node scripts/structure-audit.mjs`: exit 1 with one violation, `[directory-files] apps/extension/src/content/extraction/tests/: 28 source files`. That folder is not mine. My files carry only advisory warnings: `identity-fixtures.ts` has 13 exported values and `identity-resolution.spec.ts` has 657 lines, both under the hard limits.
- Unit tests: none were added, because no logic moved.

## Not verified

- The two Blocked rows still open `ambiguous-targets` and `identity-drift`. They ran in the final command and passed, but Wave C's guards will refuse them until hooks B-1 and B-2 land.
- `large-page-resolution.spec.ts` was typechecked only. It opens `identity-drift` and belongs to another worker. The changed `armMode` was exercised through the blocked reworded-aria row, which passed.
- No whole-package typecheck or full suite was run; the lead runs those.
- The pinned scores were measured on this tree on 2026-10-19 and move with Core's matcher constants: 0.727 and 0.64 for the cart tie-break; −0.073 and −0.099 for the redesign; 0.840 for the exact match; 0.80 and 0.79 for the checkout twins; 0.86 for the class-set tie.
- Everything ran in the content harness only. No real extension or background worker was involved.

## Open questions or contradictions found

1. **The resolver closes the quote drawer while it retries.** On refusal paths it reports "closing 1 dialog the page had put in the way", and the click log shows the drawer's × being pressed. That drawer holds the recorded control, and the person opened it on purpose. This happened on:
   - the redesign replay;
   - the class-set impostor;
   - near-miss R2;
   - the stale repair.

   It also showed up in the probe of the disabled-twin gate row. After the press opened the drawer, the log shows ×, then a second press, and the drawer ends open. The rows assert that no form action was pressed and allow the × close. This looks like a defect: interruption recovery should not dismiss the dialog the step's own `context.dialog` names.
2. **An unchanged realistic control scores below 1.000 against itself.** The exact match scores 0.840 for Continue and 0.872 for Send request, read off the same page a moment earlier, where the synthetic Save scored 1.000. The generated-id rule doesn't explain it, because the id is still on the page. The cause is unknown.
3. **Where a recorded toggle's state lives.**
   - The B5 comment in `domain/src/output-nodes/targets/targets.ts` says the element's `checked` is "what a replayed toggle has to reproduce". But since t425 (719eea64, 10 October), `payloads.ts` strips state from the step's element.
   - As a result, the original `dispatched.checked` assertion has failed on any page since then; the spec was last edited on 15 September.
   - The row now asserts the state where `check.ts` reads it, `command.checked` from `webAutomationActionFromGatewayCommand`, and asserts that the element carries no state.
   - Either the comment in `targets.ts` or t425 should be corrected.
4. **bigbox `redesigned-buy-box` and its manifest disagree.** The manifest says a provider-free run fails with `target_not_found`. But replaying the recorded Add to cart press resolves the moved Add to cart (scored-candidate, 0.644) and does not press Buy now. Either the manifest describes a different step, or the content script now recovers without a provider what the variant expects only a repair to pass.
5. **Realistic twins aren't separated by the recorded descriptor.** It scores company-website's header and hero quote buttons 0.80 and 0.74, and everything-store's two "Place your order" buttons 0.80 and 0.79. Both are safe refusals. Their landmarks differ (banner and main; main and complementary), but landmark context isn't scored.
6. A second press on a page whose state it didn't change comes back `failed` with the message "Element clicked." This is presumably press-answer behaviour; it is noted here because it shaped the wire-chain row.
7. `identity-fixtures.ts` no longer names a synthetic scenario, apart from comments describing the kept `SAVE_BASELINE`, `DISPLAY_NAME` and `armMode`. Those stay until `large-page-resolution.spec.ts` is retargeted.
