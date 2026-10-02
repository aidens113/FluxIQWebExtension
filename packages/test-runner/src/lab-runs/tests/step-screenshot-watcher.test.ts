import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { StepScreenshotWatcher, type StepCapture } from "../index.js";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 4, 5, 6]);

async function scratch(t: test.TestContext): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "step-screenshots-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function step(steps: string, name: string, complete: boolean): Promise<string> {
  const folder = path.join(steps, name);
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, "request.json"), "{}");
  if (complete) await writeFile(path.join(folder, "meta.json"), "{}");
  return folder;
}

async function until(condition: () => Promise<boolean>, timeoutMs = 5_000): Promise<void> {
  const endsAt = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > endsAt) throw new Error("the condition did not hold in time");
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

const listing = async (folder: string) => (await readdir(folder)).sort();

test("only complete tool and test steps are photographed, one capture at a time, in the image's real format", async t => {
  const steps = path.join(await scratch(t), "steps");
  const decide = await step(steps, "0001-decide", true);
  const tool = await step(steps, "0002-tool-core.run_node", true);
  let active = 0;
  let mostAtOnce = 0;
  let calls = 0;
  const capture: StepCapture = async () => {
    calls += 1; active += 1; mostAtOnce = Math.max(mostAtOnce, active);
    await new Promise(resolve => setTimeout(resolve, 15));
    active -= 1;
    return { bytes: calls === 1 ? PNG : JPEG };
  };
  const lines: string[] = [];
  const watcher = new StepScreenshotWatcher({ stepsDirectory: steps, capture, pollMs: 10, log: line => lines.push(line) });
  watcher.start();
  await until(async () => (await listing(tool)).includes("screenshot.png"));
  assert.deepEqual(await readFile(path.join(tool, "screenshot.png")), Buffer.from(PNG));

  // The model's next decision and a test replay: the replay is the newest page step, so it is photographed.
  await step(steps, "0003-decide", true);
  const replay = await step(steps, "0004-test-core.run_node", true);
  await until(async () => (await listing(replay)).includes("screenshot.jpg"));
  const pending = await step(steps, "0005-tool-core.read_page", false);
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.deepEqual(await listing(decide), ["meta.json", "request.json"], "a model step is not a page step");
  assert.deepEqual(await listing(pending), ["request.json"], "a step without meta.json is not complete");

  // It completes later and is photographed then; nothing is photographed twice.
  await writeFile(path.join(pending, "meta.json"), "{}");
  await until(async () => (await listing(pending)).includes("screenshot.jpg"));
  await watcher.stop();
  assert.deepEqual(await listing(tool), ["meta.json", "request.json", "screenshot.png"]);
  assert.equal(calls, 3);
  assert.equal(mostAtOnce, 1, "captures are serialized");
  assert.deepEqual(lines, []);
});

test("a step the next page step already acted after is marked skipped, never given a picture of the later page", async t => {
  const steps = path.join(await scratch(t), "steps");
  const passed = await step(steps, "0001-test-a", true);
  const newest = await step(steps, "0002-test-b", true);
  let calls = 0;
  let next: string | undefined;
  const capture: StepCapture = async () => {
    calls += 1;
    // The third page step starts while the second one's picture is being taken.
    if (calls === 1) next = await step(steps, "0003-tool-c", false);
    return { bytes: PNG };
  };
  const watcher = new StepScreenshotWatcher({ stepsDirectory: steps, capture, pollMs: 10 });
  watcher.start();
  await until(async () => (await listing(newest)).includes("screenshot.skipped.txt"));
  assert.match(await readFile(path.join(passed, "screenshot.skipped.txt"), "utf8"), /page step 0002-test-b had already started/u);
  assert.match(await readFile(path.join(newest, "screenshot.skipped.txt"), "utf8"), /page step 0003-tool-c started while this step's picture was being taken/u);
  assert.equal(calls, 1, "only the newest complete page step is captured");

  await writeFile(path.join(next!, "meta.json"), "{}");
  await until(async () => (await listing(next!)).includes("screenshot.png"));
  await watcher.stop();
  assert.equal(calls, 2);
});

test("a capture that fails, finds nothing or runs late writes the reason and never throws", async t => {
  const steps = path.join(await scratch(t), "steps");
  const answers: Array<() => Promise<{ bytes: Uint8Array } | undefined>> = [
    async () => { throw new Error("PrintWindow refused a window"); },
    async () => undefined,
    () => new Promise(resolve => setTimeout(() => resolve({ bytes: PNG }), 500)),
  ];
  let call = 0;
  const watcher = new StepScreenshotWatcher({ stepsDirectory: steps, capture: () => answers[call++]!(), pollMs: 10, deadlineMs: 50 });
  watcher.start();
  // One page step at a time, each the newest when it is seen.
  const failing = await step(steps, "0001-tool-a", true);
  await until(async () => (await listing(failing)).includes("screenshot.skipped.txt"));
  const nothing = await step(steps, "0002-tool-b", true);
  await until(async () => (await listing(nothing)).includes("screenshot.skipped.txt"));
  const late = await step(steps, "0003-tool-c", true);
  await until(async () => (await listing(late)).includes("screenshot.skipped.txt"));
  await watcher.stop();
  assert.match(await readFile(path.join(failing, "screenshot.skipped.txt"), "utf8"), /PrintWindow refused a window/u);
  assert.match(await readFile(path.join(nothing, "screenshot.skipped.txt"), "utf8"), /no capture source produced a picture/u);
  assert.match(await readFile(path.join(late, "screenshot.skipped.txt"), "utf8"), /took longer than 50 ms/u);
  assert.ok(!(await listing(late)).includes("screenshot.png"), "a late picture is dropped");
});

test("stop photographs the newest step finished since the last look, inside its budget", async t => {
  const steps = path.join(await scratch(t), "steps");
  let calls = 0;
  const watcher = new StepScreenshotWatcher({ stepsDirectory: steps, capture: async () => { calls += 1; await new Promise(resolve => setTimeout(resolve, 100)); return { bytes: PNG }; }, pollMs: 60_000, stopBudgetMs: 400 });
  watcher.start();
  const first = await step(steps, "0001-tool-a", true);
  const second = await step(steps, "0002-tool-b", true);
  await watcher.stop();
  assert.equal(calls, 1);
  assert.match(await readFile(path.join(first, "screenshot.skipped.txt"), "utf8"), /page step 0002-tool-b had already started/u);
  assert.ok((await listing(second)).includes("screenshot.png"));
  await watcher.stop();
  assert.equal(calls, 1, "a second stop does nothing");
});

test("stop marks a step skipped once its budget has run out", async t => {
  const steps = path.join(await scratch(t), "steps");
  const watcher = new StepScreenshotWatcher({ stepsDirectory: steps, capture: async () => ({ bytes: PNG }), pollMs: 60_000, stopBudgetMs: 0 });
  watcher.start();
  const only = await step(steps, "0001-tool-a", true);
  await watcher.stop();
  assert.match(await readFile(path.join(only, "screenshot.skipped.txt"), "utf8"), /run ended before this step was photographed/u);
});

test("a steps folder Core has not created yet is not an error", async t => {
  const lines: string[] = [];
  const watcher = new StepScreenshotWatcher({ stepsDirectory: path.join(await scratch(t), "steps"), capture: async () => ({ bytes: PNG }), pollMs: 5, log: line => lines.push(line) });
  watcher.start();
  await new Promise(resolve => setTimeout(resolve, 40));
  await watcher.stop();
  assert.deepEqual(lines, []);
});
