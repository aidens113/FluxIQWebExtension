export class ComponentRegistry {
    components = new Map();
    register(definition) {
        const nodeType = definition.spec.nodeType.trim();
        if (!nodeType) {
            throw new Error("Component node type is required");
        }
        if (this.components.has(nodeType)) {
            throw new Error(`Duplicate component node type: ${nodeType}`);
        }
        this.components.set(nodeType, definition);
    }
    maybeGet(nodeType) {
        return this.components.get(nodeType.trim()) ?? null;
    }
    specs() {
        return [...this.components.values()]
            .map((definition) => definition.spec)
            .sort((left, right) => left.nodeType.localeCompare(right.nodeType));
    }
}
export function registerBasicComponents(registry) {
    registry.register({
        spec: {
            nodeType: "flow.noop",
            displayName: "No Operation",
            category: "Flow",
            description: "Completes immediately without changing flow state.",
            params: [],
            resultStates: ["success"]
        },
        handler: () => ({ state: "success", message: "noop" })
    });
    registry.register({
        spec: {
            nodeType: "flow.success",
            displayName: "Success",
            category: "Flow",
            description: "Marks the current branch successful.",
            params: [],
            resultStates: ["success"]
        },
        handler: () => ({ state: "success", message: "success" })
    });
    registry.register({
        spec: {
            nodeType: "flow.fail",
            displayName: "Fail",
            category: "Flow",
            description: "Marks the current branch failed.",
            params: [],
            resultStates: ["failed"]
        },
        handler: () => ({ state: "failed", message: "failed" })
    });
}
