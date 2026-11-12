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
import { userActivation } from "./user-activation";

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

test("a dangerous act's permission ask is one press with no PIN, and goes as the panel always sent it", async (t) => {
  // A person's press in the panel: the browser reports an active user activation.
  userActivation(t, { isActive: true, hasBeenActive: true });
  await withFakeDocument(async () => {
    await withRuntime(async () => {
      const ask = { askId: "request.1", kind: "permission", status: "pending", missing: ["move_money"], consequences: ["move_money"], parks: true };
      const core = targetCore([{ conversationId: "conv-latest", subjectKind: "project", subjectId: "project-1", turns: [
        { turnId: "t1", author: "automation", text: "May I place the bid?", ask }
      ] }]);
      const chat = createChatPanel(core.request, () => ({ element: document.createElement("a"), observe: () => undefined }));
      chat.render(CONNECTED);
      await settle();
      await settle();
      const root = fake(chat.element);
      const allow = root.querySelectorAll("button").find((button) => button.textContent === "Allow")!;
      assert.ok(root.querySelectorAll("button").some((button) => button.textContent === "Don't allow"));
      allow.dispatch("click");
      await settle();
      await settle();
      const answers = core.sent.filter((message) => message.type === RUNTIME_MESSAGES.panelConversationAnswer);
      assert.equal(answers.length, 1);
      assert.equal(answers[0]!.kind, "grant");
      assert.equal(answers[0]!.authorizationPin, undefined);
      assert.ok(root.textContent.includes("You allowed this."));
      chat.setActive(false);
    });
  });
});

test("answers require a person's activation: a script's click and a press with no live activation both send nothing", async (t) => {
  const activation = { isActive: true, hasBeenActive: true };
  userActivation(t, activation);
  await withFakeDocument(async () => {
    await withRuntime(async () => {
      const ask = { askId: "request.1", kind: "permission", status: "pending", missing: ["move_money"], consequences: ["move_money"], parks: true };
      const core = targetCore([{ conversationId: "conv-latest", subjectKind: "project", subjectId: "project-1", turns: [
        { turnId: "t1", author: "automation", text: "May I place the bid?", ask }
      ] }]);
      const chat = createChatPanel(core.request, () => ({ element: document.createElement("a"), observe: () => undefined }));
      chat.render(CONNECTED);
      await settle();
      await settle();
      const root = fake(chat.element);
      const allow = () => root.querySelectorAll("button").find((button) => button.textContent === "Allow")!;
      const answers = () => core.sent.filter((message) => message.type === RUNTIME_MESSAGES.panelConversationAnswer);

      allow().click();
      allow().dispatchUntrusted("click");
      await settle();
      await settle();
      assert.equal(answers().length, 0, "an untrusted click does not answer");

      activation.isActive = false;
      allow().dispatch("click");
      await settle();
      await settle();
      assert.equal(answers().length, 0, "no live activation, no answer");
      assert.ok(!root.textContent.includes("You allowed this."));
      assert.ok(root.querySelectorAll("button").some((button) => button.textContent === "Allow"), "the question still waits for the person");
      chat.setActive(false);
    });
  });
});

