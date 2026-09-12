# Report: w3-spec-reconciliation

Worker: `w3-spec-reconciliation`. Wave 3, added after dispatch: the content
specs that asserted the contracts Wave 3 deliberately replaced, and that no
brief's Owns contained.

## Outcome

**Done, and nothing was left failing.** The six files I own are green, and so is
the rest of the content harness: `npx playwright test -c
e2e/playwright.content.config.ts` (the whole suite, 18 spec files) reports
**179 passed, 0 failed, exit 0**. There is no residue to attribute to anyone
else — at the moment I ran it, every other worker's specs passed too.

Twenty assertions were changed and three whole rows were deleted. Every one was
decided from the producing source first — `content/action-runtime/results.ts`,
`content/actions/assert.ts`, `domain/src/runtime/failure/codes.ts` — and only
then written into the spec. No `src/` file was touched, and no assertion was
weakened to make a red row go away.

## The rule I applied, and what it changed about the edits

A rejection code collapse is the kind of change a spec can be edited *through*
without noticing: swap `"web.action.disabled"` for `"web.action.rejected"` and
the row goes green having stopped proving anything about the reason at all.
Six of the old codes named a reason; one code names none. So every row I
touched also asserts where the reason went — the record's `actual`, which
`actionRejected` writes as `` `${reason}: ${observed}` `` — and eleven of the
fifteen assert the record's `expected` beside it. Those assertions are new
coverage, not preserved coverage: before this change the reason was in the
code, and no row asserted the record's `actual` at all.

The same reasoning drove the assert rows: `retryable` flipping from `true` to
`false` is the substantive half of that re-categorisation, so all five rows now
pin it, where three of them previously asserted only `category` and `code`.

## What changed and why

### 1. Per-reason rejection codes collapsed into `ACTION_REJECTED`

Fifteen assertions, in five files. In each, the old row asserted a code built
per reason (`web.action.${reason}`, from `rejectionFailure` in
`validation-outcome.ts`); the contract is now the closed set's single
`web.action.rejected`, category `blocked_by_capability_or_policy`, `retryable:
false`, stage `execution`, with the reason carried in the record's `actual`.

The `validation` an operator reads is untouched by the collapse, so every row's
existing `validation` assertion still holds unchanged, and I left them all in
place — they are what proves the reason is still stated in plain words as well
as in the record.

| File (new line) | Row | Old code | New `actual` asserted |
| --- | --- | --- | --- |
| `click.spec.ts` 178 | a disabled target is rejected | `web.action.disabled` | `disabled: the element is disabled` |
| `click.spec.ts` 195 | a covered target is rejected | `web.action.covered` | regex: `covered: the point <x>,<y> landed on div[data-testid="overlay"], which covers the target` |
| `click.spec.ts` 219 | a hidden target is rejected | `web.action.hidden` | `hidden: the element's display is none` |
| `keyboard.spec.ts` 203 | a radio group's arrow keys | `web.action.unsupported_key` | `unsupported_key: moving a radio group's selection needs a trusted key event; the key was delivered but nothing changed -- use web.dom.check instead` |
| `keyboard.spec.ts` 225 | type into a disabled field | `web.action.disabled` | `disabled: the element is disabled` |
| `keyboard.spec.ts` 245 | clear a disabled field | `web.action.disabled` | `disabled: the element is disabled` |
| `keyboard.spec.ts` 263 | keypress on a disabled target | `web.action.disabled` | `disabled: the element is disabled` |
| `select.spec.ts` 156 | a disabled select | `web.action.disabled` | `disabled: the element is disabled` |
| `select.spec.ts` 172 | a hidden select | `web.action.hidden` | `hidden: the element's display is none` |
| `select.spec.ts` 191 | a disabled option | `web.action.disabled` | `disabled: the option "team" (Team) is disabled` |
| `upload-dialog.spec.ts` 72 | a target that cannot hold files | `web.action.upload_rejected` | `upload_rejected: the target is a button, not a file input` |
| `upload-dialog.spec.ts` 124 | a dialog command with no request | `web.action.dialog_no_response` | `dialog_no_response: the command carried no dialog request` |
| `check-assert.spec.ts` 98 | unchecking a radio | `web.action.not_checkable` | `not_checkable: a radio cannot be unchecked; check another radio in its group instead` |
| `check-assert.spec.ts` 111 | checking a text field | `web.action.not_checkable` | `not_checkable: <input[type=text]> is not a checkbox or a radio` |
| `check-assert.spec.ts` 126 | a disabled checkbox | `web.action.disabled` | `disabled: the checkbox is disabled` |

