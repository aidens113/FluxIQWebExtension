# Report: w2i-capability-docs

Worker: `w2i-capability-docs`. Wave 2 integration, documentation only. Brief:
rewrite `docs/architecture/web-capabilities.md` against the code as it stands
after Wave 2, and correct the page-scheme sentence in
`docs/architecture/extension-client.md`.

## Outcome

**Done.** Both documents describe current behaviour. Every row of the matrix was
rewritten and every claim was checked against the file the row names, reading
the source rather than trusting the reports. `check` and the structure audit are
clean, and no working document was touched.

The headline change is that **no row is `Unsupported` or `Unreliable` any more**:
14 of 24 are fully supported, 10 partially, and each partial row names exactly
what is missing. The brief said the matrix was "substantially wrong"; it was
wrong in all 24 rows, not only the ones the reports flagged.

## What changed and why

### `docs/architecture/web-capabilities.md` — rewritten

Columns and the state vocabulary are unchanged, as the brief required. What
changed:

- **All 24 rows.** Every state, "Outcome validated" cell, "Represented as",
  "Owning files" and "Why this state" was rewritten from source. The three
  `Unreliable` rows (click, keypress, select) and the ten `Unsupported` rows are
  gone; seven rows are now carried by the new action types, and the rest by the
  actionability gate, the keyboard capability, the wait conditions, and the
  navigation comparison.
- **Summary table** recomputed: 14 fully / 10 partially / 0 unreliable / 0
  unsupported, 24 represented, 24 executed, 22 outcome-validated (the two
  extract rows only observe and declare `validation: none`, reason
  `evidence-only`).
- **"How An Action Runs"**: eleven action types became eighteen, the parameter
  lift through `gateway-action-parameters.ts` is described, and the fact that
  `web.browser.tab` and `web.browser.download` run in the worker *before* a tab
  is resolved — and that frame routing now works — is recorded.
- **Safety**: six safe (the two waits, extract, capture_snapshot, assert,
  extract_list), twelve review.
- **Recorded actions**: seven inputs became eight (`web.user.checkbox_toggled` →
  `web.dom.check`), with the checkbox nuance below, and the new rule that a key
  press on a `<select>` whose only effect is the value change stays evidence.
- **"Results And Failures"** rewritten: it previously said `success()` never
  reads the page back and that nothing produces `timed_out`. Both are now false.

### `docs/architecture/extension-client.md` — two corrections

- The "warns when the active page cannot be recorded" bullet now records that
  one rule (`runtime/unsupported-page.ts`) answers the question for recording
  and automation alike, that the recording path only restates its reason in the
  panel's wording, and that the eight URL classes the old `://`-requiring
  pattern let through are now refused: `about:`, `view-source:`, `data:`,
  `devtools:`, `javascript:`, and the Chrome, Edge and Firefox galleries.
- The Action Surface list said "deliberately small" and named eleven types. It
  now names all eighteen and states which three run in the background worker.

### The two rows that most needed the source, not a report

- **`web.dom.check` and recorded checkboxes.** `w2-domain-vocabulary` flagged
  that the recorder never reports a checkbox's checked state; that is still true
  in the code (`content/describe-element.ts` sets no `checked` field and its
  attribute allowlist has no `aria-checked`). So a recorded checkbox toggle
  stays evidence, while a **radio** maps to `checked: true` and is executable
  (`recordedCheckedState` in `domain/src/output-nodes/payloads.ts`). The row says
  exactly that rather than claiming the capability is recorded.
- **`web.dom.dialog` on Firefox.** `world: "MAIN"` is honoured from Chrome 111
  and Firefox 128, but `manifest.firefox.json` still declares
  `strict_min_version: "109.0"`, so on Firefox 109–127 the override lands in the
  isolated world and every dialog action fails as `dialog_override_missing`. The
  row states it; this is a real product gap, not a documentation one.

## Commands run and observed results

