# t401: safe interference clearing (worker report)

Branch `task/t401-safe-interference-clearing`, flat worktree
`C:/Users/osrs_/FluxStuff/fxwork/t401-safe-interference-clearing`. Nothing committed.

## Outcome

**Done.** All four points are implemented, the narrow checks pass, and **matrix row 13a now passes**, headed and
provider-free. One caveat: the evidence does not support t399's reading of defect 1. The extension's clearing never
pressed "Try again", in the unchanged code or now. See "What the evidence actually shows" below, and Open questions 1
and 2.

## What changed and why

### First: what the evidence actually shows (read this before the code)

I reproduced both t399 findings in the content harness on the real social-network-feed page, before changing anything
(new spec `apps/extension/e2e/content/tests/safe-clearing/tests/social-feed-safe-clearing.spec.ts`).

- **Defect 1 did not reproduce in the extension.** I set up the same state: three confirms, a fourth refused with
  `web.action.rate_limited`, then waited until the notice showed **both** OK and "Try again". The retry used Core's
  exact command shape (`element: { selector }`). The unchanged clearing pressed **OK**, never "Try again". The trace
  read `absorbing blocking_dialog, closing 1 dialog …`, the node's own press then confirmed Freya, and the site state
  was `rateLimited: 1` with Freya confirmed. The vocabulary already had "Try again" on no list. Existing unit tests
  (`way-out.test.ts`) also cover OK plus "Try again" in either order.
- **In 13a, Lin was confirmed before Core's retry reached the page.** The retained attempt records
  (`rmx-13a-c1932c59`), in time order from the first command:
  - 32.4 to 38.3 s: Lin's confirm is refused (`rate_limited`, `retryAfterMs` 6500). The notice says "try again in 4
    seconds", so "Try again" appeared at about 39.3 s.
  - 45.6 s: Core's retry. Its account lists `target_absent` for **all five attempts, starting with the first**. The
    account records faults in order (`recovery/account.ts`), and its one `closing 1 dialog` came after them. So Lin's
    Confirm was already gone when the retry began. In the harness, the same retry starts with `blocking_dialog`,
    because the Confirm is still there under the notice.
  - So something confirmed Lin between 38.3 and 45.6 s, while no extension command was running. t399's inference
    ("the clearing must have pressed Try again") does not fit this timeline.
  - The same run has a second anomaly. Lin's was only the third confirm, yet it was refused; the window allows
    three. Jonas's command took 3.6 s. Both point to an extra Confirm press somewhere (a second press or a duplicate
    delivery), not to the clearing. I could not identify it from the retained records; see Open questions.
- **Defect 2 reproduced, but its trigger is the Flow's selector.** The 13a/13b "Not now" selector
  `[role="dialog"][data-lb="dlg-t"] > …` matches nothing: the rendered prompt carries no `data-lb` (checked in the
  harness: 0 matches). So the step's target was absent, and on an absent target the clearing was told nothing at
  all. It then closed the prompt as a wall. That is the gap point 2 of the brief asks to close.

So I implemented all four points as briefed. For points 1 and 2 the result is defence in depth, plus the absent-target
gap. Point 3 gives Core a fact to show, and it will also show directly what the clearing pressed in any future run.

### 1. The clearing presses only a control whose effect is to dismiss

New `interference/press-guard/` (`acting-control.ts`, `acting-wording.ts`, barrel), applied by `way-out.ts`'s press
question (`mayBePressed`), so `clear`, `presence` and the classifier still agree. A candidate way out is now refused
in either of two cases:

- **By role.** The control a press reaches would submit a form: a submit button, or a `<button>` with no type inside
  a form. The exception is `form[method=dialog]`, which only closes its dialog. It is also refused when it toggles its
  own state (checkbox, radio, switch, option).
- **By wording.** The element pressed, or the button or link around it (`closest(PRESSABLE_HOST)`), carries wording
  that is not itself an admitted way out and contains an acting word. The acting words are try again, retry,
  confirm, submit, send, accept, agree, yes, sign up, sign in, log in, register, join, continue, proceed, enable,
  turn on, install, claim, redeem, reload and refresh, plus the existing consequential deny-list. So a "×" inside a
  `<button aria-label="Retry">` is refused, and so is `aria-label="Close"` on a control whose text is "Confirm
  request".

Other changes in this part:

