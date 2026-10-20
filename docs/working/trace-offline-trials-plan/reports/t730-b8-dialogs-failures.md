# t730-b8-dialogs-failures: dialogs, uploads, failure codes and check/assert on realistic pages

## Outcome

Partial. I moved every synthetic row in the six owned specs onto realistic scenarios, except two native-`confirm()` rows. Those are Blocked and still open modal-flows, as the brief said they should; the hook they need is below.

In the final headed run of all six files, 56 rows passed and 3 failed. All three failures were failing before I changed anything, for the same reasons. They are listed under "Pre-existing failures" and need a product or harness decision. I did not mask them.

## What changed and why

- **Files changed:** the six owned specs:
  - `apps/extension/e2e/content/tests/dialog-dismissal.spec.ts`
  - `apps/extension/e2e/content/tests/dialog-refusal.spec.ts`
  - `apps/extension/e2e/content/tests/upload-dialog.spec.ts`
  - `apps/extension/e2e/content/tests/failures.spec.ts`
  - `apps/extension/e2e/content/tests/check-assert.spec.ts`
  - `apps/extension/e2e/content/tests/actionability/tests/actionability-gate.spec.ts`
- **Not changed:** no `src/**` file, no scenario, no harness, no unit test. No logic needed moving out of the browser.
- **Synthetic ids left:** the only ones still in these files are the two Blocked `confirm()` rows and the comments that explain them.
- **Page setup:** where a site trap would get in the way of a row's subject, I answer it the way a person would, or through the site's own `/api` operation:
  - consent: `set-consent`, `consent`
  - chat greeting and chat: `dismiss-chat-greeting`, `chat`
  - newsletter offer: `dismiss-newsletter`
  - messages dock: `dock`
  - welcome popup and notification card on crossborder: `welcome`, `notifications`
- **Oracles:** wherever the site records something, the row reads the scenario's own final state.

### Disposition table

Run results are from the final run: `56 passed, 3 failed`.

