import { readClientGatewayTraceOperation, type ClientGatewayTraceEvent, type ClientGatewayTraceRecordedOperation, type ClientGatewayTraceRecordedPayload } from "fluxiq/client-gateway";

/** The trace's dispatched commands, in sequence order, read through Core's own operation reader. */
export function recordedReadOperations(events: readonly ClientGatewayTraceEvent[]): ClientGatewayTraceRecordedOperation[] {
  const operations: ClientGatewayTraceRecordedOperation[] = [];
  for (const event of events) {
    if (event.kind !== "outbound" || event.messageType !== "server.execute_action" || event.payload.encoding !== "json") continue;
    const envelope = event.payload.value as Record<string, unknown>;
    const payload = envelope?.payload as ClientGatewayTraceRecordedPayload | undefined;
    if (payload && typeof payload.commandId === "string") operations.push({ ...readClientGatewayTraceOperation(payload), sequence: event.sequence, logicalMs: event.time.logicalMs, commandId: payload.commandId, session: event.session ?? undefined, redacted: event.redactions.length > 0 });
  }
  return operations;
}
