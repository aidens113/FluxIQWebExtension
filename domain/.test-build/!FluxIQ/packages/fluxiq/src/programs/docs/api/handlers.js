import { DOCS_ENDPOINTS } from "./contracts";
export function registerDocsApi(registry, service) {
    registry.register({
        programId: "docs",
        endpoint: DOCS_ENDPOINTS.snapshot,
        handler: async () => ({ ok: true, payload: await service.snapshot() })
    });
    registry.register({
        programId: "docs",
        endpoint: DOCS_ENDPOINTS.rebuild,
        handler: async () => ({ ok: true, payload: await service.rebuild() })
    });
    registry.register({
        programId: "docs",
        endpoint: DOCS_ENDPOINTS.getPage,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.pageId)
                return { ok: false, error: "pageId is required" };
            return { ok: true, payload: await service.getPage(payload.pageId) };
        }
    });
    registry.register({
        programId: "docs",
        endpoint: DOCS_ENDPOINTS.registerSource,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.id || !payload.title || !payload.rootDir)
                return { ok: false, error: "id, title, and rootDir are required" };
            return { ok: true, payload: await service.upsertSource(payload) };
        }
    });
}
