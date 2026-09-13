# g-recorder-signals — B5, a checkbox's state and a landmark's name

Worker `g-recorder-signals`, 2026-09-12/13, at `HEAD 147fdb4`. The first attempt
stopped Blocked on a brief defect: the file list was drawn around individual files
rather than around the change. This report is the run under the amended brief. No
`pnpm build`, no Lab run, no commit. Build label `g-recorder-signals` throughout.

## Outcome

**Done.** A checkbox's or radio's `checked` state and the name of the landmark
around an element are now recorded. Both travel through every step: the element
description, the protocol type, the payload sent to the gateway, and the domain
target. A real page in the content harness proves the whole path.

As decided, a sensitive checkbox or radio withholds `checked` in two places: when
it is recorded and when it is sent. Each place has a failing-row mutation proof.

Six things to read first:

1. **This changes which Flows are generated.** A recorded `change` on a checkbox
   was already mapped to `web.dom.check`. The domain used to keep it as evidence
   only, because `checked` never arrived: `domain/src/io/input-model.ts:181-184`
   says "Until the recorder reports the state … the toggle stays evidence".
   `output-nodes/payloads.ts:108-115` reads `element.checked`, and the recorder now
   reports it. So **a recorded checkbox toggle is now an executable
   `web.dom.check` step**, carrying the state the box was left in. This is B5's
   "recorded toggle is unreplayable" half, landing. Any Lab expectation that counts
   executable steps on a page with checkboxes may move. That comment in
   `input-model.ts` is now stale, and the file belongs to `g-domain-mapping`.
2. **A sensitive checkbox's toggle still stays evidence**, by design. With no
   `checked`, `payloads.ts` produces no state and `hasExecutableParameters`
   refuses it. The spec asserts this.
3. **The recorder's `dom.click` carries the state from before the click.**
   `content/dom-events.ts:43-62` describes the element on `pointerdown`, before the
   browser flips the box. The `change` (`:93-106`) fires after the flip. I measured
   this rather than assumed it: my first version of the end-to-end row followed the
   click and failed with `Expected: false, Received: true`. The row now follows the
   `change`, which is the event the domain maps to `web.dom.check`. Nothing scores
   `checked` on a click, so this is harmless today. I did not change the recorder.
4. **The landmark name is read in the ARIA order, not the brief's.** The brief
   says "`aria-label`, then `aria-labelledby`". The accessible-name calculation
   takes `aria-labelledby` first, and so does this repository's own
   `identity/accessible-name.ts:32-39`. I followed the specification: referenced
   text, then `aria-label`, then `title`. I added `title` because `hasAuthoredName`
   already accepts it as what makes a `<section>` or `<form>` a landmark, so a
   landmark named only by `title` now reports that name. Reverse either choice if
   you disagree; it is a three-line function.
5. **The landmark name has its own reader, not `accessibleNameFor`.** It is
   deliberately stricter. `context` is kept on every control, a password field
   included (`gateway-payloads.ts` doc). So an `aria-labelledby` reference to a
   form control or an editable region contributes nothing, and no typed text can
   become a landmark name. A unit row asserts this.
6. **Extension `check` is currently red, and not from this change.** The last two
   runs exit 2 with three errors, all in files another brief is editing right now:
   `domain/src/client/gateway-mapping.ts:21,152` and
   `domain/src/runtime/failure/codes.ts:123`, both `g-domain-mapping`. tsc listed
   no error in any file this brief owns. Earlier runs on this tree, before those
   edits, passed: domain `check` and extension `check` both exit 0.

## What changed and why

