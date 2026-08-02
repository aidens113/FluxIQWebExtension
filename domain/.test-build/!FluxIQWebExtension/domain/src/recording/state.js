import { WEB_AUTOMATION_DOMAIN_ID, WEB_AUTOMATION_SCHEMA_VERSION } from "../constants";
export const WEB_AUTOMATION_STATE_NAMESPACE = "web";
export function createWebAutomationInitialState(timestamp = Date.now()) {
    return {
        timestamp,
        namespaces: {
            [WEB_AUTOMATION_STATE_NAMESPACE]: {
                schemaId: WEB_AUTOMATION_DOMAIN_ID,
                schemaVersion: WEB_AUTOMATION_SCHEMA_VERSION,
                values: {},
                metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID }
            }
        }
    };
}
export function withWebStateValue(snapshot, path, value, input = {}) {
    const namespace = snapshot.namespaces[WEB_AUTOMATION_STATE_NAMESPACE] ?? {
        schemaId: WEB_AUTOMATION_DOMAIN_ID,
        schemaVersion: WEB_AUTOMATION_SCHEMA_VERSION,
        values: {}
    };
    const observedAt = input.observedAt ?? Date.now();
    const nextValue = {
        type: inferStateType(value),
        value,
        observedAt,
        ...(input.sourceId !== undefined ? { sourceId: input.sourceId } : {}),
        volatility: "normal",
        comparable: true,
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {})
    };
    return {
        ...snapshot,
        timestamp: observedAt,
        namespaces: {
            ...snapshot.namespaces,
            [WEB_AUTOMATION_STATE_NAMESPACE]: {
                ...namespace,
                values: {
                    ...namespace.values,
                    [path]: nextValue
                }
            }
        }
    };
}
function inferStateType(value) {
    if (typeof value === "string")
        return "string";
    if (typeof value === "number")
        return Number.isInteger(value) ? "integer" : "number";
    if (typeof value === "boolean")
        return "boolean";
    return "json";
}
