# Report: w3-redaction-followup

Worker: `w3-redaction-followup`. Wave 3, the three leaks `w3-redaction` found and
could not fix, plus turning its `fixme` row green. A security fix, so the failing
proof was written and run first.

No captured or fixture value appears anywhere in this report. Values are named by
their field, never quoted, and no test name carries one either.

## Outcome

**Done.** All four tasks landed. `redaction.spec.ts` is ten rows, all green, no
`fixme`. One further leak was discovered while proving task 2, in a file this
brief does not own; it is described under
[Open questions](#open-questions-or-contradictions-found) and pinned by a comment
in the spec at the point where it would otherwise have been silently designed
around.

## What changed and why

### The proof, written and failed first

`apps/extension/e2e/content/tests/redaction.spec.ts` — the six existing rows kept
unchanged, the `fixme` row rewritten as a live assertion, and three rows added.
Run **before any fix**: `2 failed, 8 passed`. The two failures are the record
that both leaks were real:

- the `web.dom.type` row received a result whose `validation.expected` and
  `validation.actual` both carried the typed password verbatim — the secret
  returned to the gateway twice in one result, exactly as `w3-redaction`
  described it;
- the card row received a snapshot in which the payment field carried `value`
  and `hasValue`, on the scenario tagged `redaction` and `security`.

The ten rows now: no password value in any recorded message (typed or
pre-filled); a key press in a sensitive field recorded as a press, not as the
character; the recorded `dom.input` reporting the change without the value; a
snapshot reporting presence and never the value; an action result's evidence
carrying the descriptor without the value; `captureInputValues: false`
withholding every value; `web.dom.type` withholding the text while still
reporting the match; `web.dom.clear` withholding the value; the card field
redacted on the descriptor, the snapshot, the recorded stream and an action
result; and — the other direction — an ordinary field's validation still quoting
what was sent and what the field kept, byte for byte as before.

Every row that asserts absence searches the whole wire form (`JSON.stringify` of
the message log, the snapshot, or the result), not one named field. The card row
reads the fixture's own value off the page rather than restating it in the spec,
so the secret exists in exactly one place in the repository.

### 1. Action results no longer return the secret

`apps/extension/src/content/actions/value-redaction.ts` — **new**, one exported
function, `describeFieldValue(value, withheld)`. It is the only new decision:
how a validation string may name a value. Not withheld, it returns the value
quoted, byte-identical to what the three verbs produced before — which matters,
because `select.spec.ts`, `keyboard.spec.ts` and `actions.spec.ts` assert those
exact strings and none of them is mine. Withheld, it returns
`a withheld value of N characters`, or `an empty value` at length zero, because
an empty field is not a secret and saying so is the single most useful thing a
failed clear can report.

The sensitivity test is deliberately **not** in that module. Each verb calls
`isSensitiveFormControl` from `content/element-traits.ts` — the one shared
`isSensitiveFieldSignature` — and passes the answer in as a boolean. No second
rule was written on the extension side.

- **`type.ts`** — both halves of the validation were built from the text
  (lines 35, 36, 46, 47 as the brief cited them). They now go through
  `describeFieldValue`, and a new `heldText` helper phrases the read-back: for a
  withheld value it says whether the field kept *the text that was sent*, which
  is the entire point of the read-back, and gives the length instead of the
  content. A validation that could not distinguish a match from a mismatch would
  have been the wrong fix; this one still can.
- **`clear.ts`** — the leftover value on the failure branch is now described
  rather than quoted. The passing branch reads exactly as before, so
  `result-mapping.test.ts` and `keyboard.spec.ts` are untouched by the change.
- **`select.ts`** — the largest surface, and worse than the brief's line list
  suggested. Eight sites, not three: the request the command named
  (`describeRequest`, reached from four places, including the human-readable
  `message`), the value the select still held, the whole option list on a failed
  match, the option named in a `disabled` rejection, and both halves of the final
  validation. A sensitive select's **option list is its value space**, so
  publishing twenty options narrows the secret even where no single string held
  it; `listOptions` now reports only how many there are. An option in a
  rejection is named by index rather than by value and label. An index is a
  position rather than content, so `by: "index"` requests still read in full.

### 2. The fixture can now prove card redaction

`apps/scenario-lab/src/scenarios/sensitive-input/scenario.ts` — the card input
gains `autocomplete="cc-number"`, which is what a real card field carries and
what the shared rule already reads. The shared rule was not widened, and a
comment on `render` records why `inputmode="numeric"` is not a substitute: an
ordinary quantity field carries it, so matching on it would redact real data.

`apps/scenario-lab/dist/` is a build output and is git-ignored; it was not
hand-edited and needed no separate command. The content harness imports the
Scenario Lab from `src/` directly (`e2e/content/harness.ts` imports
`../../../scenario-lab/src/registry.js`), which is why the card row sees the new
attribute; and every `pnpm lab*` script begins with
`pnpm --filter @fluxiq-web-extension/scenario-lab build`, so a Lab run
regenerates `dist/` itself. No `pnpm lab` command was run.

### 3. The domain reducer now has a guard of its own

`domain/src/recording/reducers.ts` — the `forms.<selector>` write is now
conditional on the event's element descriptor not being sensitive.

The reducer **can** judge sensitivity: the payload carries `element`, the wire
descriptor, and `describe-element.ts`'s attribute allowlist already includes
`autocomplete` and `data-sensitive` alongside the `inputType` field. That is the
same evidence `background/connection/runtime-status.ts` uses on the other side of
the wire, so no heuristic over the selector string was invented and none was
needed. An event with no descriptor is treated as ordinary and the reason is
written down: the recorder always sends one with an input event, and refusing
every value on a missing field would empty `forms.*` on the strength of a shape
change. That decision has its own test row so the next person changing it sees it.

The rule itself had to be repeated, and that is a real cost, recorded as the
first open question below.

### Tests beside the code

- `apps/extension/src/content/actions/tests/value-redaction.test.ts` — **new**,
  five rows on the marker: an unwithheld value quoted exactly as before; a
  withheld one never containing its own content at five different shapes;
  emptiness said plainly; the singular/plural wording; and the marker's shape at
  five lengths from 1 to 4,096. The live proof cannot state the "byte-identical
  for ordinary fields" property directly, and three specs depend on it.
- `domain/src/recording/tests/reducers.test.ts` — **new**, four rows on the
  guard. Every row sends the value the producer is supposed to have withheld, so
  nothing asserted there depends on the producer behaving: nine sensitive
  descriptor shapes are each refused (and the value is checked absent from the
  whole state snapshot, not just from `forms.*`), three ordinary ones are kept,
  the rest of the event still lands when a value is refused, and the
  missing-descriptor decision is pinned.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=w3-redaction-followup` and
`DOMAIN_TEST_BUILD_LABEL=w3-redaction-followup` were set on every package
command. Exit status was captured by redirecting to a file and reading the exit
code separately, never through a pipe. No `pnpm build`, no `pnpm lab`, no
`pnpm structure:baseline`.

- **The failing proof, before any fix** —
  `pnpm --filter @fluxiq-web-extension/extension test:content redaction` →
  **exit 1**, `2 failed, 8 passed`. Failure 1: the typed password present in both
  validation strings of the `web.dom.type` result. Failure 2: the card value
  present in the captured snapshot.
- **The same command after the fix** → **exit 0**, `10 passed`. No skips, no
  `fixme`.
- `pnpm --filter @fluxiq-web-extension/extension check` → **exit 0**, no
  diagnostics. Re-run after the last test edit: **exit 0**.
- `pnpm --filter @fluxiq-web-extension/extension test` → **exit 1**,
  `# tests 144 / # pass 142 / # fail 2`. The two failures are
  `runtime/tests/action-runner.test.ts` rows about delivering an action to a
  child frame — `w3-frame-plumbing`'s file, modified in the working tree, and
  nothing to do with this change. My first run of this command failed a row of my
  own (`a withheld value is named by its length…`, where the one-character case
  trivially "contains" its own letter in the marker text); that was a defect in
  the test, not in the code, and is fixed and green.
- `pnpm --filter @fluxiq-web-extension/extension test:content` (full harness) →
  **exit 1**, `17 failed, 160 passed`. **None of the 17 is mine.** Re-run once as
  the wave's binding rules require: the failing set is **identical line for
  line** across the two runs (diffed). Fourteen of the seventeen are the same
  substitution, `web.action.<specific code>` → `web.action.rejected`, across
  `check-assert`, `click`, `keyboard`, `select`, `upload-dialog` — a change in
  `content/action-runtime/results.ts`, which `w3-failure-producers` owns and has
  modified in the working tree. The other three are `resolve-target.spec.ts` rows
  where an ambiguous selector now fails instead of taking the first match —
  `w3-resolver`'s change, also present in the working tree. The received values
  in the three `select.spec.ts` failures show my strings **unchanged**
  (`a selectable option matching label "Team"`,
  `the option "team" (Team) is disabled`), and every select row that asserts a
  value-bearing validation string passed.
- `pnpm --filter @fluxiq-web-extension/domain check` → **exit 0**.
- `pnpm --filter @fluxiq-web-extension/domain test` → **exit 0**,
  `# tests 195 / # pass 195 / # fail 0`. The four new reducer rows ran (`ok 51`
  through `ok 54`).
- `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (a copy of
  `.git/index` with the three new files added; the real index was never written)
  → **exit 1**, two violations, both pre-existing. Confirmed by running the audit
  against a pristine copy of the index with none of my files staged: **exit 1**,
  the same two, and diffing the two full outputs shows my change moves **exactly
  one line**: the advisory `directory-files` warning for
  `apps/extension/src/content/actions/` from 18 files to 19. That directory is
  not in `.structure-baseline.json`, so nothing is refused; see the third open
  question. The two failures are
  `apps/extension/src/runtime/tests/result-mapping.test.ts` reaching into
  `../../content/evidence` past its barrel (w3-evidence's seam) and
  `docs/working/README.md` being out of date (the supervisor's shared index).

## Not verified

- **No live browser validation in a loaded extension.** Everything is the real
  content-script bundle in real Chromium on the real fixture, through the T2
  harness: one world, no background worker, no frame routing. Redaction of the
  validation strings is decided entirely inside the content script, so the
  harness exercises the whole decision, but the wire hop to the background worker
  and on to the gateway was not exercised.
- **`web.dom.select` has no live redaction row.** No registered fixture has a
  `<select>` marked sensitive, so the eight redacted sites in `select.ts` are
  proven by the type checker, by `describeFieldValue`'s unit rows, and by the
  fifteen existing `select.spec.ts` rows continuing to produce the old strings on
  ordinary selects. The withheld branches themselves have no live proof. Adding a
  sensitive select to a fixture would close this; I do not own a fixture that has
  one.
- **`clear.ts`'s withheld branch has no live row either.** It is reached only
  when a page refills a field the clear emptied, and no fixture does that to a
  sensitive control. The live row proves the passing branch and the absence of
  the value; the failing branch is covered by the unit rows and the type checker.
- **The `type.ts` mismatch branch is unproven live**, for the same reason: it
  needs a sensitive field that rewrites its own value in an `input` handler.
- **Whether the eight `select.ts` strings are the complete set** is verified by
  re-scanning all three files for template interpolation after the change: every
  remaining raw interpolation is a tag name, an index, or a count, or sits on a
  branch guarded by `withheld`. That is a reading, not a measurement.
- **`pnpm check`, `pnpm test` and `pnpm build` at the repository root** were not
  run: the wave forbids the last and the other two are the supervisor's at
  integration.
- **The `selectedText` leak below is described, not fixed, and not proven by a
  failing test** — a `fixme` row would have broken this brief's "no fixme"
  requirement. It was observed once, in the pre-fix output of the card row.

## Open questions or contradictions found

1. **A fifth leak, in a file no Wave 3 brief owns: the page selection.**
   `apps/extension/src/content/dom-snapshot.ts` lines 69–70 copy
   `window.getSelection()?.toString()` into `snapshot.selectedText` without
   asking whether the focused control is sensitive. Chromium's selection
   **does** include the text of a focused ordinary `<input>`, so a select-all
   inside a card field, a one-time-code field, or anything marked
   `data-sensitive` puts its value straight into every snapshot — and from
   there into `page.selectedText` in durable web state
   (`recording/web-state/snapshot.ts`) and into the sanitized LLM packet
   (`runtime/llm-evidence/page-evidence.ts`, which lists `selectedText` as
   passed through). **I observed this**: it is why the card row failed a second
   time after the fixture fix, and it is the only reason the six original rows
   never met it — Chromium returns nothing for `type="password"`, so the
   password field hides the defect. The card row now types at the caret instead
   of over a select-all, with a comment at that exact line saying why, so the
   next reader finds this rather than a tidy-looking test. The fix belongs in
   `dom-snapshot.ts` (test `document.activeElement` with the shared rule before
   copying the selection); that file is `w3-evidence`'s, and I did not touch it.
   This is worth a follow-up brief on its own: the two downstream consumers
   already have the value by the time anyone could redact it.
2. **The sensitivity rule now exists in five places, and that is the defect the
   last worker warned about, arriving from a different direction.**
   `apps/extension/src/shared/sensitive-field.ts` is the one shared rule *for the
   extension*; `domain/src/runtime/llm-evidence/elements.ts`
   (`isSensitiveEvidenceElement`), `domain/src/runtime/reusable-evidence.ts`
   (`sensitiveControl`) and `domain/src/runtime/llm-evidence.ts`
   (`sensitiveElement`) each carry their own copy; and this brief added a fourth
   domain copy in `reducers.ts`. I could not avoid it: the structure audit
   forbids `domain/src` importing `apps/extension/src`, the runtime copies are
   either private to their module or deliberately kept out of the
   `llm-evidence` barrel, and `w3-llm-packet` is editing that directory
   concurrently. **The right fix is a single module inside the domain package** —
   the extension already depends on `@fluxiq-web-extension/domain`, so one
   exported `isSensitiveFieldSignature` there could serve the reducer, the three
   runtime call sites, and (through the package boundary) `element-traits.ts`
   and `runtime-status.ts`, deleting four copies. That crosses four workers'
   ownership, so it needs a brief of its own after this wave integrates. A
   duplicated rule leaked a billing card number in Wave 2; five copies is a
   larger version of the same bet.
3. **The change adds a nineteenth file to
   `apps/extension/src/content/actions/`,** which has been over the 15-file
   advisory since before this brief (18). The directory is not baselined, so the
   audit's verdict is unchanged and nothing is refused, but the advisory number
   grew by one. The alternative was three copies of the same length-and-marker
   formatting inside `type.ts`, `clear.ts` and `select.ts`; I judged one shared
   phrasing worth more than one advisory count, because the marker's exact form
   is what anyone grepping a result for a leak will look for, and a drifting
   marker is a drifting proof. If the supervisor disagrees, inlining it is
   mechanical. The directory is also a candidate for the sub-directory split the
   advisory is asking for, independent of this change.
4. **Ownership drawn around a file rather than around the change, again.** This
   brief owns `{type,clear,select}.ts` but not the directory, so the shared
   phrasing module is a new file in a directory the brief only partly grants.
   I created it and am reporting it rather than duplicating the formatting three
   ways; the brief should have said "and new modules beside them". Nothing here
   landed inert: every function added is invoked by an owned file and covered by
   a green row.
5. **A recorded `web.dom.type` step for a sensitive field replays as an empty
   string.** `domain/src/output-nodes/payloads.ts` builds `text` from
   `payload.inputValue ?? ""`, and a sensitive field's `inputValue` is now
   correctly absent, so a recording of a login replays typing nothing into the
   password box. That is the right security answer and the wrong product answer,
   and it is now also true of the card field, which this brief made sensitive.
   Not a regression I introduced — `w3-redaction` created it for passwords — but
   the fixture change widens it, and the `sensitive-input` manifest's
   `recordingScript` types into both fields. Whatever the eventual answer is (a
   credential reference rather than a literal, most likely), it belongs to
   Core's secret handling, not to the browser side.
