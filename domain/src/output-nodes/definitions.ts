import type { AutomationNodeParameter, AutomationNodePort } from "fluxiq/automation-studio/nodes";
import type { AutomationStudioNodeDefinition } from "fluxiq/automation-studio/nodes";
import { WEB_AUTOMATION_DOMAIN_ID } from "../constants";
import { webAutomationActionDefinitions } from "../actions/schemas";
import type { WebAutomationActionDefinition } from "../actions/schemas";
import type { WebAutomationActionType } from "../actions/types";
import {
  WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION,
  WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH,
  WEB_AUTOMATION_EXTRACT_LIST_TAGS,
  webAutomationExtractListParameters
} from "./extract-list";

const controlInput: AutomationNodePort = { id: "in", label: "In", valueType: "signal", role: "control" };
const outputPorts: AutomationNodePort[] = [
  { id: "success", label: "Success", valueType: "any", role: "success" },
  { id: "failed", label: "Failed", valueType: "any", role: "failure" }
];

/**
 * The port a later node is wired to for the rows an output saved: the one
 * Core's `builtin.policy.action` and a recording-derived definition declare
 * (Core K3). Core's capture writes `outputs.records` after the dispatch, and a
 * node can only be wired to a port its definition declares, so an output that
 * saves rows declares it -- exactly the outputs that say where their records are.
 */
const recordsPort: AutomationNodePort = { id: "records", label: "Records", valueType: "array", role: "data" };

/**
 * Where in an action's result the page puts a list of records, which Core's
 * record capture and proposal lift read (CD19). Only the list extraction
 * returns records; `./extract-list/records-path.ts` says why the path has two
 * segments and why `web.dom.extract` declares none.
 */
const recordsPathByOutput: Partial<Record<WebAutomationActionType, string>> = {
  "web.dom.extract_list": WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH
};

/**
 * What a model building a Flow reads about an output beyond the action's own
 * label and description (`./extract-list/catalog-text.ts`). Only the list
 * extraction has a request whose shape the catalog cannot otherwise show.
 */
const catalogTextByOutput: Partial<Record<WebAutomationActionType, { description: string; tags: readonly string[] }>> = {
  "web.dom.extract_list": { description: WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION, tags: WEB_AUTOMATION_EXTRACT_LIST_TAGS }
};

/**
 * The post-conditions Core's transition comparison evaluates after the action.
 *
 * Core reads `node.parameterValues.expectedState` (`runtime/executor/
 * expected-transition.ts`) and hands it to the host boundary's
 * `expectationEvaluator` (`runtime/executor/transition-comparison.ts`), which
 * the domain binds over the `web.dom.assert` condition vocabulary. Declaring
 * the parameter here is what puts a value at that path for an authored or
 * generated web node: nothing else in this repository writes it, so without
 * this declaration the comparison has nothing to evaluate and Core falls back
 * to counting keys of an object that is never present.
 *
 * The shape is the assert request plus the element it is about:
 * `{ conditions: [{ kind, selector?, expected?, timeoutMs? }], mode?, timeoutMs? }`,
 * `kind` one of `exists`, `absent`, `text`, `url`, `visible`, `enabled`
 * (`actions/types.ts`, `WebAutomationAssertKind`), `mode` `all` or `any`.
 * It carries no default: an empty condition list would ask the host to prove
 * nothing and report a pass.
 */
/**
 * Core's node-definition metadata key for a verb whose success proves the page
 * is in a stated state (Core `AUTOMATION_STUDIO_NODE_VERIFIES_STATE_METADATA_KEY`,
 * `runtime/flow-change/contracts.ts`). Core's change verdict counts a later
 * node whose definition sets it to `true` as a downstream assertion, which is
 * how a web repair can be verified at all: web outputs declare no route and no
 * outputs, so without it a repaired step that merely succeeded is unverifiable.
 *
 * The literal stands in for Core's constant until Core's built output exports
 * it; then this line becomes an import of that name from
 * `fluxiq/automation-studio`.
 */
