# w2-plan-handle-identity — worker report

## Outcome

**Done.** A plan node resolved from a target handle now carries
`parameters.element`, the identity of the element the model was shown. It uses
the recorded element fingerprint's field names (`WebAutomationElementFingerprint`),
and `output-nodes/targets` `elementFingerprint` returns it unchanged. Measured
with the extension's own `veto.ts` and `score.ts`:

- The live failure's identity scores **0.171** on the right input, matching the
  live run's 0.17, and is refused as `uncorroborated`.
- The new identity scores **1.000** on the right input and on the right button.
- Every wrong control is refused as `contradicted`: the select -0.323, another
  text input -0.131, the submit button -0.323, the drift button -0.131.

The extension-side test that proves this could not be placed, because the brief
forbids edits to `apps/extension/src` and the structure audit forbids domain
imports of it. It is below, ready to place.

## What changed and why

### Root cause (confirmed, read-only in Core)

Core's `prepareElementTargetAction` (`AS/runtime/io-policy.ts`) runs
`normalizeAutomationStudioElementTarget` on every dispatched node. When the node
has no `parameters.element`, `normalizeFingerprint(parameters)` reads
`parameters.text` as `visibleText` (`AS/model/action-element-target.ts:134`).

A created `web.dom.type` node therefore reached the page with
`{ selector, visibleText: <the words to type> }`. The veto
(`content/identity/veto.ts`) found a distinguishing signal the input could not
corroborate and refused it: "scoring 0.17 with nothing the recording named
agreeing". When `parameters.element` is present, Core uses
`actionParametersFingerprint` instead, which never reads `text`. So any
`element` fixes the text leak, and a real identity lets the page corroborate
the element.

Recorded nodes already carry
`element: elementFingerprint(payload.element)` (`output-nodes/payloads.ts:67-74`).

### Files (all inside `domain/src/runtime/llm-evidence/plan-resolution/`)

