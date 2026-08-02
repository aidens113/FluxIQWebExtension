export async function authorizeProgramPin(identityAccess, payload) {
    if (!identityAccess)
        throw new Error("PIN authorization service is not available.");
    await identityAccess.authorizeSessionPin({
        sessionId: typeof payload.authSessionId === "string" ? payload.authSessionId : undefined,
        pin: typeof payload.authorizationPin === "string" ? payload.authorizationPin : undefined
    });
}
