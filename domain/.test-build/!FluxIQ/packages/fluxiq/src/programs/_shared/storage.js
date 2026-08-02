import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
export class ProgramJsonStore {
    empty;
    filePath;
    constructor(filePath, empty) {
        this.empty = empty;
        this.filePath = path.resolve(filePath);
    }
    async read() {
        try {
            const payload = JSON.parse(await readFile(this.filePath, "utf8"));
            if (payload && typeof payload === "object" && payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
                return payload.data;
            }
        }
        catch {
            // Missing or malformed program state is treated as an empty store.
        }
        return this.empty();
    }
    async write(data) {
        await mkdir(path.dirname(this.filePath), { recursive: true });
        const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
        await writeFile(tempPath, `${JSON.stringify({ version: 1, data }, null, 2)}\n`, "utf8");
        try {
            await rename(tempPath, this.filePath);
        }
        catch (error) {
            await rm(tempPath, { force: true });
            throw error;
        }
        return data;
    }
    async update(mutator) {
        const data = await this.read();
        const result = await mutator(data);
        return this.write(result ?? data);
    }
}
export function programDataFile(rootDir, programId, fileName) {
    return path.join(rootDir, "programs", safeSegment(programId), fileName);
}
export function normalizeScope(scope = {}) {
    const domainId = scope.domainId?.trim().toLowerCase();
    return domainId ? { domainId } : {};
}
export function scopeKey(scope = {}) {
    return normalizeScope(scope).domainId ?? "global";
}
export function safeSegment(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "_");
}
export function isJsonObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
export function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}
