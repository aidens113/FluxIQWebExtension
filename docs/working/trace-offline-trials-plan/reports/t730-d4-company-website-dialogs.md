# t730-d4: company-website dialogs and redeploys as site modes

## Outcome

Done. All seven dialog rows now run on company-website modes that the site switches on itself through `set-mode`. None of them adds a dialog to the page from the test any more.

Two of the identity-veto rows simulated a redeploy by editing the page (lines ~68 and ~203). They now run on two more modes. The default site is unchanged, and the manifest and live tasks were not touched.

The final headed run of the five spec files printed **36 passed (4.3m), exit 0**.

## Rows

| row | before | now | headed result |
| --- | --- | --- | --- |
| dialog-refusal › a dialog holding a robot check… | dialog added by the test over the settled home page | mode `security-check`: "Security check" with a "Security image" canvas and Verify / Close; the row also asserts `interstitial.pressed: null` | pass |
| … a vendor captcha frame… | added by the test (`iframe title=reCAPTCHA src=about:blank`) | mode `captcha-check`: "Before you continue", "confirm you are not a robot", a reCAPTCHA iframe (`srcdoc` checkbox), Not now | pass |
| … a password prompt… | added by the test | mode `sign-in-again`: "Confirm it is you", a password form (Continue) and Cancel | pass |
| … a second-factor prompt… | added by the test | mode `sign-in-code`: "Enter the code we sent", a `one-time-code` input, Continue / Cancel | pass |
| … a card form… | added by the test | mode `card-on-file`: "Add a card" for a cover plan's renewal, a `cc-number` input, Save card / No thanks | pass |
| … a payment confirmation… | added by the test ("Authorize this payment of 42.00") | mode `deposit-authorisation`: "Confirm your payment", "authorise this payment of £30.00" (the site's own deposit), Continue to my bank / Cancel | pass |
| dialog-dismissal › a consequentially-labelled control… is not a way out | added by the test ("Before you go") | mode `account-move`: "Before you go" with the same three buttons (Close account / Skip and delete my drafts / Not now, cancel my subscription). The row also asserts the third button is visible and `interstitial.pressed: null` | pass |
| identity-veto › the recorded class set on a different action in Send request's slot is refused | Send request swapped in the page for a button with the same class | Recorded on the default site, then mode `quotes-paused`: the slot holds a primary-styled "Save and finish later" with id `ids.draft`, and nothing on the step sends. The message expectation is now `refused button#${ids.draft} "Save and finish later" scoring -0.` (see Open question 1) | pass |
| identity-veto › a recording with no stable identifier… corroboration refuses | page edited: header and hero quote buttons removed, a 32px blank button added to the top bar | Recorded on the default site, then mode `phone-quotes`: no header or hero quote button, and the top strip has a call button with an `aria-hidden` SVG, class `headerCta`, and no text, name or id. The row asserts the button is in view | pass (score still ≥ 0, refused) |
| identity-veto › a vetoed strategy is a miss (footer reorder, line ~122) | page edited | **left as is**: outside the two named injections (reason below) | pass |
| identity-veto › a strong match is not second-guessed (restyle, line ~156) | page edited | **left as is**: outside the two named injections (reason below) | pass |

**Why two veto rows still edit the page.** The brief named the two DOM injections at ~68 and ~203. The reorder and restyle rows only edit existing controls.

- **Restyle row:** a mode could host it. It needs Send request to keep its generated id while dropping its test id and taking a class outside the site's hashed vocabulary. That last part is the hard bit, because the site has no unhashed classes.
- **Reorder row:** a mode that puts Continue before Back is also plausible.

I did not convert either; the supervisor can add them if wanted.

`dialog-refusal.spec.ts:200` still removes the crossborder banner's decline links in the page. That row is out of this brief's scope: it is on another scenario.

## What changed and why

Scenario files (`apps/scenario-lab/src/scenarios/company-website/`):
- **`types.ts`**
  - `siteModes` gains `quotes-paused`, `phone-quotes`, `security-check`, `captcha-check`, `sign-in-again`, `sign-in-code`, `card-on-file`, `deposit-authorisation` and `account-move`, each documented in place.
  - The state gains `interstitial: { pressed: string | null }`.
- **`data/interstitials.ts`** (new): `INTERSTITIALS`, which gives each dialog mode its label, its body (drawn with the site's classes) and its button labels. It is exported from `data/index.ts`.
- **`state.ts`**
  - New visitors start at `{pressed: null}`.
  - New operation `answer-interstitial` records a press only when the control is one of that mode's buttons and the dialog is still open. Anywhere else it is a no-op.
- **`pages/interstitial.ts`** (new): server-renders the dialog on a `modalScrim` (z 70, above the sticky header) on every page until it is answered. It is exported from `pages/index.ts`.
- **`pages/shell.ts`**
  - Renders the dialog.
  - In `phone-quotes` it drops the header CTA and adds `callButton` to the top strip.
- **`pages/home.ts`**: drops the hero CTA in `phone-quotes`.
- **`pages/quote-drawer.ts`**: in `quotes-paused`, the draft button is in the right-hand slot with `buttonPrimary`, and step 3 shows a notice. The existing script binds the button by id, so the script needed no change.
- **`client/shell-script.ts`**:
  - `mountInterstitial` draws the security image on the canvas, stops the password form from submitting, and makes any button post `answer-interstitial` with its label and then remove the dialog.
  - `mountCallButton` rings the office.
- **New unit tests:**
  - `tests/interstitial-modes.test.ts` (4 tests): arming; press recording and refusal; markup signals, with no test vocabulary and no other way out; a browser run that checks each dialog covers the header CTA, then a press, a reload and the password form.
  - `tests/redeploy-modes.test.ts` (4 tests): markup of both modes against the baseline; in a browser, a quotes-paused draft (drafts 1, quotes 0) and phone-quotes (call button in view; the footer link still opens the drawer).

Specs:
- **`dialog-refusal.spec.ts`**
  - `openDialog` removed.
  - `settledCompanyHome(harness, mode?)` arms the mode first.
  - The `CHALLENGES` table is now `[name, mode, sentence]` and reads the label from `INTERSTITIALS`.
  - Header comment updated.
- **`dialog-dismissal.spec.ts`**: `openDialog` removed, `settledCompanyHome` takes a mode, the row uses `account-move`, and the header comment is updated.
- **`identity-veto.spec.ts`**: rows 1 and 4 use `quoteDrawer.open/settle(harness, mode)` from `identity-fixtures.ts` (not edited). The header comment is updated.

Every dialog button closes its dialog and is recorded by the server. So a press the runtime should not make would both let the step land and show up in `interstitial.pressed`. The rows now assert both.

## Commands run and observed results

1. From `apps/scenario-lab`, `node ../../scripts/build-cache/cli.mjs scenario-lab:build -- "node scripts/build-scenario-lab.mjs"`:
   - The first build failed with two TS errors in my new test (`document` and an optional `name`). I fixed both.
   - The later builds were clean (the last one "stored in the shared store (1091 file(s))").
2. `node --test` on the two new files:
   - The first run gave 2 fails, and the next 2. Two causes: my "absent" regexes matched the shell script's own selectors (`[data-interstitial]`, `[data-call-office]`), and two signal regexes assumed the wrong order. I narrowed both.
   - Final: **8 pass, 0 fail**.
3. `node --test dist/scenarios/company-website/tests/*.test.js dist/scenarios/company-website/qualification/tests/*.test.js`: **tests 62, pass 62, fail 0**. That is the 54 existing tests (C1's included) plus my 8.
4. `node --test dist/scenarios/tests/*.test.js` (cross-scenario: live instructions, repair tasks, person checks, realistic live tasks): **tests 29, pass 29, fail 0**.
5. `node scripts/structure-audit.mjs`: **passed (215 warning(s), 635 baselined)**. No finding names company-website or the three specs.
6. Headed run 1:
   - Command: `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/dialog-refusal.spec.ts content/tests/dialog-dismissal.spec.ts content/tests/identity-veto.spec.ts content/tests/upload-dialog.spec.ts content/tests/evidence/tests/live-page.spec.ts --headed --workers=2 --reporter=list --output=test-results/content/d4-artifacts`
   - Result: **1 failed, 35 passed (3.8m)**.
   - The failure was veto row 1's message: `element fingerprint (refused button#:rmwr: "Save and finish later" scoring -0.07)`. The site's draft button carries a generated id, so the refusal names it by that id. I pinned `ids.draft` in the expectation.
7. `… test:content -- content/tests/identity-veto.spec.ts --headed --workers=2`: **4 passed (2.1m)**.
8. Final headed run, same command as 6 with `--output=test-results/content/d4-final`: **36 passed (4.3m), exit 0**. That covers all seven dialog rows, all four veto rows, and C1's upload-dialog and live-page rows.

## Not verified

- No `tsc -p apps/extension/tsconfig.test.json`. Playwright transpiles the specs without type-checking them. The scenario-lab side was typechecked by its build.
- Chromium only. Flakiness not measured: each row ran twice headed (runs 6 and 8), and the veto rows three times.
- The new modes were exercised only in the content harness and in the scenario's headless browser tests. No Lab run and no real-extension run.
- C1's own working-tree edits to company-website (newsletter, styles, quote-script) are in the same files and status listing. I edited only the files listed above.

## Open questions or contradictions found

1. **Veto row 1's measurement moved.**
   - The refused candidate now has a generated id that contradicts the recorded one (`ids.send`), so it is named `button#<id>` and scores −0.07. The page-edited version had no id.
   - The row's subject still holds: strategy `fingerprint`, refused, `TARGET_NOT_FOUND`, nothing clicked, drafts 0.
   - If the row should pin the no-id case, the mode would need the draft button without an id, which means rebinding it in `quote-script.ts`.
2. **The vendor captcha now uses a `srcdoc` frame instead of `about:blank`.** The row passes. Its classification comes from the frame's `title`, not its content.
3. **Plausibility is a judgement call.** The six account and security dialogs open on arrival, over every page, for a returning customer of a heating firm's site: a bot filter, a timed-out session, a plan renewal, a deposit 3-D Secure, an account migration. They are hooks, not manifest variants, and are documented as such in `types.ts`.

## Addendum: lead follow-up, veto rows 2 and 3

### Outcome

Done. Both rows now run on one new mode, `quote-footer-redesign`. `identity-veto.spec.ts` no longer edits the page. The one `page.evaluate` left is a read-only XPath probe in row 4.

**Why not an existing mode:**
- `reworded-quote-submit` changes the submit's id. Row 3's subject is that the id alone survives, so this mode cannot host it.
- `redesigned-quote-submit` removes Send entirely.

**What the new mode does:** the quote drawer's footer is redesigned.
- Continue comes before Back.
- The submit moves to the new UI kit the site is adopting one component at a time. It has the classes `ui-button ui-button--accent`, no analytics test id, the text "Send", and the same generated id `ids.send`. It still submits through the human check.
- The default footer is unchanged.

### Rows

| row | before | now | headed result |
| --- | --- | --- | --- |
| identity-veto › a vetoed strategy is a miss: the Continue that moved is still found | Continue moved before Back by `insertBefore` in the page | Records Continue on the default site, then arms `quote-footer-redesign` at step 2; the recorded `> button:nth-of-type(2)` now reads "Back". Assertions unchanged: `scored-candidate`, Continue `ids.next`, step 3 shown | pass |
| identity-veto › a strong match is not second-guessed | Send edited in the page: test id removed, class `ui-button ui-button--accent`, text "Send" | Records Send request on the default site, then arms the same mode at step 3. The row asserts the button reads "Send", has exactly that class and has no test id. Assertions unchanged: resolves to `ids.send` with visibleText "Send", privacy error shown | pass |

### Files

- `types.ts`: adds the mode and its documentation.
- `pages/quote-drawer.ts`: footer order and the new-kit submit, in this mode only.
- `styles.ts`: two literal rules, `.ui-button` and `.ui-button--accent`.
- `tests/redeploy-modes.test.ts`: two new tests.
  - Markup: the footer buttons, in order, against the baseline. No element on the default site wears `ui-button`.
  - In a browser: the reordered first button, Continue, steps on, and "Send", still `ids.send` with a box, sends a quote (quotes 1, drafts 0).
- `identity-veto.spec.ts`: rows 2 and 3 converted, and the header comment updated.

### Commands and observed results

- **scenario-lab build:** built clean. The first test run had 1 failure: the baseline "no ui-button" regex matched the site-wide stylesheet rule. I narrowed it to `class="ui-button`.
- **company-website tests:** `node --test dist/scenarios/company-website/tests/*.test.js dist/scenarios/company-website/qualification/tests/*.test.js` printed **tests 64, pass 64, fail 0**.
- **Cross-scenario tests:** `node --test dist/scenarios/tests/*.test.js` printed **29/29 pass**.
- **Headed veto run:** `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/identity-veto.spec.ts --headed --workers=2` printed **4 passed (34.2s)**.
- **Typecheck:** `node_modules/.bin/tsc -p tsconfig.test.json --noEmit` (from apps/extension) exited 2 with **1 error, none in my three specs**. The error is `e2e/runtime/tests/typed-browser-readiness.spec.ts(172,26): TS2352`. A grep of the log for dialog-refusal, dialog-dismissal, identity-veto and company-website found nothing.
- **Structure audit:** `node scripts/structure-audit.mjs` printed **1 violation, not mine**: `[imports] apps/scenario-lab/src/scenarios/professional-network/tests/in-place-paging.test.ts` imports `../search/in-place-paging-script.js` past the barrel. That file belongs to another worker's in-flight work. Earlier in this task the audit passed.

### Not verified

- The full five-file headed run was not repeated after this follow-up. Only identity-veto was rerun. The dialog files and the C1 files are unchanged since the 36/36 run.
