import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writePlaybackSteps } from "../index.js";

async function scratch(t: test.TestContext): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "playback-steps-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

const SECRET = "hunter2-correct-horse";
const KEY = `sk-${"a".repeat(24)}`;

/** One command attempt as Core persists it, cut to the fields the writer reads plus the page snapshot it must not copy. */
function attempt(id: string, at: number, overrides: { actionType?: string; status?: string; text?: string; failure?: Record<string, unknown>; redacted?: boolean; page?: string } = {}) {
  const actionType = overrides.actionType ?? "web.dom.click";
  return {
    attempt: {
      attemptId: `attempt.${id}`, commandId: `command.${id}`, status: overrides.status ?? "succeeded", dispatchedAt: at, settledAt: at + 400,
      command: { kind: "execute_action", actionType, outputId: actionType, parameters: { selector: "#go", ...(overrides.text === undefined ? {} : { text: overrides.text }) } },
      result: {
        status: overrides.status ?? "succeeded", message: overrides.failure ? "Action refused by the page for now." : "Element clicked.",
        ...(overrides.failure ? { failure: overrides.failure } : {}),
        ...(overrides.page ? { metadata: { failureEvidence: { page: overrides.page } } } : {}),
        payload: { result: { url: "http://127.0.0.1:1/x", title: "Shop", snapshot: { interactiveElements: [{ value: "field value on the page" }] }, ...(overrides.text === undefined ? {} : { validation: { status: "passed", expected: `the field holds "${overrides.text}"`, actual: `the field holds "${overrides.text}"`, redacted: overrides.redacted === true } }) } },
      },
    },
  };
}

async function setUp(t: test.TestContext, attempts: Record<string, unknown>) {
  const root = await scratch(t);
  const attemptsDirectory = path.join(root, "command-attempts");
  const stepsDirectory = path.join(root, "steps");
  for (const [id, value] of Object.entries(attempts)) {
    await mkdir(path.join(attemptsDirectory, `attempt.${id}`), { recursive: true });
    await writeFile(path.join(attemptsDirectory, `attempt.${id}`, "attempt.json"), JSON.stringify(value));
  }
  // Core's own last step, which the playback is numbered after and listed beside.
  await mkdir(path.join(stepsDirectory, "0045-judge"), { recursive: true });
  await writeFile(path.join(stepsDirectory, "0045-judge", "meta.json"), JSON.stringify({ step: 45, kind: "judge", summary: "diagnosis: the Flow ran", costUsd: 0.001225 }));
  return { attemptsDirectory, stepsDirectory };
}

test("each playback attempt in the window becomes a run step after Core's, in dispatch order, and index.md lists them", async (t) => {
  const { attemptsDirectory, stepsDirectory } = await setUp(t, {
    build: attempt("build", 500),
    b: attempt("b", 2000, { status: "failed", failure: { category: "action_failed", code: "web.action.rate_limited", retryable: true, stage: "execution", expected: "the page accepts the press", actual: "it was busy", effect: "unacted" }, page: "PAGE \"Shop\"" }),
    a: attempt("a", 1000, { actionType: "web.dom.type", text: "3" }),
    replay: attempt("replay", 9000),
  });
  const written = await writePlaybackSteps({ attemptsDirectory, stepsDirectory, since: 1000, until: 5000, redactionLiterals: [] });
  assert.deepEqual(written, { steps: [46, 47], redacted: 0 });
  assert.deepEqual((await readdir(stepsDirectory)).sort(), ["0045-judge", "0046-run-web.dom.type", "0047-run-web.dom.click", "index.md"]);
  const typed = path.join(stepsDirectory, "0046-run-web.dom.type");
  assert.deepEqual(JSON.parse(await readFile(path.join(typed, "call.json"), "utf8")).parameters, { selector: "#go", text: "3" });
  const failed = path.join(stepsDirectory, "0047-run-web.dom.click");
  assert.deepEqual(JSON.parse(await readFile(path.join(failed, "meta.json"), "utf8")), {
    step: 47, kind: "run", callId: "attempt.b", toolId: "web.dom.click", startedAt: new Date(2000).toISOString(), finishedAt: new Date(2400).toISOString(), ms: 400,
    phase: "playback", status: "failed", resultCode: "web.action.rate_limited", failureCode: "web.action.rate_limited", message: "Action refused by the page for now.",
    summary: "web.action.rate_limited: Action refused by the page for now.",
  });
  const result = JSON.parse(await readFile(path.join(failed, "result.json"), "utf8"));
  assert.equal(result.failure.actual, "it was busy");
  assert.equal(await readFile(path.join(failed, "page.txt"), "utf8"), "PAGE \"Shop\"");
  assert.equal(JSON.stringify(result).includes("field value on the page"), false, "the page snapshot is never copied");
  assert.deepEqual((await readFile(path.join(stepsDirectory, "index.md"), "utf8")).split("\n").slice(-4), [
    "| 0045 | judge | - | diagnosis: the Flow ran | $0.001225 |",
    "| 0046 | run | web.dom.type | Element clicked. | - |",
    "| 0047 | run | web.dom.click | web.action.rate_limited: Action refused by the page for now. | - |",
    "",
  ]);
});

test("a declared literal, a credential shape and a value the extension marked redacted are never written", async (t) => {
  const { attemptsDirectory, stepsDirectory } = await setUp(t, {
    secret: attempt("secret", 1000, { actionType: "web.dom.type", text: SECRET }),
    sensitive: attempt("sensitive", 1100, { actionType: "web.dom.type", text: "4111 1111", redacted: true }),
    key: attempt("key", 1200, { status: "failed", failure: { code: "web.action.failed", actual: `Bearer ${"b".repeat(24)} and ${KEY}` } }),
  });
  const written = await writePlaybackSteps({ attemptsDirectory, stepsDirectory, since: 0, until: 5000, redactionLiterals: [SECRET] });
  assert.deepEqual(written.steps, [46, 47, 48]);
  for (const folder of await readdir(stepsDirectory)) {
    if (!folder.includes("-run-")) continue;
    for (const file of await readdir(path.join(stepsDirectory, folder))) {
      const content = await readFile(path.join(stepsDirectory, folder, file), "utf8");
      for (const leaked of [SECRET, "4111 1111", KEY, "b".repeat(24)]) assert.equal(content.includes(leaked), false, `${folder}/${file} holds ${leaked}`);
    }
    assert.equal(JSON.parse(await readFile(path.join(stepsDirectory, folder, "meta.json"), "utf8")).redacted, true, `${folder} says it was redacted`);
  }
});

test("a run with no command attempts writes nothing and leaves Core's index alone", async (t) => {
  const root = await scratch(t);
  assert.deepEqual(await writePlaybackSteps({ attemptsDirectory: path.join(root, "absent"), stepsDirectory: path.join(root, "steps"), since: 0, until: 1, redactionLiterals: [] }), { steps: [], redacted: 0 });
});
