# w1-fixture-keyboard-forms report

Worker: `w1-fixture-keyboard-forms`, Wave 1 Batch B. Fixture `keyboard-forms`,
export `keyboardFormsScenario`, corpus rows W02 and W03, evidence for D5.

## Outcome

**Done.** The placeholder is replaced by an account-settings fixture:

- a form that Enter in a text field submits, and a button submits too;
- a labelled checkbox;
- a labelled radio group;
- an ARIA combobox that opens on keydown and filters on every `input` event.

The manifest carries the W02 primary workflow and the W03 `combobox`
workflow, with no variants. All definition-of-done checks pass:

| Check | Result |
| --- | --- |
| Clean scenario-lab build | exit 0 |
| node:test unit tests | 10 of 10 |
| Playwright page spec in Chromium | 7 of 7, and 21 of 21 over `--repeat-each=3` |
| Structure audit, with my untracked files included | no finding in my files |

## What changed and why

All paths are under `apps/scenario-lab/`.

| File | Responsibility |
| --- | --- |
| `src/scenarios/keyboard-forms/scenario.ts` | Replaces the placeholder. Keeps the export name, id, seed `123`, start path `/scenarios/keyboard-forms/`, and the title "Keyboard forms". Wires the manifest, state, and markup. |
| `src/scenarios/keyboard-forms/options.ts` | Fixed option lists: 3 contact methods and 12 countries. |
| `src/scenarios/keyboard-forms/state.ts` | `KeyboardFormsState`, `createKeyboardFormsState`, and `mutateKeyboardFormsState`. |
| `src/scenarios/keyboard-forms/manifest.ts` | The W02 primary workflow and the W03 `combobox` workflow. |
| `src/scenarios/keyboard-forms/markup.ts` | Server-rendered page. |
| `src/scenarios/keyboard-forms/client-script.ts` | Browser behaviour, returned as the inline module script. |
| `src/scenarios/keyboard-forms/tests/scenario.test.ts` | 10 node:test cases. |
| `e2e/keyboard-forms.spec.ts` | 7 Playwright tests. |

The fixture is split into one responsibility per file (placement rules).
There is deliberately no `index.ts` barrel. `registry.ts` imports
`./scenarios/keyboard-forms/scenario.js` directly, and a barrel would turn
that import into a barrel-skip finding in a file I must not touch.

### The page

The page is an account settings page. One
`<form data-testid="settings-form" aria-labelledby="settings-heading">`
holds four controls:

- **Display name and submit button.** A labelled text field (`display-name`)
  and a "Save profile" submit button (`save-profile`), which is the form's
  default button. The page has **no key handler** for Enter. Enter in a
  text field submits only through native implicit submission, or through an
  emulation of it. The `submit` handler posts `save-profile`.
- **Checkbox.** "Email me product updates" (`email-updates`). Its `change`
  event posts `set-email-updates`.
- **Radio group.** A `fieldset` with the legend "Preferred contact method"
  and three radios: Email (the default), Text message, and Phone call
  (`contact-email`, `contact-sms`, `contact-phone`). A delegated `change`
  handler posts `set-contact-method`.
- **Country combobox.** An `input` with `role="combobox"`,
  `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`, and
  `aria-activedescendant`. The listbox is a labelled `ul role="listbox"`
  (`country-listbox`) with 12 `li role="option"` elements
  (`country-option-<code>`). Its behaviour:
  - It opens on keydown: a printable key, ArrowDown, or ArrowUp.
  - It filters on every `input` event, by case-insensitive prefix.
  - ArrowDown and ArrowUp move the highlight, wrapping at either end.
  - Enter chooses the highlighted option and calls `preventDefault()`.
  - Escape or blur closes the listbox.
  - A click chooses an option. `mousedown` on the listbox is prevented so
    focus stays in the input.
  - Choosing an option posts `choose-country`.
  - No handler reads `isTrusted`.
