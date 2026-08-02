import { PRODUCTION_RUNNER_ENDPOINTS } from "./contracts";
export function registerProductionRunnerApi(registry, service) {
    registry.register({
        programId: "production-runner",
        endpoint: PRODUCTION_RUNNER_ENDPOINTS.snapshot,
        handler: async (request) => ({ ok: true, payload: await service.snapshot(request.scope.domainId) })
    });
    registry.register({
        programId: "production-runner",
        endpoint: PRODUCTION_RUNNER_ENDPOINTS.registerTarget,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.id || !payload.name || !payload.type)
                return { ok: false, error: "id, name, and type are required" };
            return { ok: true, payload: await service.registerTarget(payload) };
        }
    });
    registry.register({
        programId: "production-runner",
        endpoint: PRODUCTION_RUNNER_ENDPOINTS.start,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.name)
                return { ok: false, error: "name is required" };
            return { ok: true, payload: await service.startRun(payload) };
        }
    });
    registry.register({
        programId: "production-runner",
        endpoint: PRODUCTION_RUNNER_ENDPOINTS.advance,
        handler: async (request) => {
            const payload = request.payload;
            if (payload?.runId)
                return { ok: true, payload: await service.advanceRun(payload.runId) };
            return { ok: true, payload: await service.advanceDueRuns(payload?.domainId ?? request.scope.domainId) };
        }
    });
    registry.register({
        programId: "production-runner",
        endpoint: PRODUCTION_RUNNER_ENDPOINTS.stop,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.runId)
                return { ok: false, error: "runId is required" };
            return { ok: true, payload: await service.stopRun(payload.runId) };
        }
    });
    registry.register({
        programId: "production-runner",
        endpoint: PRODUCTION_RUNNER_ENDPOINTS.cancel,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.runId)
                return { ok: false, error: "runId is required" };
            return { ok: true, payload: await service.cancelRun(payload.runId) };
        }
    });
}
