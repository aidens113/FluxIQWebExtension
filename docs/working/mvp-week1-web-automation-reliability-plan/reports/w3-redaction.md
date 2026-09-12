# Report: w3-redaction

Worker: `w3-redaction`. Wave 3, Phase 1.4 step 1 — a sensitive control must
never yield a value on any path. Written proof first, then the fix.

No captured or fixture value appears anywhere in this report. Values are named
by their field, never quoted.

## Outcome

**Done**, with three leaks found outside the brief's Owns that I did not fix and
that are listed under [Open questions](#open-questions-or-contradictions-found).
The three files the brief names are fixed, the proof spec is green, and the full
content harness, the extension type check and the extension unit tests all pass.
One spec row is deliberately `fixme` because the leak it names lives in a file I
do not own.

## What changed and why

### The proof, written first

`apps/extension/e2e/content/tests/redaction.spec.ts` — new, seven rows on the
`sensitive-input` fixture. Written and **run before any fix**: five of the six
live rows failed, which is the record that the leak was real rather than
hypothetical (observed output below). Every row searches the whole wire form of
what the content script sent — `JSON.stringify` of the message log, the
snapshot, or the action result — rather than one named field, so a value that
resurfaces in an attribute, a nested snapshot or a validation string still fails
the row. Each row also carries a control assertion on the fixture's ordinary
email field, so a fix that redacted everything would fail just as loudly as one
that redacted nothing.

The rows: no password value in any recorded message (typed or pre-filled); a key
press in a sensitive field recorded as a press and not as the character; the
recorded `dom.input` reporting the change without the value; a snapshot
reporting presence and never the value; an action result's evidence carrying the
descriptor without the value; and `captureInputValues: false` withholding every
value, sensitive or not. The seventh is the `fixme` described below.

### `content/describe-element.ts`

- **`readElementValue` returns `undefined` for a sensitive control.** This is the
  whole fix for four paths at once, and it is why the change is three lines
  rather than a redaction call at every emission point. Every capture path in
  the content script reads values through this one function: the element
  descriptor, `dom-snapshot.ts`'s ranking, the `dom.change` listener, and — this
  is the load-bearing part — `recorder.ts`'s `scheduleInputEvent` and
  `emitInputEvent`, which emit `inputValue` on `dom.input` and which the brief
  does **not** give me. Redacting at the reader closes `recorder.ts` without
  editing it, and makes a future caller safe by default instead of safe by
  remembering. The sensitivity test is `isSensitiveFormControl` from
  `element-traits.ts`, which is the single shared `isSensitiveFieldSignature`;
  no second rule was written.
- **A sensitive `<select>` now yields neither `selectedValue` nor `options`.**
  `selectedValue` was already guarded; the option list was not, and a select's
  options are its value space, so publishing them narrows the secret to a
  twenty-item list. The guard moved up to the whole block.
- **The file header is now true.** It previously said sensitivity was "only
  partly handled here" and that Phase 1.4 would finish it. It now states the
  invariant, names the one shared rule, and — deliberately — names the path it
  does **not** cover, the action verbs that read `element.value` directly for
  their post-conditions. A header that claimed total coverage would be the same
  defect in the other direction.

### `content/dom-events.ts`

- **`recordableKey` withholds a printable key pressed in a sensitive control.**
  This is the leak the value reader could not close: `dom.keydown` carried
  `event.key` for every key press, so typing a password recorded it one
  character per message. No individual message held the secret, which is exactly
  why a substring search for it would have passed while the recording still
  reconstructed it in order. A key whose name is longer than one code point
  (`Tab`, `Enter`, `Escape`, an arrow, a modifier) carries no content and still
  travels, so the navigation and submission that make keydown worth recording
  are unaffected; the press itself is still recorded for a sensitive field, only
  without the character.
- The `change` listener needed no change: its `inputValue` comes from
  `readElementValue`. The header now says so, so the next reader does not add a
  second guard there and start a second rule.

### `content/capture-settings.ts`

Documented, as the brief asks, and the documentation makes one distinction the
old comment did not: these are the user's capture preferences, **not** a
security boundary. `inputValues` defaults to **on**, and the reason is now
written down — with it off, a recorded `web.dom.type` step replays as an empty
string, because `domain/src/output-nodes/payloads.ts` builds its `text` from
`payload.inputValue ?? ""`. A sensitive value is withheld unconditionally
whatever the setting says: turning `inputValues` on cannot re-enable it, and
turning it off is not what protects it. Each of the three settings now has its
default and its meaning stated.

`apps/extension/src/content/tests/capture-settings.test.ts` — new, two T1 rows
pinning those defaults, so the documented default and the shipped default cannot
drift. It is the only part of this brief testable without a DOM; everything else
is proven against a live page by the spec.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=w3-redaction` was set on every package command. Exit
status was captured by redirecting to a file and echoing `$?`, never through a
pipe. No `pnpm build`, no `pnpm lab`, no `pnpm structure:baseline`.

- **The failing proof, before the fix** — `pnpm --filter
  @fluxiq-web-extension/extension test:content redaction` → **exit 1**.
  `5 failed, 1 skipped, 1 passed`. The five failures were the five paths, each
  showing the fixture's password in the received value: the recorded message log,
  the keydown character sequence, the recorded `dom.input`, the snapshot
  descriptor, and the action result's `element.value` and nested snapshot. The
  one row that already passed was `captureInputValues off`, which was correct
  before the fix and had to stay correct after it.
- **The same command after the fix** → **exit 0**. `6 passed, 1 skipped`; the
  skip is the `fixme` row.
- `pnpm --filter @fluxiq-web-extension/extension test:content` (full harness) →
  **exit 0**, `129 passed, 1 skipped` out of 130. Re-run at the end after the
  header edits: **exit 0**, same result. This is the regression check that
  matters most, because `recorder-trust.spec.ts` asserts the exact per-character
  `key` sequence on a non-sensitive field and `select.spec.ts` asserts option
  lists — both still pass, so the redaction is targeted, not blanket.
- `pnpm --filter @fluxiq-web-extension/extension check` → **exit 0**, no
  diagnostics. Re-run after the header edits: **exit 0**.
- `pnpm --filter @fluxiq-web-extension/extension test` → **exit 0**,
  `# tests 130 / # pass 130 / # fail 0`. The two new rows ran (`ok 71`, `ok 72`
  in that run). The count rose from 124 to 130 between my two runs because other
  workers added tests concurrently; both runs were green.
