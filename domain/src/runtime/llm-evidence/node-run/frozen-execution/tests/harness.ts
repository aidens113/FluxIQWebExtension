import type { AutomationStudioLlmRerunCaptureSnapshot, AutomationStudioLlmRerunExecutionAccess } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { webAutomationCheckWaitParameters } from "../../../../../actions/check-wait";
import { createWebLlmTargetPackets } from "../../../plan-resolution";
import { createWebLlmExtractionHandles } from "../../../structure";
import type { WebLlmEvidenceGateway, WebLlmEvidenceToolRequest } from "../../../capture";
import type { WebLlmSnapshotBinding } from "../../../sanitize";
import { present } from "../../../present";
import { createWebNodeArrivals, createWebNodeHeldLiterals, createWebNodeOwnLayers, createWebNodeShownAddresses, runWebOutputNode } from "../..";
import type { WebNodeRun } from "../../context";
import { createWebNodeFrozenExecution, webNodeFinalDispatch } from "..";
import type { WebNodeFrozenCommand, WebNodeFrozenResult } from "../types";

export const FLOW = { projectId: "project.one", flowId: "flow.one" };
export const NOW = 1_800_000_000_000;
export const PAGE = "https://workspace.test/forms";
export const TYPE = "web.output.dom-type";
export const SNAPSHOT = "web.output.dom-capture_snapshot";
export const EXTRACT = "web.output.dom-extract_list";

/** Generic provider-free host fixture; never opens a browser. */
export function frozenHarness() {
  const snapshots: AutomationStudioLlmRerunCaptureSnapshot[] = [];
  const reports: { capsule: object; dispatch: AutomationStudioLlmRerunCaptureSnapshot["dispatch"] }[] = [];
  const receipts: { command: WebNodeFrozenCommand; result: WebNodeFrozenResult }[] = [];
  let selected: AutomationStudioLlmRerunCaptureSnapshot | undefined;
  let capsule: object | undefined;
  let refused = false;
  let consumeCalls = 0;
  let consumptionAllowed = true;
  let reporting: "accepted" | "refused" | "throws" | "absent" = "accepted";
  let finalObservation = true;
  let serial = 0;
  let controls = [field("A", "#original")];
  let timeOrigin = 123;
  let location = PAGE;
  let sourceId = "tab:4:frame:0";
  let stores = { targets: createWebLlmTargetPackets(), extractions: createWebLlmExtractionHandles() };
  const commands: WebNodeFrozenCommand[] = [];
  let mainAnswer: (command: WebNodeFrozenCommand) => WebNodeFrozenResult = () => ({ status: "succeeded", payload: { value: "current read", extracted: [{ name: "Current row" }] } });
  const binding = createWebNodeFrozenExecution({
    capture: () => selected !== undefined || refused ? { kind: "unavailable", reason: "not_capturing" } : { kind: "capture", publish(snapshot) {
      snapshots.push(snapshot);
      return { kind: "accepted" };
    } },
    execution(input) {
      if (refused) return { kind: "refused", reason: "scope_changed" };
      if (selected === undefined) return { kind: "ordinary" };
      if (selected.owner !== input.owner || selected.generation !== input.generation || JSON.stringify(input.value) !== JSON.stringify(selected.adapterValue)) return { kind: "refused", reason: "adapter_changed" };
      return present<Extract<AutomationStudioLlmRerunExecutionAccess, { kind: "selected" }>>({
        kind: "selected", capsule: capsule ?? selected.capsule,
        consume(actual) {
          consumeCalls += 1;
          return consumptionAllowed && actual === selected?.capsule ? { kind: "consumed" } : { kind: "refused", reason: "capsule_changed" };
        },
        reportDispatch: reporting === "absent" ? undefined : (actual, dispatch) => {
          reports.push({ capsule: actual, dispatch });
          if (reporting === "throws") throw new Error("private report failure");
          return reporting === "accepted" && actual === selected?.capsule ? { kind: "accepted" } : { kind: "refused", reason: "dispatch_unproven" };
        }
      });
    }
  });
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    async executeAction(sessionId, command) {
      const actual = { ...command, parameters: webAutomationCheckWaitParameters(command.actionType, command.parameters) };
      if (finalObservation) webNodeFinalDispatch(sessionId, command, actual);
      commands.push(structuredClone(actual));
      if (command.actionType === "web.dom.capture_snapshot") {
        const raw = {
          url: location, title: "Workspace", frame: { isTop: true }, viewport: { width: 1200, height: 800, scrollX: 0, scrollY: 0 }, interactiveElements: controls,
          evidence: { captureOptions: { includeHidden: command.parameters.includeHidden === true }, elements: { scanned: controls.length, candidates: controls.length, matched: controls.length, returned: controls.length, truncated: false }, loading: { documentState: "complete", busy: false, pendingNavigation: false }, navigation: { timeOrigin } }
        };
        const result: WebNodeFrozenResult = { status: "succeeded", payload: { sourceId, snapshot: raw } };
        receipts.push({ command: actual, result });
        return result;
      }
      const result = mainAnswer(actual);
      receipts.push({ command: actual, result });
      return result;
    }
  };
  const remember = (page: WebLlmSnapshotBinding) => stores.targets.remember(FLOW, page);
  const base = {
    gateway, sessionId: "session.one", frozenExecution: binding,
    restamp: (page: WebLlmSnapshotBinding) => page,
    shown: remember, looked: (page: WebLlmSnapshotBinding) => stores.targets.rememberLook(FLOW, page),
    arrivals: createWebNodeArrivals(), addresses: createWebNodeShownAddresses(), layers: createWebNodeOwnLayers(), held: createWebNodeHeldLiterals()
  };
  const request = (value: JsonObject, options: Partial<WebLlmEvidenceToolRequest> = {}): WebLlmEvidenceToolRequest => ({ ...FLOW, callId: `call.${++serial}`, toolId: "core.run_node", value, referenceNow: NOW, ...options });
  const run = (value: JsonObject, options: Partial<WebLlmEvidenceToolRequest> = {}) => runWebOutputNode({ ...base, stores, request: request(value, options) });
  return {
    binding, base, commands, snapshots, reports, receipts, request, run,
    get stores() { return stores; },
    get consumeCalls() { return consumeCalls; },
    select(snapshot = snapshots.at(-1)!, foreign?: object) {
      selected = snapshot;
      capsule = foreign;
    },
    refuse() { refused = true; },
    refuseConsumption() { consumptionAllowed = false; },
    reporting(mode: typeof reporting) { reporting = mode; },
    omitFinalObservation() { finalObservation = false; },
    ordinary() {
      selected = undefined;
      capsule = undefined;
      refused = false;
    },
    replaceControls(next: JsonObject[]) { controls = next; },
    replaceMaps() { stores = { targets: createWebLlmTargetPackets(), extractions: createWebLlmExtractionHandles() }; },
    document(next: number) { timeOrigin = next; },
    location(next: string) { location = next; },
    source(next: string) { sourceId = next; },
    answer(next: typeof mainAnswer) { mainAnswer = next; },
    mainCommands() { return commands.filter((command) => command.actionType !== "web.dom.capture_snapshot"); },
    asRun(value: JsonObject): WebNodeRun { return { ...base, stores, request: request(value) }; }
  };
}

export function field(key: string, selector: string): JsonObject {
  return { tagName: "input", selector, inputType: "text", accessibleName: "Display name", attributes: { "data-testid": "display-name" }, context: { record: { key, keyAttribute: "data-profile-id", text: `Profile ${key}` } } };
}
