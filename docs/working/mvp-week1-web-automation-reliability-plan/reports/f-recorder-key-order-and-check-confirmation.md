# f-recorder-key-order-and-check-confirmation — P1 and P2 (extension)

Worker report, 2026-09-13, at `HEAD eb8bf99`. Brief: `briefs/finish-week1.md`,
Twenty-fifth dispatch. Private build label `frko`, removed afterwards.

## Outcome

**Done.** Both defects were still open at HEAD before any edit:
- `dom-events.ts:116-131`: the keydown listener sent its event without flushing.
- `runtime-status.ts:100-107`: there was no `web.dom.check` branch.

Both are fixed. Every guard has a mutation proof, and every restore was confirmed
byte-identical by hash. For task 3, after P2 no executable verb has a recorded
node waiting for a confirmation it never gets.

**P1's file is `apps/extension/src/content/dom-events.ts`.** `recorder.ts` is
untouched.

## What changed and why

### P1 — a key that acts on typed text is recorded after that text

**`apps/extension/src/content/dom-events.ts`**
- The keydown listener now calls `flushPendingInput()` before emitting
  `dom.keydown`, unless the key continues the typing. A pointer press and a text
  field's `change` already flush this way.
- The rule is the new `continuesTyping(event, target)`. It is true only when both
  hold:
  - the target is a text-entry control (`isTextEntryElement`);
  - the key is typing: a single character, `event.isComposing`, or one of
    `TYPING_KEYS` (Backspace, Delete, Shift, Control, Alt, AltGraph, Meta,
    CapsLock, Dead, Process, Unidentified).
- Every other key sends the pending text first: Enter, Tab, Escape, the arrows,
  Home and End, function keys. So does any key on a control that is not a text
  field.
- The header comment now names the three places that flush.

**Why the brief's literal wording could not be followed.** The brief says "before
any `dom.keydown`", but a real user's typing sends a keydown before every
character's `input`. Flushing on all keys would split one debounced `dom.input`
into one per keystroke:
- a plain word like "Ada" would record "A", "Ad", then "Ada";
- Shift for a capital, or Backspace, would split it too.

Mutation 5 below shows that split. The exception list keeps "no other ordering
changes" true for ordinary typing.

**Accepted side effect.** An acting key pressed mid-word inside a text field
records the text typed so far before that key. ArrowLeft to move the cursor is
one example. Replaying that sequence still leaves the right final value.

### P2 — a succeeded check is confirmed

**`apps/extension/src/background/connection/runtime-status.ts`**
- **New branch.** `web.dom.check` now returns
  `{ kind: "dom.change", inputId: "web.user.checkbox_toggled" }`. That is the
  input a recorded checkbox or radio `change` maps to (`input-model.ts:96`,
  `:123-129`), and `dom.change` is the kind the recorder emits for one
  (`element-traits.ts:94-99`, `dom-events.ts:93-107`).
- **No value member, for any control.** The recorded value of a checkbox is its
  `value` attribute ("on"), which the domain ignores for a check (`payloads.ts:54-56`).
  The state that matters is the descriptor's `checked`. The content script
  withholds `checked` for a sensitive control (`describe-element.ts:170-175`), and
  `value` as well (`:153-155`).
- **New first line:** `if (result.status !== "succeeded") return undefined;`.
  - The function never looked at `status` before. The only "failed confirms
    nothing" check was in the caller (`server-command-channel.ts:212`), which I do
    not own and which has no test.
  - The guard makes the function answer the brief's "a failed one yields none"
    itself, where a test in a file I own can prove it.
  - The caller's check is now redundant but harmless.
- **A check whose post-condition failed is covered too.** `check.ts:35-38`
  reports it through `success()`, and `statusForValidation` turns a failed
  validation into `status: "failed"` (`validation-outcome.ts:88-90`).
- **Core will hear it.** The domain matches a confirmation only by
  `metadata.inputId` (`gateway-input-hub.ts:36-50`), and the caller already sets
  that from the returned `inputId` (`server-command-channel.ts:228-232`).

**`apps/extension/src/background/connection/tests/runtime-status.test.ts`**
- The confirmation table's `web.dom.check` row now expects the confirmation. The
  stale comment ("becomes a confirmation then") is replaced.
- New test: **"an action that did not succeed confirms nothing, a check
  included"**. It covers every action type as `failed` and `timed_out`, plus a
  check whose control did not keep its state.