| Spec | Test | Capability proved | Disposition | New home (scenario, page, target) | Headed result |
|---|---|---|---|---|---|
| dialog-dismissal | 4 rows in "a dialog the page opened over itself" | the defence closes timed promos, prompts and role-less popups | already realistic, unchanged | auction, everything-store, crossborder | pass |
| dialog-dismissal | only way out is Cancel | a dialog offering only Cancel and the act itself is never pressed; the result is blocked_by_dialog and the record says no dialog was closed | Retarget | photo-social `lena.moss/`: the real "Unfollow @lena.moss?" dialog (Unfollow / Cancel, no ×). Click on a grid post. Oracle: `following` still contains lena.moss | pass |
| dialog-dismissal | W14 interstitial between two clicks | a dialog that opens between two steps is closed on the second step | Retarget | auction home: first type runs before the 2.5 s promo, second type after it. Oracle: `promoDismissed: true` | pass |
| dialog-dismissal | injected promotion closed by Not now | a dialog is closed through its "Not now" | Retarget, real dialog | local-classifieds: notifications prompt (aria-modal, "Not now" / "Turn on"). Oracle: `notificationPrompt: "dismissed"` | pass |
| dialog-dismissal | consequentially-labelled controls are not a way out | a control starting with a dismissal word but naming an act on the person's data is never pressed | Retarget (injected dialog, see Q1) | company-website settled home; header "Get a free quote" behind the injected dialog; drawer stays closed | pass |
| dialog-dismissal | challenge left alone including its own Cancel | a robot check inside a dialog is web.intervention.required, and its ways out are not pressed | Retarget, real construct | company-website quote drawer after sending: "Confirm you are human", with the drawer's × and scrim. Click on nav "Branches". URL unchanged, drawer open, `quotes: []` | pass |
| dialog-dismissal | consent banner declined, never accepted | a consent layer is declined, never accepted, and the action then lands | Retarget | bigbox: modal consent dialog over the header search; type lands. Oracle: `consent: "rejected"` | pass |
| dialog-refusal | everything-store robot check page | a page that is itself a robot check belongs to the person | already realistic, unchanged | everything-store `robot-check` mode | pass |
| dialog-refusal | cookie banner declined; hidden dialog not touched | `clearedLayers` names the consent layer and its decline; an aria-modal dialog the page is not painting is not cleared | Retarget | company-website: consent wall (declarative shadow root) over the header button. The hidden quote drawer is the unpainted dialog. `clearedLayers = [{kind:"consent", name:"Your privacy choices", control:"Reject", controlName:"Reject non-essential", wayOut}]`; then `consent: essential`, `quotes: []`, `drafts: 0` | pass (it failed on modal-flows before; that row asserted an old `clearedLayers` shape) |
| dialog-refusal | overlay that is not a dialog, with no way out, stays a rejection | a cookie banner with no decline is TARGET_NOT_ACTIONABLE, "covered: …" | Retarget | crossborder item `1005008123450`: fixed bottom consent banner over the pinned buy bar's `[data-testid=add-to-cart]`, with "Manage choices" and "Reject non-essential" removed. Oracle: `consent: pending`, `cart: []` | pass |
| dialog-refusal | 6 challenge dialogs (robot check, captcha frame, password, 2FA code, card form, payment confirmation) | each one in a dialog is web.intervention.required, with its exact sentence | Retarget (injected dialogs, see Q1) | company-website settled home; header button behind each one; drawer stays closed | 6 pass |
| upload-dialog | upload puts file, validates names | DataTransfer upload; the file's name is not quoted in the result; the page holds name, size and type | Retarget | job-board Talentloom form (`embed/job_app?for=quillmark&token=QM-4471`, opened at the top of the page, see Q2): hidden `input[type=file][name=resume]` | pass |
| upload-dialog | W17 echo after submit | the page's own change handler sees the file, and the server stores it | Retarget, stronger oracle | same form: `.tl-filename` echoes the name; I complete the form and the Shield, then `applications[0].answers.resume === "file:ada-synthetic-cv.txt"` | pass |
| upload-dialog | non-file target rejected | upload_rejected wording | Retarget | same form: "Attach" button | pass |
| upload-dialog | bad base64 names position only | the page-side backstop does not leak the name | Retarget | same form | pass |
| upload-dialog | armed dismiss answers native confirm | `web.dom.dialog` dismiss is consumed by one confirm | **Blocked**, unchanged on modal-flows | hook below | pass (still synthetic) |
| upload-dialog | armed accept deletes draft, evidence afterwards | accept, then evidence on the next dialog action | **Blocked**, unchanged on modal-flows | hook below | pass (still synthetic) |
| upload-dialog | prompt answer reported by length only | the override answers a page-world `prompt()`; the answer is never quoted | Retarget (the test itself calls the prompt, so it needs nothing from the page) | job-board Talentloom form | pass |
| upload-dialog | dialog command with no request refused | arming is refused | Retarget | job-board Talentloom form | pass |
| failures | disabled target | TARGET_NOT_ACTIONABLE, "disabled: the element is disabled" | Retarget, real disabled control | company-website quote drawer: Back on step 1 | pass |
| failures | hidden target | TARGET_NOT_SHOWN, target_not_found, actual `^hidden: the element's display is none;` | Retarget, real hidden control | drawer `[data-testid=quote-submit]` (hidden until step 3); drawer stays open | pass |
| failures | gone target | TARGET_NOT_FOUND with `resolution.strategy = selector` | Retarget, real removal | company-website consent wall: "Reject non-essential" pressed, and the wall removes itself. The second press finds nothing | pass |
| failures | snapshot when capture is off | a thrown failure still carries a snapshot | Retarget | same as the gone-target row | pass |
| failures | 4 auth-gate rows | AUTH_REQUIRED on a sign-in gate (missing target; URL claim), plus the two control rows; the record never quotes the page's fields or URL | Retarget | photo-social `accounts/login/` (a form containing a password field). A secret is typed into the password field and must not appear in the record. The URL claim is `direct/inbox/` | 4 pass |
| failures | wait TIMEOUT, and its control | `wait_for_selector` timed_out with the timeout record; success adds no failure | Retarget | company-website settled home: `[data-testid=quote-reference]` (only on quote/received) vs the header button | 2 pass |
| failures | navigation prevented, and its control | OUTPUT_NOT_OBSERVED with the exact sentence and the URL attached; an unprevented link succeeds | Retarget | company-website nav "Branches" link | 2 pass |
| check-assert | check sets checkbox (server oracle) | check sets the state; the site acts on it | Retarget | company-website drawer step 3: `privacy`; quote sent through the human check; 1 quote stored | pass |
| check-assert | uncheck, then no-op repeat | set vs already set | Retarget | drawer `marketing` (arrives ticked); sent quote stores `marketing: false` | pass |
| check-assert | radio set and replay | radio set, then already set | Retarget | drawer step 2: `contactBy = "Text message"`; sent quote stores `contactBy: "Text message"` | pass |
| check-assert | radio uncheck and text field are ACTION_REJECTED | not_checkable wording | Retarget | same radio; Back to step 1, then `input[name=fullName]` | pass |
| check-assert | disabled control rejected | the gate's disabled refusal; the control is left as it was | Retarget, real disabled checkbox | company-website consent "Customise": "Strictly necessary" (checked, disabled), asked to uncheck; `consent: pending` | pass |
| check-assert | 8 assert rows (exists/absent/timeout, kind vs timeout, absent mismatch, text, visible-late, enabled, url, absent-late, empty) | assertion timing and the TIMEOUT vs STATE_MISMATCH split | Retarget | company-website: nav, `main h1` "Warm homes since 1987", drawer step-2 fieldset shown late by the site's own Continue, Back vs Continue, the consent wall answered 150 ms into an `absent` wait (oracle `consent: essential`) | all pass |
| actionability-gate | 2 bigbox check rows | check through the gate behind the consent scrim, then after answering it | already realistic, unchanged | bigbox | **fail, pre-existing** (see below) |
| actionability-gate | upload into a hidden input | a hidden file input still takes the file | Retarget, real construct | job-board form: the CV input really is hidden (asserted `toBeHidden`) | pass |
| actionability-gate | upload into a disabled input | refused as not_actionable, holds no files | Retarget | same input, disabled by the row | pass |
| actionability-gate | upload in an inert subtree | refused, as `web.target.not_shown` | Retarget | same form, made `inert` by the row | **fail, pre-existing** (see below) |
| actionability-gate | scroll to a covered target | the scroll reports what covers the target | already realistic, unchanged | bigbox | pass |

