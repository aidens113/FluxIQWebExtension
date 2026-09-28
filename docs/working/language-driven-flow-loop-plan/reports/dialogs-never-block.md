# A dialog in the way is cleared, not recorded

## Outcome

Done, in this repository only. A refusal caused by something standing over the
target is now absorbed by the runtime: the layer's own way out is pressed, the
verb is run again, and what happened is recorded on the result. Proved against
live fixture pages by ten new rows in the content harness, all passing, plus 848
extension unit tests passing and the extension's `pnpm check` and `pnpm build`
clean. No FluxIQ Core change was needed and none was made; section 6 says why.

## 1. Where the code was produced, and what happened after it

### Produced in one place

`apps/extension/src/content/action-runtime/results.ts:211`, inside
`actionRejected` — the only producer of `web.action.blocked_by_dialog` anywhere:

```ts
const dialog = blockingDialog(reason, evidence.blockedAt);
if (dialog) {
  const code = dialog.kind === "person"
    ? WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED
    : WEB_AUTOMATION_FAILURE_CODES.BLOCKED_BY_DIALOG;
```

`actionRejected` is documented as *"An action refused before it ran"*, and that
is exactly true for the two reason words that can reach `blockingDialog`
(`covered`, `hidden`): both come from `checkActionability`, which runs before any
verb touches the page. That fact is what makes the fix safe for mutating verbs,
and it is asserted rather than assumed (section 3).

The code's row in the closed set,
`domain/src/runtime/failure/codes.ts:182`:

```ts
"web.action.blocked_by_dialog": { category: "unexpected_state", retryable: false, stage: "execution" },
```

### What happened after one was produced, before this change

**Nothing cleared it.** Three consumers existed and not one of them pressed
anything on the page.

1. **The page-side defence skipped it.** `recovery/fault.ts` gated every fault on
   the code's `retryable` flag, which for this code is `false`, so
   `recoverableFault` returned `undefined` and the loop handed the refusal
   straight back. That was right as far as it went — retrying the *same* action
   unchanged with the dialog still up answers the same way — but the loop had no
   other move.
2. **Core's ladder had a rung for it that could not fire.** `clear_interference`
   in `packages/fluxiq/.../runtime/executor/recovery-ladder.ts` is gated on
   `ladder.interferenceNodeId`, and `ladder-run.ts:110` sets that from
   `interferenceNode(input.flow, input.node)` — *a node the Flow already
   contains*. An instruction-built Flow meeting a popup it has never seen has no
   such node, so the rung is simply absent from the candidate list and the ladder
   falls through to `llm_diagnosis` or stops.
3. **The model was told about it.** `domain/.../llm-evidence/action-failure.ts`
   maps the code to the tool rejection `blocked_by_dialog`, and
   `front-layer.ts` reorders the evidence packet so the dialog's own controls are
   visible. So getting past a cookie banner cost a paid provider round trip and
   happened only if the model remembered — which is the shape the product rule
   forbids: *the runtime carries this, not the model.*

The live symptom in the brief — the effect never applied and the run carrying on
— is consequence 1 and 3 together.

## 2. What was implemented

A new directory, `apps/extension/src/content/action-runtime/interference/`:

| File | What it owns |
| --- | --- |
| `vocabulary.ts` | Which labels mean "close this", and which may never be pressed. |
| `way-out.ts` | The control inside an overlay that closes it: one scan, two answers. |
| `overlays.ts` | What is standing over the page, with and without a blocked point. |
| `clear.ts` | Presses the ways out and answers how many layers it cleared. |

`blocking-dialog.ts` now reads `overlays.ts` and `way-out.ts` instead of holding
its own copies, so the defence and the classification cannot drift: a layer the
classifier calls a dialog is exactly a layer the defence can act on. Its
behaviour is unchanged.

