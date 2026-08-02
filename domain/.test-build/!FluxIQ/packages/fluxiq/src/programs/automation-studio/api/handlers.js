import { authorizeProgramPin } from "../../_shared/authorization";
import { AUTOMATION_STUDIO_ENDPOINTS } from "./contracts";
export function registerAutomationStudioApi(registry, service, identityAccess, clientGatewayBridge, clientGateway) {
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.snapshot,
        handler: async (request) => ({
            ok: true,
            payload: await service.snapshot(request.scope.domainId)
        })
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.projects,
        handler: async () => ({
            ok: true,
            payload: await service.listProjects()
        })
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.createProject,
        handler: async (request) => {
            const payload = request.payload && typeof request.payload === "object" ? request.payload : {};
            await authorizeProgramPin(identityAccess, payload);
            return { ok: true, payload: { project: await service.createProject(payload) } };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.updateProject,
        handler: async (request) => {
            const payload = request.payload && typeof request.payload === "object" ? request.payload : {};
            await authorizeProgramPin(identityAccess, payload);
            return { ok: true, payload: { project: await service.updateProject(payload) } };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.deleteProject,
        handler: async (request) => {
            const payload = request.payload && typeof request.payload === "object" ? request.payload : {};
            await authorizeProgramPin(identityAccess, payload);
            return { ok: true, payload: await service.deleteProject(String(payload.projectId ?? "")) };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.createProjectCategory,
        handler: async (request) => {
            const payload = request.payload && typeof request.payload === "object" ? request.payload : {};
            await authorizeProgramPin(identityAccess, payload);
            return { ok: true, payload: { category: await service.createProjectCategory(payload) } };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.updateProjectCategory,
        handler: async (request) => {
            const payload = request.payload && typeof request.payload === "object" ? request.payload : {};
            await authorizeProgramPin(identityAccess, payload);
            return { ok: true, payload: { category: await service.updateProjectCategory(payload) } };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.deleteProjectCategory,
        handler: async (request) => {
            const payload = request.payload && typeof request.payload === "object" ? request.payload : {};
            await authorizeProgramPin(identityAccess, payload);
            return { ok: true, payload: await service.deleteProjectCategory(String(payload.categoryId ?? "")) };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.reorderProjectCategories,
        handler: async (request) => {
            const payload = request.payload && typeof request.payload === "object" ? request.payload : {};
            await authorizeProgramPin(identityAccess, payload);
            return { ok: true, payload: await service.reorderProjectCategories(Array.isArray(payload.categoryIds) ? payload.categoryIds.map(String) : []) };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.getProjectHierarchy,
        handler: async (request) => {
            const payload = request.payload && typeof request.payload === "object" ? request.payload : {};
            return {
                ok: true,
                payload: { hierarchy: await service.getProjectHierarchy(String(payload.projectId ?? "")) }
            };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.saveProjectHierarchy,
        handler: async (request) => {
            const payload = request.payload && typeof request.payload === "object"
                ? request.payload
                : {};
            return {
                ok: true,
                payload: {
                    hierarchy: await service.saveProjectHierarchy(String(payload.projectId ?? ""), payload.hierarchy && typeof payload.hierarchy === "object"
                        ? payload.hierarchy
                        : { customHierarchyNodes: [], deletedHierarchyIds: [], workspacePrefs: {} })
                }
            };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.listRecordings,
        handler: async (request) => {
            const payload = request.payload && typeof request.payload === "object" ? request.payload : {};
            return { ok: true, payload: { recordings: await service.listRecordingSessions(payload.projectId) } };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.listProjectArtifacts,
        handler: async (request) => {
            const payload = request.payload && typeof request.payload === "object" ? request.payload : {};
            return { ok: true, payload: { artifacts: await service.listProjectArtifacts(String(payload.projectId ?? "")) } };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.getProjectArtifact,
        handler: async (request) => {
            const payload = request.payload && typeof request.payload === "object" ? request.payload : {};
            return { ok: true, payload: { artifact: await service.getProjectArtifact(String(payload.projectId ?? ""), String(payload.kind ?? ""), String(payload.artifactId ?? "")) } };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.saveProjectArtifact,
        handler: async (request) => {
            const payload = request.payload && typeof request.payload === "object" ? request.payload : {};
            await authorizeProgramPin(identityAccess, payload);
            return { ok: true, payload: { artifact: await service.saveProjectArtifact({ projectId: String(payload.projectId ?? ""), kind: String(payload.kind ?? ""), artifact: payload.artifact }) } };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.getRecording,
        handler: async (request) => {
            const payload = request.payload && typeof request.payload === "object" ? request.payload : {};
            return { ok: true, payload: { recording: await service.getRecordingSession(String(payload.recordingId ?? ""), payload.projectId) } };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.createRecording,
        handler: async (request) => {
            const payload = (request.payload && typeof request.payload === "object" ? request.payload : {});
            await authorizeProgramPin(identityAccess, payload);
            return { ok: true, payload: { recording: await service.createRecording(payload) } };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.appendRecordingEntry,
        handler: async (request) => {
            const payload = (request.payload && typeof request.payload === "object" ? request.payload : {});
            await authorizeProgramPin(identityAccess, payload);
            return { ok: true, payload: { recording: await service.appendRecordingEvent(payload) } };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.finalizeRecording,
        handler: async (request) => {
            const payload = (request.payload && typeof request.payload === "object" ? request.payload : {});
            await authorizeProgramPin(identityAccess, payload);
            return { ok: true, payload: { recording: await service.finalizeRecording(payload) } };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.normalizeRecording,
        handler: async (request) => {
            const payload = (request.payload && typeof request.payload === "object" ? request.payload : {});
            await authorizeProgramPin(identityAccess, payload);
            return { ok: true, payload: { normalizedTimeline: await service.normalizeRecording(payload) } };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.listNormalizedTimelines,
        handler: async (request) => {
            const payload = request.payload && typeof request.payload === "object" ? request.payload : {};
            return { ok: true, payload: { normalizedTimelines: payload.projectId ? await service.listProjectNormalizedTimelines(payload.projectId) : [] } };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.listRuntimeSessions,
        handler: async (request) => {
            const payload = request.payload && typeof request.payload === "object" ? request.payload : {};
            return { ok: true, payload: { runtimeSessions: await service.listRuntimeSessions(String(payload.projectId ?? "")) } };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.startRuntimeSession,
        handler: async (request) => {
            const payload = request.payload && typeof request.payload === "object" ? request.payload : {};
            return { ok: true, payload: { runtimeSession: await service.startRuntimeSession(payload) } };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.runRuntimeSession,
        handler: async (request) => {
            const payload = request.payload && typeof request.payload === "object" ? request.payload : {};
            return { ok: true, payload: { runtimeSession: await service.runRuntimeSession(payload) } };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.inspectStateDiff,
        handler: async (request) => {
            const payload = (request.payload && typeof request.payload === "object" ? request.payload : {});
            return { ok: true, payload: await service.inspectStateDiff(payload) };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.listSignalRegistries,
        handler: async () => ({
            ok: true,
            payload: { signalRegistries: await service.listSignalRegistries() }
        })
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.listRecordingDomains,
        handler: async () => ({
            ok: true,
            payload: { domains: service.listRecordingDomains() }
        })
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.validateRecordingDomainEvent,
        handler: async (request) => {
            const payload = (request.payload && typeof request.payload === "object" ? request.payload : {});
            return { ok: true, payload: service.validateRecordingDomainEvent(payload) };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.appendRecordingDomainEvent,
        handler: async (request) => {
            const payload = (request.payload && typeof request.payload === "object" ? request.payload : {});
            const result = await service.appendRecordingDomainEvent(payload);
            return result.accepted
                ? { ok: true, payload: result }
                : { ok: false, error: result.issues.map((issue) => issue.message).join(" ") || "Recording event was rejected.", payload: result };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.clientGatewaySnapshot,
        handler: async () => ({
            ok: true,
            payload: clientGateway?.snapshot() ?? { enabled: false, sessions: [], pairings: [], auditLog: [] }
        })
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.createClientPairing,
        handler: async (request) => {
            if (!clientGateway)
                return { ok: false, error: "Client gateway is not available." };
            const payload = (request.payload && typeof request.payload === "object" ? request.payload : {});
            await authorizeProgramPin(identityAccess, payload);
            return { ok: true, payload: { pairing: clientGateway.createPairing({
                        ...(payload.projectId !== undefined ? { projectId: payload.projectId } : {}),
                        ...(typeof payload.authSessionId === "string" ? { userId: payload.authSessionId } : {}),
                        ...(payload.ttlMs !== undefined ? { ttlMs: payload.ttlMs } : {})
                    }) } };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.startClientRecording,
        handler: async (request) => {
            if (!clientGatewayBridge)
                return { ok: false, error: "Client gateway bridge is not available." };
            const payload = (request.payload && typeof request.payload === "object" ? request.payload : {});
            await authorizeProgramPin(identityAccess, payload);
            return { ok: true, payload: { recording: await clientGatewayBridge.startRecording(payload) } };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.stopClientRecording,
        handler: async (request) => {
            if (!clientGatewayBridge)
                return { ok: false, error: "Client gateway bridge is not available." };
            const payload = (request.payload && typeof request.payload === "object" ? request.payload : {});
            await authorizeProgramPin(identityAccess, payload);
            return { ok: true, payload: { recording: await clientGatewayBridge.stopRecording(String(payload.sessionId ?? "")) } };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.captureClientSnapshot,
        handler: async (request) => {
            if (!clientGateway)
                return { ok: false, error: "Client gateway is not available." };
            const payload = (request.payload && typeof request.payload === "object" ? request.payload : {});
            await clientGateway.captureSnapshot(String(payload.sessionId ?? ""), {
                ...(payload.kind !== undefined ? { kind: payload.kind } : {}),
                ...(payload.metadata !== undefined ? { metadata: payload.metadata } : {})
            });
            return { ok: true, payload: { queued: true } };
        }
    });
    registry.register({
        programId: "automation-studio",
        endpoint: AUTOMATION_STUDIO_ENDPOINTS.executeClientAction,
        handler: async (request) => {
            if (!clientGatewayBridge)
                return { ok: false, error: "Client gateway bridge is not available." };
            const payload = (request.payload && typeof request.payload === "object" ? request.payload : {});
            await authorizeProgramPin(identityAccess, payload);
            return { ok: true, payload: { result: await clientGatewayBridge.executeAction(String(payload.sessionId ?? ""), payload.command) } };
        }
    });
}
