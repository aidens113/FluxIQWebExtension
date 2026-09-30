// Choosing an automation opens its thread in the chat and brings the chat to the front.

import assert from "node:assert/strict";
import test from "node:test";
import type { ChatTarget } from "../../chat";
import { chooseAutomation } from "../choose-automation";

test("choosing an automation calls chat.open with its flow, then shows the chat tab", () => {
  const calls: string[] = [];
  const opened: ChatTarget[] = [];
  const target = chooseAutomation({ flowId: "flow-7", name: "Weekly orders" }, {
    open: (next) => {
      calls.push("open");
      opened.push(next);
    },
    showChat: () => calls.push("showChat")
  });
  assert.deepEqual(opened, [{ kind: "automation", flowId: "flow-7", name: "Weekly orders" }]);
  assert.deepEqual(target, opened[0]);
  assert.deepEqual(calls, ["open", "showChat"], "the thread is chosen before the chat comes to the front");
});

test("only the flow's id and name reach the chat, whatever else the row carries", () => {
  const opened: ChatTarget[] = [];
  const row = { flowId: "flow-1", name: "Invoices", lines: ["Completed in 2.0s"], running: false, exporting: false, datasets: [] };
  chooseAutomation(row, { open: (next) => opened.push(next), showChat: () => undefined });
  assert.deepEqual(opened, [{ kind: "automation", flowId: "flow-1", name: "Invoices" }]);
});