- **`element-identity.ts` (new).** `webPlanElementIdentity(element, selector)`
  builds the identity from the packet element, typed as a `Pick` of
  `WebAutomationElementFingerprint`:
  - Fields: `tagName`, `role`, `accessibleName` (from the packet's `name`),
    `visibleText`, `selector`, `inputType`, and
    `context: { formId, listPosition }`. The frame stays on the node as
    `browserFrameId`, as for a recorded node.
  - These are the same fields `target-override.ts` `elementFingerprint` uses.
    Nothing else is copied: no `selectedValue`, `options`, `href`, `hasValue`,
    `heading` or `cell`.
  - Value safety, on top of the sanitizer (which already drops secret controls
    and withholds text inside them):
    - `input`, `textarea` and `select` never carry `visibleText`, because it is
      their contents or their options.
    - A name or text that reached the packet's 300-character bound is left out,
      because it was cut.
    - A control whose `inputType` or `controlType` signature is sensitive
      carries no name or text (defence in depth; the sanitizer never lets one
      through).
- **`target-packets.ts`**
  - Each remembered handle keeps its identity.
  - `WebLlmTargetResolution` success now includes `element`, cloned on resolve,
    so a caller cannot change the store.
  - For a bare handle, pages that agree on the address (frame plus selector)
    but describe the element differently still resolve. The identity keeps only
    the fields every page agreed on (private `agreedIdentity`). Before this
    change such a handle resolved with no identity at all, so this is no
    stricter than before and guesses at neither page. Handles naming a
    different selector are still `ambiguous`, as before.
- **`resolve-plan-node.ts`**
  - A resolved `selector` handle writes `parameters.element` on nodes whose
    schema declares `element` (`ELEMENT_NODE_IDS`, derived from
    `webAutomationActionDefinitions`; today that is every selector node).
  - An `element` the model wrote beside a handle is replaced, because the
    handle is the authority. Beside a literal selector, the node stays
    `unchanged`.
  - A handle written inside `element` is still `web.handle.misplaced`.
  - Checked against Core: `automationStudioPlanNodeParametersNameHandle` counts
    only objects whose keys are exactly `handle` (plus an optional `location`),
    so the identity never trips it. Core's bootstrap validation checks only
    that an object parameter is an object.
- **`tests/plan-node-identity.test.ts` (new, 6 tests).** All 6 failed before the
  change, on assertions (test 2's live-defect check passed and the identity
  check failed). All 6 pass after.
  - A type node and a click node carry the identity in the recorded shape.
  - Through the real dispatch chain (Core normalizer, `outputTargetFromPayload`,
    `webAutomationActionFromGatewayCommand`): the literal node dispatches
    `visibleText: "Ada Lovelace"` (the live defect), and the resolved node
    dispatches `accessibleName: "Name"` with no typed text. These are asserted
    signal by signal, so W-1's precedence change cannot break them.
  - No value, cut name or secret-control text reaches the identity.
  - A list position and a child frame are kept.
  - Pages that disagree carry only the fields they agree on.
  - The handle replaces a model-written element; a literal selector keeps its
    own; the identity is the caller's own copy.
- **`tests/resolve-plan-node.test.ts`.** The five tests with resolved selector
  handles now expect `element`, and the header notes it. No other behaviour
  changed.

### Proposed extension test (not placed: `apps/extension/src` is outside this brief)

Home: `apps/extension/src/content/identity/tests/created-node-identity.test.ts`.
It was run from the scratchpad through an esbuild bundle equivalent to
`apps/extension/scripts/test-extension.mjs`: 3/3 pass. Against the HEAD
resolver, tests 2 and 3 fail. Test 2 fails with `actual: 'Ada Lovelace'`, the
live defect exactly. Test 1 documents the literal path and passes either way.

```ts
// A Flow node created from a plan handle, scored by the page the way a
// recorded one is.
//
// The live `instruction-only-form` creation run (`run-mu4t20d1-93b60760`)
// failed its first step: "refused input[data-testid="instruction-name"]
// scoring 0.17 with nothing the recording named agreeing exactly". The created
// type node carried a selector and no element, so Core's element-target
// normalizer read its `text` -- the words to type -- as the input's visible
// text, and the veto refused the right input for not showing them. The domain
// now writes `parameters.element` from the element the model was shown
// (`domain/src/runtime/llm-evidence/plan-resolution/element-identity.ts`).
//
// Each row goes the whole way: the fixture's snapshot is inspected through the
// domain's evidence runtime, a plan handle is resolved, the node's parameters
// pass through Core's normalizer, the wire target and the gateway mapping, and
// the `command.element` the page would read is scored here by the same `veto.ts`
// and `score.ts` the resolver uses. The candidates are shaped as
// `candidateFingerprint` describes the fixture's controls
// (`apps/scenario-lab/src/scenarios/instruction-only-form/scenario.ts`); nothing
// on this path reads the element, so it is a marker, as in `veto.test.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAutomationStudioElementTarget } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_INSPECT_TOOL_ID } from "@fluxiq-web-extension/domain";
import { outputTargetFromPayload, webAutomationActionFromGatewayCommand, webAutomationOutputNodeId } from "@fluxiq-web-extension/domain/client";
import type { TargetCandidate } from "../candidates";
import { TARGET_SCORE_FLOOR, scoreTargetCandidates, type RecordedIdentity } from "../score";
import { vetoCandidate } from "../veto";

const PAGE_URL = "http://127.0.0.1:4100/instruction-only-form";

/** The fixture's controls as `describe-element.ts` puts them in a snapshot. */
const DESCRIBED: JsonObject[] = [
  { tagName: "button", selector: '[data-testid="instruction-introduce-target-drift"]', visibleText: "Introduce target drift", text: "Introduce target drift", accessibleName: "Introduce target drift", implicitRole: "button", testId: "instruction-introduce-target-drift", attributes: { "data-testid": "instruction-introduce-target-drift", type: "button" }, context: { landmark: "main" } },
  { tagName: "input", selector: '[data-testid="instruction-name"]', inputType: "text", accessibleName: "Name", label: "Name", implicitRole: "textbox", testId: "instruction-name", attributes: { name: "name", "data-testid": "instruction-name", autocomplete: "off" }, context: { landmark: "main" } },
  { tagName: "select", selector: '[data-testid="instruction-plan"]', visibleText: "Starter Team Enterprise", text: "Starter Team Enterprise", accessibleName: "Plan", label: "Plan", implicitRole: "combobox", testId: "instruction-plan", attributes: { name: "plan", "data-testid": "instruction-plan" }, context: { landmark: "main" } },
  { tagName: "button", selector: '[data-testid="instruction-submit"]', visibleText: "Submit", text: "Submit", accessibleName: "Submit", implicitRole: "button", testId: "instruction-submit", attributes: { type: "submit", "data-testid": "instruction-submit" }, context: { landmark: "main" } }
];

