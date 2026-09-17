import assert from "node:assert/strict";
import test from "node:test";
import { processesUsingRoots } from "../processes-using-roots.mjs";

const ROOTS = ["F:/fxlab/lab-ext", "F:\\fxlab\\!FluxIQ"];
const entry = (pid, parentPid, commandLine, name = "node.exe") => ({ pid, parentPid, name, commandLine });

test("a Lab child started by absolute path inside either root is found, in either slash and any case", async () => {
  const processes = [
    entry(10, 1, "\"C:\\Program Files\\nodejs\\node.exe\" F:\\fxlab\\lab-ext\\scripts\\lab\\run-lab.mjs run basic-form"),
    entry(11, 10, "chrome.exe --load-extension=f:/FXLAB/lab-ext/apps/extension/.lab-instances/lab-pair/dist/e2e-chromium", "chrome.exe"),
    entry(12, 10, "node F:/fxlab/!FluxIQ/apps/web/node_modules/next/dist/bin/next build"),
    entry(13, 1, "node F:\\!FluxIQWebExtension\\scripts\\lab\\run-lab.mjs run basic-form"),
    entry(14, 1, "node F:/fxlab/lab-core/packages/fluxiq/dist/index.js"),
  ];
  assert.deepEqual((await processesUsingRoots(ROOTS, { processes, selfPid: 99 })).map((found) => found.pid), [10, 11, 12]);
});

test("a root named on its own, as an argument, does not count", async () => {
  const processes = [entry(20, 1, "node scripts/lab/pair.mjs --ext-root F:/fxlab/lab-ext --core dev")];
  assert.deepEqual(await processesUsingRoots(ROOTS, { processes, selfPid: 99 }), []);
});

test("this process and its ancestors are the ones asking, and never count", async () => {
  const processes = [
    entry(30, 1, "bash -c \"ls F:/fxlab/lab-ext/domain && pnpm lab:pair\"", "bash.exe"),
    entry(31, 30, "cmd.exe /d /s /c \"node F:/fxlab/lab-ext/scripts/lab/pair.mjs\"", "cmd.exe"),
    entry(32, 31, "node F:/fxlab/lab-ext/scripts/lab/pair.mjs"),
    entry(33, 30, "node F:/fxlab/lab-ext/scripts/lab/run-lab.mjs run basic-form"),
  ];
  assert.deepEqual((await processesUsingRoots(ROOTS, { processes, selfPid: 32 })).map((found) => found.pid), [33]);
});

test("a parent cycle in the listing does not loop", async () => {
  const processes = [entry(40, 41, "node x"), entry(41, 40, "node F:/fxlab/lab-ext/y.mjs")];
  assert.deepEqual(await processesUsingRoots(ROOTS, { processes, selfPid: 40 }), []);
});
