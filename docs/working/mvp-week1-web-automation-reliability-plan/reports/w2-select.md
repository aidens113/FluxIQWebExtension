# Report: w2-select

Worker: `w2-select`. Brief: `### Brief: w2-select` in
[briefs/wave-2.md](../briefs/wave-2.md), coding against
[reports/w2-foundation.md](./w2-foundation.md).

## Outcome

**Done**, with one declared deviation: two minimal edits to
`apps/extension/e2e/content/tests/actions.spec.ts`, which is not in my owns
list. Its own header tells the Wave 2 verb workers to change these rows, and
one of them pinned exactly the behaviour I replaced. Detail in
[Deviations](#deviation-from-the-brief).

## What changed and why

### `apps/extension/src/content/actions/select.ts` (rewritten)

`selectAction` now selects by value, label, or index, and proves the select
ended up holding the option:

| Request | Behaviour |
| --- | --- |
| `option: { by: "value", value }` | first option whose `value` matches exactly |
| `option: { by: "label", label }` | first option whose visible label matches after whitespace collapsing |
| `option: { by: "index", index }` | the option at that position; a non-integer or out-of-range index matches none |
| `value: "..."` (no `option`) | treated as `by: "value"`, so a recorded change keeps working |

Four decisions worth knowing:

1. **Existence is checked before anything changes.** The old code assigned
   `element.value = action.value ?? ""`, which blanked the select when no
   option matched and still reported `succeeded` — the "unreliable" row the
   action audit recorded. A request that matches no option now touches nothing
   (no focus, no value write, no events) and reports a failed validation, which
   `deps.success()` turns into `status: "failed"` with Core's
   `output_not_observed`.
2. **Selection goes through `selectedIndex`, not `value`.** A request by label
   or index is never translated into a value that two options could share.
3. **The validation reads the value back from the element.** `expected` is
   `selected value "team" (label "Team")`, `actual` is `selected value "team"`.
   A page that reverts the choice in its own `change` handler therefore reports
   `failed`, not a silent no-op.
4. **A failed match says what the select does offer** — up to 20 options as
   `"value" (Label)`, then `and N more` — so a failure is diagnosable. All
   validation text still goes through `boundValidation`, so Core's parser
   cannot drop the record.

Two more non-selecting requests were previously impossible to distinguish from
a real selection, and now each report a failed validation and change nothing:
a target that is not a `<select>` (`actual: the target is a <input>`), and a
command that names no option at all.

The verb stays synchronous, uses only capabilities already on
`ContentActionDependencies` (`resolveTarget`, `describeElement`,
`captureSnapshot`, `dispatchInputEvents`, `success`), and calls **no** Wave 2
capability module — `checkActionability` and the rest still throw, so calling
one would have broken the verb.

### `apps/extension/e2e/content/tests/select.spec.ts` (new, 9 specs)

T2 on `basic-form`: by value (explicit and legacy), by label, by index; the
events the page observes plus a submit whose Scenario Lab final state proves
the plan reached the page's `FormData`; a missing value, a missing label, and
an out-of-range index; a non-select target; and a command naming no option.
Every failing row asserts the page is unchanged (`plan` still `starter`) as
well as the reply.

### Deviation from the brief

`actions.spec.ts`, two edits:

- the select row `"a value with no option still reports success and leaves
  nothing selected"` asserted `succeeded` and `toHaveValue("")`. It now asserts
  `failed`, `output_not_observed`, and `toHaveValue("starter")`. Leaving it
  would have failed `test:content`, which the definition of done requires.
- the header's clause naming select as unreliable, which is no longer true.

The first select row there (`"chooses the option and reports it on the
element"`) needed no change and was left untouched. Both edits were exact
string replacements, not a file rewrite, to survive the other workers editing
the same file concurrently.

## Commands run and observed results

All from `F:\!FluxIQWebExtension`, with `EXTENSION_TEST_BUILD_LABEL=w2-select`.
Every exit status was captured by redirecting to a file and echoing `$?`, never
through a pipe. `pnpm build` and every `pnpm lab` command were not run, per the
brief.

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/extension check` | `exit=0` |
| `pnpm --filter @fluxiq-web-extension/extension test:content` | `exit=0` — `40 passed (6.1s)`, including all 9 `select.spec.ts` rows and the two updated `actions.spec.ts` select rows |
| `pnpm --filter @fluxiq-web-extension/extension test` | `exit=0` — `# tests 72 / # pass 72 / # fail 0` |
| `node scripts/structure-audit.mjs` (scratch git index) | `exit=0` — `structure-audit: passed (31 warning(s), 19 baselined)` |

The audit ran with `GIT_INDEX_FILE` pointing at a scratch index built from
`git read-tree HEAD`, into which `select.spec.ts` and `select.ts` were staged
with `git add -N`; `git ls-files --cached` confirmed the new spec was visible
to it. The repository's own index was never written, nothing is staged, and
`pnpm structure:baseline` was not run. The warning and baseline counts are
identical to the ones w2-foundation observed (31 / 19), so this work added no
new warning.

Files changed: `apps/extension/src/content/actions/select.ts` (+113/-17
region), `apps/extension/e2e/content/tests/actions.spec.ts` (19 lines),
`apps/extension/e2e/content/tests/select.spec.ts` (new).

## Not verified

- **No live browser validation.** `test:content` runs the real content bundle
  in headless Chromium against a Scenario Lab fixture, but nothing loaded the
  unpacked extension in a headed browser, and no Lab run was made (the brief
  reserves `pnpm lab` for `w2-flow-lane`).
- **By label and by index are unreachable from the gateway today.** They are
  proven through the harness, which sends the command directly. Whether a Flow
  can express them depends on the `option` parameter reaching
  `WebAutomationActionCommand` through the domain schema and payload mapping,
  which is `w2-domain-vocabulary`'s file
  (`domain/src/output-nodes/payloads.ts` currently maps select's `value` only).
  I did not read or change that path beyond confirming the legacy `value` field
  still works.
- **The `output_not_observed` record may not reach the gateway yet.**
  w2-foundation reported that `gatewayActionResultFromBrowserResult`
  (`runtime/result-mapping.ts`) drops `result.failure`; that is
  `w2-browser-actions`'. I verified the record exists on the content-side
  result, not that it survives the wire.
- **No Node unit test for the verb.** A content module cannot be imported in
  `pnpm test` (`frame-geometry.ts` touches `window` at load — w2-foundation's
  finding 4), so `select.ts` is proven only by `test:content`.
- **Only `basic-form` was exercised.** A `<select multiple>`, an `<optgroup>`,
  duplicate option values, and a select inside a frame are untested; the
  implementation gives a multiple-select single-option semantics
  (`selectedIndex` clears the other selections).
- **A repository-wide `pnpm check` / `pnpm test` was not run**, nor the domain
  package: I changed no domain file.

## Open questions or contradictions found

1. **A disabled option is still selectable, deliberately.** `selectedIndex`
   will happily choose an option a user could not click. I did not reject it:
   the brief defines one failure mode for this verb (a missing option), and
   actionability belongs to `w2-click`'s capability, which today throws. If the
   supervisor wants a disabled option treated as absent, it is a two-line
   change in `findOption`, but it should be decided together with the
   actionability gate so the two do not disagree.
2. **Label matching is exact after whitespace collapsing** — not
   case-insensitive, not a substring. A recorded label that differs in case
   will report a missing option rather than guess. If Flows are expected to
   carry human-typed labels, a documented fallback may be wanted; I preferred
   determinism to a silent near-match.
3. **The recorded-confirmation path is already correct for this change, by
   reading.** `connection.ts:651` returns early unless
   `result.status === "succeeded"`, so a select that now reports `failed`
   emits no `dom.change` confirmation carrying the old value. I confirmed this
   by reading the call site, not by executing it — the file is
   `w2-browser-actions`-adjacent and not mine to test.
4. **`actions.spec.ts` is a shared file with no owner in Wave 2.** Every verb
   worker whose behaviour it pins has to edit it. Worth naming an owner, or
   moving each verb's rows into that verb's own spec, before Wave 3.