type Fingerprint = Omit<TargetCandidate["fingerprint"], "candidateId">;
function candidate(candidateId: string, fingerprint: Fingerprint): TargetCandidate {
  return { element: { candidateId } as unknown as Element, fingerprint: Object.assign({ candidateId }, fingerprint) };
}
const bounds = { x: 10, y: 10, width: 200, height: 24 };

/** The same controls as `candidateFingerprint` describes them live. */
const NAME_INPUT = candidate("instruction-name", { tagName: "input", role: "textbox", testId: "instruction-name", selector: '[data-testid="instruction-name"]', accessibleName: "Name", label: "Name", bounds, isVisibleOnViewport: true });
const PLAN_SELECT = candidate("instruction-plan", { tagName: "select", role: "combobox", testId: "instruction-plan", selector: '[data-testid="instruction-plan"]', visibleText: "Starter Team Enterprise", accessibleName: "Plan", label: "Plan", bounds, isVisibleOnViewport: true });
const SUBMIT = candidate("instruction-submit", { tagName: "button", role: "button", testId: "instruction-submit", selector: '[data-testid="instruction-submit"]', visibleText: "Submit", accessibleName: "Submit", bounds, isVisibleOnViewport: true });
const DRIFT_BUTTON = candidate("instruction-introduce-target-drift", { tagName: "button", role: "button", testId: "instruction-introduce-target-drift", selector: '[data-testid="instruction-introduce-target-drift"]', visibleText: "Introduce target drift", accessibleName: "Introduce target drift", bounds, isVisibleOnViewport: true });
/** A different text field a drifted page could put under the same selector. */
const EMAIL_INPUT = candidate("instruction-email", { tagName: "input", role: "textbox", testId: "instruction-email", selector: '[data-testid="instruction-email"]', accessibleName: "Email", label: "Email", bounds, isVisibleOnViewport: true });

async function resolvedNode(nodeDefinitionId: string, parameters: JsonObject): Promise<JsonObject> {
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => command.actionType === "web.dom.capture_snapshot"
      ? { status: "succeeded", payload: { snapshot: { url: PAGE_URL, title: "Instruction-only automation", interactiveElements: DESCRIBED } } }
      : { status: "succeeded" }
  });
  await runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.inspect", toolId: WEB_LLM_INSPECT_TOOL_ID, value: {} });
  const resolution = runtime.resolvePlanNodeParameters({ projectId: "project.one", flowId: "flow.one", nodeDefinitionId, parameters });
  assert.equal(resolution.status, "resolved", JSON.stringify(resolution));
  return resolution.status === "resolved" ? resolution.parameters : {};
}

/** What the page reads for these node parameters, through Core's normalizer, the wire target and the gateway mapping. */
function pageIdentity(actionType: string, parameters: JsonObject): RecordedIdentity {
  const prepared: JsonObject = Object.assign({}, parameters);
  const target = normalizeAutomationStudioElementTarget(parameters, { source: "runtime" });
  if (target) prepared.target = target as unknown as JsonObject;
  const command = webAutomationActionFromGatewayCommand({ commandId: "command.one", actionType, parameters: prepared, target: outputTargetFromPayload(prepared) ?? {} });
  assert.equal("status" in command, false, "the command is dispatched");
  const element = (command as { element?: RecordedIdentity }).element;
  assert.ok(element, "the command carries an identity");
  return element;
}

const TYPE_PARAMETERS: JsonObject = { selector: { handle: "target.2" }, text: "Ada Lovelace" };

test("the live failure, reproduced: a type node with no element is refused on the right input", () => {
  const identity = pageIdentity("web.dom.type", { selector: '[data-testid="instruction-name"]', text: "Ada Lovelace" });
  assert.equal(identity.visibleText, "Ada Lovelace", "Core read the typed text as the input's identity");
  const verdict = vetoCandidate(identity, NAME_INPUT);
  assert.equal(verdict.refusedBecause, "uncorroborated");
});