- The consequential deny-list moved to `interference/consequential-word.ts` (`hasConsequentialWord`), because two
  readers now use it. `vocabulary.ts` behaviour is unchanged, and its exports stay at 8.
- A rate-limit notice is still closed only by OK, Got it or Understood, or by a close control. With only "Try
  again" it is left alone, and `clearableLayerOverPage` answers false.
- No new mechanisms were added (no Escape, no backdrop clicks). The existing rules have neither, and the brief allowed
  them only where those rules already did.

### 2. A layer that holds the step's target is never cleared, even when the target is absent

New `interference/clearing-target.ts` defines `ClearingTarget = { element?, selector?, names? }` and
`layerHoldsTarget`.

- When the target resolved, the element is the only rule (as before, exact).
- When it did not, the layer is spared if the step's selector matches inside it (shadow roots included; a selector
  the page cannot parse matches nothing), or if it holds a control whose own name equals a name the step's
  fingerprint carries: `accessibleName`, `label`, `visibleText`, `text` or `ariaLabel`. The comparison is whole-name,
  case-insensitive, and only for names up to 48 characters.

Wiring:

- `overlays.ts` (`overlaysAt` and `overlaysOverPage`) and `presence.ts` accept an `Element | ClearingTarget`. Existing
  callers that pass an element are unchanged.
- In `execute.ts`, the intervention and the layer probe now receive `clearingTarget(action, deps, resolve)`.
  - On `target_absent` the element is not resolved again, so each attempt still resolves its target exactly once
    (`execute.test.ts` asserts this). Only the selector and names are used there.
  - A wall that hides a target not yet drawn holds neither, so it is still cleared. company-website's "wall over a
    target not drawn yet" row passes.

### 3. What the clearing did is on the action result

- **Domain.** New `domain/src/actions/cleared-layers.ts` defines `WebAutomationClearedLayer = { kind, control }`.
  - `kind` is one of consent, rate_limit, promotion, assistant or dialog. robot_check is excluded because it is never
    pressed.
  - `control` comes from a closed list of 21 allow-list words, such as "OK", "Not now", "No thanks" and "Close".
  - `webAutomationClearedLayersValue` keeps only those two words per entry, at most 12 entries.
  - `WebAutomationActionResult.clearedLayers` is declared in `actions/types.ts`. `gateway-mapping.ts` copies it
    through the sanitizer, as it does `checkWait`, and it is exported from `client/index.ts`.
- **Extension.**
  - The press loop moved to `interference/press-ways-out.ts`, which returns the records. `clear.ts`'s
    `clearInterference` returns their count, so the loop's default in `recovery/attempt.ts` is unchanged.
  - `control-word.ts` names the pressed control by the allow-list phrase its label begins with, never by the label
    itself. "No thanks, I would rather pay full price" is recorded as "No thanks".
  - `execute.ts` collects the records across interventions, and `recovery/record.ts`
    (`recordRecovery(result, account, cleared)`) sets `result.clearedLayers`.
  - The recovery sentence ("closing N dialog(s) the page had put in the way") is unchanged, so existing matchers in
    Core, the Lab and the specs still hold.
- **Not done (Core side).** Core's trace and the chat do not read `clearedLayers` yet. The field reaches Core inside
  the dispatch payload's `result`, where the attempt record stores it. Showing "Closed a notice the page put in the
  way" (B2) is Core and panel work, outside this brief.

### 4. Tests

- `interference/tests/fake-layer.ts` is a small Node fake DOM: tag, attributes, parents, `closest` and `matches` over
  simple selectors, painted boxes, presses that record themselves, and a page installer.
- `interference/tests/acting-control.test.ts` checks each control class:
  - Close, ×, Not now, No thanks (including the long "pay full price" one), Maybe later and Dismiss are pressed.
  - OK is pressed on a rate-limit notice.
  - Try again, Retry, Continue, Confirm, Accept, Accept all, Yes, Sign up, Subscribe, Submit, Send and Turn on are
    never pressed.
  - A glyph inside a Retry or Try again button is refused, and so is a Close-named control whose text confirms.
  - Form submits are refused, except type=button and method=dialog. Stateful roles are refused.
  - Reject all and "Continue without accepting" still work on a consent layer.
