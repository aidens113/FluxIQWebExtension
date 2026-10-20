import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { compareMirrors, CORE_MIRRORS, formatMirrorReport } from "../index.mjs";

const AUDIT = "// audit entry\nexport const x = 1;\n";
const RULE = "// a rule\nexport const id = 'r';\n";

async function repository(base, name, files) {
  const root = path.join(base, name);
  await mkdir(root, { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: root });
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), content);
  }
  return root;
}

async function compare(extFiles, coreFiles) {
  const base = await mkdtemp(path.join(tmpdir(), "core-mirror-"));
  try {
    const extRoot = await repository(base, "ext", extFiles);
    const coreRoot = await repository(base, "core", coreFiles);
    return await compareMirrors({ extRoot, coreRoot, sets: CORE_MIRRORS });
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}

const mirrored = (overrides = {}) => ({
  "scripts/structure-audit.mjs": AUDIT,
  "scripts/structure-audit/rules/r.mjs": RULE,
  "scripts/structure-audit/config.mjs": "export const CONFIG = {};\n",
  "src/unrelated.ts": "export {};\n",
  ...overrides
});

test("identical mirrors are in sync and counted", async () => {
  const result = await compare(mirrored(), mirrored());
  assert.equal(result.inSync, true);
  assert.deepEqual(result.sets, [{ name: "structure-audit", files: 2, differences: [] }]);
  assert.match(formatMirrorReport(result, "C:/core"), /^core-mirror: 1 mirror set\(s\) match .*structure-audit \(2 files\)/u);
});

test("a one-byte difference fails and names the file", async () => {
  const result = await compare(mirrored(), mirrored({ "scripts/structure-audit/rules/r.mjs": RULE.replace("'r'", "'s'") }));
  assert.equal(result.inSync, false);
  assert.deepEqual(result.sets[0].differences, [{ path: "scripts/structure-audit/rules/r.mjs", kind: "differs" }]);
  const text = formatMirrorReport(result, "C:/core");
  assert.match(text, /scripts\/structure-audit\/rules\/r\.mjs differs/u);
  assert.match(text, /change Core first, then copy/u);
});

test("a file on one side only fails and says which side", async () => {
  const result = await compare(
    mirrored({ "scripts/structure-audit/rules/new.mjs": RULE }),
    mirrored({ "scripts/structure-audit/tests/t.test.mjs": "// t\n" })
  );
  assert.equal(result.inSync, false);
  assert.deepEqual(result.sets[0].differences, [
    { path: "scripts/structure-audit/rules/new.mjs", kind: "extension-only" },
    { path: "scripts/structure-audit/tests/t.test.mjs", kind: "core-only" }
  ]);
  const text = formatMirrorReport(result, "C:/core");
  assert.match(text, /new\.mjs exists only in this repository/u);
  assert.match(text, /t\.test\.mjs exists only in Core/u);
});

test("a CRLF-only difference is not a difference", async () => {
  const result = await compare(mirrored(), mirrored({
    "scripts/structure-audit.mjs": AUDIT.replaceAll("\n", "\r\n"),
    "scripts/structure-audit/rules/r.mjs": RULE.replaceAll("\n", "\r\n")
  }));
  assert.equal(result.inSync, true);
});

test("the per-repository config.mjs is never compared", async () => {
  const differing = await compare(mirrored(), mirrored({ "scripts/structure-audit/config.mjs": "export const CONFIG = { core: true };\n" }));
  assert.equal(differing.inSync, true);
  const coreWithout = Object.fromEntries(Object.entries(mirrored()).filter(([file]) => !file.endsWith("config.mjs")));
  const oneSided = await compare(mirrored(), coreWithout);
  assert.equal(oneSided.inSync, true);
});
