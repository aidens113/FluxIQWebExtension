// The extension's chat panel end to end through the package's chat, over a fake
// Core (`targetCore`): mounted, it reads the project's thread, a message the
// person sends reaches the background as the panel always sent it, and the
// reply shows. Its Open FluxIQ controls observe the extension's latest status.

import assert from "node:assert/strict";
import test from "node:test";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { ExtensionStatus } from "../../../shared/protocol";
import type { PanelMessage, PanelResult } from "../../state";
import { statusWith } from "../../tests/status-fixture";
import { createChatPanel, type OpenFluxIQControl } from "../chat-panel";
import { targetCore } from "../conversation/tests/target-core";
import { fake, withFakeDocument } from "./fake-dom";

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const CONNECTED = statusWith({ connectionState: "connected", paired: true, projectId: "project-1" });

async function withRuntime(body: () => Promise<void>): Promise<void> {
  const globals = globalThis as unknown as Record<string, unknown>;
  const before = globals.chrome;
  globals.chrome = { runtime: { onMessage: { addListener: () => undefined, removeListener: () => undefined } } };
  try {
    await body();
  } finally {
    globals.chrome = before;
  }
}

test("the panel mounts the chat, reads the thread, sends a message and shows the reply", async () => {
  await withFakeDocument(async () => {
    await withRuntime(async () => {
      const core = targetCore([
        { conversationId: "conv-latest", subjectKind: "project", subjectId: "project-1", turns: [{ turnId: "l1", author: "person", text: "Find cheap lamps" }] }
      ]);
      const request = async <T>(message: PanelMessage): Promise<PanelResult<T>> => {
        const answered = await core.request<T>(message);
        if (message.type === RUNTIME_MESSAGES.panelConversationSend) {
          core.thread("conv-latest")?.turns.push({ turnId: "l3", author: "automation", text: "Found three lamps." });
        }
        return answered;
      };
      const observed: ExtensionStatus[] = [];
      const control = (): OpenFluxIQControl => ({ element: document.createElement("a"), observe: (status) => observed.push(status) });
      const chat = createChatPanel(request, control);
      chat.render(CONNECTED);
      await settle();
      const root = fake(chat.element);
      const texts = () => root.byClass("chat-msg").map((message) => message.textContent);
      assert.deepEqual(texts(), ["Find cheap lamps"]);
      assert.ok(observed.length > 0 && observed.every((status) => status === CONNECTED), "the open controls see the extension's own status");

      const box = root.descendants().find((element) => element.id === "conversationInput")!;
      box.value = "Any under ten dollars?";
      box.dispatch("input");
      box.dispatch("keydown", { key: "Enter", shiftKey: false, isComposing: false, keyCode: 13, preventDefault: () => undefined });
      await settle();
      await settle();
      const sent = core.sent.filter((message) => message.type === RUNTIME_MESSAGES.panelConversationSend);
      assert.equal(sent.length, 1);
      assert.equal(sent[0]!.conversationId, "conv-latest");
      assert.equal(sent[0]!.text, "Any under ten dollars?");
      assert.deepEqual(texts(), ["Find cheap lamps", "Any under ten dollars?", "Found three lamps."]);
      assert.equal(box.value, "", "the box empties once FluxIQ has the message");
    });
  });
});

test("a status for another project is another owner: the last chat does not stay on screen", async () => {
  await withFakeDocument(async () => {
    await withRuntime(async () => {
      const core = targetCore([
        { conversationId: "conv-latest", subjectKind: "project", subjectId: "project-1", turns: [{ turnId: "l1", author: "person", text: "Find cheap lamps" }] }
      ]);
      const chat = createChatPanel(core.request, () => ({ element: document.createElement("a"), observe: () => undefined }));
      chat.render(CONNECTED);
      await settle();
      const root = fake(chat.element);
      assert.deepEqual(root.byClass("chat-msg").map((message) => message.textContent), ["Find cheap lamps"]);
      chat.render({ ...CONNECTED, projectId: "project-2", gatewayUrl: "ws://other.invalid/client" });
      assert.deepEqual(root.byClass("chat-msg").map((message) => message.textContent), []);
    });
  });
});
