import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "@playwright/test";
import { createdFlowChatEntry } from "../chat-entry.js";

function fixture() {
  const order: string[] = [];
  let projectId = "project.old";
  let scopeState = "ready";
  const control = { evaluate: async (_fn: unknown, args: { action: string; projectId?: string; argument?: string }) => {
    if (args.action === "navigate") { order.push("select"); projectId = args.projectId!; return null; }
    if (args.action === "read") { order.push("read"); return { projectId, scopeState, composerAvailable: true, composerEnabled: scopeState === "ready" }; }
    if (args.action === "send") { order.push("send"); return "sent"; }
    throw new Error("Unexpected non-setup driver call");
  } } as unknown as Page;
  const chat = createdFlowChatEntry({
    extensionControl: control, livePanel: { mode: "side-panel" },
    core: { async automationStudioCall() { throw new Error("No direct Core build is allowed"); } },
    scope: { projectId: "project.new", domainId: "web-automation" },
    authorizeChat: async () => { order.push("authorize"); }, picture: async () => undefined
  });
  return { chat, order, move: (id: string, state = "ready") => { projectId = id; scopeState = state; } };
}

test("existing authorization precedes actual scoped empty-ready navigation and ordinary composer Send", async () => {
  const { chat, order } = fixture();
  await chat.entry.authorizeChat();
  await chat.entry.chat.type("public synthetic task");
  assert.deepEqual(order, ["authorize", "select", "read", "read", "send"]);
});

test("unprepared or changed scope prevents task Send after readiness", async () => {
  const { chat, order, move } = fixture();
  await assert.rejects(chat.entry.chat.type("not sent"), /not been prepared/);
  await chat.entry.authorizeChat();
  move("project.old");
  await assert.rejects(chat.entry.chat.type("not sent"), /not ready/);
  assert.equal(order.includes("send"), false);
});
