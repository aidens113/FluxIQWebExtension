# x0-page: the page share of X0

## Outcome

**Partial.** Everything inside this brief's ownership is done and checked:

- The extension check, the labelled unit tests, and every `actions` and `extract-list` harness case pass.
- Ten mutations were tried. Nine were observed red and reverted. One (M3) had its run refused by the permission classifier; it was reverted and not retried.

One definition-of-done item is not met: **the structure audit exits 1**. Its only failure is `[working-docs] docs/working/README.md is out of date`. That file is a shared document this worker may not edit, and `git status` shows no change outside my own files, so the drift is already in the committed tree. My files add no violation. The supervisor clears it with `pnpm structure:baseline`.

Separately, the harness exposed a **sensitive-content leak outside extraction**, in the page snapshot that rides on every reply. Details are under "Open questions", item 1.

## What changed and why

### X0.1: a sensitive control is refused on the page (D2)

- **`content/action-runtime/extract.ts`**
  - `extractElement` now returns `ExtractedElementValue`: either `{ ok: true; value }` or `{ ok: false; refusal: "sensitive_value" }`.
  - Its first statement checks `isSensitiveFormControl(element)`, so every mode is refused before anything is read: default, `attribute` and `html`.
- **`content/actions/extract.ts`**
  - On a refusal, the verb returns `deps.rejected(action, startedAt, "sensitive_value", "a readable element that is not a sensitive control", "the target is a sensitive control, so its value is never read", { element, resolution })`.
  - The result carries no `extracted`.
- **`content/action-runtime/list-extraction.ts`**
  - `readField` is now passed the field name. When the resolved element is a sensitive control, it throws an error carrying an ACTION_REJECTED record:
    - expected: `field <name> reads no sensitive control`
    - actual: `sensitive_value: field <name> resolved to a sensitive control, so its value is never read`
  - The record is built with `webAutomationFailureRecord`, imported from `@fluxiq-web-extension/domain/client` exactly as `results.ts` imports it. `actionFailure` lifts it, so the whole read is refused.
  - Beyond the report: `readColumn` refuses a cell that itself carries the sensitivity signature. See open question 3.
- **`content/action-runtime/index.ts`**: exports the types `ExtractedElementValue` and `ListExtractionOptions`.
- **`content/actions/types.ts`**
  - `extractElement` returns `ExtractedElementValue`.
  - `extractList(request, options?: ListExtractionOptions)`.
  - The now-unused `JsonValue` import is removed.

### D2 amendment: containers

These rules also live in `action-runtime/extract.ts`.

- **Text reads.** `readableText(element)` collapses whitespace in the element's text.
  - When the element has a descendant that is sensitive by the shared rule, the text is gathered with a `TreeWalker` that rejects every subtree rooted at such a descendant. That drops a sensitive `<textarea>`'s text and a sensitive `<select>`'s option labels.
  - It asks the rule about every descendant (`querySelectorAll("*")`) rather than pre-selecting by tag, so no second copy of the rule's inputs exists.
  - A container with no sensitive descendant reads exactly as before.
- **HTML reads.** `htmlWithoutSensitiveContent` returns `innerHTML` unchanged when there is no sensitive descendant.
  - Otherwise it imports a copy into `document.implementation.createHTMLDocument("")`. That document has no browsing context, so nothing in the copy loads, runs or upgrades.
  - In the copy it removes each sensitive descendant's `value` attribute and all its children, then serializes the copy.
- **List reads.** Both text field reads and column cell reads in `list-extraction.ts` now use `readableText`.

### X0.3, page side: empty lists fail (D4)

- **`content/actions/extract-list.ts`**
  - `minItems` defaults to 1. A finite number is truncated to an integer and floored at 0.
  - Validation expected text is now `at least N record(s), each carrying <fields>`.
  - A shortfall adds `fewer than the N required` to the actual text, beside any missing-field text. `success()` turns the failed validation into OUTPUT_NOT_OBSERVED.