### Blocked: the hook the two `confirm()` rows need

No realistic site calls `alert`, `confirm` or `prompt`. I checked with a grep of the ten scenario trees, outside their tests, for `confirm(`, `prompt(`, `alert(`, `showModal` and `beforeunload`, and it matched nothing. This is the smallest armable variant that would host them:

- **Scenario and page:** company-website, `/scenarios/company-website/newsletter`. The page already lists each subscribed address with an "Unsubscribe" button (`[data-unsubscribe]`, handled in `client/newsletter-script.ts`).
- **Variant:** `confirm-unsubscribe` on the `newsletter-signup` workflow, armed with `set-mode {mode:"confirm-unsubscribe"}`. Arming resets the state, so the default site is unchanged.
- **What the variant does:** the Unsubscribe click handler first calls `window.confirm("Unsubscribe <email> from Kestrel Lane offers and reminders?")`.
  - On true, it does what it does today: `mutate('unsubscribe-newsletter', {email})`, then a reload.
  - On false, it calls `mutate('unsubscribe-declined', {email})`, a new operation that changes nothing but the count.
- **Oracle:** `newsletter.unsubscribePrompts: {accepted, dismissed}` in the company-website state, plus `newsletter.subscribers`.
- **How the rows would use it:**
  1. `apply("subscribe-newsletter", {email})`, then open the page.
  2. Arm the dialog response, press Unsubscribe.
  3. Dismiss keeps the address and gives `dismissed: 1`. A second, unarmed press falls through to Playwright's own dismiss and gives `dismissed: 2`. Accept removes the address and gives `accepted: 1`. The confirm's message is the evidence row.
- **Owner:** this is a scenario edit, so it is the lead's to make (`scenarios/**` is out of my scope).
- **Prompt rows:** they need no variant. The test calls `prompt()` in the page's world itself.

## Commands run and observed results

All runs were from the tree root, headed, without a model provider.

1. **Baseline before any edit:**
   `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/actionability/tests/actionability-gate.spec.ts content/tests/dialog-dismissal.spec.ts content/tests/dialog-refusal.spec.ts --headed --workers=2`
   - Printed: `4 failed / 21 passed (2.4m)`.
   - The 4 failures:
     - both bigbox check rows: `page.evaluate: Execution context was destroyed, most likely because of a navigation`
     - the file-transfer inert upload row: received `web.target.not_actionable` where the test expects `web.target.not_shown`
     - the modal-flows cookie row: `clearedLayers` now also carries `controlName` and `name`
2. **New dialog-dismissal rows:** `... content/tests/dialog-dismissal.spec.ts --headed --workers=2 -g "between and before"` printed `6 passed (1.1m)`.
3. **dialog-refusal first pass:** printed `1 failed / 8 passed`. The cookie row had `control` as `"Reject"`, not `"Necessary only"`; I fixed the expectation to what the product reports.
4. **failures first pass:** printed `1 failed / 11 passed`. The URL claim `/scenarios/photo-social/` matched the login page by containment, so I moved the claim to `direct/inbox/`.
5. **check-assert, upload-dialog, actionability first pass:** printed `4 failed / 24 passed`.
   - 3 were the pre-existing actionability rows.
   - 1 was the visible-late row. Asserting on the drawer root and section reads "enclosed: it is present inside a closed container…" or zero size, so I moved the row to the drawer's own `hidden` step-2 fieldset, which the site's Continue shows.