`dispatchClickGesture` moved out of `actions/click.ts` into
`action-runtime/click-gesture.ts`, because the dismissal needs the same
pointer-and-mouse sequence and `actions/` depends on `action-runtime/`, not the
reverse. A promotion whose close is wired to `pointerdown` would not see a bare
`click`.

The loop (`recovery/attempt.ts`) gained an injected `intervene`, defaulted to
`clearInterference`, called **before** the pause:

```ts
absorbed.push(fault);
if (faultNeedsInterference(fault)) dismissed += intervene(fault);
waitedMs += backoffMs;
await pause(backoffMs);
```

Clear, then wait, then run the verb again. The pause is what lets the layer
finish leaving before the target is hit-tested afresh; because a retry re-enters
the verb, the target is re-resolved and no element reference survives.

Its ladder is `RECOVERY_INTERFERENCE_BACKOFF_MS = [150, 400, 800]` — three rungs
rather than two, because a page that opens a consent sheet also opens a
newsletter modal, and clearing one only to be stopped by the next is not clearing
anything. Worst case 1.35 s of added waiting, still inside `RECOVERY_BUDGET_MS`
and still never past the command's own `timeoutMs`.

### Recorded so a debug can see it

`RecoveryAccount` gained `dismissed: number`, and the sentence that already
travels on both texts now reads, for example:

> the execution recovered on attempt 2 after absorbing blocking_dialog, closing 1
> dialog the page had put in the way, waiting 150 ms

A count and closed words only — no page text, so it needs no redaction and can
ride on any result. It is a separate field from `absorbed` on purpose: the fault
word says *the page put a dialog in the way*, and `dismissed` says *the runtime
pressed a control no Flow authored*. The second is the one act the runtime takes
uninstructed and it must be visible on its own.

## 3. The sibling codes, judged

The model-facing `web.action.rejected.*` set comes from
`domain/.../llm-evidence/action-failure.ts`. Judged one by one:

**Absorbed now.**

- `blocked_by_dialog` ← `BLOCKED_BY_DIALOG` → fault `blocking_dialog`. The task.
- `target_covered` and the overlay half of `target_not_actionable` ←
  `ACTION_REJECTED` whose reason word is `covered` or `hidden` → fault
  `obstructed_target`. Same treatment: clear whatever is over the page and try
  again. A banner with no way out is not pressed, but it is waited out and
  retried, which catches a toast or a loading veil that leaves by itself.

Both are absorbed by **every** verb, mutating or not — the exception to the
mutation rule, and it is earned: both reason words are produced only by the
actionability gate, before the verb dispatched a gesture, a value, a key or a
file. `tests/fault.test.ts` asserts this for `web.dom.click`, `type`, `upload`
and `check`.

**Judged not recoverable, and why.**

| Code | Why not |
| --- | --- |
| `needs_person` (`USER_INTERVENTION_REQUIRED`, `AUTH_REQUIRED`) | A robot check, a credential or code prompt, a payment confirmation, a sign-in wall. Only a person can answer it, and a runtime that retried past one would be answering it. Explicitly asserted for every action type. |
| `ACTION_REJECTED` with reason `disabled` | The gate produces it before dispatch, but so do `actions/check.ts` after `setCheckedState` failed and `actions/upload.ts` after `setInputFiles` failed — **after** the verb acted. Absorbing the word would retry a dispatched verb. This is the single row that made the classifier read the reason token rather than the code alone. |
| `ACTION_REJECTED` with reason `not_checkable`, `unsupported_key`, `upload_rejected` | Decided after the verb acted, and deterministic besides. |
| `ACTION_REJECTED` with reason `sensitive_value` | A list read that resolved a field to a sensitive control. A rule about what may be read, not a layer over the page; retrying would be retrying towards a value the product is forbidden to take. |
| `TARGET_AMBIGUOUS` | Stays ambiguous until the Flow says which element it meant. |
| `BROWSER_PERMISSION_DENIED`, `UNSUPPORTED_TYPE`, `NOT_IMPLEMENTED`, `INVALID_PARAMETER` | A manifest edit, a build, or a Flow edit. t163 measured the cost of retrying the first of these three times. |
| `STATE_MISMATCH`, `NAVIGATION_UNEXPECTED`, `UNKNOWN` | A claim that did not hold, a landing somewhere else, and an unnamed cause. None is an obstacle to clear. |
| `no_progress`, `out_of_scope`, `cross_origin`, `permission_required`, `not_at_start_location`, `no_repeating_structure`, `evidence_budget_exhausted` | Exploration-loop refusals, produced in the domain rather than by a page action. They never reach this loop and none names something over the page. |

