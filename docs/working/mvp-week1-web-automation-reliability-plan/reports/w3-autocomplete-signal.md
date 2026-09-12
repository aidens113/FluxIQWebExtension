# Report: w3-autocomplete-signal

Worker: `w3-autocomplete-signal`. The one security fix two earlier workers each
held half of: carrying `autocomplete` from the forms producer to the web-state
projection, and having the projection apply the shared sensitivity rule itself.

No captured or real secret value appears in this report, in any test name, or in
any test. The only attribute strings quoted are `autocomplete` token lists,
which are page markup naming what a field is for, not values. The one string a
control "holds" in the tests is the synthetic placeholder
`synthetic-value-the-producer-should-have-withheld`, and every row that plants
it asserts its absence rather than its shape.

## Outcome

**Done.** Three files, both halves, and both revert proofs.

A form control marked `billing cc-number` is now protected by **two independent
checks**. The producer's `sensitive` flag is unchanged and still set; the
projection now reads the control's `autocomplete` tokens off the wire and asks
`domain/src/sensitivity/` again. Either check alone withholds the value; both
must fail before anything escapes. Before this, the projection could only
re-derive the `controlType` half of the rule, and a card field is a plain `text`
input, so `controlType` could never see one.

No fourth file was needed. `input.ts` types `forms` as `unknown[]` and the
projection reads through `record()`, so the new field is reachable without a
declared shape; the cross-frame merge spreads each control
(`dom-snapshot.ts:219`), so it survives the merge untouched. I checked both
rather than assuming them.

Extension `check` (source) **exit 0**; extension `test` **exit 0, 215/215**;
content harness **exit 0, 185 passed**; domain `check` **exit 0, both
projects**; domain `test` **254 of 255**, the one failure another worker's
mid-edit file. Structure audit **exit 0**, and byte-identical to a run without
my files.

## What changed and why

### `apps/extension/src/content/evidence/types.ts` — the field

`FormControlEvidence` gains `autocomplete?: string | undefined`, documented as a
signal rather than a value: it is page markup naming what the field is for, and
it is the half of the rule that has leaked a card number twice in this plan.

### `apps/extension/src/content/evidence/forms.ts` — the producer

`describeControl` now carries the attribute, beside — not instead of — the
`sensitive` flag it already set. The flag is this producer's conclusion; the
tokens are the evidence it drew that conclusion from, so the other end can reach
it independently.

**Not `boundedText`, and not a character slice either.** `boundedText` collapses
and slices to 200 characters, and truncating the input to a security predicate
is a way past it. But a plain `.slice(0, 500)` — which is what the specification
report proposed, matching `describe-element.ts:97` — has the same defect in
miniature: a cut through the middle of a token leaves `billing cc-nu`, which
matches nothing. So the attribute is bounded **by whole tokens**:

```ts
function autocompleteTokens(element: Element): string | undefined {
  const tokens = (element.getAttribute("autocomplete") ?? "")
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, MAX_AUTOCOMPLETE_TOKENS)          // 16
    .map((token) => token.slice(0, MAX_AUTOCOMPLETE_TOKEN_LENGTH));  // 64
  return tokens.length ? tokens.join(" ") : undefined;
}
```

A bound is still needed — a page controls this string and it travels on a wire,
up to 30 controls per form and 8 forms — but no bound may cut a token in half. A
legitimate value is at most a `section-*` name, a `shipping`/`billing`
qualifier, a contact kind, a field name and `webauthn`, so neither bound can
touch one. The per-token cap slices rather than drops, so a `cc-`-prefixed token
longer than 64 characters still arrives with the prefix the rule matches on.

The producer does **not** decide which tokens matter — that is the rule's job,
and reimplementing it here is exactly the duplication that caused both leaks.

### `domain/src/recording/web-state/evidence/project.ts` — the consumer

```ts
const autocomplete = typeof control?.autocomplete === "string" ? control.autocomplete : undefined;
const sensitive = control?.sensitive === true
  || isSensitiveFieldSignature({ inputType: controlType, controlType, autocomplete });
```

