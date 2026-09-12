# Report: w2-keyboard-input

Worker: `w2-keyboard-input`. Brief: `### Brief: w2-keyboard-input` in
[briefs/wave-2.md](../briefs/wave-2.md), coding against
[reports/w2-foundation.md](./w2-foundation.md).

## Outcome

**Done.** Trusted-input emulation (decision D5) replaces the keyboard stub, and
the three verbs it backs now carry real post-conditions. One declared deviation
(two rows in a spec file outside my owns list) and one compatible extension to
the Wave 2 contract, both below.

The audit row this closes: `web.dom.keypress` was classed **unreliable**
because a synthetic `KeyboardEvent` has `isTrusted: false` and therefore
triggers no default action — Enter submitted nothing, Tab moved nothing — while
the result still said `succeeded`. Enter and Tab now perform the default action
themselves, and a key whose default action cannot be emulated honestly reports
`ACTION_REJECTED` rather than a success over a page that never changed.

## What changed and why

### The keyboard capability: `content/action-runtime/keyboard.ts` → `keyboard/`

The stub was one file with five distinct responsibilities ahead of it. It is
now a directory with a barrel, one exported thing per file, per the placement
rules. `execute-action.ts` still does `import { keyboard } from "./keyboard"`
and **needed no edit** — `moduleResolution: "Bundler"` resolves the directory's
`index.ts`, exactly as `import { executeContentAction } from "../actions"`
already did.

| File | Responsibility |
| --- | --- |
| `keyboard/index.ts` | Barrel: `keyboard`, `KeyboardCapability`, `KeyPressOutcome`. |
| `keyboard/capability.ts` | The capability object the verbs receive. |
| `keyboard/press-key.ts` | One key press and the default action a trusted key would perform. |
| `keyboard/type-text.ts` | Per-character typing. |
| `keyboard/text-edits.ts` | `insertText` / `deleteAllContent`: the `beforeinput` → edit → `input` pair. |
| `keyboard/key-event.ts` | The `KeyboardEvent` itself, with `code` and legacy `keyCode`. |
| `keyboard/editable-target.ts` | `isTextField` / `isEditableHost`: where typed characters can go. |
| `keyboard/implicit-submission.ts` | Enter's form submission. |
| `keyboard/tab-order.ts` | Tab's focus move. |

This **lowered** the `action-runtime/` advisory warning from 19 files to 18, and
the new directory is well under the 15-file threshold.

### Behaviour

- **Per-character typing.** Each character is a full `keydown`, `beforeinput`,
  the edit, `input`, `keyup` sequence, then one `change` when the field commits.
  A `keydown` the page cancels suppresses its character, as in the browser.
  Writing the value in one assignment fires at most one `input`, which is why a
  combobox that filters per keystroke never ran before.
- **`contenteditable`** is edited at the caret through `InputEvent` rather than
  a value setter, and gets no trailing `change` (it has no value to commit).
- **Value read-back is the validation.** The field is asked what it holds
  afterwards. Expected/actual are the two values, so a page that rewrites the
  value in its own `input` handler reports `failed` with `output_not_observed`.
- **Enter** calls `form.requestSubmit(defaultButton)` — not `form.submit()`,
  which skips both the `submit` event and constraint validation. A real Enter
  activates the form's default button, and `requestSubmit` reports it as
  `event.submitter`, so a page that branches on the submitter sees what it would
  have seen from the keyboard. HTML's actual rule is implemented: a form with no
  submit button submits implicitly only when it has exactly one blocking field.
  Enter in a textarea or editable host inserts a line break instead.
  **The submission is observed, not assumed** — a one-shot capture listener
  records whether a `submit` event really fired, so a form whose own constraint
  validation refuses reports `failed`, not success.
- **Tab** walks the document's tab order: positive `tabindex` first ascending,
  then natural order; skipping disabled, hidden, inert and boxless elements; and
  a radio group contributes one stop (its checked radio, or its first).
- **Modifiers** reach the page on every event, and a character with Ctrl, Meta
  or Alt held is a shortcut that types nothing.
- **Unsupported rather than faked**, as the brief requires: arrow keys in a
  radio group or a `<select>`, and Space on a checkbox, radio or button, all
  need trusted input. Each is `deps.rejected(..., "unsupported_key", ...)` →
  `blocked_by_capability_or_policy`, `web.action.unsupported_key`, not
  retryable, with a detail naming the verb that does the job
  (`web.dom.check`, `web.dom.select`, `web.dom.click`).

### A fidelity fix worth naming

The native value setter writes to a **read-only or disabled field** quite
happily, which a person at a keyboard cannot. An emulation built on it would
have reported text a real user could never have entered. `text-edits.ts` refuses
the edit for those fields; the keys still arrive (as they do for a real
read-only field) and the read-back then reports `output_not_observed`. This is
proven by a spec.

