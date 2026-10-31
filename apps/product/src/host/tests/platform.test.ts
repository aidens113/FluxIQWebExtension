import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createPlatformRegistry } from "fluxiq/platform/panel";
import { createSeedWorkspace } from "../../hooks/tests/seed-workspace.ts";
import { registerFluxIQPlatform } from "../index.ts";

test("registers the product and the workspace.created owned seed", async (context) => {
  const workspace = await createSeedWorkspace(context);
  const registry = createPlatformRegistry();
  registerFluxIQPlatform(registry.platform);
  assert.equal(registry.product()?.id, "fluxiq");
  await registry.emit("workspace.created", workspace.payload);
  const projects = await workspace.projects();
  assert.deepEqual(projects.map((project) => [project.name, project.ownerUserId]), [["My automations", workspace.owner.userId]]);
  await registry.emit("workspace.created", workspace.payload);
  assert.deepEqual(await workspace.projects(), projects);
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
