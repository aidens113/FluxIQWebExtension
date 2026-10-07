import assert from "node:assert/strict";
import test from "node:test";
import { proveChatBuild } from "../chat-build.js";

test("in candidate authoring mode the probe never touches chat, controls, screenshots or provider", async () => {
  const touched: string[] = [];
  const forbidden = new Proxy({}, { get: (_target, key) => { touched.push(String(key)); throw new Error("Unexpected access"); } });
  const result = await proveChatBuild(forbidden as never, { control: forbidden as never, screenshot: forbidden as never, authoringMode: "candidate" });
  assert.equal(result.result.build.failure?.code, "lab.candidate_verification_unavailable");
  assert.equal(result.result.build.providerInvocation, "not_attempted");
  assert.equal(result.checks.qualificationAvailable, false);
  assert.equal(result.result.applied, null);
  assert.deepEqual(touched, []);
});

test("in legacy authoring mode, the default, the probe goes on to type into the chat", async () => {
  const context = { session: { panel: undefined }, projectId: "project", log: () => undefined };
  for (const mode of ["legacy" as const, undefined]) {
    await assert.rejects(proveChatBuild(context as never, { control: {} as never, screenshot: async () => undefined, ...(mode ? { authoringMode: mode } : {}) }), /The chat is not open/u);
  }
});