Exit status was captured by redirecting to a file and echoing `$?`, never
through a pipe. No `pnpm build`, no `pnpm lab`, no `pnpm structure:baseline`.

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/extension check` | `check_exit=0`, no diagnostics |
| `node scripts/structure-audit.mjs` (scratch `GIT_INDEX_FILE`) | `audit_exit=0` — `structure-audit: passed (31 warning(s), 19 baselined)`, `FAIL_count=0` |
| `node scripts/structure-audit.mjs`, re-run on the final tree | `audit_exit=0` — same line, `FAIL_count=0` |

The audit reads only tracked files, so the tree was staged into a scratch index
(`cp .git/index <scratch>; GIT_INDEX_FILE=<scratch> git add -A`), leaving the
real index untouched. It was re-run after a last cosmetic edit to one table cell
so the number reflects the final tree. `check` was not re-run after that edit:
it changed markdown only, which `tsc` does not read.

**Row count:** the matrix has exactly 24 data rows (`grep -c "^| "` over the
section returns 26 = header + separator + 24).

**No working document was touched.** My two files are stamped 18:09; the newest
file anywhere under `docs/working/` is 18:03:30, before my first write. The 22
entries `git status -- docs/working` reports are other workers' reports and the
supervisor's own edits, which I only read.

## Not verified

- **Nothing was executed.** This is a documentation change; `check` and the
  audit prove the tree still compiles and conforms, not that any row's claim
  holds at runtime. Each row was verified by reading the named file, which is
  the strongest evidence available to a documentation brief.
- **Three rows describe code no test has ever run**: Open tab, Switch tab, and
  Close tab, plus the download wait loop. `chrome.tabs` and `chrome.downloads`
  do not exist in the Node runner and no harness covers the background worker
  (`w2-browser-actions` says the same). The rows state this.
- **Browser-specific claims are read, not observed**: the Firefox 109–127 dialog
  gap, and that Chrome honours the `world: "MAIN"` manifest entry at all —
  `w2-upload-dialog` recorded that the harness injects the bundle instead.
- **I did not run** `pnpm test`, `test:content`, the domain or packages suites,
  or the root gates; the brief scopes me to `check` and the audit.
- **The 30-day plan's capability list** was taken from the existing matrix's own
  24 rows. I did not read the plan (the brief does not name it), so the row set
  is inherited, not re-derived.

## Open questions or contradictions found

### Rows where the code disagreed with a worker report

The brief asked for these specifically. In every case the report was true when
written and a later Wave 2 worker changed the answer; the matrix follows the
code.

1. **Select, by label and by index.** `w2-select` recorded them as "unreachable
   from the gateway today", pending the `option` parameter reaching the command.
   It now does: `option` is in the schema (`domain/src/actions/schemas.ts`), on
   the output node, and lifted by `domain/src/client/gateway-action-parameters.ts`.
   A Flow can author all three forms. (Landed by `w2i-gateway-params`.)
2. **Select, disabled options.** `w2-select` open question 1 said a disabled
   option is "still selectable, deliberately". `content/actions/select.ts` now
   rejects `option.matches(":disabled")` with the shared `disabled` code.
   (Landed by `w2i-actionability`.)
3. **The failure record reaching the gateway.** `w2-waits`, `w2-check-assert`,
   `w2-select` and `w2-extract-list` each recorded that
   `gatewayActionResultFromBrowserResult` drops `result.failure`, so their
   `timed_out`, STATE_MISMATCH and `output_not_observed` records were proven
   only at the content-script boundary. `runtime/result-mapping.ts` now forwards
   `failure` and gives every non-succeeded status its message as `error`.
4. **The `downloads` permission.** `w2-browser-actions` said it was "still absent
   from all three manifests", so `web.browser.download` would always take the
   capability-refusal path. It is present in `manifest.chrome.json`,
   `manifest.firefox.json` and `manifest.e2e.json`. (Landed by
   `w2-upload-dialog`.)
5. **The runtime barrel.** `w2-browser-actions` open question 7 said
   `runtime/index.ts` was not edited and nothing outside `src/runtime/` imports
   the new modules. It now exports `./unsupported-page`, and
   `background/connection/browser-state.ts` imports it — which is the whole
   basis of the `extension-client.md` correction. (Landed by
   `w2i-unowned-defects`.)
6. **The dead wait dependencies.** `w2-waits` open question 4 called
   `deps.waitForElement` and `deps.waitForText` "dead weight". They are gone from
   `ContentActionDependencies` entirely (`content/actions/types.ts` carries
   `waitForCondition` only), but `waitForElement` and `waitForText` are still
   exported from `content/action-runtime/waits.ts` and no verb calls them. The
   dead code is in the module, not in the dependency contract.
7. **How stale the matrix actually was.** `w2-browser-actions` named five stale
   rows and `w2-waits` called the waits row "understated". All 24 were wrong.
   Worth noting because the phase exit check reads this matrix: a worker's view
   of the document is bounded by its own files.

### Two things the documentation cannot fix

1. **`web.dom.check` has no runtime confirmation.**
   `runtimeConfirmationForActionResult` (`background/connection/runtime-status.ts`)
   covers seven of the eight action inputs and returns `undefined` for
   `web.dom.check`, so a replayed check produces no recording event. Recorded in
   the matrix; it needs an owner.
2. **The checkbox recording gap is now load-bearing.** `web.dom.check` exists,
   is registered, and is executable for radios only, because no producer emits a
   checkbox's state. Adding `checked` to `DomElementDescriptor` and
   `describeElement` — or `aria-checked` to the attribute allowlist — would make
   the input executable with no other change, since `recordedCheckedState`
   already reads both.
