// Which task is open lives in `chrome.storage.local` and nowhere else: it round-trips, a value
// that is not a task reads as nothing open, and a storage that will not answer never throws.

import assert from "node:assert/strict";
import test from "node:test";
import { extensionTasksMemory, OPEN_TASK_KEY } from "../task-memory";

type Items = Record<string, unknown>;

function withStorage(storage: unknown, lastError?: { message: string }): () => void {
  const scope = globalThis as unknown as { chrome?: unknown };
  const before = scope.chrome;
  scope.chrome = { runtime: { lastError }, storage: { local: storage } };
  return () => { scope.chrome = before; };
}

function memoryStorage(items: Items = {}) {
  return {
    items,
    get: (key: string, callback: (found: Items) => void) => callback({ [key]: items[key] }),
    set: (values: Items, callback: () => void) => {
      Object.assign(items, values);
      callback();
    }
  };
}

test("the open task is written, read back, and cleared", async () => {
  const storage = memoryStorage();
  const restore = withStorage(storage);
  try {
    const memory = extensionTasksMemory();
    assert.equal(await memory.read(), undefined);
    await memory.write({ projectId: "project-1", taskId: "task-1" });
    assert.deepEqual(storage.items[OPEN_TASK_KEY], { projectId: "project-1", taskId: "task-1" });
    assert.deepEqual(await memory.read(), { projectId: "project-1", taskId: "task-1" });
    await memory.write(undefined);
    assert.equal(await memory.read(), undefined);
  } finally { restore(); }
});

test("a stored value that is not a task reads as nothing open", async () => {
  for (const bad of ["text", 4, { projectId: "p" }, { projectId: "", taskId: "t" }, { projectId: 1, taskId: "t" }]) {
    const restore = withStorage(memoryStorage({ [OPEN_TASK_KEY]: bad }));
    try { assert.equal(await extensionTasksMemory().read(), undefined); } finally { restore(); }
  }
});

test("storage that errors or throws is nothing open, and a write that throws is dropped", async () => {
  const failing = withStorage(memoryStorage({ [OPEN_TASK_KEY]: { projectId: "p", taskId: "t" } }), { message: "quota" });
  try { assert.equal(await extensionTasksMemory().read(), undefined); } finally { failing(); }
  const throwing = withStorage({ get: () => { throw new Error("no storage"); }, set: () => { throw new Error("no storage"); } });
  try {
    const memory = extensionTasksMemory();
    assert.equal(await memory.read(), undefined);
    await memory.write({ projectId: "p", taskId: "t" });
  } finally { throwing(); }
});