| File | Change |
| --- | --- |
| `apps/extension/src/shared/protocol.ts` | `DomElementDescriptor.checked?: boolean`; `DomElementContext.landmarkName?: string`. `WireElementTarget` derives from the descriptor, so `checked` joins the wire contract with no second declaration |
| `apps/extension/src/content/describe-element.ts` | New private `checkedState`: only `input[type=checkbox\|radio]`, and `undefined` for a control `isSensitiveFormControl` marks. It follows the same rule as `readElementValue` |
| `apps/extension/src/content/identity/context.ts` | `nearestLandmark` returns the element as well as the role. New `landmarkName` and `labelledByText` read through `ownerDocument`, bounded (8 ids, 200 characters), skipping form-control and editable targets. `landmarkName` is written into the existing `present<DomElementContext>` literal, so deleting the key is a compile error |
| `apps/extension/src/background/connection/gateway-payloads.ts` | `checked: secret ? undefined : element.checked` in the `present<WireElementTarget>` literal. The doc says which fields a sensitive control withholds; `context` (which now includes the landmark name) passes through whole |
| `domain/src/actions/types.ts` | `WebAutomationElementContext.landmarkName`; `WebAutomationElementFingerprint.checked` |
| `domain/src/output-nodes/targets.ts` | `checked: booleanValue(element.checked)` in the fingerprint, `landmarkName: stringValue(...)` in the context, and a private `booleanValue`. `false` survives; `"true"` does not. Doc updated |
| `apps/extension/src/shared/tests/present.test.ts` | `landmarkName: undefined` in all four `present<DomElementContext>` literals, so the `@ts-expect-error` rows still name exactly one defect each |
| `apps/extension/src/content/identity/tests/context.test.ts` | The stub gains `parentElement`, `ownerDocument` and `isContentEditable`. Five rows: an `aria-label` name with key order; references in listed order, beating `aria-label`; a missing reference falling back to `aria-label`, then `title`; control and editable references naming nothing, with no typed text in the output; an unnamed landmark having no name key |
| `apps/extension/src/background/connection/tests/gateway-payloads.test.ts` | `"checked"` added to `WIRE_ELEMENT_FIELDS`, and `checked` plus a landmark name added to `fullyDescribed`. Three rows: both fields reach the wire (unchecked included); both survive a JSON round trip into `elementFingerprint`; a sensitive checkbox sends no `checked` and keeps its landmark name |
| `domain/src/output-nodes/tests/targets.test.ts` | `landmarkName` added to `recordedContext`. Three rows: `checked` survives into the fingerprint and the dispatched target, `false` included; a non-boolean `checked` is dropped; the landmark name reaches the dispatched target and a non-string one is dropped |
| `apps/extension/e2e/content/tests/identity-signals.spec.ts` (new) | Markup injected into the `ambiguous-targets` page. Four rows: the recorder describes `checked` for a checkbox and a radio and for nothing else; it names the landmark by reference and by `aria-label`; a sensitive checkbox is described without state, and its check step has none; a real recorded toggle's `dom.change` maps to `checkboxToggled`, becomes `web.dom.check` with `checked` equal to the page's state, and the dispatched element carries `checked` and `landmarkName` |

`.structure-baseline.json`: no entry should change. The audit flags `protocol.ts`
(now 446 lines) and `actions/types.ts` (now 431) past the 400-line advisory. Both
were already past it and neither is baselined.

## Commands run and observed results

Exit codes were captured by redirecting output into scratchpad files, never
through a pipe.

- `pnpm --dir domain check` → `exit=0`.
- `pnpm --dir apps/extension check` → `exit=0`. It includes `e2e/**/*.ts`; this was
  the first version of the spec.
- `DOMAIN_TEST_BUILD_LABEL=g-recorder-signals pnpm --dir domain test` → `exit=0`,
  `# tests 352 # pass 352 # fail 0`, including the three new `targets.test.ts` rows
  (ok 88-90).
- `EXTENSION_TEST_BUILD_LABEL=g-recorder-signals pnpm --dir apps/extension test` →
  `exit=0`, `# tests 323 # pass 323 # fail 0`.
- **Mutations of `gateway-payloads.ts`.** The original SHA-256 is
  `EFA03AA7…F4D96B`. The file was restored from a byte copy after each run, and
  every restore reported `restored-byte-identical=True`.
  - **M1, `checked: undefined`:** test `exit=1`, `# fail 3`.
    - `not ok 66 - the wire element target carries every field …` (`-   'checked',`)
    - `not ok 72 - a checkbox's checked state and its landmark's name reach the wire, unchecked included`:
      `false is a state, not an absence … + undefined - false`
    - `not ok 73 - both survive into the element the recording's Flow node replays against`
  - **M2, `context: element.context && { ...element.context, landmarkName: undefined }`:**
    test `exit=1`, `# fail 5`.
    - `not ok 67 - every identity signal the protocol declares reaches the wire`
    - `not ok 69 …`
    - `not ok 72 …`: `+   landmarkName: undefined -   landmarkName: 'Billing details'`
    - `not ok 73 …`
  - **M3, `checked: element.checked` (sensitive-control gate removed):** test
    `exit=1`, `# fail 1`.
    - `not ok 74 - a sensitive checkbox sends no checked state, and keeps its landmark's name`:
      `a sensitive checkbox's state is its contents … expected: false actual: true`
  - **M5, `checked` key deleted:** `check` `exit=2`.
    - `src/background/connection/gateway-payloads.ts(123,37): error TS2345: Argument of type '{ selector: string; … }' is not assignable to parameter of type 'RequiredFields<WireElementTarget> & OptionalFields<WireElementTarget>'.`
  - Final `final sha256 matches original: True`.