- **Status lines.** Each outcome has a `role="status"` line:
  `profile-status`, `email-updates-status`, `contact-method-status`, and
  `country-status`. Each line's text is `state.status.*` from the server,
  so the page and the manifest facts read one source. The client runs
  mutations one at a time so a status line never shows an older response.

### State (the `/__control/final-state` oracle)

```text
profile:     { displayName, outcome: unsaved|saved|rejected, submissionCount, lastSubmitter: "save-profile"|null }
preferences: { emailUpdates, contactMethod: email|sms|phone, country: <code>|null }
status:      { profile, emailUpdates, contactMethod, country }   // exact status-line text
```

The state does not depend on the seed. It uses no clock, no randomness,
and no timers. The `mutate` operations:

- `save-profile {displayName, submitter}`: trims the name and caps it at
  80 characters. An empty name gives `outcome: "rejected"` and keeps the
  saved name. Every submission is counted. `submitter` is kept only when it
  is `"save-profile"`, otherwise it is `null`.
- `set-email-updates {enabled: boolean}`.
- `set-contact-method {method}`: `email`, `sms`, or `phone`.
- `choose-country {code}`: one of the 12 codes.
- An invalid payload or an unknown operation returns the same state object.

There is no `route` hook: the fixture is a single page.

### Workflows and variants

| Workflow | Row | Recording script | Expected outcome |
| --- | --- | --- | --- |
| primary | W02 | `type` display-name "Ada Lovelace"; `press` Enter on display-name; `check` email-updates true; `check` contact-sms true; `checkpoint` | **finalState:** profile-status "Saved: Ada Lovelace"; email-updates-status "Email updates: on"; contact-method-status "Contact method: Text message". **recordingEvents:** `web.element.input_changed`; `web.keyboard.pressed` x1; `web.form.submitted` x1; `web.element.changed`. **actions:** `web.dom.type`, `web.dom.keypress`, `web.dom.check`, all succeeded. |
| `combobox` | W03 | `type` country "Ne"; `press` ArrowDown; `waitForState` country-listbox (1000 ms); `press` ArrowDown; `press` Enter; `checkpoint` | **finalState:** country-status "Country: Netherlands"; profile-status "Not saved". **recordingEvents:** `web.element.input_changed`; `web.keyboard.pressed` x3; `web.form.submitted` x0. **actions:** `web.dom.type`, `web.dom.keypress`, succeeded. |

There are no variants, per the brief.

### Corpus decisions

1. **Order.** The W02 order follows the brief literally: Enter submits
   first, then the checkbox and the radio are set. So the checkbox and the
   radio save on `change`, the way a settings page autosaves, independently
   of the submit. Each has its own status line, so each outcome is observed
   on its own.
2. **Enter must not submit the form.** The combobox is in the same form as
   the display name, and W03 asserts profile-status "Not saved" and
   `web.form.submitted` count 0. An Enter that chooses an option must not
   submit the enclosing form. This fact makes the fixture test D5's "Enter
   calls `form.requestSubmit()`" rule: the emulation must skip
   `requestSubmit()` when the keydown was `defaultPrevented`. This is
   stricter than the row's literal text, so drop that fact if you disagree.
3. **The listbox opens on keydown only**, not on `input`, as the brief
   says. The recording lane's `type` is Playwright `fill`, which sends
   `input` but no keydown. So after `type`, the list is filtered but still
   closed. The first ArrowDown opens it and highlights the first match. The
   W03 script is therefore valid for both fill-style and per-character
   typing, which is why `waitForState` comes after the first ArrowDown and
   not after typing.
4. **`web.dom.check`.** The expected actions use D6's `web.dom.check` for
   the checkbox and the radio. It does not exist yet: `domain/src/io/input-model.ts`
   still maps checkbox and radio changes to text entry until Phase 1.2.