6. **Rerun of the three fixed rows:** `... -g "visible|URL claim that fails|cookie wall"` gave the cookie row and the URL row passing. The visible row then needed the step-2 change from item 5. Its final pass is in the final run.
7. **Final run of all six files:**
   `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/dialog-dismissal.spec.ts content/tests/dialog-refusal.spec.ts content/tests/upload-dialog.spec.ts content/tests/failures.spec.ts content/tests/check-assert.spec.ts content/tests/actionability/tests/actionability-gate.spec.ts --headed --workers=2`
   printed `3 failed / 56 passed (3.7m)`. The 3 failures are exactly the pre-existing actionability-gate rows, with the same errors as the baseline.
8. **Scenario count across the six files** (grep of `openHarness("…")`): company-website 26, job-board 9, photo-social 5, bigbox-retail 4, everything-store 3, auction 2, crossborder 2, local-classifieds 1, modal-flows 2 (the Blocked rows). The job-board count includes direct gotos to its frame document.

## Pre-existing failures (not caused by this brief, not masked)

1. **actionability-gate, the 2 bigbox check rows.** Ticking a bigbox facet makes the page navigate. The content script's reply dies with the page, so `page.evaluate` throws "Execution context was destroyed".
   - The first row, "refused behind the consent scrim", gets far enough that the facet's change fires. That means the check is no longer refused: the defence now apparently declines the consent and ticks the box. This contradicts the row's premise that check is refused as BLOCKED_BY_DIALOG.
   - Fixing it needs a decision. Either check is meant to clear a declinable consent layer, as click and type do since 2026-09-30, in which case the row's expectation changes. Or the gate should still refuse, which would be a product defect.
   - Separately, both rows need a target whose change does not navigate, or a harness that survives the navigation.
2. **actionability-gate inert upload.** `actions/upload.ts:41` sends the inert reason through `deps.rejected(…, "disabled", …)`, so the code is `web.target.not_actionable`. The row (t193, 2026-10-03) expects `web.target.not_shown` / `target_not_found`. It failed the same way on file-transfer. Either the verb or the row has to change; that is a product call.

## Not verified

- Runs used Chromium only. I did not run the Firefox or Chromium-baseline configs.
- Each row ran once headed in the final run, plus the earlier passes above. Flakiness was not measured; the photo-social, local-classifieds and auction rows depend on site timers.
- No typecheck. Per the brief, the lead runs it. Playwright transpiles without type checking, so a type error in these specs would not show in the runs.
- The other workers' files were being edited in the same tree at the same time. I did not run their specs.

## Open questions or contradictions found

1. **Injected dialogs on a realistic page (needs the lead's ruling).**
   - **Which rows:** 7 refusal rows need a dialog that no realistic site ships: the consequentially-labelled controls and the six challenge dialogs.
   - **What I did:** those rows keep their original test-authored dialog, but open it over company-website's settled home page instead of modal-flows. The construct being tested is the injected dialog; modal-flows only supplied a target to press.
   - **Why I counted it as a retarget:** the browser opens only a realistic scenario.
   - **If the ruling is that injected markup does not count:** these 7 rows become Blocked, with the hook "an armable variant that opens such a dialog over a realistic page".
   - **Real counterparts:** the robot check also has a real home (company-website's human check, in dialog-dismissal). No realistic site opens a credential or payment-confirmation dialog.
2. **Opening job-board's cross-origin form at the top of the page.** The harness talks to the top frame only, so the upload rows open `embed/job_app` on `lab.frameOrigin` as the top document instead of inside the careers page's iframe. It is the same document, script and state, and the CSP's `frame-ancestors` does not apply at the top. Uploading through the frame needs frame routing, which belongs to the harness (`harness.ts`, outside my scope).
3. **A possible product gap (not acted on).** The auction buy drawer ("Review your purchase", "Confirm and pay", "saved card ending 4417") does not match `challenge-evidence.ts` PAYMENT_WORDS, so the drawer is read as dismissible. Arguably that is right, since the Flow opened it and closing it moves no money. But "Confirm and pay" is a payment confirmation in plain words. Flagged for whoever owns the challenge vocabulary.
4. **`clearedLayers[].control`** is the vocabulary word the defence matched (`"Reject"`), not the control's text. The old modal-flows row expected `"Necessary only"` and had been failing on it.