- `interference/tests/press-ways-out.test.ts` runs end to end on the feed's own layers:
  - OK plus Try again: only OK is pressed, recorded as `{rate_limit, OK}`. The same holds with Try again first.
  - Only Try again: nothing is pressed, and the layer is not clearable.
  - A prompt over another target is closed and recorded as `{dialog, Close}`; "Turn on" is never pressed.
  - The prompt is kept when it holds the resolved target, when the selector matches inside it, or when it offers the
    recorded name. 13a's own unmatched selector is used with the name "Not now".
  - The wall is still cleared when nothing identifies it.
  - At most three layers are pressed per intervention.
- `interference/tests/control-word.test.ts` checks the label-to-word mapping, and that every word is in the domain's
  closed set.
- `recovery/tests/record.test.ts` gains a row: the record is set, it is absent when nothing was pressed, and a
  smuggled word is dropped.
- Domain: `actions/tests/cleared-layers.test.ts` and `client/tests/gateway-mapping-cleared-layers.test.ts`.
- Content harness, `safe-clearing/tests/social-feed-safe-clearing.spec.ts`, on the real scenario page:
  - Rate-limit OK plus Try again: OK is pressed, the node's press confirms, `clearedLayers` is
    `[{rate_limit, OK}]`, and `rateLimited` stays 1.
  - "Not now" with a working selector: the step presses it itself, with no clearing.
  - "Not now" with 13a's unmatched selector plus a recorded name: the clearing never answers the prompt.

## Commands run and observed results

All runs were in the t401 worktree.

- **Repro before any change.** `node scripts/test-content.mjs safe-clearing` (apps/extension):
  - Rate-limit row: everything held except the new field (it was `undefined`). The account read `the execution
    recovered on attempt 2 after absorbing blocking_dialog, closing 1 dialog the page had put in the way, waiting
    150 ms`, the state had Freya confirmed, and `rateLimited` was 1.
  - "Not now" row with 13a's selector: failed `nothing matched; …absorbing target_absent ×5, closing 1 dialog …`.
    A `page.locator(...)` count for that selector was **0**.
- **Unit tests.** `EXTENSION_TEST_BUILD_LABEL=t401 node scripts/test-extension.mjs action-runtime/interference
  content/actions` gave **198 pass, 0 fail**. Widened to `content/action-runtime content/actions`: **449 pass, 0
  fail**.
  - An intermediate run failed 2 rows in `execute.test.ts`, because the absent-target path re-resolved the target. I
    fixed that by not resolving on `target_absent`.
- **Domain tests.** `DOMAIN_TEST_BUILD_LABEL=t401 node scripts/test-domain.mjs cleared-layers gateway-mapping`:
  **31 pass, 0 fail**.
- **Typechecks.** Extension `npx tsc -p tsconfig.json --noEmit`: no output. Domain `npx tsc -p tsconfig.json
  --noEmit` and `-p tsconfig.test.json --noEmit`: no output.
- **Build.** `pnpm --filter @fluxiq-web-extension/extension build`: `chrome: verified 22 files`, `firefox: verified
  22 files`, `e2e-chromium: verified 22 files`.
- **Structure audit.** `node scripts/structure-audit.mjs 2>&1 | grep -E "FAIL|structure-audit:"` gave
  `structure-audit: passed (184 warning(s), 651 baselined)`. No warnings fall on files I touched in `interference/`.
  - Earlier runs flagged an `as never` cast and an empty `catch`. Both are fixed. The 9-export and 17-file advisories
    were removed by splitting out `consequential-word.ts` and `press-guard/`.
  - Remaining advisories on touched files predate this task: line counts of `domain/src/actions/types.ts` and
    `client/gateway-mapping.ts`.
- **Content harness, new spec.** `node scripts/test-content.mjs safe-clearing`: **3 passed**.
- **Content harness, existing clearing specs.** `node scripts/test-content.mjs dialog-dismissal dialog-refusal
  own-layer press-answers shadow-root`: **45 passed, 2 failed**. Both failures predate this task: I swapped HEAD's
  versions of every modified extension source in, re-ran the two, and got the same 2 failures, then restored mine.
  - `dialog-refusal.spec.ts:96` expects `web.target.not_actionable`; the click now succeeds.
  - `company-website-layers.spec.ts:100` expects `web.action.rejected`; it got `web.target.not_shown`.