- **`content/action-runtime/results.ts`**
  - `authGateFailure` checks a new `soughtSelector(action)`: for `web.dom.extract_list` that is `extractList.item`, for every other action it is `selector`.
  - An empty list on a sign-in gate therefore reports AUTH_REQUIRED.
  - The header comment and the function's doc comment are updated. The file is now 420 lines, up from 410.

### X0.4: de-duplicated append pagination

In `extractList`, a `Set<Element>` of items already read is kept across pages; an item in it is skipped. Truncation counts only unread items.

### X0.5, page side: item cap

- `EXTRACT_MAX_ITEMS = 1_000` mirrors the domain constant, with an agreement test.
- `maxItems = min(max(0, trunc(request.maxItems ?? EXTRACT_MAX_ITEMS)), EXTRACT_MAX_ITEMS)`.

### X0.6: `timeoutMs` is honoured

- `ListExtractionOutcome` gains `timedOut`.
- A deadline is set only for a finite, positive `timeoutMs`.
- The deadline is checked before `next.click()`.
- `waitForListChange` now returns `"changed"`, `"unchanged"` or `"timed_out"`. It waits until the earlier of the command deadline and `LIST_CHANGE_TIMEOUT_MS`, and when the command deadline ends the wait it returns `"timed_out"` instead of throwing.
- The verb passes `{ timeoutMs: action.timeoutMs }`. On `timedOut` it returns `deps.timedOut(...)` with:
  - message `Timed out extracting the list after N page(s).`
  - a failed validation whose actual ends `the time ran out before the list ended`
  - `extracted` holding the records read, plus a snapshot.

### Tests

- **New `content/actions/tests/extract.test.ts`** (node:test, fake dependencies, no DOM):
  - "a refused read is rejected as sensitive_value and carries no extracted"
  - "an allowed read succeeds with an evidence-only validation"
- **`action-runtime/tests/list-extraction.test.ts`**: "the item bound agrees with the domain's".
- **`e2e/content/tests/actions.spec.ts`**, three new cases on sensitive-input:
  - "extract: a sensitive control is refused in every mode": three controls × three modes, each asserting `web.action.rejected` / `blocked_by_capability_or_policy`, no `extracted` key, and no fixture secret anywhere in the reply. The ordinary email field is still read as the control.
  - "extract: a text read of a container skips the contents of sensitive controls inside it": uses a sensitive textarea, a sensitive select and an ordinary select injected with `page.evaluate`, and asserts the exact text.
  - "extract: an HTML read of a container removes sensitive descendants' value attributes and contents": asserts the stripped markup, and that ordinary values and options are kept.
  - The existing basic-form extract case is unchanged and green.
- **`e2e/content/tests/extract-list.spec.ts`**
  - The three existing `expected` strings are updated to the new wording.
  - New cases on product-catalog: "an item selector matching nothing fails with output_not_observed" (case a), "minItems: 0 lets an empty list succeed" (case b), and "timeoutMs: a read that outlasts it reports timed_out with the pages it read".
  - New on sensitive-input: "a field that resolves to a sensitive control refuses the whole read", and "a text field skips the contents of sensitive controls inside it" (injected markup).
  - New on auth-gate: "an empty list on a sign-in gate is auth_required" (case c).
  - New on basic-form: "an appending Next reads each item once" (injected feed plus a load-more control) and "an unbounded read stops at the domain's cap" (1,005 injected items).
  - The header comment is updated.

`execute.test.ts` compiles against the new `extractList` signature without edits and was not changed.

## Commands run and observed results

All commands ran from `F:\!FluxIQWebExtension`, one at a time, never beside another check, test, harness run or audit. Every harness run used `--workers=1`.

1. `pnpm --filter @fluxiq-web-extension/extension check` (first run): exit 0. `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json` printed nothing.
2. `EXTENSION_TEST_BUILD_LABEL=x0-page node apps/extension/scripts/test-extension.mjs`: exit 0, `# tests 516`, `# pass 516`, `# fail 0`. These rows were confirmed present and ok:
   - `ok 279 - a refused read is rejected as sensitive_value and carries no extracted`
   - `ok 280 - an allowed read succeeds with an evidence-only validation`
   - `ok 250 - the item bound agrees with the domain's`
