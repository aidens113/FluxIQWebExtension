import { CLIENT_GATEWAY_ACTIVITY_CAPABILITY_ID, type ClientGatewayCapability } from "@fluxiq/client-gateway-websocket";
import type { FluxIQRuntimeCapability } from "fluxiq/runtime";
import { WEB_AUTOMATION_DOMAIN_ID } from "../constants";
import { WEB_AUTOMATION_ACTION_TYPES } from "../actions/types";
import { WEB_AUTOMATION_FACT_CHECK_ACTION_TYPE } from "../actions/fact-check";
import { WEB_AUTOMATION_INPUT_IDS } from "../io/input-model";

/** The gateway capability a client declares when its snapshot answers `detectStructure`. */
export const WEB_AUTOMATION_STRUCTURE_DETECTION_CAPABILITY_ID = "web.structure.detection";

/**
 * The gateway capability a client declares when it answers the batched,
 * zero-wait fact check (plan B1, Core C9) under
 * `WEB_AUTOMATION_FACT_CHECK_ACTION_TYPE`. A Flow that gates on facts declares
 * `web.facts@1` in `metadata.requires` (Core C10).
 */
export const WEB_AUTOMATION_FACTS_CAPABILITY_ID = "web.facts";

/** The fact kinds `web.facts` version 1 answers, as a fact condition's `fact` names them. */
export const WEB_AUTOMATION_FACT_KINDS = Object.freeze([
  "exists", "absent", "visible", "enabled", "text", "url", "value", "count", "dialog", "checked", "selected"
] as const);

const FACTS_CAPABILITY_METADATA = {
  domainId: WEB_AUTOMATION_DOMAIN_ID,
  version: 1,
  actionType: WEB_AUTOMATION_FACT_CHECK_ACTION_TYPE,
  kinds: [...WEB_AUTOMATION_FACT_KINDS],
  dialogKinds: ["consent", "rate_limit", "robot_check", "promotion", "assistant"]
};

/**
 * The gateway capability a client declares when it reconciles a command in
 * flight (plan B3, Core C8): it keeps a record of every action it sends to a
 * page, reports one its background worker lost as `interrupted` with its effect
 * unknown after the next `session_ready`, and answers a repeated command id
 * with the result it already has instead of acting again. A Flow that relies
 * on it declares `web.actions.reconcile@1` in `metadata.requires` (Core C10).
 */
export const WEB_AUTOMATION_RECONCILE_CAPABILITY_ID = "web.actions.reconcile";

const RECONCILE_CAPABILITY_METADATA = {
  domainId: WEB_AUTOMATION_DOMAIN_ID,
  version: 1,
  interruptedStatus: "interrupted",
  dedupe: "commandId"
};

export type WebAutomationClientGatewayCapability = ClientGatewayCapability & {
  domainId?: string | null;
  inputIds?: string[];
  outputIds?: string[];
};

export const webAutomationRuntimeCapabilities: FluxIQRuntimeCapability[] = [
  {
    id: "web.actions",
    label: "Web actions",
    kind: "action",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    actionTypes: WEB_AUTOMATION_ACTION_TYPES,
    outputIds: WEB_AUTOMATION_ACTION_TYPES
  },
  {
    id: "web.snapshots",
    label: "Web snapshots",
    kind: "snapshot",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    inputIds: [WEB_AUTOMATION_INPUT_IDS.recordingEvidence]
  },
  {
    id: "web.state",
    label: "Web state",
    kind: "state",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    inputIds: [WEB_AUTOMATION_INPUT_IDS.browserState, WEB_AUTOMATION_INPUT_IDS.recordingEvidence]
  },
  {
    id: WEB_AUTOMATION_FACTS_CAPABILITY_ID,
    label: "Web facts",
    kind: "state",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    metadata: FACTS_CAPABILITY_METADATA
  },
  {
    id: WEB_AUTOMATION_RECONCILE_CAPABILITY_ID,
    label: "Web action reconciliation",
    kind: "action",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    metadata: RECONCILE_CAPABILITY_METADATA
  },
  {
    id: "web.flow-runtime",
    label: "Web flow runtime",
    kind: "flow",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    metadata: { executionHost: "fluxiq-core", actionTransport: "extension" }
  }
];

export const webAutomationGatewayCapabilities: WebAutomationClientGatewayCapability[] = [
  {
    id: "web.context.state",
    label: "Web context state",
    kind: "state",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    inputIds: [WEB_AUTOMATION_INPUT_IDS.browserState],
    metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID, inputIds: [WEB_AUTOMATION_INPUT_IDS.browserState] }
  },
  {
    id: "web.structured.snapshot",
    label: "Structured web snapshots",
    kind: "snapshot",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    inputIds: [WEB_AUTOMATION_INPUT_IDS.recordingEvidence],
    metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID, inputIds: [WEB_AUTOMATION_INPUT_IDS.recordingEvidence] }
  },
  {
    // `web.dom.capture_snapshot` answers `detectStructure` with the repeating
    // structure it found (`extraction/structure-detection.ts`). A flag on an
    // existing observe-only action rather than an action of its own, so it
    // lists no action type: nothing new is executable. The authoring evidence
    // runtime refuses its detection tool for a client that does not declare it.
    id: WEB_AUTOMATION_STRUCTURE_DETECTION_CAPABILITY_ID,
    label: "Repeating-structure detection",
    kind: "snapshot",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID, actionType: "web.dom.capture_snapshot", parameter: "detectStructure" }
  },
  {
    // The batched fact check (plan B1). Its command travels under its own
    // action type and is answered without a wait, a chat card or a recorded
    // event; like structure detection it lists no action type, so declaring it
    // makes nothing a Flow could author or run as a step.
    id: WEB_AUTOMATION_FACTS_CAPABILITY_ID,
    label: "Web facts",
    kind: "state",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    metadata: FACTS_CAPABILITY_METADATA
  },
  {
    id: "web.recording.events",
    label: "Web recording events",
    kind: "recording",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID }
  },
  {
    id: "web.actions",
    label: "Web actions",
    kind: "action",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    actionTypes: WEB_AUTOMATION_ACTION_TYPES,
    outputIds: WEB_AUTOMATION_ACTION_TYPES,
    metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID, outputIds: WEB_AUTOMATION_ACTION_TYPES }
  },
  {
    // In-flight command reconciliation (plan B3). Like the fact check it lists
    // no action type: it changes how the actions above are answered, and makes
    // nothing new executable.
    id: WEB_AUTOMATION_RECONCILE_CAPABILITY_ID,
    label: "Web action reconciliation",
    kind: "action",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    metadata: RECONCILE_CAPABILITY_METADATA
  },
  {
    // Asks Core for `server.activity`: what it is doing now, for the panel's
    // chat and the on-page overlay. Receive-only and domain-neutral, so it
    // names no domain, input, output or action type -- nothing becomes
    // executable by declaring it.
    id: CLIENT_GATEWAY_ACTIVITY_CAPABILITY_ID,
    label: "Live activity",
    kind: "custom"
  }
];
