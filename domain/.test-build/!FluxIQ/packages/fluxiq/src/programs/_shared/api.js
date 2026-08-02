import { GLOBAL_PROGRAMS } from "./catalog";
export class GlobalProgramApiRegistry {
    handlers = new Map();
    register(params) {
        const key = apiKey(params.programId, params.endpoint);
        if (this.handlers.has(key)) {
            throw new Error(`Duplicate global program API handler: ${key}`);
        }
        if (!GLOBAL_PROGRAMS.some((program) => program.id === params.programId)) {
            throw new Error(`Unknown global program id: ${params.programId}`);
        }
        this.handlers.set(key, params.handler);
    }
    async call(request) {
        const handler = this.handlers.get(apiKey(request.programId, request.endpoint));
        if (!handler) {
            return { ok: false, error: `Global program API handler not found: ${request.programId}/${request.endpoint}` };
        }
        try {
            return await handler(request);
        }
        catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
    }
    endpoints() {
        return [...this.handlers.keys()].map((key) => {
            const [programId = "", endpoint = ""] = key.split(":", 2);
            return { programId, endpoint };
        });
    }
}
function apiKey(programId, endpoint) {
    return `${programId.trim().toLowerCase()}:${endpoint.trim().toLowerCase()}`;
}