5. **Event counts.** Counts are set only where the recorder's behaviour is
   certain. `apps/extension/src/content/dom-events.ts` records every trusted
   `keydown` and every `submit`, so `keyboard.pressed` and `form.submitted`
   carry counts. `input_changed` and `element.changed` do not: the text
   field also fires `change` on blur, so an exact count would be guesswork.
6. **Submitter.** The state records `lastSubmitter` as passive evidence;
   the manifest does not assert it.
7. **Manifest metadata.** Tags are `forms`, `keyboard`, `combobox`,
   `trusted-input`. Capabilities are `forms`.

### D5 evidence, observed in Chromium by `e2e/keyboard-forms.spec.ts`

- **Native Enter vs `requestSubmit()`.** Trusted Enter in the display-name
  field submits the form, and `event.submitter` is the default button
  (`lastSubmitter: "save-profile"`). `form.requestSubmit()` also submits,
  but reports no submitter (`lastSubmitter: null`). Emulating Enter with
  `requestSubmit(<the form's default button>)` would match pages that read
  `event.submitter`.
- **Today's keypress cannot submit.** An untrusted keydown and keyup of
  Enter in a text field submits nothing (0 submit events). That is exactly
  what today's `apps/extension/src/content/actions/keypress.ts` sends, so
  W02 is expected to fail today at profile-status "Not saved"
  (`STATE_MISMATCH`), with the later steps succeeding.
- **D5's typing emulation works on the combobox.** Per-character untrusted
  keydown, value change, `InputEvent`, and keyup open and filter it. Two
  untrusted ArrowDown keydowns highlight Netherlands. The untrusted Enter
  keydown is `defaultPrevented` and chooses the option. No submit event
  fires.
- **`fill` alone is not enough to open the list.** It sends `input` but no
  keydown: the list is filtered but stays closed. If typing sent no `input`
  event at all, the list would not be filtered, the second option would be
  Australia, and W03 would fail with `STATE_MISMATCH`.
- **Radio arrow keys need trusted input.** An untrusted ArrowDown on the
  focused Email radio changes nothing. A trusted ArrowDown moves the
  selection to Text message and fires `change`. D5 does not cover this.

## Commands run and observed results

All commands ran from `F:\!FluxIQWebExtension`.

1. **Build, first two runs (12:49 and 12:51).**
   `pnpm --filter @fluxiq-web-extension/scenario-lab build` exited 2. The
   only error was in another fixture's directory:
   `src/scenarios/modal-flows/mutate.ts(35,22): error TS2322`. My files
   emitted (dist timestamps 12:51:12).
2. **Build, third run (about 12:55):** exit 0, no errors.
3. **Structure audit, normal run.** `node scripts/structure-audit.mjs`:
   "structure-audit: passed (27 warning(s), 19 baselined)", with no line
   naming keyboard-forms. It also printed "1 baseline entries can be
   lowered", without naming the entry. I did not run
   `pnpm structure:baseline`.
   - This run did **not** see my files. The audit lists files with
     `git ls-files`, and the whole `src/scenarios/keyboard-forms/`
     directory is untracked, including the supervisor's placeholder.
4. **Structure audit including my files.** I set `GIT_INDEX_FILE` to a
   scratch copy of `.git/index` in my scratchpad, ran `git add` of my paths
   into that copy only, and reran the audit. Result: "passed (27
   warning(s), 19 baselined)", no keyboard-forms finding, and the same
   "1 baseline entries can be lowered" line.
   - The shared index was not touched. `git add` wrote blob objects to
     `.git/objects` only.
5. **Client script syntax.** I rendered the browser script from
   `dist/.../client-script.js` and ran `node --check` on it: "SYNTAX OK
   (94 lines)", with 0 occurrences of `isTrusted`.
6. **Unit tests.**
   `node --test apps/scenario-lab/dist/scenarios/keyboard-forms/tests/scenario.test.js`
   - First two runs failed with `ERR_MODULE_NOT_FOUND`
     `packages/test-contracts/dist/bench-report-validation.js`. This was a
     parallel test-contracts edit: `src/bench-report-validation.ts` was
     written at 12:51:00, and `dist/index.js` already exported it at
     12:50:38.
   - I waited for the file to appear (12:53:21), then reran: "tests 10,
     pass 10, fail 0".
   - Rerun after the clean build: "tests 10, pass 10, fail 0".
