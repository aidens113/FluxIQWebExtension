# Report: w2-foundation

Worker: `w2-foundation`. Brief: `### Brief: w2-foundation` in
[briefs/wave-2.md](../briefs/wave-2.md), implementing `## Wave 2 contract`.

## Outcome

**Done**, with one declared deviation: I edited
`domain/src/actions/schemas.ts`, which my brief lists under "Must not touch".
It cannot be avoided — see [Deviations](#deviations-from-the-brief). Everything
in the definition of done passes, observed output in
[Commands](#commands-run-and-observed-results).

The rest of this report is the contract the other twelve Wave 2 workers code
against. **Sections [Capabilities](#capabilities-on-contentactiondependencies)
and [Stubs](#stubs) are the signatures your brief tells you to cite.**

## Deviations from the brief

### 1. `domain/src/actions/schemas.ts` (must-not-touch) — unavoidable

The contract says to list the seven new types in `WEB_AUTOMATION_ACTION_TYPES`.
Doing that without a matching entry in `webAutomationActionDefinitions`
(`schemas.ts`) **breaks the domain at runtime**, not just in a test:

- `io/web-automation-io.ts:42` does
  `webAutomationManifestOutputs.find((o) => o.id === outputId)!` and hands the
  result to Core's `defineOutput`;
- `webAutomationManifestOutputs` is derived from `schemas.ts`, so the find
  returns `undefined`;
- Core's `validateOutputDefinition` (`packages/fluxiq/src/io/index.ts:501`)
  reads `adapter.definition.id`, so `createWebAutomationDomainIo` throws.

Manifest outputs, output nodes, and the registered domain outputs *all* derive
from that one table, so the action-type list and the parameter schemas cannot
land in separate work units. I added the seven minimal definitions that keep
the registry total. **`w2-domain-vocabulary` should treat these as a starting
point to refine, not as a file to create**, and owns their final parameter
shapes, node parameters, payload mapping, and inputs.

### 2. Other files outside my owns list, each mechanically forced

Extending the action-type union or making `validation` a required field makes
these fail to compile or fail at runtime. Each change is one or two lines.

| File | Why |
| --- | --- |
| `src/background/connection.ts` | builds a result literal (line ~507); needs `validation` |
| `src/background/connection/runtime-status.ts` | `runtimeActionLabel` must give each of the 7 new types a label; its test asserts every type has a distinct one |
| `src/background/connection/tests/runtime-status.test.ts` | `confirmations` is `Record<BrowserActionType, …>`, exhaustive by design; and its result helper needs `validation` |
| `src/runtime/tests/{result-mapping,action-runner}.test.ts` | result helpers/expectations need `validation` |
| `domain/src/tests/domain.test.ts` | node counts 11→18 and 50→57 |
| `domain/src/tests/safety.test.ts` | `SAFE_OUTPUTS` gains assert and extract_list |
| `domain/src/io/tests/input-model.test.ts` | `dispatchOnlyOutputs` gains the 7 |

### 3. Two things the brief scoped differently

- **Wait verbs now return `timed_out`.** Contract item 2 says "wait timeouts
  yield `timed_out`", so I wired `wait-for-selector.ts` and `wait-for-text.ts`
  to `deps.timedOut`. That is more than "update the harness specs only for the
  new `validation` field": `actions.spec.ts`'s "a timeout reports failed, not
  timed_out" test is now "reports timed_out with Core's timeout category".
  `w2-waits` inherits this and replaces it with the full condition set.
- **`validation` is a required field**, not optional. That is what makes "no
  action can complete as a silent no-op" mechanical rather than advisory: a
  verb cannot build a result without stating a post-condition. It is why the
  test helpers above needed a line each.

## The contract as implemented

### Action types and safety (`domain/src/actions/types.ts`, `safety.ts`)

Seven added to `WebAutomationActionType` and to `WEB_AUTOMATION_ACTION_TYPES`
(now 18), each classified in `WEB_AUTOMATION_ACTION_SAFETY` and given a legacy
alias so `WEB_AUTOMATION_ACTION_TO_LEGACY_BROWSER` stays total:

| Type | Safety |
| --- | --- |
| `web.dom.check` | review |
| `web.dom.assert` | **safe** |
| `web.dom.extract_list` | **safe** |
| `web.dom.upload` | review |
| `web.dom.dialog` | review |
| `web.browser.tab` | review |
| `web.browser.download` | review |

### The one result type

`WebAutomationActionResult<TElement = JsonObject, TSnapshot = JsonObject>` in
`domain/src/actions/types.ts`. The extension no longer declares its own:
`shared/protocol.ts` binds the generics and `content/types.ts` re-exports it.

```ts
export type BrowserActionCommand = WebAutomationActionCommand;
export type BrowserActionResult = WebAutomationActionResult<DomElementDescriptor, DomSnapshot>;
```

- `status`: `succeeded | failed | timed_out | cancelled | unknown` — exactly
  Core's `ClientGatewayActionResult` union. **No `rejected` member**: a refused
  action type is answered before dispatch and never produces a result. (The
  plan's Phase 1.2 step 1 text says "adds `rejected`, `unknown`"; the Wave 2
  contract says "equals Core's", and I followed the contract.)
- `validation` (**required**):
  ```ts
  | { status: "passed"; expected: string; actual: string }
  | { status: "failed"; expected: string; actual: string }
  | { status: "none"; reason: "evidence-only" | "not-yet-validated" }
  ```
- `resolution?`: `{ strategy, candidateCount, bestScore?, runnerUpScore?, confidence? }`
  where `strategy` is `selector | coordinates | visual-target | fingerprint |
  active-element | scored-candidate`.
- `failure?`: Core's `AutomationStudioFailureRecord`, imported from Core as a
  type only. **There is no downstream category list.**

### Command parameters (`WebAutomationActionCommand`)

Flat fields unchanged (`selector`, `text`, `value`, `key`, `url`, `timeoutMs`,
`coordinates`, `visualTarget`, `options`), plus:

| Field | Type | For |
| --- | --- | --- |
| `newTab?` | `boolean` | navigate |
| `option?` | `{by:"value";value} \| {by:"label";label} \| {by:"index";index}` | select |
| `scroll?` | `{mode:"by";x?;y?} \| {mode:"toElement"} \| {mode:"untilStable";maxScrolls;y?}` | scroll |
| `wait?` | `{condition; url?; stableForMs?}`, condition `present\|visible\|enabled\|absent\|url\|stable` | waits |
| `modifiers?` | `{alt?;ctrl?;meta?;shift?}` | keypress |
| `checked?` | `boolean` | check |
| `extractList?` | `{item; fields: Record<string,string>; paginate?: {next;maxPages}; maxItems?}` | extract_list |
| `assert?` | `{kind; expected?; timeoutMs?}`, kind `exists\|absent\|text\|url\|visible\|enabled` | assert |
| `upload?` | `{files: {name; mimeType; contentBase64}[]}` | upload |
| `dialog?` | `{response:"accept"\|"dismiss"; promptText?}` | dialog |
| `tab?` | `{operation:"open";url?;active?} \| {operation:"switch";tabId?;urlPattern?} \| {operation:"close";tabId?}` | tab |
| `download?` | `{filename?; timeoutMs?}` | download |

Bounds exported from the domain: `WEB_AUTOMATION_EXTRACT_MAX_PAGES` (50),
`WEB_AUTOMATION_UPLOAD_MAX_FILE_BYTES` (1 MiB),
`WEB_AUTOMATION_UPLOAD_MAX_TOTAL_BYTES` (4 MiB),
`WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH` (1024).

### Element descriptor (`shared/protocol.ts`)

`DomElementDescriptor` gains optional `testId`, `accessibleName`, `label`,
`implicitRole`, and `context: DomElementContext`:

```ts
export type DomElementContext = {
  formId?: string; formName?: string; formAction?: string; fieldsetLegend?: string;
  landmark?: string; heading?: string;
  listPosition?: { index: number; total: number };
  tablePosition?: { row: number; column: number; columnHeader?: string };
};
```

`w2-identity-capture` fills these; every field is optional.

## Capabilities on `ContentActionDependencies`

Each lives in its own `content/action-runtime/` module, is wired in
`execute-action.ts`, and **throws `"… is not implemented yet."` today**. Replace
only your module; the wiring already exists.

| Capability | Module | Signature on `deps` | Owner |
| --- | --- | --- | --- |
| Actionability | `actionability.ts` | `checkActionability(element: Element): ActionabilityReport` | `w2-click` |
| Keyboard | `keyboard.ts` | `keyboard.typeText(element: Element, text: string): void`<br>`keyboard.pressKey(target: Element, key: string, modifiers?: WebAutomationKeyModifiers): KeyPressOutcome` | `w2-keyboard-input` |
| Checkable state | `checkable-state.ts` | `setCheckedState(element: Element, checked: boolean): CheckableStateOutcome` | `w2-check-assert` |
| List extraction | `list-extraction.ts` | `extractList(request: WebAutomationExtractListRequest): Promise<ListExtractionOutcome>` | `w2-extract-list` |
| File input | `file-input.ts` | `setInputFiles(element: Element, files: readonly WebAutomationUploadFile[]): FileInputOutcome` | `w2-upload-dialog` |
| Dialog control | `dialog-control.ts` | `dialogControl.arm(request: WebAutomationDialogRequest): boolean`<br>`dialogControl.observed(): ObservedDialog \| undefined` | `w2-upload-dialog` |
| Assertion | `assertion-evaluation.ts` | `evaluateAssertion(request: WebAutomationAssertRequest, target: AssertionTarget): Promise<AssertionOutcome>` | `w2-check-assert` |
| Wait conditions | `wait-conditions.ts` | `waitForCondition(request: WaitConditionRequest): Promise<WaitConditionOutcome>` | `w2-waits` |

Their result types, all exported from `content/action-runtime/index.ts`:

```ts
type ActionabilityRejectionCode = "disabled" | "hidden" | "covered";
type ActionabilityReport =
  | { actionable: true; point: { x: number; y: number }; detail: string }
  | { actionable: false; code: ActionabilityRejectionCode; detail: string; point?: { x: number; y: number } };

type KeyPressOutcome = { dispatched: boolean; defaultAction: "none" | "submitted" | "focus-moved" | "unsupported"; detail: string };

type CheckableStateOutcome =
  | { ok: true; kind: "checkbox" | "radio"; checked: boolean; changed: boolean }
  | { ok: false; reason: string };

type ExtractedListRecord = Record<string, string>;
type ListExtractionOutcome = { records: ExtractedListRecord[]; pagesRead: number; truncated: boolean; missingFields: string[] };

type FileInputOutcome = { ok: true; fileNames: string[] } | { ok: false; reason: string };

type ObservedDialog = { kind: "alert" | "confirm" | "prompt" | "beforeunload"; message: string; response: "accept" | "dismiss"; promptText?: string; at: number };

type AssertionTarget = { selector?: string; element?: Element };
type AssertionOutcome = { held: boolean; expected: string; actual: string };

type WaitConditionRequest = { condition: WebAutomationWaitCondition; selector?: string; text?: string; url?: string; timeoutMs?: number; stableForMs?: number };
type WaitConditionOutcome =
  | { ok: true; condition: WebAutomationWaitCondition; element?: Element; actual: string; waitedMs: number }
  | { ok: false; condition: WebAutomationWaitCondition; actual: string; waitedMs: number };
```

## Result builders on `deps` — how a verb reports

A verb **cannot** construct a result itself. These five are the only way:

```ts
deps.success(action, startedAt, message, validation, evidence?)   // failed validation => failed + output_not_observed
deps.failure(action, error, startedAt?)                           // a throw; execute.ts already catches for you
deps.rejected(action, startedAt, code, expected, actual, evidence?) // ACTION_REJECTED, code becomes `web.action.<code>`
deps.timedOut(action, startedAt, message, validation, evidence?)  // status timed_out + Core `timeout`
deps.notImplemented(action, startedAt, what)                      // what the stubs return now
```

`evidence` is `{ element?, snapshot?, extracted?, resolution? }` (type
`ActionResultEvidence`).

**The rule that matters:** pass a real validation to `success()` and a failed
one automatically produces `status: "failed"` with Core's `output_not_observed`
and your `expected`/`actual`. You do not build failure records yourself.

Worked example (`w2-select`):

```ts
const actual = element.value;
return deps.success(action, startedAt, "Option selected.",
  actual === requested
    ? { status: "passed", expected: requested, actual }
    : { status: "failed", expected: requested, actual },
  { element: deps.describeElement(element), snapshot: deps.captureSnapshot() });
```

Validation text is bounded to 1024 characters and never empty
(`validation-outcome.ts`), because Core's parser **drops a record whole** if
either rule is broken — an unbounded `actual` taken from page text would lose
the failure entirely. Do not bypass it.

The eleven existing verbs pass `{status:"none", reason:"not-yet-validated"}`;
`capture_snapshot` and `extract` pass `"evidence-only"`. Replacing
`not-yet-validated` with a real post-condition is each verb worker's job.

## Stubs

Verbs in `content/actions/`, registered in `execute.ts`, each returning
`deps.notImplemented(...)`:

| File | Export | Owner |
| --- | --- | --- |
| `check.ts` | `checkAction(action, deps, startedAt): BrowserActionResult` | `w2-check-assert` |
| `assert.ts` | `assertAction(action, deps, startedAt): BrowserActionResult` | `w2-check-assert` |
| `extract-list.ts` | `extractListAction(action, deps, startedAt): BrowserActionResult` | `w2-extract-list` |
| `upload.ts` | `uploadAction(action, deps, startedAt): BrowserActionResult` | `w2-upload-dialog` |
| `dialog.ts` | `dialogAction(action, deps, startedAt): BrowserActionResult` | `w2-upload-dialog` |

Background stubs in `src/runtime/`, routed from `action-runner.ts` before the
content-script send (so they never reach a page that could not perform them):

| File | Export | Owner |
| --- | --- | --- |
| `browser-tab.ts` | `runBrowserTabAction(action: BrowserActionCommand): Promise<BrowserActionResult>` | `w2-browser-actions` |
| `browser-download.ts` | `runBrowserDownloadAction(action: BrowserActionCommand): Promise<BrowserActionResult>` | `w2-browser-actions` |

A verb returning `Promise<BrowserActionResult>` is fine — `execute.ts` awaits
any verb it dispatches; the two waits are awaited inside the try block on
purpose, so a rejection cannot escape the catch.

Also in `action-runner.ts`: `isMutatingAction` now excludes `web.dom.assert`
and `web.dom.extract_list`, so the unsupported-page guard does not block the
two new read-only actions.

## Commands run and observed results

All from `F:\!FluxIQWebExtension`; each exit status captured by redirecting to
a file and echoing `$?`, never through a pipe.

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/domain check` | exit 0 |
| `DOMAIN_TEST_BUILD_LABEL=w2-foundation pnpm --filter … domain test` | exit 0 — `# tests 26 / # pass 26 / # fail 0` |
| `pnpm --filter @fluxiq-web-extension/extension check` | exit 0 |
| `EXTENSION_TEST_BUILD_LABEL=w2-foundation pnpm --filter … extension test` | exit 0 — `# tests 72 / # pass 72 / # fail 0` (64 before, +8 new) |
| `pnpm --filter @fluxiq-web-extension/extension build` | exit 0 |
| `pnpm --filter @fluxiq-web-extension/extension test:content` | exit 0 — `31 passed (7.3s)` |
| `FLUXIQ_TEST_ENV_FILES=none pnpm lab run basic-form --target isolated` | exit 0 — `{"runId":"run-mtxly4ax-3cd480e5","verdict":"passed",…}` |
| `node scripts/structure-audit.mjs` | exit 0 — `passed (31 warning(s), 19 baselined)` |

Baseline before my change, for comparison: audit `passed (29 warning(s), 19
baselined)`, domain test 26/26, extension check exit 0. The two new warnings are
`directory-files` advisories: `content/actions/` 18 files and
`content/action-runtime/` 19, both past the 15-file advisory threshold and well
under the 25-file limit. **No baseline entry was added, raised, or regenerated**
(`pnpm structure:baseline` was not run), and new files were staged with
`git add -N` first so the audit, which reads only tracked files, saw them.

**Content bundle invariant re-verified.** Wave 1 established that no Core or
domain runtime may enter the content script. In the rebuilt
`apps/extension/build/content/index.js` (58,776 bytes) the tokens
`automation-studio`, `AUTOMATION_STUDIO_ADAPTIVE`,
`parseAutomationStudioFailureRecord`, `webAutomationClientCapabilities`,
`defineOutput`, and `webAutomationActionDefinitions` each appear **0 times**,
while `output_not_observed` (2), `not-yet-validated` (8), `evidence-only` (2),
and `is not implemented yet` (11) are present. Every Core type reaches the
content script through `import type` or the indexed access
`NonNullable<BrowserActionResult["failure"]>`, which is why
`VALIDATION_TEXT_MAX_LENGTH` is restated in `validation-outcome.ts` instead of
being imported: a value import from `@fluxiq-web-extension/domain/client` would
pull the domain barrel into the page. A test asserts the two constants agree.

## Not verified

- **No live browser validation.** `test:content` runs the real content bundle
  in headless Chromium, and the Lab run exercises the extension end to end on
  `basic-form`, but nothing loaded the unpacked extension in a headed browser.
  The two background stubs (`browser-tab`, `browser-download`) and the
  background routing to them were **never executed** — no test dispatches those
  action types, and they need `chrome.tabs`/`chrome.downloads`.
- **The capability modules are unexecuted by construction.** Every one throws.
  Their signatures type-check and are wired, but no behaviour exists to test.
- **`failure` does not yet reach the gateway.** `results.ts` puts a record on
  the result, but `runtime/result-mapping.ts`
  (`gatewayActionResultFromBrowserResult`) does not copy `result.failure` onto
  the wire result, and `webAutomationActionResultPayload` (domain) does not
  forward it. Both are outside my owns; wiring them is
  `w2-browser-actions`/Phase 1.5. **Today the record is built and then
  dropped at the boundary.**
- **`resolution` is never populated.** The field exists; the resolver that
  fills it is Phase 1.3.
- **`pnpm check`, `pnpm test`, `pnpm build` at the repository root** were not
  run; I ran the per-package gates the brief names. `packages/test-runner` and
  `packages/test-contracts` suites were not run — I changed no file in them.
- **The seven new schemas are untested as schemas.** They keep the registry
  total and the smoke test passes, but no test asserts their parameter shapes;
  that is `w2-domain-vocabulary`'s T1 work.
- **`domain/src/runtime/adapter.ts` still flattens `timed_out`** to `failed`,
  so the `timed_out` the waits now produce does not survive the domain hop yet.
  That is `w2-domain-status`'s step and is why no end-to-end assertion of
  `timed_out` exists above the content harness.

## Open questions or contradictions found

1. **The brief's own contradiction (the important one).** "Must not touch
   `domain/src/actions/schemas.ts`" cannot hold together with "list them in
   `WEB_AUTOMATION_ACTION_TYPES`" and "domain `check` and `test` pass". The
   action list and the parameter-schema table are the same registry: manifest
   outputs, output nodes, and registered domain outputs all derive from
   `schemas.ts`, and Core throws for a listed output with no definition. Either
   the two land together (what I did) or the list waits for
   `w2-domain-vocabulary`. Please re-brief `w2-domain-vocabulary` to refine the
   seven definitions rather than add them.
2. **`status` union: contract vs plan.** The Wave 2 contract says the union
   equals Core's five; the plan's Phase 1.2 step 1 says it "adds `rejected`,
   `unknown`". I followed the contract — Core's wire union has no `rejected`,
   and the rejection path never builds a result. Worth correcting the plan text.
3. **`validation` required vs optional.** I made it required, which is what
   forces every producer to state a post-condition, at the cost of one line in
   four test helpers and `connection.ts`. If the supervisor prefers optional,
   that mechanical guarantee is lost.
4. **Content modules cannot be unit-tested in Node**, which is why the result
   model is split. `results.ts` imports `dom-snapshot.ts`, which imports
   `frame-geometry.ts`, which calls `isTopFrame()` **at module load** — so
   importing `results.ts` in `pnpm test` throws `ReferenceError: window is not
   defined`. I moved the decision rules into `content/action-runtime/validation-outcome.ts`
   (pure, no DOM) and unit-tested that; the assembled result is proven by
   `test:content`. Any worker tempted to add a Node test for a content module
   will hit the same wall. `frame-geometry.ts`'s load-time side effect may be
   worth removing in a later phase.
5. **`WEB_AUTOMATION_EXTRACT_MAX_PAGES` duplicates `SCENARIO_EXTRACT_MAX_PAGES`**
   (both 50). The domain must not depend on `packages/test-contracts`, so the
   bound is restated with a comment. If they must agree, a test should assert it
   — the scenario contract is the test facility's, the action bound is the
   product's, and nothing currently ties them.
6. **`web.dom.check` is still dispatch-only.** It has no recorded input, so a
   recorded checkbox change still maps to `web.dom.type`. That mapping, and
   moving `web.dom.check` from `dispatchOnlyOutputs` to the recordable list in
   `domain/src/io/tests/input-model.test.ts`, is `w2-domain-vocabulary`'s.
7. **`ActionVisualTarget` is now an alias** of the domain's
   `WebAutomationActionVisualTarget` rather than a structurally identical copy,
   so `bounds` is an inline `{x,y,width,height}` rather than `RectDescriptor`.
   They are mutually assignable and nothing broke, but a worker reading
   `RectDescriptor` on a visual target will not find it.