test("a created type node's identity is accepted on its own input, above the floor, and refused on another", async () => {
  const identity = pageIdentity("web.dom.type", await resolvedNode(webAutomationOutputNodeId("web.dom.type"), TYPE_PARAMETERS));
  assert.equal(identity.visibleText, undefined);
  assert.equal(identity.accessibleName, "Name");

  // Level 1: the selector found the input, and the veto lets it through.
  const accepted = vetoCandidate(identity, NAME_INPUT);
  assert.equal(accepted.refusedBecause, undefined);
  assert.ok(accepted.measurement && accepted.measurement.score >= TARGET_SCORE_FLOOR, `score ${accepted.measurement?.score}`);

  // The same selector landing on a different control is still refused.
  for (const wrong of [PLAN_SELECT, EMAIL_INPUT, SUBMIT]) {
    const refused = vetoCandidate(identity, wrong);
    assert.ok(refused.refusedBecause, `${wrong.fingerprint.candidateId} must be refused, scored ${refused.measurement?.score}`);
  }

  // Level 2: with the selector gone, scoring the family picks the input, and only the input.
  const scored = scoreTargetCandidates(identity, [EMAIL_INPUT, NAME_INPUT]);
  assert.equal(scored.outcome, "resolved");
  assert.equal(scored.outcome === "resolved" && scored.chosen.score.candidate.candidateId, "instruction-name");
  assert.ok(scored.outcome === "resolved" && scored.chosen.score.normalizedScore >= TARGET_SCORE_FLOOR);
  assert.notEqual(scoreTargetCandidates(identity, [EMAIL_INPUT]).outcome, "resolved", "a lone wrong input is not chosen");
});

