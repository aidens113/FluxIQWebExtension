import { canonicalArtifactIdentity, learnedTaskModelDocumentId, normalizedTimelineDocumentId, policyGraphDocumentId, recordingSessionDocumentId, signalRegistryDocumentId } from "./ids";
export class AutomationStudioMemoryRepository {
    documents = new Map();
    identities = new Map();
    identify;
    constructor(options) {
        this.identify = options.identify;
    }
    async list(domainId) {
        const documents = [];
        for (const [id, document] of this.documents) {
            const identity = this.identities.get(id);
            if (domainId === undefined || identity?.domainId === domainId) {
                documents.push(cloneDocument(document));
            }
        }
        return documents;
    }
    async get(id, domainId) {
        const identity = this.identities.get(id);
        if (!identity || (domainId !== undefined && identity.domainId !== domainId))
            return null;
        const document = this.documents.get(id);
        return document ? cloneDocument(document) : null;
    }
    async put(document) {
        const identity = this.identify(document);
        this.documents.set(identity.id, cloneDocument(document));
        this.identities.set(identity.id, identity);
        return cloneDocument(document);
    }
    async delete(id, domainId) {
        const identity = this.identities.get(id);
        if (!identity || (domainId !== undefined && identity.domainId !== domainId))
            return false;
        this.identities.delete(id);
        return this.documents.delete(id);
    }
}
export function createCanonicalAutomationStudioMemoryRepositories() {
    return {
        recordingSessions: new AutomationStudioMemoryRepository({
            identify: (document) => ({
                ...canonicalArtifactIdentity(document),
                id: recordingSessionDocumentId(document)
            })
        }),
        normalizedTimelines: new AutomationStudioMemoryRepository({
            identify: (document) => ({
                ...canonicalArtifactIdentity(document),
                id: normalizedTimelineDocumentId(document)
            })
        }),
        signalRegistries: new AutomationStudioMemoryRepository({
            identify: (document) => ({
                ...canonicalArtifactIdentity(document),
                id: signalRegistryDocumentId(document)
            })
        }),
        learnedTaskModels: new AutomationStudioMemoryRepository({
            identify: (document) => ({
                ...canonicalArtifactIdentity(document),
                id: learnedTaskModelDocumentId(document)
            })
        }),
        policyGraphs: new AutomationStudioMemoryRepository({
            identify: (document) => ({
                ...canonicalArtifactIdentity(document),
                id: policyGraphDocumentId(document)
            })
        })
    };
}
function cloneDocument(document) {
    return structuredClone(document);
}