**Not `text(control?.autocomplete)`** — `read.ts`'s `text()` collapses and
slices to 200 characters, for the same reason as above. The attribute is read
raw, used for the decision, and then discarded: it is not written into the
projected blob, because a persisted, replayed artefact gains nothing from it and
widening a persisted surface for nothing is not free. A test pins that the
projected control's key set is unchanged.

The `typeof … === "string"` guard is not decoration. The evidence comes off a
wire from a page and `input.ts` declares nothing about this field, so an array
or an object could arrive; a row plants each and requires the projection to
ignore it rather than throw and take the recording down.

The docstring above `formControl`, which stated the old weakness as a known
limitation, now states the new property instead.

## The two revert proofs

The standard the brief set: the proof must fail if **either** half is reverted.
`apps/extension/src/content/evidence/tests/forms.test.ts` meets it because it
does not hand-write the wire payload — it runs the **real** `formEvidence()`
over a stubbed DOM, strips the producer's `sensitive` flag from what comes out
(modelling a producer that is stale, regressed, or older than the domain reading
it), and puts that through the **real**
`createWebAutomationStateFromSnapshot()`. A test that wrote the payload by hand
would pass with the producer reverted, which is the exact failure mode this plan
keeps hitting.

### Reverting the producer half

Removed the one line `...(autocomplete ? { autocomplete } : {}),` from
`describeControl`, leaving the consumer's change in place, and re-ran the
extension suite.

`pnpm --filter @fluxiq-web-extension/extension test` → **exit 1**,
`# tests 215 / # pass 212 / # fail 3`. All three are mine:

| Row | Observed |
| --- | --- |
| 121 the producer puts the token list on the wire whole… | the field is absent from the described control |
| **122 a card field whose producer verdict never arrives is still withheld…** | `sensitive` was `undefined`, expected `true` |
| 123 the deciding token survives a page that buries it past every text bound | the field is absent |

Row 122 is the security row: with the flag gone from the wire and the attribute
not carried, the control was described with `hasValue` intact and no
`sensitive`. Then restored the file from a scratchpad copy and confirmed the
line back.

### Reverting the consumer half

Restored the producer, then dropped `autocomplete` from the signature the
projection passes to `isSensitiveFieldSignature`, leaving the producer's change
in place.

- `pnpm --filter @fluxiq-web-extension/domain test` → **exit 1**,
  `# tests 254 / # pass 249 / # fail 5`. Four are mine — rows 84, 85, 87 and 88
  of `evidence/tests/project.test.ts`. The fifth is the foreign failure
  described below.
- `pnpm --filter @fluxiq-web-extension/extension test` → **exit 1**,
  `# tests 215 / # pass 213 / # fail 2`, and the two are rows **122 and 123** —
  the same security rows, failing the same way, with the producer sending the
  attribute perfectly.

Row 122 therefore fails under **both** reverts and passes only with both halves
present, which is the property the brief asked to be demonstrated. Then restored
`project.ts` from its scratchpad copy and confirmed the line back.

## Tests

**`apps/extension/src/content/evidence/tests/forms.test.ts`** — new, 6 rows, the
cross-package joint. The DOM is a stub (this runner is Node; the producer on
real pages is `e2e/content/tests/evidence.spec.ts`) installed and restored
synchronously around each call, because every test file in this package is
imported into one process and a global left behind would reach another file's
tests.

- the producer carries the token list whole beside its own verdict, and the
  control's `controlType` is `text` — which is *why* the second check needs the
  attribute;
- **the security row**: producer verdict stripped, value still withheld,
  `hasValue` gone, and the control's contents absent from the whole serialized
  state;
- the deciding token survives being buried past the 200-character bound;
- an ordinary field (`billing street-address`) keeps `hasValue` — the rule
  protects secrets, not every control;
- a control only the producer's flag can recognise is still protected, which is
  the flag's half of the pair;
- what the control holds appears on neither side of the wire.

