# Report: w2-domain-vocabulary

Worker: `w2-domain-vocabulary`. Brief: `### Brief: w2-domain-vocabulary` in
[briefs/wave-2.md](../briefs/wave-2.md), coding against
[reports/w2-foundation.md](./w2-foundation.md).

## Outcome

**Done.** Domain `check` and `test` (label `w2-domain-vocabulary`) both pass,
and the structure audit is clean with my new files staged. The extension
`check` fails, but only inside files owned by other Wave 2 briefs that are
mid-edit — zero errors in `domain/src` across four runs. Detail in
[Commands](#commands-run-and-observed-results).

Two things the supervisor has to route to someone, because neither is in my
owns list and no Wave 2 brief currently claims them:
[the gateway command lift](#1-the-new-parameters-never-reach-the-command-unowned-file)
and [the recorder's missing checked state](#2-the-recorder-never-reports-a-checkboxs-checked-state).

The registry total is intact, as the brief required: **18 action types, 18
definitions, 18 output nodes, 18 manifest outputs**, unchanged. I refined the
seven existing minimum definitions rather than creating any. I did add one
registered *input* — see [open question 3](#3-i-added-one-registered-input-not-an-output).

## What changed and why

### The shape rule everything follows

Each parameter is named and shaped as the field of `WebAutomationActionCommand`
it becomes. The alternative — flat domain parameters reshaped into the command
somewhere in the middle — means two shapes for one wire contract and a reshape
layer to keep in sync, which is the drift `AGENTS.md` forbids ("keep
wire-protocol changes synchronized across shared protocol types, background
routing, domain gateway mappings").

It also has a concrete payoff today. `webAutomationActionFromGatewayCommand`
sets `options: parameters`, so a nested `parameters.assert` already arrives at
the content script as `action.options.assert`, *exactly* the
`WebAutomationAssertRequest` the verb was typed for. Had I made the schema flat
(`kind`, `expected`), the content script would receive `options.kind` and match
nothing w2-foundation typed.

### `domain/src/actions/schemas.ts`

Refined the seven minimum definitions, and added the parameters D6 gave the
original eleven. Shared sub-schemas (`waitSchema`, `keyModifiersSchema`,
`optionSelectorSchema`, `scrollRequestSchema`, `assertSchema`,
`extractListSchema`, `uploadSchema`, `dialogSchema`, `tabSchema`,
`downloadSchema`) each mirror one command type.

| Action | Required | Parameters |
| --- | --- | --- |
| `web.dom.check` | `selector` | `checked`, target, `timeoutMs` |
| `web.dom.assert` | `assert` | `assert{kind,expected,timeoutMs}`, target |
| `web.dom.extract_list` | `extractList` | `extractList{item,fields,paginate{next,maxPages},maxItems}` |
| `web.dom.upload` | `selector`, `upload` | `upload{files[{name,mimeType,contentBase64}]}`, target |
| `web.dom.dialog` | `dialog` | `dialog{response,promptText}` |
| `web.browser.tab` | `tab` | `tab{operation,url,active,tabId,urlPattern}` |
| `web.browser.download` | — | `download{filename,timeoutMs}` |

Upgrades to the eleven: navigate `newTab`; select `option`; scroll `scroll`
**and an element target** (`toElement` has to have something to scroll to);
keypress `modifiers`; both waits `wait`. `maxPages` is bounded by the domain's
own `WEB_AUTOMATION_EXTRACT_MAX_PAGES`, so no Flow can follow pages without end.

The element fingerprint schema gained `testId`, `accessibleName`, `label`.

### `domain/src/output-nodes/targets.ts`

`elementFingerprint` now emits `testId`, `accessibleName` and `label`. These are
Core's fingerprint signals *by name*, and among its highest weighted — `testId`
28, `accessibleName` 24, `label` 20, against 14 for a selector
(`DEFAULT_ELEMENT_FINGERPRINT_WEIGHTS`). A target without them can only be
matched on selector and text, which is what makes a superficial DOM change
break a workflow.

Each is read from the descriptor's own field first, then from the attributes
the recorder already captures (`data-testid` → `data-test` → `data-cy`;
`aria-label`), so **recordings made before the producer emits these fields
still resolve them**. That matters because the producer side is
`w2-identity-capture`'s and lands separately.

### `domain/src/output-nodes/definitions.ts`

Node parameters and icons for the seven, plus the new parameters on the
eleven. A structured command field becomes one `object` parameter; the flat
scalars beside it stay authorable. `required` still derives from the schema
row, so a node cannot disagree with its own schema.

Dialog, tab, download and extract_list deliberately take **no** element target:
the first three act on the browser, and a list extraction carries its own item
selector.

### `domain/src/output-nodes/payloads.ts` and `io/input-model.ts` — the checkbox mapping

A recorded checkbox/radio change now maps to `web.dom.check` through a new
input `web.user.checkbox_toggled`, instead of `web.dom.type`. The old mapping
was actively wrong: replaying it would **type the string "on" into a checkbox**,
because `readElementValue` on a checkbox returns its `value` attribute, which
is `"on"` by default and identical whether or not the box is ticked.

That same fact is why `checked` cannot simply be assumed:

- **A radio** change can only mean "now selected", so it maps to
  `checked: true` deterministically.
- **A checkbox** toggles either way. `recordedCheckedState` reads
  `element.checked`, then `aria-checked`. When neither is present the field is
  omitted and `hasExecutableParameters` keeps the event as **evidence**.

That last choice is the repository's own rule — "an action input must map
deterministically to a registered output; an unmapped input must not become
executable". Guessing `checked: true` would invert the user's action every time
they *un*ticked a box, and silently. Evidence is strictly better than the
status quo (a wrong `web.dom.type`), and the moment the recorder reports the
state the mapping becomes executable with **no further domain change**.

Also in `input-model.ts`: a keydown on a `<select>` whose only effect is the
value change the recorder already reports separately is now evidence, not a key
press — arrow/Home/End/PageUp/PageDown keys and any single character
(typeahead). Enter, Escape and Tab do something a value change does not, so
they stay key presses. This is the `w1-runner-asserts` finding that a keyboard
selection on `basic-form` recorded one extra `web.keyboard.pressed`; a Flow
built from such a recording would have replayed a stray keystroke.

### Files the brief named that needed no change

- `io/manifest-definitions.ts` — derives outputs from `schemas.ts`; the seven
  were already correct and stayed correct.
- `actions/capabilities.ts` — re-exports `webAutomationGatewayCapabilities`,
  which derives its `actionTypes`/`outputIds` from `WEB_AUTOMATION_ACTION_TYPES`
  in `runtime/capabilities.ts` (**must not touch**). All 18 were already
  advertised. Verified by `domain.test.ts`, which asserts the action
  capability's `outputIds` deep-equals `WEB_AUTOMATION_ACTION_TYPES`.

### Tests added (T1)

| File | Covers |
| --- | --- |
| `domain/src/actions/tests/schemas.test.ts` | one case per new action's schema; the fingerprint signals; the eleven's new parameters; the pagination bound |
| `domain/src/output-nodes/tests/definitions.test.ts` | a valid node per action via Core's validator; required flags derive from the schema; structured parameter per action; which actions take a target |
| `domain/src/output-nodes/tests/payloads.test.ts` | the checkbox/radio/`aria-checked`/no-state rows; dispatch-only actions yield `{}` |
| `domain/src/output-nodes/tests/targets.test.ts` | identity signals from fields and from attributes; no empty signals invented |

`io/tests/input-model.test.ts`: row 9 now asserts a stateless checkbox is
evidence, with new rows 9a (checkbox with state) and 9b (radio) both mapping to
`web.dom.check`; `web.dom.check` moved from `dispatchOnlyOutputs` to the
recordable list.

## Commands run and observed results

Every exit status captured by redirecting to a file and echoing `$?`, never
through a pipe. `DOMAIN_TEST_BUILD_LABEL` and `EXTENSION_TEST_BUILD_LABEL` were
both set to `w2-domain-vocabulary`. I ran no `pnpm build`, no `pnpm lab`
command, and no `pnpm structure:baseline`.

| Command | Observed |
| --- | --- |
| `pnpm --filter …/domain check` | **exit 0** |
| `DOMAIN_TEST_BUILD_LABEL=w2-domain-vocabulary pnpm --filter …/domain test` | **exit 0** — `# tests 73 / # pass 73 / # fail 0` |
| `node scripts/structure-audit.mjs` (scratch index, my 4 new files staged) | **exit 0** — `passed (31 warning(s), 19 baselined)`, no fail-severity finding, none citing a file of mine |
| `pnpm --filter …/extension check` | exit 2 — **only** `src/content/describe-element.ts` (2 errors, duplicate `const role`) |
| `EXTENSION_TEST_BUILD_LABEL=w2-domain-vocabulary pnpm --filter …/extension test` | exit 1 — 84/85 pass; the one failure is `runtime/tests/action-runner.test.ts` |
| `pnpm --filter …/extension test:content` | exit 1 — esbuild could not bundle: `describe-element.ts:68: The symbol "role" has already been declared` |

The structure-audit number is **identical to the pre-change reading** I took
before editing anything (`passed (31 warning(s), 19 baselined)`).

### The three extension failures are not mine

Each was rerun as the concurrency notes require, and none touches `domain/src`.

1. **`describe-element.ts`** (extension `check` and `test:content`) is
   `w2-identity-capture`'s file, mid-edit. Over four runs its errors went
   `hasEnteredValue` missing + `testIdFor` undefined + duplicate `role` (4
   errors) → duplicate `role` (2 errors), i.e. it is being actively written.
   `test:content` fails at the **bundle step**, so no content spec ran at all —
   mine or anyone's.
2. **`runtime/tests/action-runner.test.ts`** is under `apps/`, my brief's "must
   not touch", and owned by `w2-browser-actions`. It failed identically twice.
   The diff is that the actual result now carries `failure` and `validation`
   that the expected literal lacks:
   `failure: {category: 'action_failed', code: 'web.action.failed', stage: 'execution', …}`
   on the "Browser and extension pages cannot be automated" guard. `git status`
   confirms `action-runner.ts`, `result-mapping.ts`, `automation-tab.ts`,
   `browser-tab.ts`, `browser-download.ts` are all modified and
   `action-results.ts`, `unsupported-page.ts`, `command-options.ts`,
   `navigation-outcome.ts` newly added — precisely that guard's code path,
   under construction. A domain-only change cannot add those two fields; they
   are declared in `domain/src/actions/types.ts`, which I did not touch.
3. The extension unit suite grew **80 → 85 tests between my two runs**, so
   workers were landing code mid-suite.

Earlier in the session the domain `check` also failed in
`io/tests/gateway-output-dispatcher.test.ts` and `runtime/tests/adapter.test.ts`
(`w2-domain-status`'s). I reran as instructed; those errors **cleared on their
own** once that worker finished, which is why the domain check now exits 0 —
a useful confirmation that this class of failure resolves without my
intervention.

### My footprint

Six files modified, four created, **all under `domain/src`**; nothing under
`apps/`, `packages/`, or the must-not-touch list
(`actions/{types,safety}.ts`, `domain/src/runtime/`), all confirmed by
`git status`.

```
domain/src/actions/schemas.ts           | 275 +++++++++++++++++++-------
domain/src/io/input-model.ts            |  49 +++++-
domain/src/io/tests/input-model.test.ts |  33 +++-
domain/src/output-nodes/definitions.ts  |  35 +++-
domain/src/output-nodes/payloads.ts     |  32 ++++
domain/src/output-nodes/targets.ts      |  23 ++-
```
plus `actions/tests/schemas.test.ts` (146), `output-nodes/tests/definitions.test.ts`
(119), `output-nodes/tests/payloads.test.ts` (51), `output-nodes/tests/targets.test.ts` (55).

## Not verified

- **No live browser validation, and no content-harness evidence at all.**
  `test:content` never got past the bundle step. Nothing I wrote has been
  exercised in a browser.
- **None of the six dispatch-only actions has been dispatched end to end.** I
  registered their vocabulary; no test in my scope sends one through the
  gateway to a page. The blocker is
  [open question 1](#1-the-new-parameters-never-reach-the-command-unowned-file).
- **The checkbox mapping's executable branch is proven only by unit test.** No
  recording has ever produced a `checked` field, because no producer emits one
  yet, so the executable path has never run on real recorded data.
- **`pnpm check`, `pnpm test`, `pnpm build` at the repository root** were not
  run; `build` is forbidden to parallel workers. `packages/test-runner` and
  `packages/test-contracts` suites were not run — I changed no file in them,
  though the `recording-event-types` parity guard does parse
  `domain/src/io/input-model.ts` (see open question 4).
- **The extension `check` has never been observed green by me**, on any run,
  because of another worker's in-flight file. What I can state is narrower and
  is what I actually checked: no error in `domain/src`, and none in a file I
  own, on four separate runs.
- **Byte-budget headroom is now unknown.** `domain.test.ts` asserts the LLM
  bootstrap catalog fits a budget and that no required term drops out. My
  schemas enlarge every node's `metadata.parameterSchema`, and the assertions
  still pass — but I did not measure the remaining headroom, so the next
  worker to enlarge a node definition should watch that test.

## Open questions or contradictions found

### 1. The new parameters never reach the command (unowned file)

`webAutomationActionFromGatewayCommand`
(`domain/src/client/gateway-mapping.ts:~100`) lifts only `selector`, `text`,
`value`, `key`, `url`, `timeoutMs`, `coordinates` and `visualTarget` onto the
command. **None of `checked`, `option`, `scroll`, `wait`, `modifiers`,
`newTab`, `assert`, `extractList`, `upload`, `dialog`, `tab`, `download` is
lifted**, so a Flow dispatching `web.dom.check` produces
`command.options.checked`, not `command.checked`.

Because I mirrored the command shape exactly, the data is present and already
correctly shaped under `options` — the fix is a mechanical field copy in that
one function, not a reshape. Until it lands, a verb must read
`action.x ?? action.options?.x`, which is the kind of dual-path drift worth
avoiding.

`gateway-mapping.ts` is in neither my owns list nor my must-not-touch list, and
**no Wave 2 brief claims it**. I left it alone rather than edit an unowned file
that another brief may be about to take. It needs assigning. (w2-foundation
flagged the neighbouring `webAutomationActionResultPayload` gap in the same
file, for `failure`.)

### 2. The recorder never reports a checkbox's checked state

`describe-element.ts` has no `checked` field, and its attribute allowlist
excludes both `checked` and `aria-checked`. So today every recorded checkbox
toggle stays evidence. The domain side is finished and waiting: it already
reads `element.checked` and `attributes["aria-checked"]`.

`w2-identity-capture` owns that file and its brief lists allowlist additions
(`aria-labelledby`, `aria-describedby`, `for`, value presence) but **not these
two**. One of `checked` on the descriptor, or `aria-checked` in the allowlist,
completes the mapping. Worth adding to that brief or a Wave 3 one.

### 3. I added one registered input, not an output

The brief said to keep the registry total intact, which I read as the output
registry — 18 types, definitions, nodes and manifest outputs, all unchanged.
But mapping recorded checkbox changes to `web.dom.check` **requires** a
registered action input, so `web.user.checkbox_toggled` is new: action inputs
7 → 8, manifest inputs 9 → 10. Flagging it explicitly in case "total" was meant
to cover inputs too.

### 4. A test-runner guard parses `input-model.ts` by text

`packages/test-runner/src/run-expectations/tests/recording-event-types.test.ts`
reads `domain/src/io/input-model.ts` as **text** and regex-matches the body of
`webAutomationEventTypeForClientKind`. I did not touch that function, so the
guard is intact, but it is coupled to source layout (already noted as finding
12 of `w1-runner-asserts`). Anyone who converts that function to a table breaks
it. I did not run the test-runner suite.

### 5. Nested versus flat structured parameters

I chose nested objects matching the command type, for the reasons in
[the shape rule](#the-shape-rule-everything-follows). The cost is authoring
ergonomics: `web.dom.assert` presents one `assert` object in Studio rather than
three scalar fields. If the supervisor prefers flat authoring, the change is
confined to `schemas.ts` and `definitions.ts` — but then the reshape in open
question 1 stops being a field copy.