### The verbs

`type.ts`, `clear.ts`, `keypress.ts` rewritten. Each reaches the keyboard only
through `deps`, touches no DOM of its own beyond the `instanceof` guard that is
its own decision, and can no longer report success without a post-condition.
`keypress` keeps resolving its target as selector-or-`activeElement`.

### Files I own but did not change

`action-runtime/set-element-value.ts` and `input-events.ts`. The first is reused
by the keyboard (it is exactly the native-setter bypass per-character typing
needs). The second is shared with `select.ts` and `clear.ts`, and its `inputType`
is fixed at `insertText`; parameterising it would mean editing
`actions/types.ts`, which is w2-foundation's. Noted under Open questions.

## Deviation from the brief

**`apps/extension/e2e/content/tests/actions.spec.ts` — two rows, not in my
owns list.** That file's own header says the rows "pin today's behaviour,
including what the action audit classes as unreliable — a dispatched key has no
default action … so the Wave 2 verb workers must change these assertions when
they change that behaviour." My change makes exactly two of them false, and the
definition of done requires `test:content` to pass:

- `type: …` — the event trace is now three `input`s and a `change`, not one
  `input` and a `change`, and the validation is `passed`, not `not-yet-validated`.
- `keypress: … so Enter does not submit` — Enter now submits; rewritten as
  "an untrusted Enter performs the default action a trusted one would". Its
  trailing "control" (a real Enter submits) is now redundant and was removed.

I edited only those two blocks, so a parallel worker editing a different block
of the same file does not conflict.

**I deliberately did not touch that file's header paragraph**, although my
change makes its "a dispatched key has no default action" clause stale. The
same sentence's other clause ("a select to a value with no option still reports
success") is `w2-select`'s to invalidate — their row already reads
"changes nothing and reports output_not_observed" — so two workers rewriting
one sentence concurrently would have collided. **One line for the supervisor to
fix at integration.**

## Extension to the Wave 2 contract

`KeyPressOutcome` gains two required fields. `dispatched`, `defaultAction` and
`detail` keep their meaning, so nothing that cites the contract breaks; no other
worker consumes this type, and `action-runtime/index.ts` re-exports it by name,
so **no file outside my owns list needed an edit**.

```ts
export type KeyPressOutcome = {
  dispatched: boolean;
  defaultAction: "none" | "submitted" | "focus-moved" | "unsupported";
  detail: string;
  expected: string;   // the post-condition the press was meant to establish
  held: boolean;      // whether `expected` was observed
};
```

Without these the verb could not tell "there was no default action to perform"
(a pass) from "the submit was attempted and the form refused" (a fail) — both
would have been `defaultAction: "none"`, and a blocked submit would have
reported success. That is the defect this brief exists to remove.

## Commands run and observed results

From `F:\!FluxIQWebExtension`, `EXTENSION_TEST_BUILD_LABEL=w2-keyboard-input`.
Every exit status captured by redirecting to a file and echoing `$?`, never
through a pipe. No `pnpm build` and no `pnpm lab` command was run.

| Command | Observed |
| --- | --- |
| `pnpm --filter …/extension check` | exit 0 |
| `pnpm --filter …/extension test` (1st) | exit 1 — `# tests 108 / # pass 107 / # fail 1` |
| `pnpm --filter …/extension test` (rerun) | **exit 0 — `# tests 120 / # pass 120 / # fail 0`** |
| `pnpm --filter …/extension test:content` (1st) | exit 1 — `115 passed`, `2 failed` |
| `pnpm --filter …/extension test:content` (rerun) | **exit 0 — `117 passed`**, 0 failed |
| `node scripts/structure-audit.mjs` (scratch index) | **exit 0 — `passed (31 warning(s), 19 baselined)`** |

**Both first-run failures were parallel edits, as the brief predicted, and both
cleared on the single rerun.** None was in a file I own and none could be
reached by my change:

- `runtime/tests/action-runner.test.ts:638` — the unsupported-page guard now
  returns a full result (`failure`, `validation`, `status`, timestamps) where
  the test still expected a bare object. That is `w2-browser-actions`' file and
  its stated task. Nothing in `content/` is imported by the background
  action-runner. The rerun shows 120 tests where the first showed 108, i.e.
  their work landed between the two runs.
- `identity.spec.ts:104` (`w2-identity-capture`) and `scroll.spec.ts:148`
  (`w2-scroll`), the latter a harness teardown timeout.

All ten of my specs passed in both runs, as did both `actions.spec.ts` rows I
changed and `recorder-trust.spec.ts`.

