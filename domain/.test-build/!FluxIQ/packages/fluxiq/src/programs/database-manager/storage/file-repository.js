import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
export class FileRepository {
    rootDir;
    kind;
    constructor(options) {
        this.rootDir = path.resolve(options.rootDir);
        this.kind = safeSegment(options.kind);
        if (!this.kind) {
            throw new Error("Repository kind is required");
        }
    }
    async list(scope = {}) {
        const index = await this.readIndex(scope);
        return Object.values(index.records).sort((left, right) => left.id.localeCompare(right.id));
    }
    async get(id, scope = {}) {
        const index = await this.readIndex(scope);
        return index.records[id] ?? null;
    }
    async put(record) {
        const scope = normalizeScope(record.scope);
        const now = Date.now();
        const index = await this.readIndex(scope);
        const existing = index.records[record.id];
        const next = {
            ...record,
            kind: this.kind,
            scope,
            createdAtMs: existing?.createdAtMs ?? (record.createdAtMs || now),
            updatedAtMs: now
        };
        index.records[next.id] = next;
        await this.writeIndex(scope, index);
        return next;
    }
    async delete(id, scope = {}) {
        const index = await this.readIndex(scope);
        if (!index.records[id]) {
            return false;
        }
        delete index.records[id];
        await this.writeIndex(scope, index);
        return true;
    }
    scopeDir(scope) {
        const normalized = normalizeScope(scope);
        const scopeSegment = normalized.domainId ? path.join("domains", safeSegment(normalized.domainId)) : "global";
        return path.join(this.rootDir, scopeSegment, this.kind);
    }
    indexPath(scope) {
        return path.join(this.scopeDir(scope), "records.json");
    }
    async readIndex(scope) {
        const filePath = this.indexPath(scope);
        try {
            const payload = JSON.parse(await readFile(filePath, "utf8"));
            return {
                version: 1,
                records: isRecordMap(payload.records) ? payload.records : {}
            };
        }
        catch {
            return { version: 1, records: {} };
        }
    }
    async writeIndex(scope, index) {
        const directory = this.scopeDir(scope);
        await mkdir(directory, { recursive: true });
        const filePath = this.indexPath(scope);
        const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
        await writeFile(tempPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
        try {
            await rename(tempPath, filePath);
        }
        catch (error) {
            await rm(tempPath, { force: true });
            throw error;
        }
    }
}
export function createRecord(params) {
    const now = params.nowMs ?? Date.now();
    return {
        id: params.id,
        kind: safeSegment(params.kind),
        scope: normalizeScope(params.scope ?? {}),
        data: params.data,
        createdAtMs: now,
        updatedAtMs: now
    };
}
function normalizeScope(scope) {
    const domainId = scope.domainId?.trim().toLowerCase();
    return domainId ? { domainId } : {};
}
function safeSegment(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "_");
}
function isRecordMap(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