7. **Page spec.** The brief's command, plus two isolation flags:
   `pnpm --filter @fluxiq-web-extension/scenario-lab exec playwright test -c e2e/playwright.config.ts e2e/keyboard-forms.spec.ts --reporter=list --output=<scratchpad>/w1-kf-pw-results`.
   The flags keep this run from cleaning the shared `e2e/test-results` that
   parallel workers write to.
   - First two runs failed on the same missing module ("No tests found").
   - After the module appeared: "7 passed (3.5s)".
   - With `--repeat-each=3 --reporter=line`: "21 passed (10.2s)".

The node tests (all pass) cover:

- manifest validity, loopback-only policy, both workflows, and no variants;
- every step target and fact subject renders as a `data-testid`;
- deterministic, seed-independent state and markup;
- `save-profile`: accepted, trimmed, capped, submitter kept or dropped, and
  rejected;
- the checkbox, radio, and combobox operations;
- invalid payloads and unknown operations return the same object;
- the semantic markup;
- the client script has no `isTrusted`, no `requestSubmit`, and no
  clock, randomness, or timers;
- saved state renders and is escaped;
- no `route` hook.

The Playwright tests (all pass):

- W02 primary workflow, driven from the manifest script, with the final
  state asserted;
- W02 button submit and empty-name rejection;
- W03 `combobox` workflow, driven from the manifest script;
- W03 with typed keystrokes, checking opening, filtering, highlighting, and
  choosing;
- W03 choosing by click;
- D5 untrusted-events evidence;
- D5 radio arrow-key evidence.

## Not verified

- **No extension recording or playback of W02 or W03.** That needs the
  extension and the test runner. So the manifest's `recordingEvents` and
  `actions` expectations are not checked against a real recording.
- **The runner cannot drive these workflows today.** `executeStep` in
  `packages/test-runner/src/run-scenario.ts` handles only click, type,
  select, scroll, navigate, and waitForState. A `press` or `check` step
  falls through without error and does nothing. The spec's `perform()`
  shows the intended mapping: `press` → `locator.press`, `check` →
  `setChecked`.
- **The runner reads final facts once.** `assertExpectedFacts` reads each
  fact once. Status lines update after a loopback round trip, so a runner
  asserting straight after the last step should poll.
- **Firefox:** not run. The Playwright config is Chromium only.

## Open questions or contradictions found

1. **W03's "Not saved" fact** is stricter than the row text; see corpus
   decision 2. Keep it (it is D5 evidence) or drop it.
2. **`web.dom.check`** is expected by W02 but is not in the domain until
   Phase 1.2 (D6).
3. **Runner step support.** `press` and `check` do nothing silently in the
   runner's `executeStep` today (see Not verified). The recording lane for
   W02 and W03 depends on whoever owns the runner adding them; I did not
   look for that owner.
4. **Uncommitted placeholder.** The supervisor's placeholder was never
   committed, so the whole `src/scenarios/keyboard-forms/` directory is new
   to git. The commit must include it.
5. **Unnamed lowerable baseline entry.** The structure audit reports "1
   baseline entries can be lowered" without naming it. It is not from my
   files: they have no baseline entries.
6. **Transient failures from other workers.** Both cleared during this
   work:
   - The `modal-flows/mutate.ts` type error was present from 12:49 to
     12:51 and gone by about 12:55.
   - The missing `packages/test-contracts/dist/bench-report-validation.js`
     appeared at 12:53:21.
7. **Scratch files** are in my scratchpad only: `w1-kf-index`,
   `w1-kf-audit*.txt`, `w1-kf-client-script.mjs`, and
   `w1-kf-pw-results*`.