3. `pnpm --filter @fluxiq-web-extension/extension test:content -- actions extract-list --workers=1` (first run): exit 1, 3 failed and 31 passed.
   - The failures were the three D2 container cases, each at its whole-reply scan line: `actions.spec.ts:258`, `:277` and `extract-list.spec.ts:340`.
   - The printed reply showed the `extracted` records correctly filtered. The injected strings came from the reply's **snapshot**: the textarea and select descriptors carried `text`/`visibleText`, and the wrapping labels carried `text`/`visibleText`/`accessibleName`.
   - The injected-string scans were narrowed to `reply.extracted`, with a comment naming the defect. The whole-reply scan for the fixture's own secrets stays.
4. The same harness command (second run): exit 0, `34 passed (11.7s)`.
5. Mutations. Each was applied alone, run with `--grep` for its case, then reverted.

   | # | Mutation | Command filter | Observed |
   | --- | --- | --- | --- |
   | M1 | delete the `isSensitiveFormControl` line in `extract.ts` | `actions --grep=sensitive.control.is.refused.in.every.mode` | exit 1, `1 failed`; expected `"status": "failed"` |
   | M3 | make `extractAction` ignore `ok: false` (`if (!read.ok && false)`) | unit tests | **run refused by the permission classifier ("Security Weaken")**; reverted and not retried |
   | M4 | `minItems` default 0 | `extract-list --grep=an.item.selector.matching.nothing` | exit 1, `1 failed`; validation `"passed"` instead of `"failed"` |
   | M5 | `soughtSelector` returns `action.selector` only | `extract-list --grep=sign-in.gate.is.auth_required` | exit 1; category `output_not_observed` instead of `auth_required` |
   | M6 | remove the `read.has` skip | `extract-list --grep=an.appending.Next.reads.each.item.once` | exit 1; `15 records from 3 pages` instead of 7 |
   | M7 | no page default (`maxItems` unbounded when absent) | `extract-list --grep=an.unbounded.read.stops.at.the.domain` | exit 1; `1005 records from 1 page` instead of 1000, truncated |
   | M8 | `deadlineFor(undefined)` | first `--grep=timeoutMs.a.read.that.outlasts.it` gave "No tests found" (my regex missed the `: `); rerun `--grep=a.read.that.outlasts.it.reports.timed_out` | exit 1; `"status": "succeeded"` instead of `"timed_out"` |
   | M10 | HTML read returns raw `innerHTML` | `actions --grep=an.HTML.read.of.a.container.removes` | exit 1; the stripped `<input name="password" ...>` substring was missing |
   | M2 | delete the `readField` sensitivity check | `extract-list --grep=a.field.that.resolves.to.a.sensitive.control` | exit 1; `"status": "succeeded"` instead of `"failed"` |
   | M9 | text read ignores sensitive descendants | `actions extract-list --grep=skips.the.contents.of.sensitive.controls` | exit 1, `2 failed`; both text cases received `SYNTHETIC_RECOVERY_NOTE`/`SYNTHETIC_ANSWER_LABEL` in the read |

   M1, M2, M9 and M10 weaken security checks, as M3 does, and their runs were not refused; the classifier was not consistent across them.
6. After the reverts, per-file Greps confirmed every guard line is back, with no `&& false`, `|| true`, `POSITIVE_INFINITY` or `deadlineFor(undefined)` left.
7. `pnpm --filter @fluxiq-web-extension/extension check`: exit 0.
8. The labelled unit tests (final run): exit 0; `# tests 516`, `# pass 516`, `# fail 0`; no "failed to load".
9. `git status --short -- apps/extension` lists only the ten owned files as modified and `actions/tests/extract.test.ts` as new.
   - `git diff --stat`: 10 files changed, 574 insertions and 68 deletions.
   - Tracked `apps/extension/build/` is unchanged, and nothing outside `apps/extension` is modified.
10. The harness command (final run): exit 0, `34 passed (11.2s)`.
11. `node scripts/structure-audit.mjs`: exit 1, "structure-audit: 1 violation(s) across 1 rule(s)".
    - The one failure: `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks. Run "pnpm structure:baseline" to regenerate it.`
    - Warnings among my files: `extract-list.spec.ts: 441 lines` and `results.ts: 420 lines`, both past the 400-line advisory and under 800.
