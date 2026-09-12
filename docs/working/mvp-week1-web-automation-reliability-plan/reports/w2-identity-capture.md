# Report: w2-identity-capture

Worker: `w2-identity-capture`. Brief: `### Brief: w2-identity-capture` in
[briefs/wave-2.md](../briefs/wave-2.md) — Phase 1.3 steps 1–2, the capture side.

## Outcome

**Done.** Every descriptor field the Wave 2 contract reserved for this brief is
now produced: `testId`, `accessibleName`, `label`, `implicitRole` and
`context`. All four gates pass; observed output in
[Commands](#commands-run-and-observed-results). No file outside the brief's
owns list was touched, and no baseline entry was added or regenerated.

## What changed and why

### New: `apps/extension/src/content/identity/`

One rule per module, so a signal can be read and changed without opening the
descriptor assembler. `describe-element.ts` is the only caller.

| Module | Export | Answers |
| --- | --- | --- |
| `accessible-name.ts` | `accessibleNameFor(element): string \| undefined` | `aria-labelledby` → `aria-label` → associated `<label>` → `title`/`alt` → `placeholder` → a push button's value → name from content |
| | `authoredNameAttribute(element): string \| undefined` | `aria-label` → `title` → `alt`: the name the author wrote on the element itself |
| `label.ts` | `labelText(element): string \| undefined` | the associated `<label>`, else the nearest label-shaped text before an unlabelled control |
| | `associatedLabel(element): string \| undefined` | only the `<label>`s the page associated (`for="id"` or an ancestor label) |
| `implicit-role.ts` | `implicitRole(element): string \| undefined` | the ARIA role the markup implies with no `role` attribute written |
| `context.ts` | `elementContext(element): DomElementContext \| undefined` | form, fieldset legend, landmark, heading, list position, table position |
| `bounded-text.ts` | `boundedText(value, maxLength): string \| undefined` | one normalization rule: collapse whitespace, trim, cap, empty means no signal |

`index.ts` is the directory's barrel.

### Changed: `describe-element.ts`

- Emits the five identity fields. `testIdFor(element)` (new export) reads
  `data-testid` → `data-test` → `data-cy`; `stableElementId` now calls it
  instead of repeating the list.
- **`accessibleName` is deliberately two functions, not one.** The wire field
  `accessibleName` is the *computed* name (`accessibleNameFor`). The exported
  `accessibleName`, which `dom-snapshot.ts` uses to decide whether an element
  is worth describing and how to rank it, is now a re-export of
  `authoredNameAttribute` — identical to what it computed before. Pointing the
  snapshot at the computed name would have changed which elements a snapshot
  includes and in what order, which is not this brief's change to make. Both
  live in one module, so there is one implementation of each step.
- The attribute allowlist gains `aria-labelledby`, `aria-describedby` and
  `for`. It does **not** gain `value`: I read "and value presence" as the
  presence signal, not the attribute, because copying `value` verbatim into
  `attributes` would put a sensitive field's content on the wire through a
  second door. Presence travels as `hasValue`.

### Changed: `element-traits.ts`

`isOrdinaryNonSensitiveFillControl` (its only caller was the `hasValue` line)
is replaced by `hasEnteredValue(element): boolean | undefined`, covering every
value-bearing control — text inputs, `textarea`, `select`, `file`,
`contenteditable`, and sensitive fields — and excluding the input types whose
`value` is not something a user entered (`hidden`, `button`, `submit`, `reset`,
`image`, `checkbox`, `radio`, whose state is `checked`).

**Widening this to sensitive fields is safe and was checked, not assumed.** The
function returns a boolean and never returns or logs a value. Downstream,
`domain/src/runtime/llm-evidence.ts:280` gates `hasValue` behind
`safeFillTag(tag, inputType)`, so the LLM packet still drops it for an unsafe
tag (its test at `llm-evidence.test.ts:80` pins exactly that for
`input[type=hidden]`). The sensitivity rule remains the one shared function:
`isSensitiveFieldSignature` via `isSensitiveFormControl`, which is consulted in
exactly one new place — a push button's value may name it, a sensitive field's
value may never. The label and name collectors skip nested controls, so no
control's value can reach the wire as someone else's label either.

### Decisions worth knowing

- **`context.landmark` is the landmark's role, not its name**, as the type's
  own comment in `shared/protocol.ts` specifies. Consequence, pinned by a test:
  on `ambiguous-targets` the two Continue buttons sit in two differently *named*
  `region` landmarks, and their `context` objects are equal — context alone does
  not disambiguate them. See [Open questions](#open-questions-or-contradictions-found).
- **`listPosition` and `tablePosition` are 1-based** (`{ index: 1, total: 12 }`
  reads "1 of 12"); `tablePosition.row` counts the header row, so the first body
  row is 2. `columnHeader` comes from the table's header row, which is the only
  column mapping a page like `data-table` offers.
- **Every scan is bounded.** `elementContext` runs for every described element
  and a snapshot describes up to 2 000 of them, so the heading search is capped
  at 10 ancestor levels, 12 previous siblings per level and 24 subtree queries
  per call; nearby-label scanning at 4 siblings; `aria-labelledby` at 8 ids.
  Nothing walks the document.
- **Name from content is role-gated**, to the roles that take their name from
  content (`button`, `link`, `option`, `heading`, cells, list items, …) or the
  equivalent tags. A `<div>` does not acquire a name made of the first 200
  characters inside it, and a form control never takes a name from its own text
  — which also keeps a `<textarea>`'s content, which *is* its value, out of the
  name.

### New: `apps/extension/e2e/content/tests/identity.spec.ts` (12 T2 cases)

Each case reads one element through the read-only `web.dom.extract` verb, whose
reply carries the exact descriptor the background worker receives.
`identity-drift` is covered in **all five modes** (baseline plus the four
drifts, each armed through the fixture's own `POST /api/identity-drift/set-mode`
then reloaded), and `ambiguous-targets` in two.

What the drift cases demonstrate, per mode:

| Mode | testId | accessibleName | context |
| --- | --- | --- | --- |
| baseline | `save-changes` | Save changes | landmark `region`, heading General |
| selector-only | `settings-submit` | Save changes | unchanged |
| text-only | *(none)* | **Apply changes** | unchanged |
| moved | *(none)* | Save changes | **landmark `form`, heading Advanced** |
| wrapped-aria | *(none)* | Save changes (via `aria-labelledby`) | unchanged |

Three fixtures beyond the two the brief names are used, each for context a
settings form has none of: `keyboard-forms` (fieldset legend, list position
9 of 12, a `role="combobox"` input whose implicit role is `textbox`),
`data-table` (row, column and column header), and `sensitive-input` (value
presence reported with no value in any identity field). Shipping that code
untested was the alternative; each harness starts its own Scenario Lab, so
using a fixture another worker's spec also uses is safe.

## Commands run and observed results

From `F:\!FluxIQWebExtension`. Every exit status captured by redirecting to a
file and echoing `$?`, never through a pipe. `EXTENSION_TEST_BUILD_LABEL=w2-identity-capture`
as the brief requires; no `pnpm build`, no `pnpm lab`, no `pnpm structure:baseline`.

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/extension check` | exit 0 |
| `EXTENSION_TEST_BUILD_LABEL=w2-identity-capture pnpm --filter … extension test` | exit 0 — `# tests 120 / # pass 120 / # fail 0` |
| `pnpm --filter @fluxiq-web-extension/extension test:content` | exit 0 — `117 passed (13.8s)`, my 12 identity cases among them |
| `GIT_INDEX_FILE=<scratch> node scripts/structure-audit.mjs` | exit 0 — `structure-audit: passed (31 warning(s), 19 baselined)` |

The audit ran against a **copy** of `.git/index` (`cp .git/index $TEMP/w2ic.index`,
then `git add -N` of the six new files into that copy), so the repository's own
index was never modified; `git ls-files` under it listed 963 files including all
six new ones. The warning total is 31, the same as w2-foundation observed:
`identity/` holds 6 files, well under the 15-file advisory threshold, and
`element-traits.ts`'s 11-export warning predates this work (one export was
replaced, not added).

**One failure, reran once, gone — and not mine.** The first unit run reported
`not ok 69 - a failure is reported against its command, finished the moment it
started` in `src/runtime/tests/action-runner.test.ts:638` (99 tests, 1 fail):
the actual result carried `failure`, `status: "failed"` and `validation` where
the expectation had none. That file and `action-runner.ts` belong to
`w2-browser-actions`, which was mid-edit; the rerun passed 120/120. I changed no
file on that path.

## Not verified

- **No live browser.** `test:content` runs the real content bundle in headless
  Chromium against Scenario Lab fixtures; nothing loaded the unpacked extension
  in a headed browser, and no recording session was driven end to end. The
  identity fields are proven on the **action** path (`executeAction` →
  `describeElement`); the **recorder** path calls the same `describeElement`, so
  it inherits them by construction, but no test asserts a recorded
  `web.element.clicked` payload carries them.
- **Nothing scores these fields yet.** Core's
  `createAutomationStudioElementMatcher` is not fed the new signals anywhere in
  this repository, so "matching Core's fingerprint normalizer" is verified as
  *shape and derivation* (I read
  `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\fingerprinting\element-fingerprint.ts`,
  read-only: `accessibleName` 24, `label` 20, `testId` 28, text compared after
  the same whitespace/case normalization), **not** as a resolution outcome. That
  is Phase 1.3's resolver, a later brief.
- **Snapshot cost was not measured.** `elementContext` runs per described
  element and a snapshot may describe 2 000; bounds are in place and the suite
  did not slow noticeably (117 specs in 13.8 s), but no benchmark compares
  `captureSnapshot` timing before and after on a large document.
- **`pnpm build`, `pnpm lab`, root `pnpm check`/`test`, domain and
  test-runner suites** were not run — the brief forbids the first two in
  parallel, and I changed no file in the other packages.
- **Descriptor `value` redaction is untouched**, as the brief states: a password
  field's `value` still reaches the wire while input-value capture is on. My
  test on `sensitive-input` deliberately asserts nothing about `value`, only
  that `hasValue`, `label` and `accessibleName` carry no part of it.
- **Unicode/RTL and shadow DOM.** No case covers a shadow root (`closest` and
  `getElementById` do not cross one, so context and `aria-labelledby` stop at
  the boundary) or a non-Latin label.

## Open questions or contradictions found

1. **A landmark's name is not captured, and on `ambiguous-targets` that is
   exactly the disambiguator.** `DomElementContext.landmark` is documented as
   the landmark *role*, so two `<section aria-label="Primary">` /
   `aria-label="Secondary"` regions both yield `"region"` and the two Continue
   buttons have byte-identical `context`. My spec pins this rather than papering
   over it. Corpus row W26 ("resolves ambiguity by context") will need either a
   landmark name field on `DomElementContext` (protocol.ts is w2-foundation's
   file, not mine) or a resolver that falls back to xpath/bounds. Cheapest fix:
   one optional `landmarkName` beside `landmark`.
2. **`descriptor.name` still means "the authored name attribute".** Whoever maps
   descriptors onto Core targets (`domain/src/output-nodes/targets.ts`,
   `w2-domain-vocabulary`) should feed Core's `accessibleName` from the new
   `accessibleName` field, **not** from `name`, or the strongest new signal is
   silently dropped at the boundary. `label` and `testId` map straight across.
3. **`element-finder.findClosestFingerprint` has not caught up.** It still
   resolves by `selector`, `xpath`, `id`, `data-testid`, `name`, class names and
   visible text; it ignores `accessibleName`, `label`, `implicitRole` and
   `context` entirely. Capture is now ahead of resolution, which is the intended
   order (Phase 1.3 steps 1–2 before the resolver), but until the resolver lands
   the drift modes still recover only by the signals that were already there.
4. **`implicitRole` is a documented subset**, not the whole HTML-AAM mapping:
   `<section>` and `<form>` report a role only once named, and elements outside
   the table report none rather than a guess. If a corpus row needs a role the
   table lacks, extend the table rather than inferring one at the call site.
5. **A worker-owned file failed once mid-run** (see Commands). If
   `w2-browser-actions` intends the guard path to carry `failure` and
   `validation`, `src/runtime/tests/action-runner.test.ts:638` needs updating
   with it; the supervisor should confirm at integration that the passing rerun
   reflects a finished edit and not a half-applied one.