- New test: **"a check confirmation carries nothing from the control it set, a
  sensitive one included"**. It covers a checkbox, a radio, and all ten
  sensitive-field rows as checkables, each carrying `value: "hunter2-secret"`.
  Strict deep equality proves there is no `inputValue` member.

### P1's tests (content harness)

**`apps/extension/e2e/content/tests/recorder-trust.spec.ts`** is the content
harness's recorder spec. I treated it as P1's tests under "and their tests".
- **"W02 and W03: text typed just before an acting key is recorded before that
  key".** On `keyboard-forms`, with real Playwright keys, it types "Ada" then
  Enter, and "Ne" then ArrowDown twice. It asserts the exact order:
  - `A, d, a, input:Ada, Enter`
  - `N, e, input:Ne, ArrowDown, ArrowDown`
- **"Shift and Backspace are part of typing, so the text stays one debounced
  dom.input".** It types `Ad`, Shift+X, Backspace, `a`, and asserts six keydowns
  then a single `input:Ada`.

## Commands run and observed results

All from `apps/extension` with `EXTENSION_TEST_BUILD_LABEL=frko` unless noted. Exit
statuses were captured by redirecting to a file and echoing `$?`.

**Gates on the finished code:**

| Gate | Result |
| --- | --- |
| `pnpm check` | exit 0 |
| `pnpm test` | exit 0; `Extension smoke test passed.`; `# tests 413`, `# pass 413`, `# fail 0` |
| `node scripts/structure-audit.mjs` (repo root) | exit 0; `structure-audit: passed (39 warning(s), 17 baselined).`; 0 lines name any of my four files |
| Content harness: `recorder-trust`, `keyboard`, `identity-signals`, `redaction`, `selection-redaction`, `actions` | exit 0; `56 passed (12.0s)` |
| Content harness: `recorder-trust` and `keyboard`, earlier | exit 0; `19 passed (4.8s)` |

Harness command:
`pnpm exec playwright test -c e2e/playwright.content.config.ts --workers=2 <specs>`.

**First unit run, before the mutations.** It printed `# pass 407`, `# fail 6`.
- All six failures were in `tests/pointer-click-filter.test.ts` and
  `tests/recorded-event-intake.test.ts`, which belong to the P3 worker.
- Git showed both files and their sources modified.
- The next run failed a different set of six in the same two files, and every
  later run had no failures outside mine.
- I read this as P3's edits in progress, not the faulty RAM: the failures were
  partial, had real assertion diffs, and changed between runs.

**Mutation proofs.** Each was restored by Edit and then hashed.