12. After removing the unused `JsonValue` import, `pnpm --filter @fluxiq-web-extension/extension check` ran again: exit 0. The change is type-only, so the unit tests and harness were not rerun for it.

No crashes or uniform timeouts occurred; nothing needed a rerun for hardware reasons.

## Not verified

- **The unit-level mutation M3.** Its run was refused. The unit row is confirmed green with the code correct, but it was never observed red.
- **Column-cell refusal and column text filtering.** No fixture has a sensitive table cell or a sensitive control inside a cell, so no harness case or mutation covers these paths.
- **Browsers.** Firefox and a loaded unpacked extension were not tested. The container HTML filter relies on `document.implementation.createHTMLDocument` plus `importNode`, which was exercised only in the harness's Chromium, in the page's main world rather than an isolated world.
- **Repository-wide gates.** `pnpm check`, `pnpm test` and `pnpm build` were not run; only the extension package commands above.
- **Other quoters of the old wording.** The repo-wide grep for `every record carries` excluded `docs/`, and documentation is W7's to update.
- **Performance.** The read scan (`querySelectorAll("*")` on each text read) was not measured on large pages. The 1,005-item case ran inside an 11-second run.

## Open questions or contradictions found

1. **Security defect outside extraction (recommend a separate brief).**
   - The page snapshot attached to action replies quotes a sensitive control's contents:
     - a sensitive `<textarea>` descriptor carries its text as `text` and `visibleText`;
     - a sensitive `<select>` descriptor carries its selected option label the same way;
     - a `<label>` wrapping either carries that content in `text`, `visibleText` and `accessibleName`.
   - This was observed in the first harness run's printed reply (`extract-label-text`). The fields are produced in `apps/extension/src/content/describe-element.ts`: `visibleText` at :50-54, and `accessibleNameFor` at :75-76, which comes from `identity/`.
   - Value-attribute secrets (password and card inputs) are not affected. The snapshot's forms evidence does mark these controls `sensitive: true`.
   - This affects any reply carrying a snapshot on a page with such controls, not only extraction.
   - The three container specs scan the read for injected strings and note the defect. Once it is fixed, they can scan the whole reply again.
2. **The audit's `working-docs` failure.** `docs/working/README.md` drift is present in the committed tree and is outside this brief. It needs `pnpm structure:baseline` from the supervisor.
3. **Column cells (a judgement call beyond the report).**
   - The report's X0.1 says `readColumn` "is unchanged". D2 as amended says a text read of a container skips sensitive contents, and "refuses every read of a sensitive control ... list fields".
   - I applied both to column cells: a cell that itself carries the signature is refused whole, and a cell's text skips sensitive descendants.
   - Revert the cell refusal if column cells should stay exempt.
4. **Contradiction in `list-extraction.ts`.** The file's own comment says the content script "must not import the domain's runtime" and therefore mirrors `EXTRACT_MAX_PAGES`. But `results.ts` already value-imports from `@fluxiq-web-extension/domain/client`, and `list-extraction.ts` now does too (`webAutomationFailureRecord`, `WEB_AUTOMATION_FAILURE_CODES`). So the stated reason to mirror constants does not hold for the `/client` entry. I kept the mirror plus agreement test as specified (report open question 1).
5. **Wording choices (mine).**
   - Shortfall: `fewer than the N required`.
   - Timeout: actual `...; the time ran out before the list ended`, message `Timed out extracting the list after N page(s).`
   - `minItems: 0` reads `at least 0 records, each carrying ...`.
6. **Behaviours to be aware of.**
   - An `extract_list` that fails for any reason, a timeout included, while its item selector matches nothing on a sign-in gate now reports AUTH_REQUIRED. That is the same rule a selector action already follows.
   - A timed-out read reports `truncated: false`.
   - The `timeoutMs` deadline starts when the page capability starts, after the verb dispatches.
7. **Line endings.** Git warns "LF will be replaced by CRLF" for all ten modified files; the content is unaffected.
