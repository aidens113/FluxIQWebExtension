import assert from "node:assert/strict";
import { link, mkdir, mkdtemp, open, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { RunEvaluation } from "@fluxiq-web-extension/test-contracts";
import {
  createDurableJson,
  writeDurableJson,
  type DurableFileHandle,
  type DurableFileStage,
  type DurableFileSystem,
} from "../durable-file.js";
import { writeBenchMarkdown, writeBenchReport, writeBenchRuns, writeRunEvaluation, type BenchRunsFile } from "../report-store.js";

const nativeFileSystem: DurableFileSystem = {
  mkdir: (directory, options) => mkdir(directory, options),
  open: (file, flags, mode) => open(file, flags, mode),
  rename,
  link,
  remove: (file, options) => rm(file, options),
};

const codedError = (code: string): NodeJS.ErrnoException => Object.assign(new Error(code), { code });

async function temporaryRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "fluxiq-durable-file-"));
}

async function assertNoTemporary(directory: string): Promise<void> {
  assert.deepEqual((await readdir(directory)).filter((name) => name.endsWith(".tmp")), []);
}

test("faults at every publication checkpoint leave complete old-or-new JSON and clean only the owned sibling temporary", async () => {
  const beforePublication: DurableFileStage[] = ["temporary-created", "content-written", "file-synced", "file-closed"];
  const afterPublication: DurableFileStage[] = ["target-published", "before-directory-sync", "directory-synced"];
  for (const stage of [...beforePublication, ...afterPublication]) {
    const root = await temporaryRoot();
    try {
      const target = path.join(root, "state.json");
      await writeFile(target, `${JSON.stringify({ generation: "old" })}\n`, "utf8");
      await assert.rejects(writeDurableJson(target, { generation: "new" }, {
        platform: "win32",
        randomSuffix: () => stage,
        checkpoint: (current) => { if (current === stage) throw new Error(`interrupt:${stage}`); },
      }), new RegExp(`interrupt:${stage}`));
      assert.deepEqual(JSON.parse(await readFile(target, "utf8")), {
        generation: beforePublication.includes(stage) ? "old" : "new",
      });
      await assertNoTemporary(root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("a partial temporary write cannot truncate the published target", async () => {
  const root = await temporaryRoot();
  try {
    const target = path.join(root, "state.json");
    await writeFile(target, "{\"generation\":\"old\"}\n", "utf8");
    const fileSystem: DurableFileSystem = {
      ...nativeFileSystem,
      open: async (file, flags, mode) => {
        const handle = await open(file, flags, mode);
        return {
          close: () => handle.close(),
          sync: () => handle.sync(),
          writeFile: (async (contents: string) => {
            await handle.writeFile(contents.slice(0, Math.ceil(contents.length / 2)), "utf8");
            throw new Error("interrupted write");
          }) as DurableFileHandle["writeFile"],
        };
      },
    };
    await assert.rejects(writeDurableJson(target, { generation: "new", detail: "complete" }, { fileSystem }), /interrupted write/u);
    assert.deepEqual(JSON.parse(await readFile(target, "utf8")), { generation: "old" });
    await assertNoTemporary(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Windows replacement retries only bounded sharing violations and never unlinks the destination", async () => {
  const root = await temporaryRoot();
  try {
    const target = path.join(root, "state.json");
    await writeFile(target, "old", "utf8");
    const errors = ["EPERM", "EACCES", "EBUSY"];
    const delays: number[] = [];
    const removed: string[] = [];
    let calls = 0;
    const fileSystem: DurableFileSystem = {
      ...nativeFileSystem,
      rename: async (source, destination) => {
        const code = errors[calls++];
        if (code) throw codedError(code);
        await rename(source, destination);
      },
      remove: async (file, options) => { removed.push(file); await rm(file, options); },
    };
    await writeDurableJson(target, { complete: true }, { fileSystem, platform: "win32", sleep: async (delay) => { delays.push(delay); } });
    assert.deepEqual([calls, delays], [4, [10, 20, 40]]);
    assert.ok(removed.every((file) => file !== target));
    assert.deepEqual(JSON.parse(await readFile(target, "utf8")), { complete: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("non-sharing rename errors and exhausted Windows retries fail closed with the old target", async () => {
  // The replace-mode rename keeps its short 10-80 ms schedule; only temporary removal waits longer.
  for (const [code, expectedCalls, expectedDelays] of [["EIO", 1, []], ["EPERM", 5, [10, 20, 40, 80]]] as const) {
    const root = await temporaryRoot();
    try {
      const target = path.join(root, "state.json");
      await writeFile(target, "old", "utf8");
      let calls = 0;
      const delays: number[] = [];
      const fileSystem: DurableFileSystem = { ...nativeFileSystem, rename: async () => { calls += 1; throw codedError(code); } };
      await assert.rejects(writeDurableJson(target, { complete: true }, { fileSystem, platform: "win32", sleep: async (delay) => { delays.push(delay); } }), (error: NodeJS.ErrnoException) => error.code === code);
      assert.deepEqual([calls, delays, await readFile(target, "utf8")], [expectedCalls, expectedDelays, "old"]);
      await assertNoTemporary(root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("temporaries are private exclusive siblings and writes to one target serialize", async () => {
  const root = await temporaryRoot();
  try {
    const target = path.join(root, "nested", "state.json");
    const opens: Array<{ file: string; flags: string; mode: number | undefined }> = [];
    let fileSyncs = 0;
    const stages: string[] = [];
    let releaseFirst!: () => void;
    let markFirstCreated!: () => void;
    const held = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const firstCreated = new Promise<void>((resolve) => { markFirstCreated = resolve; });
    const fileSystem: DurableFileSystem = {
      ...nativeFileSystem,
      open: async (file, flags, mode) => {
        opens.push({ file, flags, mode });
        const handle = await open(file, flags, mode);
        if (!file.endsWith(".tmp")) return handle;
        return {
          writeFile: ((...args: Parameters<DurableFileHandle["writeFile"]>) => handle.writeFile(...args)) as DurableFileHandle["writeFile"],
          sync: async () => { fileSyncs += 1; await handle.sync(); },
          close: () => handle.close(),
        };
      },
    };
    const first = writeDurableJson(target, { order: 1 }, {
      fileSystem,
      randomSuffix: () => "first",
      checkpoint: async (stage) => { if (stage === "temporary-created") { stages.push("first-created"); markFirstCreated(); await held; } },
    });
    await firstCreated;
    const second = writeDurableJson(target, { order: 2 }, {
      fileSystem,
      randomSuffix: () => "second",
      checkpoint: (stage) => { if (stage === "temporary-created") stages.push("second-created"); },
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(stages, ["first-created"]);
    releaseFirst();
    await Promise.all([first, second]);
    assert.deepEqual(stages, ["first-created", "second-created"]);
    const temporaryOpens = opens.filter(({ file }) => file.endsWith(".tmp"));
    assert.equal(temporaryOpens.length, 2);
    assert.ok(temporaryOpens.every(({ file, flags, mode }) => path.dirname(file) === path.dirname(target) && flags === "wx" && mode === 0o600));
    assert.equal(fileSyncs, 2);
    assert.deepEqual(JSON.parse(await readFile(target, "utf8")), { order: 2 });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("immutable publication refuses duplicates without replacing the first complete value", async () => {
  const root = await temporaryRoot();
  try {
    const target = path.join(root, "evaluations", "run-one.json");
    await createDurableJson(target, { attempt: 1 });
    await assert.rejects(createDurableJson(target, { attempt: 2 }), (error: NodeJS.ErrnoException) => error.code === "EEXIST");
    assert.deepEqual(JSON.parse(await readFile(target, "utf8")), { attempt: 1 });
    await assertNoTemporary(path.dirname(target));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/** Native filesystem whose removals of `.tmp` names fail with `codes[i]` on the i-th call, then really remove. */
function failingTemporaryRemoval(codes: readonly string[]): { fileSystem: DurableFileSystem; removals: () => number } {
  let calls = 0;
  const fileSystem: DurableFileSystem = {
    ...nativeFileSystem,
    remove: async (file, options) => {
      if (!file.endsWith(".tmp")) throw new Error(`durable writer removed a non-temporary: ${file}`);
      const code = codes[calls++];
      if (code) throw codedError(code);
      await rm(file, options);
    },
  };
  return { fileSystem, removals: () => calls };
}

const REMOVAL_DELAYS_MS = [10, 20, 40, 80, 160, 320, 640, 1280];
const sharingFailures = (count: number): string[] => Array.from({ length: count }, (_, index) => ["EBUSY", "EPERM", "EACCES"][index % 3]!);

test("Windows immutable publication retries sharing violations on its owned temporary through the long removal schedule and leaves none", async () => {
  for (const codes of [sharingFailures(1), sharingFailures(5), sharingFailures(8)]) {
    const root = await temporaryRoot();
    try {
      const target = path.join(root, "evaluations", "run-one.json");
      const { fileSystem, removals } = failingTemporaryRemoval(codes);
      const delays: number[] = [];
      const stages: DurableFileStage[] = [];
      await createDurableJson(target, { attempt: 1 }, { fileSystem, platform: "win32", sleep: async (delay) => { delays.push(delay); }, checkpoint: (stage) => { stages.push(stage); } });
      assert.deepEqual([removals(), delays], [codes.length + 1, REMOVAL_DELAYS_MS.slice(0, codes.length)]);
      assert.deepEqual(stages, ["temporary-created", "content-written", "file-synced", "file-closed", "target-published", "before-directory-sync", "directory-synced"]);
      assert.deepEqual(await readdir(path.dirname(target)), ["run-one.json"]);
      assert.deepEqual(JSON.parse(await readFile(target, "utf8")), { attempt: 1 });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("a temporary that outlives bounded removal retries fails the publication closed and names the owned file", async () => {
  for (const [platform, codes, expectedRemovals, expectedDelays] of [
    ["win32", sharingFailures(9), 9, REMOVAL_DELAYS_MS],
    ["win32", ["EIO"], 1, []],
    ["linux", ["EBUSY"], 1, []],
  ] as const) {
    const root = await temporaryRoot();
    try {
      const target = path.join(root, "evaluations", "run-one.json");
      const { fileSystem, removals } = failingTemporaryRemoval(codes);
      const delays: number[] = [];
      const stages: DurableFileStage[] = [];
      let temporary = "";
      await assert.rejects(createDurableJson(target, { attempt: 1 }, {
        fileSystem, platform, randomSuffix: () => "0123abcd",
        sleep: async (delay) => { delays.push(delay); },
        checkpoint: (stage, paths) => { stages.push(stage); temporary = paths.temporary; },
      }), (error: NodeJS.ErrnoException & { target?: string; temporary?: string }) => {
        assert.equal(error.code, "ERR_DURABLE_TEMPORARY_LEFT");
        assert.deepEqual([error.target, error.temporary], [target, temporary]);
        assert.equal((error.cause as NodeJS.ErrnoException).code, codes.at(-1));
        return true;
      });
      assert.deepEqual([removals(), delays], [expectedRemovals, expectedDelays]);
      assert.deepEqual(stages, ["temporary-created", "content-written", "file-synced", "file-closed", "target-published"]);
      assert.equal(temporary, path.join(path.dirname(target), `.run-one.json.${process.pid}.0123abcd.tmp`));
      assert.deepEqual((await readdir(path.dirname(target))).sort(), [path.basename(temporary), "run-one.json"].sort());
      assert.deepEqual(await readFile(temporary), await readFile(target));
      assert.deepEqual(JSON.parse(await readFile(target, "utf8")), { attempt: 1 });
      await assert.rejects(createDurableJson(target, { attempt: 2 }), (error: NodeJS.ErrnoException) => error.code === "EEXIST");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("an unpublished immutable write keeps its original error while retrying removal of its temporary", async () => {
  const root = await temporaryRoot();
  try {
    const target = path.join(root, "run-one.json");
    await writeFile(target, "first", "utf8");
    const { fileSystem, removals } = failingTemporaryRemoval(["EBUSY", "EPERM"]);
    const delays: number[] = [];
    await assert.rejects(createDurableJson(target, { attempt: 2 }, { fileSystem, platform: "win32", sleep: async (delay) => { delays.push(delay); } }), (error: NodeJS.ErrnoException) => error.code === "EEXIST");
    assert.deepEqual([removals(), delays], [3, [10, 20]]);
    assert.deepEqual(await readdir(root), ["run-one.json"]);
    assert.equal(await readFile(target, "utf8"), "first");

    const persistent = failingTemporaryRemoval(sharingFailures(9));
    await assert.rejects(createDurableJson(target, { attempt: 3 }, { fileSystem: persistent.fileSystem, platform: "win32", sleep: async () => undefined }), (error: NodeJS.ErrnoException) => error.code === "EEXIST");
    assert.equal(persistent.removals(), 9);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("supported parent-directory sync is attempted and unsupported sync is best effort", async () => {
  const root = await temporaryRoot();
  try {
    const target = path.join(root, "state.json");
    let directorySyncs = 0;
    const fileSystem: DurableFileSystem = {
      ...nativeFileSystem,
      open: async (file, flags, mode) => file === root
        ? {
            writeFile: (async () => undefined) as DurableFileHandle["writeFile"],
            sync: async () => { directorySyncs += 1; throw codedError("ENOTSUP"); },
            close: async () => undefined,
          }
        : open(file, flags, mode),
    };
    await writeDurableJson(target, { complete: true }, { fileSystem, platform: "linux" });
    assert.equal(directorySyncs, 1);
    assert.deepEqual(JSON.parse(await readFile(target, "utf8")), { complete: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("report store replaces mutable projections and creates evaluations immutably", async () => {
  const root = await temporaryRoot();
  try {
    const runs: BenchRunsFile = {
      schemaVersion: "0.1", benchId: "bench-test-1234abcd", corpusId: "smoke", repeatCount: 1,
      target: "isolated", lanes: ["recording"], startedAt: "2026-09-14T00:00:00.000Z", sources: {}, runs: [],
    };
    await writeBenchRuns(root, runs);
    await writeBenchRuns(root, { ...runs, finishedAt: "2026-09-14T00:01:00.000Z" });
    assert.equal(JSON.parse(await readFile(path.join(root, "runs.json"), "utf8")).finishedAt, "2026-09-14T00:01:00.000Z");

    const report = { schemaVersion: "0.1", reportId: "report-one" } as unknown as Parameters<typeof writeBenchReport>[1];
    await writeBenchReport(root, report);
    await writeBenchReport(root, { ...report, reportId: "report-two" });
    await writeBenchMarkdown(root, "first");
    await writeBenchMarkdown(root, "second");
    assert.equal(JSON.parse(await readFile(path.join(root, "report.json"), "utf8")).reportId, "report-two");
    assert.equal(await readFile(path.join(root, "report.md"), "utf8"), "second");

    const evaluation = { runId: "run-one", schemaVersion: "0.2", facilityFailure: null } as unknown as RunEvaluation;
    assert.equal(await writeRunEvaluation(root, evaluation), "evaluations/run-one.json");
    await assert.rejects(writeRunEvaluation(root, evaluation), (error: NodeJS.ErrnoException) => error.code === "EEXIST");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