**`domain/src/recording/web-state/evidence/tests/project.test.ts`** — new, 9
rows, the consumer's decision on its own. Placed beside its subject per the
repository's test-placement rule rather than added to
`web-state/tests/evidence.test.ts`, which another brief may be editing. Every
row sends a payload whose `sensitive` flag is absent or wrong, because a row
that sent the flag would pass with the second check removed and prove nothing.
Rows: the unmarked card field; nine token shapes including `shipping cc-exp`,
`section-pay billing cc-csc`, mixed case and stray whitespace; six ordinary
values keeping `hasValue`; the buried token; the attribute not widening the
persisted key set; `controlType` still sufficient on its own; the producer's
flag still sufficient on its own; five non-string attributes ignored rather than
thrown on; and the planted value absent from the state under any key.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=w3-autocomplete-signal` and
`DOMAIN_TEST_BUILD_LABEL=w3-autocomplete-signal` on every package command. Exit
status captured by redirecting to a file and echoing `$?`, never through a pipe.
No `pnpm build`, no `pnpm lab`, no `pnpm structure:baseline`, no git command that
writes the real index.

- `tsc -p tsconfig.json --noEmit` in `apps/extension` → **exit 0**, no
  diagnostics. `tsc -p tsconfig.test.json` → **exit 2**, exactly one error, in
  `src/runtime/tests/result-mapping.test.ts:147` (`WebAutomationFailureCode`),
  a file another worker has modified in the tree. Run separately precisely so
  the source half's clean result is not hidden by the `&&`. My new test file
  type-checks: tsc reports every error in the program and named only that one.
- `pnpm --filter @fluxiq-web-extension/extension test` → **exit 0**,
  `# tests 215 / # pass 215 / # fail 0`. My six are `ok 121`–`ok 126`.
- `pnpm --filter @fluxiq-web-extension/test-contracts build` → **exit 0**, then
  `pnpm exec playwright test -c e2e/playwright.content.config.ts --workers=4`
  from `apps/extension` → **exit 0**, **185 passed**. The 19 `evidence.spec.ts`
  rows are green, including the two that compare a form's control list with
  `toEqual`; no registered fixture carries an `autocomplete` attribute, which I
  checked by grep across every `.html` and `.ts` in the repository before
  running.
- `tsc -p tsconfig.json --noEmit` and `tsc -p tsconfig.test.json` in `domain` →
  **exit 0, exit 0**, no diagnostics. (An earlier run failed with two errors in
  `domain/src/runtime/failure/classify.ts`; another worker's mid-edit file,
  clean on the later run.)
- `pnpm --filter @fluxiq-web-extension/domain test` → **exit 1**,
  `# tests 255 / # pass 254 / # fail 1`. My nine are `ok 84`–`ok 92`. The single
  failure is `domain/src/runtime/tests/adapter.test.ts`, *the client's structured
  failure record reaches the runtime result*, which received
  `web.action.unknown` where it wanted `web.action.output_not_observed`. **Not
  mine, and established rather than asserted**: my first full domain run of this
  session was **exit 0, 254/254** with my `project.ts` edit and my new domain
  test already in place; the failure appeared afterwards, `domain/src/runtime/
  adapter.ts` and its test are both modified in the working tree by
  `w3-failure-producers`, and the row is about failure-code classification with
  no path to sensitivity or evidence. Re-run once as the wave rules require;
  identical, and the suite total moved 254 → 255 between runs, so another worker
  landed a test while I was running.
- One domain run aborted at `# tests 10` on
  `ERR_MODULE_NOT_FOUND: …/domain/node_modules/fluxiq/dist/programs/automation-studio/index.js`
  — Core's linked `dist` being rebuilt underneath the run. Environmental; the
  rerun was clean.
- Structure audit, `node scripts/structure-audit.mjs` through a scratch
  `GIT_INDEX_FILE` (a copy of `.git/index` plus `git add -N` of my two new test
  files) → **exit 0**, `passed (29 warning(s), 19 baselined)`. Run again against
  a pristine copy of the index with my files unstaged → **exit 0**, and the two
  outputs **diff to nothing — byte identical**. So my change adds no finding and
  no warning. I confirmed the audit honours the scratch index rather than
  assuming it: `git ls-files` under it lists both new test files, under the
  pristine one neither. `git status --porcelain` shows nothing staged; the real
  index was never written.

