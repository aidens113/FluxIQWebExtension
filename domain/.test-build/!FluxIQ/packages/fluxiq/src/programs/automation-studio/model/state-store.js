import { applyStateDeltas, diffStateSnapshots } from "./state-diff";
export class AutomationInMemoryStateStore {
    current;
    listeners = new Set();
    schemaByPath = new Map();
    constructor(snapshot = emptyStateSnapshot()) {
        this.current = structuredClone(snapshot);
    }
    read(namespace, path) {
        const value = this.current.namespaces[namespace]?.values[path];
        return value ? structuredClone(value) : undefined;
    }
    write(namespace, path, value, options = {}) {
        return this.update(namespace, path, () => value, options);
    }
    update(namespace, path, updater, options = {}) {
        const previous = this.snapshot();
        const next = this.snapshot();
        const ns = next.namespaces[namespace] ?? { schemaId: namespace, schemaVersion: "0.1", values: {} };
        next.namespaces[namespace] = ns;
        const value = updater(ns.values[path] ? structuredClone(ns.values[path]) : undefined);
        if (value === undefined)
            delete ns.values[path];
        else
            ns.values[path] = structuredClone(value);
        next.timestamp = value?.observedAt ?? Date.now();
        return this.commit(previous, next, options);
    }
    snapshot() {
        return structuredClone(this.current);
    }
    restore(snapshot, options = {}) {
        return this.commit(this.snapshot(), structuredClone(snapshot), options);
    }
    diff(snapshot) {
        return diffStateSnapshots(this.current, snapshot);
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    registerSchema(schema) {
        this.schemaByPath.set(`${schema.namespace}:${schema.path}`, structuredClone(schema));
    }
    schemas() {
        return [...this.schemaByPath.values()].map((schema) => structuredClone(schema));
    }
    commit(previous, next, options) {
        const deltas = diffStateSnapshots(previous, next);
        this.current = structuredClone(next);
        const event = {
            snapshot: this.snapshot(),
            deltas,
            ...(options.source !== undefined ? { source: options.source } : {}),
            ...(options.metadata !== undefined ? { metadata: options.metadata } : {})
        };
        for (const listener of this.listeners)
            listener(event);
        return event;
    }
}
export function emptyStateSnapshot(timestamp = Date.now()) {
    return { timestamp, namespaces: {} };
}
export function stateValue(type, value, observedAt = Date.now(), options = {}) {
    return { type, value, observedAt, ...options };
}
export { applyStateDeltas };