`target_absent`, `output_not_observed`, `page_changed`, `timeout`,
`action_failed` and `transport` keep the treatment t165 gave them: waited out, no
press, because pressing cannot help a target that has not been drawn.

## 4. How a dismissal is kept from becoming destructive

Five independent guards. Any one of them alone stops the obvious failure.

1. **The allow-list is closed and anchored.** A label qualifies only if it
   *begins with* one of: close, dismiss, hide, not now, no thanks, no thank you,
   maybe later, remind me later, later, skip, not interested, continue without —
   or is exactly a close glyph (`× ✕ ✖ ╳ x X`). "Delete", "Buy now", "Place your
   order", "Pay now" and "Confirm purchase" do not begin with any of them and are
   refused before anything else is asked.
2. **The tail is read for a consequential word.** "Close account", "Skip and
   delete my drafts", "Not now, cancel my subscription", "Later, remove my card"
   all begin with a dismissal and are refused on `account`, `delete`, `cancel`,
   `remove`. Matched on word boundaries, never as substrings — the everything-store
   deal wheel declines with *"No thanks, I would rather pay full price"*, and a
   substring scan would have refused the one control on that dialog that closes
   it. `pay` is therefore deliberately not a denied word; `payment`, `purchase`,
   `buy` and `checkout` are.
3. **A challenge is never touched at all.** Every candidate overlay is read by
   `challengeIn` first, and one holding a robot check, a credential or code
   prompt, or a payment confirmation is left exactly as the page left it —
   including its own "Cancel" and "Close".
4. **The press is confined to the overlay's own subtree,** and the overlay is a
   layer the page is painting over itself. A mis-press lands inside a promotion,
   never on the page's own Delete.
5. **A "Not now" that is a link away from here is not pressed** (`way-out.ts`),
   because leaving the page is a worse outcome than the dialog. Fragments and
   `javascript:` hrefs stay in place. A disabled control is skipped too.

Cookie consent is deliberately **not** dismissed: accepting or rejecting is a
choice about the person's data and the product does not make it for them. A
banner that also carries a close glyph is closed by that glyph, because closing
is not answering.

Two things this leaves on the table, honestly:

- **"Cancel" is not a dismissal.** It is the one word that means both "close
  this" and "carry out the cancellation", so it is out. The modal-flows invite
  dialog offers only "Cancel" and "Confirm", so it is *not* cleared and the step
  still stops — a row in the new spec asserts exactly that, with the record
  showing the defence was reached and found nothing it could press.
- **"Continue without an account"** is refused by guard 2, which is a false
  negative. Refusing is the safe direction.

## 5. Tests that fail the build if the defence is removed

**Node (`pnpm --filter @fluxiq-web-extension/extension test`), 848 pass, 0 fail.**

