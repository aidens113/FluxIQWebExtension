import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createPlatformRegistry, type PlatformHookPayloads } from "fluxiq/platform/panel";
import { registerFluxIQPlatform } from "../index.ts";

function fakePayload(created: string[]): PlatformHookPayloads["workspace.created"] {
  const studio = {
    async listProjects() {
      return { categories: [], projects: created.map((name) => ({ id: name, name })) };
    },
    async createProject(input: { name: unknown }) {
      created.push(String(input.name));
      return { id: String(input.name), name: String(input.name) };
    }
  };
  return { accountId: "acct-1", workspaceId: "ws-1", ownerUserId: "user-1", fluxiq: { programs: { automationStudio: studio } } } as unknown as PlatformHookPayloads["workspace.created"];
}

test("registers the product and the workspace.created seed", async () => {
  const registry = createPlatformRegistry();
  registerFluxIQPlatform(registry.platform);
  assert.equal(registry.product()?.id, "fluxiq");
  const created: string[] = [];
  await registry.emit("workspace.created", fakePayload(created));
  assert.deepEqual(created, ["My automations"]);
  await registry.emit("workspace.created", fakePayload(created));
  assert.deepEqual(created, ["My automations"]);
});

test("every manifest asset exists in the assets directory and the svg carries no script", () => {
  const registry = createPlatformRegistry();
  registerFluxIQPlatform(registry.platform);
  const dir = registry.assetsDir();
  assert.ok(dir && path.isAbsolute(dir), "an absolute assets directory");
  assert.equal(path.basename(dir), "assets");
  const names = Object.values(registry.product()?.assets ?? {}).filter((name): name is string => typeof name === "string");
  assert.ok(names.length > 0);
  for (const name of names) {
    assert.ok(existsSync(path.join(dir, name)), `${name} exists`);
    if (name.endsWith(".svg")) {
      const svg = readFileSync(path.join(dir, name), "utf8");
      assert.ok(!/<script|\son[a-z]+\s*=|javascript:|<foreignObject/iu.test(svg), `${name} has no script`);
    }
  }
});