test("a confirmation that takes a PIN is sent to FluxIQ: no Confirm to press, an open control, and Cancel still answers", async (t) => {
  // A person's press in the panel: the browser reports an active user activation.
  userActivation(t, { isActive: true, hasBeenActive: true });
  await withFakeDocument(async () => {
    await withRuntime(async () => {
      const ask = { askId: "panel-command.1", kind: "confirm", status: "pending", consequences: ["delete"], parks: false };
      const core = targetCore([{ conversationId: "conv-latest", subjectKind: "project", subjectId: "project-1", turns: [
        { turnId: "t1", author: "automation", text: "Delete it?", ask }
      ] }]);
      const purposes: Array<string | undefined> = [];
      const chat = createChatPanel(core.request, (style) => {
        purposes.push(style.purpose);
        const element = document.createElement("a");
        element.className = "opener";
        return { element, observe: () => undefined };
      });
      chat.render(CONNECTED);
      await settle();
      await settle();
      const root = fake(chat.element);
      const labels = root.querySelectorAll("button").map((button) => button.textContent);
      assert.ok(!labels.includes("Confirm") && !labels.includes("Yes"), "nothing here can settle it with nothing run");
      assert.ok(root.textContent.includes("Answer this in FluxIQ."));
      assert.equal(root.byClass("turn-ask")[0]!.byClass("opener").length, 1);
      assert.ok(purposes.includes("ask"));
      root.querySelectorAll("button").find((button) => button.textContent === "Cancel")!.dispatch("click");
      await settle();
      await settle();
      assert.equal(core.sent.filter((message) => message.type === RUNTIME_MESSAGES.panelConversationAnswer)[0]!.kind, "deny");
      chat.setActive(false);
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

test("a new browser with no project named and no thread yet can still write: the first message goes to the session's project", async () => {
  // The background names the session's project for a message that names none, asking FluxIQ for one when this
  // browser has none stored (`background/connection/project-context.ts`), so the chat never waits on the status for it.
  await withFakeDocument(async () => {
    await withRuntime(async () => {
      const core = targetCore([]);
      const request = async <T>(message: PanelMessage): Promise<PanelResult<T>> => {
        if (message.type === RUNTIME_MESSAGES.panelConversationRead && message.kind === "list-all") {
          core.sent.push(message);
          return { ok: true, value: { ok: true, payload: { conversations: [] } } as T };
        }
        return core.request<T>(message);
      };
      const chat = createChatPanel(request, () => ({ element: document.createElement("a"), observe: () => undefined }), { threadMemory: { recall: async () => undefined, keep: () => undefined } });
      chat.render(statusWith({ connectionState: "connected", paired: true }));
      chat.setActive(true);
      try {
        for (let beat = 0; beat < 4; beat += 1) await settle();
        const root = fake(chat.element);
        const box = root.descendants().find((element) => element.id === "conversationInput")!;
        assert.deepEqual(chat.target(), { kind: "latest" });
        assert.equal(box.disabled, false, "the composer takes typing");
        assert.equal(box.placeholder, "Message FluxIQ");
        assert.ok(root.byClass("composer-unavailable").every((reason) => reason.hidden), "no reason is shown over the composer");
        box.value = "Find cheap lamps";
        box.dispatch("input");
        box.dispatch("keydown", { key: "Enter", shiftKey: false, isComposing: false, keyCode: 13, preventDefault: () => undefined });
        for (let beat = 0; beat < 4; beat += 1) await settle();
        const sent = core.sent.filter((message) => message.type === RUNTIME_MESSAGES.panelConversationSend);
        assert.equal(sent.length, 1, "the first message is sent");
        assert.equal(sent[0]!.projectId, undefined, "the background names the project");
        assert.deepEqual(root.byClass("chat-msg").map((message) => message.textContent), ["Find cheap lamps"]);
      } finally {
        // A failed assertion must not leave the chat's poll running, which would keep the test process alive.
        chat.setActive(false);
      }
    });
  });
});

test("the panel shows Core's thread list as a drawer, reopens this window's remembered thread, and remembers the one on screen", async () => {
  await withFakeDocument(async () => {
    await withRuntime(async () => {
      const core = targetCore([
        { conversationId: "conv-1", subjectKind: "project", subjectId: "project-1", turns: [{ turnId: "a1", author: "person", text: "Find cheap lamps" }] },
        { conversationId: "conv-2", subjectKind: "project", subjectId: "project-1", turns: [{ turnId: "b1", author: "person", text: "Find a desk" }] }
      ]);
      const row = (conversationId: string, title: string, updatedAt: number) => ({
        conversationId, projectId: "project-1", revision: 1, status: "open", updatedAt, pendingAskCount: 0, title, subject: { kind: "project", id: "project-1" }
      });
      const request = async <T>(message: PanelMessage): Promise<PanelResult<T>> => {
        if (message.type === RUNTIME_MESSAGES.panelConversationRead && message.kind === "list-all") {
          core.sent.push(message);
          return { ok: true, value: { ok: true, payload: { conversations: [row("conv-2", "Desk", 2), row("conv-1", "Lamps", 1)] } } as T };
        }
        return core.request<T>(message);
      };
      const kept: Array<{ conversationId: string; projectId: string }> = [];
      const threadMemory = { recall: async () => ({ conversationId: "conv-1", projectId: "project-1" }), keep: (thread: { conversationId: string; projectId: string }) => { kept.push(thread); } };
      const chat = createChatPanel(request, () => ({ element: document.createElement("a"), observe: () => undefined }), { threadMemory });
      chat.render(CONNECTED);
      chat.setActive(true);
      for (let beat = 0; beat < 4; beat += 1) await settle();
      const root = fake(chat.element);
      assert.equal(root.byClass("chat-thread-toggle").length, 1, "the drawer's Chats button is drawn");
      assert.equal(root.byClass("chat-thread-nav")[0]!.getAttribute("data-layout"), "drawer");
      const listed = core.sent.filter((message) => message.type === RUNTIME_MESSAGES.panelConversationRead && message.kind === "list-all");
      assert.ok(listed.length > 0, "the list is read through the list-all relay");
      assert.equal(listed[0]!.projectId, "project-1");
      assert.deepEqual(chat.target(), { kind: "thread", conversationId: "conv-1", projectId: "project-1" }, "the remembered thread, not the newest");
      assert.deepEqual(root.byClass("chat-msg").map((message) => message.textContent), ["Find cheap lamps"]);
      assert.deepEqual(kept.at(-1), { conversationId: "conv-1", projectId: "project-1" });
      chat.setActive(false);
    });
  });
});
