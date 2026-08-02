import { DEPLOYMENT_SYNC_ENDPOINTS } from "./contracts";
export function registerDeploymentSyncApi(registry, service) {
    registry.register({
        programId: "deployment-sync",
        endpoint: DEPLOYMENT_SYNC_ENDPOINTS.snapshot,
        handler: async () => ({ ok: true, payload: await service.snapshot() })
    });
    registry.register({
        programId: "deployment-sync",
        endpoint: DEPLOYMENT_SYNC_ENDPOINTS.upsertTarget,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.id || !payload.name)
                return { ok: false, error: "id and name are required" };
            return { ok: true, payload: await service.upsertTarget(payload) };
        }
    });
    registry.register({
        programId: "deployment-sync",
        endpoint: DEPLOYMENT_SYNC_ENDPOINTS.upsertArtifact,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.id || !payload.targetId || !payload.kind || !payload.version)
                return { ok: false, error: "id, targetId, kind, and version are required" };
            return { ok: true, payload: await service.upsertArtifact(payload) };
        }
    });
    registry.register({
        programId: "deployment-sync",
        endpoint: DEPLOYMENT_SYNC_ENDPOINTS.dryRun,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.targetId)
                return { ok: false, error: "targetId is required" };
            return { ok: true, payload: await service.dryRun(payload.targetId) };
        }
    });
    registry.register({
        programId: "deployment-sync",
        endpoint: DEPLOYMENT_SYNC_ENDPOINTS.sync,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.targetId)
                return { ok: false, error: "targetId is required" };
            return { ok: true, payload: await service.sync(payload.targetId) };
        }
    });
    registry.register({
        programId: "deployment-sync",
        endpoint: DEPLOYMENT_SYNC_ENDPOINTS.rollback,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.targetId)
                return { ok: false, error: "targetId is required" };
            return { ok: true, payload: await service.rollback(payload.targetId, payload.versionSha) };
        }
    });
}
