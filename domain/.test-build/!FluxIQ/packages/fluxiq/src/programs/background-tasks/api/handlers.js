import { BACKGROUND_TASKS_ENDPOINTS } from "./contracts";
export function registerBackgroundTasksApi(registry, service) {
    registry.register({
        programId: "background-tasks",
        endpoint: BACKGROUND_TASKS_ENDPOINTS.snapshot,
        handler: async () => ({ ok: true, payload: await service.snapshot() })
    });
    registry.register({
        programId: "background-tasks",
        endpoint: BACKGROUND_TASKS_ENDPOINTS.detail,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.taskId)
                return { ok: false, error: "taskId is required" };
            return { ok: true, payload: await service.detail(payload.taskId, payload.limit) };
        }
    });
    registry.register({
        programId: "background-tasks",
        endpoint: BACKGROUND_TASKS_ENDPOINTS.run,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.taskId)
                return { ok: false, error: "taskId is required" };
            return { ok: true, payload: await service.run(payload.taskId, payload.payload) };
        }
    });
    registry.register({
        programId: "background-tasks",
        endpoint: BACKGROUND_TASKS_ENDPOINTS.setEnabled,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.taskId)
                return { ok: false, error: "taskId is required" };
            return { ok: true, payload: await service.setEnabled(payload.taskId, Boolean(payload.enabled)) };
        }
    });
    registry.register({
        programId: "background-tasks",
        endpoint: BACKGROUND_TASKS_ENDPOINTS.saveSchedule,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.taskId)
                return { ok: false, error: "taskId is required" };
            return { ok: true, payload: await service.saveSchedule(payload) };
        }
    });
    registry.register({
        programId: "background-tasks",
        endpoint: BACKGROUND_TASKS_ENDPOINTS.control,
        handler: async (request) => {
            const payload = request.payload;
            if (payload?.action === "start")
                return { ok: true, payload: await service.start() };
            if (payload?.action === "stop")
                return { ok: true, payload: await service.stop() };
            return { ok: false, error: "action must be start or stop" };
        }
    });
}