- `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (a copy of
  `.git/index` with the two new files added; the real index was never written) →
  **exit 1**, one violation: `docs/working/README.md is out of date with the
  documents' header blocks`. **Not mine.** I confirmed it by running the audit
  against the pristine index with none of my files staged: **exit 1**, the same
  single violation. Re-run once, as the wave's binding rules require, with the
  same result. Diffing the warning sets of the two runs: `31 warnings` in both,
  **identical line for line**, and no finding names any file I touched. My change
  adds no structure finding; the working-doc index is a shared file another agent
  owns.

## Not verified

- **No live browser validation in a loaded extension.** Everything here is the
  real content-script bundle in real Chromium on the real fixture, through the
  T2 harness, which is one world with no background worker and no frame routing.
  Redaction is decided entirely inside the content script, so the harness
  exercises the whole decision — but the wire hop to the background worker and
  the gateway was not exercised.
- **Child frames were not exercised.** The harness talks to the top frame only.
  `readElementValue` is per-element and frame-agnostic, so there is no reason to
  expect a difference, but it is reasoned, not measured.
- **Only the fixture's password field proves the sensitive case.** The other two
  signals in the shared rule — an `autocomplete` card or one-time-code token, and
  `data-sensitive="true"` — are covered by the shared rule's own unit tests, not
  by a live page here, because no registered fixture carries a control with
  either. See the first open question.
