import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { executeAuthCommand } from "./auth-cli.js";
import { WebPanelAuthSessionCache } from "./auth-session.js";

const execFileAsync = promisify(execFile);

test("auth status and clear emit only non-secret scope metadata", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-auth-cli-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cache = new WebPanelAuthSessionCache(root, { now: () => new Date("2026-09-04T12:00:00.000Z") });
  const scope = { origin: "http://127.0.0.1:3000", username: "runner" };
  await cache.save(scope, { cookie: "fluxiq_session=never-print-this", expiresAt: "2026-09-04T13:00:00.000Z" });

  const status = await executeAuthCommand(cache, "status", scope);
  assert.deepEqual(status, { command: "auth.status", state: "valid", ...scope, createdAt: "2026-09-04T12:00:00.000Z", expiresAt: "2026-09-04T13:00:00.000Z" });
  assert.equal(JSON.stringify(status).includes("never-print-this"), false);
  assert.equal("path" in status, false);

  assert.deepEqual(await executeAuthCommand(cache, "clear", scope), { command: "auth.clear", state: "missing", ...scope });
  assert.equal((await cache.status(scope)).state, "missing");
});

test("CLI auth status and clear need only existing origin and username", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-auth-cli-process-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const scope = { origin: "http://127.0.0.1:3000", username: "runner" };
  const cache = new WebPanelAuthSessionCache(root);
  await cache.save(scope, { cookie: "fluxiq_session=opaque-cli-secret" });
  const cliPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "cli.js");
  const env = { ...process.env, FLUXIQ_WEB_EXTENSION_ROOT: root, FLUXIQ_TEST_RUNS_DIR: root, FLUXIQ_TEST_TARGET: "existing", FLUXIQ_TEST_BASE_URL: scope.origin, FLUXIQ_TEST_USERNAME: scope.username };

  const status = JSON.parse((await execFileAsync(process.execPath, [cliPath, "auth", "status"], { env })).stdout) as Record<string, unknown>;
  assert.deepEqual(status, { command: "auth.status", state: "valid", ...scope, createdAt: status.createdAt, expiresAt: status.expiresAt });
  assert.equal(JSON.stringify(status).includes("opaque-cli-secret"), false);
  assert.equal("path" in status, false);

  const cleared = JSON.parse((await execFileAsync(process.execPath, [cliPath, "auth", "clear"], { env })).stdout) as Record<string, unknown>;
  assert.deepEqual(cleared, { command: "auth.clear", state: "missing", ...scope });
});
