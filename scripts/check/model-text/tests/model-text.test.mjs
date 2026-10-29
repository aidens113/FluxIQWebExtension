import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { findTokens, formatModelTextReport, namesInStrings, runModelTextCheck } from "../index.mjs";

const RUNTIME = "packages/fluxiq/src/programs/automation-studio/runtime";

async function write(root, file, content) {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), content);
}

async function fixture({ coreText }) {
  const base = await mkdtemp(path.join(tmpdir(), "model-text-"));
  const ext = path.join(base, "ext");
  const core = path.join(base, "core");
  const scenario = "apps/scenario-lab/src/scenarios/job-board/data.ts";
  await write(ext, scenario, 'export const COMPANY = "Quillmark Labs";\nexport const NOTE = "Remote roles";\n');
  await write(core, `${RUNTIME}/llm/instructions.ts`, coreText);
  await write(core, `${RUNTIME}/other/plain.ts`, "export const w = 'remote roles are listed';\n");
  return { ext, core, base };
}

test("a scenario name in model-facing Core text fails with file, line and token", async () => {
  const { ext, core, base } = await fixture({ coreText: 'export const A = "fine";\nexport const B = "open the quillmark labs page";\n' });
  try {
    const result = await runModelTextCheck({ extRoot: ext, coreRoot: core });
    assert.equal(result.hits.length, 1);
    assert.deepEqual(result.hits[0], { file: `${RUNTIME}/llm/instructions.ts`, line: 2, token: "Quillmark Labs" });
    assert.match(formatModelTextReport(result), /instructions\.ts:2 {2}"Quillmark Labs"/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("generic text passes, and so does a word Core writes in lower case elsewhere", async () => {
  const { ext, core, base } = await fixture({ coreText: 'export const A = "open the support queue and filter remote roles";\n' });
  try {
    const result = await runModelTextCheck({ extRoot: ext, coreRoot: core });
    assert.deepEqual(result.hits, []);
    assert.match(formatModelTextReport(result), /^model-text: ok/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("a token inside a comment is not model text", () => {
  assert.deepEqual(findTokens({ file: "a.ts", text: "// Quillmark Labs\n* Quillmark Labs\n", tokens: ["Quillmark Labs"] }), []);
});

test("a retired example fails even though no fixture holds it", async () => {
  const { ext, core, base } = await fixture({ coreText: 'export const A = "Archive the Garden Club newsletter";\n' });
  try {
    const result = await runModelTextCheck({ extRoot: ext, coreRoot: core });
    assert.deepEqual(result.hits.map((hit) => hit.token), ["Garden Club"]);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("names are read from double-quoted strings only", () => {
  assert.deepEqual([...namesInStrings('const a = "Halvard Labs hires"; // Mention Elsewhere')], ["Halvard Labs"]);
});

const TOKENS = ["Space Grey"];

test("a scenario token inside a comment passes, inside a string or template literal fails", () => {
  assert.deepEqual(findTokens({ file: "a.ts", text: "/* Space Grey */\n// Space Grey\n", tokens: TOKENS }), []);
  assert.equal(findTokens({ file: "a.ts", text: 'const a = "pick Space Grey";\n', tokens: TOKENS }).length, 1);
  assert.equal(findTokens({ file: "a.ts", text: "const a = `x\n${b} pick Space Grey`;\n", tokens: TOKENS })[0].line, 2);
  assert.equal(findTokens({ file: "a.ts", text: "const a = `pick ${b} Space Grey`;\n", tokens: TOKENS }).length, 1);
});

test("a regex literal or comment-like text inside a string does not confuse the scanner", () => {
  const text = 'const r = /"\/\/ Space Grey/;\nconst u = "http://x.test"; // Space Grey\nconst s = "a // b";\nconst t = "Space Grey";\n';
  assert.deepEqual(findTokens({ file: "a.ts", text, tokens: TOKENS }).map((hit) => hit.line), [4]);
});

test("a token the allow list holds does not enter the vocabulary", async () => {
  const { ext, core, base } = await fixture({ coreText: 'export const A = "the Watchlist page";\n' });
  try {
    await write(ext, "apps/scenario-lab/src/scenarios/job-board/more.ts", 'export const W = "Watchlist";\n');
    assert.deepEqual((await runModelTextCheck({ extRoot: ext, coreRoot: core })).hits, []);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