- **The sensitive-`<select>` change has no live row.** No fixture has a select
  marked sensitive, so the `options`/`selectedValue` guard is proven only by the
  type checker and by the fifteen existing `select.spec.ts` rows continuing to
  pass on non-sensitive selects.
- **The snapshot ranking consequence was not measured.** `dom-snapshot.ts` scores
  an element partly on `meaningfulText(readElementValue(element))`, so a sensitive
  field now loses that one signal (35 points, and one of nine identity
  fallbacks). The password field still appears in the snapshot in every row
  above, because it has a label, an accessible name and a test id. A sensitive
  control with **no** other identity at all could now fall below the inclusion
  bar. `dom-snapshot.ts` is w3-evidence's file, so I could not adjust it to read
  presence via `hasEnteredValue` instead; I judged the security invariant to
  outrank the ranking signal, and the alternative — leaving the reader honest and
  redacting at each emission point — cannot close `recorder.ts`, which I do not
  own.
- **`pnpm build`, `pnpm check` and `pnpm test` at the repository root** were not
  run: the wave forbids the first and the other two are the supervisor's at
  integration.

## Open questions or contradictions found

Three leaks, all outside this brief's Owns, all still open. The first two are
live defects; the third is a fixture gap that makes the first invisible to the
suite.

1. **`web.dom.type` puts the text it typed into the result.**
   `apps/extension/src/content/actions/type.ts` builds both validation strings
   from the text — `expected` from the requested text and `actual` from a
   read-back of `element.value` — so typing into a password field returns the
   secret to the gateway twice in one result. `clear.ts` does the same in its
   failure branch, and `select.ts` echoes option values. These read
   `element.value` directly and never touch `readElementValue`, so my fix does
   not reach them. **The last row of `redaction.spec.ts` is a `test.fixme`
   asserting exactly this**, titled with the file and pointing at this report, so
   it turns green the moment somebody fixes it. No Wave 3 brief owns
   `content/actions/`; `w3-failure-producers` owns `results.ts`, which assembles
   the result but does not compose these strings. This is the wave's named
   defect shape — ownership drawn around a file rather than around the change —
   and the brief should have included `content/actions/{type,clear,select}.ts`,
   or a follow-up brief should.
2. **The `sensitive-input` fixture's card field is not sensitive by the shared
   rule, and its value is captured today.**
   `apps/scenario-lab/src/scenarios/sensitive-input/scenario.ts` renders the card
   input with `inputmode="numeric"` and a test id, but **no** `autocomplete` and
   **no** `data-sensitive`. `isSensitiveFieldSignature` reads exactly three
   signals — input type, `autocomplete` tokens, `data-sensitive` — so it cannot
   see this field, and its value travels in every snapshot; I observed it in the
   pre-fix failure output. Widening the rule would be wrong: `inputmode="numeric"`
   is what a quantity field carries too. The fixture is what is wrong — a real
   card field carries `autocomplete="cc-number"`, which the shared rule already
   handles, so the fix is one attribute in the fixture. It matters beyond tidiness
   because this scenario is tagged `redaction` and `security` and its manifest
   expects "secrets discarded": it is the repository's designated proof that card
   data is redacted, and it currently proves the opposite. I own neither the
   fixture nor `shared/sensitive-field.ts`, so I changed neither.
3. **`domain/src/recording/reducers.ts` writes recorded input values into web
   state.** Line 18 puts `payload.inputValue` into `forms.<selector>` whenever it
   is a string. With this fix a sensitive field's `inputValue` is `undefined`, so
   nothing sensitive is written today — but the guard is the producer's, not the
   reducer's, and there is no test on the domain side pinning that. Worth a
   defensive row wherever `w3-state-identity` or `w3-domain-contracts` lands.

One thing that is **not** a contradiction, recorded so nobody re-litigates it:
`apps/extension/src/background/connection/runtime-status.ts` already tests the
wire descriptor with the shared rule before promoting `element.value` to a
confirmed input value. That guard is now redundant, since `element.value` is
never set for a sensitive control, but it is defence in depth on the far side of
the wire and I left it alone.
