# t730-d1-photo-social-mode

## Outcome

Done. photo-social has a new rendering, `saved-logins`, armed through `set-mode`. It is the login page on a device that remembers its accounts. Every other page is unchanged, and the baseline login page is unchanged too.

The six rows now run on the mode, and none of them injects DOM any more. All three spec files passed headed: 32 passed.

There was no row whose shape could not fit the mode, so no injection was kept.

## What changed and why

### Scenario (`apps/scenario-lab/src/scenarios/photo-social/`)

- **`types.ts`**: added `"saved-logins"` to `photoModes`, with a doc entry. `set-mode` already accepts any member and starts a fresh visit.
  - I added no manifest variant, live task or repair task. `scenario.test.ts`, which pins the manifest's variant list, still passes unchanged.
- **New directory `pages/saved-logins/`**: `values.ts`, `login-extras.ts`, `device-panels.ts` and `index.ts`, one export per file.
  - **`values.ts`** exports `SAVED_LOGINS_VALUES`: every value the page itself keeps hidden. The specs import it through the scenario barrel and search the whole wire for all of it. All values are made up; the phone number is in the UK 07700 900xxx fiction range.
  - **`login-extras.ts`** adds three things inside the login form, after its error line:
    - a `<label id>` "Password hint" wrapping a `data-sensitive` readonly textarea. The label also names a `div[role=button]` "Show" through `aria-labelledby`.
    - "Security question": a `data-sensitive` select with one option, the saved answer.
    - "Stay logged in": an ordinary select with the option "For 30 days".
  - **`device-panels.ts`** adds three sections below the form, each named by its heading:
    1. **"Accounts on this device"**: `ul[data-testid=saved-logins]` with 3 `li[data-testid=saved-login]` rows. Each row has a handle span, a "Last used …" span and an `input type=password` served with a `value`. The password is marked by its type alone. photo-social already uses test ids, on its consent buttons and relay scripts.
    2. **"Backup codes"**: 3 `li[data-testid=backup-code]` rows, each nothing but an `input type=password` served with a code.
    3. **"Two-step verification"**: a `data-sensitive` list box `select[name=loginCodes][size=2]`, and a `data-sensitive` contenteditable region `aria-label="Recovery note"`. The region holds `<data value="+44 7700 900461">Aunt Rosalind</data>`. A real HTML element with a `value` attribute replaces the injected span that had a non-standard `value`.
- **`pages/elsewhere.ts` `loginPage`**: only in this mode, the username and password inputs get a `value` (the remembered sign-in), and the extras and panels are appended. Baseline output is byte-identical; a unit test checks this.
- **Barrels**: `pages/index.ts` exports the three new names, and the scenario `index.ts` exports `SAVED_LOGINS_VALUES`.
- **`tests/saved-logins.test.ts`** (new, 6 tests). It checks:
  - the arm and reset, and that the mode is never the default;
  - the baseline login page has no marked content, no `value=` and none of the hidden values;
  - home, profile, explore, subscribe, inbox and saved pages give the same markup in both modes;
  - the structure of the form's extras, and that the `aria-labelledby` target is unique;
  - the row templates for accounts and backup codes;
  - each hidden value appears the expected number of times, and the visible text uses no test vocabulary (`synthetic|fixture|secret|sensitive|test|planted|scenario`);
  - the page has one form and no `<button>`.

### Specs (`apps/extension/e2e/content/tests/`)

- **`actions.spec.ts`**:
  - `addContentBearingControls`, `addSnapshotOnlyRoutes`, `INJECTED_SECRETS`, `DRAFT_SECRETS` and `SNAPSHOT_SECRETS` are deleted.
  - A new `openSavedLogins` arms the mode through the spec's own `mutate` and opens `accounts/login/`.
  - Every row searches the wire for all of `SAVED_LOGIN_SECRETS`.
  - Elements are found with `descriptorOf`, by element identity, rather than by test-id selectors.
  - The header comment was updated.
  - `openFilledLogin` stays: it is used only by the out-of-scope row "sensitive control refused in every mode", which fills the page's existing fields and injects nothing.
