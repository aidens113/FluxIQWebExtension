import assert from "node:assert/strict";
import test from "node:test";
import { contentWorldSource } from "../content-world-source.js";

test("the scroll watch and the runtime stub run before the content script, in one script named as the sandbox's own", () => {
  const world = contentWorldSource("/*content*/console.log(1);");
  const watchAt = world.source.indexOf("installScrollWatch");
  const stubAt = world.source.indexOf("installSandboxRuntimeStub");
  const contentAt = world.source.indexOf("/*content*/");
  assert.ok(watchAt >= 0 && stubAt > watchAt && contentAt > stubAt, "watch, stub, content, in that order");
  assert.match(world.source, /\/\/# sourceURL=fluxiq-snapshot-content\.js\n$/u);
  assert.ok(world.source.includes(JSON.stringify(world.harnessGlobal)));
  assert.ok(world.source.includes(JSON.stringify(world.scrollGlobal)));
  assert.notEqual(world.harnessGlobal, world.scrollGlobal);
});

test("the page-world script is named as the sandbox's own too, so it is never counted as a page script", () => {
  assert.equal(contentWorldSource("").pageWorld("/*page*/"), "/*page*/\n//# sourceURL=fluxiq-snapshot-page-world.js\n");
});