| # | Mutation | Observed failure | Restore hash |
| --- | --- | --- | --- |
| 1 | Delete the `web.dom.check` branch | `not ok 132 - a succeeded action confirms the recording event and input its type maps to`; error `web.dom.check`, `+ undefined`, `- { inputId: 'web.user.checkbox_toggled', kind: 'dom.change' }` at `runtime-status.test.ts:84`; also `not ok 134`. `# fail 8` (6 were P3's) | `5ca50e19…` = pre-mutation |
| 2 | Delete the `status !== "succeeded"` guard | Only `not ok 133 - an action that did not succeed confirms nothing, a check included`; error `web.browser.navigate, failed`, `+ { inputId: 'web.user.navigation_requested', kind: 'browser.navigation' }`, `- undefined` at `:91`. `# pass 412`, `# fail 1` | `5ca50e19…` = pre-mutation |
| 3 | Check carries `inputValue: result.element?.value` | `not ok 132`, `134` and `135`; 134's first failing row `a checkbox`, `+ inputValue: 'hunter2-secret'` | covered by 3b's restore |
| 3b | Check leaks the value only for a sensitive control | Only `not ok 134`, first failing row `a password input`, `+ inputValue: 'hunter2-secret'`; the plain checkbox and radio rows passed. `# pass 412`, `# fail 1` | `5ca50e19…` = pre-mutation |
| 4 | Delete the keydown flush | Only the W02/W03 harness test failed: `"key:Enter"` arrived before `"input:Ada"`, and both `"key:ArrowDown"` before `"input:Ne"` (the exact bench shapes). `1 failed`, `5 passed` | `c95eebaa…` = pre-mutation |
| 5 | Drop `TYPING_KEYS` from `continuesTyping` | Only the Shift/Backspace test failed, receiving `+ "input:Ad"` before `dom.keydown:Shift` and `+ "input:AdX"` before `dom.keydown:Backspace`. `1 failed`, `5 passed` | `c95eebaa…` = pre-mutation |

For mutation 3, I replaced its edit directly with 3b to prove the sensitive rows
are reached. One final restore and hash cover both.

**Housekeeping:**
- `git check-ignore -v` showed both `e2e/test-results/` (`.gitignore:18`) and
  `.test-build-scratch/` (`.gitignore:26`) are ignored.
- `rm -rf .test-build-scratch/frko` ran, and a listing then counted 0 `frko`
  entries.
- `git diff --stat` on my four files: 105 insertions, 7 deletions.

## Task 3 — verbs whose recorded node expects a confirmation but gets none

**None, after P2.** How that was established, from domain and extension code:

- **Where recorded nodes come from.** Only the eight action inputs produce them
  (`input-model.ts:90-99`): navigate, click, type, clear, select, check, keypress
  and scroll. Each candidate always waits on its own source input
  (`web-panel-host.ts:159-161`, `expectedConfirmation: { inputId: sourceInputId,
  timeoutMs: 5_000 }`).
- **Before P2, `web.dom.check` was the only one of the eight with no
  confirmation.** It now has one. The other seven send exactly their source
  input (`runtime-status.ts`).
- **The linked click.** Its `action` entry (`web-panel-host.ts:174-193`) waits on
  the click input, which is confirmed.
- **The late-target wait.** It carries no `expectedConfirmation`, by design
  (`late-target-wait.ts:15-17`).
- **Verbs with no confirmation.** `wait_for_selector`, `wait_for_text`,
  `extract`, `capture_snapshot`, `assert`, `extract_list`, `upload`, `dialog`,
  `web.browser.tab` and `web.browser.download`. No recorded node maps to any of
  them, so none waits for one.

**Adjacent gaps, not confirmation gaps (not fixed):**
- **A key press's confirmation proves only that the key was pressed**
  (`runtime-status.ts`, keypress branch). A wrong choice made by keyboard, like
  W03's, is still visible only to the runner's final-state check. This is
  i-bench-triage's open question 5.
- **P5 (a file input mapped to `web.dom.type`)** would still be confirmed as text
  entry whenever the type succeeds. What is wrong there is the node, not its
  confirmation.

## Not verified

- **Core's own fallback for `action` entries** (`recordingActionEntryCandidate`).
  I did not read Core. Task 3 assumes its `confirmationInputId` is the entry's
  action input, which is one of the eight.
- **Composing and dead keys.** `event.isComposing`, `Process`, `Dead` and
  `Unidentified` are handled only by reading the code. The harness exercised
  Shift and Backspace, not an input method or a dead key.
- **The live extension.** No live browser, no Lab run, and no `pnpm build`, as
  the brief requires. The tracked `apps/extension/build/` is not regenerated.
- **Only these root gates ran:** the structure audit, plus the extension's own
  `check` and `test`. The full content-harness suite did not run, only the six
  specs that exercise keys.
- **Every result is a single observation** on this machine, except where a
  mutation run repeated a baseline.
- **What a Lab run must show:**
  - **P1:** W03 `combobox` Flow runs its actions in script order (type, then
    ArrowDown, ArrowDown, Enter) and its final state holds ("Country:
    Netherlands"). W02's key press follows its type, and its recording lists
    `web.element.input_changed` before `web.keyboard.pressed`.
  - **P2:** W02's Flow `web.dom.check` actions succeed. No
    `output_confirmation.not_received` appears at stage `confirmation`, and W02
    passes.

## Open questions or contradictions found

1. **The brief's "before any `dom.keydown`" cannot hold while typing stays
   debounced.** I carved out keys that are part of typing, as described above.
   If the supervisor wants a narrower set (only Enter, Tab, Escape and the
   arrows), that is a one-line change to `continuesTyping`.
2. **The failed-status check is now in two places:** `runtime-status.ts` and
   `server-command-channel.ts:212`. The caller's owner could drop its copy. I did
   not touch it.
3. **A runtime confirmation's element is sent unprojected.**
   `server-command-channel.ts:221` passes `result.element` as is, so
   `gateway-payloads.ts:136`'s second withholding of `checked` does not apply to
   confirmations. For a check, a sensitive control's `checked` and `value` are
   withheld only at the source (`describe-element.ts:60-61`, `:170-175`). Type and
   select confirmations already travel this way; P2 adds no new path.
4. **Structure baseline:** no entry needs to change.
5. **An unrelated worker's file in the tree.** Git also shows
   `apps/extension/src/background/connection/recording-start/tests/handshake.test.ts`
   modified. It is not mine and not P3's listed files.
