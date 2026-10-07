import assert from "node:assert/strict";
import test from "node:test";

import { gateName } from "../index.mjs";

const ROOT = "fluxiq-web-extension";

test("a package script is named as the pnpm command that runs it", () => {
  assert.equal(gateName({ npm_lifecycle_event: "build", npm_package_name: "@fluxiq-web-extension/domain" }, ROOT), "pnpm --filter @fluxiq-web-extension/domain build");
  assert.equal(gateName({ npm_lifecycle_event: "test:e2e", npm_package_name: "@fluxiq-web-extension/extension" }, ROOT), "pnpm --filter @fluxiq-web-extension/extension test:e2e");
});

test("the root package's script is named without a filter", () => {
  assert.equal(gateName({ npm_lifecycle_event: "check", npm_package_name: ROOT }, ROOT), "pnpm check");
});

test("run by hand, outside any package script, the gate is named after pnpm check", () => {
  assert.equal(gateName({}, ROOT), "pnpm check");
});
