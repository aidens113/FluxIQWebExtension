# t605 page-view-legends: worker report

Worktree `fxwork/t605/!FluxIQWebExtension`, branch `task/t605-page-view-legends`. Core was not touched and needs no
change. No model provider was called and no Lab was run.

## Outcome

Done. Both root causes from the A8 towels debug (`a8-towels-run-mv8p37k8-debug.md`, fixes 1-2) are fixed in the domain:

- A `<legend>` or `<caption>` now gets its own line in the compact page view.
- So do a `<label>` naming no control beside it, an `<a>` with no address, and an element whose role is `heading`,
  `tooltip`, `cell`, `gridcell`, `columnheader`, `rowheader`, `row` or `listitem`. All were lost the same way.
- Every element inside a `<fieldset>` carries its legend as a `group` field.
  - Control lines in the view end with `group="<legend>"`, and so do `web.find_on_page` matches.
  - `web.describe_element` prints `group` in its context.
  - `find_on_page` also matches by group words.

The new domain test reproduces the A8 defect at HEAD: 3 of its 4 tests fail with the old `elements.ts`, with the exact
"no legend line, no group" diff. All 4 pass with the fix.

## What changed and why

- **`domain/src/runtime/llm-evidence/elements.ts`**
  - **Fix 1.** `text` equal to the name is now kept for elements whose view words come only from `text`. The new private
    `wordsOnlyInText` covers these tags and roles:
    - tags `legend`, `caption`, `label`, `option`;
    - an `<a>` with no `href`;
    - roles `heading`, `tooltip`, `cell`, `gridcell`, `columnheader`, `rowheader`, `row`, `listitem`.
  - These are the extension's name-from-content tags and roles (`identity/accessible-name.ts`) minus the controls and
    `SEMANTIC_TAGS`. The view reads controls and semantic tags by name, so dropping `text` costs them nothing.
  - For these elements the extension sends only the element's own text nodes as `text`. Keeping that text duplicates no
    child's words.
  - I chose this over adding `legend`/`caption` to `SEMANTIC_TAGS`. A semantic element folds its descendants' lines (F1).
    But the extension sends a legend only its own words, so a legend such as `<legend>Size <small>(3)</small></legend>`
    would have lost the "(3)" line.
  - **Fix 2.** `elementPlacement` now reads `context.fieldsetLegend` (screened) into a new `group` field on
    `WebLlmEvidenceElement`. As with `heading`, `group` is dropped where it equals the element's name or text, so a legend
    has no group of its own. The `EvidenceElementPlacement` projection names the field.
- **`page-view/element/group-token.ts`** (new, exported through the `element` barrel): `webLlmGroupToken` builds the
  `group="…"` token.
- **`page-view/line/render.ts`**: control lines append the group token after the state tokens. Text lines do not carry it.
- **`page-find/search.ts`**:
  - `matchOf` searches `group` right after the element's own words, before value, options, href and attributes.
  - A control's match line and near-match line print `group="…"` before the "where" part.
  - When a control matched through its group, the `(group=…)` window is not printed a second time.
  - A non-control matched through its group shows the usual `(group="…")` window.
- **`page-find/description.ts`**: unchanged. Its context line prints every packet field, so `group="Format"` appears there
  automatically.
- **`look-alikes.ts`**: `group` is now part of the look-alike description. The type is exhaustive, so the compiler
  required it, and it tells apart two options with the same words in different groups.
- **`state-digest/state-digest.ts`**:
  - `group` is digested beside `heading`. The exhaustive `Record<keyof …>` forces the key in either case.
  - Version bumped `web-state.v4` -> `web-state.v5`. Adding a key changes every digest string, and the file's own rule
    says a change to what is digested must not read as a change of state.
  - Updated the 5 version regexes in `state-digest/tests/{state-digest,call-state-digests}.test.ts`.
- **`system-instructions/instructions.ts`**:
  - Version `web-8` -> `web-9`.
  - Added one generic sentence to the reading paragraph: `group="..." ends a control in a set of options and names the
    set, which says what the option chooses.` It mentions no site, task or product.
  - The test now expects `web-9` and lists `group=` among the printed terms. The text stays under its 3,600-character
    test bound, and that test passes.
- **`tests/present.test.ts`**: the exhaustive `present<WebLlmEvidenceElement>` literal gained `group: undefined`.
- **Wire and protocol**:
  - No protocol type changed. `DomElementContext.fieldsetLegend` already exists in `apps/extension/src/shared/dom-element.ts`
    and `domain/src/actions/types.ts`.
  - The extension already collects it (`identity/context.ts`) and the background already passes `context` through.
  - Only the domain's model-facing packet and its printed forms changed. Schema versions `web-llm-page.v3`,
    `web-llm-find.v1` and `web-llm-describe.v1` were not bumped, because the field is additive, as `heading` was.
- **`docs/architecture/page-evidence.md`** (compact page view section):
  - Lists the elements that keep text equal to their name.
  - Adds the line format's trailing `group="…"` and where it comes from.
  - Notes that find matches and prints group, and that describe prints it.
  - The digest is now `web-state.v5` (the doc said `v3`), and the system instructions are `web-9` (the doc said `web-1`).