- **`extraction/tests/inference.spec.ts`**: `injectCredentialRows` is deleted. The row arms the mode and proposes from `[data-testid=saved-login-handle]`. The extracted rows are compared with `SAVED_LOGINS_VALUES.accounts`.
- **`extraction/tests/structure-detection.spec.ts`**: `injectCredentialRows` is deleted. The page's own backup-code list replaces the secret-only rows, and the remove-then-reinject step is gone, because both lists are on the page at once. The secret is now only typed into the existing password field, and the constant is renamed `TYPED_SECRET`.

| row | before | now | headed result |
| --- | --- | --- | --- |
| actions: container text skips sensitive contents | baseline login + injected `recovery-note` textarea, `security-answer` select, `contact-time` select | `saved-logins` form: hint textarea, security answer select, "Stay logged in" select; text = `Log inSorry, … password.Password hint Show Security question Stay logged in For 30 days` | pass |
| actions: container HTML strips sensitive values | same injection + spec-written password `value` attribute | the mode serves the password `value`; the HTML read drops it, empties the textarea and select, and keeps the username `value="tamsin.reyes"` and the "For 30 days" option | pass |
| actions: element inside sensitive control refused | injection + injected contenteditable with `span[value]` | `select[name=securityAnswer] option` and the `<data value>` inside the marked recovery note; ordinary `select[name=stayLoggedIn] option` still reads `30-days` | pass |
| actions: snapshot never quotes sensitive contents | injection + injected listbox, contenteditable, `span#hint-name` textarea + `?` button | list box `loginCodes`, recovery note, hint label naming "Show" (`text: "Show"`, `accessibleName: "Password hint"`); labels "Password hint", "Security question", "Recent login codes" read as their own words | pass |
| inference: password in repeating row proposed excluded | 3 injected `credential-row` li on login page | "Accounts on this device" rows: item `[data-testid="saved-login"]`, `saved-login-password` value/exclude, handle and last-used read for all 3 rows | pass |
| structure-detection: sensitive controls refused, excluded, never quoted | injected secret-only rows, removed, then labelled rows injected | backup-code rows refused `sensitive_region` (on row and input); account rows detected, item `[data-testid="saved-login"]`, password excluded; no typed or served secret in structure or messages | pass |

## Commands run and observed results

All tree paths are under `C:/Users/osrs_/FluxStuff/fxwork/t730-realistic-only-browser-specs`.

- **Build, first attempt.** From `apps/scenario-lab`: `node ../../scripts/build-cache/cli.mjs scenario-lab:build -- "node scripts/build-scenario-lab.mjs"`.
  - It failed with exit 2 on `bigbox-retail/tests/partner-widgets.test.ts` (`partnerWidgetsStrip` / `PARTNER_WIDGETS` missing). That is another worker's in-progress bigbox work, not my files.
  - My first unit-test run against that emit was 5/6. The failure was my own regex, which missed plainPage's closing `</div>`; I fixed it.
- **Build, second attempt.** It succeeded: `"build-cache":"build" … not stamped, because inputs changed while it ran`.
- **Non-browser unit tests.** `node --test dist/scenarios/photo-social/tests/saved-logins.test.js dist/scenarios/photo-social/tests/scenario.test.js dist/scenarios/photo-social/breadth/tests/expected.test.js dist/scenarios/photo-social/qualification/tests/expected.test.js` gave `# tests 27 # pass 27 # fail 0`. That is the 6 new tests plus 21 existing ones, including the manifest/variants test.
- **Browser path tests.** `node --test dist/scenarios/photo-social/tests/breadth-paths.test.js dist/scenarios/photo-social/tests/honest-and-naive-paths.test.js`:
  - First run, with other workers running concurrently: `# tests 20 # pass 19 # fail 1` ("breadth honest paths").
  - Immediate rerun: `# tests 20 # pass 20 # fail 0`.
  - Those paths never open `accounts/login`, and under baseline the login page is unchanged, so I read the first failure as load. I did not capture its failure detail.
