import { randomUUID } from "node:crypto";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { appendRecordingEntry, createAutomationStudioFixture, createBlankAutomationStudioFlow, createRecordingSession, diffStateSnapshots, finalizeRecordingSession, RecordingDomainRegistry, processRecordingDomainEvent } from "../model";
import { normalizeRecordingTimeline } from "../normalization";
import { automationNodeClasses } from "../nodes";
import { runAutomationStudioGraph } from "./executor";
import { ProgramJsonStore, programDataFile, safeSegment } from "../../_shared/storage";
import { createCanonicalAutomationStudioMemoryRepositories } from "../storage";
export class AutomationStudioService {
    repositories;
    projectIndexStore;
    legacyProjectStore;
    projectRootDir;
    nodeRootDir;
    recordingDomains = new RecordingDomainRegistry();
    ready;
    storageReady;
    constructor(options = {}) {
        this.repositories = options.repositories ?? createCanonicalAutomationStudioMemoryRepositories();
        if (options.dataDir) {
            const automationDataDir = path.join(options.dataDir, "programs", "automation-studio");
            this.projectRootDir = path.join(automationDataDir, "projects");
            this.nodeRootDir = path.join(automationDataDir, "nodes");
            this.projectIndexStore = new ProgramJsonStore(path.join(this.projectRootDir, "index.json"), () => ({ categories: [], projects: [] }));
            this.legacyProjectStore = new ProgramJsonStore(programDataFile(options.dataDir, "automation-studio", "projects.json"), () => ({ categories: [], projects: [] }));
        }
        this.ready = options.seedFixture === false ? Promise.resolve() : this.seedFixture();
    }
    async snapshot(domainId) {
        await this.ready;
        return {
            tasks: [],
            recordings: [],
            policies: [],
            canonical: {
                recordingSessions: await this.repositories.recordingSessions.list(domainId),
                normalizedTimelines: await this.repositories.normalizedTimelines.list(domainId),
                signalRegistries: await this.repositories.signalRegistries.list(domainId),
                learnedTaskModels: await this.repositories.learnedTaskModels.list(domainId),
                policyGraphs: await this.repositories.policyGraphs.list(domainId)
            },
            problems: [
                {
                    id: "automation-studio.prototype-data",
                    severity: "info",
                    message: "Automation Studio is showing framework fixture data until host-owned artifacts are connected."
                }
            ]
        };
    }
    async listRecordingSessions(projectId) {
        await this.ready;
        if (projectId)
            await this.loadProjectRecordings(projectId);
        return await this.repositories.recordingSessions.list();
    }
    async getRecordingSession(recordingId, projectId) {
        await this.ready;
        if (projectId)
            await this.loadProjectRecordings(projectId);
        const recording = await this.repositories.recordingSessions.get(recordingId);
        if (!recording)
            throw new Error(`Unknown Automation Studio recording: ${recordingId}`);
        return recording;
    }
    async createRecording(input) {
        await this.ready;
        const recording = createRecordingSession(input);
        await this.repositories.recordingSessions.put(recording);
        if (input.projectId)
            await this.writeProjectRecordingSession(input.projectId, recording);
        return recording;
    }
    async appendRecordingEvent(input) {
        const recording = await this.getRecordingSession(input.recordingId, input.projectId);
        const next = appendRecordingEntry(recording, input.entry);
        await this.repositories.recordingSessions.put(next);
        if (input.projectId)
            await this.writeProjectRecordingSession(input.projectId, next);
        return next;
    }
    async finalizeRecording(input) {
        const recording = await this.getRecordingSession(input.recordingId, input.projectId);
        const finalized = finalizeRecordingSession(recording, input.endedAt);
        await this.repositories.recordingSessions.put(finalized);
        if (input.projectId)
            await this.writeProjectRecordingSession(input.projectId, finalized);
        return finalized;
    }
    async normalizeRecording(input) {
        const recording = await this.getRecordingSession(input.recordingId, input.projectId);
        const normalized = normalizeRecordingTimeline(recording, input.options);
        await this.repositories.normalizedTimelines.put(normalized);
        if (input.projectId)
            await this.writeProjectNormalizedTimeline(input.projectId, normalized);
        return normalized;
    }
    async inspectStateDiff(input) {
        return { deltas: diffStateSnapshots(input.previous, input.current, input.includeStable !== undefined ? { includeStable: input.includeStable } : {}) };
    }
    async listSignalRegistries() {
        await this.ready;
        return await this.repositories.signalRegistries.list();
    }
    registerRecordingDomain(definition) {
        return this.recordingDomains.register(definition);
    }
    unregisterRecordingDomain(domainId) {
        return this.recordingDomains.unregister(domainId);
    }
    listRecordingDomains() {
        return this.recordingDomains.list();
    }
    validateRecordingDomainEvent(input) {
        return this.recordingDomains.validate(input);
    }
    async appendRecordingDomainEvent(input) {
        const recording = await this.getRecordingSession(input.recordingId, input.projectId);
        const result = await processRecordingDomainEvent(this.recordingDomains, recording, input);
        if (result.accepted) {
            await this.repositories.recordingSessions.put(result.recording);
            if (input.projectId)
                await this.writeProjectRecordingSession(input.projectId, result.recording);
        }
        return result;
    }
    async listProjectArtifacts(projectId) {
        await this.findProject(projectId);
        return {
            tasks: await this.readProjectArtifactList(projectId, "tasks"),
            routines: await this.readProjectArtifactList(projectId, "routines"),
            configs: await this.readProjectArtifactList(projectId, "configs"),
            flows: await this.readProjectArtifactList(projectId, "flows")
        };
    }
    async saveProjectArtifact(input) {
        await this.findProject(input.projectId);
        if (!input.artifact || typeof input.artifact !== "object" || Array.isArray(input.artifact))
            throw new Error("Artifact object is required.");
        const artifact = input.artifact;
        const id = this.projectArtifactId(input.kind, artifact);
        const now = Date.now();
        const withTimestamps = {
            ...artifact,
            schemaVersion: typeof artifact.schemaVersion === "string" ? artifact.schemaVersion : "0.1",
            createdAt: typeof artifact.createdAt === "number" ? artifact.createdAt : now,
            updatedAt: now
        };
        await new ProgramJsonStore(this.projectArtifactFile(input.projectId, input.kind, id), () => ({})).write(withTimestamps);
        return withTimestamps;
    }
    async getProjectArtifact(projectId, kind, artifactId) {
        await this.findProject(projectId);
        const artifact = await new ProgramJsonStore(this.projectArtifactFile(projectId, kind, artifactId), () => ({})).read();
        if (!Object.keys(artifact).length)
            throw new Error(`Unknown Automation Studio ${kind}: ${artifactId}`);
        return artifact;
    }
    async createDefaultFlow(input) {
        const flow = createBlankAutomationStudioFlow({
            flowId: `${input.ownerKind}.${safeSegment(input.ownerId)}.flow`,
            ownerKind: input.ownerKind,
            ownerId: input.ownerId,
            name: input.name,
            ...(input.description ? { description: input.description } : {})
        });
        await this.saveProjectArtifact({ projectId: input.projectId, kind: "flow", artifact: flow });
        return flow;
    }
    async listProjectNormalizedTimelines(projectId) {
        await this.loadProjectRecordings(projectId);
        const index = await this.readRecordingIndex(projectId);
        const timelines = [];
        for (const item of index.normalizedTimelines ?? []) {
            const timeline = await this.repositories.normalizedTimelines.get(item.normalizedTimelineId);
            if (timeline)
                timelines.push(timeline);
        }
        return timelines;
    }
    async startRuntimeSession(input) {
        const flow = input.flow ?? (input.projectId && input.flowId ? await this.getProjectArtifact(input.projectId, "flow", input.flowId) : undefined);
        if (!flow)
            throw new Error("A flow document or project flow ID is required.");
        const now = Date.now();
        const session = {
            schemaVersion: "0.1",
            runId: randomUUID(),
            ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
            targetKind: input.targetKind ?? (flow.ownerKind === "policy" ? "flow" : flow.ownerKind),
            targetId: input.targetId ?? flow.ownerId,
            flowId: flow.flowId,
            status: "queued",
            queuedAt: now,
            flow,
            metadata: { ...(input.metadata ?? {}), inputs: input.inputs ?? {} }
        };
        if (input.projectId)
            await this.writeRuntimeSession(input.projectId, session);
        return session;
    }
    async runRuntimeSession(input) {
        const existing = input.projectId && input.runId ? await this.getRuntimeSession(input.projectId, input.runId) : null;
        const startInput = {};
        if (input.projectId !== undefined)
            startInput.projectId = input.projectId;
        if (input.flow !== undefined)
            startInput.flow = input.flow;
        if (input.flowId !== undefined)
            startInput.flowId = input.flowId;
        if (input.inputs !== undefined)
            startInput.inputs = input.inputs;
        const session = existing ?? await this.startRuntimeSession(startInput);
        const startedAt = Date.now();
        const graphOptions = {
            inputs: (input.inputs ?? session.metadata?.inputs ?? {})
        };
        if (input.maxSteps !== undefined)
            graphOptions.maxSteps = input.maxSteps;
        const trace = await runAutomationStudioGraph(session.flow, graphOptions);
        const next = {
            ...session,
            status: trace.status,
            startedAt: session.startedAt ?? startedAt,
            ...(trace.finishedAt !== undefined ? { finishedAt: trace.finishedAt } : {}),
            trace
        };
        if (input.projectId)
            await this.writeRuntimeSession(input.projectId, next);
        return next;
    }
    async getRuntimeSession(projectId, runId) {
        await this.findProject(projectId);
        const stored = await new ProgramJsonStore(this.projectFile(projectId, "runtime", "sessions", `${safeSegment(runId)}.json`), () => ({})).read();
        return stored.session ?? null;
    }
    async listRuntimeSessions(projectId) {
        const index = await this.readRuntimeIndex(projectId);
        const sessions = [];
        for (const item of index.sessions ?? []) {
            const session = await this.getRuntimeSession(projectId, item.runId);
            if (session)
                sessions.push(session);
        }
        return sessions.sort((left, right) => (right.startedAt ?? right.queuedAt) - (left.startedAt ?? left.queuedAt));
    }
    async listProjects() {
        const state = await this.readProjectIndex();
        return {
            categories: this.sortCategories(state.categories ?? []),
            projects: state.projects
                .sort((left, right) => right.updatedAt - left.updatedAt)
        };
    }
    async createProject(input) {
        const name = typeof input.name === "string" ? input.name.trim() : "";
        if (!name)
            throw new Error("Project name is required.");
        const now = Date.now();
        const categoryId = typeof input.categoryId === "string" && input.categoryId.trim() ? input.categoryId.trim() : null;
        const project = {
            id: randomUUID(),
            name,
            description: typeof input.description === "string" ? input.description.trim() : "",
            categoryId,
            createdAt: now,
            updatedAt: now
        };
        await this.writeProjectIndex((state) => ({ ...state, projects: [project, ...state.projects] }));
        await this.writeProjectRecord({ ...project, customHierarchyNodes: [], deletedHierarchyIds: [], workspacePrefs: {} });
        return project;
    }
    async updateProject(input) {
        const projectId = String(input.projectId ?? "");
        const name = typeof input.name === "string" ? input.name.trim() : undefined;
        if (name !== undefined && !name)
            throw new Error("Project name is required.");
        let updated;
        await this.writeProjectIndex((state) => ({
            ...state,
            projects: state.projects.map((project) => {
                if (project.id !== projectId)
                    return project;
                updated = {
                    ...project,
                    ...(name !== undefined ? { name } : {}),
                    ...(typeof input.description === "string" ? { description: input.description.trim() } : {}),
                    ...(input.categoryId !== undefined ? { categoryId: typeof input.categoryId === "string" && input.categoryId.trim() ? input.categoryId.trim() : null } : {}),
                    updatedAt: Date.now()
                };
                return updated;
            })
        }));
        if (!updated)
            throw new Error(`Unknown Automation Studio project: ${projectId}`);
        const existing = await this.findProject(projectId);
        await this.writeProjectRecord({ ...existing, ...updated });
        return updated;
    }
    async deleteProject(projectId) {
        await this.findProject(projectId);
        await this.writeProjectIndex((state) => ({
            ...state,
            projects: state.projects.filter((project) => project.id !== projectId)
        }));
        if (this.projectRootDir)
            await rm(this.projectDirectory(projectId), { recursive: true, force: true });
        return { deletedProjectId: projectId };
    }
    async createProjectCategory(input) {
        const name = typeof input.name === "string" ? input.name.trim() : "";
        if (!name)
            throw new Error("Category name is required.");
        const now = Date.now();
        const state = await this.readProjectIndex();
        const category = { id: randomUUID(), name, order: nextCategoryOrder(state.categories), createdAt: now, updatedAt: now };
        await this.writeProjectIndex((state) => ({ ...state, categories: [category, ...(state.categories ?? [])] }));
        return category;
    }
    async updateProjectCategory(input) {
        const categoryId = String(input.categoryId ?? "");
        const name = typeof input.name === "string" ? input.name.trim() : "";
        if (!name)
            throw new Error("Category name is required.");
        let updated;
        await this.writeProjectIndex((state) => ({
            ...state,
            categories: (state.categories ?? []).map((category) => {
                if (category.id !== categoryId)
                    return category;
                updated = { ...category, name, updatedAt: Date.now() };
                return updated;
            })
        }));
        if (!updated)
            throw new Error(`Unknown Automation Studio project category: ${categoryId}`);
        return updated;
    }
    async deleteProjectCategory(categoryId) {
        const affectedProjects = [];
        await this.writeProjectIndex((state) => ({
            ...state,
            categories: (state.categories ?? []).filter((category) => category.id !== categoryId),
            projects: state.projects.map((project) => {
                if (project.categoryId !== categoryId)
                    return project;
                const updated = { ...project, categoryId: null, updatedAt: Date.now() };
                affectedProjects.push(updated);
                return updated;
            })
        }));
        for (const project of affectedProjects) {
            const existing = await this.findProject(project.id);
            await this.writeProjectRecord({ ...existing, ...project });
        }
        return { deletedCategoryId: categoryId };
    }
    async reorderProjectCategories(categoryIds) {
        const requestedIds = categoryIds.filter((id) => typeof id === "string" && id.trim()).map((id) => id.trim());
        let categories = [];
        await this.writeProjectIndex((state) => {
            const requested = new Set(requestedIds);
            const known = new Set((state.categories ?? []).map((category) => category.id));
            if (requestedIds.some((id) => !known.has(id)))
                throw new Error("Unknown Automation Studio project category in reorder request.");
            const orderedIds = [...requestedIds, ...(state.categories ?? []).filter((category) => !requested.has(category.id)).map((category) => category.id)];
            const orderById = new Map(orderedIds.map((id, index) => [id, index]));
            categories = (state.categories ?? []).map((category) => ({ ...category, order: orderById.get(category.id) ?? category.order, updatedAt: Date.now() }));
            return { ...state, categories };
        });
        return { categories: this.sortCategories(categories) };
    }
    async getProjectHierarchy(projectId) {
        const project = await this.findProject(projectId);
        return {
            customHierarchyNodes: project.customHierarchyNodes,
            deletedHierarchyIds: project.deletedHierarchyIds,
            workspacePrefs: project.workspacePrefs ?? {}
        };
    }
    async saveProjectHierarchy(projectId, hierarchy) {
        const nextHierarchy = {
            customHierarchyNodes: Array.isArray(hierarchy.customHierarchyNodes) ? hierarchy.customHierarchyNodes : [],
            deletedHierarchyIds: Array.isArray(hierarchy.deletedHierarchyIds) ? hierarchy.deletedHierarchyIds : [],
            workspacePrefs: hierarchy.workspacePrefs && typeof hierarchy.workspacePrefs === "object" && !Array.isArray(hierarchy.workspacePrefs) ? hierarchy.workspacePrefs : {}
        };
        let updatedProject;
        await this.writeProjectIndex((state) => ({
            ...state,
            projects: state.projects.map((project) => {
                if (project.id !== projectId)
                    return project;
                updatedProject = { ...project, updatedAt: Date.now() };
                return updatedProject;
            })
        }));
        if (!updatedProject)
            throw new Error(`Unknown Automation Studio project: ${projectId}`);
        await this.writeProjectRecord({ ...updatedProject, ...nextHierarchy });
        return nextHierarchy;
    }
    async readProjectIndex() {
        await this.ensureStorageReady();
        const state = this.projectIndexStore ? await this.projectIndexStore.read() : { categories: [], projects: [] };
        return { categories: normalizeProjectCategories(state.categories ?? []), projects: state.projects ?? [] };
    }
    async writeProjectIndex(mutator) {
        await this.ensureStorageReady();
        if (!this.projectIndexStore)
            return mutator({ categories: [], projects: [] });
        return await this.projectIndexStore.update((state) => mutator({ categories: normalizeProjectCategories(state.categories ?? []), projects: state.projects ?? [] }));
    }
    sortCategories(categories) {
        return [...normalizeProjectCategories(categories)].sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
    }
    async findProject(projectId) {
        const state = await this.readProjectIndex();
        const project = state.projects.find((item) => item.id === projectId);
        if (!project)
            throw new Error(`Unknown Automation Studio project: ${projectId}`);
        return await this.readProjectRecord(project);
    }
    async readProjectRecord(project) {
        if (!this.projectRootDir)
            return { ...project, customHierarchyNodes: [], deletedHierarchyIds: [], workspacePrefs: {} };
        await this.ensureProjectStructure(project.id);
        const legacyHierarchy = await new ProgramJsonStore(this.projectFile(project.id, "hierarchy", "index.json"), () => ({ customHierarchyNodes: [], deletedHierarchyIds: [], workspacePrefs: {} })).read();
        const nodes = await new ProgramJsonStore(this.projectFile(project.id, "hierarchy", "nodes.json"), () => ({ customHierarchyNodes: legacyHierarchy.customHierarchyNodes ?? [] })).read();
        const deleted = await new ProgramJsonStore(this.projectFile(project.id, "hierarchy", "deleted.json"), () => ({ deletedHierarchyIds: legacyHierarchy.deletedHierarchyIds ?? [] })).read();
        const workspace = await new ProgramJsonStore(this.projectFile(project.id, "workspace", "preferences.json"), () => ({ workspacePrefs: legacyHierarchy.workspacePrefs ?? {} })).read();
        return {
            ...project,
            customHierarchyNodes: Array.isArray(nodes.customHierarchyNodes) ? nodes.customHierarchyNodes : [],
            deletedHierarchyIds: Array.isArray(deleted.deletedHierarchyIds) ? deleted.deletedHierarchyIds : [],
            workspacePrefs: workspace.workspacePrefs && typeof workspace.workspacePrefs === "object" && !Array.isArray(workspace.workspacePrefs) ? workspace.workspacePrefs : {}
        };
    }
    async writeProjectRecord(project) {
        if (!this.projectRootDir)
            return;
        await this.ensureProjectStructure(project.id);
        const { customHierarchyNodes, deletedHierarchyIds, workspacePrefs, ...manifest } = project;
        await new ProgramJsonStore(this.projectFile(project.id, "manifest.json"), () => ({})).write(manifest);
        await new ProgramJsonStore(this.projectFile(project.id, "hierarchy", "nodes.json"), () => ({ customHierarchyNodes: [] })).write({ customHierarchyNodes });
        await new ProgramJsonStore(this.projectFile(project.id, "hierarchy", "deleted.json"), () => ({ deletedHierarchyIds: [] })).write({ deletedHierarchyIds });
        await new ProgramJsonStore(this.projectFile(project.id, "workspace", "preferences.json"), () => ({ workspacePrefs: {} })).write({ workspacePrefs });
    }
    async migrateLegacyProjectStore() {
        if (!this.projectIndexStore || !this.legacyProjectStore)
            return;
        const index = await this.projectIndexStore.read();
        if (index.projects.length > 0 || index.categories.length > 0)
            return;
        const legacy = await this.legacyProjectStore.read();
        if (!legacy.projects.length && !legacy.categories.length)
            return;
        await this.projectIndexStore.write({
            categories: normalizeProjectCategories(legacy.categories ?? []),
            projects: legacy.projects.map(({ customHierarchyNodes: _customHierarchyNodes, deletedHierarchyIds: _deletedHierarchyIds, workspacePrefs: _workspacePrefs, ...project }) => project)
        });
        for (const project of legacy.projects)
            await this.writeProjectRecord(project);
    }
    async prepareStorage() {
        await this.ensureNodeLibraryStructure();
        await this.migrateLegacyProjectStore();
    }
    async ensureStorageReady() {
        this.storageReady ??= this.prepareStorage();
        await this.storageReady;
    }
    async ensureNodeLibraryStructure() {
        if (!this.nodeRootDir)
            return;
        await Promise.all([
            mkdir(path.join(this.nodeRootDir, "custom"), { recursive: true }),
            mkdir(path.join(this.nodeRootDir, "packages"), { recursive: true }),
            ...automationNodeClasses.map((nodeClass) => mkdir(path.join(this.nodeRootDir, "custom", nodeClass), { recursive: true }))
        ]);
    }
    async ensureProjectStructure(projectId) {
        if (!this.projectRootDir)
            return;
        const root = this.projectDirectory(projectId);
        await Promise.all([
            mkdir(root, { recursive: true }),
            mkdir(path.join(root, "hierarchy"), { recursive: true }),
            mkdir(path.join(root, "workspace"), { recursive: true }),
            mkdir(path.join(root, "tasks"), { recursive: true }),
            mkdir(path.join(root, "routines"), { recursive: true }),
            mkdir(path.join(root, "configs"), { recursive: true }),
            mkdir(path.join(root, "flows"), { recursive: true }),
            mkdir(path.join(root, "recordings"), { recursive: true }),
            mkdir(path.join(root, "recordings", "sessions"), { recursive: true }),
            mkdir(path.join(root, "recordings", "normalized"), { recursive: true }),
            mkdir(path.join(root, "recordings", "snapshots"), { recursive: true }),
            mkdir(path.join(root, "recordings", "indexes"), { recursive: true }),
            mkdir(path.join(root, "policies"), { recursive: true }),
            mkdir(path.join(root, "runtime"), { recursive: true }),
            mkdir(path.join(root, "runtime", "sessions"), { recursive: true }),
            mkdir(path.join(root, "runtime", "indexes"), { recursive: true }),
            mkdir(path.join(root, "state"), { recursive: true }),
            mkdir(path.join(root, "custom-nodes"), { recursive: true }),
            mkdir(path.join(root, "artifacts"), { recursive: true })
        ]);
    }
    projectDirectory(projectId) {
        if (!this.projectRootDir)
            return "";
        return path.join(this.projectRootDir, safeSegment(projectId));
    }
    projectFile(projectId, ...parts) {
        return path.join(this.projectDirectory(projectId), ...parts);
    }
    async readRecordingIndex(projectId) {
        await this.findProject(projectId);
        return await new ProgramJsonStore(this.projectFile(projectId, "recordings", "indexes", "recordings.json"), () => ({ recordings: [], normalizedTimelines: [] })).read();
    }
    async readRuntimeIndex(projectId) {
        await this.findProject(projectId);
        return await new ProgramJsonStore(this.projectFile(projectId, "runtime", "indexes", "sessions.json"), () => ({ sessions: [] })).read();
    }
    async writeRuntimeSession(projectId, session) {
        await this.ensureProjectStructure(projectId);
        await new ProgramJsonStore(this.projectFile(projectId, "runtime", "sessions", `${safeSegment(session.runId)}.json`), () => ({})).write({ session: session });
        await new ProgramJsonStore(this.projectFile(projectId, "runtime", "indexes", "sessions.json"), () => ({ sessions: [] })).update((index) => ({
            sessions: upsertBy(index.sessions ?? [], "runId", {
                runId: session.runId,
                targetKind: session.targetKind,
                targetId: session.targetId,
                status: session.status,
                updatedAt: Date.now()
            })
        }));
    }
    async readProjectArtifactList(projectId, folder) {
        await this.ensureProjectStructure(projectId);
        if (!this.projectRootDir)
            return [];
        const dir = path.join(this.projectDirectory(projectId), folder);
        let files = [];
        try {
            files = await readdir(dir);
        }
        catch {
            return [];
        }
        const artifacts = [];
        for (const file of files.filter((item) => item.endsWith(".json"))) {
            const data = await new ProgramJsonStore(path.join(dir, file), () => ({})).read();
            if (Object.keys(data).length)
                artifacts.push(data);
        }
        return artifacts;
    }
    projectArtifactFile(projectId, kind, artifactId) {
        return this.projectFile(projectId, this.projectArtifactFolder(kind), `${safeSegment(artifactId)}.json`);
    }
    projectArtifactFolder(kind) {
        if (kind === "task")
            return "tasks";
        if (kind === "routine")
            return "routines";
        if (kind === "config")
            return "configs";
        return "flows";
    }
    projectArtifactId(kind, artifact) {
        const id = kind === "task" ? artifact.taskId : kind === "routine" ? artifact.routineId : kind === "config" ? artifact.configId : artifact.flowId;
        if (typeof id !== "string" || !id.trim())
            throw new Error(`${kind} ID is required.`);
        return id;
    }
    async writeRecordingIndex(projectId, mutator) {
        await this.findProject(projectId);
        return await new ProgramJsonStore(this.projectFile(projectId, "recordings", "indexes", "recordings.json"), () => ({ recordings: [], normalizedTimelines: [] })).update(mutator);
    }
    async writeProjectRecordingSession(projectId, recording) {
        await this.ensureProjectStructure(projectId);
        const recordingId = safeSegment(recording.recordingId);
        const sessionDir = path.join(this.projectDirectory(projectId), "recordings", "sessions", recordingId);
        await mkdir(path.join(sessionDir, "events"), { recursive: true });
        await mkdir(path.join(sessionDir, "snapshots"), { recursive: true });
        await new ProgramJsonStore(path.join(sessionDir, "recording.json"), () => ({ recording: recording })).write({ recording: recording });
        await new ProgramJsonStore(path.join(sessionDir, "events", "timeline.json"), () => ({ timeline: [] })).write({ timeline: recording.timeline });
        await new ProgramJsonStore(path.join(sessionDir, "snapshots", "initial-state.json"), () => ({ initialState: recording.initialState })).write({ initialState: recording.initialState });
        await this.writeRecordingIndex(projectId, (index) => ({
            recordings: upsertBy(index.recordings ?? [], "recordingId", {
                recordingId: recording.recordingId,
                ...(recording.taskId !== undefined ? { taskId: recording.taskId } : {}),
                startedAt: recording.startedAt,
                ...(recording.endedAt !== undefined ? { endedAt: recording.endedAt } : {}),
                updatedAt: Date.now()
            }),
            normalizedTimelines: index.normalizedTimelines ?? []
        }));
    }
    async writeProjectNormalizedTimeline(projectId, normalized) {
        await this.ensureProjectStructure(projectId);
        const fileName = `${safeSegment(normalized.normalizedTimelineId)}.json`;
        await new ProgramJsonStore(this.projectFile(projectId, "recordings", "normalized", fileName), () => ({ normalizedTimeline: normalized })).write({ normalizedTimeline: normalized });
        await this.writeRecordingIndex(projectId, (index) => ({
            recordings: index.recordings ?? [],
            normalizedTimelines: upsertBy(index.normalizedTimelines ?? [], "normalizedTimelineId", {
                normalizedTimelineId: normalized.normalizedTimelineId,
                recordingId: normalized.recordingId,
                generatedAt: normalized.generatedAt
            })
        }));
    }
    async loadProjectRecordings(projectId) {
        if (!this.projectRootDir)
            return;
        const index = await this.readRecordingIndex(projectId);
        for (const item of index.recordings ?? []) {
            const stored = await new ProgramJsonStore(this.projectFile(projectId, "recordings", "sessions", safeSegment(item.recordingId), "recording.json"), () => ({})).read();
            const recording = stored.recording;
            if (recording?.recordingId)
                await this.repositories.recordingSessions.put(recording);
        }
        for (const item of index.normalizedTimelines ?? []) {
            const stored = await new ProgramJsonStore(this.projectFile(projectId, "recordings", "normalized", `${safeSegment(item.normalizedTimelineId)}.json`), () => ({})).read();
            const normalized = stored.normalizedTimeline;
            if (normalized?.normalizedTimelineId)
                await this.repositories.normalizedTimelines.put(normalized);
        }
    }
    async seedFixture() {
        const fixture = createAutomationStudioFixture();
        await this.repositories.recordingSessions.put(fixture.recording);
        await this.repositories.normalizedTimelines.put(fixture.normalizedTimeline);
        await this.repositories.signalRegistries.put(fixture.signalRegistry);
        await this.repositories.learnedTaskModels.put(fixture.learnedTaskModel);
        await this.repositories.policyGraphs.put(fixture.policy);
    }
}
function normalizeProjectCategories(categories) {
    return categories.map((category, index) => ({
        ...category,
        order: typeof category.order === "number" && Number.isFinite(category.order) ? category.order : index
    }));
}
function nextCategoryOrder(categories) {
    if (!categories.length)
        return 0;
    return Math.max(...normalizeProjectCategories(categories).map((category) => category.order)) + 1;
}
function upsertBy(items, key, item) {
    const index = items.findIndex((candidate) => candidate[key] === item[key]);
    if (index < 0)
        return [item, ...items];
    return items.map((candidate, candidateIndex) => candidateIndex === index ? item : candidate);
}