const VERIFIES_STATE_METADATA_KEY = "verifiesState";

/**
 * Whether a verb reads the page or changes it, stated per verb so Core can ask
 * the node about repeat safety instead of inferring it from a failure's stage.
 *
 * Core's defensive policy admits a retry after a `verification`-staged failure
 * when the node says it only observes (`automationStudioNodeRepeatIsSafe`), and
 * withholds one for an ambiguous fault when the node says it mutates
 * (`automationStudioNodeMutates`). Without this every web verb was
 * indistinguishable to it: all eighteen dispatch through `builtin.policy.action`,
 * whose side-effect class is `external` unconditionally, so a rule keyed on that
 * class alone was a no-op for every node in this domain.
 *
 * It is the same vocabulary as Core's `AutomationStudioActionEffect`, so it
 * introduces no concept. It is a **total** record rather than two lists, so a
 * verb added later does not compile until somebody has decided whether repeating
 * it is safe -- which is the one question this answers and the one that must not
 * be answered by default.
 *
 * A read is `observe` even when it waits or scrolls: waiting again is harmless
 * and a delta scroll that runs twice moves the viewport, which no downstream step
 * depends on. `web.browser.tab` observes because the operations it performs are
 * idempotent in the sense that matters here -- asking for the same tab twice
 * leaves one tab. Everything that presses, types, uploads, answers a dialog,
 * navigates or downloads mutates, and mutating is the answer whenever there is
 * doubt: this record is read to decide whether an action may be repeated, so the
 * cost of being wrong is one-sided.
 */
const WEB_AUTOMATION_ACTION_EFFECT: Readonly<Record<WebAutomationActionType, "observe" | "mutate">> = Object.freeze({
  "web.browser.navigate": "mutate",
  "web.browser.download": "mutate",
  "web.browser.tab": "observe",
  "web.dom.click": "mutate",
  "web.dom.type": "mutate",
  "web.dom.clear": "mutate",
  "web.dom.select": "mutate",
  "web.dom.keypress": "mutate",
  "web.dom.check": "mutate",
  "web.dom.upload": "mutate",
  "web.dom.dialog": "mutate",
  "web.dom.scroll": "observe",
  "web.dom.wait_for_selector": "observe",
  "web.dom.wait_for_text": "observe",
  "web.dom.extract": "observe",
  "web.dom.extract_list": "observe",
  "web.dom.capture_snapshot": "observe",
  "web.dom.assert": "observe"
});

/**
 * The outputs that prove state rather than change it: each succeeds only when
 * the page shows what the node asked for. A click, a typed value or a
 * navigation succeeding says nothing about whether the page then looked right,
 * and a read (`extract`, `extract_list`, `capture_snapshot`) succeeds on
 * whatever it finds.
 */
const stateVerifyingOutputs: ReadonlySet<WebAutomationActionType> = new Set<WebAutomationActionType>([
  "web.dom.assert",
  "web.dom.wait_for_text",
  "web.dom.wait_for_selector"
]);

const expectedStateParameter: AutomationNodeParameter = {
  id: "expectedState",
  label: "Expected State",
  description: "Post-conditions checked after this action, as web.dom.assert conditions: { conditions: [{ kind, selector, expected }], mode, timeoutMs }.",
  valueType: "object",
  ui: { control: "value" }
};

export function webAutomationOutputNodeId(outputId: WebAutomationActionType): string {
  return `web.output.${outputId.replace(/^web\./, "").replace(/\./g, "-")}`;
}

export const webAutomationOutputNodeDefinitions: AutomationStudioNodeDefinition[] = webAutomationActionDefinitions.map((definition) =>
  createWebAutomationOutputNodeDefinition(definition)
);

