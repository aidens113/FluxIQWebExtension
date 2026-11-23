/** A generic protocol probe: confirming can lead only to a real read or an End. */
export function offlinePreflightProbeGraph() {
  return {
    nodes: [
      { id: "start", definitionId: "builtin.control.start", parameterValues: { emitTimestamp: false } },
      { id: "confirm-read", definitionId: "builtin.routine.approval", parameterValues: { prompt: "Read this fixture page for the offline preflight?", timeoutMs: 0, defaultRoute: "rejected" } },
      { id: "read-page", definitionId: "builtin.policy.action", parameterValues: { outputId: "web.dom.capture_snapshot", parameters: {} } },
      { id: "done", definitionId: "builtin.control.end", parameterValues: { status: "success" } },
    ],
    edges: [
      { id: "start-confirm", sourceNodeId: "start", targetNodeId: "confirm-read", sourcePortId: "success", targetPortId: "in" },
      { id: "confirm-read", sourceNodeId: "confirm-read", targetNodeId: "read-page", sourcePortId: "approved", targetPortId: "in" },
      { id: "confirm-end", sourceNodeId: "confirm-read", targetNodeId: "done", sourcePortId: "rejected", targetPortId: "in" },
      { id: "read-end", sourceNodeId: "read-page", targetNodeId: "done", sourcePortId: "success", targetPortId: "in" },
    ],
  };
}