The audit ran with my new files and the deleted `keyboard.ts` staged into a
**scratch** index (`GIT_INDEX_FILE` pointed at a copy in my scratchpad); the
shared index was never touched, confirmed afterwards by `git status --short`
showing nothing staged. Without that the audit would have tried to read the
file I deleted. **No baseline entry was added, raised, or regenerated**, and
`pnpm structure:baseline` was not run. No finding names any file of mine; the
only lines mentioning my directories are the pre-existing `directory-files`
advisories, one of which my change lowers (`action-runtime/` 19 → 18).

### What the new spec proves — `e2e/content/tests/keyboard.spec.ts`, 10 tests

On `basic-form`: the exact per-character event trace
(`keydown`/`beforeinput`/`input`/`keyup` ×n then `change`); replacing existing
content; a read-only field reporting `output_not_observed` with no edit events
at all; a `contenteditable` host edited through `InputEvent` with no trailing
`change`; `clear` proving the field stayed empty; Tab landing on `[data-testid="plan"]`;
modifiers arriving with the right `code` and `keyCode` while Ctrl+A types nothing.

On `keyboard-forms` (the D5 fixture): **W02** — Enter submits and the fixture
records `lastSubmitter: "save-profile"`, which is the D5 evidence, since
`requestSubmit()` with no argument records `null`; **W03** — typing "Ne" opens
and filters the combobox to Nepal/Netherlands/New Zealand (so both the per-key
`keydown` and the per-key `input` must have happened), two ArrowDowns move
`aria-activedescendant` to `country-option-nl`, and Enter chooses Netherlands
while `profile-status` stays "Not saved" with `submissionCount: 0` — the
enclosing form is not submitted; and a radio arrow key rejected as unsupported
with the group's selection untouched.

## Not verified

- **No headed browser, no loaded extension.** `test:content` runs the real
  content bundle in headless Chromium against live Scenario Lab pages, which is
  where these behaviours are decidable, but nothing loaded the unpacked
  extension. Per the brief I ran no `pnpm lab` command and no `pnpm build`, so
  the keyboard path was never exercised end to end through the background
  worker, the gateway, or a Flow.
- **`pnpm check` / `pnpm test` at the repository root**, and the `domain`,
  `test-runner` and `test-contracts` suites: not run. I changed no file in them.
- **Firefox:** not run; the content config is Chromium only. The emulation uses
  no Chrome-specific API, but `requestSubmit`, `getClientRects` and
  `InputEvent` behaviour under Gecko is untested here.
- **Typing into segmented inputs** (`date`, `month`, `time`, `number`) is
  unproven and probably reports `failed` honestly rather than working: a real
  browser fills those by segment, whereas per-character insertion produces
  intermediate values the control rejects. No fixture covers it.
- **The verbs do not gate on actionability.** `deps.checkActionability` is
  `w2-click`'s and still throws, so calling it would have broken my suite. A
  disabled or covered field therefore surfaces as a failed read-back
  (`output_not_observed`) rather than `ACTION_REJECTED` with a code. Wiring that
  in is a one-line change once `w2-click` lands, and is worth doing.
- **`beforeinput` cancellation** is implemented and returns `false` up the
  chain, but no fixture cancels it, so only the read-only path exercises the
  "edit refused" branch.
- **Tab wrapping**: at the end of the document focus wraps to the first stop
  (a real Tab moves into browser chrome, which a page cannot reach). The
  detail text says so; no spec asserts the wrap.

## Open questions or contradictions found

1. **`actions.spec.ts`'s header sentence is now half-stale** and neither
   `w2-select` nor I could safely fix it alone. See Deviation. One line at
   integration.
2. **`dispatchInputEvents` always says `inputType: "insertText"`**, including
   from `clear.ts` (a deletion) and `select.ts` (not an insertion at all). A
   page that branches on `inputType` is misled. Fixing it means an optional
   parameter on the dep, whose signature lives in `actions/types.ts`
   (w2-foundation's), so I left it. Cheap to fix in a follow-up.
3. **`web.dom.keypress` can now type a character** (a printable key with no
   command modifier inserts it), which overlaps `web.dom.type`. That is faithful
   to the browser, but the domain's recorded-input mapping should keep sending
   text through `web.dom.type`; worth a look from `w2-domain-vocabulary`, whose
   brief already covers "a keydown on a `<select>` whose only effect is the value
   change … is evidence, not a key press action".
4. **A disabled field still receives key events** from `typeText`, where a real
   browser delivers none because the field cannot be focused. The edit is
   correctly refused, so the result is right; only the event trace differs.
5. **`w2-check-assert` inherits a dependency**: my unsupported-key detail tells
   the caller to use `web.dom.check` for radio and checkbox keyboard interaction.
   Until that verb works, a Flow recorded from radio-group arrow keys has no
   working replay path at all — it fails honestly instead of silently, which is
   the intended Week 1 outcome, but it is a real corpus gap for W02.
