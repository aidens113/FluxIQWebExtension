export class AutomationStudioAdapterRegistry {
    adapters = new Map();
    register(adapter) {
        this.adapters.set(adapter.adapterId, adapter);
    }
    get(adapterId) {
        return this.adapters.get(adapterId);
    }
    list() {
        return [...this.adapters.values()];
    }
}