Two test titles were stale after the change and were reworded, because the code
is no longer what carries the distinction they name:

- `select.spec.ts`: "a hidden select is rejected as hidden, so the **code** is
  the capability's own rather than a guess" → "so the **reason** is …".
- `check-assert.spec.ts`: "a disabled control is rejected with the disabled
  **code**" → "with the disabled **reason**".

The `click.spec.ts` covered row is the one that could not assert an exact
string: the reason embeds the hit-test point, which moves with layout. It
asserts a regex that pins the `covered: ` prefix and the overlay's label, the
same shape the row already used for its `validation.actual`.

### 2. Assertion failures re-categorised to `STATE_MISMATCH`

Five rows in `check-assert.spec.ts`. Each asserted a per-kind code
`web.assert.${kind}` under category `expected_state_missing` with `retryable:
true`; the contract is now `web.validation.state_mismatch`, category
`unexpected_state`, `retryable: false`, stage `verification` — one record for
every kind, built by `assert.ts`'s `stateMismatchFailure` from the closed set.

| New line | Row | Old code | Now also asserts |
| --- | --- | --- | --- |
| 147 | `exists` on a selector nothing matches | `web.assert.exists` | `expected`/`actual` both, verbatim from the validation |
| 168 | a `text` claim that does not hold | `web.assert.text` | `expected`/`actual` both |
| 184 | `visible` on a hidden element | `web.assert.visible` | `actual`, plus `retryable`/`stage` (the row asserted neither before) |
| 207 | `enabled` on a disabled button | `web.assert.enabled` | `actual`, plus `retryable`/`stage` |
| 223 | `url` against another page | `web.assert.url` | `expected`, plus `retryable`/`stage` |

The kind is no longer in the code, so the rows prove it is not lost: `expected`
names the claim in words (`an element matching "…" exists`, `"…" contains "…"`,
`the page URL is …`), which is where a reader looks for it.

Line 143's `expect(wrong.failure?.category).not.toBe("output_not_observed")`
needed nothing and was left exactly as it was — it is the row that keeps the
`web.dom.assert` / `web.dom.click` distinction honest, and it still holds.

The file header claimed `STATE_MISMATCH` was `expected_state_missing`, which was
the same error `assert.ts`'s header carried. It is rewritten, with the reason
the set gives: a failed authored assertion means the page is in a state other
than the asserted one, which is what `unexpected_state` names, while
`expected_state_missing` is Core's transition-comparison category and has no web
code. The header also now states why `retryable` is `false` and where a
refusal's reason travels, so the next reader of these rows does not have to
rediscover either.

### 3. Three rows in `resolve-target.spec.ts` deleted, not rewritten

`w3-resolver` reported that all three had passing replacements. **I verified
that before deleting anything**, by running `identity-resolution.spec.ts` first:
**12 passed, exit 0**, including each named replacement. Only then did I remove
the rows.

| Deleted row | What it pinned | Covered now by (`identity-resolution.spec.ts`) |
| --- | --- | --- |
| `on ambiguous-targets › selector: an ambiguous selector takes the first match in document order` | `succeeded` on `choice-primary` | `ambiguous-targets: a tie is reported, not guessed › an ambiguous selector fails TARGET_AMBIGUOUS and names what tied` (line 167) — same fixture, same command, and it asserts more: the whole record, `resolution.candidateCount`, both candidate labels in the message, and that nothing was clicked |
| `on ambiguous-targets › fingerprint: matching text takes the first match; a test id is exact` | first half `succeeded` on `choice-primary`; second half the exact test id | `… › an ambiguous fingerprint text fails TARGET_AMBIGUOUS; a unique test id still resolves` (line 184). Its second half is the deleted row's second half verbatim — same command, same `choice-secondary` expectation — so the exact-test-id coverage moved rather than vanishing |
| `on long-document › visual target: viewport bounds win over document bounds, even when stale` | `succeeded` on the wrong element | two rows: `long-document: a visual target prefers its document bounds › document bounds win over the viewport bounds recorded beside them` (line 238) and `› stale viewport bounds no longer click whatever scrolled into their place` (line 255) |

