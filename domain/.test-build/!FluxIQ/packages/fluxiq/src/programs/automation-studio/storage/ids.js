export function recordingSessionDocumentId(recording) {
    return recording.recordingId;
}
export function normalizedTimelineDocumentId(timeline) {
    return timeline.normalizedTimelineId;
}
export function signalRegistryDocumentId(registry) {
    return registry.registryId;
}
export function learnedTaskModelDocumentId(model) {
    return model.learnedTaskModelId;
}
export function policyGraphDocumentId(policy) {
    return policy.policyId;
}
export function canonicalArtifactIdentity(artifact) {
    if ("normalizedTimelineId" in artifact) {
        return withOptionalIdentityFields({
            kind: "normalized_timeline",
            id: normalizedTimelineDocumentId(artifact)
        }, readDomainId(artifact.metadata), artifact.taskId);
    }
    if ("recordingId" in artifact) {
        return withOptionalIdentityFields({
            kind: "recording_session",
            id: recordingSessionDocumentId(artifact)
        }, artifact.environment.domainId, artifact.taskId);
    }
    if ("registryId" in artifact) {
        return withOptionalIdentityFields({
            kind: "signal_registry",
            id: signalRegistryDocumentId(artifact)
        }, readDomainId(artifact.metadata));
    }
    if ("learnedTaskModelId" in artifact) {
        return withOptionalIdentityFields({
            kind: "learned_task_model",
            id: learnedTaskModelDocumentId(artifact)
        }, readDomainId(artifact.metadata), artifact.taskId);
    }
    return withOptionalIdentityFields({
        kind: "policy_graph",
        id: policyGraphDocumentId(artifact)
    }, readDomainId(artifact.metadata), artifact.taskId);
}
function withOptionalIdentityFields(base, domainId, taskId) {
    const identity = { ...base };
    if (domainId !== undefined)
        identity.domainId = domainId;
    if (taskId !== undefined)
        identity.taskId = taskId;
    return identity;
}
function readDomainId(metadata) {
    if (!metadata || !("domainId" in metadata))
        return undefined;
    return typeof metadata.domainId === "string" || metadata.domainId === null ? metadata.domainId : undefined;
}
