import { ProgramJsonStore, programDataFile } from "../../_shared/storage";
export class DatabaseManagerService {
    repositories = new Map();
    migrations = new Map();
    state;
    constructor(options = {}) {
        if (options.dataDir) {
            this.state = new ProgramJsonStore(programDataFile(options.dataDir, "database-manager", "state.json"), () => ({ migrationRuns: [] }));
        }
    }
    registerRepository(kind, repository) {
        const key = safeKind(kind);
        if (this.repositories.has(key)) {
            throw new Error(`Duplicate repository kind: ${key}`);
        }
        this.repositories.set(key, repository);
        return this;
    }
    repository(kind) {
        const repo = this.repositories.get(safeKind(kind));
        if (!repo) {
            throw new Error(`Unknown repository kind: ${kind}`);
        }
        return repo;
    }
    registerMigration(migration) {
        if (this.migrations.has(migration.id)) {
            throw new Error(`Duplicate migration: ${migration.id}`);
        }
        this.migrations.set(migration.id, migration);
        return this;
    }
    async snapshot(scope = {}) {
        const stores = [];
        for (const [kind, repository] of this.repositories) {
            stores.push({
                kind,
                scope,
                recordCount: (await repository.list(scope)).length
            });
        }
        return {
            databases: this.databases(),
            stores: stores.sort((left, right) => left.kind.localeCompare(right.kind)),
            migrations: [...this.migrations.values()].map(({ id, description }) => ({ id, description })),
            migrationRuns: (await this.readState()).migrationRuns.sort((left, right) => right.startedAtMs - left.startedAtMs)
        };
    }
    async listRecords(kind, scope = {}) {
        return this.repository(kind).list(scope);
    }
    async getRecord(kind, id, scope = {}) {
        return this.repository(kind).get(id, scope);
    }
    async putRecord(kind, id, data, scope = {}) {
        const existing = await this.repository(kind).get(id, scope);
        return this.repository(kind).put({
            id,
            kind: safeKind(kind),
            scope,
            data,
            createdAtMs: existing?.createdAtMs ?? Date.now(),
            updatedAtMs: Date.now()
        });
    }
    async deleteRecord(kind, id, scope = {}) {
        return this.repository(kind).delete(id, scope);
    }
    databases() {
        const values = new Set(["global"]);
        for (const repository of this.repositories.values()) {
            if (hasDatabaseList(repository)) {
                for (const database of repository.databases())
                    values.add(database);
            }
        }
        return [...values].sort((left, right) => left.localeCompare(right));
    }
    async runMigration(id, direction = "up") {
        const migration = this.migrations.get(id);
        if (!migration) {
            throw new Error(`Unknown migration: ${id}`);
        }
        if (direction === "down" && !migration.down) {
            throw new Error(`Migration does not support down: ${id}`);
        }
        const startedAtMs = Date.now();
        try {
            if (direction === "up")
                await migration.up();
            else
                await migration.down?.();
            return this.recordMigrationRun({ id: `${id}.${startedAtMs}`, migrationId: id, direction, status: "succeeded", startedAtMs, finishedAtMs: Date.now() });
        }
        catch (error) {
            return this.recordMigrationRun({
                id: `${id}.${startedAtMs}`,
                migrationId: id,
                direction,
                status: "failed",
                startedAtMs,
                finishedAtMs: Date.now(),
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async readState() {
        return this.state?.read() ?? { migrationRuns: [] };
    }
    async recordMigrationRun(run) {
        if (!this.state)
            return run;
        await this.state.update((state) => {
            state.migrationRuns = [run, ...state.migrationRuns].slice(0, 500);
        });
        return run;
    }
}
function safeKind(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "_");
}
function hasDatabaseList(value) {
    return "databases" in value && typeof value.databases === "function";
}