- **Matrix row 13a.** `FLUXIQ_TEST_ENV_FILES=none pnpm lab recovery-matrix --case 13a`. (`--row` takes only a number;
  `--row 13` would also run 13b.)
  - The first launch was refused by the Lab: the shared Core is 2 commits behind Core's dev (`af964548` and
    `3f710e68`, t402 selector facts, which the 13a Flow does not use). The brief says the shared Core is read-only, so
    I did not sync it.
  - Re-run with `FLUXIQ_LAB_ALLOW_BEHIND_CORE=1`, as t399 did. Result: `{"caseId":"13a","verdict":"passed",
    "reasons":[]}`, run `succeeded`, 14 attempts. Site state: `confirmed` = all four (rq_7a95b3, rq_8b41c7,
    rq_c7a0e5, rq_e24f90), `rateLimited: 1`, `confirmations: 4`, `retries: 1`. s12 (Freya) failed
    `action_failed/web.action.rate_limited` and its retry succeeded; every other step succeeded first time. Bundle:
    `test-runs/recovery-matrix/rmx-2026-10-10T02-45-41-974Z-9ba47e/` (ignored; no workspace retained, since it
    passed).

## Not verified

- **One 13a run only.** It passed with the rate limit falling on the fourth confirm, as designed. t399's failing run
  had it fall on the third (see Open question 2), so a single pass does not show that the anomaly is gone.
- **No `clearedLayers` seen from a live run.** The 13a workspace is not retained on a pass, and the matrix bundle's
  attempt summaries do not carry the field. I checked it in the content harness (real bundle, real page) and in unit
  tests only.
- **Core and the panel do not read `clearedLayers` yet.** The B2 sentence ("Closed a notice the page put in the
  way") is not produced anywhere. That is Core and panel work, outside this brief.
- **Row 13b, other matrix rows, Firefox, full suites.** Not run, as instructed. No paid runs. Core, `panel/**`,
  `background/**`, `lab-slots/` and other fxwork trees were not touched. The shared Core was only read.
- **Two pre-existing content failures.** I did not investigate `dialog-refusal.spec.ts:96` or
  `company-website-layers.spec.ts:100`. They fail identically on HEAD.

## Open questions or contradictions found

1. **Defect 1 is misattributed in t399's report (finding 2).**
   - With the same notice (OK plus "Try again") and the same command shape, the clearing presses OK, before and after
     this task.
   - In t399's run, Lin's Confirm was already gone when Core's retry began: `target_absent` was the first fault, at
     45.6 s. So Lin was confirmed between 38.3 and 45.6 s, while no extension command ran.
   - Something else pressed "Try again" or Lin's Confirm. I could not identify it from the retained records.
2. **An extra Confirm press in t399's 13a run.** Lin's was the third confirm, but the site refused it, and its window
   allows three. Jonas's command took 3.6 s.
   - Lead: the click verb's ignored-press rule presses a control once more when it sees no answer
     (`apps/extension/src/content/actions/click.ts:39-42`).
   - The feed answers a Confirm only after an async `mutate` round trip. A second press therefore pushes a second
     timestamp into the window (`requests-script.ts` `pressConfirm`), even though the server ignores the duplicate.
   - That fits the early refusal. It does not by itself explain Lin's later confirm. Worth a brief on `click.ts` and
     the feed's async answer. In this task's passing run it did not recur.
3. **The 13a/13b "Not now" selector never matches.** `[role="dialog"][data-lb="dlg-t"] > …` matches nothing, because
   the rendered prompt has no `data-lb`.
   - Hand-authored Flows give Core only `{ selector }`, so with no recorded name the clearing still cannot tell that
     prompt is the step's own. Point 2 spares it only by element, selector or name.
   - The Flow should use a selector that matches. `[role="dialog"][aria-modal="true"] > div:last-child >
     [role="button"]:first-child` resolves to "Not now" in the harness. Or it should carry a name. The file is
     `packages/test-runner/src/recovery-matrix/flows/confirm/*`, which I don't own.
4. **The name rule can spare a layer that is in the way.** It applies only when the target is unresolved. It spares
   any layer that offers a control by the step's recorded name, so an unrelated promotion that also offers "Close"
   is left alone while a "Close …" step's target is absent. I chose the conservative side (never close the step's
   own dialog). The supervisor may want it narrowed, for example to non-dialog names only.
5. **The brief says `--row 13a`.** The command accepts only `--row 13` (both cases) or `--case 13a`. I used `--case
   13a`.
