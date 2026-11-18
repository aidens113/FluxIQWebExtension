import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { startProofEngine } from "../engine.js";
import { hostProofProcessExit } from "../process-exit.js";

for (const code of [0, 7]) test(`IPC disconnect drains output and ${code === 0 ? "accepts exit 0" : "refuses exit 7"}`, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fluxiq-proof-exit-"));
  let engine: Awaited<ReturnType<typeof startProofEngine>> | undefined;
  try {
    const entry = path.join(directory, "packages/fluxiq/dist/server/cli/main.js");
    await mkdir(path.dirname(entry), { recursive: true });
    await writeFile(path.join(directory, "package.json"), JSON.stringify({ type: "module" }));
    await writeFile(entry, [
      `import { sendHostProofEvent } from ${JSON.stringify(new URL("../events.js", import.meta.url).href)};`,
      `process.on("disconnect", () => {`,
      `  sendHostProofEvent({ type: "proof.network", violations: 0 });`,
      `  process.stderr.write("engine-tail-${code}\\n", () => process.exit(${code}));`,
      `});`,
      `process.on("message", (message) => {`,
      `  if (message.type === "proof.flush") {`,
      `    sendHostProofEvent({ type: "proof.action", runId: "unit-run" });`,
      `    sendHostProofEvent({ type: "proof.flushed", id: message.id });`,
      `  }`,
      `});`,
      `process.send({ type: "fluxiq.ready", apiUrl: "http://127.0.0.1:1" });`
    ].join("\n"));
    engine = await startProofEngine({ coreRoot: directory, dataDir: directory, evidenceDirectory: directory, environment: {}, hosts: 0, marker: `unit-${code}` });
    await Promise.all([engine.flushEvents(), engine.flushEvents()]);
    assert.equal(engine.events.filter((event) => event.type === "proof.action").length, 2);
    if (code === 0) await engine.stop();
    else await assert.rejects(engine.stop(), /did not stop normally \(exit 7/u);
    assert.match(await readFile(path.join(directory, `unit-${code}.log`), "utf8"), new RegExp(`engine-tail-${code}`));
  } finally {
    if (engine && engine.child.exitCode === null && engine.child.signalCode === null) {
      engine.child.kill();
      await hostProofProcessExit(engine.child);
    }
    const absolute = path.resolve(directory);
    assert.equal(path.dirname(absolute), path.resolve(os.tmpdir()));
    assert.ok(path.basename(absolute).startsWith("fluxiq-proof-exit-"));
    await rm(absolute, { recursive: true, force: true });
  }
});