Nothing else in that file changed behaviour, and the remaining ten rows all
pass. Its header did have to change: it advertised itself as pinning "today's
behaviour … known defects included", naming all three defects. Two of the three
are now fixed, so the header would have been a lie about the file's own purpose.
It now states what the file still pins (the strategy order, each strategy's
reach, and the one genuine remaining limitation — a point resolves only inside
the viewport, because `coordinates` are viewport-relative), and names the three
deleted rows with the spec that replaced each, so the coverage is traceable from
where it used to live.

`PRIMARY`, `SECONDARY`, `viewportRect`, `documentRect`, `centre`,
`visualTarget` and `viewportHeight` all still have call sites after the
deletions — checked, and the type check confirms it.

## Rows left failing: none

Every row in the six files passes. I found no case where the spec was right and
the product wrong, so nothing was left red and nothing was edited into agreement
with a defect. The one behaviour I was warned about — an assertion timeout —
does not appear anywhere in these files, and I did not add it (see below).

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=w3-spec-reconciliation` was set for every command.
No `pnpm build`, no `pnpm lab`, no `pnpm structure:baseline`. Exit status was
captured by redirecting to a file and echoing `$?`, never through a pipe.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/extension check` | **0** | `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`, no diagnostics. Run after the edits; the e2e specs are in `tsconfig.test.json`'s program |
| `npx playwright test -c e2e/playwright.content.config.ts` (whole harness, `--workers=4`) | **0** | **179 passed** (20.3s), 0 failed, 0 skipped |
| … `check-assert.spec.ts click.spec.ts select.spec.ts` `--workers=3` | **0** | `34 passed` |
| … `keyboard.spec.ts upload-dialog.spec.ts resolve-target.spec.ts` `--workers=3` | **0** | `29 passed` |
| … `resolve-target.spec.ts identity-resolution.spec.ts` (**before** deleting anything) | **1** | `22 passed, 3 failed`. The three failures were exactly the three rows I then deleted; all 12 `identity-resolution.spec.ts` rows passed, which is the evidence the replacements exist |
| … `click.spec.ts` (before my edits) | **1** | `7 passed, 3 failed` — the three rejection-code rows, each diff showing only `code` differing |
| `node scripts/structure-audit.mjs` (scratch `GIT_INDEX_FILE`, this report staged) | **1** | 3 violations, **none mine**; see below |

### The structure audit's three violations, and why none is mine

The audit reports `3 violation(s) across 2 rule(s)` and 27 warnings, and its
output with this report staged is **byte-identical** to its output without it
(`diff` reports no difference at all). I own no
file any of them names, and I added no file and removed no file, so the audit's
inputs are the same set of paths as before my change:

- `FAIL [imports] apps/extension/src/runtime/tests/result-mapping.test.ts` —
  imports `../../content/evidence` instead of the directory barrel.
  `w3-evidence`'s, and reported by two earlier workers before I started.
- `FAIL [imports] apps/extension/src/shared/protocol.ts` — two imports reaching
  into `../content/evidence`. Same origin, and newer: `w3-failure-producers`
  and `w3-extension-gaps` each saw only the `result-mapping.test.ts` one.
- `FAIL [working-docs] docs/working/README.md is out of date` — the
  supervisor's index, whose regeneration command workers must not run.

The audit was run through a scratch `GIT_INDEX_FILE` (a copy of `.git/index`
under the session scratchpad, with this report added). The real index was never
written. No warning or violation names any file under
`apps/extension/e2e/content/tests/`; the six files are 174–276 lines, far under
the 400-line advisory, and I added no file to that directory.

## Not verified

- **No live browser validation of the extension.** The content harness is the
  real content-script bundle in real Chromium on Scenario Lab fixtures, but with
  no background worker, no tab routing and no gateway. Nothing here proves what
  a Flow sees.
- **The extension unit tests (`pnpm … test`) were not run**, and neither were
  any domain or test-runner gates. I changed only Playwright specs, which none
  of those programs compile or execute; `check` covers their type-correctness.
  If the supervisor wants a single confirmation, the harness run above is it.