New tests:

- `page-view/tests/fieldset-legends.test.ts` runs a raw capture through the sanitizer into the published page.
  - A two-fieldset sidebar (Format, Language): each legend line comes before its options, and each checkbox ends with
    `group="…"`.
  - A table caption gets its line.
  - A `role="heading"` div and a lone `<label>` keep their words.
  - A label wrapping its checkbox still folds (F2): the option's words appear once.
- `page-find/tests/groups.test.ts` runs a raw capture through the sanitizer into describe and find.
  - The option's describe context has `group="Format"`.
  - The legend's context has `text="Format"` and no group.
  - Finding "format" returns the legend, the option (with `group="Format"`, matched by group ahead of its
    `value="format:audiobook"` attribute) and a span in the group (with the `(group="Format")` window).
  - Finding "audiobook" prints the option with its group.
- `tests/elements.test.ts` gained two sanitizer tests: `group` is published (and absent on a legend and outside a
  fieldset), and the text-kept rule holds for each tag and role while a button, a link and an `h2` still drop it.

Existing page-view tests needed no change. The end-to-end realistic page's `<label>"Search in"` now keeps its text, and F2
still folds it beside its select.

## Commands run and observed results

All commands ran in the worktree; domain tests used `DOMAIN_TEST_BUILD_LABEL=t605`.

| When | Command | Result |
| --- | --- | --- |
| Baseline, before edits | `node scripts/test-domain.mjs runtime/llm-evidence` | 1105 tests, pass 1105, fail 0 |
| After the source edits | same | 1105 tests, pass 1097, fail 8. All 8 were `web-state.v4` regexes meeting `web-state.v5:...`, fixed as above. |
| Proof of the defect | Swapped `elements.ts` back to `git show HEAD:...` and ran `node scripts/test-domain.mjs page-view/tests/fieldset-legends`, then restored my version | pass 1, fail 3; the diffs showed no `"Format"`/`"Language"` lines, no `group=`, no caption line, no role-heading or label line |
| Final | `node scripts/test-domain.mjs runtime/llm-evidence` | 1114 tests, pass 1114, fail 0 |
| Out-of-directory consumers | `node scripts/test-domain.mjs` with the out-of-directory consumers of the packet: `runtime/llm-evidence client/interrupted-action/tests extraction/tests/structure-detection io/tests/gateway-output-dispatcher-cleared-layers output-nodes/extract-list/tests/catalog-text output-nodes/tests/definitions output-nodes/tests/model-facing-catalog page-evidence/tests runtime/facts/tests runtime/route-state runtime/state-diff runtime/tests ...` | 1354 tests, pass 1354, fail 0. This ran before the system-instructions edit. |
| Final | `node scripts/test-domain.mjs tests/domain.test tests/page-evidence-joinery` | 16 tests, pass 16, fail 0 |
| Final | `npx tsc -p tsconfig.json --noEmit && npx tsc -p tsconfig.test.json --noEmit` (domain) | exit 0, no output |
| Final | `node scripts/check-extension.mjs` (apps/extension: both tsc projects plus an in-memory bundle of every entry) | exit 0 |
| Final | `pnpm structure:check` | `structure-audit: passed (194 warning(s), 639 baselined).` |

## Not verified

- **No live browser check.** It is not verified that the extension's real capture of the bigbox sidebar carries
  `fieldsetLegend` on each checkbox and sends a legend's `visibleText` equal to its `accessibleName`. The tests use raw
  captures shaped from the debug report's description of `describeElement`.
- **Extension guard spec not run.** `apps/extension/e2e/content/tests/evidence/tests/page-view-controls.spec.ts` is a
  Playwright spec that runs on the ten scenarios.
- **Full suites not run.** That covers `pnpm check`, `pnpm test` and the extension unit tests, per the full-suites rule.
- **No Lab run.** Whether a model now picks the Retailer filter is unverified.
- **Token cost not measured.** Every control in a fieldset now carries a `group="…"` token, plus the new legend, caption
  and label lines. I did not measure the change in view size.

## Open questions or contradictions found

- **Two version bumps the supervisor should know about** before committing:
  - **`web-state.v5`.** Saved preconditions carrying `web-state.v4` digests no longer compare equal. Any key added to the
    element changes every digest, so the bump only makes that visible. The earlier `readable`/`cursor` additions changed
    digests without a bump.
  - **`web-9` system instructions.** Two sentences about `group=` are model guidance; revert them if model-text changes need
    separate sign-off.
- **ARIA groups are not covered.** Only `<fieldset>/<legend>` groups are published. Many real sites draw filter groups as
  `role="group"` or `radiogroup` with `aria-labelledby`, and those still give no `group`. Covering them needs
  `identity/context.ts` and `DomElementContext` to collect the group's accessible name, which is a protocol-type change I
  did not make.
- **Fingerprints left alone.** `packet-fingerprint/from-packet.ts` still does not put `group` into a built step's saved
  identity as `context.fieldsetLegend`, while a recorded step's identity does (`output-nodes/targets/targets.ts:344`). I
  left identity alone because it changes saved targets; it would make built and recorded identities agree.