export function createWebAutomationOutputNodeDefinition(definition: WebAutomationActionDefinition): AutomationStudioNodeDefinition {
  const requiredParameters = new Set(
    Array.isArray(definition.parameterSchema.required)
      ? definition.parameterSchema.required.filter((value): value is string => typeof value === "string")
      : []
  );
  const recordsPath = recordsPathByOutput[definition.actionType];
  const catalogText = catalogTextByOutput[definition.actionType];
  return {
    schemaVersion: "0.1",
    id: webAutomationOutputNodeId(definition.actionType),
    version: "1.0.0",
    label: definition.label,
    description: catalogText?.description ?? definition.description,
    category: "web",
    source: {
      kind: "importer",
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      packageId: "@fluxiq-web-extension/domain",
      implementationKey: definition.actionType
    },
    availability: { kind: "domain", domainId: WEB_AUTOMATION_DOMAIN_ID },
    capabilities: { executable: true, stateAware: true, recordable: true },
    requiredRuntimeCapabilities: ["web.actions"],
    // **No node is privileged or approval-gated for being the kind of action it
    // is (t166).** These two flags were `!safeOutput` -- true for every output
    // that touches the page, which is every click, keypress, navigation, scroll,
    // selection and upload -- and Core reads them as permission rather than as
    // description. `runtime/llm/harness-options/registry.ts` drops an option
    // whose `requiresOperatorApproval` is true and whose tool id nobody
    // pre-approved, silently, so the model is not offered the tool at all; and
    // `runtime/flow-bootstrap/plan/risk.ts` marks any plan containing a
    // privileged node `high`, which is what keeps a repair from applying itself.
    // Neither asks what the action would actually cause. What it would cause is
    // declared per action and gated by Core's action permission gate, which is
    // untouched and is where a delete or a checkout is still stopped and put to
    // the person. `requiredPermissions` stays: that is who may operate this
    // domain at all, not whether this press is allowed.
    safety: {
      privileged: false,
      requiresOperatorApproval: false,
      requiredPermissions: ["web-automation.action"]
    },
    outputAction: { fixedOutputId: definition.actionType },
    inputs: [controlInput],
    outputs: recordsPath ? [...outputPorts, recordsPort] : outputPorts,
    // Every web parameter may be filled from state unless it says otherwise.
    // Only `recordOutput` does, for the reason Core gives its own: a binding
    // could replace the dataset schema, and with it the excluded fields.
    parameters: [...parametersForOutput(definition.actionType), expectedStateParameter].map((parameter) => ({
      ...parameter,
      ...(requiredParameters.has(parameter.id) ? { required: true } : {}),
      allowStateBinding: parameter.allowStateBinding ?? true
    })),
    icon: iconForOutput(definition.actionType),
    tags: ["web-automation", "output", ...(catalogText?.tags ?? [])],
    metadata: {
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      outputId: definition.actionType,
      parameterSchema: definition.parameterSchema,
      // Read or change: the question Core's defensive policy asks before it
      // repeats an action. See WEB_AUTOMATION_ACTION_EFFECT above.
      effect: WEB_AUTOMATION_ACTION_EFFECT[definition.actionType],
      // Core's element-target preparation (`runtime/io-policy.ts`) resolves the
      // recorded fingerprint against the runtime candidates, and applies its
      // confidence floor, only for an output that declares this. The flag is
      // derived from the action's own schema row rather than listed by hand, so
      // it cannot drift from it: an action that requires a selector cannot run
      // without an element, and an action that does not — a delta scroll, a
      // key press to the focused element, a URL assertion, a tab operation —
      // must not declare it, because Core fails an action outright when a
      // declared element target has no fingerprint to resolve.
      ...(requiredParameters.has("selector") ? { elementTarget: true } : {}),
      ...(recordsPath ? { recordsPath } : {}),
      ...(stateVerifyingOutputs.has(definition.actionType) ? { [VERIFIES_STATE_METADATA_KEY]: true } : {})
    }
  };
}

