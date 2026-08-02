export function defineBuiltinNode(definition) {
    const normalized = normalizeVisualPorts(definition);
    return {
        ...normalized,
        origin: "builtin",
        implementationKey: definition.implementationKey ?? definition.id
    };
}
function normalizeVisualPorts(definition) {
    const inputs = normalizeVisualInputs(definition);
    const outputs = normalizeVisualOutputs(definition);
    return { ...definition, inputs, outputs };
}
function normalizeVisualInputs(definition) {
    const inputs = definition.inputs.map((port) => normalizePortRole(port, "target"));
    if (definition.id === "builtin.control.start")
        return inputs;
    if (inputs.some((port) => port.id === "in" || port.role === "control"))
        return inputs;
    return [controlInput(), ...inputs];
}
function normalizeVisualOutputs(definition) {
    if (definition.id === "builtin.control.end")
        return definition.outputs.map((port) => normalizePortRole(port, "source"));
    const outputs = definition.outputs.map((port) => normalizePortRole(port, "source"));
    if (outputs.some((port) => port.role === "branch"))
        return outputs;
    if (!outputs.some((port) => port.id === "success" || port.role === "success"))
        outputs.unshift(successOutput());
    if (!outputs.some((port) => port.id === "failed" || port.role === "failure")) {
        const insertAt = outputs.some((port) => port.id === "success") ? 1 : outputs.length;
        outputs.splice(insertAt, 0, failedOutput());
    }
    return outputs;
}
function normalizePortRole(port, direction) {
    if (port.role)
        return port;
    if (port.id === "in")
        return { ...port, role: "control" };
    if (port.id === "success")
        return { ...port, role: "success" };
    if (port.id === "failed" || port.id === "failure")
        return { ...port, role: "failure" };
    if (port.id === "error")
        return { ...port, role: "error" };
    if (direction === "source" && ["true", "false", "body", "done", "case", "default", "approved", "rejected", "timeout", "recovered"].includes(port.id))
        return { ...port, role: "branch" };
    if (direction === "source")
        return { ...port, role: "data" };
    return port;
}
export function emptyResult(outputs = {}) {
    return { status: "success", route: "success", outputs: outputs };
}
export function failedResult(outputs = {}) {
    return { status: "failed", route: "failed", outputs: outputs };
}
export function controlInput(label = "In") {
    return { id: "in", label, valueType: "any", role: "control" };
}
export function successOutput(label = "Success") {
    return { id: "success", label, valueType: "any", role: "success" };
}
export function failedOutput(label = "Failed") {
    return { id: "failed", label, valueType: "any", role: "failure" };
}
export function errorOutput(label = "Error") {
    return { id: "error", label, valueType: "object", role: "error" };
}
export function dataOutput(id = "data", label = "Data", valueType = "any") {
    return { id, label, valueType, role: "data" };
}
export function branchOutput(id, label, valueType = "any") {
    return { id, label, valueType, role: "branch" };
}
export function successFailureOutputs(data) {
    return data ? [successOutput(), failedOutput(), data] : [successOutput(), failedOutput()];
}
export function visualNodeInputs(inputs = []) {
    return [controlInput(), ...inputs];
}
export function inputValue(context, id) {
    return context.inputs[id] ?? context.parameters[id];
}
export function numberValue(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}
export function booleanValue(value) {
    if (typeof value === "boolean")
        return value;
    if (typeof value === "number")
        return value !== 0;
    if (typeof value === "string")
        return ["true", "yes", "1", "on"].includes(value.trim().toLowerCase());
    return Boolean(value);
}
export function arrayValue(value) {
    return Array.isArray(value) ? value : [];
}
export function stringValue(value, fallback = "") {
    if (value === undefined || value === null)
        return fallback;
    return String(value);
}
export function objectValue(value) {
    if (value && typeof value === "object" && !Array.isArray(value))
        return value;
    return {};
}
export function jsonValue(value) {
    if (value === undefined)
        return null;
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean")
        return value;
    if (Array.isArray(value))
        return value.map(jsonValue);
    if (typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, jsonValue(entry)]));
    }
    return String(value);
}
export function getPathValue(source, path) {
    const parts = stringValue(path).split(".").map((part) => part.trim()).filter(Boolean);
    let current = source;
    for (const part of parts) {
        if (current && typeof current === "object" && part in current)
            current = current[part];
        else
            return undefined;
    }
    return current;
}
export function setPathValue(source, path, value) {
    const parts = stringValue(path).split(".").map((part) => part.trim()).filter(Boolean);
    if (!parts.length)
        return source;
    const next = { ...source };
    let cursor = next;
    for (const part of parts.slice(0, -1)) {
        const existing = cursor[part];
        const child = existing && typeof existing === "object" && !Array.isArray(existing) ? { ...existing } : {};
        cursor[part] = child;
        cursor = child;
    }
    cursor[parts[parts.length - 1]] = jsonValue(value);
    return next;
}
export function compareBasic(left, right, operator) {
    switch (stringValue(operator, "equals")) {
        case "not-equals": return left !== right;
        case "greater-than": return numberValue(left) > numberValue(right);
        case "greater-than-or-equal": return numberValue(left) >= numberValue(right);
        case "less-than": return numberValue(left) < numberValue(right);
        case "less-than-or-equal": return numberValue(left) <= numberValue(right);
        case "contains": return String(left ?? "").includes(String(right ?? ""));
        case "starts-with": return String(left ?? "").startsWith(String(right ?? ""));
        case "ends-with": return String(left ?? "").endsWith(String(right ?? ""));
        case "exists": return left !== undefined && left !== null && left !== "";
        case "equals":
        default: return left === right;
    }
}