- **Narrow typecheck.** `npx tsc -p <scratchpad>/tsconfig.d1.json`, which extends `apps/extension/tsconfig.test.json` and lists the 3 specs, gave `exit 0` with no output.
- **Headed, sensitive rows only (to read the text value).** `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/actions.spec.ts -g "sensitive|capture_snapshot: no descriptor" --headed --workers=2` gave `4 passed, 1 failed`. The one failure was the text row, still holding a `"TBD"` placeholder. It received the string now pinned in `FORM_TEXT`.
- **Headed, final.** `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/actions.spec.ts content/tests/extraction/tests/inference.spec.ts content/tests/extraction/tests/structure-detection.spec.ts --headed --workers=2 --reporter=line --output=test-results/content/d1-artifacts` gave `32 passed (5.1m)`, exit 0. That is 20 + 3 + 9 tests.
- **Structure audit.** `node scripts/structure-audit.mjs` gave `structure-audit: passed (215 warning(s), 635 baselined)`, exit 0.
  - The only line naming my files is the existing advisory `[file-lines] actions.spec.ts: 472 lines`. The file had 488 lines before my change.

## Not verified

- No whole-package typecheck, `pnpm check` or full suite. Only Chromium (the content harness) was run; Firefox was not.
- Only one final headed run, not two.
- I did not check other specs that open photo-social's login page under baseline. Baseline is byte-identical (unit-tested), so they cannot be affected.
- No live or Lab run. No live task uses the mode.

## Open questions or contradictions found

1. **The concurrent bigbox edit breaks the scenario-lab build mid-way.** Another worker's `partner-widgets` work made my first build fail. It built cleanly a minute later. I touched nothing in bigbox.
2. **Two values are still written into existing fields, not injected.** `actions.spec.ts` `openFilledLogin` sets the password's `value` attribute on the baseline page. It belongs to a row outside this brief. The `saved-logins` mode now serves such a value itself, so that row could move to the mode too if the lead wants no spec-written attributes at all. `structure-detection` still types `TYPED_SECRET` into the page's own password field, which is what a person does.
3. **The one-time first-run failure in photo-social's breadth browser paths** passed on immediate rerun. Its detail was not captured.

## Follow-up: `openFilledLogin` moved onto the mode (lead request)

### Outcome

Done. `openFilledLogin` and `PASSWORD_SECRET` are deleted from `actions.spec.ts`. The row "extract: a sensitive control is refused in every mode (photo-social's password and card number)" now opens the page with `openSavedLogins`. That form already serves the remembered password in the field's `value` attribute, so the spec writes nothing into the login page.

### What changed

- The password is refused in every extract mode, and the wire is searched for every value in `SAVED_LOGIN_SECRETS` plus the card number.
- The targeted-rule check now expects the pre-filled username, `SAVED_LOGINS_VALUES.username` (`tamsin.reyes`). It used to type and expect `maya@example.test`.
- The second half of the row is unchanged: it types a card number into the Verified payment form's real `cc-number` field, as a person would, and expects that field to be refused too. No attribute is written and no element is added.
- The header comment now says the spec writes nothing into the page.

| row | before | now | headed result |
| --- | --- | --- | --- |
| actions: sensitive control refused in every mode | baseline login; spec filled username and wrote the password `value` attribute | `saved-logins` login, pre-filled by the page; username read as `tamsin.reyes`; card number typed into the Verified form as before | pass |

### Commands run and observed results

- `npx tsc -p <scratchpad>/tsconfig.d1.json` (the 3 specs) gave `exit 0`.
- `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/actions.spec.ts --headed --workers=2 --reporter=line --output=test-results/content/d1-artifacts` gave `20 passed (2.4m)`, exit 0.
- `node scripts/structure-audit.mjs` gave `passed (216 warning(s), 634 baselined)`. The only line naming my files is the existing advisory `actions.spec.ts: 456 lines`, down from 488 before t730-d1.

### Not verified

- `inference.spec.ts` and `structure-detection.spec.ts` were not re-run, because this follow-up did not change them. Their last headed run was in the 32-passed run above.
