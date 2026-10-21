// The request Core's trace matcher hands the web domain's reevaluator when a
// trial sends read B where the trace recorded read A, built from what a trace
// of A would hold (Core's `ClientGatewayTraceReevaluationRequest`):
// - `command` and `recordedCommand`: B's and A's `server.execute_action`
//   payloads, the read under `parameters.extractList` as a Flow sends it;
// - `operation`, `recorded` and `fields`: Core's own reading of both payloads
//   and where they differ (`readClientGatewayTraceOperation`,
//   `clientGatewayTraceOperationDifferences`);
// - `recordedResult`: live A's `client.action_result`, built by the domain's
//   builder the background answers with and carrying the capture's references
//   on `metadata.trace` (the background's own `withTraceMetadata`);
// - `artifacts` and `readArtifact`: the captured parts, by digest.
// Every payload goes through JSON, as a trace records and reads it back.

import { gatewayActionResultFromBrowserResult } from "@fluxiq-web-extension/domain/client";
import { clientGatewayTraceOperationDifferences, readClientGatewayTraceOperation, type ClientGatewayTraceRecordedPayload, type ClientGatewayTraceReevaluationRequest } from "fluxiq/client-gateway";
import { withTraceMetadata } from "../../../../../src/background/trace-capture/index.js";
import type { BrowserActionCommand, BrowserActionResult } from "../../../../../src/shared/protocol.js";
import type { PageCapture } from "./capture-snapshot.js";

export function reevaluationRequest(input: { commandB: BrowserActionCommand; commandA: BrowserActionCommand; liveA: BrowserActionResult; capture: PageCapture }): ClientGatewayTraceReevaluationRequest {
  const command = asRecorded(gatewayCommand(input.commandB));
  const recordedCommand = asRecorded(gatewayCommand(input.commandA));
  const operation = readClientGatewayTraceOperation(command);
  const recordedOperation = readClientGatewayTraceOperation(recordedCommand);
  const recordedResult = asRecorded(withTraceMetadata(gatewayActionResultFromBrowserResult(input.liveA), input.capture.trace));
  const { bytes, trace } = input.capture;
  return {
    traceId: "offline-reads",
    command,
    operation,
    recorded: { ...recordedOperation, sequence: 1, logicalMs: 0, commandId: input.commandA.commandId, session: undefined, redacted: false },
    recordedCommand,
    fields: clientGatewayTraceOperationDifferences(recordedOperation, operation),
    recordedResult,
    artifacts: trace.artifacts.map((artifact, index) => ({ id: `artifact-${index}`, sha256: artifact.sha256, mediaType: artifact.mediaType, sequence: 2 + index })),
    readArtifact: async (sha256) => bytes.get(sha256)
  };
}

function gatewayCommand(command: BrowserActionCommand) {
  return { commandId: command.commandId, actionType: command.actionType, timeoutMs: command.timeoutMs, parameters: { extractList: command.extractList } };
}

function asRecorded(value: object): ClientGatewayTraceRecordedPayload {
  return JSON.parse(JSON.stringify(value)) as ClientGatewayTraceRecordedPayload;
}