- **`pnpm check`, `pnpm test` and `pnpm build` at repository scope** were not
  run. The structure audit, which is what root `check` runs first, was run
  directly.
- **The full-harness green is a snapshot.** Other workers were editing this tree
  while I ran it; a later edit can turn a file red that was green at 179/179.
- **I did not re-derive the reason strings by reverting the producer.** Each
  asserted `actual` was read off `results.ts`'s `` `${reason}: ${observed}` ``
  composition plus the verb's own call site, and then confirmed by the row
  passing. A row passing is weaker evidence than a mutation check, but the
  strings are exact rather than substring matches, which is what makes the
  passing row meaningful.

## Open questions or contradictions found

### `web.dom.assert` cannot report `TIMEOUT`, and the specs cannot say so

The brief warned me off writing an assertion-timeout row, and the warning is
right: `AssertionOutcome` is `{ held, expected, actual }` and carries no timing,
so `evaluateAssertion` returns the same shape whether the claim was false
immediately or false for the whole polling window. Every failed assertion is
therefore `STATE_MISMATCH`, and the vocabulary's line "a wait or action timeout
is status `timed_out` with `TIMEOUT`" is satisfied by the wait verbs and not by
`assert`.

What this costs the spec suite specifically: three of the five assert rows above
pass a short `timeoutMs` (200 ms) and are, in fact, exercising the expiry path —
`exists` on a selector nothing matches, `visible` on a hidden element, `url`
against another page all poll until the window closes. They assert
`STATE_MISMATCH` because that is what the product produces, and they would
assert the same thing if the polling loop were deleted. So **the assert verb's
wait is currently unproven by these rows**, in either direction. That is worth
knowing before someone reads the suite as covering it.

`w3-extension-gaps` names the seam: `AssertionOutcome` must carry that its wait
expired (`content/action-runtime/assertion-evaluation.ts`), the dependency type
must pass it (`content/actions/types.ts`), and the status must become
`timed_out` rather than `failed`
(`content/action-runtime/validation-outcome.ts`). No Wave 3 brief owns any of
the three. When one does, `check-assert.spec.ts` gains a row and the two
`timeoutMs: 200` rows above should be split into an immediate-false case and an
expired case.

### `rejectionFailure` is still exported, still tested, and now contradicts the set

`content/action-runtime/validation-outcome.ts` still exports
`rejectionFailure(code, validation)`, which builds `web.action.${code}` from a
caller-supplied suffix — the exact thing the closed set exists to prevent — and
`src/content/action-runtime/tests/validation-outcome.test.ts:55` still passes
against it. `results.ts` was its only production caller and no longer calls it,
so that unit test is now green proof of dead code that disagrees with the wire.
`outputNotObservedFailure`, `timeoutFailure` and `notImplementedFailure` in the
same file are dead in the same way, though harmless.

Both `w3-failure-codes` and `w3-failure-producers` flagged this and neither
owned the file. I do not own it either — it is `src/`, which my brief forbids
outright. Flagging it a third time because the shape of the risk has changed:
with `results.ts` converted, this function is no longer merely redundant, it is
the only remaining way to mint a rejection code outside the set, and a test
stands behind it.

### One place the specs still cannot reach the vocabulary

`NAVIGATION_UNEXPECTED` has no content-side producer at all — its only producer
is `runtime/action-results.ts`, in the background worker, which the content
harness does not run. No row in my six files can assert it, and none tries.
`w3-failure-producers` reached the same wall from the other side. If Wave 4
wants that category proven, it needs a T3 Lab row, not a content spec.

### The harness overloads before it fails honestly

My first run — the six files, six workers, alongside three other workers'
suites — reported **66 of 66 failed**, every one a 30 s timeout inside
`harness.ts:88`'s `page.evaluate`, with no assertion diff anywhere. Nothing was
wrong: the same files at `--workers=3` pass, and the whole 179-test harness
passes at `--workers=4`. This is the "a compiler crash under load is
environmental" rule showing up in a new place, and it is worth naming because
the failure mode is indistinguishable at a glance from a content script that
hangs on every action — which is what I started to diagnose before rerunning.
A worker who trusts that output will chase a bug that does not exist.