- `interference/tests/vocabulary.test.ts` — 19 dismissals that must be pressed
  (including the deal wheel's own decline) and 27 labels that must never be,
  covering delete, buy, order, checkout, pay, publish, unsubscribe, every cookie
  answer, and the six dismissal-phrase-plus-destructive-tail overlaps.
- `recovery/tests/fault.test.ts` — a dialog is a fault for *every* action type
  although its code is not retryable; the mutating verbs absorb it and
  `obstructed_target`; a refusal the target made on its own account is not an
  obstruction; a person's challenge is never absorbed on any verb.
- `recovery/tests/attempt.test.ts` — **a dialog appearing before a click does not
  fail the click**: it is closed and the click lands; the order is asserted as
  `["attempt", "clear", "pause 150", "attempt"]`; two stacked dialogs are cleared
  layer by layer; a dialog that will not close reports the page's own refusal with
  `dismissed: 0`; and nothing is pressed for a fault pressing cannot help.

**Playwright content harness (`pnpm --filter @fluxiq-web-extension/extension test:content`).**
New `e2e/content/tests/dialog-dismissal.spec.ts`, 10 rows, all passing against
live fixture pages, stable over three consecutive runs:

| Fixture | Obstacle | Result |
| --- | --- | --- |
| auction-marketplace | timed app promotion (aria-modal, "Not now") | closed; the typing lands |
| everything-store | notifications prompt | closed; the search field filled |
| everything-store `deal-wheel` | spin-to-win wheel, way out is a `<p>` not a button | closed |
| crossborder-marketplace | welcome popup declaring no role at all | closed; the typing lands |
| modal-flows | invite dialog, inert shape, only "Cancel" | **not** closed; step still stops |
| modal-flows | W14 interstitial between two clicks | closed; both sections added |
| modal-flows | injected promotion with "Not now" | closed; the click lands |
| modal-flows | overlay of "Close account" / "Skip and delete my drafts" | nothing pressed; still refused |
| modal-flows | robot check offering "Not now" and "Close" | nothing pressed; `web.intervention.required` |
| modal-flows | consent banner with only Accept and Reject | nothing pressed; `web.action.rejected` |

The injected dialogs are wired so every button removes them. Without that a press
that should not happen is indistinguishable from a press that happened and had no
effect, and the "nothing was pressed" rows would prove nothing.

`dialog-refusal.spec.ts` was trimmed to what must still be refused — the
challenges, the page that is itself a robot check, the consent banner. Its header
says why, and points at the new spec for the rest.

## 6. Repository boundary

**Everything went downstream; FluxIQ Core was not touched.** Detecting a layer
over a target, finding the control inside it that closes it, and dispatching a
pointer gesture at it are browser, DOM and selector concerns, which
`AGENTS.md` places here.

The generic half already exists in Core and is already correct: the
`clear_interference` rung was ungated from `retryable` earlier, with a comment
that states the general principle this work applies one layer down — *rungs that
"wait for a state or clear an obstruction and then attempt" offer something that
is not the failed action repeated unchanged*. What Core cannot supply is a way
out it has never been given: its rung runs a node the Flow already has. So the
missing piece was the page's own ability to clear a layer it can see, and that
had nowhere else to live. `recovery/fault.ts` quotes Core's comment at the point
it makes the same argument, so the two stay legible together.

## Commands run and observed results

| Command | Observed |
| --- | --- |
| `npx tsc -p tsconfig.json --noEmit` (extension) | no output |
| `node scripts/test-extension.mjs` (extension unit) | `# tests 848 / # pass 848 / # fail 0` |
| `pnpm test:content -- dialog-dismissal.spec.ts` ×3 | `10 passed (15.5s)`, `10 passed (15.2s)`, `10 passed (15.1s)` |
| `pnpm test:content -- dialog-dismissal + dialog-refusal + click + failures + select` | `58 passed` (after the deal-wheel row was made deterministic) |
| `pnpm test:content` (whole harness) | `357 passed`, `12 failed` — all twelve pre-existing, section below |
| `pnpm check` (extension) | clean, no output |
| `pnpm build` (extension) | bundles written, no errors |
| `node scripts/structure-audit.mjs` (repo) | `1 violation(s)`: `[working-docs] docs/working/README.md is out of date` — pre-existing, and not mine |

### The twelve remaining content-harness failures are not mine

Four failures *were* mine and are fixed: `click.spec.ts` ×2, `failures.spec.ts`
and `select.spec.ts` asserted the exact text of a covered or hidden refusal, and
that text now carries the defence's account after it. They were changed to assert
the reason as the head of the text plus the account after it, and they pass.

The twelve that remain all show a fault word this change does not produce:

```
"actual": "the text did not appear before the timeout; the execution did not recover
           within its 1 attempts after absorbing timeout, waiting 0 ms"
"actual": "nothing matched \"[data-testid=\"never\"]\"; ... after absorbing timeout,
           timeout, timeout, waiting 750 ms"
"actual": "0 records from 1 page; ... after absorbing output_not_observed, waiting 0 ms"
```

`timeout` and `output_not_observed` are t165's fault words, written by
`recovery/record.ts`, which I did not change. Nine failures are that annotation
against specs that assert exact text. The other three
(`extract-list-sensitive.spec.ts`) report `web.validation.output_not_observed`
where the spec expects `web.action.rejected`, carry no recovery account at all —
so the loop was never entered — and touch no file in this change. The specs'
`not.toContain(secret)` assertions are downstream of the failing line and were
not reached, so this report does not claim either way whether a value leaks; it
is worth a look by whoever owns the extraction work.

I could not run a clean baseline to prove this by bisection, because the working
tree is shared: a concurrent worker has `domain/src/runtime/llm-evidence/` open
(`action-failure.ts` deleted in favour of an `action-failure/` directory, plus
edits to `capture.ts`, `tool-rejection.ts`, `tools.ts`, `node-run/`). Stashing
would have destroyed their work, so I proved the point with a test instead:
`recovery/tests/fault.test.ts` now asserts that `sensitive_value:` and
`dialog_override_missing:` rejections are never absorbed.

## Not verified

- **FluxIQ Core's test suite was not run.** Nothing in Core changed.
- **The domain package's tests were not run.** Nothing in domain changed, and a
  concurrent worker has that package mid-edit, so a run would report their state
  rather than mine.
- **No live provider run.** This is a page-side defence; the content harness
  against live fixture pages is the closest available proof and it passed. What a
  full language-driven Flow run does with a popup now is unmeasured.
- **Chrome only.** The content harness runs Chromium. Firefox's popup build was
  not exercised; nothing here uses a browser-specific API, but that is reasoning,
  not a measurement.
- **Shadow DOM.** `overlaysOverPage` uses `elementFromPoint`, which stops at a
  shadow boundary, so a dialog inside a closed shadow root is not found. No
  fixture exercises that.
- **The three `extract-list-sensitive` failures** were diagnosed far enough to
  exclude this change and no further.

## Open questions

1. **`dismissed` should be a wire field, not a sentence.** `recovery/record.ts`
   already records that the account belongs on a declared field copied at the
   domain boundary and projected by Core onto node metadata, as `listWait` and
   `itemsSeen` are. Until then "the runtime pressed a control nobody authored" is
   discoverable only by reading prose, which is the exact defect `account.ts` was
   written against. A four-line wire diff would make it countable.
2. **The nine pre-existing t165 annotation failures are a standing red suite.** A
   defence that appends to every failure's text and leaves twelve specs failing is
   a ratchet nobody set. Someone should either update those specs or reconsider
   appending to `validation.actual` at all.
3. **Should `hidden` and `covered` cost 1.35 s when they are permanent?** A
   `display:none` element in a fixture now waits the full ladder. That is the
   defensive trade and I took it deliberately, but it is a real per-node cost on
   Flows that legitimately address a hidden control.
4. **Cookie consent.** The product does not answer it, so a Flow blocked by a
   consent wall with no close glyph still stops. If that turns out to be the
   common real-site blocker, the decision to leave it to the person is worth
   putting to the product owner explicitly rather than inheriting it.