function parametersForOutput(outputId: WebAutomationActionType): AutomationNodeParameter[] {
  const selectorParameters: AutomationNodeParameter[] = [
    { id: "target", label: "Adapted Target", valueType: "object", ui: { control: "value" } },
    { id: "selector", label: "Selector", valueType: "string", ui: { control: "text", placeholder: "CSS selector" } },
    { id: "element", label: "Element", valueType: "object", ui: { control: "value" } },
    { id: "visualTarget", label: "Visual Target", valueType: "object", ui: { control: "value" } },
    { id: "timeoutMs", label: "Timeout", valueType: "number", defaultValue: 10_000 }
  ];
  // A structured parameter is an `object` whose shape is the matching field of
  // `WebAutomationActionCommand`, declared in `actions/schemas.ts`. The flat
  // scalars beside it stay authorable, and a recorded action fills them.
  const structured = (id: string, label: string): AutomationNodeParameter => ({ id, label, valueType: "object", ui: { control: "value" } });
  if (outputId === "web.browser.navigate") return [
    { id: "url", label: "URL", valueType: "string", required: true, ui: { control: "text", placeholder: "https://example.com" } },
    { id: "newTab", label: "New Tab", valueType: "boolean", defaultValue: false }
  ];
  if (outputId === "web.dom.type") return [...selectorParameters, { id: "text", label: "Text", valueType: "string", defaultValue: "", ui: { control: "textarea" } }];
  if (outputId === "web.dom.select") return [...selectorParameters, { id: "value", label: "Value", valueType: "string", defaultValue: "", ui: { control: "text" } }, structured("option", "Option")];
  if (outputId === "web.dom.keypress") return [...selectorParameters, { id: "key", label: "Key", valueType: "string", defaultValue: "", ui: { control: "text" } }, structured("modifiers", "Modifiers")];
  if (outputId === "web.dom.scroll") return [
    ...selectorParameters,
    { id: "x", label: "X", valueType: "number", defaultValue: 0 },
    { id: "y", label: "Y", valueType: "number", defaultValue: 0 },
    { id: "smooth", label: "Smooth", valueType: "boolean", defaultValue: false },
    structured("scroll", "Scroll Mode")
  ];
  if (outputId === "web.dom.extract") return [...selectorParameters, structured("extract", "Read")];
  if (outputId === "web.dom.wait_for_selector") return [...selectorParameters, structured("wait", "Condition")];
  if (outputId === "web.dom.wait_for_text") return [
    { id: "text", label: "Text", valueType: "string", required: true, ui: { control: "text" } },
    { id: "timeoutMs", label: "Timeout", valueType: "number", defaultValue: 10_000 },
    structured("wait", "Condition")
  ];
  if (outputId === "web.dom.capture_snapshot") return [];
  if (outputId === "web.dom.check") return [...selectorParameters, { id: "checked", label: "Checked", valueType: "boolean", defaultValue: true }];
  if (outputId === "web.dom.assert") return [...selectorParameters, structured("assert", "Assertion")];
  if (outputId === "web.dom.extract_list") return webAutomationExtractListParameters();
  if (outputId === "web.dom.upload") return [...selectorParameters, structured("upload", "Files")];
  if (outputId === "web.dom.dialog") return [structured("dialog", "Dialog")];
  if (outputId === "web.browser.tab") return [structured("tab", "Tab")];
  if (outputId === "web.browser.download") return [structured("download", "Download")];
  return selectorParameters;
}

function iconForOutput(outputId: WebAutomationActionType): string {
  if (outputId === "web.browser.navigate") return "navigation";
  if (outputId === "web.dom.click") return "mouse-pointer-click";
  if (outputId === "web.dom.type") return "text-cursor-input";
  if (outputId === "web.dom.extract") return "scan-search";
  if (outputId === "web.dom.capture_snapshot") return "camera";
  if (outputId === "web.dom.check") return "square-check";
  if (outputId === "web.dom.assert") return "circle-check";
  if (outputId === "web.dom.extract_list") return "table";
  if (outputId === "web.dom.upload") return "upload";
  if (outputId === "web.dom.dialog") return "message-square";
  if (outputId === "web.browser.tab") return "app-window";
  if (outputId === "web.browser.download") return "download";
  return "square-dot";
}
