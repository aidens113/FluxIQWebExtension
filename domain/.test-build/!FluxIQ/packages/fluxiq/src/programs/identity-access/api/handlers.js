import { IDENTITY_ACCESS_ENDPOINTS } from "./contracts";
export function registerIdentityAccessApi(registry, service) {
    registry.register({
        programId: "identity-access",
        endpoint: IDENTITY_ACCESS_ENDPOINTS.snapshot,
        handler: async () => ({
            ok: true,
            payload: await service.snapshot()
        })
    });
    registry.register({
        programId: "identity-access",
        endpoint: IDENTITY_ACCESS_ENDPOINTS.createUser,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.username || !payload.displayName || !payload.roleId)
                return { ok: false, error: "username, displayName, and roleId are required" };
            return { ok: true, payload: await service.upsertUser(payload) };
        }
    });
    registry.register({
        programId: "identity-access",
        endpoint: IDENTITY_ACCESS_ENDPOINTS.updateUser,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.id)
                return { ok: false, error: "id is required" };
            if (payload.roleId) {
                await service.authorizeSessionCredentials({
                    sessionId: payload.authSessionId,
                    password: payload.authorizationPassword,
                    pin: payload.authorizationPin,
                    totp: payload.authorizationTotp
                });
            }
            return { ok: true, payload: await service.updateUser(payload) };
        }
    });
    registry.register({
        programId: "identity-access",
        endpoint: IDENTITY_ACCESS_ENDPOINTS.setPassword,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.userId || !payload.value)
                return { ok: false, error: "userId and value are required" };
            return { ok: true, payload: await service.setPasswordAuthorized({
                    userId: payload.userId,
                    password: payload.value,
                    sessionId: payload.authSessionId,
                    authorizationPassword: payload.authorizationPassword,
                    authorizationPin: payload.authorizationPin,
                    authorizationTotp: payload.authorizationTotp
                }) };
        }
    });
    registry.register({
        programId: "identity-access",
        endpoint: IDENTITY_ACCESS_ENDPOINTS.setPin,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.userId || !payload.value)
                return { ok: false, error: "userId and value are required" };
            return { ok: true, payload: await service.setPinAuthorized({
                    userId: payload.userId,
                    pin: payload.value,
                    sessionId: payload.authSessionId,
                    authorizationPassword: payload.authorizationPassword,
                    authorizationPin: payload.authorizationPin,
                    authorizationTotp: payload.authorizationTotp
                }) };
        }
    });
    registry.register({
        programId: "identity-access",
        endpoint: IDENTITY_ACCESS_ENDPOINTS.beginTotp,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.userId)
                return { ok: false, error: "userId is required" };
            return { ok: true, payload: await service.beginTotp(payload.userId) };
        }
    });
    registry.register({
        programId: "identity-access",
        endpoint: IDENTITY_ACCESS_ENDPOINTS.confirmTotp,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.userId || !payload.code)
                return { ok: false, error: "userId and code are required" };
            return { ok: true, payload: await service.confirmTotp(payload.userId, payload.code) };
        }
    });
    registry.register({
        programId: "identity-access",
        endpoint: IDENTITY_ACCESS_ENDPOINTS.disableTotp,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.userId)
                return { ok: false, error: "userId is required" };
            return { ok: true, payload: await service.disableTotp(payload.userId) };
        }
    });
    registry.register({
        programId: "identity-access",
        endpoint: IDENTITY_ACCESS_ENDPOINTS.createSession,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.userId)
                return { ok: false, error: "userId is required" };
            return { ok: true, payload: await service.createSession(payload.userId, payload.ttlMs) };
        }
    });
    registry.register({
        programId: "identity-access",
        endpoint: IDENTITY_ACCESS_ENDPOINTS.revokeSession,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.sessionId)
                return { ok: false, error: "sessionId is required" };
            return { ok: true, payload: { revoked: await service.revokeSession(payload.sessionId) } };
        }
    });
    registry.register({
        programId: "identity-access",
        endpoint: IDENTITY_ACCESS_ENDPOINTS.unlockVault,
        handler: async (request) => {
            const payload = request.payload;
            if (!payload?.userId)
                return { ok: false, error: "userId is required" };
            return { ok: true, payload: await service.unlockVault(payload) };
        }
    });
    registry.register({
        programId: "identity-access",
        endpoint: IDENTITY_ACCESS_ENDPOINTS.lockVault,
        handler: async () => ({ ok: true, payload: await service.lockVault() })
    });
}
