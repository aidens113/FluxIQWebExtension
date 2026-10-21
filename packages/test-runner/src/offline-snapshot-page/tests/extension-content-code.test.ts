// The extension's production content code, as the snapshot page runs it
// outside the e2e harness: the content and page-world bundles the extension's
// own build wrote under `dist/<target>/`, and the domain's `executeAction`
// builder. A missing bundle, or one older than the extension's source, is
// refused with the command that makes it, never run stale.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { executeActionMessage } from "@fluxiq-web-extension/domain/node";
import { loadExtensionContentCode } from "../extension-content-code.js";

async function extensionTree(): Promise<{ dir: string; at(relative: string, text: string, seconds: number): Promise<void> }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "p5w8-content-"));
  return {
    dir,
    at: async (relative, text, seconds) => {
      const file = path.join(dir, relative);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, text);
      await utimes(file, seconds, seconds);
    },
  };
}

test("a current build gives its content and page-world bundles and the domain's own action message builder", async () => {
  const tree = await extensionTree();
  try {
    await tree.at("src/content/index.ts", "source", 1_000);
    await tree.at("src/content/tests/x.test.ts", "source", 1_500);
    await tree.at("dist/chrome/content/index.js", "content bundle", 2_000);
    await tree.at("dist/chrome/page-world/index.js", "page bundle", 2_000);
    const code = await loadExtensionContentCode({ extensionDir: tree.dir });
    assert.equal(code.contentScript, "content bundle");
    assert.equal(code.pageWorldScript, "page bundle");
    assert.equal(code.actionMessage, executeActionMessage);
  } finally {
    await rm(tree.dir, { recursive: true, force: true });
  }
});

test("a missing bundle is refused with the build command", async () => {
  const tree = await extensionTree();
  try {
    await tree.at("src/content/index.ts", "source", 1_000);
    await tree.at("dist/chrome/content/index.js", "content bundle", 2_000);
    await assert.rejects(loadExtensionContentCode({ extensionDir: tree.dir }), (error: Error) => {
      assert.match(error.message, /page-world\/index\.js/u);
      assert.match(error.message, /pnpm --filter @fluxiq-web-extension\/extension build/u);
      return true;
    });
  } finally {
    await rm(tree.dir, { recursive: true, force: true });
  }
});

test("a bundle older than any file of the extension's source is refused, naming that file", async () => {
  const tree = await extensionTree();
  try {
    await tree.at("dist/chrome/content/index.js", "content bundle", 2_000);
    await tree.at("dist/chrome/page-world/index.js", "page bundle", 1_200);
    await tree.at("src/content/index.ts", "source", 1_000);
    await tree.at("src/page-world/deep/later.ts", "source", 1_500);
    await assert.rejects(loadExtensionContentCode({ extensionDir: tree.dir }), (error: Error) => {
      assert.match(error.message, /older than/u);
      assert.match(error.message, /later\.ts/u);
      assert.match(error.message, /pnpm --filter @fluxiq-web-extension\/extension build/u);
      return true;
    });
  } finally {
    await rm(tree.dir, { recursive: true, force: true });
  }
});

test("another target's bundles are read from its own directory", async () => {
  const tree = await extensionTree();
  try {
    await tree.at("src/content/index.ts", "source", 1_000);
    await tree.at("dist/e2e-chromium/content/index.js", "e2e content", 2_000);
    await tree.at("dist/e2e-chromium/page-world/index.js", "e2e page", 2_000);
    const code = await loadExtensionContentCode({ extensionDir: tree.dir, target: "e2e-chromium" });
    assert.equal(code.contentScript, "e2e content");
  } finally {
    await rm(tree.dir, { recursive: true, force: true });
  }
});