## Not verified

- **No live browser validation of this change.** The content harness ran green,
  but no registered fixture has a control carrying an `autocomplete` attribute,
  so **no row in it exercises the new field**. What the harness proves is that
  the producer change breaks nothing on real pages, not that it works on one.
  The producer over a real DOM with a real `autocomplete` attribute is covered
  only by the stubbed test. A fixture with a `billing cc-number` field would
  close this; I own no fixture, and adding one would have widened the brief.
  **This is the gap worth closing next** — see the open questions.
- **No unpacked extension was loaded**, so the wire hop from content script to
  background worker to gateway is not exercised for the new field. The
  cross-frame merge is reasoned from `dom-snapshot.ts:219` spreading each
  control, and from `w3-evidence-finish` having checked the same thing, not run.
- **Core's side.** Nothing here observed a projected state carrying the new
  decision arriving at Core.
- **The 16-token and 64-character bounds have no row of their own.** A page that
  puts the deciding token past the sixteenth is a false negative for *this*
  check, closed by the producer's flag, which is what a second independent check
  is for. It is bounded by construction and I judged a row for a crafted
  17-token attribute not worth the reader's time; if the supervisor disagrees it
  is three lines.
- **`pnpm build`, root `pnpm check` and root `pnpm test`** were not run, per the
  wave's binding rules.

## Open questions or contradictions found

1. **The fixture gap is now the weakest link in the coverage, not the code.**
   Every redaction guard in this plan is proven live on the `sensitive-input`
   fixture except this one, because no fixture carries an `autocomplete`
   attribute at all — `grep` finds the string in exactly four places in the
   repository's HTML, all of them `autocomplete="off"` in the extension's own
   popup and side panel. A single `<input autocomplete="billing cc-number">` on
   `sensitive-input`, plus a row in `evidence.spec.ts` asserting the token list
   reaches the evidence, would make the producer half live. Whichever brief owns
   a fixture next should take it.
2. **The `autocomplete` a descriptor carries is still sliced to 500
   characters**, at `describe-element.ts:97`, and `isSensitiveElementDescriptor`
   reads that sliced value. `w3-evidence-finish` raised this and I confirm it is
   still true: the forms evidence path is now token-bounded and safe, and the
   element-descriptor path beside it is not. Same class of hazard, different
   file, and I do not own it. It is one attribute in a 25-entry allowlist that
   is bounded as a whole, so the fix is an exemption for that one key rather
   than a change to the bound.
3. **`content/element-traits.ts` still does not pass `controlType`**, so the
   raw `type` attribute signal of the shared rule is unreachable from the live
   DOM (`w3-sensitivity-consolidation`, open question 2). Unchanged, still one
   line, still unowned. It now matters slightly more: the producer and the
   projection ask the same rule with different fields available, and this is the
   one field only the producer could supply and does not.
4. **The projection now decides `sensitive` from a signal it does not persist.**
   That is deliberate and argued above, but it means a reader of stored web
   state can see *that* a control is protected and never *why*. If a Flow ever
   needs to distinguish "protected because it is a password" from "protected
   because it is a card field", the answer is not in the artefact. I judged the
   privacy of not widening the persisted surface worth more than the
   diagnostic; it is a one-line change if the supervisor disagrees.
5. **A wire field has three shape declarations and no compiler between them.**
   `content/evidence/types.ts` declares it, `web-state/evidence/input.ts`
   deliberately does not (it types `forms` as `unknown[]`), and the projection
   reads it through `record()` with a `typeof` guard. That is the right design
   given the audit forbids `domain/src` importing `apps/extension/src`, and it
   is why the cross-package test in `content/evidence/tests/forms.test.ts`
   exists — it is the only thing that fails if the two ends stop agreeing. Worth
   knowing that it is the *only* thing.
