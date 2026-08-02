export function validateFlow(flow) {
    const issues = [];
    const nodeIds = new Set(flow.nodes.map((node) => node.id));
    if (!flow.id.trim()) {
        issues.push({ severity: "error", code: "flow.id.required", message: "Flow id is required" });
    }
    if (!nodeIds.has(flow.start)) {
        issues.push({
            severity: "error",
            code: "flow.start.missing",
            message: `Start node '${flow.start}' does not exist`
        });
    }
    for (const edge of flow.edges) {
        if (!nodeIds.has(edge.from)) {
            issues.push({
                severity: "error",
                code: "flow.edge.source_missing",
                message: `Edge source '${edge.from}' does not exist`
            });
        }
        if (!nodeIds.has(edge.to)) {
            issues.push({
                severity: "error",
                code: "flow.edge.target_missing",
                message: `Edge target '${edge.to}' does not exist`
            });
        }
    }
    return issues;
}
