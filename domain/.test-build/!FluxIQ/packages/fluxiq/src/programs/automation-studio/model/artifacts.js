export function createBlankAutomationStudioFlow(input) {
    const now = input.now ?? Date.now();
    return {
        schemaVersion: "0.1",
        flowId: input.flowId,
        ownerKind: input.ownerKind,
        ownerId: input.ownerId,
        name: input.name,
        ...(input.description !== undefined ? { description: input.description } : {}),
        nodes: [],
        edges: [],
        createdAt: now,
        updatedAt: now,
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {})
    };
}
