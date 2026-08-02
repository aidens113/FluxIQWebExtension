export class DomainRegistry {
    domains = new Map();
    register(registration) {
        const id = normalizeDomainId(registration.manifest.id);
        if (!id) {
            throw new Error("Domain id is required");
        }
        if (this.domains.has(id)) {
            throw new Error(`Duplicate domain registration: ${id}`);
        }
        this.domains.set(id, {
            ...registration,
            manifest: { ...registration.manifest, id }
        });
    }
    all() {
        return [...this.domains.values()].sort((left, right) => left.manifest.title.localeCompare(right.manifest.title));
    }
    maybeGet(domainId) {
        if (!domainId)
            return null;
        return this.domains.get(normalizeDomainId(domainId)) ?? null;
    }
    summaries() {
        return this.all().map((registration) => domainSummary(registration.manifest));
    }
}
export function domainSummary(manifest) {
    const id = normalizeDomainId(manifest.id);
    const summary = {
        id,
        title: manifest.title,
        category: manifest.category,
        description: manifest.description,
        icon: manifest.icon,
        status: manifest.status ?? "available",
        route: `/domains/${id}`
    };
    if (manifest.capabilities) {
        summary.capabilities = manifest.capabilities;
    }
    return summary;
}
export function normalizeDomainId(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "_");
}
