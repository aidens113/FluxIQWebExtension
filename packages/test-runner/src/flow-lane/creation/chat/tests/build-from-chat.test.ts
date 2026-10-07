import assert from "node:assert/strict";
import test from "node:test";
import { buildCreatedFlowFromChat } from "../build-from-chat.js";

test("qualification refuses before any control, authorizer, chat or provider work", async () => {
  const calls: string[] = [];
  const control = new Proxy({}, { get: (_target, key) => { calls.push(String(key)); return async () => { calls.push("effect"); }; } });
  await assert.rejects(async () => { await buildCreatedFlowFromChat(control as never, control as never, { projectId: "project", domainId: "web", instruction: "job" }); }, (error: unknown) => !!error && typeof error === "object" && "details" in error && (error.details as Record<string, unknown>)?.code === "lab.candidate_verification_unavailable");
  assert.deepEqual(calls, []);
});
