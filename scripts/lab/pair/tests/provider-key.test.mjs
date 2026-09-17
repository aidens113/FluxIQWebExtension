import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { providerKeySource } from "../provider-key.mjs";

// A fixture value, not a credential.
const FAKE = "fixture-value-0000";

async function withCheckout(files, body) {
  const root = await mkdtemp(path.join(tmpdir(), "lab-pair-key-"));
  try {
    for (const [name, contents] of Object.entries(files)) await writeFile(path.join(root, name), contents);
    await body(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("the process environment wins, and the result never carries the value", async () => {
  await withCheckout({ ".env.local": `DEEPSEEK_API_KEY=${FAKE}\n` }, async (root) => {
    const found = await providerKeySource({ env: { DEEPSEEK_API_KEY: FAKE }, extRoot: root });
    assert.deepEqual(found, { name: "DEEPSEEK_API_KEY", found: true, source: "the process environment" });
    assert.doesNotMatch(JSON.stringify(found), new RegExp(FAKE, "u"));
  });
});

test("otherwise .env is read before .env.local, by name only", async () => {
  await withCheckout({ ".env": "OTHER=1\n", ".env.local": `# comment\nexport DEEPSEEK_API_KEY="${FAKE}"\n` }, async (root) => {
    const found = await providerKeySource({ env: {}, extRoot: root });
    assert.deepEqual(found, { name: "DEEPSEEK_API_KEY", found: true, source: path.join(root, ".env.local") });
    assert.doesNotMatch(JSON.stringify(found), new RegExp(FAKE, "u"));
  });
  await withCheckout({ ".env": `DEEPSEEK_API_KEY=${FAKE}\n`, ".env.local": `DEEPSEEK_API_KEY=${FAKE}\n` }, async (root) => {
    assert.equal((await providerKeySource({ env: {}, extRoot: root })).source, path.join(root, ".env"));
  });
});

test("an empty, blank, commented or absent assignment is not a key", async () => {
  await withCheckout({ ".env": "DEEPSEEK_API_KEY=\n# DEEPSEEK_API_KEY=x\n", ".env.local": "DEEPSEEK_API_KEY=\"\"\nOTHER_DEEPSEEK_API_KEY=x\n" }, async (root) => {
    const found = await providerKeySource({ env: { DEEPSEEK_API_KEY: "   " }, extRoot: root });
    assert.deepEqual(found, { name: "DEEPSEEK_API_KEY", found: false, searched: ["the process environment", path.join(root, ".env"), path.join(root, ".env.local")] });
  });
  await withCheckout({}, async (root) => {
    assert.equal((await providerKeySource({ env: {}, extRoot: root })).found, false);
  });
});
