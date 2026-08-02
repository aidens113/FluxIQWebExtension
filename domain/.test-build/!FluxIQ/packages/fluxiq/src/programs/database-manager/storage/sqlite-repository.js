import { mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import sqlite3 from "sqlite3";
export class SQLiteRepository {
    rootDir;
    kind;
    tableName;
    constructor(options) {
        this.rootDir = path.resolve(options.rootDir);
        this.kind = safeKind(options.kind);
        if (!this.kind)
            throw new Error("Repository kind is required");
        this.tableName = quoteIdentifier(this.kind);
    }
    async list(scope = {}) {
        const db = await this.open(scope);
        try {
            const rows = await all(db, `select id, kind, data, created_at_ms as createdAtMs, updated_at_ms as updatedAtMs from ${this.tableName} order by id`);
            return rows.map((row) => rowToRecord(row, normalizeScope(scope)));
        }
        finally {
            await close(db);
        }
    }
    async get(id, scope = {}) {
        const db = await this.open(scope);
        try {
            const row = await get(db, `select id, kind, data, created_at_ms as createdAtMs, updated_at_ms as updatedAtMs from ${this.tableName} where id = ?`, [id]);
            return row ? rowToRecord(row, normalizeScope(scope)) : null;
        }
        finally {
            await close(db);
        }
    }
    async put(record) {
        const scope = normalizeScope(record.scope);
        const existing = await this.get(record.id, scope);
        const now = Date.now();
        const next = {
            ...record,
            kind: this.kind,
            scope,
            createdAtMs: existing?.createdAtMs ?? (record.createdAtMs || now),
            updatedAtMs: now
        };
        const db = await this.open(scope);
        try {
            await run(db, `
        insert into ${this.tableName} (id, kind, data, created_at_ms, updated_at_ms)
        values (?, ?, ?, ?, ?)
        on conflict(id) do update set
          kind = excluded.kind,
          data = excluded.data,
          updated_at_ms = excluded.updated_at_ms
      `, [next.id, next.kind, JSON.stringify(next.data), next.createdAtMs, next.updatedAtMs]);
            return next;
        }
        finally {
            await close(db);
        }
    }
    async delete(id, scope = {}) {
        const db = await this.open(scope);
        try {
            const result = await run(db, `delete from ${this.tableName} where id = ?`, [id]);
            return result.changes > 0;
        }
        finally {
            await close(db);
        }
    }
    databases() {
        const values = new Set(["global"]);
        const domainRoot = path.join(this.rootDir, "domains");
        try {
            for (const entry of readdirSync(domainRoot, { withFileTypes: true })) {
                if (entry.isFile() && entry.name.endsWith(".sqlite")) {
                    values.add(entry.name.replace(/\.sqlite$/i, ""));
                }
            }
        }
        catch {
            // No domain database directory yet.
        }
        return [...values].sort((left, right) => left.localeCompare(right));
    }
    async open(scope) {
        const filePath = this.databasePath(scope);
        mkdirSync(path.dirname(filePath), { recursive: true });
        const db = await openDatabase(filePath);
        await run(db, "pragma foreign_keys = ON");
        await run(db, "pragma journal_mode = WAL");
        await run(db, `
      create table if not exists ${this.tableName} (
        id text primary key,
        kind text not null,
        data text not null,
        created_at_ms integer not null,
        updated_at_ms integer not null
      )
    `);
        await run(db, `create index if not exists ${quoteIdentifier(`${this.kind}_updated_idx`)} on ${this.tableName} (updated_at_ms)`);
        return db;
    }
    databasePath(scope) {
        const normalized = normalizeScope(scope);
        if (normalized.domainId) {
            return path.join(this.rootDir, "domains", `${safeKind(normalized.domainId)}.sqlite`);
        }
        return path.join(this.rootDir, "global.sqlite");
    }
}
export function createRecord(params) {
    const now = params.nowMs ?? Date.now();
    return {
        id: params.id,
        kind: safeKind(params.kind),
        scope: normalizeScope(params.scope ?? {}),
        data: params.data,
        createdAtMs: now,
        updatedAtMs: now
    };
}
function openDatabase(filePath) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(filePath, (error) => {
            if (error)
                reject(error);
            else
                resolve(db);
        });
    });
}
function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(error) {
            if (error)
                reject(error);
            else
                resolve({ changes: this.changes, lastID: this.lastID });
        });
    });
}
function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => {
            if (error)
                reject(error);
            else
                resolve(rows);
        });
    });
}
function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => {
            if (error)
                reject(error);
            else
                resolve(row);
        });
    });
}
function close(db) {
    return new Promise((resolve, reject) => {
        db.close((error) => {
            if (error)
                reject(error);
            else
                resolve();
        });
    });
}
function rowToRecord(row, scope) {
    return {
        id: row.id,
        kind: row.kind,
        scope,
        data: JSON.parse(row.data),
        createdAtMs: row.createdAtMs,
        updatedAtMs: row.updatedAtMs
    };
}
function normalizeScope(scope) {
    const domainId = scope.domainId?.trim().toLowerCase();
    return domainId ? { domainId } : {};
}
function safeKind(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "_");
}
function quoteIdentifier(value) {
    return `"${value.replaceAll('"', '""')}"`;
}