- **Content harness.** Every run used
  `pnpm --dir apps/extension exec playwright test -c e2e/playwright.content.config.ts --workers=2 <spec>`.
  - `identity-signals.spec.ts`, first version → `exit=1`, 3 passed and 1 failed.
    The row that followed `dom.click` got `Expected: false, Received: true` at
    `:107`. This was a real finding (item 3 above), not the RAM fault; the row was
    rewritten to follow `dom.change`.
  - `identity-signals.spec.ts`, final → `exit=0`, `4 passed (2.9s)`.
  - **M4 (the capture-side sensitive gate):** `describe-element.ts`
    `return isSensitiveFormControl(element) ? undefined : element.checked;` →
    `return element.checked;`, then the same spec → `exit=1`, `1 failed, 3 passed`:
    `Error: the recorder withholds a sensitive control's state … Expected: false Received: true … > 100 |`.
    Restored, `restored-byte-identical=True`.
  - `identity-resolution.spec.ts` (run, not edited) → `exit=0`, `14 passed (3.8s)`.
- **Structure audit** with the new spec staged in a scratch `GIT_INDEX_FILE`, placed
  under the ignored `apps/extension/.test-build-scratch/` and deleted afterwards →
  `exit=1`. The one violation is not in this brief's files:
  `FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks`.
  The file-line warnings are listed above.
- `pnpm --dir apps/extension check` after the spec rewrite → `exit=2`, and again on
  the one rerun → `exit=2`. The same three errors both times, all in
  `g-domain-mapping`'s modified files: `domain/src/client/gateway-mapping.ts(21,10)`
  TS2724, `(152,8)` TS2552, and `domain/src/runtime/failure/codes.ts(123,14)`
  TS2741. None was in a file this brief owns.

## Not verified

- **Extension `check` at the final state of this brief's files.** The final spec
  was compiled only by the two red runs above. tsc reported every error in the
  program and none was in my files, but a green `check` needs `g-domain-mapping`
  to land first. The supervisor should rerun it.
- **Domain `check` and both unit suites were not rerun after the spec rewrite.**
  The rewrite touched no unit-test source, and every mutation was restored byte
  for byte.
- **Not the whole content harness**, only the two specs above. Firefox not run.
- **No live extension.** The harness loads the content bundle into Chromium
  without an extension, so the real background worker's path to Core is not
  exercised.
- **A Lab run must show:**
  - a recording that toggles a checkbox (for example storefront-checkout's terms,
    if it has one) yields an executable `web.dom.check` whose `checked` matches
    the page;
  - a sensitive checkbox's toggle does not become an executable step;
  - an `ambiguous-targets` recording's element context carries both `landmark`
    and `landmarkName` wherever the page names its panels;
  - any corpus count of executable actions on a checkbox page, re-read against
    item 1 of the Outcome.
- **W26 will not move from this change.** It needs Core (below).

## What W26 still needs from Core (not edited)

- **Core cannot score either signal.** `ElementFingerprintWeights`
  (`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\fingerprinting\element-fingerprint.ts:54`)
  has no state signal, no landmark signal and no context signal.
- **The extension's scorer doesn't send them either.**
  `content/identity/score.ts:187-200` `comparableFingerprint` sends Core only
  `visibleText`, `accessibleName`, `label`, `id`, `testId`, `tagName`, `role`,
  `selector` and `classNames`. That file is not this brief's (`g-resolver-corroboration`).
- **W26 is the negative row** (`bench/corpus/week1.ts:51`, `ambiguous-targets` /
  `no-context`): two `Continue` buttons with the test id removed. To separate the
  `form-context` twin, Core must add a context signal to both `ElementFingerprint`
  and `ElementFingerprintWeights`: landmark role plus name, and form or fieldset.
  It needs a weight and a mismatch penalty. `comparableFingerprint` must then send
  it.
- **`checked` is replay state, not identity.** Core does not need to score it.

## Open questions or contradictions found

- **Landmark-name order and the `title` fallback** differ from the brief's wording
  (Outcome item 4). Please confirm.
- **`input-model.ts:181-184` is now stale** ("Until the recorder reports the
  state"). It belongs to `g-domain-mapping`.
- **`payloads.ts:112-114` reads `attributes["aria-checked"]` for custom toggles,**
  but the recorder's attribute allowlist (`describe-element.ts:95`) has no
  `aria-checked`. A `role="switch"` or `role="checkbox"` widget therefore still
  records no state. Adding the attribute is a one-word change in a file this brief
  owns, but it is outside B5's checkbox-and-radio scope, so I left it.
- **Clicks are recorded twice.** `dom.click` is emitted from both `pointerdown`
  and `click` (`dom-events.ts:43`, `:64`). For a toggle the two descriptors
  disagree on `checked`. Whether the background worker's click filter keeps the
  first is outside this brief; any future consumer that reads `checked` off a
  click will see the state from before it.
- **Scratch files.** The first attempt's compile probes are in the session
  scratchpad on C:, outside the repository. This run's scratch git index and audit
  output were under the ignored `apps/extension/.test-build-scratch/` and were
  deleted.
