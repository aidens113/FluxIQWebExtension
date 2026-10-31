import type { AutomationStudioLlmRerunCaptureAccess, AutomationStudioLlmRerunExecutionAccess, AutomationStudioLlmRerunExecutionInput, AutomationStudioLlmRerunExecutionRefused } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import type { WebTargetScope } from "../../../target-reacquire/identity";
import type { WebLlmEvidenceGateway } from "../../capture";
import type { WebLlmSnapshotBinding } from "../../sanitize";
import type { WebRunnableNode } from "../catalog";
import type { WebNodeRun } from "../context";

export type WebNodeFrozenCommand = Parameters<WebLlmEvidenceGateway["executeAction"]>[1];
export type WebNodeFrozenResult = Awaited<ReturnType<WebLlmEvidenceGateway["executeAction"]>>;
export type WebNodeFrozenScope = WebTargetScope & Required<Pick<WebTargetScope, "sessionId" | "browserTabId" | "browserFrameId" | "resetResource" | "location" | "timeOrigin">>;
export type WebNodeFrozenCall = Readonly<{
  definitionId: string;
  definitionVersion: string;
  buildSlot: string;
  startLocation: string | undefined;
  referenceNow: number;
  value: JsonObject;
  /** Snapshot taken at run entry, before any domain shaping or held restoration. */
  adapterValue: JsonObject;
  written: JsonObject;
  parameters: JsonObject;
  command: WebNodeFrozenCommand;
  scope: WebNodeFrozenScope;
  subject: object;
  subjectKind: "element" | "query" | "page";
}>;

export type WebNodeFrozenSelection = { kind: "ordinary" } | { kind: "refused" } | {
  kind: "selected";
  call: WebNodeFrozenCall;
  consume(): boolean;
  capture: WebNodeDispatchCapture;
  finish(): WebNodeFrozenDispatchReport;
};

export type WebNodeFrozenDispatchReport =
  | { kind: "accepted" }
  | AutomationStudioLlmRerunExecutionRefused
  | { kind: "unavailable"; reason: "capsule_unconsumed" | "dispatch_unproven" | "report_unavailable" | "report_closed" };

/** Main dispatches only; page looks and effect checks are not node attempts. */
export type WebNodeDispatchCapture = {
  dispatch(command: WebNodeFrozenCommand, execute: () => Promise<WebNodeFrozenResult>): Promise<WebNodeFrozenResult>;
  /** The existing producer refreshed only a concrete locator and identity. */
  refreshed(parameters: JsonObject): void;
};

export type WebNodeFrozenCapture = WebNodeDispatchCapture & {
  parameters: JsonObject;
  publish(page?: WebLlmSnapshotBinding): void;
};

export type WebNodeFrozenCaptureInput = {
  run: WebNodeRun;
  node: WebRunnableNode;
  value: JsonObject;
  adapterValue: JsonObject | undefined;
  written: JsonObject;
  parameters: JsonObject;
  before?: WebLlmSnapshotBinding;
  look(options: { includeHidden: true; scope: WebTargetScope }): Promise<WebLlmSnapshotBinding | undefined>;
};

export type WebNodeFrozenExecution = {
  /** Copy only an active producer's entry value; malformed/unproven calls keep their ordinary path. */
  entry(value: JsonObject): WebNodeFrozenEntry;
  select(run: Pick<WebNodeRun, "request" | "sessionId">): WebNodeFrozenSelection;
  capture(input: WebNodeFrozenCaptureInput): Promise<WebNodeFrozenCapture | undefined>;
};

export type WebNodeFrozenCoreAccess = {
  capture(): AutomationStudioLlmRerunCaptureAccess;
  execution(input: AutomationStudioLlmRerunExecutionInput): AutomationStudioLlmRerunExecutionAccess;
};

export type WebNodeFrozenCaptureHost = {
  owner: object;
  generation: object;
  core: WebNodeFrozenCoreAccess;
  subject(scope: WebNodeFrozenScope, kind: WebNodeFrozenCall["subjectKind"], parameters: JsonObject): object;
  retain(call: WebNodeFrozenCall): object;
};

export type WebNodeFrozenScopeInput = {
  sessionId: string;
  parameters: JsonObject;
  before: WebLlmSnapshotBinding | undefined;
  look: WebNodeFrozenCaptureInput["look"];
};

/** Entry-copy failure closes provenance without changing an ordinary call's behavior. */
export type WebNodeFrozenEntry =
  | { kind: "captured"; value: JsonObject }
  | { kind: "unavailable"; reason: "inactive" | "adapter_value_unreadable" };