test("a created click node's identity is accepted on its own button and refused on another", async () => {
  const identity = pageIdentity("web.dom.click", await resolvedNode(webAutomationOutputNodeId("web.dom.click"), { selector: { handle: "target.4" } }));
  assert.equal(identity.accessibleName, "Submit");
  const accepted = vetoCandidate(identity, SUBMIT);
  assert.equal(accepted.refusedBecause, undefined);
  assert.ok(accepted.measurement && accepted.measurement.score >= TARGET_SCORE_FLOOR, `score ${accepted.measurement?.score}`);
  const refused = vetoCandidate(identity, DRIFT_BUTTON);
  assert.ok(refused.refusedBecause, `the drift button must be refused, scored ${refused.measurement?.score}`);
  const scored = scoreTargetCandidates(identity, [DRIFT_BUTTON, SUBMIT]);
  assert.equal(scored.outcome === "resolved" && scored.chosen.score.candidate.candidateId, "instruction-submit");
});
```

The scratch copy also printed the scores with `console.log`. Those lines are
dropped above. Nothing else differs.

## Commands run and observed results

- **New test file alone, before the fix** (scratch esbuild runner, label
  `w2-plan-handle-identity`): `tests 6, pass 0, fail 6`, all assertion
  failures. Test 2 got past the literal `visibleText: "Ada Lovelace"` check and
  failed at `tagName` (expected `'input'`).
- **Same, after the fix:** `pass 6, fail 0`.
- **`resolve-plan-node.test.ts` after the fix, before its expectations were
  updated:** 5 of 9 failed, exactly the rows with resolved selector handles.
  After the update, both files together gave `pass 15, fail 0`.
- **Extension check** (scratch bundle of `created-node-identity.test.ts`
  against the real `content/identity/score.ts`, `veto.ts` and domain sources):
  - With this change: `pass 3, fail 0`. Printed: "live-shape identity on the
    right input: score 0.171"; "created identity: veto score 1.000; wrong:
    instruction-plan -0.323 contradicted; instruction-email -0.131
    contradicted; instruction-submit -0.323 contradicted"; "click identity:
    veto score 1.000; drift button -0.131 contradicted".
  - With `resolve-plan-node.ts` and `target-packets.ts` swapped to HEAD in the
    bundle: `pass 1, fail 2`. Test 2 failed with `actual: 'Ada Lovelace'`;
    test 3 failed with `expected: 'Submit'`.
- **`node scripts/structure-audit.mjs`:** "structure-audit: passed (61
  warning(s), 17 baselined)", exit 0. No finding names a plan-resolution file.
- **`pnpm --filter @fluxiq-web-extension/domain check`** (both tsc configs):
  exit 0.
- **`DOMAIN_TEST_BUILD_LABEL=w2-plan-handle-identity node scripts/test-domain.mjs`:**
  exit 1. Result: 600 top-level `ok`, 0 `not ok`, and "1 of 76 domain test
  entries failed to load: src/tests/domain.test.ts".
- **`pnpm --filter @fluxiq-web-extension/domain test`** (regenerates the
  tracked `domain/.test-build`): exit 1 for the same single load failure. Same
  counts: 600 `ok`, 0 `not ok`. All 6 new tests and all 9 resolver tests are
  `ok`.
- **The `domain.test.ts` load failure is not from this change.** The
  supervisor has since confirmed this and assigned it elsewhere. Evidence:
  - Bundling `domain.test.ts` with my two modified files swapped to HEAD gives
    the same `missingRequiredTerms ['end']`.
  - Bundling with all 6 modified domain sources in the bundle swapped to HEAD
    (every worker's), against the current Core dist, gives the same failure.
    `19055b4` changed no domain files.
  - The Core dist is not newer than 17:38:39.
  - A measurement with the test's exact inputs gave
    `{"byteBudget":3761,"usedBytes":3648,"requiredTerms":["enter","choose","submit","verify","start","end"],"missingRequiredTerms":["end"]}`.
    Selected entries by bytes: `builtin.control.start` 418,
    `web.output.dom-click` 757, `web.output.dom-select` 891,
    `web.output.dom-type` 843, `web.output.dom-wait_for_text` 733. The End node
    no longer fits the budget once the structured-parameter catalog text is
    counted.
- **`pnpm check`:** exit 1 at `lab:test`.
  `scripts/lab/tests/live-campaign.test.mjs` failed to load with "The
  requested module '../live-campaign.mjs' does not provide an export named
  'labRunArguments'". `scripts/lab/live-campaign.mjs` is modified and
  `scripts/lab/live-campaign/` is untracked, which is another worker's
  in-flight split, not this change. Because of `&&`, the later stages did not
  run in that invocation.
- **`pnpm -r check`** (the remaining stage, run alone): exit 0. All ten
  packages reported `check: Done`, including `domain` and `apps/extension`.
- Scratch label directories under `domain/.test-build-scratch/` and
  `apps/extension/.test-build-scratch/` were removed afterwards.

## Not verified

- **No live run** (the brief forbids it). The supervisor should rerun
  `pnpm lab run instruction-only-form --live-llm --llm-task create-flow`. The
  Lab run rebuilds the domain host module itself (`logs/host-build.log` in the
  earlier run), and the extension is unchanged. Expected result: the type step
  resolves through the selector strategy with a measured score, not
  `web.target.not_found`.
- **Candidate shapes are hand-built.** The candidate fingerprints in the
  extension check were derived by reading `candidates.ts`,
  `accessible-name.ts`, `label.ts` and the fixture markup, not measured in
  Chromium. In particular, the input's live accessible name ("Name", from the
  wrapping `<label>`) is an assumption until the live run or the content
  harness shows it.
- **The proposed extension test is not placed.** It ran only from the
  scratchpad.
- **`pnpm check` never ran green end to end,** because of the `lab:test`
  failure above. Its stages were verified separately: structure audit exit 0,
  `pnpm -r check` exit 0. `structure:test` passed inside the failing
  invocation, since the log reached `lab:test`.
- **W-1's precedence change was not exercised.** The dispatch-chain assertions
  read signals that are present whichever copy wins.

## Open questions or contradictions found

1. **Brief contradiction.** The brief asks for a test that the created node
   resolves "in the extension's resolver", but grants no path under
   `apps/extension/src`, and `scripts/structure-audit/config.mjs` forbids any
   `domain/src` file, tests included, from importing `apps/extension/src`. The
   test is written and was run from the scratchpad (above). Someone who owns
   `apps/extension/src/content/identity/tests/` should place it.
2. **No change needed in W-1's files.** The identity rides in the recorded
   position (`parameters.element`), so whatever precedence W-1 gives an adapted
   target over the recorded one applies to created nodes unchanged.
3. **Decision taken: model-written `element` beside a handle is replaced, not
   refused.** The handle names the element unambiguously, and a merged
   identity (the model's name with the real selector) would be the weakest
   shape. Refusing with `web.handle.malformed` would also be defensible.
4. **Decision taken: disagreeing pages keep only the shared fields.** Pages
   that agree on a bare handle's address but describe it differently resolve
   with the fields they agree on, not as `ambiguous`. Before this change that
   case resolved with no identity at all, so this adds no new refusals.
5. **Carried as-is from `target-override.ts`: form name recorded as
   `formId`.** The packet's `form` is "the owning form's id or name", and the
   identity writes it as `context.formId`. Nothing scores `context` today (per
   the `targets.ts` notes), but a form that has only a `name` is recorded under
   the id key.
6. **Latent limit.** The extension's candidate `visibleText` is cut at 200
   characters, while the packet carries up to 299. A control whose visible
   text is 200 to 299 characters long therefore compares at Core's partial
   rung, not the exact one. The accessible name (cut at 200 on both sides)
   still corroborates it, so no refusal follows for named controls.
